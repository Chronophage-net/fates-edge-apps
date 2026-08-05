# Fate's Edge JavaScript Toolkit v4.5.1

**Fate's Edge** is a narrative‑first TTRPG system. This directory holds the JavaScript half of the toolkit's cross‑platform ecosystem:

- A **web‑based toolkit** (`fates-edge-web-client/`) — characters, dice, VTT, timers, encounters, wiki, document library, Spellcraft, Kon'reh, and more
- A **self‑hosted campaign server** (`fates-edge-socket-server/`) with WebSocket sync, REST API, and account authentication
- A **desktop client** (`fates-edge-desktop-client/`) — Electron wrapper around the web client
- A **terminal client** (`fates-edge-terminal/`) — MUD‑style CLI for testing and administration

VTT integrations (Discord bot, Roll20 API script, Foundry VTT module, Avrae module) live one level up, under `../vtt_mods_bots/`. The Python CLI and Tkinter desktop tool live under `../python/`. See the [repo root README](../../README.md) for the full ecosystem overview, quick start, and license details — this file only covers what's specific to the JS subprojects.

> **Removed:** the standalone AI GM Bot that appeared in earlier revisions of this document has been removed from the ecosystem entirely. It is no longer part of the toolkit.

---

## ✨ Features

### Core Toolkit (`fates-edge-web-client/`)
- **Password protection** – lock the entire site with a playtester password (SHA‑256 hash), independent of server accounts
- **Character management** – full CRUD with XP tracking, a template‑based builder wizard, and talent editor
- **Dice roller** – Fate's Edge resolution with position and boons
- **VTT (Virtual Tabletop)** – chat, party status, quick roller, timers, voice chat
- **Timer/clocks system** – scene and campaign timers with visual progress
- **Encounter tracker** – combat log, initiative, bestiary, status
- **Document library** – horizontal grid with search/filter (SRD, Essentials, GM Screen)
- **Wiki** – Markdown‑based with fuzzy search and an in‑app editor
- **Deck of Consequences & Crown Spread** – Story Beat complication generator, shared across connected clients
- **Spellcraft** – unified magic-system UI (Calculator, Rites, Cantor, Witchcraft, Summoning, Monks, Spellbook, Trackers)
- **Kon'reh** – standalone 8×8 strategy board game with six AI "Schools" and Coach Mode
- **Travel Planner** – overland route and travel-time planning across regions
- **Campaign sharing** – server‑side storage via short code, real‑time WebSocket sync

### Campaign Server (`fates-edge-socket-server/`)
- **Account authentication** – register/login with bcrypt‑hashed passwords and JWT‑backed sessions (`server/auth.js`), in addition to API‑key auth for service‑to‑service calls
- **Real‑time sync** – chat, dice, characters, timers, scenes, and Deck of Consequences draws over Socket.IO/WS
- **GM election & promotion** – request GM status, approve/reject requests, transfer GM powers
- **Adventure Engine** – load and run structured adventures (acts, scenes, encounters, timers), with matching REST and Socket.IO/WS events for every mutation
- **Module management** — push and clean up modules on connected clients

---

## 🚀 Getting Started

### 1. Web Toolkit (Frontend)

```bash
cd fates-edge-web-client
npm install
npm run dev      # local dev server via Vite
# or
./build.sh       # produces dist/ for static hosting
```

You can also open `index.html` directly or serve `dist/` with any static web server. When you first open it, you'll see a password gate if one has been set — configure it from the **Settings** tab.

### 2. Campaign Server (Backend)

If you want real‑time sync, the Adventure Engine, or account authentication, run the WebSocket/REST server.

```bash
cd fates-edge-socket-server
npm install
cp env-example.md .env   # edit with your settings
node server-start.js
```

The server listens on port 3000 by default.

#### Docker

```bash
cd fates-edge-socket-server
docker build -t fates-edge-server .
docker run -d -p 3000:3000 --name fates-server -v $(pwd)/data:/app/data fates-edge-server
```

### 3. Desktop Client

```bash
cd fates-edge-desktop-client
npm install
npm run build   # produces a platform-specific installer/package
```

### 4. Terminal Client

```bash
cd fates-edge-terminal
npm install
node terminal-client.js --room YOUR_ROOM
```

### 5. VTT Integrations & Python Clients

See `../vtt_mods_bots/` (Discord bot, Roll20 API script, Foundry VTT module, Avrae module) and `../python/` (Python CLI client, Tkinter desktop tool). Each has its own README with setup instructions.

---

## 📦 Server API

See `fates-edge-socket-server/DESIGN.md` and the repo root [`API.md`](../../API.md) for the full, current REST and WebSocket event reference, including the Adventure Engine and authentication routes.

---

## 📂 Project Structure

```
utilities/javascript/
├── fates-edge-web-client/
│   ├── index.html
│   ├── css/
│   ├── data/                  # regions, patrons, factions, bestiary, docs, wiki.json
│   ├── dist/                  # production build output
│   ├── js/
│   │   ├── app.js
│   │   ├── router.js
│   │   ├── core/               # state, sync, dice, websocket, media, crypto, password, etc.
│   │   ├── components/
│   │   └── features/           # one folder per routed tab
│   └── build.sh
├── fates-edge-socket-server/
│   ├── server/
│   │   ├── auth.js             # account registration/login, JWT, bcrypt
│   │   ├── adventure.js        # Adventure Engine state machine
│   │   ├── api.js              # REST API routes
│   │   ├── room.js             # Room management / GM election
│   │   ├── deck.js             # Deck of Consequences engine
│   │   ├── ws-handlers.js
│   │   └── socketio-handlers.js
│   └── DESIGN.md
├── fates-edge-terminal/
│   └── terminal-client.js
└── fates-edge-desktop-client/
    └── (Electron wrapper around fates-edge-web-client)
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
| `API_KEY` | none | API key for REST authentication (service‑to‑service) |
| `JWT_SECRET` | none | Secret used to sign account session tokens |
| `MAX_DECK_HISTORY` | `100` | Max deck history entries |
| `LOG_LEVEL` | `INFO` | Logging level |
| `ADVENTURES_DIR` | `./data/adventures` | Adventure module directory |

See `fates-edge-socket-server/env-example.md` for the full list.

---

## 🔒 License & Attribution

- **Fate's Edge** is © Nicholas A. Gasper.
- The **SRD** and **Essentials** guide are licensed under [CC BY‑NC‑SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
- All other content – setting lore, original characters, proprietary magic systems, artwork – is **All Rights Reserved**.

Full license breakdown: see the [repo root README](../../README.md#-license).

---

## 🤝 Contributing

This project is maintained for personal and playtester use. If you find issues or have feature requests, please open an issue or submit a pull request.

---

**Enjoy your games!**
— Nick Gasper
