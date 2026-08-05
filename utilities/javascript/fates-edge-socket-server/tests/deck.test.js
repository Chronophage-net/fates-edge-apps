const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// deck.js resolves REGION_DIR from process.cwd() at module-load time, so
// these tests must run with the socket-server package root as cwd
// (true for `npm test` / `node --test tests/` invoked from this directory).
const deck = require('../server/deck.js');

describe('deck.js region-slug resolution (loadRegionData)', () => {
    // THE highest-value regression test in this backlog: the hyphen-vs-
    // underscore region-slug bug independently recurred in web-client's
    // decks/index.js, ai-gm-bot's world-manager.js, AND this exact file
    // (server/deck.js -> loadRegionDataSync). Feed real multi-word region
    // display names and confirm they resolve to the real underscore-named
    // JSON files instead of silently falling back to placeholder data.

    const cases = [
        ['Black Banners', 'black_banners.json'],
        ['The Wilds', 'the_wilds.json'],
        ['Midh Ahkaz', 'midh_ahkaz.json'],
        ['The Ways Between', 'the_ways_between.json'],
    ];

    for (const [displayName, expectedFile] of cases) {
        test(`"${displayName}" resolves to ${expectedFile}, not the fallback`, () => {
            // Sanity: the expected file actually exists in data/regions.
            const filePath = path.join(__dirname, '..', 'data', 'regions', expectedFile);
            assert.equal(fs.existsSync(filePath), true, `fixture file ${expectedFile} must exist`);

            const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const expectedName = raw.title || raw.id || 'Unknown';

            const regionData = deck.loadRegionData(displayName);

            // Fallback data's description always contains this exact marker
            // (see deck.js's createFallbackData) -- if this string is present,
            // the slug resolution failed and silently used placeholder data.
            assert.equal(
                regionData.description.includes('Using fallback data'),
                false,
                `loadRegionData("${displayName}") fell back to placeholder data instead of loading ${expectedFile}`
            );
            assert.equal(regionData.name, expectedName);
        });
    }

    test('a made-up region name safely falls back without throwing', () => {
        const regionData = deck.loadRegionData('Definitely Not A Real Region');
        assert.equal(regionData.description.includes('Using fallback data'), true);
        assert.equal(regionData.name, 'Definitely Not A Real Region');
    });
});

describe('deck.js transformRegionData()', () => {
    const fixture = {
        id: 'test_region',
        title: 'Test Region',
        version: '2.0.0',
        type: 'generator',
        overview: {
            tagline: 'A place of testing.',
            genre: 'Mystery',
        },
        places: [
            { rank: '2', title: 'The Square', description: 'A dusty plaza.' },
            { rank: 'A', title: 'The Vault', description: 'Sealed since the war.' },
        ],
        people_and_factions: [
            { rank: 'K', title: 'The Warden', description: 'Guards the gate.' },
        ],
        complications: [],
        rewards: [
            { rank: '10', title: 'Old Coin', description: 'Worth more than it looks.' },
        ],
    };

    test('produces the flat {spades:{rank:text}, hearts:{...}, ...} shape', () => {
        const out = deck.transformRegionData(fixture);
        assert.equal(out.name, 'Test Region');
        assert.equal(typeof out.spades['2'], 'string');
        assert.match(out.spades['2'], /The Square/);
        assert.match(out.spades['A'], /The Vault/);
        assert.match(out.hearts['K'], /The Warden/);
        assert.match(out.diamonds['10'], /Old Coin/);
        assert.deepEqual(out.clubs, {});
        assert.equal(out.metadata.source_file, 'test_region');
        assert.equal(out.metadata.version, '2.0.0');
    });

    test('passes through data already in transformed shape unchanged', () => {
        const already = { hearts: { A: 'x' }, spades: { A: 'y' }, clubs: { A: 'z' }, diamonds: { A: 'w' } };
        const out = deck.transformRegionData(already);
        assert.equal(out, already);
    });

    test('returns null for falsy input', () => {
        assert.equal(deck.transformRegionData(null), null);
    });
});

describe('deck.js getCardMeaningFromRegion()', () => {
    const regionData = {
        hearts: { A: 'A powerful patron takes interest.' },
        spades: {},
        clubs: {},
        diamonds: {},
    };

    test('returns the specific region text when the rank is present', () => {
        const text = deck.getCardMeaningFromRegion('hearts', 'A', regionData);
        assert.match(text, /A powerful patron takes interest\./);
        assert.match(text, /Ace of Hearts/);
    });

    test('falls back to generic archetype text when rank missing', () => {
        const text = deck.getCardMeaningFromRegion('spades', '7', regionData);
        assert.match(text, /Seven of Spades/);
        assert.match(text, /location/i);
        // Should not contain the specific hearts text
        assert.doesNotMatch(text, /patron/);
    });
});

describe('deck.js getAceEffect()', () => {
    const card = { suit: 'hearts', rank: 'A' };

    test('uses region-specific effects when the region key matches exactly', () => {
        const effect = deck.getAceEffect('acasia', card);
        assert.ok(effect.text);
        // acasia's own list is distinct text from generic; assert it's one of acasia's entries
        const acasiaTexts = [
            'The Curse stirs. A crossroads behind you now leads to a place you have already been.',
            "A broken milestone weeps rust. The empire's ghost is counting.",
            "A free company's banner flickers in the distance, its colors changed.",
        ];
        assert.ok(acasiaTexts.includes(effect.text));
    });

    test('falls back to generic effects for an unknown region', () => {
        const effect = deck.getAceEffect('totally-unknown-region', card);
        assert.ok(effect.text);
    });

    test('partial region-key match via regionKey.includes(key)', () => {
        // regionKey.includes('acasia') should match even with extra text around it
        const effect = deck.getAceEffect('the acasia frontier', card);
        assert.ok(effect.text);
    });
});
