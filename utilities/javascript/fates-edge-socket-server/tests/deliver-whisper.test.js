const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const room = require('../server/room.js');

// deliverWhisper() (server/room.js) -- privately delivers a chat-message
// whisper to its resolvable recipient (plus an echo to the sender) instead
// of the whole room, and returns false when it can't resolve the recipient
// locally so the caller falls back to the original broadcastToRoom()
// behavior. See the function's own doc comment for the full rationale
// (bug: whisper/recipient used to be pure client-side decoration, enforced
// nowhere on the server).

const ROOM_CODE = 'WHSP1234';

function fakeWsClient(id) {
    const sent = [];
    return {
        entry: { id, type: 'ws', ws: { readyState: WebSocket.OPEN, send: (msg) => sent.push(JSON.parse(msg)) } },
        sent,
    };
}

function fakeIoClient(id) {
    const emitted = [];
    return {
        entry: { id, type: 'socket.io', socket: { emit: (event, payload) => emitted.push({ event, payload }) } },
        sent: emitted,
    };
}

describe('room.js deliverWhisper()', () => {
    beforeEach(() => {
        room.rooms.set(ROOM_CODE, {
            code: ROOM_CODE,
            clients: new Map(),
        });
    });

    test('delivers only to the resolved recipient and echoes to the sender (both plain-ws)', () => {
        const bot = fakeWsClient('bot-1');
        const newPlayer = fakeWsClient('player-1');
        const bystander = fakeWsClient('bystander-1');
        const r = room.rooms.get(ROOM_CODE);
        r.clients.set('bot-1', bot.entry);
        r.clients.set('player-1', newPlayer.entry);
        r.clients.set('bystander-1', bystander.entry);

        const delivered = room.deliverWhisper(
            ROOM_CODE,
            'chat-message',
            { message: { text: 'Welcome!', whisper: true, recipient: 'player-1' } },
            'bot-1',
            'player-1'
        );

        assert.equal(delivered, true);
        assert.equal(newPlayer.sent.length, 1, 'recipient should receive exactly one message');
        assert.equal(newPlayer.sent[0].message.text, 'Welcome!');
        assert.equal(bot.sent.length, 1, 'sender should get an echo of their own whisper');
        assert.equal(bystander.sent.length, 0, 'bystander must not see the whisper at all');
    });

    test('works across mixed transports (ws sender, socket.io recipient)', () => {
        const bot = fakeWsClient('bot-1');
        const newPlayer = fakeIoClient('player-1');
        const r = room.rooms.get(ROOM_CODE);
        r.clients.set('bot-1', bot.entry);
        r.clients.set('player-1', newPlayer.entry);

        const delivered = room.deliverWhisper(
            ROOM_CODE,
            'chat-message',
            { message: { text: 'Welcome!', whisper: true, recipient: 'player-1' } },
            'bot-1',
            'player-1'
        );

        assert.equal(delivered, true);
        assert.equal(newPlayer.sent.length, 1);
        assert.equal(newPlayer.sent[0].event, 'chat-message');
        assert.equal(newPlayer.sent[0].payload.message.text, 'Welcome!');
    });

    test('does not double-send when sender and recipient are the same client', () => {
        const solo = fakeWsClient('solo-1');
        const r = room.rooms.get(ROOM_CODE);
        r.clients.set('solo-1', solo.entry);

        room.deliverWhisper(
            ROOM_CODE,
            'chat-message',
            { message: { text: 'hi', whisper: true, recipient: 'solo-1' } },
            'solo-1',
            'solo-1'
        );

        assert.equal(solo.sent.length, 1, 'should not be delivered twice to the same client');
    });

    test('returns false when the recipient is not a client connected to this room (caller should fall back to broadcastToRoom)', () => {
        const bot = fakeWsClient('bot-1');
        const r = room.rooms.get(ROOM_CODE);
        r.clients.set('bot-1', bot.entry);

        const delivered = room.deliverWhisper(
            ROOM_CODE,
            'chat-message',
            { message: { text: 'hi', whisper: true, recipient: 'nobody-here' } },
            'bot-1',
            'nobody-here'
        );

        assert.equal(delivered, false);
        assert.equal(bot.sent.length, 0, 'nothing should have been sent when resolution fails');
    });

    test('returns false when the room does not exist', () => {
        const delivered = room.deliverWhisper('NOSUCHROOM', 'chat-message', {}, 'bot-1', 'player-1');
        assert.equal(delivered, false);
    });

    test('returns false when no recipientClientId is given at all', () => {
        const r = room.rooms.get(ROOM_CODE);
        r.clients.set('bot-1', fakeWsClient('bot-1').entry);
        const delivered = room.deliverWhisper(ROOM_CODE, 'chat-message', {}, 'bot-1', undefined);
        assert.equal(delivered, false);
    });
});
