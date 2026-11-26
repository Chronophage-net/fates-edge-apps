/**
 * Message coverage — every event the web client sends is handled by both
 * transports and allowed in managed rooms.
 *
 * The bugs this locks down:
 *   - Managed rooms gated on an allow-list of invented names ('roll',
 *     'dice-roll', 'webrtc-offer', 'voice-state'), so the real 'roll-result'
 *     and 'roll-dice' came back "not enabled for managed rooms" on every
 *     dice roll, along with voice, presence, sync and generic events.
 *   - 'whiteboard-ping' and the X-card events had no handler on either
 *     transport: plain WS answered "Unknown message type", Socket.IO
 *     dropped them.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-for-unit-tests';
const { managedEventScope } = require('../server/manager.js');

const read = f => fs.readFileSync(path.join(__dirname, '..', 'server', f), 'utf8');
const wsSource = read('ws-handlers.js');
const ioSource = read('socketio-handlers.js');
const relayBlock = ioSource.slice(ioSource.indexOf('const relayEvents = ['), ioSource.indexOf('];', ioSource.indexOf('const relayEvents = [')))
    .replace(/\/\/.*$/gm, '');
const wsHandles = e => wsSource.includes(`case '${e}':`);
const ioHandles = e => ioSource.includes(`socket.on('${e}'`) || relayBlock.includes(`'${e}'`);

// What a player's web client sends during play (js/core/websocket.js and
// its callers), under the names that actually go out on the wire.
const PLAYER_EVENTS = [
    'chat-message', 'roll-result', 'roll-dice', 'event', 'presence', 'character-select',
    'claim-character', 'release-character', 'whiteboard-update', 'whiteboard-ping',
    'sync-state', 'state-updated', 'x-card-raised', 'x-card-resumed',
    'voice-offer', 'voice-answer', 'voice-ice-candidate', 'voice-status', 'media_recording',
    'turn-credentials-request', 'get-clients', 'sync-request', 'deck-history', 'module-list',
    'adhoc-timer-request',
];

describe('every player event is handled on both transports', () => {
    for (const e of PLAYER_EVENTS) {
        test(e, () => {
            assert.ok(wsHandles(e), `plain WebSocket has no case for '${e}'`);
            assert.ok(ioHandles(e), `Socket.IO has no listener or relay for '${e}'`);
        });
    }
});

describe('managed rooms', () => {
    test('allow every player event', () => {
        for (const e of PLAYER_EVENTS) assert.ok(managedEventScope(e), `'${e}' is refused in managed rooms`);
    });
    test('dice rolls need only a player\'s character:write scope', () => {
        assert.equal(managedEventScope('roll-result'), 'character:write');
        assert.equal(managedEventScope('roll-dice'), 'character:write');
    });
    test('the full adventure reference needs campaign:write', () => {
        const { checkEventPermission } = require('../server/security.js');
        assert.ok(checkEventPermission('adventure-reference', 'player'), 'players cannot read unrevealed GM knowledge');
        assert.equal(checkEventPermission('adventure-reference', 'co-gm'), null);
        assert.equal(managedEventScope('adventure-reference'), 'campaign:write');
        assert.equal(managedEventScope('adventure-reference-request'), 'campaign:write');
    });
    test('membership and seat changes stay with the manager', () => {
        for (const e of ['request_gm', 'approve_gm', 'role_change_request', 'kick_client', 'ban_client', 'set_room_password']) {
            assert.equal(managedEventScope(e), null, e);
        }
    });
    test('every name on the allow-list is handled somewhere', () => {
        const src = read('manager.js');
        const list = src.slice(src.indexOf('const participantEvents = new Set(['), src.indexOf(']);', src.indexOf('const participantEvents')));
        for (const [, e] of list.matchAll(/'([\w-]+)'/g)) {
            assert.ok(wsHandles(e) || ioHandles(e), `'${e}' is allowed but no transport handles it`);
        }
    });
});
