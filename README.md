[![Build Apps and Packages](https://github.com/Chronophage-net/fates-edge-apps/actions/workflows/build-apps-and-packages.yml/badge.svg)](https://github.com/Chronophage-net/fates-edge-apps/actions/workflows/build-apps-and-packages.yml)

# Fate's Edge Toolkit v4.1.2b – Complete VTT Ecosystem

> A modular, self-contained toolkit for running Fate's Edge TTRPG campaigns, with real‑time collaboration, VTT integrations, Game Master management, and a full in-browser magic/monastic-path system.

[![License: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](LICENSE.code)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/SRD-CC_BY--NC--SA_4.0-lightgrey.svg)](LICENSE.srd)
[![License: All Rights Reserved](https://img.shields.io/badge/Content-All_Rights_Reserved-red.svg)](LICENSE.proprietary)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-green.svg)](https://nodejs.org/)
[![Foundry VTT](https://img.shields.io/badge/Foundry-VTT-orange)](https://foundryvtt.com/)
[![Discord](https://img.shields.io/badge/Discord-Bot-5865F2)](https://discord.com/)
[![Version](https://img.shields.io/badge/version-4.1.2b-blue)](https://github.com/nicholasagaspar/fates-edge-apps)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [What's New in v4.1.2b](#-whats-new-in-v412b)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Modules](#-modules)
- [Data Files](#-data-files)
- [Integrations](#-integrations)
- [Real‑Time Campaign Server](#-real-time-campaign-server)
- [Roadmap](#-roadmap)
- [License](#-license)
- [Contributing](#-contributing)
- [Credits](#-credits)

---

## 🎯 Overview

**Fate's Edge Toolkit** is a modular, browser-based companion application for running *Fate's Edge* tabletop roleplaying games. It provides tools for character management, dice rolling, encounter tracking, faction management, campaign planning, a full magic-system UI (Cantor, Witch, Summoner, Free Caster, Runekeeper/Invoker, and Monastic traditions), and more — all in a single, self-contained web application.

The toolkit includes **real‑time VTT features** via a WebSocket/Socket.io server, a **campaign sharing server** with GM election and shared Deck of Consequences draws, **integrations** for Foundry VTT, Discord, Roll20, and Avrae, and a growing set of **standalone in-browser mini-tools** (including an original strategy board game, Kon'reh).

---

## 🆕 What's New in v4.1.2b

- **🕸️ Kon'reh** – A full original 8×8 strategy board game, playable two-player local or vs. a computer opponent with six distinct AI "Schools," each with its own evaluation style (material, mobility, aggression, board control). Includes a live Coach Mode that suggests and explains moves.
- **🧭 Travel Planner** – A new feature module for planning overland routes and travel time across the regional maps.
- **🛠️ GM Tools** – GM-facing utilities split out into their own dedicated tab, separate from the general VTT view.
- **🔮 Spellcraft & Magic System** – A unified interface covering every magic path in one place: the TAGS Calculator (Free Caster), Rites (Runekeeper/Invoker), Cantor songs & corruption, Witchcraft hedge gifts & rituals, Summoning & the bestiary, a Spellbook, and character Trackers (Obligation/Corruption/Leash/Mental Strain/Shadow-Shame-Identity).
- **🥋 Monastic Traditions** – Monk is no longer gated behind a magic path; any character can walk a monastic path by investing XP into Foundation → Working → Signature talents, tied to patron-defined traditions (breath states, techniques, and a scaling corruption track).
- **🩹 Fixes** – Corrected async rendering in the Spellcraft tab system (Calculator/Cantor/Summoning could previously render blank on first load), removed duplicate tab-click event wiring, and fixed a stale-reference bug in the Monk module's refresh button.

> **Note on Session Logging & Voice Recording:** an earlier release cycle documented automatic session logging, voice recording, and SRT subtitle generation as shipped features. They were never actually implemented in this codebase and have been moved to [Roadmap](#-roadmap) rather than listed as available.

---

## ✨ Features

### Core Tools
- **🎲 Dice Roller** — Advanced dice rolling with Story Beat tracking and outcome resolution
- **👤 Character Manager** — Create, edit, and track characters, with a dedicated Character Builder wizard, talent editor, and roller
- **⏱️ Timer System** — Visual timers for tracking threats, progress, and campaign pressure
- **⚔️ Encounter Builder** — Design and run encounters with an integrated bestiary and combat tracker
- **📚 Wiki** — Reference rules, patrons, regions, and more, with an in-app editor
- **📄 Document Viewer** — Browse and search SRD, Essentials, and GM Screen content
- **🗺️ Travel Planner** — Plan overland routes and travel time across regions

### Campaign Management
- **🏛️ Faction Manager** — Track faction standings, agendas, and relationships
- **🌟 Patron System** — Manage cosmic and terrestrial patrons with rites, witchcraft, and monastic traditions
- **📋 Kanban Board** — Organize campaign tasks, threats, and opportunities
- **✏️ Whiteboard** — Collaborative note-taking and planning
- **🛠️ GM Tools** — GM-only utilities, separated from the shared VTT view

### Magic & Character Systems (Spellcraft)
- **🔮 TAGS Calculator** — Free Caster spell construction with DV breakdown and backlash risk
- **📜 Rites** — Patron-granted rites for Runekeepers and Invokers, with obligation tracking
- **🎵 Cantor** — Songs, Push It mechanics, and a patron-scaled corruption track
- **🧹 Witchcraft** — Hedge gifts, quick workings, full rituals, and Shadow/Shame/Identity Strain tracks
- **👁️ Summoning** — A searchable bestiary, spirit binding, and Leash management
- **🥋 Monks** — Talent-gated monastic traditions, breath states, and meditation
- **📚 Spellbook** — Custom spells, signature combinations, import/export

### Advanced VTT Features
- **🔌 Real‑time WebSocket/Socket.io Sync** — Share campaign state, chat, dice rolls, characters, timers, and scenes in real time
- **🃏 Deck of Consequences** — Generate thematic complications from Story Beats, shared across all connected clients
- **👑 Crown Spread** — Campaign planning and foreshadowing tool with shared results
- **📦 Module Management** — Push and clean up modules on connected clients
- **🌍 Region Support** — Multiple regions with unique card meanings, synced across clients
- **🎤 Voice Chat** — WebRTC voice signaling for in‑game communication
- **👑 GM Election & Promotion** — Request GM status, approve/reject requests, view roles, and transfer GM powers seamlessly
- **🕸️ Kon'reh** — A standalone strategy board game with six AI opponent "Schools" and a live move-coaching mode

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

### Web Client

The web client lives at `utilities/javascript/fates-edge-web-client/`. It runs entirely in the browser, and ships both a dev entry point (`index.html`) and a production build (`dist/`).

```bash
cd utilities/javascript/fates-edge-web-client
npm install
npm run dev      # local dev server via Vite
# or
./build.sh       # produces dist/ for static hosting
```

All data stays in your browser's `localStorage` by default — export/import JSON for backup, or connect to the real‑time server below for shared campaigns.

### Real‑Time / Campaign Sharing Server

```bash
cd utilities/javascript/fates-edge-socket-server
npm install
cp env-example.md .env   # edit with your settings
node server-start.js
```

The server listens on port 3000 by default. Connect your clients (web, Foundry, Discord, Roll20, terminal) to it. See [Real‑Time Campaign Server](#-real-time-campaign-server) for what it actually does under the hood.

### Docker

```bash
cd utilities/javascript/fates-edge-web-client
docker build -t fates-edge-toolkit .
docker run -p 3000:80 fates-edge-toolkit
# or, for the client + dev container variant:
docker compose -f docker-compose.yml up
```

The socket server has its own `Dockerfile` and `build.sh` under `utilities/javascript/fates-edge-socket-server/`.

---

## 🏗️ Architecture

```
fates-edge-apps/
├── ADVISORY.md
├── API.md
├── misc/                          # design notes, TODO, wiki seed data
├── tools/                         # repo-wide maintenance scripts (copyright headers, package sync)
├── utilities/
│   ├── javascript/
│   │   ├── fates-edge-web-client/     # Main web application
│   │   │   ├── index.html
│   │   │   ├── css/
│   │   │   ├── data/                  # regions, patrons, factions, bestiary, docs, wiki.json
│   │   │   ├── dist/                  # production build output
│   │   │   ├── js/
│   │   │   │   ├── app.js
│   │   │   │   ├── router.js
│   │   │   │   ├── module-loader.js
│   │   │   │   ├── core/              # state, sync, dice, websocket, media, gravatar, etc.
│   │   │   │   ├── components/        # Toast, CharacterCard, DocCard, TimerWidget, VoiceChat
│   │   │   │   ├── features/          # one folder per routed tab (see Modules below)
│   │   │   │   └── tools/             # data-pipeline scripts (manifests, seeds, patron migration)
│   │   │   ├── Dockerfile / Dockerfile.dev / docker-compose.yml
│   │   │   └── build.sh
│   │   ├── fates-edge-socket-server/  # Real-time WebSocket + campaign sharing server
│   │   ├── fates-edge-terminal/       # MUD-style CLI client
│   │   └── fates-edge-desktop-client/ # Electron desktop client
│   ├── python/
│   │   ├── fates_edge_tool/           # legacy standalone Python tool
│   │   └── fates-edge-python-client/  # Python CLI client (packaged)
│   └── vtt_mods_bots/
│       ├── fates-edge-discord-bot/
│       ├── fates-edge-roll20/
│       └── foundry_fates-edge-bridge/
└── .github/workflows/                 # CI/CD (build-apps-and-packages)
```

### Module System

The web client uses a dynamic module loader that lazy-loads features on demand, registered in `js/router.js`:

```javascript
const ROUTE_IMPORTS = {
    home:        () => import('./features/home/index.js'),
    dashboard:   () => import('./features/dashboard/index.js'),
    characters:  () => import('./features/characters/index.js'),
    builder:     () => import('./features/builder/index.js'),
    dice:        () => import('./features/dice/index.js'),
    decks:       () => import('./features/decks/index.js'),
    encounters:  () => import('./features/encounters/index.js'),
    timers:      () => import('./features/timers/index.js'),
    factions:    () => import('./features/factions/index.js'),
    patrons:     () => import('./features/patrons/index.js'),
    docs:        () => import('./features/docs/index.js'),
    search:      () => import('./features/search/index.js'),
    settings:    () => import('./features/settings/index.js'),
    sync:        () => import('./features/sync/index.js'),
    whiteboard:  () => import('./features/whiteboard/index.js'),
    kanban:      () => import('./features/kanban/index.js'),
    wiki:        () => import('./features/wiki/index.js'),
    vtt:         () => import('./features/vtt/index.js'),
    'gm-tools':  () => import('./features/gm-tools/index.js'),
    spellcraft:  () => import('./features/spellcraft/index.js'),
    'kon-reh':   () => import('./features/kon-reh/index.js'),
    'travel-planner': () => import('./features/travel-planner/index.js'),
};
```

---

## 📦 Modules

### Core Features

| Module | Description | Path |
|--------|-------------|------|
| **Home** | Landing page with quick links | `features/home/` |
| **Dashboard** | Campaign overview with stats | `features/dashboard/` |
| **Characters** | Character management, builder wizard, talent editor, roller | `features/characters/`, `features/builder/` |
| **Dice** | Dice roller with Story Beats | `features/dice/` |
| **Timers** | Visual timer system | `features/timers/` |
| **Encounters** | Encounter builder, bestiary, and combat tracker | `features/encounters/` |
| **VTT** | Virtual tabletop with voice & real‑time sync | `features/vtt/` |
| **GM Tools** | GM-only utilities, separated from the shared VTT view | `features/gm-tools/` |
| **Docs** | Document viewer (SRD, Essentials, GM Screen) | `features/docs/` |
| **Search** | Global search | `features/search/` |
| **Wiki** | Reference wiki, with in-app editor | `features/wiki/` |
| **Decks** | Deck of Consequences & Crown Spread | `features/decks/` |
| **Patrons** | Cosmic & terrestrial patrons | `features/patrons/` |
| **Factions** | Faction management & assets | `features/factions/` |
| **Spellcraft** | Unified magic system UI — see sub-components below | `features/spellcraft/` |
| **Kon'reh** | Standalone strategy board game vs. AI or a second player | `features/kon-reh/` |
| **Travel Planner** | Overland route and travel-time planning | `features/travel-planner/` |
| **Kanban** | Campaign task board | `features/kanban/` |
| **Whiteboard** | Collaborative notes | `features/whiteboard/` |
| **Sync** | Sync status/config tab | `features/sync/` |
| **Settings** | Application settings, password gate, campaign sharing config | `features/settings/` |

### Spellcraft Sub-Components (`features/spellcraft/components/`)

| Component | Description |
|-----------|-------------|
| `calculator.js` | TAGS calculator for Free Casters |
| `cantor.js` / `rites.js` | Cantor songs and patron rites, shared rite-rendering logic |
| `witchcraft.js` | Hedge gifts, quick workings, full rituals |
| `summoning.js` | Bestiary browser and bound-spirit/Leash management |
| `monks.js` | Talent-gated monastic traditions and meditation |
| `spellbook.js` | Custom spell storage, import/export |
| `trackers.js` | Unified Obligation/Corruption/Leash/Mental Strain/Shadow-Shame-Identity tracks |

### Core Utilities (`js/core/`)

| Module | Description |
|--------|-------------|
| `state.js` | State management with localStorage persistence |
| `sync/` | Real-time sync via WebSocket (`conflict.js`, `offline-queue.js`, `operations.js`, `presence.js`) |
| `dice.js` | Dice rolling engine |
| `websocket.js` / `discovery.js` | WebSocket connection management and server discovery |
| `media.js` | Voice recording/playback support used by the VTT's voice chat |
| `crypto.js` | Client-side hashing (used by the password gate) |
| `password.js` | Password protection |
| `gravatar.js` | Gravatar integration for presence avatars |
| `pack-manager.js` / `data.js` / `game-data.js` | Data pack loading and lookup |
| `highlight-tags.js` | Inline tag highlighting used across rules text |

### Components (`js/components/`)

| Component | Description |
|-----------|-------------|
| `Toast.js` | Toast notification system |
| `CharacterCard.js` | Character display card |
| `DocCard.js` | Document reference card |
| `TimerWidget.js` | Timer display widget |
| `VoiceChat.js` | Voice chat integration |

---

## 📂 Data Files

The toolkit loads data from JSON files at runtime, under `utilities/javascript/fates-edge-web-client/data/`:

```
data/
├── bestiary.json
├── wiki.json
├── seed.js
├── docs/
│   ├── Fates_Edge_-_Essentials.html
│   ├── Fates_Edge_-_Game_Master_Screen.html
│   ├── Fates_Edge_-_Systems_Reference_Document.html
│   └── manifest-core.json
├── factions/
│   ├── manifest.json
│   └── bloody-fist.json, ecktorian-censorate.json, gray-ash.json,
│       house-contarini.json, iron-league.json, velvet-court.json
├── patrons/
│   ├── manifest.json
│   └── 17 patron files (e.g. inaea_angel_of_spiders.json, the_traveler.json,
│       khemesh_the_abyssal_maw.json, thrysos_king_of_revels.json, …)
└── regions/
    └── 18 region files (acasia.json, aelaerem.json, aeler.json, silkstrand.json,
        ykrul.json, zakov.json, …)
```

---

## 🔌 Integrations

### Foundry VTT Bridge

Install the module from the manifest URL:
```
https://github.com/fates-edge/foundry-bridge/releases/latest/download/module.json
```

**Features:** GM election & promotion panel, Deck of Consequences & Crown Spread, module management, region support, real‑time chat/dice/character/timer/scene sync.

### Discord Bot

```bash
cd utilities/vtt_mods_bots/fates-edge-discord-bot
npm install
cp .env.example .env   # add your Discord token, client ID, VTT server URL, room code
npm start
```

**Slash Commands:** `/vtt connect`, `/vtt gm request`, `/vtt gm approve @player`, `/vtt draw 3 Acasia`, `/vtt crown Acasia`.

### Roll20 API

In Roll20, go to **Settings → API Scripts**, create a new script, and paste the contents of `utilities/vtt_mods_bots/fates-edge-roll20/api/fates-edge-api.js`. Set `FATES_EDGE_SERVER_URL` and `FATES_EDGE_ROOM_CODE`.

### Avrae Module

Copy the content of `utilities/vtt_mods_bots/avrae_module.txt` into Discord (Avrae) to create the `!fe` alias.

### Terminal & Python Clients

```bash
cd utilities/javascript/fates-edge-terminal && node terminal-client.js
# or
cd utilities/python/fates-edge-python-client && pip install -e . && fates-edge-cli --help
```

---

## 🌐 Real‑Time Campaign Server

`utilities/javascript/fates-edge-socket-server/` is more than a REST upload endpoint — it's a small real‑time backend built around a `server/` directory with `server.js`, `api.js`, `room.js` (GM election/rooms), `deck.js` (shared Deck of Consequences draws), `security.js`, `storage.js`, and both `socketio-handlers.js` and `ws-handlers.js` for the real-time transport layer. Campaigns are persisted as individual JSON files (and a `campaigns.db` index) under `server/campaigns/`. See that project's own README for the full setup and API details.

---

## 🗺️ Roadmap

Features that have been discussed or partially scaffolded but are **not yet implemented** in this build:

- **Session Logging & Voice-Chat Recording** — automatic JSON session logs, recorded audio, and SRT subtitle generation. No `core/logging.js`, `core/subtitle.js`, or `features/session/` module exists yet.
- **Session Playback / Export** — replaying or exporting a logged session as HTML/Markdown/plain text depends on the above.

If you were looking for these from an earlier README revision: they were documented ahead of implementation and have been pulled back to this roadmap section until they actually ship.

---

## 🔐 License

### Code (MIT License)
All source code in this repository is licensed under the **MIT License**. See [LICENSE.code](LICENSE.code).

### SRD & Essentials (CC BY-NC-SA 4.0)
Licensed under **CC BY-NC-SA 4.0**. See [LICENSE.srd](LICENSE.srd).

### Proprietary Content (All Rights Reserved — Freely Distributed)
© **Nicholas A. Gasper**, All Rights Reserved, distributed for free as part of this toolkit: setting lore, original characters/NPCs, faction descriptions, proprietary magic systems (Runekeeper, Invoker, Cantor, Summoner, Witch, Monk, etc.), artwork/maps, original prose, the Deck of Consequences and Crown Spread systems, the Travel Framework and regional generators, and the Kon'reh board game.

**You may use this content for personal, non-commercial purposes.** For commercial use, contact **support@fates-edge.com**.

| Component | License | Commercial Use |
|-----------|---------|----------------|
| Source Code | MIT | ✅ Yes |
| SRD Content | CC BY-NC-SA 4.0 | ❌ No |
| Essentials Guide | CC BY-NC-SA 4.0 | ❌ No |
| Proprietary Content | All Rights Reserved | ❌ No (permission required) |

---

## 🤝 Contributing

1. **Fork the repository** and create your branch from `main`
2. **Follow the code style** — use existing patterns
3. **Add tests** for new functionality when possible
4. **Update documentation** as needed
5. **Submit a pull request** with a clear description of changes

### Code Style

- ES modules (`import`/`export`), `const`/`let` only, async/await, template literals, arrow functions for callbacks, JSDoc for functions.

---

## 🏆 Credits

- **Creator & Author**: Nicholas A. Gasper
- **Inspiration**: Fate's Edge TTRPG system
- **Built With**: Vanilla JavaScript, CSS, Node.js, WebSocket, WebRTC

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/nicholasagaspar/fates-edge-apps/issues)
- **Email**: support@fates-edge.com
- **Website**: [fates-edge.com](https://fates-edge.com)

---

> *"The coin that never spends is the one you don't remember taking."*
> — Serafine of the Velvet Touch

---

## 📋 Version History

### v4.1.2b (Current)
- **Added** Kon'reh, an original strategy board game with six AI "Schools" and Coach Mode
- **Added** Travel Planner module
- **Added** GM Tools as its own dedicated tab
- **Added** Spellcraft: a unified magic-system UI (Calculator, Rites, Cantor, Witchcraft, Summoning, Monks, Spellbook, Trackers)
- **Changed** Monk is now talent-gated rather than tied to a magic path — any character can walk it
- **Fixed** blank/broken Spellcraft tabs caused by async components rendering into detached DOM nodes
- **Fixed** duplicate tab-click event handlers firing twice per click
- **Moved** Session Logging, Voice Recording, and SRT generation to [Roadmap](#-roadmap) — previously documented as shipped, never actually implemented

### v4.0.0a
- Documented (but did not ship) session logging, voice recording, and SRT subtitle generation
- Real-time WebSocket sync, Deck of Consequences, Crown Spread, GM election
- Foundry VTT bridge, Discord bot, Roll20 API, Avrae module, Terminal client, Python CLI client
- Faction management, Patron system, Kanban board, Whiteboard

### v3.0
- Complete modular architecture, WebSocket real-time sync, voice chat via WebRTC, GM election & promotion, faction management, patron system, Deck of Consequences & Crown Spread, campaign Kanban board, whiteboard, Foundry bridge, Discord bot, Roll20 API, Avrae module, terminal client, Python CLI client, desktop client (Electron)

### v2.0
- Character management, dice roller with Story Beats, timer system, encounter builder, wiki system

### v1.0
- Initial release with core features

---

<p align="center">
  <sub>Made with ❤️ by the Fate's Edge Team</sub>
</p>
