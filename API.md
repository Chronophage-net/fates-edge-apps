Here's a complete API reference for the Fate's Edge WebSocket server, covering both the REST API and the WebSocket event protocol. This document is kept in sync with the actual server code in `utilities/javascript/fates-edge-socket-server/server/` (`api.js`, `ws-handlers.js`, `socketio-handlers.js`, `adventure.js`). The server also exposes its own REST reference live at `GET /api/data/docs` (no auth required) — if this file and that endpoint ever disagree, trust the running server.

---

# Fate's Edge WebSocket Server – API Reference

The server provides two interfaces:

- **REST API** (HTTP) – for administration, deck management, module control, the Adventure Engine, whiteboard/grid-combat, character storage, campaign sharing, and player moderation.
- **WebSocket API** – for real‑time collaboration (chat, dice, deck draws, presence, GM election, whiteboard, the Adventure Engine, etc.). Supports both **Socket.io** and **plain WebSocket** connections, which offer equivalent functionality over two different message-framing conventions (see below).

---

## 🔐 Authentication

### REST API

All REST endpoints (except `/healthz`, `/api/healthz`, and `/api/data/docs`) require an API key. Pass it as either:

- HTTP header: `x-api-key: your-key-here`
- Query parameter: `?apiKey=your-key-here`

### WebSocket

No API key is required for WebSocket connections. Clients identify themselves via a **handshake** message (plain WS) or **join-room** event (Socket.io). The server assigns roles (`gm` or `player`) based on the first claimer or GM election.

---

## 🌐 Base URL

The server runs on the configured host and port (default `0.0.0.0:10000`).
For local development: `http://localhost:10000/api`

Some third-party integrations in this repo (Discord bot, Foundry bridge) previously shipped with a stale `ws://localhost:3000` default — if you're troubleshooting a mod/bot that can't connect, check its configured server URL against the actual port your server is running on.

---

## 📊 REST API Endpoints

### Health

**`GET /healthz`**
**`GET /api/healthz`**
Returns `"OK"` with status 200. No auth required.

**`GET /api/health`** (or custom `healthEndpoint` from config)
Returns server stats and room overview. No auth required.

**Example response:**
```json
{
  "status": "ok",
  "timestamp": 1690000000000,
  "uptime": 12345.6,
  "stats": {
    "totalRooms": 2,
    "rooms": [
      {
        "code": "AC12",
        "name": "Room AC12",
        "clients": 3,
        "deckRemaining": 47,
        "historyCount": 12,
        "lastActivity": 1690000000000,
        "created": 1690000000000
      }
    ]
  }
}
```

**`GET /api/data/docs`** — no auth required
Self-documenting JSON reference of every REST endpoint below, generated straight from the router. Useful as a live sanity check against this document.

---

### Rooms

**`GET /api/rooms`**
*Auth required*
Lists all rooms with stats.

**Response:**
```json
{
  "rooms": [ ... ],
  "count": 2,
  "timestamp": 1690000000000
}
```

---

### Deck Operations

All deck endpoints are scoped to a room: `/api/rooms/:code/deck/...`

**`GET /api/rooms/:code/deck`**
Get the current deck state.

**Response:**
```json
{
  "code": "AC12",
  "name": "Room AC12",
  "deck": [ ... cards ... ],
  "deckHistory": [ ... ],
  "remaining": 47,
  "offset": 123
}
```

**`POST /api/rooms/:code/deck/shuffle`**
Shuffles the deck. Notifies room via `deck-shuffled`.

**`POST /api/rooms/:code/deck/draw`**
Draws cards from the deck.
**Request body:**
```json
{
  "count": 1,        // 1–5
  "region": "Acasia" // optional
}
```
If count == 5, a Crown Spread is synthesised instead of individual consequences. Notifies room via `deck-drawn`.

**`POST /api/rooms/:code/deck/crown`**
Explicitly perform a Crown Spread (5 cards).
**Request body:**
```json
{
  "region": "Acasia"
}
```
Notifies room via `crown-spread`.

**`GET /api/rooms/:code/deck/history?limit=50`**
Retrieve draw history.

**`DELETE /api/rooms/:code/deck/history`**
Clear deck history. Notifies room via `deck-history-cleared`.

**`GET /api/rooms/:code/deck/seed`**
Get the room's current deck PRNG seed.
**Response:**
```json
{
  "code": "AC12",
  "seed": 1234567890
}
```

**`POST /api/rooms/:code/deck/seed`**
Reseed the room's per-room PRNG and reshuffle the deck.
**Request body:**
```json
{
  "seed": 1234567890
}
```
`seed` is required and may be any JSON-serializable seed value. Notifies room via `deck-shuffled` with `{ reason: "reseeded", ... }`.
**Response:**
```json
{
  "success": true,
  "code": "AC12",
  "seed": 1234567890,
  "remaining": 54
}
```

---

### Player / Client Management (Ban/Kick)

**`GET /api/rooms/:code/clients`**
List all clients in a room.

**Response:**
```json
{
  "code": "AC12",
  "clients": [
    { "id": "ws-123...", "name": "Alice", "role": "gm", "email": "" },
    { "id": "socketio-id...", "name": "Bob", "role": "player", "email": "" }
  ]
}
```

**`POST /api/rooms/:code/clients/:clientId/kick`**
Kick a client from the room.
**Request body (optional):**
```json
{ "reason": "Disruptive behaviour" }
```

**`POST /api/rooms/:code/clients/:clientId/ban`**
Ban a client (kicks them and adds to ban list).
**Request body (optional):**
```json
{ "reason": "Spamming" }
```

**`POST /api/rooms/:code/clients/:clientId/unban`**
Remove a client ID from the ban list.

---

### Modules

**`GET /api/modules`** — also aliased at **`GET /api/rooms/:code/modules`** (the module catalog isn't actually room-scoped; the alias exists because some callers always build URLs under `/rooms/:code/...`)
List available modules — legacy folders under `server/modules/` plus standalone adventure JSON files under `data/adventures/`.

**`POST /api/modules`**
Permanently install an adventure module: writes `manifest.json` + `adventure.json` under `server/modules/<id>/`, so it's visible to everyone from then on (unlike `POST /api/rooms/:code/adventure/load-custom`, which only exists in one room's memory).
**Request body:**
```json
{
  "id": "my-adventure",
  "content": { "title": "...", "acts": [ ... ] },
  "manifest": { "name": "...", "tier": "1-3" },  // optional; derived from content if omitted
  "overwrite": false
}
```

**`POST /api/modules/:id/push`**
Push a module to a room or all rooms. Notifies clients via `module-push`.
**Request body:**
```json
{ "roomCode": "AC12" }  // optional; if omitted, push to all rooms
```

**`POST /api/modules/:id/cleanup`**
Request cleanup of a module from clients. Notifies clients via `module-cleanup`.
**Request body:**
```json
{ "roomCode": "AC12" }  // optional
```

### Soundboard Search

Proxies [Freesound](https://freesound.org)'s text-search API for the web client's GM soundboard "Search Sounds" modal (`js/features/gm-tools/sound-search.js`), so the `FREESOUND_API_KEY` env var stays server-side. Both routes require the admin `x-api-key` (same as every other route in this section) and respond `503` if `FREESOUND_API_KEY` isn't set on this deployment. Rate-limited separately from the general API cap (20 requests/min per IP) since each call spends real Freesound quota.

**`GET /api/soundboard/search?q=thunder&page=1&page_size=20`**
Search Freesound. `q` must be 2+ characters; `page_size` is capped at 50.
```json
{
  "count": 812,
  "page": 1,
  "pageSize": 20,
  "hasNext": true,
  "hasPrevious": false,
  "results": [
    { "id": 12345, "name": "Thunder Clap.wav", "username": "someuser", "duration": 4.2, "license": "https://creativecommons.org/licenses/by/4.0/", "preview_url": "https://freesound.org/...", "description": "..." }
  ]
}
```

**`GET /api/soundboard/download/:id`**
Re-resolves a Freesound sound ID to its playable preview URL. Note: this is *not* a true original-file download — Freesound's real download endpoint requires three-legged OAuth2, which this server (authenticating with a plain API-key Token) can't obtain. The soundboard's own "Add" flow never calls this; it uses the `preview_url` already returned by `/search`.

---

### Adventure Engine

State machine defined in `server/adventure.js`. These routes let a GM's own tooling — or a fully automated/AI GM — drive an entire adventure through plain authenticated REST calls, and mirror the Socket.IO/WS events of the same name one-for-one: whichever path drove a change, everyone in the room sees the update via the matching broadcast event.

**`GET /api/rooms/:code/adventure`**
Current adventure state (module, act, scene, active encounter, campaign timers, recent log, growth tracking, player-safe `knowledge[]` view — see below). Growth/climax-pacing fields on the state object include `climaxPadScenes` (number, defaults to `2`; overridable per-adventure via `load-custom`'s optional `climaxPadScenes` field below, but always reset to the default on a file-based module load, since dynamic growth is server-forced off for those), `climaxScenesSinceTrigger` (number, increments once per `scene-changed`-completed scene while `climaxTriggered` is true), and `climaxForced` (boolean, true once a forced climax twist has fired for the current climax — resets when a new adventure loads).

**`GET /api/rooms/:code/adventure/reference`**
Bestiary/NPCs/locations/factions/notes/**full `knowledge[]`** for the loaded adventure — GM/AI-eyes-only, includes each entry's secret `gm` text and `revealCondition`. Also includes `persistence` — either `null`, or an object `{ schema, carryover: [...], reset_on_complete }` surfaced verbatim from the loaded adventure module's declared "Legacy Tracker" schema (a bot-side feature; the server just passes the module's own `persistence` block through read-only).

**`POST /api/rooms/:code/adventure/knowledge/reveal`** — `{ id, by? }`
Flip a `knowledge[]` entry's `revealed` flag to `true`. `by` is optional free-form provenance (e.g. `"AI_GM"`, a GM's display name). Broadcasts `adventure-knowledge-revealed`. 404 if `id` doesn't match a knowledge entry in the loaded adventure.

**`POST /api/rooms/:code/adventure/knowledge/hide`** — `{ id, by? }`
Flip a `knowledge[]` entry's `revealed` flag back to `false` (undo a mistaken/premature reveal). Broadcasts `adventure-knowledge-hidden`. Same 404 behavior as reveal.

**`POST /api/rooms/:code/adventure/load`** — `{ moduleId }`
Load an adventure module by id (must have `"type": "adventure"` in its manifest plus an `adventure.json`). Broadcasts `adventure-loaded`.

**`POST /api/rooms/:code/adventure/load-custom`** — `{ content, id?, dynamicGrowth?, climaxAfterSessions?, climaxPadScenes? }`
Load an in-memory adventure with no file on disk — for AI-GM-generated adventures (e.g. built from a Crown Spread). `climaxPadScenes` (number, defaults to `2`) sets how many scenes a triggered climax is allowed to run before `climaxScenesSinceTrigger` reaches it and a climax-forced twist becomes eligible. Broadcasts `adventure-loaded`.

**`POST /api/rooms/:code/adventure/reset`**
Reset the loaded adventure back to planned (position, completed flags, timers, session/climax tracking). Broadcasts `adventure-reset`.

**`POST /api/rooms/:code/adventure/scene`** — `{ actIndex?, sceneIndex? }`
Advance the adventure. Omit both to advance sequentially. Broadcasts `scene-changed`.

**`POST /api/rooms/:code/adventure/scene/append`** — `{ actIndex, scene }`
Append a new scene to an existing act — call `.../adventure/scene` afterward to advance into it. Broadcasts `scene-appended`.

**`POST /api/rooms/:code/adventure/act/append`** — `{ act: { title, description?, scenes: [...] } }`
Append a whole new act (e.g. a generated climax). Broadcasts `act-appended`.

**`POST /api/rooms/:code/adventure/npc`** — `{ npc: { name, role?, motivation? } }`
Register an ad-hoc NPC into the loaded adventure. Broadcasts `npc-added`.

**`POST /api/rooms/:code/adventure/creature`** — `{ creature: { name, ... } }`
Register an ad-hoc creature into the bestiary. Broadcasts `creature-added`.

**`POST /api/rooms/:code/adventure/session/end`**
Mark a real-world play session as ended (increments `sessionsPlayed`, which the growth system checks against `climaxAfterSessions`). Broadcasts `session-ended`.

**`POST /api/rooms/:code/adventure/climax-triggered`**
Mark that the climax act has already been generated, so growth logic doesn't generate a second one. Broadcasts `adventure-climax-triggered`.

**`POST /api/rooms/:code/adventure/climax-forced`**
Mark that a forced climax twist has already been generated and appended (flips `climaxForced` to `true`, so this only ever applies once per climax) — used internally by the AI GM bot (`modules/adventure-director.js`'s `generateForcedClimaxTwist()`) after it appends a forced-twist scene via `scene/append`, once `climaxScenesSinceTrigger` reaches `climaxPadScenes` without the climax resolving. This route only records the flag; it does not generate anything itself. No request body. Broadcasts `adventure-climax-forced`.

**`POST /api/rooms/:code/adventure/encounter/start`** — `{ ref }` (index or name/creatureId in the current scene) **or** `{ encounter }` (a full ad-hoc object for an improvised fight)
Broadcasts `encounter-started`.

**`POST /api/rooms/:code/adventure/encounter/resolve`** — `{ outcome: "clean"|"partial"|"miss", notes? }`
Broadcasts `encounter-resolved`.

**`POST /api/rooms/:code/adventure/timer`** — `{ scope: "scene"|"campaign", ref (index or name), name?, amount? }` (amount defaults to +1, can be negative)
Ticks a timer — either the current scene's own timers or the module's `campaignTimers[]`. Broadcasts `timer-ticked`.

**`POST /api/rooms/:code/adventure/log`** — `{ text, author? }`
Append a free-form narrative beat to the adventure log. Broadcasts `adventure-log`.

---

### Whiteboard

**`GET /api/rooms/:code/whiteboard`**
Current whiteboard state — `drawings`, `notes`, `images`, `gridCombat`, etc. **Returned directly on the response body, not wrapped in a `whiteboard` key.**

**`POST /api/rooms/:code/whiteboard/grid-combat`** — `{ enabled?, gridType?, cellSize? }`
Enable/configure grid combat mode. Broadcasts `whiteboard-update`.

**`POST /api/rooms/:code/whiteboard/tokens`** — `{ token: { id?, label, faction, col, row, color?, harm?, fatigue?, tags?, vision?, body? } }`
Place or update a token. **`col`/`row` are grid cells, not pixels** — the server derives pixel position from the room's current `gridCombat.cellSize` (default 40). Placing a token auto-enables grid combat. Broadcasts `whiteboard-update`.

**`POST /api/rooms/:code/whiteboard/tokens/:id/move`** — `{ col, row }`
Move an existing token. Broadcasts `whiteboard-update`.

**`DELETE /api/rooms/:code/whiteboard/tokens/:id`**
Remove a token. Broadcasts `whiteboard-update`.

---

### Characters

**`GET /api/rooms/:code/characters`**
List all full character objects in a room.

**`GET /api/rooms/:code/characters/:name`**
Get one full character object.

**`POST /api/rooms/:code/characters/update`** — `{ updates: { "Character Name": { ...fields } } }`
Bulk update full character objects. Broadcasts `state-updated`. The web client calls this both on
connect/reconnect and, debounced, on every local character edit — see `core/state.js`'s
`onCharacterChange()` — so this is a live sync path, not a one-shot import. `fields` typically
includes `attributes`, `harm`, `fatigue`, `obligation`, `boons`, `leash`, `corruption`, `skills`,
`avatar`, `playerName`, and `patron` (which Patron a character's Obligation is owed to — passed
through as an arbitrary field, no server-side validation against the patron content data).

**`POST /api/rooms/:code/characters/:name/(harm|fatigue|obligation|boons|leash|corruption)`** — `{ delta }`
Adjust a single numeric field by a signed delta (clamped at 0). Prefer these over the bulk endpoint for simple counter bumps — they avoid a read-modify-write race. Broadcasts `character-update`.

**`POST /api/rooms/:code/characters/cleanup`**
One-time merge of case-fragmented duplicate character records (e.g. `"Khor"`/`"khor"`) left over from before character names were case-normalized.

**`GET /api/characters/export`**
Export all characters across all rooms (global, not room-scoped).

---

### Campaign Sharing

**`POST /api/rooms/:code/campaigns`**
Store campaign state under a freshly generated random code (up to 2 manual snapshots retained per room, oldest pruned).
**Response:** `{ success, code, room, message }` — share `code` with whoever loads it.

**`GET /api/rooms/:code/campaigns/:campaignCode`**
Retrieve a stored campaign snapshot using the code returned above.

**`POST /api/rooms/:code/campaigns/auto-save`**
Overwrite the room's single deterministic auto-save slot (keyed by room code, not a random code — safe for frequent automatic writes, kept entirely separate from the manual-share retention above).

**`GET /api/rooms/:code/campaigns/auto-save`**
Retrieve the room's auto-saved campaign, if any (404 if none exists yet).

---

## 📡 WebSocket API

The server accepts connections on the same port as HTTP.

- **Socket.io** – connect with a Socket.io client (e.g., `io("http://localhost:10000")`).
- **Plain WebSocket** – connect to `ws://localhost:10000?room=ROOM_CODE` or `ws://localhost:10000/campaign/ROOM_CODE`.

Plain WebSocket messages are JSON objects with a `type` field, sent flat (`{ "type": "adventure-scene", "actIndex": 1, "sceneIndex": 2 }`, not nested under a payload key). Socket.io uses named events with a data object as the argument. Both transports expose equivalent functionality; the tables below use the plain-WS `type` value / Socket.io event name interchangeably except where transport-specific behavior is called out.

---

### Connection & Handshake

#### Plain WebSocket

1. Connect with room code as query parameter or path.
2. Send a `handshake` message to join the room.

**Client → Server:**
```json
{
  "type": "handshake",
  "campaignCode": "AC12",
  "clientName": "Alice",
  "role": "gm",
  "clientEmail": "alice@example.com"
}
```

**Server → Client:**
```json
{
  "type": "handshake_ack",
  "success": true,
  "clientId": "ws-168...",
  "clientRole": "gm",
  "versionVector": {},
  "activeClients": [ ... ]
}
```

#### Socket.io

Connect to the server and emit `join-room`:

```json
{
  "roomCode": "AC12",
  "playerName": "Alice",
  "playerRole": "gm",
  "playerEmail": "alice@example.com"
}
```

The server responds with `handshake_ack` followed by `room-joined` (Socket.io's `room-joined` includes `characters` — the plain-WS handshake flow does not include a directly equivalent single event; use `sync-request` after joining to pull whiteboard + character state). Both `room-joined` and plain-WS's `room-state` (sent right after connect) also include `chatHistory`: the room's rolling window of recent chat messages (`message-shaped` objects, oldest first — see "Chat History" below), letting a client that joins mid-conversation show something other than a blank pane.

---

### Common Events (Client → Server)

| Event Type          | Description                          | Payload Example                          |
|---------------------|--------------------------------------|------------------------------------------|
| `chat-message`      | Send a chat message. `sender` is just a display label — see the Server → Client row below for how GM trust is actually decided. | `{ "text": "Hello", "sender": "Alice" }` |
| `roll-dice`         | Broadcast a dice roll                | `{ "expr": "3d6+2", "total": 15, ... }`  |
| `deck-draw`         | Draw cards from deck                 | `{ "count": 1, "region": "Acasia" }`     |
| `deck-shuffle`      | Shuffle the deck                     | `{}`                                     |
| `crown-spread`      | Perform Crown Spread                 | `{ "region": "Acasia" }`                 |
| `deck-history`      | Request deck history                 | `{}` (ack callback on Socket.io)         |
| `deck-history-clear`| Clear deck history                   | `{}`                                     |
| `request_gm`        | Request to become GM                 | `{}`                                     |
| `approve_gm`        | Current GM approves a request        | `{ "targetId": "client-id" }`            |
| `kick_client`       | **(GM only)** Kick a player          | `{ "targetId": "client-id", "reason": "" }` |
| `ban_client`        | **(GM only)** Ban a player           | `{ "targetId": "client-id", "reason": "" }` |
| `unban_client`      | **(GM only)** Unban a client         | `{ "targetId": "client-id" }`            |
| `module-push-request` | Request module push                | `{ "moduleId": "my-module" }` (ack callback on Socket.io) |
| `module-cleanup-request` | Request module cleanup           | `{ "moduleId": "my-module" }` (ack callback on Socket.io) |
| `module-list`       | List loaded modules                  | `{}` (ack callback on Socket.io)         |
| `set-region`        | Update default region                | `{ "region": "Ecktoria" }`               |
| `state-updated`      | Push a full characters array — merged into room state and broadcast to everyone **including the sender** | `{ "characters": [ { "name": "...", ... } ] }` |
| `whiteboard-update` | **Replace the entire room whiteboard object** (drawings, notes, images, gridCombat — everything) | `{ "whiteboard": { ... } }`      |
| `sync-state`         | ⚠️ Client→server, this is handled **identically to `whiteboard-update`** — it overwrites the whole room whiteboard, it is *not* a generic state push. Don't use this for anything you don't want to destructively replace (e.g. don't use it just to announce a scene name — see `scene-status-update` below for that). | `{ "state": { ... } }` |
| `sync-request`      | Pull current room state — server replies with `sync-state` (whiteboard) and, if present, `state-updated` (characters). Does **not** include a client list. | `{}` |
| `get-clients`       | Get the client list for the caller's current room (ack callback) | `{}` |
| `leave-room`        | Explicit room leave without disconnecting the socket | `{}` (plain WS: room code string, optional) |
| `voice-offer`       | WebRTC signaling                     | ...                                      |
| `voice-answer`      | WebRTC signaling                     | ...                                      |
| `voice-ice-candidate` | WebRTC signaling                   | ...                                      |
| `voice-status`      | Voice enabled/disabled               | `{ "enabled": true }`                    |
| `tts-audio`         | Optional AI GM voice narration — base64-encoded synthesized speech, broadcast to the room exactly like `chat-message` (see the AI GM Bot's `TTS_ENABLED`/`TTS_URL`; see `WS_MAX_PAYLOAD_BYTES` below for the size cap this needs) | `{ "audio": "<base64>", "text": "...", "voice": "default", "format": "wav" }` |
| `soundboard-ambience` | Optional Reactive Soundscape — fired by the AI GM Bot when a scene advances or it explicitly sets a mood (see the bot's `adventure-context.js` mood→trackId profile and its `[MOOD "..."]` tag); relayed to the room exactly like `tts-audio`. Two payload shapes: `trackId` must match an id already present in the room's `state.soundboard.tracks` (see the web client's `core/soundboard.js`) — a mood mapped to a track no client has created is a silent no-op on the receiving end; OR, when the bot's `SOUNDSCAPE_AUTO_SEARCH=true` and no manual profile entry matched, `url` (+ optional `name`/`attribution`) from a live `GET /api/soundboard/search` lookup — each receiving client auto-adds its own track from the URL instead of looking one up by id. | `{ "mood": "tense", "trackId": "sound_abc123", "transitionDuration": 2000 }` or `{ "mood": "tense", "url": "https://freesound.org/...", "name": "Distant Thunder", "attribution": { "author": "someuser", "license": "CC BY", "url": "https://freesound.org/s/12345/" }, "transitionDuration": 2000 }` |
| `scene-status-update` | Non-destructive broadcast-only notification — relayed to the room as-is, no room state is touched. Good for things like "here's my current scene name" that shouldn't clobber the whiteboard. | `{ "scene": { "name": "..." } }` |
| `combat-status-update` | Same as `scene-status-update` but semantically for combat/encounter status (e.g. a bot's local timer list) | `{ ... }` |
| `event`              | Generic custom event                 | `{ ... }`                                |
| `operation` / `operation_ack` | Generic op-relay pair for custom sync protocols | `{ ... }`                    |
| `presence`           | Update your own presence fields (plain WS: e.g. `name`) | `{ "name": "..." }`             |
| `adventure-load`     | Load an adventure module             | `{ "moduleId": "my-adventure" }`         |
| `adventure-reset`    | Reset the loaded adventure           | `{}`                                     |
| `adventure-scene`    | Advance the adventure — fields are flat on the message, not nested | `{ "actIndex": 1, "sceneIndex": 2 }` |
| `adventure-encounter-start` | Start an encounter            | `{ "ref": 0 }` or `{ "encounter": { ... } }` |
| `adventure-encounter-resolve` | Resolve the active encounter | `{ "outcome": "clean", "notes": "" }`   |
| `adventure-timer`    | Tick a timer                         | `{ "scope": "scene", "ref": 0, "amount": 1 }` |
| `adventure-log`      | Append a narrative beat              | `{ "text": "...", "author": "..." }`     |
| `adventure-knowledge-reveal` | Flip a `knowledge[]` entry's `revealed` gate to `true` | `{ "id": "rennik-transformation", "by": "AI_GM" }` |
| `adventure-knowledge-hide` | Flip a `knowledge[]` entry's `revealed` gate back to `false` | `{ "id": "rennik-transformation", "by": "GM" }` |
| `adventure-state`    | Request current adventure state (ack callback) | `{}`                            |
| `adventure-reference` | Request bestiary/npcs/locations/etc. (ack callback) | `{}`                    |

---

### Common Events (Server → Client)

| Event Type           | Description                                   | Payload Example                                       |
|----------------------|-----------------------------------------------|---------------------------------------------------------|
| `connected`          | Connection established (plain WS)             | `{ "clientId": "...", "room": "AC12", "serverVersion": "..." }` |
| `handshake_ack`       | Handshake/join accepted                       | `{ "clientId": "...", "clientRole": "gm", "activeClients": [...] }` |
| `room-joined`         | (Socket.io) Full room snapshot on join, including characters and `chatHistory` (rolling window of recent messages, oldest first — see `MAX_CHAT_HISTORY`, default 50, 0 disables) | `{ "room": "...", "clients": [...], "whiteboard": {...}, "characters": [...], "chatHistory": [...] }` |
| `chat-message`       | Incoming chat message. `verifiedGM` is stamped by the server from its own role tracking for the sending connection, overwriting anything the client sent — it's the only trustworthy signal that a message actually came from the room's GM (or a co-GM); `sender` is a free-text display label a client can set to anything, including `"GM"`. | `{ "text": "...", "sender": "Bob", "verifiedGM": false, ... }` |
| `tts-audio`           | Optional AI GM voice narration audio, broadcast to everyone in the room (including the bot's own connection) | `{ "audio": "<base64>", "text": "...", "voice": "default", "format": "wav" }` |
| `soundboard-ambience` | Optional Reactive Soundscape cue, broadcast to everyone in the room (including the bot's own connection) — clients with a matching `trackId` in their local soundboard crossfade to it; if `url` is sent instead (SOUNDSCAPE_AUTO_SEARCH), each client auto-adds its own track from the URL first | `{ "mood": "tense", "trackId": "sound_abc123", "transitionDuration": 2000 }` |
| `roll-result`        | Incoming dice roll                            | `{ "outcome": "success", "dice": [1,4,6], ... }`     |
| `deck-drawn`         | Cards were drawn                              | `{ "cards": [...], "synthesis": "..." }`              |
| `deck-shuffled`      | Deck was shuffled                             | `{ "remaining": 54 }`                                 |
| `crown-spread`       | Crown Spread result                           | `{ "result": { "synthesis": "...", "positions": [...] } }` |
| `deck-history-cleared`| History was cleared                          | `{}`                                                  |
| `presence`            | Updated client list with roles                | `{ "clients": [ { "id": "...", "name": "...", "role": "gm" } ] }` |
| `player-joined`      | A new client joined                           | `{ "clientId": "...", "clientName": "...", "clients": [...] }` |
| `player-left`        | A client left                                 | `{ "clientId": "...", "clientName": "...", "clients": [...] }` |
| `gm_vote_request`    | Someone requests GM, current GM must approve  | `{ "requesterId": "...", "requesterName": "..." }`    |
| `gm_role_update`     | Your role changed                             | `{ "clientId": "...", "role": "gm" }`                  |
| `server_announcement`| Broadcast from server                         | `{ "message": "..." }`                                |
| `module-push`        | New module pushed by server                   | `{ "module": { "id": "...", "manifest": {...} } }`    |
| `module-cleanup`     | Module cleanup request from server            | `{ "moduleId": "..." }`                               |
| `region-updated`     | Default region changed                        | `{ "region": "Ecktoria" }`                            |
| `state-updated`      | Characters were updated by someone            | `{ "characters": [ ... ] }`                           |
| `character-update`   | A single character field changed (via the delta REST/socket routes) | `{ "name": "...", "field": "harm", "value": 3 }` |
| `whiteboard-update`  | Whiteboard was replaced/updated by someone    | `{ "whiteboard": { ... }, "source": "..." }`          |
| `sync-state`          | Response to `sync-request` — whiteboard state | `{ "state": { ... } }`                                |
| `scene-status-update` / `combat-status-update` | Broadcast-only status relay (see client→server table above) | `{ ... }` |
| `adventure-loaded` / `adventure-reset` / `scene-changed` / `scene-appended` / `act-appended` / `npc-added` / `creature-added` / `session-ended` / `adventure-climax-triggered` / `adventure-climax-forced` / `encounter-started` / `encounter-resolved` / `timer-ticked` / `adventure-log` / `adventure-knowledge-revealed` / `adventure-knowledge-hidden` | Broadcast counterparts of the Adventure Engine REST/socket calls above | full updated adventure state object |
| `kicked`             | You have been kicked from the room            | `{ "reason": "..." }`                                 |
| `error`              | Server error message                          | `{ "message": "..." }`                                |
| `room-closed`        | Room has been closed by the server            | `{}`                                                  |

---

## 🎮 GM Election Flow

1. Any player sends `request_gm`.
2. If no GM exists, the requester becomes GM immediately.
3. If a GM exists, a `gm_vote_request` is sent to the current GM.
4. The current GM can send `approve_gm` with the requester's client ID to swap roles.
5. Both the old and new GM receive `gm_role_update`.

---

## 🚫 Ban / Kick Flow

- Only the current GM can kick or ban.
- Banned clients are stored per room and prevented from reconnecting (they receive an error on handshake).
- Use `unban_client` to remove a ban.

---

## 📦 Module Management

Modules are folders under `server/modules/` with a `manifest.json`, plus standalone adventure JSON files under `data/adventures/`.
- `GET /api/modules` (also `GET /api/rooms/:code/modules`) lists them.
- `POST /api/modules` permanently installs a new one from raw content.
- `POST /api/modules/:id/push` sends the module's content to all clients in a room (or globally).
- `POST /api/modules/:id/cleanup` tells clients to unload/cleanup the module.
Clients receive `module-push` and `module-cleanup` events respectively.

---

## 🎭 Adventure Engine

A per-room state machine (`server/adventure.js`) tracking the loaded module, current act/scene, active encounter, campaign/scene timers, NPC/creature roster, and a running narrative log — with optional "dynamic growth" (auto-generating new content as sessions accumulate, driven by an AI GM or a human referencing `sessionsPlayed`/`climaxAfterSessions`). Every mutating REST route under `/api/rooms/:code/adventure/...` has a matching Socket.IO/plain-WS event of the same name (minus the `/adventure/` path segment, e.g. `POST .../adventure/scene` ↔ `adventure-scene`), and both paths broadcast the identical event to the room. See the **Adventure Engine** REST section above for the full route list.

---

## 🗺️ Whiteboard & Grid Combat

Each room has one shared whiteboard object (`drawings`, `notes`, `images`, `gridCombat`). The human whiteboard UI reads/writes it wholesale via the `whiteboard-update` event. Bots and other non-canvas integrations that only need to place/move/remove combat tokens should use the dedicated `POST/DELETE /api/rooms/:code/whiteboard/tokens...` and `POST .../whiteboard/grid-combat` REST routes instead of trying to compute a full whiteboard replacement — these are small, targeted mutations addressed by grid cell (`col`/`row`), not by raw pixel coordinates.

**Do not use `sync-state` to announce non-whiteboard information (e.g. "the active scene changed").** On both transports, a client-sent `sync-state` is handled exactly like `whiteboard-update` — it replaces the *entire* room whiteboard object with whatever you send. Use the non-destructive `scene-status-update` / `combat-status-update` broadcast-only relay events instead.

---

## 🔌 Quick Start Examples

### Connect with Socket.io (JavaScript)

```javascript
const socket = io('http://localhost:10000');
socket.emit('join-room', { roomCode: 'AC12', playerName: 'Alice', playerRole: 'gm' });

socket.on('room-joined', (data) => { console.log('Joined', data); });
socket.on('chat-message', (msg) => { console.log('Chat:', msg); });
```

### Connect with Plain WebSocket

```javascript
const ws = new WebSocket('ws://localhost:10000?room=AC12');
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'handshake', clientName: 'Alice', role: 'gm' }));
};
ws.onmessage = (evt) => {
  const data = JSON.parse(evt.data);
  console.log('Event:', data.type, data);
};
```

### Kick a player via REST API

```bash
curl -X POST http://localhost:10000/api/rooms/AC12/clients/ws-AC12/kick \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Too many dogs"}'
```

### Place a grid combat token via REST API

```bash
curl -X POST http://localhost:10000/api/rooms/AC12/whiteboard/tokens \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"token": {"label": "Bandit", "faction": "enemy", "col": 4, "row": 2}}'
```

---

This reference covers all currently implemented endpoints and events. For more details, inspect the modular source files (`api.js`, `ws-handlers.js`, `socketio-handlers.js`, `adventure.js`), or query the server's own live reference at `GET /api/data/docs`.
