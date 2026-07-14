# Fate's Edge Toolkit v3.0

> A modular, self-contained toolkit for running Fate's Edge TTRPG campaigns.

[![License: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](LICENSE.code)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/SRD-CC_BY--NC--SA_4.0-lightgrey.svg)](LICENSE.srd)
[![License: All Rights Reserved](https://img.shields.io/badge/Content-All_Rights_Reserved-red.svg)](LICENSE.proprietary)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-green.svg)](https://nodejs.org/)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Modules](#-modules)
- [Data Files](#-data-files)
- [License](#-license)
- [Contributing](#-contributing)
- [Credits](#-credits)

---

## 🎯 Overview

**Fate's Edge Toolkit** is a modular, browser-based companion application for running *Fate's Edge* tabletop roleplaying games. It provides tools for character management, dice rolling, encounter tracking, faction management, campaign planning, and more — all in a single, self-contained web application.

### What is Fate's Edge?

Fate's Edge is a narrative-first tabletop roleplaying system where every action carries weight, every choice has consequence, and even failure feeds the story. Characters navigate a world of ancient magic, fallen empires, and vibrant cultures — where power demands a price and the past never truly sleeps.

The toolkit is designed to support GMs and players with digital tools that enhance, not replace, the tabletop experience.

---

## ✨ Features

### Core Tools
- **🎲 Dice Roller** — Advanced dice rolling with Story Beat tracking and outcome resolution
- **👤 Character Manager** — Create, edit, and track characters with full attribute/skill systems
- **⏱️ Timer System** — Visual timers for tracking threats, progress, and campaign pressure
- **⚔️ Encounter Builder** — Design and run encounters with integrated combat tracker

### Campaign Management
- **🏛️ Faction Manager** — Track faction standings, agendas, and relationships
- **🌟 Patron System** — Manage cosmic and terrestrial patrons with rites and obligations
- **📋 Kanban Board** — Organize campaign tasks, threats, and opportunities
- **✏️ Whiteboard** — Collaborative note-taking and planning

### Advanced Features
- **🃏 Deck of Consequences** — Generate thematic complications from Story Beats
- **👑 Crown Spread** — Campaign planning and foreshadowing tool
- **🌐 Live Campaign Sync** — Real-time collaboration with WebSocket support
- **📚 Wiki** — Reference rules, patrons, regions, and more
- **📄 Document Viewer** — Browse and search SRD and expanded content

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 24.x or later
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, Safari)

### Installation

```bash
# Clone the repository
git clone https://github.com/nicholasagaspar/fates-edge-apps.git
cd fates-edge-apps

# Install dependencies
npm install

# Start the development server
npm run dev

# Or build for production
npm run build
```

### Using the Toolkit

1. Open your browser to `http://localhost:3000` (or the port shown in your terminal)
2. If password protected, enter the password (set in settings)
3. Start using the tools!

### Docker

```bash
# Build the Docker image
docker build -t fates-edge-toolkit .

# Run the container
docker run -p 3000:80 fates-edge-toolkit
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
│   ├── fates-edge-socket-server/ # WebSocket server
│   └── fates-edge-desktop-client/# Electron desktop client
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
    // ... etc
};
```

Each feature module exports:
- `render(el)` — Renders the feature into a container
- `onActivate()` — Called when the module becomes active
- `onDeactivate()` — Called when the module is hidden
- `refresh()` — Refreshes the module data
- `destroy()` — Cleans up resources

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
| **VTT** | Virtual tabletop with voice | `features/vtt/` |
| **Docs** | Document viewer | `features/docs/` |
| **Search** | Global search | `features/search/` |
| **Wiki** | Reference wiki | `features/wiki/` |
| **Decks** | Deck of Consequences & Crown Spread | `features/decks/` |
| **Patrons** | Cosmic & terrestrial patrons | `features/patrons/` |
| **Factions** | Faction management & assets | `features/factions/` |
| **Settings** | Application settings | `features/settings/` |

### Core Utilities

| Module | Description |
|--------|-------------|
| `core/state.js` | State management with localStorage persistence |
| `core/sync/` | Real-time sync via WebSocket |
| `core/dice.js` | Dice rolling engine |
| `core/websocket.js` | WebSocket connection management |
| `core/password.js` | Password protection |
| `core/gravatar.js` | Gravatar integration |

### Components

| Component | Description |
|-----------|-------------|
| `Toast.js` | Toast notification system |
| `CharacterCard.js` | Character display card |
| `TimerWidget.js` | Timer display widget |
| `VoiceChat.js` | Voice chat integration |

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
- **Built With**: Vanilla JavaScript, CSS, Node.js

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

### v3.0 (Current)
- Complete modular architecture
- WebSocket real-time sync
- Voice chat support
- Faction management system
- Patron system
- Deck of Consequences
- Crown Spread
- Campaign Kanban board
- Whiteboard
- Desktop client (Electron)

### v2.0
- Character management
- Dice roller with Story Beats
- Timer system
- Encounter builder
- Wiki system

### v1.0
- Initial release with core features
```

---

## License Files

You'll also want to create these separate license files in your repository:

### `LICENSE.code` (MIT)

```text
MIT License

Copyright (c) 2024 Nicholas A. Gasper

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### `LICENSE.srd` (CC BY-NC-SA 4.0)

```text
Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License

This work is licensed under the Creative Commons Attribution-NonCommercial-
ShareAlike 4.0 International License. To view a copy of this license, visit
http://creativecommons.org/licenses/by-nc-sa/4.0/ or send a letter to
Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.

You are free to:
- Share — copy and redistribute the material in any medium or format
- Adapt — remix, transform, and build upon the material

Under the following terms:
- Attribution — You must give appropriate credit, provide a link to the
  license, and indicate if changes were made.
- NonCommercial — You may not use the material for commercial purposes.
- ShareAlike — If you remix, transform, or build upon the material, you
  must distribute your contributions under the same license.
```

### `LICENSE.proprietary` (All Rights Reserved)

```text
PROPRIETARY CONTENT — ALL RIGHTS RESERVED

The following content is © Nicholas A. Gasper, All Rights Reserved:

- Setting lore (Acasia, Aeler, Vhasia, the Curse, etc.)
- Original characters, NPCs, and named figures
- Faction descriptions and campaign-specific content
- Proprietary magic systems (Runekeeper, Invoker, Cantor, Summoner, etc.)
- Artwork, maps, and graphical elements
- Original prose, framing devices, and narrative text
- The Deck of Consequences and Crown Spread systems
- The Travel Framework and regional generators

This content is distributed for free as part of the Fate's Edge Toolkit,
but is not licensed for redistribution or commercial use without explicit
permission from the copyright holder.

For permission requests, contact: support@fates-edge.com