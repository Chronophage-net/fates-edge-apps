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

### DOMPurify / rich text sanitization — verified, no change needed

The suggestion to strip `aria-*`/`role` attributes from user-authored rich text (deck card text, etc.) was checked against `js/features/decks/index.js`'s `renderCardText()`. It already calls `DOMPurify.sanitize(text, { ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS, ALLOWED_ATTR: [] })` — an empty attribute allowlist is strictly stronger than a `role`/`aria-*` denylist (it blocks *all* attributes, not just those two families), so this was already secure and required no code change.

---

## Deferred (not implemented this pass)

Scoped out deliberately, to keep this pass focused and reviewable rather than attempt everything in one sweep:

- Voice chat visual/text speaking indicators (who's currently talking, for players who can't rely on audio cues).
- A GM keyboard-shortcuts reference/help modal.
- `<input type="range">` numeric fallback labels / `aria-valuenow` wiring for the Spellcraft and Rites magic-system sliders.
- `inert`-based focus-trapping for inline editor screens (currently only true `role="dialog"` modals trap focus; full-screen inline editors do not).
- Jest + `axe-core` automated regression tests.
- A Lighthouse CI GitHub Action.
- Discord bot embed accessibility (alt text on embed images, plain-text fallbacks).
- Foundry bridge inheriting/propagating `CONFIG.ariaLabels` from the host Foundry instance.
- Captions/transcript for the project's demo video, if/when one exists.
- A user-facing high-contrast theme toggle (distinct from the baseline contrast fixes above, which apply to the existing themes as-is).

These remain a reasonable roadmap for a follow-up pass.
