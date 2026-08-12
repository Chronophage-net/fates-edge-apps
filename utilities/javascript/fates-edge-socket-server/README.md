# Fate's Edge Socket Server v4.8.1 — Real-Time VTT & Campaign Sharing

**Fate's Edge** is a narrative‑first TTRPG system. This is the real‑time backend for the web toolkit: a WebSocket/Socket.io server that syncs campaign state live across your group, plus a short‑code **campaign sharing** endpoint for loading/saving full toolkit state without a persistent connection.

> This server lives at `utilities/javascript/fates-edge-socket-server/` inside the main [fates-edge-apps](../../../README.md) monorepo. It is no longer distributed as a standalone repo.

---

## ✨ What this actually does

Earlier documentation for this server described it as a minimal REST endpoint for uploading/downloading a JSON blob. That's still one thing it does, but the real server (`server/`) is considerably more:

- **Real‑time sync** — chat, dice rolls, character updates, timers, and scene changes broadcast to every connected client, over both a Socket.io transport and a raw `ws` transport (`server/socketio-handlers.js`, `server/ws-handlers.js`).
- **Account authentication** — `server/auth.js` provides real user accounts: `POST /api/auth/register` and `POST /api/auth/login` hash passwords with bcrypt and issue JWT session tokens, layered alongside the existing per-request API-key authentication used for service-to-service calls.
- **GM election & rooms** — `server/room.js` handles requesting, approving, and transferring GM status per room/campaign code.
- **Roles & character registration (v4.8)** — beyond the single GM seat above, `server/room.js` now supports GM-granted Co-GM promotions (session-only or saved), a read-only Spectator role, and a claim/release bridge that binds a player's saved character (their account library) to a room's live roster. See `DESIGN.md`'s "Roles & Character Registration (v4.8)" section for the full model.
- **Shared Deck of Consequences** — `server/deck.js` draws cards from a region's deck and broadcasts the result to everyone in the room, using the same region data (`data/regions/`) as the web client.
- **Campaign persistence** — `server/storage.js` stores campaigns, rooms, accounts, and characters in a database: SQLite by default (`campaigns.db`, see [INSTALL.md](INSTALL.md#backing-up-your-campaigns-your-world-save) for backup notes), or Postgres/MySQL via `DATABASE_TYPE`/`DATABASE_URL`.
- **Security & config** — `server/security.js` and `server/config.js` handle basic request validation and environment-driven configuration.
- **A bundled test/reference dataset** — `data/patrons/the_traveler.json` and `data/regions/acasia.json` ship with the server so you can smoke-test deck draws and patron lookups without the full web client's data folder.
- **A Python CLI** (`fates-edge-cli.py`) for exercising the server from the command line without a browser.

---

## 🚀 Getting Started

**→ See [INSTALL.md](INSTALL.md) for the full setup guide** — Docker or
manual Node.js, opening your server to players, backups, updates, and
troubleshooting, written for anyone who's run a dedicated game server
before. The short version:

```bash
cd utilities/javascript/fates-edge-socket-server
cp .env.example .env   # your server config file — set a real API_KEY
docker compose up -d
```

The server listens on port **10000** by default (`PORT` in `.env`).

### Manual Setup (no Docker)

```bash
cd utilities/javascript/fates-edge-socket-server
npm install
cp env-example.md .env   # copy and edit with your settings
node server-start.js
```

### Docker (single container, no compose)

```bash
docker build -t fates-edge-socket-server .
docker run -d -p 10000:10000 --name campaign-server \
  -e API_KEY=your-secret-key-here \
  -v $(pwd)/data:/app/data \
  -e DATABASE_URL=/app/data/campaigns.db \
  fates-edge-socket-server
```

The `-v .../data` mount + `DATABASE_URL` pointing inside it is what makes
your campaign data (a SQLite database, not individual files — see
"Server Layout" below) survive a container restart; see
[INSTALL.md](INSTALL.md#backing-up-your-campaigns-your-world-save) for
details. **`docker compose up -d` (below) already sets this up for you**
— prefer it over the raw `docker run` above unless you have a reason not to.

### Docker Compose (recommended — server + optional TURN for voice chat)

```bash
cp .env.example .env   # fill in API_KEY, and TURN_SECRET/TURN_URLS if you want voice chat to work behind strict NATs/firewalls
docker compose up -d
```

This starts the server (with campaign persistence already configured
correctly) plus a [coturn](https://github.com/coturn/coturn) TURN relay
for the web client's voice chat feature (`js/features/vtt/voice.js`).
Voice chat works without any TURN configuration too — it just falls back
to STUN-only, which can't traverse symmetric NAT/restrictive firewalls.
See `env-example.md`, [INSTALL.md](INSTALL.md#voice-chat-optional), and
the comments in `docker-compose.yml` for the full TURN setup (including
optional TLS for firewalls that block everything but HTTPS-looking
traffic).

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
├── .env / env-example.md / .env.example
├── build.sh
├── campaigns.db                # SQLite database: campaigns, rooms, accounts, characters (default DATABASE_TYPE)
├── coturn/                     # optional TLS cert/key + README for the `turn` docker-compose profile
├── data/                       # bundled reference data for local testing
│   ├── patrons/the_traveler.json
│   └── regions/acasia.json
├── DESIGN.md
├── docker-compose.yml          # server + coturn (see "Docker Compose" above)
├── Dockerfile
├── fates-edge-cli.py           # Python CLI test client
├── generate-manifest.js        # CLI: derive manifest.json for a hand-placed modules/<id>/adventure.json
├── modules/                    # installable adventure modules (see MODULES.md)
│   └── example-module/
│       ├── adventure.json
│       └── manifest.json
├── package.json
├── requirements.txt            # for fates-edge-cli.py
├── server/
│   ├── adventure.js             # Adventure Engine state machine (acts/scenes/timers/encounters)
│   ├── api.js                   # REST endpoints — see "REST API" below
│   ├── auth.js                  # account registration/login (bcrypt + JWT)
│   ├── config.js                 # env/config.json loader
│   ├── deck.js                   # Deck of Consequences logic
│   ├── index.js                  # (legacy duplicate of server.js — server.js is the real entrypoint)
│   ├── logger.js
│   ├── module-manifest-utils.js  # shared manifest-deriving logic (API install path + generate-manifest.js)
│   ├── room.js                   # GM election / room state / broadcastToRoom
│   ├── security.js
│   ├── server.js                 # actual entrypoint (via server-start.js)
│   ├── socketio-handlers.js      # Socket.io transport
│   ├── storage.js
│   ├── turn.js                   # short-lived TURN credential minting (see TURN docs above)
│   └── ws-handlers.js            # plain-WebSocket transport (the web client's default)
├── server-start.js             # entry point (requires server/server.js)
└── utils/
    ├── config.js
    ├── logger.js
    └── websocket.js
```

See [MODULES.md](MODULES.md) for how to author, install, and push an adventure module.

---

## 📦 REST API

Every route below is served from `server/api.js`. `authenticate` means the request needs an `X-API-Key` header (or `?apiKey=`) matching the server's `API_KEY`; unmarked routes are open (same trust boundary as being able to connect to the room/server at all).

| Method | Endpoint                              | Auth | Description |
|--------|-----------------------------------------|:---:|-------------|
| GET    | `/healthz`, `/api/healthz` | – | Plain `OK` liveness check, always available regardless of config. |
| GET    | `<HEALTH_ENDPOINT>` (default `/api/health`) | – | Fuller health check + room stats as JSON. |
| GET    | `/api/turn-credentials?clientId=X`      | –   | Mint short-lived TURN credentials (404 if `TURN_SECRET` isn't configured). See the root docker-compose's `turn` profile. |
| GET    | `/api/rooms`                            | ✅  | List all rooms with stats. |
| POST   | `/api/auth/register`, `/api/auth/login` | –*  | Account auth (bcrypt + JWT). *Requires the optional DB storage module to be present. |
| GET    | `/api/rooms/:code/clients`              | ✅  | List clients in a room. |
| POST   | `/api/rooms/:code/clients/:clientId/kick` \| `/ban` \| `/unban` | ✅ | Moderation. |
| POST   | `/api/rooms/:code/password`             | ✅  | Set/change/clear a room password. |
| GET/POST | `/api/rooms/:code/deck*`, `/api/rooms/:code/deck/crown`, `.../history` | ✅ | Deck of Consequences draws/history (same logic the WS `deck-draw`/`crown-spread` events use). |
| GET    | `/api/modules`, `/api/rooms/:code/modules` | ✅ | List installed modules (`modules/<id>/manifest.json`) plus standalone `data/adventures/*.json`. |
| POST   | `/api/modules`                          | ✅  | Install a module: writes `modules/<id>/{manifest.json,adventure.json}`. See [MODULES.md](MODULES.md). |
| POST   | `/api/modules/:id/push`                 | ✅  | Broadcast an installed module to a room (or every room). |
| POST   | `/api/modules/:id/cleanup`              | ✅  | Broadcast a cleanup request for a module id. |
| GET/POST | `/api/rooms/:code/adventure*`         | ✅  | Adventure Engine: load/reset/scene/encounter/timer/log, backed by `server/adventure.js`. |
| GET/POST | `/api/rooms/:code/whiteboard*`, `/api/rooms/:code/characters*`, `/api/rooms/:code/campaigns*` | ✅ | Whiteboard state, character sync, campaign save/load (see "Using Campaign Sharing" above for the short-code flow). |
| GET    | `/api/data/docs`                        | –   | This same endpoint list, machine-readable. |

Real‑time events (chat, dice, GM election, deck draws, scene/timer sync, voice signaling, module push/cleanup) are handled separately over Socket.io/`ws` — see `server/socketio-handlers.js` and `server/ws-handlers.js` for the full event list, and [MODULES.md](MODULES.md) for the module-specific events.

---

## 🛠️ Configuration

Environment variables (see `env-example.md` for the full list, `.env.example` for the docker-compose-specific subset):

| Env Var   | Default | Description |
|-----------|---------|-------------|
| `PORT`    | `10000` | Port to listen on. |
| `API_KEY` | *(auto-generated + logged if unset)* | Admin API key for `authenticate`-gated routes above. |
| `DATABASE_TYPE` / `DATABASE_URL` | `sqlite` / `./campaigns.db` | Where campaigns, rooms, accounts, and characters are persisted. |
| `HEALTH_ENDPOINT` | `/api/health` | The fuller JSON health/stats route — `/healthz` and `/api/healthz` (plain `OK`) are always available regardless of this. |
| `TURN_SECRET`, `TURN_REALM`, `TURN_URLS`, `TURN_CREDENTIAL_TTL` | unset | TURN credential minting — see `/api/turn-credentials` above and this server's own `docker-compose.yml` `coturn` service. |

`campaigns.db` (or your configured `DATABASE_URL`) and `modules/` are created automatically at runtime as needed. For Docker, `docker-compose.yml` already mounts `./data` (with `DATABASE_URL` pointed inside it), plus named volumes for `/app/logs` and `/app/modules`, so all of this persists across container restarts out of the box — see [INSTALL.md](INSTALL.md#backing-up-your-campaigns-your-world-save).

---

## 🔒 License & Attribution

- **Fate's Edge** is © Nicholas A. Gasper.
- Source code in this server is MIT-licensed as part of the [fates-edge-apps](../../../README.md) monorepo.
- Bundled reference data (patron/region JSON) is proprietary Fate's Edge content, distributed for free for personal, non-commercial use. See the root README's License section for details.

---

**Enjoy your games!**
— Nick Gasper
