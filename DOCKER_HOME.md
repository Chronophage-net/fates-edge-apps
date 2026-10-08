# Run Fate's Edge on a home server or NAS

Start here for a small, self-hosted table. The recommended setup runs **two containers**:
the Toolkit website and the multiplayer server. You do not need Node.js, Python,
an AI subscription, Redis, or the SaaS Manager installed on your NAS.

This guide uses the **repository-root `docker-compose.yml`**. Do not mix its commands
with the separate Compose files inside individual components: their storage paths differ.

## Before you begin

- A NAS or home server with Docker and **Docker Compose v2** (`docker compose version`).
  Use its container-management package if it provides Compose projects.
- A 64-bit x86 or ARM host supported by the base images. Older 32-bit NAS models are
  not a tested target. ARM support is intended, but builds must be checked on your model.
- Free disk space for source files, image builds, and saved games. The first build needs
  internet access and more memory than simply running the containers. If it is killed
  for lack of memory, build on a compatible machine and import the images.
- A shared folder for the **complete repository**, and a separate backup location.
- Your NAS's LAN address, for example `192.168.1.50`. Reserve it in your router's DHCP
  settings if possible so your players' address does not keep changing.

The two default ports are **8080** (website) and **10000** (game server), both TCP.
If another NAS application already uses one, choose a free port in `.env`.
Do not change the NAS administration ports or enable privileged container mode.

## 1. Put the files on the NAS

Download and extract the repository ZIP, or use Git:

```sh
git clone https://github.com/Chronophage-net/fates-edge-apps.git
cd fates-edge-apps
cp .env.example .env
```

Use a plain-text editor for `.env` (including the leading dot). Do not overwrite an
existing `.env` during an update. Keep it private: it contains your administration key.

### Using a NAS container interface

Create a Compose **project/stack** whose working folder is the extracted repository
and select the root `docker-compose.yml`. Keep the same project name for future updates.
The folder must contain `utilities/`, not just the YAML file.

The stack **builds local images**. A UI that only accepts an image name or a pasted
Compose file may not support this workflow. Use a Compose-capable project/import
feature, or the NAS's SSH terminal and the commands below. Docker resolves build
paths relative to the Compose project, not your laptop's Downloads folder.
See [Docker's build-path documentation](https://docs.docker.com/reference/compose-file/build/).

If the interface has an environment-variable editor, enter the values there or ensure
it loads this folder's `.env`. Do not paste `.env` contents into the Compose YAML.
No Node.js installation on the NAS is necessary: the build runs inside Docker.

## 2. Set your administration key

Edit these lines in `.env`:

```dotenv
CLIENT_PORT=8080
SERVER_PORT=10000
API_KEY=REPLACE_WITH_YOUR_OWN_LONG_RANDOM_SECRET
CORS_ORIGIN=http://192.168.1.50:8080
```

Replace the example IP and key. Generate a long random letters-and-digits key in a
password manager (at least 32 characters). This is an **administrator credential**,
not a room code or a password to give every player. Keep it out of screenshots and
support logs. If left blank, a temporary key is printed in the server logs and changes
on restart; that is inconvenient for a lasting installation.

`CORS_ORIGIN` is the exact website address players open: scheme, hostname/IP and port,
without a trailing slash. It is a browser restriction, **not a firewall or login system**.
For initial LAN troubleshooting the default `*` accepts any website origin; restrict it
once you know your final address. Leave `PUBLIC_WS_URL` and `PUBLIC_SERVER_URL` blank
for this LAN-only setup. Do not enable bots, TURN, or the full AI demo yet.

## 3. Build and start

Run from the repository folder on the NAS (or choose Build/Deploy in its project UI):

```sh
docker compose config --quiet
docker compose up -d --build client server
docker compose ps
```

The first build can take several minutes, especially on a small NAS. The two containers
should stay running and become healthy. `-d` keeps them running after the terminal closes;
the restart policy brings them back after the Docker service restarts.

For startup problems:

```sh
docker compose logs --tail=100 client server
```

Logs may contain the temporary API key if you did not set one. Redact it before sharing.
Do not run `docker compose config` without `--quiet` when collecting public diagnostics:
the expanded configuration can include secrets.

## 4. Open the Toolkit and connect your table

On your laptop or phone, open **`http://192.168.1.50:8080`**, using your NAS's address.
`localhost` means the device running the browser; it does **not** mean the NAS.

Check both services directly:

| Address | Expected result |
| --- | --- |
| `http://192.168.1.50:8080` | Toolkit interface |
| `http://192.168.1.50:8080/health` | `healthy` |
| `http://192.168.1.50:10000/healthz` | HTTP success / server health response |

There is no default administrator website login in this two-container setup. The
Toolkit can be used locally without an account. The separate Manager login is **not**
included. Browser lock/PIN features are not a substitute for server access controls.

In **Settings**, find **WebSocket Server URL**, **Room Name**, and **Connect**.
The root Docker build now defaults to the NAS hostname/IP you opened, on `SERVER_PORT`.
For this example, that is `ws://192.168.1.50:10000`. Set a room name/code with your group
and connect everyone to the **same server and room**. Use a second device to verify
chat or dice events arrive. Returning browsers may retain an older server address;
correct it in Settings rather than clearing all browser data.

For **Campaign Sharing (HTTP)**, check its Server URL separately:
`http://192.168.1.50:10000`. Live synchronization and explicitly uploading a saved
campaign are different operations. Keep browser exports too; do not assume every
local edit is automatically a durable server backup.

## 5. Know where your data lives

For the **root stack**:

| Data | Storage | What to back up |
| --- | --- | --- |
| Server SQLite database and room directory | Named volume `server-persistence`, mounted at `/app/persistence` | Entire volume, including SQLite sidecar files |
| Installed server modules | Named volume `server-modules`, at `/app/modules` | Entire volume |
| Server data files | Repository's `utilities/javascript/fates-edge-socket-server/data`, at `/app/data` | That host folder |
| Logs | Named volume `server-logs` | Optional for recovery; useful for diagnosis |
| Configuration | Repository-root `.env` | Private copy, plus the Compose file and version used |
| Each player's local Toolkit state | That device/browser's storage | Toolkit **Export Data**, saved outside the browser |

Docker usually prefixes named volumes with the project name. For example,
`fates-edge-apps_server-persistence`. Your NAS may call these *volumes* or *persistent
storage*. They are not automatically inside your shared repository folder.
The NAS's normal shared-folder backup may **not** include Docker volumes.

Keep the same project name and folder when updating. A different name creates different
volumes, which can look like data loss. `docker compose down` retains named volumes;
**`docker compose down -v` deletes them**. Never use `-v` as an update or troubleshooting step.
See [Docker's volume documentation](https://docs.docker.com/reference/compose-file/volumes/).

### Simple backup with a short maintenance break

Ask players to export their browser data and disconnect. Create a new backup folder for
each backup; replace `backup-before-update` below if it already exists. These commands
copy from stopped containers so the SQLite files are consistent:

```sh
mkdir -p backup-before-update/persistence backup-before-update/modules backup-before-update/data
docker compose stop server
docker compose cp server:/app/persistence/. backup-before-update/persistence/
docker compose cp server:/app/modules/. backup-before-update/modules/
docker compose cp server:/app/data/. backup-before-update/data/
cp .env docker-compose.yml backup-before-update/
docker compose start server
```

Check that the copy commands succeeded, then copy the backup folder to another disk or
machine using your NAS backup software. Protect it like a password file. Record the
release/commit used. A backup on the same NAS is not protection against losing the NAS.
NAS volume snapshots are another option, but stop the server while taking the snapshot.

### Restore without overwriting the only remaining copy

Keep the original backup and current volumes. First try recovery with a **fresh project**:

1. Stop/remove the old stack's containers with `docker compose down` (**no `-v`**).
   The fixed container names prevent two copies of this stack running side by side.
2. Extract the same source version to a new folder. Copy the backed-up `.env` into it.
3. In that new folder, create replacement containers and new named volumes:
   `docker compose -p fates-edge-restore create --build client server`.
4. Copy the backed-up files into those stopped containers, substituting the real backup path:

   ```sh
   docker compose -p fates-edge-restore cp /path/to/backup/persistence/. server:/app/persistence/
   docker compose -p fates-edge-restore cp /path/to/backup/modules/. server:/app/modules/
   docker compose -p fates-edge-restore cp /path/to/backup/data/. server:/app/data/
   docker compose -p fates-edge-restore up -d client server
   ```

5. Check health, join the expected room, and load a saved campaign. Import browser exports
   separately if needed. Keep using `-p fates-edge-restore` for this restored installation.
   Do not delete the old volumes until recovery has been verified.

## Updates

Back up first. In the **same project folder**:

```sh
git pull --ff-only
docker compose up -d --build client server
docker compose ps
```

If Git reports local changes, stop and review them; do not discard your configuration.
For ZIP installations, update the source while preserving `.env`, the server data folder,
and the project identity. Downloading a ZIP alone does not update running containers.
These images are built locally: **Pull image** by itself does not build the updated app.
For base-image refreshes, use `docker compose build --pull client server` before `up -d`.
Keep the previous source version and backup until the update has been checked.

## Friends outside your house, HTTPS, and voice

Start with LAN access. Do **not** expose the NAS administration interface or casually
forward the game port to the internet. Prefer a private VPN for trusted players, or
configure an HTTPS reverse proxy with a valid certificate and appropriate access rules.
Remote hosting requires deliberate firewall and server-access configuration.

For a reverse proxy, use two hostnames, for example:

- `https://table.example.com` → NAS port 8080 (Toolkit).
- `https://game.example.com` → NAS port 10000 (server), with WebSocket upgrades enabled.

Then set `CORS_ORIGIN=https://table.example.com`,
`PUBLIC_WS_URL=wss://game.example.com`, and `PUBLIC_SERVER_URL=https://game.example.com`
in `.env`, and run `docker compose up -d --build client server` again.
The public URLs are baked into the client image; restarting is not enough.
Keep both server URLs pointed at **your** deployment. Never use the internal Docker
hostname `server` as a browser address, and never embed the admin key in client settings
distributed with the image.

Microphone/voice and screen-recording features require a secure browser context:
**HTTPS for a NAS accessed by IP/hostname**, even over a VPN. The localhost exception
applies to the browser's own device, not another machine on the LAN.
See [MDN's microphone requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
TURN may still be needed for difficult network paths after HTTPS is working.

## Optional components: add them later

- **TURN:** set a strong `TURN_SECRET`, real `TURN_URLS`, and the appropriate public IP;
  start with `docker compose --profile turn up -d`. Review the
  [TURN guide](utilities/javascript/fates-edge-socket-server/coturn/README.md) for
  host networking, relay ports, and certificates. Do not enable it just to fix HTTP
  microphone permissions. Host-network support depends on your Docker platform.
- **Bots:** require their own credentials; the AI bot also needs its separate sibling
  repository. They are not necessary for human GMs. Do not publish model-service ports
  to the internet. The full demo/voice stacks are not the low-resource NAS starting point.
- **SaaS Manager:** [its guide](utilities/javascript/fates-edge-manager/README.md) is a
  separate, more advanced setup. Its `compose.yml` starts **PostgreSQL only**, not the
  Manager application or a managed socket node. Do not expect a dashboard at port 3100
  after deploying that file alone. It is not needed for an ordinary self-hosted table.

## Quick troubleshooting

| Symptom | First thing to check |
| --- | --- |
| Build context / Dockerfile missing | Upload the whole repository; use its root as the Compose project folder. |
| Image pull denied | Use Build/Deploy, not registry-only Pull. These image names are local build tags. |
| Port already allocated | Change the matching port in `.env`, rebuild/redeploy, and update the browser address/CORS origin. |
| Page opens but players cannot connect | Check server health, browser Settings, NAS firewall, and `ws://` versus `wss://`. No router port forwarding is needed on the same LAN. |
| Browser still uses an old server | Saved per-browser settings override build defaults; edit Settings. |
| Microphone missing/denied | Use HTTPS, grant browser permissions, then investigate network/TURN issues. |
| Empty campaigns after changing the project name | Inspect the old named volumes before creating new data or deleting anything. |
| Permission denied on storage | Check the NAS folder/volume access policy; do not use `chmod 777` or privileged mode as a blanket fix. |
| Build exits with code 137 | Check whether the NAS ran out of memory. |

## Verification status

This guide and the Compose/Dockerfile changes were reviewed against the source on
2026-10-08. Automated configuration/source checks and client default-address tests are
provided in `tests/docker-config.test.mjs`. No Docker daemon was available in the review
environment; image builds, boot, backup/restore, and NAS-specific behavior still need
an on-device smoke test. The commands above are instructions, not a claim that your
running NAS has been changed or tested.

Run the nine focused regression checks with `node --test tests/docker-config.test.mjs`
on a development machine with Node installed (not required on the NAS). They cover
public URL defaults, health-check tools, optional TURN, storage paths, and packaging
of fetched data/seed assets. A host-side Vite production build also succeeded; this
does not replace a Docker image build. The broader client suite passed 343/345 checks,
with two existing failures in unrelated CSS custom-property/RTL audits.
