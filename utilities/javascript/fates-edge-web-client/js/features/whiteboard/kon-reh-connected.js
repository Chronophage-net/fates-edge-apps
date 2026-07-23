// ============================================================
//  KON'REH — Connected Mode
// ============================================================
//
// Lets two separate clients play a real-time Kon'reh game against each
// other over ANY transport the host application already has set up
// (raw WebSocket, socket.io, a VTT's existing chat/event channel,
// whatever) — this module never opens a connection itself.
//
// CONTRACT WITH THE HOST APPLICATION
// -----------------------------------
// You provide a `transport` object with exactly one method:
//
//   transport.send(message)
//     `message` is a plain JS object (not a string). Serialize it
//     however your transport needs (JSON.stringify, etc.) and put it
//     on the wire — socket.emit('konreh', message), ws.send(...), your
//     VTT's existing message bus, and so on.
//
// Whenever a message arrives from the remote peer, YOU call:
//
//   connection.receive(message)
//
//   `message` may be the plain object or a JSON string — either is
//   accepted. Routing the right message to the right game instance
//   (rooms, opponent IDs, etc.) is entirely your responsibility; this
//   module only knows about the single game it was opened for.
//
// That is the whole contract. Everything else — turn ownership, move
// application, Reforge choices, and resync after a dropped message —
// is handled inside this file, on top of the same KonrehEngine and
// board UI used for local and vs-Computer play.
//
// USAGE
// -----
//   import { openKonrehModalConnected } from './kon-reh-connected.js';
//
//   const connection = openKonrehModalConnected(myTransport, {
//     localPlayer: 1,       // which seat THIS client controls (1, 2, or
//                           // omit/null for a read-only spectator view)
//     startFresh: true,     // true: start a brand-new game right now
//                           // false: request the peer's current game
//                           //        state and join it in progress
//   });
//
//   // wire incoming messages from your existing socket into it:
//   mySocket.on('konreh', (msg) => connection.receive(msg));
//
//   // if your transport tells you it just reconnected (or you simply
//   // suspect a message went missing), ask the peer to resend the
//   // full current state rather than guessing:
//   connection.requestSync();
//
//   // later, to tear down:
//   connection.destroy();

import { openKonrehModal } from './kon-reh.js';

export const KONREH_CONNECTED_PROTOCOL_VERSION = 1;

export function openKonrehModalConnected(transport, options = {}) {
  const { localPlayer = null, startFresh = true } = options;

  let ui = null;
  let connectionReady = false;
  let connectingEl = null;

  function onLocalMove(pieceId, move, seq) {
    transport.send({ t: 'move', pieceId, move, seq });
  }
  function onLocalReforge(optionKey, seq) {
    transport.send({ t: 'reforge', optionKey, seq });
  }
  function onLocalNewGame() {
    transport.send({ t: 'new-game' });
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
    if (connectingEl) { connectingEl.remove(); connectingEl = null; }
  }

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

  if (startFresh) {
    buildUi(null);
  } else {
    showConnectingIndicator();
    transport.send({ t: 'sync-request' });
  }

  function requestSync() {
    transport.send({ t: 'sync-request' });
  }

  function receive(raw) {
    let msg = raw;
    if (typeof raw === 'string') {
      try { msg = JSON.parse(raw); } catch { return; }
    }
    if (!msg || typeof msg !== 'object' || !msg.t) return;

    // Joining an in-progress game: the first sync-state we see is what
    // we build the board from.
    if (!connectionReady) {
      if (msg.t === 'sync-state') buildUi(msg.state, msg.seq);
      return; // ignore everything else until we've joined
    }

    switch (msg.t) {
      case 'move': {
        if (msg.seq !== ui.getSeq() + 1) { requestSync(); return; }
        const ok = ui.applyRemoteMove(msg.pieceId, msg.move);
        if (!ok) requestSync();
        break;
      }
      case 'reforge': {
        if (msg.seq !== ui.getSeq() + 1) { requestSync(); return; }
        const ok = ui.applyRemoteReforge(msg.optionKey);
        if (!ok) requestSync();
        break;
      }
      case 'new-game': {
        ui.applyRemoteNewGame();
        break;
      }
      case 'sync-request': {
        transport.send({ t: 'sync-state', state: ui.getState(), seq: ui.getSeq() });
        break;
      }
      case 'sync-state': {
        ui.loadState(msg.state, msg.seq);
        break;
      }
      default:
        break; // unknown message type — ignore rather than throw
    }
  }

  return {
    receive,
    requestSync,
    destroy() {
      hideConnectingIndicator();
      if (ui) ui.destroy();
    },
  };
}
