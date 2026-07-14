```markdown
# Fate's Edge Socket Server & CLI Management Tool

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/fates-edge/fates-edge)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Python](https://img.shields.io/badge/python-%3E%3D3.8-blue.svg)](https://python.org)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://docker.com)

The **Fate's Edge Socket Server** is the real-time backbone of the Fate's Edge VTT ecosystem. It provides WebSocket and HTTP API services for multiplayer gaming, real-time collaboration, and campaign management.

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [CLI Management Tool](#-cli-management-tool)
- [API Reference](#-api-reference)
- [WebSocket Events](#-websocket-events)
- [Docker](#-docker)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### Server Core
- **WebSocket Server** - Real-time bidirectional communication
- **HTTP REST API** - Comprehensive management endpoints
- **Room Management** - Create, join, and manage game rooms
- **Authentication** - API key and JWT support
- **Rate Limiting** - Protect against abuse
- **Session Management** - User sessions with memory store
- **Redis Caching** - Optional caching for performance
- **Email Support** - Nodemailer integration
- **Job Scheduling** - Agenda.js for scheduled tasks

### VTT Features
- **Chat Sync** - Real-time chat synchronization
- **Dice Rolling** - Full dice expression support (standard, Fate/Fudge)
- **Character Management** - Sync characters with attributes
- **Timer Management** - Scene timers with progress tracking
- **Scene Sync** - Synchronize scenes across clients
- **Voice Chat** - WebRTC voice signaling

### Deck of Consequences
- **Card Draw** - Draw 1-5 cards with region-based meanings
- **Crown Spread** - 4-card spread with wildcard twist
- **Deck Shuffling** - Shuffle and reset the deck
- **Deck History** - Track all draws
- **Region Support** - Multiple regions with custom card meanings

### Module Management
- **Module Pushing** - Push modules to connected clients
- **Module Cleanup** - Remove modules from clients
- **Module Listing** - List available modules

### CLI Management Tool
- **Interactive Shell** - Full-featured CLI with tab completion
- **Health Monitoring** - Server health checks
- **Room Management** - Create, delete, list rooms
- **Backup & Restore** - Backup and restore server data
- **Module Management** - Push and cleanup modules
- **Deck Operations** - Draw, crown spread, shuffle
- **Configuration** - Manage server configuration

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Pull and run the image
docker run -d \
  --name fates-edge-server \
  -p 3000:3000 \
  -v fates-edge-data:/app/data \
  -v fates-edge-logs:/app/logs \
  -e API_KEY=your-secret-key \
  fates-edge/fates-edge-server:latest

# Check health
curl http://localhost:3000/health

# Use the CLI
docker exec -it fates-edge-server fates-edge-cli status
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/fates-edge/fates-edge.git
cd fates-edge/utilities/javascript/fates-edge-socket-server

# Install dependencies
npm install

# Start the server
node server.js

# In another terminal, use the CLI
cd /path/to/fates-edge
python3 fates-edge-cli.py
```

## 📦 Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **Python** >= 3.8 (for CLI tool)
- **npm** or **yarn**
- **Redis** (optional, for caching)
- **Docker** (optional, for containerized deployment)

### From Source

```bash
# Clone the repository
git clone https://github.com/fates-edge/fates-edge.git
cd fates-edge/utilities/javascript/fates-edge-socket-server

# Install Node dependencies
npm ci

# Install Python dependencies for CLI
pip install -r requirements-cli.txt

# Create directories
mkdir -p data modules logs

# Start the server
node server.js
```

### From Docker Hub

```bash
# Pull the image
docker pull fates-edge/fates-edge-server:latest

# Run the container
docker run -d \
  --name fates-edge-server \
  -p 3000:3000 \
  -e API_KEY=your-secret-key \
  -e AUTO_CREATE_ROOMS=true \
  -v fates-edge-data:/app/data \
  -v fates-edge-modules:/app/modules \
  -v fates-edge-logs:/app/logs \
  fates-edge/fates-edge-server:latest
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `API_KEY` | Master API key | Auto-generated |
| `AUTO_CREATE_ROOMS` | Auto-create rooms on join | `false` |
| `ENABLE_RATE_LIMITING` | Enable rate limiting | `true` |
| `ENABLE_CACHING` | Enable Redis caching | `false` |
| `ENABLE_SESSIONS` | Enable session management | `false` |
| `ENABLE_EMAIL` | Enable email support | `false` |
| `ENABLE_SCHEDULING` | Enable job scheduling | `false` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_SECRET` | JWT secret key | Auto-generated |
| `SESSION_SECRET` | Session secret key | Auto-generated |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `AUTH_RATE_LIMIT_MAX` | Max auth requests | `5` |
| `WEBSOCKET_PING_INTERVAL` | WebSocket ping interval | `25000` |
| `WEBSOCKET_PING_TIMEOUT` | WebSocket ping timeout | `60000` |

### Configuration File

Create a `.env` file:

```env
PORT=3000
API_KEY=your-master-api-key
AUTO_CREATE_ROOMS=true
ENABLE_RATE_LIMITING=true
ENABLE_CACHING=false
ENABLE_SESSIONS=true
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
RATE_LIMIT_MAX=200
AUTH_RATE_LIMIT_MAX=10
```

## 🛠 CLI Management Tool

The CLI tool provides comprehensive management capabilities for the Fate's Edge server.

### Installation

```bash
# Install the CLI globally
pip install -e .

# Or use it directly
python fates-edge-cli.py
```

### Commands

#### Health & Status

```bash
# Check server health
fates-edge-cli health

# Get detailed status
fates-edge-cli status

# View server statistics
fates-edge-cli stats
```

#### Room Management

```bash
# List all rooms
fates-edge-cli rooms list

# Create a room
fates-edge-cli rooms create --name "My Campaign" --password "secret" --template fate-edge

# Get room details
fates-edge-cli rooms info ABC123

# Delete a room
fates-edge-cli rooms delete ABC123

# Get room clients
fates-edge-cli rooms clients ABC123
```

#### Deck Operations

```bash
# Draw cards from a room's deck
fates-edge-cli rooms draw ABC123 --count 3 --region Acasia

# Perform a Crown Spread
fates-edge-cli rooms crown ABC123 --region Acasia

# Shuffle the deck
fates-edge-cli rooms shuffle ABC123

# View deck history
fates-edge-cli rooms deck-history ABC123 --limit 20

# Clear deck history
fates-edge-cli rooms deck-history ABC123 --clear
```

#### VTT Operations

```bash
# Get VTT state
fates-edge-cli rooms vtt ABC123

# Get characters
fates-edge-cli rooms characters ABC123

# Get timers
fates-edge-cli rooms timers ABC123

# Send chat message
fates-edge-cli rooms chat ABC123 --message "Hello everyone!"

# Roll dice
fates-edge-cli rooms roll ABC123 --dice "3d6+2" --reason "Attack"
```

#### Module Management

```bash
# List available modules
fates-edge-cli modules list

# Push a module to a room
fates-edge-cli modules push example-module --room ABC123

# Cleanup a module from a room
fates-edge-cli modules cleanup example-module --room ABC123

# Push to all rooms
fates-edge-cli modules push example-module
```

#### Backup & Restore

```bash
# Backup server data
fates-edge-cli backup backup.json

# Restore from backup
fates-edge-cli restore backup.json
```

#### Configuration

```bash
# Get all config
fates-edge-cli config get

# Get specific config
fates-edge-cli config get server_url

# Set config
fates-edge-cli config set server_url http://localhost:3000
fates-edge-cli config set api_key your-api-key

# Remove config
fates-edge-cli config unset api_key
```

#### Logs

```bash
# View server logs
fates-edge-cli logs --tail 50

# View Docker logs
fates-edge-cli logs --tail 100 --docker
```

#### Interactive Shell

```bash
# Launch interactive shell
fates-edge-cli

# Inside the shell:
fates-edge> status
fates-edge> rooms list
fates-edge> modules list
fates-edge> backup backup.json
fates-edge> exit
```

## 📡 API Reference

### Authentication

All API requests require an API key sent in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/rooms
```

### Endpoints

#### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/status` | Server status |
| GET | `/api/stats` | Server statistics |

#### Room Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | List all rooms |
| POST | `/api/rooms` | Create a room |
| GET | `/api/rooms/:code` | Get room details |
| DELETE | `/api/rooms/:code` | Delete a room |
| GET | `/api/rooms/:code/clients` | Get room clients |
| GET | `/api/rooms/:code/state` | Get room state |
| PUT | `/api/rooms/:code/state` | Update room state |

#### Deck Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms/:code/deck` | Get deck state |
| POST | `/api/rooms/:code/deck/shuffle` | Shuffle deck |
| POST | `/api/rooms/:code/deck/draw` | Draw cards |
| POST | `/api/rooms/:code/deck/crown` | Crown Spread |
| GET | `/api/rooms/:code/deck/history` | Get deck history |
| DELETE | `/api/rooms/:code/deck/history` | Clear deck history |

#### Module Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/modules` | List modules |
| POST | `/api/modules/:id/push` | Push module |
| POST | `/api/modules/:id/cleanup` | Cleanup module |

#### VTT Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms/:code/vtt/state` | Get VTT state |
| PUT | `/api/rooms/:code/vtt/state` | Update VTT state |
| GET | `/api/rooms/:code/vtt/characters` | Get characters |
| PUT | `/api/rooms/:code/vtt/characters` | Update characters |
| GET | `/api/rooms/:code/vtt/timers` | Get timers |
| PUT | `/api/rooms/:code/vtt/timers` | Update timers |

#### Chat & Dice

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms/:code/chat` | Get chat history |
| POST | `/api/rooms/:code/chat` | Send chat message |
| DELETE | `/api/rooms/:code/chat` | Clear chat |
| POST | `/api/rooms/:code/roll` | Roll dice |

### Example API Calls

```bash
# Create a room
curl -X POST http://localhost:3000/api/rooms \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Campaign", "maxClients": 10}'

# Draw cards
curl -X POST http://localhost:3000/api/rooms/ABC123/deck/draw \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"count": 3, "region": "Acasia"}'

# Push a module
curl -X POST http://localhost:3000/api/modules/example-module/push \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"roomCode": "ABC123"}'
```

## 🔌 WebSocket Events

### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `join-room` | `{roomCode, clientData, password}` | Join a room |
| `chat-message` | `{text, sender}` | Send chat message |
| `roll-dice` | `{roll, reason}` | Roll dice |
| `sync-state` | `{state}` | Sync state |
| `deck-draw` | `{count, region}` | Draw cards |
| `deck-shuffle` | `{}` | Shuffle deck |
| `module-push` | `{moduleId}` | Request module push |
| `module-cleanup` | `{moduleId}` | Request module cleanup |
| `set-region` | `{region}` | Set default region |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `room-state` | `{roomState}` | Room state |
| `state-updated` | `{state}` | State updated |
| `chat-message` | `{message}` | Chat message |
| `roll-result` | `{rollResult}` | Roll result |
| `client-joined` | `{clientData}` | Client joined |
| `client-left` | `{clientId}` | Client left |
| `deck-drawn` | `{cards, synthesis}` | Cards drawn |
| `deck-shuffled` | `{remaining}` | Deck shuffled |
| `crown-spread` | `{result}` | Crown Spread |
| `module-list` | `{modules}` | Module list |
| `module-push` | `{module}` | Module pushed |
| `module-cleanup` | `{moduleId}` | Module cleanup |
| `region-updated` | `{region}` | Region updated |

## 🐳 Docker

### Build Image

```bash
# Build the image
docker build -t fates-edge-server .

# Build with custom tag
docker build -t fates-edge-server:1.2.0 .
```

### Run Container

```bash
# Basic run
docker run -d -p 3000:3000 --name fates-edge-server fates-edge-server

# With environment variables
docker run -d -p 3000:3000 \
  -e API_KEY=your-secret-key \
  -e AUTO_CREATE_ROOMS=true \
  -v fates-edge-data:/app/data \
  -v fates-edge-logs:/app/logs \
  --name fates-edge-server \
  fates-edge-server

# With custom config
docker run -d -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/modules:/app/modules \
  -v $(pwd)/logs:/app/logs \
  --name fates-edge-server \
  fates-edge-server
```

### Docker Compose

```yaml
version: '3.8'

services:
  fates-edge-server:
    image: fates-edge-server:latest
    container_name: fates-edge-server
    ports:
      - "3000:3000"
    environment:
      - API_KEY=${API_KEY:-your-secret-key}
      - AUTO_CREATE_ROOMS=${AUTO_CREATE_ROOMS:-true}
      - ENABLE_RATE_LIMITING=${ENABLE_RATE_LIMITING:-true}
      - ENABLE_CACHING=${ENABLE_CACHING:-false}
      - ENABLE_SESSIONS=${ENABLE_SESSIONS:-true}
    volumes:
      - ./data:/app/data
      - ./modules:/app/modules
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  redis:
    image: redis:alpine
    container_name: fates-edge-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

## 🔧 Troubleshooting

### Common Issues

#### Connection Refused

```bash
# Check if server is running
curl http://localhost:3000/health

# Check logs
docker logs fates-edge-server

# Check port availability
netstat -tulpn | grep 3000
```

#### Authentication Failed

```bash
# Get the API key from logs
docker logs fates-edge-server | grep "API Key"

# Or set it explicitly
fates-edge-cli config set api_key your-api-key
```

#### Room Not Found

```bash
# List available rooms
fates-edge-cli rooms list

# Check if auto-creation is enabled
fates-edge-cli config get AUTO_CREATE_ROOMS
```

#### WebSocket Connection Issues

```bash
# Check WebSocket endpoint
wscat -c ws://localhost:3000

# Check firewall
sudo ufw allow 3000

# Check for proxy issues
# Make sure websocket connections are allowed through proxies
```

### Logs

```bash
# View server logs
fates-edge-cli logs --tail 50

# View Docker logs
docker logs -f fates-edge-server

# View specific log file
tail -f logs/combined.log
```

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guidelines](https://github.com/fates-edge/fates-edge/blob/main/CONTRIBUTING.md).

### Development Setup

```bash
# Clone the repository
git clone https://github.com/fates-edge/fates-edge.git
cd fates-edge/utilities/javascript/fates-edge-socket-server

# Install dependencies
npm install

# Install Python dependencies for CLI
pip install -r requirements-cli.txt

# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Express](https://expressjs.com/) - Web framework
- [Socket.io](https://socket.io/) - WebSocket library
- [Node.js](https://nodejs.org/) - JavaScript runtime
- [Python](https://python.org/) - CLI tool runtime
- [Docker](https://docker.com/) - Container platform

## 📞 Support

- **Documentation**: [https://fates-edge.com/docs](https://fates-edge.com/docs)
- **Discord**: [https://discord.gg/fates-edge](https://discord.gg/fates-edge)
- **GitHub Issues**: [https://github.com/fates-edge/fates-edge/issues](https://github.com/fates-edge/fates-edge/issues)
- **Email**: support@fates-edge.com

---

Made with ❤️ by the Fate's Edge Team
