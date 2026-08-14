const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
    createRateLimiter,
    createConnectionMessageLimiter,
} = require('../server/security.js');

/**
 * Neither of these limiters had any dedicated test coverage before this --
 * createRateLimiter() (in use since the auth routes' login/register
 * limiters) was only ever exercised indirectly through manual testing of
 * those routes, and createConnectionMessageLimiter() is new. Both are pure
 * enough to unit test without spinning up a real HTTP/WebSocket server.
 */

// ─── createRateLimiter() (HTTP, per-IP) ───────────────────────────────
describe('security.js createRateLimiter()', () => {
    function fakeReqRes(ip) {
        const res = {
            statusCode: null,
            headers: {},
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; },
            setHeader(name, value) { this.headers[name] = value; },
        };
        const req = { ip };
        return { req, res };
    }

    test('allows requests under the max', () => {
        const limiter = createRateLimiter({ windowMs: 60000, max: 3 });
        const { req, res } = fakeReqRes('1.2.3.4');
        let nextCalls = 0;
        for (let i = 0; i < 3; i++) {
            limiter(req, res, () => { nextCalls++; });
        }
        assert.equal(nextCalls, 3);
        assert.equal(res.statusCode, null, 'must not have rejected any of the first 3 requests');
        limiter._stop();
    });

    test('rejects with 429 once the max is exceeded, and sets Retry-After', () => {
        const limiter = createRateLimiter({ windowMs: 60000, max: 2, message: 'slow down' });
        const { req, res } = fakeReqRes('5.6.7.8');
        let nextCalls = 0;
        const next = () => { nextCalls++; };

        limiter(req, res, next);
        limiter(req, res, next);
        assert.equal(nextCalls, 2);

        limiter(req, res, next);
        assert.equal(nextCalls, 2, 'the 3rd request must NOT reach next()');
        assert.equal(res.statusCode, 429);
        assert.deepEqual(res.body, { error: 'slow down' });
        assert.ok(res.headers['Retry-After'] !== undefined);
        limiter._stop();
    });

    test('tracks separate IPs independently', () => {
        const limiter = createRateLimiter({ windowMs: 60000, max: 1 });
        const a = fakeReqRes('10.0.0.1');
        const b = fakeReqRes('10.0.0.2');
        let allowed = 0;
        limiter(a.req, a.res, () => allowed++);
        limiter(b.req, b.res, () => allowed++);
        assert.equal(allowed, 2, 'two distinct IPs must each get their own budget');
        limiter._stop();
    });

    test('falls back to a fixed key ("unknown") when req.ip is missing, rather than throwing', () => {
        const limiter = createRateLimiter({ windowMs: 60000, max: 1 });
        const res = { status() { return this; }, json() { return this; }, setHeader() {} };
        assert.doesNotThrow(() => limiter({}, res, () => {}));
        limiter._stop();
    });

    test('resets after the window elapses', () => {
        const limiter = createRateLimiter({ windowMs: 10, max: 1 });
        const { req, res } = fakeReqRes('9.9.9.9');
        let allowed = 0;
        limiter(req, res, () => allowed++);
        return new Promise((resolve) => {
            setTimeout(() => {
                limiter(req, res, () => allowed++);
                assert.equal(allowed, 2, 'a fresh window must allow another request');
                limiter._stop();
                resolve();
            }, 20);
        });
    });
});

// ─── createConnectionMessageLimiter() (WebSocket, per-connection) ─────
describe('security.js createConnectionMessageLimiter()', () => {
    test('allows messages under the max, using a caller-supplied state object', () => {
        const checkRate = createConnectionMessageLimiter({ windowMs: 60000, max: 3 });
        const state = {};
        assert.equal(checkRate(state), true);
        assert.equal(checkRate(state), true);
        assert.equal(checkRate(state), true);
    });

    test('rejects once the max is exceeded within the window', () => {
        const checkRate = createConnectionMessageLimiter({ windowMs: 60000, max: 2 });
        const state = {};
        assert.equal(checkRate(state), true);
        assert.equal(checkRate(state), true);
        assert.equal(checkRate(state), false, '3rd message in the same window must be rejected');
        assert.equal(checkRate(state), false, 'still rejected once over the cap, not just the first excess message');
    });

    test('two independent state objects (two connections) never share a counter', () => {
        const checkRate = createConnectionMessageLimiter({ windowMs: 60000, max: 1 });
        const connA = {};
        const connB = {};
        assert.equal(checkRate(connA), true);
        assert.equal(checkRate(connB), true, 'a different connection\'s state must have its own fresh budget');
        assert.equal(checkRate(connA), false);
    });

    test('resets after the window elapses', () => {
        const checkRate = createConnectionMessageLimiter({ windowMs: 10, max: 1 });
        const state = {};
        assert.equal(checkRate(state), true);
        assert.equal(checkRate(state), false);
        return new Promise((resolve) => {
            setTimeout(() => {
                assert.equal(checkRate(state), true, 'a fresh window must allow another message');
                resolve();
            }, 20);
        });
    });

    test('never throws if the caller forgets to pass a state object', () => {
        const checkRate = createConnectionMessageLimiter({ windowMs: 60000, max: 1 });
        assert.doesNotThrow(() => checkRate(undefined));
        assert.equal(checkRate(undefined), true, 'defensive default: fail open, not closed, on a caller bug');
    });
});
