# Fate's Edge Web Client – Implementation Roadmap

Based on the full codebase review and the **Essentials** rules, here is a detailed roadmap of what needs to be modified, added, and in which files. The adventure JSON for "The Lantern at Dusk" is already well-structured — the work now is bridging it with automated mechanics.

---

## 1. Safety Tools (Lines, Veils & X-Card)

*Essentials §1.2 – Critical for safe play.*

| File(s) | Action |
|---------|--------|
| `index.html` | Add a floating "🛑 X-Card" button in the bottom-right corner of the main layout. |
| `index.html` | Add a hidden overlay div for the X-Card modal (full-screen pause). |
| `css/app.css` | Style the X-Card overlay with a large red "🛑 PAUSED" message, blur effect, and a "Resume" button. |
| `js/features/gm-tools/index.js` | Add a **Safety Tools** panel: text areas for Lines and Veils, stored in `state.campaign.safety`. |
| `js/core/state.js` | Extend the default state with `campaign.safety: { lines: "", veils: "", sessionZero: {} }`. |
| `js/app.js` | Register a global keyboard shortcut (e.g., `Ctrl+Shift+X`) to toggle the X-Card overlay. |
| `js/features/gm-tools/index.js` | Add a **Session Zero Checklist** component (tone, campaign length, character hooks) with save functionality. |

---

## 2. Automation: Timers Auto-Tick on Partial/Miss

*Essentials §2.1 & §2.3 – Timers tick on Partial/Miss and SB spends.*

| File(s) | Action |
|---------|--------|
| `js/core/dice.js` | Expose the roll result (Partial/Miss) and SB count to the caller. |
| `js/features/vtt/vtt-core.js` | After a roll is performed, check if the result is `Partial` or `Miss`. If so, dispatch a custom event: `"timer-tick-request"` with the roll context. |
| `js/features/gm-tools/index.js` | Listen for `"timer-tick-request"`. If there is an active adventure with scene timers, prompt the GM (or auto-tick) the relevant timer. |
| `js/features/adventure-manager/index.js` | Add a function `tickActiveSceneTimer(adventureId, amount = 1)` that advances the current scene's timer(s). |
| `js/features/gm-tools/index.js` | Add a GM setting toggle: **"Auto-tick active timers on Partial/Miss"** (default: off). |

---

## 3. Automation: Fatigue Auto-Worsens Position

*Essentials §2.4 – Each Fatigue worsens Position by one step.*

| File(s) | Action |
|---------|--------|
| `js/features/characters/roller.js` | Modify `K(e, o, t, i, s, a)` (the dice roll function) to accept the character's current Fatigue. |
| `js/features/characters/roller.js` | Derive the "Effective Position" from the base Position and Fatigue level: `Dominant → Controlled → Desperate`, then `–1 die per additional Fatigue`. |
| `js/features/vtt/vtt-local.js` & `vtt-connected.js` | In the Quick Roller, pre-populate the Fatigue input from the selected character's current Fatigue. Display the "Effective Position" as a read-only label next to the Position dropdown. |
| `js/features/characters/editor.js` | When Fatigue changes, recalculate and display the "Effective Position" in the character summary. |

---

## 4. Automation: Armor Auto-Conversion in Combat Tracker

*Essentials §2.4 & §A.7 – Armor converts Harm to Fatigue.*

| File(s) | Action |
|---------|--------|
| `js/features/encounters/combat.js` | In `damageCombatant(idx)`, when applying damage, read the target's `armorType` (from the combatant object, or from the linked character sheet). |
| `js/features/encounters/combat.js` | Implement the Armor Conversion Table as a function: `applyArmorConversion(harm, armorType)` → returns `{ harm: number, fatigue: number }`. |
| `js/features/encounters/combat.js` | Modify the damage flow: apply the converted Fatigue to the combatant's Fatigue track, and the remaining Harm to their Harm track. |
| `js/features/encounters/combat.js` | In the "Add Combatant" flow, allow the user to select an Armor Type (Light/Medium/Heavy) for each combatant (default: None). |

---

## 5. Automation: Boons Limit on Scene End

*Essentials §2.2 – Reduce held Boons to 2 at scene end.*

| File(s) | Action |
|---------|--------|
| `js/features/gm-tools/index.js` | In the existing `sceneEndTrimBoons()` function, also reset any per-scene flags (e.g., Combat Actions usage). |
| `js/features/vtt/combat-actions.js` | Expose a `resetCombatScene()` function that clears the `sceneUseCounts` map. |
| `js/features/gm-tools/index.js` | Call `resetCombatScene()` when `sceneEndTrimBoons()` is triggered. |
| `js/features/gm-tools/index.js` | Add a visual warning (floating toast) if any character has >2 Boons when a new scene starts. |

---

## 6. Automation: Auto-Increment Story Beat (SB) Bank

*Essentials §2.3 – Each rolled `1` generates a Story Beat for the GM.*

| File(s) | Action |
|---------|--------|
| `js/core/dice.js` | In `performRoll`, count the number of `1`s rolled. Return this as `storyBeats` (already done). |
| `js/features/vtt/vtt-core.js` | After any roll that produces `storyBeats > 0`, dispatch a custom event: `"sb-generated"` with the SB count. |
| `js/features/gm-tools/index.js` | Listen for `"sb-generated"`. Auto-increment the GM's SB Bank (in `state.gm.sbBank`). |
| `js/features/gm-tools/index.js` | Show a brief toast: `"🎲 Story Beat +1 (Total: X)."` |
| `js/features/gm-tools/index.js` | Modify the SB Bank UI to show live updates. |

---

## 7. Integration: Pre-Generated Characters

*Essentials §4 – Five pre-generated characters ready to play.*

| File(s) | Action |
|---------|--------|
| `js/features/characters/wizard.js` | Add a **"📋 Load Pre-Gen"** button below the Character Name input. |
| `data/pre-gens.json` | Create a new JSON file containing all 5 pre-generated characters (Levi, Lyra, Sera, Mira, Kael). |
| `js/features/characters/wizard.js` | Fetch `data/pre-gens.json`, display a dropdown list of names. On selection, populate all wizard fields (Attributes, Skills, Talents, Gear). |
| `js/features/characters/wizard.js` | Ensure the pre-gen data includes the correct XP calculations (including Bonds/Complications). |

---

## 8. Integration: "The Lantern at Dusk" Starter Adventure

*Essentials §5 – The adventure JSON is already in the codebase. Ensure it's discoverable and auto-loads its timers.*

| File(s) | Action |
|---------|--------|
| `data/adventures/lantern_at_dusk.json` | Ensure this file exists and is correctly formatted (it appears to be already). |
| `js/features/adventure-manager/index.js` | Modify `loadAdventureManifest()` to include a hardcoded fallback entry for `"lantern_at_dusk"` so it appears in the library even if the manifest is missing. |
| `js/features/adventure-manager/index.js` | When an adventure is started, auto-populate its `campaignTimers` into the GM Tools' Timer panel. |
| `js/features/gm-tools/index.js` | Add a **"Start Adventure"** button in the GM Tools that loads the current adventure's timers. |
| `js/features/adventure-manager/index.js` | When a scene is completed, auto-advance the adventure's `currentScene` and update the GM Tools display. |

---

## 9. UI/UX: Adventure Detail Enhancements

| File(s) | Action |
|---------|--------|
| `js/features/adventure-manager/index.js` | In `buildAdventureDetailHtml`, render the **bestiary** as expandable cards with the creature's SB spends. |
| `js/features/adventure-manager/index.js` | In the detail view, add a **"Start Encounter"** button next to scenes that have `encounters` with `creatureId`. |
| `js/features/adventure-manager/index.js` | When "Start Encounter" is clicked, call `startSceneEncounter()` which resolves the creature from the adventure's bestiary and opens the Combat Tracker. |
| `js/features/adventure-manager/index.js` | Add a **"Show Scene Description"** toggle that renders the scene description using the `renderDescriptionHtml()` function (already present). |

---

## 10. Automation: "The Lantern at Dusk" Specific Auto-Timers

| File(s) | Action |
|---------|--------|
| `js/features/adventure-manager/index.js` | When the adventure starts, automatically create two timers: **Barrow Collapse [6]** and **Lena's Agenda [4]**. |
| `js/features/adventure-manager/index.js` | In `advanceTimer()`, when **Barrow Collapse** reaches 6, trigger a notification: *"The entrance seals! Escape becomes a Desperate group action."* |
| `js/features/adventure-manager/index.js` | When **Lena's Agenda** reaches 4, auto-mark the "Lantern Chamber" scene as completed and advance to the "Escape" scene (or trigger a "Lena has taken the lantern" event). |
| `js/features/adventure-manager/index.js` | In the "Escape" scene, implement the **Group Skill Challenge** logic: the party needs 3 successes before 2 failures. |

---

## 11. UI/UX: The Lantern at Dusk – Quick Start

| File(s) | Action |
|---------|--------|
| `js/app.js` | On first load, check if `state.adventures` is empty. If so, auto-load `lantern_at_dusk` from the `/data/adventures/` directory. |
| `js/features/home/index.js` | Add a **"🚀 Quick Start – The Lantern at Dusk"** button on the Home page that directly loads the adventure and switches to the Adventure Manager tab. |
| `js/features/adventure-manager/index.js` | Add a **"Start Adventure"** button in the Adventure Manager that, when clicked, loads the pre-gen characters (Levi, Lyra, etc.) and starts the adventure. |

---

## 12. Code Quality: Extract Shared Helpers

| File(s) | Action |
|---------|--------|
| `js/core/utils.js` | Add shared helpers: `safeParseInt`, `clamp`, `deepMerge` (already partially there, consolidate). |
| `js/core/utils.js` | Add `renderDescriptionHtml(text)` – move it from adventure-manager to core so it can be reused by the Wiki and VTT. |
| `js/core/utils.js` | Add `getTierFromXp(xp)` and `getTierColor(tier)` for consistent tier display. |
| `js/core/utils.js` | Add `formatDuration(ms)` and `timeAgo(date)` for timer displays. |

---

## 13. Security: Content Sanitization

| File(s) | Action |
|---------|--------|
| `js/core/utils.js` | Add a `sanitizeHtml(html)` function that removes `<script>` tags and `on*` attributes using a DOMPurify-like approach (or integrate DOMPurify as a dependency). |
| `js/features/wiki/editor.js` | Apply `sanitizeHtml()` to the preview output. |
| `js/features/adventure-manager/index.js` | Apply `sanitizeHtml()` to all adventure descriptions before rendering. |
| `js/features/vtt/vtt-core.js` | Apply `sanitizeHtml()` to chat messages before rendering. |

---

## 14. Infrastructure: Default Data Bundling

| File(s) | Action |
|---------|--------|
| `data/adventures/lantern_at_dusk.json` | Ensure this file is included in the repository and copied to the build output. |
| `data/pre-gens.json` | Create and include. |
| `Makefile` | Add a rule to copy `data/` to the build directory. |
| `Dockerfile` | Ensure the `data/` directory is included in the container image. |

---

## 15. Testing: New Feature Coverage

| File(s) | Action |
|---------|--------|
| `tests/unit/dice.test.js` | Add tests for Fatigue auto-worsening Position. |
| `tests/unit/armor.test.js` | Add tests for Armor Conversion (Light/Medium/Heavy). |
| `tests/unit/timers.test.js` | Add tests for auto-ticking timers on Partial/Miss. |
| `tests/integration/adventure-manager.test.js` | Add tests for starting "The Lantern at Dusk" and auto-loading its timers. |

---

## Summary of Priority

| Priority | Feature | Files Touched |
| :--- | :--- | :--- |
| 1 | Safety Tools (X-Card, Lines/Veils) | `index.html`, `app.css`, `gm-tools/index.js`, `state.js` |
| 2 | Auto-tick Timers on Partial/Miss | `dice.js`, `vtt-core.js`, `gm-tools/index.js`, `adventure-manager/index.js` |
| 3 | Fatigue auto-worsens Position | `roller.js`, `vtt-local.js`, `editor.js` |
| 4 | Armor auto-conversion | `combat.js` |
| 5 | Pre-Gen Characters | `wizard.js`, `data/pre-gens.json` |
| 6 | Auto-increment SB Bank | `dice.js`, `vtt-core.js`, `gm-tools/index.js` |
| 7 | Adventure Detail Enhancements | `adventure-manager/index.js` |
| 8 | Content Sanitization | `utils.js`, `wiki/editor.js`, `vtt-core.js` |

This roadmap provides a clear, file-by-file implementation plan to bring the client fully in line with the *Essentials* rules and make "The Lantern at Dusk" a seamless, automated onboarding experience.