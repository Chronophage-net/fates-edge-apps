```markdown
# Fate's Edge Discord Bot

<p align="center">
  <img src="https://img.shields.io/badge/Discord-Bot-blue" alt="Discord Bot"/>
  <img src="https://img.shields.io/badge/version-2.0.0-orange" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
  <img src="https://img.shields.io/badge/node-18+-brightgreen" alt="Node.js"/>
</p>

**Fate's Edge Discord Bot** bridges your Discord server with the Fate's Edge VTT WebSocket server, enabling real‑time interaction between Discord users and your VTT sessions. It now includes **Game Master election and promotion** features, plus an **Avrae module** for seamless integration with Avrae D&D bots.

---

## ✨ Features

- 🔌 **VTT Connection Management** – Connect, disconnect, and monitor VTT server status.
- 💬 **Chat Relay** – Send messages between Discord and VTT clients.
- 🎲 **Dice Rolling** – Roll dice in Discord and optionally broadcast to VTT.
- 👥 **Character Management** – Create, update, and list VTT characters.
- ⏱️ **Timer Management** – Create, tick, and track VTT timers.
- 🃏 **Deck Operations** – Draw cards, shuffle, perform Crown Spread readings.
- 📦 **Module Management** – List, push, and clean up VTT modules.
- 👑 **GM Election & Promotion** – Request GM status, approve/reject requests, view GM status and client lists (via `/vtt gm` subcommands).
- 🤖 **Avrae Integration** – Use Fate's Edge commands directly within Avrae (see [Avrae Module](#-avrae-module)).
- 🌐 **Webhook Support** – External services can trigger Discord messages.
- 🔐 **Admin Commands** – Broadcast messages, force sync, view stats.
- 📊 **Rich Embeds** – Beautiful Discord embed messages for all commands.

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
VTT_LOG_CHANNEL=123456789012345678  # Channel for GM notifications

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
| `/vtt region <region>` | Set default region for deck draws | `/vtt region Acasia` |
| `/vtt modules` | List loaded modules | `/vtt modules` |

### GM Management (subgroup `/vtt gm`)

| Command | Description | Example |
|---------|-------------|---------|
| `/vtt gm request` | Request to become Game Master | `/vtt gm request` |
| `/vtt gm approve <player>` | Approve a pending GM request (GM only) | `/vtt gm approve "PlayerName"` |
| `/vtt gm status` | Show current GM and pending requests | `/vtt gm status` |
| `/vtt gm list` | List all connected clients with their roles | `/vtt gm list` |

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

### Deck Operations

| Command | Description | Example |
|---------|-------------|---------|
| `/vttdeck draw <count> [region]` | Draw cards from deck | `/vttdeck draw 3 Acasia` |
| `/vttdeck crown [region]` | Perform Crown Spread | `/vttdeck crown Acasia` |
| `/vttdeck shuffle` | Shuffle the deck | `/vttdeck shuffle` |
| `/vttdeck history` | Show deck history | `/vttdeck history` |
| `/vttdeck clear-history` | Clear deck history | `/vttdeck clear-history` |

### Module Management

| Command | Description | Example |
|---------|-------------|---------|
| `/vttmodules list` | List loaded modules | `/vttmodules list` |
| `/vttmodules push <moduleId>` | Push a module to clients | `/vttmodules push "my-module"` |
| `/vttmodules cleanup <moduleId>` | Clean up a module | `/vttmodules cleanup "my-module"` |

### Admin Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/vttadmin broadcast <message>` | Broadcast message to all VTT clients | `/vttadmin broadcast "Break time!"` |
| `/vttadmin sync` | Force sync all state | `/vttadmin sync` |
| `/vttadmin stats` | Show bot statistics | `/vttadmin stats` |

---

## 🤖 Avrae Module

The bot includes an **Avrae module** (`avrae.txt`) that allows you to run Fate's Edge commands directly from **Avrae**, the popular D&D bot for Discord. This module leverages Avrae’s alias system to call the Fate's Edge WebSocket API via HTTP requests.

### Installation (Avrae)

1. Copy the contents of `avrae.txt` (provided in the repository).
2. In Discord, type `!alias create fe <paste-content>` (or use the Avrae dashboard).
3. The alias `!fe` will be created with subcommands for deck draws, Crown Spread, GM management, and more.

### Available Avrae Commands

| Command | Description |
|---------|-------------|
| `!fe draw [count] [region]` | Draw cards (1–5) from a region. |
| `!fe crown [region]` | Perform a Crown Spread reading. |
| `!fe gm request` | Request to become GM. |
| `!fe gm status` | Show current GM and pending requests. |
| `!fe gm approve <player>` | Approve a GM request (GM only). |
| `!fe region [name]` | Get or set the default region. |
| `!fe help` | Show help text. |

> **Note:** The Avrae module requires the Fate's Edge server's REST API to be accessible and the bot's webhook server to relay events if needed. See the `avrae.txt` file for full implementation details and configuration.

---

## 🌐 Webhook Integration

The bot includes an Express webhook server for external services to send messages to Discord.

### Webhook Endpoint

```
POST /webhook
Headers: x-webhook-secret: your-webhook-secret
Body: {
  "event": "vtt-roll" | "vtt-chat" | "vtt-deck-draw" | "vtt-gm-update",
  "data": { ... }
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
│  (Slash cmds)   │                     │  (Foundry/Roll20)   │
└─────────────────┘                     └─────────────────────┘
         │                                         │
         │                                         │
         ▼                                         ▼
┌─────────────────┐                     ┌─────────────────────┐
│  Avrae Users    │                     │  Webhook            │
│  (!fe commands) │                     │  Server (optional)  │
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

### GM Approval Not Working

- The user must first send a GM request (`/vtt gm request`).
- Only the current GM can approve.
- Use `/vtt gm list` to see all clients and their roles.

### Notifications Not Sending (GM events)

- Set `VTT_LOG_CHANNEL` to a valid Discord channel ID.
- Ensure the bot has permission to send messages in that channel.
- Verify the bot is connected to the VTT server.

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

MIT License – see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing`).
3. Commit changes (`git commit -m 'Add amazing feature'`).
4. Push to branch (`git push origin feature/amazing`).
5. Open a Pull Request.

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
├── avrae.txt               # Avrae module alias
├── commands/               # Slash commands
│   ├── vtt.js              # VTT connection + GM commands
│   ├── dice.js             # Dice rolling
│   ├── chat.js             # Chat relay
│   ├── character.js        # Character management
│   ├── timer.js            # Timer management
│   ├── vttdeck.js          # Deck operations
│   ├── vttmodules.js       # Module management
│   └── admin.js            # Admin commands
├── utils/                  # Utilities
│   ├── websocket.js        # WebSocket client (with GM support)
│   ├── logger.js           # Logging
│   └── config.js           # Configuration
└── events/                 # Discord events
    ├── ready.js            # Ready handler (GM notifications)
    ├── messageCreate.js    # Message handler
    └── interactionCreate.js # Interaction handler
```

### Adding New Commands

1. Create `commands/yourcommand.js`.
2. Use `SlashCommandBuilder` for command definition.
3. Export `data` and `execute(interaction, client)`.
4. Command auto-loads on restart.

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
```