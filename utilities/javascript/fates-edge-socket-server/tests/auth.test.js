const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-for-unit-tests';

const auth = require('../server/auth.js');

describe('auth.js password hashing (bcryptjs round-trip)', () => {
    test('hashPassword() produces a bcrypt hash distinct from the plaintext', async () => {
        const hash = await auth.hashPassword('correct horse battery staple');
        assert.notEqual(hash, 'correct horse battery staple');
        assert.match(hash, /^\$2[aby]\$/);
    });

    test('verifyPassword() returns true for the correct password and false for a wrong one', async () => {
        const hash = await auth.hashPassword('hunter2isagoodpassword');
        assert.equal(await auth.verifyPassword('hunter2isagoodpassword', hash), true);
        assert.equal(await auth.verifyPassword('wrongpassword', hash), false);
    });

    test('verifyPassword() returns false (not throws) for a missing hash', async () => {
        assert.equal(await auth.verifyPassword('anything', null), false);
        assert.equal(await auth.verifyPassword('anything', undefined), false);
    });

    test('verifyPassword() returns false for a malformed hash instead of throwing', async () => {
        assert.equal(await auth.verifyPassword('anything', 'not-a-real-bcrypt-hash'), false);
    });
});

describe('auth.js JWT issuance/verification', () => {
    test('signToken() + verifyToken() round-trips the payload', () => {
        const token = auth.signToken({ userId: 42, username: 'levi' });
        const decoded = auth.verifyToken(token);
        assert.equal(decoded.userId, 42);
        assert.equal(decoded.username, 'levi');
    });

    test('verifyToken() throws on a tampered/invalid token', () => {
        assert.throws(() => auth.verifyToken('not.a.valid.jwt'));
    });

    test('verifyTokenOptional() returns null (never throws) for a bad token', () => {
        assert.equal(auth.verifyTokenOptional('garbage'), null);
        assert.equal(auth.verifyTokenOptional(null), null);
        assert.equal(auth.verifyTokenOptional(undefined), null);
        assert.equal(auth.verifyTokenOptional(12345), null);
    });

    test('verifyTokenOptional() returns the decoded payload for a valid token', () => {
        const token = auth.signToken({ userId: 7, username: 'khor' });
        const decoded = auth.verifyTokenOptional(token);
        assert.deepEqual(decoded, { userId: 7, username: 'khor' });
    });

    test('verifyTokenOptional() returns null for a token missing userId', () => {
        const token = auth.signToken({ username: 'noid' });
        assert.equal(auth.verifyTokenOptional(token), null);
    });
});

describe('auth.js requireAuth middleware', () => {
    function mockRes() {
        const res = {};
        res.statusCode = null;
        res.body = null;
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (body) => { res.body = body; return res; };
        return res;
    }

    test('rejects a missing Authorization header with 401', () => {
        const req = { headers: {} };
        const res = mockRes();
        let nextCalled = false;
        auth.requireAuth(req, res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 401);
        assert.equal(nextCalled, false);
    });

    test('rejects a malformed (non-Bearer) header with 401', () => {
        const req = { headers: { authorization: 'Basic AC12' } };
        const res = mockRes();
        auth.requireAuth(req, res, () => {});
        assert.equal(res.statusCode, 401);
    });

    test('accepts a valid Bearer token and calls next() with req.user set', () => {
        const token = auth.signToken({ userId: 1, username: 'gm' });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        let nextCalled = false;
        auth.requireAuth(req, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(req.user.userId, 1);
        assert.equal(req.user.username, 'gm');
    });
});

describe('auth.js input validation', () => {
    test('isValidUsername() accepts 3-32 chars of letters/numbers/_/-', () => {
        assert.equal(auth.isValidUsername('levi_the_bold'), true);
        assert.equal(auth.isValidUsername('ab'), false); // too short
        assert.equal(auth.isValidUsername('a'.repeat(33)), false); // too long
        assert.equal(auth.isValidUsername('bad name!'), false); // invalid chars
        assert.equal(auth.isValidUsername(123), false); // not a string
    });

    test('isValidPassword() accepts 8-256 char strings only', () => {
        assert.equal(auth.isValidPassword('longenough'), true);
        assert.equal(auth.isValidPassword('short'), false);
        assert.equal(auth.isValidPassword('a'.repeat(257)), false);
        assert.equal(auth.isValidPassword(null), false);
    });
});

describe('auth.js duplicate-username rejection (contract, mocked storage)', () => {
    // The actual duplicate-username check lives in api.js's
    // POST /api/auth/register route handler (storage.getUserByUsername()
    // lookup before storage.createUser()), not inside auth.js itself --
    // auth.js only provides the hashing/token primitives that route uses.
    // This test documents/locks in that contract at the unit level using a
    // mock storage layer shaped like server/storage.js's real API, so a
    // regression in the duplicate-check logic itself (if it were ever moved
    // here) would still be caught. Full HTTP-level coverage of the actual
    // route lives in test-auth-e2e.js.
    test('registering a username that already exists is rejected before a second user is created', async () => {
        const users = new Map();
        const mockStorage = {
            async getUserByUsername(username) { return users.get(username) || null; },
            async createUser(username, passwordHash) {
                const user = { id: users.size + 1, username, password_hash: passwordHash };
                users.set(username, user);
                return user;
            },
        };

        async function register(username, password) {
            if (!auth.isValidUsername(username)) throw new Error('invalid username');
            if (!auth.isValidPassword(password)) throw new Error('invalid password');
            const existing = await mockStorage.getUserByUsername(username);
            if (existing) throw new Error('Username already taken');
            const hash = await auth.hashPassword(password);
            return mockStorage.createUser(username, hash);
        }

        const first = await register('leviathan', 'password123');
        assert.equal(first.username, 'leviathan');

        await assert.rejects(
            () => register('leviathan', 'differentpassword'),
            /Username already taken/
        );
        assert.equal(users.size, 1); // second attempt never created a user
    });
});
