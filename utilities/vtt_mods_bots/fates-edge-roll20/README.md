# Fate's Edge Roll20 Module

<p align="center">
  <img src="https://img.shields.io/badge/Roll20-API-blue" alt="Roll20 API"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

Connects a Roll20 game to the Fate's Edge [socket server](../../javascript/fates-edge-socket-server/), syncing chat, dice rolls, characters, timers, scenes, the Deck of Consequences, Crown Spread readings, modules, and GM election/promotion in real time.

---

## Features

- Real-time connection to the Fate's Edge server, with auto-reconnect.
- Bidirectional chat and dice roll sync.
- Character sync (Harm, Fatigue, Boons, Tier) as Roll20 attributes and journal entries.
- Adventure Engine access — load modules, advance scenes, run encounters, tick real campaign/scene timers, log narrative beats.
- Scene notifications — the current Roll20 page name broadcasts to the VTT on change (one-way).
- Deck of Consequences draws, shuffles, and Crown Spread readings from Roll20 chat.
- Region support for card meanings.
- GM election & promotion, and API-key authentication.

---

## Requirements

- A Roll20 game with a **Pro subscription** (API access required).
- A Fate's Edge socket server, running and reachable — see [its own README](../../javascript/fates-edge-socket-server/README.md).
- Optionally, the bundled custom character sheet.

---

## Installation

### 1. Add the API script

In your Roll20 game: **Settings → API Scripts → New Script**, name it `Fates Edge Bridge`, paste in the contents of `api/fates-edge-api.js` from this module, and save.

### 2. Configure

Set these at the top of the script or in the Roll20 API environment:

```javascript
// Required
var FATES_EDGE_SERVER_URL = 'ws://your-server:10000';
var FATES_EDGE_ROOM_CODE = 'AC12';

// Optional
var FATES_EDGE_API_KEY = 'your-api-key-here';

// Feature toggles (all default to true)
var FATES_EDGE_AUTO_CONNECT = 'true';
var FATES_EDGE_SYNC_CHAT = 'true';
var FATES_EDGE_SYNC_ROLLS = 'true';
var FATES_EDGE_SYNC_CHARACTERS = 'true';
var FATES_EDGE_SYNC_TIMERS = 'true';
var FATES_EDGE_SYNC_SCENES = 'true';
var FATES_EDGE_SYNC_DECK = 'true';

// Display name (defaults to Roll20 active player name)
var FATES_EDGE_PLAYER_NAME = 'My GM Name';

// Default region for deck draws
var FATES_EDGE_DEFAULT_REGION = 'Acasia';
```

### 3. Optional: the custom character sheet

**Settings → Game Settings → Character Sheet Template → Custom** — paste `character-sheet/fates-edge.html` into HTML Layout and `character-sheet/fates-edge.css` into CSS Styling, then save.

---

## Usage

Commands run in Roll20 chat or macros as `!fates-edge <command>`. This list is generated directly from the script's chat handler — everything below is implemented in the current script.

### Connection & status

| Command | Description |
|---|---|
| `!fates-edge connect` | Connect to the VTT server |
| `!fates-edge disconnect` | Disconnect |
| `!fates-edge status` | Connection status, region, deck count, whiteboard/grid-combat summary, GM info, current adventure/scene/encounter |

### Chat & dice

| Command | Description |
|---|---|
| `!fates-edge send <message>` | Send a chat message to the VTT |
| `!fates-edge roll <dice>` | Roll locally and broadcast the result |

Ordinary chat (not prefixed with `!fates-edge`) relays automatically when `FATES_EDGE_SYNC_CHAT` is on; Roll20 roll results relay automatically when `FATES_EDGE_SYNC_ROLLS` is on.

### Character & scene sync

| Command | Description |
|---|---|
| `!fates-edge sync characters` | Sync all Roll20 characters to the VTT |
| `!fates-edge sync scene` | Broadcast the current page name as a non-destructive `scene-status-update` |

Page changes also sync automatically when `FATES_EDGE_SYNC_SCENES` is on.

### Deck of Consequences

| Command | Description |
|---|---|
| `!fates-edge draw [count]` | Draw 1–5 cards (capped server-side) |
| `!fates-edge crown [region]` | Crown Spread reading |
| `!fates-edge shuffle` | Shuffle the deck |
| `!fates-edge region [name]` | Set or get the default region |

Each room's deck shuffles with its own seedable RNG, so draws are reproducible per room via the server's `GET`/`POST /api/rooms/:code/deck/seed` routes; no `!fates-edge` subcommand calls those yet, though a server-side reseed still shows up here via the existing `deck-shuffled` handler.

### Module management

| Command | Description |
|---|---|
| `!fates-edge modules list` | List loaded modules |

### Adventure Engine

| Command | Description |
|---|---|
| `!fates-edge adventure load <moduleId>` | Load an adventure module |
| `!fates-edge adventure scene [actIndex] [sceneIndex]` | Advance the adventure (omit both to advance sequentially) |
| `!fates-edge adventure encounter start <ref>` | Start an encounter by index or name |
| `!fates-edge adventure encounter resolve <clean\|partial\|miss> [notes]` | Resolve the active encounter |
| `!fates-edge adventure timer <name> [amount] [scene\|campaign]` | Tick a real Adventure Engine timer |
| `!fates-edge adventure log <text>` | Append a narrative beat |
| `!fates-edge adventure status` | Show current adventure state |
| `!fates-edge adventure reference` | Show bestiary/NPCs/locations/factions for the loaded adventure |
| `!fates-edge adventure reset` | Reset the loaded adventure to planned |

The server also tracks climax pacing (`climaxPadScenes`/`climaxScenesSinceTrigger`/`climaxForced`) and a per-module "Legacy Tracker" persistence schema on the state/reference payloads above; no subcommand surfaces those fields on their own yet.

### GM election & promotion

| Command | Description |
|---|---|
| `!fates-edge gm request` | Request to become Game Master |
| `!fates-edge gm approve <player>` | Approve a pending request (GM only) |
| `!fates-edge gm reject <player>` | Reject a pending request (GM only) |
| `!fates-edge gm status` | Show current GM and pending requests |
| `!fates-edge gm list` | List all connected clients with roles |
| `!fates-edge role set <player> <co-gm\|assistant-gm\|player\|spectator> [save]` | Change a client's role (GM only; `save` persists a Co-GM/Assistant GM grant across reconnects, demotions always persist) |
| `!fates-edge role list` | List all clients with roles |

`assistant-gm` is the role typically assigned to the AI GM Bot's own client — see the [`fates-edge-ai-gm-bot`](https://github.com/Chronophage-net/fates-edge-ai-gm-bot) repo's README ("Assistant GM Mode") for what changes once it holds that role.

```javascript
!fates-edge gm request
!fates-edge gm approve "Aria"
!fates-edge gm reject "Thorn"
!fates-edge gm status
!fates-edge gm list
```

---

## Macros

See [`macros/examples.md`](macros/examples.md) for a full reference. A few basics:

```javascript
!fates-edge connect
!fates-edge sync characters
!fates-edge roll 2d20kh1
!fates-edge draw 3
!fates-edge adventure timer "Ritual" 1
!fates-edge gm request
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| Connection fails | `FATES_EDGE_SERVER_URL` correct; room code valid on the server; server reachable; `wss://` supported if used |
| Characters not syncing | `FATES_EDGE_SYNC_CHARACTERS` is `true`; names match between Roll20 and the VTT; API console for errors |
| GM approval not working | Only the current GM can approve/reject; requester used `!fates-edge gm request` first; check `!fates-edge gm list` for client ids |
| Deck draws not appearing | `FATES_EDGE_SYNC_DECK` is `true`; check the console for errors |

## Updating

**Settings → API Scripts** — replace the `Fates Edge Bridge` script's content with the latest `api/fates-edge-api.js`, save, and update the character sheet HTML/CSS if you use it.

## License

MIT — see the monorepo root's [`LICENSE.code`](../../../LICENSE.code).

## Contributing

This module lives inside the `fates-edge-apps` monorepo — fork it, make changes under `utilities/vtt_mods_bots/fates-edge-roll20/`, and open a pull request.

## Support

[GitHub Issues](https://github.com/Chronophage-net/fates-edge-apps/issues) · support@fates-edge.com

---

Made with ❤️ by Nick Gasper
