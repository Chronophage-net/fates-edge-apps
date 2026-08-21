# Fate's Edge Bridge — Foundry VTT Module

<p align="center">
  <img src="https://img.shields.io/badge/Foundry-VTT-orange" alt="Foundry VTT"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
  <img src="https://img.shields.io/badge/status-stable-brightgreen" alt="Status"/>
</p>

Connects a Foundry VTT world to the Fate's Edge [socket server](../../javascript/fates-edge-socket-server/), so chat, dice rolls, characters, scene notifications, the Deck of Consequences, Crown Spread readings, module listing, and GM election/promotion all sync in real time between Foundry and every other connected VTT client.

---

## Features

- **Real-time connection** — a persistent WebSocket connection to the Fate's Edge server, with auto-reconnect.
- **Chat sync** — bidirectional, between Foundry and the VTT.
- **Dice roll sync** — Foundry rolls relay to VTT clients.
- **Character sync** — Harm, Fatigue, Boons, and Tier sync as journal entries.
- **Scene notifications** — the active scene's name broadcasts to the VTT whenever it changes (one-way, Foundry → VTT).
- **Deck operations** — draw, shuffle, and Crown Spread, shown as both Foundry chat messages and journal entries.
- **Module listing** — see modules available on the server.
- **GM election & promotion** — request, approve/reject, and view client roles from the Foundry UI.
- **Secure** — API key authentication and configurable per-feature permissions.

---

## Requirements

- Foundry VTT v11 or higher (tested with v13)
- A Fate's Edge socket server, running and reachable
- A stable connection for WebSocket communication

---

## Installation

This module lives inside the `fates-edge-apps` monorepo rather than as its own standalone repo, so it installs by copying the folder in rather than via a Foundry manifest URL:

1. Clone or download `fates-edge-apps`:
   ```bash
   git clone https://github.com/Chronophage-net/fates-edge-apps.git
   ```
2. Copy `fates-edge-apps/utilities/vtt_mods_bots/foundry_fates-edge-bridge/` into your Foundry `Data/modules/` directory, renaming it to `fates-edge-bridge`, so the result is `Data/modules/fates-edge-bridge/`.
3. Restart (or reload) Foundry and enable **Fate's Edge Bridge** under **Add-on Modules** in your world.

---

## Configuration

After enabling the module, configure it via **Settings → Configure Settings → Module Settings → Fate's Edge Bridge**.

### Connection

| Setting | Description |
|---|---|
| **Server URL** | The WebSocket URL of your Fate's Edge server (`ws://localhost:10000` or `wss://your-server.com`). |
| **Room Code** | The room code to join (e.g. `AC12`). |
| **API Key** | Optional, if your server requires one. |
| **Player Name** | Your display name in the VTT (defaults to your Foundry username). |
| **Default Region** | Default region for deck draws. |
| **Auto Connect** | Connect automatically when Foundry loads. |

### Synchronization

| Setting | Description |
|---|---|
| **Sync Chat** | Mirror ordinary (non-whisper) Foundry chat to the VTT. |
| **Sync Dice Rolls** | Send Foundry rolls to the VTT. |
| **Sync Characters** | Sync characters to the VTT as journal entries. |
| **Sync Timers** | Reserved for a future scene/campaign timer integration — registered but not yet wired to any behavior. |
| **Sync Scenes** | Broadcast the active scene's name on change (notification only — doesn't touch the room whiteboard). |
| **Sync Deck** | Sync Deck of Consequences draws with the VTT. |

### GM features

| Setting | Description |
|---|---|
| **Enable GM Management Features** | Toggle the GM election/promotion UI. |

---

## Usage

### Connecting

Enable **Auto Connect** and reload Foundry, run the `connectFatesEdge()` macro, or click the status bar's status indicator, which toggles connect/disconnect. A status bar element appears top-left showing connection status, deck count, voice status, current region, and a **GM** button.

| Status bar element | Function |
|---|---|
| Status indicator | `🟢 Connected` / `🔴 Disconnected`; click to toggle |
| Deck counter | Remaining cards; click to refresh |
| Voice indicator | Voice status (visual only) |
| Region display | Current default region |
| GM button (👑) | Opens the GM Management panel |

### GM Management panel

Shows the current GM, your own role badge, a **Request GM** button (players) or **Resign GM** button (the GM — resigning requires approving a pending request, or using `/vtt gm approve` in Discord), a **Pending Requests** list with Approve/Reject (visible to the current GM only), and a **Clients List**. As GM, every non-GM row also gets a role dropdown (Co-GM / Assistant GM / Player / Spectator), a "save" checkbox to persist the grant across reconnects, and a **Set** button — "Assistant GM" is typically assigned to the AI GM Bot's own client; see the [`fates-edge-ai-gm-bot`](https://github.com/Chronophage-net/fates-edge-ai-gm-bot) repo's README ("Assistant GM Mode"). The server has final say on every role change, checked against your own connection, same as everywhere else in this panel.

### Sending actions from Foundry

**Chat** and **dice rolls** — just use Foundry normally; they mirror to the VTT if the corresponding sync setting is on.

**Deck operations** (macros):

```javascript
drawCard(1);                  // Draw 1 card from the default region
drawCard(3, 'Vhasia');        // Draw 3 cards from a specific region
crownSpread();                // Crown Spread reading
shuffleDeck();                // Shuffle the deck
setRegion('Acasia');          // Set the default region
listModules();                // List loaded modules
getDeckStatus();              // { remaining, history }
```

**Characters & scenes** — both sync automatically when their setting is enabled (character sheet/combat changes; active-scene changes). There's no separate manual button for either.

The server also tracks adventure climax pacing and a per-module "Legacy Tracker" persistence schema; this bridge doesn't expose adventure-specific macros yet, but both ride along in `this.adventureState`/`Hooks.call('fates-edge-adventure-state', ...)` for anything downstream that wants them. Deck reseeding (`GET`/`POST /api/rooms/:code/deck/seed`) is likewise available server-side without a macro yet — the existing `deck-shuffled` handler already renders a reseed event generically.

---

## Macros reference

| Function | Description |
|---|---|
| `connectFatesEdge()` | Connect to the configured server |
| `disconnectFatesEdge()` | Disconnect |
| `drawCard(count, region)` | Draw 1–5 cards from a region (or default) |
| `crownSpread(region)` | Crown Spread reading |
| `shuffleDeck()` | Shuffle the deck |
| `setRegion(region)` | Change the default region |
| `listModules()` | List loaded modules |
| `getDeckStatus()` | `{ remaining, history }` |
| `requestGM()` | Send a GM request |
| `approveGM(targetId)` | Approve a GM request (GM only) |
| `getGMStatus()` | `{ currentGM, isGM, pendingRequests, clients }` |

All of the above are also available as `FatesEdgeBridge.<methodName>(...)` directly — the short `window.*` names just wrap them.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| Connection fails | Server URL, room code, `ws://` vs `wss://`, firewall |
| Messages not syncing | The relevant sync setting is on; connection is active (status bar); browser console for errors |
| GM panel empty | **Enable GM Management Features** is on; reconnect to populate client data |
| Deck draws not appearing | **Sync Deck** is on; the deck has cards remaining |

| Error | Meaning |
|---|---|
| `WebSocket connection failed` | Server not running, or wrong URL |
| `Room not found` | Invalid room code |
| `Authentication failed` | Check API key |
| `Connection timed out` | Network issue, or server overloaded |

---

## Updating

```bash
cd fates-edge-apps && git pull
```

Then re-copy `utilities/vtt_mods_bots/foundry_fates-edge-bridge/` over `Data/modules/fates-edge-bridge/`, overwriting existing files.

---

## Documentation

- [Fate's Edge socket server](../../javascript/fates-edge-socket-server/README.md)
- [Foundry VTT Wiki](https://foundryvtt.wiki)

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
