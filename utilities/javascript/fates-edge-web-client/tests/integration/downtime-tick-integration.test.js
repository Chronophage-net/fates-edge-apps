import { describe, it, assertEqual } from '../runner.js';
import { getState, addCharacter, updateCharacter, getCharacter } from '../../js/core/state.js';

// End-to-end path: js/features/factions/index.js's "GM Downtime (Faction
// Turn)" button (window.factionTurn(), triggered here directly rather
// than via a DOM click since there's no real click event in this
// headless harness) dispatches a real 'downtime-tick' CustomEvent on
// `document` (see tests/support/dom-shim.js's EventTarget-alike), which
// js/features/crafting/index.js's module-level listener picks up and
// applies to every character's attuned items — not just the pure
// applyDowntimeTick() step covered in tests/unit/crafting.test.js, but
// the actual event wiring between the two unrelated features.
//
// Importing crafting/index.js registers its 'downtime-tick' listener as
// a side effect of module load (matches production: both are ES modules
// loaded once by the app shell). Importing factions/index.js defines
// window.factionTurn as a side effect the same way.
import '../../js/features/crafting/index.js';
import '../../js/features/factions/index.js';

describe('downtime-tick integration: factions -> crafting', () => {

    it('window.factionTurn() dispatches downtime-tick, and crafting decays unpaid attuned items for every character', () => {
        const char = addCharacter({ name: 'Downtime Test Char', totalXp: 10, xpSpent: 0 });
        updateCharacter(char.id, {
            crafting: {
                ingredients: [],
                crafted: [],
                attuned: [
                    { id: 501, name: 'Test Charm', category: 'magic_item', cost: 2, condition: 'maintained', paidUpkeepThisDowntime: false },
                    { id: 540, name: "Wanderer's Last Match", category: 'artifact', condition: 'maintained', paidUpkeepThisDowntime: false }
                ]
            }
        });

        window.factionTurn();

        const after = getCharacter(char.id);
        const [magicItem, artifact] = after.crafting.attuned;
        assertEqual(magicItem.condition, 'neglected', 'unpaid magic item should decay one step on a downtime tick');
        assertEqual(artifact.condition, 'maintained', 'artifacts require no upkeep and must never decay');

        // A second downtime, still unpaid -> Compromised (two consecutive
        // skipped downtimes, per items.tex).
        window.factionTurn();
        const after2 = getCharacter(char.id);
        assertEqual(after2.crafting.attuned[0].condition, 'compromised');
    });

    it('paying upkeep before the next downtime-tick keeps the item maintained', () => {
        const char = addCharacter({ name: 'Paid Upkeep Char', totalXp: 10, xpSpent: 0 });
        updateCharacter(char.id, {
            crafting: {
                ingredients: [],
                crafted: [],
                attuned: [
                    { id: 502, name: 'Paid Item', category: 'magic_item', cost: 2, condition: 'maintained', paidUpkeepThisDowntime: true }
                ]
            }
        });

        window.factionTurn();

        const after = getCharacter(char.id);
        assertEqual(after.crafting.attuned[0].condition, 'maintained');
        assertEqual(after.crafting.attuned[0].paidUpkeepThisDowntime, false, 'the paid flag is consumed by the tick, not carried forward for free');
    });
});
