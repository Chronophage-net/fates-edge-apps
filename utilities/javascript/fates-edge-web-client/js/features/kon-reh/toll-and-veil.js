// ============================================================
//  TOLL & VEIL — UI (local hot-seat / vs AI, and the shared
//  rendering layer that connected mode drives too)
// ============================================================
//
// This module owns the DOM. It never talks to a network directly —
// instead it renders against a small "controller" interface so the
// exact same rendering code works for local/AI play (a controller
// that wraps a real TollVeilEngine directly) and for connected
// multiplayer (a controller built by toll-and-veil-connected.js that
// wraps host-authoritative state + network calls instead). This is
// the same split ../kon-reh/index.js's KonrehEngine UI vs.
// kon-reh-connected.js uses, adapted for a game with hidden
// information (hands) where a client-symmetric engine can't work.
//
// CONTROLLER INTERFACE
// ---------------------
//   controller.numSeats
//   controller.seatNames            -> string[]
//   controller.localSeat            -> number|null (null = spectator)
//   controller.stakeConfig          -> { mode: 'points'|'xp'|'string', xpCap?: number }
//   controller.getView()            -> merged public state + `myHand` (cards for localSeat, [] if spectating)
//   controller.canBid()             -> boolean
//   controller.canPlay()            -> boolean
//   controller.bid(n)
//   controller.play(cardId, {cut, leap})
//   controller.requestNewGame()     -> optional
//   controller.onChange(cb)         -> returns an unsubscribe function
//   controller.destroy()            -> optional cleanup

import { t as i18nText } from '@core/i18n.js';
import { escHtml as escapeHtml } from '@core/utils.js';
import { showOutcomeOverlay, hideOutcomeOverlay } from './outcome-overlay.js';
import { STORY_STAKES, storyPromise, storyMoment, storySettlement } from './story-stakes.js';
import {
    TollVeilEngine, aiChooseBid, aiChoosePlay, legalPlaysForSeat,
    MIN_SEATS, MAX_SEATS, cardDisplay, TRICKS_PER_HAND, MAX_BID, ACE_VALUE,
} from './toll-and-veil-engine.js';

const SUIT_COLOR = { '♣': '#cfd2e3', '♠': '#cfd2e3', '♡': '#e18a95', '♢': '#e18a95' };

// ============================================================
// Local (hot-seat / vs AI) controller
// ============================================================

export function createLocalController({ numSeats = 3, aiSeats = [], winningScore, localSeat = 0, stakeConfig = { mode: 'points' } } = {}) {
    const engine = new TollVeilEngine(numSeats, { winningScore });
    const aiSet = new Set(aiSeats);
    const listeners = new Set();
    let aiTimer = null;
    const passPlay = aiSeats.length === 0 && localSeat != null;
    let revealedSeat = null;
    const currentLocalSeat = () => passPlay ? engine.currentSeat : localSeat;
    const ready = () => !passPlay || revealedSeat === engine.currentSeat;

    function fire() { listeners.forEach(cb => { try { cb(); } catch (e) { /* ignore */ } }); }
    engine.onUpdate = fire;

    function scheduleAiIfNeeded() {
        clearTimeout(aiTimer);
        if (engine.phase === 'game_over') return;
        const seat = engine.currentSeat;
        if (!aiSet.has(seat)) return;
        aiTimer = setTimeout(() => {
            if (engine.phase === 'bidding' && engine.currentSeat === seat) {
                engine.makeBid(seat, aiChooseBid(engine, seat));
            } else if (engine.phase === 'playing' && engine.currentSeat === seat) {
                const choice = aiChoosePlay(engine, seat);
                engine.playCard(seat, choice.id, { cut: choice.cut, leap: choice.leap });
            }
        }, 550 + Math.random() * 500);
    }

    listeners.add(scheduleAiIfNeeded);
    engine.startHand();

    return {
        numSeats,
        seatNames: Array.from({ length: numSeats }, (_, i) => aiSet.has(i) ? `AI ${i + 1}` : (!passPlay && i === localSeat ? 'You' : `Seat ${i + 1}`)),
        get localSeat() { return currentLocalSeat(); },
        passPlay,
        humanSeats: Array.from({length:numSeats}, (_,i)=>i).filter(i=>!aiSet.has(i)),
        revealHand() { revealedSeat = engine.currentSeat; fire(); },
        stakeConfig,
        getView() {
            const pub = engine.getPublicState();
            const seat = currentLocalSeat();
            const myHand = seat != null && ready() ? engine.getSeatView(seat).hand : [];
            return { ...pub, myHand, needsHandoff: passPlay && !ready() && engine.phase !== 'game_over' };
        },
        canBid() { return ready() && engine.phase === 'bidding' && engine.currentSeat === currentLocalSeat() && !aiSet.has(currentLocalSeat()); },
        canPlay() { return ready() && engine.phase === 'playing' && engine.currentSeat === currentLocalSeat() && !aiSet.has(currentLocalSeat()); },
        legalIds() {
            if (engine.phase !== 'playing') return null;
            return ready() && currentLocalSeat() != null ? legalPlaysForSeat(engine, currentLocalSeat()) : [];
        },
        bid(n) { return act(() => engine.makeBid(currentLocalSeat(), n)); },
        play(id, markers) { return act(() => engine.playCard(currentLocalSeat(), id, markers)); },
        requestNewGame() { revealedSeat = null; engine.lastHandSummary = []; engine.log = []; engine.dealerIndex = (engine.dealerIndex + 1) % engine.numSeats; engine.scores = new Array(engine.numSeats).fill(0); engine.gameWinner = null; engine.startHand(); },
        onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
        destroy() { clearTimeout(aiTimer); listeners.clear(); engine.onUpdate = null; },
        _engine: engine, // exposed for connected-mode host reuse only
    };

    function act(action) {
        if (!ready()) return { ok: false, reason: 'reveal-hand-first' };
        const previous = revealedSeat;
        revealedSeat = null; // Hide private cards before synchronous engine notifications.
        const result = action();
        if (!result.ok) revealedSeat = previous;
        fire();
        return result;
    }
}

// ============================================================
// Modal
// ============================================================

let modalEl = null;
let activeController = null;
let unsubscribe = null;
let hiddenSiblings = null; // siblings of #app-content we hid while the modal is mounted

function injectStyle() {
    if (document.getElementById('tv-style')) return;
    const style = document.createElement('style');
    style.id = 'tv-style';
    style.textContent = `
        #tv-modal * { box-sizing: border-box; }
        #tv-modal { --gold:#d4af37; --bg:#14151c; --panel:#1b1c26; --line:#2c2d3a; --ink:#e8e6df; --muted:#9a9aa8; }
        #tv-modal .tv-btn { background:#2a2b38; color:#e8e6df; border:1px solid #3a3b4a; padding:7px 14px;
            border-radius:6px; cursor:pointer; font-size:13px; transition: background .15s ease; }
        #tv-modal .tv-btn:hover:not(:disabled) { background:#34364a; }
        #tv-modal .tv-btn:disabled { opacity:0.35; cursor:not-allowed; }
        #tv-modal .tv-btn.primary { background:var(--gold); color:#1a1400; border-color:var(--gold); font-weight:600; }
        #tv-modal .tv-btn.primary:hover:not(:disabled) { background:#e6c250; }
        #tv-modal .tv-card { display:inline-flex; align-items:center; justify-content:center; width:46px; height:64px;
            border-radius:6px; background:#22232f; border:1px solid #3a3b4a; font-weight:700; font-size:15px;
            cursor:pointer; user-select:none; transition: transform .1s ease, border-color .1s ease; }
        #tv-modal .tv-card:hover:not(.disabled) { transform: translateY(-4px); border-color: var(--gold); }
        #tv-modal .tv-card.disabled { opacity:0.3; cursor:not-allowed; }
        #tv-modal .tv-card.trump { box-shadow: 0 0 0 2px var(--gold) inset; }
        #tv-modal .tv-log { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:11.5px; line-height:1.6; color:#b9b8c8; }
        #tv-modal .tv-scroll::-webkit-scrollbar { width:8px; }
        #tv-modal .tv-scroll::-webkit-scrollbar-thumb { background:#3a3b4a; border-radius:4px; }
        #tv-modal .tv-seat { border:1px solid var(--line); border-radius:8px; padding:8px 10px; min-width:110px; }
        #tv-modal .tv-seat.active { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
        #tv-modal .tv-marker { display:inline-block; padding:2px 7px; border-radius:10px; font-size:11px; margin-inline-start:4px; }
        #tv-modal .tv-marker.on { background:var(--gold); color:#1a1400; font-weight:700; }
        #tv-modal .tv-marker.off { background:#2a2b38; color:var(--muted); }
    `;
    document.head.appendChild(style);
}

function cardHtml(card, extraClass = '', dataAttrs = '') {
    const color = SUIT_COLOR[card.suit] || '#cfd2e3';
    const interactive = dataAttrs.includes('data-card=');
    const tag = interactive ? 'button' : 'span';
    return `<${tag} class="tv-card ${extraClass}" style="color:${color};" ${interactive ? `type="button" aria-label="${escapeHtml(cardDisplay(card))}" aria-pressed="false" ${extraClass.includes('disabled') ? 'disabled' : ''}` : ''} ${dataAttrs}>${escapeHtml(cardDisplay(card))}</${tag}>`;
}

function renderSetupScreen(root, onStart) {
    root.innerHTML = `
        <header class="game-heading"><div><p class="play-eyebrow">THE ROADSIDE CARD TABLE</p><h2>Toll &amp; Veil</h2></div><button class="tv-btn" id="tv-setup-close">Back to games</button></header>
        <p class="game-intro">Read your hand. Name your price. Win the tricks you promised.</p>
        <p>Choose your table size, then start a match.</p>
        <fieldset class="tv-story-setup"><legend>What is on the table?</legend>
            <label for="tv-story-risk">Story stakes</label>
            <select id="tv-story-risk"><option value="none">Points only — no story debt</option>${Object.entries(STORY_STAKES).map(([key,s])=>`<option value="${key}">${s.label}</option>`).join('')}</select>
            <p id="tv-story-promise">No character sheets or XP will be changed.</p>
            <p>Agree with everyone before starting. Computer seats are practice opponents, not parties to player debts.</p>
        </fieldset>
        <div style="display:flex; gap:8px; justify-content:center; margin-bottom:14px;">
            <button class="tv-btn primary" id="tv-mode-passplay" data-i18n="feature.kon-reh.toll-and-veil.passPlay">👥 Pass & Play</button>
            <button class="tv-btn" id="tv-mode-vsai" data-i18n="feature.kon-reh.toll-and-veil.soloVsAI">🤖 Solo vs AI</button>
        </div>
        <div style="display:flex; align-items:center; gap:8px; justify-content:center; margin-bottom:14px; font-size:13px; color:var(--muted); flex-wrap:wrap;">
            <span>Seats:</span>
            <div id="tv-seat-count-row" style="display:flex; gap:6px;">
                ${[3, 4, 5].map(n => `<button class="tv-btn ${n === 3 ? 'primary' : ''}" aria-pressed="${n === 3}" data-seats="${n}">${n} seats</button>`).join('')}
            </div>
        </div>
        <p style="text-align:center; color:var(--text3, var(--muted)); font-size:12px; max-width:420px; margin:0 auto;">
            3–5 seats, 10 tricks a hand, bids 0–5. Trump breaks like Spades. Cut (+1 value, never on an Ace)
            and Leap (bypass trump-breaking once) are one-time markers each hand — spend both and you're
            <b>Rooted</b>: the next trick you win, you must pass the lead. First to the target score wins.
        </p>
    `;
    root.querySelector('#tv-setup-close').onclick = closeTollVeilModal;
    let seats = 3;
    root.querySelectorAll('#tv-seat-count-row button').forEach(btn => {
        btn.onclick = () => {
            seats = parseInt(btn.dataset.seats, 10);
            root.querySelectorAll('#tv-seat-count-row button').forEach(b => b.className = 'tv-btn');
            btn.className = 'tv-btn primary';
            root.querySelectorAll('[data-seats]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        };
    });
    const risk = root.querySelector('#tv-story-risk');
    const stakes = () => risk.value === 'none' ? {mode:'points'} : {mode:'string', storyRisk:risk.value};
    risk.onchange = () => { root.querySelector('#tv-story-promise').textContent = risk.value === 'none' ? 'No character sheets or XP will be changed.' : storyPromise(stakes()); };
    root.querySelector('#tv-mode-passplay').onclick = () => onStart({ seats, aiSeats: [], stakeConfig: stakes() });
    root.querySelector('#tv-mode-vsai').onclick = () => onStart({ seats, aiSeats: Array.from({ length: seats - 1 }, (_, i) => i + 1), stakeConfig: stakes() });
}

let outcomeShownFor = null; // controller whose game-over we've already announced

// Victory / Defeat overlay, once per finished game. Seated players get a
// personal result; spectators / GM-run tables (localSeat == null) get a
// neutral "<name> wins".
function maybeShowOutcome(controller, view) {
    if (view.phase !== 'game_over' || view.gameWinner == null) {
        if (outcomeShownFor === controller) { outcomeShownFor = null; hideOutcomeOverlay(); }
        return;
    }
    if (outcomeShownFor === controller) return;
    outcomeShownFor = controller;

    const me = controller.localSeat;
    const seatLabel = s => controller.seatNames[s] || `Seat ${s + 1}`;
    const winnerLabel = seatLabel(view.gameWinner);
    const scores = view.scores || [];
    const ranking = scores.map((sc, s) => ({ s, sc })).sort((a, b) => b.sc - a.sc)
        .map(r => `${r.s === me && !controller.passPlay ? 'You' : seatLabel(r.s)}: ${r.sc}`).join(' · ');
    const details = ranking ? `Final scores — ${ranking}` : '';

    let result, title, subtitle;
    if (me == null || controller.passPlay) {
        result = 'neutral'; title = `${winnerLabel} Wins`; subtitle = `First to ${view.winningScore} points.`;
    } else if (view.gameWinner === me) {
        result = 'win'; title = 'Victory'; subtitle = `You reached ${view.winningScore} points first.`;
    } else {
        result = 'lose'; title = 'Defeat'; subtitle = `${winnerLabel} reached ${view.winningScore} points first.`;
    }
    const buttons = [
        ...(controller.requestNewGame ? [{ label: 'Play Again', primary: true, onClick: () => controller.requestNewGame() }] : []),
        { label: 'Back to games', onClick: closeTollVeilModal },
    ];
    showOutcomeOverlay({ result, title, subtitle, details, buttons, game: 'Toll & Veil',
        stats: [{label:'Winning score',value:scores[view.gameWinner]},{label:'Target',value:view.winningScore}],
        story: storySettlement(view, controller.stakeConfig, controller.seatNames, controller.humanSeats),
    });
}

function renderGame(root, controller, closeFn) {
    const view = controller.getView();
    const mySeat = controller.localSeat;
    const isMyTurn = view.currentSeat === mySeat;
    const seatName = seat => escapeHtml(controller.seatNames[seat] || `Seat ${seat + 1}`);
    if (view.needsHandoff) {
        root.innerHTML = `<header class="game-heading"><h2>Toll &amp; Veil</h2><button class="tv-btn" id="tv-close">Leave table</button></header>
            <section class="tv-handoff"><p class="play-eyebrow">PASS THE DEVICE</p><div class="tv-card-back" aria-hidden="true">♠</div>
            <h3>${seatName(mySeat)}, your turn</h3><p>Other hands are hidden. Reveal your cards when you are ready.</p>
            <button class="tv-btn primary" id="tv-reveal">Reveal my hand</button></section>`;
        root.querySelector('#tv-close').onclick = closeFn;
        root.querySelector('#tv-reveal').onclick = () => controller.revealHand();
        root.querySelector('#tv-reveal').focus();
        return;
    }
    const stakeLabel = { points: 'Points only', xp: `XP wager (cap ${controller.stakeConfig?.xpCap ?? '?'})`, string: 'String (narrative debt)' }[controller.stakeConfig?.mode] || 'Points only';

    const seatRow = Array.from({ length: view.numSeats }, (_, i) => {
        const name = seatName(i);
        const bidEntry = view.bids.find(b => b.seat === i);
        const markers = view.markerUsed[i] || { cut: false, leap: false };
        return `
            <div class="tv-seat ${view.currentSeat === i && view.phase !== 'game_over' ? 'active' : ''}">
                <div style="font-weight:700; color:${i === mySeat ? 'var(--gold)' : 'var(--ink)'};">${name}${view.dealerIndex === i ? ' 🃏' : ''}</div>
                <div style="font-size:12px; color:var(--muted);">Score: <b style="color:var(--ink);">${view.scores[i]}</b></div>
                <div style="font-size:12px; color:var(--muted);">Bid: ${bidEntry ? bidEntry.bid : '—'} · Tricks: ${view.tricksWon[i] ?? 0}</div>
                <div style="margin-top:4px;">
                    <span class="tv-marker ${markers.cut ? 'off' : 'on'}">Cut ${markers.cut ? 'spent' : 'ready'}</span>
                    <span class="tv-marker ${markers.leap ? 'off' : 'on'}">Leap ${markers.leap ? 'spent' : 'ready'}</span>
                </div>
            </div>
        `;
    }).join('');

    const trickRow = view.currentTrick.map(p => `
        <div style="text-align:center;">
            ${cardHtml(p.card, p.card.suit === view.trump ? 'trump' : '')}
            <div style="font-size:12px; color:var(--muted); margin-top:6px;">${seatName(p.seat)}${p.cut ? ' · Cut' : ''}${p.leap ? ' · Leap' : ''}</div>
        </div>
    `).join('');

    let phasePanel = '';
    if (view.phase === 'bidding') {
        const isLastBidder = view.bids.length === view.numSeats - 1;
        const sumSoFar = view.bids.reduce((s, b) => s + b.bid, 0);
        const options = Array.from({ length: MAX_BID + 1 }, (_, n) => n);
        phasePanel = `
            <div style="text-align:center; margin-top:10px;">
                <div style="color:var(--muted); font-size:13px; margin-bottom:6px;">
                    ${isMyTurn ? "Your bid — how many of this hand's tricks will you take?" : `Waiting on ${seatName(view.currentSeat)}…`}
                </div>
                <div class="tv-hand" aria-label="Your hand for bidding">${view.myHand.map(c => cardHtml(c, c.suit === view.trump ? 'trump' : '')).join('')}</div>
                <p>Trump: <b>${escapeHtml(view.trump)}</b> · ${isLastBidder ? 'Dealer: total bids cannot equal 10.' : 'Bid 0–5. Meeting or beating your bid scores points.'}</p>
                <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                    ${options.map(n => {
                        const illegal = controller.canBid() && isLastBidder && (sumSoFar + n === TRICKS_PER_HAND);
                        return `<button class="tv-btn ${controller.canBid() && !illegal ? '' : ''}" data-bid="${n}" ${controller.canBid() && !illegal ? '' : 'disabled'}>${n}</button>`;
                    }).join('')}
                </div>
            </div>
        `;
    } else if (view.phase === 'playing') {
        const legal = controller.canPlay() ? legalPlaysForSeat({ ...view, hands: { [mySeat]: view.myHand } }, mySeat) : [];
        const legalMap = legal ? new Map(legal.map(o => [o.card.rank + o.card.suit, o])) : null;
        phasePanel = `
            <div style="margin-top:10px;">
                <div style="color:var(--muted); font-size:13px; text-align:center; margin-bottom:6px;">
                    ${isMyTurn ? 'Choose a card, then confirm your play.' : `Waiting on ${seatName(view.currentSeat)}…`}
                    Trump: <b style="color:var(--gold);">${view.trump}</b> (${view.trumpFamily})${view.trumpBroken ? ' — broken' : ''}
                </div>
                <div style="display:flex; gap:6px; justify-content:center; align-items:center; margin-bottom:8px;">
                    <label style="font-size:12px; color:var(--muted); display:flex; align-items:center; gap:4px;">
                        <input type="checkbox" id="tv-use-cut" ${!controller.canPlay() || view.markerUsed[mySeat]?.cut ? 'disabled' : ''}> Cut (+1, no Aces)
                    </label>
                    <label style="font-size:12px; color:var(--muted); display:flex; align-items:center; gap:4px;">
                        <input type="checkbox" id="tv-use-leap" ${!controller.canPlay() || view.markerUsed[mySeat]?.leap ? 'disabled' : ''}> Leap (play trump early)
                    </label>
                </div>
                <div class="tv-hand" aria-label="Your hand">
                    ${view.myHand.map(c => {
                        const key = c.rank + c.suit;
                        const isLegal = controller.canPlay() && (!legalMap || legalMap.has(key));
                        return cardHtml(c, `${c.suit === view.trump ? 'trump' : ''} ${isLegal ? '' : 'disabled'}`, `data-card="${escapeHtml(c.id)}" data-needs-leap="${!!legalMap?.get(key)?.needsLeap}"`);
                    }).join('')}
                </div>
                <p id="tv-feedback" role="status">${view.leadSuit ? `Follow ${escapeHtml(view.leadSuit)} if you can.` : 'You may lead any legal card.'} Gold outlines mark trump.</p>
                <button class="tv-btn primary" id="tv-confirm" disabled>Choose a card</button>
            </div>
        `;
    } else if (view.phase === 'game_over') {
        const winnerName = seatName(view.gameWinner);
        phasePanel = `
            <div style="text-align:center; margin-top:14px;">
                <div style="font-size:18px; color:var(--gold); font-weight:700;">🏆 ${winnerName} wins!</div>
                <div style="font-size:12px; color:var(--muted); margin-top:4px;">Stakes: ${stakeLabel}</div>
                ${controller.requestNewGame ? '<button class="tv-btn primary" id="tv-new-game" style="margin-top:10px;">Play Again</button>' : ''}
            </div>
        `;
    }

    root.innerHTML = `
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div>
                <h2 style="color:var(--gold); margin:0; font-size:20px; letter-spacing:0.02em;" data-i18n="feature.kon-reh.toll-and-veil.tollVeil">Toll & Veil</h2>
                <span style="color:var(--muted); font-size:12px;">${view.phase === 'bidding' ? 'Bidding' : `Trick ${Math.min(TRICKS_PER_HAND, view.trickNumber)} / ${TRICKS_PER_HAND}`} · Target: ${view.winningScore} points · ${stakeLabel}</span>
            </div>
            <button class="tv-btn" id="tv-close">Leave table</button>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:10px;">${seatRow}</div>
        <div class="tv-table" aria-label="Current trick">
            ${trickRow || '<span style="color:var(--muted); font-size:12px;">No cards played yet this trick.</span>'}
        </div>
        ${phasePanel}
        ${controller.stakeConfig?.mode === 'string' ? `<aside class="tv-story"><h3>The promise at stake</h3><p>${escapeHtml(storyPromise(controller.stakeConfig))}</p><p>${escapeHtml(view.phase === 'game_over' ? storySettlement(view,controller.stakeConfig,controller.seatNames,controller.humanSeats) : storyMoment(view,mySeat))}</p><small>Optional fiction, never a new scoring rule. Agree before carrying it into your campaign.</small></aside>` : ''}
        ${view.lastHandSummary?.length ? `<details class="tv-history"><summary>Last hand · bids, risks &amp; consequences</summary>${view.lastHandSummary.map(row=>`<p><b>${seatName(row.seat)}</b>: bid ${escapeHtml(row.bid)}, took ${escapeHtml(row.tricks)} · ${row.score >= 0 ? '+' : ''}${escapeHtml(row.score)} points${row.perfectVeil ? ' · Perfect Veil: a secret kept' : ''}${row.cross ? ' · Cross: a turning point claimed' : ''}${row.cut && row.leap ? ' · Both markers spent: overcommitted' : ''}</p>`).join('')}<small>Story labels are prompts, not extra rewards or penalties.</small></details>` : ''}
        <details class="tv-history"><summary>Table log &amp; recent tricks</summary><div class="tv-scroll tv-log">
            ${(view.log || []).slice(-30).map(l => `<div>${escapeHtml(l.msg)}</div>`).join('')}
        </div></details>
    `;

    root.querySelector('#tv-close').onclick = closeFn;
    maybeShowOutcome(controller, view);
    if (controller.canBid()) {
        root.querySelectorAll('[data-bid]').forEach(btn => {
            btn.onclick = () => controller.bid(parseInt(btn.dataset.bid, 10));
        });
    }
    if (controller.canPlay()) {
        let selectedCard = null;
        root.querySelectorAll('[data-card]').forEach(cardEl => {
            if (cardEl.classList.contains('disabled')) return;
            cardEl.onclick = () => {
                selectedCard = cardEl.dataset.card;
                root.querySelectorAll('[data-card]').forEach(el => el.setAttribute('aria-pressed', String(el === cardEl)));
                const selected = view.myHand.find(c => c.id === selectedCard);
                const cutBox = root.querySelector('#tv-use-cut');
                cutBox.disabled = !!view.markerUsed[mySeat]?.cut || selected.value === ACE_VALUE;
                if (cutBox.disabled) cutBox.checked = false;
                root.querySelector('#tv-use-leap').checked = cardEl.dataset.needsLeap === 'true';
                root.querySelector('#tv-feedback').textContent = cardEl.dataset.needsLeap === 'true' ? 'This play needs Leap. It is selected and will be spent when you confirm.' : 'Card selected. Add an available marker or confirm your play.';
                const confirm = root.querySelector('#tv-confirm');
                confirm.disabled = false;
                confirm.textContent = `Play ${cardDisplay(selected)}`;
            };
        });
        root.querySelector('#tv-confirm').onclick = () => {
            if (!selectedCard) return;
            const result = controller.play(selectedCard, { cut: root.querySelector('#tv-use-cut').checked, leap: root.querySelector('#tv-use-leap').checked });
            if (result?.ok === false) root.querySelector('#tv-feedback').textContent = `Cannot play: ${String(result.reason).replaceAll('-', ' ')}. Choose again.`;
        };
    }
    const newGameBtn = root.querySelector('#tv-new-game');
    if (newGameBtn) newGameBtn.onclick = () => controller.requestNewGame();
}

/**
 * Opens the Toll & Veil modal.
 *
 * @param {Object} [config]
 * @param {Object} [config.controller] - Pre-built controller (connected mode).
 *   If omitted, a local hot-seat/vs-AI setup screen is shown first.
 * @param {number} [config.winningScore]
 * @returns {{ destroy: Function }}
 */
export function openTollVeilModal(config = {}) {
    closeTollVeilModal();
    injectStyle();

    modalEl = document.createElement('div');
    modalEl.id = 'tv-modal';
    modalEl.className = 'editor-screen-host';
    modalEl.style.cssText = `
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px 0;
    `;
    const content = document.createElement('div');
    content.className = 'tv-game-content';
    content.style.cssText = `
        background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
        padding: 20px; max-width: 720px; width: 100%; color: var(--ink);
        box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-height: 92vh; overflow: auto;
    `;
    modalEl.appendChild(content);

    // .editor-screen-host is a flex ITEM meant to live inside #app-content's
    // own flex row (see css/app.css's "Inline editor screens" section) —
    // it has no useful effect appended anywhere else (e.g. document.body),
    // where it just renders with no real size/position. Mount it exactly
    // the way ../kon-reh/index.js's openKonrehModal() does: as a child of
    // #app-content, with that container's other children hidden while the
    // modal is up and restored on close.
    const host = document.getElementById('app-content') || document.body;
    hiddenSiblings = Array.from(host.children);
    hiddenSiblings.forEach(ch => { ch.style.display = 'none'; });
    host.appendChild(modalEl);

    function mountController(controller) {
        activeController = controller;
        const rerender = () => renderGame(content, controller, closeTollVeilModal);
        unsubscribe = controller.onChange(rerender);
        rerender();
    }

    if (config.controller) {
        mountController(config.controller);
    } else {
        renderSetupScreen(content, ({ seats, aiSeats, stakeConfig }) => {
            const controller = createLocalController({
                numSeats: seats,
                aiSeats,
                winningScore: config.winningScore,
                localSeat: 0,
                stakeConfig,
            });
            mountController(controller);
        });
    }

    return { destroy: closeTollVeilModal };
}

export function closeTollVeilModal() {
    hideOutcomeOverlay();
    outcomeShownFor = null;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (activeController && activeController.destroy) activeController.destroy();
    activeController = null;
    if (modalEl) { modalEl.remove(); modalEl = null; }
    if (hiddenSiblings) {
        hiddenSiblings.forEach(ch => { ch.style.display = ''; });
        hiddenSiblings = null;
    }
}

export function isTollVeilModalOpen() {
    return !!modalEl;
}
