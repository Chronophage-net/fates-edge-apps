# Fate's Edge Bridge — Foundry VTT Module

<p align="center">
  <img src="https://img.shields.io/badge/Foundry-VTT-orange" alt="Foundry VTT"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
  <img src="https://img.shields.io/badge/status-host%20verification%20needed-yellow" alt="Status"/>
</p>

Connects a Foundry VTT world to the Fate's Edge [socket server](../../javascript/fates-edge-socket-server/), so chat, dice rolls, characters, scene notifications, ad-hoc timers, the Deck of Consequences, Crown Spread readings, module listing, and GM election/promotion all sync in real time between Foundry and every other connected VTT client.

---

## Features

- **Real-time connection** — a persistent WebSocket connection to the Fate's Edge server, with auto-reconnect.
- **Chat sync** — bidirectional, between Foundry and the VTT.
- **Dice roll sync** — Foundry rolls relay to VTT clients.
- **Character sync** — Harm, Fatigue, Boons, and Tier sync as journal entries.
- **Scene notifications** — the active scene's name broadcasts to the VTT whenever it changes (one-way, Foundry → VTT).
- **Ad-hoc timers** — create, tick, list, and remove freeform GM/AI-improvised timers that live on the server, independent of any loaded adventure — shared with every other connected client.
- **Deck operations** — draw, shuffle, and Crown Spread, shown as both Foundry chat messages and journal entries.
- **Module listing** — see modules available on the server.
- **GM election & promotion** — request, approve/reject, and view client roles from the Foundry UI.
- **Room access** — room passwords and socket-server account tokens; server-side role checks still apply.

---

## Connection and privacy

Use a `ws://` or `wss://` server URL. An HTTPS Foundry page requires `wss://`. The module waits for room admission before showing Connected. Socket-server room passwords and account tokens are supported; managed rooms requiring a manager-token adapter currently fail explicitly.

Keep the active Foundry GM connected: that client publishes incoming public chat and journals once for the whole world. Other clients still maintain their own room identities. Only a message’s author forwards it outward; imported messages, whispers, and blind rolls are not re-broadcast. Remote whispers are imported only for the receiving Foundry user. Character sync creates reference journals, not system-specific Actor sheets.

Password, account token, API key, and display name are now client settings. When upgrading, clear any previously stored world-level credentials and enter each user’s credentials locally. The API key is a deployment administrator credential, not a room password; leave it empty unless using administrative HTTP tools. Browser settings are not a secret vault.

Journals use modern text pages with private default ownership. Remote journal content retains structural formatting while active HTML and attributes are removed. Existing legacy journal content is left intact; new updates use a text page.

## Requirements

- Foundry VTT v11–v13 API target; these versions have not been exercised in a running Foundry installation during this review
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
| **API Key** | Optional deployment administrator key for HTTP tools; not a room login. |
| **Player Name** | Your display name in the VTT (defaults to your Foundry username). |
| **Default Region** | Default region for deck draws. |
| **Auto Connect** | Connect automatically when Foundry loads. |

### Synchronization

| Setting | Description |
|---|---|
| **Sync Chat** | Mirror ordinary (non-whisper) Foundry chat to the VTT. |
| **Sync Dice Rolls** | Send Foundry rolls to the VTT. |
| **Sync Characters** | Import VTT character reference journals into Foundry. |
| **Sync Timers** | Reserved for a future scene/campaign timer integration — registered but not yet wired to any behavior. Unrelated to ad-hoc timers below, which always sync regardless of this setting. |
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

**Ad-hoc timers** (macros) — independent of any loaded adventure module, distinct from the Adventure Engine's own scene/campaign timers (ticked via `FatesEdgeBridge.sendAdventureTimer(name, amount, scope)`, no macro wrapper):

```javascript
createAdhocTimer('Ritual', 6);          // Create a 6-segment ad-hoc timer
tickAdhocTimer('Ritual', 2);            // Tick it forward (negative amounts tick back)
listAdhocTimers();                      // Request the current list from the server
removeAdhocTimer('Ritual');             // Remove it
```

The server also tracks adventure climax pacing and a per-module "Legacy Tracker" persistence schema; this bridge doesn't expose adventure-specific macros yet, but both ride along in `this.adventureState`/`Hooks.call('fates-edge-adventure-state', ...)` for anything downstream that wants them. Deck reseeding (`GET`/`POST /api/rooms/:code/deck/seed`) is likewise available server-side without a macro yet — the existing `deck-shuffled` handler already renders a reseed event generically. Same story for the socket server's `GET /api/soundboard/search` (Freesound proxy behind the web client's GM soundboard "Search Sounds" modal) — available server-side, no macro here yet; unlike Roll20, Foundry's Node/Electron context *can* make the fetch, so a macro wrapping it is a reasonable future addition, just not one this bridge does today.

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
| `createAdhocTimer(name, segments, description)` | Create a new ad-hoc timer |
| `tickAdhocTimer(name, amount)` | Tick an ad-hoc timer forward (default 1; negative ticks back) |
| `removeAdhocTimer(name)` | Remove an ad-hoc timer |
| `listAdhocTimers()` | Request the ad-hoc timer list from the server |
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

## Verification

Run `node --test utilities/vtt_mods_bots/tests/*.test.js` from the repository root after installing the Discord and socket-server dependencies. The bridge is tested with mocked Foundry host APIs and the actual socket server: URL construction, admission, chat, dice events, escaping, duplicate suppression, and private-message handling. UI rendering, Foundry document permissions, and full game-system compatibility still require testing in an installed Foundry world. No hosted manifest or release ZIP is published by this change; use the manual installation steps above.
