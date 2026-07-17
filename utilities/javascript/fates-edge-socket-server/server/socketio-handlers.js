/**
 * Fate's Edge - Socket.io Handlers
 */

const room = require('./room.js');
const deck = require('./deck.js');
const logger = require('./logger.js').createLogger(process.env.LOG_LEVEL || 'INFO');
const fs = require('fs');
const path = require('path');

let socketStats = { socketIOConnections: 0, totalConnections: 0 };

function setupSocketIO(io) {
    io.on('connection', (socket) => {
        socketStats.socketIOConnections++;
        socketStats.totalConnections++;

        logger.info('🔌 Socket.io client connected', { socketId: socket.id });

        socket.clientData = {
            id: socket.id,
            name: 'Player',
            role: 'player',
            email: '',
            type: 'socket.io',
            socket: socket
        };

        socket.on('join-room', (data) => {
            const { roomCode, playerName, playerRole = 'player', playerEmail = '' } = data;
            if (!roomCode || !room.validateRoomCode(roomCode)) {
                socket.emit('error', { message: 'Invalid room code' });
                return;
            }
            const roomKey = roomCode.toUpperCase();

            // Leave previous room
            if (socket.room) {
                socket.leave(socket.room);
                const oldRoom = room.rooms.get(socket.room);
                if (oldRoom) {
                    const wasGm = oldRoom.clients.get(socket.id)?.role === 'gm';
                    oldRoom.clients.delete(socket.id);
                    const oldClientsList = room.getClientsList(oldRoom);
                    io.to(socket.room).emit('player-left', {
                        clientId: socket.id,
                        clientName: socket.clientData?.name || 'Player',
                        clients: oldClientsList
                    });
                    if (wasGm) {
                        room.broadcastToRoom(socket.room, 'server_announcement', {
                            message: 'The Game Master has disconnected.',
                            timestamp: Date.now()
                        });
                    }
                }
            }

            let currentRoom = room.rooms.get(roomKey);
            if (!currentRoom) {
                currentRoom = room.createRoom(roomKey);
                logger.info('📋 Room created via Socket.io', { room: roomKey });
            }

            // Ban check
            if (room.isBanned(currentRoom, socket.id)) {
                socket.emit('error', { message: 'You are banned from this room.' });
                socket.disconnect(true);
                return;
            }

            // GM conflict
            let assignedRole = playerRole;
            const existingGm = room.getExistingGm(currentRoom);
            if (assignedRole === 'gm' && existingGm) {
                assignedRole = 'player';
                socket.emit('error', { message: 'A GM is already hosting this room. You have joined as a Player.', code: 'GM_CONFLICT' });
            }

            socket.join(roomKey);
            socket.room = roomKey;
            socket.clientData.name = playerName || 'Player';
            socket.clientData.role = assignedRole;
            socket.clientData.email = playerEmail;
            currentRoom.clients.set(socket.id, socket.clientData);
            currentRoom.lastActivity = Date.now();

            const clientsList = room.getClientsList(currentRoom);

            socket.emit('room-joined', {
                room: roomKey,
                clients: clientsList,
                clientRole: assignedRole,
                deckRemaining: currentRoom.deck.length,
                deckHistory: currentRoom.deckHistory.slice(-20),
                totalClients: currentRoom.clients.size,
                whiteboard: currentRoom.whiteboard
            });

            room.broadcastToRoom(roomKey, 'presence', { clients: clientsList });
            room.broadcastToRoom(roomKey, 'player-joined', {
                clientId: socket.id,
                clientName: socket.clientData.name,
                role: socket.clientData.role,
                clients: clientsList
            });
        });

        socket.on('request_gm', () => {
            if (!socket.room) return;
            const r = room.rooms.get(socket.room);
            if (!r) return;
            room.handleGmRequest(r, socket.id);
        });

        socket.on('approve_gm', (data) => {
            if (!socket.room) return;
            const r = room.rooms.get(socket.room);
            if (!r) return;
            const targetId = data?.targetId;
            if (!targetId) return;
            room.handleGmApproval(r, socket.id, targetId);
        });

        // Deck operations
        socket.on('deck-draw', async (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            try {
                const { count = 1, region = 'Acasia' } = data || {};
                if (!r.deck || r.deck.length === 0) r.deck = deck.buildDeck();
                if (r.deck.length < count) r.deck = deck.buildDeck();

                const drawn = [];
                for (let i = 0; i < count; i++) {
                    if (r.deck.length === 0) r.deck = deck.buildDeck();
                    drawn.push(r.deck.pop());
                }

                const regionData = await deck.loadRegionData(region);
                const isCrown = count === 5;
                const synthesis = isCrown
                    ? deck.synthesiseCrownSpread(drawn.slice(0,4), drawn[4], regionData)
                    : deck.synthesiseConsequence(drawn, regionData);

                const result = {
                    cards: drawn,
                    synthesis,
                    type: isCrown ? 'crown' : String(count),
                    region,
                    remaining: r.deck.length,
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                };

                r.deckHistory = r.deckHistory || [];
                r.deckHistory.push({
                    cards: drawn.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                    synthesis: typeof synthesis === 'string' ? synthesis : (synthesis?.synthesis || synthesis),
                    type: isCrown ? 'Crown Spread' : `${count} Draw${count > 1 ? 's' : ''}`,
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                });
                if (r.deckHistory.length > 100) r.deckHistory = r.deckHistory.slice(-100);

                r.lastActivity = Date.now();
                room.broadcastToRoom(socket.room, 'deck-drawn', result);
            } catch (error) {
                logger.error('Error in Socket.io deck draw', { error: error.message });
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('deck-shuffle', () => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            r.deck = deck.buildDeck();
            r.deckOffset = Math.floor(Math.random() * 1000);
            r.lastActivity = Date.now();
            room.broadcastToRoom(socket.room, 'deck-shuffled', {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                remaining: r.deck.length,
                timestamp: Date.now()
            });
        });

        socket.on('deck-history', (callback) => {
            if (!socket.room) { callback?.({ error: 'Not in a room' }); return; }
            const r = room.rooms.get(socket.room);
            if (!r) { callback?.({ error: 'Room not found' }); return; }
            const history = (r.deckHistory || []).slice(-50);
            if (typeof callback === 'function') callback({ history, count: history.length, total: r.deckHistory?.length || 0 });
        });

        socket.on('deck-history-clear', () => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            r.deckHistory = [];
            r.lastActivity = Date.now();
            room.broadcastToRoom(socket.room, 'deck-history-cleared', {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                timestamp: Date.now()
            });
        });

        socket.on('crown-spread', async (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            try {
                const { region = 'Acasia' } = data || {};
                if (!r.deck || r.deck.length < 5) r.deck = deck.buildDeck();
                const cards = [];
                for (let i = 0; i < 5; i++) {
                    if (r.deck.length === 0) r.deck = deck.buildDeck();
                    cards.push(r.deck.pop());
                }
                const mainCards = cards.slice(0,4);
                const wildcard = cards[4];
                const regionData = await deck.loadRegionData(region);
                const result = deck.synthesiseCrownSpread(mainCards, wildcard, regionData);

                r.deckHistory = r.deckHistory || [];
                r.deckHistory.push({
                    cards: cards.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                    synthesis: result.synthesis,
                    type: 'Crown Spread',
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                });
                r.lastActivity = Date.now();
                const response = {
                    success: true,
                    cards, mainCards, wildcard,
                    result, remaining: r.deck.length,
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                };
                room.broadcastToRoom(socket.room, 'crown-spread', response);
            } catch (error) {
                socket.emit('error', { message: 'Failed to process crown spread: ' + error.message });
            }
        });

        // Module management
        socket.on('module-push-request', (data, callback) => {
            const { moduleId } = data || {};
            if (!moduleId) return callback?.({ error: 'Module ID required' });
            const modulesPath = path.join(__dirname, 'modules', moduleId);
            if (!fs.existsSync(modulesPath)) return callback?.({ error: 'Module not found' });
            const manifestPath = path.join(modulesPath, 'manifest.json');
            if (!fs.existsSync(manifestPath)) return callback?.({ error: 'Module manifest not found' });

            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                const moduleData = { id: moduleId, manifest, files: {} };
                const files = fs.readdirSync(modulesPath);
                for (const file of files) {
                    if (file !== 'manifest.json') {
                        const filePath = path.join(modulesPath, file);
                        if (fs.statSync(filePath).isFile()) {
                            moduleData.files[file] = fs.readFileSync(filePath, 'utf-8');
                        }
                    }
                }
                if (socket.room) {
                    room.broadcastToRoom(socket.room, 'module-push', {
                        source: socket.id,
                        clientName: socket.clientData?.name || 'Player',
                        module: moduleData,
                        timestamp: Date.now()
                    });
                }
                callback?.({ success: true, module: moduleData });
            } catch (error) {
                callback?.({ error: error.message });
            }
        });

        socket.on('module-cleanup-request', (data, callback) => {
            const { moduleId } = data || {};
            if (!moduleId) return callback?.({ error: 'Module ID required' });
            if (socket.room) {
                room.broadcastToRoom(socket.room, 'module-cleanup', {
                    moduleId,
                    source: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                });
            }
            callback?.({ success: true, moduleId });
        });

        socket.on('module-list', (callback) => {
            const modules = [];
            const modulesPath = path.join(__dirname, 'modules');
            if (fs.existsSync(modulesPath)) {
                const items = fs.readdirSync(modulesPath);
                for (const item of items) {
                    const itemPath = path.join(modulesPath, item);
                    if (fs.statSync(itemPath).isDirectory()) {
                        const manifestPath = path.join(itemPath, 'manifest.json');
                        if (fs.existsSync(manifestPath)) {
                            try {
                                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                                modules.push({
                                    id: item,
                                    name: manifest.name || item,
                                    version: manifest.version || '1.0.0',
                                    description: manifest.description || '',
                                    author: manifest.author || '',
                                    type: manifest.type || 'module',
                                    icon: manifest.icon || '📦',
                                    route: manifest.route || null
                                });
                            } catch (e) { /* ignore */ }
                        }
                    }
                }
            }
            if (typeof callback === 'function') callback({ modules, count: modules.length, timestamp: Date.now() });
        });

        // Whiteboard
        socket.on('whiteboard-update', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            let newWhiteboard = data.whiteboard || data.state || data;
            r.whiteboard = {
                drawings: newWhiteboard.drawings || [],
                notes: newWhiteboard.notes || [],
                images: newWhiteboard.images || [],
                settings: { ...r.whiteboard.settings, ...(newWhiteboard.settings || {}) },
                gridCombat: { ...r.whiteboard.gridCombat, ...(newWhiteboard.gridCombat || {}) }
            };
            r.lastActivity = Date.now();
            room.broadcastToRoom(socket.room, 'whiteboard-update', {
                whiteboard: r.whiteboard,
                timestamp: Date.now(),
                source: 'socket.io',
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player'
            });
        });

        socket.on('sync-request', () => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            socket.emit('sync-state', { state: r.whiteboard, timestamp: Date.now() });
        });

        socket.on('sync-state', (data) => {
            socket.emit('whiteboard-update', data);
        });

        // Relay events
        const relayEvents = [
            'media_recording', 'voice-offer', 'voice-answer', 'voice-ice-candidate',
            'voice-status', 'chat-message', 'roll-dice', 'roll-result',
            'event', 'operation', 'operation_ack', 'presence'
        ];
        relayEvents.forEach(eventName => {
            socket.on(eventName, (data) => {
                if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
                room.broadcastToRoom(socket.room, eventName, {
                    ...data,
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player'
                });
            });
        });

        // Ban/Kick
        socket.on('kick_client', (data) => {
            if (!socket.room || socket.clientData.role !== 'gm') return;
            const r = room.rooms.get(socket.room);
            if (!r) return;
            room.kickClient(r, data.targetId, data.reason || 'Kicked by GM');
            room.broadcastToRoom(socket.room, 'presence', { clients: room.getClientsList(r) });
        });

        socket.on('ban_client', (data) => {
            if (!socket.room || socket.clientData.role !== 'gm') return;
            const r = room.rooms.get(socket.room);
            if (!r) return;
            room.banClient(r, data.targetId, data.reason || 'Banned by GM');
            room.broadcastToRoom(socket.room, 'presence', { clients: room.getClientsList(r) });
        });

        socket.on('unban_client', (data) => {
            if (!socket.room || socket.clientData.role !== 'gm') return;
            const r = room.rooms.get(socket.room);
            if (!r) return;
            room.unbanClient(r, data.targetId);
            socket.emit('unban_client_ack', { targetId: data.targetId });
        });

        // Disconnect
        socket.on('disconnect', () => {
            socketStats.socketIOConnections--;
            if (socket.room) {
                const r = room.rooms.get(socket.room);
                if (r) {
                    const wasGm = r.clients.get(socket.id)?.role === 'gm';
                    r.clients.delete(socket.id);
                    room.broadcastToRoom(socket.room, 'presence', { clients: room.getClientsList(r) });
                    room.broadcastToRoom(socket.room, 'player-left', {
                        clientId: socket.id,
                        clientName: socket.clientData?.name || 'Player',
                        clients: room.getClientsList(r)
                    });
                    if (wasGm) {
                        room.broadcastToRoom(socket.room, 'server_announcement', {
                            message: 'The Game Master has disconnected.',
                            timestamp: Date.now()
                        });
                    }
                    if (r.clients.size === 0) {
                        room.rooms.delete(socket.room);
                        logger.info('🗑️ Room deleted (empty)', { room: socket.room });
                    }
                }
            }
        });
    });
}

module.exports = { setupSocketIO, socketStats };
