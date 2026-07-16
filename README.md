Here's the updated README for version **4.0.0a** with the new session logging and voice recording features.

---

# Fate's Edge Toolkit v4.0.0a – Complete VTT Ecosystem

> A modular, self-contained toolkit for running Fate's Edge TTRPG campaigns, with real‑time collaboration, VTT integrations, Game Master management, and **session logging with voice recording and SRT subtitle generation**.

[![License: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](LICENSE.code)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/SRD-CC_BY--NC--SA_4.0-lightgrey.svg)](LICENSE.srd)
[![License: All Rights Reserved](https://img.shields.io/badge/Content-All_Rights_Reserved-red.svg)](LICENSE.proprietary)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-green.svg)](https://nodejs.org/)
[![Foundry VTT](https://img.shields.io/badge/Foundry-VTT-orange)](https://foundryvtt.com/)
[![Discord](https://img.shields.io/badge/Discord-Bot-5865F2)](https://discord.com/)
[![Version](https://img.shields.io/badge/version-4.0.0a-blue)](https://github.com/nicholasagaspar/fates-edge-apps)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [What's New in v4.0.0a](#-whats-new-in-v400a)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Modules](#-modules)
- [Data Files](#-data-files)
- [Integrations](#-integrations)
- [Session Logging & Voice Recording](#-session-logging--voice-recording)
- [License](#-license)
- [Contributing](#-contributing)
- [Credits](#-credits)

---

## 🎯 Overview

**Fate's Edge Toolkit** is a modular, browser-based companion application for running *Fate's Edge* tabletop roleplaying games. It provides tools for character management, dice rolling, encounter tracking, faction management, campaign planning, and more — all in a single, self-contained web application.

The toolkit now includes **real‑time VTT features** via WebSocket, a **campaign sharing server**, **integrations** for Foundry VTT, Discord, Roll20, and Avrae, and **session logging with voice recording and SRT subtitle generation** — allowing you to capture every moment of your sessions for review, transcription, or content creation.

---

## 🆕 What's New in v4.0.0a

- **📝 Session Logging** – Automatically log all chat messages, dice rolls, system events, and GM actions to a structured JSON log file. Perfect for session recaps and post‑game analysis.
- **🎤 Voice Recording** – Record voice chat during sessions directly from the VTT interface. Audio is saved as WAV or MP3 files (configurable).
- **📄 SRT Subtitle Generation** – Automatically generate SRT subtitle files from recorded audio, with timestamps aligned to the session log. Great for creating video summaries or accessibility.
- **🗂️ Session Archive** – All logs, recordings, and subtitles are bundled into a zip archive per session, ready for download or cloud storage.
- **🔍 Searchable Logs** – Full‑text search over session logs, with filtering by player, event type, or timestamp.
- **⏱️ Session Playback** – Replay a session from the log, viewing chat and events in real‑time speed (experimental).
- **📤 One‑Click Export** – Export session data as HTML, Markdown, or plain text for sharing with your players.

---

## ✨ Features

### Core Tools
- **🎲 Dice Roller** — Advanced dice rolling with Story Beat tracking and outcome resolution
- **👤 Character Manager** — Create, edit, and track characters with full attribute/skill systems
- **⏱️ Timer System** — Visual timers for tracking threats, progress, and campaign pressure
- **⚔️ Encounter Builder** — Design and run encounters with integrated combat tracker
- **📚 Wiki** — Reference rules, patrons, regions, and more
- **📄 Document Viewer** — Browse and search SRD and expanded content

### Campaign Management
- **🏛️ Faction Manager** — Track faction standings, agendas, and relationships
- **🌟 Patron System** — Manage cosmic and terrestrial patrons with rites and obligations
- **📋 Kanban Board** — Organize campaign tasks, threats, and opportunities
- **✏️ Whiteboard** — Collaborative note-taking and planning

### Advanced VTT Features
- **🔌 Real‑time WebSocket Sync** — Share campaign state, chat, dice rolls, characters, timers, and scenes in real time
- **🃏 Deck of Consequences** — Generate thematic complications from Story Beats, shared across all connected clients
- **👑 Crown Spread** — Campaign planning and foreshadowing tool with shared results
- **📦 Module Management** — Push and clean up modules on connected clients
- **🌍 Region Support** — Multiple regions with unique card meanings, synced across clients
- **🎤 Voice Chat** — WebRTC voice signaling for in‑game communication (with optional recording)
- **👑 GM Election & Promotion** — Request GM status, approve/reject requests, view roles, and transfer GM powers seamlessly

### Session Logging & Recording (New in v4.0.0a)
- **📝 Automatic Session Logging** — Every chat message, roll, system event, and GM action is timestamped and stored in a structured JSON format
- **🎙️ Voice Recording** — Record voice sessions with one‑click start/stop; audio files saved in WAV/MP3 format with configurable bitrate
- **📄 SRT Subtitle Generation** — Automatically generate subtitle files from recorded audio, aligned with log timestamps for perfect sync
- **🗂️ Session Archives** — All session data (log, audio, SRT, optional notes) bundled into a zip file for download
- **🔍 Search & Filter** — Full‑text search and filter by participant, event type, or time range
- **▶️ Session Playback** — Replay a session from the log, seeing chat and events as they happened
- **📤 Export Options** — Export session logs as HTML, Markdown, plain text, or JSON for integration with other tools

### Integrations
- **Foundry VTT Bridge** — Full module with GM election, deck, modules, region support, and real‑time sync
- **Discord Bot** — Slash commands for VTT management, GM election, deck draws, timers, and more
- **Roll20 API** — Sync chat, dice, characters, deck, and GM management
- **Avrae Module** — Use Fate's Edge commands directly in Avrae (D&D bot) with `!fe` commands
- **Terminal Client** — MUD‑style CLI for testing and administration
- **Python CLI** — Full‑featured command‑line client

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 24.x or later (for server components)
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, Safari)

### Web Client Only (No Server Required)

The entire web client is a **single HTML file** (`index.html`). It runs entirely in your browser – no installation, no server required (except for sharing campaigns).

1. Open `index.html` in your browser.
2. Start creating characters, rolling dice, building encounters, and managing your campaign.
3. All data stays in your browser's `localStorage` – export/import JSON for backup.

### Full Ecosystem Setup

```bash
# Clone the repository
git clone https://github.com/nicholasagaspar/fates-edge-apps.git
cd fates-edge-apps

# Install dependencies for the web client
npm install

# Start the development server
npm run dev

# Or build for production
npm run build
```

### Start the WebSocket Server (Real‑time VTT)

```bash
cd utilities/javascript/fates-edge-socket-server
npm install
cp .env.example .env   # edit with your settings
node server.js
```

The server listens on port 3000 by default. Connect your clients (web, Foundry, Discord, Roll20, terminal) to it.

### Campaign Sharing Server (Optional)

Share your campaign state with your group using a short 6‑character code.

```bash
# The campaign server is also in the socket-server directory
cd utilities/javascript/fates-edge-socket-server
npm start
```

Then in the web client, go to **Settings → Campaign Sharing**, enter the server URL, and upload your state.

### Docker

```bash
# Build the image
docker build -t fates-edge-toolkit .

# Run the container
docker run -p 3000:80 fates-edge-toolkit

# With WebSocket server included
docker-compose up
```

---

## 🏗️ Architecture

The toolkit is built on a modular architecture with a clean separation of concerns:

```
fates-edge-apps/
├── ttrpg/utilities/javascript/
│   ├── fates-edge-web-client/    # Main web application
│   │   ├── index.html            # Entry point
│   │   ├── css/                  # Stylesheets
│   │   ├── js/
│   │   │   ├── app.js            # Application entry
│   │   │   ├── router.js         # Navigation router
│   │   │   ├── module-loader.js  # Dynamic module loader
│   │   │   ├── core/             # Core utilities
│   │   │   ├── components/       # Reusable UI components
│   │   │   └── features/         # Feature modules
│   │   ├── regions/              # Region data
│   │   ├── factions/             # Faction data
│   │   └── data/                 # Data files (wiki, patrons, etc.)
│   ├── fates-edge-socket-server/ # WebSocket server + CLI tool
│   ├── fates-edge-terminal/      # Terminal client
│   └── fates-edge-desktop-client/# Electron desktop client
├── utilities/vtt_mods_bots/
│   ├── fates-edge-discord-bot/   # Discord bot
│   ├── fates-edge-roll20/        # Roll20 API module
│   ├── foundry_fates-edge-bridge/# Foundry VTT module
│   └── avrae_module.txt          # Avrae alias
├── misc/                         # Source data files
└── .github/workflows/            # CI/CD workflows
```

### Module System

The application uses a dynamic module loader that lazy-loads features on demand:

```javascript
// Module paths are registered in module-loader.js
const modulePaths = {
    'home': './features/home/index.js',
    'characters': './features/characters/index.js',
    'factions': './features/factions/index.js',
    'patrons': './features/patrons/index.js',
    'vtt': './features/vtt/index.js',      // VTT connected mode
    'decks': './features/decks/index.js',  // Deck of Consequences
    'session': './features/session/index.js', // Session logging & recording (new)
    // ... etc
};
```

### Session Logging & Recording Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Session Recording                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │  WebSocket   │─────▶│  Session     │                    │
│  │  Events      │      │  Logger      │                    │
│  └──────────────┘      └──────────────┘                    │
│         │                     │                             │
│         ▼                     ▼                             │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │  Voice       │─────▶│  SRT         │                    │
│  │  Recorder    │      │  Generator   │                    │
│  └──────────────┘      └──────────────┘                    │
│         │                     │                             │
│         └──────────┬──────────┘                             │
│                    ▼                                        │
│           ┌─────────────────┐                               │
│           │  Session        │                               │
│           │  Archive (.zip) │                               │
│           └─────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Modules

### Core Features

| Module | Description | Path |
|--------|-------------|------|
| **Home** | Landing page with quick links | `features/home/` |
| **Dashboard** | Campaign overview with stats | `features/dashboard/` |
| **Characters** | Character management | `features/characters/` |
| **Builder** | Character builder wizard | `features/builder/` |
| **Dice** | Dice roller with Story Beats | `features/dice/` |
| **Timers** | Visual timer system | `features/timers/` |
| **Encounters** | Encounter builder & tracker | `features/encounters/` |
| **VTT** | Virtual tabletop with voice & real‑time sync | `features/vtt/` |
| **Docs** | Document viewer | `features/docs/` |
| **Search** | Global search | `features/search/` |
| **Wiki** | Reference wiki | `features/wiki/` |
| **Decks** | Deck of Consequences & Crown Spread | `features/decks/` |
| **Patrons** | Cosmic & terrestrial patrons | `features/patrons/` |
| **Factions** | Faction management & assets | `features/factions/` |
| **Session** | Session logging, voice recording, and playback (NEW) | `features/session/` |
| **Settings** | Application settings | `features/settings/` |

### Core Utilities

| Module | Description |
|--------|-------------|
| `core/state.js` | State management with localStorage persistence |
| `core/sync/` | Real-time sync via WebSocket |
| `core/dice.js` | Dice rolling engine |
| `core/websocket.js` | WebSocket connection management (unified) |
| `core/media.js` | Media and voice support (recording, playback) |
| `core/logging.js` | Session logging engine (NEW) |
| `core/subtitle.js` | SRT subtitle generation (NEW) |
| `core/password.js` | Password protection |
| `core/gravatar.js` | Gravatar integration |

### Components

| Component | Description |
|-----------|-------------|
| `Toast.js` | Toast notification system |
| `CharacterCard.js` | Character display card |
| `TimerWidget.js` | Timer display widget |
| `VoiceChat.js` | Voice chat integration |
| `SessionControls.js` | Session recording controls (NEW) |
| `PlaybackControls.js` | Session playback controls (NEW) |

---

## 📂 Data Files

The toolkit loads data from JSON files at runtime:

### Regions (`/regions/`)
```
/regions/
├── manifest.json         # List of available regions
└── acasia.json          # Acasia region data
```

### Factions (`/factions/`)
```
/factions/
├── manifest.json         # List of available factions
├── velvet-court.json     # The Velvet Court
├── iron-league.json      # The Iron League
├── gray-ash.json         # Gray Ash Ykrul
├── ecktorian-censorate.json
├── bloody-fist.json      # The Bloody Fist Company
└── house-contarini.json  # House Contarini
```

### Patrons (`/data/patrons/`)
```
/data/patrons/
├── manifest.json         # List of available patrons
└── traveler.json         # The Traveler patron data
```

### Wiki (`/wiki.json`)
```
/wiki.json                # Wiki entries in JSON format
```

---

## 🔌 Integrations

### Foundry VTT Bridge

Install the module from the manifest URL:
```
https://github.com/fates-edge/foundry-bridge/releases/latest/download/module.json
```

**Features:**
- GM election & promotion panel
- Deck of Consequences & Crown Spread
- Module management
- Region support
- Real‑time chat, dice, character, timer, and scene sync
- Session logging integration (logs events from Foundry)

### Discord Bot

```bash
cd utilities/vtt_mods_bots/fates-edge-discord-bot
npm install
cp .env.example .env   # add your Discord token, client ID, VTT server URL, room code
npm start
```

**Slash Commands:**
- `/vtt connect` – connect to the VTT server
- `/vtt gm request` – request to become GM
- `/vtt gm approve @player` – approve a pending GM request
- `/vtt draw 3 Acasia` – draw 3 cards from the Acasia region
- `/vtt crown Acasia` – perform a Crown Spread

### Roll20 API

1. In Roll20, go to **Settings → API Scripts**.
2. Create a new script and paste the contents of `utilities/vtt_mods_bots/fates-edge-roll20/api/fates-edge-api.js`.
3. Set global variables (e.g., `FATES_EDGE_SERVER_URL`, `FATES_EDGE_ROOM_CODE`).

**Commands:** `!fates-edge gm request`, `!fates-edge draw 3`, etc.

### Avrae Module

Copy the content of `utilities/vtt_mods_bots/avrae_module.txt` into Discord (Avrae) to create the `!fe` alias. Supports deck draws, Crown Spread, GM management, and more.

**Commands:** `!fe draw 3 Acasia`, `!fe gm request`, etc.

### Terminal Client

```bash
cd utilities/javascript/fates-edge-terminal
npm install
node terminal-client.js
```

Type `/help` for commands. Great for testing and server administration.

### Python CLI Client

```bash
cd utilities/python/fates-edge-python-client
pip install -e .
fates-edge-cli --help
```

Supports full VTT operations, deck management, and GM functions.

---

## 🎙️ Session Logging & Voice Recording

The new **Session module** (v4.0.0a) provides comprehensive session capture and playback.

### Features

- **Automatic Logging** – Every chat message, dice roll, timer tick, scene change, system event, and GM action is logged with a timestamp, sender, and metadata.
- **Voice Recording** – Record voice from the VTT voice chat; audio is saved in WAV format (configurable to MP3 with `lame` or similar).
- **SRT Subtitle Generation** – After recording, the system automatically generates a `.srt` file with timestamps synchronized to the voice recording and aligned with the session log, making it easy to create video subtitles or transcripts.
- **Session Archive** – All session data (JSON log, audio file, SRT file, optional notes) is bundled into a zip file for easy download and sharing.
- **Search & Filter** – Search through logs by participant, event type, keyword, or time range.
- **Playback Mode** – Replay a session from the log, watching chat and events appear in real‑time at adjustable speed.
- **Export** – Export logs as HTML (styled), Markdown, plain text, or raw JSON for integration with other tools.

### Usage

1. Open the **Session** tab in the toolkit.
2. Click **Start Recording** to begin capturing all events and voice.
3. Play your session as normal – everything is logged automatically.
4. When finished, click **Stop Recording**.
5. The system will generate the log, compress the audio, and produce the SRT file.
6. Click **Download Archive** to save the `.zip` file containing all session data.

You can also export the log in different formats directly from the session list.

---

## 🔐 License

### Code (MIT License)
All source code in this repository is licensed under the **MIT License**. You may use, modify, and distribute the code freely. See [LICENSE.code](LICENSE.code) for details.

### SRD & Essentials (CC BY-NC-SA 4.0)
The System Reference Document and Essentials guide are licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License**. You may share and adapt the material for non-commercial purposes with attribution. See [LICENSE.srd](LICENSE.srd) for details.

### Proprietary Content (All Rights Reserved — Freely Distributed)
The following content is © **Nicholas A. Gasper**, All Rights Reserved, but is distributed for free as part of this toolkit:

- Setting lore (Acasia, Aeler, Vhasia, the Curse, etc.)
- Original characters, NPCs, and named figures
- Faction descriptions and campaign-specific content
- Proprietary magic systems (Runekeeper, Invoker, Cantor, Summoner, etc.)
- Artwork, maps, and graphical elements
- Original prose, framing devices, and narrative text
- The Deck of Consequences and Crown Spread systems
- The Travel Framework and regional generators

**You may use this content for personal, non-commercial purposes.** For commercial use, please contact **support@fates-edge.com** for permission.

### Summary

| Component | License | Commercial Use |
|-----------|---------|----------------|
| Source Code | MIT | ✅ Yes |
| SRD Content | CC BY-NC-SA 4.0 | ❌ No |
| Essentials Guide | CC BY-NC-SA 4.0 | ❌ No |
| Proprietary Content | All Rights Reserved | ❌ No (permission required) |

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository** and create your branch from `main`
2. **Follow the code style** — use existing patterns
3. **Add tests** for new functionality when possible
4. **Update documentation** as needed
5. **Submit a pull request** with a clear description of changes

### Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/fates-edge-apps.git
cd fates-edge-apps

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Code Style

- Use ES modules (`import`/`export`)
- Use `const` and `let` (no `var`)
- Use async/await for promises
- Use template literals for strings
- Use arrow functions for callbacks
- Add JSDoc comments for functions

---

## 🏆 Credits

- **Creator & Author**: Nicholas A. Gasper
- **Inspiration**: Fate's Edge TTRPG system
- **Built With**: Vanilla JavaScript, CSS, Node.js, WebSocket, WebRTC

---

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/nicholasagaspar/fates-edge-apps/issues)
- **Email**: support@fates-edge.com
- **Website**: [fates-edge.com](https://fates-edge.com)

---

## 🙏 Acknowledgments

- The Fate's Edge playtest community
- Contributors and collaborators
- Open source libraries and tools

---

> *"The coin that never spends is the one you don't remember taking."*  
> — Serafine of the Velvet Touch

---

## 📋 Version History

### v4.0.0a (Current)
- **Session Logging** – automatic JSON logging of all game events
- **Voice Recording** – record voice chat during sessions
- **SRT Subtitle Generation** – automatic subtitle files from voice recordings
- **Session Playback** – replay sessions from logs
- **Search & Filter** – full-text search over session logs
- **Export** – export logs as HTML, Markdown, plain text, or JSON
- **Session Archive** – zip downloads of all session data

### v3.0
- Complete modular architecture
- WebSocket real-time sync with unified client
- Voice chat support via WebRTC
- GM election & promotion system
- Faction management system
- Patron system
- Deck of Consequences & Crown Spread
- Campaign Kanban board
- Whiteboard
- Foundry VTT bridge
- Discord bot with slash commands
- Roll20 API integration
- Avrae module
- Terminal client
- Python CLI client
- Desktop client (Electron)

### v2.0
- Character management
- Dice roller with Story Beats
- Timer system
- Encounter builder
- Wiki system

### v1.0
- Initial release with core features

---

<p align="center">
  <sub>Made with ❤️ by the Fate's Edge Team</sub>
</p>