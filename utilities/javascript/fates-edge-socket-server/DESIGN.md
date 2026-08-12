# Fate's Edge VTT - Design Documentation

> **Status (Toolkit v4.4.1):** Account authentication (register/login, JWT-backed sessions, bcrypt password hashing) described below is implemented in `server/auth.js` / `server/api.js`, and now has real unit-level test coverage (`tests/auth.test.js`, `tests/deck.test.js`, `tests/adventure.test.js` — see the root README's "What's New"). The AI GM bot referenced in earlier revisions of the wider ecosystem has been removed from this monorepo; it lives on as its own separate repository (`fates-edge-ai-gm-bot`).
>
> **Correction (v4.8.3):** Several items below describe a larger/older aspirational feature set than what's actually installed and running. Concretely: **Redis is not a dependency of this project and is never used** (there's no `redis`/`ioredis` package in `package.json`, and no caching layer reads `REDIS_URL`/`ENABLE_CACHING`) — persistence is `server/storage.js`, which defaults to SQLite (`campaigns.db`) and optionally supports PostgreSQL or MySQL (`DATABASE_TYPE`/`DATABASE_URL`); ephemeral room/session state is plain in-memory `Map`s. The default port is **10000**, not 3000 (see `server/config.js`). This project's license is **MIT** (see root `package.json`/`LICENSE.code`), not the "proprietary and confidential" line at the bottom of this document. The `redis`/`ioredis`, `agenda`, `nodemailer`, `handlebars`, and `multer` entries under Optional Dependencies below aren't in `package.json` either — the real dependency list is `bcryptjs`, `cors`, `dotenv`, `express`, `jsonwebtoken`, `socket.io`, `sqlite3`, `ws`, with `mysql2`/`pg` as the only optional dependencies.

## System Architecture

### Overview
Fate's Edge is a real-time Virtual Tabletop (VTT) server built with Node.js, Express, and Socket.IO. It provides REST API endpoints and WebSocket connections for real-time gaming features including chat, dice rolling, voice communication, and state synchronization.

### Technology Stack

**Backend:**
- Node.js with Express.js
- Socket.IO (and a plain `ws` transport) for WebSocket communication
- SQLite by default, PostgreSQL or MySQL optionally (`server/storage.js`) — no Redis anywhere in this codebase
- JSON file-based persistence (`server-data.json`) for room snapshots

**Security:**
- API Key authentication (header or query param)
- JWT authentication for user sessions
- bcrypt password hashing
- Helmet.js for security headers
- Rate limiting and request throttling
- Session management with memory store

**Database:**
- In-memory storage (rooms, sessions) with periodic JSON serialization for room snapshots
- `server/storage.js`: SQLite by default (`campaigns.db`), optionally PostgreSQL or MySQL — for campaign persistence, accounts, and character claims

### Ports & Endpoints

- **Web Server:** Port 10000 (configurable via PORT env var)
- **WebSocket:** Same port as web server (Socket.IO multiplexing)

---

## API Endpoints

### Room Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | List all active rooms (cached 30s) |
| POST | `/api/rooms` | Create a new room |
| POST | `/api/rooms/template/:template` | Create room from template |
| GET | `/api/rooms/:code` | Get room details |
| DELETE | `/api/rooms/:code` | Delete a room |
| GET | `/api/rooms/:code/clients` | Get clients in a room |
| GET | `/api/rooms/:code/state` | Get room state (cached 10s) |
| PUT | `/api/rooms/:code/state` | Update room state (broadcasts to room) |

### VTT Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms/:code/vtt/state` | Get VTT state (cached 10s) |
| PUT | `/api/rooms/:code/vtt/state` | Update VTT state (broadcasts) |
| GET | `/api/rooms/:code/vtt/characters` | Get characters (cached 30s) |
| PUT | `/api/rooms/:code/vtt/characters` | Update characters (broadcasts) |
| GET | `/api/rooms/:code/vtt/timers` | Get timers (cached 30s) |
| PUT | `/api/rooms/:code/vtt/timers` | Update timers (broadcasts) |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms/:code/chat` | Get chat history (cached 10s) |
| POST | `/api/rooms/:code/chat` | Send chat message (broadcasts) |
| DELETE | `/api/rooms/:code/chat` | Clear chat history |

### Dice Rolling

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rooms/:code/roll` | Roll dice (broadcasts result) |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register` | Register new user |
| POST | `/api/users/login` | Login user (returns JWT) |
| GET | `/api/users/profile` | Get user profile (requires JWT) |
| PUT | `/api/users/profile` | Update user profile (requires JWT) |

### Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List user sessions (requires JWT) |
| POST | `/api/sessions` | Create session (requires JWT) |
| POST | `/api/sessions/:id/join` | Join session (requires JWT) |
| POST | `/api/sessions/:id/leave` | Leave session (requires JWT) |

### API Key Management (Master Key Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/keys` | List API keys |
| POST | `/api/keys` | Create API key |
| DELETE | `/api/keys/:key` | Delete API key |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/stats` | Server statistics (requires auth) |
| GET | `/api/analytics` | Detailed analytics (requires master key) |
| GET | `/api/status` | CLI-friendly status endpoint |
| GET | `/api/data/docs` | API documentation |

### PDF Conversion (Optional)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/convert/status` | Check conversion status |
| POST | `/api/convert/pdf` | Upload and convert PDF to HTML |

---

## WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{ roomCode, clientData, password }` | Join a room |
| `get-clients` | `{ roomCode? }` | Request client list |
| `sync-state` | `{ state }` | Update room state |
| `event` | `{ event }` | Send custom event to room |
| `chat-message` | `{ text, sender? }` | Send chat message |
| `roll-dice` | `{ roll, dice, reason? }` | Roll dice |
| `voice-offer` | `{ sdp }` | WebRTC offer |
| `voice-answer` | `{ sdp }` | WebRTC answer |
| `voice-ice-candidate` | `{ candidate }` | WebRTC ICE candidate |
| `voice-toggle` | `{ enabled: boolean }` | Toggle voice |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `ping` | (empty) | Connection health check |
| `room-state` | `{ data, clients, chatHistory, name, createdAt, hasPassword, settings }` | Initial room state |
| `client-joined` | `{ id, data, timestamp }` | New client joined |
| `client-left` | `{ id, name, timestamp }` | Client left |
| `state-updated` | `{ clientId, clientName, state }` | Room state updated |
| `event` | `{ clientId, clientName, event }` | Custom event |
| `chat-message` | `{ text, sender, timestamp, clientId, id }` | New chat message |
| `chat-cleared` | `{ source, clearedBy, timestamp }` | Chat cleared |
| `roll-result` | `{ expr, result, rolls, modifier, type, reason, sender, timestamp, clientId, id }` | Dice roll result |
| `voice-offer` | `{ from, sdp }` | WebRTC offer |
| `voice-answer` | `{ from, sdp }` | WebRTC answer |
| `voice-ice-candidate` | `{ from, candidate }` | WebRTC ICE candidate |
| `voice-status` | `{ clientId, clientName, enabled }` | Voice status update |
| `error` | `{ message }` | Error message |

---

## Room Structure

### Room Object
```javascript
{
  data: {},                    // Custom state data
  clients: Set(),             // Set of client socket IDs
  voice: Set(),               // Set of voice-enabled clients
  chatHistory: [],            // Array of chat messages
  createdAt: Number,          // Creation timestamp
  lastActivity: Number,       // Last activity timestamp
  name: String,               // Room display name
  maxClients: Number,         // Maximum clients (default: 20)
  password: String|null,      // Hashed password (null if none)
  owner: String,              // Owner name
  settings: {
    allowVoice: Boolean,      // Default: true
    allowDiceRolls: Boolean,  // Default: true
    allowChat: Boolean,       // Default: true
    maxMessageLength: Number, // Default: 2000
    autoDeleteAfter: Number   // Default: 3600000 (1 hour)
  }
}
```

### Chat Message Object
```javascript
{
  text: String,               // Filtered message
  sender: String,             // Sender name
  timestamp: Number,          // Timestamp
  source: 'api'|'websocket',  // Message source
  clientId: String,           // Socket ID (websocket) or 'api'
  id: String,                 // Unique message ID
  metadata: Object            // Optional metadata
}
```

### Roll Result Object
```javascript
{
  expr: String,               // Dice expression (e.g., "3d6+2")
  result: Number,             // Total result
  total: Number,              // Total (same as result)
  rolls: [Number],            // Individual die rolls
  modifier: Number,           // Modifier
  type: 'standard'|'fate'|'percentile',
  reason: String,             // Roll reason
  sender: String,             // Sender name
  timestamp: Number,          // Timestamp
  source: 'api'|'websocket',  // Roll source
  clientId: String,           // Socket ID
  id: String,                 // Unique roll ID
  metadata: Object            // Optional metadata
}
```

---

## Room Templates

| Template | Name | Description |
|----------|------|-------------|
| `fate-edge` | Fate's Edge Session | Default template with characters, timers, and scene |
| `dnd` | D&D Session | D&D template with combat timer |
| `generic` | Generic RPG Session | Minimal template |

### Template Structure
```javascript
{
  name: String,
  data: {
    vtt: {
      characters: [],        // Array of character objects
      timers: [],            // Array of timer objects
      scene: String          // Current scene description
    }
  }
}
```

---

## Authentication

### API Key Authentication
- **Method:** `X-API-Key` header or `?apiKey` query parameter
- **Default Key:** Auto-generated on startup
- **Permissions:** Scoped by API key data
- **Expiration:** Optional per-key expiration

### JWT Authentication
- **Method:** `Authorization: Bearer <token>` header
- **Expiration:** 24 hours
- **Scope:** User profile and session management

### Session Authentication
- **Method:** Express session with MemoryStore
- **Cookie:** Secure in production
- **Duration:** 24 hours

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `API_KEY` | Master API key | Auto-generated |
| `JWT_SECRET` | JWT signing secret | Auto-generated |
| `SESSION_SECRET` | Session cookie secret | Auto-generated |
| `ENABLE_UPLOAD` | Enable PDF upload | `false` |
| `ENABLE_RATE_LIMITING` | Enable rate limiting | `true` |
| `ENABLE_LOGGING` | Enable logging | `true` |
| `ENABLE_CACHING` | Not implemented — no caching layer exists | n/a |
| `ENABLE_SESSIONS` | Enable user sessions | `false` |
| `ENABLE_EMAIL` | Enable email features | `false` |
| `ENABLE_SCHEDULING` | Enable scheduling | `false` |
| `AUTO_CREATE_ROOMS` | Auto-create rooms | `false` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `AUTH_RATE_LIMIT_MAX` | Auth requests per window | `5` |
| `DATABASE_TYPE` | `sqlite` (default), `postgres`, or `mysql` (`server/storage.js`) | `sqlite` |
| `DATABASE_URL` | SQLite file path, or a Postgres/MySQL connection string | `./campaigns.db` |
| `SALT_ROUNDS` | bcrypt salt rounds | `10` |
| `MAX_CONCURRENT_CONVERSIONS` | Max concurrent conversions | `2` |
| `UPLOAD_FILE_SIZE_LIMIT` | Max upload size (bytes) | `20971520` |
| `BLOCKED_WORDS` | Comma-separated blocked words | (empty) |
| `NODE_ENV` | Environment | `development` |

### WebSocket Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_WEBSOCKET_COMPRESSION` | Enable compression | `false` |
| `ENABLE_WEBSOCKET_HEARTBEAT` | Enable heartbeat | `true` |
| `WEBSOCKET_PING_INTERVAL` | Ping interval (ms) | `25000` |
| `WEBSOCKET_PING_TIMEOUT` | Ping timeout (ms) | `60000` |

---

## Data Persistence

### File-based Storage
- **File:** `server-data.json`
- **Interval:** 60 seconds
- **Data:** Room data, chat history (last 100 messages), metadata

### In-Memory Storage
- **Rooms:** Map of room codes to room objects
- **Users:** Map of usernames to user data (sessions, login info)
- **Sessions:** Map of session IDs to session data
- **API Keys:** Map of keys to key metadata

### Database Storage (`server/storage.js`)
- SQLite by default (`campaigns.db`), or PostgreSQL/MySQL via `DATABASE_TYPE`
- Accounts, room passwords/memberships, manual campaign-share snapshots, a separate no-pruning autosave table, and character claims — see the module's own header comment for the full table list and why autosave and manual-share snapshots deliberately don't share a retention budget
- No Redis involved at any layer

---

## Features

### Real-time Communication
- WebSocket-based bidirectional communication
- Connection health monitoring with ping/pong
- Automatic reconnection support

### Voice Chat
- WebRTC-based voice communication
- Room-level voice enable/disable
- Voice client presence tracking

### Dice Rolling
- Standard dice: `2d6+3`, `1d20`, etc.
- Fate/Fudge dice: `4dF`, `2dF+1`
- Percentile dice: `d100`

### Chat System
- Message filtering (profanity, length limits)
- Chat history (last 500 messages)
- Room-level chat enable/disable

### PDF Conversion (Optional)
- PDF to HTML conversion
- Supports pdf2htmlEX and pdftohtml
- File size limit: 20 MB (configurable)

### Caching
- Not implemented — there's no Redis or other caching layer in this codebase; the "cached Ns" notes on the API endpoint tables above describe an aspirational design, not current behavior

### Rate Limiting
- IP-based rate limiting
- Separate limits for auth endpoints
- Automatic throttling

---

## Error Handling

### Standard Error Response
```javascript
{
  error: String,        // Error message
  retryAfter: Number   // Retry after (seconds) - for rate limiting
}
```

### HTTP Status Codes
| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## Development Notes

### CLI Usage Examples

**Create Room:**
```bash
curl -X POST http://localhost:3000/api/rooms \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"name": "My Game", "maxClients": 8}'
```

**Send Chat:**
```bash
curl -X POST http://localhost:3000/api/rooms/ABC123/chat \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"message": "Hello everyone!", "sender": "GM"}'
```

**Roll Dice:**
```bash
curl -X POST http://localhost:3000/api/rooms/ABC123/roll \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"roll": "3d6+2", "reason": "Attack"}'
```

**Get Room State:**
```bash
curl http://localhost:3000/api/rooms/ABC123 \
  -H "X-API-Key: YOUR_API_KEY"
```

### WebSocket Example
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_API_KEY' }
});

socket.on('connect', () => {
  socket.emit('join-room', 'ABC123', { name: 'GM' });
});

socket.on('chat-message', (msg) => {
  console.log(`${msg.sender}: ${msg.text}`);
});

socket.emit('roll-dice', { roll: '3d6+2', reason: 'Damage' });
```

---

## Performance Considerations

### Concurrency
- Event-driven, non-blocking I/O
- WebSocket connections handled asynchronously
- Multiple rooms supported simultaneously

### Resource Management
- Empty room cleanup (auto-delete after inactivity)
- Chat history limit (500 messages per room)
- Client ping/pong for connection health

### Caching Strategy
- Room list: 30 seconds
- Room state: 10 seconds
- Chat history: 10 seconds
- VTT state: 10 seconds
- Characters: 30 seconds
- Timers: 30 seconds

---

## Security Features

### Authentication
- API key requirement for all endpoints
- JWT for user-specific endpoints
- Session-based authentication (optional)

### Authorization
- Room owner permissions (delete, clear chat)
- Master key permissions (API key management, analytics)
- User role-based access: `gm` | `co-gm` | `player` | `spectator` (see "Roles & Character Registration (v4.8)" below)

### Data Validation
- Input sanitization and validation
- Message filtering (profanity, length)
- Character validation (required fields, numeric types)

### Rate Limiting
- General API rate limits
- Stricter auth endpoint limits
- Request throttling

### Security Headers
- Helmet.js middleware
- Content Security Policy
- HSTS (in production)
- XSS protection

---

## Roles & Character Registration (v4.8)

### Room roles

Every connected client has exactly one role, stored on `client.role` (in-memory,
per connection) and mirrored to `room_memberships.role` (persistent, per
account) when the client is authenticated:

| Role | Notes |
|---|---|
| `gm` | Room owner. Exactly one per room. Assigned via the existing `request_gm`/`approve_gm` socket events -- unchanged by this feature. |
| `co-gm` | Every GM permission (deck control, character edits, kick/ban, room password) except transferring/revoking the GM seat, promoting/demoting another Co-GM, or deleting/resetting the room. Multiple Co-GMs are allowed per room, uncapped. Only the GM can grant/revoke it. |
| `player` | Default role. Controls exactly one *claimed* character (see below); can edit only that character. |
| `spectator` | Fully read-only, public state only -- no character control, no writes, no GM-only/secret data. |

Role changes (other than the GM seat itself) go through the socket event
`role_change_request { targetId, role, persist }`, handled by
`room.handleRoleChangeRequest()`:
- Only a strict `role === 'gm'` sender is authorized (`security.canManageGmSeat()`)
  -- a Co-GM cannot promote or demote anyone.
- `persist: false` (the default) flips `client.role` for the current connection
  only; nothing is written to storage, so it reverts to whatever's on file
  the next time that user joins. Good for "run tonight's fight scene."
- `persist: true` also calls the existing `_persistRole()` helper (the same
  one `handleGmApproval()` already used for the GM seat), writing through to
  `room_memberships.role` so the grant survives reconnects.
- Demotions always persist, regardless of how the promotion was made, so a
  saved Co-GM can be fully revoked, not just silenced for one session.
- The server broadcasts `role_update { targetId, role, byId, persist }` to
  the room on every change.

Anywhere the codebase used to gate an action on `client.role === 'gm'`
(kick/ban/room-password, most GM-tools actions) now uses
`security.isGmLike(role)` instead, so Co-GM gets the same access. The three
seat-management actions (GM handoff, Co-GM promotion/demotion, room
delete/reset) stay on the strict `=== 'gm'` check via `canManageGmSeat()`.

A client's self-declared role on join is only trusted for
`gm`/`player`/`spectator` -- `co-gm` is never accepted from the client
itself. It's only restored automatically when the account's persisted
`room_memberships.role` already says `co-gm` (i.e., a previously *saved*
grant), so nobody can just claim Co-GM by asking for it at join time.

### Character registration (claim/release)

Bridges the account-owned character *library* (`GET/POST/PUT/DELETE
/api/account/characters`, capped at `storage.MAX_CHARACTERS_PER_USER`) to a
room's live character roster (`room.characters`), via a new
`room_character_claims` table: one row per `(room_code, user_id)`, enforcing
one live claim per player per room.

- `POST /api/rooms/:code/claim-character { characterId }` (JWT-authed) --
  binds a saved character to this room, applying immediately to the live
  roster if the room happens to be active, and always persisting the claim
  row regardless. Claiming again replaces the previous claim.
- `DELETE /api/rooms/:code/claim-character` -- releases it (the character
  stays in the account library).
- `GET /api/rooms/:code/claim-character` -- reads back the current claim.
- Equivalent socket events `claim-character` / `release-character` do the
  same thing for an already-connected client.
- On join/rejoin (both Socket.IO and plain WebSocket transports), a
  previously-saved claim auto-resolves against the room's live roster, so a
  returning player doesn't have to re-pick their character every session.
- The claimed character's roster record gets an `ownerId` field. A Player
  may only write to a character where `room.characterClaims[userId] ===
  normalizeCharKey(name)` (checked via `room.canEditCharacter()`); GM/Co-GM
  bypass this check; a Spectator never passes it.

---

## Dependencies

Reflects the actual `package.json` as of v4.8.3 — sections above describing Winston, Helmet, express-session, rate-limit/slow-down, Redis, agenda, nodemailer, handlebars, or multer are aspirational and do not correspond to installed packages.

### Dependencies
- Express.js - Web framework
- Socket.IO - WebSocket server (`ws` also used directly for the plain-WebSocket transport)
- CORS - Cross-origin resource sharing
- bcryptjs - Password hashing
- jsonwebtoken - JWT implementation
- dotenv - Environment variable loading
- sqlite3 - Default database driver

### Optional Dependencies
- mysql2 - MySQL database driver (`DATABASE_TYPE=mysql`)
- pg - PostgreSQL database driver (`DATABASE_TYPE=postgres`)

---

## License

MIT (code) — see the repo root's `LICENSE.code` and `package.json`. Game content bundled alongside the code (SRD/proprietary setting material) has its own separate licensing; see the root README's License section.
