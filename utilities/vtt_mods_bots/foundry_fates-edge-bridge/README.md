# Fate's Edge Bridge - Foundry VTT Module

<p align="center">
  <img src="https://img.shields.io/badge/Foundry-VTT-orange" alt="Foundry VTT"/>
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
  <img src="https://img.shields.io/badge/status-stable-brightgreen" alt="Status"/>
</p>

**Fate's Edge Bridge** connects your Foundry VTT instance to the Fate's Edge WebSocket server, enabling real-time synchronization of chat, dice rolls, characters, timers, and VTT state between Foundry and other connected clients.

---

## ✨ Features

- **🔌 Real-time Connection** - Persistent WebSocket connection to the Fate's Edge server
- **💬 Chat Sync** - Bidirectional chat message synchronization
- **🎲 Dice Roll Sync** - Share dice rolls between Foundry and VTT clients
- **👥 Character Sync** - Synchronize character data (Harm, Fatigue, Boons, Tier)
- **⏱️ Timer Sync** - Share scene timers visible to all connected clients
- **🎬 Scene Sync** - Switch Foundry scenes remotely from the VTT
- **🎤 Voice Integration** - Voice status indicators and client presence
- **🔄 Auto-Reconnect** - Automatically reconnects if the connection drops
- **🔐 Secure** - API key authentication support

---

## 📋 Requirements

- Foundry VTT v11 or higher
- Fate's Edge WebSocket Server running and accessible
- Node.js (for the server, not required for Foundry)

---

## 🚀 Installation

### Method 1: Install from Manifest URL

1. In Foundry VTT, go to **Add-on Modules** → **Install Module**
2. Paste this manifest URL:
   ```
   https://github.com/fates-edge/foundry-bridge/releases/latest/download/module.json
   ```
3. Click **Install**

### Method 2: Manual Installation

1. Download the module from the [releases page](https://github.com/fates-edge/foundry-bridge/releases)
2. Extract the zip file into your Foundry `Data/modules/` directory
3. The folder structure should be: `Data/modules/fates-edge-bridge/`

---

## ⚙️ Configuration

### Server Setup

First, you need a Fate's Edge WebSocket server running. See the [Server Documentation](https://github.com/fates-edge/fates-edge-server) for setup instructions.

### Foundry Settings

1. Enable the **Fate's Edge Bridge** module in your world
2. Go to **Settings** → **Configure Settings** → **Module Settings** → **Fate's Edge Bridge**
3. Configure the following:

| Setting | Description |
|---------|-------------|
| **Server URL** | The WebSocket URL of your server (e.g., `ws://localhost:3000`) |
| **Room Code** | The room code to join (e.g., `ABC123`) |
| **Player Name** | Your display name (defaults to your Foundry username) |
| **Auto-Connect** | Automatically connect when Foundry loads |
| **Sync Foundry Chat** | Send Foundry chat messages to the VTT |
| **Sync Foundry Rolls** | Send Foundry dice rolls to the VTT |
| **Sync Foundry Actors** | Experimental - sync selected actors to the VTT |

---

## 🎮 Usage

### Connecting

1. Click **Connect Now** in the module settings, or
2. Enable **Auto-Connect** and reload Foundry

### Sending Chat Messages

```javascript
// From a macro or console
FatesEdgeBridge.sendChatMessage("Hello, VTT clients!");
```

### Rolling Dice

```javascript
// From a macro or console
FatesEdgeBridge.sendRoll("3d6+2", "Attack roll");
```

### Syncing Characters

**From Foundry:**

1. Select tokens on the canvas
2. Run this macro:

```javascript
const actors = canvas.tokens.controlled.map(t => t.actor);
const chars = actors.map(a => ({
    name: a.name,
    harm: 0,
    fatigue: 0,
    boons: 0,
    tier: a.system?.tier || 1
}));
FatesEdgeBridge.syncCharacters(chars);
```

### Syncing Scenes

```javascript
// Sync the current scene to VTT
FatesEdgeBridge.syncVttState({
    scene: { name: game.scenes.current.name }
});
```

---

## 🔧 Macro Examples

### Send Chat Message with Prompt

```javascript
const text = await Dialog.prompt({
    title: "Send to VTT",
    content: `<input type="text" id="chat-input" placeholder="Message..." />`,
    label: "Send",
    callback: (html) => html.find('#chat-input').val()
});
FatesEdgeBridge.sendChatMessage(text);
```

### Roll Custom Dice

```javascript
const expr = await Dialog.prompt({
    title: "Roll Dice",
    content: `
        <input type="text" id="roll-input" placeholder="3d6+2" value="3d6" />
        <input type="text" id="reason-input" placeholder="Reason..." value="Attack" />
    `,
    label: "Roll",
    callback: (html) => ({
        roll: html.find('#roll-input').val(),
        reason: html.find('#reason-input').val()
    })
});
FatesEdgeBridge.sendRoll(expr.roll, expr.reason);
```

### Sync All Actors from a Scene

```javascript
const actors = canvas.scene.tokens.map(t => t.actor).filter(a => a);
const chars = actors.map(a => ({
    name: a.name,
    harm: a.system?.attributes?.harm || 0,
    fatigue: a.system?.attributes?.fatigue || 0,
    boons: a.system?.attributes?.boons || 0,
    tier: a.system?.tier || 1
}));
FatesEdgeBridge.syncCharacters(chars);
ui.notifications.info(`Synced ${chars.length} characters`);
```

### Toggle Voice Status

```javascript
const status = game.settings.get('fates-edge-bridge', 'voiceStatus') || false;
FatesEdgeBridge.setVoiceStatus(!status);
```

---

## 📊 API Reference

### FatesEdgeBridge Object

| Method | Description |
|--------|-------------|
| `connect()` | Connect to the WebSocket server |
| `disconnect()` | Disconnect from the server |
| `sendChatMessage(text, sender)` | Send a chat message |
| `sendRoll(expr, reason)` | Send a dice roll |
| `syncVttState(state)` | Sync VTT state |
| `syncCharacters(characters)` | Sync character data |
| `syncTimers(timers)` | Sync timer data |

### Events

| Event | Description |
|-------|-------------|
| `fates-edge-bridge-settings-changed` | Fired when settings change |
| `state-updated` | Fired when VTT state updates |
| `chat-message` | Fired when a chat message arrives |
| `roll-result` | Fired when a roll result arrives |
| `vtt-characters-updated` | Fired when characters update |
| `vtt-timers-updated` | Fired when timers update |

---

## 🐛 Troubleshooting

### Connection Failed
- Verify the server URL is correct
- Ensure the server is running
- Check the room code is valid
- Verify network connectivity

### Messages Not Syncing
- Check **Sync Foundry Chat** setting is enabled
- Verify the WebSocket connection is active
- Check the browser console for errors

### Characters Not Updating
- Ensure actors are selected before syncing
- Verify the character data format
- Check **Sync Foundry Actors** setting is enabled

### Common Errors

| Error | Solution |
|-------|----------|
| `WebSocket connection failed` | Server not running or incorrect URL |
| `Room not found` | Invalid room code - create a new room |
| `Authentication failed` | Check API key configuration |
| `Connection timed out` | Network issue or server overloaded |

---

## 🔄 Updating

### From Manifest
1. In Foundry VTT, go to **Add-on Modules**
2. Click **Check for Updates**
3. Click **Update** next to Fate's Edge Bridge

### Manual Update
1. Download the latest release
2. Extract to your `Data/modules/fates-edge-bridge/` folder
3. Overwrite existing files

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

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

- **Foundry VTT** - The incredible virtual tabletop platform
- **Fate's Edge Team** - The amazing team behind Fate's Edge

---

<p align="center">
  <sub>Made with ❤️ by the Fate's Edge Team</sub>
</p>
