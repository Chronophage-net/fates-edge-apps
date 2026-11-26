import { describe, it, assertEqual } from '../runner.js';
import { spellDV, tagCost } from '../../js/features/spellcraft/spell-dv.js';
import { readFileSync } from 'node:fs';

// SRD 10/11: DV = 1 + sum of tag costs; dangerous tags cost 2.
describe('Spell DV (SRD)', () => {
    it('matches the SRD worked example: Teleport [AIR][FOLD] is DV 4', () => {
        assertEqual(spellDV(['AIR', 'FOLD']), 4);
        assertEqual(spellDV(['[AIR]', '[FOLD]']), 4);
    });
    it('prices ordinary tags at 1 and dangerous tags at 2', () => {
        assertEqual(tagCost('Curse'), 1);
        for (const t of ['Gate', 'Leap', 'Create', 'Summon', 'Transmute', 'Animate', 'Transform', 'Dominate', 'Rewind', 'Subvert']) assertEqual(tagCost(t), 2);
        assertEqual(spellDV([]), 1);
        assertEqual(spellDV(['Fire', 'Strike']), 3);
    });
    it('the Caster calculator no longer counts each tag twice', () => {
        const src = readFileSync(new URL('../../js/features/spellcraft/components/calculator.js', import.meta.url), 'utf8');
        const body = src.slice(src.indexOf('function calculateDV('), src.indexOf('function updateResult('));
        assertEqual(/let dv = 1 \+ tags\.length/.test(body), false);
        assertEqual(/let dv = 1;/.test(body), true);
    });
});
