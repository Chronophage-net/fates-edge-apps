/**
 * Guards the Harm Levels -> Resilience rename.
 *
 * The rename split three things that used to share one word: the Harm a
 * creature DEALS, the 1-3 severity of a single Harm mark on a character, and
 * the number of marks an adversary can ABSORB. Only the third became
 * Resilience. Two things must stay true forever:
 *
 *   1. Data written before the rename (saved campaigns, installed packs,
 *      hand-authored bestiary JSON) still reads correctly. Those files belong
 *      to the user and are never migrated in place.
 *   2. The player-facing Harm track is still called Harm and still runs 0-3.
 */

import { describe, it, assert, assertEqual, assertTrue } from '../runner.js';
import {
    resilienceOf,
    resilienceForTl,
    harmLevelsForTl,
} from '../../js/features/encounters/bestiary.js';

describe('Resilience rename: back-compatibility', () => {
    it('reads the new key', () => {
        assertEqual(resilienceOf({ resilience: '8 (advanced)' }), '8 (advanced)');
    });

    it('still reads pre-rename records that only have harm_levels', () => {
        assertEqual(resilienceOf({ harm_levels: '3 (standard)' }), '3 (standard)');
    });

    it('prefers the new key when a record carries both', () => {
        assertEqual(resilienceOf({ resilience: '8 (advanced)', harm_levels: 'stale' }), '8 (advanced)');
    });

    it('does not invent a value for a creature that has none', () => {
        assertEqual(resilienceOf({}), undefined);
        assertEqual(resilienceOf(null), undefined);
    });

    it('keeps "None (puzzle)" rather than treating it as absent', () => {
        assertEqual(resilienceOf({ resilience: 'None (puzzle)' }), 'None (puzzle)');
    });

    it('keeps harmLevelsForTl working as a deprecated alias', () => {
        assertEqual(harmLevelsForTl, resilienceForTl);
        assertEqual(harmLevelsForTl(2), '3 (standard)');
    });

    it('derives Resilience from Threat Level on the SRD ladder', () => {
        assertEqual(resilienceForTl(1), '3 (standard)');
        assertEqual(resilienceForTl(4), '3 (standard)');
        assertEqual(resilienceForTl(5), '8 (advanced)');
        assertEqual(resilienceForTl(6), '8 (advanced)');
        assertEqual(resilienceForTl(7), '8 per phase');
        assertEqual(resilienceForTl(10), 'None (puzzle)');
    });
});

describe('Resilience rename: shipped data', () => {
    const loadBestiary = async () => {
        const { readFileSync } = await import('node:fs');
        const { fileURLToPath } = await import('node:url');
        const path = await import('node:path');
        const here = path.dirname(fileURLToPath(import.meta.url));
        return JSON.parse(readFileSync(path.resolve(here, '..', '..', 'data', 'bestiary.json'), 'utf8'));
    };

    it('every bestiary entry carries resilience and none is left on the old key', async () => {
        const raw = await loadBestiary();
        const entries = Object.values(raw).map(o => Object.values(o)[0]).filter(Boolean);
        assertTrue(entries.length > 200, `expected the full bestiary, got ${entries.length}`);
        const missing = entries.filter(e => !e.resilience);
        const stale = entries.filter(e => e.harm_levels !== undefined);
        assertEqual(missing.length, 0, `${missing.length} entries have no resilience`);
        assertEqual(stale.length, 0, `${stale.length} entries still carry harm_levels`);
    });

    it('resilience values stay on the vocabulary the books use', async () => {
        const raw = await loadBestiary();
        const entries = Object.values(raw).map(o => Object.values(o)[0]).filter(Boolean);
        const odd = entries.filter(e => !/^(3 \(standard\)|8 \(advanced\)|8 per phase|None \(puzzle\))/.test(String(e.resilience)));
        assertTrue(odd.length < entries.length * 0.2,
            `unexpected resilience vocabulary in ${odd.length} entries, e.g. ${odd.slice(0, 3).map(e => e.resilience).join(' | ')}`);
    });
});
