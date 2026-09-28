const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../server/config');

function config(t, saved = {}, overrides = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-config-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'config.json');
    fs.writeFileSync(file, JSON.stringify(saved));
    return loadConfig({ env: { CONFIG_FILE: file, API_KEY: 'test-key', ...overrides } });
}
test('environment overrides file values and zero disables history and limits', t => {
    const result = config(t, { port: 1234, maxChatHistory: 50, apiRateLimitMax: 10 }, { PORT: '0', MAX_CHAT_HISTORY: '0', API_RATE_LIMIT_MAX: '0' });
    assert.equal(result.port, 0); assert.equal(result.maxChatHistory, 0); assert.equal(result.apiRateLimitMax, 0);
    assert.equal(result.wsMaxPayloadBytes, 8388608);
});
test('invalid security limits fail at startup', t => {
    for (const value of ['NaN', '-1', '12oops', '1.5', 'Infinity']) {
        assert.throws(() => config(t, {}, { WS_MESSAGE_RATE_MAX: value }), /WS_MESSAGE_RATE_MAX/);
    }
    assert.throws(() => config(t, {}, { HANDSHAKE_TIMEOUT_MS: '0' }), /HANDSHAKE_TIMEOUT_MS/);
    assert.throws(() => config(t, {}, { TRUST_PROXY: 'true' }), /TRUST_PROXY/);
});
test('origin lists normalize and reject paths or credentials', t => {
    assert.deepEqual(config(t, {}, { CORS_ORIGIN: 'https://table.example/, http://localhost:5173' }).corsOrigin, ['https://table.example', 'http://localhost:5173']);
    for (const value of ['https://table.example/path', 'https://user:pass@table.example', 'null']) {
        assert.throws(() => config(t, {}, { CORS_ORIGIN: value }), /CORS_ORIGIN/);
    }
});
test('configuration rejects invalid shapes and ignores unknown properties', t => {
    assert.throws(() => config(t, []), /object/);
    const result = config(t, JSON.parse('{"__proto__":{"polluted":true},"unknown":"ignored"}'));
    assert.equal(result.polluted, undefined); assert.equal(result.unknown, undefined);
});
test('DEBUG logging includes debug messages and INFO suppresses them', t => {
    const calls = [];
    t.mock.method(console, 'log', (...args) => calls.push(args));
    const { createLogger } = require('../server/logger');
    createLogger('debug').debug('visible'); createLogger('INFO').debug('hidden');
    assert.equal(calls.length, 1); assert.match(calls[0][0], /visible/);
});
