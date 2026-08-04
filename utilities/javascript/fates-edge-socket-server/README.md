# Fate's Edge Socket Server v4.3a — Real-Time VTT & Campaign Sharing

**Fate's Edge** is a narrative‑first TTRPG system. This is the real‑time backend for the web toolkit: a WebSocket/Socket.io server that syncs campaign state live across your group, plus a short‑code **campaign sharing** endpoint for loading/saving full toolkit state without a persistent connection.

> This server lives at `utilities/javascript/fates-edge-socket-server/` inside the main [fates-edge-apps](../../../README.md) monorepo. It is no longer distributed as a standalone repo.

---

## ✨ What this actually does

Earlier documentation for this server described it as a minimal REST endpoint for uploading/downloading a JSON blob. That's still one thing it does, but the real server (`server/`) is considerably more:

- **Real‑time sync** — chat, dice rolls, character updates, timers, and scene changes broadcast to every connected client, over both a Socket.io transport and a raw `ws` transport (`server/socketio-handlers.js`, `server/ws-handlers.js`).
- **Account authentication** — `server/auth.js` provides real user accounts: `POST /api/auth/register` and `POST /api/auth/login` hash passwords with bcrypt and issue JWT session tokens, layered alongside the existing per-request API-key authentication used for service-to-service calls.
- **GM election & rooms** — `server/room.js` handles requesting, approving, and transferring GM status per room/campaign code.
- **Shared Deck of Consequences** — `server/deck.js` draws cards from a region's deck and broadcasts the result to everyone in the room, using the same region data (`data/regions/`) as the web client.
- **Campaign persistence** — `server/storage.js` writes each campaign to its own JSON file under `server/campaigns/`, indexed in `campaigns.db`.
- **Security & config** — `server/security.js` and `server/config.js` handle basic request validation and environment-driven configuration.
- **A bundled test/reference dataset** — `data/patrons/the_traveler.json` and `data/regions/acasia.json` ship with the server so you can smoke-test deck draws and patron lookups without the full web client's data folder.
- **A Python CLI** (`fates-edge-cli.py`) for exercising the server from the command line without a browser.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 24.x+
- npm

### Manual Setup

```bash
cd utilities/javascript/fates-edge-socket-server
npm install
cp env-example.md .env   # copy and edit with your settings
node server-start.js
```

The server listens on port 3000 by default.

### Docker

```bash
docker build -t fates-edge-socket-server .
docker run -d -p 3000:3000 --name campaign-server \
  -v $(pwd)/server/campaigns:/app/server/campaigns \
  fates-edge-socket-server
```

Or use the bundled build script:

```bash
./build.sh
```

---

## 🔌 Using Campaign Sharing (short‑code upload/download)

1. In the web client, go to **Settings → Campaign Sharing**.
2. Enter your server's URL (e.g., `http://localhost:3000`).
3. Click **Upload Current State** — the server returns a short code (e.g., `A9K3LQ`), matching the file names you'll see land under `server/campaigns/` (e.g. `HMRU2I.json`, `K112VK.json`).
4. Share the code with your players. They enter the same server URL and code, then **Load State**.
5. Use **Delete Campaign** to remove a stored campaign from the server.

For live, always‑connected play (chat/dice/GM election/deck draws shared in real time rather than a manual upload/download), connect to the same server URL from the **VTT** tab instead — that's the Socket.io/`ws` path, not the upload endpoint.

---

## 📦 Server Layout

```
fates-edge-socket-server/
├── .dockerignore
├── .env / env-example.md
├── build.sh
├── campaigns.db                # index of stored campaign codes
├── data/                       # bundled reference data for local testing
│   ├── patrons/the_traveler.json
│   └── regions/acasia.json
├── DESIGN.md
├── Dockerfile
├── fates-edge-cli.py           # Python CLI test client
├── modules/
│   └── example-module/         # sample module manifest for the module-push feature
│       ├── index.js
│       └── manifest.json
├── package.json
├── requirements.txt            # for fates-edge-cli.py
├── server/
│   ├── api.js                  # REST endpoints (campaign upload/download/delete)
│   ├── campaigns/               # stored campaign JSON files (created at runtime)
│   ├── config.js
│   ├── deck.js                 # Deck of Consequences logic
│   ├── index.js
│   ├── logger.js
│   ├── room.js                 # GM election / room state
│   ├── security.js
│   ├── server.js
│   ├── socketio-handlers.js
│   ├── storage.js
│   └── ws-handlers.js
├── server-start.js             # entry point
└── utils/
    ├── config.js
    ├── logger.js
    └── websocket.js
```

---

## 📦 REST API

| Method | Endpoint               | Description |
|--------|-------------------------|-------------|
| POST   | `/campaigns`            | Upload a JSON payload. Returns `{ code: "ABC123" }`. |
| GET    | `/campaigns/:code`      | Retrieve the stored JSON for the given code. |
| DELETE | `/campaigns/:code`      | Delete the campaign with that code. |

All endpoints respond with `application/json` and support CORS. Real‑time events (chat, dice, GM election, deck draws, scene/timer sync) are handled separately over Socket.io/`ws` — see `server/socketio-handlers.js` and `server/ws-handlers.js` for the event list.

---

## 🛠️ Configuration

Environment variables (see `env-example.md` for the full list):

| Env Var   | Default | Description |
|-----------|---------|-------------|
| `PORT`    | `3000`  | Port to listen on. |

`server/campaigns/` is created automatically at runtime. For Docker, mount a volume over it to persist data across container restarts.

---

## 🔒 License & Attribution

- **Fate's Edge** is © Nicholas A. Gasper.
- Source code in this server is MIT-licensed as part of the [fates-edge-apps](../../../README.md) monorepo.
- Bundled reference data (patron/region JSON) is proprietary Fate's Edge content, distributed for free for personal, non-commercial use. See the root README's License section for details.

---

**Enjoy your games!**
— Nick Gasper
