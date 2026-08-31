# Fate's Edge Web Client – Implementation Roadmap (Archived)

> **Status: fully shipped.** This was the original file-by-file implementation plan for bridging "The Lantern at Dusk" with automated *Essentials* mechanics. Every item below has since been built and verified against the current codebase (checked 2026-08-12, toolkit v4.8.3). Kept for historical reference — for what's actually still open, see the root [README's Roadmap section](../../../README.md#-roadmap), which is the maintained source of truth.

---

## 1. Safety Tools (Lines, Veils & X-Card) — ✅ Shipped
X-Card floating button + full-screen pause overlay (`index.html`, `#xcard-toggle`/`#xcard-overlay`), keyboard shortcut, and a Safety Tools panel in GM Tools.

## 2. Automation: Timers Auto-Tick on Partial/Miss — ✅ Shipped
`vtt-core.js` dispatches `timer-tick-request`; `gm-tools/index.js` listens and auto-ticks the active scene's timer(s), gated by a `gmState.autoTickTimers` toggle.

## 3. Automation: Fatigue Auto-Worsens Position — ✅ Shipped
`characters/roller.js` derives `effectivePosition` (`positionAfterFatigue`) from base Position + current Fatigue, surfaced in the roller UI.

## 4. Automation: Armor Auto-Conversion in Combat Tracker — ✅ Shipped
`encounters/combat.js` implements `applyArmorConversion(harm, armorType)` and applies it in the damage flow; combatants carry an `armorType` field (Light/Medium/Heavy/None).

## 5. Automation: Boons Limit on Scene End — ✅ Shipped
`resetCombatScene()` (`vtt/combat-actions.js`) is wired into the scene-end flow alongside the existing `sceneEndTrimBoons()`.

## 6. Automation: Auto-Increment Story Beat (SB) Bank — ✅ Shipped
`vtt-core.js` dispatches `sb-generated`; `gm-tools/index.js` listens and increments `state.gm.sbBank` live.

## 7. Integration: Pre-Generated Characters — ✅ Shipped
`data/pre-gens.json` exists; the character wizard loads from it.

## 8. Integration: "The Lantern at Dusk" Starter Adventure — ✅ Shipped
`data/adventures/lantern_at_dusk.json` is bundled and discoverable; starting it populates its scene timers automatically.

## 9. UI/UX: Adventure Detail Enhancements — ✅ Shipped
`adventure-manager/index.js` has `startSceneEncounter()`, bestiary rendering, and description toggles.

## 10. Automation: "The Lantern at Dusk" Specific Auto-Timers — ✅ Shipped
Barrow Collapse and Lena's Agenda timers are defined per-scene in the adventure JSON and wired through the standard timer-advance flow.

## 11. UI/UX: The Lantern at Dusk – Quick Start — ✅ Shipped
Superseded by the "⚡ Jump to the Action" flow on Home (pre-gen + starter adventure + Essentials link in one click, see root README's v4.5.1 notes).

## 12. Code Quality: Extract Shared Helpers — ✅ Shipped
`core/utils.js` has `safeParseInt`, `clamp`, `deepMerge`, `renderDescriptionHtml`, `getTierFromXp`/`getTierColor`, `formatDuration`, `timeAgo`.

## 13. Security: Content Sanitization — ✅ Shipped
`core/utils.js` has `escHtml()` and a `sanitizeHtml()` with optional DOMPurify integration, applied across Wiki/adventure/VTT rendering paths.

## 14. Infrastructure: Default Data Bundling — ✅ Shipped
`data/` is included in the repo and copied into both the `Makefile` and `Dockerfile` build paths.

## 15. Testing: New Feature Coverage — ✅ Shipped (broader than originally scoped)
The `tests/` suite now covers far more than this list anticipated — conflict resolution, crafting, decks, discovery caching, downtime ticks, jump-to-action, objective types, offline queue, operations, presence, symbol management, sync integration, system status, Toll & Veil, travel planner, TURN/ICE, voice signaling, and websocket integration. See the root README's "What's New" sections for current test counts per release.

---

Looking for what's actually left to build? The root [README's Roadmap](../../../README.md#-roadmap) is kept current; as of v4.8.3 that's session playback/export and horizontal server scaling.

## Security / hardening — found during the dark-fantasy theming pass

- [ ] **Add SRI hashes to all CDN `<script>` tags in `index.html`.** Seven third-party
      scripts load with no `integrity` attribute, so a compromised or altered CDN artifact
      executes with full page privileges (it can read the unlock state in `localStorage`
      and everything in the character store). Hashes could not be computed in the
      environment this pass ran in — egress to jsdelivr/cdnjs was blocked. To generate:
      `curl -sfL <url> | openssl dgst -sha384 -binary | openssl base64 -A`
      then add `integrity="sha384-…" crossorigin="anonymous"` to each tag.
      **Verify each hash actually loads before committing** — a wrong hash blocks the
      script silently and takes the feature with it.
- [x] **`marked` was loaded completely unpinned** (`/npm/marked/marked.min.js`, which
      resolves to whatever is newest). Pinned to `marked@12.0.2`. The other six were
      already version-pinned.
- [ ] **Audit `innerHTML` against `sanitizeHTML()`.** `js/core/utils.js` has a DOMPurify
      wrapper, but there are ~200 `innerHTML` assignments across the feature modules
      (settings 29, docs 22, decks 18, kon-reh 17, vtt 14, dashboard 14) and it is not
      established that user-supplied content — character names, wiki entries, adventure
      titles, VTT chat — routes through it. Worth a pass module by module; the VTT and
      wiki paths are the ones that carry other people's text.
- [x] `target="_blank"` links in the home module were missing `rel="noopener noreferrer"`.
      Fixed.
- [ ] **`data/lock-reset.json` is tracked in git.** `resetCodeHash` is currently empty, so
      nothing is leaked today — but the file is committed and not ignored, so the first
      person to fill it in locally will commit their reset hash by accident. Add it to
      `.gitignore` and ship a `lock-reset.example.json` instead.
- [ ] **Test runner is broken independently of this work**: `node tests/runner.js` fails
      with `Cannot find package '@core/state.js'` — an unresolved import alias, not a
      test failure. Nothing can be validated until this is fixed.
