// ============================================================
//  TOLL & VEIL — Connected Mode (host-authoritative)
// ============================================================
//
// Unlike Kon'reh (perfect information — both clients can run an
// identical, client-symmetric engine and just replay each other's
// moves), Toll & Veil has hidden hands and a shuffled deck. A
// symmetric protocol would mean every client has to be trusted not to
// peek at its local copy of everyone else's cards. Instead, exactly
// ONE client — the host — runs the real TollVeilEngine. Every other
// seat is a thin remote controller: it sends bid/play *requests*, the
// host validates and applies them to the one true engine, and the
// host pushes back a redacted view to each participant.
//
// TRANSPORT CONTRACT (same shape as kon-reh-connected.js)
// ---------------------------------------------------------
//   transport.send(message)   — message is a plain JS object.
//   connection.receive(message) — you call this when one arrives.
//
// PRIVACY CAVEAT (please read)
// ------------------------------
// The VTT's event relay (core/websocket.js's sendEvent/onEvent) is a
// broadcast to the whole room — there is no server-side concept of a
// private, single-recipient message, and this project deliberately
// avoids requiring server changes (same constraint Kon'reh's bridge
// works under). So a seat's hand IS technically sent to every client
// in the room, tagged `forId: <that seat's opaque id>`; well-behaved
// clients simply ignore any `hand` message whose `forId` isn't their
// own. This is NOT cryptographic privacy — a modified client could
// read anyone's hand. For a home game among friends over your own
// VTT server, that's an accepted, documented trade-off, not a bug.
//
// STAKES
// ------
// When stakeConfig.mode is 'xp' or 'string', the HOST computes the
// outcome once the game ends and emits one `stake-transfer` (XP) or
// `stake-string` (narrative debt) message per losing human seat. Every
// client — including the host's own UI — watches for messages where
// it is the `fromSeat` or `toSeat` and applies the effect to its OWN
// locally-bound character only; no client ever mutates another
// client's character record. See applyStakeEvent() below.

import { TollVeilEngine, aiChooseBid, aiChoosePlay } from './toll-and-veil-engine.js';
import { getCharacter, updateCharacter, getCharacters } from '../../core/state.js';

export const TOLL_VEIL_CONNECTED_PROTOCOL_VERSION = 1;

const STRING_DEBT_PROMPTS = [
    'I owe you a story about why I needed that XP.',
    "I'll do one favor for you, no questions asked.",
    'You now know my character’s deepest fear.',
    'I owe you the truth about where I really was that night.',
    'Next time you need backup, I’m there — no matter the cost.',
    'You hold one secret of mine now. Use it wisely.',
];

/** Best-effort "my bound character" — mirrors the Whiteboard's own
 *  convention (js/features/whiteboard/modules/ui.js's getWhiteboardSenderName). */
export function myActiveCharacter() {
    try {
        const chars = getCharacters() || [];
        return chars.find(c => c.active !== false) || null;
    } catch (e) {
        return null;
    }
}

/**
 * Applies an incoming stake event to the LOCAL character only, if this
 * client is actually a party to it. Safe to call for every stake
 * message received, from every client (including the host's own).
 *
 * @param {Object} event - { t: 'stake-transfer'|'stake-string', fromSeat, toSeat, amount?, text?, mySeat }
 * @returns {string|null} a human-readable line describing what happened locally, or null if not applicable.
 */
export function applyStakeEvent(event, mySeat) {
    if (mySeat == null) return null;
    const char = myActiveCharacter();
    if (event.t === 'stake-transfer') {
        if (event.fromSeat === mySeat && char) {
            const newXp = Math.max(0, (char.startingXp || 0) - event.amount);
            updateCharacter(char.id, { startingXp: newXp });
            return `You wagered ${event.amount} XP and lost the hand — ${char.name}'s starting XP is now ${newXp}.`;
        }
        if (event.toSeat === mySeat && char) {
            const newXp = (char.startingXp || 0) + event.amount;
            updateCharacter(char.id, { startingXp: newXp });
            return `You won the wager — ${char.name} gains ${event.amount} XP (now ${newXp}).`;
        }
        return null;
    }
    if (event.t === 'stake-string') {
        if (event.fromSeat === mySeat) {
            return `You owe a String: "${event.text}"`;
        }
        if (event.toSeat === mySeat) {
            return `You're owed a String: "${event.text}"`;
        }
        return null;
    }
    return null;
}

/**
 * Opens Toll & Veil as the authoritative HOST for `numSeats` players.
 *
 * @param {Object} transport - `{ send(message) }`
 * @param {Object} options
 * @param {number} options.numSeats
 * @param {number} options.localSeat - which seat the host itself plays (or null to spectate/GM-run).
 * @param {Object} options.seatIds - { [seat]: opaqueId } — every HUMAN seat's transport-addressable id; AI/unfilled seats are simply absent.
 * @param {number} [options.winningScore]
 * @param {Object} [options.stakeConfig] - { mode: 'points'|'xp'|'string', xpCap?: number }
 * @param {Function} [options.postChat] - optional (text) => void, for a single table-wide summary at game end.
 * @returns {Object} { receive, getEngine, destroy }
 */
export function createTollVeilHost(transport, options = {}) {
    const {
        numSeats, localSeat = null, seatIds = {}, winningScore,
        stakeConfig = { mode: 'points' }, postChat = null,
    } = options;

    const engine = new TollVeilEngine(numSeats, { winningScore });
    let seq = 0;
    let aiTimer = null;
    let prevPhase = null;
    const changeListeners = new Set();

    function safeSend(msg) {
        try { transport.send(msg); } catch (e) { console.warn('[Toll & Veil host] send error:', e); }
    }

    function isHumanSeat(seat) { return !!seatIds[seat]; }
    function isAiSeat(seat) { return !isHumanSeat(seat) && seat !== localSeat; }

    function broadcastState() {
        seq++;
        safeSend({ t: 'public', seq, state: engine.getPublicState() });
        for (let s = 0; s < engine.numSeats; s++) {
            const id = seatIds[s];
            if (!id) continue;
            safeSend({ t: 'hand', forId: id, seq, seat: s, hand: engine.getSeatView(s).hand });
        }
    }

    function scheduleAi() {
        clearTimeout(aiTimer);
        if (engine.phase === 'game_over') return;
        const seat = engine.currentSeat;
        if (!isAiSeat(seat)) return;
        aiTimer = setTimeout(() => {
            if (engine.phase === 'bidding' && engine.currentSeat === seat) {
                engine.makeBid(seat, aiChooseBid(engine, seat));
            } else if (engine.phase === 'playing' && engine.currentSeat === seat) {
                const c = aiChoosePlay(engine, seat);
                engine.playCard(seat, c.id, { cut: c.cut, leap: c.leap });
            }
        }, 500 + Math.random() * 700);
    }

    function resolveStakes() {
        const winner = engine.gameWinner;
        if (winner == null || stakeConfig.mode === 'points') return;
        const loserSeats = [];
        for (let s = 0; s < engine.numSeats; s++) {
            if (s === winner) continue;
            if (!isHumanSeat(s) && s !== localSeat) continue; // AI seats never owe/collect stakes
            loserSeats.push(s);
        }
        if (!loserSeats.length) return;

        const summaryLines = [];
        if (stakeConfig.mode === 'xp') {
            const amount = Math.max(0, stakeConfig.xpCap || 0);
            if (amount <= 0) return;
            for (const loser of loserSeats) {
                const ev = { t: 'stake-transfer', fromSeat: loser, toSeat: winner, amount };
                safeSend(ev);
                applyStakeEvent(ev, localSeat); // apply locally if the host itself is a party
            }
            summaryLines.push(`💰 Toll & Veil: seat ${winner + 1} collects ${amount} wagered XP from ${loserSeats.map(s => `seat ${s + 1}`).join(', ')}.`);
        } else if (stakeConfig.mode === 'string') {
            for (const loser of loserSeats) {
                const text = STRING_DEBT_PROMPTS[Math.floor(Math.random() * STRING_DEBT_PROMPTS.length)];
                const ev = { t: 'stake-string', fromSeat: loser, toSeat: winner, text };
                safeSend(ev);
                applyStakeEvent(ev, localSeat);
                summaryLines.push(`🧵 Seat ${loser + 1} owes seat ${winner + 1} a String: "${text}"`);
            }
        }
        if (postChat && summaryLines.length) postChat(summaryLines.join('\n'));
    }

    engine.onUpdate = () => {
        broadcastState();
        scheduleAi();
        if (engine.phase === 'game_over' && prevPhase !== 'game_over') {
            resolveStakes();
        }
        prevPhase = engine.phase;
        changeListeners.forEach(cb => { try { cb(); } catch (e) { /* ignore */ } });
    };
    engine.startHand();

    // Incoming guest action / late-join sync-request.
    function receive(raw) {
        let msg = raw;
        if (typeof raw === 'string') {
            try { msg = JSON.parse(raw); } catch { return; }
        }
        if (!msg || typeof msg !== 'object' || !msg.t) return;

        switch (msg.t) {
            case 'bid': {
                if (msg.seat == null || seatIds[msg.seat] !== msg.fromId) return; // seat ownership check
                engine.makeBid(msg.seat, msg.bid);
                break;
            }
            case 'play': {
                if (msg.seat == null || seatIds[msg.seat] !== msg.fromId) return;
                engine.playCard(msg.seat, msg.id, { cut: !!msg.cut, leap: !!msg.leap });
                break;
            }
            case 'sync-request': {
                broadcastState();
                break;
            }
            default:
                break;
        }
    }

    // A controller conforming to toll-and-veil.js's interface, for the
    // host's OWN seat (if the host is playing, not just GMing the table).
    const controller = {
        numSeats,
        seatNames: Array.from({ length: numSeats }, (_, i) => isHumanSeat(i) ? `Seat ${i + 1}` : (i === localSeat ? 'You' : (i === localSeat ? 'You' : `AI ${i + 1}`))),
        localSeat,
        stakeConfig,
        getView() {
            const pub = engine.getPublicState();
            const myHand = localSeat != null ? engine.getSeatView(localSeat).hand : [];
            return { ...pub, myHand };
        },
        canBid() { return localSeat != null && engine.phase === 'bidding' && engine.currentSeat === localSeat; },
        canPlay() { return localSeat != null && engine.phase === 'playing' && engine.currentSeat === localSeat; },
        legalIds() {
            if (localSeat == null || engine.phase !== 'playing') return null;
            return null; // host UI trusts engine round-trip validation directly (rare path — host rarely misclicks its own legal set since it IS the engine)
        },
        bid(n) { return engine.makeBid(localSeat, n); },
        play(id, markers) { return engine.playCard(localSeat, id, markers); },
        onChange(cb) { changeListeners.add(cb); return () => changeListeners.delete(cb); },
        destroy() { clearTimeout(aiTimer); changeListeners.clear(); engine.onUpdate = null; },
    };

    return { receive, controller, getEngine: () => engine, destroy: controller.destroy };
}

/**
 * Opens Toll & Veil as a GUEST controlling exactly one seat, with the
 * host running the real engine. Renders through the same
 * toll-and-veil.js UI via the controller interface.
 *
 * @param {Object} transport - `{ send(message) }`
 * @param {Object} options
 * @param {number} options.mySeat
 * @param {string} options.myId - this client's opaque transport id (matches what the host was told at join time).
 * @param {Object} [options.stakeConfig]
 * @returns {Object} { receive, controller, destroy }
 */
export function createTollVeilGuest(transport, options = {}) {
    const { mySeat, myId, stakeConfig = { mode: 'points' } } = options;

    let publicState = null;
    let myHand = [];
    const changeListeners = new Set();

    function safeSend(msg) {
        try { transport.send({ ...msg, fromId: myId }); } catch (e) { console.warn('[Toll & Veil guest] send error:', e); }
    }
    function fire() { changeListeners.forEach(cb => { try { cb(); } catch (e) { /* ignore */ } }); }

    safeSend({ t: 'sync-request' });

    function receive(raw) {
        let msg = raw;
        if (typeof raw === 'string') {
            try { msg = JSON.parse(raw); } catch { return; }
        }
        if (!msg || typeof msg !== 'object' || !msg.t) return;

        if (msg.t === 'public') {
            publicState = msg.state;
            fire();
        } else if (msg.t === 'hand') {
            if (msg.forId !== myId) return; // not meant for us — see PRIVACY CAVEAT above
            if (msg.seat !== mySeat) return;
            myHand = msg.hand;
            fire();
        } else if (msg.t === 'stake-transfer' || msg.t === 'stake-string') {
            applyStakeEvent(msg, mySeat);
        }
    }

    const controller = {
        numSeats: publicState?.numSeats,
        seatNames: [],
        localSeat: mySeat,
        stakeConfig,
        getView() {
            return { ...(publicState || {}), myHand };
        },
        canBid() { return !!publicState && publicState.phase === 'bidding' && publicState.currentSeat === mySeat; },
        canPlay() { return !!publicState && publicState.phase === 'playing' && publicState.currentSeat === mySeat; },
        legalIds() { return null; }, // guests can't compute this without the deck's trump-broken/hand-is-all-trump context beyond what's already public+hand — host will reject illegal attempts, so no card is pre-disabled.
        bid(n) { safeSend({ t: 'bid', seat: mySeat, bid: n }); },
        play(id, markers = {}) { safeSend({ t: 'play', seat: mySeat, id, cut: !!markers.cut, leap: !!markers.leap }); },
        onChange(cb) { changeListeners.add(cb); return () => changeListeners.delete(cb); },
        destroy() { changeListeners.clear(); },
    };

    return { receive, controller, destroy: controller.destroy };
}
