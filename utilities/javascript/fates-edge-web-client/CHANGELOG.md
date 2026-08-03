# Changelog

All notable changes to the Fate's Edge Web Client are logged here. This file starts at 4.2 — earlier versions (up through 4.1.2a) predate this convention and aren't reconstructed retroactively.

## [4.2.0]

### Talents — mechanical teeth
- New talent effects engine (`js/core/talent-effects.js`): a small structured grammar (die bonuses, Position shifts, ignored penalties, conditional re-rolls) plus a free-text interpreter so existing talent/wiki text isn't wasted work.
- Use-limit charge tracking (once/scene, once/session, once/arc, once/campaign) via `character.talentUses`, reset at scene end and new session.
- Talent effects now actually modify dice pools via the roller, instead of being flavor text only.
- Seed content pack: `data/talents-manifest.json` + `data/talents/*.json` (10 talents), loaded through `talent-loader.js`.
- Unified the two talent editors (character sheet quick-add vs. the dedicated talent editor modal) so both write the same structured data.

### Weapons & range bands
- The combat tracker's weapon axis is now **Light / Medium / Heavy / Ranged** — matching the Player's Guide's actual weight-class system (§3.12.1–3.12.3) — replacing an earlier, incorrect "weapon type" (one-handed/reach/ranged) split.
- Dice bonuses per weight class and range band now come straight from the Player's Guide's Melee Modifiers and Ranged & Tempo tables for Close/Medium(Near)/Far; Reach and Absent are this table's own extended-band house rule layered on top of the book's 3-band Close/Near/Far (only Heavy melee — halberd, greatsword — can threaten Reach).
- A range selector (Close/Medium/Reach/Far/Absent) is now available in both the Character Roller and the VTT's embedded Quick Roller (local + connected), with the selected range shown in the roll result and posted to VTT chat.
- Combat tracker's range grid is GM-gated in connected sessions (players can see it; only the GM can change it). Solo/local play remains fully open.

### Shields
- `editor.js`'s Shield selector (Buckler/Heater/Pavise) previously had zero runtime effect. Heater and Pavise now apply the book's `-1d Ranged` (bulky/off-hand) penalty when rolling with a Ranged weapon; the Defend bonus and Harm→Fatigue conversion are surfaced as roll-modifier reminder notes (situational, not part of the generic dice pool).

### Boon economy
- Fixed a pre-existing bug where "boons to spend" (pre-roll boon spend, intended as +1d/boon) was accepted by the roller but never actually added to the dice pool.
- Implemented **Fatigue-as-Boon**: if a character spends more Boons than they have, the shortfall is now paid in real Fatigue instead of silently over-spending — the roll still gets its full requested bonus, and the Fatigue persists to the character sheet afterward.
- Boons spent on a roll are now actually deducted from the character's Boon pool (previously only Boons *gained* from Partial/Miss outcomes were applied).

### X-Card / safety tool
- The floating X-Card button did nothing when clicked — its click handler (`setupXCard()`) was written but never called during app init. Fixed, along with a missing `escHtml` import that would have broken the Lines/Veils display once the overlay opened.
- Raising the X-Card now broadcasts to every connected client (not just the person who clicked it) so the whole table pauses together, and posts a notice into VTT chat on both raise and resume.

### VTT & Whiteboard
- New inline mini combat tracker card in the VTT sidebar: live initiative order, active-turn indicator, and range-to-you, without needing the full Encounters tracker modal open.
- Whiteboard toolbar reorganized into collapsible sections (Draw / Tokens & Combat / Fog & Light / View) instead of one long wrapped row.
- Whiteboard → VTT chat bridge: pings, Fog of War toggling/clearing, and Kon'reh now post short notices into VTT chat.
- VTT chat panel now sizes itself against the viewport instead of a fixed pixel height, so it behaves on short/mobile screens.
- Added 3D animated dice, a macro/quick-action bar, ambience/SFX soundboard, character portraits, and richer presence (who's viewing what) to the roller/VTT.
- Fixed a drifted duplicate of the Scene End boon-trim logic in the VTT (it never reset once/scene talent charges); now delegates to the shared GM Tools implementation.
- Redacted `js/features/vtt/combat.js`, a stale duplicate of the real combat tracker at `js/features/encounters/combat.js`.

### Bug fixes
- `roller.js` was missing an `updateCharacter` import, crashing on any roll that gained Boons.
- `pack-manager.js`'s `validatePack()` never returned a value, crashing `installPack()`.
- Removed a self-referencing `factions-manifest` entry that broke faction search.
