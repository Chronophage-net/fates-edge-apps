const { test } = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { startTestServer, connect } = require('./support/live-server');

async function fixture(t, settings) {
    const server = await startTestServer(settings);
    t.after(() => server.close());
    return server;
}

test('both transports share one port, including campaign-path joins and correlated client lists', { timeout: 15000 }, async t => {
    const server = await fixture(t);
    const ws = await connect(server, { path: '/campaign/LIVE' });
    const first = await ws.join();
    const io = await connect(server, { socketIO: true });
    await io.join();
    ws.send('get-clients', { requestId: 'roster-test' });
    const roster = await ws.wait('clients');
    assert.equal(roster.requestId, 'roster-test');
    assert.equal(roster.clients.length, 2);
    assert(roster.clients.some(client => client.id === first.clientId));
    io.send('chat-message', { message: { text: 'Hello from Socket.IO' } });
    const message = await ws.wait('chat-message');
    assert.equal(message.message.text, 'Hello from Socket.IO');
    assert.equal(message.message.verifiedGM, false);
});

test('pending and rejected handshakes cannot see protected state or broadcasts', { timeout: 15000 }, async t => {
    const server = await fixture(t);
    const gm = await connect(server);
    await gm.join('LIVE', { role: 'gm' });
    gm.send('set_room_password', { password: 'private-room-password' });
    await gm.wait('set_room_password_ack');
    const pending = await connect(server);
    gm.send('chat-message', { message: { text: 'private conversation' } });
    gm.send('get-clients');
    assert.equal((await gm.wait('clients')).clients.length, 1);
    pending.send('ping');
    await pending.wait('pong');
    assert(!pending.messages.some(item => ['room-state', 'chat-message', 'presence'].includes(item.type)));
    pending.send('handshake', { password: 'wrong' });
    assert.equal((await pending.wait('error')).code, 'ROOM_PASSWORD_INVALID');
    await pending.closed;
    const allowed = await connect(server);
    await allowed.join('LIVE', { password: 'private-room-password' });
    const snapshot = await allowed.wait('room-state');
    assert.equal(snapshot.chatHistory[0].text, 'private conversation');
});

test('unresolved whispers stay private on both transports and never enter public history', { timeout: 15000 }, async t => {
    const server = await fixture(t);
    const observer = await connect(server);
    await observer.join('LIVE', { role: 'gm' });
    for (const socketIO of [false, true]) {
        const sender = await connect(server, { socketIO });
        await sender.join();
        sender.send('chat-message', { message: { whisper: true, recipient: 'missing', text: 'Do not broadcast' } });
        assert.equal((await sender.wait('error')).code, 'WHISPER_UNDELIVERABLE');
        sender.send('chat-message', { message: { whisper: true, recipient: 'gm', text: 'Only for the GM' } });
        assert.equal((await observer.wait('chat-message')).message.text, 'Only for the GM');
    }
    assert(!observer.messages.some(item => item.message?.text === 'Do not broadcast'));
    const newcomer = await connect(server);
    await newcomer.join();
    assert.deepEqual((await newcomer.wait('room-state')).chatHistory, []);
});

test('handshake deadlines reclaim idle connections without admitting them', { timeout: 15000 }, async t => {
    const server = await fixture(t, { HANDSHAKE_TIMEOUT_MS: '150' });
    const client = await connect(server);
    assert.equal((await client.wait('error')).code, 'HANDSHAKE_TIMEOUT');
    assert.equal((await client.closed).code, 4008);
    const health = await (await fetch(`${server.base}/api/health`)).json();
    assert.equal(health.stats.totalClients, 0);
    assert.equal(health.stats.totalRooms, 0);
});

test('origin allowlist protects upgrades on both protocols', { timeout: 15000 }, async t => {
    const server = await fixture(t, { CORS_ORIGIN: 'https://table.example' });
    for (const path of ['/?room=LIVE', '/socket.io/?EIO=4&transport=websocket']) {
        const status = await new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://127.0.0.1:${server.port}${path}`, { origin: 'https://other.example' });
            ws.on('unexpected-response', (_req, res) => { res.resume(); ws.terminate(); resolve(res.statusCode); });
            ws.on('error', () => {});
            ws.on('open', () => { ws.terminate(); reject(new Error('Disallowed origin connected')); });
        });
        // Engine.IO responds to denied upgrades with 400; plain ws uses 403.
        assert.equal(status, path.startsWith('/socket.io/') ? 400 : 403);
    }
    const allowed = await connect(server, { origin: 'https://table.example' });
    await allowed.join();
    const allowedIO = await connect(server, { socketIO: true, origin: 'https://table.example' });
    await allowedIO.join();
    const native = await connect(server);
    await native.join();
});

test('status is accurate and does not disclose room codes; invalid JSON returns bounded JSON errors', { timeout: 15000 }, async t => {
    const server = await fixture(t);
    const client = await connect(server, { path: '/?room=HIDE' });
    await client.join('HIDE');
    const response = await fetch(server.base);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await response.json()).version, require('../package.json').version);
    const health = await (await fetch(`${server.base}/api/health`)).json();
    assert.equal(health.stats.totalClients, 1);
    assert(!JSON.stringify(health).includes('HIDE'));
    const invalid = await fetch(`${server.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"secret":' });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: 'Invalid JSON request body.' });
});

test('shutdown closes active plain WebSocket and Socket.IO connections cleanly', { timeout: 15000 }, async t => {
    const server = await startTestServer();
    t.after(() => server.close());
    const plain = await connect(server); await plain.join();
    const io = await connect(server, { socketIO: true }); await io.join();
    assert.equal((await server.close()).code, 0);
    assert.equal((await plain.closed).code, 1001);
    await io.closed;
});

test('room caps are enforced at admission even when sockets connected before the room filled', { timeout: 15000 }, async t => {
    const server = await fixture(t, { MAX_CLIENTS_PER_ROOM: '1' });
    const pending = await connect(server);
    const io = await connect(server, { socketIO: true });
    const admitted = await connect(server); await admitted.join();
    for (const [client, event] of [[pending, 'handshake'], [io, 'join-room']]) {
        client.send(event, { roomCode: 'LIVE' });
        assert.equal((await client.wait('error')).code, 'ROOM_FULL');
    }
    admitted.send('get-clients');
    assert.equal((await admitted.wait('clients')).clients.length, 1);
});

test('HTTP limiting leaves health checks available', { timeout: 15000 }, async t => {
    const server = await fixture(t, { API_RATE_LIMIT_MAX: '1' });
    assert.equal((await fetch(`${server.base}/api/rooms`)).status, 401);
    assert.equal((await fetch(`${server.base}/api/rooms`)).status, 429);
    assert.equal((await fetch(`${server.base}/healthz`)).status, 200);
    assert.equal((await fetch(`${server.base}/api/health`)).status, 200);
});

test('oversized messages close both transports', { timeout: 15000 }, async t => {
    const server = await fixture(t, { WS_MAX_PAYLOAD_BYTES: '1024' });
    for (const socketIO of [false, true]) {
        const client = await connect(server, { socketIO }); await client.join();
        client.send('chat-message', { message: { text: 'x'.repeat(2048) } });
        assert.equal((await client.closed).code, 1009);
    }
});

test('storage failure rejects admission on both transports without revealing state', { timeout: 15000 }, async t => {
    const server = await fixture(t, { DATABASE_URL: '/nonexistent-fates-edge-directory/test.db' });
    for (const socketIO of [false, true]) {
        const client = await connect(server, { socketIO });
        client.send(socketIO ? 'join-room' : 'handshake', { roomCode: 'LIVE' });
        assert.equal((await client.wait('error')).code, 'ROOM_AUTH_UNAVAILABLE');
        assert(!client.messages.some(message => message.type === 'room-state'));
    }
});

test('message limits drop excess traffic without disconnecting either transport', { timeout: 15000 }, async t => {
    const server = await fixture(t, { WS_MESSAGE_RATE_MAX: '2', WS_MESSAGE_RATE_WINDOW_MS: '60000' });
    const observer = await connect(server); await observer.join();
    for (const socketIO of [false, true]) {
        const client = await connect(server, { socketIO }); await client.join();
        client.send('chat-message', { message: { text: 'accepted' } });
        assert.equal((await observer.wait('chat-message')).message.text, 'accepted');
        client.send('chat-message', { message: { text: 'excess' } });
        const warning = await client.wait(socketIO ? 'server_announcement' : 'error');
        assert.match(warning.message, /too quickly/);
        assert.equal(client.ws.readyState, WebSocket.OPEN);
        assert(!observer.messages.some(message => message.message?.text === 'excess'));
    }
});

test('simultaneous first joins safely share database initialization', { timeout: 15000 }, async t => {
    const server = await fixture(t);
    const clients = await Promise.all(Array.from({ length: 8 }, () => connect(server)));
    const joins = await Promise.all(clients.map(client => client.join()));
    assert(joins.every(join => join.success));
    clients[0].send('get-clients');
    assert.equal((await clients[0].wait('clients')).clients.length, 8);
});
