# Fate's Edge Socket Server

The real-time backend for the Fate's Edge web toolkit: a WebSocket/Socket.IO server that syncs campaign state live across a group, plus a short-code **campaign sharing** endpoint for loading and saving a full toolkit snapshot without staying connected.

> This server lives at `utilities/javascript/fates-edge-socket-server/`, inside the [fates-edge-apps](../../../README.md) monorepo — a sibling directory to the web client, not a separate repository.

---

## What it does

- **Real-time sync** — chat, dice rolls, character updates, timers, and scene changes broadcast to every connected client, over both a Socket.IO transport and a raw `ws` transport (`server/socketio-handlers.js`, `server/ws-handlers.js`) so the client can use whichever is more reliable in a given deployment.
- **Account authentication** — `server/auth.js` provides real user accounts: `POST /api/auth/register` and `POST /api/auth/login` hash passwords with bcrypt and issue JWT session tokens, alongside the existing per-request API-key authentication used for service-to-service calls.
- **GM election & rooms** — `server/room.js` handles requesting, approving, and transferring GM status per room/campaign code, plus GM-granted Co-GM and Assistant-GM promotions, a server-enforced read-only Spectator role, and a claim/release bridge that binds a player's saved character to a room's live roster. Spectators can request public snapshots but cannot chat, roll, signal voice, alter presence/state, relay generic events, or use newly added events unless those events are deliberately classified as reads. See [`ROLES.md`](ROLES.md) for the full model, with diagrams.
- **The Adventure Engine** — `server/adventure.js` loads and runs structured adventures (acts, scenes, encounters, pre-authored scene/campaign timers, knowledge/reveal state, climax pacing), with matching REST and Socket.IO/WS events for every mutation.
- **Ad-hoc timers** — `server/timers.js` tracks improvised, GM/AI-created timers ("Guard Patrol", "Village Unrest") in their own `room.data.timers` bucket, deliberately independent of the Adventure Engine above — they exist and persist whether or not an adventure module is loaded. This is also the mechanism the **AI GM Bot** (`fates-edge-ai-gm-bot`, a separate app) uses to create/tick/read timers: the bot has no local timer state of its own, only this server does, so every client (web client, terminal, Roll20, Discord bot, Foundry bridge, the AI GM Bot) sees the same timers. See `server/timers.js`'s header comment and the REST API table below.
- **The shared Deck of Consequences** — `server/deck.js` draws cards from a region's deck and broadcasts the result to everyone in the room, using the same region data as the web client. Shuffles run on a per-room seedable PRNG (`server/rng.js`), so a room's shuffle sequence is reproducible from its seed via `GET`/`POST /api/rooms/:code/deck/seed`.
- **Module management** — installable adventure modules can be listed, pushed to connected clients, and cleaned up; see [`MODULES.md`](MODULES.md).
- **Soundboard sound search** — `server/api.js` proxies [Freesound](https://freesound.org)'s text-search API (`FREESOUND_API_KEY` env var, admin-key-gated, rate-limited) so the web client's GM Soundboard "Search Sounds" modal, and the equivalent lookup commands on the AI GM Bot, Discord bot, and terminal client, never need the Freesound key themselves. No server-side soundboard state — tracks stay client-side (web client `localStorage`).
- **Scaling, two independent axes** — off by default (single process, no external dependency). `CLUSTER_WORKERS` uses more of one machine's CPU cores via Node's `cluster` module; `REDIS_URL` runs multiple instances behind a load balancer via a pub/sub relay. The two combine. A proposed manager adds stable server IDs and room-level affinity without changing unmanaged deployments. See [`SCALING.md`](SCALING.md).
- **Rate limiting & per-room client caps** — a general per-IP limit across the REST API, a per-connection message-rate limit on both WebSocket transports, and an optional per-room client cap. All configurable, all generous/off by default. See [`DESIGN.md`](DESIGN.md) §5.
- **Campaign persistence** — `server/storage.js` stores campaigns, rooms, accounts, and characters in SQLite by default (`campaigns.db`; see [`INSTALL.md`](INSTALL.md#backing-up-your-campaigns-your-world-save) for backups), or Postgres/MySQL via `DATABASE_TYPE`/`DATABASE_URL`.
- **TURN credential minting** — `server/turn.js` mints short-lived coturn credentials for the web client's voice chat, so it can traverse symmetric NAT and restrictive firewalls rather than relying on STUN alone.
- **A bundled reference dataset** (`data/patrons/the_traveler.json`, `data/regions/acasia.json`) and a Python CLI (`fates-edge-cli.py`, v1.6.0) — room/client/module management, backups, and ad-hoc timers from the command line, plus enough to smoke-test deck draws and patron lookups without the full web client's data folder.

---

## Getting started

**→ See [`INSTALL.md`](INSTALL.md) for the full setup guide** — Docker or manual Node.js, opening your server to players, backups, updates, and troubleshooting. The short version:

```bash
cd utilities/javascript/fates-edge-socket-server
cp .env.example .env   # set a real API_KEY
docker compose up -d
```

The server listens on port **10000** by default (`PORT` in `.env`).

### Manual setup (no Docker)

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

The `-v .../data` mount plus `DATABASE_URL` pointing inside it is what makes your campaign data (a SQLite database, not individual files — see "Server layout" below) survive a container restart; see [`INSTALL.md`](INSTALL.md#backing-up-your-campaigns-your-world-save). `docker compose up -d` below already sets this up for you — prefer it unless you have a reason not to.

### Docker Compose (recommended — server + optional TURN for voice chat)

```bash
cp .env.example .env   # fill in API_KEY, and TURN_SECRET/TURN_URLS if you want voice chat behind strict NATs
docker compose up -d
```

Starts the server (with campaign persistence already configured) plus a [coturn](https://github.com/coturn/coturn) TURN relay for the web client's voice chat. Voice chat works without any TURN configuration too — it just falls back to STUN-only, which can't traverse symmetric NAT/restrictive firewalls. See `env-example.md`, [`INSTALL.md`](INSTALL.md#voice-chat-optional), and the comments in `docker-compose.yml` for the full TURN setup, including optional TLS.

---

## Using campaign sharing (short-code upload/download)

1. In the web client, go to **Settings → Campaign Sharing**.
2. Enter your server's URL (e.g. `http://localhost:10000`).
3. Click **Upload Current State** — the server returns a short code (e.g. `A9K3LQ`), matching a file under `server/campaigns/` (e.g. `A9K3LQ.json`).
4. Share the code with your players. They enter the same server URL and code, then **Load State**.
5. **Delete Campaign** removes a stored campaign from the server.

For live, always-connected play — chat, dice, GM election, and deck draws shared in real time rather than a manual upload/download — connect to the same server URL from the **VTT** tab instead. That's the Socket.IO/`ws` path, distinct from the upload endpoint above.

---

## Server layout

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
├── ROLES.md                    # role/permission model, with diagrams
├── SCALING.md                  # multi-core (cluster) and multi-instance (Redis) deployment
├── ROADMAP.md                  # planned, not-yet-built work (server-specific)
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
│   ├── cluster.js                # optional Node `cluster`-based multi-core scaling — see SCALING.md
│   ├── config.js                 # env/config.json loader
│   ├── deck.js                   # Deck of Consequences logic
│   ├── index.js                  # the server implementation (Express + Socket.IO + ws + scaling wiring)
│   ├── logger.js
│   ├── module-manifest-utils.js  # shared manifest-deriving logic (API install path + generate-manifest.js)
│   ├── room.js                   # GM election / room state / broadcastToRoom
│   ├── scaling.js                # optional Redis-backed horizontal scaling — see SCALING.md
│   ├── security.js               # input validation + rate limiters
│   ├── server.js                 # re-exports index.js (server-start.js's require target)
│   ├── socketio-handlers.js      # Socket.IO transport
│   ├── storage.js
│   ├── timers.js                 # Ad-hoc (GM/AI-improvised) timers -- deliberately separate from adventure.js
│   ├── turn.js                   # short-lived TURN credential minting
│   └── ws-handlers.js            # plain-WebSocket transport (the web client's default)
├── server-start.js             # entry point
└── utils/
    ├── config.js
    ├── logger.js
    └── websocket.js
```

See [`MODULES.md`](MODULES.md) for how to author, install, and push an adventure module.

---

## REST API

Every route below is served from `server/api.js`. `authenticate` means the request needs an `X-API-Key` header (or `?apiKey=`) matching the server's `API_KEY`; unmarked routes are open (the same trust boundary as being able to reach the room/server at all).

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| GET | `/healthz`, `/api/healthz` | – | Plain `OK` liveness check, always available regardless of config. |
| GET | `<HEALTH_ENDPOINT>` (default `/api/health`) | – | Fuller health check + room stats as JSON. |
| GET | `/api/turn-credentials?clientId=X` | – | Mint short-lived TURN credentials (404 if `TURN_SECRET` isn't configured). |
| GET | `/api/rooms` | ✅ | List all rooms with stats. |
| POST | `/api/auth/register`, `/api/auth/login` | –* | Account auth (bcrypt + JWT). *Requires the optional DB storage module to be present. |
| GET | `/api/rooms/:code/clients` | ✅ | List clients in a room. |
| POST | `/api/rooms/:code/clients/:clientId/kick` \| `/ban` \| `/unban` | ✅ | Moderation. |
| POST | `/api/rooms/:code/password` | ✅ | Set/change/clear a room password. |
| GET/POST | `/api/rooms/:code/deck*`, `/api/rooms/:code/deck/crown`, `.../history` | ✅ | Deck of Consequences draws/history (same logic the WS `deck-draw`/`crown-spread` events use). |
| GET/POST | `/api/rooms/:code/deck/seed` | ✅ | Read/set the room's per-room deck PRNG seed; `POST` reseeds and reshuffles, broadcasting `deck-shuffled` with `reason: "reseeded"`. |
| GET | `/api/modules`, `/api/rooms/:code/modules` | ✅ | List installed modules plus standalone `data/adventures/*.json`. |
| POST | `/api/modules` | ✅ | Install a module — see [`MODULES.md`](MODULES.md). |
| POST | `/api/modules/:id/push` | ✅ | Broadcast an installed module to a room (or every room). |
| POST | `/api/modules/:id/cleanup` | ✅ | Broadcast a cleanup request for a module id. |
| GET/POST | `/api/rooms/:code/adventure*` | ✅ | Adventure Engine: load/reset/scene/encounter/timer/log/climax state, backed by `server/adventure.js`. |
| GET/POST/DELETE | `/api/rooms/:code/timers*` | ✅ | Ad-hoc timers (create/list/tick/resolve/remove), backed by `server/timers.js` — deliberately separate from the Adventure Engine's own scene/campaign timers above. |
| GET | `/api/soundboard/search` | ✅ | Freesound text-search proxy (`?q=&page=&page_size=`); 503 if `FREESOUND_API_KEY` is unset. |
| GET | `/api/soundboard/download/:id` | ✅ | Re-resolve a Freesound sound id to its playable preview URL (not a real original-file download — see DESIGN.md). |
| GET/POST | `/api/rooms/:code/whiteboard*`, `/api/rooms/:code/characters*`, `/api/rooms/:code/campaigns*` | ✅ | Whiteboard state, character sync, campaign save/load (see "Using campaign sharing" above). |
| GET | `/api/data/docs` | – | This same endpoint list, machine-readable. |

Real-time events (chat, dice, GM election, deck draws, scene/timer sync, voice signaling, module push/cleanup) are handled separately over Socket.IO/`ws` — see `server/socketio-handlers.js` and `server/ws-handlers.js` for the full event list, and [`MODULES.md`](MODULES.md) for module-specific events. For the authoritative, current list of routes and events, grep those files directly rather than trusting a hand-copied table — see [`DESIGN.md`](DESIGN.md) for why that matters.

---

## Configuration

Environment variables (see `env-example.md` for the full list, `.env.example` for the Docker Compose subset):

| Env var | Default | Description |
|---|---|---|
| `PORT` | `10000` | Port to listen on. |
| `API_KEY` | auto-generated + logged if unset | Admin API key for `authenticate`-gated routes above. |
| `DATABASE_TYPE` / `DATABASE_URL` | `sqlite` / `./campaigns.db` | Where campaigns, rooms, accounts, and characters are persisted. |
| `HEALTH_ENDPOINT` | `/api/health` | The fuller JSON health/stats route — `/healthz` and `/api/healthz` are always available regardless. |
| `TURN_SECRET`, `TURN_REALM`, `TURN_URLS`, `TURN_CREDENTIAL_TTL` | unset | TURN credential minting — see `/api/turn-credentials` above and this server's `docker-compose.yml` `coturn` service. |
| `API_RATE_LIMIT_WINDOW_MS` / `API_RATE_LIMIT_MAX` | `60000` / `300` | General per-IP REST rate limit (`_MAX=0` disables). |
| `WS_MESSAGE_RATE_WINDOW_MS` / `WS_MESSAGE_RATE_MAX` | `10000` / `120` | Per-connection WebSocket message rate limit, both transports (`_MAX=0` disables). |
| `MAX_CLIENTS_PER_ROOM` | `0` (unlimited) | Reject new joins once a room already holds this many clients. |
| `CLUSTER_WORKERS` | `0` (single process) | Fork this many worker processes (or `auto` = one per CPU core) — see [`SCALING.md`](SCALING.md). |
| `REDIS_URL` | unset | Optional multi-instance scaling — see [`SCALING.md`](SCALING.md). |

`campaigns.db` (or your configured `DATABASE_URL`) and `modules/` are created automatically at runtime. For Docker, `docker-compose.yml` already mounts `./data` (with `DATABASE_URL` pointed inside it) plus named volumes for `/app/logs` and `/app/modules`, so all of this persists across container restarts out of the box.

---

## License & attribution

- *Fate's Edge* is © Nicholas A. Gasper.
- Source code in this server is MIT-licensed, as part of the [fates-edge-apps](../../../README.md) monorepo.
- Bundled reference data (patron/region JSON) is proprietary Fate's Edge content, distributed for free for personal, non-commercial use. See the root README's License section for details.

---

**Enjoy your games!**
— Nick Gasper
