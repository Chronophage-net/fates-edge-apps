const { test } = require('node:test');
const assert = require('node:assert/strict');
const room = require('../server/room');
const side = require('../server/side-tasks');
function setup(code) {
    const source = room.createRoom(code);
    const gm = { id: 'gm', userId: '100', name: 'Human', role: 'gm' };
    const bot = { id: 'bot', role: 'assistant-gm' };
    source.clients.set(gm.id, gm); source.clients.set(bot.id, bot);
    source.clients.set('player', { id: 'player', userId: '200', role: 'player' });
    return { source, gm, bot };
}
test('only a granted host and signed-in human GM can provision invited side rooms', () => {
    const { source, bot } = setup('ST01');
    const data = { action: 'open', taskId: 'task-0001', supervisorClientId: 'gm', participants: ['200'] };
    assert.throws(() => side.request(source, { id: 'player', role: 'player' }, data));
    assert.throws(() => side.request(source, bot, { ...data, supervisorClientId: 'player' }));
    assert.throws(() => side.request(source, bot, { ...data, participants: ['999'] }));
    const result = side.request(source, bot, data);
    const target = room.rooms.get(result.room);
    assert.equal(side.access(target, { userId: '200' }).allowed, true);
    assert.equal(side.access(target, { userId: '100' }).role, 'co-gm');
    assert.equal(side.access(target, { userId: '999' }).allowed, false);
    assert.equal(side.access(target, null).allowed, false);
    assert.equal(side.access(target, null, { sideTaskId: result.taskId, delegationToken: result.delegationToken }).role, 'gm');
    assert.equal(side.access({ }, null, { sideTaskId: result.taskId, delegationToken: result.delegationToken }).allowed, false);
    assert.throws(() => side.request(source, bot, data));
    const reopened = side.request(source, bot, { ...data, delegationToken: result.delegationToken });
    assert.equal(reopened.room, result.room);
    side.request(source, bot, { action: 'close', taskId: result.taskId, delegationToken: result.delegationToken });
    assert.equal(side.access(target, { userId: '200' }).allowed, false);
    room.rooms.delete(source.code);
});

test('reports reach only the supervising GM and never fall back to public delivery', () => {
    const { source, bot, gm } = setup('ST02');
    const result = side.request(source, bot, { action: 'open', taskId: 'task-0002', supervisorClientId: 'gm', participants: ['200'] });
    const sent = [];
    const capture = id => ({ readyState: 1, send: data => sent.push({ id, data: JSON.parse(data) }) });
    Object.assign(gm, { type: 'ws', ws: capture('gm') });
    Object.assign(source.clients.get('player'), { type: 'ws', ws: capture('player') });
    const report = { action: 'report', taskId: result.taskId, delegationToken: result.delegationToken, text: 'Private outcome' };
    assert.equal(side.request(source, bot, report).delivered, 1);
    assert.deepEqual(sent.map(x => x.id), ['gm']);
    source.clients.delete('gm'); sent.length = 0;
    assert.equal(side.request(source, bot, report).delivered, 0);
    assert.equal(sent.length, 0);
    assert.throws(() => side.request(source, { id: 'other', role: 'gm' }, report));
    side.request(source, bot, { ...report, action: 'close' });
    room.rooms.delete(source.code);
});
