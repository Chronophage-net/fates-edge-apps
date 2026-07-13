# Fate's Edge Discord Bot

<p align="center">
  <img src="https://img.shields.io/badge/Discord-Bot-blue" alt="Discord Bot"/>
  <img src="https://img.shields.io/badge/version-1.0.0-orange" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
  <img src="https://img.shields.io/badge/node-18+-brightgreen" alt="Node.js"/>
</p>

**Fate's Edge Discord Bot** bridges your Discord server with the Fate's Edge VTT WebSocket server, enabling real-time interaction between Discord users and your VTT sessions.

---

## ✨ Features

- 🔌 **VTT Connection Management** - Connect, disconnect, and monitor VTT server status
- 💬 **Chat Relay** - Send messages between Discord and VTT clients
- 🎲 **Dice Rolling** - Roll dice in Discord and optionally broadcast to VTT
- 👥 **Character Management** - Create, update, and list VTT characters
- ⏱️ **Timer Management** - Create, tick, and track VTT timers
- 🔐 **Admin Commands** - Broadcast messages, force sync, view stats
- 🌐 **Webhook Support** - External services can trigger Discord messages
- 📊 **Rich Embeds** - Beautiful Discord embed messages for all commands

---

## 📋 Requirements

- Node.js 18 or higher
- Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
- Fate's Edge VTT WebSocket Server running and accessible
- Discord Server with bot permissions

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/fates-edge/discord-bot.git
cd discord-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Discord Bot Configuration
DISCORD_TOKEN=YOUR_BOT_TOKEN
DISCORD_CLIENT_ID=YOUR_CLIENT_ID
DISCORD_GUILD_ID=YOUR_GUILD_ID  # Optional, for dev

# Fate's Edge VTT Server
VTT_SERVER_URL=ws://localhost:3000
VTT_API_KEY=your-api-key
VTT_ROOM_CODE=ABC123
VTT_AUTO_CONNECT=true

# Bot Settings
PREFIX=!
ACTIVITY_TYPE=PLAYING
ACTIVITY_NAME=Fate's Edge VTT
LOG_LEVEL=info

# Webhook Server (Optional)
WEBHOOK_PORT=3001
WEBHOOK_SECRET=your-webhook-secret
```

### 3. Register Slash Commands

```bash
npm run register
```

### 4. Start the Bot

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

---

## 🔧 Discord Bot Setup

### Creating a Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and name it "Fate's Edge Bot"
3. Go to the **Bot** tab
4. Click **Add Bot**
5. Under **Token**, click **Copy** (save this for `.env`)
6. Enable **Message Content Intent** and **Server Members Intent**

### Inviting the Bot

1. Go to the **OAuth2** → **URL Generator** tab
2. Under **Scopes**, select `bot` and `applications.commands`
3. Under **Bot Permissions**, select:
   - Send Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Use Slash Commands
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

---

## 📊 Command Reference

### VTT Management

| Command | Description | Example |
|---------|-------------|---------|
| `/vtt connect [room]` | Connect to VTT server | `/vtt connect ABC123` |
| `/vtt disconnect` | Disconnect from VTT server | `/vtt disconnect` |
| `/vtt status` | Show connection status | `/vtt status` |
| `/vtt info` | Show room info and clients | `/vtt info` |

### Dice Rolling

| Command | Description | Example |
|---------|-------------|---------|
| `/roll <dice> [reason] [vtt:true]` | Roll dice and optionally send to VTT | `/roll 3d6+2 "Attack" vtt:true` |

### Chat Relay

| Command | Description | Example |
|---------|-------------|---------|
| `/vttchat <message> [sender]` | Send message to VTT chat | `/vttchat "Hello VTT!" "GM"` |

### Character Management

| Command | Description | Example |
|---------|-------------|---------|
| `/vttchar list` | List all VTT characters | `/vttchar list` |
| `/vttchar add <name> [harm] [fatigue] [boons] [tier]` | Add character | `/vttchar add "Aria" harm:2 fatigue:1 boons:3 tier:3` |
| `/vttchar update <name> [harm] [fatigue] [boons] [tier]` | Update character | `/vttchar update "Aria" harm:3` |
| `/vttchar remove <name>` | Remove character | `/vttchar remove "Aria"` |

### Timer Management

| Command | Description | Example |
|---------|-------------|---------|
| `/vtttimer create <name> <segments>` | Create a new timer | `/vtttimer create "Ritual" 6` |
| `/vtttimer tick <name> [amount]` | Tick a timer forward | `/vtttimer tick "Ritual" 2` |
| `/vtttimer list` | List all active timers | `/vtttimer list` |
| `/vtttimer remove <name>` | Remove a timer | `/vtttimer remove "Ritual"` |
| `/vtttimer reset <name>` | Reset a timer to 0 | `/vtttimer reset "Ritual"` |

### Admin Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/vttadmin broadcast <message>` | Broadcast message to all VTT clients | `/vttadmin broadcast "Break time!"` |
| `/vttadmin sync` | Force sync all state | `/vttadmin sync` |
| `/vttadmin stats` | Show bot statistics | `/vttadmin stats` |

---

## 🌐 Webhook Integration

The bot includes an Express webhook server for external services to send messages to Discord.

### Webhook Endpoint

```
POST /webhook
Headers: x-webhook-secret: your-webhook-secret
Body: {
  "event": "vtt-roll" | "vtt-chat",
  "data": {
    "channelId": "DISCORD_CHANNEL_ID",
    "sender": "Player Name",
    "roll": "3d6+2",
    "result": "15",
    "message": "Hello!"
  }
}
```

### Example Webhook Usage

```bash
curl -X POST http://localhost:3001/webhook \
  -H "x-webhook-secret: your-webhook-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "vtt-roll",
    "data": {
      "channelId": "1234567890",
      "sender": "Aria",
      "roll": "3d6+2",
      "result": "15"
    }
  }'
```

---

## 🏗️ Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────────┐
│  Discord Bot    │◄──────────────────►│  Fate's Edge        │
│  (Commands)     │                     │  WebSocket Server   │
└─────────────────┘                     └─────────────────────┘
         │                                         │
         │                                         │
         ▼                                         ▼
┌─────────────────┐                     ┌─────────────────────┐
│  Discord Users  │                     │  VTT Clients        │
│  (Slash Commands)│                     │  (Foundry/Roll20/Web)│
└─────────────────┘                     └─────────────────────┘
         │                                         │
         │                                         │
         ▼                                         ▼
┌─────────────────┐                     ┌─────────────────────┐
│  Webhook        │                     │  Webhook            │
│  Server         │                     │  Server             │
└─────────────────┘                     └─────────────────────┘
```

---

## 🐛 Troubleshooting

### Bot Not Connecting

| Issue | Solution |
|-------|----------|
| Invalid token | Check `DISCORD_TOKEN` in `.env` |
| Missing intents | Enable Message Content Intent in Discord Developer Portal |
| Gateway connection | Check network connectivity and Discord status |

### VTT Connection Failed

| Issue | Solution |
|-------|----------|
| Server offline | Start the VTT WebSocket server |
| Wrong URL | Check `VTT_SERVER_URL` in `.env` |
| Invalid room | Check `VTT_ROOM_CODE` in `.env` |
| API key error | Check `VTT_API_KEY` in `.env` |

### Slash Commands Not Appearing

| Issue | Solution |
|-------|----------|
| Commands not registered | Run `npm run register` |
| Bot missing permissions | Re-invite bot with `applications.commands` scope |
| Cache | Wait 1 hour or re-invite bot |

### Permission Errors

The bot needs these permissions:
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Use Slash Commands

---

## 📝 Logs

Logs are stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

---

## 🔄 Updating

```bash
git pull
npm install
npm run register
pm2 restart fates-edge-bot  # If using PM2
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 💬 Support

- **Discord**: [Join our Discord](https://discord.gg/fates-edge)
- **Issues**: [GitHub Issues](https://github.com/fates-edge/discord-bot/issues)
- **Email**: support@fates-edge.com

---

## 🛠️ Development

### Project Structure

```
fates-edge-discord-bot/
├── index.js                # Main entry
├── package.json            # Dependencies
├── .env.example            # Environment template
├── commands/               # Slash commands
│   ├── vtt.js              # VTT connection commands
│   ├── dice.js             # Dice rolling commands
│   ├── chat.js             # Chat relay commands
│   ├── character.js        # Character management
│   ├── timer.js            # Timer management
│   └── admin.js            # Admin commands
├── utils/                  # Utilities
│   ├── websocket.js        # WebSocket client
│   ├── logger.js           # Logging
│   └── config.js           # Configuration
└── events/                 # Discord events
    ├── ready.js            # Ready handler
    ├── messageCreate.js    # Message handler
    └── interactionCreate.js # Interaction handler
```

### Adding New Commands

1. Create `commands/yourcommand.js`
2. Use `SlashCommandBuilder` for command definition
3. Export `data` and `execute(interaction, client)`
4. Command auto-loads on restart

Example:
```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('example')
        .setDescription('Example command'),
    async execute(interaction, client) {
        await interaction.reply('Hello!');
    }
};
```

---

<p align="center">
  <sub>Made with ❤️ by the Fate's Edge Team</sub>
</p>
