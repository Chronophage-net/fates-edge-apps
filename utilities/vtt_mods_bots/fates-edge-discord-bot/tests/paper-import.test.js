const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PaperImports, deliverOperations } = require('../utils/paper-import');
const ctx = { user: 'u', guild: 'g', channel: 'c', room: 'ROOM', server: 'ws://test', connection: 'conn' };
const text = '=== Character ===\nName: Rowan\nBody: I\nSkills: Lore=2';

test('shared parser preview reports OCR corrections and creates stable operations', async () => {
    const sessions = new PaperImports();
    const result = await sessions.preview(text, ctx);
    assert.match(result.report, /I → 1/);
    assert.equal(result.count, 1);
    const operations = sessions.take(result.token, ctx);
    assert.equal(operations[0].value.body, 1);
    assert.equal(operations[0].value.skills.lore, 2);
    assert.equal(operations[0].value.totalXp, 32);
    assert.match(result.report, new RegExp(operations[0].value.id));
    assert.throws(() => sessions.take(result.token, ctx), /already used/);
});

test('invalid mixed input and ID updates never offer an import button', async () => {
    for (const input of [text + '\nUnknown: x', text + '\nID: existing', text + '\n=== Timer ===\nName: Bad clock\nSegments: 5']) {
        const result = await new PaperImports().preview(input, ctx);
        assert.equal(result.token, null);
    }
});

test('preview expiration, replacement and context binding prevent stale confirmations', async () => {
    let now = 100;
    const sessions = new PaperImports({ now: () => now });
    const first = await sessions.preview(text, ctx);
    for (const key of Object.keys(ctx)) {
        assert.throws(() => sessions.take(first.token, { ...ctx, [key]: 'other' }), /changed/);
    }
    const second = await sessions.preview(text, ctx);
    assert.throws(() => sessions.take(first.token, ctx));
    now += 300001;
    assert.throws(() => sessions.take(second.token, ctx), /expired/);
});

test('input and entry limits are enforced', async () => {
    const sessions = new PaperImports();
    await assert.rejects(sessions.preview('x'.repeat(4001), ctx), /4,000/);
    await assert.rejects(sessions.preview(Array(11).fill('=== Character ===\nName: X').join('\n'), ctx), /10 entries/);
});

test('delivery stops after uncertain entry without retrying or sending the remainder', async () => {
    let calls = 0;
    const vtt = { connected: true, roomCode: ctx.room, clientId: ctx.connection, config: { serverUrl: ctx.server },
        async sendPaperOperation() { if (++calls === 2) throw new Error('timeout'); } };
    assert.deepEqual(await deliverOperations(vtt, [{}, {}, {}], ctx), { confirmed: 1, total: 3, uncertain: true });
    assert.equal(calls, 2);
});

test('changing rooms mid-import stops subsequent entries', async () => {
    let calls = 0;
    const vtt = { connected: true, roomCode: ctx.room, clientId: ctx.connection, config: { serverUrl: ctx.server },
        async sendPaperOperation() { calls++; this.roomCode = 'OTHER'; } };
    assert.deepEqual(await deliverOperations(vtt, [{}, {}], ctx), { confirmed: 1, total: 2, uncertain: false });
    assert.equal(calls, 1);
});
