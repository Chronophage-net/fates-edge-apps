const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const scaling = require('../server/scaling.js');

describe('scaling.js initScaling()', () => {
    test('is a complete no-op when REDIS_URL is not configured', () => {
        let ioAdapterCalled = false;
        const fakeIo = { adapter: () => { ioAdapterCalled = true; } };
        const logger = { info: () => {}, warn: () => {}, error: () => {} };

        const result = scaling.initScaling(fakeIo, { redisUrl: null }, logger, () => {});

        assert.deepEqual(result, { enabled: false });
        assert.equal(ioAdapterCalled, false, 'must not touch the Socket.IO adapter without REDIS_URL');
        assert.equal(scaling.isEnabled(), false);
    });

    test('falls back gracefully (does not throw) when REDIS_URL is set but optional deps are missing', () => {
        // In this test environment ioredis/@socket.io/redis-adapter are not
        // installed (they're optionalDependencies) -- initScaling must catch
        // that require() failure and behave like the disabled case rather
        // than crashing the server.
        let ioAdapterCalled = false;
        const fakeIo = { adapter: () => { ioAdapterCalled = true; } };
        const errors = [];
        const logger = { info: () => {}, warn: () => {}, error: (msg) => errors.push(msg) };

        const result = scaling.initScaling(fakeIo, { redisUrl: 'redis://localhost:6379' }, logger, () => {});

        assert.equal(result.enabled, false);
        assert.equal(ioAdapterCalled, false);
        assert.ok(errors.length > 0, 'should log a helpful error explaining the missing optional deps');
    });
});
