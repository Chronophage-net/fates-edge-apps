# Horror theme pack (v4.6.3)

A gothic/cosmic-horror visual reskin, built the same way as the sibling
`modern-noir/` theme (same `theme-manager.js`/`pack-manager.js`
mechanism — see that folder's README for how theme packs work in
general) but with its own palette and mood: blood-red and bone instead
of neon cyan, a vignette instead of a glow, serif instead of monospace.
Paired with the **Horror Campaigns** setting expansion
(`fates-edge-docs/ttrpg/reference/expansions/horror_campaigns.tex`).

## What's here

- `pack.json` — the pack manifest and `theme.variables` color-token pass.
- `theme.css` — typography, vignette, VTT grid/token treatment, and a
  subtle candlelight-flicker animation on the sidebar border (respects
  `prefers-reduced-motion`).

This theme also ships as part of the full **Horror module package** in
the docs repo (`fates-edge-docs/ttrpg/reference/expansions/horror-module/`),
which bundles it with Thornhaven/Daughters-of-the-Cord data for the web
client and a ready-to-push socket-server adventure ("The Ninth Bell").
This folder remains the development copy; the docs module folder is the
distributable (shipped there as a prebuilt `.zip`).

## Installing this draft locally

```sh
cd data/themes/horror
zip -r horror.pack.zip pack.json theme.css
```

Then use **Install Pack** in Settings, or hand-register it for local dev
via `registerTheme()` in `core/theme-manager.js` while iterating on
`theme.css`.

## Roadmap

- Same open items as the Modern Noir theme: no themed SVG icon set yet
  (icons are hardcoded per-feature, not theme-aware), and `--token-color`
  needs a per-token source (e.g. a faction color) to actually vary the
  glow — right now every token gets the same accent-color glow.
- A body-horror variant of the vignette (pulsing rather than flickering)
  could better suit the Corruption Track / Collective Insanity mechanics
  than the current candlelight flicker, which reads more "haunted
  location" than "cosmic dread."
