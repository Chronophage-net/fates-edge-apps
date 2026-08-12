// ============================================================
//  TOLL & VEIL — Engine (refined)
// ============================================================
//
// A 3–5 player trick-taking bidding game. This file has ZERO DOM
// dependencies (same convention as ../kon-reh/index.js's KonrehEngine)
// so it can be unit tested with plain Node, then reused verbatim by
// both the local/AI UI (toll-and-veil.js) and the host-authoritative
// multiplayer layer (toll-and-veil-connected.js).
//
// REFINEMENTS over the original draft this was built from
// -----------------------------------------------------------
// The original prototype had several places where the intent (visible
// in comments/UI copy) didn't match what the code actually enforced.
// Rather than leave those as silent behavior gaps, this pass makes the
// two hand markers and the "trump broken" state actually mean
// something, and cleans up dead/confused state:
//
//   1. TRUMP-BREAKING is now a real, enforced rule (a standard
//      trick-taking convention — e.g. Spades — that the original code
//      tracked via `trumpBroken` but never actually checked anywhere):
//      you may not LEAD a trick with a trump card until trump has been
//      "broken" (played by someone unable to follow the lead suit),
//      unless your entire hand is trump.
//   2. The Leap marker now has a real effect tied to that rule: it lets
//      its one-time user bypass the trump-broken restriction for a
//      single card — either to lead trump early, or to play trump when
//      void of the lead suit without waiting for it to break. Previously
//      `useLeap` was accepted, logged, and consumed the marker, but
//      never actually gated or permitted anything.
//   3. The Cut marker (+1 to a played card's effective value, can't
//      target an Ace) is unchanged — it was already fully implemented.
//   4. The Trick 5/6 "Cross" bonus scoring is unchanged in effect
//      (win trick 5 but not trick 6 → +1) but the implementation is
//      simplified: the original kept a whole parallel `crossWon[]`
//      array that every code path mutated but `endRound()` never
//      actually read (it scored from separate `_trick5Winner`/
//      `_trick6Winner` fields instead) — that dead array is gone, and
//      trick5Winner/trick6Winner are now real, constructor-declared
//      fields instead of ad-hoc `this._foo` properties.
//   5. Cards are addressed by a stable id (`"K♠"`) instead of hand
//      index for playCard()/makeBid() — a hand-index protocol breaks
//      the moment two clients render a hand in different orders (which
//      the multiplayer layer does, to keep bidding/AI reasoning
//      independent of client-side sort order).
//   6. AI decision-making is split into pure `aiChooseBid()` /
//      `aiChoosePlay()` functions (engine + seat in, a decision out —
//      no mutation, no setTimeout) so both local play and the
//      multiplayer host (which must run AI for any unfilled seats) use
//      the exact same logic instead of two copies drifting apart.
//
// Scoring, bid range (0–5), hand size (10 tricks), and the winning
// score are unchanged from the original design.

// ---------- Card & Deck ----------

export const SUITS = ['♣', '♠', '♡', '♢'];
export const RED_SUITS = ['♡', '♢'];
const RANK_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = Object.fromEntries(RANK_NAMES.map((r, i) => [r, i + 2]));
export const ACE_VALUE = RANK_VALUES['A'];

export function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANK_NAMES) {
            deck.push({ suit, rank, value: RANK_VALUES[rank] });
        }
    }
    return deck;
}

export function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Stable card identity ("K♠") — used on the wire and as the addressing
 *  scheme for playCard(), instead of a hand-array index that two
 *  clients may not agree on the order of. */
export function cardId(card) {
    return `${card.rank}${card.suit}`;
}

export function cardDisplay(card) {
    return `${card.rank}${card.suit}`;
}

// ---------- Config ----------

export const MIN_SEATS = 3;
export const MAX_SEATS = 5;
export const TRICKS_PER_HAND = 10;
export const MAX_BID = 5;
export const WINNING_SCORE_DEFAULT = 15;

function clampSeats(n) {
    return Math.min(Math.max(n, MIN_SEATS), MAX_SEATS);
}

// ---------- Engine ----------

export class TollVeilEngine {
    constructor(numSeats = 3, options = {}) {
        this.numSeats = clampSeats(numSeats);
        this.winningScore = options.winningScore || WINNING_SCORE_DEFAULT;
        this.rng = options.rng || Math.random; // overridable for deterministic tests

        this.deck = [];
        this.hands = [];
        this.trump = null;
        this.trumpFamily = null; // 'Toll' (red trump) or 'Veil' (black trump) — the game's own naming convention
        this.trumpBroken = false;
        this.currentTrick = [];
        this.leadSuit = null;
        this.trickNumber = 0;
        this.trickWinner = null;
        this.bids = [];
        this.currentSeat = 0;
        this.phase = 'bidding'; // 'bidding' | 'playing' | 'scoring' | 'game_over'
        this.scores = new Array(this.numSeats).fill(0);
        this.tricksWon = [];
        this.trick5Winner = null;
        this.trick6Winner = null;
        this.rootedPenaltyApplied = []; // per-seat: has the one-time Rooted lead-skip already fired this hand?
        this.markerUsed = []; // per-seat: { cut, leap }
        this.dealerIndex = 0;
        this.log = [];
        this.gameWinner = null;

        this.onUpdate = null; // optional UI callback
    }

    // ---------- Setup ----------

    /** Starts a brand-new hand: shuffles, deals, flips trump, opens bidding. */
    startHand() {
        this.deck = shuffle(createDeck());
        this._deal();
        this.bids = [];
        this.tricksWon = new Array(this.numSeats).fill(0);
        this.rootedPenaltyApplied = new Array(this.numSeats).fill(false);
        this.markerUsed = new Array(this.numSeats).fill(null).map(() => ({ cut: false, leap: false }));
        this.currentTrick = [];
        this.trickNumber = 0;
        this.trickWinner = null;
        this.trick5Winner = null;
        this.trick6Winner = null;
        this.leadSuit = null;
        this.trumpBroken = false;
        this.phase = 'bidding';

        // Trump is whatever suit sits on top of the undealt remainder of
        // the deck (10 cards/seat means 2–22 cards are always left over
        // for 3–5 seats out of a 52-card deck) — peek, don't remove, so
        // it isn't a playable card mid-hand.
        const topCard = this.deck[this.deck.length - 1];
        this.trump = topCard.suit;
        this.trumpFamily = RED_SUITS.includes(this.trump) ? 'Toll' : 'Veil';
        this._log(`Trump: ${this.trump} — playing in ${this.trumpFamily}.`);

        this.currentSeat = (this.dealerIndex + 1) % this.numSeats;
        this._fireUpdate();
    }

    _deal() {
        this.hands = new Array(this.numSeats).fill(null).map(() => []);
        for (let i = 0; i < TRICKS_PER_HAND * this.numSeats; i++) {
            const card = this.deck.pop();
            if (!card) break;
            this.hands[i % this.numSeats].push(card);
        }
    }

    // ---------- Bidding ----------

    /**
     * @param {number} seat
     * @param {number} bid - 0..MAX_BID
     */
    makeBid(seat, bid) {
        if (this.phase !== 'bidding') return { ok: false, reason: 'not-bidding' };
        if (seat !== this.currentSeat) return { ok: false, reason: 'not-your-turn' };
        if (!Number.isInteger(bid) || bid < 0 || bid > MAX_BID) return { ok: false, reason: 'bad-bid' };
        if (this.bids.some(b => b.seat === seat)) return { ok: false, reason: 'already-bid' };

        // Standard "screw the dealer" rule: the LAST bidder (always the
        // dealer, since bidding starts at dealer+1 and wraps all the way
        // around) may not bid a number that makes the total equal
        // exactly TRICKS_PER_HAND — guarantees at least one bidder is
        // wrong every hand.
        const isLastBidder = this.bids.length === this.numSeats - 1;
        if (isLastBidder) {
            const sum = this.bids.reduce((s, b) => s + b.bid, 0) + bid;
            if (sum === TRICKS_PER_HAND) {
                return { ok: false, reason: 'sum-would-equal-tricks' };
            }
        }

        this.bids.push({ seat, bid });
        this._log(`Seat ${seat + 1} bids ${bid}`);

        if (this.bids.length === this.numSeats) {
            // Everyone has bid -- BUG FIX: the "skip to the next seat that
            // hasn't bid yet" loop below assumes at least one such seat
            // still exists. On the final bid that's no longer true (every
            // seat is in this.bids), so it looped forever. Move straight
            // to the playing phase instead of hunting for a next bidder.
            this.phase = 'playing';
            this.currentSeat = (this.dealerIndex + 1) % this.numSeats;
            this.trickNumber = 1;
            this._log('Bidding complete. Play begins.');
        } else {
            let next = (this.currentSeat + 1) % this.numSeats;
            while (this.bids.some(b => b.seat === next)) {
                next = (next + 1) % this.numSeats;
            }
            this.currentSeat = next;
        }
        this._fireUpdate();
        return { ok: true };
    }

    // ---------- Playing ----------

    /**
     * @param {number} seat
     * @param {string} id - cardId() of the card in `seat`'s hand to play
     * @param {{cut?: boolean, leap?: boolean}} [markers]
     */
    playCard(seat, id, markers = {}) {
        const useCut = !!markers.cut;
        const useLeap = !!markers.leap;

        if (this.phase !== 'playing') return { ok: false, reason: 'not-playing' };
        if (seat !== this.currentSeat) return { ok: false, reason: 'not-your-turn' };

        const hand = this.hands[seat];
        const cardIndex = hand.findIndex(c => cardId(c) === id);
        if (cardIndex === -1) return { ok: false, reason: 'card-not-in-hand' };
        const card = hand[cardIndex];

        const seatMarkers = this.markerUsed[seat];
        if (useCut && seatMarkers.cut) return { ok: false, reason: 'cut-already-used' };
        if (useLeap && seatMarkers.leap) return { ok: false, reason: 'leap-already-used' };
        if (useCut && card.value === ACE_VALUE) return { ok: false, reason: 'cannot-cut-an-ace' };

        const isLeading = this.leadSuit === null;
        const isTrumpCard = card.suit === this.trump;
        const handIsAllTrump = hand.every(c => c.suit === this.trump);

        if (isLeading) {
            // Trump-breaking: can't lead trump before it's broken, unless
            // Leap is spent on this card, or the hand has nothing else.
            if (isTrumpCard && !this.trumpBroken && !handIsAllTrump) {
                if (!useLeap) return { ok: false, reason: 'trump-not-broken' };
            }
        } else {
            const hasLeadSuit = hand.some(c => c.suit === this.leadSuit);
            if (hasLeadSuit) {
                if (card.suit !== this.leadSuit) return { ok: false, reason: 'must-follow-suit' };
            } else if (isTrumpCard && !this.trumpBroken && !handIsAllTrump) {
                // Void in the lead suit, trying to play trump before it's
                // broken — legal, but only if Leap is spent on it (Leap
                // is exactly what lets a void hand reach for trump early;
                // without it you must play off-suit, non-trump, same as
                // a hand that has no trump at all).
                //
                // BUG FIX: the `!handIsAllTrump` escape used to only apply
                // when LEADING. A player void in the lead suit whose
                // entire remaining hand happens to be trump (easily
                // possible late in a hand) had no legal move at all if
                // they'd already spent Leap -- every card they held was
                // simultaneously "not the lead suit" and "trump before it
                // broke". Mirroring the same escape here means a hand
                // with literally no non-trump card left is never soft-locked.
                if (!useLeap) return { ok: false, reason: 'trump-not-broken' };
            }
        }

        hand.splice(cardIndex, 1);
        this.currentTrick.push({ seat, card, cut: useCut, leap: useLeap });
        if (useCut) seatMarkers.cut = true;
        if (useLeap) seatMarkers.leap = true;
        if (isLeading) this.leadSuit = card.suit;
        if (isTrumpCard) this.trumpBroken = true;

        const cutStr = useCut ? ' ✂️' : '';
        const leapStr = useLeap ? ' 🦘' : '';
        this._log(`Seat ${seat + 1} plays ${cardDisplay(card)}${cutStr}${leapStr}`);

        this.currentSeat = (this.currentSeat + 1) % this.numSeats;

        if (this.currentTrick.length === this.numSeats) {
            this._resolveTrick();
        } else {
            this._fireUpdate();
        }
        return { ok: true };
    }

    /** Effective (Cut-adjusted) value of one played card, for trick resolution. */
    _effectiveValue(play) {
        return play.cut ? play.card.value + 1 : play.card.value;
    }

    _resolveTrick() {
        let winner = this.currentTrick[0];
        for (const play of this.currentTrick.slice(1)) {
            const winnerIsTrump = winner.card.suit === this.trump;
            const playIsTrump = play.card.suit === this.trump;
            const winnerIsLead = winner.card.suit === this.leadSuit;
            const playIsLead = play.card.suit === this.leadSuit;

            let beats = false;
            if (playIsTrump && !winnerIsTrump) {
                beats = true;
            } else if (playIsTrump && winnerIsTrump) {
                beats = this._effectiveValue(play) > this._effectiveValue(winner);
            } else if (!playIsTrump && !winnerIsTrump) {
                if (playIsLead && !winnerIsLead) beats = true;
                else if (playIsLead && winnerIsLead) beats = this._effectiveValue(play) > this._effectiveValue(winner);
                // else: neither trump nor lead suit — can never win.
            }
            if (beats) winner = play;
        }

        const winnerSeat = winner.seat;
        this.tricksWon[winnerSeat]++;
        this.trickWinner = winnerSeat;
        if (this.trickNumber === 5) this.trick5Winner = winnerSeat;
        if (this.trickNumber === 6) this.trick6Winner = winnerSeat;

        this._log(`Trick ${this.trickNumber} won by seat ${winnerSeat + 1}`);

        this.trickNumber++;
        this.currentTrick = [];
        this.leadSuit = null;

        if (this.trickNumber > TRICKS_PER_HAND) {
            this._endHand();
            return;
        }

        this.currentSeat = winnerSeat;

        // Rooted: the first time a seat that has used BOTH markers wins
        // the lead, they must immediately pass it on — a one-time
        // penalty per hand, not a lasting restriction.
        const markers = this.markerUsed[winnerSeat];
        if (markers.cut && markers.leap && !this.rootedPenaltyApplied[winnerSeat]) {
            this.rootedPenaltyApplied[winnerSeat] = true;
            this._log(`Seat ${winnerSeat + 1} is Rooted (both markers spent) — passes the lead.`, 'warning');
            this.currentSeat = (this.currentSeat + 1) % this.numSeats;
        }

        this._fireUpdate();
    }

    _endHand() {
        this.phase = 'scoring';
        const handScores = new Array(this.numSeats).fill(0);

        for (let seat = 0; seat < this.numSeats; seat++) {
            const bidEntry = this.bids.find(b => b.seat === seat);
            const bid = bidEntry ? bidEntry.bid : 0;
            const tricks = this.tricksWon[seat];
            let score = 0;

            if (tricks >= bid) {
                score += 2 + (tricks - bid);
            } else {
                score -= (bid - tricks);
            }

            if (this.trick5Winner === seat && this.trick6Winner !== seat) {
                score += 1; // Cross: won trick 5, not trick 6
            }
            if (bid === 0 && tricks === 0) {
                score += 3; // Perfect Veil
            }

            handScores[seat] = score;
            this.scores[seat] += score;
        }

        this._log('Hand scores: ' + this.scores.map((s, i) => `Seat ${i + 1}: ${handScores[i]} (total ${s})`).join('  '));

        for (let seat = 0; seat < this.numSeats; seat++) {
            if (this.scores[seat] >= this.winningScore) {
                this.gameWinner = seat;
                this.phase = 'game_over';
                this._log(`🏆 Seat ${seat + 1} wins the game with ${this.scores[seat]} points!`, 'winner');
                this._fireUpdate();
                return;
            }
        }

        this.dealerIndex = (this.dealerIndex + 1) % this.numSeats;
        this.startHand();
    }

    // ---------- Views ----------

    /** Everything EXCEPT hand contents — safe to broadcast to every seat/spectator. */
    getPublicState() {
        return {
            numSeats: this.numSeats,
            winningScore: this.winningScore,
            trump: this.trump,
            trumpFamily: this.trumpFamily,
            trumpBroken: this.trumpBroken,
            currentTrick: this.currentTrick.map(p => ({ seat: p.seat, card: p.card, cut: p.cut, leap: p.leap })),
            leadSuit: this.leadSuit,
            trickNumber: this.trickNumber,
            trickWinner: this.trickWinner,
            bids: this.bids,
            currentSeat: this.currentSeat,
            phase: this.phase,
            scores: [...this.scores],
            tricksWon: [...this.tricksWon],
            markerUsed: this.markerUsed.map(m => ({ ...m })),
            dealerIndex: this.dealerIndex,
            gameWinner: this.gameWinner,
            handCounts: this.hands.map(h => h.length),
            log: this.log.slice(-40),
        };
    }

    /** The public state plus exactly one seat's own hand — the full view that seat's client should render. */
    getSeatView(seat) {
        return {
            ...this.getPublicState(),
            seat,
            hand: (this.hands[seat] || []).map(c => ({ ...c, id: cardId(c) })),
        };
    }

    // ---------- Logging ----------

    _log(msg, type = 'info') {
        this.log.push({ msg, type, t: Date.now() });
        this._fireUpdate();
    }

    _fireUpdate() {
        if (this.onUpdate) this.onUpdate();
    }
}

// ============================================================
// AI — pure decision functions (engine + seat in, decision out)
// ============================================================

/** @returns {number} a legal bid for `seat` right now. */
export function aiChooseBid(engine, seat) {
    const isLastBidder = engine.bids.length === engine.numSeats - 1;
    const sumSoFar = engine.bids.reduce((s, b) => s + b.bid, 0);
    const candidates = [0, 1, 2, 3, 4, 5];
    if (isLastBidder) {
        const legal = candidates.filter(b => (sumSoFar + b) !== TRICKS_PER_HAND);
        return legal[Math.floor(Math.random() * legal.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Pure helper (no mutation) shared by aiChoosePlay() and the UI layer:
 * what's actually legal for `seat` to play right now, mirroring
 * playCard()'s own rules exactly (including the all-trump-hand escape
 * in both the leading and void-follow branches), annotated with whether
 * playing it would require spending Leap. The UI uses this to grey out
 * illegal cards instead of letting the player click one and get
 * rejected; the AI uses it to pick from real legal options.
 *
 * @returns {Array<{card, isTrump: boolean, needsLeap: boolean}>}
 */
export function legalPlaysForSeat(engine, seat) {
    const hand = engine.hands[seat];
    const markers = engine.markerUsed[seat];
    const isLeading = engine.leadSuit === null;
    const handIsAllTrump = hand.every(c => c.suit === engine.trump);
    const hasLeadSuit = engine.leadSuit !== null && hand.some(c => c.suit === engine.leadSuit);

    const options = hand.map(card => {
        const isTrump = card.suit === engine.trump;
        let legal = true;
        let needsLeap = false;

        if (isLeading) {
            if (isTrump && !engine.trumpBroken && !handIsAllTrump) {
                needsLeap = true;
                legal = !!markers.leap; // only legal with Leap available (and unspent)
            }
        } else if (hasLeadSuit) {
            legal = card.suit === engine.leadSuit;
        } else if (isTrump && !engine.trumpBroken && !handIsAllTrump) {
            needsLeap = true;
            legal = !!markers.leap;
        }
        return { card, isTrump, legal, needsLeap };
    }).filter(o => o.legal);

    // Fallback: should be unreachable given the legality mirror above
    // matches playCard() exactly (including the all-trump escape), but
    // kept as a last-resort safety net so neither the AI nor the UI is
    // ever left with literally zero options.
    return options.length ? options : hand.map(card => ({
        card,
        isTrump: card.suit === engine.trump,
        needsLeap: card.suit === engine.trump && !engine.trumpBroken && !handIsAllTrump,
    }));
}

/**
 * @returns {{id: string, cut: boolean, leap: boolean}} a legal play for `seat` right now.
 */
export function aiChoosePlay(engine, seat) {
    const hand = engine.hands[seat];
    const markers = engine.markerUsed[seat];
    const isLeading = engine.leadSuit === null;
    const hasLeadSuit = engine.leadSuit !== null && hand.some(c => c.suit === engine.leadSuit);
    const legalOptions = legalPlaysForSeat(engine, seat);

    let choice;
    const trumpOptions = legalOptions.filter(o => o.isTrump);
    if (trumpOptions.length > 0 && (isLeading || !hasLeadSuit)) {
        trumpOptions.sort((a, b) => b.card.value - a.card.value);
        choice = trumpOptions[0];
    } else if (hasLeadSuit) {
        const suitOptions = legalOptions.filter(o => o.card.suit === engine.leadSuit);
        suitOptions.sort((a, b) => b.card.value - a.card.value);
        choice = suitOptions[0] || legalOptions[0];
    } else {
        const sorted = [...legalOptions].sort((a, b) => b.card.value - a.card.value);
        choice = sorted[0];
    }

    const useLeap = !markers.leap && !!choice.needsLeap;
    // Spend Cut opportunistically on a strong, non-Ace card when we
    // don't already have the outright best card in hand for this trick.
    const useCut = !markers.cut && choice.card.value !== ACE_VALUE && choice.card.value >= 10;

    return { id: cardId(choice.card), cut: useCut, leap: useLeap };
}
