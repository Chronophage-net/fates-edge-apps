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

    test('connects and enables scaling when REDIS_URL is set and optional deps are installed', async () => {
        // ioredis/@socket.io/redis-adapter ship as real optionalDependencies
        // (package.json) and are present in a normal `npm install`/`npm ci`,
        // so this is the path CI actually exercises. The Redis host below
        // doesn't need to be reachable -- ioredis connects lazily and this
        // test only asserts initScaling's own synchronous setup (adapter
        // wiring, enabled flag), not a live round-trip -- but it MUST close
        // the clients it opens, or ioredis's background reconnect loop
        // keeps the process alive and hangs the test runner.
        let ioAdapterCalled = false;
        const fakeIo = { adapter: () => { ioAdapterCalled = true; } };
        const logger = { info: () => {}, warn: () => {}, error: () => {} };

        const result = scaling.initScaling(fakeIo, { redisUrl: 'redis://127.0.0.1:6399' }, logger, () => {});

        try {
            assert.equal(result.enabled, true);
            assert.equal(ioAdapterCalled, true, 'must wire the Socket.IO redis-adapter when enabled');
            assert.equal(typeof result.publish, 'function');
            assert.equal(scaling.isEnabled(), true);
        } finally {
            result.close && result.close();
        }
    });

    // The require()-fails fallback (REDIS_URL set but ioredis/@socket.io/redis-adapter
    // genuinely not installed -- e.g. `npm ci --omit=optional`) is exercised by
    // initScaling's try/catch around those requires; not covered here since the
    // deps are real optionalDependencies and normally present in this test
    // environment. Verified manually by temporarily removing the packages.
});
