# Installing the Fate's Edge Web Client

This is the "game client" — the app your players actually open in their
browser to roll dice, manage characters, and see the shared table. On its
own it's just a self-contained website; for live multiplayer play it
connects out to a [Socket Server](../fates-edge-socket-server/INSTALL.md)
(your "dedicated server" — set that up first if you haven't).

Two very different ways to run this, pick based on your situation:

- **Solo / just for you** — no install at all, just open a file.
- **Hosted for your table** — a small always-on web server so every
  player just visits a URL, the same way you'd host a website. This is
  the one worth Docker for.

---

## Option A: Solo / Just for You (no install)

If it's just you, or you're fine with everyone at your table opening the
same file locally:

1. **Get the files** — `git clone` this repo, or download it as a ZIP
   from GitHub and extract it.
2. Open `index.html` (inside `fates-edge-web-client/`) directly in a
   modern browser (Chrome, Firefox, Edge, Safari).

That's genuinely it for solo play — character creation, dice rolling,
the wiki, crafting, all of it works with zero server. You only need a
Socket Server (see above) once you want live multiplayer sync, voice
chat, or campaign sharing between devices.

> Some browsers restrict what a page opened via `file://` can do. If
> anything looks broken, use the one-line local server below instead of
> double-clicking `index.html`:
> ```bash
> cd fates-edge-web-client
> npx serve
> ```
> then open the URL it prints.

---

## Option B: Hosted for Your Table

This runs the client as a small always-on web server so players just
visit `http://your-server:8080` in their browser — no files to download,
no install on their end at all. This is the Docker path, and it's the
recommended one if you're already running the Socket Server this way.

**1. Get the files** (same as Option A, step 1).

**2. Build and start it:**
```bash
cd fates-edge-web-client
docker compose up -d
```
That's the whole install. Docker compiles the app and serves it with
nginx; `-d` keeps it running in the background after you close the
terminal.

**3. Open it:** `http://localhost:8080` (or your machine's IP, from
another device on your network). Change the port by setting `PORT` in a
`.env` file in this folder before starting, e.g. `PORT=9000`.

**4. Point it at your Socket Server** — see the callout below. This is
the one step that's easy to miss.

### ⚠️ Tell your client where your Socket Server is

The web client doesn't automatically know about a self-hosted Socket
Server — each player sets the server address once, in the client's
**Settings → Connection** screen (same idea as entering an IP to join
someone's game server). After the first connection, the browser
remembers it (saved to `localStorage`), so this is a one-time thing per
player per device.

**Important gotcha:** if you're serving this client over **HTTPS**
(e.g. behind a reverse proxy with a real domain/cert), the client's
built-in *default* — before a player has ever entered anything — points
at the developer's own public demo server (`fates-edge-ws.onrender.com`),
not your self-hosted one. Plain HTTP deployments default to
`localhost:10000` instead, which is still not your server's real address
if you're not running both on the same machine. Either way: **make sure
every player sets your actual Socket Server address in Settings the
first time they connect.**

If you'd rather they never have to touch that setting at all, change the
built-in default once and rebuild, so it's pre-filled for everyone:

1. Open `js/core/websocket.js` in a text editor.
2. Find `DEFAULT_WS_URL` / `DEFAULT_SOCKET_URL` near the top and replace
   `fates-edge-ws.onrender.com` / `localhost:10000` with your server's
   real address (e.g. `ws://your-domain-or-ip:10000`).
3. Rebuild: `docker compose up -d --build` (Docker) or `npm run build`
   (manual — see below).

---

## Manual Way (no Docker)

For admins who'd rather run this without Docker — still just two
commands once Node.js is installed.

**1. Install [Node.js](https://nodejs.org/) 20+.**

**2. Build and serve:**
```bash
cd fates-edge-web-client
npm install
npm run build     # compiles the app into dist/
npm run serve     # serves dist/ — defaults to port 10000
```

> **Port collision warning:** `npm run serve`'s default port (**10000**)
> is the *same* default port the Socket Server uses. If you're running
> both on the same machine, set `PORT` for one of them, e.g.
> `PORT=8080 npm run serve`, so they don't fight over the port.

For active development instead of a production build, `npm run dev`
starts Vite's dev server with hot-reload — not needed just to host the
client for a game.

### Keeping it running after you close the terminal

Same situation as the Socket Server — closing the terminal kills
`npm run serve`. Use [pm2](https://pm2.keymetrics.io/):
```bash
npm install -g pm2
pm2 start "npm run serve" --name fates-edge-client
pm2 save
pm2 startup     # prints one command to run so it survives a reboot too
```
(Docker's `restart: unless-stopped`, already set in `docker-compose.yml`,
means you don't need any of this on the Docker path.)

---

## Password-Protecting Your Table

Two independent options, either or both:

- **Each player sets their own** — click the lock icon in the sidebar.
  Stored only in that player's browser; doesn't affect anyone else.
- **You lock the whole build** — `npm run build:locked -- --password=your-secure-password`
  distributes a pre-locked build everyone needs the password for. If you
  go this route, also set an emergency reset code in
  `data/lock-reset.json` (see `generate-seed.js`) in case you forget it.

---

## Updating to a New Version

**Docker:**
```bash
git pull
docker compose up -d --build
```

**Manual:**
```bash
git pull
npm install
npm run build
# then restart however you're serving it: `npm run serve`, or `pm2 restart fates-edge-client`
```

There's no separate data to lose here — this container/process only
serves static files. Your actual campaign data lives on the Socket
Server (see that guide's backup section) or, for solo play, in each
player's own browser storage.

---

## Troubleshooting

**Players see the app but nothing syncs / no chat.**
They haven't connected to your Socket Server yet, or it's pointed at the
wrong address — check Settings → Connection on their end, and see the
⚠️ callout above about the default server address.

**`npm run serve` won't start / "port already in use."**
You're very likely running the Socket Server on the same machine with
its default port — see the port collision warning above. Set `PORT` to
something else for one of them.

**I changed `js/core/websocket.js`'s default but players still connect
to the wrong server.**
Make sure you actually rebuilt (`docker compose up -d --build` or
`npm run build`) after editing — the change lives in source, not in
already-built `dist/` output. Also remind returning players that their
browser may have cached a different address in `localStorage` from
before your change — they can re-enter it once in Settings to overwrite it.

**Docker container is "unhealthy."**
`docker compose logs client` — if you're on an older `docker-compose.yml`
that used `curl` for its healthcheck, that's a known issue (the base
image doesn't include `curl`); re-copy the current `docker-compose.yml`,
which uses `wget` instead.

---

## Uninstalling

**Docker:** `docker compose down` (optionally `-v` to remove the
networks Docker created; there's no data volume to worry about losing).

**Manual:** stop the process (`pm2 delete fates-edge-client` if you used
pm2), then delete the folder.

---

For the full feature list, project layout, and licensing details, see
[README.md](README.md).
