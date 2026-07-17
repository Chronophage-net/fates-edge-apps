/**
 * Fate's Edge - Plain WebSocket Handlers
 * v2 – Sender exclusion to prevent self‑echo
 */

const WebSocket = require('ws');
const room = require('./room.js');
const deck = require('./deck.js');
const logger = require('./logger.js').createLogger(process.env.LOG_LEVEL || 'INFO');

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

        let currentRoom = room.rooms.get(roomKey);
        if (!currentRoom) {
            currentRoom = room.createRoom(roomKey);
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

        // Send connected message
        ws.send(JSON.stringify({
            type: 'connected',
            clientId,
            room: roomKey,
            timestamp: Date.now(),
            message: 'Connected to Fate\'s Edge WebSocket server',
            protocols: ['socket.io', 'plain-websocket'],
            serverVersion: '1.0.0'
        }));

        // Send room state
        ws.send(JSON.stringify({
            type: 'room-state',
            room: roomKey,
            deckRemaining: currentRoom.deck?.length || 0,
            historyCount: currentRoom.deckHistory?.length || 0,
            whiteboard: currentRoom.whiteboard,
            timestamp: Date.now()
        }));

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
                        // Broadcast to all other clients
                        room.broadcastToRoom(roomKey, 'state-updated', data, ws.clientId);
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

// ─── Handler implementations (with sender exclusion) ──────────────────

function handleHandshake(ws, roomState, data) {
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

async function handleDeckDraw(ws, roomState, data) {
    try {
        const { count = 1, region = 'Acasia' } = data;
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

function handleWhiteboardUpdate(ws, roomState, data) {
    let newWhiteboard = data.whiteboard || data.state || data;
    roomState.whiteboard = {
        drawings: newWhiteboard.drawings || [],
        notes: newWhiteboard.notes || [],
        images: newWhiteboard.images || [],
        settings: { ...roomState.whiteboard.settings, ...(newWhiteboard.settings || {}) },
        gridCombat: { ...roomState.whiteboard.gridCombat, ...(newWhiteboard.gridCombat || {}) }
    };
    roomState.lastActivity = Date.now();
    room.broadcastToRoom(roomState.code, 'whiteboard-update', {
        whiteboard: roomState.whiteboard,
        timestamp: Date.now(),
        source: 'plain-ws'
    }, ws.clientId);
}

function handleSyncRequest(ws, roomState) {
    ws.send(JSON.stringify({ type: 'sync-state', state: roomState.whiteboard, timestamp: Date.now() }));
}

module.exports = { setupWSS, socketStats };