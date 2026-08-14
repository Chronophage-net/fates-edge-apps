const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * The actual rate-limiting/room-cap LOGIC is unit-tested directly in
 * security.test.js (createRateLimiter, createConnectionMessageLimiter).
 * What's covered here is that the two transport handlers and the API
 * router actually WIRE that logic in at the right point -- a full
 * integration test would require spinning up real ws/Socket.IO
 * connections and an HTTP server, which this test suite doesn't do
 * anywhere else either (see get-clients.test.js's identical rationale
 * for this same source-level-guard style).
 */

const apiSrc = fs.readFileSync(path.join(__dirname, '../server/api.js'), 'utf8');
const ioSrc = fs.readFileSync(path.join(__dirname, '../server/socketio-handlers.js'), 'utf8');
const wsSrc = fs.readFileSync(path.join(__dirname, '../server/ws-handlers.js'), 'utf8');

describe('api.js general rate limiting', () => {
    test('mounts a general rate limiter via router.use(), gated on config.apiRateLimitMax', () => {
        assert.match(apiSrc, /router\.use\(createRateLimiter\(/);
        assert.match(apiSrc, /config\.apiRateLimitMax > 0/);
    });

    test('the general limiter is registered AFTER the health-check routes (so health checks are never throttled)', () => {
        const healthIdx = apiSrc.indexOf(`router.get(config.healthEndpoint`);
        const limiterIdx = apiSrc.indexOf('router.use(createRateLimiter(');
        assert.ok(healthIdx !== -1, 'health route not found');
        assert.ok(limiterIdx !== -1, 'general rate limiter not found');
        assert.ok(healthIdx < limiterIdx, 'health routes must be registered before the general rate limiter middleware');
    });
});

describe('socketio-handlers.js per-connection message rate limiting', () => {
    test('gates inbound events via socket.use(), keyed off config.wsMessageRateMax', () => {
        assert.match(ioSrc, /ioConfig\.wsMessageRateMax > 0/);
        assert.match(ioSrc, /socket\.use\(\(packet, next\)/);
        assert.match(ioSrc, /checkMessageRate\(rateState\)/);
    });

    test('a rate-limited packet calls next(err) rather than dropping the connection', () => {
        const match = ioSrc.match(/socket\.use\(\(packet, next\) => \{[\s\S]{0,200}?\}\);/);
        assert.ok(match, 'socket.use gate block not found');
        assert.match(match[0], /next\(new Error\(/);
        assert.doesNotMatch(match[0], /socket\.disconnect/);
    });
});

describe('socketio-handlers.js per-room client cap', () => {
    test('checks currentRoom.clients.size against ioConfig.maxClientsPerRoom before joining', () => {
        assert.match(ioSrc, /ioConfig\.maxClientsPerRoom > 0 && currentRoom\.clients\.size >= ioConfig\.maxClientsPerRoom/);
    });

    test('the cap check runs BEFORE the client is added to the room', () => {
        const capIdx = ioSrc.indexOf('ioConfig.maxClientsPerRoom > 0');
        const setIdx = ioSrc.indexOf('currentRoom.clients.set(socket.id, socket.clientData)');
        assert.ok(capIdx !== -1 && setIdx !== -1);
        assert.ok(capIdx < setIdx, 'the room-full check must run before the client is actually added');
    });

    test('rejects with a ROOM_FULL error code and disconnects, matching the ban/password rejection pattern', () => {
        const idx = ioSrc.indexOf('ioConfig.maxClientsPerRoom > 0');
        assert.ok(idx !== -1);
        const block = ioSrc.slice(idx, idx + 400);
        assert.match(block, /code:\s*'ROOM_FULL'/);
        assert.match(block, /socket\.disconnect\(true\)/);
    });
});

describe('ws-handlers.js per-connection message rate limiting', () => {
    test('gates every inbound message before the switch dispatch, keyed off config.wsMessageRateMax', () => {
        assert.match(wsSrc, /wssConfig\.wsMessageRateMax > 0/);
        assert.match(wsSrc, /checkMessageRate && !checkMessageRate\(rateLimitState\)/);
    });

    test('the rate-limit gate runs before JSON.parse/switch dispatch, and does not close the connection', () => {
        const idx = wsSrc.indexOf('checkMessageRate && !checkMessageRate(rateLimitState)');
        const parseIdx = wsSrc.indexOf('JSON.parse(message)');
        assert.ok(idx !== -1 && parseIdx !== -1);
        assert.ok(idx < parseIdx, 'rate-limit gate must run before parsing/dispatching the message');
        const match = wsSrc.match(/checkMessageRate && !checkMessageRate\(rateLimitState\) \{[\s\S]{0,300}?\}/);
        // (fallback if the exact brace isn't matched, still assert no ws.close in the gate)
        const gateBlock = wsSrc.slice(idx, idx + 400);
        assert.doesNotMatch(gateBlock, /ws\.close/);
    });
});

describe('ws-handlers.js per-room client cap', () => {
    test('checks currentRoom.clients.size against wssConfig.maxClientsPerRoom at connection time', () => {
        assert.match(wsSrc, /wssConfig\.maxClientsPerRoom > 0 && currentRoom\.clients\.size >= wssConfig\.maxClientsPerRoom/);
    });

    test('the cap check runs BEFORE the client is added to the room', () => {
        const capIdx = wsSrc.indexOf('wssConfig.maxClientsPerRoom > 0');
        const setIdx = wsSrc.indexOf('currentRoom.clients.set(clientId, ws.clientData)');
        assert.ok(capIdx !== -1 && setIdx !== -1);
        assert.ok(capIdx < setIdx, 'the room-full check must run before the client is actually added');
    });

    test('rejects with a ROOM_FULL error code and closes with a distinct close code (4003)', () => {
        const idx = wsSrc.indexOf('wssConfig.maxClientsPerRoom > 0');
        assert.ok(idx !== -1);
        const block = wsSrc.slice(idx, idx + 400);
        assert.match(block, /code:\s*'ROOM_FULL'/);
        assert.match(block, /ws\.close\(4003/);
    });
});
