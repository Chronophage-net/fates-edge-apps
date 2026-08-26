# Fate's Edge Discord Bot

<p align="center">
  <img src="https://img.shields.io/badge/Discord-Bot-blue" alt="Discord Bot"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
  <img src="https://img.shields.io/badge/node-18+-brightgreen" alt="Node.js"/>
</p>

Bridges your Discord server with the Fate's Edge [socket server](../../javascript/fates-edge-socket-server/), so a table can play through Discord slash commands instead of (or alongside) the web client. Covers GM election and promotion, chat relay, dice, characters, timers, the Deck of Consequences, module management, and the Adventure Engine.

---

## Features

- **VTT connection management** — connect, disconnect, and monitor server status.
- **Chat relay** — messages flow between Discord and other connected VTT clients.
- **Dice rolling** — roll in Discord, optionally broadcast to the VTT.
- **Character management** — create, update, and list VTT characters.
- **Ad-hoc timer management** — create, tick, list, and remove real, server-synced timers, visible to every connected client (see the note under Timer Management below — these are separate from the server's own Adventure Engine timers).
- **Deck operations** — draw, shuffle, and Crown Spread readings.
- **Module management** — list, push, and clean up VTT adventure modules.
- **Adventure Engine** — load modules, advance scenes, run encounters, tick timers, and log narrative beats.
- **GM election & promotion** — request GM status, approve/reject requests, view roles and client lists.
- **Webhook support** — external services can trigger Discord messages.
- **Admin commands** — broadcast messages, force sync, view stats, moderate clients.
- **Rich embeds** for every command's output.

---

## Requirements

- Node.js 18 or higher
- A Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
- A Fate's Edge socket server, running and reachable
- A Discord server where you can install bots

---

## Quick start

This bot lives inside the `fates-edge-apps` monorepo, alongside the web client and socket server:

```bash
git clone https://github.com/Chronophage-net/fates-edge-apps.git
cd fates-edge-apps/utilities/vtt_mods_bots/fates-edge-discord-bot
npm install
cp .env.example .env
```

Edit `.env`:

```env
# Discord Bot Configuration
DISCORD_TOKEN=YOUR_BOT_TOKEN
DISCORD_CLIENT_ID=YOUR_CLIENT_ID
DISCORD_GUILD_ID=YOUR_GUILD_ID  # Optional, for dev

# Fate's Edge VTT Server
VTT_SERVER_URL=ws://localhost:10000
VTT_API_KEY=your-api-key
VTT_ROOM_CODE=AC12
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

```bash
npm run register   # register slash commands
npm start           # or `npm run dev` for auto-restart during development
```

### Docker

```bash
# from the fates-edge-apps repo root
cp .env.example .env   # fill in DISCORD_TOKEN
docker-compose --profile discord-bot up
```

A standalone `Dockerfile` is also included if you'd rather build just this bot in isolation.

---

## Discord bot setup

**Creating a bot token:** [Discord Developer Portal](https://discord.com/developers/applications) → New Application → Bot tab → Add Bot → copy the token for `.env`. Enable **Message Content Intent** and **Server Members Intent**.

**Inviting the bot:** OAuth2 → URL Generator → scopes `bot` and `applications.commands` → permissions Send Messages, Embed Links, Attach Files, Read Message History, Use Slash Commands → open the generated URL and authorize it for your server.

---

## Command reference

### VTT management

| Command | Description | Example |
|---|---|---|
| `/vtt connect [room]` | Connect to the VTT server | `/vtt connect AC12` |
| `/vtt disconnect` | Disconnect | `/vtt disconnect` |
| `/vtt status` | Show connection status | `/vtt status` |
| `/vtt info` | Show room info and clients | `/vtt info` |
| `/vtt region <region>` | Set default region for deck draws | `/vtt region Acasia` |
| `/vtt modules` | List loaded modules | `/vtt modules` |

### GM management (`/vtt gm`)

| Command | Description | Example |
|---|---|---|
| `/vtt gm request` | Request to become Game Master | `/vtt gm request` |
| `/vtt gm approve <player>` | Approve a pending GM request (GM only) | `/vtt gm approve "PlayerName"` |
| `/vtt gm status` | Show current GM and pending requests | `/vtt gm status` |
| `/vtt gm list` | List all connected clients with their roles | `/vtt gm list` |

### Dice & chat

| Command | Description | Example |
|---|---|---|
| `/roll <dice> [reason] [vtt:true]` | Roll dice and optionally send to VTT | `/roll 3d6+2 "Attack" vtt:true` |
| `/vttchat <message> [sender]` | Send a message to VTT chat | `/vttchat "Hello VTT!" "GM"` |

### Character management

| Command | Description | Example |
|---|---|---|
| `/vttchar list` | List all VTT characters | `/vttchar list` |
| `/vttchar add <name> [harm] [fatigue] [boons] [tier]` | Add character | `/vttchar add "Aria" harm:2 fatigue:1 boons:3 tier:3` |
| `/vttchar update <name> [harm] [fatigue] [boons] [tier]` | Update character | `/vttchar update "Aria" harm:3` |
| `/vttchar remove <name>` | Remove character | `/vttchar remove "Aria"` |

### Timer management

| Command | Description | Example |
|---|---|---|
| `/vtttimer create <name> <segments> [description]` | Create a new ad-hoc timer | `/vtttimer create "Ritual" 6` |
| `/vtttimer tick <name> [amount]` | Tick a timer forward (negative amounts tick it back) | `/vtttimer tick "Ritual" 2` |
| `/vtttimer list` | List all active ad-hoc timers | `/vtttimer list` |
| `/vtttimer remove <name>` | Remove a timer | `/vtttimer remove "Ritual"` |

These are GM/AI-improvised ad-hoc timers (`server/timers.js`), independent of any loaded adventure — distinct from the server's Adventure Engine timers (`/vttadventure timer`, tied to timers defined inside a loaded adventure module). Unlike the old bot-only tracker, they're real, shared, persistent room state: the bot calls the server and awaits its confirmation before replying, and every other connected client (web client, Foundry, Roll20, the AI GM) sees the same timers. There's no `reset` subcommand anymore — tick by a negative amount, or remove and recreate, to get the same effect.

### Adventure Engine

| Command | Description | Example |
|---|---|---|
| `/vttadventure load <moduleid>` | Load an adventure module | `/vttadventure load "the-hazel-root"` |
| `/vttadventure scene [actindex] [sceneindex]` | Advance the adventure (omit both to advance sequentially) | `/vttadventure scene actindex:1 sceneindex:0` |
| `/vttadventure encounter start <ref>` | Start an encounter by index or name | `/vttadventure encounter start "Bandit Ambush"` |
| `/vttadventure encounter resolve <outcome> [notes]` | Resolve the active encounter | `/vttadventure encounter resolve clean` |
| `/vttadventure timer <name> [amount] [scope]` | Tick a real Adventure Engine timer | `/vttadventure timer "Village Safety" amount:1` |
| `/vttadventure log <text> [author]` | Append a narrative beat to the adventure log | `/vttadventure log "The bridge collapses behind them."` |
| `/vttadventure status` | Show current adventure state | `/vttadventure status` |

The server also tracks climax pacing (how long a triggered climax act has run before a GM or the AI GM director forces it toward resolution) and a per-adventure-module "Legacy Tracker" persistence schema; neither has a dedicated slash command yet, so use `/vttadventure status`/`reference` for the raw state or drive them from the web client.

### Deck operations

| Command | Description | Example |
|---|---|---|
| `/vttdeck draw <count> [region]` | Draw cards from deck | `/vttdeck draw 3 Acasia` |
| `/vttdeck crown [region]` | Perform Crown Spread | `/vttdeck crown Acasia` |
| `/vttdeck shuffle` | Shuffle the deck | `/vttdeck shuffle` |
| `/vttdeck history` | Show deck history | `/vttdeck history` |

`/deck` (in `commands/dice.js`) is a near-duplicate of `/vttdeck` with the same subcommands under a shorter name — either works. Each room's deck shuffles with its own seedable RNG, so draws are reproducible per room via the server's `GET`/`POST /api/rooms/:code/deck/seed` routes; no slash command calls those yet.

### Module management

| Command | Description | Example |
|---|---|---|
| `/vtt modules` | List loaded modules | `/vtt modules` |
| `/vttadmin modules list` | List loaded modules (admin) | `/vttadmin modules list` |
| `/vttadmin modules push <module-id>` | Push a module to clients | `/vttadmin modules push "my-module"` |
| `/vttadmin modules cleanup <module-id>` | Clean up a module | `/vttadmin modules cleanup "my-module"` |

### Admin commands

| Command | Description | Example |
|---|---|---|
| `/vttadmin broadcast <message>` | Broadcast a message to all VTT clients | `/vttadmin broadcast "Break time!"` |
| `/vttadmin sync` | Force sync all state | `/vttadmin sync` |
| `/vttadmin stats` | Show bot statistics | `/vttadmin stats` |
| `/vttadmin players` | List players currently in the VTT room | `/vttadmin players` |
| `/vttadmin kick <target> [reason]` | Kick a player from the VTT room | `/vttadmin kick "Levi" "AFK too long"` |
| `/vttadmin ban <target> [reason]` | Ban a player | `/vttadmin ban "Levi"` |
| `/vttadmin unban <client-id>` | Unban a client by id | `/vttadmin unban ws-AC12` |
| `/vttadmin role <target> <role> [save]` | Change a player's role — Co-GM, Assistant GM, Player, or Spectator (server enforces GM-only; `save` persists a Co-GM/Assistant GM grant across reconnects, demotions always persist) | `/vttadmin role "AI_GM" assistant-gm save:True` |
| `/vttadmin soundsearch <query>` | Search Freesound for sounds (preview only — add the result from the web client's Soundboard panel; server needs `FREESOUND_API_KEY` set) | `/vttadmin soundsearch query:"tavern murmur"` |

`target` accepts either a player's display name or their raw client id (`ws-...`/socket.io id). `assistant-gm` is the role typically assigned to the AI GM Bot's own client — see the [`fates-edge-ai-gm-bot`](https://github.com/Chronophage-net/fates-edge-ai-gm-bot) repo's README ("Assistant GM Mode") for what changes once it holds that role.

---

## AI GM Voice Narration (optional)

Off by default. If the AI GM Bot has its own voice narration configured (see its own README), this bot can additionally speak those replies into a Discord voice channel:

1. Install the extra playback dependencies (not installed by default):
   ```bash
   npm install @discordjs/opus ffmpeg-static
   ```
   (or a system `ffmpeg` on `PATH` instead of `ffmpeg-static`, and/or `opusscript` instead of `@discordjs/opus` if you'd rather avoid a native build.)
2. Set in `.env`:
   ```
   DISCORD_GUILD_ID=your-server-id
   DISCORD_TTS_ENABLED=true
   DISCORD_TTS_VOICE_CHANNEL_ID=the-voice-channel-id
   ```
3. Make sure the bot has `Connect` and `Speak` permissions on that voice channel.

The bot joins the configured channel on the first narration clip it receives and stays connected — disconnect it from Discord's own UI, or restart the bot, to have it leave. This fails soft at every layer: missing dependencies, no permission, or `DISCORD_TTS_ENABLED` unset all degrade to "narration text still arrives normally, audio silently doesn't play."

## Reactive Soundscape (optional)

Off by default, no setup needed on this bot's side. If the AI GM Bot has a mood → track soundscape profile configured, this bot posts a "🎵 Now Playing" embed to `VTT_LOG_CHANNEL` whenever the ambience changes — text only, no voice playback here. The actual ambience audio plays client-side in each player's own web browser (`fates-edge-web-client`'s `core/soundboard.js`), not through this bot's voice connection — that's what Voice Narration above is for.

---

## Webhook integration

The bot runs an Express webhook server so external services can send messages to Discord:

```
POST /webhook
Headers: x-webhook-secret: your-webhook-secret
Body: {
  "event": "vtt-roll" | "vtt-chat" | "vtt-deck-draw" | "vtt-gm-update",
  "data": { ... }
}
```

```bash
curl -X POST http://localhost:3001/webhook \
  -H "x-webhook-secret: your-webhook-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "vtt-roll",
    "data": { "channelId": "1234567890", "sender": "Aria", "roll": "3d6+2", "result": "15" }
  }'
```

---

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────────┐
│  Discord Bot    │◄──────────────────►│  Fate's Edge        │
│  (Commands)     │                     │  Socket Server       │
└─────────────────┘                     └─────────────────────┘
         │                                         │
         ▼                                         ▼
┌─────────────────┐                     ┌─────────────────────┐
│  Discord Users  │                     │  VTT Clients        │
│  (Slash cmds)   │                     │  (Foundry/Roll20/…)  │
└─────────────────┘                     └─────────────────────┘
         │
         ▼
┌─────────────────┐
│  Webhook Server  │
│  (optional)      │
└─────────────────┘
```

---

## Project structure

```
fates-edge-discord-bot/
├── index.js                # Main entry
├── package.json
├── .env.example
├── commands/                # Slash commands
│   ├── vtt.js               # VTT connection, info, GM, grid/whiteboard, characters
│   ├── admin.js              # /vttadmin: broadcast, sync, stats, deck, modules, region, kick/ban, grid, token, whiteboard, soundsearch
│   ├── adventure.js          # /vttadventure: load, scene, encounter, timer, log, status
│   ├── dice.js                # /deck (near-duplicate of vttdeck.js)
│   ├── chat.js                 # Chat relay
│   ├── character.js            # Character management
│   ├── timer.js                # Ad-hoc timer commands (server/timers.js-backed)
│   └── vttdeck.js               # Deck operations
├── utils/
│   ├── websocket.js             # WebSocket client (with GM support)
│   ├── logger.js
│   └── config.js
└── events/
    ├── ready.js                 # Ready handler (GM notifications)
    ├── messageCreate.js
    └── interactionCreate.js
```

Adding a new command: create `commands/yourcommand.js`, export `data` (built with `SlashCommandBuilder`) and `execute(interaction, client)` — it auto-loads on restart.

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

## Troubleshooting

| Symptom | Check |
|---|---|
| Bot won't connect to Discord | `DISCORD_TOKEN`, Message Content Intent enabled, Discord status |
| Bot can't reach the VTT server | Server running? `VTT_SERVER_URL`/`VTT_ROOM_CODE`/`VTT_API_KEY` correct? |
| GM approval not working | Requester must `/vtt gm request` first; only the current GM can approve; check `/vtt gm list` |
| GM notifications not sending | `VTT_LOG_CHANNEL` set to a valid channel id the bot can post in |
| Slash commands missing | `npm run register`; re-invite with `applications.commands` scope; Discord's command cache can take up to an hour |

Logs land in `logs/` — `combined.log` for everything, `error.log` for errors only.

## Updating

```bash
git pull
npm install
npm run register
pm2 restart fates-edge-bot  # if using PM2
```

## License

MIT — see the monorepo root's [`LICENSE.code`](../../../LICENSE.code).

## Contributing

Fork, branch, commit, push, open a pull request.

## Support

[GitHub Issues](https://github.com/Chronophage-net/fates-edge-apps/issues) · support@fates-edge.com

---

<p align="center">
  <sub>Made with ❤️ by Nick Gasper</sub>
</p>
