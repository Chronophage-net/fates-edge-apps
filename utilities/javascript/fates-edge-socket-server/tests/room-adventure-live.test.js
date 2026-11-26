/**
 * Live: the room's adventure (loaded by the AI GM over REST) reaches
 * browsers on both transports, which is what lets the web client's
 * Adventure Manager show it in place of its local library.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, connect } = require('./support/live-server');

const content = {
    title: 'The Salt Road', description: 'A toll that costs too much.',
    acts: [{ title: 'Act One', scenes: [
        { title: 'The Ferry', description: 'Fog.', timers: [{ name: 'Alarm', segments: 4 }] },
        { title: 'The Toll Gate', description: 'Rain.' },
    ] }],
};

test('an AI-GM adventure reaches WebSocket and Socket.IO players', { timeout: 20000 }, async t => {
    const server = await startTestServer();
    t.after(() => server.close());

    const bot = await connect(server, { path: '/?room=SALT' });
    bot.send('handshake', { campaignCode: 'SALT', clientName: 'AI GM', role: 'gm', botMode: 'gm', botSeat: 0,
        botKey: 'isolated-test-admin-key', authToken: '', password: '' });
    assert.equal((await bot.wait('handshake_ack')).clientRole, 'gm');
    const ws = await connect(server, { path: '/?room=SALT' });
    await ws.join('SALT', { clientName: 'Wren' });
    const io = await connect(server, { socketIO: true });
    await io.join('SALT', { clientName: 'Ilaro' });

    // Before anything is loaded the room reports no adventure.
    ws.send('adventure-state-request');
    assert.equal((await ws.wait('adventure-state')).moduleId, null);

    // The AI GM loads its adventure the way ai-gm-bot does: REST.
    const res = await fetch(`${server.base}/api/rooms/SALT/adventure/load-custom`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': 'isolated-test-admin-key' },
        body: JSON.stringify({ id: 'custom_salt', content, dynamicGrowth: true }),
    });
    assert.equal(res.status, 200, await res.text());
    for (const client of [ws, io]) {
        const loaded = await client.wait('adventure-loaded');
        assert.equal(loaded.title, 'The Salt Road');
        assert.equal(loaded.currentScene.title, 'The Ferry');
        assert.equal(loaded.dynamicGrowth, true);
    }

    // The room list (used by the CLI's status/rooms/watch) shows the room,
    // its GM and its adventure. It used to answer every call with a 500.
    const list = await fetch(`${server.base}/api/rooms`, { headers: { 'x-api-key': 'isolated-test-admin-key' } });
    assert.equal(list.status, 200);
    const { rooms, totalClients } = await list.json();
    const salt = rooms.find(r => r.code === 'SALT');
    assert.ok(salt, 'room listed');
    assert.equal(salt.gm, 'AI GM');
    assert.equal(salt.adventure.title, 'The Salt Road');
    assert.equal(totalClients, 3);

    // A late look-up gets the same state on both transports.
    ws.send('adventure-state-request');
    assert.equal((await ws.wait('adventure-state')).moduleId, 'custom_salt');
    // Socket.IO answers 'adventure-state' through its acknowledgement
    // callback (what the web client's requestAdventureState() uses).
    const ack = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no Socket.IO ack for adventure-state')), 5000);
        io.ws.on('message', bytes => {
            const text = bytes.toString();
            if (text.startsWith('437')) { clearTimeout(timer); resolve(JSON.parse(text.slice(3))[0]); }
        });
    });
    io.ws.send('427["adventure-state"]');
    assert.equal((await ack).title, 'The Salt Road');

    // Players can watch but not drive it.
    ws.send('adventure-scene', {});
    assert.equal((await ws.wait('permission-denied')).event, 'adventure-scene');

    // The GM's next-scene command comes back to everyone as full state.
    bot.send('adventure-scene', {});
    for (const client of [ws, io]) {
        assert.equal((await client.wait('scene-changed')).currentScene.title, 'The Toll Gate');
    }
    bot.send('adventure-timer', { scope: 'scene', ref: 0, amount: 1 });
    // The second scene has no timers: the server answers the GM with an error
    // and players see nothing change.
    assert.match((await bot.wait('error')).message, /timer/i);
});
