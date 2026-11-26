/**
 * Live: a Socket.IO player and a plain-WebSocket player in one room see
 * each other's rolls, X-card calls, whiteboard pings and presence.
 *
 * Rolls are the case that broke: the Socket.IO client sent 'roll-dice'
 * and listened only for 'roll-result', so its rolls reached nobody on
 * its own transport. Both clients now send 'roll-result'; the server
 * still relays the older name for any client that sends it.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, connect } = require('./support/live-server');

test('rolls and table events cross between Socket.IO and plain WebSocket', { timeout: 20000 }, async t => {
    const server = await startTestServer();
    t.after(() => server.close());

    const ws = await connect(server, { path: '/?room=XTRANS' });
    await ws.join('XTRANS', { clientName: 'Wren' });
    const io = await connect(server, { socketIO: true });
    await io.join('XTRANS', { clientName: 'Ilaro' });

    io.send('roll-result', { outcome: 'Success', dice: [7, 10, 2], sender: 'Ilaro' });
    const fromIo = await ws.wait('roll-result');
    assert.equal(fromIo.sender, 'Ilaro');
    assert.deepEqual(fromIo.dice, [7, 10, 2]);

    ws.send('roll-result', { outcome: 'Failure', dice: [1, 3], sender: 'Wren' });
    assert.equal((await io.wait('roll-result')).sender, 'Wren');

    io.send('roll-dice', { outcome: 'Partial', sender: 'Ilaro' });
    assert.equal((await ws.wait('roll-dice')).outcome, 'Partial', 'the older event name still relays');

    io.send('x-card-raised', { from: 'Ilaro' });
    assert.equal((await ws.wait('x-card-raised')).from, 'Ilaro');
    ws.send('x-card-resumed', { from: 'Wren' });
    assert.equal((await io.wait('x-card-resumed')).from, 'Wren');

    ws.send('whiteboard-ping', { sheetId: 's1', x: 4, y: 9 });
    assert.equal((await io.wait('whiteboard-ping')).x, 4);

    io.send('presence', { name: 'Ilaro the Quick', activeView: 'vtt' });
    // Earlier joins also broadcast presence; read until the updated roster.
    let roster;
    for (let i = 0; i < 5; i++) {
        roster = await ws.wait('presence');
        if (roster.clients?.some(c => c.name === 'Ilaro the Quick')) break;
    }
    assert.ok(Array.isArray(roster.clients), 'Socket.IO presence broadcasts the roster');
    assert.ok(roster.clients.some(c => c.name === 'Ilaro the Quick'), 'and updates the sender\'s name');

    // Neither transport echoes a sender's own broadcast back to it.
    assert.ok(!io.messages.some(m => m.type === 'roll-result' && m.sender === 'Ilaro'), 'Socket.IO sender got its own roll back');
    assert.ok(!ws.messages.some(m => m.type === 'roll-result' && m.sender === 'Wren'), 'WebSocket sender got its own roll back');

    assert.ok(!ws.messages.some(m => m.type === 'error'), JSON.stringify(ws.messages.filter(m => m.type === 'error')));
    assert.ok(!io.messages.some(m => m.type === 'error'), JSON.stringify(io.messages.filter(m => m.type === 'error')));
});
