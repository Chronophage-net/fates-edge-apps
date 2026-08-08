# Modern Noir theme pack (draft, v0.1.0)

A cyberpunk visual reskin, meant to eventually accompany the **Modern Noir**
setting expansion (`fates-edge-docs/ttrpg/reference/expansions/modern_noir.tex`
— itself flagged as needing a content revision pass). This folder is a
**scaffold**: a working example of the theme-pack convention described below,
with a real starting palette, not a finished reskin.

## What's here

- `pack.json` — the pack manifest. `theme.variables` is the color-token pass
  (every custom property `css/app.css`'s `:root`/`html.light` blocks define —
  see that file's `THEME SYSTEM` header comment). `theme.cssPath` points at
  `theme.css` for changes variables can't express.
- `theme.css` — typography, corner treatment, and a couple of decorative
  touches, all scoped under `html[data-theme="modern-noir"]`.

## How theme packs work

See `js/core/theme-manager.js` for the full mechanism. Short version: any
`pack.json` (of any `type` — `module`, `hybrid`, `document`, or the new
`theme`) can include an optional top-level `theme` block:

```json
"theme": {
  "id": "modern-noir",
  "label": "Modern Noir",
  "icon": "🌆",
  "isDark": true,
  "cssPath": "theme.css",
  "variables": { "--gold": "#00f5d4", "...": "..." }
}
```

`js/core/pack-manager.js`'s `installPack()` reads `variables` directly and
`cssPath`'s file as text (so it can be persisted and reconstituted into a
fresh stylesheet on every future app boot — unlike a pack's JS module
routes, a pack theme survives a page reload), then registers it with
`theme-manager.js`. From that point it behaves exactly like the two
built-in themes (Dark/Light): it shows up in Settings → Theme & Appearance,
and `setTheme('modern-noir')` applies it.

## Installing this draft locally

The in-app installer (Settings → Pack Management) expects a `.zip`
containing `pack.json` at its root. From this directory:

```sh
cd data/themes/modern-noir
zip -r modern-noir.pack.zip pack.json theme.css
```

Then use **Install Pack** in Settings and select the resulting zip. Because
this is bundled in the repo's `data/` tree rather than an actual separate
install, you can also just hand-register it for local dev by calling
`registerTheme()` from `core/theme-manager.js` directly with the contents of
`pack.json`'s `theme` block — useful while iterating on `theme.css` without
re-zipping on every change.

## Roadmap (not yet done)

- Typography pass beyond headings (a real display face for the brand mark,
  not just `monospace`).
- VTT grid/token treatment — the whiteboard/combat grid currently inherits
  plain theme colors only; a cyberpunk pass would want its own grid line
  style and token glow.
- Iconography — the emoji icons used throughout (🎲, 📜, ⚔️, etc.) read
  oddly against a neon-noir palette; likely wants a small SVG icon set
  swapped in per-theme eventually, which the current theme system doesn't
  have a hook for yet (icons are hardcoded in each feature's template
  strings, not themed) — flagging this as a real limitation of the theme
  system as it stands today, not just this draft.
- Coordinate the palette/tone with whatever the `modern_noir.tex` content
  revision lands on, rather than the other way around.
