import { describe, it, assert, assertEqual } from '../runner.js';
import { readFileSync } from 'node:fs';
import { filterDocuments } from '../../js/features/docs/workspace.js';

const filename = 'Fates_-_Edge_-_-The-_-Five-_-Daughters-_-of-_-Inaea.html';
const html = readFileSync(new URL(`../../data/docs/expansions/${filename}`, import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../../data/docs/manifest.json', import.meta.url), 'utf8'));

describe('Five Daughters expansion', () => {
    it('has one active, searchable expansion entry with its stable reading ID', () => {
        const entries = manifest.documents.filter(doc => doc.id === 'the_five_daughters_of_inaea');
        assertEqual(entries.length, 1);
        const doc = entries[0];
        assertEqual(doc.title, 'The Five Daughters of Inaea');
        assertEqual(doc.file, filename);
        assertEqual(doc.path, '/data/docs/expansions/');
        assertEqual(doc.category, 'expansions');
        assert(doc.active);
        const found = filterDocuments([{ ...doc, type: doc.category, fullPath: doc.path + doc.file }],
            { type: 'expansions', query: 'romance sanctuary' }, { saved: [], recent: [] });
        assertEqual(found.length, 1);
    });
    it('keeps unique anchors and working contents links for the complete book', () => {
        const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
        assertEqual(ids.length, new Set(ids).size);
        for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) {
            assert(ids.includes(target), `Missing contents target: ${target}`);
        }
        for (const anchor of ['rules-compatibility', 'threads-at-the-table-optional-rules',
            'mechanics-solaras-blessing', 'mechanics-venaras-blessing', 'mechanics-zephyrias-blessing',
            'mechanics-gailas-blessing', 'mechanics-livaeas-blessing', 'a-playable-opening-five-seats-one-empty']) {
            assert(ids.includes(anchor), `Missing section: ${anchor}`);
        }
    });
    it('keeps chapter recoveries consistent with the observance costs and limits', () => {
        for (const [daughter, cost] of [['solara', 'Connection Weight'], ['venara', 'Connection Weight'], ['gaila', 'Spend 1 Boon']]) {
            const section = html.split(`id="mechanics-${daughter}s-blessing"`)[1]?.split('</section>')[0];
            assert(section?.includes('Once per session'), daughter);
            assert(section?.includes(cost), daughter);
            assert(section?.includes('not a second recovery'), daughter);
            assert(section?.includes('shared recipient limit'), daughter);
        }
        assert(html.includes('both participants may agree'));
        assert(!html.includes('I have not seen him in six months'));
        assert(!html.includes('I watched him for weeks before he sang'));
        assert(html.includes('Six months have passed since I left the pit'));
    });
});
