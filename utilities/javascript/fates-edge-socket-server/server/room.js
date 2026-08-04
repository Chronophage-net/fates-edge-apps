/**
 * Fate's Edge - Room & Client Management + Ban/Kick + Character Storage
 * v3 – Full character storage with default attributes/skills on creation
 */

const WebSocket = require('ws');
const { safeAssign, buildSafeDict, UNSAFE_KEYS } = require('./security.js');

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
    const dict = buildSafeDict(charactersArray, c => c && c.name);
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
    if (data && data.name) {
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

// ---------- Broadcast ----------
let io = null;
function setIo(ioInstance) { io = ioInstance; }

function broadcastToRoom(roomCode, event, data, senderId = null) {
    const roomKey = roomCode.toUpperCase();
    const room = rooms.get(roomKey);
    if (!room) return;

    const payload = { ...data };
    if (senderId) {
        payload.clientId = senderId;
    }

    if (io) {
        io.to(roomKey).emit(event, payload);
    }

    const message = JSON.stringify({ type: event, ...payload });
    for (const [, client] of room.clients) {
        if (client.type === 'ws' && client.ws && client.ws.readyState === WebSocket.OPEN) {
            if (senderId && client.id === senderId) continue;
            client.ws.send(message);
        }
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
    setIo,
    broadcastToRoom,
    createRoom,
    setRoomPassword,
    createDefaultWhiteboard,
};