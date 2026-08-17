# Changelog
All notable changes to this project will be documented here.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/), versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [4.15.0] - 2026-08-17

### Added
- **`npm run demo` / `docker-compose.full.yml`** — a self-contained, zero-API-key demo stack distinct from the main `docker-compose.yml`: web client, real-time server, Redis, a local Ollama instance (small model auto-pulled by a one-shot `ollama-pull` init container), and the AI GM bot wired to that local Ollama instance instead of a paid provider. `tools/demo.sh` (invoked via the new npm script) auto-clones the sibling `fates-edge-ai-gm-bot` repo if missing, generates `.env.demo` from `.env.demo.example` on first run, and prints the exact URLs/room to open once the stack is healthy — including the AI GM bot's own status dashboard (`STATUS_HOST=0.0.0.0` set explicitly for the demo, since it binds to loopback-only by default and would otherwise be unreachable through the container's port mapping). `npm run demo -- --down` tears the stack down while keeping the pulled model/Redis data/server logs cached in named volumes, so a second run is much closer to the "two minutes" the demo aims for than the first.
- **Adventure Engine: structured knowledge state** (`fates-edge-socket-server/server/adventure.js`). Adventure modules can now define a `knowledge[]` array of `{ id, subject, gm, player, revealed, revealCondition, tags }` entries — an explicit, queryable game-state answer to "what is the party allowed to know right now?" instead of leaving it to be inferred from `_gmhints` prose (still fully supported, unchanged). `revealed` is live state, reset to its authored value on every `loadAdventureModule()`/`loadAdventureContent()` alongside existing scene/timer resets, and flipped at runtime via new `revealKnowledge(room, id, { by })` / `hideKnowledge(room, id, { by })`.
- Two new REST routes: `POST /api/rooms/:code/adventure/knowledge/reveal` and `.../knowledge/hide`, both `{ id, by? }`, broadcasting `adventure-knowledge-revealed`/`-hidden` to the room. Same `authenticate`-only gating as the rest of the Adventure Engine's routes — no new role/permission model introduced.
- `getPublicState()` (the player-safe live-state fetch) now includes a filtered `knowledge` view — `{ id, subject, revealed, text }`, where `text` is the entry's `player` text pre-reveal and its full `gm` text once revealed. `gm` and `revealCondition` are never included here.
- `getReferenceData()` (the existing GM/AI-eyes-only reference fetch, already home to full NPC/bestiary/notes secrets) now includes the full `knowledge[]` array unfiltered — this is what `fates-edge-ai-gm-bot`'s system prompt is built from.
- Matching Socket.IO/plain-WS parity for the two new REST routes above: `adventure-knowledge-reveal` / `adventure-knowledge-hide` events on both transports (`ws-handlers.js`, `socketio-handlers.js`), broadcasting the same `adventure-knowledge-revealed` / `adventure-knowledge-hidden` events — same one-event-per-REST-route convention every other Adventure Engine route already follows.

### Changed
- **Demo stack polish pass** (`tools/demo.sh` / `docker-compose.full.yml` / `.env.demo.example`), following a review of the initial `npm run demo` cut:
  - `tools/demo.sh` now generates a random 32-char `API_KEY` (via `openssl rand -hex 16`, falling back to `node`'s `crypto` module or `/dev/urandom` if `openssl` isn't available) and writes it into `.env.demo` the first time that file is created, instead of leaving the static `demo-local-key-change-me` placeholder from `.env.demo.example` in place. The example file's own comment now explains this so it doesn't read as a contradiction.
  - `tools/demo.sh`'s startup output now warns when the default `llama3.2:1b` model is in use ("its writing can get nonsensical on complex TTRPG scenarios... not broken, just a very small model") and points at `DEMO_OLLAMA_MODEL=llama3.2:3b`/`mistral` as better options — previously this tradeoff was only documented in `.env.demo.example`'s comments, easy to miss if you never open that file.
  - `tools/demo.sh`'s startup output now also notes that the AI GM bot's very first reply may take an extra 10-30s while Ollama loads the model into memory, so a first-time user doesn't mistake that pause for the stack being broken.
  - `docker-compose.full.yml`'s `OLLAMA_CONTEXT_WINDOW` comment expanded to explain it's sent straight through to Ollama as `num_ctx` (not just used for this bot's local trimming budget — see the matching `fates-edge-ai-gm-bot` fix below) and to point at `ollama show <model>` for checking a model's real context ceiling before bumping it.

### Fixed
- **Demo stack: client silently connected to the hosted production server instead of the local demo stack.** `fates-edge-web-client`'s WebSocket URL/room/server defaults (`js/features/settings/index.js`) were hardcoded to `wss://fates-edge-socket-server.onrender.com`, so opening `http://localhost:8080` after `npm run demo` looked like it worked (client loads, "Connected to server" toast) but was actually talking to production, not the containers `npm run demo` just started -- room "DEMO" never had the AI GM bot in it because the bot and the browser were on two different servers entirely. Found and fixed while producing a demo recording: those three defaults are now overridable via Vite build-time env vars (`VITE_WS_URL`/`VITE_WS_ROOM`/`VITE_SERVER_URL`, plumbed through the client's `Dockerfile` as build `ARG`s), and `docker-compose.full.yml`'s `client` build now sets them to `ws://localhost:<SERVER_PORT>` / `DEMO_ROOM` / `http://localhost:<SERVER_PORT>` -- so a freshly built demo image points at itself out of the box. The production (non-demo) build is unaffected: with the build args unset it falls back to the exact same hardcoded hosted-server defaults as before.
- **Three disagreeing default room codes across the codebase, none of which matched `fates-edge-ai-gm-bot`'s own default (`AC12`).** The web client alone had two independently hardcoded fallbacks that disagreed with each other: `js/core/websocket.js`'s `CONFIG.DEFAULT_ROOM` (`'VTRM'` — the one actually used to auto-join on a fresh connection with nothing in `localStorage`/Settings) and `js/features/settings/index.js`'s `DEFAULT_WS_ROOM` (`'vtt-room'` — only the Settings-panel placeholder/pre-fill, never actually connected-to by itself). Root `docker-compose.yml`'s AI GM bot profile added a *third* value (`AIGM_ROOM:-AIGM`). A first-time user following the README's own instructions (open the client, run the bot) would never land in the same room as the bot without manually typing a room code somewhere. All three now default to `AC12`, matching `ai-gm-bot.js`'s own hardcoded default and `DISCORD_ROOM_CODE`'s existing default -- one canonical default room across every entry point. `.env.example` and `fates-edge-ai-gm-bot/env-deepseek.md`'s example also updated to match. `docker-compose.full.yml`'s demo stack is unaffected -- it already drove both the client and the bot from the same `DEMO_ROOM` variable, so it was internally consistent even before this fix.
- Also discovered and fixed running the demo stack for the first time (all pre-existing bugs in `fates-edge-apps`/`fates-edge-ai-gm-bot`, unrelated to the demo work itself, just surfaced by actually running it end to end):
  - `fates-edge-socket-server/.dockerignore` excluded `package-lock.json`, breaking `npm ci` in every Docker build of that service.
  - `fates-edge-socket-server/Dockerfile`'s `pip3 install` had no `--break-system-packages`, which newer Alpine/Python (PEP 668) rejects outright.
  - `docker-compose.full.yml`'s three locally-built services (`client`/`server`/`ai-gm-bot`) had no `pull_policy`, so Compose V2 tried to *pull* them from a registry instead of building locally and failed with "repository does not exist."
  - `.env.demo(.example)`'s `AIGM_BOT_NAME=AI GM` was unquoted, breaking `tools/demo.sh`'s `source "$ENV_FILE"` step (`AI` got treated as an assignment, `GM` as a command).
  - `OLLAMA_PORT` defaulted to 11434, colliding with a native (non-Docker) Ollama install on the same machine -- remapped the default to 11435.

### Docs
- README's Quick Start now embeds `docs/media/demo.mp4` (with a `docs/media/demo-thumbnail.png` poster frame) right under the `npm run demo` command -- a real recording of the demo stack running: the AI GM bot joining room `DEMO` and narrating a live reply generated by the local Ollama instance, no API keys or cloud services involved.

## [4.14.0] - 2026-08-14

Addresses three abuse-hardening/scaling gaps flagged from a review of the socket-server's `DESIGN.md`: no general API rate limiting, no way to use more than one CPU core on a single machine, and no cap on how many clients a single room can hold.

### Added
- **General API rate limiting** (`fates-edge-socket-server`): a broad, generous per-IP limiter (`API_RATE_LIMIT_WINDOW_MS`/`API_RATE_LIMIT_MAX`, default 300 req/min) now covers the whole REST API, not just `/api/auth/login`/`/api/auth/register` — mounted via `router.use(...)` right after the health-check routes so uptime probes/load-balancer health checks are never throttled. Reuses the existing hand-rolled `security.js` limiter (no new dependency) rather than adding `express-rate-limit`.
- **Per-connection WebSocket message rate limiting**: a second limiter (`WS_MESSAGE_RATE_WINDOW_MS`/`WS_MESSAGE_RATE_MAX`, default 120 msgs/10s) caps inbound messages/events per CONNECTION on both transports — `socket.use()` inbound middleware for Socket.IO (covers all ~40 event types through one gate), an inline check before the message switch for plain-ws. A rate-limited message is dropped with a warning, not a disconnect. Both new limiters can be disabled independently by setting their `_MAX` to `0`.
- **Per-room client cap** (`MAX_CLIENTS_PER_ROOM`, default `0` = unlimited): rejects new joins once a room already holds this many clients, checked at join time on both transports.
- **Node `cluster`-based multi-core scaling** (`CLUSTER_WORKERS`, integer > 1 or `auto` for one worker per CPU core): a simpler alternative to `REDIS_URL`-based horizontal scaling for the specific case of using more of one machine's CPU cores, with no external dependency. Uses the official `@socket.io/sticky` (session-affine routing — required, since Socket.IO's polling transport makes multiple sequential requests per connection that must all land on the same worker) and `@socket.io/cluster-adapter` (cross-worker Socket.IO broadcast relay), plus a small custom cluster-IPC relay for plain-ws clients mirroring `scaling.js`'s Redis pub/sub relay in shape. Combines with `REDIS_URL` (Redis takes priority for both adapters when both are configured — it's a superset, covering every worker on top of every machine). **Verified with a real two-worker smoke test during development**: two Socket.IO clients confirmed landing on different worker PIDs via least-connection balancing, with a broadcast from one reaching the other through the cluster adapter, plus a live HTTP round-trip (health check + REST API call) through the primary → worker routing path.

### Docs
- `fates-edge-socket-server/DESIGN.md` §5 and its config table updated for all three new features; `SCALING.md` restructured into "Multi-core scaling (single machine)" and "Horizontal scaling (multiple machines, Redis)" sections; `ROADMAP.md`'s "General API rate limiting" open item closed out; `env-example.md` documents the new variables.

### Tests
- New `tests/security.test.js` (unit coverage for both rate limiters — previously untested even for the pre-existing login/register limiter), `tests/cluster.test.js` (config-gating + graceful-fallback, mirroring `scaling.test.js`'s pattern), and `tests/room-cap-and-rate-limit-wiring.test.js` (source-level guards confirming both transports actually wire the new checks in, matching the existing `get-clients.test.js` precedent for this style of coverage). Full socket-server suite: 114/114 passing.

## [4.13.1] - 2026-08-14

Closes the last gap from 4.13.0: the web client now has its own in-app role picker, so a GM doesn't have to leave the browser and reach for Discord/Foundry/Roll20 to promote or demote a party member.

### Added
- **Web client role picker** (`js/features/vtt/vtt-core.js`'s `renderLocalPresence()`): every non-self, non-GM row in the "Party Members" presence list now shows a role `<select>` (Co-GM / Assistant GM / Player / Spectator) + a "save" persist checkbox + a "Set" button, visible only when the viewing client's own **live presence role** is `gm` — deliberately not gated on the broader `isGmLikeRole()` UI-visibility helper (which also treats Co-GM as GM-like), since the server's `role_change_request` handler enforces changes with a strict `role === 'gm'` check (`canManageGmSeat()`) and would reject a Co-GM's attempt anyway.
- New `changeRole(targetId, role, persist)` export in `core/websocket.js`: dual-transport (Socket.IO / raw WebSocket), fire-and-forget, matching the existing kick/ban call pattern in that file. The result arrives asynchronously as a `role_update` broadcast (already handled by `vtt-connected.js`'s `roleUpdateHandler`, unchanged) rather than a direct response.

## [4.13.0] - 2026-08-14

Adds a REST equivalent of role assignment (`POST /api/rooms/:code/clients/:clientId/role`), and wires up the actual role-assignment UI/commands that were missing across the ecosystem — previously only the Roll20 integration had a working `!fates-edge role set` command; the Discord bot and Foundry bridge both had the underlying `changeRole()` plumbing already but no command/UI ever called it, and the web client still has no picker at all (unchanged this release).

### Added
- **`POST /api/rooms/:code/clients/:clientId/role`** (socket-server, `server/api.js`): API-key-admin equivalent of the socket-only `role_change_request` event, for integrations that don't hold a live GM connection (the Discord bot's admin commands are otherwise entirely REST-based). Calls a new `room.setClientRole()`, which shares its mutate/persist/broadcast core (`_applyRoleChange()`) with the existing socket path but has no sender/GM-seat check — the API key itself is the authorization, exactly like the neighboring kick/ban routes. `byId` in the resulting `role_update` broadcast is `'api'` rather than a client id.
- **Discord bot**: new `/vttadmin role <target> <role> [save]` slash command (Co-GM / Assistant GM / Player / Spectator), using the bot's existing live-socket `changeRole()` method — the same transport `/vttadmin kick`/`ban` already use, not the new REST route.
- **Foundry bridge**: the GM Management panel's client list now has a role dropdown + persist checkbox + "Set" button on every non-GM row, visible only to the current GM.
- **Roll20 integration**: `!fates-edge role set`/`role list` usage text now documents `assistant-gm` as an accepted value (the underlying command already forwarded any string to the server unvalidated, so this was a docs-only gap).

### Fixed
- Role-label maps (`Co-GM`/`Assistant GM`/`Player`/`Spectator`) updated in the Discord bot, Foundry bridge, and Roll20 integration's `role_update` handlers — previously fell through to the raw `'assistant-gm'` string.

## [4.12.0] - 2026-08-14

Adds `'assistant-gm'` as a fourth assignable room role (alongside GM/Co-GM/Player/Spectator), so a GM can hand the AI GM Bot a middle tier between full narrative control and doing nothing — see the `fates-edge-ai-gm-bot` repo's v4.10.0 changelog for what the bot does with it. This repo's changes are entirely about legalizing and labeling the role; the bot-side behavior lives in that repo.

### Added
- **`assistant-gm` room role**: added to `server/room.js`'s `ASSIGNABLE_ROLES` (assignable via the existing `role_change_request` socket event, same GM-only promote/demote flow as Co-GM) and to `server/auth.js`'s `VALID_ROLES` (so a persisted grant can be re-claimed directly at handshake on reconnect, matching Co-GM). Demotions off `assistant-gm` always persist, same as Co-GM.
- Deliberately **not** added to `security.js`'s `GM_LIKE_ROLES` — `assistant-gm` carries no elevated server-side permissions (character-edit rights, GM-only data, etc. all stay gated the same as `player`). Its only effect is on the AI GM Bot's own in-process narration behavior.
- Role-label maps updated in the web client (`vtt-connected.js`) and `API.md`/`server/api.js`'s inline docs.

### Docs
- `API.md`, socket-server `server/api.js` inline docs, and the web client's role-change toast all updated to mention the new role.

## [4.11.1] - 2026-08-13

Adventure Timer Sync Loop closed end-to-end, one-click Adventure Module install from Settings, and character edits now push to the server live instead of only at connect — see the "Added" section below. Docs across the web-client and socket-server updated to match.

### Added
- **Adventure Timer Sync Loop**: the server already ticked timers authoritatively and broadcast the result (`timer-ticked`) on every `[scene|campaign]` timer tick, but no client listened for that broadcast — other clients (and the sender, on drift) never saw the canonical result. `core/websocket.js` now handles `timer-ticked` on both transports, and `adventure-manager/index.js`'s new `applyRemoteTimerTick()` reconciles the local timer to match.
- **Adventure Module Library (Settings)**: a new "Adventure Module Library" panel in Settings lists modules from the local `/data/adventures/` folder with metadata (title, tier, author, description) and installs with one click, reusing `loadAdventureManifest()`/`loadAdventureFromFile()` — no more modal-only browsing or manual JSON placement.
- **Bidirectional character sync**: local character edits (sheet editor, wizard, roller — anything going through `core/state.js`'s `updateCharacter()`) now push to the server via a new debounced `onCharacterChange` hook, instead of only syncing once at initial connect. Character updates also now include `patron`, previously dropped on the floor before it ever reached the server.

### Other
- Updated sync/broadcast looks, module browser, and characters uploading their patron(s) obligation
- Updated to add funding buttons
- Updated email address to support@fates-edge.com all around.
- Updated package-lock.json files

## [4.11.0] - 2026-08-12

Documentation pass across the ecosystem ahead of the AI GM bot going public: fixed broken/fictional cross-repo links (wrong GitHub org, non-existent releases pages) in the Discord bot, Roll20, and Foundry bridge READMEs; corrected a Discord bot README that rendered entirely as a single code block; rewrote root SECURITY.md (was still the unfilled GitHub template); fixed a stale root README roadmap section contradicting the already-shipped Redis scaling feature; consolidated Kon'reh's rules doc out of the wrong feature folder (was duplicated and out of sync with itself); removed/redirected several stale docs (ADVISORY.md superseded by COMMUNITY_USE_POLICY.md, two mislabeled patron_update.md scratch files). Also fixed a real test hang: socket-server's scaling.test.js assumed the optional Redis deps were never installed in test environments, which stopped being true once they shipped as real optionalDependencies -- the resulting live (if unreachable) Redis client kept the process alive forever. Rewritten to match reality and close its connections.

_No commits since the last tag — manual version bump._

## [4.10.0] - 2026-08-12

Optional Elasticsearch search backend for the web client (alongside the existing, now-documented Solr option), with System Status integration and new test coverage.

_No commits since the last tag — manual version bump._

## [4.9.0] - 2026-08-12

Optional Redis-backed horizontal scaling for the socket server; documentation overhaul separating implemented reality from roadmap across the socket-server and web-client design docs (new SCALING.md, ROLES.md, ROADMAP.md for the socket server).

### Added
- optional Redis-backed horizontal scaling

### Docs
- rewrite web-client TODO.md as an archived status record
- correct socket-server DESIGN.md (remove Redis/aspirational claims)

## [4.8.3] - 2026-08-12

Security hardening: server-verified sender identity for the VTT event relay, XSS fixes in Kon'reh/Toll & Veil banners, Toll & Veil stake-message validation, Trust/Cantor bug fixes.

### Other
- Added Toll and Veil guide and document categoy.

## [4.8.2] - 2026-08-12

### Other
- Got Toll and Veil working

## [4.8.1] - 2026-08-12

Socket server persistence/Dockerfile fixes, web client compose cleanup, INSTALL guides for server/client/bot

_No commits since the last tag — manual version bump._

## [4.7.1] - 2026-08-11

### Other
- Updated copyright language
- Updated mods and bots to stop html injections, finished desktop client
- Updated konreh doc and package manager

## [4.7.0] - 2026-08-10

Security hardening pass (XSS fixes, auth rate limiting, input length limits) and multi-character 'Remote enabled' control (up to 6 characters per client)

_No commits since the last tag — manual version bump._

## [4.6.3] - 2026-08-10

### Other
- Added two expansions and an adventure. Plugged one security hole. TODO: HTML Parsing issues

## [4.6.2] - 2026-08-10

### Other
- Added Modern Noir
- Added Modern Nmoit
- Updated theme engine and fixed CSS. Made WebGUI theme-able

## [4.6.1] - 2026-08-08

Talent catalog overhaul: JSON-per-talent expansion (10 -> 55), tagging + category filter bar in the character editor/wizard, and starter/XP-appropriate talent recommendations.

### Chore
- prune 5 not-yet-free adventures from web-client per updated allowlist
- sync 9 new adventures (JSON + HTML docs) from fates-edge-docs
- sync 18 new patron files from fates-edge-docs

### Other
- Fixed an annoying yet prominant typo.

## [4.6.0] - 2026-08-07

Diverse encounter objective-type clocks (obstruction, skill challenge, trap/ward, lockpick, heist, social, custom), symbol management fixes, patron/cantor discovery reliability, Kon'reh AI phase-awareness

### Added
- generic objective-type clocks instead of hardcoded Harm/Heal
- phase-aware Kon'reh AI evaluation

### Fixed
- stop Cantor/Patrons needing a manual refresh to see current data
- remove redundant auto-symbol injection in character editor/wizard

### Other
- Merge branch 'symbol_character_update': symbol management fixes, patron/cantor discovery fix, Kon'reh AI phase-awareness, generic objective-type encounters
- Working on getting characters to track symbols properly and to have rites be able to choose between them.
- Updated adventures and added Terrestrial Patrons

## [4.5.1] - 2026-08-05

Jump to the Action: one-click pregen + starter adventure flow in the welcome overlay

_No commits since the last tag — manual version bump._

## [4.5.0] - 2026-08-05

Voice/logging fully implemented (TURN NAT traversal), unified docker-compose for the whole ecosystem, community use policy + split license files, System Status page, module system fixed and documented, data schema docs

_No commits since the last tag — manual version bump._

## [4.4.2] - 2026-08-05

Fixed remaining stale v4.3a version references in README.md/DESIGN.md files (root README title/badge/What's New/Version History, JS toolkit README, socket-server README/DESIGN, web-client DESIGN). Taught bump-version.mjs to auto-catch README/DESIGN title lines and version badges going forward (conservatively — narrative changelog sections still need a human).

_No commits since the last tag — manual version bump._

## [4.4.1] - 2026-08-05

Fix: index.html and app.js version banners were still stale after v4.4.0 (only package.json files were bumped). Centralized the displayed version into js/core/version.js and taught bump-version.mjs to catch index.html/version.js going forward.

### Other
- Updated the index.html

## [4.4.0] - 2026-08-05

Crafting decay/forage-limit system tied to GM Downtime (Faction Turn), CSS modularization for crafting, socket-server auth/deck/adventure unit tests, web-client test-harness fixes, terminal client account-character (/mychar) commands.

### Other
- Actual tests
- Repo hygiene: fix .gitignore (stale paths, env/venv split, *.db), untrack campaigns.db, drop stray fs npm-security-placeholder dependency
- Updated manifest

