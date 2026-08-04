/**
 * Fate's Edge - Socket.io Handlers
 * v6 – Adventure Engine wired in (see server/adventure.js)
 */

const room = require('./room.js');
const deck = require('./deck.js');
const logger = require('./logger.js').createLogger(process.env.LOG_LEVEL || 'INFO');
const fs = require('fs');
const path = require('path');
const { buildSafeDict, isSafeModuleId, clampCount } = require('./security.js');
const adventure = require('./adventure.js');
const auth = require('./auth.js');

// Optional -- see storage.js's file-header note on why account features
// degrade gracefully instead of hard-failing if the DB module isn't
// available (e.g. the file-system fallback in api.js is active).
let storage = null;
try { storage = require('./storage.js'); } catch (e) { storage = null; }
function hasAccountSupport() { return !!(storage && typeof storage.getMembership === 'function'); }

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

        // ─── Join Room ──────────────────────────────────────────────
        // NEW: `authToken` is optional -- a client with no account (or an
        // expired/invalid token) joins exactly as before, anonymously,
        // always subject to the room password if one is set. A client
        // that supplies a valid token gets three things layered on top:
        // (1) a persistent ban tied to their account survives across
        // reconnects/new socket ids, where the old ban Set (keyed by
        // ephemeral socket.id) didn't; (2) once they've joined a
        // password-protected room once, they don't have to re-enter the
        // password on later joins; (3) their GM status can be persisted
        // (see room.js's handleGmRequest/handleGmApproval) for future
        // features to build on, though live GM election behavior itself
        // is unchanged.
        socket.on('join-room', async (data) => {
            // Flexible payload: accept either clientData object or flat fields
            const {
                roomCode,
                password,
                authToken,
                clientData = {},
                playerName = clientData.name || 'Player',
                playerRole = clientData.role || 'player',
                playerEmail = clientData.email || ''
            } = data || {};

            if (!roomCode || !room.validateRoomCode(roomCode)) {
                socket.emit('error', { message: 'Invalid room code' });
                return;
            }
            const roomKey = roomCode.toUpperCase();
            const authUser = auth.verifyTokenOptional(authToken);

            // Leave previous room
            if (socket.room) {
                socket.leave(socket.room);
                const oldRoom = room.rooms.get(socket.room);
                if (oldRoom) {
                    const wasGm = oldRoom.clients.get(socket.id)?.role === 'gm';
                    oldRoom.clients.delete(socket.id);
                    const oldClientsList = room.getClientsList(oldRoom);
                    room.broadcastToRoom(socket.room, 'player-left', {
                        clientId: socket.id,
                        clientName: socket.clientData?.name || 'Player',
                        clients: oldClientsList
                    }, socket.id);
                    if (wasGm) {
                        room.broadcastToRoom(socket.room, 'server_announcement', {
                            message: 'The Game Master has disconnected.',
                            timestamp: Date.now()
                        }, socket.id);
                    }
                }
            }

            let currentRoom = room.rooms.get(roomKey);
            if (!currentRoom) {
                currentRoom = room.createRoom(roomKey);
                logger.info('📋 Room created via Socket.io', { room: roomKey });
            }

            // NEW: rooms are deleted from the in-memory Map whenever they
            // go empty (see the disconnect handler below) and rebuilt
            // fresh -- with password: null -- on the next join. Without
            // this, a persisted room password would silently stop being
            // enforced the moment a room's last client left, even for
            // seconds. Only hydrate when the in-memory value is empty;
            // set_room_password / the admin route already keep storage
            // and the in-memory room in sync going forward, so this is
            // strictly "recover what we lost when the room object was
            // recreated", not a competing source of truth.
            if (!currentRoom.password && hasAccountSupport()) {
                try {
                    const persistedHash = await storage.getRoomPasswordHash(roomKey);
                    if (persistedHash) currentRoom.password = persistedHash;
                } catch (e) {
                    logger.warn('Failed to hydrate persisted room password', { error: e.message });
                }
            }

            // Ban check (ephemeral, by socket id -- unaffected by accounts)
            if (room.isBanned(currentRoom, socket.id)) {
                socket.emit('error', { message: 'You are banned from this room.' });
                socket.disconnect(true);
                return;
            }

            // Persistent ban check (by account, survives reconnects/new socket ids)
            let membership = null;
            if (authUser && hasAccountSupport()) {
                try {
                    if (await storage.isMemberBanned(roomKey, authUser.userId)) {
                        socket.emit('error', { message: 'You are banned from this room.' });
                        socket.disconnect(true);
                        return;
                    }
                    membership = await storage.getMembership(roomKey, authUser.userId);
                } catch (e) {
                    logger.warn('Account membership lookup failed', { error: e.message });
                }
            }

            // Password check (if room has one) -- known members (an
            // existing membership row) skip re-entering it. Everyone else
            // (anonymous clients, or an authenticated user's first visit
            // to this room) still needs it.
            if (currentRoom.password && !membership) {
                const ok = await auth.verifyPassword(password, currentRoom.password);
                if (!ok) {
                    socket.emit('error', { message: 'Incorrect room password.' });
                    socket.disconnect(true);
                    return;
                }
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
            socket.clientData.name = playerName || (authUser ? authUser.username : 'Player');
            socket.clientData.role = assignedRole;
            socket.clientData.email = playerEmail;
            socket.clientData.userId = authUser ? authUser.userId : null;
            currentRoom.clients.set(socket.id, socket.clientData);
            currentRoom.lastActivity = Date.now();

            if (authUser && hasAccountSupport()) {
                storage.upsertMembership(roomKey, authUser.userId, {}).catch(e =>
                    logger.warn('Failed to upsert room membership', { error: e.message })
                );
            }

            const clientsList = room.getClientsList(currentRoom);

            // Consistent handshake acknowledgment (like plain WebSocket)
            socket.emit('handshake_ack', {
                success: true,
                clientId: socket.id,
                clientRole: assignedRole,
                versionVector: {},
                activeClients: clientsList
            });

            // ─── Include characters in room-joined ──────────────────
            const charArray = currentRoom.characters ? Object.values(currentRoom.characters) : [];

            socket.emit('room-joined', {
                room: roomKey,
                clients: clientsList,
                clientRole: assignedRole,
                deckRemaining: currentRoom.deck.length,
                deckHistory: currentRoom.deckHistory.slice(-20),
                totalClients: currentRoom.clients.size,
                whiteboard: currentRoom.whiteboard || {},
                characters: charArray  // <-- send full characters
            });

            // Broadcast with sender exclusion
            room.broadcastToRoom(roomKey, 'presence', { clients: clientsList }, socket.id);
            room.broadcastToRoom(roomKey, 'player-joined', {
                clientId: socket.id,
                clientName: socket.clientData.name,
                role: socket.clientData.role,
                clients: clientsList
            }, socket.id);
        });

        // ─── GM requests ────────────────────────────────────────────
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

        // ─── Deck operations ────────────────────────────────────────
        socket.on('deck-draw', async (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            try {
                const { region = 'Acasia' } = data || {};
                const count = clampCount(data?.count);
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
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                };

                r.deckHistory = r.deckHistory || [];
                r.deckHistory.push({
                    cards: drawn.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                    synthesis: typeof synthesis === 'string' ? synthesis : (synthesis?.synthesis || synthesis),
                    type: isCrown ? 'Crown Spread' : `${count} Draw${count > 1 ? 's' : ''}`,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                });
                if (r.deckHistory.length > 100) r.deckHistory = r.deckHistory.slice(-100);

                r.lastActivity = Date.now();
                room.broadcastToRoom(socket.room, 'deck-drawn', result, socket.id);
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
                clientName: socket.clientData?.name || 'Player',
                remaining: r.deck.length,
                timestamp: Date.now()
            }, socket.id);
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
                clientName: socket.clientData?.name || 'Player',
                timestamp: Date.now()
            }, socket.id);
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
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                });
                r.lastActivity = Date.now();
                const response = {
                    success: true,
                    cards, mainCards, wildcard,
                    result, remaining: r.deck.length,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                };
                room.broadcastToRoom(socket.room, 'crown-spread', response, socket.id);
            } catch (error) {
                socket.emit('error', { message: 'Failed to process crown spread: ' + error.message });
            }
        });

        // ─── Region ──────────────────────────────────────────────────
        socket.on('set-region', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            const region = data?.region;
            if (!region) return socket.emit('error', { message: 'Region name required' });
            if (!r.data) r.data = {};
            r.data.region = region;
            r.lastActivity = Date.now();
            room.broadcastToRoom(socket.room, 'region-updated', { region, clientName: socket.clientData?.name || 'Player' }, socket.id);
        });

        // ─── Adventure Engine ────────────────────────────────────────
        // See server/adventure.js. Mirrors the exact room-lookup pattern
        // already used by set-region above (room.rooms.get(socket.room)).
        socket.on('adventure-load', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            try {
                const state = adventure.loadAdventureModule(r, data?.moduleId);
                room.broadcastToRoom(socket.room, 'adventure-loaded', state);
            } catch (error) {
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('adventure-reset', () => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            try {
                const state = adventure.resetAdventure(r);
                room.broadcastToRoom(socket.room, 'adventure-reset', state);
            } catch (error) {
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('adventure-scene', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            try {
                const target = {};
                if (typeof data?.actIndex === 'number') target.actIndex = data.actIndex;
                if (typeof data?.sceneIndex === 'number') target.sceneIndex = data.sceneIndex;
                const state = adventure.advanceScene(r, target);
                room.broadcastToRoom(socket.room, 'scene-changed', state);
            } catch (error) {
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('adventure-encounter-start', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            try {
                const state = adventure.startEncounter(r, data?.ref, data?.encounter || null);
                room.broadcastToRoom(socket.room, 'encounter-started', state);
            } catch (error) {
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('adventure-encounter-resolve', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            try {
                const state = adventure.resolveEncounter(r, { outcome: data?.outcome, notes: data?.notes });
                room.broadcastToRoom(socket.room, 'encounter-resolved', state);
            } catch (error) {
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('adventure-timer', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            try {
                const state = adventure.tickTimer(r, { scope: data?.scope, ref: data?.ref, name: data?.name, amount: data?.amount });
                room.broadcastToRoom(socket.room, 'timer-ticked', state);
            } catch (error) {
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('adventure-log', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            try {
                const state = adventure.logBeat(r, { text: data?.text, author: data?.author });
                room.broadcastToRoom(socket.room, 'adventure-log', state);
            } catch (error) {
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('adventure-state', (callback) => {
            if (!socket.room) { callback?.({ error: 'Not in a room' }); return; }
            const r = room.rooms.get(socket.room);
            if (!r) { callback?.({ error: 'Room not found' }); return; }
            if (typeof callback === 'function') callback(adventure.getPublicState(r));
        });

        socket.on('adventure-reference', (callback) => {
            if (!socket.room) { callback?.({ error: 'Not in a room' }); return; }
            const r = room.rooms.get(socket.room);
            if (!r) { callback?.({ error: 'Room not found' }); return; }
            try {
                if (typeof callback === 'function') callback(adventure.getReferenceData(r));
            } catch (error) {
                if (typeof callback === 'function') callback({ error: error.message });
            }
        });

        // ─── Module management ──────────────────────────────────────
        socket.on('module-push-request', (data, callback) => {
            const { moduleId } = data || {};
            if (!moduleId) return callback?.({ error: 'Module ID required' });
            if (!isSafeModuleId(moduleId)) return callback?.({ error: 'Invalid module id' });
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
                    }, socket.id);
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
                }, socket.id);
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

        // ─── WHITEBOARD: store full object ──────────────────────────
        socket.on('whiteboard-update', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            let newWhiteboard = data.whiteboard || data.state || data;
            r.whiteboard = newWhiteboard;
            r.lastActivity = Date.now();
            room.broadcastToRoom(socket.room, 'whiteboard-update', {
                whiteboard: r.whiteboard,
                timestamp: Date.now(),
                source: 'socket.io',
                clientName: socket.clientData?.name || 'Player'
            }, socket.id);
        });

        // ─── CHARACTER SYNC: store full characters ──────────────────
        socket.on('state-updated', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });

            // If the update contains a characters array, store it in r.characters
            if (data.state && data.state.characters && Array.isArray(data.state.characters)) {
                r.characters = buildSafeDict(data.state.characters, c => c && c.name);
            } else if (data.characters && Array.isArray(data.characters)) {
                // Also support direct characters field
                r.characters = buildSafeDict(data.characters, c => c && c.name);
            }

            r.lastActivity = Date.now();
            // Broadcast to all clients in the room (including sender)
            room.broadcastToRoom(socket.room, 'state-updated', data, socket.id);
        });

        // ─── Sync requests ──────────────────────────────────────────
        socket.on('sync-request', (data) => {
            if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
            const r = room.rooms.get(socket.room);
            if (!r) return socket.emit('error', { message: 'Room not found' });
            // Send presence update
            socket.emit('presence', { clients: room.getClientsList(r) });
            // Send whiteboard state
            socket.emit('sync-state', { state: r.whiteboard || {}, timestamp: Date.now() });
            // Also send characters if present
            if (r.characters) {
                socket.emit('state-updated', {
                    characters: Object.values(r.characters),
                    timestamp: Date.now()
                });
            }
        });

        socket.on('sync-state', (data) => {
            socket.emit('whiteboard-update', data);
        });

        // ─── Relay events ───────────────────────────────────────────
        const relayEvents = [
            'media_recording', 'voice-offer', 'voice-answer', 'voice-ice-candidate',
            'voice-status', 'chat-message', 'roll-dice', 'roll-result',
            'event', 'operation', 'operation_ack', 'presence',
            // NEW: parity with the plain-WS handler's direct-broadcast list
            // (ws-handlers.js) -- these were relay-only there but silently
            // dropped for Socket.IO-connected clients, since Socket.IO only
            // relays events explicitly listed here. Non-destructive,
            // broadcast-only notifications (e.g. a VTT mod announcing its
            // current scene/combat status) should reach every connected
            // client regardless of which transport they used to connect.
            'scene-status-update', 'combat-status-update'
        ];
        relayEvents.forEach(eventName => {
            socket.on(eventName, (data) => {
                if (!socket.room) return socket.emit('error', { message: 'Not in a room' });
                room.broadcastToRoom(socket.room, eventName, {
                    ...data,
                    clientName: socket.clientData?.name || 'Player'
                }, socket.id);
            });
        });

        // ─── Room password (GM only) ─────────────────────────────────
        // NEW: previously nothing could actually set room.password (see
        // room.js's setRoomPassword comment) -- this is the live,
        // client-facing way for a GM to add/change/clear it mid-session,
        // mirroring the REST admin route POST /api/rooms/:code/password.
        socket.on('set_room_password', async (data) => {
            if (!socket.room || socket.clientData.role !== 'gm') return;
            const r = room.rooms.get(socket.room);
            if (!r) return;
            const password = data && data.password;
            const hash = password ? await auth.hashPassword(String(password)) : null;
            room.setRoomPassword(r, hash);
            if (hasAccountSupport()) {
                storage.setRoomPasswordHash(r.code, hash).catch(e =>
                    logger.warn('Failed to persist room password', { error: e.message })
                );
            }
            socket.emit('set_room_password_ack', { success: true, passwordSet: !!hash });
        });

        // ─── Ban/Kick ───────────────────────────────────────────────
        socket.on('kick_client', (data) => {
            if (!socket.room || socket.clientData.role !== 'gm') return;
            const r = room.rooms.get(socket.room);
            if (!r) return;
            room.kickClient(r, data.targetId, data.reason || 'Kicked by GM');
            room.broadcastToRoom(socket.room, 'presence', { clients: room.getClientsList(r) }, socket.id);
        });

        socket.on('ban_client', (data) => {
            if (!socket.room || socket.clientData.role !== 'gm') return;
            const r = room.rooms.get(socket.room);
            if (!r) return;
            room.banClient(r, data.targetId, data.reason || 'Banned by GM');
            room.broadcastToRoom(socket.room, 'presence', { clients: room.getClientsList(r) }, socket.id);
        });

        socket.on('unban_client', (data) => {
            if (!socket.room || socket.clientData.role !== 'gm') return;
            const r = room.rooms.get(socket.room);
            if (!r) return;
            room.unbanClient(r, data.targetId);
            socket.emit('unban_client_ack', { targetId: data.targetId });
        });

        // ─── Disconnect ─────────────────────────────────────────────
        // ─── Leave Room ─────────────────────────────────────────────
        // Explicit leave (as opposed to disconnect): client is staying
        // connected but navigating away from this room.
        socket.on('leave-room', (roomCodeArg) => {
            const targetRoom = (typeof roomCodeArg === 'string' ? roomCodeArg : socket.room);
            if (!targetRoom || targetRoom !== socket.room) return;
            socket.leave(targetRoom);
            const r = room.rooms.get(targetRoom);
            if (r) {
                const wasGm = r.clients.get(socket.id)?.role === 'gm';
                r.clients.delete(socket.id);
                room.broadcastToRoom(targetRoom, 'presence', { clients: room.getClientsList(r) }, socket.id);
                room.broadcastToRoom(targetRoom, 'player-left', {
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    clients: room.getClientsList(r)
                }, socket.id);
                if (wasGm) {
                    room.broadcastToRoom(targetRoom, 'server_announcement', {
                        message: 'The Game Master has disconnected.',
                        timestamp: Date.now()
                    }, socket.id);
                }
                if (r.clients.size === 0) {
                    room.rooms.delete(targetRoom);
                    logger.info('🗑️ Room deleted (empty)', { room: targetRoom });
                }
            }
            socket.room = null;
        });

        // ─── Get Clients ────────────────────────────────────────────
        // Returns the client list for the caller's current room via the
        // ack callback, per DESIGN.md's documented `get-clients` event.
        socket.on('get-clients', (callback) => {
            if (typeof callback !== 'function') return;
            if (!socket.room) { callback([]); return; }
            const r = room.rooms.get(socket.room);
            callback(r ? room.getClientsList(r) : []);
        });

        socket.on('disconnect', () => {
            socketStats.socketIOConnections--;
            if (socket.room) {
                const r = room.rooms.get(socket.room);
                if (r) {
                    const wasGm = r.clients.get(socket.id)?.role === 'gm';
                    r.clients.delete(socket.id);
                    room.broadcastToRoom(socket.room, 'presence', { clients: room.getClientsList(r) }, socket.id);
                    room.broadcastToRoom(socket.room, 'player-left', {
                        clientId: socket.id,
                        clientName: socket.clientData?.name || 'Player',
                        clients: room.getClientsList(r)
                    }, socket.id);
                    if (wasGm) {
                        room.broadcastToRoom(socket.room, 'server_announcement', {
                            message: 'The Game Master has disconnected.',
                            timestamp: Date.now()
                        }, socket.id);
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
