import { test } from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createRequire } from 'node:module';
import { createSocketIOSession } from '../../js/core/socketio-session.js';
import '../support/dom-shim.js';
import { initSocketIO, joinRoom, disconnectWebSocket, isConnectedToServer, sendChatMessage, onWSEvent, offWSEvent } from '../../js/core/websocket.js';
const require = createRequire(import.meta.url);
const { startTestServer, connect } = require('../../../fates-edge-socket-server/tests/support/live-server.js');

function event(socket, name) {
    return new Promise((resolve, reject) => {
        const received = data => { clearTimeout(timer); resolve(data); };
        const timer = setTimeout(() => { socket.off(name, received); reject(new Error(`Timed out: ${name}`)); }, 5000);
        socket.once(name, received);
    });
}

for (const transport of ['websocket', 'polling']) {
    test(`${transport}: browser admission, credentials, rejection, and automatic rejoin`, { timeout: 20000 }, async t => {
        const server = await startTestServer();
        t.after(() => server.close());
        const host = await connect(server);
        await host.join('LIVE', { role: 'gm' });
        host.send('set_room_password', { password: 'test-room-password' });
        await host.wait('set_room_password_ack');
        const socket = io(server.base, { autoConnect: false, transports: [transport], reconnectionDelay: 30, randomizationFactor: 0 });
        let ready = false, admissions = 0;
        const errors = [];
        const session = createSocketIOSession(socket, {
            onNotReady: () => { ready = false; },
            onReady: () => {
                ready = true; admissions++;
                socket.emit('chat-message', { message: { text: 'admitted' } });
            },
            onError: error => errors.push(error),
        });
        t.after(() => { session.dispose(); socket.disconnect(); });
        const connected = event(socket, 'connect');
        socket.connect(); await connected;
        assert.equal(ready, false, 'transport connection is not game readiness');
        const rejectedDisconnect = event(socket, 'disconnect');
        await assert.rejects(session.join('LIVE', { password: 'wrong' }), /Incorrect room password/);
        await rejectedDisconnect;
        assert.equal(ready, false);
        const retry = event(socket, 'connect');
        socket.connect(); await retry;
        const joined = await session.join('LIVE', { name: 'Home GM', role: 'gm', password: 'test-room-password' });
        // GM conflict is a warning followed by successful admission as Player.
        assert.equal(joined.clientRole, 'player');
        assert.equal(ready, true);
        assert.equal((await host.wait('chat-message')).message.text, 'admitted');
        assert(joined.clients.some(client => client.name === 'Home GM'));
        const rejoined = event(socket, 'room-joined');
        const disconnected = event(socket, 'disconnect');
        socket.io.engine.close();
        await disconnected;
        assert.equal(ready, false);
        await rejoined;
        assert.equal(admissions, 2);
        assert.equal((await host.wait('chat-message')).message.text, 'admitted');
        assert.deepEqual(errors, []);
        session.leave();
        assert.equal(ready, false);
        const isolated = await session.join('NEWROOM', { name: 'Home GM', role: 'gm' });
        assert.equal(isolated.clientRole, 'gm', 'requested role reaches the server');
    });
}

test('public browser helpers gate game traffic until admission and after disconnect', { timeout: 15000 }, async t => {
    const server = await startTestServer();
    t.after(() => server.close());
    const observer = await connect(server);
    await observer.join();
    let admissions = 0;
    const ready = () => { admissions++; assert.equal(sendChatMessage({ text: 'browser ready' }), true); };
    onWSEvent('connected', ready);
    t.after(() => { offWSEvent('connected', ready); disconnectWebSocket(); });
    const socket = await initSocketIO(server.base, { transports: ['websocket'] });
    assert.equal(isConnectedToServer(), false);
    assert.equal(sendChatMessage({ text: 'too early' }), false);
    await joinRoom('LIVE', { name: 'Browser GM', role: 'gm' });
    assert.equal(isConnectedToServer(), true);
    assert.equal((await observer.wait('chat-message')).message.text, 'browser ready');
    const rejoined = event(socket, 'room-joined');
    const disconnected = event(socket, 'disconnect');
    socket.io.engine.close();
    await disconnected;
    assert.equal(isConnectedToServer(), false);
    assert.equal(sendChatMessage({ text: 'offline' }), false);
    await rejoined;
    assert.equal(admissions, 2);
    assert.equal((await observer.wait('chat-message')).message.text, 'browser ready');
    disconnectWebSocket();
    assert.equal(isConnectedToServer(), false);
});
