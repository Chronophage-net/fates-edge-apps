# Changelog

All notable changes to the Fate's Edge Web Client are logged here. This file starts at 4.2 — earlier versions (up through 4.1.2a) predate this convention and aren't reconstructed retroactively.

## [4.11.1] - 2026-08-13

### Adventure Manager — timer sync loop closed end-to-end
- `advanceTimer()`/`advanceSceneTimer()` already broadcast an `adventure-timer` WS message on every local tick (`broadcastTimerTick()`), and the server already recomputed it authoritatively and broadcast the result back to the whole room as `timer-ticked` — but nothing on the client ever listened for `timer-ticked`, so other clients (and the sender itself, on drift) never converged on the server's canonical number. `core/websocket.js` now registers and dispatches `timer-ticked` on both the plain-WebSocket and Socket.io transports; `adventure-manager/index.js`'s new `applyRemoteTimerTick()` matches the ticked timer by name/scope against the currently loaded adventure and reconciles `.current`, the GM Tools global timer mirror, and re-renders — idempotently, so the tick's own echo back to the sender is a safe no-op.

### Settings — one-click Adventure Module install
- New "Adventure Module Library" panel in Settings: lists modules bundled in the local `/data/adventures/` folder with a read-only metadata preview (title, tier, sessions, author, description — fetched without installing anything), and installs any of them into your local library with one click. Reuses `adventure-manager/index.js`'s existing `loadAdventureManifest()`/`loadAdventureFromFile()` rather than duplicating install logic; previously this browse+install flow only existed as a modal inside the Adventures panel itself, with no admin-facing entry point.

### Character sync — now bidirectional
- Character sheet edits (editor, wizard, roller — anything that calls `core/state.js`'s `addCharacter()`/`updateCharacter()`/`deleteCharacter()`) now push to the server automatically via a new debounced subscriber in `vtt-connected.js`, instead of only syncing once at initial connect/reconnect. Backed by a new narrow `onCharacterChange()`/`offCharacterChange()` hook in `core/state.js` (deliberately separate from the existing, much noisier `onSave()`, which fires on every kind of state save). `pushCharactersToServer()`'s payload also now includes each character's `patron`, previously silently dropped before it reached the server — nothing downstream (including the AI GM's per-Patron Obligation view) could see which Patron a character's Obligation was owed to until now.

## [4.6.0] - 2026-08-07

### Encounters — objective types for non-combat clocks
- The Encounters feature framed *every* clock in Harm/Heal combat terms even when the encounter wasn't a fight (picking a lock, disarming a trap, a heist, a skill challenge, a negotiation). New shared registry `js/core/objective-types.js` (`OBJECTIVE_TYPES` / `getObjectiveType()` / `isCombatType()`) defines seven objective types — Combat, Obstruction, Skill Challenge, Trap/Ward, Lockpick, Heist, Social/Negotiation — each with its own icon and progress/relief vocabulary (e.g. Lockpick's "Tumblers"/"Jam" instead of "Harm"/"Heal"). This exact shape is shared with `fates-edge-socket-server` and `fates-edge-ai-gm-bot` to keep the systems compatible.
- Encounters (`encounters/editor.js`) now have an Objective Type dropdown when creating/editing, defaulting to Combat for back-compat. Adventure Manager scenes (`adventure-manager/index.js`) carry the same `type` field and thread it into the Encounter created when a scene starts.
- `encounters/combat.js`'s tracker now renders non-combat clocks with their type's own labels/icon/buttons instead of hardcoded "💥 Damage"/"💚 Heal" — the numeric current/max track and its two buttons work identically underneath, only the terminology changes. Real combat (`type` missing or `'combat'`) is completely untouched: armor conversion, Fatigue, TL→maxHarm, and defeat/revive all still only run for combat entries.
- Non-combat clocks get a generic "Resolved" state instead of "Defeated" when they hit max, plus a small `Max = ✅ Success` / `Max = ❌ Failure` toggle per clock — whether hitting max is good or bad for a given clock is scenario-dependent (a heist's Heat clock hitting max is bad; a skill challenge's Progress clock hitting max is good) and is the GM's own call, not assumed by the app.
- The VTT sidebar's mini combat tracker (`vtt-connected.js`, `vtt-local.js`) now also reads each combatant's objective type so players see the right terminology, not just the GM's local Encounters panel.
- Strictly additive: every saved character/encounter/campaign with no `type` field anywhere is treated as `'combat'` and behaves exactly as before. `getObjectiveType()` never throws on a missing/bad id.
- Added an eighth objective type, `custom` ("Custom / Freeform"), for clocks that don't fit the fixed vocabulary — the GM types their own Timer Label and Tick Label (e.g. "Ritual Completion" / "chant") instead of picking from the list. New `isCustomType()` / `resolveObjectiveType()` helpers in `objective-types.js` overlay a GM-supplied `customLabel`/`customTickLabel` from the owning encounter/scene/combatant over the generic "Timer"/"Tick" defaults, falling back gracefully when none is set. Wired through the Objective Type pickers in `encounters/editor.js`, `encounters/combat.js`, and `adventure-manager/index.js` (two new inputs that show only when "Custom / Freeform" is selected), and through the mini combat tracker in `vtt-connected.js`/`vtt-local.js` so players see the GM's custom labels too.

### Character Editor & Wizard — removed redundant "auto-symbol" injection
- Removed a newly-added "auto-symbol addition" feature from both `editor.js` and `wizard.js` that silently force-added whatever patron sat in the single top-level "Patron" dropdown as a Symbol the moment `magicPath === 'invoker'`, including on save (`saveEditor()`/`collectTalentsAndLoadout()` unshifting it into `char.symbols`/`d.symbols`). This conflicted with the existing, correct "Invoker Symbols" Add-Symbol UI (`#ce-add-symbol-btn` / `#wz-add-symbol-btn`), which already lets players add one or more Symbols explicitly. Invokers canonically carry *multiple* Symbols from different patrons (see the Cross-Resonance warning logic in `rites.js`) — the top-level Patron dropdown is really the Runekeeper/Cantor single Bound Patron field, reused incorrectly here — so auto-injecting it could silently corrupt `char.symbols` on save. The dropdown now shows a small inline hint ("Runekeeper/Cantor only — Invokers use Symbols below") when an Invoker path is selected, instead.

### Patrons / Cantor — fixed stale rites requiring a manual refresh
- Root cause: `js/core/discovery.js`'s `discoverPatrons()` (and `discoverRegions()`/`discoverBestiary()`) cached their discovered slug lists in `localStorage` for 1 hour, and that cache was always checked first — even when `loadPatronData(true)` (a forced reload, e.g. `window.cantorRefresh()`) was called. The app-level force-reload fix already in `patrons/index.js` only bypassed its own character-state cache, never this lower discovery-level cache, so newly-added or edited patron files could still be invisible until the hour expired. `discoverPatrons`/`discoverRegions`/`discoverBestiary` now accept a `force` parameter that skips the cache read (and still repopulates it afterward); `loadPatronData(force)` threads it all the way down through `loadRemotePatrons()`. `cantor.js`'s `renderCantor` also now retries once with a forced reload if a bound patron's data comes back empty, mirroring the existing retry-once pattern in `rites.js`.

### Spellcraft rites (audit)
- `rites.js` was audited for multi-Symbol Invoker support (per-patron rendering, Cross-Resonance warnings, per-patron Obligation, Learn/Invoke/Crack the Seal) and found already correct — no functional changes needed. Removed one unused `isDummy`/`patronId` dead-code local from the per-patron render loop.

## [4.2.0]

### Talents — mechanical teeth
- New talent effects engine (`js/core/talent-effects.js`): a small structured grammar (die bonuses, Position shifts, ignored penalties, conditional re-rolls) plus a free-text interpreter so existing talent/wiki text isn't wasted work.
- Use-limit charge tracking (once/scene, once/session, once/arc, once/campaign) via `character.talentUses`, reset at scene end and new session.
- Talent effects now actually modify dice pools via the roller, instead of being flavor text only.
- Seed content pack: `data/talents-manifest.json` + `data/talents/*.json` (10 talents), loaded through `talent-loader.js`.
- Unified the two talent editors (character sheet quick-add vs. the dedicated talent editor modal) so both write the same structured data.

### Weapons & range bands
- The combat tracker's weapon axis is now **Light / Medium / Heavy / Ranged** — matching the Player's Guide's actual weight-class system (§3.12.1–3.12.3) — replacing an earlier, incorrect "weapon type" (one-handed/reach/ranged) split.
- Dice bonuses per weight class and range band now come straight from the Player's Guide's Melee Modifiers and Ranged & Tempo tables for Close/Medium(Near)/Far; Reach and Absent are this table's own extended-band house rule layered on top of the book's 3-band Close/Near/Far (only Heavy melee — halberd, greatsword — can threaten Reach).
- A range selector (Close/Medium/Reach/Far/Absent) is now available in both the Character Roller and the VTT's embedded Quick Roller (local + connected), with the selected range shown in the roll result and posted to VTT chat.
- Combat tracker's range grid is GM-gated in connected sessions (players can see it; only the GM can change it). Solo/local play remains fully open.

### Shields
- `editor.js`'s Shield selector (Buckler/Heater/Pavise) previously had zero runtime effect. Heater and Pavise now apply the book's `-1d Ranged` (bulky/off-hand) penalty when rolling with a Ranged weapon; the Defend bonus and Harm→Fatigue conversion are surfaced as roll-modifier reminder notes (situational, not part of the generic dice pool).

### Boon economy
- Fixed a pre-existing bug where "boons to spend" (pre-roll boon spend, intended as +1d/boon) was accepted by the roller but never actually added to the dice pool.
- Implemented **Fatigue-as-Boon**: if a character spends more Boons than they have, the shortfall is now paid in real Fatigue instead of silently over-spending — the roll still gets its full requested bonus, and the Fatigue persists to the character sheet afterward.
- Boons spent on a roll are now actually deducted from the character's Boon pool (previously only Boons *gained* from Partial/Miss outcomes were applied).

### X-Card / safety tool
- The floating X-Card button did nothing when clicked — its click handler (`setupXCard()`) was written but never called during app init. Fixed, along with a missing `escHtml` import that would have broken the Lines/Veils display once the overlay opened.
- Raising the X-Card now broadcasts to every connected client (not just the person who clicked it) so the whole table pauses together, and posts a notice into VTT chat on both raise and resume.

### VTT & Whiteboard
- New inline mini combat tracker card in the VTT sidebar: live initiative order, active-turn indicator, and range-to-you, without needing the full Encounters tracker modal open.
- Whiteboard toolbar reorganized into collapsible sections (Draw / Tokens & Combat / Fog & Light / View) instead of one long wrapped row.
- Whiteboard → VTT chat bridge: pings, Fog of War toggling/clearing, and Kon'reh now post short notices into VTT chat.
- VTT chat panel now sizes itself against the viewport instead of a fixed pixel height, so it behaves on short/mobile screens.
- Added 3D animated dice, a macro/quick-action bar, ambience/SFX soundboard, character portraits, and richer presence (who's viewing what) to the roller/VTT.
- Fixed a drifted duplicate of the Scene End boon-trim logic in the VTT (it never reset once/scene talent charges); now delegates to the shared GM Tools implementation.
- Redacted `js/features/vtt/combat.js`, a stale duplicate of the real combat tracker at `js/features/encounters/combat.js`.

### Bug fixes
- `roller.js` was missing an `updateCharacter` import, crashing on any roll that gained Boons.
- `pack-manager.js`'s `validatePack()` never returned a value, crashing `installPack()`.
- Removed a self-referencing `factions-manifest` entry that broke faction search.
