const { test } = require('node:test');
const assert = require('node:assert/strict');
const room = require('../server/room');
const auth = require('../server/auth');
const { setupSocketIO } = require('../server/socketio-handlers');

test('wrong target password preserves the current room and emits retry guidance', async () => {
    let connect;
    setupSocketIO({ on(event, handler) { if (event === 'connection') connect = handler; } }, {});
    const handlers = new Map();
    const events = [];
    const socket = {
        id: 'recovery-test', on: (event, handler) => handlers.set(event, handler),
        use() {}, emit: (event, payload) => events.push({ event, payload }),
        disconnect() { this.disconnected = true; },
        leave() { throw new Error('Left current room before admission'); },
    };
    connect(socket);
    const old = room.createRoom('UXOLD');
    const target = room.createRoom('UXNEW');
    socket.room = old.room_id;
    old.clients.set(socket.id, socket.clientData);
    target.password = await auth.hashPassword('correct-password');
    try {
        await handlers.get('join-room')({ roomCode: 'UXNEW', password: 'wrong-password' });
        assert.equal(socket.room, old.room_id);
        assert.equal(old.clients.has(socket.id), true);
        assert.equal(target.clients.has(socket.id), false);
        assert.equal(Boolean(socket.disconnected), false);
        assert.equal(events.at(-1).payload.code, 'ROOM_PASSWORD_INVALID');
    } finally {
        room.rooms.delete('UXOLD'); room.rooms.delete(old.room_id);
        room.rooms.delete('UXNEW'); room.rooms.delete(target.room_id);
    }
});
