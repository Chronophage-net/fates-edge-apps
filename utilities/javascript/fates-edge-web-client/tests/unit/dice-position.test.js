import { describe, it, assertEqual, assertTrue } from '../runner.js';
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
