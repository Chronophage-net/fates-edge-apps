# Fate's Edge Socket Server — Design Documentation

> **Verified against code as of v4.8.3 (2026-08-12).** This document was previously a mix of real architecture and an older aspirational draft (PDF conversion, email, job scheduling, Redis caching, session middleware — none of which exist in this codebase) copied in without being reconciled against what actually shipped. It's been rewritten to describe only what's real, checked line-by-line against `server/*.js` and `package.json`. Where a list below would drift easily (exact routes, exact event names), it points at the source file instead of re-transcribing it — a second stale copy of the same list is how this happened the first time.
>
> Related documents: [README.md](README.md) (what this server does, plain-language), [ROLES.md](ROLES.md) (the role/permission model, promoted out of this file), [SCALING.md](SCALING.md) (optional multi-instance deployment), [ROADMAP.md](ROADMAP.md) (genuinely planned, not-yet-built work), [INSTALL.md](INSTALL.md) (setup/ops).

---

## 1. Overview

Fate's Edge Socket Server is a real-time backend for the web toolkit: a Node.js/Express HTTP API plus **two** parallel WebSocket transports (Socket.IO and a plain `ws` server, both mounted on the same HTTP server/port) that broadcast room state, chat, dice rolls, decks, and adventure progress to everyone connected to a room/campaign code.

## 2. Technology Stack

Reflects `package.json`'s actual `dependencies`/`optionalDependencies` — nothing here is aspirational:

| Layer | Technology |
|---|---|
| HTTP framework | Express.js |
| Real-time transport | Socket.IO **and** a plain `ws` server (both active simultaneously, see below) |
| Password hashing | bcryptjs |
| Sessions | JWT (`jsonwebtoken`), not cookie/server-side sessions |
| Persistence | SQLite by default (`server/storage.js`, `campaigns.db`); optional PostgreSQL (`pg`) or MySQL (`mysql2`) via `DATABASE_TYPE`/`DATABASE_URL` |
| Ephemeral room state | Plain in-memory `Map` (`server/room.js`), one process, gone on restart |
| Horizontal scaling | Optional Redis pub/sub relay — off by default, see [SCALING.md](SCALING.md) |
| Config | `dotenv` + environment variables, optional `server/config.json` overlay |

**Not present anywhere in this codebase**, despite older drafts of this document describing them: Redis caching, PDF conversion, email (nodemailer), job scheduling (agenda), Winston, Helmet.js, `express-session`, or the `express-rate-limit`/`express-slow-down` packages.

### Why two WebSocket transports?

`server/socketio-handlers.js` and `server/ws-handlers.js` implement the same room protocol independently over Socket.IO and plain `ws`, both listening on the same HTTP server (`server/index.js`). This exists so the web client can use whichever transport is more reliable in a given deployment (Socket.IO's fallback/reconnection logic vs. a plain WebSocket with less overhead); both are first-class, not a legacy/deprecated pairing. `room.js`'s `broadcastToRoom()` is the single place that delivers to both.

### Default port

**10000**, not 3000 — set via `PORT` (see `server/config.js`). `HOST` defaults to `0.0.0.0`.

## 3. HTTP API

Routes are grouped by feature area below; **`server/api.js` is the authoritative, exhaustive list** — grep it for `router.get/post/put/delete` rather than trusting a hand-copied table here, which is exactly how this document went stale before.

- **Rooms** — create/list/inspect rooms, client lists, kick/ban/unban.
- **Characters** — per-room character CRUD, plus an account-owned character *library* (`/api/account/characters`) independent of any room, and a claim/release bridge tying a library character to a room's live roster (see [ROLES.md](ROLES.md)).
- **Deck** — draw/shuffle/history for the shared Deck of Consequences, and the Crown Spread reading.
- **Adventure** — load/reset an adventure, advance scenes/timers, log entries, start/resolve encounters, append acts/scenes, add NPCs/creatures.
- **Whiteboard** — tokens, grid-combat state.
- **Campaigns** — manual short-code share/upload/download, plus a separate always-latest auto-save (see `server/storage.js`'s header comment for why those two don't share one retention table).
- **Auth** — `POST /api/auth/register`, `POST /api/auth/login` (both behind a hand-rolled in-memory rate limiter, see §5), `GET /api/auth/me`.
- **Modules** — installable adventure-module list/push/cleanup.
- **TURN** — `GET /api/turn-credentials`, short-lived coturn credentials for voice chat NAT traversal (see `server/turn.js`).
- **Health** — `GET /healthz` / `GET /api/healthz`.

Not real (were listed in an earlier draft of this document, don't exist in `api.js`): `/api/rooms/template/:template`, `/api/rooms/:code/chat`, `/api/rooms/:code/roll`, `/api/rooms/:code/vtt/*`, `/api/sessions`, `/api/keys`, `/api/stats`, `/api/analytics`, `/api/convert/pdf`.

## 4. WebSocket Protocol

Both transports speak the same logical protocol; **`server/socketio-handlers.js`'s `socket.on(...)` calls and `server/ws-handlers.js`'s `switch` `case`s are the authoritative event list.** In broad strokes, client-originated events cover: joining/leaving a room, GM request/approve and Co-GM role changes, character select/claim/release, deck draws/shuffle/history, chat and dice rolls, voice signaling (offer/answer/ICE/status), adventure state changes, module push/list/cleanup, whiteboard updates, kick/ban, and a generic `event` passthrough (used by client-side features like Kon'reh and Toll & Veil to ride the same relay without needing new server code per feature — see the web client's own DESIGN.md).

Server-originated broadcasts follow the pattern `broadcastToRoom(roomCode, eventName, payload, senderId)` (`server/room.js`) and reach every client in the room across **both** transports in one call — Socket.IO clients via `io.to(roomCode).emit(...)`, plain-`ws` clients via a direct loop over that room's tracked connections (and, if Redis scaling is enabled, relayed to other instances too — see [SCALING.md](SCALING.md)).

### Room object shape (as actually created, `room.js`'s `createRoom()`)

```javascript
{
  name: String,              // "Room {CODE}"
  code: String,               // uppercased room code
  clients: Map,                // clientId -> { ws|socket, role, name, userId?, ... }
  deck: Array,                 // built via deck.js's buildDeck()
  deckHistory: Array,
  deckOffset: Number,
  characters: Object,          // normalizeCharKey(name) -> character record
  characterClaims: Object,     // userId -> claimed character key (v4.8, see ROLES.md)
  banned: Set,                 // banned userIds/names
  whiteboard: { drawings, notes, images, settings, gridCombat },
  password: String|null,       // bcrypt hash, or null
  data: Object,                // free-form custom state
  created: Number,
  lastActivity: Number,
}
```

There is no `maxClients`, `owner`, or `settings` field on the real room object — an earlier draft of this document described a richer shape that was never built.

## 5. Authentication & Authorization

- **API key** — `X-API-Key` header or `?apiKey` query param, required on most `/api/*` routes (`authenticate` middleware in `api.js`). Auto-generated and logged once at startup if `API_KEY` isn't set (see `server/config.js`).
- **JWT accounts** — `server/auth.js` issues a JWT on register/login; `auth.requireAuth` gates account-specific routes (`/api/account/characters`, claim-character, `/api/auth/me`). No server-side session store — the token itself is the session.
- **Room roles** — `gm` / `co-gm` / `player` / `spectator`, promoted out to their own document: **[ROLES.md](ROLES.md)**.
- **Rate limiting** — a small hand-rolled in-memory fixed-window limiter (`server/security.js`'s `createRateLimiter`, no `express-rate-limit` dependency), applied three ways: (1) tight per-route limiters on `/api/auth/login` and `/api/auth/register` to slow credential stuffing, (2) a broad, generous general limiter (`router.use(...)` in `api.js`, right after the health-check routes so uptime probes are never throttled) covering every other `/api/*` route, and (3) a per-CONNECTION message-rate gate on both WebSocket transports (`security.js`'s `createConnectionMessageLimiter`, wired via `socket.use()` for Socket.IO and inline in the message switch for plain-ws) to stop a single already-connected client from flooding the server. All three are configurable (`API_RATE_LIMIT_WINDOW_MS`/`API_RATE_LIMIT_MAX`, `WS_MESSAGE_RATE_WINDOW_MS`/`WS_MESSAGE_RATE_MAX`) and independently disable-able by setting their `_MAX` to `0`. There is still no Helmet.js security headers or CSP/HSTS configuration in this codebase, despite an earlier draft describing them as implemented.

## 6. Configuration Reference

The real, currently-read environment variables. See [INSTALL.md](INSTALL.md) for setup context and `server/config.js` for the loader itself.

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP/WebSocket port | `10000` |
| `HOST` | Bind address | `0.0.0.0` |
| `LOG_LEVEL` | `DEBUG`\|`INFO`\|`WARN`\|`ERROR` | `INFO` |
| `CORS_ORIGIN` | Allowed origin(s) | `*` |
| `API_KEY` | Master API key | auto-generated + logged if unset |
| `AUTH_JWT_SECRET` | JWT signing secret | auto-generated if unset (won't survive a restart — set this for real deployments) |
| `DATABASE_TYPE` | `sqlite` (default) \| `postgres` \| `mysql` | `sqlite` |
| `DATABASE_URL` | SQLite file path, or a Postgres/MySQL connection string | `./campaigns.db` |
| `MAX_DECK_HISTORY` | Draws kept per room | `100` |
| `HEALTH_ENDPOINT` | Extra health-check path (`/healthz`/`/api/healthz` always exist too) | `/api/health` |
| `STATS_INTERVAL` | Server stats log interval (ms) | `30000` |
| `TURN_SECRET` / `TURN_REALM` / `TURN_URLS` / `TURN_CREDENTIAL_TTL` | coturn credential minting (voice chat NAT traversal) — see `server/turn.js` | unset = endpoint returns 404 |
| `API_RATE_LIMIT_WINDOW_MS` / `API_RATE_LIMIT_MAX` | General per-IP REST API rate limit (§5) | `60000` / `300` (`_MAX=0` disables) |
| `WS_MESSAGE_RATE_WINDOW_MS` / `WS_MESSAGE_RATE_MAX` | Per-connection WebSocket message rate limit (§5) | `10000` / `120` (`_MAX=0` disables) |
| `MAX_CLIENTS_PER_ROOM` | Reject new joins once a room holds this many clients | `0` = unlimited |
| `CLUSTER_WORKERS` | Fork this many worker processes (or `auto` = one per CPU core) — see [SCALING.md](SCALING.md) | `0` = single process |
| `REDIS_URL` | Optional multi-instance scaling — see [SCALING.md](SCALING.md) | unset = disabled |

**Not real** (described in an earlier draft, not read anywhere in `server/*.js`): `SESSION_SECRET`, `ENABLE_UPLOAD`, `ENABLE_CACHING`, `ENABLE_SESSIONS`, `ENABLE_EMAIL`, `ENABLE_SCHEDULING`, `AUTO_CREATE_ROOMS`, `RATE_LIMIT_WINDOW`/`RATE_LIMIT_MAX`, `SALT_ROUNDS`, `MAX_CONCURRENT_CONVERSIONS`, `UPLOAD_FILE_SIZE_LIMIT`, `BLOCKED_WORDS`.

## 7. Data Persistence

Two separate layers, serving different purposes:

- **In-memory (`server/room.js`)** — live room state (clients, deck position, whiteboard, characters) for whichever rooms this process currently has active. Gone on restart; not shared across instances unless [SCALING.md](SCALING.md)'s Redis relay is enabled (and even then, the relay only forwards broadcast traffic — it does not replicate this in-memory state itself).
- **Durable (`server/storage.js`)** — SQLite by default, optional PostgreSQL/MySQL. Accounts, hashed room passwords, room memberships/roles, manual campaign-share snapshots, a separate always-latest auto-save table, and character claims. See that file's own header comment for the full table list and why auto-save and manual-share snapshots deliberately don't compete for the same retention budget.

## 8. Performance & Operational Notes

- Event-driven, non-blocking I/O; multiple rooms served concurrently by one process.
- No caching layer of any kind exists — API responses are computed fresh on every request. An earlier draft of this document listed per-endpoint cache TTLs; none of that was ever implemented.
- Empty-room cleanup, chat/deck-history length caps, and connection health (ping/pong) are implemented per-transport in `ws-handlers.js`/`socketio-handlers.js` — see those files for exact numbers rather than a hand-copied table here.
- Single Node.js process by default. See [SCALING.md](SCALING.md) if you need more than one.

## 9. Roles & Permissions

Moved to its own document: **[ROLES.md](ROLES.md)**. It covers the `gm`/`co-gm`/`player`/`spectator` role model, how role changes are authorized and (optionally) persisted, and the character claim/release system that binds a player's account-owned character to a room's live roster.

## 10. License

MIT (code) — see the repo root's `LICENSE.code` and `package.json`. Game content bundled alongside the code (SRD/proprietary setting material) has its own separate licensing; see the root README's License section.
