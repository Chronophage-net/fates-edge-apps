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

- [x] **SRI hashes added to all seven CDN `<script>` tags in `index.html`.** Seven third-party
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
- [x] **`data/lock-reset.json` is no longer tracked.** Added to
      `utilities/javascript/.gitignore`, with `data/lock-reset.example.json`
      tracked in its place and INSTALL.md updated with the copy step. Runtime
      behaviour is unchanged: `local-lock.js` already returns false on a
      missing file, exactly as it did on the empty hash it shipped with.
- [x] **Test runner fixed.** `node tests/runner.js` died on `Cannot find package
      '@core/state.js'`: the `@core` alias exists only in `vite.config.js`, and
      Node's ESM loader cannot see it (package.json `imports` can't express it
      either — those keys must start with `#`). Added an ESM resolve hook in
      `tests/support/alias-hooks.mjs` mirroring the vite alias map, registered
      via `--import`. The suite was never broken, only unrunnable: **157/157
      pass**. Keep the two alias maps in sync — adding one to vite.config.js
      and not to the hook breaks only the tests.
- [x] **Fixed a flaky Toll & Veil test** that failed ~1 run in 3.
      "must follow suit when able" led `hand[0]` blindly; when that card was
      trump the engine correctly refused the lead (trump not broken), the play
      was rejected and `leadSuit` stayed null. It now leads a non-trump card
      and asserts the lead succeeded. Engine behaviour was correct throughout.
      10/10 clean runs after the fix.

## Repo hygiene

- [x] **`data/docs/manifest.json` can now be committed clean.** It stores a
      `generated` ISO timestamp, it is tracked, and the pre-commit hook
      regenerates it on every commit that touches the web client — so each
      commit leaves the tree dirty with a one-line timestamp diff, forever.
      `generate-manifests.js` now carries the previous `generated` timestamp
      forward when the rest of the manifest is byte-identical, so back-to-back
      runs produce identical files. Applies to every generated manifest.
- [x] **`npm audit` is clean in both projects (0 vulnerabilities).**
      web-client: all four criticals and most highs came from one dev-only
      dependency, `serve@^6.5.8` (2018). Bumped to `^14.2.6` and moved to
      devDependencies where it belongs — it is CLI-only (`npx serve -s dist`),
      never imported, and the production image serves via nginx, so nothing
      ships differently. The remaining `nanoid` advisory cleared with a plain
      `npm audit fix`.
      socket-server: every advisory lived in `node-gyp`'s toolchain under
      `sqlite3` (tar, cacache, make-fetch-happen, http-proxy-agent). Resolved
      with `overrides` on `node-gyp@^11` and `tar@^7` rather than by taking
      `sqlite3@6` — see the note below.
- [ ] **Revisit `sqlite3@6` on a real build host.** The obvious fix was
      `sqlite3@5.1.7 -> 6.0.1`, and it was reverted deliberately: v6's prebuilt
      aarch64 binary requires GLIBC_2.38 and fails to load on older glibc with
      "SQLite module not installed", which took the whole auth API down with
      500s. The JS API is unchanged, so v6 is probably fine on the real target
      (`node:24-alpine`, musl, builds from source) — but that could not be
      verified from here, and an untestable major bump of a native module is
      not worth it when `overrides` clears the advisories anyway. Try it on a
      real build host, and check `require('sqlite3').verbose()` loads before
      trusting the test suite.
- [ ] **`npm run test:auth` has 3 pre-existing failures**, unrelated to any of
      the above and present before these changes: "admin sets room password"
      gets 404 Room TESTROOM not found, and the two anonymous-join password
      checks pass when they should be rejected. Worth a look — on the face of
      it a room has to exist before a password can be set on it, and the
      password gate may not be enforced for anonymous joins.
