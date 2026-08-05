import { describe, it, assert, assertEqual, assertTrue } from '../runner.js';
import {
    Xorshift128,
    getTimerSizeFromRank,
    resetSuitDecksForTest,
    drawSuitCardForTest
} from '../../js/features/travel-planner/index.js';

describe('travel-planner: Xorshift128 PRNG', () => {

    it('never returns exactly 1 across >=10000 calls, for >=5 seeds', () => {
        // Regression test for the crash this session's PRNG fix targeted:
        // converting the full 64-bit combined state to a JS Number without
        // masking to 53 bits could round UP to exactly 2^64, making
        // random() === 1. That let randomInt(0, n) return n itself (out of
        // bounds), corrupting the Fisher-Yates shuffle with `undefined`
        // entries ("Cannot read properties of undefined (reading 'rank')").
        const seeds = ['seed-one', 'seed-two', 12345, 'a much longer seed string with spaces!!', 0];
        assertTrue(seeds.length >= 5, 'test itself must exercise >=5 seeds');

        for (const seed of seeds) {
            const prng = new Xorshift128(seed);
            for (let i = 0; i < 10000; i++) {
                const value = prng.random();
                assertTrue(value < 1, `Xorshift128(${JSON.stringify(seed)}).random() returned ${value} (call #${i}), expected strictly < 1`);
                assertTrue(value >= 0, `Xorshift128(${JSON.stringify(seed)}).random() returned ${value} (call #${i}), expected >= 0`);
            }
        }
    });

    it('randomInt(min, max) never returns max (half-open range)', () => {
        // Direct regression for the Fisher-Yates corruption: randomInt is
        // used as `randomInt(0, i + 1)` inside shuffle(), and needs
        // max to be an exclusive upper bound.
        const prng = new Xorshift128('shuffle-bounds-seed');
        for (let i = 0; i < 5000; i++) {
            const value = prng.randomInt(0, 10);
            assertTrue(value >= 0 && value < 10, `randomInt(0,10) returned out-of-range ${value} on call #${i}`);
        }
    });
});

describe('travel-planner: suit-locked deck draws', () => {

    it('never desyncs a drawn card\'s suit from the position it was drawn for', () => {
        // BUGFIX regression: the old implementation drew four cards from
        // one shared 52-card deck and just LABELED them spade/heart/club/
        // diamond by draw order, regardless of the card's real suit. Each
        // suit now has its own 13-card deck, so drawSuitCard(suit) must
        // always return a card whose .suit === the requested suit.
        resetSuitDecksForTest();
        const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
        // Draw well past one deck's worth (13) per suit to also exercise
        // the auto-reshuffle-when-empty path.
        for (let round = 0; round < 30; round++) {
            for (const suit of suits) {
                const card = drawSuitCardForTest(suit);
                assert(card, `drawSuitCard(${suit}) returned nothing on round ${round}`);
                assertEqual(card.suit, suit, `drawSuitCard(${suit}) returned a card of suit "${card.suit}" on round ${round}`);
                assert(card.rank, `drawSuitCard(${suit}) returned a card with no rank on round ${round}`);
            }
        }
    });
});

describe('travel-planner: getTimerSizeFromRank', () => {

    it('rank 6 gives 6 segments, not 4 (off-by-one boundary regression)', () => {
        // BUGFIX regression: this used to gate the 6-segment tier on
        // rank >= 7, so a 6 (which the sourcebook's Timer Conversion table
        // puts in the "6-10 -> 6 segments" band) incorrectly fell through
        // to the 4-segment "2-5" band.
        assertEqual(getTimerSizeFromRank('6'), 6);
    });

    it('covers the full Timer Conversion table', () => {
        assertEqual(getTimerSizeFromRank('2'), 4);
        assertEqual(getTimerSizeFromRank('3'), 4);
        assertEqual(getTimerSizeFromRank('4'), 4);
        assertEqual(getTimerSizeFromRank('5'), 4);
        assertEqual(getTimerSizeFromRank('6'), 6);
        assertEqual(getTimerSizeFromRank('7'), 6);
        assertEqual(getTimerSizeFromRank('8'), 6);
        assertEqual(getTimerSizeFromRank('9'), 6);
        assertEqual(getTimerSizeFromRank('10'), 6);
        assertEqual(getTimerSizeFromRank('J'), 8);
        assertEqual(getTimerSizeFromRank('Q'), 8);
        assertEqual(getTimerSizeFromRank('K'), 8);
        assertEqual(getTimerSizeFromRank('A'), 10);
    });
});
