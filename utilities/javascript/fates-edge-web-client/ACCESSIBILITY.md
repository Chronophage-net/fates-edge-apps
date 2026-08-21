# Accessibility

What's built into the Fate's Edge web client for screen reader, low-vision, and hearing/speech-related accessibility, where to find each feature, and how to turn it on. For what's planned but not yet built, see [Known gaps](#known-gaps) at the end.

## Navigation & screen readers

**Route announcements.** Switching tabs moves focus to the new panel and announces it ("Navigated to {Tab Name}") to screen readers, and updates the browser tab title to `Fate's Edge — {Tab}` so a screen reader's own "announce title on navigation" behavior has something useful to say. This happens automatically on every tab change; there's nothing to turn on.

**Skip link.** The first focusable element on the page is a "Skip to content" link, for keyboard and screen-reader users who don't want to tab through the entire sidebar on every page load.

**Landmarks.** The sidebar is a proper `tablist` (each tab announces its selected state and which panel it controls), and the main content area is marked as the page's main landmark — both standard territory for a screen reader's landmark-navigation shortcuts.

**Live announcements.** Two off-screen announcer regions exist from first paint (not created on demand) for anything that needs to reach a screen reader without a visible dialog: a `polite` one for routine updates (a new chat message, your own dice roll result, "recording started") and an `assertive` one reserved for things that should interrupt.

## Visual

**Three built-in themes** — Dark, Light, and **High Contrast** — switchable from Settings. High Contrast is a from-the-ground-up AAA-level design (7:1 contrast minimum, pure black/white base, solid rather than translucent borders), not a patch over the other two; it's registered as an ordinary theme, so it shows up anywhere the other themes do. Dark and Light both pass WCAG AA (4.5:1) for body text against their backgrounds.

**One documented, unfixed exception:** the Light theme's gold accent color (`--gold`) sits at 3.03:1 against its background in some uses — below AA for normal text, fine for large text/UI elements. It wasn't force-fixed because the same token also drives a two-color gradient used elsewhere, and a global change to fix one use would have shifted the other without a visual review. If you need AA-compliant gold text specifically, use High Contrast instead; a proper fix (splitting the token so each use can be tuned independently) is tracked as a real, open item.

## Chat, voice, and speech

**Chat is a live region.** Both the connected and offline chat panels use `role="log"` with polite live-region semantics, so new messages are announced as they arrive without any extra setup.

**"Type to Speak"** (VTT → chat panel, 🔊 checkbox next to Auto-scroll) reads new chat messages aloud via the browser's built-in speech synthesis — for anyone in a voice call who'd rather listen than watch a scrolling log, especially useful for a deaf or mute player typing into the same chat everyone else uses. Off by default, per-browser (not synced to other clients), and only speaks messages that arrive after you turn it on — it won't read out the backlog.

**AI GM Voice Narration** (Settings, when connected to an AI GM Bot with TTS configured) reads the AI Game Master's own replies aloud alongside the text. Off by default, opt-in everywhere it's implemented: the web client, the Foundry bridge (`narrationEnabled`, a per-user Foundry setting, not GM-wide), and the Discord bot (voice-channel playback). Roll20, the Python client, and the terminal client acknowledge the narration event but can't play audio, so they don't attempt to.

**Voice chat speaking indicators** show a 🔊 icon (not just a color change) next to whoever's currently talking, plus screen-reader text announcing "{name}, speaking" — so who's talking is discoverable by icon, by color, and by screen reader, not by color alone. Your own mic-activity indicator isn't wired up yet; see Known gaps.

**Call and recording status reach screen readers too:** starting a voice call announces it (not just a toast), and starting or stopping a screen/mic recording announces it, with a repeat announcement every 30 seconds while recording continues — frequent enough to know it's still going, not so frequent it becomes a stopwatch.

## Controls

Every slider in the app (light radius/intensity, stroke size/opacity, per-layer opacity on the Whiteboard/VTT tools) has an accessible name and a visible numeric readout next to the handle, not just a position to eyeball. Images carry `alt` text — a real description for meaningful images (like a pinned whiteboard image), or an intentionally empty `alt=""` where the image is purely decorative next to a visible label that already names it. User-authored rich text (card text, custom content) is sanitized with an empty attribute allowlist before rendering, which as a side effect strips any `aria-*`/`role` a malicious upload might try to inject.

## Keyboard shortcuts

Press **`?`** anywhere outside a text field to open the shortcuts reference (also reachable from the sidebar footer's ⌨️ button). It covers the shortcuts worth a mid-session reminder:

| Shortcut | Where | What it does |
|---|---|---|
| `Ctrl+Shift+X` | Anywhere | Toggle the X-Card overlay |
| `Escape` | Anywhere | Close the open modal |
| `Space` | Combat timer | Advance to the next combatant |
| `R` | Combat timer | Reset the combat timer |
| `Ctrl/Cmd+Z` | Whiteboard | Undo |
| `Ctrl/Cmd+Y` / `Ctrl/Cmd+Shift+Z` | Whiteboard | Redo |
| `Enter` | Any chat/search/roller input | Submit |

## Cross-repo coverage

Accessibility work isn't limited to the web client:

- **Foundry bridge** — the GM Management panel's icon-only and ambiguous controls (the GM status button, approve/reject on a specific pending request, the per-client role picker) carry explicit, per-row `aria-label`s rather than one generic label for the whole panel. If your Foundry world defines a `CONFIG.ariaLabels` override (a convention some Foundry modules use so a GM's own localization propagates automatically), the bridge honors it; otherwise it falls back to its own English labels.
- **Discord bot** — every embed the bot sends was audited for image content; none currently use `setImage()`/`setThumbnail()`, so there's nothing missing alt text today. Worth re-checking if an embed image is ever added.

## Testing

`tests/unit/a11y-lint.test.js`, part of the normal `npm test` run, statically checks the source for the accessibility regressions this project has actually shipped before: every `<input type="range">` has an accessible name, every `<img>` has an `alt` attribute (including a deliberate empty one), every sidebar tab has `aria-controls` and stays synced with `aria-selected`, no interactive `role="button"` gets bolted onto a `<div>`/`<span>` without the keyboard wiring that requires, no positive `tabindex` reorders the page's tab sequence, and a handful of regression guards for specific fixes (the live-region markup staying in `index.html`, the shortcuts modal's controls keeping their labels). It's a static, source-level check — cheap to run on every commit, and it can't catch anything that needs real layout or computed styles (contrast, focus order). See Known gaps below for what would.

## Known gaps

Tracked deliberately rather than silently dropped:

- **Local mic activity indicator.** Remote participants' speaking state is shown (see above); your own isn't surfaced in the UI yet, though the underlying detection already exists.
- **Configurable mic sensitivity.** The voice-activity threshold is currently a fixed value, not a Settings option.
- **Real browser-based a11y testing in CI.** The static lint above catches known regression patterns; it can't check contrast or focus order because that needs actual rendering. A headless-browser + axe-core pass against the built app is the planned next step.
- **`inert`-based focus trapping for inline editors.** Modal dialogs already trap focus correctly; full-screen inline editor views don't yet.
- **Demo video captions/transcript.**

If you run into an accessibility gap not listed here, please open an issue — this list is meant to be current, not aspirational.
