# Fate's Edge Bridge – Foundry VTT Module

<p align="center">
  <img src="https://img.shields.io/badge/Foundry-VTT-orange" alt="Foundry VTT"/>
  <img src="https://img.shields.io/badge/version-4.16.0-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
  <img src="https://img.shields.io/badge/status-stable-brightgreen" alt="Status"/>
</p>

**Fate's Edge Bridge** connects your Foundry VTT instance to the Fate's Edge WebSocket server, enabling real‑time synchronization of chat, dice rolls, characters, scene notifications, the Deck of Consequences, Crown Spread readings, module listing, and **Game Master election/promotion** between Foundry and other connected VTT clients.

---

## ✨ Features

- **🔌 Real‑time Connection** – Persistent WebSocket connection to the Fate's Edge server.
- **💬 Chat Sync** – Bidirectional chat message exchange between Foundry and VTT.
- **🎲 Dice Roll Sync** – Send dice rolls from Foundry to VTT clients.
- **👥 Character Sync** – Synchronize character data (Harm, Fatigue, Boons, Tier) as journal entries.
- **🎬 Scene Notifications** – Broadcast the active Foundry scene's name to the VTT whenever it changes (one-way, Foundry → VTT).
- **🃏 Deck Operations** – Draw cards, shuffle, and perform Crown Spread readings, all displayed as Foundry chat messages and journal entries.
- **📦 Module Listing** – List modules available on the server.
- **👑 GM Election & Promotion** – Request GM status, approve/reject requests, view client lists and roles directly from the Foundry UI.
- **🔄 Auto‑Reconnect** – Automatically reconnects if the connection drops.
- **🔐 Secure** – API key authentication and configurable permissions.

---

## 📋 Requirements

- Foundry VTT v11 or higher (tested with v13)
- Fate's Edge WebSocket Server running and accessible
- (Recommended) A stable internet connection for WebSocket communication

---

## 🚀 Installation

This module lives inside the `fates-edge-apps` monorepo rather than as its
own standalone repo, so it's installed by copying the folder in rather than
a Foundry manifest URL:

1. Clone or download `fates-edge-apps`:
   ```bash
   git clone https://github.com/Chronophage-net/fates-edge-apps.git
   ```
2. Copy `fates-edge-apps/utilities/vtt_mods_bots/foundry_fates-edge-bridge/`
   into your Foundry `Data/modules/` directory, renaming it to
   `fates-edge-bridge`. The folder structure should end up as
   `Data/modules/fates-edge-bridge/`.
3. Restart Foundry (or reload) and enable **Fate's Edge Bridge** under
   **Add‑on Modules** in your world.

---

## ⚙️ Configuration

After installation, enable the module in your world and configure it via **Settings** → **Configure Settings** → **Module Settings** → **Fate's Edge Bridge**.

### Connection Settings

| Setting | Description |
|---------|-------------|
| **Server URL** | The WebSocket URL of your Fate's Edge server (e.g., `ws://localhost:10000` or `wss://your-server.com`). |
| **Room Code** | The room code to join (e.g., `AC12`). |
| **API Key** | (Optional) API key for authentication if your server requires it. |
| **Player Name** | Your display name in the VTT (defaults to your Foundry username). |
| **Default Region** | Default region for deck draws. |
| **Auto Connect** | Automatically connect when Foundry loads. |

### Synchronization Settings

| Setting | Description |
|---------|-------------|
| **Sync Chat** | Mirror ordinary (non-whisper) Foundry chat messages to the VTT. |
| **Sync Dice Rolls** | Send Foundry dice rolls to the VTT. |
| **Sync Characters** | Synchronize characters with the VTT as journal entries. |
| **Sync Timers** | Reserved for a future scene/campaign timer integration — this toggle is currently registered but not yet wired to any behavior. |
| **Sync Scenes** | Broadcast the active scene's name to the VTT whenever it changes (one-way notification only, doesn't affect the room whiteboard). |
| **Sync Deck** | Synchronize Deck of Consequences draws with the VTT. |

### GM Features

| Setting | Description |
|---------|-------------|
| **Enable GM Management Features** | Toggle the GM election/promotion UI and functionality. |

---

## 🎮 Usage

### Connecting

- Enable **Auto Connect** and reload Foundry, or run the `connectFatesEdge()` macro (see [Macros Reference](#-macros-reference)) — or just click the status indicator itself, which toggles connect/disconnect.
- A status bar element will appear in the top‑left corner showing connection status, deck count, voice status, current region, and a **GM** button.

### Status Bar Controls

| Element | Function |
|---------|----------|
| **Status indicator** | Displays `🟢 Connected` / `🔴 Disconnected`. Click to toggle connection. |
| **Deck counter** | Shows remaining cards in the deck. Click to refresh. |
| **Voice indicator** | Shows voice status (currently visual only). |
| **Region display** | Shows the current default region. |
| **GM button** (👑) | Opens the GM Management panel (see below). |

### GM Management Panel

Click the **GM** button in the status bar to open the panel. This panel displays:

- **Current GM** name and your role badge (`You are GM` or `Player`).
- **Request GM** button (if you are a player) or **Resign GM** button (if you are the GM – note: resigning requires approving a pending request or using the `/vtt gm approve` command in Discord).
- **Pending Requests** list (visible only to the current GM) with **Approve** / **Reject** buttons.
- **Clients List** showing all connected clients and their roles (e.g., `GM`, `Player`). If you're the GM, every non-GM row also has a role dropdown (Co-GM / Assistant GM / Player / Spectator), a "save" checkbox to persist the grant across reconnects, and a **Set** button. "Assistant GM" is typically assigned to the AI GM Bot's own client — see the `fates-edge-ai-gm-bot` repo's README ("Assistant GM Mode") for what changes once it holds that role. The server has final say (GM-only, checked against your own connection), same as everything else in this panel.

### Sending Actions from Foundry

#### Chat Messages
Send a chat message normally in Foundry; it will be mirrored to the VTT (if `Sync Chat` is enabled).

#### Dice Rolls
Roll dice using Foundry's dice system; the result will be sent to the VTT (if `Sync Rolls` is enabled).

#### Deck Operations (Macros)
Use these macros to interact with the Deck of Consequences:

```javascript
// Draw 1 card from the default region
drawCard(1);

// Draw 3 cards from a specific region
drawCard(3, 'Vhasia');

// Perform a Crown Spread
crownSpread();

// Shuffle the deck
shuffleDeck();

// Set the default region
setRegion('Acasia');

// List loaded modules
listModules();

// Get deck status (returns remaining cards and history count)
getDeckStatus();
```

> **Server API note (v4.16.0):** the socket server added `POST /api/rooms/:code/adventure/climax-forced` (a sibling of the existing `climax-triggered` route, broadcasting `adventure-climax-forced` when the AI GM director forces a stalled climax forward), and the adventure state (`GET /api/rooms/:code/adventure`, and the `adventure-state`/`adventure-loaded` broadcasts this bridge already handles) now also reports `climaxPadScenes`, `climaxScenesSinceTrigger`, and `climaxForced`. The GM-only `adventure/reference` payload (`_handleAdventureReference`) now also carries an optional `persistence` block (the "Legacy Tracker" schema declaration). This bridge doesn't expose any adventure-specific macros today, so no code change is needed — the new fields simply ride along in `this.adventureState`/`Hooks.call('fates-edge-adventure-state', ...)` for anything downstream that wants them.

> **Server API note (v4.16.0):** each room's deck now shuffles with its own seedable RNG instead of a shared unseeded one, so draws are reproducible per room via two new REST routes, `GET`/`POST /api/rooms/:code/deck/seed`. The existing `deck-shuffled` broadcast this bridge already listens for (`_handleDeckShuffled`) now also fires with `reason: 'reseeded'` when a room is explicitly reseeded — no code change needed here since that handler already renders any `deck-shuffled` event generically. Neither seed route has a macro yet.

#### Character & Scene Sync
- **Characters**: automatic — whenever combat/character sheet data changes, if **Sync Characters** is enabled, characters are synced to the VTT as journal entries.
- **Scene**: automatic — whenever you change the active scene, if **Sync Scenes** is enabled, the new scene's name is broadcast to the VTT. There's no separate manual button for either of these; toggle the corresponding setting to turn the behavior on or off.

---

## 🔧 Macros Reference

| Function | Description |
|----------|-------------|
| `connectFatesEdge()` | Connect to the configured Fate's Edge server. |
| `disconnectFatesEdge()` | Disconnect from the server. |
| `drawCard(count, region)` | Draw `count` cards (1–5) from the specified region (or default). |
| `crownSpread(region)` | Perform a Crown Spread reading from the given region (or default). |
| `shuffleDeck()` | Shuffle the deck. |
| `setRegion(region)` | Change the default region. |
| `listModules()` | Request the list of loaded modules from the VTT server. |
| `getDeckStatus()` | Returns an object with `remaining` and `history` length. |
| `requestGM()` | Send a GM request to the server. |
| `approveGM(targetId)` | Approve a GM request (GM only). |
| `getGMStatus()` | Returns an object with `currentGM`, `isGM`, `pendingRequests`, and `clients` count. |

All of the above are also available as `FatesEdgeBridge.<methodName>(...)` directly (e.g. `FatesEdgeBridge.connect()`), which the short `window.*` names above just wrap.

---

## 🐛 Troubleshooting

### Connection Failed
- Verify the **Server URL** and **Room Code** are correct.
- Ensure the Fate's Edge server is running and reachable.
- Check firewall/network settings (try `ws://` vs `wss://`).

### Messages Not Syncing
- Ensure the corresponding sync setting is enabled.
- Verify the WebSocket connection is active (check status bar).
- Check the browser console for errors.

### GM Panel Not Showing
- Ensure **Enable GM Management Features** is enabled in settings.
- Reconnect to the server; the panel requires a connection to populate client data.

### Deck Draws Not Appearing
- Ensure **Sync Deck** is enabled.
- Check that the deck has remaining cards (status bar shows the count).

### Common Errors

| Error | Solution |
|-------|----------|
| `WebSocket connection failed` | Server not running or incorrect URL. |
| `Room not found` | Invalid room code – create a new room or check the code. |
| `Authentication failed` | Check API key configuration. |
| `Connection timed out` | Network issue or server overloaded. |

---

## 🔄 Updating

```bash
cd fates-edge-apps && git pull
```

Then re-copy `utilities/vtt_mods_bots/foundry_fates-edge-bridge/` over
`Data/modules/fates-edge-bridge/`, overwriting existing files.

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License – see the monorepo root's
[LICENSE.code](../../../LICENSE.code) for details.

---

## 🏗️ Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────────┐
│  Foundry VTT    │◄──────────────────►│  Fate's Edge        │
│  (Module)       │                     │  WebSocket Server   │
└─────────────────┘                     └─────────────────────┘
         │                                         │
         │                                         │
         ▼                                         ▼
┌─────────────────┐                     ┌─────────────────────┐
│  Foundry Users  │                     │  VTT Clients        │
│  & Game Data    │                     │  (Browser, Mobile)  │
└─────────────────┘                     └─────────────────────┘
```

---

## 📚 Documentation

- [Fate's Edge Server](../../javascript/fates-edge-socket-server/README.md)
- [Foundry VTT Wiki](https://foundryvtt.wiki)

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/Chronophage-net/fates-edge-apps/issues)
- **Email**: support@fates-edge.com

---

## ✨ Credits

- **Foundry VTT** – The incredible virtual tabletop platform.
- **Fate's Edge Team** – The amazing team behind Fate's Edge.

---

<p align="center">
  <sub>Made with ❤️ by Nick Gasper</sub>
</p>