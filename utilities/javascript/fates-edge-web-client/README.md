# Fate's Edge Web Client

**The browser‑based toolkit for running Fate's Edge – a narrative‑first TTRPG.**

[![License: MIT](https://img.shields.io/badge/Code%20License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/SRD%20License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Project: Fate's Edge](https://img.shields.io/badge/Project-Fate's%20Edge-8A2BE2)](https://github.com/Chronophage-net/fates-edge-apps)

> *"Every choice carries weight. Every debt echoes forward. Every road remembers."*

---

## 📖 Overview

The **Fate's Edge Web Client** is a complete, self‑contained browser application for running *Fate's Edge* – a narrative‑first tabletop roleplaying game. It provides all the tools you need to create characters, roll dice, manage encounters, track factions, plan campaigns, and explore a rich magical system – all in one single‑page application.

This client is part of the larger [Fate's Edge Applications](https://github.com/Chronophage-net/fates-edge-apps) monorepo, which also includes the real‑time campaign server, Discord bots, and VTT integrations.

> **The Rules:** This application implements the full *Fate's Edge* ruleset. The **Essentials** guide (included in the repository) contains the open‑license System Reference Document (SRD) – the core mechanics you need to play. The full game (extended lore, proprietary magic systems, adventures, etc.) is available separately.

---

## ✨ Features

### 🎲 Core Systems
- **Dice Roller** – Full resolution with Position (Dominant/Controlled/Desperate), Boons, and Story Beats.
- **Character Wizard** – Guided creation with attributes, skills, talents, and magic paths.
- **Character Editor** – Full management with XP tracking, skills, and inventory.

### 🎭 Game Management
- **Adventure Manager** – Load, create, and track campaigns with acts, scenes, timers, and progress.
- **Crown Spread Integration** – Generate complete adventures from card readings.
- **Whiteboard** – Collaborative drawing, notes, tactical planning with layers, grid combat, and Fog of War.
- **Kanban Board** – Campaign progress tracking with custom columns and clocks.
- **GM Tools** – Scene management, timers, encounter tracking, and session logging.

### 📚 Reference & Content
- **Wiki** – Markdown‑powered reference for rules, patrons, regions, equipment, talents, and more.
- **Document Library** – Browse and view HTML/PDF documents from `/data/docs/`.
- **Patrons Module** – Cosmic and terrestrial patrons with rites, gifts, and corruption mechanics.
- **Faction Manager** – Track faction standing, agendas, assets, and followers.
- **Bestiary** – Creature reference with stats, descriptions, and SB moves.
- **Search Everything** (`js/features/search/`) – Full-text search across the Wiki, documents, patrons, factions, and regions. Works with zero setup (a local Fuse.js index, auto-built from `/data/` on first use) — optionally point it at a self-hosted **Solr** or **Elasticsearch** index instead for a shared, pre-built search backend. See [Search Backend Configuration](#-search-backend-configuration-optional) below.

### 🌐 Connected Play
- **WebSocket Support** – Real‑time multiplayer with Socket.io or plain WebSocket modes.
- **VTT (Virtual Tabletop)** – Live table with chat, presence, and WebRTC voice support.
- **Campaign Sharing** – Upload and load campaign states via HTTP API.

### 🧙 Magic & Spellcraft – *One unified interface*
- **TAGS Calculator** – Free Caster spell creation and testing.
- **Rites** – Runekeeper and Invoker rite management.
- **Cantor** – Songs and corruption mechanics.
- **Witchcraft** – Hedge Gifts, Quick Workings, Full Rituals, and the Shadow/Shame/Identity Strain price tracks. Available to the Witch path, and to any character who's taken the "Craft of the Hedge" talent — not gated on magic path alone.
- **Summoning** – Spirit binding and leash management.
- **Spellbook** – Spell collection and casting.
- **Monastic Traditions** – Breath states, techniques, and corruption track.

### 🔨 Crafting – *Its own sidebar page, open to every character*
- **Crafting Bench** – Forage or buy ingredients, combine them, and work recipes into consumables (per the *Gear, Magic Items, and Crafting* rules: a downtime action, 1–2 XP, a DV 3 skill roll). Tracks a per‑character crafted‑item inventory with uses remaining.
- **The Codex** – A browsable reference of sample magic items, consumables, and artifacts (Minor/Major/Prestige/Epic tiers), loaded from `/data/wiki.json`. Attune up to 3 magic items and track their upkeep — pay XP (Efficient) or spend a downtime scene (Intensive) each downtime, or let an item slide from Maintained → Neglected → Compromised.
- Split out from Witchcraft, since ingredient/recipe crafting never had anything to do with hedge magic specifically — see `js/features/crafting/index.js`.

### 🎮 Bonus: Kon'reh Strategy Board Game
- Original 8×8 strategy game with two‑player local or AI opponents (six distinct schools of play).
- Coach Mode with live move suggestions.

### 🗺️ Travel Planner
- Plan overland routes with regional data.

---

## 🚀 Quick Start

**→ See [INSTALL.md](INSTALL.md) for the full setup guide** — solo/local
use, hosting it for your table (Docker), pointing it at your own Socket
Server, updates, and troubleshooting.

### For Players & GMs (solo, no install)
1. **Clone or download** this repository.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge, or Safari).
3. Set a password (optional) – click the lock icon in the sidebar.
4. Start creating characters, rolling dice, and building your campaign!

### Hosting it for your table
```bash
cd fates-edge-apps/utilities/javascript/fates-edge-web-client
docker compose up -d
```
Then open `http://localhost:8080`. See [INSTALL.md](INSTALL.md) for
pointing it at your self-hosted [Socket Server](../fates-edge-socket-server/INSTALL.md)
— that step's easy to miss.

### For Developers
```bash
# Clone the monorepo
git clone https://github.com/Chronophage-net/fates-edge-apps.git
cd fates-edge-apps/utilities/javascript/fates-edge-web-client

# Serve locally (any static server)
python3 -m http.server 8000
# or
npx serve

# Build for production (generates manifests and seed)
npm run build
```

---

## 📁 Project Structure

```
fates-edge-web-client/
├── index.html              # Main entry point
├── css/                    # Stylesheets
├── data/                   # Game data (all JSON)
│   ├── adventures/         # Campaign adventures
│   ├── bestiary/           # Creature data
│   ├── docs/               # Document library
│   ├── factions/           # Faction data
│   ├── patrons/            # Cosmic patron data
│   ├── regions/            # Regional data
│   ├── religions/          # Religion data
│   └── terrestrial/        # Terrestrial patron data
├── js/                     # JavaScript source
│   ├── app.js              # Application entry point
│   ├── router.js           # Navigation routing
│   ├── module-loader.js    # Dynamic module loading
│   ├── core/               # Core libraries (dice, state, sync, etc.)
│   ├── features/           # Feature modules
│   └── tools/              # Build and utility tools
├── tests/                  # Unit and integration tests
├── DESIGN.md               # Design documentation
├── Dockerfile              # Production container
└── README.md               # This file
```

---

## 🔐 Password Protection

The toolkit can be password‑protected in two ways:

1. **User‑Set Password** – Click the lock icon in the sidebar to set a local password (stored only in your browser).
2. **Build‑Time Lock** – Use `npm run build:locked -- --password=your-secure-password` to distribute a pre‑locked build.

> **Emergency Reset:** If you forget your local password, set an emergency reset code in `data/lock-reset.json` (see the `generate-seed.js` tool for hashing).

---

## 🌐 Real‑Time Campaign Server

The client connects to a WebSocket/Socket.io server for multiplayer features. The server is part of the parent monorepo and can be run separately.

Default endpoints:
```
ws://localhost:10000              # Local development
wss://fates-edge-ws.onrender.com  # Production default
```

### API Endpoint for Character Sync
```
POST /api/rooms/:roomCode/characters/update
{ "updates": { "Character Name": { "harm": 0, "fatigue": 0, "boons": 3, ... } } }
```

---

## 🔍 Search Backend Configuration (optional)

`js/features/search/index.js` works out of the box with **no configuration at all** — it builds a local search index from `/data/` on first use (Fuse.js, cached in `sessionStorage`) and needs nothing external. This is the right choice for the common case (a single GM's browser, or a small self-hosted table).

If you're deploying this client at scale and want a shared, pre-built search index instead (faster, and searchable the same way for every visitor without each browser rebuilding its own), point it at a self-hosted **Solr** or **Elasticsearch** instance by setting one of these globals in a small inline `<script>` before this app's own scripts load (e.g. added to `index.html`, or via whatever templating your deployment uses):

```html
<script>
  // Solr — url should be the collection's /select endpoint
  window.__SOLR_URL = 'https://solr.example.com/solr/fatesedge/select';

  // Elasticsearch — url is the index base, no trailing slash / no /_search
  window.__ES_URL = 'https://es.example.com/fatesedge';
  window.__ES_API_KEY = 'base64-id:secret';  // optional, sent as `Authorization: ApiKey ...`

  // Only needed if you've configured BOTH and want to force one:
  window.__SEARCH_BACKEND = 'elasticsearch'; // or 'solr'
</script>
```

If both are configured with no explicit `__SEARCH_BACKEND`, Solr is tried first, falling back to Elasticsearch, then to the local Fuse.js index if neither responds. Whichever one actually connects is shown on the **System Status** page (sidebar → System → 🩺 Status).

**Security note:** queries go straight from the browser to whichever URL you configure — there's no server-side proxy in this client. That means the endpoint needs either open CORS or the embedded API key above; don't point either at an endpoint you wouldn't want a site visitor querying directly from their own browser's devtools.

Neither backend is required, installed, or run by anything in this repo — "configuring" one just means pointing this client at search infrastructure you already run yourself.

---

## 📄 License

The project uses a **dual‑license** model to protect both the open‑source code and the proprietary game content.

### Code (MIT)
The source code of this web client is licensed under the **MIT License**.  
You are free to use, modify, and distribute the code for any purpose, provided you include the original copyright notice.

### Content (Mixed)

- **SRD (System Reference Document)** – The core mechanics, as published in the *Essentials* guide, are licensed under **CC BY‑NC‑SA 4.0**. You may share and adapt them for non‑commercial purposes, with attribution.
- **All Other Content** – This includes setting lore, original characters, faction descriptions, proprietary magic systems (e.g., Runekeeper, Invoker, Cantor), artwork, maps, adventures, and narrative text. These are **All Rights Reserved** and the intellectual property of Nicholas A. Gasper.

For permissions regarding Copyright, contact: **support@fates-edge.com**

---

## 📚 The Essentials Guide

The **Essentials** guide (included in this repository as `Fate's Edge - Essentials.txt` or `Fate's Edge - Essentials.pdf`) is the open‑license core of the game. It contains:

- The complete resolution loop (dice, Position, DV, Outcome Matrix)
- Character creation rules
- Boons, Story Beats, Fatigue, Harm, and Armor Conversion
- A starter adventure (*The Lantern at Dusk*)
- Simplified magic (Free Casting and Hedge Gifts)
- GM tips and quick reference

This guide is the perfect starting point for new players and GMs.

---

## 🤝 Contributing

Contributions are welcome! Please ensure:

1. All code contributions are MIT‑licensed.
2. Content additions that are not SRD are clearly marked as proprietary.
3. Feature additions are well‑documented.

### Development Setup
```bash
# Clone the monorepo
git clone https://github.com/Chronophage-net/fates-edge-apps.git
cd fates-edge-apps/utilities/javascript/fates-edge-web-client

# Install dependencies (if any) and build
npm install
npm run build

# Start a local server
npm start
```

---

## 🙏 Credits

**Fate's Edge** was created by **Nicholas A. Gasper** (Chronophage).  
The web client is built with vanilla JavaScript and runs entirely in your browser – no sign‑up, no accounts, no hidden costs.

> *"The coin that never spends is the one you don't remember taking."*  
> — Serafine of the Velvet Touch
