# Accessibility

This document tracks the accessibility (a11y) state of the Fate's Edge web client: what's implemented, what was audited and found already sufficient, what was changed in the most recent accessibility pass, and what's deliberately deferred.

The web client already had a meaningful amount of accessibility infrastructure in place before this pass — a visible `aria-live` toast system, a `role="tab"`/`role="tabpanel"` sidebar, and a strict DOMPurify sanitization config. This pass focused on closing real, verified gaps rather than re-implementing things that already existed.

## Status at a glance

| Area | Status | Notes |
|---|---|---|
| Focus management on route change | ✅ Done | `router.js` moves focus + announces the new tab |
| `document.title` on route change | ✅ Done | `Fate's Edge — {Tab}`, updates on every navigation including initial load |
| `aria-live` announcer regions | ✅ Done | Hardcoded in `index.html`, not left to lazy JS injection |
| Sidebar `aria-selected`/`aria-controls` | ✅ Done | |
| Chat `role="log"`, dice-roll self-announcement | ✅ Done | |
| Color contrast (dark/light `--text3`) | ✅ Done | Light theme's `--gold` intentionally left as a documented, unfixed finding — see below |
| High-contrast theme | ✅ Done | Third built-in theme, AAA-level contrast throughout |
| Voice chat speaking indicators | ✅ Done | Icon + sr-only text, not just color; local self-indicator still open |
| Whiteboard/VTT slider labels + numeric readouts | ✅ Done | |
| Image `alt` text (whiteboard/roster) | ✅ Done | |
| GM keyboard-shortcuts modal | ✅ Done | |
| Static accessibility lint tests | ✅ Done | 9 checks in `tests/unit/a11y-lint.test.js` |
| DOMPurify strips `aria-*`/`role` | ✅ Already sufficient | `ALLOWED_ATTR: []` predates this work and is stricter than the suggested fix |
| Real axe-core/Playwright coverage in CI | ⏳ Deferred | Plan documented below; genuinely new devDependency + CI job |
| `inert`-based focus trapping (inline editors) | ⏳ Deferred | `inert` is the right modern approach when this is built — see below |
| Local mic self-activity indicator | ⏳ Deferred | Backend (`getVoiceActivity()`) already exists, unused in UI |
| Discord bot embed alt text | ⏳ Deferred | Different repo; not touched this pass |
| Foundry bridge `CONFIG.ariaLabels` | ⏳ Deferred | Different repo; not touched this pass |
| Demo video captions/transcript | ⏳ Deferred | Out of scope for now |
| Lighthouse CI GitHub Action | ⏳ Deferred | Bundle with the axe-core/Playwright work above |

The rest of this document is organized by pass, oldest first, with the reasoning and verification behind each entry — this table is just the map.

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

- A visual/text indicator for the *local* user's own mic activity (remote participants' speaking state is now covered — see below; `VoiceChat.js` already exposes `getVoiceActivity()`/`onActivity()` for this, just not wired to any UI yet).
- `inert`-based focus-trapping for inline editor screens (currently only true `role="dialog"` modals trap focus; full-screen inline editors do not).
- Real axe-core/headless-browser coverage in CI (see **Automated accessibility regression testing**, option 2 below — the cheap option-1 lint is now implemented; the real-browser option is still open).
- A Lighthouse CI GitHub Action.
- Discord bot embed accessibility (alt text on embed images, plain-text fallbacks).
- Foundry bridge inheriting/propagating `CONFIG.ariaLabels` from the host Foundry instance.
- Captions/transcript for the project's demo video, if/when one exists.

These remain a reasonable roadmap for a follow-up pass.

---

## Third pass: voice chat speaking indicators + a high-contrast theme

### Voice chat speaking indicators — implemented

Checked before writing anything: `js/features/vtt/voice.js` already had a *complete* per-remote-participant speaking-detection backend — `voiceClients` tracking `{ name, speaking, connectionState }` per client, a `startSpeakingDetector`/`stopSpeakingDetector` pair analyzing each remote audio stream, and `onVoiceClientsChanged()` broadcasting live updates. The actual gap was narrower than "build speaking detection" — it was purely in the three places that render the voice roster (`vtt-connected.js`, `vtt-local.js`, and the real live-updating renderer in `vtt-core.js`'s `renderVoiceClients()`): `speaking` only ever changed a small dot's *color* (gold vs. gray), with a `title` tooltip as the only non-color cue — invisible to screen readers, and weak for colorblind users since it was color-only with no shape/icon difference.

Fixed identically in all three render sites: a visible 🔊 icon now appears next to a speaking participant's name (not just a color change), and an `sr-only` text suffix (", speaking") is added to the name so it's discoverable by a screen reader browsing the roster. This is deliberately **not** wired through the `aria-live` announcer from the first pass — mic activity can toggle many times a second, and pushing that through a live region would be pure noise, not a useful announcement. Making the *persistent* DOM node's accessible name reflect current state (discoverable on demand) is the right pattern here, the same way a mute button's own label change is enough without needing an announcement every time it's pressed.

Left open: the local user's own mic-activity indicator (see Deferred above) — `VoiceChat.js` already computes it, nothing in the UI reads it yet.

### High-contrast theme — implemented

Rather than continuing to chase individual light/dark contrast failures pair-by-pair (the light theme's `--gold` was left unresolved in the first pass specifically because fixing it in isolation risked an unreviewed visual change to `.btn-gold`'s gradient), this adds a third, dedicated theme built for maximum legibility from the ground up: pure black background, pure white primary text, and every accent color picked to clear WCAG **AAA** (7:1), not just AA — verified with the same relative-luminance/contrast-ratio math as the original audit, now also pinned down by an automated test (see below) instead of only a one-time manual check.

It plugs into the *existing* theme registry (`core/theme-manager.js`) exactly the way a pack-supplied theme would — `initTheme()` now registers a third built-in (`registerTheme({ id: 'high-contrast', ... })`) alongside `dark`/`light`, using a new exported `HIGH_CONTRAST_VARIABLES` map of CSS custom-property overrides. Nothing in the registry, application, or pack-comparison logic needed to change beyond that one registration call and updating `settings/index.js`'s `getThemeSource()` to recognize it as `Built-in` rather than misreporting it as a random pack-registered theme — the Settings page's theme picker already renders every registered theme generically, so "High Contrast" (◐) just appears there automatically, with no new UI code.

Translucent borders (`rgba(..., 0.6)`-style) are replaced with solid colors in this theme specifically — a low-alpha border is itself a low-vision problem, which somewhat defeats the point of a high-contrast mode if left as-is. `--border-light` (a deliberately subtler tertiary border) is the one value that stops at AA (5.32:1) rather than AAA, on purpose — everything else, including every semantic accent (red/green/blue/purple/orange) and their `-light` variants, clears AAA.

New `tests/unit/theme-manager.test.js` guards this going forward: it asserts every base custom property is actually defined in `HIGH_CONTRAST_VARIABLES` (an unlisted variable would silently fall through to the dark theme's value, quietly reintroducing whatever contrast problem this theme exists to avoid), checks the real contrast ratios of every color in the palette against `--bg` (AA baseline for all, AAA for the primary text/accent set), and confirms registering the theme makes it discoverable through the same `getThemes()`/`getTheme()` API a pack theme would use.

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

Writing this test immediately found three more real, previously-unnoticed gaps it was designed to catch: two `<img>` tags in the whiteboard's own renderer (a pinned image, and — since its accompanying text label already names it — a character token) and one in the roster panel, all missing `alt` entirely. Fixed alongside the test (`alt="Image pinned to the whiteboard"` for the standalone image; `alt=""` for the two with an adjacent visible name label, to avoid double-announcing the same information). All four lint checks (now nine — see the Fourth pass section below) pass against the current codebase; `npm test`'s total has grown across each pass (see the flakiness note below for the current count).

This is not full axe-core coverage — it can't check contrast, focus order, or anything that needs actual layout/computed styles — but it directly guards the exact classes of regression this project has already shipped once.

**Still open — real coverage, real cost:** swap in a headless browser for CI only. Add Playwright (not currently a dependency anywhere in this repo — confirmed by checking every `package.json`) as a *separate*, opt-in test target — e.g. `npm run test:a11y` — that boots the built `dist/` in headless Chromium and runs `@axe-core/playwright` against each routed tab. This gives real axe-core coverage without touching `tests/runner.js` or its shim at all, and can be wired into a Lighthouse CI GitHub Action (the review's other suggestion) as the same job, since both need a real browser anyway. This is a genuinely new devDependency and CI job, not a small add — size it as its own follow-up piece of work.

When this gets built: point it at the built `dist/` output, not the Vite dev server — `dist/` is what actually ships, and dev-server-only quirks (unminified markup, HMR scaffolding) aren't what a real user's screen reader will ever see. Start with a single route (Home is the obvious first target) and expand route-by-route rather than trying to cover all ~23 tabs in the first version — each route needs its own known-good baseline reviewed by a human before it's trustworthy as a CI gate, and doing that for one route at a time is far more tractable than trying to sign off on all of them in one PR.

---

## Fourth pass: document title, hardcoded live regions, five more lint checks

Three smaller, cheap fixes plus meaningfully expanding the static lint suite.

### `document.title` now updates on every route change

`router.js`'s `navigate()` sets `document.title = \`Fate's Edge — ${activeLabel}\`` using the exact same resolved tab label the sidebar's `aria-selected` sync and the `announce()` call already use — no separate lookup, so it can't drift out of sync with what's actually showing. Unlike the focus-move/announce logic (deliberately skipped on the very first page load, so it doesn't fight the browser's own default focus), the title update runs on *every* navigation including the first — a static `<title>Fate's Edge Toolkit v4.16.1</title>` regardless of which tab a deep link opened to was itself a small pre-existing gap. A well-behaved SPA updating `<title>` on route change is what lets a screen reader's own built-in "announce title on navigation" behavior actually say something useful.

### `aria-live` announcer regions are now hardcoded in `index.html`

`core/a11y-announce.js`'s `ensureRegions()` always checked `getElementById` before creating anything, so this only required adding the two `<div>`s to the static HTML — zero JS changes. The regions now exist in the DOM from first paint rather than being created on the first `announce()` call, which removes a subtle real risk: some screen readers only reliably pick up a live region added to the DOM *after* page load if it happens to still be there by the time they finish their own initial accessibility-tree pass. `ensureRegions()`'s create-on-demand logic stays in place as a defensive fallback (and is still what lets `tests/unit/theme-manager.test.js`-style DOM-free tests import the module without crashing), but production now never actually exercises it.

### Five more static lint checks in `tests/unit/a11y-lint.test.js`

All source-only regex checks, same conservative philosophy as the original three (false negatives are acceptable, false positives are not): all nine checks currently pass clean against the live codebase, meaning these are regression guards rather than fixes for something currently broken.

1. **`role="button"` on a `<div>`/`<span>`** — flags it outright rather than trying to also verify the hand-rolled `tabindex`/keydown wiring a real interactive `role="button"` div needs to not be a keyboard trap. Cheaper to just never do it than to correctly verify it's done right every time.
2. **Empty, unlabeled `<button>`/`<a>`** — flags a `<button>`/`<a>` whose inner content is empty (after stripping comments) *and* contains no `${...}` interpolation *and* has no `aria-label`/`aria-labelledby` on the opening tag. Deliberately narrow: it will not catch every possible missing-accessible-name case (an interpolated value that's always empty at runtime is invisible to a static check), but it will never flag a genuinely text-bearing or labeled element.
3. **No positive `tabindex`** — `tabindex="0"`/`"-1"` are both fine and already used deliberately elsewhere (e.g. `router.js`'s focus-on-navigate); a positive value reorders the whole page's tab sequence around one element's guess at priority, almost always fighting the DOM's own — usually correct — source order.
4. **`document.title` regression guard** — asserts `router.js` still contains a `document.title =` assignment.
5. **Live-region regression guard** — asserts `index.html` still hardcodes both `#a11y-announcer` (`aria-live="polite"`) and `#a11y-announcer-urgent` (`aria-live="assertive"`).

`npm test` is 152/152 (the one pre-existing Toll & Veil flake noted below aside).

### `inert` — noted for whenever inline-editor focus-trapping gets built

Still deferred (see the status table above), but worth recording now rather than re-researching later: `inert` has been a real, broadly-supported HTML attribute for a while now (not a proposal or a polyfill-only feature), and is the right tool for this — it's a single attribute that removes an entire subtree from both the tab order and screen-reader traversal at once, which is more robust than the older pattern of manually toggling `aria-hidden` on every sibling and separately managing a focus trap by hand (easy to get subtly wrong, e.g. forgetting one sibling, or a trap that doesn't release cleanly on close).

### Discord bot / Foundry bridge — still out of scope, noted for whoever picks them up

Both live in separate repos from this one and weren't touched this pass. For whenever they are: the Discord bot's embeds should carry alt text on any image field where Discord's embed schema supports it (and a plain-text fallback line in the message body for clients that don't render embeds at all — some mobile/accessibility-mode Discord clients don't). The Foundry bridge's interactive elements (buttons, selects in its GM panel) should inherit accessible names from Foundry's own `CONFIG.ariaLabels` where the host instance defines them, rather than hardcoding English-only labels that ignore whatever the GM's Foundry instance is already configured with.

---

## Note on test suite flakiness (pre-existing, unrelated to this work)

`npm test` currently shows 151/152 or 152/152 depending on the run: `TollVeilEngine: follow-suit and trump-breaking › must follow suit when able` fails intermittently (confirmed by re-running it several times in isolation, across multiple accessibility passes now — it passes most runs, fails occasionally with a `got null` assertion on a randomly-varying expected suit symbol). This is a pre-existing flake in the Toll & Veil card-engine test, unrelated to any file this accessibility work has touched, and out of scope here — flagged for whoever next works in `tests/unit/toll-and-veil.test.js` to track down (likely an unseeded random draw somewhere in the AI-play test path).
