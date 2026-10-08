# Installing the Fate's Edge Socket Server

**Home/NAS users:** start with the [Home Docker guide](../../../DOCKER_HOME.md)
for the website and game server together. Commands on this page use the server-only
Compose file in this directory; its database storage path differs from the root stack.

Think of this the same way you'd think about a Valheim, ARK, or Minecraft
dedicated server: it's the always-on process that holds the "world" (your
campaign — chat, dice rolls, character sheets, the Deck of Consequences,
GM status) and keeps everyone's client in sync with it. Players don't talk
to each other directly; they all connect to this server, the same way
they'd point a game client at your server's IP and port.

This guide assumes you're comfortable in a terminal but would rather not
live in one. Everything after the initial setup is either a single command
or editing one plain-text config file.

---

## Before You Start

A checklist, not a lecture:

- [ ] **A machine that can stay reachable while you play.** A laptop on
      your home network is fine for a game with your own group. A cheap
      VPS (DigitalOcean, Hetzner, etc.) if you want it up 24/7 or want
      people outside your house to connect without your computer needing
      to stay on.
- [ ] **Docker** — [Docker Desktop](https://www.docker.com/products/docker-desktop/)
      on Windows/Mac, or Docker Engine on Linux. This is the recommended
      path: no Node.js, no dependency management, one command to start,
      one to update. Skip to [The Manual Way](#the-manual-way-nodejs-no-docker)
      only if you have a specific reason not to use Docker.
- [ ] **A text editor.** Notepad, TextEdit, VS Code, nano — anything.
      You'll edit exactly one file (`.env`), and it's plain `KEY=value`
      lines, same idea as a game server's `server.cfg`.
- [ ] **Your machine's IP address**, if you're hosting for people outside
      your own network — same thing you'd need to give out to let a
      friend join your Minecraft server.

---

## The Fast Way: Docker (recommended)

**1. Get the files.**

If you have `git`:
```bash
git clone https://github.com/Chronophage-net/fates-edge-apps.git
cd fates-edge-apps/utilities/javascript/fates-edge-socket-server
```
No `git`? Download the repo as a ZIP from GitHub, extract it, and open a
terminal in the `fates-edge-socket-server` folder inside it.

**2. Set up your server config file.**

```bash
cp .env.example .env
```
Open `.env` in your text editor. At minimum, set a real `API_KEY` — this
is your admin password (kick/ban players, install adventure modules,
read/write campaign data via the REST API). Leave everything else at its
default for now; see the [Configuration Reference](#configuration-reference)
below if you want to change the port, enable voice chat, etc.

**3. Start it.**

```bash
docker compose up -d
```
That's it — `-d` runs it in the background, so you can close the terminal
and it keeps running. Docker builds the image the first time (takes a
minute or two); every start after that is instant.

**4. Confirm it's alive.**

Open `http://localhost:10000/healthz` in a browser (or `curl` it) — you
should see `OK`. If you changed `PORT` in `.env`, use that port instead.

```bash
docker compose logs -f server
```
Ctrl+C to stop watching the logs (this does **not** stop the server —
it's still running in the background). If you didn't set `API_KEY` in
step 2, look for a boxed warning in these logs with a randomly generated
one — copy it into `.env` as `API_KEY=...` and run `docker compose up -d`
again, so it doesn't change every time the container restarts.

**5. Point your Web Client (and/or AI GM Bot) at it.**

Players connect using your machine's IP/hostname and the port from step
2 — see [Opening Your Server to Players](#opening-your-server-to-players)
below for LAN vs. internet hosting.

---

## The Manual Way: Node.js (no Docker)

For admins who'd rather not install Docker at all.

**1. Install [Node.js](https://nodejs.org/) 24 or newer.** The installer
   sets up `node` and `npm` for you — no extra terminal config needed.

**2. Get the files** (same as step 1 above).

**3. Install dependencies and configure:**
```bash
npm install
cp env-example.md .env
```
Edit `.env` the same way as the Docker path above — set a real `API_KEY`
at minimum.

**4. Start it:**
```bash
npm start
```
This runs in the foreground — closing the terminal window stops the
server. That's fine for testing; see below for keeping it running
long-term.

### Keeping it running after you close the terminal

This is the same problem as running any dedicated server without a
process manager — closing your terminal (or SSH session) kills it. The
simplest fix, on any OS, is [pm2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start server-start.js --name fates-edge-server
pm2 save
pm2 startup     # prints one command to run so it also survives a reboot — run what it prints
```

From then on: `pm2 logs fates-edge-server` to check on it, `pm2 restart
fates-edge-server` to restart it, `pm2 stop fates-edge-server` to stop it.
(If you went the Docker route above, you don't need any of this —
`restart: unless-stopped` in `docker-compose.yml` already handles it.)

---

## Configuration Reference

Your server config file (`.env`) is a list of `KEY=value` lines. The full
list lives in `env-example.md`; here's the short version of what actually
matters day-to-day:

| Setting | Default | What it means |
|---|---|---|
| `PORT` | `10000` | The port players connect to. Change it if `10000` is already used by something else on your machine. |
| `API_KEY` | *(random, changes every restart if unset)* | Your admin password — required to kick/ban, install modules, or hit the REST API. **Set this explicitly.** |
| `CORS_ORIGIN` | `*` | Which websites are allowed to connect from a browser. Leave as `*` unless you're hosting the Web Client somewhere specific and want to lock it down. |
| `LOG_LEVEL` | `INFO` | How chatty the server's logs are. |
| `DATABASE_TYPE` / `DATABASE_URL` | SQLite, `./campaigns.db` | Where campaign data (rooms, characters, saved campaigns, accounts) lives. The default SQLite file is fine for a self-hosted table — see [Backing Up](#backing-up-your-campaigns-your-world-save). Point `DATABASE_URL` at a Postgres/MySQL connection string instead if you already run one. |
| `TURN_SECRET`, `TURN_URLS`, `TURN_REALM` | unset | Only needed to fix voice chat for players behind strict/symmetric NAT (most home routers don't need this at all). See [Voice Chat](#voice-chat-optional) below. |

---

## Opening Your Server to Players

**Everyone's on the same WiFi/LAN (e.g. playing in person, same house):**
Nothing to configure. Players enter `http://<your-computer's-LAN-IP>:10000`
in the Web Client's connection settings — find your LAN IP with
`ipconfig` (Windows) or `ifconfig`/`ip addr` (Mac/Linux), the same way
you'd find it to host any LAN game.

**Players connect over the internet:**
Do not expose plain HTTP/WebSocket traffic or your NAS administration interface.
Use a private VPN for trusted players or an HTTPS reverse proxy with a valid certificate,
WebSocket support, and deliberate firewall/access rules. Give browsers an HTTPS website
and a secure `wss://` server address. A VPN does not remove the browser's HTTPS requirement
for microphone or screen capture. See the [Home Docker guide](../../../DOCKER_HOME.md)
for the public URL settings and a two-hostname example.

**Hosting on a VPS instead of your own machine?** Same steps, just run
them on the VPS — most cloud providers' firewalls need the port opened
there too, in addition to (or instead of) a router.

---

## Voice Chat (optional)

Voice chat first requires HTTPS when the website is opened on a NAS by IP or hostname.
HTTP localhost is a special case only when the browser runs on the server itself.
Once browser permissions work, STUN can establish direct connections on some networks;
others need a TURN relay. Do not promise that every home router works without one.

For this **server-only Compose file**, copy `.env.example` to `.env` only if you do
not already have one. Set a long random `TURN_SECRET`, your actual `TURN_URLS`, and
appropriate `TURN_PUBLIC_IP`, then explicitly enable the optional service:

```sh
docker compose --profile turn up -d
```

Review [coturn/README.md](coturn/README.md) before exposing a relay. Its host-networking
requirements depend on the Docker platform. For an internet-accessible relay, firewall
and router rules must permit UDP/TCP 3478 and UDP 49160–49200; TLS on 5349 additionally
needs certificates and matching configuration. Do not open these ports unnecessarily.

Skip this whole section if STUN-only voice chat already works for your
group — most home setups don't need it.

---

## Keeping Tabs on Your Server

- **Is it up?** `http://<your-server>:10000/healthz` → `OK`.
- **Fuller status** (room count, uptime, etc.): the endpoint set by
  `HEALTH_ENDPOINT` in your `.env` (default `/api/health`) — requires your
  `API_KEY`.
- **Logs:** `docker compose logs -f server` (Docker) or `pm2 logs
  fates-edge-server` (manual/pm2).
- **Who's connected / room list:**
  ```bash
  curl -H "X-API-Key: <your API_KEY>" http://<your-server>:10000/api/rooms
  ```
- A Python CLI (`fates-edge-cli.py`) also ships in this folder for
  scripting against the server from a terminal — it's a convenience
  wrapper, not required for anything above.

---

## Updating to a New Version

**Docker:**
```bash
git pull
docker compose up -d --build
```

**Manual/Node:**
```bash
git pull
npm install
# then restart however you started it: `npm start`, or `pm2 restart fates-edge-server`
```

Your campaign data lives outside the code (see below), so updating never
touches it.

---

## Backing Up Your Campaigns (Your "World Save")

Everything that matters — rooms, characters, saved campaigns, accounts —
lives in one place: the SQLite database at `data/campaigns.db` (Docker)
or `./campaigns.db` in this folder (manual/Node). Back up the whole
`data/` folder (Docker) or just `campaigns.db` (manual) the same way
you'd back up a game server's save folder — copy it somewhere else
periodically, and before every update. Stop the server while copying SQLite files;
copy the entire folder, including any `-wal`/`-shm` sidecars and `room-directory.json`,
not just the database file while it is live. Back up `.env` privately too.

This is the **standalone server** path. The root stack instead stores its database
and room directory in the `server-persistence` named volume; backing up only `data/`
there would miss them. See the Home Docker guide for backup and restore commands.

If you've installed any adventure modules (`modules/<id>/`), back those
up too — they're not stored in the database.

> **If you're on an older copy of `docker-compose.yml`:** earlier
> versions of this file didn't persist `campaigns.db` at all — every
> `docker compose down` silently wiped every saved campaign. Re-copy the
> current `docker-compose.yml` (it sets `DATABASE_URL=/app/data/campaigns.db`,
> landing the database inside the already-persisted `./data` folder) if
> yours predates this fix.

---

## Troubleshooting

**`docker compose up` finishes but I can't connect.**
Check `docker compose logs server` — most often either the port is
already used by something else on your machine (change `PORT` in `.env`),
or the NAS firewall blocks access. On the same LAN, use the NAS IP, not localhost;
router port forwarding is not needed.

**I don't know my API key.**
`docker compose logs server | grep -A2 "No API_KEY"` — it's printed once
at every startup if you haven't set one. Set it explicitly in `.env` so
it stops changing on every restart.

**My campaign disappeared after I updated/restarted.**
See the callout in [Backing Up](#backing-up-your-campaigns-your-world-save)
above — you're very likely on an older `docker-compose.yml` that wasn't
persisting the database. Update it, then anything saved going forward
will survive restarts (data lost before the fix, unfortunately, can't be
recovered unless you had a manual backup).

**Voice chat doesn't work for one specific player.**
First check HTTPS and microphone permission, then investigate NAT/TURN — see
[Voice Chat](#voice-chat-optional) above.

**A player can't reach the server but everyone else can.**
Usually a firewall on their end, not yours — have them try a different
network (e.g. phone hotspot) to confirm before you go digging further on
the server side.

---

## Uninstalling

**Docker:** `docker compose down` (add `-v` to also remove the named
log/module volumes; your `./data` folder — including `campaigns.db` — is
a plain host folder, delete it yourself if you want it gone too).

**Manual:** stop the process (`pm2 delete fates-edge-server` if you used
pm2), then just delete the folder.

---

For the full REST API reference, module system, and architecture details,
see [README.md](README.md), [MODULES.md](MODULES.md), and [DESIGN.md](DESIGN.md).
