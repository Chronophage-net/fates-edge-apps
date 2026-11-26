import { describe, it, assert, assertEqual, assertTrue } from '../runner.js';
import { performRoll, shiftPosition, capPool, MAX_POOL } from '../../js/core/dice.js';
import { calculateDicePool } from '../../js/features/characters/roller.js';

// Rules from the SRD that the roll engines must follow. Each of these was
// wrong somewhere in the app before:
//   02 Position & Effect: a Boon spent before the roll improves Position one
//      step; steps past Dominant become +1 die, past Desperate -1 die.
//   02 Maximum Dice Pool: 10d10; each extra die is an automatic success.
//   09 Fatigue: each point worsens Position one step; past Desperate, -1 die.
//   09 Harm: Harm 2 is -1 die (not -2); Harm 3 incapacitates.
//   performRoll(attr, skill, dv): the spellcraft screens used to call
//   performRoll(pool, dv), which rolled pool + DV dice against no DV.

describe('SRD Position ladder', () => {
    it('moves within the ladder and turns overflow into dice', () => {
        assertEqual(shiftPosition('desperate', 1).position, 'controlled');
        assertEqual(shiftPosition('desperate', 1).diceDelta, 0);
        assertEqual(shiftPosition('controlled', 3).position, 'dominant');
        assertEqual(shiftPosition('controlled', 3).diceDelta, 2);
        assertEqual(shiftPosition('controlled', -3).position, 'desperate');
        assertEqual(shiftPosition('controlled', -3).diceDelta, -2);
    });
});

describe('SRD pool cap', () => {
    it('caps at 10 and converts the rest to automatic successes', () => {
        assertEqual(MAX_POOL, 10);
        const c = capPool(13);
        assertEqual(c.pool, 10); assertEqual(c.autoSuccesses, 3);
        assertEqual(capPool(9, 8).autoSuccesses, 1);
    });

    it('performRoll rolls at most 10 dice and banks the overflow', () => {
        for (let i = 0; i < 50; i++) {
            const r = performRoll(6, 6, 5);
            assertEqual(r.pool, 10); assertEqual(r.dice.length, 10); assertEqual(r.autoSuccesses, 2);
            assertTrue(r.successes >= 2, 'overflow dice must count as successes');
        }
    });
});

describe('performRoll: Boons improve Position, not the pool', () => {
    it('a Boon lifts Desperate to Controlled without adding a die', () => {
        const r = performRoll(2, 1, 3, 'desperate', 1);
        assertEqual(r.position, 'controlled'); assertEqual(r.requestedPosition, 'desperate');
        assertEqual(r.pool, 3);
        assertEqual(r.reRolls, 0, 'Controlled re-rolls nothing');
    });
    it('Boons past Dominant become dice', () => {
        const r = performRoll(2, 1, 3, 'dominant', 2);
        assertEqual(r.position, 'dominant'); assertEqual(r.pool, 5);
    });
    it('a pool and DV passed in the right places roll exactly the pool', () => {
        for (let i = 0; i < 50; i++) {
            const r = performRoll(4, 0, 3);
            assertEqual(r.dice.length, 4); assertEqual(r.dv, 3);
        }
    });
});

describe('Character roller pool (calculateDicePool)', () => {
    it('Fatigue past Desperate costs dice even when the roll starts Controlled', () => {
        const p = calculateDicePool(3, 2, { position: 'controlled', fatigue: 3, fatigueMax: 4 });
        assertEqual(p.positionAfterFatigue, 'desperate');
        assertEqual(p.pool, 3, 'Controlled -> Desperate takes one step; the other two cost a die each');
    });
    it('a Boon offsets a point of Fatigue instead of adding a die', () => {
        const p = calculateDicePool(3, 2, { position: 'controlled', fatigue: 1, fatigueMax: 4, boonDice: 1 });
        assertEqual(p.positionAfterFatigue, 'controlled'); assertEqual(p.pool, 5);
    });
    it('Boons past Dominant become dice', () => {
        const p = calculateDicePool(3, 2, { position: 'dominant', boonDice: 2 });
        assertEqual(p.positionAfterFatigue, 'dominant'); assertEqual(p.pool, 7);
    });
    it('Harm 2 is -1 die and Harm 3 incapacitates', () => {
        assertEqual(calculateDicePool(3, 2, { harm: 2 }).pool, 4);
        assert(calculateDicePool(3, 2, { harm: 3 }).incapacitated);
    });
});
