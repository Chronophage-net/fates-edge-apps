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

## Deferred (not implemented this pass)

Scoped out deliberately, to keep this pass focused and reviewable rather than attempt everything in one sweep:

- Voice chat visual/text speaking indicators (who's currently talking, for players who can't rely on audio cues).
- A GM keyboard-shortcuts reference/help modal — see **Setting the stage** below for a real inventory of what already exists to build it from.
- `inert`-based focus-trapping for inline editor screens (currently only true `role="dialog"` modals trap focus; full-screen inline editors do not).
- Automated accessibility regression testing — see **Setting the stage** below for a plan that fits this project's actual test runner (it doesn't use Jest).
- A Lighthouse CI GitHub Action.
- Discord bot embed accessibility (alt text on embed images, plain-text fallbacks).
- Foundry bridge inheriting/propagating `CONFIG.ariaLabels` from the host Foundry instance.
- Captions/transcript for the project's demo video, if/when one exists.
- A user-facing high-contrast theme toggle (distinct from the baseline contrast fixes above, which apply to the existing themes as-is).

These remain a reasonable roadmap for a follow-up pass.

---

## Setting the stage for the next pass

Two of the deferred items above are big enough that "implement it" isn't a one-sitting task, but each has real groundwork worth capturing now rather than starting from zero later.

### GM keyboard-shortcuts modal — existing shortcut inventory

There are **22 separate `addEventListener('keydown', ...)` call sites** across the codebase, each independently defining its own key handling with no central registry. Before a shortcuts-help modal can exist, its content has to come from *somewhere real* — the table below is that inventory, gathered by grepping every keydown handler in `js/` rather than guessed:

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

The other 12+ keydown sites (character editor/wizard/roller, talent editor, patrons, search, settings, spellcraft calculator, travel planner, whiteboard onboarding, wiki editor, talent-effects, local-lock/password, feature-flags, utils) were checked and are internal input-handling (autocomplete navigation, form submission, modal dismissal on their own scoped inputs) rather than discoverable "shortcuts" a GM would want listed — they're omitted from the table above as noise, not overlooked.

**Next step for whoever builds the modal:** the GM-relevant subset worth surfacing is the X-Card toggle, the combat timer's Space/R shortcuts, and the whiteboard undo/redo — those are the ones a GM would plausibly want a reminder of mid-session. A simple `role="dialog"` modal (matching the existing modal pattern already used elsewhere in the app) listing exactly those, wired to a new keybinding (e.g. `?` or `Ctrl+/`, both currently unused — confirmed via the same grep), is a scoped, low-risk follow-up.

### Automated accessibility regression testing — a plan that fits this project's actual setup

The original review suggested Jest + `axe-core`. Checked against the actual project: **there is no Jest here** — `npm test` runs `tests/runner.js`, a small hand-rolled test framework (`assert`/`assertEqual`/`assertTrue`/etc.) that runs directly under plain `node`, with `tests/support/dom-shim.js` providing a deliberately minimal DOM/localStorage/window stub (explicitly *not* jsdom, to stay lightweight — see that file's own header comment). `axe-core` itself needs a real DOM to walk (computed styles, layout, live `getComputedStyle`) — it fundamentally can't run against the current shim, and swapping in jsdom (or a real headless browser) just to support it would be a meaningfully bigger infrastructure change than "add a test."

Two realistic paths, in increasing order of investment:

1. **Cheap, no new dependency: a static-analysis lint pass over feature templates.** Most of what this pass fixed (`aria-selected` never set, unlabeled sliders, missing `role="log"`) is pattern-matchable in the *source* — e.g. a small Node script (using the project's existing `tests/runner.js` conventions) that scans `js/features/**/*.js` for `<input type="range"` without a nearby `aria-label`/`aria-labelledby`, `<img` without `alt`, or `role="tab"` buttons without a matching `aria-controls`. This wouldn't catch everything axe-core would, but it would catch regressions of the exact bugs this pass just fixed, runs in milliseconds, and needs zero new dependencies — a natural fit to add as a new `tests/unit/a11y-lint.test.js` alongside the existing suite.
2. **Real coverage, real cost: swap the shim for a headless browser in CI only.** Add Playwright (not currently a dependency anywhere in this repo — confirmed by checking every `package.json`) as a *separate*, opt-in test target — e.g. `npm run test:a11y` — that boots the built `dist/` in headless Chromium and runs `@axe-core/playwright` against each routed tab. This gives real axe-core coverage without touching `tests/runner.js` or its shim at all, and can be wired into a Lighthouse CI GitHub Action (the review's other suggestion) as the same job, since both need a real browser anyway. This is a genuinely new devDependency and CI job, not a small add — size it as its own follow-up piece of work.

Recommendation: start with (1) now — it's genuinely cheap and directly encodes what this pass already learned — and treat (2) as the real "Jest + axe-core"-equivalent follow-up, sized correctly for what it actually requires.
