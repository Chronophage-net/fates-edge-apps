import { describe, it, assert, assertEqual, assertDeepEqual, assertFalse, assertTrue } from '../runner.js';
import {
    ATTUNEMENT_LIMIT,
    canAttune,
    upkeepCostFor,
    intensiveUpkeepCostFor,
    DECAY_ORDER,
    advanceDecay,
    itemRequiresUpkeep,
    applyDowntimeTick,
    FORAGE_LIMIT_PER_DOWNTIME,
    canForage,
    getForageCount,
    recordForageAttempt,
    resetForageCount
} from '../../js/features/crafting/index.js';

describe('crafting: attunement cap', () => {

    it('caps attunement at 3 items', () => {
        assertEqual(ATTUNEMENT_LIMIT, 3);

        let attuned = [];
        assertTrue(canAttune(attuned, 'item-1'));
        attuned.push({ id: 'item-1' });
        assertTrue(canAttune(attuned, 'item-2'));
        attuned.push({ id: 'item-2' });
        assertTrue(canAttune(attuned, 'item-3'));
        attuned.push({ id: 'item-3' });

        // A 4th new item should now be rejected...
        assertFalse(canAttune(attuned, 'item-4'));
        // ...but toggling OFF one already in the list is always allowed
        // regardless of how full the list is (that's how you break
        // attunement to free up a slot).
        assertTrue(canAttune(attuned, 'item-1'));
    });

    it('allows re-attuning after breaking one of three', () => {
        let attuned = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        assertFalse(canAttune(attuned, 'd'));
        attuned = attuned.filter(a => a.id !== 'b');
        assertTrue(canAttune(attuned, 'd'));
    });
});

describe('crafting: upkeep formulas', () => {

    it('Efficient upkeep = ceil(cost / 3), minimum 1', () => {
        assertEqual(upkeepCostFor({ cost: 0 }), 1);
        assertEqual(upkeepCostFor({ cost: 1 }), 1);
        assertEqual(upkeepCostFor({ cost: 3 }), 1);
        assertEqual(upkeepCostFor({ cost: 4 }), 2);   // ceil(4/3) = 2
        assertEqual(upkeepCostFor({ cost: 6 }), 2);
        assertEqual(upkeepCostFor({ cost: 7 }), 3);   // ceil(7/3) = 3
        assertEqual(upkeepCostFor({ cost: 9 }), 3);
        assertEqual(upkeepCostFor({ cost: 10 }), 4);  // ceil(10/3) = 4
        assertEqual(upkeepCostFor({}), 1);            // no cost field at all
    });

    it('Intensive upkeep = 1 XP + a downtime scene (flat 1 XP)', () => {
        assertEqual(intensiveUpkeepCostFor({ cost: 0 }), 1);
        assertEqual(intensiveUpkeepCostFor({ cost: 30 }), 1);
        assertEqual(intensiveUpkeepCostFor({}), 1);
    });
});

describe('crafting: decay state transitions', () => {
    // Per fates-edge-docs/ttrpg/player_guide/sections/items.tex
    // "Attunement and Upkeep": skipping upkeep for one downtime ->
    // Neglected (no benefit until paid retroactively); skipping a
    // second consecutive downtime -> Compromised (requires a quest to
    // restore, not just upkeep). Driven by the 'downtime-tick'
    // CustomEvent dispatched from factions/index.js's
    // "GM Downtime (Faction Turn)" button; applyDowntimeTick() is the
    // pure per-tick step so it's testable without the DOM/event system.

    it('advanceDecay() steps maintained -> neglected -> compromised, then floors', () => {
        assertDeepEqual(DECAY_ORDER, ['maintained', 'neglected', 'compromised']);
        assertEqual(advanceDecay('maintained'), 'neglected');
        assertEqual(advanceDecay('neglected'), 'compromised');
        assertEqual(advanceDecay('compromised'), 'compromised'); // floor, doesn't wrap
        assertEqual(advanceDecay(undefined), 'neglected'); // missing condition treated as 'maintained'
    });

    it('itemRequiresUpkeep() is false only for artifacts', () => {
        assertTrue(itemRequiresUpkeep({ category: 'magic_item' }));
        assertTrue(itemRequiresUpkeep({}));
        assertFalse(itemRequiresUpkeep({ category: 'artifact' }));
    });

    it('applyDowntimeTick() decays unpaid items one step and resets the paid flag', () => {
        const attuned = [
            { id: 'a', condition: 'maintained', paidUpkeepThisDowntime: false },
            { id: 'b', condition: 'neglected', paidUpkeepThisDowntime: false },
        ];
        applyDowntimeTick(attuned);
        assertEqual(attuned[0].condition, 'neglected');
        assertEqual(attuned[1].condition, 'compromised');
        assertFalse(attuned[0].paidUpkeepThisDowntime);
        assertFalse(attuned[1].paidUpkeepThisDowntime);
    });

    it('applyDowntimeTick() restores paid items to maintained and consumes the flag', () => {
        const attuned = [
            { id: 'a', condition: 'neglected', paidUpkeepThisDowntime: true },
        ];
        applyDowntimeTick(attuned);
        assertEqual(attuned[0].condition, 'maintained');
        assertFalse(attuned[0].paidUpkeepThisDowntime); // consumed, doesn't carry over to next tick for free
    });

    it('two consecutive skipped downtimes reach Compromised, matching the rule text exactly', () => {
        const item = { id: 'a', condition: 'maintained', paidUpkeepThisDowntime: false };
        const attuned = [item];
        applyDowntimeTick(attuned); // downtime 1, skipped
        assertEqual(item.condition, 'neglected');
        applyDowntimeTick(attuned); // downtime 2, skipped again (consecutive)
        assertEqual(item.condition, 'compromised');
    });

    it('paying upkeep between downtimes prevents decay on the next tick', () => {
        const item = { id: 'a', condition: 'maintained', paidUpkeepThisDowntime: false };
        const attuned = [item];
        applyDowntimeTick(attuned); // downtime 1, skipped -> neglected
        assertEqual(item.condition, 'neglected');
        item.paidUpkeepThisDowntime = true; // simulates payUpkeep() being called before the next tick
        applyDowntimeTick(attuned); // downtime 2, paid -> back to maintained
        assertEqual(item.condition, 'maintained');
    });

    it('artifacts never decay across ticks even when never "paid"', () => {
        const artifact = { id: 'art', category: 'artifact', condition: 'maintained', paidUpkeepThisDowntime: false };
        const attuned = [artifact];
        applyDowntimeTick(attuned);
        applyDowntimeTick(attuned);
        applyDowntimeTick(attuned);
        assertEqual(artifact.condition, 'maintained');
    });
});

describe('crafting: forage attempts per downtime', () => {
    // Not specified in the rulebook (world_interactions.tex's
    // "Foraging and Subsistence by Region" table is an unrelated travel
    // mechanic) — this cap is a web-client-only economy/pacing decision.
    // See state.js's FORAGE_LIMIT_PER_DOWNTIME comment. Resets on the
    // same 'downtime-tick' event as upkeep decay.

    it('FORAGE_LIMIT_PER_DOWNTIME is a small positive number', () => {
        assertTrue(FORAGE_LIMIT_PER_DOWNTIME > 0);
        assertEqual(FORAGE_LIMIT_PER_DOWNTIME, 3);
    });

    it('canForage() allows attempts until the limit, then blocks', () => {
        const char = { crafting: {} };
        for (let i = 0; i < FORAGE_LIMIT_PER_DOWNTIME; i++) {
            assertTrue(canForage(char), `attempt ${i + 1} should still be allowed`);
            recordForageAttempt(char);
        }
        assertFalse(canForage(char), 'should be blocked once the limit is reached');
        assertEqual(getForageCount(char), FORAGE_LIMIT_PER_DOWNTIME);
    });

    it('recordForageAttempt() increments and getForageCount() defaults to 0', () => {
        const char = {};
        assertEqual(getForageCount(char), 0);
        assertEqual(recordForageAttempt(char), 1);
        assertEqual(recordForageAttempt(char), 2);
        assertEqual(getForageCount(char), 2);
    });

    it('resetForageCount() (the downtime-tick step) restores a full allowance', () => {
        const char = { crafting: { forageCount: FORAGE_LIMIT_PER_DOWNTIME } };
        assertFalse(canForage(char));
        resetForageCount(char);
        assertEqual(getForageCount(char), 0);
        assertTrue(canForage(char));
    });
});

// ===== SRD 6.9 crafting rules =====

import { FLAWS, flawById, wonderObligationFor } from '../../js/features/crafting/state.js';

describe('crafting: Wonders borrow their magic (SRD 6.9.5)', () => {
    it('marks Obligation by Talent-equivalent tier', () => {
        assertEqual(wonderObligationFor(2), 1, 'Minor (2 XP) marks 1 Obligation');
        assertEqual(wonderObligationFor(4), 2, 'Major (4 XP) marks 2');
        assertEqual(wonderObligationFor(6), 3, 'Prestige (6 XP) marks 3');
        assertEqual(wonderObligationFor(8), 4, 'Epic (8 XP) marks 4');
    });

    it('a Provision or a Work borrows nothing', () => {
        assertEqual(wonderObligationFor(0), 0, 'no XP cost means no Obligation');
        assertEqual(wonderObligationFor(undefined), 0, 'a missing cost is not a Wonder');
    });
});

describe('crafting: Flaws (SRD 6.9.4)', () => {
    it('offers the five named Flaws, each with an effect', () => {
        assertEqual(FLAWS.length, 5, 'the SRD names five Flaws');
        for (const f of FLAWS) {
            assertTrue(!!f.id && !!f.name && !!f.effect, `Flaw ${f.id} is missing a field`);
        }
        for (const id of ['thirsty', 'loud', 'remembering', 'brittle', 'marked']) {
            assertTrue(!!flawById(id), `Flaw "${id}" should exist`);
        }
    });

    it('flawById returns null for an unknown Flaw rather than throwing', () => {
        assertEqual(flawById('immaculate'), null, 'unknown Flaws are null, not exceptions');
    });
});

// ============================================================
// REGRESSION: duplicate event listeners on the crafting container
// ============================================================
//
// Reported symptom: expand the first recipe (fine, it opens and scrolls),
// then close it — and the page stops responding.
//
// Cause: render() replaces container.innerHTML but NOT the container element,
// while attachEvents() bound four delegated listeners to that same container
// on every render. Handlers therefore accumulated — 1 set, then 2, then 4 —
// and because every handler calls refreshPanel(), which re-binds, the count
// doubled on each click until the page locked up. The even-numbered firings
// also cancelled the expand/collapse toggle out, so the card looked dead
// before the tab froze.
//
// These are source guards rather than DOM tests: the accumulation only shows
// up across real renders against a live container, which the test DOM shim's
// no-op addEventListener cannot model. They pin the three properties that
// actually prevent the bug.

describe('crafting source guard (regression): container listeners bind once', () => {

    async function craftingSource() {
        const { readFileSync } = await import('node:fs');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const p = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../js/features/crafting/index.js');
        return readFileSync(p, 'utf8');
    }

    it('guards every container.addEventListener behind a bind-once flag', async () => {
        const src = await craftingSource();

        const guardIdx = src.indexOf('container[BOUND_FLAG] = true;');
        assert(guardIdx > -1, 'attachEvents() must set a bind-once flag on the container element');
        assert(
            src.indexOf('if (container[BOUND_FLAG]) return;') > -1,
            'attachEvents() must return early when the container is already bound'
        );

        // Every delegated listener must sit AFTER the guard, so a re-render
        // cannot add a second copy of it.
        const positions = [];
        let i = src.indexOf('container.addEventListener');
        while (i !== -1) { positions.push(i); i = src.indexOf('container.addEventListener', i + 1); }
        assert(positions.length > 0, 'expected delegated listeners on the container');
        for (const pos of positions) {
            assert(pos > guardIdx, 'a container.addEventListener call sits before the bind-once guard — it will be re-bound on every render');
        }
    });

    it('does not capture a character in the long-lived handlers', async () => {
        const src = await craftingSource();
        // The handlers now outlive any single render, so a `char` captured at
        // bind time would go stale and get written back over newer data.
        assert(
            /function attachEvents\(\s*\)/.test(src),
            'attachEvents() must take no arguments — it must not close over a render-time character'
        );
        assert(
            /attachEvents\(\s*\);/.test(src),
            'render() must call attachEvents() with no arguments'
        );
        assert(
            src.indexOf('function currentChar()') > -1,
            'handlers must read the selected character at click time via currentChar()'
        );
    });

    it('does not re-parse wiki data on every click', async () => {
        const src = await craftingSource();
        const start = src.indexOf('function attachEvents');
        const end = src.indexOf('// TOAST WITH HTML');
        assert(start > -1 && end > start, 'could not locate attachEvents() body');
        const handlers = src.slice(start, end);

        for (const fn of ['parseIngredientsFromWiki', 'parseRecipesFromWiki', 'parseCodexFromWiki']) {
            assert(
                handlers.indexOf(fn + '(') === -1,
                `${fn}() must not run inside a click handler — render() already built that map`
            );
        }
    });
});
