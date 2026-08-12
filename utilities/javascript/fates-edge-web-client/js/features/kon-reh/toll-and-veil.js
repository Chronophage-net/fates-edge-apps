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

import {
    TollVeilEngine, aiChooseBid, aiChoosePlay, legalPlaysForSeat,
    MIN_SEATS, MAX_SEATS, cardDisplay, TRICKS_PER_HAND, MAX_BID,
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
        seatNames: Array.from({ length: numSeats }, (_, i) => aiSet.has(i) ? `AI ${i + 1}` : (i === localSeat ? 'You' : `Seat ${i + 1}`)),
        localSeat,
        stakeConfig,
        getView() {
            const pub = engine.getPublicState();
            const myHand = localSeat != null ? engine.getSeatView(localSeat).hand : [];
            return { ...pub, myHand };
        },
        canBid() { return engine.phase === 'bidding' && engine.currentSeat === localSeat && !aiSet.has(localSeat); },
        canPlay() { return engine.phase === 'playing' && engine.currentSeat === localSeat && !aiSet.has(localSeat); },
        legalIds() {
            if (engine.phase !== 'playing') return null;
            return legalPlaysForSeat(engine, localSeat);
        },
        bid(n) { return engine.makeBid(localSeat, n); },
        play(id, markers) { return engine.playCard(localSeat, id, markers); },
        requestNewGame() { engine.dealerIndex = (engine.dealerIndex + 1) % engine.numSeats; engine.scores = new Array(engine.numSeats).fill(0); engine.gameWinner = null; engine.startHand(); },
        onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
        destroy() { clearTimeout(aiTimer); listeners.clear(); engine.onUpdate = null; },
        _engine: engine, // exposed for connected-mode host reuse only
    };
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
        #tv-modal .tv-marker { display:inline-block; padding:2px 7px; border-radius:10px; font-size:11px; margin-left:4px; }
        #tv-modal .tv-marker.on { background:var(--gold); color:#1a1400; font-weight:700; }
        #tv-modal .tv-marker.off { background:#2a2b38; color:var(--muted); }
    `;
    document.head.appendChild(style);
}

function cardHtml(card, extraClass = '', dataAttrs = '') {
    const color = SUIT_COLOR[card.suit] || '#cfd2e3';
    return `<div class="tv-card ${extraClass}" style="color:${color};" ${dataAttrs}>${cardDisplay(card)}</div>`;
}

function renderSetupScreen(root, onStart) {
    root.innerHTML = `
        <div style="text-align:center; color:var(--muted); font-size:13px; margin-bottom:10px;">Choose how to play.</div>
        <div style="display:flex; gap:8px; justify-content:center; margin-bottom:14px;">
            <button class="tv-btn primary" id="tv-mode-passplay">👥 Pass &amp; Play</button>
            <button class="tv-btn" id="tv-mode-vsai">🤖 Solo vs AI</button>
        </div>
        <div style="display:flex; align-items:center; gap:8px; justify-content:center; margin-bottom:14px; font-size:13px; color:var(--muted);">
            <span>Seats:</span>
            <div id="tv-seat-count-row" style="display:flex; gap:6px;">
                ${[3, 4, 5].map(n => `<button class="tv-btn ${n === 3 ? 'primary' : ''}" data-seats="${n}">${n}</button>`).join('')}
            </div>
        </div>
        <p style="text-align:center; color:var(--text3, var(--muted)); font-size:12px; max-width:420px; margin:0 auto;">
            3–5 seats, 10 tricks a hand, bids 0–5. Trump breaks like Spades. Cut (+1 value, never on an Ace)
            and Leap (bypass trump-breaking once) are one-time markers each hand — spend both and you're
            <b>Rooted</b>: the next trick you win, you must pass the lead. First to the target score wins.
        </p>
    `;
    let seats = 3;
    root.querySelectorAll('#tv-seat-count-row button').forEach(btn => {
        btn.onclick = () => {
            seats = parseInt(btn.dataset.seats, 10);
            root.querySelectorAll('#tv-seat-count-row button').forEach(b => b.className = 'tv-btn');
            btn.className = 'tv-btn primary';
        };
    });
    root.querySelector('#tv-mode-passplay').onclick = () => onStart({ seats, aiSeats: [] });
    root.querySelector('#tv-mode-vsai').onclick = () => onStart({ seats, aiSeats: Array.from({ length: seats - 1 }, (_, i) => i + 1) });
}

function renderGame(root, controller, closeFn) {
    const view = controller.getView();
    const mySeat = controller.localSeat;
    const isMyTurn = view.currentSeat === mySeat;
    const stakeLabel = { points: 'Points only', xp: `XP wager (cap ${controller.stakeConfig?.xpCap ?? '?'})`, string: 'String (narrative debt)' }[controller.stakeConfig?.mode] || 'Points only';

    const seatRow = Array.from({ length: view.numSeats }, (_, i) => {
        const name = controller.seatNames[i] || `Seat ${i + 1}`;
        const bidEntry = view.bids.find(b => b.seat === i);
        const markers = view.markerUsed[i] || { cut: false, leap: false };
        return `
            <div class="tv-seat ${view.currentSeat === i && view.phase !== 'game_over' ? 'active' : ''}">
                <div style="font-weight:700; color:${i === mySeat ? 'var(--gold)' : 'var(--ink)'};">${name}${view.dealerIndex === i ? ' 🃏' : ''}</div>
                <div style="font-size:12px; color:var(--muted);">Score: <b style="color:var(--ink);">${view.scores[i]}</b></div>
                <div style="font-size:12px; color:var(--muted);">Bid: ${bidEntry ? bidEntry.bid : '—'} · Tricks: ${view.tricksWon[i] ?? 0}</div>
                <div style="margin-top:4px;">
                    <span class="tv-marker ${markers.cut ? 'on' : 'off'}">✂️ Cut</span>
                    <span class="tv-marker ${markers.leap ? 'on' : 'off'}">🦘 Leap</span>
                </div>
            </div>
        `;
    }).join('');

    const trickRow = view.currentTrick.map(p => `
        <div style="text-align:center;">
            ${cardHtml(p.card, p.card.suit === view.trump ? 'trump' : '')}
            <div style="font-size:10px; color:var(--muted); margin-top:2px;">${controller.seatNames[p.seat] || `S${p.seat + 1}`}${p.cut ? ' ✂️' : ''}${p.leap ? ' 🦘' : ''}</div>
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
                    ${isMyTurn ? "Your bid — how many of this hand's tricks will you take?" : `Waiting on ${controller.seatNames[view.currentSeat] || 'seat ' + (view.currentSeat + 1)}…`}
                </div>
                <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                    ${options.map(n => {
                        const illegal = controller.canBid() && isLastBidder && (sumSoFar + n === TRICKS_PER_HAND);
                        return `<button class="tv-btn ${controller.canBid() && !illegal ? '' : ''}" data-bid="${n}" ${controller.canBid() && !illegal ? '' : 'disabled'}>${n}</button>`;
                    }).join('')}
                </div>
            </div>
        `;
    } else if (view.phase === 'playing') {
        const legal = controller.canPlay() ? (controller.legalIds ? controller.legalIds() : null) : null;
        const legalMap = legal ? new Map(legal.map(o => [o.card.rank + o.card.suit, o])) : null;
        phasePanel = `
            <div style="margin-top:10px;">
                <div style="color:var(--muted); font-size:13px; text-align:center; margin-bottom:6px;">
                    ${isMyTurn ? 'Your play.' : `Waiting on ${controller.seatNames[view.currentSeat] || 'seat ' + (view.currentSeat + 1)}…`}
                    Trump: <b style="color:var(--gold);">${view.trump}</b> (${view.trumpFamily})${view.trumpBroken ? ' — broken' : ''}
                </div>
                <div style="display:flex; gap:6px; justify-content:center; align-items:center; margin-bottom:8px;">
                    <label style="font-size:12px; color:var(--muted); display:flex; align-items:center; gap:4px;">
                        <input type="checkbox" id="tv-use-cut"> ✂️ Cut (+1, no Aces)
                    </label>
                    <label style="font-size:12px; color:var(--muted); display:flex; align-items:center; gap:4px;">
                        <input type="checkbox" id="tv-use-leap"> 🦘 Leap (play trump early)
                    </label>
                </div>
                <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                    ${view.myHand.map(c => {
                        const key = c.rank + c.suit;
                        const isLegal = controller.canPlay() && (!legalMap || legalMap.has(key));
                        return cardHtml(c, `${c.suit === view.trump ? 'trump' : ''} ${isLegal ? '' : 'disabled'}`, `data-card="${c.id}"`);
                    }).join('')}
                </div>
            </div>
        `;
    } else if (view.phase === 'game_over') {
        const winnerName = controller.seatNames[view.gameWinner] || `Seat ${view.gameWinner + 1}`;
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
                <h2 style="color:var(--gold); margin:0; font-size:20px; letter-spacing:0.02em;">Toll &amp; Veil</h2>
                <span style="color:var(--muted); font-size:12px;">Target: ${view.winningScore} points · ${stakeLabel}</span>
            </div>
            <button class="tv-btn" id="tv-close">✕</button>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:10px;">${seatRow}</div>
        <div style="min-height:80px; display:flex; gap:14px; justify-content:center; align-items:flex-end; padding:8px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line);">
            ${trickRow || '<span style="color:var(--muted); font-size:12px;">No cards played yet this trick.</span>'}
        </div>
        ${phasePanel}
        <div class="tv-scroll tv-log" style="margin-top:12px; max-height:120px; overflow-y:auto; border-top:1px solid var(--line); padding-top:6px;">
            ${(view.log || []).slice(-30).map(l => `<div>${l.msg}</div>`).join('')}
        </div>
    `;

    root.querySelector('#tv-close').onclick = closeFn;
    if (controller.canBid()) {
        root.querySelectorAll('[data-bid]').forEach(btn => {
            btn.onclick = () => controller.bid(parseInt(btn.dataset.bid, 10));
        });
    }
    if (controller.canPlay()) {
        root.querySelectorAll('[data-card]').forEach(cardEl => {
            if (cardEl.classList.contains('disabled')) return;
            cardEl.onclick = () => {
                const cut = root.querySelector('#tv-use-cut')?.checked;
                const leap = root.querySelector('#tv-use-leap')?.checked;
                controller.play(cardEl.dataset.card, { cut, leap });
            };
        });
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
        renderSetupScreen(content, ({ seats, aiSeats }) => {
            const controller = createLocalController({
                numSeats: seats,
                aiSeats,
                winningScore: config.winningScore,
                localSeat: 0,
            });
            mountController(controller);
        });
    }

    return { destroy: closeTollVeilModal };
}

export function closeTollVeilModal() {
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
