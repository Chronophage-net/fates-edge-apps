const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const room = require('../server/room.js');

describe('room.recordChatMessage (rolling chat-history window)', () => {
    test('pushes messages in order and trims to maxHistory', () => {
        const r = { chatHistory: [] };
        for (let i = 1; i <= 5; i++) {
            room.recordChatMessage(r, { text: `msg ${i}`, id: `m${i}` }, 3);
        }
        // Only the last 3 survive, oldest-first.
        assert.deepEqual(r.chatHistory.map(m => m.id), ['m3', 'm4', 'm5']);
    });

    test('accepts the {message: {...}} wrapper shape both transports send', () => {
        const r = { chatHistory: [] };
        room.recordChatMessage(r, { message: { text: 'hi', id: 'm1' }, room: 'AC12' }, 10);
        // Only ever called with data.message || data by the two handlers --
        // recordChatMessage itself just stores whatever object it's given,
        // so this confirms the wrapper's inner object is what a caller
        // should pass, not the whole {message, room} envelope.
        room.recordChatMessage(r, ({ message: { text: 'hi2', id: 'm2' } }).message, 10);
        assert.equal(r.chatHistory.length, 2);
        assert.equal(r.chatHistory[1].text, 'hi2');
    });

    test('maxHistory <= 0 disables storage entirely (no-op)', () => {
        const r = { chatHistory: [] };
        room.recordChatMessage(r, { text: 'should not be stored' }, 0);
        assert.equal(r.chatHistory.length, 0);
    });

    test('ignores non-object messages without throwing', () => {
        const r = { chatHistory: [] };
        assert.doesNotThrow(() => room.recordChatMessage(r, null, 10));
        assert.doesNotThrow(() => room.recordChatMessage(r, undefined, 10));
        assert.doesNotThrow(() => room.recordChatMessage(r, 'not an object', 10));
        assert.equal(r.chatHistory.length, 0);
    });

    test('lazily initializes chatHistory if missing on the room object', () => {
        const r = {}; // e.g. a room created before this feature existed
        room.recordChatMessage(r, { text: 'first' }, 10);
        assert.equal(r.chatHistory.length, 1);
    });

    test('a fresh room from createRoom() starts with an empty chatHistory array', () => {
        const created = room.createRoom('CHTT');
        assert.deepEqual(created.chatHistory, []);
        room.rooms.delete('CHTT'); // don't leak state into other test files
    });
});
