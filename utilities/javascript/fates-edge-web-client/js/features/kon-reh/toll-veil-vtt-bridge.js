// ============================================================
//  TOLL & VEIL — VTT Bridge (lobby: host a table, join, start)
// ============================================================
//
// Wires toll-and-veil-connected.js's host/guest controllers onto the
// VTT's existing generic 'event' relay (core/websocket.js's
// sendEvent/onEvent) — same no-server-changes approach as
// ../kon-reh/vtt-bridge.js. Unlike Kon'reh's straight 1-vs-1 challenge,
// Toll & Veil needs a multi-seat LOBBY first: the host opens a table
// (3-5 seats, stake mode), other connected players see a banner and
// can join a seat, and the host starts whenever ready — any seats
// nobody claimed are filled by AI.
//
// WIRE FORMAT
// -----------
//   { ns: 'tollveil', sub: <type>, socketId, ...extra }
//
// Lobby-only types: 'table-open', 'table-join', 'table-roster',
// 'table-cancel', 'table-start'. Everything else (`public`, `hand`,
// `bid`, `play`, `sync-request`, `stake-transfer`, `stake-string`) is
// real game protocol traffic, handed straight to whichever
// host/guest controller is currently live (see toll-and-veil-connected.js).

import { t as i18nText } from '@core/i18n.js';
import { sendEvent, onEvent, getSocketId, isConnectedToServer } from '@core/websocket.js';
import { createTollVeilHost, createTollVeilGuest } from './toll-and-veil-connected.js';
import { openTollVeilModal, closeTollVeilModal } from './toll-and-veil.js';
import { escHtml } from '@core/utils.js';

const NS = 'tollveil';

let bridgeInitialized = false;
let lobbyState = null;   // { hosting, numSeats, stakeConfig, hostSocketId, hostName, seats: { [seatIndex]: {socketId, name} } }
let lobbyBanner = null;
let activeHost = null;   // createTollVeilHost() handle
let activeGuest = null;  // createTollVeilGuest() handle
let tableActive = false;

function send(sub, extra = {}) {
    sendEvent({ ns: NS, sub, socketId: getSocketId(), ...extra });
}

function transport() {
    return { send(message) { send(message.t, { payload: message }); } };
}

function postToVTTChat(text) {
    import('@features/vtt/index.js')
        .then(module => {
            if (module.addChatMessage && typeof module.addChatMessage === 'function') {
                module.addChatMessage({ text, sender: 'Toll & Veil', system: true });
            } else if (module.sendMessage && typeof module.sendMessage === 'function') {
                module.sendMessage(text, 'Toll & Veil', 'all', { system: true });
            }
        })
        .catch(err => console.debug('[Toll & Veil] VTT chat bridge skipped:', err?.message));
}

function removeLobbyBanner() {
    if (lobbyBanner) { lobbyBanner.remove(); lobbyBanner = null; }
}

// SECURITY FIX: normalizes an incoming, network-supplied stakeConfig into
// one of the three known shapes, instead of trusting whatever an attacker
// broadcasts in a 'table-open' event. Without this, a malicious 'table-open'
// could set stakeConfig.mode to an arbitrary string (rendered directly into
// the lobby banner's label lookup — harmless there since it's a plain
// object-key miss, but every downstream consumer of stakeConfig.mode
// branches on it with `===` checks, so an unrecognized value should
// deterministically fall back to the safe 'points' default rather than
// propagate an unvalidated shape through the host/guest controllers).
function sanitizeStakeConfig(raw) {
    const mode = ['points', 'xp', 'string'].includes(raw?.mode) ? raw.mode : 'points';
    const xpCapNum = Number(raw?.xpCap);
    const xpCap = mode === 'xp' ? Math.min(50, Math.max(1, Number.isFinite(xpCapNum) ? Math.floor(xpCapNum) : 1)) : undefined;
    return xpCap !== undefined ? { mode, xpCap } : { mode };
}

// SECURITY FIX: clamps a network-supplied seat count into the engine's
// actual supported range, rather than trusting an attacker's 'table-open'
// numSeats verbatim (which otherwise flows straight into
// createTollVeilHost()/TollVeilEngine's seat-count math on whoever accepts
// the table).
function sanitizeNumSeats(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 3;
    return Math.min(5, Math.max(3, Math.floor(n)));
}

// SECURITY FIX: a display name arriving over the network (table-open's
// hostName, table-join's name) is later escaped before it's ever put into
// innerHTML (see renderLobbyBanner()), but it's still worth capping length
// here so a hostile client can't blow up the banner/roster UI with a
// multi-megabyte string.
function sanitizeDisplayName(raw, fallback) {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!s) return fallback;
    return s.slice(0, 60);
}

function teardownMatch() {
    if (activeHost) { try { activeHost.destroy(); } catch (e) { /* ignore */ } }
    if (activeGuest) { try { activeGuest.destroy(); } catch (e) { /* ignore */ } }
    activeHost = null;
    activeGuest = null;
    tableActive = false;
    closeTollVeilModal();
}

function renderLobbyBanner() {
    removeLobbyBanner();
    if (!lobbyState) return;

    const iAmHost = lobbyState.hostSocketId === getSocketId();
    const seatEntries = Object.entries(lobbyState.seats);
    const iAmSeated = seatEntries.some(([, info]) => info.socketId === getSocketId());
    // SECURITY FIX: hostName and each seat's display name arrive over the
    // network (an attacker-controlled 'table-open'/'table-join' event can
    // put literally anything in these fields, including HTML/script) and
    // used to be interpolated straight into innerHTML below — a stored XSS
    // reachable by anyone in the same VTT room. Escape before display.
    const seatsLabel = seatEntries.map(([seat, info]) => `Seat ${parseInt(seat, 10) + 1}: ${escHtml(info.name)}`).join(' · ') || 'No one seated yet';
    const stakeLabel = { points: 'Points only', xp: `XP wager (cap ${lobbyState.stakeConfig.xpCap ?? '?'})`, string: 'String debts' }[lobbyState.stakeConfig.mode] || 'Points only';

    const el = document.createElement('div');
    el.id = 'tollveil-lobby-banner';
    el.style.cssText = `
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%); /* rtl-physical: viewport centering */
        z-index: 10001; background: #1b1c26; border: 1px solid #d4af37;
        border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;
        color: #e8e6df; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 420px;
    `;
    el.innerHTML = `
        <div><b>${escHtml(lobbyState.hostName || 'A player')}</b> is hosting Toll &amp; Veil (${lobbyState.numSeats} seats · ${stakeLabel})</div>
        <div style="color:#9a9aa8; font-size:12px;">${seatsLabel}</div>
        <div style="display:flex; gap:8px;">
            ${iAmHost ? '<button id="tv-lobby-start" style="background:#d4af37;color:#1a1400;border:none;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer;">Start Game</button>' : ''}
            ${!iAmHost && !iAmSeated ? '<button id="tv-lobby-join" style="background:#d4af37;color:#1a1400;border:none;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer;">Join Table</button>' : ''}
            <button id="tv-lobby-dismiss" style="background:#2a2b38;color:#e8e6df;border:1px solid #3a3b4a;border-radius:6px;padding:6px 12px;cursor:pointer;">${iAmHost ? 'Cancel' : 'Dismiss'}</button>
        </div>
    `;
    document.body.appendChild(el);
    lobbyBanner = el;

    el.querySelector('#tv-lobby-start')?.addEventListener('click', () => startTable());
    el.querySelector('#tv-lobby-join')?.addEventListener('click', () => {
        const name = window.prompt(i18nText("feature.kon-reh.toll-veil-vtt-bridge.joinAs", null, "Join as:"), 'Player') || 'Player';
        send('table-join', { name });
    });
    el.querySelector('#tv-lobby-dismiss')?.addEventListener('click', () => {
        if (iAmHost) send('table-cancel');
        lobbyState = null;
        removeLobbyBanner();
    });
}

function assignSeat(socketId, name) {
    if (!lobbyState || lobbyState.hostSocketId !== getSocketId()) return;
    const taken = new Set(Object.values(lobbyState.seats).map(s => s.socketId));
    if (taken.has(socketId)) return;
    let seatIdx = null;
    for (let i = 0; i < lobbyState.numSeats; i++) {
        if (!lobbyState.seats[i]) { seatIdx = i; break; }
    }
    if (seatIdx === null) return; // table full
    lobbyState.seats[seatIdx] = { socketId, name };
    send('table-roster', { hostSocketId: getSocketId(), seats: lobbyState.seats });
    renderLobbyBanner();
}

function startTable() {
    if (!lobbyState || lobbyState.hostSocketId !== getSocketId()) return;
    const seatIds = {};
    for (const [seat, info] of Object.entries(lobbyState.seats)) seatIds[seat] = info.socketId;
    const hostEntry = Object.entries(lobbyState.seats).find(([, info]) => info.socketId === getSocketId());
    const localSeat = hostEntry ? parseInt(hostEntry[0], 10) : null;
    const { numSeats, stakeConfig } = lobbyState;

    removeLobbyBanner();
    tableActive = true;
    activeHost = createTollVeilHost(transport(), { numSeats, localSeat, seatIds, stakeConfig, postChat: postToVTTChat });
    send('table-start', { seatIds, stakeConfig, numSeats, hostSocketId: getSocketId() });
    postToVTTChat(`🃏 ${lobbyState.hostName || 'The host'} started a game of Toll & Veil (${numSeats} seats · ${{ points: 'points only', xp: 'XP wager', string: 'String debts' }[stakeConfig.mode] || 'points only'}).`);
    openTollVeilModal({ controller: activeHost.controller });
    lobbyState = null;
}

/**
 * Wires the bridge's incoming-event listener. Safe to call more than
 * once (only attaches once) — call at module load from the Whiteboard
 * UI, same as initKonrehVttBridge().
 */
export function initTollVeilVttBridge() {
    if (bridgeInitialized) return;
    bridgeInitialized = true;

    onEvent('event', (data) => {
        if (!data || data.ns !== NS) return;

        switch (data.sub) {
            case 'table-open': {
                if (data.socketId === getSocketId()) return;
                if (tableActive || lobbyState) return; // already in/hosting something
                lobbyState = {
                    hosting: false,
                    numSeats: sanitizeNumSeats(data.numSeats),
                    stakeConfig: sanitizeStakeConfig(data.stakeConfig),
                    hostSocketId: data.socketId,
                    hostName: sanitizeDisplayName(data.hostName, 'A player'),
                    seats: data.seats || {},
                };
                renderLobbyBanner();
                return;
            }
            case 'table-cancel': {
                if (lobbyState && data.socketId === lobbyState.hostSocketId) {
                    lobbyState = null;
                    removeLobbyBanner();
                }
                return;
            }
            case 'table-join': {
                assignSeat(data.socketId, sanitizeDisplayName(data.name, 'Player'));
                return;
            }
            case 'table-roster': {
                if (!lobbyState || data.hostSocketId !== lobbyState.hostSocketId) return;
                lobbyState.seats = data.seats;
                renderLobbyBanner();
                return;
            }
            case 'table-start': {
                if (data.socketId === getSocketId()) return; // host already opened its own modal directly
                const mySeatEntry = Object.entries(data.seatIds || {}).find(([, id]) => id === getSocketId());
                lobbyState = null;
                removeLobbyBanner();
                if (!mySeatEntry) return; // wasn't seated — table starts without us
                tableActive = true;
                const mySeat = parseInt(mySeatEntry[0], 10);
                activeGuest = createTollVeilGuest(transport(), {
                    mySeat,
                    myId: getSocketId(),
                    stakeConfig: sanitizeStakeConfig(data.stakeConfig),
                    // SECURITY: the host we actually joined, per the server-
                    // stamped socketId on this table-start broadcast (not
                    // anything the message payload itself might claim) — the
                    // guest controller uses this to refuse stake-transfer/
                    // stake-string messages that don't actually come from
                    // this table's real host. See createTollVeilGuest().
                    hostSocketId: data.socketId,
                });
                openTollVeilModal({ controller: activeGuest.controller });
                return;
            }
            default: {
                // Real game protocol traffic (public/hand/bid/play/sync-request/stake-*).
                if (data.socketId === getSocketId()) return;
                // SECURITY FIX: `data.payload.fromId` (if present) is
                // whatever the SENDING client's own createTollVeilGuest()
                // put there — self-reported, not verified. `data.socketId`,
                // by contrast, is now stamped by the socket server itself
                // (see ws-handlers.js/socketio-handlers.js's matching fix)
                // and can't be forged by the sender. Pass it through as
                // `fromSocketId` and have the host controller's seat-
                // ownership check use *that*, not the self-reported field —
                // otherwise any guest could claim any seat by simply setting
                // `fromId` in their own outgoing message to someone else's id.
                const msg = { t: data.sub, ...(data.payload || {}), fromSocketId: data.socketId };
                if (activeHost) activeHost.receive(msg);
                else if (activeGuest) activeGuest.receive(msg);
                return;
            }
        }
    });
}

/**
 * Opens a Toll & Veil table as host and broadcasts an invite to the room.
 *
 * @param {Object} options
 * @param {string} options.hostName
 * @param {number} [options.numSeats=3]
 * @param {boolean} [options.hostPlays=true] - false to GM-run a spectated table.
 * @param {{mode: 'points'|'xp'|'string', xpCap?: number}} [options.stakeConfig]
 * @returns {boolean} false if not connected or already in/hosting a table.
 */
export function openTollVeilTable(options = {}) {
    const { hostName: rawHostName = 'A player', numSeats: rawNumSeats = 3, hostPlays = true, stakeConfig: rawStakeConfig = { mode: 'points' } } = options;
    if (!isConnectedToServer() || tableActive || lobbyState) return false;

    const hostName = sanitizeDisplayName(rawHostName, 'A player');
    const numSeats = sanitizeNumSeats(rawNumSeats);
    const stakeConfig = sanitizeStakeConfig(rawStakeConfig);

    lobbyState = { hosting: true, numSeats, stakeConfig, hostSocketId: getSocketId(), hostName, seats: {} };
    if (hostPlays) lobbyState.seats[0] = { socketId: getSocketId(), name: hostName };
    send('table-open', { numSeats, stakeConfig, hostName, seats: lobbyState.seats });
    renderLobbyBanner();
    return true;
}

export function isTollVeilTableActive() {
    return tableActive || !!lobbyState;
}

export function endTollVeilMatch() {
    if (lobbyState && lobbyState.hostSocketId === getSocketId()) send('table-cancel');
    lobbyState = null;
    removeLobbyBanner();
    teardownMatch();
}
