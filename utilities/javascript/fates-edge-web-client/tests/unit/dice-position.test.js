import { describe, it, assert, assertEqual, assertTrue } from '../runner.js';
import { performRoll } from '../../js/core/dice.js';

// The Position ladder re-rolls exactly ONE die. The SRD is explicit:
//   Dominant:  "Re-roll one failure (die <= 5)."
//   Desperate: "Re-roll one success (die >= 6). 10s are never re-rolled."
//
// The engine used to re-roll EVERY failure on Dominant and EVERY success on
// Desperate, 10s included. That is not a rounding difference: it made
// Dominant far stronger than the rules describe and a Desperate roll close
// to unwinnable. These tests pin the "one die" contract, since it sits under
// every roll the app makes.

function rollMany(position, n = 400) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(performRoll(3, 2, 3, position));
    return out;
}

describe('performRoll: Position re-rolls exactly one die', () => {

    it('Dominant re-rolls at most one die', () => {
        for (const r of rollMany('dominant')) {
            assertTrue(r.reRolls <= 1, `Dominant re-rolled ${r.reRolls} dice; the rule allows one`);
            assertTrue((r.reRolledDice || []).length <= 1,
                `Dominant reported ${(r.reRolledDice || []).length} re-rolled dice; the rule allows one`);
        }
    });

    it('Desperate re-rolls at most one die', () => {
        for (const r of rollMany('desperate')) {
            assertTrue(r.reRolls <= 1, `Desperate re-rolled ${r.reRolls} dice; the rule allows one`);
        }
    });

    it('Controlled re-rolls nothing', () => {
        for (const r of rollMany('controlled')) {
            assertEqual(r.reRolls || 0, 0, 'Controlled Position grants no re-roll');
        }
    });

    it('Desperate never re-rolls a 10', () => {
        for (const r of rollMany('desperate', 800)) {
            for (const d of r.reRolledDice || []) {
                assertTrue(d.old !== 10, 'a 10 was re-rolled on Desperate; 10s are never re-rolled');
                assertTrue(d.old >= 6, `Desperate re-rolled a ${d.old}, which is not a success`);
            }
        }
    });

    it('Dominant only ever re-rolls a failure', () => {
        for (const r of rollMany('dominant', 800)) {
            for (const d of r.reRolledDice || []) {
                assertTrue(d.old <= 5, `Dominant re-rolled a ${d.old}, which is not a failure`);
            }
        }
    });

    it('Dominant beats Controlled beats Desperate, on average, over many rolls', () => {
        const mean = (pos) => {
            let total = 0;
            const n = 3000;
            for (let i = 0; i < n; i++) total += performRoll(3, 2, 3, pos).successes;
            return total / n;
        };
        const dom = mean('dominant'), con = mean('controlled'), des = mean('desperate');
        assertTrue(dom > con, `Dominant (${dom.toFixed(2)}) should beat Controlled (${con.toFixed(2)})`);
        assertTrue(con > des, `Controlled (${con.toFixed(2)}) should beat Desperate (${des.toFixed(2)})`);
        // And the gap should be about one die's worth either way, not half the pool.
        assertTrue(dom - con < 1.2, `Dominant is ${(dom - con).toFixed(2)} successes better than Controlled; one re-rolled die is worth well under 1`);
        assertTrue(con - des < 1.2, `Desperate is ${(con - des).toFixed(2)} successes worse than Controlled; one re-rolled die is worth well under 1`);
    });
});

// ============================================================
// REGRESSION: a re-rolled 1 keeps its Story Beat (SRD 18.1)
// ============================================================
//
// "Each die result of 1 generates 1 SB. Re-rolling a 1 does not erase its SB;
// if the re-rolled die also shows 1, it generates additional SB."
//
// performRoll() recomputed storyBeats from the final dice after a Position
// re-roll, which deleted the beat the original 1 had already earned. Dominant
// picks the LOWEST failing die, so whenever the pool contained a 1 that was
// exactly the die re-rolled — meaning Dominant silently ate a Story Beat on
// most rolls that generated one.

describe('dice: a re-rolled 1 keeps its Story Beat', () => {

    it('Dominant re-rolls the lowest failure without erasing its beat', () => {
        // Average SB per roll must not drop when Position improves. Story Beats
        // come from the dice, and Dominant re-rolls exactly one die — it can add
        // a beat (new 1) but must never subtract the one already earned.
        let dom = 0, ctl = 0;
        const N = 4000;
        for (let i = 0; i < N; i++) {
            dom += performRoll(3, 2, 3, 'dominant').storyBeats;
            ctl += performRoll(3, 2, 3, 'controlled').storyBeats;
        }
        const dAvg = dom / N, cAvg = ctl / N;
        // Controlled: 5 dice x 1/10 = 0.50 beats. Dominant re-rolls one die and
        // keeps any beat it had, so it can only be >= that, plus 1/10 of a beat
        // from the re-roll itself when a failure existed to re-roll.
        assert(dAvg >= cAvg - 0.06,
            `Dominant averaged ${dAvg.toFixed(3)} Story Beats vs Controlled ${cAvg.toFixed(3)} — ` +
            `improving Position must not destroy Story Beats`);
        assert(cAvg > 0.40 && cAvg < 0.60, `Controlled SB average ${cAvg.toFixed(3)} should sit near 0.50`);
    });

    it('never reports fewer beats than the surviving 1s in the final pool', () => {
        for (let i = 0; i < 2000; i++) {
            const r = performRoll(3, 2, 3, i % 2 ? 'dominant' : 'desperate');
            const onesShowing = r.dice.filter(d => d === 1).length;
            assert(r.storyBeats >= onesShowing,
                `reported ${r.storyBeats} beats but ${onesShowing} ones are showing`);
        }
    });
});

// ============================================================
// REGRESSION: roller.js counts Story Beats additively too
// ============================================================
//
// core/dice.js performRoll() was fixed to keep a re-rolled 1's Story Beat, but
// the character roller has its OWN re-roll implementation and was still
// recomputing beats from the final pool. Its Position re-rolls happened not to
// hit 1s (Dominant deliberately skipped them), but a TALENT-granted re-roll
// selects any die under 6 — so a talent that re-rolls a failure would silently
// delete the beat that failure had earned.

import { storyBeatsFor } from '../../js/features/characters/roller.js';

describe('roller: a re-rolled 1 keeps its Story Beat', () => {

    it('counts a beat for every 1 ever shown, not every 1 still showing', () => {
        // rolled a 1, re-rolled it into a 7: the beat was earned and stands
        assertEqual(storyBeatsFor([1, 5, 8], [{ index: 0, old: 1, new: 7 }]), 1);
    });

    it('adds a second beat when the re-roll is also a 1', () => {
        // SRD 18.1: "if the re-rolled die also shows 1, it generates additional SB"
        assertEqual(storyBeatsFor([1, 5, 8], [{ index: 0, old: 1, new: 1 }]), 2);
    });

    it('adds a beat when a non-1 is re-rolled into a 1', () => {
        assertEqual(storyBeatsFor([4, 5, 8], [{ index: 0, old: 4, new: 1 }]), 1);
    });

    it('is unchanged when nothing was re-rolled', () => {
        assertEqual(storyBeatsFor([1, 1, 6, 10], []), 2);
        assertEqual(storyBeatsFor([4, 5, 6], []), 0);
    });

    it('handles several re-rolls without losing earlier beats', () => {
        assertEqual(
            storyBeatsFor([1, 1, 3], [{ index: 0, old: 1, new: 9 }, { index: 2, old: 3, new: 1 }]),
            3
        );
    });
});
