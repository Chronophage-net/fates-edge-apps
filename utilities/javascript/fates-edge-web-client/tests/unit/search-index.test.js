import { describe, it, assert, assertEqual, assertDeepEqual } from '../runner.js';
import {
    expandManifest,
    firstSentences,
    getIndexStatus,
    onIndexProgress,
} from '../../js/core/search-index.js';

describe('Background search index: manifest expansion', () => {
    it('indexes every page of a multi-page book separately, so a hit links to the right page', () => {
        const units = expandManifest({
            documents: [{
                id: 'srd', title: 'SRD', path: '/data/docs/srd/', category: 'core', categoryLabel: 'Core',
                pages: [
                    { file: 'index.html', title: 'Start here' },
                    { file: 'combat.html', title: 'Combat' },
                ],
            }],
        });
        assertEqual(units.length, 2);
        assertDeepEqual(units.map(u => u.url), ['/data/docs/srd/index.html', '/data/docs/srd/combat.html']);
        // The book name is kept so a result can say which book the page is from.
        assertEqual(units[1].book, 'SRD');
        assertEqual(units[1].title, 'Combat');
    });

    it('handles single-file documents and accepts a bare array manifest', () => {
        const units = expandManifest([
            { title: 'One', file: 'one.html', path: '/data/docs/', category: 'resources' },
        ]);
        assertEqual(units.length, 1);
        assertEqual(units[0].url, '/data/docs/one.html');
        assertEqual(units[0].book, null);
    });

    it('skips documents the manifest marks inactive', () => {
        const units = expandManifest([
            { title: 'Live', file: 'a.html', path: '/data/docs/' },
            { title: 'Retired', file: 'b.html', path: '/data/docs/', active: false },
        ]);
        assertEqual(units.length, 1);
        assertEqual(units[0].title, 'Live');
    });

    it('tags anthology documents so results can be told apart from rules documents', () => {
        const [unit] = expandManifest([
            { title: 'The Hearth Cord', file: 'hc.html', path: '/data/docs/anthology/', category: 'anthology' },
        ]);
        assertEqual(unit.type, 'anthology');
    });

    it('returns nothing rather than throwing when the manifest is missing or malformed', () => {
        assertDeepEqual(expandManifest(null), []);
        assertDeepEqual(expandManifest({}), []);
        assertDeepEqual(expandManifest({ documents: 'nope' }), []);
    });
});

describe('Background search index: previews and status', () => {
    it('cuts a preview at a sentence boundary rather than mid-word', () => {
        const text = 'The stone has been chiseled seven times. The last mark is still wet. And more besides.';
        const preview = firstSentences(text, 45);
        assert(preview.endsWith('…'), 'a truncated preview is marked');
        assert(preview.startsWith('The stone has been chiseled seven times.'), `got: ${preview}`);
        assert(!preview.includes('still wet'), 'stops at the first sentence that fits');
    });

    it('returns short text untouched', () => {
        assertEqual(firstSentences('Short enough.', 100), 'Short enough.');
        assertEqual(firstSentences('', 100), '');
    });

    it('reports an idle status before anything has been indexed', () => {
        const status = getIndexStatus();
        assertEqual(status.phase, 'idle');
        assertEqual(status.count, 0);
        assertEqual(status.building, false);
    });

    it('hands a new subscriber the current status immediately', () => {
        let seen = null;
        const off = onIndexProgress((s) => { seen = s; });
        assert(seen !== null, 'subscriber is called on subscribe, not only on the next event');
        assertEqual(seen.phase, 'idle');
        off();
    });

    it('survives a subscriber that throws', () => {
        const off = onIndexProgress(() => { throw new Error('bad subscriber'); });
        off();
        assert(true);
    });
});
