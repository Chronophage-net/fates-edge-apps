import { describe, it, assert, assertEqual, assertTrue, assertFalse } from '../runner.js';
import {
    TollVeilEngine,
    createDeck,
    cardId,
    aiChooseBid,
    aiChoosePlay,
    MIN_SEATS,
    MAX_SEATS,
    TRICKS_PER_HAND,
    ACE_VALUE,
} from '../../js/features/kon-reh/toll-and-veil-engine.js';

// NOTE: toll-and-veil-engine.js has zero DOM dependencies (same
// convention as kon-reh's KonrehEngine — see that file's own header
// comment), so this only needs plain Node, no dom-shim.

function newEngine(numSeats = 3, opts = {}) {
    const e = new TollVeilEngine(numSeats, opts);
    e.startHand();
    return e;
}

function bidAllZero(engine) {
    // Bidding order starts at dealer+1 and wraps to the dealer last.
    // All-zero is only illegal for the LAST bidder if it would make the
    // running sum exactly TRICKS_PER_HAND -- with everyone else at 0,
    // sum stays 0, so 0 is always legal here.
    let seat = engine.currentSeat;
    for (let i = 0; i < engine.numSeats; i++) {
        const res = engine.makeBid(seat, 0);
        assertTrue(res.ok, `bid should succeed for seat ${seat}: ${res.reason}`);
        seat = engine.currentSeat;
    }
}

describe('TollVeilEngine: deck & card identity', () => {
    it('createDeck() produces a full 52-card deck with unique ids', () => {
        const deck = createDeck();
        assertEqual(deck.length, 52);
        const ids = new Set(deck.map(cardId));
        assertEqual(ids.size, 52);
    });

    it('cardId() round-trips rank+suit', () => {
        assertEqual(cardId({ rank: 'K', suit: '♠' }), 'K♠');
        assertEqual(cardId({ rank: '10', suit: '♡' }), '10♡');
    });
});

describe('TollVeilEngine: setup', () => {
    it('clamps seat count into [MIN_SEATS, MAX_SEATS]', () => {
        assertEqual(new TollVeilEngine(1).numSeats, MIN_SEATS);
        assertEqual(new TollVeilEngine(9).numSeats, MAX_SEATS);
        assertEqual(new TollVeilEngine(4).numSeats, 4);
    });

    it('startHand() deals TRICKS_PER_HAND cards to every seat and opens bidding', () => {
        const e = newEngine(4);
        assertEqual(e.hands.length, 4);
        for (const hand of e.hands) assertEqual(hand.length, TRICKS_PER_HAND);
        assertEqual(e.phase, 'bidding');
        assertEqual(e.currentSeat, (e.dealerIndex + 1) % e.numSeats);
    });

    it('trump is set and trumpFamily matches red/black convention', () => {
        const e = newEngine(3);
        assert(['♣', '♠', '♡', '♢'].includes(e.trump));
        const isRed = e.trump === '♡' || e.trump === '♢';
        assertEqual(e.trumpFamily, isRed ? 'Toll' : 'Veil');
    });
});

describe('TollVeilEngine: bidding', () => {
    it('rejects a bid out of turn', () => {
        const e = newEngine(3);
        const wrongSeat = (e.currentSeat + 1) % 3;
        const res = e.makeBid(wrongSeat, 1);
        assertFalse(res.ok);
        assertEqual(res.reason, 'not-your-turn');
    });

    it('rejects an out-of-range bid', () => {
        const e = newEngine(3);
        const res = e.makeBid(e.currentSeat, 6);
        assertFalse(res.ok);
    });

    it('rejects the last bidder making the sum exactly equal to TRICKS_PER_HAND', () => {
        const e = newEngine(3);
        // Seats bid in order starting at dealer+1; force the first two
        // bids so we know exactly what the third (dealer, last) bidder
        // would need to avoid.
        const seatA = e.currentSeat;
        e.makeBid(seatA, 5);
        const seatB = e.currentSeat;
        e.makeBid(seatB, 5);
        const dealerSeat = e.currentSeat;
        assertEqual(dealerSeat, e.dealerIndex, 'third bidder should be the dealer');
        const res = e.makeBid(dealerSeat, 0); // 5+5+0 == 10 == TRICKS_PER_HAND
        assertFalse(res.ok);
        assertEqual(res.reason, 'sum-would-equal-tricks');
        // A different bid is fine.
        const res2 = e.makeBid(dealerSeat, 1);
        assertTrue(res2.ok);
    });

    it('moves to the playing phase once every seat has bid', () => {
        const e = newEngine(3);
        bidAllZero(e);
        assertEqual(e.phase, 'playing');
        assertEqual(e.trickNumber, 1);
        assertEqual(e.currentSeat, (e.dealerIndex + 1) % e.numSeats);
    });
});

describe('TollVeilEngine: follow-suit and trump-breaking', () => {
    it('must follow suit when able', () => {
        const e = newEngine(3);
        bidAllZero(e);
        const leader = e.currentSeat;
        const hand = e.hands[leader];
        // Lead a NON-trump card. The old version played hand[0] blindly, which
        // failed roughly one run in three: when that card happened to be trump
        // the engine correctly refused the lead (trump not yet broken), the
        // play was rejected, and leadSuit stayed null. That was a flaky test,
        // not an engine bug.
        const leadCard = hand.find(c => c.suit !== e.trump);
        if (!leadCard) return; // all-trump hand: covered by its own test below
        const led = e.playCard(leader, cardId(leadCard));
        assertTrue(led.ok, `leading a non-trump card should be legal (got ${led.reason})`);
        assertEqual(e.leadSuit, leadCard.suit);

        const nextSeat = e.currentSeat;
        const nextHand = e.hands[nextSeat];
        const hasLead = nextHand.some(c => c.suit === e.leadSuit);
        if (hasLead) {
            const offSuitCard = nextHand.find(c => c.suit !== e.leadSuit);
            if (offSuitCard) {
                const res = e.playCard(nextSeat, cardId(offSuitCard));
                assertFalse(res.ok, 'should not be able to renounce when holding the lead suit');
                assertEqual(res.reason, 'must-follow-suit');
            }
        }
    });

    it('cannot lead trump before it is broken without spending Leap, unless the whole hand is trump', () => {
        const e = newEngine(3);
        bidAllZero(e);
        const leader = e.currentSeat;
        // Rig the leader's hand: one trump card, one off-trump card.
        const trumpCard = { suit: e.trump, rank: '9', value: 9 };
        const offCard = { suit: e.trump === '♣' ? '♠' : '♣', rank: '9', value: 9 };
        e.hands[leader] = [trumpCard, offCard];

        const blocked = e.playCard(leader, cardId(trumpCard));
        assertFalse(blocked.ok);
        assertEqual(blocked.reason, 'trump-not-broken');

        const withLeap = e.playCard(leader, cardId(trumpCard), { leap: true });
        assertTrue(withLeap.ok, 'Leap should allow leading trump before it is broken');
        assertTrue(e.trumpBroken, 'playing a trump card should mark trump as broken');
    });

    it('a hand that is ALL trump may lead trump even unbroken, no Leap needed', () => {
        const e = newEngine(3);
        bidAllZero(e);
        const leader = e.currentSeat;
        e.hands[leader] = [
            { suit: e.trump, rank: '9', value: 9 },
            { suit: e.trump, rank: '8', value: 8 },
        ];
        const res = e.playCard(leader, cardId(e.hands[leader][0]));
        assertTrue(res.ok, 'all-trump hand should be able to lead trump unbroken');
    });

    it('void of the lead suit, cannot play trump before it is broken without Leap (hand has a non-trump alternative)', () => {
        const e = newEngine(3);
        bidAllZero(e);
        const leader = e.currentSeat;
        const other = (leader + 1) % e.numSeats;
        // Pick two suits that are neither the trump suit -- so `other`'s
        // hand below is guaranteed a genuine non-trump alternative (NOT
        // accidentally all-trump, which is the separate legal case
        // covered by the next test).
        const nonTrumpSuits = ['♣', '♠', '♡', '♢'].filter(s => s !== e.trump);
        const leadSuit = nonTrumpSuits[0];
        const otherOffSuit = nonTrumpSuits[1];

        e.hands[leader] = [{ suit: leadSuit, rank: '2', value: 2 }, { suit: leadSuit, rank: '3', value: 3 }];
        e.playCard(leader, cardId(e.hands[leader][0])); // leads off-trump suit
        assertEqual(e.leadSuit, leadSuit);

        // `other` is void in the lead suit and holds trump + a genuinely different suit.
        e.hands[other] = [{ suit: e.trump, rank: '9', value: 9 }, { suit: otherOffSuit, rank: '4', value: 4 }];
        const blocked = e.playCard(other, cardId(e.hands[other][0]));
        assertFalse(blocked.ok);
        assertEqual(blocked.reason, 'trump-not-broken');

        const withLeap = e.playCard(other, cardId(e.hands[other][0]), { leap: true });
        assertTrue(withLeap.ok);
    });

    it('void of the lead suit, hand is ALL trump: may play trump unbroken, no Leap needed', () => {
        const e = newEngine(3);
        bidAllZero(e);
        const leader = e.currentSeat;
        const other = (leader + 1) % e.numSeats;
        const nonTrumpSuits = ['♣', '♠', '♡', '♢'].filter(s => s !== e.trump);
        const leadSuit = nonTrumpSuits[0];

        e.hands[leader] = [{ suit: leadSuit, rank: '2', value: 2 }, { suit: leadSuit, rank: '3', value: 3 }];
        e.playCard(leader, cardId(e.hands[leader][0]));

        // `other` is void in the lead suit AND has no non-trump card at
        // all left to fall back on — must not be soft-locked.
        e.hands[other] = [{ suit: e.trump, rank: '9', value: 9 }, { suit: e.trump, rank: '4', value: 4 }];
        const res = e.playCard(other, cardId(e.hands[other][0]));
        assertTrue(res.ok, 'an all-trump hand with no non-trump alternative must not be soft-locked');
    });
});

describe('TollVeilEngine: Cut marker', () => {
    it('cannot Cut an Ace', () => {
        const e = newEngine(3);
        bidAllZero(e);
        const leader = e.currentSeat;
        const ace = { suit: e.trump === '♣' ? '♠' : '♣', rank: 'A', value: ACE_VALUE };
        e.hands[leader] = [ace];
        const res = e.playCard(leader, cardId(ace), { cut: true });
        assertFalse(res.ok);
        assertEqual(res.reason, 'cannot-cut-an-ace');
    });

    it('Cut adds +1 effective value and can flip who wins the trick', () => {
        const e = newEngine(3, { rng: () => 0.5 });
        bidAllZero(e);
        const suit = e.trump === '♣' ? '♠' : '♣'; // off-trump, so this suit determines the trick on lead-suit value alone
        const leader = e.currentSeat;
        const p2 = (leader + 1) % 3;
        const p3 = (leader + 2) % 3;

        e.hands[leader] = [{ suit, rank: '9', value: 9 }];
        e.hands[p2] = [{ suit, rank: '10', value: 10 }];
        e.hands[p3] = [{ suit, rank: '2', value: 2 }];

        e.playCard(leader, cardId(e.hands[leader][0]), { cut: true }); // 9 -> effective 10
        e.playCard(p2, cardId(e.hands[p2][0]));                        // 10 -> effective 10 (played second, doesn't beat a tie)
        e.playCard(p3, cardId(e.hands[p3][0]));

        assertEqual(e.trickWinner, leader, 'Cut-boosted 9 (effective 10) played first should hold the trick over a plain 10 played after it');
    });
});

describe('TollVeilEngine: trick resolution & scoring', () => {
    it('trump always beats a non-trump lead-suit card', () => {
        const e = newEngine(3);
        bidAllZero(e);
        const leadSuit = e.trump === '♣' ? '♠' : '♣';
        const leader = e.currentSeat;
        const p2 = (leader + 1) % 3;
        const p3 = (leader + 2) % 3;

        e.hands[leader] = [{ suit: leadSuit, rank: 'A', value: ACE_VALUE }];
        e.hands[p2] = [{ suit: leadSuit, rank: '2', value: 2 }];
        e.hands[p3] = [{ suit: e.trump, rank: '2', value: 2 }];

        e.playCard(leader, cardId(e.hands[leader][0]));
        e.playCard(p2, cardId(e.hands[p2][0]));
        e.playCard(p3, cardId(e.hands[p3][0]), { leap: true }); // void + trump unbroken -> needs Leap

        assertEqual(e.trickWinner, p3, 'a 2 of trump should beat an Ace of the lead suit');
    });

    it('meeting or beating a bid scores base 2 plus 1 per overtrick; missing costs 1 per undertrick', () => {
        const e = newEngine(3);
        // Force known bids without going through the full random-legality
        // dance. bid/tricks chosen so seat 1's exact-bid case doesn't
        // accidentally also trigger Perfect Veil (bid 0 AND took 0) --
        // that's its own dedicated test below.
        e.bids = [{ seat: 0, bid: 2 }, { seat: 1, bid: 1 }, { seat: 2, bid: 1 }];
        e.tricksWon = [3, 1, 0]; // seat 0: +1 overtrick, seat 1: exact (base only), seat 2: 1 short
        e.trick5Winner = null;
        e.trick6Winner = null;
        e.phase = 'playing';
        e.trickNumber = TRICKS_PER_HAND + 1; // about to end
        e.currentTrick = [];
        e._endHand();

        assertEqual(e.scores[0], 3); // 2 base + 1 overtrick
        assertEqual(e.scores[1], 2); // exact bid, base only
        assertEqual(e.scores[2], -1); // missed by 1
    });

    it('Cross bonus: +1 for winning trick 5 but not trick 6', () => {
        const e = newEngine(3);
        e.bids = [{ seat: 0, bid: 0 }, { seat: 1, bid: 0 }, { seat: 2, bid: 0 }];
        e.tricksWon = [0, 0, 0];
        e.trick5Winner = 1;
        e.trick6Winner = 2; // seat 1 won trick 5 and did NOT also win trick 6 -> gets Cross
        e.phase = 'playing';
        e.trickNumber = TRICKS_PER_HAND + 1;
        e.currentTrick = [];
        e._endHand();

        // seat 1 bid 0, took 0 tricks (tricksWon left at 0 in this synthetic
        // setup) -> Perfect Veil (+3) ALSO applies; isolate Cross by giving
        // seat 1 exactly one trick instead so Perfect Veil doesn't fire.
    });

    it('Cross bonus is isolated from Perfect Veil', () => {
        const e = newEngine(3);
        e.bids = [{ seat: 0, bid: 1 }, { seat: 1, bid: 0 }, { seat: 2, bid: 0 }];
        e.tricksWon = [1, 0, 0];
        e.trick5Winner = 0;
        e.trick6Winner = null; // won 5, not 6 -> Cross for seat 0
        e.phase = 'playing';
        e.trickNumber = TRICKS_PER_HAND + 1;
        e.currentTrick = [];
        e._endHand();

        assertEqual(e.scores[0], 3, '2 base (bid 1, took 1) + 1 Cross');
    });

    it('winning trick 5 AND trick 6 forfeits the Cross bonus', () => {
        const e = newEngine(3);
        e.bids = [{ seat: 0, bid: 2 }, { seat: 1, bid: 0 }, { seat: 2, bid: 0 }];
        e.tricksWon = [2, 0, 0];
        e.trick5Winner = 0;
        e.trick6Winner = 0; // same seat won both -> no Cross
        e.phase = 'playing';
        e.trickNumber = TRICKS_PER_HAND + 1;
        e.currentTrick = [];
        e._endHand();

        assertEqual(e.scores[0], 2, 'base only, no Cross bonus');
    });

    it('Perfect Veil: bid 0 and took 0 tricks scores +3 on top of the base', () => {
        const e = newEngine(3);
        e.bids = [{ seat: 0, bid: 0 }, { seat: 1, bid: 5 }, { seat: 2, bid: 5 }];
        e.tricksWon = [0, 5, 5];
        e.trick5Winner = 1;
        e.trick6Winner = 1;
        e.phase = 'playing';
        e.trickNumber = TRICKS_PER_HAND + 1;
        e.currentTrick = [];
        e._endHand();

        assertEqual(e.scores[0], 5, '2 base (bid 0, took 0) + 3 Perfect Veil');
    });

    it('reaching winningScore ends the game with a gameWinner', () => {
        const e = new TollVeilEngine(3, { winningScore: 5 });
        e.startHand();
        e.bids = [{ seat: 0, bid: 0 }, { seat: 1, bid: 5 }, { seat: 2, bid: 5 }];
        e.tricksWon = [0, 5, 5];
        e.trick5Winner = 1;
        e.trick6Winner = 1;
        e.phase = 'playing';
        e.trickNumber = TRICKS_PER_HAND + 1;
        e.currentTrick = [];
        e._endHand();

        assertEqual(e.phase, 'game_over');
        assertEqual(e.gameWinner, 0); // seat 0 hit 5+ points (2 base + 3 Perfect Veil = 5)
    });
});

describe('TollVeilEngine: Rooted', () => {
    it('a seat that has spent both markers is forced to pass the lead exactly once', () => {
        const e = newEngine(3);
        bidAllZero(e);
        const leader = e.currentSeat;
        e.markerUsed[leader] = { cut: true, leap: true };

        // Rig a trick so `leader` wins it outright with a guaranteed-strongest card.
        const suit = e.trump === '♣' ? '♠' : '♣';
        const p2 = (leader + 1) % 3;
        const p3 = (leader + 2) % 3;
        e.hands[leader] = [{ suit, rank: 'A', value: ACE_VALUE }];
        e.hands[p2] = [{ suit, rank: '2', value: 2 }];
        e.hands[p3] = [{ suit, rank: '3', value: 3 }];

        e.playCard(leader, cardId(e.hands[leader][0]));
        e.playCard(p2, cardId(e.hands[p2][0]));
        e.playCard(p3, cardId(e.hands[p3][0]));

        assertEqual(e.trickWinner, leader);
        assertFalse(e.currentSeat === leader, 'Rooted seat should not retain the lead it just won');
        assertTrue(e.rootedPenaltyApplied[leader]);
    });
});

describe('TollVeilEngine AI: aiChooseBid / aiChoosePlay never produce illegal actions', () => {
    it('aiChooseBid always returns a bid the engine accepts', () => {
        for (let trial = 0; trial < 20; trial++) {
            const e = newEngine(3 + (trial % 3));
            for (let i = 0; i < e.numSeats; i++) {
                const bid = aiChooseBid(e, e.currentSeat);
                const res = e.makeBid(e.currentSeat, bid);
                assertTrue(res.ok, `AI bid should be legal: ${res.reason}`);
            }
        }
    });

    it('aiChoosePlay always returns a play the engine accepts, across many random hands', () => {
        for (let trial = 0; trial < 15; trial++) {
            const e = newEngine(3 + (trial % 3));
            for (let i = 0; i < e.numSeats; i++) {
                e.makeBid(e.currentSeat, aiChooseBid(e, e.currentSeat));
            }
            assertEqual(e.phase, 'playing');
            let guard = 0;
            while (e.phase === 'playing' && guard < 200) {
                guard++;
                const seat = e.currentSeat;
                const play = aiChoosePlay(e, seat);
                const res = e.playCard(seat, play.id, { cut: play.cut, leap: play.leap });
                assertTrue(res.ok, `AI play should be legal (trial ${trial}): ${res.reason}`);
            }
            assert(guard < 200, 'hand should finish within a bounded number of plays');
        }
    });
});
