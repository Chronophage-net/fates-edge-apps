const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
process.env.DATABASE_URL = ':memory:';
const room = require('../server/room');
const auth = require('../server/auth');
const { setupSocketIO } = require('../server/socketio-handlers');

// Real Engine.IO / Socket.IO websocket clients; no external service or account required.
async function client(port) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
    const queue = [];
    const waiters = [];
    ws.on('message', bytes => {
        const text = bytes.toString();
        if (text.startsWith('0')) ws.send('40');
        if (text === '2') ws.send('3');
        if (text.startsWith('40')) deliver('ready', JSON.parse(text.slice(2)));
        if (text.startsWith('42')) { const [event, data] = JSON.parse(text.slice(2)); deliver(event, data); }
    });
    function deliver(event, data) {
        const i = waiters.findIndex(w => w.event === event);
        if (i < 0) queue.push({ event, data });
        else { const [w] = waiters.splice(i, 1); clearTimeout(w.timer); w.resolve(data); }
    }
    function wait(event) {
        const i = queue.findIndex(item => item.event === event);
        if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0].data);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timed out: ${event}`)), 5000);
            waiters.push({ event, resolve, timer });
        });
    }
    await wait('ready');
    return { ws, wait, send(event, data) { ws.send('42' + JSON.stringify([event, data])); } };
}

test('live clients: rejected and overlapping switches preserve membership; retry succeeds', { timeout: 15000 }, async () => {
    const server = http.createServer();
    const io = new Server(server);
    setupSocketIO(io, {}); room.setIo(io);
    const clients = [];
    try {
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        const a = await client(server.address().port); clients.push(a);
        const b = await client(server.address().port); clients.push(b);
        a.send('join-room', { roomCode: 'LIVEOLD', playerName: 'A' });
        const first = await a.wait('room-joined');
        b.send('join-room', { roomCode: 'LIVEOLD', playerName: 'B' });
        await b.wait('room-joined');
        const target = room.createRoom('LIVENEW');
        target.password = await auth.hashPassword(' secret ');
        a.send('join-room', { roomCode: 'LIVENEW', password: 'wrong' });
        a.send('join-room', { roomCode: 'LIVENEW', password: ' secret ' });
        const errors = [await a.wait('error'), await a.wait('error')];
        assert.deepEqual(errors.map(e => e.code).sort(), ['JOIN_IN_PROGRESS', 'ROOM_PASSWORD_INVALID']);
        assert.equal(room.rooms.get(first.room).clients.size, 2);
        assert.equal(a.ws.readyState, WebSocket.OPEN);
        a.send('join-room', { roomCode: 'LIVENEW', password: ' secret ' });
        const joined = await a.wait('room-joined');
        assert.equal(joined.room, target.room_id);
        assert.equal(room.rooms.get(first.room).clients.size, 1);
        assert.equal(target.clients.size, 1);
        a.ws.terminate();
    } finally {
        clients.forEach(c => c.ws.terminate());
        await new Promise(resolve => io.close(resolve));
        room.setIo(null); room.rooms.clear();
    }
});
