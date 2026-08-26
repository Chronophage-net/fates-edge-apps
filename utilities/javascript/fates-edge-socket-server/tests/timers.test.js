const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const timers = require('../server/timers.js');

function makeRoom() {
    return { data: {}, lastActivity: null };
}

describe('timers.js ad-hoc timer management', () => {
    test('a fresh room has no timers', () => {
        const room = makeRoom();
        const state = timers.getPublicState(room);
        assert.deepEqual(state.timers, []);
    });

    test('createTimer() adds a timer and does not touch room.data.adventure', () => {
        const room = makeRoom();
        const state = timers.createTimer(room, { name: 'Guard Patrol', segments: 4, description: 'Reinforcements arrive' });
        assert.equal(state.timers.length, 1);
        assert.equal(state.timers[0].name, 'Guard Patrol');
        assert.equal(state.timers[0].current, 0);
        assert.equal(room.data.adventure, undefined);
    });

    test('creating a timer with the same name re-arms it', () => {
        const room = makeRoom();
        timers.createTimer(room, { name: 'Guard Patrol', segments: 4 });
        timers.tickTimer(room, { name: 'Guard Patrol', amount: 2 });
        const state = timers.createTimer(room, { name: 'Guard Patrol', segments: 6 });
        assert.equal(state.timers.length, 1);
        assert.equal(state.timers[0].segments, 6);
        assert.equal(state.timers[0].current, 0);
    });

    test('createTimer() rejects missing name or invalid segments', () => {
        const room = makeRoom();
        assert.throws(() => timers.createTimer(room, { segments: 4 }));
        assert.throws(() => timers.createTimer(room, { name: 'X', segments: 0 }));
        assert.throws(() => timers.createTimer(room, { name: 'X', segments: 'abc' }));
    });

    test('tickTimer() advances and clamps to [0, segments], and reports full', () => {
        const room = makeRoom();
        timers.createTimer(room, { name: 'Village Unrest', segments: 3 });
        let state = timers.tickTimer(room, { name: 'Village Unrest', amount: 2 });
        assert.equal(state.tickedTimer.current, 2);
        assert.equal(state.tickedTimer.full, false);

        state = timers.tickTimer(room, { name: 'Village Unrest', amount: 5 });
        assert.equal(state.tickedTimer.current, 3);
        assert.equal(state.tickedTimer.full, true);

        state = timers.tickTimer(room, { name: 'Village Unrest', amount: -10 });
        assert.equal(state.tickedTimer.current, 0);
    });

    test('tickTimer() accepts a numeric index as ref', () => {
        const room = makeRoom();
        timers.createTimer(room, { name: 'A', segments: 4 });
        const state = timers.tickTimer(room, { ref: 0, amount: 1 });
        assert.equal(state.tickedTimer.name, 'A');
        assert.equal(state.tickedTimer.current, 1);
    });

    test('tickTimer() throws for an unknown timer', () => {
        const room = makeRoom();
        assert.throws(() => timers.tickTimer(room, { name: 'Nope' }));
    });

    test('removeTimer() drops a timer outright', () => {
        const room = makeRoom();
        timers.createTimer(room, { name: 'A', segments: 4 });
        const state = timers.removeTimer(room, 'A');
        assert.equal(state.timers.length, 0);
    });

    test('resolveTimer() removes the timer and returns it for narration', () => {
        const room = makeRoom();
        timers.createTimer(room, { name: 'A', segments: 4 });
        timers.tickTimer(room, { name: 'A', amount: 4 });
        const state = timers.resolveTimer(room, 'A');
        assert.equal(state.timers.length, 0);
        assert.equal(state.resolvedTimer.name, 'A');
    });

    test('a 4th timer merges the overflow into the kept 3, preserving averaged progress', () => {
        const room = makeRoom();
        timers.createTimer(room, { name: 'Short', segments: 4 });
        timers.tickTimer(room, { name: 'Short', amount: 2 }); // 2/4 = 50%
        timers.createTimer(room, { name: 'Medium', segments: 6 });
        timers.createTimer(room, { name: 'Long', segments: 8 });
        const state = timers.createTimer(room, { name: 'Extra', segments: 4 });

        assert.equal(state.timers.length, 3);
        const merged = state.timers.find(t => t.merged);
        assert.ok(merged, 'expected a merged timer among the kept 3');
        assert.ok(merged.name.startsWith('Merged: '));
    });

    test('applyDeckDrawToTimers() ticks one random timer on an Ace, all timers on a Crown Spread', () => {
        const room = makeRoom();
        timers.createTimer(room, { name: 'A', segments: 10 });
        timers.createTimer(room, { name: 'B', segments: 10 });

        const aceTicked = timers.applyDeckDrawToTimers(room, { cards: [{ rank: 'A' }] });
        assert.equal(aceTicked.length, 1);

        const crownTicked = timers.applyDeckDrawToTimers(room, { type: 'crown' });
        assert.equal(crownTicked.length, 2);
    });

    test('applyDeckDrawToTimers() is a no-op with no timers or no matching draw', () => {
        const room = makeRoom();
        assert.deepEqual(timers.applyDeckDrawToTimers(room, { cards: [{ rank: 'A' }] }), []);
        timers.createTimer(room, { name: 'A', segments: 10 });
        assert.deepEqual(timers.applyDeckDrawToTimers(room, { cards: [{ rank: '5' }] }), []);
    });
});
