# Authoring & Distributing Modules

A **module** is an installable adventure package the server can store and push live to every client in a room — think "drop a one-shot into the group's toolkit with one command," as opposed to each player manually importing a JSON file.

This is distinct from the **Adventure Engine** (`server/adventure.js`), which is the authoritative synced state machine for whichever adventure is currently loaded in a room (its acts/scenes/timers/encounters). A module is how you *get* an adventure onto a room's Adventure Engine (or into a player's local Adventure Manager) in the first place.

It's also distinct from the web client's **Settings → Adventure Module Library** panel (`js/features/settings/index.js`, since v4.11.1) — that one browses and one-click-installs adventures bundled statically in the client's own `data/adventures/` folder (see `adventure-manager/index.js`'s `loadAdventureManifest()`/`loadAdventureFromFile()`), entirely client-side, no server involved at all. This page's "module" push/pull system is for server-hosted adventures a GM distributes live to everyone in a room; the Settings library is for adventures already bundled with the client itself.

---

## 1. Anatomy of a module

Every module is a directory under `modules/<id>/` at the repo root (sibling to `server/`), containing exactly two files:

```
modules/
└── my-adventure/
    ├── adventure.json   # the adventure content itself
    └── manifest.json    # metadata describing it
```

`<id>` is the directory name and doubles as the module's id everywhere (API paths, WS payloads, etc.) — keep it URL-safe (`[a-zA-Z0-9_-]`, no spaces).

### `adventure.json`

This is a normal Fate's Edge adventure file — the same format the web client's **Adventure Manager** imports/exports. Minimum shape:

```json
{
  "id": "my-adventure",
  "title": "The Salt Road Incident",
  "acts": [
    {
      "id": "act-1",
      "title": "Act I: Arrival",
      "scenes": [
        { "id": "scene-1", "title": "The Docks", "description": "..." }
      ]
    }
  ],
  "npcs": [],
  "locations": [],
  "campaignTimers": [],
  "bestiary": []
}
```

Only `title` is strictly required — the client-side installer (`installAdventureContent()` in `js/features/adventure-manager/index.js`) fills in empty arrays for anything missing and repairs missing ids. But a real module should have at least one act with at least one scene, or there's nothing to load.

### `manifest.json`

Metadata shown in module-listing UIs and the `/api/modules` response:

```json
{
  "name": "The Salt Road Incident",
  "version": "1.0.0",
  "description": "A short, self-contained adventure demonstrating the adventure.json schema.",
  "author": "Your Name",
  "type": "adventure",
  "icon": "🧂",
  "tierRange": "I"
}
```

`name` and `version` are the only fields every consumer reads; `description`, `author`, `icon`, and `tierRange` are recommended for anything you intend to share.

See `modules/example-module/` for a complete, working reference.

---

## 2. Generating a manifest automatically

If you already have an `adventure.json` and don't want to hand-write `manifest.json`, drop the adventure file in place and run:

```bash
cd utilities/javascript/fates-edge-socket-server
node generate-manifest.js my-adventure          # writes modules/my-adventure/manifest.json
node generate-manifest.js my-adventure --force  # overwrite an existing manifest.json
```

This derives `name`/`description` from the adventure's own `title`/summary fields where possible. It's a starting point, not a substitute for filling in `author`/`icon`/`tierRange` by hand if you care about how the module is presented.

---

## 3. Installing a module via the REST API

Instead of placing files on disk directly, you can install a module over HTTP (useful for a GM-facing tool, or scripting module delivery):

```bash
curl -X POST http://localhost:3000/api/modules \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "id": "my-adventure",
        "manifest": { "name": "The Salt Road Incident", "version": "1.0.0" },
        "adventure": { "title": "The Salt Road Incident", "acts": [] }
      }'
```

This writes `modules/my-adventure/{manifest.json,adventure.json}` exactly as if you'd placed them by hand. List what's installed with:

```bash
curl -H "X-API-Key: $API_KEY" http://localhost:3000/api/modules
```

---

## 4. Pushing a module to a live room

Once a module is installed (on disk or via the API above), broadcast it to everyone currently connected to a room:

```bash
curl -X POST http://localhost:3000/api/modules/my-adventure/push \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "roomCode": "AC12" }'
```

Omit `roomCode` to broadcast to every active room on the server.

The web client can also trigger this from inside a session — the VTT's module-push UI sends a `module-push-request` WS/Socket.io message with the module id, and the server broadcasts a `module-push` event containing the manifest and file contents to every other client in the room. Each receiving client's `vtt-connected.js` automatically calls `installAdventureContent()` to add it to their local Adventure Manager — no manual import step. The pushing GM's own client installs it too, from the request's own response (since broadcasts don't echo back to the sender).

To remove a pushed module from everyone's local copy, use `/api/modules/:id/cleanup` (or the equivalent `module-cleanup-request` WS event) — this broadcasts `module-cleanup`, which each client uses to call `removeInstalledAdventure(id)`.

---

## 5. Event/route reference

| Transport | Name | Direction | Payload |
|---|---|---|---|
| REST | `GET /api/modules` | client → server | — |
| REST | `POST /api/modules` | client → server | `{ id, manifest, adventure }` |
| REST | `POST /api/modules/:id/push` | client → server | `{ roomCode? }` |
| REST | `POST /api/modules/:id/cleanup` | client → server | `{ roomCode? }` |
| WS/Socket.io | `module-list` | client → server | `{ requestId }` |
| WS/Socket.io | `module-list-response` | server → client | `{ requestId, modules, count }` |
| WS/Socket.io | `module-push-request` | client → server | `{ requestId, moduleId }` |
| WS/Socket.io | `module-push-response` | server → client | `{ requestId, success, module }` or `{ requestId, error }` |
| WS/Socket.io | `module-push` (broadcast) | server → other clients in room | `{ source, clientName, module, timestamp }` |
| WS/Socket.io | `module-cleanup-request` | client → server | `{ requestId, moduleId }` |
| WS/Socket.io | `module-cleanup-response` | server → client | `{ requestId, success, moduleId }` or `{ requestId, error }` |
| WS/Socket.io | `module-cleanup` (broadcast) | server → other clients in room | `{ source, moduleId, timestamp }` |

Both the plain-`ws` transport (`server/ws-handlers.js`) and the Socket.io transport (`server/socketio-handlers.js`) implement all of the WS/Socket.io rows identically — the web client works with either.
