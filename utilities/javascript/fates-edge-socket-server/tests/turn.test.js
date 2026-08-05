const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const turn = require('../server/turn.js');

function baseConfig(overrides = {}) {
    return {
        turnSecret: 'test-shared-secret',
        turnUrls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
        turnCredentialTtl: 3600,
        ...overrides
    };
}

describe('turn.js mintCredentials()', () => {
    test('returns null when TURN is not configured (no secret)', () => {
        assert.equal(turn.mintCredentials({ turnUrls: ['turn:x:3478'] }, 'alice'), null);
    });

    test('returns null when TURN is not configured (no urls)', () => {
        assert.equal(turn.mintCredentials({ turnSecret: 'x', turnUrls: [] }, 'alice'), null);
    });

    test('returns null for a completely empty/missing config', () => {
        assert.equal(turn.mintCredentials(null, 'alice'), null);
        assert.equal(turn.mintCredentials(undefined, 'alice'), null);
    });

    test('mints one iceServers entry per configured TURN URL, all sharing the same username/credential', () => {
        const result = turn.mintCredentials(baseConfig(), 'alice');
        assert.ok(result);
        assert.equal(result.iceServers.length, 2);
        assert.equal(result.iceServers[0].urls, 'turn:turn.example.com:3478');
        assert.equal(result.iceServers[1].urls, 'turns:turn.example.com:5349');
        assert.equal(result.iceServers[0].username, result.iceServers[1].username);
        assert.equal(result.iceServers[0].credential, result.iceServers[1].credential);
        assert.equal(result.ttl, 3600);
    });

    test('username follows the coturn "<expiry>:<label>" convention', () => {
        const before = Math.floor(Date.now() / 1000);
        const result = turn.mintCredentials(baseConfig(), 'bob');
        const after = Math.floor(Date.now() / 1000);

        const [expiryStr, label] = result.iceServers[0].username.split(':');
        const expiry = parseInt(expiryStr, 10);
        assert.equal(label, 'bob');
        assert.ok(expiry >= before + 3600 && expiry <= after + 3600, 'expiry should be now + ttl');
    });

    test('credential is base64(HMAC-SHA1(secret, username)) -- matches what coturn itself validates', () => {
        const config = baseConfig();
        const result = turn.mintCredentials(config, 'carol');
        const username = result.iceServers[0].username;
        const expected = crypto.createHmac('sha1', config.turnSecret).update(username).digest('base64');
        assert.equal(result.iceServers[0].credential, expected);
    });

    test('sanitizes labels so a malicious/odd clientId cannot break the "expiry:label" parse', () => {
        const result = turn.mintCredentials(baseConfig(), 'weird:id/with spaces&stuff');
        const [, label] = result.iceServers[0].username.split(':');
        assert.doesNotMatch(label, /[^a-zA-Z0-9_-]/);
    });

    test('falls back to "anon" when no label is given', () => {
        const result = turn.mintCredentials(baseConfig());
        assert.match(result.iceServers[0].username, /:anon$/);
    });

    test('two mints for different labels at the same instant produce different credentials', () => {
        const a = turn.mintCredentials(baseConfig(), 'alice');
        const b = turn.mintCredentials(baseConfig(), 'bob');
        assert.notEqual(a.iceServers[0].username, b.iceServers[0].username);
        assert.notEqual(a.iceServers[0].credential, b.iceServers[0].credential);
    });
});
