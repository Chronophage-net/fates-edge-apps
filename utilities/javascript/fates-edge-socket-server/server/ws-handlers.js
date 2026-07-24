/**
 * Fate's Edge - Plain WebSocket Handlers
 * v4 – Full feature parity with Socket.io:
 *   - ping/pong heartbeat
 *   - full whiteboard sync (sheets + activeSheetId)
 *   - set-region command
 *   - room password support (handshake)
 *   - full character storage (r.characters)
 */

const WebSocket = require('ws');
const room = require('./room.js');
const deck = require('./deck.js');
const logger = require('./logger.js').createLogger(process.env.LOG_LEVEL || 'INFO');
const { buildSafeDict, clampCount } = require('./security.js');

let socketStats = { wsConnections: 0, totalConnections: 0 };

function setupWSS(wss) {
    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        let roomCode = url.searchParams.get('room');
        if (!roomCode) {
            const pathParts = url.pathname.split('/').filter(Boolean);
            if (pathParts.length >= 2 && pathParts[0] === 'campaign') {
                roomCode = pathParts[1];
            }
        }
        const roomKey = (roomCode || 'default').toUpperCase();
        const clientId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        let currentRoom;
        try {
            currentRoom = room.rooms.get(roomKey) || room.createRoom(roomKey);
        } catch (err) {
            logger.warn('🚫 Rejected connection with invalid room code', { roomKey, error: err.message });
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid room code format.' }));
            ws.close(4000, 'Invalid room code');
            return;
        }
        if (!room.rooms.has(roomKey)) {
            logger.info('📋 Room created', { room: roomKey });
        }

        // Check ban
        if (room.isBanned(currentRoom, clientId)) {
            logger.warn('🚫 Banned client attempted connection', { clientId, room: roomKey });
            ws.send(JSON.stringify({ type: 'error', message: 'You are banned from this room.' }));
            ws.close(4002, 'Banned');
            return;
        }

        ws.clientId = clientId;
        ws.room = roomKey;
        ws.clientData = { id: clientId, name: 'Player', role: 'player', email: '', type: 'ws', ws };
        currentRoom.clients.set(clientId, ws.clientData);
        socketStats.wsConnections++;
        socketStats.totalConnections++;

        // ─── Heartbeat (ping/pong) ──────────────────────────────────
        let pingInterval = null;
        let isAlive = true;

        ws.on('pong', () => {
            isAlive = true;
        });

        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                if (!isAlive) {
                    logger.warn('🔴 Client did not respond to ping, terminating connection', { clientId, room: roomKey });
                    ws.terminate();
                    return;
                }
                isAlive = false;
                ws.ping();
            } else {
                clearInterval(pingInterval);
            }
        }, 30000); // 30 seconds

        // ─── Send connected message ──────────────────────────────────
        ws.send(JSON.stringify({
            type: 'connected',
            clientId,
            room: roomKey,
            timestamp: Date.now(),
            message: 'Connected to Fate\'s Edge WebSocket server',
            protocols: ['socket.io', 'plain-websocket'],
            serverVersion: '1.0.0'
        }));

        // ─── Send room state (includes whiteboard, region, characters) ──
        const charArray = currentRoom.characters ? Object.values(currentRoom.characters) : [];
        const roomStatePayload = {
            type: 'room-state',
            room: roomKey,
            deckRemaining: currentRoom.deck?.length || 0,
            historyCount: currentRoom.deckHistory?.length || 0,
            whiteboard: currentRoom.whiteboard || {},
            characters: charArray,
            timestamp: Date.now()
        };
        if (currentRoom.data?.region) {
            roomStatePayload.region = currentRoom.data.region;
        }
        ws.send(JSON.stringify(roomStatePayload));

        // ─── Message handler ──────────────────────────────────────────
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                const messageType = data.type || 'unknown';
                const currentRoom = room.rooms.get(roomKey);
                if (!currentRoom) return;

                switch (messageType) {
                    case 'ping':
                        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                        break;

                    case 'handshake':
                        handleHandshake(ws, currentRoom, data);
                        break;

                    case 'request_gm':
                        room.handleGmRequest(currentRoom, clientId);
                        break;

                    case 'approve_gm':
                        room.handleGmApproval(currentRoom, clientId, data.targetId);
                        break;

                    case 'deck-draw':
                        handleDeckDraw(ws, currentRoom, data);
                        break;

                    case 'deck-shuffle':
                        handleDeckShuffle(ws, currentRoom);
                        break;

                    case 'crown-spread':
                        handleCrownSpread(ws, currentRoom, data);
                        break;

                    case 'deck-history':
                        handleDeckHistory(ws, currentRoom);
                        break;

                    case 'deck-history-clear':
                        handleDeckHistoryClear(ws, currentRoom);
                        break;

                    case 'whiteboard-update':
                    case 'sync-state':
                        handleWhiteboardUpdate(ws, currentRoom, data);
                        break;

                    case 'sync-request':
                        handleSyncRequest(ws, currentRoom);
                        break;

                    case 'state-updated':
                        handleStateUpdated(ws, currentRoom, data);
                        break;

                    case 'set-region':
                        handleSetRegion(ws, currentRoom, data);
                        break;

                    case 'kick_client':
                        if (ws.clientData.role === 'gm') {
                            room.kickClient(currentRoom, data.targetId, data.reason || 'Kicked');
                            room.broadcastToRoom(roomKey, 'presence', { clients: room.getClientsList(currentRoom) }, ws.clientId);
                        }
                        break;

                    case 'ban_client':
                        if (ws.clientData.role === 'gm') {
                            room.banClient(currentRoom, data.targetId, data.reason || 'Banned');
                            room.broadcastToRoom(roomKey, 'presence', { clients: room.getClientsList(currentRoom) }, ws.clientId);
                        }
                        break;

                    case 'unban_client':
                        if (ws.clientData.role === 'gm') {
                            room.unbanClient(currentRoom, data.targetId);
                            ws.send(JSON.stringify({ type: 'unban_client_ack', targetId: data.targetId }));
                        }
                        break;

                    case 'media_recording':
                    case 'voice-offer':
                    case 'voice-answer':
                    case 'voice-ice-candidate':
                    case 'voice-status':
                    case 'chat-message':
                    case 'roll-dice':
                    case 'roll-result':
                    case 'event':
                    case 'operation':
                    case 'operation_ack':
                    case 'presence':
                    case 'module-push':
                    case 'module-cleanup':
                        room.broadcastToRoom(roomKey, messageType, data, ws.clientId);
                        break;

                    default:
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Unknown message type: ${messageType}`
                        }));
                }
            } catch (error) {
                logger.error('Error parsing plain WS message', { clientId, error: error.message });
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format: ' + error.message }));
            }
        });

        // ─── Close handler ──────────────────────────────────────────
        ws.on('close', () => {
            if (pingInterval) clearInterval(pingInterval);
            logger.info('🔌 Plain WebSocket client disconnected', { clientId, room: roomKey });
            const r = room.rooms.get(roomKey);
            if (r) {
                const wasGm = r.clients.get(clientId)?.role === 'gm';
                r.clients.delete(clientId);
                room.broadcastToRoom(roomKey, 'presence', { clients: room.getClientsList(r) }, clientId);
                room.broadcastToRoom(roomKey, 'player-left', {
                    clientId,
                    clientName: ws.clientData?.name || 'Player',
                    clients: room.getClientsList(r)
                }, clientId);
                if (wasGm) {
                    room.broadcastToRoom(roomKey, 'server_announcement', {
                        message: 'The Game Master has disconnected.',
                        timestamp: Date.now()
                    }, clientId);
                }
                if (r.clients.size === 0) {
                    room.rooms.delete(roomKey);
                    logger.info('🗑️ Room deleted (empty)', { room: roomKey });
                }
            }
            socketStats.wsConnections--;
        });

        ws.on('error', (error) => {
            logger.error('Plain WS error', { clientId, room: roomKey, error: error.message });
        });
    });
}

// ─── Handler implementations ──────────────────────────────────────────

function handleHandshake(ws, roomState, data) {
    // Password check (parity with Socket.io join-room)
    if (roomState.password && roomState.password !== data.password) {
        ws.send(JSON.stringify({ type: 'error', message: 'Incorrect room password.' }));
        ws.close(4003, 'Incorrect password');
        return;
    }

    let assignedRole = data.role || 'player';
    const existingGm = room.getExistingGm(roomState);
    if (assignedRole === 'gm' && existingGm) {
        assignedRole = 'player';
        ws.send(JSON.stringify({ type: 'error', message: 'A GM is already hosting this room. You have joined as a Player.', code: 'GM_CONFLICT' }));
    }
    ws.clientData.name = data.clientName || 'Player';
    ws.clientData.role = assignedRole;
    ws.clientData.email = data.clientEmail || '';
    roomState.clients.set(ws.clientId, ws.clientData);

    const clientsList = room.getClientsList(roomState);
    ws.send(JSON.stringify({ type: 'handshake_ack', success: true, clientId: ws.clientId, clientRole: assignedRole, versionVector: {}, activeClients: clientsList }));
    room.broadcastToRoom(roomState.code, 'presence', { clients: clientsList }, ws.clientId);
    room.broadcastToRoom(roomState.code, 'player-joined', {
        clientId: ws.clientId,
        clientName: ws.clientData.name,
        role: ws.clientData.role,
        clients: clientsList
    }, ws.clientId);
}

// ─── CHARACTER SYNC: store full characters ──────────────────────────
function handleStateUpdated(ws, roomState, data) {
    // If the update contains a characters array, store it in roomState.characters
    if (data.state && data.state.characters && Array.isArray(data.state.characters)) {
        roomState.characters = buildSafeDict(data.state.characters, c => c && c.name);
    } else if (data.characters && Array.isArray(data.characters)) {
        // Also support direct characters field
        roomState.characters = buildSafeDict(data.characters, c => c && c.name);
    }

    roomState.lastActivity = Date.now();
    // Broadcast to all clients in the room (including sender)
    room.broadcastToRoom(roomState.code, 'state-updated', data, ws.clientId);
}

// ─── DECK HANDLERS ──────────────────────────────────────────────────

async function handleDeckDraw(ws, roomState, data) {
    try {
        const { region = 'Acasia' } = data;
        const count = clampCount(data.count);
        if (!roomState.deck || roomState.deck.length === 0) roomState.deck = deck.buildDeck();
        if (roomState.deck.length < count) roomState.deck = deck.buildDeck();

        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (roomState.deck.length === 0) roomState.deck = deck.buildDeck();
            drawn.push(roomState.deck.pop());
        }

        const regionData = await deck.loadRegionData(region);
        const isCrown = count === 5;
        const synthesis = isCrown
            ? deck.synthesiseCrownSpread(drawn.slice(0,4), drawn[4], regionData)
            : deck.synthesiseConsequence(drawn, regionData);

        const result = {
            type: 'deck-drawn',
            cards: drawn,
            synthesis,
            cardCount: count,
            region,
            remaining: roomState.deck.length,
            timestamp: Date.now()
        };

        roomState.deckHistory = roomState.deckHistory || [];
        roomState.deckHistory.push({
            cards: drawn.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
            synthesis: typeof synthesis === 'string' ? synthesis : (synthesis?.synthesis || synthesis),
            type: isCrown ? 'Crown Spread' : `${count} Draw${count > 1 ? 's' : ''}`,
            timestamp: Date.now()
        });
        if (roomState.deckHistory.length > 100) roomState.deckHistory = roomState.deckHistory.slice(-100);

        roomState.lastActivity = Date.now();
        room.broadcastToRoom(roomState.code, 'deck-drawn', result, ws.clientId);
        ws.send(JSON.stringify({ type: 'deck-drawn-success', ...result }));
    } catch (error) {
        logger.error('Error in plain WS deck draw', { room: roomState.code, error: error.message });
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to draw cards: ' + error.message }));
    }
}

function handleDeckShuffle(ws, roomState) {
    roomState.deck = deck.buildDeck();
    roomState.deckOffset = Math.floor(Math.random() * 1000);
    roomState.lastActivity = Date.now();
    room.broadcastToRoom(roomState.code, 'deck-shuffled', { remaining: roomState.deck.length, timestamp: Date.now() }, ws.clientId);
    ws.send(JSON.stringify({ type: 'deck-shuffled-success', remaining: roomState.deck.length, timestamp: Date.now() }));
}

async function handleCrownSpread(ws, roomState, data) {
    try {
        const { region = 'Acasia' } = data;
        if (!roomState.deck || roomState.deck.length < 5) roomState.deck = deck.buildDeck();

        const cards = [];
        for (let i = 0; i < 5; i++) {
            if (roomState.deck.length === 0) roomState.deck = deck.buildDeck();
            cards.push(roomState.deck.pop());
        }
        const mainCards = cards.slice(0,4);
        const wildcard = cards[4];
        const regionData = await deck.loadRegionData(region);
        const result = deck.synthesiseCrownSpread(mainCards, wildcard, regionData);

        roomState.deckHistory = roomState.deckHistory || [];
        roomState.deckHistory.push({
            cards: cards.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
            synthesis: result.synthesis,
            type: 'Crown Spread',
            timestamp: Date.now()
        });
        roomState.lastActivity = Date.now();

        const response = {
            type: 'crown-spread',
            cards,
            mainCards,
            wildcard,
            result,
            remaining: roomState.deck.length,
            timestamp: Date.now()
        };
        room.broadcastToRoom(roomState.code, 'crown-spread', response, ws.clientId);
        ws.send(JSON.stringify({ type: 'crown-spread-success', ...response }));
    } catch (error) {
        logger.error('Error in plain WS crown spread', { room: roomState.code, error: error.message });
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to process crown spread: ' + error.message }));
    }
}

function handleDeckHistory(ws, roomState) {
    const history = (roomState.deckHistory || []).slice(-50);
    ws.send(JSON.stringify({ type: 'deck-history', history, count: history.length, total: roomState.deckHistory?.length || 0 }));
}

function handleDeckHistoryClear(ws, roomState) {
    roomState.deckHistory = [];
    roomState.lastActivity = Date.now();
    room.broadcastToRoom(roomState.code, 'deck-history-cleared', { timestamp: Date.now() }, ws.clientId);
    ws.send(JSON.stringify({ type: 'deck-history-cleared-success', timestamp: Date.now() }));
}

// ─── WHITEBOARD: store full object ────────────────────────────────

function handleWhiteboardUpdate(ws, roomState, data) {
    let newWhiteboard = data.whiteboard || data.state || data;
    roomState.whiteboard = newWhiteboard;
    roomState.lastActivity = Date.now();
    room.broadcastToRoom(roomState.code, 'whiteboard-update', {
        whiteboard: roomState.whiteboard,
        timestamp: Date.now(),
        source: 'plain-ws'
    }, ws.clientId);
}

// ─── SYNC REQUEST: send whiteboard + characters ──────────────────

function handleSyncRequest(ws, roomState) {
    // Send whiteboard state
    ws.send(JSON.stringify({
        type: 'sync-state',
        state: roomState.whiteboard || {},
        timestamp: Date.now()
    }));
    // Also send characters if present
    if (roomState.characters) {
        ws.send(JSON.stringify({
            type: 'state-updated',
            characters: Object.values(roomState.characters),
            timestamp: Date.now()
        }));
    }
}

// ─── REGION HANDLER ────────────────────────────────────────────────

function handleSetRegion(ws, roomState, data) {
    const region = data?.region;
    if (!region) {
        ws.send(JSON.stringify({ type: 'error', message: 'Region name required' }));
        return;
    }
    if (!roomState.data) roomState.data = {};
    roomState.data.region = region;
    roomState.lastActivity = Date.now();
    room.broadcastToRoom(roomState.code, 'region-updated', {
        region,
        clientName: ws.clientData?.name || 'Player'
    }, ws.clientId);
}

module.exports = { setupWSS, socketStats };
