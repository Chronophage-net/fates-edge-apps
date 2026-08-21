# Fate's Edge — JavaScript Toolkit

This directory holds the JavaScript half of the Fate's Edge ecosystem: the browser application, its real-time server, and two alternate clients built on the same server API.

- **[`fates-edge-web-client/`](fates-edge-web-client/)** — the main application: characters, dice, the VTT, timers, encounters, the Wiki and document library, Spellcraft, Kon'reh, Toll & Veil, and more.
- **[`fates-edge-socket-server/`](fates-edge-socket-server/)** — the self-hosted campaign server: WebSocket sync, REST API, and account authentication. A sibling directory here, not a separate repository.
- **[`fates-edge-desktop-client/`](fates-edge-desktop-client/)** — an Electron wrapper that bundles the web client as a native desktop app.
- **`fates-edge-terminal/`** — a MUD-style CLI client, mainly for testing and administration against a running server.

VTT integrations (Discord bot, Roll20 API script, Foundry VTT module, Avrae module) live one level up under [`../vtt_mods_bots/`](../vtt_mods_bots/). The Python CLI and Tkinter desktop tool live under [`../python/`](../python/). See the [repository root README](../../README.md) for the full ecosystem overview, quick start, and licensing — this file only covers what's specific to the JS subprojects.

---

## What each piece does

### The web client (`fates-edge-web-client/`)

Runs entirely in the browser, with all data in `localStorage` by default. Covers character management with a builder wizard and talent editor, Fate's Edge dice resolution, the VTT (chat, party status, quick roller, voice chat, timers), an encounter/combat tracker with a bestiary, a Wiki and searchable document library, the Deck of Consequences and Crown Spread, the full Spellcraft magic-system UI, Kon'reh and Toll & Veil, and a Travel Planner. Connect it to the campaign server below for shared, real-time play instead of solo/local-only use.

### The campaign server (`fates-edge-socket-server/`)

A Node/Express backend with two parallel WebSocket transports (Socket.IO and plain `ws`), account authentication (bcrypt + JWT alongside API-key auth), GM election with Co-GM/Assistant-GM/Spectator roles, the Adventure Engine, the shared Deck of Consequences, and optional horizontal scaling. Persists campaigns to SQLite by default (Postgres/MySQL also supported).

---

## Getting started

### Web client

```bash
cd fates-edge-web-client
npm install
npm run dev      # local dev server via Vite
# or
./build.sh       # produces dist/ for static hosting
```

You can also open `index.html` directly or serve `dist/` with any static web server. A password gate (set from **Settings**) can lock the whole site independently of any server account.

### Campaign server

Needed for real-time sync, the Adventure Engine, or account authentication:

```bash
cd fates-edge-socket-server
npm install
cp env-example.md .env   # edit with your settings
node server-start.js
```

```bash
# or, via Docker
cd fates-edge-socket-server
docker build -t fates-edge-server .
docker run -d -p 10000:10000 --name fates-server -v $(pwd)/data:/app/data fates-edge-server
```

See [`fates-edge-socket-server`'s own README](fates-edge-socket-server/README.md) and [`INSTALL.md`](fates-edge-socket-server/INSTALL.md) for the full setup guide, including Docker Compose with an optional TURN relay for voice chat.

### Desktop client

```bash
cd fates-edge-desktop-client
npm install
npm run build   # produces a platform-specific installer/package
```

### Terminal client

```bash
cd fates-edge-terminal
npm install
node terminal-client.js --room YOUR_ROOM
```

### VTT integrations & Python clients

See [`../vtt_mods_bots/`](../vtt_mods_bots/) (Discord bot, Roll20 API script, Foundry VTT module, Avrae module) and [`../python/`](../python/) (Python CLI client, Tkinter desktop tool). Each has its own README with setup instructions.

---

## Project structure

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
│   │   ├── module-loader.js
│   │   ├── core/               # state, sync, dice, websocket, media, gravatar, etc.
│   │   ├── components/         # Toast, CharacterCard, DocCard, TimerWidget, VoiceChat
│   │   └── features/           # one folder per routed tab
│   └── build.sh
├── fates-edge-socket-server/
│   ├── server/
│   │   ├── auth.js             # account registration/login, JWT, bcrypt
│   │   ├── adventure.js        # Adventure Engine state machine
│   │   ├── api.js              # REST API routes
│   │   ├── room.js             # room management / GM election
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

## Configuration reference

### Web client

| Setting | Description |
|---|---|
| Password | SHA-256 hashed, stored in `localStorage` |
| Base URL | For document link generation (auto-detected by default) |
| Theme | Dark, light, high-contrast, or auto |

### Server

| Env var | Default | Description |
|---|---|---|
| `PORT` | `10000` | Server port |
| `API_KEY` | auto-generated | API key for REST authentication (service-to-service) |
| `AUTH_JWT_SECRET` | auto-generated | Secret used to sign account session tokens |
| `MAX_DECK_HISTORY` | `100` | Max deck history entries |
| `LOG_LEVEL` | `INFO` | Logging level |
| `ADVENTURES_DIR` | `./data/adventures` | Adventure module directory |

See [`fates-edge-socket-server/env-example.md`](fates-edge-socket-server/env-example.md) for the full list.

---

## API reference

See [`fates-edge-socket-server/DESIGN.md`](fates-edge-socket-server/DESIGN.md) and the repository root [`API.md`](../../API.md) for the full, current REST and WebSocket event reference, including the Adventure Engine and authentication routes.

---

## License

Source code here is MIT-licensed as part of [fates-edge-apps](../../README.md). SRD and Essentials content is CC BY-NC-SA 4.0; everything else — setting lore, characters, proprietary magic systems, artwork — is All Rights Reserved. Full breakdown: [repository root README](../../README.md#license).

---

**Enjoy your games!**
— Nick Gasper
