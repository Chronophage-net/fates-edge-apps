[![Build Apps and Packages](https://github.com/Chronophage-net/fates-edge-apps/actions/workflows/build-apps-and-packages.yml/badge.svg)](https://github.com/Chronophage-net/fates-edge-apps/actions/workflows/build-apps-and-packages.yml)

# Fate's Edge Toolkit v4.18.0 – Complete VTT Ecosystem

> A modular, self-contained toolkit for running Fate's Edge TTRPG campaigns, with real‑time collaboration, VTT integrations, Game Master management, and a full in-browser magic/monastic-path system.

[![License: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](LICENSE.code)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/SRD-CC_BY--NC--SA_4.0-lightgrey.svg)](LICENSE.srd)
[![License: All Rights Reserved](https://img.shields.io/badge/Content-All_Rights_Reserved-red.svg)](LICENSE.proprietary)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-green.svg)](https://nodejs.org/)
[![Foundry VTT](https://img.shields.io/badge/Foundry-VTT-orange)](https://foundryvtt.com/)
[![Discord](https://img.shields.io/badge/Discord-Bot-5865F2)](https://discord.com/)
[![Version](https://img.shields.io/badge/version-4.18.0-blue)](https://github.com/Chronophage-net/fates-edge-apps)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [What's New in v4.16.0](#-whats-new-in-v4160)
- [What's New in v4.15.0](#-whats-new-in-v4150)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Modules](#-modules)
- [Data Files](#-data-files)
- [Integrations](#-integrations)
- [Real‑Time Campaign Server](#-real-time-campaign-server)
- [Roadmap](#-roadmap)
  - [Transcription](#transcription)
- [License](#-license)
- [Contributing](#-contributing)
- [Credits](#-credits)

---

## 🎯 Overview

**Fate's Edge Toolkit** is a modular, browser-based companion application for running *Fate's Edge* tabletop roleplaying games. It provides tools for character management, dice rolling, encounter tracking, faction management, campaign planning, a full magic-system UI (Cantor, Witch, Summoner, Free Caster, Runekeeper/Invoker, and Monastic traditions), and more — all in a single, self-contained web application.

The toolkit includes **real‑time VTT features** via a WebSocket/Socket.io server, a **campaign sharing server** with GM election and shared Deck of Consequences draws, **integrations** for Foundry VTT, Discord, Roll20, and Avrae, and a growing set of **standalone in-browser mini-tools** (including an original strategy board game, Kon'reh).

---

## 🆕 What's New in v4.16.0

- **🎬 Adventure Engine: climax pacing/forcing** (`fates-edge-socket-server/server/adventure.js`) — a triggered climax act can now stall out (players circling without resolving it), so the adventure state gained `climaxPadScenes` (settable via `POST /api/rooms/:code/adventure/load-custom`'s new optional field, defaults to `2`), `climaxScenesSinceTrigger` (increments once per completed scene while `climaxTriggered` is true), and `climaxForced` (flips once a forced twist has fired, resets on the next adventure load). A new sibling route, `POST /api/rooms/:code/adventure/climax-forced`, broadcasts `adventure-climax-forced` and is used by `fates-edge-ai-gm-bot`'s `modules/adventure-director.js` (`generateForcedClimaxTwist()`) to push a stalled climax toward resolution once the pad is used up. See [API.md](API.md) for the full route/field reference.
- **📜 Legacy Tracker persistence surfaced through the API** — `GET /api/rooms/:code/adventure/reference` now includes a `persistence` field (`null`, or `{ schema, carryover: [...], reset_on_complete }`) read straight through from a loaded adventure module's own declared schema. This is a bot-side carryover/legacy-state feature (`fates-edge-ai-gm-bot`); the server itself only passes the module's `persistence` block through read-only.
- **🎲 Per-room seedable deck RNG** (`fates-edge-socket-server/server/rng.js`, new) — the Deck of Consequences now shuffles with a per-room xorshift128 PRNG stored in room state instead of bare `Math.random()`, making a room's shuffle sequence fully reproducible from its seed. Two new routes: `GET /api/rooms/:code/deck/seed` (current seed) and `POST /api/rooms/:code/deck/seed` (`{ seed }`, reseeds + reshuffles, broadcasts `deck-shuffled` with `{ reason: "reseeded" }`). `deck.js`'s internal `buildDeck()`/`shuffleArray()` both take an optional `rng` param defaulting to `Math.random`, so nothing that doesn't care about seeding changes behavior.
- **🔒 Card-text rendering sanitized with DOMPurify** (web client) — user-uploaded/custom card text now runs through DOMPurify when it's loaded, hardening the custom-content path against stored XSS.

## 🆕 What's New in v4.15.0

- **🎙️ Session Recording bundled into one `.zip`, plus optional live transcription** — `js/core/media.js`'s recording (screen+mic `.webm`) and its event-driven SRT used to download as two separate files a moment apart; they now download together as a single `.zip` (recording + SRT + a short `session-info.txt`) via the `JSZip` already loaded for pack import/export, with a two-file fallback if that's ever unavailable. Also added an opt-in, best-effort **live transcription** checkbox (GM Tools → Session Recap) that feeds the browser's own `SpeechRecognition` API into the same event log as `[SPEECH]` lines. Neither is full audio transcription on its own — see the new [Transcription](#transcription) section under Roadmap for pairing this with a real speech-to-text tool. Also fixed: docs/table entries that described `media.js` as voice-chat support were wrong (that's `VoiceChat.js`/`vtt/voice.js`) — corrected throughout.
- **🎥 A real recording of the demo actually running** — README's Quick Start now embeds `docs/media/demo.mp4`: the AI GM bot joining room `DEMO` and narrating a live reply, generated entirely by the local Ollama instance `npm run demo` starts (no API keys, nothing cloud-hosted).
- **🐛 Fixed: the demo client was silently talking to the production server, not the local stack.** `fates-edge-web-client`'s WebSocket URL/room/server defaults were hardcoded to the hosted production server, so opening `localhost:8080` after `npm run demo` connected the browser to production instead of the containers `npm run demo` just started — the AI GM bot (correctly joined to the *local* server's room `DEMO`) was never in the same room as the browser. Now overridable at build time via `VITE_WS_URL`/`VITE_WS_ROOM`/`VITE_SERVER_URL`, and `docker-compose.full.yml`'s demo build sets them to point the client at itself. The normal production build is unaffected.
- **🔧 Demo stack polish**, closing out a round of review feedback: `tools/demo.sh` now generates a random per-run `API_KEY` instead of a static placeholder, warns when the lightweight default model (`llama3.2:1b`) is in use and suggests `llama3.2:3b`/`mistral`, and notes that the AI GM's first reply may take 10-30s longer while Ollama loads the model.
- **🐛 Five more first-run bugs fixed**, all surfaced by actually running `npm run demo` end to end for the first time: a missing `pull_policy` on the three locally-built services (Compose tried to *pull* them instead of building), `fates-edge-socket-server/.dockerignore` excluding `package-lock.json` (broke `npm ci`), a missing `--break-system-packages` on that service's `pip3 install` (PEP 668), an unquoted `AIGM_BOT_NAME=AI GM` in `.env.demo(.example)` breaking `tools/demo.sh`'s env sourcing, and `OLLAMA_PORT` colliding with a native (non-Docker) Ollama install on the same machine.
- **🧠 Adventure Engine: structured knowledge state** (`fates-edge-socket-server/server/adventure.js`) — adventure modules can now define a `knowledge[]` array of explicit `{ id, subject, gm, player, revealed, revealCondition, tags }` secret entries instead of burying them in `_gmhints` prose. Two new REST routes (`POST /api/rooms/:code/adventure/knowledge/reveal|hide`) plus matching Socket.IO/plain-WS events flip an entry's live reveal state at runtime; `getPublicState()`/`getReferenceData()` split so GM-only truth never reaches player-facing views. See `fates-edge-ai-gm-bot`'s matching `[REVEAL "id"]`/`[HIDE "id"]` AI tags.

## 🆕 What's New in v4.14.0

- **🛡️ Abuse-hardening & scaling pass on the socket server**, addressing three gaps flagged from a review of `DESIGN.md`:
  - **General API rate limiting** — a broad per-IP limiter now covers the whole REST API (previously only login/register were rate-limited), plus a new per-CONNECTION WebSocket message-rate limiter on both transports. Both configurable, both independently disable-able, no new dependency (extends the existing hand-rolled limiter rather than adding `express-rate-limit`).
  - **Per-room client cap** (`MAX_CLIENTS_PER_ROOM`) — rejects new joins once a room already holds a configured number of clients. Off (unlimited) by default.
  - **Node `cluster`-based multi-core scaling** (`CLUSTER_WORKERS`) — a simpler alternative to Redis-based horizontal scaling for using more of one machine's CPU cores, with no external dependency. Uses the official `@socket.io/sticky` + `@socket.io/cluster-adapter` packages and combines with the existing `REDIS_URL` scaling for multi-machine deployments. See `fates-edge-socket-server/SCALING.md`'s new "Multi-core scaling" section — verified with a real two-worker smoke test during development, not just pattern-matched from documentation.

## 🆕 What's New in v4.13.1

- **🎭 Role assignment, closed end-to-end across the whole ecosystem.** Previously only the Roll20 integration had a working "assign a role" command — the Discord bot and Foundry bridge both had the underlying live-socket `changeRole()` plumbing already wired up, but nothing ever called it, and the web client had no picker at all. Now every surface can promote/demote a client:
  - **`assistant-gm` room role** (v4.12.0) — a fourth assignable role alongside GM/Co-GM/Player/Spectator, giving a GM a middle tier to hand the AI GM Bot: full mechanics, held narrative authority. See the `fates-edge-ai-gm-bot` repo's "Assistant GM Mode" for what the bot does with it. Deliberately carries no elevated server permissions of its own.
  - **`POST /api/rooms/:code/clients/:clientId/role`** (v4.13.0) — a REST equivalent of the socket-only `role_change_request` event, for integrations (like the Discord bot's admin commands) that are otherwise entirely REST-based rather than holding a live GM socket connection.
  - **Discord bot**: new `/vttadmin role <target> <role> [save]` slash command.
  - **Foundry bridge**: the GM Management panel's client list now has a role dropdown + persist checkbox + "Set" button on every non-GM row.
  - **Roll20**: `!fates-edge role set`/`role list` now documented and accept `assistant-gm`.
  - **Web client**: the "Party Members" presence list now has its own in-app role picker — no more needing to leave the browser and reach for Discord/Foundry/Roll20 just to promote or demote someone.
- **📚 Docs pass across every integration** covering the above — `ROLES.md`'s code-location table, and the Discord bot / Foundry bridge / Roll20 READMEs.

## 🆕 What's New in v4.11.1

- **⏱️ Adventure Timer Sync Loop closed end-to-end** — the server already recomputed every timer tick authoritatively and broadcast the canonical result (`timer-ticked`) to the whole room, but no client ever listened for that broadcast, so a tick from one client (or an AI GM) never visibly updated anyone else's timer display. `core/websocket.js` now handles `timer-ticked` on both transports, and `adventure-manager/index.js` reconciles the local timer to match — idempotently, so the sender's own echo is a safe no-op.
- **📚 One-click Adventure Module install from Settings** — a new "Adventure Module Library" panel lists modules from the local adventure folder with metadata (title, tier, author, description) and installs any of them with one click, no modal or manual JSON placement required. Reuses the existing manifest/install functions rather than duplicating logic.
- **🔄 Character sync is now bidirectional** — local character edits (sheet editor, wizard, roller) push to the server automatically, debounced, instead of only at initial connect. Character payloads also now include `patron`, previously dropped before it ever reached the server — the AI GM bot's status dashboard (see the bot repo's own changelog) uses this for a per-Patron Obligation breakdown.

## 🆕 What's New in v4.10.0

- **🔍 Optional Elasticsearch search backend for the web client** — `js/features/search/index.js` already supported an optional self-hosted Solr backend (undocumented until now); it now supports Elasticsearch too (`window.__ES_URL`, `window.__ES_API_KEY`), with `window.__SEARCH_BACKEND` to force a specific one if both are configured. Still zero-config by default — the built-in local Fuse.js index needs nothing external. See the web client's own README's new "Search Backend Configuration" section.
- **🩺 System Status now shows the active search backend** — which of Solr/Elasticsearch/local index is actually connected, and how many entries are indexed.
- **🧪 12 new tests** covering the Elasticsearch integration and Solr/Elasticsearch backend-selection logic (138/138 web-client tests passing), plus a `sessionStorage` shim added to the test harness (was missing entirely — the search feature couldn't be unit tested at all before this).
- **🔧 Small reliability fix while touching this code** — the Solr/Elasticsearch config used to be read once at module import time, meaning `window.__SOLR_URL` had to be set before this module was ever imported by anything (including indirectly) or it would silently never take effect. Now read live on every use.

## 🆕 What's New in v4.9.0

- **📈 Optional Redis-backed horizontal scaling for the socket server** — off by default (single instance, zero external dependency, unchanged behavior for the common case). Opt in via `REDIS_URL` to run more than one server instance behind a load balancer with sticky sessions: Socket.IO clients scale transparently via the official `@socket.io/redis-adapter`, and a small custom pub/sub relay covers the plain-`ws` transport, which isn't part of Socket.IO's room system. See [`fates-edge-socket-server/SCALING.md`](utilities/javascript/fates-edge-socket-server/SCALING.md).
- **📚 Documentation overhaul — separating what's implemented from what's aspirational.** The socket server's `DESIGN.md` had drifted badly from the real code over time (describing Redis caching, PDF conversion, email, and job scheduling that were never built, alongside real routes/events that were never listed). Rewritten against the actual code, with three new companion docs: [`SCALING.md`](utilities/javascript/fates-edge-socket-server/SCALING.md) (the new scaling feature, in full), [`ROLES.md`](utilities/javascript/fates-edge-socket-server/ROLES.md) (the role/permission model, promoted out with diagrams), and [`ROADMAP.md`](utilities/javascript/fates-edge-socket-server/ROADMAP.md) (only genuinely planned work — everything else was deleted, not parked). The web client's own `DESIGN.md` no longer duplicates server architecture/deployment content that isn't its job to maintain; it points at the server's docs instead.
- **🔧 Small fixes surfaced along the way** — `fates-edge-socket-server`'s `package.json` had a broken `main` field (pointed at a file that doesn't exist) and a full copy-pasted duplicate server entrypoint (`server/server.js` vs `server/index.js`) that had to be kept in sync by hand; the duplicate is now a one-line re-export.

## 🆕 What's New in v4.8.3

- **🃏 Toll & Veil** — A second original card game (alongside Kon'reh), playable pass-and-play, solo vs. AI, or as a host-authoritative real-time table over the VTT's event relay, with an opt-in stakes system (Points by default, a capped XP wager, or a narrative "String" debt tied to the patron Lucky Jack). Ships with its own in-app "Definitive Guide" doc.
- **🔒 Security sweep of the new multiplayer path** — Fixed a stored-XSS class of bug (unescaped network-supplied display names rendered into lobby/challenge banners for both Kon'reh and Toll & Veil), a sender-identity spoofing hole in the socket server's generic `event` relay (the server now stamps the true, connection-verified `socketId` instead of trusting whatever a client claimed), and a forged-stake-message bug that let a malicious peer apply arbitrary XP/String transfers outside the agreed cap or game state. Also added input sanitization for network-supplied lobby data (seat counts, stake config, display names), and the AI GM bot's status dashboard no longer binds to all network interfaces by default (loopback-only unless explicitly opted into via `STATUS_HOST`).
- **🐛 Trust cards no longer silently vanish** — `loadRemoteFactions()` could leave `assets`/`followers`/`trusts` empty once real faction files loaded, orphaning already-rendered default cards (e.g. "The Silk Coin") and producing a "Trust not found" error on click.
- **🐛 Cantor's Songs list now renders on first load** — was querying the live document for an element that only existed inside a not-yet-attached wrapper, so it silently found nothing until a manual refresh forced a re-render into the attached DOM.
- Prior cycle (v4.6.0–v4.8.2, condensed): diverse encounter objective-type clocks instead of hardcoded Harm/Heal (Obstruction, Skill Challenge, Trap/Ward, Lockpick, Heist, Social, Custom); phase-aware Kon'reh AI; symbol-management and patron/cantor discovery fixes; a full talent catalog overhaul (10 → 55 JSON-per-talent entries with tagging/category filters); a Modern Noir theme and a themeable UI engine; multi-character "Remote enabled" support (up to 6 characters per client); a broader security hardening pass (auth rate limiting, input length limits); Co-GM roles propagated through the mods/bots; socket-server persistence and Dockerfile fixes; and Toll & Veil's initial engine/UI landing.
- **🧪 100/100 web-client tests, 59/59 socket-server tests, 146/146 ai-gm-bot tests passing** as of v4.6.0; not re-run end-to-end for every point release since — see each repo's own test suite for current counts.

## 🆕 What's New in v4.6.0

- **🎯 Diverse Encounter Objective Types** — Encounters used to frame *every* clock in Harm/Heal combat terms even when the encounter wasn't a fight. A new shared `js/core/objective-types.js` registry (mirrored in the socket server and AI GM bot) adds Obstruction, Skill Challenge, Trap/Ward, Lockpick, Heist, Social/Negotiation, and a freeform Custom type (your own Timer/Tick labels) alongside Combat — each with its own icon, progress/relief vocabulary, and log text. Real combat's Harm/Fatigue/armor math is untouched and strictly gated to actual fights. Wired through the Encounters editor, the combat tracker, Adventure Manager scenes, and the VTT's mini tracker; the socket server's adventure API now carries an optional `type` field end to end, defaulting to `combat` for full backward compatibility.
- **🔧 Character Editor/Wizard Symbol Fix** — Removed a redundant "auto-symbol" feature that force-added whatever patron sat in the generic Patron dropdown as an Invoker Symbol, conflicting with the existing purpose-built Add Symbol flow and risking silently corrupting `char.symbols` on save.
- **🔄 Patrons/Cantor No Longer Need a Manual Refresh** — Root-caused to `discoverPatrons()`'s 1-hour localStorage cache never being bypassed by a forced reload; added a real `force` parameter threaded from `loadPatronData()` all the way down, plus a retry-once safeguard in the Cantor panel.
- **♟️ Phase-Aware Kon'reh AI** — The built-in strategy game's AI now recognizes opening/midgame/endgame phases, races Sanctum Seed tempo instead of camping, refuses to let Blue idle safely on a Sanctum, and searches deeper (with an explanatory coach hint) once a Reforge race is on.
- **🧪 100/100 web-client tests, 59/59 socket-server tests, 146/146 ai-gm-bot tests passing** after all of the above.

## 🆕 What's New in v4.5.1

- **⚡ "Jump to the Action" — one‑click into a one‑shot** — The welcome overlay's Quick Start button is now **Jump to the Action**: it hands you a ready‑made pre‑gen character, loads and starts the bundled starter adventure (*The Lantern at Dusk*), and shows a short confirmation pane naming your character with a link to the Essentials quickstart doc, before dropping you into the Adventure Manager. Building this surfaced a real bug: `data/pre-gens.json` — the file the old Quick Start button fetched — never actually existed anywhere in the repo, so pre‑gen loading had always silently failed. Three new pre‑gens themed to the starter adventure were added, and a double‑fire bug in the button's click handling was fixed along the way.
- **🧪 72/72 web-client tests passing** after the above (11 new).

## 🆕 What's New in v4.5.0

- **🎙️ Voice Chat & TURN NAT Traversal, Actually Working** — Audited and fixed voice signaling end-to-end: both the plain-WebSocket and Socket.io transports now correctly route offer/answer/ICE-candidate/status messages (they were silently dropped over Socket.io before), and voice-status broadcasts now carry the `clientId` peers need to identify the sender. Added a `server/turn.js` short-lived TURN credential minting endpoint (`GET /api/turn-credentials`), a `coturn` service in `docker-compose.yml` (the `turn` profile), and client-side wiring (`js/core/turn.js`) so voice chat works behind symmetric NAT/restrictive firewalls, not just STUN-friendly networks.
- **🐳 One `docker-compose up` for the Whole Ecosystem** — A root `docker-compose.yml` now brings up the web client, socket server, and (via `bots` profile) the AI GM bot and Discord bot together, with TURN as an opt-in `turn` profile. See [Quick Start](#-quick-start).
- **📜 Community Use Policy & Split License Files** — [COMMUNITY_USE_POLICY.md](COMMUNITY_USE_POLICY.md) is a plain-language FAQ over what you can and can't do with the code/SRD/proprietary-content split. The `LICENSE.code`/`LICENSE.srd`/`LICENSE.proprietary` files the badges above link to now actually exist (they were broken links before).
- **🩺 System Status Page** — Sidebar → System → 🩺 Status (`js/features/system-status/`) shows real-time server connection, voice chat + TURN availability, active recording, sync/offline-queue state, who else is in the room, and browser feature support, auto-refreshing every 5s. Building this surfaced and fixed a real bug: `getConnectedClients()` only worked over Socket.io — the plain-WS transport (the client's default) had no `get-clients` handler and always timed out to an empty list.
- **📦 Module System Fixed (it never actually worked)** — The installable-adventure "module" system (`POST/GET /api/modules`, push/cleanup, and the matching WS events) resolved its storage directory as `server/modules/` in five places across `api.js` and `socketio-handlers.js`, when the real directory has always been `<repo-root>/modules/` — meaning every module install/list/push/cleanup call failed in every deployment. Also fixed: the plain-WS transport had zero handling for module events at all (Socket.io-only, same bug pattern as `get-clients` above); the `generate-manifest.js` CLI crashed on every run from a bad require path; the shipped example module's files were misnamed and invisible to every loader; and pushing a module never actually installed it into the pushing GM's own client (broadcasts don't echo to the sender). See [MODULES.md](utilities/javascript/fates-edge-socket-server/MODULES.md) for how to author and distribute one.
- **📚 Data Schema Documentation** — [DATA_SCHEMA.md](utilities/javascript/fates-edge-web-client/DATA_SCHEMA.md) documents the on-disk shape of factions/patrons/regions/religions/talents/bestiary and exactly how manifest-based discovery works, including a fix so newly-added factions are discovered via `manifest.json` the same way regions already were (previously, "add a JSON file" alone did nothing for factions — you had to also edit a hardcoded slug array in source).
- **🧪 57/57 socket-server tests, 61/61 web-client tests passing** after all of the above.

## 🆕 What's New in v4.4.1

- **🧪 Real Test Coverage Across the Ecosystem** – `fates-edge-ai-gm-bot` (120 tests: drivers, tag parsing, world data), the socket server (34 tests: auth, deck region-slug resolution, adventure state machine), and the web client (49 tests, including a fixed/repaired test harness with real DOM-event and IndexedDB shims) all now have real, passing test suites where most had none before. See each repo's `TEST_TODO.md` for the full backlog and what's still open.
- **🐛 Fixed a Real Tag-Parsing Bug** – `modules/commands.js`'s `[APPLY ...]`/`[ROLL ...]`/etc. tag handlers used a stateful global regex while mutating the string it was scanning; with more than one tag of the same type in a single AI response, later tags could silently fail to resolve. Fixed across every tag handler in that file.
- **🔨 Magic Item Decay & Forage Limits** – Attuned magic items now actually decay (Maintained → Neglected → Compromised) per the Player's Guide's Attunement & Upkeep rules, driven by a `downtime-tick` event fired from the Factions tab's "GM Downtime (Faction Turn)" button. Crafting's Forage action is now capped per downtime (a web-client pacing choice, not a rulebook number — see `state.js`).
- **🎨 Crafting Modularized, No More Inline CSS** – `js/features/crafting/` split into `data.js`/`state.js`/`render.js`/`index.js`; every inline `style="..."` and injected `<style>` block replaced with real classes in `css/app.css`, which also picked up two previously-undefined-but-widely-used button classes (`.btn-secondary`, `.btn-xs`).
- **🖥️ Terminal Client Account Commands** – `/mychar list|save|delete` now exposes the account-character endpoints the terminal client's auth system already supported but never surfaced.
- **🔢 Real Semantic Versioning** – Replaced the inconsistent `4.3a`-style version scheme with strict `MAJOR.MINOR.PATCH` across every repo, plus `tools/bump-version.mjs` to automate future bumps (version sync across every `package.json`, CHANGELOG generation, git tag) — see `VERSIONING.md`.

> **Note on Session Logging & Voice Recording (historical):** at the time of this v4.4.1 entry, session logging/recording/SRT generation had been documented ahead of implementation and were pulled back to [Roadmap](#-roadmap) rather than listed as available. That gap is closed — see **Session Recording** under [Features](#-features) and the [Transcription](#transcription) section below for the current, actually-implemented state (screen+mic capture, an event-driven SRT, and both bundled into one `.zip` download).

---

## ✨ Features

### Core Tools
- **🎲 Dice Roller** — Advanced dice rolling with Story Beat tracking and outcome resolution
- **👤 Character Manager** — Create, edit, and track characters, with a dedicated Character Builder wizard, talent editor, and roller
- **⏱️ Timer System** — Visual timers for tracking threats, progress, and campaign pressure
- **⚔️ Encounter Builder** — Design and run encounters with an integrated bestiary and combat tracker
- **📚 Wiki** — Reference rules, patrons, regions, and more, with an in-app editor
- **📄 Document Viewer** — Browse and search SRD, Essentials, and GM Screen content
- **🔍 Search Everything** — Full-text search across Wiki/documents/patrons/factions/regions; zero-config local index by default, with optional pluggable Solr or Elasticsearch backends for larger deployments — see the web client's own README for setup
- **🗺️ Travel Planner** — Plan overland routes and travel time across regions

### Campaign Management
- **🏛️ Faction Manager** — Track faction standings, agendas, and relationships
- **🌟 Patron System** — Manage cosmic and terrestrial patrons with rites, witchcraft, and monastic traditions
- **📋 Kanban Board** — Organize campaign tasks, threats, and opportunities
- **✏️ Whiteboard** — Collaborative note-taking and planning
- **🛠️ GM Tools** — GM-only utilities, separated from the shared VTT view

### Magic & Character Systems (Spellcraft)
- **🔮 TAGS Calculator** — Free Caster spell construction with DV breakdown and backlash risk
- **📜 Rites** — Patron-granted rites for Runekeepers and Invokers, with obligation tracking
- **🎵 Cantor** — Songs, Push It mechanics, and a patron-scaled corruption track
- **🧹 Witchcraft** — Hedge gifts, quick workings, full rituals, and Shadow/Shame/Identity Strain tracks
- **👁️ Summoning** — A searchable bestiary, spirit binding, and Leash management
- **🥋 Monks** — Talent-gated monastic traditions, breath states, and meditation
- **📚 Spellbook** — Custom spells, signature combinations, import/export

### Advanced VTT Features
- **🔌 Real‑time WebSocket/Socket.io Sync** — Share campaign state, chat, dice rolls, characters, timers, and scenes in real time
- **🃏 Deck of Consequences** — Generate thematic complications from Story Beats, shared across all connected clients
- **👑 Crown Spread** — Campaign planning and foreshadowing tool with shared results
- **📦 Module Management** — Push and clean up modules on connected clients
- **🌍 Region Support** — Multiple regions with unique card meanings, synced across clients
- **🎤 Voice Chat** — WebRTC voice signaling for in‑game communication
- **🎙️ Session Recording** — Screen + mic capture (GM Tools → Session Recap), downloaded as a single `.zip` bundle: the `.webm` recording plus a synced `.srt` subtitle track auto-generated from in-app events (deck draws, Crown Spreads, timers, scene changes — see `js/core/media.js`). Optional best-effort live transcription (browser `SpeechRecognition`, Chrome/Edge) adds `[SPEECH]` lines to the same SRT. Not full audio transcription by itself — see [Transcription](#transcription) below for pairing it with a real speech-to-text tool.
- **👑 GM Election & Promotion** — Request GM status, approve/reject requests, view roles, and transfer GM powers seamlessly
- **🕸️ Kon'reh** — A standalone strategy board game with six AI opponent "Schools" and a live move-coaching mode

### Integrations
- **Foundry VTT Bridge** — Full module with GM election, deck, modules, region support, and real‑time sync
- **Discord Bot** — Slash commands for VTT management, GM election, deck draws, timers, and more
- **Roll20 API** — Sync chat, dice, characters, deck, and GM management
- **Avrae Module** — Use Fate's Edge commands directly in Avrae (D&D bot) with `!fe` commands
- **Terminal Client** — MUD‑style CLI for testing and administration
- **Python CLI** — Full‑featured command‑line client, rebuilt as a structured package (v5.0.0)

### AI GM Voice, TTS & Reactive Soundscape (optional)
Three independent, off-by-default features layered on the AI GM Bot (a separate sibling repo,
[`fates-edge-ai-gm-bot`](https://github.com/Chronophage-net/fates-edge-ai-gm-bot)) and relayed
through this repo's socket server, same as chat/dice/deck:
- **🎙️ Voice Narration (TTS)** — the AI GM's replies are synthesized to speech and broadcast
  alongside the text (`tts-audio` WS event). Played back in the web client (Web Audio API, opt-in
  toggle), the Foundry bridge (`AudioHelper`, opt-in setting), and the Discord bot
  (`@discordjs/voice`, opt-in channel) — acknowledged but not played in Roll20/terminal/Python
  clients, which have no audio capability.
- **🗣️ Voice Cloning (RVC)** — a second optional layer on top of TTS that re-voices the narration
  through [RVC](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI) so the GM
  consistently sounds like one specific trained voice, with an LRU cache for repeated stock lines.
- **🎵 Reactive Soundscape** — the AI GM can shift the room's background ambience to match the
  scene's mood, automatically on scene changes or explicitly mid-scene, via a new `soundboard-ambience`
  WS event; the web client's `core/soundboard.js` crossfades to the matching track. Discord posts a
  text-only "Now Playing" embed.

See the AI GM Bot's own README ("Voice Narration," "Voice Cloning," "Reactive Soundscape") for
setup, and its `DESIGN.md` for the full pipeline walkthrough. This repo's [API.md](API.md)
documents the `tts-audio`/`soundboard-ambience` WS events these features add.

### ♿ Accessibility
The web client's accessibility work is an ongoing, actively-tracked pass — focus management,
`aria-live` announcements, a high-contrast theme, labeled controls, two independent opt-in
text-to-speech features ("Type to Speak" for incoming chat, AI GM Voice Narration above for the
AI's replies), and cross-repo coverage (Foundry bridge `aria-label`s, Discord embed alt-text
audit). See the web client's own README and [`ACCESSIBILITY.md`](utilities/javascript/fates-edge-web-client/ACCESSIBILITY.md)
for the full pass-by-pass record.

---

## 🚀 Quick Start

### See it working right now (no API keys, ~2 min after the first build)

```bash
npm run demo
```

[![Screenshot of the AI GM bot narrating a live reply in the Fate's Edge web client, linking to a video demo](docs/media/demo-thumbnail.png)](docs/media/demo.mp4)

*Click to play `docs/media/demo.mp4` -- the AI GM bot joining room `DEMO`
and narrating a live reply, generated entirely by the local Ollama
instance `npm run demo` just started (no API keys, nothing cloud-hosted).*

Brings up the web client, the real-time server, Redis, a local Ollama
instance, and the AI GM bot -- wired together with sensible defaults, no
OpenAI/DeepSeek key needed (the AI GM talks to the local Ollama instance
instead). Clones `fates-edge-ai-gm-bot` as a sibling directory
automatically if it isn't already there. Then:

1. Open http://localhost:8080, create/join room `DEMO`
2. Wait ~10s -- the AI GM bot auto-joins and takes the GM seat
3. Open a second tab, join the same room, and turn on voice chat in both
   (works over plain STUN on localhost, no TURN relay needed)

The very first run also builds three Docker images and pulls a small
local model (~1.3GB) — expect a few minutes, not literally two, the
first time. Every run after that reuses the Docker cache and the
already-pulled model. See `docker-compose.full.yml`'s header comment
for the full breakdown, `.env.demo.example` for every knob (bigger/
smaller local model, ports, etc. — or just set `DEMO_LEVEL=light` /
`quality` there for an all-in-one speed/quality preset instead of
tuning each one by hand), and `npm run demo -- --down` to tear it down
(your pulled model and data stay cached).

This is a separate, self-contained file (`docker-compose.full.yml`)
from the "bring your own API key(s)" `docker-compose.yml` covered next
-- use that one instead once you're ready to plug in a real AI
provider and/or TURN relay for a real game.

### Prerequisites

- **Node.js** 24.x or later (for server components)
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, Safari)

### Web Client

The web client lives at `utilities/javascript/fates-edge-web-client/`. It runs entirely in the browser, and ships both a dev entry point (`index.html`) and a production build (`dist/`).

```bash
cd utilities/javascript/fates-edge-web-client
npm install
npm run dev      # local dev server via Vite
# or
./build.sh       # produces dist/ for static hosting
```

All data stays in your browser's `localStorage` by default — export/import JSON for backup, or connect to the real‑time server below for shared campaigns.

### Real‑Time / Campaign Sharing Server

```bash
cd utilities/javascript/fates-edge-socket-server
npm install
cp env-example.md .env   # edit with your settings
node server-start.js
```

The server listens on port 3000 by default. Connect your clients (web, Foundry, Discord, Roll20, terminal) to it. See [Real‑Time Campaign Server](#-real-time-campaign-server) for what it actually does under the hood.

### Docker (the whole ecosystem, one command)

The repo root has a single `docker-compose.yml` that brings up the web client and the real-time server together, with the AI GM bot, Discord bot, and a TURN relay (for voice chat NAT traversal) available as opt-in profiles:

```bash
cp .env.example .env       # every value is optional for the default path
docker-compose up          # client (localhost:8080) + server (localhost:10000)

# opt in to more as needed:
docker-compose --profile turn up         # + coturn TURN relay for voice chat
docker-compose --profile bots up         # + AI GM bot + Discord bot
docker-compose --profile discord-bot up  # + just the Discord bot
```

The AI GM bot lives in the separate [`fates-edge-ai-gm-bot`](https://github.com/Chronophage-net/fates-edge-ai-gm-bot) repo — clone it as a sibling directory to `fates-edge-apps` if you want the `ai-gm-bot`/`bots` profiles; every other profile works without it. See the comments at the top of `docker-compose.yml` and `.env.example` for the full option list.

Each individual app also still has its own standalone `Dockerfile`/`docker-compose.yml`/`build.sh` (`utilities/javascript/fates-edge-web-client/`, `utilities/javascript/fates-edge-socket-server/`) if you only want to run one piece in isolation.

---

## 🏗️ Architecture

```
fates-edge-apps/
├── API.md
├── docker-compose.yml             # whole-ecosystem compose: client + server + optional coturn/bots (see Quick Start)
├── .env.example
├── misc/                          # design notes, TODO, wiki seed data
├── tools/                         # repo-wide maintenance scripts (copyright headers, package sync)
├── utilities/
│   ├── javascript/
│   │   ├── fates-edge-web-client/     # Main web application
│   │   │   ├── index.html
│   │   │   ├── css/
│   │   │   ├── data/                  # regions, patrons, factions, bestiary, docs, wiki.json
│   │   │   ├── dist/                  # production build output
│   │   │   ├── js/
│   │   │   │   ├── app.js
│   │   │   │   ├── router.js
│   │   │   │   ├── module-loader.js
│   │   │   │   ├── core/              # state, sync, dice, websocket, media, gravatar, etc.
│   │   │   │   ├── components/        # Toast, CharacterCard, DocCard, TimerWidget, VoiceChat
│   │   │   │   ├── features/          # one folder per routed tab (see Modules below)
│   │   │   │   └── tools/             # data-pipeline scripts (manifests, seeds, patron migration)
│   │   │   ├── Dockerfile / Dockerfile.dev / docker-compose.yml
│   │   │   └── build.sh
│   │   ├── fates-edge-socket-server/  # Real-time WebSocket + campaign sharing server
│   │   ├── fates-edge-terminal/       # MUD-style CLI client
│   │   └── fates-edge-desktop-client/ # Electron desktop client
│   ├── python/
│   │   ├── fates_edge_tool/           # Tkinter desktop GUI (character sheet + GM screen), optional server sync
│   │   └── fates-edge-python-client/  # Python CLI client (packaged)
│   └── vtt_mods_bots/
│       ├── fates-edge-discord-bot/
│       ├── fates-edge-roll20/
│       └── foundry_fates-edge-bridge/
└── .github/workflows/                 # CI/CD (build-apps-and-packages)
```

### Module System

The web client uses a dynamic module loader that lazy-loads features on demand, registered in `js/router.js`:

```javascript
const ROUTE_IMPORTS = {
    home:        () => import('./features/home/index.js'),
    dashboard:   () => import('./features/dashboard/index.js'),
    characters:  () => import('./features/characters/index.js'),
    builder:     () => import('./features/builder/index.js'),
    dice:        () => import('./features/dice/index.js'),
    decks:       () => import('./features/decks/index.js'),
    encounters:  () => import('./features/encounters/index.js'),
    timers:      () => import('./features/timers/index.js'),
    factions:    () => import('./features/factions/index.js'),
    patrons:     () => import('./features/patrons/index.js'),
    docs:        () => import('./features/docs/index.js'),
    search:      () => import('./features/search/index.js'),
    settings:    () => import('./features/settings/index.js'),
    sync:        () => import('./features/sync/index.js'),
    whiteboard:  () => import('./features/whiteboard/index.js'),
    kanban:      () => import('./features/kanban/index.js'),
    wiki:        () => import('./features/wiki/index.js'),
    vtt:         () => import('./features/vtt/index.js'),
    'gm-tools':  () => import('./features/gm-tools/index.js'),
    spellcraft:  () => import('./features/spellcraft/index.js'),
    'kon-reh':   () => import('./features/kon-reh/index.js'),
    'travel-planner': () => import('./features/travel-planner/index.js'),
};
```

---

## 📦 Modules

### Core Features

| Module | Description | Path |
|--------|-------------|------|
| **Home** | Landing page with quick links | `features/home/` |
| **Dashboard** | Campaign overview with stats | `features/dashboard/` |
| **Characters** | Character management, builder wizard, talent editor, roller | `features/characters/`, `features/builder/` |
| **Dice** | Dice roller with Story Beats | `features/dice/` |
| **Timers** | Visual timer system | `features/timers/` |
| **Encounters** | Encounter builder, bestiary, and combat tracker | `features/encounters/` |
| **VTT** | Virtual tabletop with voice & real‑time sync | `features/vtt/` |
| **GM Tools** | GM-only utilities, separated from the shared VTT view | `features/gm-tools/` |
| **Docs** | Document viewer (SRD, Essentials, GM Screen) | `features/docs/` |
| **Search** | Global search | `features/search/` |
| **Wiki** | Reference wiki, with in-app editor | `features/wiki/` |
| **Decks** | Deck of Consequences & Crown Spread | `features/decks/` |
| **Patrons** | Cosmic & terrestrial patrons | `features/patrons/` |
| **Factions** | Faction management & assets | `features/factions/` |
| **Spellcraft** | Unified magic system UI — see sub-components below | `features/spellcraft/` |
| **Kon'reh** | Standalone strategy board game vs. AI or a second player | `features/kon-reh/` |
| **Travel Planner** | Overland route and travel-time planning | `features/travel-planner/` |
| **Kanban** | Campaign task board | `features/kanban/` |
| **Whiteboard** | Collaborative notes | `features/whiteboard/` |
| **Sync** | Sync status/config tab | `features/sync/` |
| **Settings** | Application settings, password gate, campaign sharing config | `features/settings/` |

### Spellcraft Sub-Components (`features/spellcraft/components/`)

| Component | Description |
|-----------|-------------|
| `calculator.js` | TAGS calculator for Free Casters |
| `cantor.js` / `rites.js` | Cantor songs and patron rites, shared rite-rendering logic |
| `witchcraft.js` | Hedge gifts, quick workings, full rituals |
| `summoning.js` | Bestiary browser and bound-spirit/Leash management |
| `monks.js` | Talent-gated monastic traditions and meditation |
| `spellbook.js` | Custom spell storage, import/export |
| `trackers.js` | Unified Obligation/Corruption/Leash/Mental Strain/Shadow-Shame-Identity tracks |

### Core Utilities (`js/core/`)

| Module | Description |
|--------|-------------|
| `state.js` | State management with localStorage persistence |
| `sync/` | Real-time sync via WebSocket (`conflict.js`, `offline-queue.js`, `operations.js`, `presence.js`) |
| `dice.js` | Dice rolling engine |
| `websocket.js` / `discovery.js` | WebSocket connection management and server discovery |
| `media.js` | Session recording (screen+mic capture) and its event-driven SRT/zip-bundle export — **not** the live voice chat itself (that's `VoiceChat.js`/`vtt/voice.js`) |
| `crypto.js` | Client-side hashing (used by the password gate) |
| `password.js` | Password protection |
| `gravatar.js` | Gravatar integration for presence avatars |
| `pack-manager.js` / `data.js` / `game-data.js` | Data pack loading and lookup |
| `highlight-tags.js` | Inline tag highlighting used across rules text |

### Components (`js/components/`)

| Component | Description |
|-----------|-------------|
| `Toast.js` | Toast notification system |
| `CharacterCard.js` | Character display card |
| `DocCard.js` | Document reference card |
| `TimerWidget.js` | Timer display widget |
| `VoiceChat.js` | Voice chat integration |

---

## 📂 Data Files

The toolkit loads data from JSON files at runtime, under `utilities/javascript/fates-edge-web-client/data/`:

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
│   └── bloody-fist.json, ecktorian-censorate.json, gray-ash.json,
│       house-contarini.json, iron-league.json, velvet-court.json
├── patrons/
│   ├── manifest.json
│   └── 17 patron files (e.g. inaea_angel_of_spiders.json, the_traveler.json,
│       khemesh_the_abyssal_maw.json, thrysos_king_of_revels.json, …)
└── regions/
    └── 18 region files (acasia.json, aelaerem.json, aeler.json, silkstrand.json,
        ykrul.json, zakov.json, …)
```

---

## 🔌 Integrations

### Foundry VTT Bridge

Lives inside this monorepo rather than as its own standalone module release — copy
`utilities/vtt_mods_bots/foundry_fates-edge-bridge/` into your Foundry `Data/modules/`
directory (renamed to `fates-edge-bridge`) and enable it. See that folder's own
[README](utilities/vtt_mods_bots/foundry_fates-edge-bridge/README.md) for the full install steps.

**Features:** GM election & promotion panel, Deck of Consequences & Crown Spread, module management, region support, real‑time chat/dice/character/timer/scene sync.

### Discord Bot

```bash
cd utilities/vtt_mods_bots/fates-edge-discord-bot
npm install
cp .env.example .env   # add your Discord token, client ID, VTT server URL, room code
npm start
```

**Slash Commands:** `/vtt connect`, `/vtt gm request`, `/vtt gm approve @player`, `/vtt draw 3 Acasia`, `/vtt crown Acasia`.

### Roll20 API

In Roll20, go to **Settings → API Scripts**, create a new script, and paste the contents of `utilities/vtt_mods_bots/fates-edge-roll20/api/fates-edge-api.js`. Set `FATES_EDGE_SERVER_URL` and `FATES_EDGE_ROOM_CODE`.

### Avrae Module

Copy the content of `utilities/vtt_mods_bots/avrae_module.txt` into Discord (Avrae) to create the `!fe` alias.

### Terminal & Python Clients

```bash
cd utilities/javascript/fates-edge-terminal && node terminal-client.js
# or
cd utilities/python/fates-edge-python-client && pip install -e . && fates-edge-cli --help
```

---

## 🌐 Real‑Time Campaign Server

`utilities/javascript/fates-edge-socket-server/` is more than a REST upload endpoint — it's a small real‑time backend built around a `server/` directory with `server.js`, `api.js`, `room.js` (GM election/rooms), `deck.js` (shared Deck of Consequences draws), `security.js`, `storage.js`, and both `socketio-handlers.js` and `ws-handlers.js` for the real-time transport layer. Campaigns are persisted as individual JSON files (and a `campaigns.db` index) under `server/campaigns/`. See that project's own README for the full setup and API details.

---

## 🗺️ Roadmap

**Shipped since the last update:** Voice chat (WebRTC, `js/features/vtt/voice.js` + `js/components/VoiceChat.js`) and session recording/logging (screen + mic capture with an auto-generated SRT event manifest for video editors, `js/core/media.js`, surfaced in GM Tools) are both implemented and wired end-to-end, including short-lived TURN credentials (see `docker-compose.yml`'s `turn` profile) so voice chat traverses symmetric NAT / restrictive firewalls, not just STUN-friendly networks. The recording and its SRT now download together as a single `.zip` bundle instead of two separate files, and an opt-in best-effort live-transcription mode (browser `SpeechRecognition`) can fold `[SPEECH]` lines into that same SRT — see [Transcription](#transcription). A single root `docker-compose.yml` now also brings up the whole ecosystem (client + server + optional bots) in one command — see [Quick Start](#-quick-start). Licensing is also now spelled out in plain language per-category (code/SRD/proprietary) in [COMMUNITY_USE_POLICY.md](COMMUNITY_USE_POLICY.md), and the `LICENSE.code`/`LICENSE.srd`/`LICENSE.proprietary` files the badges above link to actually exist now. A **System Status** page (sidebar → System → 🩺 Status, `js/features/system-status/`) now shows real-time server connection, voice chat + TURN availability, active recording, sync/offline-queue state, who's in the room, and browser feature support, all auto-refreshing. The installable-adventure **module system** (`/api/modules`, push/cleanup) has been fixed end-to-end (it was pointed at a directory that never existed) and is documented in [MODULES.md](utilities/javascript/fates-edge-socket-server/MODULES.md); the custom-content **data schema** is documented in [DATA_SCHEMA.md](utilities/javascript/fates-edge-web-client/DATA_SCHEMA.md).

**Also since then (through v4.8.3):** a second original card game, **Toll & Veil**, shipped with the same three play modes as Kon'reh (pass-and-play, solo vs. AI, host-authoritative real-time table) plus an opt-in stakes system and its own in-app guide. Co-GM roles were added and propagated across the Discord bot, AI GM bot, Foundry bridge, and Roll20 integration, which closes out the "VTT/bot audit" item that used to sit in this section. A security sweep of the new multiplayer path fixed stored XSS in lobby/challenge banners, closed a sender-identity spoofing hole in the socket server's generic event relay, and stopped forged stake-transfer messages from bypassing agreed caps.

**Also shipped (v4.9.0):** optional Redis-backed horizontal scaling for the socket server (opt-in via `REDIS_URL`; single-instance/no-dependency behavior unchanged by default) — see [`SCALING.md`](utilities/javascript/fates-edge-socket-server/SCALING.md). This closes out the "horizontal server scaling" item that used to sit in this section.

**Also shipped (v4.11.1):** the Adventure Timer Sync Loop now closes end-to-end (a tick from any client/AI GM updates every connected client's timer display, not just the sender's own optimistic local state); one-click Adventure Module install from Settings (metadata preview + install, no manual JSON placement); and character sync is now bidirectional (local edits push automatically instead of only at connect), with `patron` now included so the AI GM bot's status dashboard can show Obligation totals grouped by Patron.

Features that have been discussed or partially scaffolded but are **not yet implemented** in this build:

- **Session Playback / Export** — replaying or exporting a recorded/logged session as HTML/Markdown/plain text (beyond the SRT event manifest recording already produces).
- **Full audio transcription** — see [Transcription](#transcription) immediately below for the honest current state and how to get a real transcript today without waiting on this.

If you were looking for the voice-chat/logging line from an earlier README revision: it was documented ahead of implementation at the time and pulled back to this roadmap section — it has since actually shipped, per the note above.

### Transcription

The SRT that Session Recording produces is **event-driven, not audio transcription** — it's built from in-app actions (deck draws, Crown Spreads, timer ticks, scene changes, chat highlights, etc. — see `logRecordingEvent()` call sites in `js/features/decks/index.js` and elsewhere) plus, if you opt in, best-effort speech recognition. It is not a substitute for a real spoken-word transcript, and we're deliberately not building a hosted speech-to-text pipeline for this project — that's a substantial, well-solved problem elsewhere, and duplicating it here would be scope creep for what is fundamentally a VTT.

Two ways to get an actual transcript today, in increasing order of effort:

1. **Opt-in live transcription (built in, zero setup).** GM Tools → Session Recap → check "🗣️ Live transcription" before hitting Record. Uses the browser's own `SpeechRecognition` API (Chrome/Edge; the checkbox disables itself where unsupported) to fold recognized speech into the same SRT as `[SPEECH]` lines, timestamped alongside the game events. Best-effort, single-language-at-a-time, no correction pass — good enough for search/skimming, not for publishing verbatim.
2. **Run the exported audio through a real speech-to-text tool after the fact.** The `.webm` inside the session recording `.zip` has a full audio track. Feed it to an existing open-source or hosted transcriber — [whisper.cpp](https://github.com/ggerganov/whisper.cpp) or [faster-whisper](https://github.com/SYSTRAN/faster-whisper) run locally (free, private, works offline), or a cloud STT API if you'd rather not run anything locally — and you'll get a proper, corrected transcript/SRT. Most of these tools accept `.webm`/extracted `.wav` directly and can emit their own `.srt`, which you can then align alongside (or merge with) the event SRT from this app in your editor of choice. This repo intentionally doesn't wrap or bundle one of these tools — pick whichever fits your accuracy/cost/privacy tradeoff, since that choice is genuinely yours to make, not ours.

---

## 🔐 License

**New here?** [COMMUNITY_USE_POLICY.md](COMMUNITY_USE_POLICY.md) is a plain-language FAQ over the license files below — start there if you're wondering "can I do X with this repo."

### Code (MIT License)
All source code in this repository is licensed under the **MIT License**. See [LICENSE.code](LICENSE.code).

### SRD & Essentials (CC BY-NC-SA 4.0)
Licensed under **CC BY-NC-SA 4.0**. See [LICENSE.srd](LICENSE.srd).

### Copyright (All Rights Reserved — Freely Distributed)
© **Nicholas A. Gasper**, All Rights Reserved, distributed for free as part of this toolkit: setting lore, original characters/NPCs, faction descriptions, proprietary magic systems (Runekeeper, Invoker, Cantor, Summoner, Witch, Monk, etc.), artwork/maps, original prose, the Deck of Consequences and Crown Spread systems, the Travel Framework and regional generators, and the Kon'reh board game.

**You may use this content for personal, non-commercial purposes.** For commercial use, contact **support@fates-edge.com**.

| Component | License | Commercial Use |
|-----------|---------|----------------|
| Source Code | MIT | ✅ Yes |
| SRD Content | CC BY-NC-SA 4.0 | ❌ No |
| Essentials Guide | CC BY-NC-SA 4.0 | ❌ No |
| Copyright | All Rights Reserved | ❌ No (permission required) |

---

## 🤝 Contributing

Found a security issue? See [SECURITY.md](SECURITY.md) for how to report it
privately rather than filing a public issue.

Working on accessibility? See the web client's [`ACCESSIBILITY.md`](utilities/javascript/fates-edge-web-client/ACCESSIBILITY.md) for the current state, the last audit's findings, and what's still open.

1. **Fork the repository** and create your branch from `main`
2. **Follow the code style** — use existing patterns
3. **Add tests** for new functionality when possible
4. **Update documentation** as needed
5. **Submit a pull request** with a clear description of changes

### Code Style

- ES modules (`import`/`export`), `const`/`let` only, async/await, template literals, arrow functions for callbacks, JSDoc for functions.

---

## 🏆 Credits

- **Creator & Author**: Nicholas A. Gasper
- **Inspiration**: Fate's Edge TTRPG system
- **Built With**: Vanilla JavaScript, CSS, Node.js, WebSocket, WebRTC

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/Chronophage-net/fates-edge-apps/issues)
- **Email**: support@fates-edge.com
- **Website**: [fates-edge.com](https://fates-edge.com)

---

> *"The coin that never spends is the one you don't remember taking."*
> — Serafine of the Velvet Touch

---

## 📋 Version History

### v4.16.0 (Current)
- **Added** Adventure Engine climax pacing/forcing — `climaxPadScenes`/`climaxScenesSinceTrigger`/`climaxForced` state fields, new `POST /api/rooms/:code/adventure/climax-forced` route + `adventure-climax-forced` broadcast, `climaxPadScenes` on `load-custom`
- **Added** `persistence` field on `GET /api/rooms/:code/adventure/reference`, surfacing a loaded module's Legacy Tracker schema read-only
- **Added** Per-room seedable deck RNG (`server/rng.js`, xorshift128) with `GET`/`POST /api/rooms/:code/deck/seed`; `deck.js`'s `buildDeck()`/`shuffleArray()` take an optional `rng` param (defaults to `Math.random`)
- **Changed** Web client's card-text renderer now sanitizes with DOMPurify when loaded

### v4.15.0
- **Added** `docs/media/demo.mp4`/`demo-thumbnail.png` — a real recording of `npm run demo`, embedded in the README Quick Start
- **Added** Adventure Engine structured `knowledge[]` state, reveal/hide REST + socket events, `getPublicState()`/`getReferenceData()` split
- **Fixed** Demo client was hardcoded to the hosted production WebSocket server instead of the local demo stack — now overridable via `VITE_WS_URL`/`VITE_WS_ROOM`/`VITE_SERVER_URL` build args, wired up for the demo build
- **Fixed** Five first-run bugs in the demo stack: missing `pull_policy` on locally-built services, `.dockerignore` excluding `package-lock.json`, missing `--break-system-packages` on `pip3 install`, unquoted `AIGM_BOT_NAME` breaking env sourcing, `OLLAMA_PORT` colliding with native Ollama installs
- **Changed** `tools/demo.sh` generates a random per-run `API_KEY`, warns about the lightweight default model, and notes first-reply load time

### v4.14.0
- **Added** General per-IP API rate limiting across the whole REST API (`API_RATE_LIMIT_WINDOW_MS`/`API_RATE_LIMIT_MAX`), previously only on login/register
- **Added** Per-connection WebSocket message rate limiting on both transports (`WS_MESSAGE_RATE_WINDOW_MS`/`WS_MESSAGE_RATE_MAX`)
- **Added** Per-room client cap (`MAX_CLIENTS_PER_ROOM`, default unlimited)
- **Added** Node `cluster`-based multi-core scaling (`CLUSTER_WORKERS`), combinable with `REDIS_URL`
- **Docs** `DESIGN.md`/`SCALING.md`/`ROADMAP.md`/`env-example.md` updated for all three; `tests/security.test.js`/`tests/cluster.test.js`/`tests/room-cap-and-rate-limit-wiring.test.js` added

### v4.13.1
- **Added** Web client role picker — the "Party Members" presence list now has an in-app role `<select>` + persist checkbox + "Set" button, GM-only, gated on the viewer's live presence role
- **Docs** `ROLES.md`'s code-location table updated

### v4.13.0
- **Added** `POST /api/rooms/:code/clients/:clientId/role` — REST equivalent of the socket-only `role_change_request` event, API-key-authorized
- **Added** Discord bot `/vttadmin role <target> <role> [save]` slash command
- **Added** Foundry bridge GM Management panel role dropdown + persist checkbox + "Set" button
- **Fixed** Roll20 `!fates-edge role set`/`role list` usage text and role-label maps across Discord/Foundry/Roll20 now document/handle `assistant-gm`

### v4.12.0
- **Added** `assistant-gm` as a fourth assignable room role (alongside GM/Co-GM/Player/Spectator), so a GM can hand the AI GM Bot a middle tier between full narrative control and doing nothing
- **Changed** Deliberately not added to `GM_LIKE_ROLES` — carries no elevated server-side permissions of its own

### v4.11.1
- **Added** Adventure Timer Sync Loop closed end-to-end — `timer-ticked` broadcasts are now consumed on both WS transports and reconciled into local adventure/timer state (previously fired, but nothing listened)
- **Added** One-click Adventure Module install from Settings (metadata preview + install; no manual JSON placement)
- **Added** Bidirectional character sync — local edits push to the server automatically (debounced), not just at connect
- **Added** `patron` field to the character sync payload, enabling per-Patron Obligation totals downstream (see the AI GM bot's status dashboard)
- **Docs** README/CHANGELOG/API/DESIGN pass across the web client and socket server covering all of the above

### v4.11.0
- **Changed** Documentation pass across the ecosystem ahead of the AI GM bot going public: fixed broken/fictional cross-repo links in the Discord bot, Roll20, and Foundry bridge READMEs; rewrote root `SECURITY.md`; fixed a stale roadmap section; consolidated Kon'reh's rules doc
- **Fixed** `scaling.test.js` could hang indefinitely once Redis shipped as a real optional dependency (assumed it was never installed in test environments)

### v4.10.0
- **Added** Optional Elasticsearch search backend for the web client (`window.__ES_URL`/`__ES_API_KEY`), alongside the pre-existing (now documented) Solr option
- **Added** `window.__SEARCH_BACKEND` to force Solr or Elasticsearch when both are configured
- **Added** Search backend status to the System Status page
- **Added** 12 new tests for the search feature; added a `sessionStorage` test-harness shim
- **Fixed** Solr/Elasticsearch config is now read live instead of cached at module-import time
- **Changed** Documented the search feature's backend options in the web client's README (previously undocumented)

### v4.9.0
- **Added** Optional Redis-backed horizontal scaling for the socket server (`REDIS_URL`, off by default) — see `SCALING.md`
- **Added** `ROLES.md` and `ROADMAP.md` for the socket server
- **Changed** Rewrote the socket server's `DESIGN.md` against the actual code; removed aspirational Redis-caching/PDF-conversion/email/scheduling content that was never implemented
- **Changed** Web client's `DESIGN.md` no longer duplicates server architecture/deployment content — points at the server's own docs
- **Fixed** Socket server `package.json`'s broken `main` field; de-duplicated `server/server.js` (was a full copy of `server/index.js`)

### v4.8.3
- **Added** Toll & Veil, a second original card game (host-authoritative real-time multiplayer over the VTT relay, opt-in Points/XP/String stakes, in-app guide)
- **Fixed** Security sweep of the Toll & Veil multiplayer path: stored XSS in lobby/challenge banners, sender-identity spoofing in the socket server's `event` relay, forged stake-transfer messages, missing input sanitization on network-supplied lobby data
- **Fixed** Trust cards (e.g. "The Silk Coin") silently orphaned when real faction files loaded, producing "Trust not found"
- **Fixed** Cantor's Songs list required a manual refresh on every first load
- **Changed** AI GM bot's status dashboard binds to `127.0.0.1` by default instead of all interfaces (`STATUS_HOST` to opt into LAN exposure)

### v4.8.2
- Toll & Veil engine/UI landed and working end-to-end

### v4.8.1
- Socket server persistence/Dockerfile fixes, web client compose cleanup, INSTALL guides for server/client/bot

### v4.7.1
- Copyright language updates; mods/bots hardened against HTML injection; Kon'reh doc and package-manager updates; desktop client finished

### v4.7.0
- Security hardening pass (XSS fixes, auth rate limiting, input length limits); multi-character "Remote enabled" control (up to 6 characters per client)

### v4.6.1–v4.6.3
- Talent catalog overhaul (10 → 55 JSON-per-talent entries, tagging + category filters, starter/XP-appropriate recommendations); Modern Noir theme and a themeable UI engine; adventure/patron data syncs; one security fix (HTML parsing follow-up noted as still open at the time)

### v4.6.0
- **Added** Diverse encounter objective-type clocks (Obstruction, Skill Challenge, Trap/Ward, Lockpick, Heist, Social, Custom) instead of hardcoded Harm/Heal
- **Added** Phase-aware Kon'reh AI (opening/midgame/endgame recognition, Sanctum Seed tempo, Reforge-race search depth)
- **Fixed** Patrons/Cantor requiring a manual refresh, root-caused to a 1-hour discovery cache never bypassed on forced reload
- **Fixed** Redundant auto-symbol injection in the character editor/wizard that could silently corrupt `char.symbols` on save

### v4.5.1
- **Added** "Jump to the Action" one-click flow in the welcome overlay: pre-gen character + starter adventure + a link to the Essentials doc
- **Added** `data/pre-gens.json` with three pre-gen characters themed to *The Lantern at Dusk*
- **Fixed** The old Quick Start button's pre-gen loading step had silently failed forever — `data/pre-gens.json` never existed
- **Fixed** A double-fire bug where the quick-start click could run twice (delegated container handler + the overlay's own direct listener)

### v4.5.0
- **Added** TURN credential minting (`server/turn.js`, `GET /api/turn-credentials`) and a `coturn` docker-compose service, so voice chat traverses symmetric NAT/restrictive firewalls
- **Added** Unified root `docker-compose.yml` bringing up client + server + optional bots in one command
- **Added** `COMMUNITY_USE_POLICY.md` plus split `LICENSE.code`/`LICENSE.srd`/`LICENSE.proprietary` files
- **Added** System Status page (`js/features/system-status/`)
- **Added** [MODULES.md](utilities/javascript/fates-edge-socket-server/MODULES.md) and [DATA_SCHEMA.md](utilities/javascript/fates-edge-web-client/DATA_SCHEMA.md)
- **Fixed** Voice signaling was silently dropped over Socket.io, and voice-status broadcasts were missing the `clientId` peers need to identify the sender
- **Fixed** `getConnectedClients()`/`get-clients` only worked over Socket.io; the plain-WS default transport always timed out to an empty list
- **Fixed** The module system's storage path resolved to a directory (`server/modules/`) that has never existed, in 5 places across 2 files — every module install/list/push/cleanup call failed in every deployment. Also fixed: missing plain-WS handlers for module events, a broken `generate-manifest.js` require path, a misnamed shipped example module, and pushed modules never installing into the pushing GM's own client.
- **Fixed** Factions were only discoverable via a hardcoded slug array; now tries `data/factions/manifest.json` first, consistent with regions (which had the same bug, also fixed this cycle)

### v4.4.1
- **Added** Full test suites across the ecosystem (ai-gm-bot, socket server, web client — see "What's New" above)
- **Added** Magic item decay/upkeep tracking (Maintained → Neglected → Compromised) tied to a new `downtime-tick` event, and a per-downtime Forage limit in Crafting
- **Added** `/mychar` account-character commands in the terminal client
- **Added** `tools/bump-version.mjs` — automated semver bump + CHANGELOG + git tag across every repo, see `VERSIONING.md`
- **Fixed** A tag-parsing regex-desync bug in the AI GM bot's `modules/commands.js` affecting multiple same-type `[TAG ...]`s in one response
- **Changed** Version scheme moved from `4.3a`-style to strict semver (`MAJOR.MINOR.PATCH`)
- **Changed** Crafting feature split into `data.js`/`state.js`/`render.js`/`index.js`; all inline CSS moved into `css/app.css`

### v4.3a
- **Added** Account authentication on the campaign server — register/login with bcrypt-hashed passwords and JWT sessions, alongside the existing API-key and playtester-password gates
- **Redone** Python CLI client, now a structured package (`cli/`, `rest_client.py`, `ws_client.py`, `shell.py`) at v5.0.0
- **Updated** Foundry VTT bridge and Roll20 API mod integrations
- **Changed** All feature pop-up modals replaced app-wide with inline "editor screen" views (real in-place navigation with a `← Back` button instead of floating dialogs)
- **Rebuilt** Theona, Linn, Vilikari, Black Banners, and The Ways Between region data from authored source material into the standard rich schema
- **Fixed** Flattened/dimmed region description rendering in the Decks region browser and Crown Spread
- **Removed** The standalone AI GM Bot — no longer part of the toolkit or its integrations

### v4.1.2b
- **Added** Kon'reh, an original strategy board game with six AI "Schools" and Coach Mode
- **Added** Travel Planner module
- **Added** GM Tools as its own dedicated tab
- **Added** Spellcraft: a unified magic-system UI (Calculator, Rites, Cantor, Witchcraft, Summoning, Monks, Spellbook, Trackers)
- **Changed** Monk is now talent-gated rather than tied to a magic path — any character can walk it
- **Fixed** blank/broken Spellcraft tabs caused by async components rendering into detached DOM nodes
- **Fixed** duplicate tab-click event handlers firing twice per click
- **Moved** Session Logging, Voice Recording, and SRT generation to [Roadmap](#-roadmap) — previously documented as shipped, never actually implemented

### v4.0.0a
- Documented (but did not ship) session logging, voice recording, and SRT subtitle generation
- Real-time WebSocket sync, Deck of Consequences, Crown Spread, GM election
- Foundry VTT bridge, Discord bot, Roll20 API, Avrae module, Terminal client, Python CLI client
- Faction management, Patron system, Kanban board, Whiteboard

### v3.0
- Complete modular architecture, WebSocket real-time sync, voice chat via WebRTC, GM election & promotion, faction management, patron system, Deck of Consequences & Crown Spread, campaign Kanban board, whiteboard, Foundry bridge, Discord bot, Roll20 API, Avrae module, terminal client, Python CLI client, desktop client (Electron)

### v2.0
- Character management, dice roller with Story Beats, timer system, encounter builder, wiki system

### v1.0
- Initial release with core features

---

<p align="center">
  <sub>Made with ❤️ by Nick Gasper</sub>
</p>
