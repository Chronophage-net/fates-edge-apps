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

import { TAGS, getTag, canonicalTag, TAG_ALIASES } from '../../js/features/spellcraft/tags.js';

describe('Spell tags reconciled with the rules', () => {
    // SRD appendix: Example Spells, with the DVs the SRD prints.
    const SRD_EXAMPLES = [
        [['FIRE', 'STRIKE'], 3], [['WATER', 'VEIL'], 3], [['AIR', 'PASSAGE'], 3], [['LIFE', 'MEND'], 3],
        [['FIRE', 'DEFEND'], 3], [['FATE', 'BIND'], 3], [['WATER', 'HEAL', 'AREA'], 4], [['EARTH', 'BARRIER'], 3],
        [['AIR', 'FOLD'], 4], [['FATE', 'STRIKE', 'STRIKE'], 4], [['DEATH', 'COMMAND'], 3],
    ];
    it('builds every SRD example spell from known tags at the SRD DV', () => {
        for (const [tags, dv] of SRD_EXAMPLES) {
            for (const t of tags) assertEqual(Boolean(getTag(t)), true, `${t} must be a known tag`);
            assertEqual(spellDV(tags), dv, `${tags.join('+')} should be DV ${dv}`);
        }
    });
    it('includes all eight elements and every dangerous tag the rules name', () => {
        for (const e of ['AIR', 'FIRE', 'EARTH', 'WATER', 'FORTUNE', 'LIFE', 'FATE', 'DEATH']) assertEqual(getTag(e)?.family, 'Element');
        for (const d of ['GATE', 'FOLD', 'LEAP', 'CREATE', 'SUMMON', 'TRANSMUTE', 'ANIMATE', 'TRANSFORM', 'DOMINATE', 'REWIND', 'SUBVERT', 'GRAVITY']) assertEqual(getTag(d)?.cost, 2, d);
    });
    it('keeps saved spells readable: retired app tags resolve to rules tags', () => {
        assertEqual(canonicalTag('Light'), 'ILLUMINATE');
        assertEqual(canonicalTag('[Protect]'), 'DEFEND');
        for (const target of Object.values(TAG_ALIASES)) assertEqual(Boolean(getTag(target)), true, target);
        assertEqual(new Set(TAGS.map(t => t.name)).size, TAGS.length, 'no duplicate tags');
    });
});
