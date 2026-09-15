'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const adventure = require('../server/adventure');
const recovery = require('../server/adventure-recovery');
const rooms = require('../server/room');
const copy = value => JSON.parse(JSON.stringify(value));
const content = { title: 'Recovery fixture', acts: Array.from({ length: 3 }, (_, i) => ({ title: `Act ${i}`, scenes: [0, 1].map(j => ({ title: `Scene ${j}`, timers: [{ name: 'Danger', current: 0, segments: 4 }], encounters: [{ name: 'Guard', dv: 2 }] })) })), campaignTimers: [{ name: 'Pursuit', current: 0, segments: 6 }], knowledge: [{ id: 'secret', gm: 'A hidden traitor', player: 'A trusted guide', revealed: false }] };
function fixture() {
    const room = { room_id: 'room-one', data: {} };
    adventure.loadAdventureContent(room, content, { id: 'custom_recovery', dynamicGrowth: true });
    adventure.advanceScene(room, { actIndex: 2, sceneIndex: 1 });
    // Use the engine's actual index fields, independent of the request transport.
    room.data.adventure.currentAct = 2; room.data.adventure.currentScene = 1;
    room.data.adventure.module.campaignTimers[0].current = 2;
    room.data.adventure.module.acts[2].scenes[1].timers[0].current = 3;
    adventure.startEncounter(room, 0);
    adventure.revealKnowledge(room, 'secret');
    adventure.appendScene(room, 2, { title: 'Appended scene' });
    room.data.timers = { list: [{ name: 'Alarm', current: 2, segments: 4 }], log: [], updatedAt: 5 };
    return room;
}
test('full crash recovery round trips custom content, all progress and timers; replay, append and reset work', () => {
    const room = fixture();
    const snapshot = recovery.full(room);
    const before = copy(room.data);
    room.data = {}; // All ephemeral server state is lost, including custom source content.
    assert.equal(recovery.restore(room, snapshot).ok, true);
    assert.deepEqual(room.data, before);
    assert.equal(recovery.restore(room, snapshot).unchanged, true);
    assert.deepEqual({ ...recovery.full(room), savedAt: snapshot.savedAt }, snapshot);
    const count = room.data.adventure.module.acts[2].scenes.length;
    adventure.appendScene(room, 2, { title: 'After recovery' });
    assert.equal(room.data.adventure.module.acts[2].scenes.length, count + 1);
    assert.throws(() => recovery.restore(room, snapshot), e => e.status === 409);
    assert.equal(recovery.restore(room, snapshot, { force: true }).ok, true);
    adventure.resetAdventure(room);
    assert.equal(room.data.adventure.status, 'planned');
    assert.equal(room.data.adventure.currentAct, 0);
    assert.equal(room.data.adventure.currentScene, 0);
    assert.equal(room.data.adventure.module.id, snapshot.moduleId);
});
test('invalid snapshots leave the entire live room untouched, including force attempts', () => {
    const room = fixture(); const before = copy(room.data); const snapshot = recovery.full(room);
    const cases = [
        [s => delete s.moduleId, 400], [s => { s.roomId = 'other'; }, 403],
        [s => { s.snapshotVersion = 99; }, 400], [s => { s.customAdventures = []; }, 404],
        [s => { s.currentAct = 900; }, 400], [s => { s.currentScene = -1; }, 400],
        [s => { s.module.knowledge[0].revealed = 'yes'; }, 400],
        [s => { s.adhocTimers.list[0].current = 900; }, 400],
        [s => { s.climaxTriggered = true; }, 400],
        [s => { s.activeEncounterRef.index = 999; }, 400],
        [s => { s.moduleId = '../escape'; }, 400]
    ];
    for (const [mutate, status] of cases) {
        const bad = copy(snapshot); mutate(bad);
        assert.throws(() => recovery.restore(room, bad, { force: true }), e => e.status === status);
        assert.deepEqual(room.data, before);
    }
});
test('manifest modules restore from the installed adventure directory; missing files fail', () => {
    const room = { room_id: 'manifest-room', data: {} };
    adventure.loadAdventureModule(room, 'grumbling_vault');
    const snapshot = recovery.full(room); room.data = {};
    assert.equal(recovery.restore(room, snapshot).ok, true);
    const missing = copy(snapshot); missing.moduleSourceId = 'not_an_installed_adventure';
    assert.throws(() => recovery.restore(room, missing, { force: true }), e => e.status === 404);
});
test('full is read-only and returns an isolated copy; empty rooms do not acquire state', () => {
    const empty = { room_id: 'empty' }; assert.equal(recovery.full(empty), null); assert.equal(empty.data, undefined);
    const room = fixture(); const before = copy(room);
    const snapshot = recovery.full(room); snapshot.module.knowledge[0].gm = 'tampered';
    assert.deepEqual(room, before);
});
test('HTTP snapshot endpoints require authentication and recover across a rotated room code', async t => {
    const express = require('express');
    const { createApiRouter } = require('../server/api');
    const app = express(); app.use(express.json({ limit: '5mb' }));
    app.use(createApiRouter({ apiKey: 'recovery-test-key', healthEndpoint: '/health' }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const live = rooms.createRoom('RCV123');
    adventure.loadAdventureContent(live, content, { id: 'custom_http' });
    adventure.revealKnowledge(live, 'secret');
    const url = `http://127.0.0.1:${server.address().port}/api/rooms/${live.room_id}/adventure`;
    assert.equal((await fetch(url + '/full')).status, 401);
    assert.equal((await fetch(url + '/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    const headers = { 'x-api-key': 'recovery-test-key', 'Content-Type': 'application/json' };
    const snapshot = await (await fetch(url + '/full', { headers })).json();
    assert.equal(snapshot.module.knowledge[0].gm, 'A hidden traitor');
    assert.equal(snapshot.module.knowledge[0].revealed, true);
    rooms.rotateRoomCode(live.room_id, 'RCV456'); live.data = {};
    const result = await fetch(url + '/restore', { method: 'POST', headers, body: JSON.stringify({ snapshot }) });
    assert.equal(result.status, 200, await result.text());
    assert.equal(live.data.adventure.module.id, 'custom_http');
    rooms.rooms.delete(live.room_id);
});
