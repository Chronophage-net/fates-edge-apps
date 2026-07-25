// ============================================================
//  KON'REH — Connected Mode
// ============================================================
//
// Lets two separate clients play a real-time Kon'reh game over ANY
// transport the host application already provides (raw WebSocket,
// socket.io, a VTT's existing message bus, etc.). This module never
// opens a connection itself — you supply a `transport` object.
//
// CONTRACT WITH THE HOST APPLICATION
// -----------------------------------
// You provide a `transport` object with exactly one method:
//
//   transport.send(message)
//     `message` is a plain JS object (not a string). Serialize it
//     however your transport needs (JSON.stringify, etc.) and put it
//     on the wire — socket.emit('konreh', message), ws.send(...), etc.
//
// Whenever a message arrives from the remote peer, YOU call:
//
//   connection.receive(message)
//
//   `message` may be a plain object or a JSON string — either is
//   accepted. Routing the right message to the right game instance
//   (rooms, opponent IDs, etc.) is your responsibility; this module
//   only knows about the single game it was opened for.
//
// That is the whole contract. Everything else — turn ownership, move
// application, Reforge choices, and resync after a dropped message —
// is handled inside this file, on top of the same KonrehEngine and UI.
//
// USAGE
// -----
//   import { openKonrehModalConnected } from './kon-reh-connected.js';
//
//   const connection = openKonrehModalConnected(myTransport, {
//     localPlayer: 1,       // which seat THIS client controls (1, 2)
//                           // omit/null for a read‑only spectator
//     startFresh: true,     // true: start a brand‑new game right now
//                           // false: request the peer's current state
//   });
//
//   // wire incoming messages into it:
//   mySocket.on('konreh', (msg) => connection.receive(msg));
//
//   // if you suspect a message went missing, ask for a full resync:
//   connection.requestSync();
//
//   // later, to tear down:
//   connection.destroy();

import { openKonrehModal } from './index.js';

export const KONREH_CONNECTED_PROTOCOL_VERSION = 1;

/**
 * Opens a Kon'reh game in connected (network) mode.
 *
 * @param {Object} transport - Must have a `send(message)` method.
 * @param {Object} options
 * @param {number|null} [options.localPlayer] - 1 or 2; null for spectator.
 * @param {boolean} [options.startFresh=true] - true to start a new game immediately;
 *   false to request the remote peer's current state and join in progress.
 * @returns {Object} A connection object with `receive`, `requestSync`, and `destroy`.
 */
export function openKonrehModalConnected(transport, options = {}) {
  const { localPlayer = null, startFresh = true } = options;

  if (!transport || typeof transport.send !== 'function') {
    throw new Error('Connected mode requires a transport object with a .send() method.');
  }

  let ui = null;
  let connectionReady = false;
  let connectingEl = null;

  // Safely send a message over the transport, catching any errors.
  function safeSend(msg) {
    try {
      transport.send(msg);
    } catch (err) {
      console.warn('[Kon’reh connected] Send error:', err);
    }
  }

  // Local callbacks that the UI will invoke when the local player acts.
  function onLocalMove(pieceId, move, seq) {
    safeSend({ t: 'move', pieceId, move, seq });
  }
  function onLocalReforge(optionKey, seq) {
    safeSend({ t: 'reforge', optionKey, seq });
  }
  function onLocalNewGame() {
    safeSend({ t: 'new-game' });
  }

  function showConnectingIndicator() {
    connectingEl = document.createElement('div');
    connectingEl.id = 'konreh-connecting';
    connectingEl.style.cssText = `
      position: fixed; inset: 0; background: rgba(6,6,10,0.88); display: flex;
      align-items: center; justify-content: center; z-index: 10000;
      color: #e8e6df; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px;
    `;
    connectingEl.textContent = 'Connecting to game…';
    document.body.appendChild(connectingEl);
  }
  function hideConnectingIndicator() {
    if (connectingEl) {
      connectingEl.remove();
      connectingEl = null;
    }
  }

  // Build the actual Kon'reh UI, passing network configuration.
  function buildUi(initialState, initialSeq) {
    ui = openKonrehModal({
      localPlayer,
      initialState: initialState || null,
      initialSeq: initialSeq || 0,
      onLocalMove,
      onLocalReforge,
      onLocalNewGame,
    });
    connectionReady = true;
    hideConnectingIndicator();
  }

  // Start the flow.
  if (startFresh) {
    buildUi(null);
  } else {
    showConnectingIndicator();
    safeSend({ t: 'sync-request' });
  }

  // Public API: ask the remote peer to send its full state.
  function requestSync() {
    safeSend({ t: 'sync-request' });
  }

  // Public API: receive an incoming message from the transport.
  function receive(raw) {
    let msg = raw;
    if (typeof raw === 'string') {
      try { msg = JSON.parse(raw); } catch { return; }
    }
    if (!msg || typeof msg !== 'object' || !msg.t) return;

    // If we haven't built the UI yet, the only acceptable message is a sync-state.
    if (!connectionReady) {
      if (msg.t === 'sync-state') {
        buildUi(msg.state, msg.seq);
      }
      return;
    }

    // We have a live UI; handle all message types.
    switch (msg.t) {
      case 'move': {
        // Check sequence: the remote move must be exactly one ahead of ours.
        if (msg.seq !== ui.getSeq() + 1) {
          requestSync();
          return;
        }
        const ok = ui.applyRemoteMove(msg.pieceId, msg.move);
        if (!ok) requestSync();
        break;
      }
      case 'reforge': {
        if (msg.seq !== ui.getSeq() + 1) {
          requestSync();
          return;
        }
        const ok = ui.applyRemoteReforge(msg.optionKey);
        if (!ok) requestSync();
        break;
      }
      case 'new-game': {
        ui.applyRemoteNewGame();
        break;
      }
      case 'sync-request': {
        // Remote wants our state.
        safeSend({
          t: 'sync-state',
          state: ui.getState(),
          seq: ui.getSeq(),
        });
        break;
      }
      case 'sync-state': {
        ui.loadState(msg.state, msg.seq);
        break;
      }
      default:
        // Unknown message type; ignore it.
        break;
    }
  }

  // Public API: cleanly close the connection and remove the UI.
  function destroy() {
    hideConnectingIndicator();
    if (ui) {
      ui.destroy();
      ui = null;
    }
    connectionReady = false;
  }

  return {
    receive,
    requestSync,
    destroy,
  };
}
