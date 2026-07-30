# Fate's Edge Ecosystem v2.2 — Complete TTRPG Toolkit

**Fate's Edge** is a narrative‑first TTRPG system. This monorepo provides a complete **cross‑platform ecosystem** for running and playing the game, including:

- A **web‑based toolkit** (characters, dice, VTT, timers, encounters, wiki, document library)
- A **self‑hosted campaign server** with WebSocket sync and REST API
- A **Discord bot** for full VTT and adventure control
- A **Roll20 API script** for integration with Roll20
- A **Foundry VTT module** for integration with Foundry
- An **Avrae module** for D&D Beyond integration
- A **terminal client** for CLI enthusiasts
- An **AI Game Master bot** with LLM‑driven narration and adventure generation

---

## ✨ Features

### Core Toolkit
- **Password protection** – lock the entire site with a playtester password (SHA‑256 hash)
- **Character management** – full CRUD with XP tracking
- **Character builder** – template‑based with cost calculation
- **Dice roller** – Fate's Edge resolution with position and boons
- **VTT (Virtual Tabletop)** – chat, party status, quick roller, timers
- **Timer/clocks system** – scene and campaign timers with visual progress
- **Encounter tracker** – combat log, initiative, status
- **Document library** – horizontal grid with search/filter
- **Wiki** – Markdown‑based with fuzzy search
- **Deck of Consequences** – Story Beat complication generator
- **Regional roller** – worldbuilding elements per region
- **Campaign sharing** – server‑side storage via short code
- **Adventure Engine** – load and run structured adventures (acts, scenes, encounters, timers)

### Integrations
- **Discord bot** – `/vtt`, `/vttchar`, `/vtttimer`, `/vttdeck`, `/vttadmin`, `/vttadventure`
- **Roll20 API** – `!fates-edge` commands for full VTT and adventure control
- **Foundry VTT module** – real‑time sync of chat, dice, characters, scenes, timers, adventures
- **Avrae module** – `!fe` commands for D&D Beyond
- **Terminal client** – full CLI with ANSI themes, adventure control, and styling
- **AI GM Bot** – LLM‑driven narration, adventure generation, and GM automation

---

## 🚀 Getting Started

### 1. Web Toolkit (Frontend)

The entire toolkit is a **single HTML file** (`index.html`). It’s self‑contained – all CSS and JavaScript are inside. You can:

- **Open it directly** in your browser (double‑click the file)
- **Serve it with any static web server** (`npx serve .`, Python `http.server`, or upload to your web host)

When you first open it, you’ll see a password gate (if one has been set). You can set or remove the password from the **Settings** tab.

### 2. Campaign Server (Backend)

If you want real‑time sync and adventure engine support, run the WebSocket server.

#### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/fates-edge-toolkit.git
cd fates-edge-toolkit

# Build the server image
docker build -t fates-edge-server -f Dockerfile.server .

# Run the container (maps port 3000, persists data)
docker run -d -p 3000:3000 --name fates-server -v $(pwd)/data:/app/data -v $(pwd)/modules:/app/modules fates-edge-server
```

The server will be available at `ws://localhost:3000` and `http://localhost:3000`.

#### Manual Setup (without Docker)

```bash
npm install
node server.js
```

### 3. Discord Bot

```bash
cd discord-bot
cp .env.example .env
# Edit .env with your Discord token and server URL
npm install
node index.js
```

### 4. AI GM Bot

```bash
cd ai-gm-bot
cp .env.example .env
# Edit .env with your AI provider and server URL
npm install
node ai-gm-bot.js
```

### 5. Terminal Client

```bash
cd terminal-client
npm install
node edge-cli.js --room YOUR_ROOM
```

### 6. Roll20 API Script

1. In Roll20, go to **Settings → API Scripts**
2. Paste the contents of `roll20/fates-edge-api.js`
3. Set the environment variables in the Roll20 API settings

### 7. Foundry VTT Module

1. Copy the `foundry-module/` folder to your Foundry VTT `modules/` directory
2. Enable the module in your world settings
3. Configure the connection in the module settings

### 8. Avrae Module

1. In the Avrae Discord bot, use `!drac2` with the contents of `avrae/fates-edge-avrae.py`
2. Or add it as a custom command in your D&D Beyond campaign

---

## 📦 Server API

### WebSocket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `handshake` | Client → Server | Authenticate and join room |
| `chat-message` | Client → Server | Send chat message |
| `roll-dice` | Client → Server | Broadcast roll result |
| `deck-draw` | Client → Server | Draw from deck |
| `deck-shuffle` | Client → Server | Shuffle deck |
| `deck-history` | Client → Server | Get deck history |
| `set-region` | Client → Server | Set default region |
| `request_gm` | Client → Server | Request GM role |
| `approve_gm` | Client → Server | Approve GM request |
| `sync-request` | Client → Server | Request state sync |
| `state-updated` | Client → Server | Push state update |
| `adventure-load` | Client → Server | Load adventure |
| `adventure-scene` | Client → Server | Advance scene |
| `adventure-encounter-start` | Client → Server | Start encounter |
| `adventure-encounter-resolve` | Client → Server | Resolve encounter |
| `adventure-timer` | Client → Server | Tick timer |
| `adventure-log` | Client → Server | Add log entry |

### REST API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms/:code/adventure` | Get adventure state |
| GET | `/api/rooms/:code/adventure/reference` | Get reference data |
| POST | `/api/rooms/:code/adventure/load` | Load adventure module |
| POST | `/api/rooms/:code/adventure/load-custom` | Load in‑memory adventure |
| POST | `/api/rooms/:code/adventure/reset` | Reset adventure |
| POST | `/api/rooms/:code/adventure/scene` | Advance scene |
| POST | `/api/rooms/:code/adventure/encounter/start` | Start encounter |
| POST | `/api/rooms/:code/adventure/encounter/resolve` | Resolve encounter |
| POST | `/api/rooms/:code/adventure/timer` | Tick timer |
| POST | `/api/rooms/:code/adventure/log` | Add log entry |
| GET | `/api/rooms/:code/characters` | List characters |
| GET | `/api/rooms/:code/characters/:name` | Get character |
| POST | `/api/rooms/:code/characters/update` | Update characters |
| GET | `/api/modules` | List modules |
| POST | `/api/modules` | Install module |
| POST | `/api/modules/:id/push` | Push module |
| POST | `/api/modules/:id/cleanup` | Cleanup module |
| GET | `/api/rooms` | List rooms |
| GET | `/api/rooms/:code/clients` | List clients |
| POST | `/api/rooms/:code/clients/:id/kick` | Kick client |
| POST | `/api/rooms/:code/clients/:id/ban` | Ban client |
| POST | `/api/rooms/:code/clients/:id/unban` | Unban client |

---

## 📂 Project Structure

```
fates-edge-toolkit/
├── index.html                     # Web toolkit
├── server/
│   ├── adventure.js               # Adventure Engine
│   ├── api.js                     # REST API routes
│   ├── room.js                    # Room management
│   ├── deck.js                    # Deck engine
│   ├── ws-handlers.js             # WebSocket handlers
│   └── socketio-handlers.js       # Socket.io handlers
├── discord-bot/
│   ├── index.js                   # Discord bot entry
│   └── commands/                  # Slash commands
│       ├── vtt.js                 # Main VTT commands
│       ├── vttchar.js             # Character commands
│       ├── vtttimer.js            # Timer commands
│       ├── vttdeck.js             # Deck commands
│       ├── vttadventure.js        # Adventure commands
│       ├── vttadmin.js            # Admin commands
│       └── vttchat.js             # Chat commands
├── ai-gm-bot/
│   ├── ai-gm-bot.js               # AI GM bot entry
│   ├── modules/                   # Core modules
│   │   ├── adventure-context.js   # Adventure context for prompts
│   │   ├── adventure-director.js  # Adventure selection & lifecycle
│   │   ├── characters.js          # Character management
│   │   ├── commands.js            # !gm commands
│   │   ├── deck.js                # Deck module
│   │   ├── dice.js                # Dice module
│   │   ├── gm-orchestrator.js     # GM orchestration
│   │   ├── timers.js              # Timer management
│   │   └── world-manager.js       # World data
│   └── drivers/                   # AI providers
│       ├── ollama-driver.js
│       ├── openai-driver.js
│       └── deepseek-driver.js
├── terminal-client/
│   └── edge-cli.js                # Terminal client
├── roll20/
│   └── fates-edge-api.js          # Roll20 API script
├── foundry-module/
│   └── scripts/
│       └── fates-edge-bridge.js   # Foundry VTT module
├── avrae/
│   └── fates-edge-avrae.py        # Avrae module
└── data/
    ├── adventures/                # Adventure modules (JSON)
    ├── regions/                   # Region data (JSON)
    ├── factions/                  # Faction data (JSON)
    ├── patrons/                   # Patron data (JSON)
    └── rules.txt                  # System rules for AI prompts
```

---

## 🔧 Configuration

### Frontend
| Setting | Description |
|---------|-------------|
| Password | SHA‑256 hashed, stored in `localStorage` |
| Base URL | For document link generation (auto‑detect by default) |
| Theme | Dark, light, or auto |

### Server
| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3000` | Server port |
| `API_KEY` | none | API key for REST authentication |
| `MAX_DECK_HISTORY` | `100` | Max deck history entries |
| `LOG_LEVEL` | `INFO` | Logging level |
| `ADVENTURES_DIR` | `./data/adventures` | Adventure module directory |

### AI GM Bot
| Env Var | Default | Description |
|---------|---------|-------------|
| `AI_PROVIDER` | `ollama` | `ollama`, `openai`, or `deepseek` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.1` | Ollama model |
| `OPENAI_API_KEY` | - | OpenAI API key |
| `DEEPSEEK_API_KEY` | - | DeepSeek API key |
| `DEFAULT_REGION` | `acasia-broken-marches` | Default region |
| `MAX_HISTORY` | `20` | Max conversation history |
| `SYNC_INTERVAL_MS` | `30000` | Aggressive sync interval |

### Discord Bot
| Env Var | Default | Description |
|---------|---------|-------------|
| `DISCORD_TOKEN` | - | Discord bot token |
| `VTT_SERVER_URL` | `ws://localhost:3000` | VTT server URL |
| `VTT_ROOM` | - | Default room code |
| `API_KEY` | - | Server API key |
| `CLIENT_ID` | - | Discord client ID |

---

## 🔒 License & Attribution

- **Fate's Edge** is © Nicholas A. Gasper.
- The **SRD** and **Essentials** guide are licensed under [CC BY‑NC‑SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
- All other content – setting lore, original characters, proprietary magic systems, artwork – is **All Rights Reserved**.

---

## 🤝 Contributing

This project is maintained for personal and playtester use. If you find issues or have feature requests, please open an issue or submit a pull request.

---

## 🧑‍💻 Development Notes

- The frontend uses **vanilla JavaScript** (no frameworks) and relies on `localStorage` for data.
- The server is a minimal **Express.js + WebSocket** app – extend it as needed.
- All components are designed to be **portable** and **self‑contained**.

---

**Enjoy your games!**  
— Nick Gasper