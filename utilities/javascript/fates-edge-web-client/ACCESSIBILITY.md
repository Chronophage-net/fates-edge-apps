# Accessibility

This document tracks the accessibility (a11y) state of the Fate's Edge web client: what's implemented, what was audited and found already sufficient, what was changed in the most recent accessibility pass, and what's deliberately deferred.

The web client already had a meaningful amount of accessibility infrastructure in place before this pass — a visible `aria-live` toast system, a `role="tab"`/`role="tabpanel"` sidebar, and a strict DOMPurify sanitization config. This pass focused on closing real, verified gaps rather than re-implementing things that already existed.

---

## What changed in this pass

### Focus management & navigation (`router.js`)

- `navigate()` now syncs `aria-selected="true"/"false"` on every sidebar tab button to match the actual active tab. This was previously a genuine bug: the DOM had `role="tab"` buttons but nothing ever set `aria-selected`, so assistive tech had no way to know which tab was current.
- After a route renders (and on every navigation except the very first page load), focus moves to the new tab panel (`tabindex="-1"` + `.focus()`), and a screen-reader-only announcement fires ("Navigated to {Tab Name}") via a new small announcer module.

### New: `js/core/a11y-announce.js`

A minimal `announce(message, { assertive })` helper that writes to one of two off-screen `aria-live` regions (`polite` by default, `assertive` for genuinely interrupting events). It's intentionally separate from `Toast.js`'s visible `aria-live="polite"` region rather than reusing it — toasts are user-facing visual notifications, and routing every screen-reader announcement through the same node would mean either cluttering the visible toast stream with routing/navigation chatter, or overloading one region with two very different jobs. The regions are `sr-only` (visually hidden, not `display:none`, so they remain in the accessibility tree).

### Dice roller self-feedback (`js/features/dice/index.js`)

Rolling your own dice previously updated the visible result panel with no screen-reader announcement — only *other* players' rolls (relayed over WebSocket) triggered a toast. Your own roll now announces its outcome via `announce()`.

### Chat log semantics (`vtt-connected.js` and `vtt-local.js`)

Both chat panels (the connected/multiplayer client and the offline/local-mode client — these are two separate, non-shared implementations of `#chatMessages`) now use `role="log"` with `aria-live="polite"` and `aria-relevant="additions"`. This is the standard pattern for an append-only chat transcript: screen readers announce new messages as they arrive without needing any additional application code, and it doesn't require duplicating chat text into a separate announcer.

Note: most other real-time events (dice rolls from other players, deck draws/shuffles, crown spreads, timer completions) were **already** announced via `showToast()` calls that predate this pass — `Toast.js` targets `#toast-container`, which already had `role="status" aria-live="polite"`. That infrastructure did not need to be added; it needed to be found and left alone.

### Landmarks & skip link (`index.html`)

- Added a "Skip to content" link as the first focusable element in `<body>`, targeting a new `id="main-content"` on `<main>`, which also now carries `role="main"`.
- The sidebar `<nav>` now has `role="tablist" aria-orientation="vertical"`, and each of its ~23 tab buttons has `aria-controls` pointing at its panel id. (Two of those ids — `tab-crafting` and `tab-adventure-manager` — are created dynamically by the router rather than existing statically in the HTML; this is harmless since `aria-controls` referencing an element that doesn't exist yet at parse time still resolves correctly once the router creates it.)

### Visually-hidden utility classes (`app.css`)

Added `.sr-only` (clip-based visually-hidden, kept in the accessibility tree — not `display:none`) and `.sr-only-focusable:focus` (un-hides on keyboard focus, for the skip link and any future similar controls).

### Color contrast (`app.css`)

Ran a full WCAG 2.1 contrast audit of both themes' CSS custom-property color pairs (relative luminance / contrast ratio formulas from the spec, computed directly against the actual hex values in `app.css`, not estimated). Results:

| Theme | Pair | Before | After | AA normal (4.5:1) | AA large/UI (3:1) |
|---|---|---|---|---|---|
| Dark (`:root`) | `--text3` on `--bg` | `#5a5e72` / `#0f1117` → 2.95:1 | `#767b93` → 4.52:1 | ❌ → ✅ | ❌ → ✅ |
| Light (`html.light`) | `--text3` on `--bg` | `#8a8590` / `#f8f6fa` → 3.35:1 | `#736e79` → 4.62:1 | ❌ → ✅ | ✅ → ✅ |
| Light (`html.light`) | `--gold` on `--bg` | `#b8860b` / `#f8f6fa` → 3.03:1 | *not changed — see below* | ❌ | ✅ |

All other checked text/background pairs in both themes already pass AA.

**Why `--gold` in the light theme wasn't changed:** `--gold` is used in ~40+ places across the stylesheet, in two different roles — as plain text/border color (where a straightforward darkening to `#926a09` would fix it to 4.56:1), and as one endpoint of the `.btn-gold` gradient (`linear-gradient(135deg, var(--gold), var(--gold-light))`) against `--text-inverse`. Checking that gradient specifically: `--gold` vs `--text-inverse` is 3.03:1 (would become 4.56:1 with the fix), but `--gold-light` (`#d4a017`) vs `--text-inverse` is only **2.21:1** — a worse, pre-existing failure that a `--gold`-only fix would not address, and that sits on a shared multi-purpose token where a global change risks a visual outcome nobody has reviewed. Per the "without compromising the overall experience" constraint on this pass, this was left as a documented, calculated-but-unapplied finding rather than a blind global replace. Recommended follow-up: either split `--gold` into distinct `--gold-text` / `--gold-gradient-start` tokens so each can be tuned independently, or design a dedicated `.btn-gold` treatment (e.g. a solid darker gold instead of a two-stop gradient) and validate it visually before shipping.

### Slider accessibility — whiteboard/VTT tool controls (`js/features/whiteboard/modules/ui.js`, `layers.js`)

The original review flagged "Magic System sliders" (Spellcraft/Rites) as needing numeric fallbacks and `aria-valuenow` wiring. Checked against the actual code: **the Spellcraft/Rites magic system has no `<input type="range">` elements at all** — every `<input type="range">` in the app lives in the Whiteboard/VTT grid-combat tools (light radius/intensity, stroke size/opacity, per-layer opacity). The underlying concern was real, just misattributed to the wrong feature.

Native `<input type="range">` already exposes its current value, min, and max to assistive tech automatically (the browser fills in the accessibility-tree equivalent of `aria-valuenow`/`aria-valuemin`/`aria-valuemax` for free) — adding those attributes by hand would have been redundant and risked drifting out of sync with the real DOM value. The actual gaps were narrower and more concrete:

- Several sliders (the two per-light controls, the stroke color/size/opacity controls) had no accessible name at all — a bare `title` attribute is not reliably exposed to screen readers, and one `<label>` (light radius/intensity) sat next to its input rather than wrapping or being `for`-associated with it. Fixed by adding explicit `aria-label`s (`"Radius in cells for light 1"`, `"Stroke opacity"`, `"Opacity for layer Fog"`, etc.) to every previously-unlabeled range and color input.
- Three sliders (stroke size, stroke opacity, per-layer opacity) had no visible numeric readout at all — sighted low-vision users had to guess the value from handle position alone. The fog-darkness slider already had this pattern (an adjacent `<span>` kept in sync on `input`); the fix extends the same pattern to the other three, wiring the new `<span>`s into each slider's existing `input` event handler rather than adding new listeners.

No visual layout changed beyond a few small text labels appearing next to controls that previously had none — the sliders themselves, their ranges, and their behavior are untouched.

### DOMPurify / rich text sanitization — verified, no change needed

The suggestion to strip `aria-*`/`role` attributes from user-authored rich text (deck card text, etc.) was checked against `js/features/decks/index.js`'s `renderCardText()`. It already calls `DOMPurify.sanitize(text, { ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS, ALLOWED_ATTR: [] })` — an empty attribute allowlist is strictly stronger than a `role`/`aria-*` denylist (it blocks *all* attributes, not just those two families), so this was already secure and required no code change.

---

## Deferred (not implemented)

Scoped out deliberately, to keep each pass focused and reviewable rather than attempt everything at once:

- Voice chat visual/text speaking indicators (who's currently talking, for players who can't rely on audio cues).
- `inert`-based focus-trapping for inline editor screens (currently only true `role="dialog"` modals trap focus; full-screen inline editors do not).
- Real axe-core/headless-browser coverage in CI (see **Automated accessibility regression testing**, option 2 below — the cheap option-1 lint is now implemented; the real-browser option is still open).
- A Lighthouse CI GitHub Action.
- Discord bot embed accessibility (alt text on embed images, plain-text fallbacks).
- Foundry bridge inheriting/propagating `CONFIG.ariaLabels` from the host Foundry instance.
- Captions/transcript for the project's demo video, if/when one exists.
- A user-facing high-contrast theme toggle (distinct from the baseline contrast fixes above, which apply to the existing themes as-is).

These remain a reasonable roadmap for a follow-up pass.

---

## Follow-up pass: GM shortcuts modal + automated lint coverage

Two items that were originally left as "groundwork for later" got built out in a second pass.

### GM keyboard-shortcuts modal — implemented

A `#shortcutsModal` (standard `.modal-overlay`/`.modal` markup, so it gets close-button/outside-click/Escape handling for free from the existing `setupModals()`) is now reachable two ways: the sidebar footer's new ⌨️ button, or pressing `?` anywhere that isn't a text-entry control (checked via `target.matches('input, textarea, select, [contenteditable="true"]')`, and skipped if any modifier key is held, so it never steals a literal `?` from chat/search/any input). Wired up in `js/app.js`'s `setupShortcutsModal()`.

Its content is the GM-relevant subset of the shortcut inventory below: X-Card toggle, the combat timer's Space/R, and whiteboard undo/redo — the ones worth a mid-session reminder. `Escape` and `?` itself are listed too, since a shortcuts list that doesn't mention how to close itself is an odd first impression.

Existing shortcut inventory (kept here for reference — this is what the modal's content was built from). There are **22 separate `addEventListener('keydown', ...)` call sites** across the codebase, each independently defining its own key handling with no central registry:

| Shortcut | Where | What it does |
|---|---|---|
| `Ctrl+Shift+X` | `app.js` (global) | Toggles the X-Card overlay |
| `Escape` | `app.js` (global) | Closes any open `.modal-overlay` (except the password lock overlay) |
| `Enter` | Chat input (`vtt-connected.js`, `vtt-local.js`), scene-tag input (`gm-tools/index.js`), dice roller (`dice/index.js`), Kon'reh talk box (`kon-reh/index.js`) | Submits the focused input — same convention everywhere, not a true "shortcut" so much as expected form behavior |
| `Escape` | Deck of Consequences Crown Spread modal (`decks/index.js`) | Closes the Crown Spread modal specifically (in addition to the global handler) |
| `Space` | Combat timer modal (`encounters/combat.js`), only when focus isn't in an input/textarea/select | Advances to the next combatant (`#combat-next`) |
| `R` / `r` | Combat timer modal (`encounters/combat.js`), same focus guard | Resets the combat timer (`#combat-timer-reset`) |
| `Ctrl/Cmd+Z` | Whiteboard (`whiteboard/modules/ui.js`) | Undo |
| `Ctrl/Cmd+Y` or `Ctrl/Cmd+Shift+Z` | Whiteboard (`whiteboard/modules/ui.js`) | Redo |

The other 12+ keydown sites (character editor/wizard/roller, talent editor, patrons, search, settings, spellcraft calculator, travel planner, whiteboard onboarding, wiki editor, talent-effects, local-lock/password, feature-flags, utils) were checked and are internal input-handling (autocomplete navigation, form submission, modal dismissal on their own scoped inputs) rather than discoverable "shortcuts" a GM would want listed — deliberately left out of the modal's content as noise, not overlooked.

### Automated accessibility regression testing — cheap option implemented, real option still open

The original review suggested Jest + `axe-core`. Checked against the actual project: **there is no Jest here** — `npm test` runs `tests/runner.js`, a small hand-rolled test framework (`assert`/`assertEqual`/`assertTrue`/etc.) that runs directly under plain `node`, with `tests/support/dom-shim.js` providing a deliberately minimal DOM/localStorage/window stub (explicitly *not* jsdom, to stay lightweight — see that file's own header comment). `axe-core` itself needs a real DOM to walk (computed styles, layout, live `getComputedStyle`) — it fundamentally can't run against the current shim, and swapping in jsdom (or a real headless browser) just to support it would be a meaningfully bigger infrastructure change than "add a test."

**Implemented: `tests/unit/a11y-lint.test.js`** — a static-analysis pass over the actual source, using the project's own `describe`/`it`/`assert` conventions, zero new dependencies. It checks three things, each a direct regression guard for a bug this project has actually had:

1. Every `<input type="range">` under `js/features/` has `aria-label` or `aria-labelledby`.
2. Every `<img>` under `js/features/` and in `index.html` has an `alt` attribute (empty `alt=""` counts — that's the correct, deliberate marker for a decorative image whose meaning is carried by adjacent visible text; only a fully missing `alt` is flagged).
3. Every sidebar `role="tab"` button in `index.html` has `aria-controls`, and `router.js` still contains the `setAttribute('aria-selected', ...)` call that keeps `aria-selected` in sync at runtime (a regression guard for the exact bug the first accessibility pass fixed).

Writing this test immediately found three more real, previously-unnoticed gaps it was designed to catch: two `<img>` tags in the whiteboard's own renderer (a pinned image, and — since its accompanying text label already names it — a character token) and one in the roster panel, all missing `alt` entirely. Fixed alongside the test (`alt="Image pinned to the whiteboard"` for the standalone image; `alt=""` for the two with an adjacent visible name label, to avoid double-announcing the same information). All four lint checks pass against the current codebase; `npm test` is 141-142/142 depending on run (see note below).

This is not full axe-core coverage — it can't check contrast, focus order, or anything that needs actual layout/computed styles — but it directly guards the exact classes of regression this project has already shipped once.

**Still open — real coverage, real cost:** swap in a headless browser for CI only. Add Playwright (not currently a dependency anywhere in this repo — confirmed by checking every `package.json`) as a *separate*, opt-in test target — e.g. `npm run test:a11y` — that boots the built `dist/` in headless Chromium and runs `@axe-core/playwright` against each routed tab. This gives real axe-core coverage without touching `tests/runner.js` or its shim at all, and can be wired into a Lighthouse CI GitHub Action (the review's other suggestion) as the same job, since both need a real browser anyway. This is a genuinely new devDependency and CI job, not a small add — size it as its own follow-up piece of work.

---

## Note on test suite flakiness (pre-existing, unrelated to this work)

`npm test` currently shows 141/142 or 142/142 depending on the run: `TollVeilEngine: follow-suit and trump-breaking › must follow suit when able` fails intermittently (confirmed by re-running it several times in isolation — it passes most runs, fails occasionally with `expected ♢, got null`). This is a pre-existing flake in the Toll & Veil card-engine test, unrelated to any file this accessibility pass touched, and out of scope here — flagged for whoever next works in `tests/unit/toll-and-veil.test.js` to track down (likely an unseeded random draw somewhere in the AI-play test path).
