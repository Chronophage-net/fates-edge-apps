# Fate's Edge Roll20 Module

<p align="center">
  <img src="https://img.shields.io/badge/Roll20-API-blue" alt="Roll20 API"/>
  <img src="https://img.shields.io/badge/version-4.16.0-orange" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

**Fate's Edge Roll20** connects your Roll20 game to the Fate's Edge WebSocket server, enabling real‑time synchronization of chat, dice rolls, characters, timers, scenes, the Deck of Consequences, Crown Spread readings, modules, and **Game Master election/promotion**.

---

## ✨ Features

- 🔌 **Real‑time Connection** – Persistent WebSocket connection to the Fate's Edge server.
- 💬 **Chat Sync** – Bidirectional chat message synchronization.
- 🎲 **Dice Roll Sync** – Share dice rolls between Roll20 and VTT clients.
- 👥 **Character Sync** – Synchronize character data (Harm, Fatigue, Boons, Tier) as Roll20 attributes and journal entries.
- 🎭 **Adventure Engine** – Load modules, advance scenes, run encounters, tick real campaign/scene timers, and log narrative beats.
- 🎬 **Scene Notifications** – Broadcast the current Roll20 page name to the VTT whenever it changes (one-way, Roll20 → VTT).
- 🃏 **Deck of Consequences** – Draw cards, shuffle, and perform Crown Spread readings directly from Roll20.
- 📦 **Module Listing** – List modules available on the server.
- 🌍 **Region Support** – Set and sync default region for card meanings.
- 👑 **GM Election & Promotion** – Request GM status, approve/reject requests, and view client roles – all from Roll20 chat.
- 🔐 **Secure** – API key authentication support.
- 🔄 **Auto-Reconnect** – Automatically reconnects if the connection drops.

---

## 📋 Requirements

- Roll20 Game with **Pro subscription** (API access required).
- Fate's Edge WebSocket Server running and accessible (see [server documentation](../../javascript/fates-edge-socket-server/README.md)).
- (Optional) Custom character sheet for Fate's Edge (provided).

---

## 🚀 Installation

### 1. Add the API Script

1. Go to your Roll20 Game.
2. Click **Settings** → **API Scripts**.
3. Click **New Script**.
4. Name it: `Fates Edge Bridge`.
5. Paste the contents of `api/fates-edge-api.js` (from this module) into the editor.
6. Click **Save Script**.

### 2. Configure Environment Variables

In the Roll20 API console, set these global variables (they can be added at the top of the script or in the API environment):

```javascript
// Required
var FATES_EDGE_SERVER_URL = 'ws://your-server:10000';
var FATES_EDGE_ROOM_CODE = 'AC12';

// Optional – API key if your server requires it
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

### 3. (Optional) Install the Custom Character Sheet

1. In your Roll20 Game, go to **Settings** → **Game Settings**.
2. Under **Character Sheet Template**, select **Custom**.
3. Paste the HTML from `character-sheet/fates-edge.html` into the **HTML Layout** field.
4. Paste the CSS from `character-sheet/fates-edge.css` into the **CSS Styling** field.
5. Click **Save Changes**.

---

## 🎮 Usage

The module exposes a set of `!fates-edge` commands that can be used in Roll20 chat or in macros.

> The command list below is generated directly from the `switch (subcommand)` in `api/fates-edge-api.js`'s chat handler — every command here is implemented in the current script. A few commands from older versions of this README (`ping`, `whisper`, `emote`, `d`, standalone `timer`/`scene` management, `sync char`/`sync selected`, `char list`/`char update`, `modules push`/`modules cleanup`) were removed from this document because the code backing them doesn't currently exist — file an issue or a PR if you'd like them added.

### Connection & Status

| Command | Description |
|---------|-------------|
| `!fates-edge connect` | Connect to the VTT server. |
| `!fates-edge disconnect` | Disconnect from the VTT server. |
| `!fates-edge status` | Show connection status, region, deck count, whiteboard/grid-combat summary, GM info, and current adventure/scene/encounter if any. |

### Chat & Dice

| Command | Description |
|---------|-------------|
| `!fates-edge send <message>` | Send a chat message to the VTT. |
| `!fates-edge roll <dice>` | Roll dice locally and broadcast the result to VTT. |

Chat messages you type normally (not prefixed with `!fates-edge`) are also relayed automatically when `FATES_EDGE_SYNC_CHAT` is on, and Roll20 dice-roll results are relayed automatically when `FATES_EDGE_SYNC_ROLLS` is on.

### Character Sync

| Command | Description |
|---------|-------------|
| `!fates-edge sync characters` | Sync all Roll20 characters to VTT. |

### Scene Sync

| Command | Description |
|---------|-------------|
| `!fates-edge sync scene` | Broadcast the current Roll20 page name to the VTT as a `scene-status-update` notification (non-destructive — does not touch the room whiteboard). |

Roll20 page changes are also synced automatically when `FATES_EDGE_SYNC_SCENES` is on (same non-destructive broadcast, fired on `change:campaign:currentpage`).

### Deck of Consequences

| Command | Description |
|---------|-------------|
| `!fates-edge draw [count]` | Draw N cards from the deck (1–5, capped server-side). |
| `!fates-edge crown [region]` | Perform a Crown Spread reading. |
| `!fates-edge shuffle` | Shuffle the deck. |
| `!fates-edge region [name]` | Set or get the default region. |

> **Server API note (v4.16.0):** each room's deck now shuffles with its own seedable RNG instead of a shared unseeded one, so draws are reproducible per room via two new REST routes, `GET`/`POST /api/rooms/:code/deck/seed`. The existing `deck-shuffled` broadcast handled above already fires generically regardless of `reason`, so a server-side reseed (`reason: 'reseeded'`) needs no code change here, but no `!fates-edge` subcommand calls the seed routes yet.

### Module Management

| Command | Description |
|---------|-------------|
| `!fates-edge modules list` | List loaded modules. |

### Adventure Engine

| Command | Description |
|---------|-------------|
| `!fates-edge adventure load <moduleId>` | Load an adventure module. |
| `!fates-edge adventure scene [actIndex] [sceneIndex]` | Advance the adventure (omit both to advance sequentially). |
| `!fates-edge adventure encounter start <ref>` | Start an encounter by index or name. |
| `!fates-edge adventure encounter resolve <clean\|partial\|miss> [notes]` | Resolve the active encounter. |
| `!fates-edge adventure timer <name> [amount] [scene\|campaign]` | Tick a real Adventure Engine timer. |
| `!fates-edge adventure log <text>` | Append a narrative beat to the adventure log. |
| `!fates-edge adventure status` | Show current adventure state. |
| `!fates-edge adventure reference` | Show bestiary/NPCs/locations/factions for the loaded adventure. |
| `!fates-edge adventure reset` | Reset the loaded adventure back to planned. |

> **Server API note (v4.16.0):** the socket server added `POST /api/rooms/:code/adventure/climax-forced` (a sibling of the existing `climax-triggered` route, broadcasting `adventure-climax-forced` when the AI GM director forces a stalled climax forward), and the adventure state/reference payloads (`adventure status` / `adventure reference` above) now also carry `climaxPadScenes`, `climaxScenesSinceTrigger`, `climaxForced` (state) and an optional `persistence` block (reference — the "Legacy Tracker" schema declaration). No `!fates-edge adventure` subcommand calls the new route or surfaces these fields yet.

### GM Election & Promotion

| Command | Description |
|---------|-------------|
| `!fates-edge gm request` | Request to become the Game Master. |
| `!fates-edge gm approve <player>` | Approve a pending GM request (GM only). |
| `!fates-edge gm reject <player>` | Reject a pending GM request (GM only). |
| `!fates-edge gm status` | Show current GM and pending requests. |
| `!fates-edge gm list` | List all connected clients with their roles. |
| `!fates-edge role set <player> <co-gm\|assistant-gm\|player\|spectator> [save]` | Change a client's role (GM only; `save` persists a Co-GM/Assistant GM grant across reconnects — demotions always persist). `assistant-gm` is typically assigned to the AI GM Bot's own client — see the `fates-edge-ai-gm-bot` repo's README ("Assistant GM Mode") for what changes once it holds that role. |
| `!fates-edge role list` | List all clients with their roles. |

#### GM Command Examples

```javascript
// Request GM
!fates-edge gm request

// Approve a request (by player name or ID)
!fates-edge gm approve "Aria"

// Reject a request
!fates-edge gm reject "Thorn"

// Show GM status
!fates-edge gm status

// List all clients
!fates-edge gm list
```

---

## 📝 Macros

You can create Roll20 macros that use these commands. For a complete reference, see [`macros/examples.md`](macros/examples.md).

### Basic Macro Examples

```javascript
// Connect to VTT
!fates-edge connect

// Sync all characters
!fates-edge sync characters

// Roll dice and broadcast to VTT
!fates-edge roll 2d20kh1

// Draw 3 cards
!fates-edge draw 3

// Advance the current adventure's active Ritual timer
!fates-edge adventure timer "Ritual" 1

// Request GM
!fates-edge gm request
```

---

## 🐛 Troubleshooting

### Connection Failed

- Verify `FATES_EDGE_SERVER_URL` is correct.
- Check that `FATES_EDGE_ROOM_CODE` is a valid room on the server.
- Ensure the server is running and reachable.
- If using `wss://`, make sure your Roll20 environment supports secure WebSockets.

### Characters Not Syncing

- Ensure `FATES_EDGE_SYNC_CHARACTERS` is set to `true`.
- Character names must match between Roll20 and the VTT.
- Check the API console for errors (View → Developer → JavaScript Console).

### GM Approval Not Working

- Only the current GM can approve or reject a request.
- Players must first use `!fates-edge gm request`.
- Use `!fates-edge gm list` to see client IDs and names.

### Deck Draws Not Appearing

- Ensure `FATES_EDGE_SYNC_DECK` is set to `true`.
- The deck must have enough cards (the server will auto-shuffle if low).
- Check the console for any error messages.

---

## 🔄 Updating

1. Go to **Settings** → **API Scripts**.
2. Replace the content of `Fates Edge Bridge` with the latest `api/fates-edge-api.js`.
3. Click **Save Script**.
4. If using the custom character sheet, update the HTML/CSS files accordingly.

---

## 📄 License

MIT License – see the monorepo root's [LICENSE.code](../../../LICENSE.code) for details.

---

## 🤝 Contributing

Contributions are welcome! This module lives inside the `fates-edge-apps`
monorepo — fork it, make your changes under
`utilities/vtt_mods_bots/fates-edge-roll20/`, and open a pull request.

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/Chronophage-net/fates-edge-apps/issues)
- **Email**: support@fates-edge.com

---

Made with ❤️ by Nick Gasper