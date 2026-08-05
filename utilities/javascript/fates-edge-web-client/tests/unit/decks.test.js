import { describe, it, assert, assertEqual } from '../runner.js';
import { getRegionSlug } from '../../js/features/decks/index.js';

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
