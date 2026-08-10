# Modern Noir theme pack (v4.6.2)

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

## What's new in v0.2.0

- Typography: brand mark now gets its own rule (uppercase, wider tracking,
  cyan text-shadow) on top of the existing h1–h3 monospace treatment.
- VTT grid/token treatment: `.vtt-grid`/`.whiteboard-grid`/`.combat-grid`
  get a tinted grid line color instead of inheriting neutral defaults, and
  tokens/markers get a neon rim-light (`--token-color` custom property,
  falling back to the theme accent) instead of a plain outline.
- Iconography: a targeted `filter` desaturate-and-retint on the handful of
  icon classes most likely to read oddly in full color (dice, scroll,
  flame, brand icon).
- This theme now ships as part of the full **Modern Noir module package**
  in the docs repo (`fates-edge-docs/ttrpg/reference/expansions/modern-noir-module/`),
  which bundles this theme with case/faction data for the web client and a
  ready-to-push socket-server adventure. This folder remains the
  development copy; the docs module folder is the distributable.

## Roadmap (still not done)

- A real SVG icon set swapped in per-theme — the `filter` spot-fix above
  covers the worst offenders but isn't a substitute for actual themed
  iconography. Icons are still hardcoded in each feature's template
  strings, not themed, which remains a real limitation of the theme system
  as it stands today.
- `--token-color` is read by the CSS above but nothing sets it per-token
  yet — the VTT token/marker components would need to write that custom
  property (e.g. from a faction color) for the glow to vary; today every
  token gets the same accent-color glow.
- Further coordinate palette/tone with the `modern_noir.tex` revision.
