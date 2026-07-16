# Fate's Edge Bridge – Foundry VTT Module

<p align="center">
  <img src="https://img.shields.io/badge/Foundry-VTT-orange" alt="Foundry VTT"/>
  <img src="https://img.shields.io/badge/version-1.3.0-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
  <img src="https://img.shields.io/badge/status-stable-brightgreen" alt="Status"/>
</p>

**Fate's Edge Bridge** connects your Foundry VTT instance to the Fate's Edge WebSocket server, enabling real‑time synchronization of chat, dice rolls, characters, timers, scenes, the Deck of Consequences, Crown Spread readings, modules, and **Game Master election/promotion** between Foundry and other connected VTT clients.

---

## ✨ Features

- **🔌 Real‑time Connection** – Persistent WebSocket connection to the Fate's Edge server.
- **💬 Chat Sync** – Bidirectional chat message exchange between Foundry and VTT.
- **🎲 Dice Roll Sync** – Send dice rolls from Foundry to VTT clients.
- **👥 Character Sync** – Synchronize character data (Harm, Fatigue, Boons, Tier) as journal entries.
- **⏱️ Timer Sync** – Share scene timers visible to all connected clients.
- **🎬 Scene Sync** – Switch Foundry scenes remotely from the VTT.
- **🃏 Deck Operations** – Draw cards, shuffle, and perform Crown Spread readings, all displayed as Foundry chat messages and journal entries.
- **📦 Module Management** – List, push, and clean up VTT modules from Foundry.
- **👑 GM Election & Promotion** – Request GM status, approve/reject requests, view client lists and roles directly from the Foundry UI.
- **🔄 Auto‑Reconnect** – Automatically reconnects if the connection drops.
- **🔐 Secure** – API key authentication and configurable permissions.

---

## 📋 Requirements

- Foundry VTT v11 or higher (tested with v12)
- Fate's Edge WebSocket Server running and accessible
- (Recommended) A stable internet connection for WebSocket communication

---

## 🚀 Installation

### Method 1: Install from Manifest URL

1. In Foundry VTT, go to **Add‑on Modules** → **Install Module**.
2. Paste this manifest URL:
   ```
   https://github.com/fates-edge/foundry-bridge/releases/latest/download/module.json
   ```
3. Click **Install**.

### Method 2: Manual Installation

1. Download the latest release from the [releases page](https://github.com/fates-edge/foundry-bridge/releases).
2. Extract the zip file into your Foundry `Data/modules/` directory.
3. The folder structure should be: `Data/modules/fates-edge-bridge/`.

---

## ⚙️ Configuration

After installation, enable the module in your world and configure it via **Settings** → **Configure Settings** → **Module Settings** → **Fate's Edge Bridge**.

### Connection Settings

| Setting | Description |
|---------|-------------|
| **Server URL** | The WebSocket URL of your Fate's Edge server (e.g., `ws://localhost:3000` or `wss://your-server.com`). |
| **Room Code** | The room code to join (e.g., `ABC123`). |
| **API Key** | (Optional) API key for authentication if your server requires it. |
| **Player Name** | Your display name in the VTT (defaults to your Foundry username). |
| **Default Region** | Default region for deck draws. |
| **Auto Connect** | Automatically connect when Foundry loads. |

### Synchronization Settings

| Setting | Description |
|---------|-------------|
| **Sync Chat** | Send Foundry chat messages to the VTT. |
| **Sync Dice Rolls** | Send Foundry dice rolls to the VTT. |
| **Sync Characters** | Synchronize characters with the VTT as journal entries. |
| **Sync Timers** | Share scene timers with the VTT. |
| **Sync Scenes** | Broadcast scene changes to the VTT. |
| **Sync Deck** | Synchronize Deck of Consequences draws with the VTT. |

### GM Features

| Setting | Description |
|---------|-------------|
| **Enable GM Management Features** | Toggle the GM election/promotion UI and functionality. |

---

## 🎮 Usage

### Connecting

- Click **Connect Now** in the module settings, or enable **Auto Connect** and reload Foundry.
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
- **Clients List** showing all connected clients and their roles (e.g., `GM`, `Player`).

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

#### Character & Scene Sync
- **Sync Selected Actors**: In the module settings, click **Sync Selected Actors to VTT** to send all currently selected Foundry actors as character journal entries.
- **Sync Current Scene**: Click **Sync Current Scene** to broadcast the active scene name to the VTT.

---

## 🔧 Macros Reference

| Function | Description |
|----------|-------------|
| `drawCard(count, region)` | Draw `count` cards (1–5) from the specified region (or default). |
| `crownSpread(region)` | Perform a Crown Spread reading from the given region (or default). |
| `shuffleDeck()` | Shuffle the deck. |
| `setRegion(region)` | Change the default region. |
| `listModules()` | Request the list of loaded modules from the VTT server. |
| `getDeckStatus()` | Returns an object with `remaining` and `history` length. |
| `requestGM()` | Send a GM request to the server. |
| `approveGM(targetId)` | Approve a GM request (GM only). |
| `getGMStatus()` | Returns an object with `currentGM`, `isGM`, `pendingRequests`, and `clients` count. |

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

### From Manifest
1. In Foundry VTT, go to **Add‑on Modules**.
2. Click **Check for Updates**.
3. Click **Update** next to Fate's Edge Bridge.

### Manual Update
1. Download the latest release.
2. Extract to `Data/modules/fates-edge-bridge/`, overwriting existing files.

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

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

- [Fate's Edge Server](https://github.com/fates-edge/fates-edge-server)
- [API Documentation](https://fates-edge.com/api/docs)
- [Foundry VTT Wiki](https://foundryvtt.wiki)

---

## 💬 Support

- **Discord**: [Join our Discord](https://discord.gg/fates-edge)
- **Issues**: [GitHub Issues](https://github.com/fates-edge/foundry-bridge/issues)
- **Email**: support@fates-edge.com

---

## ✨ Credits

- **Foundry VTT** – The incredible virtual tabletop platform.
- **Fate's Edge Team** – The amazing team behind Fate's Edge.

---

<p align="center">
  <sub>Made with ❤️ by the Fate's Edge Team</sub>
</p>