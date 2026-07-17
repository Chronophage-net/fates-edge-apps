# Fate's Edge VTT - Design Documentation

## System Architecture

### Overview
Fate's Edge is a real-time Virtual Tabletop (VTT) server built with Node.js, Express, and Socket.IO. It provides REST API endpoints and WebSocket connections for real-time gaming features including chat, dice rolling, voice communication, and state synchronization.

### Technology Stack

**Backend:**
- Node.js with Express.js
- Socket.IO for WebSocket communication
- Redis for caching (optional)
- Winston for logging
- JSON file-based persistence

**Security:**
- API Key authentication (header or query param)
- JWT authentication for user sessions
- bcrypt password hashing
- Helmet.js for security headers
- Rate limiting and request throttling
- Session management with memory store

**Database:**
- In-memory storage with periodic JSON serialization
- Redis for caching (configurable)

### Ports & Endpoints

- **Web Server:** Port 3000 (configurable via PORT env var)
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
| `ENABLE_CACHING` | Enable Redis caching | `false` |
| `ENABLE_SESSIONS` | Enable user sessions | `false` |
| `ENABLE_EMAIL` | Enable email features | `false` |
| `ENABLE_SCHEDULING` | Enable scheduling | `false` |
| `AUTO_CREATE_ROOMS` | Auto-create rooms | `false` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `AUTH_RATE_LIMIT_MAX` | Auth requests per window | `5` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
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

### Caching (Optional)
- Redis-based caching for GET endpoints
- Configurable TTL per endpoint

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
- User role-based access (player, observer)

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

## Dependencies

### Core Dependencies
- Express.js - Web framework
- Socket.IO - WebSocket server
- Winston - Logging
- Compression - Response compression
- CORS - Cross-origin resource sharing
- Helmet - Security headers

### Security Dependencies
- bcrypt - Password hashing
- jsonwebtoken - JWT implementation
- express-session - Session management
- validator - Input validation
- rate-limit - Rate limiting
- slow-down - Request throttling

### Optional Dependencies
- redis / ioredis - Redis client
- agenda - Job scheduling
- nodemailer - Email sending
- handlebars - Email templates
- multer - File uploads

---

## License

This software is proprietary and confidential. Unauthorized copying, distribution, or use of this software is strictly prohibited.
