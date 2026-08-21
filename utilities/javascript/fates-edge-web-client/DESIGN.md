# Fate's Edge Web Client — Design

This document covers the web client's architecture: how a self-contained, `localStorage`-backed single-page app became a real-time collaborative one without losing the ability to run entirely offline. For the server side of this — rooms, persistence, scaling — see the socket server's own [`DESIGN.md`](../fates-edge-socket-server/DESIGN.md), [`ROLES.md`](../fates-edge-socket-server/ROLES.md), and [`SCALING.md`](../fates-edge-socket-server/SCALING.md); that's the server repo's job to document, and this file doesn't duplicate it.

## Starting point

The client's original model was simple: every tab reads and writes a single state object, that object is mirrored to `localStorage` on every change, and "sharing" a campaign meant exporting the whole thing as JSON and sending it to someone, or later, uploading it to a server under a short code for someone else to download. That still works today — it's the offline/solo path, and the campaign-sharing short-code flow the socket server exposes at `/api/rooms/:code/campaigns` is a direct descendant of it. But it has an obvious ceiling: two people can't be looking at the same room at the same time, and every sync is a full-state transfer with no idea what changed.

The real-time layer, `js/core/sync/`, sits between the feature modules and the network without replacing that foundation. A feature module still just reads and writes local state; the sync layer's job is to notice those writes, turn them into operations, get them to the server and back out to everyone else in the room, and reconcile whatever comes back — including the case where two people changed the same thing while both were offline.

```
Feature modules (characters, timers, wiki, encounters, chat, decks, …)
              │  read/write local state
              ▼
        Sync layer (js/core/sync/)
   ┌─────────────┬──────────────┬──────────────┐
   │ SyncManager │ OfflineQueue │ Conflict-     │
   │ (index.js)  │ (IndexedDB)  │ Resolver /    │
   │             │              │ Presence      │
   └─────────────┴──────────────┴──────────────┘
              │  WebSocket (Socket.IO or plain ws)
              ▼
        Socket server — authoritative room state
```

## Connecting: handshake, heartbeat, and soft auth

`SyncManager` (`sync/index.js`) owns the WebSocket connection. On connect it sends a `handshake` message — campaign code, room password (if the room has one), client id/name/email, requested role, and an optional `authToken`. The token is a JWT from the account system if the browser has one saved, but it's genuinely optional: an omitted or invalid token doesn't fail the handshake, it just makes the join proceed anonymously, exactly as it would have before account auth existed. The room password (server-checked) is what actually gates entry to a locked room; the auth token is what lets the server attach a returning player to their saved character library.

A 30-second heartbeat keeps the connection alive and lets the client detect a silently-dead socket faster than the browser's own timeout would. On disconnect, `SyncManager` doesn't just give up — it retries with exponential backoff (`reconnectDelay * 2^attempts`, capped at 30 seconds) up to a configured attempt limit, and only then falls back to a visible "couldn't reconnect, refresh" state. Every successful reconnect re-sends the handshake and receives a fresh full state snapshot plus the room's current version vector (see below), so a client that was offline for five seconds and one that was offline for five hours go through the same recovery path.

## Operations: the vocabulary of change

Every mutation a feature module makes — adding a character, ticking a timer, editing a wiki entry — becomes an **operation**: a typed, addressed description of the change (`ADD_CHARACTER`, `UPDATE_TIMER`, `DELETE_WIKI_ENTRY`, and so on — the full list is `OPERATION_TYPES` in `sync/operations.js`), carrying the origin client's id, a path to the affected data, and the new value. `validateOperation()` checks an operation's shape before it's sent or applied, so a malformed local write can't get relayed to the rest of the room. Operations, not raw state diffs, are what travels over the wire — which is also what makes selective conflict handling possible: the resolver knows *what kind* of change is colliding, not just that two blobs of JSON disagree.

## Conflict resolution

`ConflictResolver` (`sync/conflict.js`) picks a resolution strategy per operation type — not one global "last write wins" rule. A few examples, straight from the resolver's own strategy names:

- **`delete_wins`** — if one client deletes a character while another edits it, the delete wins. There's nothing to reconcile a field-level edit against once the record is gone.
- **`merge_character_add`** / **`merge_timer_add`** / **`merge_wiki_add`** — if two clients independently add what's effectively the same new record (same id, added while both were offline), the resolver merges them into one rather than creating a duplicate or picking a arbitrary winner.
- **`merge_timer_ticks`** — concurrent ticks on the same timer accumulate instead of one clobbering the other, which matches how a timer is actually used at a table (multiple people advancing the same countdown).
- **`no_conflict`** — most pairs of operations don't actually touch the same data and are just applied in order.
- **`*_already_exists`** / **`*_not_found`** — bookkeeping outcomes for the edge cases (an add racing a delete, two adds of literally the same id) that don't fit a clean merge.

Append-only data — chat messages, roll history, deck history — has no conflict strategy because it doesn't need one: two people posting to the same log at the same time is just two log entries, not a collision.

## State versioning

Each client tracks a **version vector**: a map of `clientId → last operation id seen from that client`. A new connection (or a reconnection after any gap) gets the room's full current state plus its version vector in one shot — `mergeState(state, versionVector)` — rather than a delta stream it would have to reconstruct from scratch. From there, individual operations update the vector incrementally as they arrive. This is deliberately simpler than trying to replay a precise operation log across a reconnect: a full-state resync is a little more bandwidth on reconnect, in exchange for a client never being in a state it can't fully explain from what the server just sent it.

## Offline support

`OfflineQueue` (`sync/offline-queue.js`) persists queued operations to **IndexedDB**, with an in-memory fallback if IndexedDB isn't available. Every local write that happens while disconnected gets enqueued rather than dropped; `flush(sendFn)` replays the queue in order once the connection comes back, and a failed send leaves an operation in the queue for the next flush rather than losing it. Combined with the reconnection backoff above, this is what makes "close the laptop mid-session, open it again later" a non-event — queued local changes go out, the server's changes since then come back as part of the reconnect handshake, and the conflict resolver reconciles anything that touched the same records.

## Presence

`PresenceManager` (`sync/presence.js`) is deliberately the simplest piece of this system: it's just a `Map` of connected clients, updated from the server's own client-list broadcasts, with helpers for "who else is here" and "is this specific client online." It backs the VTT's "Party Members" list and the presence indicators elsewhere in the UI — there's no separate presence protocol to maintain, it's a thin read model over data the server already sends.

## How a feature module plugs in

A feature module doesn't talk to the WebSocket directly. It reads and writes through the normal local state API, and registers handlers for the operation types it cares about (see `setupSyncListeners()` and the `*Handler` functions in `sync/index.js`) so that when an operation for, say, `update_character` arrives from the server, the Characters feature's own render logic re-runs the same way it would after a local edit. This is why adding real-time behavior to a new feature is additive rather than a rewrite: define its operation types, wire up handlers that apply an incoming operation to local state, and the sync layer, offline queue, and conflict resolver all pick it up for free.

**Kon'reh** and **Toll & Veil** take a slightly different path: rather than defining a full set of bespoke operation types for two turn-based games, they ride a generic `event` passthrough that the socket server relays to a room without needing to understand its payload (see the socket server's own `DESIGN.md`). That keeps game-specific logic entirely client-side while still getting a host-authoritative real-time table for free.

## What the player sees

Connection state, presence, and conflicts surface without a player needing to think about any of the above: a toast when someone joins or leaves, a live-updating "who's online" list, a flash on a UI element someone else just changed, a banner when the connection drops, and a toast plus a brief resync when it comes back. Where a conflict can't resolve itself cleanly, the affected feature surfaces a choice rather than silently picking a side.

## Security posture

The room password gates entry; the optional account JWT (soft, as described above) attaches a returning player to their saved characters. Every operation is validated server-side regardless of what the client claims about itself — the server is the authority on room membership and on whether an operation is well-formed, the same trust model as the REST API (see the socket server's `DESIGN.md` §5 for its rate limiting and input validation). On the client, DOMPurify sanitizes any user-authored rich text (card text, custom content) before it's rendered, with an empty attribute allowlist — see [`ACCESSIBILITY.md`](ACCESSIBILITY.md) for why that also happens to block `aria-*`/`role` injection as a side effect.

## Testing

`npm test` runs `tests/runner.js`, a small hand-rolled test framework (`assert`/`assertEqual`/`assertTrue`, no Jest) with `tests/support/dom-shim.js` providing a deliberately minimal DOM/localStorage/window stub. The sync layer's unit tests exercise the conflict resolver's per-type strategies directly, and integration-style tests drive two simulated clients through connect/operation/reconnect sequences against that shim rather than a real server. It's a lighter-weight harness than a full browser test runner by design — see `tests/support/dom-shim.js`'s own header comment for the reasoning — which is also why real accessibility regression coverage needs a separate, real-browser test target rather than extending this one (see [`ACCESSIBILITY.md`](ACCESSIBILITY.md)).
