# Fate’s Edge for Roll20

This integration provides **local** dice, a 54-card deck, GM timers, character export, and a custom character sheet. It does not connect to the Fate’s Edge socket server. Roll20’s [Mod sandbox](https://wiki.roll20.net/Mod_Sandbox) provides neither external networking nor browser DOM APIs; the former WebSocket bridge could not run there.

## Installation

1. In a game with access to Roll20 Mods, open the Mod script editor, create a new script, paste `api/fates-edge-api.js`, and save it. Remove the former bridge script to avoid duplicate handlers.
2. As the GM, enter `!fates-edge help` in chat, then `!fates-edge shuffle` and `!fates-edge draw 1`.
3. For the optional custom sheet, choose a Custom character sheet in game settings and paste `character-sheet/fates-edge.html` into HTML and `character-sheet/fates-edge.css` into CSS. Availability of Mods and custom sheets depends on the game creator’s Roll20 subscription.

The sheet uses Roll20 roll buttons rather than browser scripts. Body + Melee and Wits + Stealth roll d10 pools. Apply successes, complications, and Story Beats using your table rules; this helper does not adjudicate them.

## Commands (GM only)

| Command | Result |
| --- | --- |
| `!fates-edge roll 4d10` | Local Roll20 dice (up to 100 dice, 2–100 sides; optional integer modifier) |
| `!fates-edge shuffle` | Reset and shuffle the local 54-card deck |
| `!fates-edge draw 2` | Draw 1–5 cards without replacement |
| `!fates-edge crown` | Draw five local cards; interpret the spread at the table |
| `!fates-edge timer add doom 6` | Create or replace a local timer |
| `!fates-edge timer tick doom 1` | Advance the timer, clamped to its size |
| `!fates-edge timer list` | Show local timers privately to the GM |
| `!fates-edge timer remove doom` | Remove a timer |
| `!fates-edge export CHARACTER_ID` | Show character JSON privately to the GM for manual copying |

These cards and timers are independent of the web client. There is no live region synthesis, automated import, module sync, or server administration here. Use Discord or Foundry for live server connections. Example macros are in `macros/examples.md`.

## Verification

From the repository root, after installing the Discord and socket-server dependencies:

```sh
node --test utilities/vtt_mods_bots/tests/*.test.js
```

The Roll20 tests execute the actual script with only sandbox APIs, check authorization, deck draws, timer bounds, and native sheet buttons. A real Roll20 game remains necessary to verify installation and visual rendering.
