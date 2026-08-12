# Installing the Fate's Edge Socket Server

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
Same idea as forwarding a port for any dedicated game server:
1. Forward TCP port `10000` (or whatever you set `PORT` to) on your
   router to the machine running the server.
2. Give players your public IP (check "what's my IP" in a browser) or a
   DNS name pointing at it.
3. If your public IP changes periodically (most home internet), consider
   a free dynamic-DNS service (No-IP, DuckDNS) so you don't have to
   re-share your IP every session — same trick used for any home-hosted
   game server.

**Don't want to touch your router at all?** A tunnel service — [Cloudflare
Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
or [Tailscale](https://tailscale.com/) — gets you a stable, public address
without opening any ports, the same category of tool as `ngrok`/`playit.gg`
for game servers. Out of scope for this guide, but worth knowing it exists
if your router/ISP makes port forwarding painful (CGNAT, etc.).

**Hosting on a VPS instead of your own machine?** Same steps, just run
them on the VPS — most cloud providers' firewalls need the port opened
there too, in addition to (or instead of) a router.

---

## Voice Chat (optional)

Voice chat works out of the box via STUN, which is enough for most home
routers. It only breaks down for players behind stricter NATs/firewalls
(common on some corporate/campus/mobile networks) — for those, you need a
TURN relay. This repo bundles [coturn](https://github.com/coturn/coturn)
for that, wired up via `docker-compose.yml`:

```bash
cp .env.example .env   # if you haven't already
# edit .env: set TURN_SECRET to any long random string,
# and TURN_URLS=turn:<your-public-ip-or-domain>:3478
docker compose up -d
```

This also starts the `coturn` service alongside the main server. It needs
UDP/TCP port `3478` forwarded too (same as above), and additionally uses
ports `49160-49200` UDP for the actual relayed audio — forward that range
as well if you're hosting for players outside your LAN. See
`coturn/README.md` for adding a real TLS cert (`turns://`) if some
players are behind a firewall that only allows HTTPS-looking traffic.

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
periodically, or before every update if you want to be extra safe.

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
or you're trying to connect from another device without forwarding the
port (see [Opening Your Server to Players](#opening-your-server-to-players)).

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
That's almost always the NAT issue TURN exists to fix — see [Voice
Chat](#voice-chat-optional) above.

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
