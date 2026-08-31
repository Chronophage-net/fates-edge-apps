# Changelog
All notable changes to this project will be documented here.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/), versions follow [Semantic Versioning](https://semver.org/).

## [4.26.2] - 2026-08-31

SRI on third-party scripts, untrack the lock reset code, stop manifest timestamp churn

### Fixed
- pin third-party scripts with SRI, untrack the reset code, stop manifest churn

## [4.26.1] - 2026-08-31

Clear all npm audit findings; fix the test runner and a flaky test

### Fixed
- clear all npm audit findings in web-client and socket-server

### Docs
- note the unclean-manifest loop and the npm audit backlog

### Chore
- build artefacts from the release hook (lockfile versions, manifest timestamp)

## [4.26.0] - 2026-08-31

Dark-fantasy theming pass, setting data sync, dependency pinning

### Added
- dark-fantasy theming pass, setting data sync, and hardening

## [4.25.4] - 2026-08-28

Settings: add small GitHub/Dev Portal links to About

### Added
- add GitHub/Dev Portal links to Settings About section

### Chore
- dedupe phantom CHANGELOG entries from retried release script

## [4.25.3] - 2026-08-28

### Docs
- call out the No AI Art Policy

## [4.25.0] - 2026-08-28

### Added
- print button + PDF export for character sheets, print for SRD/Essentials/Campfire docs

### Fixed
- restore The Knave's Regret title, dedupe, fill gaps
- use import.meta.dirname instead of __dirname in vite.config.js

### Other
- Fix SUCCESSION.md link: point at public dev-portal page, not private repo
- Point to fates-edge-docs SUCCESSION.md from LICENSE.md
- Sync data + docs from fates-edge-docs: new adventures, book-format guides, region/patron updates
- Updated package-lock.json files.

## [4.24.1] - 2026-08-26

### Fixed
- repair dangling GM Tools handlers found in button audit
- verify chat GM formatting server-side, close presence role escalation

### Changed
- convert relative imports to path aliases across js/

### Docs
- document verifiedGM chat trust and the presence role-escalation fix

### Chore
- remove dead code (unused vtt/sync/builder modules)

## [4.24.0] - 2026-08-26

Propagate SOUNDSCAPE_AUTO_SEARCH's url-shaped ambience cue across remaining VTT/mods/clients

### Added
- propagate SOUNDSCAPE_AUTO_SEARCH's url-shaped ambience cue to remaining VTT/mods/clients

## [4.23.0] - 2026-08-26

Reactive Soundscape auto-search fallback for the AI GM Bot

### Added
- auto-search fallback for the AI GM Bot's Reactive Soundscape

## [4.22.1] - 2026-08-26

### Docs
- document soundboard sound search in DESIGN.md/README.md

## [4.22.0] - 2026-08-26

Soundboard sound search (Freesound proxy) + ad-hoc timer module

### Added
- soundboard sound search (Freesound) + ad-hoc timer module, propagated to VTT/mods/bots/clients

### Other
- Updated the manifest and package-lock.json
- Updated to fix dashboard buttons and general namespace collisions

## [4.21.0] - 2026-08-24

Cross-repo assistant-suggestion events (SB-spend/Crown Spread LLM synthesis approvals from the AI GM Bot), relayed by the socket server and rendered with live Approve/Reject in the web client, Discord bot, Foundry bridge, and Roll20 API script; whisper-privacy bug fix for join greetings

### Other
- Adventure Manager: Browse Library shows adventure titles, not filenames
- docs UI: single category dropdown + one tile pane, not per-category sections
- Updated documents and document feature
- docs UI: category dropdown label, fixed 4-col tile grid w/ scroll; fix Chronicles category; retire Myrmis-Canray doc
- docs UI: tile grid layout, consolidate Expansions + Other Games categories

## [4.20.3] - 2026-08-22

Documentation sweep across the ecosystem; AI GM Bot lite Docker stack for underpowered machines; link Campfire Mode from the welcome wizard

_No commits since the last tag — manual version bump._

## [4.20.2] - 2026-08-21

Voice-adapter/demo hardening from a code-review pass on `docker-compose.voice.yml`

### Added
- **Reference-clip existence check** (`tools/voice-adapter/adapter.py`) — `voice-adapter` now gets its own read-only mount of `voice-tts-reference/` (the same host folder Chatterbox itself mounts) purely to check the configured `CHATTERBOX_REFERENCE_FILE` actually exists, logging a clear warning at startup and on every `/synthesize` call when it's missing, and reporting `referenceFilePresent`/`referenceFile` from `/healthz`. Not an error condition — Chatterbox falls back to its stock voice either way — but it used to be a silent "why does it sound like the stock voice?" discovery instead of a `docker logs` line. `tools/demo.sh --voice` already checked for the file before startup (since [4.19.0]); this covers the same gap for anyone running `docker compose` directly.
- **Soft memory guard on `tts`** (`mem_limit: ${CHATTERBOX_MEMORY_LIMIT:-6g}`) — Chatterbox on CPU can use several GB during inference, and shares a machine with Ollama/the socket server/etc. in the demo stack; an unbounded container is the one most likely to starve everything else if something goes wrong. Deliberately the legacy top-level `mem_limit` key, not `deploy.resources.limits` — the latter is a Swarm-mode construct that plain `docker compose up` silently ignores outside a stack deploy, which would have made the limit a no-op.
- Clearer first-run size/time messaging in `tools/demo.sh --voice` (rough GB/minutes estimate, points at `docker logs -f fates-edge-demo-tts` for progress).

### Notes
- Prompted by a code-review pass on the voice-cloning overlay. Most of its other suggestions were already covered by existing design (RVC model-discovery warnings already live in `demo.sh`; `depends_on: condition: service_healthy` already gates startup ordering, making adapter-side retry logic redundant) or were declined with reasoning: an HTTP healthcheck that actually runs synthesis every 15-30s would burn real CPU/RAM on a model server for marginal benefit over a plain reachability check; a TTS-model pre-pull init container was left out because the reviewer's suggested Hugging Face repo ID (Coqui XTTS-v2) doesn't match Chatterbox's actual model, and shipping an unverified repo ID risked pulling the wrong model entirely.

## [4.20.1] - 2026-08-21

### Fixed
- **`docker-compose.voice.yml`'s `tts` service now pulls upstream's published GHCR image (`ghcr.io/devnen/chatterbox-tts-server:main-cpu`) instead of building from a git context on every fresh `npm run demo -- --voice`.** [4.19.0] originally built it from source (`Dockerfile.cpu` via a git build context) reasoning that it would "stay in sync with upstream without maintaining a fork" — true, but upstream already publishes multi-arch images for exactly that reason, and pulling one is strictly better: no local build step, no compiling torch's dependency stack from source, same "no fork to maintain" property. `CHATTERBOX_IMAGE` in `.env.demo` overrides the tag if you want a GPU variant (`main-nvidia`/`main-cu128`/`main-rocm`/`main-strixhalo`) or a pinned `sha-<hash>-cpu` build instead of upstream's rolling `main-cpu`.

## [4.20.0] - 2026-08-20

Rolling chat history: newly-joined clients see recent room chat, not a blank pane

### Added
- **`MAX_CHAT_HISTORY`** (`server/config.js`, default `50`, `0` disables) — the socket server now keeps a rolling, in-memory window of recent chat messages per room (`room.js`'s new `recordChatMessage()`, called from both transports' `chat-message` handlers right before they broadcast — the stored history always matches what clients actually saw live). Sent to newly-joined clients as `chatHistory` (oldest first) in Socket.io's `room-joined` and plain-WS's `room-state` payloads, alongside the existing `deckHistory`/`whiteboard`/`characters` snapshot those already carry.
- **Web client replay** (`js/features/vtt/vtt-connected.js`) — on connect, replays `chatHistory` into the chat pane via the same `vttStore.addChatMessage()` the live handler already uses, so history and live messages render identically. Also fixes a pre-existing gap where nothing in the client was listening for `room-joined` at all (only `room-state`, the plain-WS variant) — both now share one handler.
- **`tests/chat-history.test.js`** — unit coverage for `recordChatMessage()`'s windowing/trim/disable behavior. Full existing suite (120 tests) still green.

### Notes
- Purely in-memory, same lifetime as the room itself (cleared when a room empties out and gets recreated — see `room.js`'s `createRoom()`), same as `deckHistory`. Nothing is persisted to disk or a database.
- **Whisper privacy is unchanged, not newly introduced:** whispered messages were already broadcast to every client in the room over the wire (only hidden client-side by `recipient` matching) — this feature extends that same existing exposure across time (a client joining mid-conversation now also receives whispers it would have received live had it been connected), it doesn't create a new one. Properly scoping whisper history to only its intended recipient(s) would need the server to track clientId↔recipient-name mapping and is a separate, larger change — flagging here rather than silently deciding either way.

## [4.19.0] - 2026-08-20

Voice-cloning sidecar for the demo stack: `npm run demo -- --voice`/`--voice-rvc`

### Added
- **`docker-compose.voice.yml`** — a separate, opt-in overlay on top of `docker-compose.full.yml` that brings up a cloned GM voice for the demo stack: a `tts` service (Chatterbox, built directly from its upstream repo via a git build context, so it stays in sync with upstream without a fork here), an optional `rvc` service (`tools/voice-rvc/`, a thin Dockerfile around [daswer123/rvc-python](https://github.com/daswer123/rvc-python), gated behind a `voice-rvc` Compose profile since it needs a trained model you supply), and a `voice-adapter` sidecar (`tools/voice-adapter/`) that translates between `fates-edge-ai-gm-bot`'s fixed `TTS_URL`/`RVC_URL` JSON contract and whatever Chatterbox/rvc-python actually speak — neither upstream project needs patching. Merges new `TTS_*`/`RVC_*` env vars straight into the existing `ai-gm-bot` service (`environment`/`depends_on` merge by key across `-f` files, verified via `docker compose config` — nothing from `docker-compose.full.yml` is clobbered).
- **`tools/demo.sh --voice` / `--voice-rvc`** (also `npm run demo:voice` / `demo:voice-rvc`) — brings the voice overlay up alongside the base stack, with status messages checking whether you've dropped a reference clip in `voice-tts-reference/` (for Chatterbox's zero-shot cloning) or a trained model in `voice-rvc-models/` (for RVC) yet. `npm run demo -- --down` tears down both the base and voice stacks regardless of which flags started them.
- **`voice-tts-reference/`, `voice-rvc-models/`** — untracked-by-default folders (see new `.gitignore` entries) for your own reference clip and RVC model, each with a README explaining what goes there.
- New `.env.demo.example` vars: `CHATTERBOX_PORT`, `VOICE_ADAPTER_PORT`, `CHATTERBOX_REFERENCE_FILE`, `VOICE_RVC_ENABLED`, `RVC_PORT`, `RVC_VOICE` — all ignored unless the stack is brought up with `--voice`/`--voice-rvc`.

### Docs
- README Quick Start gets a new "Optional: hear the GM in a cloned voice" subsection under Docker.
- `fates-edge-ai-gm-bot/docs/local-voice-cloning/VOICE-CLONING-LOCAL-SETUP.md` (that repo's manual, outside-Docker walkthrough) now leads with this overlay as the fastest path, keeping the from-scratch instructions below it for anyone not using the demo stack.

### Notes
- Heavier than the base demo on purpose, which is why it's opt-in rather than part of `npm run demo` by default: Chatterbox's model weights are a multi-GB download on first run, on top of the Ollama pull the base demo already does.
- `rvc-python`'s API server holds one active model at a time; `voice-adapter` doesn't forward `RVC_VOICE` per-request — make sure whatever model `rvc-python` has loaded actually matches what you've set `RVC_VOICE`/`voice-rvc-models/` to.

## [4.18.0] - 2026-08-20

Local demo stack: configurable Ollama timeout + `DEMO_LEVEL` speed/quality preset

### Added
- **`DEMO_LEVEL` preset** (`tools/demo.sh`, `.env.demo.example`) — set `DEMO_LEVEL=light` or `DEMO_LEVEL=quality` in `.env.demo` as an all-or-nothing bundle over `DEMO_OLLAMA_MODEL`/`_CONTEXT_WINDOW`/`_TIMEOUT_MS`, for anyone who'd rather say "my machine is slow" than tune three separate knobs by hand. Resolved only by `npm run demo` (a bare `docker compose up` doesn't see it); doesn't probe actual hardware — Docker Desktop's CPU/RAM allocation isn't visible outside the container anyway. Leave unset/`default` to keep hand-tuning the three vars as before.

### Fixed
- **`npm run demo` "(AI error)" / Ollama timeouts** (`docker-compose.full.yml`, wired to `fates-edge-ai-gm-bot`'s `ollama-driver.js` `OLLAMA_TIMEOUT_MS` via new `DEMO_OLLAMA_TIMEOUT_MS`) — the AI GM bot's built-in 60s Ollama request timeout was routinely too short for Ollama running CPU-only inside Docker (Docker Desktop can't pass a host GPU through to a container — no Metal on macOS, no CUDA without extra setup on Linux/WSL), causing spurious "(AI error)" fallbacks on otherwise-working demo stacks. Default raised to 180000ms (3min); configurable, and bundled into the new `DEMO_LEVEL` presets above.

### Docs
- README Quick Start now points to `DEMO_LEVEL` as the fast path for tuning the local-model demo to your machine.

## [4.16.1] - 2026-08-20

### Other
- voice chat speaking indicators, high-contrast theme
- GM shortcuts modal, image alt fixes, static a11y lint tests
- label and add numeric readouts to whiteboard/VTT sliders
- Accessibility sweep: focus management, live regions, contrast fixes
- Updated Kon'reh, fixed Blue camping in the cross.

## [4.16.0] - 2026-08-19

Adventure Director v2 (climax pacing, deck RNG seeding, persistence hooks) + Session Recording bundling/live transcription

### Added
- **Climax pacing** (`server/adventure.js`, `server/api.js`) — three new live-state fields (`climaxPadScenes`, `climaxScenesSinceTrigger`, `climaxForced`) track how long a dynamic-growth adventure's final act has been running once `climaxTriggered`, and a new `POST /api/rooms/:code/adventure/climax-forced` route (sibling of the existing `climax-triggered` route) lets the AI GM bot mark that it forced a dramatic turn to keep a stalled climax moving. `POST /api/rooms/:code/adventure/load-custom` now also accepts an optional `climaxPadScenes` in its body.
- **Legacy Tracker persistence declaration** — `GET /api/rooms/:code/adventure/reference` now includes a `persistence` field (`{ schema, carryover, reset_on_complete }` or `null`) surfacing an adventure module's own optional declaration of what cross-adventure state should carry over, unfiltered, the same way `notes`/`knowledge` already are. Purely declarative on the server side — see `fates-edge-ai-gm-bot`'s new `modules/legacy-tracker.js` for the actual extraction/injection logic.
- **Per-room seedable deck RNG** (`server/rng.js`, new) — every room's deck shuffle now uses its own independent xorshift128 PRNG (`room.data.deckSeed`/`deckRngState`) instead of the shared, unseeded global `Math.random()`. Two new routes: `GET /api/rooms/:code/deck/seed` (read the room's current seed) and `POST /api/rooms/:code/deck/seed` (`{ seed }`, reseed + immediately reshuffle) — enables reproducible draws for tournament play or bug repro. `deck.buildDeck()`/`shuffleArray()` now take an optional `rng` function (default `Math.random`, fully backward compatible).
- **Session Recording bundling + live transcription** (`js/core/media.js`, web client) — the screen+mic recording and its event-driven SRT now download together as one `.zip` (via the already-loaded `JSZip`) instead of two separate files, with a two-file fallback if `JSZip` is unavailable. New opt-in, best-effort **live transcription** (browser `SpeechRecognition` API) folds recognized speech into the same SRT as `[SPEECH]` lines. Surfaced in GM Tools → Session Recap.
- `renderCardText()` (`js/features/decks/index.js`) now prefers `window.DOMPurify` for sanitizing card text when it's loaded, falling back to the existing hand-rolled `escapeKeepingAllowedTags()` otherwise — ready for GM-uploaded custom region content without changing behavior for today's static, developer-authored region JSON.

### Docs
- Corrected several integrations' docs describing `media.js` as voice-chat support (it's the session-recording/SRT system; live voice chat is `VoiceChat.js`/`vtt/voice.js`). Updated README/CHANGELOG across `fates-edge-discord-bot`, `foundry_fates-edge-bridge`, `fates-edge-roll20`, `avrae_module.txt`, `fates-edge-terminal`, `fates-edge-desktop-client`, and `fates-edge-python-client` (which also gained real `get_deck_seed()`/`set_deck_seed()` client methods + CLI flags + tests) to reflect the API changes above. `foundry_fates-edge-bridge/module.json` and `fates-edge-roll20/module.json`/`version.json` bumped to `4.16.0` by hand (outside `tools/bump-version.mjs`'s package.json-only scope) to stay on the same release train.

### Other
- Updated Kon'reh, fixed Blue camping in the cross.

## [4.15.2] - 2026-08-19

### Other
- Fix Docker publish tag collision, add discord-bot image

## [4.15.1] - 2026-08-19

### Other
- Fix Docker publish tag collision, add discord-bot image

## [4.17.0] - 2026-08-20

### Added
- **Reactive Soundscape** — new `soundboard-ambience` WebSocket event (`{ mood, trackId, transitionDuration }`), relayed room-wide by both `fates-edge-socket-server` transports (`socketio-handlers.js`'s `relayEvents`, `ws-handlers.js`'s direct-broadcast switch — same pattern as the existing `tts-audio` event) so an AI GM bot's mood → trackId profile (`fates-edge-ai-gm-bot`'s `adventure-context.js`) can drive ambience across every connected client. `fates-edge-web-client`'s `core/soundboard.js` now supports a real crossfade (`playAmbience(id, { transitionDuration })`, ramped via `requestAnimationFrame` across two overlapping `Audio()` elements) instead of only a hard-cut track switch, and `js/features/vtt/vtt-connected.js` wires the new event to it, matching by `trackId` against the room's own `state.soundboard.tracks` (a silent no-op if the mood maps to a track this room never created). `fates-edge-discord-bot` posts a text-only "🎵 Now Playing" embed on ambience changes; Foundry/Roll20/terminal/Python clients acknowledge the event (console log / hook) since none has a way to resolve an arbitrary web-client `trackId` into local playback. See `fates-edge-ai-gm-bot`'s README "Reactive Soundscape" section and this repo's `API.md`.
- Also fixed in `core/soundboard.js` while touching it: `setAmbienceVolume()` previously ignored the currently-playing track's own per-track `volume` multiplier, so calling it while a quieter track (e.g. `volume: 0.5`) was playing would audibly jump it louder than `playAmbience()` had originally set it to.
- **Adventure Engine: structured knowledge state** (`fates-edge-socket-server/server/adventure.js`). Adventure modules can now define a `knowledge[]` array of `{ id, subject, gm, player, revealed, revealCondition, tags }` entries — an explicit, queryable game-state answer to "what is the party allowed to know right now?" instead of leaving it to be inferred from `_gmhints` prose (still fully supported, unchanged). `revealed` is live state, reset to its authored value on every `loadAdventureModule()`/`loadAdventureContent()` alongside existing scene/timer resets, and flipped at runtime via new `revealKnowledge(room, id, { by })` / `hideKnowledge(room, id, { by })`.
- Two new REST routes: `POST /api/rooms/:code/adventure/knowledge/reveal` and `.../knowledge/hide`, both `{ id, by? }`, broadcasting `adventure-knowledge-revealed`/`-hidden` to the room. Same `authenticate`-only gating as the rest of the Adventure Engine's routes — no new role/permission model introduced.
- `getPublicState()` (the player-safe live-state fetch) now includes a filtered `knowledge` view — `{ id, subject, revealed, text }`, where `text` is the entry's `player` text pre-reveal and its full `gm` text once revealed. `gm` and `revealCondition` are never included here.
- `getReferenceData()` (the existing GM/AI-eyes-only reference fetch, already home to full NPC/bestiary/notes secrets) now includes the full `knowledge[]` array unfiltered — this is what `fates-edge-ai-gm-bot`'s system prompt is built from.
- Matching Socket.IO/plain-WS parity for the two new REST routes above: `adventure-knowledge-reveal` / `adventure-knowledge-hide` events on both transports (`ws-handlers.js`, `socketio-handlers.js`), broadcasting the same `adventure-knowledge-revealed` / `adventure-knowledge-hidden` events — same one-event-per-REST-route convention every other Adventure Engine route already follows.
- Every existing Adventure Engine consumer updated to match: `fates-edge-terminal` (`/adventure knowledge|reveal|hide`), `fates-edge-discord-bot` (`/vttadventure knowledge|reveal|hide`), `foundry_fates-edge-bridge` (`sendAdventureKnowledgeReveal()`/`Hide()` + journal-entry handlers), and `fates-edge-roll20` (`!fates-edge adventure reveal|hide <id>`). Each follows its existing per-consumer pattern: the GM-only reference view (bestiary/npcs/notes) now also shows each `knowledge[]` entry's full `gm` text and `revealCondition`, while player-facing status views only ever show the filtered `text`/`revealed` fields `getPublicState()` returns. **Not updated:** `fates-edge-web-client`'s (and by extension `fates-edge-desktop-client`'s) "Adventure Manager" feature turns out to be a separate, client-local adventure system with its own state sync — it never called this server-side Adventure Engine API to begin with (no `/api/rooms/:code/adventure` calls, no `adventure-loaded`/`scene-changed` WS listeners), so there was no existing integration point to extend. Wiring the web client into the real Adventure Engine (this knowledge feature included) would be new work, not a knowledge-state update.

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

