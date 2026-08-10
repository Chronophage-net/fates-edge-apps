[![Build Apps and Packages](https://github.com/Chronophage-net/fates-edge-apps/actions/workflows/build-apps-and-packages.yml/badge.svg)](https://github.com/Chronophage-net/fates-edge-apps/actions/workflows/build-apps-and-packages.yml)

# Fate's Edge Toolkit v4.6.3 – Complete VTT Ecosystem

> A modular, self-contained toolkit for running Fate's Edge TTRPG campaigns, with real‑time collaboration, VTT integrations, Game Master management, and a full in-browser magic/monastic-path system.

[![License: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](LICENSE.code)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/SRD-CC_BY--NC--SA_4.0-lightgrey.svg)](LICENSE.srd)
[![License: All Rights Reserved](https://img.shields.io/badge/Content-All_Rights_Reserved-red.svg)](LICENSE.proprietary)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-green.svg)](https://nodejs.org/)
[![Foundry VTT](https://img.shields.io/badge/Foundry-VTT-orange)](https://foundryvtt.com/)
[![Discord](https://img.shields.io/badge/Discord-Bot-5865F2)](https://discord.com/)
[![Version](https://img.shields.io/badge/version-4.6.3-blue)](https://github.com/nicholasagaspar/fates-edge-apps)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [What's New in v4.6.0](#-whats-new-in-v460)
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

## 🆕 What's New in v4.6.0

- **🎯 Diverse Encounter Objective Types** — Encounters used to frame *every* clock in Harm/Heal combat terms even when the encounter wasn't a fight. A new shared `js/core/objective-types.js` registry (mirrored in the socket server and AI GM bot) adds Obstruction, Skill Challenge, Trap/Ward, Lockpick, Heist, Social/Negotiation, and a freeform Custom type (your own Timer/Tick labels) alongside Combat — each with its own icon, progress/relief vocabulary, and log text. Real combat's Harm/Fatigue/armor math is untouched and strictly gated to actual fights. Wired through the Encounters editor, the combat tracker, Adventure Manager scenes, and the VTT's mini tracker; the socket server's adventure API now carries an optional `type` field end to end, defaulting to `combat` for full backward compatibility.
- **🔧 Character Editor/Wizard Symbol Fix** — Removed a redundant "auto-symbol" feature that force-added whatever patron sat in the generic Patron dropdown as an Invoker Symbol, conflicting with the existing purpose-built Add Symbol flow and risking silently corrupting `char.symbols` on save.
- **🔄 Patrons/Cantor No Longer Need a Manual Refresh** — Root-caused to `discoverPatrons()`'s 1-hour localStorage cache never being bypassed by a forced reload; added a real `force` parameter threaded from `loadPatronData()` all the way down, plus a retry-once safeguard in the Cantor panel.
- **♟️ Phase-Aware Kon'reh AI** — The built-in strategy game's AI now recognizes opening/midgame/endgame phases, races Sanctum Seed tempo instead of camping, refuses to let Blue idle safely on a Sanctum, and searches deeper (with an explanatory coach hint) once a Reforge race is on.
- **🧪 100/100 web-client tests, 59/59 socket-server tests, 146/146 ai-gm-bot tests passing** after all of the above.

## 🆕 What's New in v4.5.1

- **⚡ "Jump to the Action" — one‑click into a one‑shot** — The welcome overlay's Quick Start button is now **Jump to the Action**: it hands you a ready‑made pre‑gen character, loads and starts the bundled starter adventure (*The Lantern at Dusk*), and shows a short confirmation pane naming your character with a link to the Essentials quickstart doc, before dropping you into the Adventure Manager. Building this surfaced a real bug: `data/pre-gens.json` — the file the old Quick Start button fetched — never actually existed anywhere in the repo, so pre‑gen loading had always silently failed. Three new pre‑gens themed to the starter adventure were added, and a double‑fire bug in the button's click handling was fixed along the way.
- **🧪 72/72 web-client tests passing** after the above (11 new).

## 🆕 What's New in v4.5.0

- **🎙️ Voice Chat & TURN NAT Traversal, Actually Working** — Audited and fixed voice signaling end-to-end: both the plain-WebSocket and Socket.io transports now correctly route offer/answer/ICE-candidate/status messages (they were silently dropped over Socket.io before), and voice-status broadcasts now carry the `clientId` peers need to identify the sender. Added a `server/turn.js` short-lived TURN credential minting endpoint (`GET /api/turn-credentials`), a `coturn` service in `docker-compose.yml` (the `turn` profile), and client-side wiring (`js/core/turn.js`) so voice chat works behind symmetric NAT/restrictive firewalls, not just STUN-friendly networks.
- **🐳 One `docker-compose up` for the Whole Ecosystem** — A root `docker-compose.yml` now brings up the web client, socket server, and (via `bots` profile) the AI GM bot and Discord bot together, with TURN as an opt-in `turn` profile. See [Quick Start](#-quick-start).
- **📜 Community Use Policy & Split License Files** — [COMMUNITY_USE_POLICY.md](COMMUNITY_USE_POLICY.md) is a plain-language FAQ over what you can and can't do with the code/SRD/proprietary-content split. The `LICENSE.code`/`LICENSE.srd`/`LICENSE.proprietary` files the badges above link to now actually exist (they were broken links before).
- **🩺 System Status Page** — Sidebar → System → 🩺 Status (`js/features/system-status/`) shows real-time server connection, voice chat + TURN availability, active recording, sync/offline-queue state, who else is in the room, and browser feature support, auto-refreshing every 5s. Building this surfaced and fixed a real bug: `getConnectedClients()` only worked over Socket.io — the plain-WS transport (the client's default) had no `get-clients` handler and always timed out to an empty list.
- **📦 Module System Fixed (it never actually worked)** — The installable-adventure "module" system (`POST/GET /api/modules`, push/cleanup, and the matching WS events) resolved its storage directory as `server/modules/` in five places across `api.js` and `socketio-handlers.js`, when the real directory has always been `<repo-root>/modules/` — meaning every module install/list/push/cleanup call failed in every deployment. Also fixed: the plain-WS transport had zero handling for module events at all (Socket.io-only, same bug pattern as `get-clients` above); the `generate-manifest.js` CLI crashed on every run from a bad require path; the shipped example module's files were misnamed and invisible to every loader; and pushing a module never actually installed it into the pushing GM's own client (broadcasts don't echo to the sender). See [MODULES.md](utilities/javascript/fates-edge-socket-server/MODULES.md) for how to author and distribute one.
- **📚 Data Schema Documentation** — [DATA_SCHEMA.md](utilities/javascript/fates-edge-web-client/DATA_SCHEMA.md) documents the on-disk shape of factions/patrons/regions/religions/talents/bestiary and exactly how manifest-based discovery works, including a fix so newly-added factions are discovered via `manifest.json` the same way regions already were (previously, "add a JSON file" alone did nothing for factions — you had to also edit a hardcoded slug array in source).
- **🧪 57/57 socket-server tests, 61/61 web-client tests passing** after all of the above.

## 🆕 What's New in v4.4.1

- **🧪 Real Test Coverage Across the Ecosystem** – `fates-edge-ai-gm-bot` (120 tests: drivers, tag parsing, world data), the socket server (34 tests: auth, deck region-slug resolution, adventure state machine), and the web client (49 tests, including a fixed/repaired test harness with real DOM-event and IndexedDB shims) all now have real, passing test suites where most had none before. See each repo's `TEST_TODO.md` for the full backlog and what's still open.
- **🐛 Fixed a Real Tag-Parsing Bug** – `modules/commands.js`'s `[APPLY ...]`/`[ROLL ...]`/etc. tag handlers used a stateful global regex while mutating the string it was scanning; with more than one tag of the same type in a single AI response, later tags could silently fail to resolve. Fixed across every tag handler in that file.
- **🔨 Magic Item Decay & Forage Limits** – Attuned magic items now actually decay (Maintained → Neglected → Compromised) per the Player's Guide's Attunement & Upkeep rules, driven by a `downtime-tick` event fired from the Factions tab's "GM Downtime (Faction Turn)" button. Crafting's Forage action is now capped per downtime (a web-client pacing choice, not a rulebook number — see `state.js`).
- **🎨 Crafting Modularized, No More Inline CSS** – `js/features/crafting/` split into `data.js`/`state.js`/`render.js`/`index.js`; every inline `style="..."` and injected `<style>` block replaced with real classes in `css/app.css`, which also picked up two previously-undefined-but-widely-used button classes (`.btn-secondary`, `.btn-xs`).
- **🖥️ Terminal Client Account Commands** – `/mychar list|save|delete` now exposes the account-character endpoints the terminal client's auth system already supported but never surfaced.
- **🔢 Real Semantic Versioning** – Replaced the inconsistent `4.3a`-style version scheme with strict `MAJOR.MINOR.PATCH` across every repo, plus `tools/bump-version.mjs` to automate future bumps (version sync across every `package.json`, CHANGELOG generation, git tag) — see `VERSIONING.md`.

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
- **Python CLI** — Full‑featured command‑line client, rebuilt as a structured package (v5.0.0)

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

### Docker (the whole ecosystem, one command)

The repo root has a single `docker-compose.yml` that brings up the web client and the real-time server together, with the AI GM bot, Discord bot, and a TURN relay (for voice chat NAT traversal) available as opt-in profiles:

```bash
cp .env.example .env       # every value is optional for the default path
docker-compose up          # client (localhost:8080) + server (localhost:10000)

# opt in to more as needed:
docker-compose --profile turn up         # + coturn TURN relay for voice chat
docker-compose --profile bots up         # + AI GM bot + Discord bot
docker-compose --profile discord-bot up  # + just the Discord bot
```

The AI GM bot lives in the separate [`fates-edge-ai-gm-bot`](https://github.com/Chronophage-net/fates-edge-ai-gm-bot) repo — clone it as a sibling directory to `fates-edge-apps` if you want the `ai-gm-bot`/`bots` profiles; every other profile works without it. See the comments at the top of `docker-compose.yml` and `.env.example` for the full option list.

Each individual app also still has its own standalone `Dockerfile`/`docker-compose.yml`/`build.sh` (`utilities/javascript/fates-edge-web-client/`, `utilities/javascript/fates-edge-socket-server/`) if you only want to run one piece in isolation.

---

## 🏗️ Architecture

```
fates-edge-apps/
├── ADVISORY.md
├── API.md
├── docker-compose.yml             # whole-ecosystem compose: client + server + optional coturn/bots (see Quick Start)
├── .env.example
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
│   │   ├── fates_edge_tool/           # Tkinter desktop GUI (character sheet + GM screen), optional server sync
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

**Shipped since the last update:** Voice chat (WebRTC, `js/features/vtt/voice.js` + `js/components/VoiceChat.js`) and session recording/logging (screen + mic capture with an auto-generated SRT subtitle manifest for video editors, `js/core/media.js`, surfaced in GM Tools) are both implemented and wired end-to-end, including short-lived TURN credentials (see `docker-compose.yml`'s `turn` profile) so voice chat traverses symmetric NAT / restrictive firewalls, not just STUN-friendly networks. A single root `docker-compose.yml` now also brings up the whole ecosystem (client + server + optional bots) in one command — see [Quick Start](#-quick-start). Licensing is also now spelled out in plain language per-category (code/SRD/proprietary) in [COMMUNITY_USE_POLICY.md](COMMUNITY_USE_POLICY.md), and the `LICENSE.code`/`LICENSE.srd`/`LICENSE.proprietary` files the badges above link to actually exist now. A **System Status** page (sidebar → System → 🩺 Status, `js/features/system-status/`) now shows real-time server connection, voice chat + TURN availability, active recording, sync/offline-queue state, who's in the room, and browser feature support, all auto-refreshing. The installable-adventure **module system** (`/api/modules`, push/cleanup) has been fixed end-to-end (it was pointed at a directory that never existed) and is documented in [MODULES.md](utilities/javascript/fates-edge-socket-server/MODULES.md); the custom-content **data schema** is documented in [DATA_SCHEMA.md](utilities/javascript/fates-edge-web-client/DATA_SCHEMA.md).

Features that have been discussed or partially scaffolded but are **not yet implemented** in this build:

- **Session Playback / Export** — replaying or exporting a recorded/logged session as HTML/Markdown/plain text (beyond the SRT manifest voice/logging already produces).
- **VTT/bot audit for new server APIs** — the Discord bot, AI GM bot, Foundry bridge, Roll20 integration, terminal client, and Python clients haven't yet been individually reviewed for whether they should adopt the new TURN-credentials endpoint or the fixed module-push API.

If you were looking for the voice-chat/logging line from an earlier README revision: it was documented ahead of implementation at the time and pulled back to this roadmap section — it has since actually shipped, per the note above.

---

## 🔐 License

**New here?** [COMMUNITY_USE_POLICY.md](COMMUNITY_USE_POLICY.md) is a plain-language FAQ over the license files below — start there if you're wondering "can I do X with this repo."

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

### v4.5.1 (Current)
- **Added** "Jump to the Action" one-click flow in the welcome overlay: pre-gen character + starter adventure + a link to the Essentials doc
- **Added** `data/pre-gens.json` with three pre-gen characters themed to *The Lantern at Dusk*
- **Fixed** The old Quick Start button's pre-gen loading step had silently failed forever — `data/pre-gens.json` never existed
- **Fixed** A double-fire bug where the quick-start click could run twice (delegated container handler + the overlay's own direct listener)

### v4.5.0
- **Added** TURN credential minting (`server/turn.js`, `GET /api/turn-credentials`) and a `coturn` docker-compose service, so voice chat traverses symmetric NAT/restrictive firewalls
- **Added** Unified root `docker-compose.yml` bringing up client + server + optional bots in one command
- **Added** `COMMUNITY_USE_POLICY.md` plus split `LICENSE.code`/`LICENSE.srd`/`LICENSE.proprietary` files
- **Added** System Status page (`js/features/system-status/`)
- **Added** [MODULES.md](utilities/javascript/fates-edge-socket-server/MODULES.md) and [DATA_SCHEMA.md](utilities/javascript/fates-edge-web-client/DATA_SCHEMA.md)
- **Fixed** Voice signaling was silently dropped over Socket.io, and voice-status broadcasts were missing the `clientId` peers need to identify the sender
- **Fixed** `getConnectedClients()`/`get-clients` only worked over Socket.io; the plain-WS default transport always timed out to an empty list
- **Fixed** The module system's storage path resolved to a directory (`server/modules/`) that has never existed, in 5 places across 2 files — every module install/list/push/cleanup call failed in every deployment. Also fixed: missing plain-WS handlers for module events, a broken `generate-manifest.js` require path, a misnamed shipped example module, and pushed modules never installing into the pushing GM's own client.
- **Fixed** Factions were only discoverable via a hardcoded slug array; now tries `data/factions/manifest.json` first, consistent with regions (which had the same bug, also fixed this cycle)

### v4.4.1
- **Added** Full test suites across the ecosystem (ai-gm-bot, socket server, web client — see "What's New" above)
- **Added** Magic item decay/upkeep tracking (Maintained → Neglected → Compromised) tied to a new `downtime-tick` event, and a per-downtime Forage limit in Crafting
- **Added** `/mychar` account-character commands in the terminal client
- **Added** `tools/bump-version.mjs` — automated semver bump + CHANGELOG + git tag across every repo, see `VERSIONING.md`
- **Fixed** A tag-parsing regex-desync bug in the AI GM bot's `modules/commands.js` affecting multiple same-type `[TAG ...]`s in one response
- **Changed** Version scheme moved from `4.3a`-style to strict semver (`MAJOR.MINOR.PATCH`)
- **Changed** Crafting feature split into `data.js`/`state.js`/`render.js`/`index.js`; all inline CSS moved into `css/app.css`

### v4.3a
- **Added** Account authentication on the campaign server — register/login with bcrypt-hashed passwords and JWT sessions, alongside the existing API-key and playtester-password gates
- **Redone** Python CLI client, now a structured package (`cli/`, `rest_client.py`, `ws_client.py`, `shell.py`) at v5.0.0
- **Updated** Foundry VTT bridge and Roll20 API mod integrations
- **Changed** All feature pop-up modals replaced app-wide with inline "editor screen" views (real in-place navigation with a `← Back` button instead of floating dialogs)
- **Rebuilt** Theona, Linn, Vilikari, Black Banners, and The Ways Between region data from authored source material into the standard rich schema
- **Fixed** Flattened/dimmed region description rendering in the Decks region browser and Crown Spread
- **Removed** The standalone AI GM Bot — no longer part of the toolkit or its integrations

### v4.1.2b
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
  <sub>Made with ❤️ by Nick Gasper</sub>
</p>
