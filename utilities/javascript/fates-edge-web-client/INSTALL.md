# Installing the Fate's Edge Web Client

For a home server or NAS, start with the [Home Docker guide](../../../DOCKER_HOME.md).
It covers the website and game server together, NAS projects, ports, backups,
updates, and HTTPS. This page covers the **website-only** installation.

## Choose your installation

- **Website + multiplayer on a NAS:** use the repository-root Compose file and Home Docker guide.
- **Website only:** use the commands below. A separate socket server is needed for multiplayer.
- **Local solo use:** use the local development server below; no multiplayer server is needed.

Do not double-click the source `index.html`. The source uses JavaScript modules,
build-time configuration, and fetched data. A `file://` page or generic static server
over the source folder is not a supported substitute for building with Vite.

## Website-only Docker installation

From the repository root:

```sh
cd utilities/javascript/fates-edge-web-client
docker compose up -d --build
docker compose ps
```

Open `http://NAS-IP:8080` from another device, or `http://localhost:8080` on the
Docker host itself. Change the website port by creating a `.env` in **this component
folder** with `PORT=9000` before deploying. This standalone file uses `PORT`;
the root combined stack uses `CLIENT_PORT` instead.

The image contains the built website; do not mount an empty host folder over
`/usr/share/nginx/html`. No website data volume is needed. Browser data is separate.

## Connect to your game server

In Settings, set **WebSocket Server URL** to your own server, such as
`ws://192.168.1.50:10000`, set the room name, and choose **Connect**.
For Campaign Sharing (HTTP), set **Server URL** to `http://192.168.1.50:10000`.

The standalone website cannot discover your server. Without build overrides,
HTTP builds fall back to localhost and HTTPS builds to the hosted server.
These are not automatically your NAS. The **combined root stack**, in contrast,
builds a default using the website hostname and `SERVER_PORT`.
Each browser's saved settings take precedence over build defaults.

For HTTPS hosting, use `wss://` and `https://` server addresses with valid TLS.
An HTTPS website cannot use an insecure HTTP/WebSocket server.
Microphone and screen recording also require HTTPS when opening a NAS by IP/hostname.

To preconfigure a standalone image, add public build arguments under
`services.client.build.args` in this folder's Compose file:

```yaml
args:
  VITE_WS_URL: wss://game.example.com
  VITE_SERVER_URL: https://game.example.com
  VITE_WS_ROOM: AC12
```

Then rebuild with `docker compose up -d --build`. These settings are public:
never put an API key or password in them. Returning players must update old
saved addresses in Settings; rebuilding does not overwrite browser storage.

## Local solo use or development (without Docker)

Install Node.js 24 and npm. From the repository root:

```sh
cd utilities/javascript/fates-edge-web-client
npm ci
npm run dev
```

Open the address Vite prints. Keep that terminal running. In Settings, disable
WebSocket connectivity if you want to work completely offline.

For static hosting, run `npm run build` and serve the resulting `dist/` folder.
Use `PORT=8080 npm run serve` on Linux/macOS to serve it on port 8080.
The serve script's default port is 10000, which would conflict with the game server.
For long-running home hosting, use Docker instead of leaving a development server open.

## Locking and access

The sidebar lock protects the local browser interface; it is not server authentication
or encryption of a shared website. Keep the deployment private or use appropriate
reverse-proxy/network access controls. No `build:locked` npm script is provided by this package.

## Updates and backups

Have each player use **Export Data** before important updates. A Docker-volume backup
does not include their browser storage. Back up the game server separately if used.

For a Git installation, from this component directory:

```sh
git pull --ff-only
docker compose up -d --build
```

Review local-change errors instead of discarding files. See the Home Docker guide for
the combined stack's backup and restore procedure.

## Troubleshooting

- **Page appears but players cannot see each other:** check server/room settings and
  the server's `/healthz` endpoint; website health alone does not prove multiplayer works.
- **Wrong server after an update:** correct the saved URL in Settings. Do not erase
  browser storage without exporting your data.
- **Unhealthy website container:** check `docker compose logs client`. The current
  health check uses `wget`, matching the nginx image.
- **Files not found during build:** copy the full component source, not just its Compose file.
- **Voice permissions missing on the LAN:** use HTTPS; TURN does not fix insecure browser contexts.

To stop and remove these website-only containers, run `docker compose down`.
There is no need for `-v`; that option deletes named volumes, not just networks.

See [README.md](README.md) for features and licensing.
