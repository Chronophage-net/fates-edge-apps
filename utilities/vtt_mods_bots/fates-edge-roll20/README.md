# Fate's Edge Roll20 Module

<p align="center">
  <img src="https://img.shields.io/badge/Roll20-API-blue" alt="Roll20 API"/>
  <img src="https://img.shields.io/badge/version-1.3.0-orange" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

**Fate's Edge Roll20** connects your Roll20 game to the Fate's Edge WebSocket server, enabling real‑time synchronization of chat, dice rolls, characters, timers, scenes, the Deck of Consequences, Crown Spread readings, modules, and **Game Master election/promotion**.

---

## ✨ Features

- 🔌 **Real‑time Connection** – Persistent WebSocket connection to the Fate's Edge server.
- 💬 **Chat Sync** – Bidirectional chat message synchronization.
- 🎲 **Dice Roll Sync** – Share dice rolls between Roll20 and VTT clients.
- 👥 **Character Sync** – Synchronize character data (Harm, Fatigue, Boons, Tier) as Roll20 attributes and journal entries.
- ⏱️ **Timer Sync** – Share scene timers visible to all connected clients.
- 🎬 **Scene Sync** – Switch Roll20 pages remotely from the VTT.
- 🃏 **Deck of Consequences** – Draw cards, shuffle, and perform Crown Spread readings directly from Roll20.
- 📦 **Module Management** – List, push, and clean up VTT modules.
- 🌍 **Region Support** – Set and sync default region for card meanings.
- 👑 **GM Election & Promotion** – Request GM status, approve/reject requests, and view client roles – all from Roll20 chat.
- 🔐 **Secure** – API key authentication support.
- 🔄 **Auto-Reconnect** – Automatically reconnects if the connection drops.

---

## 📋 Requirements

- Roll20 Game with **Pro subscription** (API access required).
- Fate's Edge WebSocket Server running and accessible (see [server documentation](https://github.com/fates-edge/fates-edge-server)).
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
var FATES_EDGE_SERVER_URL = 'ws://your-server:3000';
var FATES_EDGE_ROOM_CODE = 'ABC123';

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

### Connection & Status

| Command | Description |
|---------|-------------|
| `!fates-edge connect` | Connect to the VTT server. |
| `!fates-edge disconnect` | Disconnect from the VTT server. |
| `!fates-edge status` | Show connection status, region, deck count, and GM info. |
| `!fates-edge ping` | Test connection latency. |

### Chat & Dice

| Command | Description |
|---------|-------------|
| `!fates-edge send <message>` | Send a chat message to the VTT. |
| `!fates-edge whisper <player> <message>` | Whisper to a specific VTT client. |
| `!fates-edge emote <action>` | Send an emote/action. |
| `!fates-edge roll <dice> [reason]` | Roll dice and broadcast to VTT. |
| `!fates-edge d <dice>` | Shortcut for dice roll. |

### Character Management

| Command | Description |
|---------|-------------|
| `!fates-edge sync char <name>` | Sync a specific character to VTT. |
| `!fates-edge sync characters` | Sync all Roll20 characters to VTT. |
| `!fates-edge sync selected` | Sync selected tokens to VTT. |
| `!fates-edge char list` | List all synced characters. |
| `!fates-edge char update <name> <attr> <value>` | Update a character attribute (harm, fatigue, boons, tier). |

### Timer Management

| Command | Description |
|---------|-------------|
| `!fates-edge timer create <name> <segments>` | Create a new timer. |
| `!fates-edge timer tick <name> [ticks]` | Advance a timer by 1 or more. |
| `!fates-edge timer remove <name>` | Remove a timer. |
| `!fates-edge timer list` | List all active timers. |
| `!fates-edge timer reset <name>` | Reset a timer to 0. |

### Scene Management

| Command | Description |
|---------|-------------|
| `!fates-edge sync scene` | Sync the current Roll20 page to VTT. |
| `!fates-edge scene <name>` | Switch to a Roll20 page and sync it. |
| `!fates-edge scene list` | List available pages. |

### Deck of Consequences

| Command | Description |
|---------|-------------|
| `!fates-edge draw [count] [region]` | Draw N cards from the deck (1–5). |
| `!fates-edge crown [region]` | Perform a Crown Spread reading. |
| `!fates-edge shuffle` | Shuffle the deck. |
| `!fates-edge region [name]` | Set or get the default region. |

### Module Management

| Command | Description |
|---------|-------------|
| `!fates-edge modules list` | List loaded modules. |
| `!fates-edge modules push <id>` | Push a module to all clients (GM only). |
| `!fates-edge modules cleanup <id>` | Cleanup a module from all clients (GM only). |

### GM Election & Promotion (new in v1.3.0)

| Command | Description |
|---------|-------------|
| `!fates-edge gm request` | Request to become the Game Master. |
| `!fates-edge gm approve <player>` | Approve a pending GM request (GM only). |
| `!fates-edge gm reject <player>` | Reject a pending GM request (GM only). |
| `!fates-edge gm status` | Show current GM and pending requests. |
| `!fates-edge gm list` | List all connected clients with their roles. |

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

// Roll with advantage
!fates-edge roll 2d20kh1 "Attack with Advantage"

// Create a timer
!fates-edge timer create "Ritual" 6

// Draw 3 cards
!fates-edge draw 3 Acasia

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

MIT License – see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guidelines](https://github.com/fates-edge/fates-edge/blob/main/CONTRIBUTING.md).

---

## 💬 Support

- **Discord**: [Join our Discord](https://discord.gg/fates-edge)
- **Issues**: [GitHub Issues](https://github.com/fates-edge/fates-edge/issues)
- **Email**: support@fates-edge.com

---

Made with ❤️ by the Fate's Edge Team