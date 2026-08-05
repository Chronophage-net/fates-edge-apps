const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Regression coverage for a real bug: the plain-WebSocket transport
 * (ws-handlers.js) never handled the 'get-clients' message type at all --
 * only the Socket.io transport (socketio-handlers.js) did, via an ack
 * callback. Since plain WebSocket is the client's default transport (see
 * websocket.js CONFIG.mode), every call to getConnectedClients() from the
 * web client silently timed out after 2s and resolved to [] .
 *
 * Full end-to-end coverage would require spinning up a real `ws` server;
 * this is a source-level guard (same style as the web client's
 * voice-signaling regression test) confirming the handler exists and is
 * wired to the same room.getClientsList() the Socket.io path uses, and
 * echoes requestId so the client's generic request/response correlation
 * (see websocket.js's pendingCallbacks) actually resolves.
 */
describe('ws-handlers.js get-clients (regression)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../server/ws-handlers.js'), 'utf8');

    test('handles the get-clients message type', () => {
        assert.match(src, /case 'get-clients':/);
    });

    test('responds using room.getClientsList() (same source of truth as Socket.io\'s handler)', () => {
        const match = src.match(/case 'get-clients':[\s\S]{0,300}?break;/);
        assert.ok(match, 'get-clients case block not found');
        assert.match(match[0], /room\.getClientsList\(/);
    });

    test('echoes requestId back so the client\'s pendingCallbacks correlation resolves', () => {
        const match = src.match(/case 'get-clients':[\s\S]{0,300}?break;/);
        assert.ok(match, 'get-clients case block not found');
        assert.match(match[0], /requestId:\s*data\.requestId/);
    });
});
