// ============================================================
//  KON'REH — VTT Bridge (NEW)
// ============================================================
//
// Wires kon-reh-connected.js's transport-agnostic connected mode onto
// the VTT's existing generic 'event' relay (core/websocket.js's
// sendEvent/onEvent), so two players already sharing a VTT room can
// challenge each other to a real-time Kon'reh match with one click —
// no server changes needed. The socket server already broadcasts
// arbitrary 'event' payloads to every other client in the room (see
// server/ws-handlers.js's `case 'event':` passthrough and the
// equivalent Socket.IO handler); this module just rides that.
//
// WIRE FORMAT
// -----------
// Every message this module puts on the wire looks like:
//   { ns: 'konreh', sub: <type>, socketId, ...extra }
// `sub` mirrors kon-reh-connected.js's own protocol message `.t` field
// (move / reforge / new-game / sync-request / sync-state) for actual
// game traffic, plus two bridge-only types used purely to negotiate
// who's playing before any game exists yet: 'challenge' and 'cancel'.
//
// PAIRING
// -------
// The challenger opens the connected board immediately as Player 1
// (localPlayer: 1, startFresh: true) and broadcasts a challenge. The
// first other client to accept opens it as Player 2 (startFresh:
// false), which triggers the normal sync-request/sync-state handshake
// already implemented in kon-reh-connected.js. Both sides lock onto
// the first opponent socketId they actually hear from, so a third
// client that also has the Whiteboard open doesn't get mixed in.

import { sendEvent, onEvent, getSocketId, isConnectedToServer } from '../../core/websocket.js';
import { openKonrehModalConnected } from './kon-reh-connected.js';
import { escHtml } from '../../core/utils.js';

const NS = 'konreh';

let activeConnection = null;   // the live openKonrehModalConnected() handle, once a match exists
let opponentSocketId = null;   // whoever we've locked onto as our actual opponent
let hosting = false;           // true while WE have an outstanding challenge out
let bridgeInitialized = false;
let challengeBanner = null;

function send(sub, extra = {}) {
    sendEvent({ ns: NS, sub, socketId: getSocketId(), ...extra });
}

function transport() {
    return {
        send(message) { send(message.t, { payload: message }); },
    };
}

function teardownMatch() {
    if (activeConnection) {
        try { activeConnection.destroy(); } catch (e) { /* ignore */ }
    }
    activeConnection = null;
    opponentSocketId = null;
    hosting = false;
}

function removeChallengeBanner() {
    if (challengeBanner) { challengeBanner.remove(); challengeBanner = null; }
}

// Small self-contained accept/decline banner — deliberately not a full
// modal, since the player may still want to look at the board/chat
// while deciding.
function showChallengeBanner(fromName, onAccept, onDecline) {
    removeChallengeBanner();
    const el = document.createElement('div');
    el.id = 'konreh-challenge-banner';
    el.style.cssText = `
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        z-index: 10001; background: #1b1c26; border: 1px solid #d4af37;
        border-radius: 10px; padding: 12px 16px; display: flex; align-items: center;
        gap: 12px; color: #e8e6df; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;
    el.innerHTML = `
        <span>🌀 <b>${escHtml(fromName)}</b> is challenging you to Kon'reh!</span>
        <button id="konreh-accept-btn" style="background:#d4af37;color:#1a1400;border:none;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer;">Accept</button>
        <button id="konreh-decline-btn" style="background:#2a2b38;color:#e8e6df;border:1px solid #3a3b4a;border-radius:6px;padding:6px 12px;cursor:pointer;">Decline</button>
    `;
    document.body.appendChild(el);
    challengeBanner = el;
    el.querySelector('#konreh-accept-btn').onclick = () => { removeChallengeBanner(); onAccept(); };
    el.querySelector('#konreh-decline-btn').onclick = () => { removeChallengeBanner(); onDecline(); };

    // Auto-dismiss after 30s so a stale banner doesn't linger forever.
    setTimeout(() => { if (challengeBanner === el) { removeChallengeBanner(); } }, 30000);
}

/**
 * Wires the bridge's incoming-event listener. Safe to call more than
 * once (only attaches once) — intended to be called at module load
 * from the Whiteboard UI.
 */
export function initKonrehVttBridge() {
    if (bridgeInitialized) return;
    bridgeInitialized = true;

    onEvent('event', (data) => {
        if (!data || data.ns !== NS) return;
        if (data.socketId === getSocketId()) return; // never react to our own broadcast

        if (data.sub === 'challenge') {
            if (activeConnection || hosting) return; // already playing/hosting — ignore incoming challenges
            showChallengeBanner(
                data.fromName || 'A player',
                () => acceptChallenge(data.socketId),
                () => send('cancel'),
            );
            return;
        }

        if (data.sub === 'cancel') {
            if (data.socketId === opponentSocketId) teardownMatch();
            return;
        }

        // Real Kon'reh protocol traffic (move / reforge / new-game /
        // sync-request / sync-state). Only accepted once we actually have
        // a match open, and only from whichever opponent we've locked
        // onto (the first one we hear from).
        if (!['move', 'reforge', 'new-game', 'sync-request', 'sync-state'].includes(data.sub)) return;
        if (!activeConnection) return;
        if (opponentSocketId && data.socketId !== opponentSocketId) return;
        if (!opponentSocketId) opponentSocketId = data.socketId;
        activeConnection.receive({ t: data.sub, ...(data.payload || {}) });
    });
}

/**
 * Broadcasts a Kon'reh challenge to everyone else in the room and opens
 * the connected board locally as Player 1, waiting for someone to accept.
 * Returns false (and does nothing) if not connected or already in a match.
 */
export function challengeToKonreh(fromName) {
    if (!isConnectedToServer() || activeConnection) return false;
    hosting = true;
    opponentSocketId = null;
    send('challenge', { fromName: fromName || 'A player' });
    activeConnection = openKonrehModalConnected(transport(), { localPlayer: 1, startFresh: true });
    return true;
}

function acceptChallenge(challengerSocketId) {
    if (activeConnection) return;
    opponentSocketId = challengerSocketId;
    activeConnection = openKonrehModalConnected(transport(), { localPlayer: 2, startFresh: false });
}

export function isKonrehMatchActive() {
    return !!activeConnection;
}

export function endKonrehMatch() {
    if (activeConnection) send('cancel');
    teardownMatch();
}
