# Fate's Edge Roll20 Module

<p align="center">
  <img src="https://img.shields.io/badge/Roll20-API-blue" alt="Roll20 API"/>
  <img src="https://img.shields.io/badge/version-1.0.0-orange" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

**Fate's Edge Roll20** connects your Roll20 game to the Fate's Edge WebSocket server, enabling real-time synchronization of chat, dice rolls, characters, timers, and scenes.

---

## ✨ Features

- 🔌 **Real-time Connection** - WebSocket connection to Fate's Edge server
- 💬 **Chat Sync** - Bidirectional chat message synchronization
- 🎲 **Dice Roll Sync** - Share dice rolls between Roll20 and VTT clients
- 👥 **Character Sync** - Synchronize character data (Harm, Fatigue, Boons, Tier)
- ⏱️ **Timer Sync** - Share scene timers visible to all connected clients
- 🎬 **Scene Sync** - Switch Roll20 pages remotely from the VTT
- 🔐 **Secure** - API key authentication support

---

## 📋 Requirements

- Roll20 Game with Pro subscription (API access)
- Fate's Edge WebSocket Server running and accessible

---

## 🚀 Installation

### 1. Add the API Script

1. Go to your Roll20 Game
2. Click on **Settings** → **API Scripts**
3. Click **New Script**
4. Name it: `Fate's Edge Bridge`
5. Paste the contents of `api/fates-edge-api.js`
6. Click **Save Script**

### 2. Configure Environment Variables

In the Roll20 API console, add these variables:

```javascript
// Set these as global variables in the API
var FATES_EDGE_SERVER_URL = 'ws://your-server:3000';
var FATES_EDGE_ROOM_CODE = 'ABC123';
var FATES_EDGE_API_KEY = 'your-api-key-here';
var FATES_EDGE_AUTO_CONNECT = 'true';
var FATES_EDGE_SYNC_CHAT = 'true';
var FATES_EDGE_SYNC_ROLLS = 'true';
var FATES_EDGE_SYNC_CHARACTERS = 'true';
var FATES_EDGE_SYNC_TIMERS = 'true';
var FATES_EDGE_SYNC_SCENES = 'true';
var FATES_EDGE_PLAYER_NAME = 'GM Name';
```

### 3. (Optional) Install Character Sheet

1. In your Roll20 Game, go to **Settings** → **Game Settings**
2. Under **Character Sheet Template**, select **Custom**
3. Paste the HTML and CSS from `character-sheet/`
4. Click **Save Changes**

---

## 🎮 Usage

### Quick Commands

| Command | Description |
|---------|-------------|
| `!fates-edge connect` | Connect to server |
| `!fates-edge disconnect` | Disconnect from server |
| `!fates-edge status` | Show connection status |
| `!fates-edge send <message>` | Send chat message |
| `!fates-edge roll <dice>` | Roll dice |
| `!fates-edge sync characters` | Sync all characters |
| `!fates-edge sync scene` | Sync current scene |

### Macros

Create macros in Roll20 with the commands above.

---

## 🐛 Troubleshooting

### Connection Failed
- Verify server URL is correct
- Check room code is valid
- Ensure server is running
- Check API key is set

### Characters Not Syncing
- Ensure `FATES_EDGE_SYNC_CHARACTERS` is `true`
- Character must exist in Roll20 with matching name
- Check API console for errors

---

## 🔄 Updates

1. Go to **Settings** → **API Scripts**
2. Update the script content
3. Click **Save Script**

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details
