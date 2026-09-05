/**
 * v4.8 -- Roles (GM / Co-GM / Player / Spectator) + Character Registration
 *
 * Covers:
 *   - security.js's isGmLike/canManageGmSeat/isSpectator role helpers
 *   - auth.js's isValidRole
 *   - room.js's handleRoleChangeRequest (GM-only, session vs. persisted
 *     Co-GM grants, GM seat carve-out)
 *   - room.js's claimCharacter/releaseCharacter/canEditCharacter (the
 *     account-library <-> room-live-roster bridge)
 */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-for-unit-tests';

const auth = require('../server/auth.js');
const security = require('../server/security.js');
const room = require('../server/room.js');

describe('security.js role helpers', () => {
    test('isGmLike() is true for gm and co-gm only -- assistant-gm is limited to its separate story-authority set', () => {
        assert.equal(security.isGmLike('gm'), true);
        assert.equal(security.isGmLike('co-gm'), true);
        assert.equal(security.isGmLike('assistant-gm'), false);
        assert.equal(security.isGmLike('player'), false);
        assert.equal(security.isGmLike('spectator'), false);
        assert.equal(security.isGmLike(undefined), false);
    });

    test('canManageGmSeat() is true only for the strict gm role', () => {
        assert.equal(security.canManageGmSeat('gm'), true);
        assert.equal(security.canManageGmSeat('co-gm'), false);
        assert.equal(security.canManageGmSeat('assistant-gm'), false);
        assert.equal(security.canManageGmSeat('player'), false);
    });

    test('isSpectator() is true only for spectator', () => {
        assert.equal(security.isSpectator('spectator'), true);
        assert.equal(security.isSpectator('player'), false);
        assert.equal(security.isSpectator('gm'), false);
    });
});

describe('auth.js isValidRole()', () => {
    test('accepts exactly the five-role enum', () => {
        assert.equal(auth.isValidRole('gm'), true);
        assert.equal(auth.isValidRole('co-gm'), true);
        assert.equal(auth.isValidRole('assistant-gm'), true);
        assert.equal(auth.isValidRole('player'), true);
        assert.equal(auth.isValidRole('spectator'), true);
    });

    test('rejects the old "member" default and any junk value', () => {
        assert.equal(auth.isValidRole('member'), false);
        assert.equal(auth.isValidRole('admin'), false);
        assert.equal(auth.isValidRole(''), false);
        assert.equal(auth.isValidRole(null), false);
        assert.equal(auth.isValidRole(42), false);
    });
});

describe('auth.js resolveRoomJoinRole()', () => {
    test('a persisted spectator restriction wins over reconnect claims', () => {
        assert.equal(auth.resolveRoomJoinRole('player', 'spectator'), 'spectator');
        assert.equal(auth.resolveRoomJoinRole('gm', 'spectator'), 'spectator');
        assert.equal(auth.resolveRoomJoinRole('co-gm', 'spectator'), 'spectator');
    });

    test('promoted roles require and restore a matching saved grant', () => {
        assert.equal(auth.resolveRoomJoinRole('co-gm', 'player'), 'player');
        assert.equal(auth.resolveRoomJoinRole('player', 'co-gm'), 'co-gm');
        assert.equal(auth.resolveRoomJoinRole('player', 'assistant-gm'), 'assistant-gm');
    });

    test('ordinary anonymous role selection remains compatible', () => {
        assert.equal(auth.resolveRoomJoinRole('player'), 'player');
        assert.equal(auth.resolveRoomJoinRole('spectator'), 'spectator');
        assert.equal(auth.resolveRoomJoinRole('junk'), 'player');
    });

    test('both socket transports use the same join-role resolver', () => {
        for (const file of ['ws-handlers.js', 'socketio-handlers.js']) {
            const source = fs.readFileSync(path.join(__dirname, '..', 'server', file), 'utf8');
            assert.match(source, /auth\.resolveRoomJoinRole\(/);
        }
    });
});

// ─── room.js role-change + character-claim behavior ────────────────
// These use plain in-memory client stubs (no real socket/ws) -- room.js's
// broadcastToRoom() degrades to a no-op for clients whose `type` isn't
// 'socket.io'/'ws', so this exercises the actual state-mutation logic
// without needing a live transport.
function makeClient(id, role, overrides = {}) {
    return { id, role, name: `Client-${id}`, type: 'stub', ...overrides };
}

describe('room.js handleRoleChangeRequest()', () => {
    let r;
    beforeEach(() => {
        r = room.createRoom('ROLE' + Math.floor(Math.random() * 1e6).toString(36).toUpperCase().padEnd(4, 'X').slice(0, 8));
        room.rooms.set(r.code, r); // createRoom already does this, but be explicit
    });

    test('the GM can promote a Player to Co-GM (session-only by default)', () => {
        const gm = makeClient('gm-1', 'gm');
        const p = makeClient('p-1', 'player');
        r.clients.set(gm.id, gm);
        r.clients.set(p.id, p);

        const result = room.handleRoleChangeRequest(r, gm.id, p.id, 'co-gm', false);
        assert.equal(result.ok, true);
        assert.equal(result.persist, false);
        assert.equal(r.clients.get(p.id).role, 'co-gm');
    });

    test('a Co-GM cannot promote another player to Co-GM (GM-only action)', () => {
        const gm = makeClient('gm-1', 'gm');
        const cogm = makeClient('cogm-1', 'co-gm');
        const p = makeClient('p-1', 'player');
        r.clients.set(gm.id, gm);
        r.clients.set(cogm.id, cogm);
        r.clients.set(p.id, p);

        const result = room.handleRoleChangeRequest(r, cogm.id, p.id, 'co-gm', false);
        assert.equal(result.ok, false);
        assert.equal(r.clients.get(p.id).role, 'player'); // unchanged
    });

    test('multiple Co-GMs are allowed in the same room', () => {
        const gm = makeClient('gm-1', 'gm');
        const p1 = makeClient('p-1', 'player');
        const p2 = makeClient('p-2', 'player');
        r.clients.set(gm.id, gm);
        r.clients.set(p1.id, p1);
        r.clients.set(p2.id, p2);

        assert.equal(room.handleRoleChangeRequest(r, gm.id, p1.id, 'co-gm', false).ok, true);
        assert.equal(room.handleRoleChangeRequest(r, gm.id, p2.id, 'co-gm', false).ok, true);
        assert.equal(r.clients.get(p1.id).role, 'co-gm');
        assert.equal(r.clients.get(p2.id).role, 'co-gm');
    });

    test('the GM seat itself cannot be reassigned through handleRoleChangeRequest', () => {
        const gm = makeClient('gm-1', 'gm');
        const other = makeClient('gm-2', 'gm'); // pretend two GM-flagged entries exist
        r.clients.set(gm.id, gm);
        r.clients.set(other.id, other);

        const result = room.handleRoleChangeRequest(r, gm.id, other.id, 'player', false);
        assert.equal(result.ok, false); // target.role === 'gm' is rejected
    });

    test('rejects an unassignable role', () => {
        const gm = makeClient('gm-1', 'gm');
        const p = makeClient('p-1', 'player');
        r.clients.set(gm.id, gm);
        r.clients.set(p.id, p);

        const result = room.handleRoleChangeRequest(r, gm.id, p.id, 'gm', false);
        assert.equal(result.ok, false);
    });

    test('the GM can promote the AI GM Bot\'s own client to assistant-gm', () => {
        const gm = makeClient('gm-1', 'gm');
        const bot = makeClient('bot-1', 'player', { name: 'AI_GM' });
        r.clients.set(gm.id, gm);
        r.clients.set(bot.id, bot);

        const result = room.handleRoleChangeRequest(r, gm.id, bot.id, 'assistant-gm', false);
        assert.equal(result.ok, true);
        assert.equal(r.clients.get(bot.id).role, 'assistant-gm');
    });

    test('demoting a saved assistant-gm back to Player always persists, same as Co-GM', () => {
        const gm = makeClient('gm-1', 'gm');
        const bot = makeClient('bot-1', 'assistant-gm', { name: 'AI_GM', userId: 'bot-user-1' });
        r.clients.set(gm.id, gm);
        r.clients.set(bot.id, bot);

        const result = room.handleRoleChangeRequest(r, gm.id, bot.id, 'player', false);
        assert.equal(result.ok, true);
        assert.equal(result.persist, true); // demotion off assistant-gm always writes through
        assert.equal(r.clients.get(bot.id).role, 'player');
    });

    test('demoting a saved Co-GM back to Player always persists (even though promotion path is separately tested for persist:true elsewhere)', () => {
        const gm = makeClient('gm-1', 'gm');
        const cogm = makeClient('cogm-1', 'co-gm');
        r.clients.set(gm.id, gm);
        r.clients.set(cogm.id, cogm);

        const result = room.handleRoleChangeRequest(r, gm.id, cogm.id, 'player', false);
        assert.equal(result.ok, true);
        assert.equal(result.persist, true); // demotions always persist, per §2.5
        assert.equal(r.clients.get(cogm.id).role, 'player');
    });

    test('a session-only Socket.IO Spectator role is remembered for rejoins to the same room', () => {
        const gm = makeClient('gm-1', 'gm');
        const socket = { sessionRoomRoles: new Map(), emit() {} };
        const viewer = makeClient('s-1', 'player', { type: 'socket.io', socket });
        r.clients.set(gm.id, gm);
        r.clients.set(viewer.id, viewer);

        assert.equal(room.handleRoleChangeRequest(r, gm.id, viewer.id, 'spectator', false).ok, true);
        assert.equal(socket.sessionRoomRoles.get(r.code), 'spectator');

        assert.equal(room.handleRoleChangeRequest(r, gm.id, viewer.id, 'player', false).ok, true);
        assert.equal(socket.sessionRoomRoles.get(r.code), 'player');
    });
});

// ─── room.js setClientRole() -- the API-key admin path ──────────────────
// Same mutation core as handleRoleChangeRequest above (both funnel through
// _applyRoleChange), but with no sender/canManageGmSeat() check -- this is
// what POST /api/rooms/:code/clients/:clientId/role calls, trusted by
// api.js's shared API_KEY `authenticate` middleware alone, matching how
// room.kickClient()/banClient() are never sender-checked either.
describe('room.js setClientRole() (API-key admin path)', () => {
    let r;
    beforeEach(() => {
        r = room.createRoom('APIRL' + Math.floor(Math.random() * 1e6).toString(36).toUpperCase().padEnd(3, 'X').slice(0, 5));
    });

    test('assigns a role with no sender/GM present at all', () => {
        const bot = makeClient('bot-1', 'player', { name: 'AI_GM' });
        r.clients.set(bot.id, bot);

        const result = room.setClientRole(r, bot.id, 'assistant-gm', false);
        assert.equal(result.ok, true);
        assert.equal(r.clients.get(bot.id).role, 'assistant-gm');
    });

    test('rejects an unknown target client', () => {
        const result = room.setClientRole(r, 'nobody-here', 'co-gm', false);
        assert.equal(result.ok, false);
        assert.match(result.error, /not found/i);
    });

    test('rejects an unassignable role, same validation as the socket path', () => {
        const p = makeClient('p-1', 'player');
        r.clients.set(p.id, p);

        const result = room.setClientRole(r, p.id, 'gm', false);
        assert.equal(result.ok, false);
    });

    test('cannot reassign the GM seat through this path either', () => {
        const gm = makeClient('gm-1', 'gm');
        r.clients.set(gm.id, gm);

        const result = room.setClientRole(r, gm.id, 'player', false);
        assert.equal(result.ok, false);
    });

    test('demoting a saved assistant-gm grant still always persists', () => {
        const bot = makeClient('bot-1', 'assistant-gm', { name: 'AI_GM' });
        r.clients.set(bot.id, bot);

        const result = room.setClientRole(r, bot.id, 'player', false);
        assert.equal(result.ok, true);
        assert.equal(result.persist, true);
    });

    // NOTE: the 'api' vs. client-id distinction in role_update's `byId`
    // field (see _applyRoleChange in room.js) is exercised at the
    // broadcastToRoom call site, which room.js invokes internally rather
    // than through its exports -- not spyable from a plain unit test
    // without a live socket, so it's left to the api.js route comment/docs
    // as the contract rather than asserted here.
});

describe('room.js character claim/release + canEditCharacter()', () => {
    let r;
    beforeEach(() => {
        r = room.createRoom('CLAIM' + Math.floor(Math.random() * 1e6).toString(36).toUpperCase().padEnd(3, 'X').slice(0, 5));
    });

    test('claimCharacter() requires an account (userId)', () => {
        const anon = makeClient('anon-1', 'player'); // no userId
        const result = room.claimCharacter(r, anon, 'char-1', { name: 'Khor' });
        assert.equal(result.ok, false);
    });

    test('claimCharacter() registers the character on the live roster, tagged with ownerId', () => {
        const p = makeClient('p-1', 'player', { userId: 'user-1' });
        r.clients.set(p.id, p);

        const result = room.claimCharacter(r, p, 'char-1', { name: 'Khor', attributes: { Body: 3 } });
        assert.equal(result.ok, true);
        const char = room.getCharacter(r, 'Khor');
        assert.equal(char.ownerId, 'user-1');
        assert.equal(r.characterClaims['user-1'], 'khor');
        assert.equal(r.clients.get(p.id).selectedCharacter, 'Khor');
    });

    test('claiming a second character replaces the first claim (one live claim per player per room)', () => {
        const p = makeClient('p-1', 'player', { userId: 'user-1' });
        r.clients.set(p.id, p);

        room.claimCharacter(r, p, 'char-1', { name: 'Khor' });
        room.claimCharacter(r, p, 'char-2', { name: 'Nyla' });

        assert.equal(r.characterClaims['user-1'], 'nyla');
    });

    test('releaseCharacter() clears the claim', () => {
        const p = makeClient('p-1', 'player', { userId: 'user-1' });
        r.clients.set(p.id, p);
        room.claimCharacter(r, p, 'char-1', { name: 'Khor' });

        const result = room.releaseCharacter(r, p);
        assert.equal(result.ok, true);
        assert.equal(result.released, true);
        assert.equal(r.characterClaims['user-1'], undefined);
    });

    test('canEditCharacter(): GM and Co-GM can always edit; a Player only their own claimed character; a Spectator never', () => {
        const gm = makeClient('gm-1', 'gm');
        const cogm = makeClient('cogm-1', 'co-gm');
        const owner = makeClient('p-1', 'player', { userId: 'user-1' });
        const otherPlayer = makeClient('p-2', 'player', { userId: 'user-2' });
        const spectator = makeClient('s-1', 'spectator', { userId: 'user-3' });
        r.clients.set(owner.id, owner);

        room.claimCharacter(r, owner, 'char-1', { name: 'Khor' });

        assert.equal(room.canEditCharacter(r, gm, 'Khor'), true);
        assert.equal(room.canEditCharacter(r, cogm, 'Khor'), true);
        assert.equal(room.canEditCharacter(r, owner, 'Khor'), true);
        assert.equal(room.canEditCharacter(r, otherPlayer, 'Khor'), false);
        assert.equal(room.canEditCharacter(r, spectator, 'Khor'), false);
    });

    test('canEditCharacter() is case-insensitive on the character name (matches normalizeCharKey)', () => {
        const owner = makeClient('p-1', 'player', { userId: 'user-1' });
        r.clients.set(owner.id, owner);
        room.claimCharacter(r, owner, 'char-1', { name: 'Khor' });

        assert.equal(room.canEditCharacter(r, owner, 'KHOR'), true);
        assert.equal(room.canEditCharacter(r, owner, 'khor'), true);
    });
});
