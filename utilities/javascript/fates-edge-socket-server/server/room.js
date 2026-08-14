/**
 * Fate's Edge - Room & Client Management + Ban/Kick + Character Storage
 * v3 – Full character storage with default attributes/skills on creation
 */

const WebSocket = require('ws');
const { safeAssign, buildSafeDict, UNSAFE_KEYS, MAX_NAME_LENGTH, isGmLike, canManageGmSeat, isSpectator } = require('./security.js');

// Optional -- room.js stays usable with zero DB configured; these calls
// are always best-effort (fire-and-forget, errors logged not thrown) and
// only fire at all for clients that joined with a valid account token
// (see socketio-handlers.js / ws-handlers.js, which set clientData.userId).
let _storage = null;
try { _storage = require('./storage.js'); } catch (e) { _storage = null; }
function _hasAccountSupport() { return !!(_storage && typeof _storage.setMemberRole === 'function'); }
function _persistRole(roomObj, client, role) {
    if (client && client.userId && _hasAccountSupport()) {
        _storage.setMemberRole(roomObj.code, client.userId, role).catch(() => {});
    }
}
function _persistCharacterClaim(roomObj, userId, characterId) {
    if (userId && characterId && _hasAccountSupport() && typeof _storage.setCharacterClaim === 'function') {
        _storage.setCharacterClaim(roomObj.code, userId, characterId).catch(() => {});
    }
}
function _persistCharacterRelease(roomObj, userId) {
    if (userId && _hasAccountSupport() && typeof _storage.deleteCharacterClaim === 'function') {
        _storage.deleteCharacterClaim(roomObj.code, userId).catch(() => {});
    }
}

// ─── Shared default character constants ────────────────────────────
// Matches the defaults in modules/characters.js so the server and bot
// never disagree on what a "fresh" character looks like.
const DEFAULT_ATTRIBUTES = { Body: 2, Wits: 2, Spirit: 2, Presence: 2 };

const ALL_SKILLS = [
  'Melee', 'Ranged', 'Unarmed',
  'Athletics', 'Stealth', 'Endurance', 'Craft',
  'Sway', 'Deception', 'Subterfuge', 'Performance', 'Insight',
  'Lore', 'Investigation', 'Medicine',
  'Arcana'
];

const DEFAULT_SKILLS = Object.fromEntries(ALL_SKILLS.map(s => [s, 0]));

// ---------- State ----------
const rooms = new Map();

// ---------- Helpers ----------
function validateRoomCode(code) {
    return typeof code === 'string' && code.length >= 4 && code.length <= 10 && /^[A-Z0-9]+$/.test(code);
}

function getRoom(code) {
    if (!validateRoomCode(code)) {
        throw new Error('Invalid room code format');
    }
    const room = rooms.get(code.toUpperCase());
    if (!room) throw new Error(`Room ${code} not found`);
    return room;
}

function getRoomStats(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return null;
    return {
        code: room.code,
        name: room.name,
        clients: room.clients.size,
        deckRemaining: room.deck?.length || 0,
        historyCount: room.deckHistory?.length || 0,
        characterCount: room.characters ? Object.keys(room.characters).length : 0,
        lastActivity: room.lastActivity,
        created: room.created
    };
}

function getExistingGm(room) {
    for (const [, client] of room.clients) {
        if (client.role === 'gm') return client;
    }
    return null;
}

function getClientsList(room) {
    return Array.from(room.clients.values()).map(c => ({
        id: c.id,
        name: c.name,
        role: c.role,
        email: c.email || '',
        // NOTE: selectedCharacter was already being SET on the client entry
        // (see ws-handlers.js 'character-select') but was never included here,
        // so it silently never reached other clients. Fixed alongside adding
        // activeView (which tab/feature a client is currently looking at) for
        // richer presence.
        selectedCharacter: c.selectedCharacter || '',
        // NEW: "Remote enabled" clients can drive more than one character at
        // once (capped at MAX_CONTROLLED_CHARACTERS -- see security.js's
        // sanitizeCharacterSelection()). `selectedCharacter` above is kept
        // as-is (first entry of this array) so older clients that only know
        // about a single selection keep working unchanged.
        selectedCharacters: c.selectedCharacters || (c.selectedCharacter ? [c.selectedCharacter] : []),
        activeView: c.activeView || ''
    }));
}

// ---------- Character Helpers ----------
function normalizeCharKey(name) {
    return typeof name === 'string' ? name.toLowerCase() : name;
}

function getCharacters(room) {
    return room.characters ? Object.values(room.characters) : [];
}

function getCharacter(room, name) {
    const key = normalizeCharKey(name);
    return room.characters && room.characters[key] ? room.characters[key] : null;
}

function setCharacters(room, charactersArray) {
    if (!Array.isArray(charactersArray)) return;
    // Reject (rather than silently truncate) an over-long name here --
    // this path replaces the WHOLE character roster in one call, so
    // truncating would risk two different long names colliding on the
    // same truncated key and silently clobbering one character with
    // another's data.
    const dict = buildSafeDict(
        charactersArray.filter(c => c && typeof c.name === 'string' && c.name.length <= MAX_NAME_LENGTH),
        c => c && c.name
    );
    const normalized = Object.create(null);
    for (const [rawKey, value] of Object.entries(dict)) {
        normalized[normalizeCharKey(rawKey)] = value;
    }
    room.characters = normalized;
    room.lastActivity = Date.now();
}

/**
 * Create or update a character, ensuring attributes and skills are always
 * present (with defaults) to avoid partial updates wiping out essential fields.
 */
function updateCharacter(room, name, data) {
    if (!name || UNSAFE_KEYS.has(name)) return null;
    if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) return null;
    const key = normalizeCharKey(name);
    if (UNSAFE_KEYS.has(key)) return null;
    if (!room.characters) room.characters = Object.create(null);

    // Ensure the character record exists
    if (!room.characters[key]) {
        room.characters[key] = { name };
    }
    const char = room.characters[key];

    // ─── FIX: initialise attributes and skills if missing ──────────
    if (!char.attributes || typeof char.attributes !== 'object') {
        char.attributes = { ...DEFAULT_ATTRIBUTES };
    }
    if (!char.skills || typeof char.skills !== 'object') {
        char.skills = { ...DEFAULT_SKILLS };
    }

    // Merge incoming data (shallow merge for top-level fields)
    safeAssign(char, data);

    // Ensure the display name is preserved
    if (data && typeof data.name === 'string' && data.name.length <= MAX_NAME_LENGTH) {
        char.name = data.name;
    } else if (!char.name) {
        char.name = name;
    }

    room.lastActivity = Date.now();
    return char;
}

/**
 * One-time cleanup for duplicate case‑fragmented character records.
 * See the long comment in the original file for details.
 */
function mergeDuplicateCharacters(room) {
    if (!room.characters) return { merged: 0, removedKeys: [] };

    const groups = new Map(); // normalizedKey -> [rawKey, ...]
    for (const rawKey of Object.keys(room.characters)) {
        const norm = normalizeCharKey(rawKey);
        if (!groups.has(norm)) groups.set(norm, []);
        groups.get(norm).push(rawKey);
    }

    const NESTED_MERGE_FIELDS = ['attributes', 'skills'];
    const ARRAY_FIELDS = ['talents', 'bonds', 'complications', 'assets', 'followers'];

    let mergedCount = 0;
    const removedKeys = [];

    for (const [norm, rawKeys] of groups) {
        if (rawKeys.length <= 1) continue;

        let merged = {};
        for (const rawKey of rawKeys) {
            const rec = room.characters[rawKey];
            if (!rec) continue;
            for (const [field, value] of Object.entries(rec)) {
                if (NESTED_MERGE_FIELDS.includes(field) && value && typeof value === 'object') {
                    merged[field] = { ...(merged[field] || {}), ...value };
                } else if (ARRAY_FIELDS.includes(field) && Array.isArray(value)) {
                    if (!merged[field] || value.length > merged[field].length) {
                        merged[field] = value;
                    }
                } else if (value !== undefined && value !== null && value !== '') {
                    merged[field] = value;
                } else if (merged[field] === undefined) {
                    merged[field] = value;
                }
            }
        }
        merged.name = merged.name || norm;

        for (const rawKey of rawKeys) {
            if (rawKey !== norm) {
                delete room.characters[rawKey];
                removedKeys.push(rawKey);
            }
        }
        room.characters[norm] = merged;
        mergedCount++;
    }

    if (mergedCount > 0) room.lastActivity = Date.now();
    return { merged: mergedCount, removedKeys };
}

// ---------- Ban/Kick ----------
function kickClient(room, targetId, reason = 'Kicked by GM') {
    const target = room.clients.get(targetId);
    if (!target) return false;

    if (target.type === 'socket.io' && target.socket) {
        target.socket.emit('kicked', { reason });
        target.socket.leave(room.code);
        target.socket.disconnect(true);
    } else if (target.type === 'ws' && target.ws) {
        target.ws.send(JSON.stringify({ type: 'kicked', reason }));
        target.ws.close(4001, reason);
    }

    room.clients.delete(targetId);
    return true;
}

function banClient(room, targetId, reason = 'Banned by GM') {
    if (!room.banned) room.banned = new Set();
    room.banned.add(targetId);
    // NEW: if the target is (or was) an authenticated account, persist
    // the ban against their userId too -- the in-memory Set above is
    // keyed by ephemeral socket/ws id and won't catch them on their next
    // reconnect (which gets a brand new id). See socketio-handlers.js /
    // ws-handlers.js's persistent ban check at join time.
    const target = room.clients.get(targetId);
    if (target && target.userId && _hasAccountSupport()) {
        _storage.setMemberBanned(room.code, target.userId, true).catch(() => {});
    }
    if (room.clients.has(targetId)) {
        kickClient(room, targetId, reason);
    }
}

function unbanClient(room, targetId) {
    if (room.banned) {
        return room.banned.delete(targetId);
    }
    return false;
}

function isBanned(room, clientId) {
    return room.banned ? room.banned.has(clientId) : false;
}

// NEW: ban/unban by persistent account id directly, for a user who isn't
// currently connected (so there's no live socket/ws id to pass to
// banClient/unbanClient above). Used by the new REST route
// POST/DELETE /api/rooms/:code/members/:userId/ban.
//
// Takes a room CODE, not a live room object, and does NOT require the
// room to currently exist in the in-memory `rooms` Map -- that Map is
// garbage-collected empty rooms aggressively (see the disconnect
// handlers in socketio-handlers.js / ws-handlers.js), and the whole
// point of banning-by-account is to be able to act on someone who isn't
// connected right now. The persisted membership row is the source of
// truth; the live room (if it happens to exist) is only consulted to
// kick an already-connected match immediately instead of waiting for
// their next join attempt to be rejected.
async function setMemberBannedByUserId(roomCode, userId, banned) {
    if (!_hasAccountSupport()) return false;
    const roomKey = roomCode.toUpperCase();
    await _storage.setMemberBanned(roomKey, userId, banned);
    const liveRoom = rooms.get(roomKey);
    if (banned && liveRoom) {
        for (const [id, client] of liveRoom.clients) {
            if (client.userId === userId) {
                kickClient(liveRoom, id, 'Banned by GM');
                break;
            }
        }
    }
    return true;
}

// ---------- GM Election ----------
function handleGmRequest(room, requesterId) {
    const requester = room.clients.get(requesterId);
    if (!requester) return;

    const currentGm = getExistingGm(room);
    if (!currentGm) {
        requester.role = 'gm';
        room.clients.set(requesterId, requester);
        _persistRole(room, requester, 'gm');
        const clientsList = getClientsList(room);
        broadcastToRoom(room.code, 'presence', { clients: clientsList });
        broadcastToRoom(room.code, 'server_announcement', {
            message: `👑 ${requester.name} has taken on the role of Game Master.`,
            timestamp: Date.now()
        });
        if (requester.type === 'socket.io' && requester.socket) {
            requester.socket.emit('gm_role_update', { role: 'gm' });
        } else if (requester.type === 'ws' && requester.ws && requester.ws.readyState === WebSocket.OPEN) {
            requester.ws.send(JSON.stringify({ type: 'gm_role_update', role: 'gm' }));
        }
    } else {
        broadcastToRoom(room.code, 'gm_vote_request', {
            requesterId,
            requesterName: requester.name,
            currentGmId: currentGm.id,
            currentGmName: currentGm.name,
            timestamp: Date.now()
        });
        const waitMsg = `A GM is already present. A vote request has been sent to ${currentGm.name}.`;
        if (requester.type === 'socket.io' && requester.socket) {
            requester.socket.emit('server_announcement', { message: waitMsg, timestamp: Date.now() });
        } else if (requester.type === 'ws' && requester.ws) {
            requester.ws.send(JSON.stringify({ type: 'server_announcement', message: waitMsg, timestamp: Date.now() }));
        }
    }
}

function handleGmApproval(room, approverId, targetId) {
    const approver = room.clients.get(approverId);
    const target = room.clients.get(targetId);
    if (!approver || !target) return;
    if (approver.role !== 'gm') return;

    approver.role = 'player';
    target.role = 'gm';
    room.clients.set(approverId, approver);
    room.clients.set(targetId, target);
    _persistRole(room, approver, 'player');
    _persistRole(room, target, 'gm');

    const clientsList = getClientsList(room);
    broadcastToRoom(room.code, 'presence', { clients: clientsList });
    broadcastToRoom(room.code, 'server_announcement', {
        message: `👑 ${approver.name} has stepped down. ${target.name} is now the Game Master.`,
        timestamp: Date.now()
    });

    if (approver.type === 'socket.io' && approver.socket) {
        approver.socket.emit('gm_role_update', { role: 'player' });
    } else if (approver.type === 'ws' && approver.ws) {
        approver.ws.send(JSON.stringify({ type: 'gm_role_update', role: 'player' }));
    }
    if (target.type === 'socket.io' && target.socket) {
        target.socket.emit('gm_role_update', { role: 'gm' });
    } else if (target.type === 'ws' && target.ws) {
        target.ws.send(JSON.stringify({ type: 'gm_role_update', role: 'gm' }));
    }
}

// ---------- v4.8: Role Management (Co-GM / Player / Spectator) ----------
// ---------- v4.12: 'assistant-gm' added as a fourth assignable role -----
//
// Generalizes the GM-only "promote/demote" gesture beyond the single GM
// seat above. Only the room's GM may call this (checked with
// canManageGmSeat(), a strict `=== 'gm'` check -- a Co-GM cannot promote
// another Co-GM, matching the "GM controls Co-GM" decision). The target
// role must be one of 'co-gm' | 'assistant-gm' | 'player' | 'spectator';
// transferring the GM seat itself still goes through handleGmApproval()
// above, not here.
//
// 'assistant-gm' is how a GM hands the AI GM Bot a middle tier between
// full narrative control and doing nothing: the bot keeps running
// mechanics (rolls, resource math, timers) but holds narrative-authority
// decisions (new facts, new NPCs, scene advancement) for the GM to
// approve. See fates-edge-ai-gm-bot's modules/assistant-suggestions.js and
// README "Assistant GM Mode" for what the bot does with this role once
// assigned -- this server only needs to know it's a legal, non-GM role to
// hand out the same way Co-GM is.
//
// `persist`: when promoting to Co-GM, the GM chooses whether the grant is
// session-only (in-memory `client.role` flip, reverts to whatever's on
// file next time this user joins) or saved (also written to
// room_memberships via _persistRole, so it survives reconnects until
// explicitly demoted). Demotions always persist, so a saved Co-GM can be
// fully revoked, not just silenced for the current connection.
const ASSIGNABLE_ROLES = new Set(['co-gm', 'assistant-gm', 'player', 'spectator']);

// Shared mutation core for both role-change entry points below: the
// GM-only socket flow (handleRoleChangeRequest, sender must hold the GM
// seat on THIS connection) and the system/API-key flow (setClientRole,
// trusted the same unconditional way api.js's kick/ban routes already
// trust the API key -- no per-connection sender to check). Both already
// validated target/role/GM-seat-carve-out before calling this; this
// function only does the actual mutate-persist-broadcast.
function _applyRoleChange(room, target, targetId, role, persist, byId) {
    const previousRole = target.role;
    target.role = role;
    room.clients.set(targetId, target);

    // Demotions (anything moving OFF co-gm or assistant-gm) always write
    // through, even if the original promotion was session-only -- a
    // standing grant must be fully revocable, not just suppressed for one
    // connection.
    const shouldPersist = persist || previousRole === 'co-gm' || previousRole === 'assistant-gm';
    if (shouldPersist) _persistRole(room, target, role);

    const clientsList = getClientsList(room);
    broadcastToRoom(room.code, 'presence', { clients: clientsList });
    broadcastToRoom(room.code, 'role_update', { targetId, role, byId, persist: shouldPersist });

    const roleLabel = { 'co-gm': 'Co-GM', 'assistant-gm': 'Assistant GM', player: 'Player', spectator: 'Spectator' }[role] || role;
    const isPromotedRole = role === 'co-gm' || role === 'assistant-gm';
    broadcastToRoom(room.code, 'server_announcement', {
        message: `🎭 ${target.name} is now a ${roleLabel}${isPromotedRole && !shouldPersist ? ' for this session' : ''}.`,
        timestamp: Date.now()
    });

    const send = (client, payload) => {
        if (client.type === 'socket.io' && client.socket) client.socket.emit('role_update', payload);
        else if (client.type === 'ws' && client.ws && client.ws.readyState === WebSocket.OPEN) client.ws.send(JSON.stringify({ type: 'role_update', ...payload }));
    };
    send(target, { targetId, role, persist: shouldPersist });

    return { ok: true, role, persist: shouldPersist };
}

function handleRoleChangeRequest(room, senderId, targetId, role, persist = false) {
    const sender = room.clients.get(senderId);
    const target = room.clients.get(targetId);
    if (!sender || !target) return { ok: false, error: 'Client not found' };
    if (!canManageGmSeat(sender.role)) return { ok: false, error: 'Only the GM can change roles' };
    if (!ASSIGNABLE_ROLES.has(role)) return { ok: false, error: `Cannot assign role "${role}" this way` };
    if (target.role === 'gm') return { ok: false, error: 'Use GM handoff to change the GM seat' };

    return _applyRoleChange(room, target, targetId, role, persist, senderId);
}

// System/API-key entry point -- same mutation as handleRoleChangeRequest
// above, but for callers that aren't a connected client at all (the REST
// API, gated by api.js's shared API_KEY `authenticate` middleware). No
// canManageGmSeat() sender check here, deliberately: the API key itself IS
// the authorization, exactly like api.js's existing kick/ban routes
// (room.kickClient/banClient) never check a sender's role either -- an
// admin with the API key already has strictly more authority than any
// in-room GM. `byId` in the broadcast is 'api' rather than a client id, so
// clients can tell a role change came from outside the room.
function setClientRole(room, targetId, role, persist = false) {
    const target = room.clients.get(targetId);
    if (!target) return { ok: false, error: 'Client not found' };
    if (!ASSIGNABLE_ROLES.has(role)) return { ok: false, error: `Cannot assign role "${role}" this way` };
    if (target.role === 'gm') return { ok: false, error: 'Use GM handoff to change the GM seat' };

    return _applyRoleChange(room, target, targetId, role, persist, 'api');
}

// ---------- v4.8: Character Registration (claim/release) ----------
//
// Binds one row of the account-owned character library to a room
// membership: `(room.code, userId) -> characterId`. Enforced as at most
// one live claim per (room, user) -- claiming a new character replaces
// any existing claim for that user in this room. The claimed character's
// live roster record is tagged with `ownerId` so write-permission checks
// (Player may only edit their OWN character) have something to key off;
// see socketio-handlers.js / ws-handlers.js's character-update handling.
function claimCharacter(room, client, characterId, characterSnapshot) {
    if (!client || !client.userId) return { ok: false, error: 'Account required to claim a character' };
    if (!characterSnapshot || typeof characterSnapshot.name !== 'string') {
        return { ok: false, error: 'Invalid character data' };
    }

    // Release any previous claim by this user in this room first (one
    // live character per player per room).
    releaseCharacter(room, client, { silent: true });

    const char = updateCharacter(room, characterSnapshot.name, { ...characterSnapshot, ownerId: client.userId });
    if (!char) return { ok: false, error: 'Could not register character' };

    if (!room.characterClaims) room.characterClaims = Object.create(null);
    room.characterClaims[client.userId] = normalizeCharKey(char.name);

    client.selectedCharacter = char.name;
    client.selectedCharacters = [char.name];
    room.clients.set(client.id, client);

    _persistCharacterClaim(room, client.userId, characterId);

    broadcastToRoom(room.code, 'presence', { clients: getClientsList(room) });
    broadcastToRoom(room.code, 'character_claimed', { userId: client.userId, characterId, name: char.name });

    return { ok: true, character: char };
}

function releaseCharacter(room, client, { silent = false } = {}) {
    if (!client || !client.userId) return { ok: false, error: 'Account required' };
    if (!room.characterClaims || !room.characterClaims[client.userId]) {
        return { ok: true, released: false };
    }
    const name = room.characterClaims[client.userId];
    delete room.characterClaims[client.userId];
    _persistCharacterRelease(room, client.userId);

    if (!silent) {
        broadcastToRoom(room.code, 'presence', { clients: getClientsList(room) });
        broadcastToRoom(room.code, 'character_released', { userId: client.userId, name });
    }
    return { ok: true, released: true, name };
}

/** True if `client` is allowed to write to character `name` -- GM/Co-GM
 *  always can; a Player only if they hold the claim on that exact
 *  character; anyone else (including an unclaimed Player) cannot. */
function canEditCharacter(room, client, name) {
    if (!client) return false;
    if (isGmLike(client.role)) return true;
    if (isSpectator(client.role)) return false;
    if (!client.userId || !room.characterClaims) return false;
    return room.characterClaims[client.userId] === normalizeCharKey(name);
}

// ---------- Broadcast ----------
let io = null;
function setIo(ioInstance) { io = ioInstance; }

// Optional multi-instance relay hook (server/scaling.js). Absent by
// default -- single-instance behavior is completely unchanged when this
// is null (the common case; see SCALING.md).
let scaling = null;
function setScaling(scalingApi) { scaling = scalingApi && scalingApi.enabled ? scalingApi : null; }

function deliverToLocalWsClients(roomCode, event, payload, senderId = null) {
    const roomKey = roomCode.toUpperCase();
    const room = rooms.get(roomKey);
    if (!room) return; // this instance isn't holding any clients for this room -- fine
    const message = JSON.stringify({ type: event, ...payload });
    for (const [, client] of room.clients) {
        if (client.type === 'ws' && client.ws && client.ws.readyState === WebSocket.OPEN) {
            if (senderId && client.id === senderId) continue;
            client.ws.send(message);
        }
    }
}

function broadcastToRoom(roomCode, event, data, senderId = null) {
    const roomKey = roomCode.toUpperCase();
    const room = rooms.get(roomKey);
    if (!room) return;

    const payload = { ...data };
    if (senderId) {
        payload.clientId = senderId;
    }

    // Socket.IO clients: local delivery today; transparently reaches
    // every instance's Socket.IO clients too when server/scaling.js has
    // attached the Redis adapter (io.adapter(...)) -- no extra call
    // needed here either way.
    if (io) {
        io.to(roomKey).emit(event, payload);
    }

    // Plain-ws clients connected to THIS instance.
    deliverToLocalWsClients(roomKey, event, payload, senderId);

    // Plain-ws clients connected to OTHER instances, only when Redis
    // scaling is enabled (see server/scaling.js).
    if (scaling) {
        scaling.publish(roomKey, event, payload, senderId);
    }
}

// ---------- Room Creation ----------
function createRoom(roomCode) {
    if (!validateRoomCode(roomCode)) {
        throw new Error('Invalid room code format');
    }
    const roomKey = roomCode.toUpperCase();
    if (rooms.has(roomKey)) return rooms.get(roomKey);

    const { buildDeck } = require('./deck.js');
    const room = {
        name: `Room ${roomKey}`,
        code: roomKey,
        clients: new Map(),
        deck: buildDeck(),
        deckHistory: [],
        deckOffset: Math.floor(Math.random() * 1000),
        lastActivity: Date.now(),
        created: Date.now(),
        whiteboard: createDefaultWhiteboard(),
        characters: Object.create(null),
        // v4.8: userId -> normalized character key, one claim per user.
        characterClaims: Object.create(null),
        banned: new Set(),
        password: null,
        data: {}
    };
    rooms.set(roomKey, room);
    return room;
}

// NEW: `password` here is expected to already be a bcrypt hash (or null
// to clear it) -- see auth.js's hashPassword(). Callers used to pass
// plaintext, compared with a raw `!==` at join time; that's fixed at the
// two join call sites (socketio-handlers.js / ws-handlers.js), which now
// use auth.verifyPassword() instead. Kept as `room.password` (not renamed
// to `room.passwordHash`) so this doesn't touch every existing reference,
// but the value it now holds is always a hash, never plaintext.
function setRoomPassword(room, passwordHash) {
    room.password = passwordHash || null;
    room.lastActivity = Date.now();
    return room.password !== null;
}

function createDefaultWhiteboard() {
    return {
        drawings: [],
        notes: [],
        images: [],
        settings: {
            gridSnap: false,
            gridSize: 20,
            backgroundColor: '#ffffff',
            gridType: 'square',
            showGrid: true
        },
        gridCombat: {
            enabled: false,
            gridType: 'square',
            cellSize: 40,
            showCoordinates: false,
            showZones: false,
            tokens: []
        }
    };
}

// ---------- Exports ----------
module.exports = {
    rooms,
    validateRoomCode,
    getRoom,
    getRoomStats,
    getExistingGm,
    setScaling,
    deliverToLocalWsClients,
    getClientsList,
    getCharacters,
    getCharacter,
    setCharacters,
    updateCharacter,
    mergeDuplicateCharacters,
    normalizeCharKey,
    kickClient,
    banClient,
    unbanClient,
    isBanned,
    setMemberBannedByUserId,
    handleGmRequest,
    handleGmApproval,
    handleRoleChangeRequest,
    setClientRole,
    ASSIGNABLE_ROLES,
    claimCharacter,
    releaseCharacter,
    canEditCharacter,
    setIo,
    broadcastToRoom,
    createRoom,
    setRoomPassword,
    createDefaultWhiteboard,
};