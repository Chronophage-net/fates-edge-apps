const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, connect } = require('./support/live-server');

async function botJoin(server) {
    const bot = await connect(server, { path: '/?room=LIVE' });
    // Match ai-gm-bot.js's actual handshake, not the browser join helper.
    bot.send('handshake', { campaignCode: 'LIVE', clientName: 'AI GM', role: 'gm',
        botMode: 'gm', botSeat: 0, botKey: 'isolated-test-admin-key', authToken: '', password: '' });
    const ack = await bot.wait('handshake_ack');
    assert.equal(ack.success, true);
    assert.equal(ack.clientRole, 'gm');
    await bot.wait('room-state');
    return { bot, ack };
}

test('AI-GM wire contract bridges browser transports, preserves authority, and isolates rooms', { timeout: 20000 }, async t => {
    const server = await startTestServer();
    t.after(() => server.close());
    const { bot, ack } = await botJoin(server);
    const browsers = [];
    for (const socketIO of [false, true]) {
        const client = await connect(server, { socketIO });
        await client.join();
        browsers.push(client);
    }
    const outsider = await connect(server, { path: '/?room=OTHER' });
    await outsider.join('OTHER');
    for (const client of browsers) {
        client.send('chat-message', { message: { text: '!gm approve proposal-1', verifiedGM: true, senderRole: 'gm' } });
        const command = (await bot.wait('chat-message')).message;
        assert.equal(command.text, '!gm approve proposal-1');
        assert.equal(command.verifiedGM, false, 'client cannot forge GM approval authority');
        assert.equal(command.senderRole, 'player');
        assert(command.senderClientId);
    }
    const events = [
        ['chat-message', { message: { id: 'narration', text: 'The door opens.' } }],
        ['tts-audio', { url: 'https://example.invalid/narration.mp3' }],
        ['soundboard-ambience', { trackId: 'rain' }],
        ['assistant-suggestion-created', { id: 'proposal-1', kind: 'fact', preview: 'An open door' }],
        ['assistant-suggestion-resolved', { id: 'proposal-1', outcome: 'approved' }],
        ['scene-status-update', { sceneId: 'scene-1', status: 'active' }],
        ['combat-status-update', { active: true }],
    ];
    // Plain WS excludes the sender; Socket.IO also echoes to its sender.
    await browsers[0].wait('chat-message');
    await browsers[1].wait('chat-message');
    await browsers[1].wait('chat-message');
    for (const [event, payload] of events) {
        bot.send(event, payload);
        for (const client of browsers) {
            const delivered = await client.wait(event);
            for (const [key, value] of Object.entries(payload)) {
                if (key === 'message') {
                    assert.equal(delivered.message.text, value.text);
                    assert.equal(delivered.message.verifiedGM, true);
                } else assert.deepEqual(delivered[key], value);
            }
            assert.equal(delivered.clientId, ack.clientId);
        }
    }
    for (const client of browsers) {
        for (const event of ['tts-audio', 'soundboard-ambience', 'assistant-suggestion-created', 'assistant-suggestion-resolved']) {
            client.send(event, { id: 'forged-proposal' });
            assert.equal((await client.wait('permission-denied')).event, event);
        }
    }
    outsider.send('get-clients', { requestId: 'isolation-barrier' });
    assert.equal((await outsider.wait('clients')).clients.length, 1);
    assert(!outsider.messages.some(message => events.some(([event]) => event === message.type)));
    assert(!bot.messages.some(message => message.id === 'forged-proposal'));
});

test('AI-GM can reconnect with a fresh handshake, restored snapshot and no duplicate seat', { timeout: 20000 }, async t => {
    const server = await startTestServer();
    t.after(() => server.close());
    const first = await botJoin(server);
    const browser = await connect(server, { socketIO: true });
    await browser.join();
    first.bot.ws.terminate();
    await first.bot.closed;
    await browser.wait('player-left');
    const second = await botJoin(server);
    assert.notEqual(second.ack.clientId, first.ack.clientId);
    second.bot.send('get-clients', { requestId: 'reconnected' });
    const roster = await second.bot.wait('clients');
    assert.equal(roster.requestId, 'reconnected');
    assert.equal(roster.clients.length, 2);
    assert.equal(roster.clients.filter(client => client.botMode === 'gm').length, 1);
    browser.send('chat-message', { message: { text: '!gm status' } });
    assert.equal((await second.bot.wait('chat-message')).message.text, '!gm status');
});
