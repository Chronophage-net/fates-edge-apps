Here’s a complete API reference for the Fate’s Edge WebSocket server, covering both the REST API and the WebSocket event protocol. This document reflects the current modular server code (version 2.0.0+).

---

# Fate’s Edge WebSocket Server – API Reference

The server provides two interfaces:

- **REST API** (HTTP) – for administration, deck management, module control, and player moderation.
- **WebSocket API** – for real‑time collaboration (chat, dice, deck draws, presence, GM election, etc.). Supports both **Socket.io** and **plain WebSocket** connections.

---

## 🔐 Authentication

### REST API

All REST endpoints (except health checks) require an API key. Pass it as either:

- HTTP header: `x-api-key: your-key-here`
- Query parameter: `?apiKey=your-key-here`

### WebSocket

No API key is required for WebSocket connections. Clients identify themselves via a **handshake** message (plain WS) or **join-room** event (Socket.io). The server assigns roles (`gm` or `player`) based on the first claimer or GM election.

---

## 🌐 Base URL

The server runs on the configured host and port (default `0.0.0.0:10000`).  
For local development: `http://localhost:10000/api`

---

## 📊 REST API Endpoints

### Health

**`GET /healthz`**  
**`GET /api/healthz`**  
Returns `"OK"` with status 200.

**`GET /api/health`** (or custom `healthEndpoint` from config)  
Returns server stats and room overview.

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
        "code": "ABC123",
        "name": "Room ABC123",
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
  "code": "ABC123",
  "name": "Room ABC123",
  "deck": [ ... cards ... ],
  "deckHistory": [ ... ],
  "remaining": 47,
  "offset": 123
}
```

**`POST /api/rooms/:code/deck/shuffle`**  
Shuffles the deck. Notifies room via WebSocket.

**`POST /api/rooms/:code/deck/draw`**  
Draws cards from the deck.  
**Request body:**
```json
{
  "count": 1,        // 1–5
  "region": "Acasia" // optional
}
```
If count == 5, a Crown Spread is performed.

**`POST /api/rooms/:code/deck/crown`**  
Explicitly perform a Crown Spread (5 cards).  
**Request body:**
```json
{
  "region": "Acasia"
}
```

**`GET /api/rooms/:code/deck/history?limit=50`**  
Retrieve draw history.

**`DELETE /api/rooms/:code/deck/history`**  
Clear deck history.

---

### Player / Client Management (Ban/Kick)

**`GET /api/rooms/:code/clients`**  
List all clients in a room.

**Response:**
```json
{
  "code": "ABC123",
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
{
  "reason": "Disruptive behaviour"
}
```

**`POST /api/rooms/:code/clients/:clientId/ban`**  
Ban a client (kicks them and adds to ban list).  
**Request body (optional):**
```json
{
  "reason": "Spamming"
}
```

**`POST /api/rooms/:code/clients/:clientId/unban`**  
Remove a client ID from the ban list.

---

### Modules

**`GET /api/modules`**  
List available modules (from `modules/` directory).

**`POST /api/modules/:id/push`**  
Push a module to a room or all rooms.  
**Request body:**
```json
{
  "roomCode": "ABC123"  // optional; if omitted, push to all rooms
}
```

**`POST /api/modules/:id/cleanup`**  
Request cleanup of a module from clients.  
**Request body:**
```json
{
  "roomCode": "ABC123"  // optional
}
```

---

## 📡 WebSocket API

The server accepts connections on the same port as HTTP.

- **Socket.io** – connect with a Socket.io client (e.g., `io("http://localhost:10000")`).
- **Plain WebSocket** – connect to `ws://localhost:10000?room=ROOM_CODE` or `ws://localhost:10000/campaign/ROOM_CODE`.

All WebSocket messages are JSON objects with a `type` field. Additional fields are the payload.

---

### Connection & Handshake

#### Plain WebSocket

1. Connect with room code as query parameter or path.
2. Send a `handshake` message to join the room.

**Client → Server:**
```json
{
  "type": "handshake",
  "campaignCode": "ABC123",
  "clientName": "Alice",
  "role": "gm",           // or "player"
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
  "roomCode": "ABC123",
  "playerName": "Alice",
  "playerRole": "gm",
  "playerEmail": "alice@example.com"
}
```

The server responds with `room-joined` event.

---

### Common Events (Client → Server)

| Event Type          | Description                          | Payload Example                          |
|---------------------|--------------------------------------|------------------------------------------|
| `chat-message`      | Send a chat message                  | `{ "text": "Hello", "sender": "Alice" }` |
| `roll-dice`         | Broadcast a dice roll                | `{ "expr": "3d6+2", "total": 15, ... }`  |
| `deck-draw`         | Draw cards from deck                 | `{ "count": 1, "region": "Acasia" }`     |
| `deck-shuffle`      | Shuffle the deck                     | `{}`                                     |
| `crown-spread`      | Perform Crown Spread                 | `{ "region": "Acasia" }`                 |
| `deck-history`      | Request deck history                 | `{}` (callback in Socket.io)             |
| `deck-history-clear`| Clear deck history                   | `{}`                                     |
| `request_gm`        | Request to become GM                 | `{}`                                     |
| `approve_gm`        | Current GM approves a request        | `{ "targetId": "client-id" }`            |
| `kick_client`       | **(GM only)** Kick a player          | `{ "targetId": "client-id", "reason": "" }` |
| `ban_client`        | **(GM only)** Ban a player           | `{ "targetId": "client-id", "reason": "" }` |
| `unban_client`      | **(GM only)** Unban a client         | `{ "targetId": "client-id" }`            |
| `module-push-request` | Request module push                | `{ "moduleId": "my-module" }`            |
| `module-cleanup-request` | Request module cleanup           | `{ "moduleId": "my-module" }`            |
| `module-list`       | List loaded modules                  | `{}`                                     |
| `set-region`        | Update default region                | `{ "region": "Ecktoria" }`               |
| `sync-state`        | Push full state update               | `{ "state": { ... } }`                   |
| `whiteboard-update` | Update whiteboard                    | `{ "whiteboard": { ... } }`              |
| `sync-request`      | Request whiteboard state             | `{}`                                     |
| `voice-offer`       | WebRTC signaling                     | ...                                      |
| `voice-answer`      | WebRTC signaling                     | ...                                      |
| `voice-ice-candidate` | WebRTC signaling                   | ...                                      |
| `voice-status`      | Voice enabled/disabled               | `{ "enabled": true }`                    |
| `event`             | Generic custom event                 | `{ ... }`                                |
| `presence`          | Request presence update              | `{}` (or server sends automatically)     |

---

### Common Events (Server → Client)

| Event Type           | Description                                   | Payload Example                                       |
|----------------------|-----------------------------------------------|-------------------------------------------------------|
| `connected`          | Connection established                        | `{ "clientId": "...", "room": "ABC123" }`             |
| `room-state`         | Current room state (deck, whiteboard, clients)| `{ "whiteboard": {...}, "clients": [...], ... }`      |
| `chat-message`       | Incoming chat message                         | `{ "text": "...", "sender": "Bob", ... }`             |
| `roll-result`        | Incoming dice roll                            | `{ "outcome": "success", "dice": [1,4,6], ... }`     |
| `deck-drawn`         | Cards were drawn                              | `{ "cards": [...], "synthesis": "..." }`              |
| `deck-shuffled`      | Deck was shuffled                             | `{ "remaining": 54 }`                                 |
| `crown-spread`       | Crown Spread result                           | `{ "result": { "synthesis": "...", "positions": [...] }` |
| `deck-history`       | Deck history data                             | `{ "history": [...] }`                                |
| `deck-history-cleared`| History was cleared                           | `{}`                                                  |
| `presence`           | Updated client list with roles                | `{ "clients": [ { "id": "...", "name": "...", "role": "gm" } ] }` |
| `player-joined`      | A new client joined                           | `{ "clientId": "...", "clientName": "..." }`          |
| `player-left`        | A client left                                 | `{ "clientId": "...", "clientName": "..." }`          |
| `gm_vote_request`    | Someone requests GM, current GM must approve  | `{ "requesterId": "...", "requesterName": "..." }`    |
| `gm_role_update`     | Your role changed                             | `{ "role": "gm" }`                                    |
| `server_announcement`| Broadcast from server                         | `{ "message": "..." }`                                |
| `module-push`        | New module pushed by server                   | `{ "module": { "id": "...", "manifest": {...} } }`    |
| `module-cleanup`     | Module cleanup request from server            | `{ "moduleId": "..." }`                               |
| `module-list`        | List of modules (response to request)         | `{ "modules": [...] }`                                |
| `region-updated`     | Default region changed                        | `{ "region": "Ecktoria" }`                            |
| `state-updated`      | Full state sync from another client           | `{ "state": { ... } }`                                |
| `whiteboard-update`  | Whiteboard updated by someone                 | `{ "whiteboard": { ... } }`                           |
| `sync-state`         | Response to `sync-request`                    | `{ "state": { ... } }`                                |
| `kicked`             | You have been kicked from the room            | `{ "reason": "..." }`                                 |
| `error`              | Server error message                          | `{ "message": "..." }`                                |
| `room-closed`        | Room has been closed by the server            | `{}`                                                  |

---

## 🎮 GM Election Flow

1. Any player sends `request_gm`.  
2. If no GM exists, the requester becomes GM immediately.  
3. If a GM exists, a `gm_vote_request` is sent to the current GM.  
4. The current GM can send `approve_gm` with the requester’s client ID to swap roles.  
5. Both the old and new GM receive `gm_role_update`.

---

## 🚫 Ban / Kick Flow

- Only the current GM can kick or ban.  
- Banned clients are stored per room and prevented from reconnecting (they receive an error on handshake).  
- Use `unban_client` to remove a ban.

---

## 📦 Module Management

Modules are folders under `./modules/` with a `manifest.json`.  
- `GET /api/modules` lists them.  
- `POST /api/modules/:id/push` sends the module’s content to all clients in a room (or globally).  
- `POST /api/modules/:id/cleanup` tells clients to unload/cleanup the module.  
Clients receive `module-push` and `module-cleanup` events respectively.

---

## 🔌 Quick Start Examples

### Connect with Socket.io (JavaScript)

```javascript
const socket = io('http://localhost:10000');
socket.emit('join-room', { roomCode: 'ABC123', playerName: 'Alice', playerRole: 'gm' });

socket.on('room-joined', (data) => { console.log('Joined', data); });
socket.on('chat-message', (msg) => { console.log('Chat:', msg); });
```

### Connect with Plain WebSocket

```javascript
const ws = new WebSocket('ws://localhost:10000?room=ABC123');
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
curl -X POST http://localhost:10000/api/rooms/ABC123/clients/ws-abc123/kick \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Too many dogs"}'
```

---

This reference covers all currently implemented endpoints and events. For more details, inspect the modular source files (`api.js`, `ws-handlers.js`, `socketio-handlers.js`).
