/**
 * Fate's Edge - Room & Client Management + Ban/Kick + Character Storage
 * v2 – Full character storage (r.characters) for WebSocket sync
 */

const WebSocket = require('ws');

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
        email: c.email || ''
    }));
}

// ---------- Character Helpers ----------
function getCharacters(room) {
    return room.characters ? Object.values(room.characters) : [];
}

function getCharacter(room, name) {
    return room.characters && room.characters[name] ? room.characters[name] : null;
}

function setCharacters(room, charactersArray) {
    if (!Array.isArray(charactersArray)) return;
    const chars = {};
    charactersArray.forEach(c => {
        if (c.name) chars[c.name] = c;
    });
    room.characters = chars;
    room.lastActivity = Date.now();
}

function updateCharacter(room, name, data) {
    if (!room.characters) room.characters = {};
    if (!room.characters[name]) room.characters[name] = { name };
    // Merge all top-level fields
    for (const [key, value] of Object.entries(data)) {
        if (key === 'name') continue;
        room.characters[name][key] = value;
    }
    room.lastActivity = Date.now();
    return room.characters[name];
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

// ---------- GM Election ----------
function handleGmRequest(room, requesterId) {
    const requester = room.clients.get(requesterId);
    if (!requester) return;

    const currentGm = getExistingGm(room);
    if (!currentGm) {
        requester.role = 'gm';
        room.clients.set(requesterId, requester);
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

// ---------- Broadcast (with sender exclusion) ----------
let io = null;
function setIo(ioInstance) { io = ioInstance; }

/**
 * Broadcast an event to all clients in a room.
 * @param {string} roomCode - Room identifier
 * @param {string} event - Event name
 * @param {object} data - Event payload
 * @param {string|null} senderId - Optional client ID to exclude from plain WebSocket broadcast
 */
function broadcastToRoom(roomCode, event, data, senderId = null) {
    const roomKey = roomCode.toUpperCase();
    const room = rooms.get(roomKey);
    if (!room) return;

    // Build payload with sender info if provided
    const payload = { ...data };
    if (senderId) {
        payload.clientId = senderId;
    }

    // Socket.io broadcast (includes sender, but client can ignore via clientId check)
    if (io) {
        io.to(roomKey).emit(event, payload);
    }

    // Plain WebSocket broadcast (skip sender)
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
        characters: {},          // <-- Full character storage (keyed by name)
        banned: new Set(),
        password: null,          // Optional room password
        data: {}                 // Generic data store (region, etc.)
    };
    rooms.set(roomKey, room);
    return room;
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
    kickClient,
    banClient,
    unbanClient,
    isBanned,
    handleGmRequest,
    handleGmApproval,
    setIo,
    broadcastToRoom,
    createRoom,
    createDefaultWhiteboard,
};