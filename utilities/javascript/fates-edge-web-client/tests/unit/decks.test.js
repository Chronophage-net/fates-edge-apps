import { describe, it, assert, assertEqual } from '../runner.js';
import { getRegionSlug } from '../../js/features/decks/index.js';
import { readFileSync, readdirSync } from 'node:fs';

// Region JSON files actually shipped under data/regions/. This list is a
// snapshot of `ls data/regions/*.json` (minus non-region files like
// clubs.json/hearts.json/spades.json/diamonds.json which are suit
// manifests, not regions, and manifest.json/quick_use_notes.json which
// aren't region files either).
const REAL_REGION_FILE_STEMS = [
    'acasia',
    'aelaerem',
    'aeler',
    'aelinnel',
    'black_banners',
    'ecktoria',
    'kahfagia',
    'linn',
    'midh_ahkaz',
    'mistlands',
    'silkstrand',
    'the_ways_between',
    'the_wilds',
    'theona',
    'thepyrgos',
    'ubral',
    'valewood',
    'vhasia',
    'vilikari',
    'viterra',
    'ykrul',
    'zakov'
];

// Map of the human-readable display name (as it would appear in UI /
// region-selector dropdowns) to the expected on-disk slug. This is where
// the classic hyphen/underscore multi-word-region bug lived (see
// TEST_TODO.md's "Cross-cutting pattern to watch for everywhere").
const DISPLAY_NAME_TO_SLUG = {
    'Acasia': 'acasia',
    'Aelaerem': 'aelaerem',
    'Aeler': 'aeler',
    'Aelinnel': 'aelinnel',
    'Black Banners': 'black_banners',
    'Ecktoria': 'ecktoria',
    'Kahfagia': 'kahfagia',
    'Linn': 'linn',
    'Midh Ahkaz': 'midh_ahkaz',
    'Mistlands': 'mistlands',
    'Silkstrand': 'silkstrand',
    'The Ways Between': 'the_ways_between',
    'The Wilds': 'the_wilds',
    'Theona': 'theona',
    'Thepyrgos': 'thepyrgos',
    'Ubral': 'ubral',
    'Valewood': 'valewood',
    'Vhasia': 'vhasia',
    'Vilikari': 'vilikari',
    'Viterra': 'viterra',
    "Y'krul": 'ykrul',
    'Zakov': 'zakov'
};

describe('decks: getRegionSlug', () => {

    it('round-trips every real data/regions/*.json filename via its display name', () => {
        for (const [displayName, expectedSlug] of Object.entries(DISPLAY_NAME_TO_SLUG)) {
            assertEqual(
                getRegionSlug(displayName),
                expectedSlug,
                `getRegionSlug(${JSON.stringify(displayName)}) should resolve to the real file "${expectedSlug}.json"`
            );
            assert(
                REAL_REGION_FILE_STEMS.includes(expectedSlug),
                `${expectedSlug} should be a real file in data/regions/`
            );
        }
    });

    it('regresses the classic hyphen/underscore multi-word-region bug', () => {
        // Three independent files in this codebase once used
        // name.replace(/ /g, '-') (hyphens) while data/regions/*.json
        // filenames use underscores. This is the exact multi-word case
        // that broke: a naive hyphen-join would produce
        // "black-banners.json" / "the-wilds.json" / "midh-ahkaz.json" /
        // "the-ways-between.json", none of which exist on disk.
        assertEqual(getRegionSlug('Black Banners'), 'black_banners');
        assertEqual(getRegionSlug('The Wilds'), 'the_wilds');
        assertEqual(getRegionSlug('Midh Ahkaz'), 'midh_ahkaz');
        assertEqual(getRegionSlug('The Ways Between'), 'the_ways_between');

        // Explicitly assert the hyphenated (buggy) forms are NOT produced.
        assert(getRegionSlug('Black Banners') !== 'black-banners');
        assert(getRegionSlug('The Wilds') !== 'the-wilds');
        assert(getRegionSlug('Midh Ahkaz') !== 'midh-ahkaz');
        assert(getRegionSlug('The Ways Between') !== 'the-ways-between');
    });

    it('lowercases and strips characters outside [a-z0-9_]', () => {
        assertEqual(getRegionSlug("Y'krul"), 'ykrul');
        assertEqual(getRegionSlug('ALREADY_LOWER'), 'already_lower');
        assertEqual(getRegionSlug('Multiple   Spaces'), 'multiple___spaces');
    });
});

describe('Decks: GM guidance on esoteric draws', () => {
    const SRC = readFileSync(new URL('../../js/features/decks/index.js', import.meta.url), 'utf8');

    it('keeps the GM note out of the card meaning string', () => {
        // It used to be appended to `meaning` as "[Running this: ...]", which
        // put a multi-paragraph note through the bracket-chip renderer and
        // into the plain-text consequence synthesis. It now lives in its own
        // bucket on the transformed region.
        assert(!SRC.includes('[Running this: ${card.gm_note}]'),
            'gm_note must not be concatenated into the card meaning');
        assert(SRC.includes('transformed.gmNotes[suit][rankKey] = card.gm_note'),
            'gm_note should be stored beside the meanings, not inside them');
        assert(SRC.includes('gmNotes: { spades: {}, hearts: {}, clubs: {}, diamonds: {} }'),
            'the transform needs a gmNotes bucket per suit');
    });

    it('renders the note as a closed-by-default disclosure, not inline text', () => {
        assert(SRC.includes('class="deck-gm-note"'), 'the note gets its own block');
        assert(/<details class="deck-gm-note"/.test(SRC), 'it should be a <details>, collapsed by default');
        assert(!/<details class="deck-gm-note"[^>]*\sopen/.test(SRC),
            'it must not be open by default — a spread should read as four meanings first');
        assert(SRC.includes('Running this draw'), 'the disclosure is labelled for the GM');
    });

    it('is wired into both Crown Spread layouts and the plain draw', () => {
        const calls = SRC.match(/renderGmNote\(/g) || [];
        assert(calls.length >= 4, `expected renderGmNote to be called from every render path, saw ${calls.length}`);
        assert(SRC.includes('renderGmNote(p.gmNote, { compact: true })'), 'compact layout');
        assert(SRC.includes('renderGmNote(p.gmNote)'), 'detailed layout');
        assert(SRC.includes('drawnGmNotes'), 'plain draws collect notes for the drawn cards');
    });

    it('exposes the note to other features instead of making them re-read the region JSON', () => {
        assert(SRC.includes('export function getCardGmNote(suit, rank)'),
            'decks/index.js should export getCardGmNote()');
    });

    it('splits a multi-paragraph note into paragraphs and escapes the heading', () => {
        assert(SRC.includes("split(/\\n\\s*\\n/)"), 'notes are paragraph-split like the synthesis renderer');
        assert(SRC.includes('escHtmlLocal(heading)'), 'the card label in the summary is escaped');
    });
});

describe('Region data: the esoteric notes the Decks tab renders', () => {
    it('every gm_note in the shipped regions is attached to a real entry and has text', () => {
        const dir = new URL('../../data/regions/', import.meta.url);
        const files = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'manifest.json');
        let notes = 0;
        for (const f of files) {
            const doc = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
            for (const key of ['places', 'people_and_factions', 'complications', 'rewards']) {
                for (const entry of (doc[key] || [])) {
                    if (!entry || !entry.gm_note) continue;
                    notes++;
                    assert(typeof entry.rank === 'number', `${f} ${key}: a note needs a rank to be looked up by`);
                    assert(entry.gm_note.trim().length > 40, `${f} ${key} ${entry.rank}: note is too short to be guidance`);
                    assert(!/\\\\|``|---/.test(entry.gm_note), `${f} ${key} ${entry.rank}: TeX artifacts in a note`);
                }
            }
        }
        assert(notes >= 40, `expected the full per-region pass, found ${notes} notes`);
    });
});
