const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * assistant-suggestion-created/-resolved are plain pass-through relay
 * events (fates-edge-ai-gm-bot's modules/assistant-suggestions.js
 * broadcasts them; clients render them) -- same wiring style as
 * tts-audio/soundboard-ambience, so this is a source-level guard rather
 * than a live-connection test, matching that pair's own test coverage
 * style (see room-cap-and-rate-limit-wiring.test.js for the identical
 * rationale applied to a different pair of features).
 */

const wsSrc = fs.readFileSync(path.join(__dirname, '../server/ws-handlers.js'), 'utf8');
const ioSrc = fs.readFileSync(path.join(__dirname, '../server/socketio-handlers.js'), 'utf8');

describe('ws-handlers.js assistant-suggestion relay', () => {
    test('relays assistant-suggestion-created via broadcastToRoom', () => {
        assert.match(wsSrc, /case 'assistant-suggestion-created':/);
    });

    test('relays assistant-suggestion-resolved via broadcastToRoom', () => {
        assert.match(wsSrc, /case 'assistant-suggestion-resolved':/);
    });

    test('both cases fall into the same broadcastToRoom(roomKey, messageType, data, ws.clientId) block as tts-audio', () => {
        const idx = wsSrc.indexOf("case 'assistant-suggestion-created':");
        assert.ok(idx !== -1);
        const block = wsSrc.slice(idx, idx + 300);
        assert.match(block, /case 'assistant-suggestion-resolved':/);
        assert.match(block, /room\.broadcastToRoom\(roomKey, messageType, data, ws\.clientId\);/);
    });
});

describe('socketio-handlers.js assistant-suggestion relay', () => {
    test('both events are listed in the relayEvents pass-through array', () => {
        const arrayMatch = ioSrc.match(/const relayEvents = \[[\s\S]*?\];/);
        assert.ok(arrayMatch, 'relayEvents array not found');
        assert.match(arrayMatch[0], /'assistant-suggestion-created'/);
        assert.match(arrayMatch[0], /'assistant-suggestion-resolved'/);
    });
});
