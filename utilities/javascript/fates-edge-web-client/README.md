# Fate's Edge Web Client

The main *Fate's Edge* application: character management, dice, encounters, the magic system, a virtual tabletop, and two standalone games, all running client-side in the browser. Connect it to the [socket server](../fates-edge-socket-server/) for shared, real-time campaigns, or use it entirely offline with data in `localStorage`.

> Part of the [fates-edge-apps](../../../README.md) monorepo — see the repository root for the full ecosystem (server, VTT integrations, other clients) and licensing.

---

## Quick start

```bash
cd utilities/javascript/fates-edge-web-client
npm install
npm run dev      # local dev server via Vite
# or
./build.sh       # produces dist/ for static hosting
```

You can also open `index.html` directly, or serve `dist/` with any static web server. First run shows a password gate only if one has been set from **Settings** — it's independent of any server account and just locks the local browser session.

To play with others, connect to a running [socket server](../fates-edge-socket-server/) from **Settings → Campaign Sharing** or the **VTT** tab. Without a server, everything still works — characters, dice, the magic system, Kon'reh — just local to your browser, with export/import for backup.

---

## What's in it

### Playing

- **Characters** — full CRUD with XP tracking, a template-based builder wizard, and a talent editor, backed by a full catalog of tagged, filterable talents.
- **Dice** — Fate's Edge resolution with position and boons, and Story Beat tracking.
- **Encounters** — a combat/objective tracker with an integrated bestiary. Clocks aren't limited to Harm/Heal combat math — Obstruction, Skill Challenge, Trap/Ward, Lockpick, Heist, Social/Negotiation, and a freeform Custom type each get their own progress vocabulary and icon, with real combat's Harm/Fatigue/armor math strictly gated to actual fights.
- **Timers** — visual timers for scene and campaign pressure.
- **Docs & Wiki** — a searchable document viewer for the SRD, Essentials guide, and GM Screen, plus a Markdown wiki with an in-app editor.
- **Search** — full-text search across the Wiki, documents, patrons, factions, and regions. Zero-config with a built-in local Fuse.js index; optionally backed by a self-hosted Solr or Elasticsearch instance for larger deployments (`window.__SOLR_URL` / `window.__ES_URL`/`__ES_API_KEY`, `window.__SEARCH_BACKEND` to force one when both are configured — see System Status for which one is actually active).
- **Crafting** — the Codex (Talent-tier-priced magic items/artifacts, attunement and upkeep/decay tracking) and the crafting bench for ingredients and recipes, split out into its own tab so it isn't gated behind any one magic path.

### Spellcraft — the magic system

One unified UI covering every path in the game:

| Component | Covers |
|---|---|
| `calculator.js` | The TAGS calculator for Free Casters — spell construction with DV breakdown and backlash risk |
| `rites.js` / `cantor.js` | Patron-granted Rites for Runekeepers and Invokers; Cantor songs, Push It mechanics, and a patron-scaled corruption track |
| `witchcraft.js` | Hedge gifts, quick workings, full rituals, and Shadow/Shame/Identity Strain tracking |
| `summoning.js` | A searchable bestiary, spirit binding, and Leash management |
| `monks.js` | Talent-gated Monastic traditions and breath-state meditation |
| `spellbook.js` | Custom spell storage, signature combinations, import/export |
| `trackers.js` | The shared Obligation/Corruption/Leash/Mental-Strain/Shadow-Shame-Identity tracker UI used across the above |

### Running a campaign

- **Factions & Patrons** — standings, agendas, relationships, and rites/witchcraft/traditions tied to cosmic and terrestrial patrons.
- **Adventure Manager** — load pre-authored adventure modules and track scene/act progress, NPCs, locations, and a per-adventure bestiary. Also hosts the **ad-hoc timer panel** — quick GM/AI-improvised countdown timers (e.g. "Guard Patrol," "Village Unrest") that are independent of any loaded adventure and live on the server (`server/timers.js`) rather than in this client's local state, separate from an adventure module's own authored scene/campaign timers.
- **Whiteboard** — collaborative notes and grid-combat tools.
- **GM Tools** — GM-only utilities kept separate from the shared player view: Session Recap (below), the **Kanban** task board for threats and opportunities, and the **Travel Planner** for overland route/travel-time planning across regions.

### Real-time play (needs the socket server)

- **Sync** — chat, dice, characters, timers, and scenes over WebSocket/Socket.IO, with an offline-queue and conflict-aware merge so a dropped connection doesn't lose local edits.
- **Deck of Consequences & Crown Spread** — shared draws with region-specific card meanings.
- **Voice chat** — WebRTC, with TURN support (see the socket server) for restrictive networks.
- **Session Recording** — screen + mic capture (GM Tools → Session Recap), downloaded as one `.zip`: the `.webm` recording plus a synced `.srt` auto-generated from in-app events (deck draws, timers, scene changes). An opt-in "live transcription" checkbox folds best-effort browser speech recognition into the same `.srt` as `[SPEECH]` lines — see the repository root README's Transcription section for pairing this with a real speech-to-text tool for a verbatim transcript.
- **GM election** — request GM status, approve/reject requests, and promote Co-GM/Assistant-GM/Spectator roles.
- **System Status** (sidebar → System → 🩺 Status) — live server connection, voice/TURN availability, active recording, sync/offline-queue state, who else is in the room, and which search backend is active, auto-refreshing.

### Kon'reh & Toll & Veil

Two standalone games built on the same infrastructure as everything else here — no separate technology stack.

- **Kon'reh** — an 8×8 strategy board game with six AI opponent "Schools," phase-aware play (opening/midgame/endgame), and a live coaching mode.
- **Toll & Veil** — a card game with an opt-in stakes system (Points by default, a capped XP wager, or a narrative "String" debt tied to the patron Lucky Jack).

Both play pass-and-play, solo against the built-in AI, or as a host-authoritative real-time table riding the same event relay as chat and dice.

---

## Architecture

The web client uses a dynamic module loader that lazy-loads each feature tab on demand, registered in `js/router.js`:

```javascript
const ROUTE_IMPORTS = {
    home:        () => import('./features/home/index.js'),
    dashboard:   () => import('./features/dashboard/index.js'),
    characters:  () => import('./features/characters/index.js'),
    dice:        () => import('./features/dice/index.js'),
    decks:       () => import('./features/decks/index.js'),
    crafting:    () => import('./features/crafting/index.js'),
    encounters:  () => import('./features/encounters/index.js'),
    timers:      () => import('./features/timers/index.js'),
    factions:    () => import('./features/factions/index.js'),
    patrons:     () => import('./features/patrons/index.js'),
    docs:        () => import('./features/docs/index.js'),
    search:      () => import('./features/search/index.js'),
    settings:    () => import('./features/settings/index.js'),
    'system-status': () => import('./features/system-status/index.js'),
    sync:        () => import('./features/sync/index.js'),
    whiteboard:  () => import('./features/whiteboard/index.js'),
    kanban:      () => import('./features/kanban/index.js'),
    wiki:        () => import('./features/wiki/index.js'),
    vtt:         () => import('./features/vtt/index.js'),
    'gm-tools':  () => import('./features/gm-tools/index.js'),
    spellcraft:  () => import('./features/spellcraft/index.js'),
    'kon-reh':   () => import('./features/kon-reh/index.js'),
    'adventure-manager': () => import('./features/adventure-manager/index.js'),
};
```

`builder` now redirects to `characters` (folded into the character builder wizard there) and `travel-planner` is loaded on demand from inside GM Tools rather than as a standalone route — see `ROUTE_REDIRECTS` in `js/router.js` for the full backward-compatibility list.

Each tab in `js/features/` is self-contained; `js/core/` holds the shared machinery every feature draws on:

| Module | Description |
|---|---|
| `state.js` | State management with `localStorage` persistence |
| `sync/` | Real-time sync via WebSocket (`conflict.js`, `offline-queue.js`, `operations.js`, `presence.js`) |
| `dice.js` | The dice-rolling engine |
| `websocket.js` / `discovery.js` | Connection management and server discovery |
| `media.js` | Session recording (screen+mic capture) and its event-driven SRT/zip export — **not** live voice chat itself (that's `VoiceChat.js`/`vtt/voice.js`) |
| `crypto.js` / `password.js` | Client-side hashing and the password gate |
| `gravatar.js` | Gravatar integration for presence avatars |
| `pack-manager.js` / `data.js` / `game-data.js` | Data pack loading and lookup |
| `highlight-tags.js` | Inline tag highlighting in rules text |

For the full architecture — state management, the real-time sync protocol, conflict resolution, and how a feature module plugs into all of it — see [`DESIGN.md`](DESIGN.md).

---

## Data files

Game data loads from JSON at runtime, under `data/`:

```
data/
├── bestiary.json
├── wiki.json
├── seed.js
├── docs/
│   ├── Fates_Edge_-_Essentials.html
│   ├── Fates_Edge_-_Game_Master_Screen.html
│   ├── Fates_Edge_-_Systems_Reference_Document.html
│   └── manifest-core.json
├── factions/
│   ├── manifest.json
│   └── bloody-fist.json, ecktorian-censorate.json, gray-ash.json, house-contarini.json, iron-league.json, velvet-court.json
├── patrons/
│   ├── manifest.json
│   └── 51 patron files (inaea_angel_of_spiders.json, the_traveler.json, khemesh_the_abyssal_maw.json, thrysos_king_of_revels.json, …)
└── regions/
    └── 23 region files (acasia.json, aelaerem.json, silkstrand.json, ykrul.json, zakov.json, …)
```

Adding your own faction, patron, or region is a matter of dropping a JSON file in the right folder and listing it in that folder's `manifest.json` — see [`DATA_SCHEMA.md`](DATA_SCHEMA.md) for the exact on-disk shape of each data type.

---

## Search backend configuration

The built-in local index needs no configuration. To point at a self-hosted Solr or Elasticsearch instance instead (useful once your Wiki/faction/patron data grows past what an in-browser index handles comfortably), set the relevant global before the search module first loads:

```javascript
window.__SOLR_URL = 'https://your-solr-instance/solr/fates-edge';
// or
window.__ES_URL = 'https://your-es-instance:9200';
window.__ES_API_KEY = 'your-api-key';
// if both are configured:
window.__SEARCH_BACKEND = 'elasticsearch'; // or 'solr'
```

System Status (sidebar → System → 🩺 Status) shows which backend is actually connected and how many entries are indexed.

---

## Accessibility

Focus management and `aria-live` announcements on navigation, a high-contrast theme, a `role="log"` self-announcing chat pane, two independent opt-in text-to-speech features, labeled controls throughout, and a static accessibility lint suite run as part of `npm test`. See [`ACCESSIBILITY.md`](ACCESSIBILITY.md) for the full rundown — what's implemented, where to find it, and how to use it.

---

## Development

```bash
npm test          # runs tests/runner.js — a small hand-rolled test framework, no Jest
```

Before submitting a change: run the test suite, update this README or `DESIGN.md`/`ACCESSIBILITY.md`/`DATA_SCHEMA.md` if you changed behavior those documents describe, and keep any change to a data file's shape backward-compatible with existing saved campaigns where possible.

---

## License & attribution

- *Fate's Edge* is © Nicholas A. Gasper.
- Source code here is MIT-licensed, as part of the [fates-edge-apps](../../../README.md) monorepo.
- The SRD and Essentials guide are CC BY-NC-SA 4.0. Everything else — setting lore, characters, factions, proprietary magic systems, artwork — is All Rights Reserved, distributed for free for personal, non-commercial use. See the [repository root README](../../../README.md#license) for the full breakdown.

---

**Enjoy your games!**
— Nick Gasper
