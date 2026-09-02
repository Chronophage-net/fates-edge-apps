import { describe, it, assert } from '../runner.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rivalriesFor } from '../../js/features/patrons/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = join(ROOT, 'data');
const table = JSON.parse(readFileSync(join(DATA, 'patron-rivalries.json'), 'utf8'));
const patrons = readdirSync(join(DATA, 'patrons'))
    .filter(f => f.endsWith('.json') && f !== 'manifest.json')
    .map(f => JSON.parse(readFileSync(join(DATA, 'patrons', f), 'utf8')));

/**
 * Cross-Resonance lookup.
 *
 * The rivalry table names patrons the way a sentence does ("Aveh", "Mab")
 * while patron files carry long titles ("Aveh, the Rider Behind the
 * Storm"). The first matcher required the shorter side to be five or more
 * characters, to stop "the" matching everything — which silently dropped
 * every short-named patron. Fifteen of fifty-one resolved to zero rivals,
 * and zero rivals is indistinguishable from "this patron has none".
 */
describe('patrons: Cross-Resonance lookup', () => {

    it('the table survived extraction intact', () => {
        assert(table.pairs.length === 81, `expected 81 pairings, got ${table.pairs.length}`);
        assert(table.rulings.length === 4, 'expected the four quick rulings');
        for (const p of table.pairs) {
            assert(p.patron && p.rival, 'every pairing needs both sides');
            assert(p.edge_loci && p.friction, `pairing ${p.patron}/${p.rival} lost a column`);
            assert(!/[\\{}]/.test(p.friction), 'LaTeX residue in friction text');
        }
    });

    it('finds rivals listed on either side of the pairing', () => {
        // Aveh is the left column for its five rows; Oath of Flame & Light
        // is the right. Both must resolve, or half the table is invisible.
        const aveh = patrons.find(p => /^Aveh/.test(p.title || ''));
        const oath = patrons.find(p => /Oath of Flame/i.test(p.title || ''));
        assert(aveh && oath, 'fixture patrons missing');
        assert(rivalriesFor(aveh, table).length >= 5, 'Aveh should find its own rows');
        const oathRivals = rivalriesFor(oath, table).map(r => r.rival);
        assert(oathRivals.some(n => /Aveh/.test(n)),
            'Oath of Flame & Light must find Aveh, which lists it as the RIVAL');
    });

    it('short patron names are not dropped', () => {
        // The regression: Aveh, Mab, Oya, Kuva, Gaila, Inaea, Isoka are all
        // four or five characters and were invisible to a length-guarded
        // containment test.
        for (const name of ['Aveh', 'Mab', 'Inaea', 'Isoka', 'Kuva']) {
            const p = patrons.find(x => new RegExp(`^${name}\\b`).test(x.title || ''));
            if (!p) continue;
            assert(rivalriesFor(p, table).length > 0,
                `${name} is named in the rivalry table but resolved to no rivals`);
        }
    });

    it('does not invent rivals for patrons the table never names', () => {
        // Eight patrons genuinely have no rows -- mostly Inaea's daughters,
        // whom the guide calls unclassifiable. Silence is the right answer;
        // a loose matcher that "finds" rivals for them is worse than none.
        const absent = patrons.find(p => /^Zephyria/.test(p.title || ''));
        if (absent) assert(rivalriesFor(absent, table).length === 0,
            'Zephyria has no pairings in the source and must not acquire any');
    });

    it('every patron file resolves without throwing', () => {
        for (const p of patrons) {
            const r = rivalriesFor(p, table);
            assert(Array.isArray(r), `${p.title} did not return a list`);
        }
    });

    it('is empty-safe', () => {
        assert(rivalriesFor(null, table).length === 0);
        assert(rivalriesFor(patrons[0], null).length === 0);
        assert(rivalriesFor(patrons[0], { pairs: [] }).length === 0);
    });
});
