import { describe, it, assert } from '../runner.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storyBeatsFor } from '../../js/features/characters/roller.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, 'js', p), 'utf8');
const ROLLER = read('features/characters/roller.js');
const GM_TOOLS = read('features/gm-tools/index.js');
const VTT_CORE = read('features/vtt/vtt-core.js');

/**
 * Story Beats are handed over once, when the roll is finished.
 *
 * The roller keeps no standing count of its own. It works out what a roll
 * produced — after the Position re-roll and after any talent re-rolls,
 * because a beat is owed for every 1 the dice EVER showed and that total
 * is not known until the sequence ends — and hands the number to the GM
 * Tools SB Bank, which is the counter a GM actually spends from.
 */
describe('Story Beats reach the GM once, after every re-roll', () => {

    it('beats count every 1 ever shown, not the 1s still showing', () => {
        // One 1 rolled, re-rolled into a 7: the beat is still owed.
        assert(storyBeatsFor([1, 4, 7], [{ index: 0, old: 1, new: 7 }]) === 1,
            're-rolling a 1 must not take back the beat it earned');
        // Re-rolled into another 1: two beats.
        assert(storyBeatsFor([1, 4, 7], [{ index: 0, old: 1, new: 1 }]) === 2,
            'a re-rolled die showing 1 again owes another beat');
        // A talent re-roll of a non-1 into a 1 adds one.
        assert(storyBeatsFor([3, 4, 7], [{ index: 0, old: 3, new: 1 }]) === 1);
        // Chained re-rolls accumulate rather than replacing each other.
        assert(storyBeatsFor([1, 1, 5], [{ index: 2, old: 5, new: 1 }]) === 3);
    });

    it('the roller hands its beats over instead of tallying them', () => {
        assert(/sb-generated/.test(ROLLER),
            'the roller should dispatch its beats to the bank');
        // No standing total anywhere in the roller.
        assert(!/(sbBank|sessionSB|totalStoryBeats|runningSB)\s*[=+]/.test(ROLLER),
            'the roller must not keep a standing Story Beat count of its own');
    });

    it('the dispatch happens after the talent re-roll loop, not inside it', () => {
        const dispatch = ROLLER.indexOf("new CustomEvent('sb-generated'");
        const loop = ROLLER.indexOf('for (const rr of rerolls)');
        assert(dispatch > 0 && loop > 0, 'expected both the loop and the dispatch');
        assert(dispatch > loop,
            'beats must be handed over after every re-roll, not once per re-roll');
    });

    it('every roll carries an id the bank can dedupe on', () => {
        assert(/rollId:\s*`roll-/.test(ROLLER), 'the roll result needs a stable id');
        assert(/rollId: result\.rollId/.test(ROLLER),
            'the id must travel with the rollData sent to the VTT');
        assert(/rollId: rollData\.rollId/.test(VTT_CORE),
            'the VTT feeder must pass the id through');
    });

    it('the bank refuses a roll it has already counted', () => {
        // Two feeders reach the bank: the roller when a roll finishes, and
        // the VTT chat pipeline when the roll message is processed. With the
        // VTT open a roll goes through both, so without dedupe the GM is
        // credited twice for one roll.
        assert(/bankedRollIds/.test(GM_TOOLS), 'gm-tools should track banked roll ids');
        const handler = GM_TOOLS.slice(GM_TOOLS.indexOf('function onSbGenerated'));
        const body = handler.slice(0, handler.indexOf('\n}'));
        assert(/bankedRollIds\.has\(rollId\)/.test(body), 'the handler must check before banking');
        assert(/return;/.test(body), 'a duplicate must return without banking');
        assert(/BANKED_ROLL_MEMORY|\.delete\(/.test(GM_TOOLS),
            'the id set must be bounded so it cannot grow for the life of the tab');
    });
});
