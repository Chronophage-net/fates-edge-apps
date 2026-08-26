/**
 * Fate's Edge - Plain WebSocket Handlers
 * v5 – Player name + selected character separation
 * v6 – Adventure Engine wired in (see server/adventure.js)
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const room = require('./room.js');
const deck = require('./deck.js');
const logger = require('./logger.js').createLogger(process.env.LOG_LEVEL || 'INFO');
const { buildSafeDict, clampCount, isSafeModuleId, clampString, MAX_NAME_LENGTH, sanitizeCharacterSelection, isGmLike, createConnectionMessageLimiter } = require('./security.js');
const adventure = require('./adventure.js');
const timers = require('./timers.js'); // NEW: ad-hoc timers -- deliberately separate from adventure.js, see server/timers.js header
const auth = require('./auth.js');
const turn = require('./turn.js');

// Installable modules (see server/api.js's /api/modules routes and
// DATA_SCHEMA.md's "Adventure modules" section) live at <repo-root>/modules/,
// a sibling of server/ -- NOT server/modules/. This transport's
// 'module-push-request'/'module-cleanup-request'/'module-list' handlers
// mirror socketio-handlers.js's, which already got this path right.
const MODULES_DIR = path.join(__dirname, '..', 'modules');

// See socketio-handlers.js's identical note -- accounts degrade
// gracefully if the DB storage module didn't load.
let storage = null;
try { storage = require('./storage.js'); } catch (e) { storage = null; }
function hasAccountSupport() { return !!(storage && typeof storage.getMembership === 'function'); }

let socketStats = { wsConnections: 0, totalConnections: 0 };
let wssConfig = {};

function setupWSS(wss, appConfig) {
    wssConfig = appConfig || {};

    // See socketio-handlers.js's identical note. One stateless limiter
    // factory shared across all connections; each connection gets its own
    // state object (ws._rateLimitState below), so connections never share
    // or contend over a counter.
    const checkMessageRate = wssConfig.wsMessageRateMax > 0
        ? createConnectionMessageLimiter({ windowMs: wssConfig.wsMessageRateWindowMs, max: wssConfig.wsMessageRateMax })
        : null;

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

        // NEW: per-room client cap (MAX_CLIENTS_PER_ROOM, 0/unset =
        // unlimited, unchanged default behavior) -- see config.js and
        // socketio-handlers.js's identical check on the Socket.IO side.
        // This transport joins the room at connection time (no separate
        // join-room message), so this is the only place to check it.
        if (wssConfig.maxClientsPerRoom > 0 && currentRoom.clients.size >= wssConfig.maxClientsPerRoom) {
            logger.warn('🚫 Rejected connection: room full', { room: roomKey, cap: wssConfig.maxClientsPerRoom });
            ws.send(JSON.stringify({ type: 'error', message: 'This room is full.', code: 'ROOM_FULL' }));
            ws.close(4003, 'Room full');
            return;
        }

        ws.clientId = clientId;
        ws.room = roomKey;
        ws.clientData = {
            id: clientId,
            name: 'Player',
            role: 'player',
            email: '',
            selectedCharacter: '',  // 👈 NEW
            type: 'ws',
            ws
        };
        currentRoom.clients.set(clientId, ws.clientData);
        socketStats.wsConnections++;
        socketStats.totalConnections++;

        // Per-connection message-rate state (see checkMessageRate above) --
        // hung directly off this connection's ws object so it's garbage-
        // collected with it, same lifetime as ws.clientData.
        const rateLimitState = {};

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
        }, 30000);

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
            // Rolling chat window -- see room.js's recordChatMessage() and
            // the matching field on socketio-handlers.js's 'room-joined'.
            chatHistory: currentRoom.chatHistory || [],
            timestamp: Date.now()
        };
        if (currentRoom.data?.region) {
            roomStatePayload.region = currentRoom.data.region;
        }
        ws.send(JSON.stringify(roomStatePayload));

        // ─── Message handler ──────────────────────────────────────────
        ws.on('message', (message) => {
            try {
                // NEW: rate-limit gate, checked before dispatching to any
                // case below -- covers all ~50 message types through this
                // one switch statement. Matches socketio-handlers.js's
                // socket.use() gate in spirit (drop the message, don't
                // disconnect the client) but implemented inline here since
                // this transport has no equivalent inbound-middleware hook.
                if (checkMessageRate && !checkMessageRate(rateLimitState)) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'You are sending messages too quickly. Please slow down.',
                        code: 'RATE_LIMITED'
                    }));
                    return;
                }

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

                    // ─── v4.8: Role management (Co-GM / Player / Spectator) ─
                    case 'role_change_request': {
                        const respond = (payload) => ws.send(JSON.stringify({ type: 'role_change_response', requestId: data.requestId, ...payload }));
                        const { targetId, role, persist } = data || {};
                        if (!targetId || !role) { respond({ ok: false, error: 'Missing targetId or role' }); break; }
                        if (!auth.isValidRole(role) || role === 'gm') { respond({ ok: false, error: 'Invalid role' }); break; }
                        respond(room.handleRoleChangeRequest(currentRoom, clientId, targetId, role, !!persist));
                        break;
                    }

                    // ─── v4.8: Character registration (claim/release) ───────
                    case 'claim-character': {
                        const respond = (payload) => ws.send(JSON.stringify({ type: 'claim-character-response', requestId: data.requestId, ...payload }));
                        const clientEntry = currentRoom.clients.get(clientId);
                        if (!clientEntry) { respond({ ok: false, error: 'Client not found' }); break; }
                        const { characterId, character } = data || {};
                        if (!characterId || !character) { respond({ ok: false, error: 'Missing characterId or character' }); break; }
                        respond(room.claimCharacter(currentRoom, clientEntry, characterId, character));
                        break;
                    }

                    case 'release-character': {
                        const respond = (payload) => ws.send(JSON.stringify({ type: 'release-character-response', requestId: data.requestId, ...payload }));
                        const clientEntry = currentRoom.clients.get(clientId);
                        if (!clientEntry) { respond({ ok: false, error: 'Client not found' }); break; }
                        respond(room.releaseCharacter(currentRoom, clientEntry));
                        break;
                    }

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
                        if (isGmLike(ws.clientData.role)) {
                            room.kickClient(currentRoom, data.targetId, data.reason || 'Kicked');
                            room.broadcastToRoom(roomKey, 'presence', { clients: room.getClientsList(currentRoom) }, ws.clientId);
                        }
                        break;

                    case 'ban_client':
                        if (isGmLike(ws.clientData.role)) {
                            room.banClient(currentRoom, data.targetId, data.reason || 'Banned');
                            room.broadcastToRoom(roomKey, 'presence', { clients: room.getClientsList(currentRoom) }, ws.clientId);
                        }
                        break;

                    case 'unban_client':
                        if (isGmLike(ws.clientData.role)) {
                            room.unbanClient(currentRoom, data.targetId);
                            ws.send(JSON.stringify({ type: 'unban_client_ack', targetId: data.targetId }));
                        }
                        break;

                    case 'set_room_password':
                        if (isGmLike(ws.clientData.role)) {
                            handleSetRoomPassword(ws, currentRoom, data);
                        }
                        break;

                    // ─── Chat messages (recorded into the room's rolling ──
                    // history) -- pulled out of the direct-broadcast group
                    // below because this one needs a side effect
                    // (room.recordChatMessage) before the broadcast. See
                    // that function's doc comment in room.js and the
                    // matching 'chatHistory' field added to 'room-state'
                    // above (sent right after connect).
                    case 'chat-message': {
                        const chatMsg = (data && data.message) || data;
                        room.recordChatMessage(currentRoom, chatMsg, wssConfig.maxChatHistory);
                        // SECURITY FIX: see the matching comment in
                        // socketio-handlers.js's 'chat-message' handler --
                        // stamp the server's own authoritative role for this
                        // connection so the client can verify a 'GM' sender
                        // claim instead of trusting the message's own
                        // (client-supplied) sender/role fields.
                        if (chatMsg && typeof chatMsg === 'object') {
                            chatMsg.verifiedGM = isGmLike(ws.clientData?.role);
                        }
                        // Whisper with a resolvable live recipient (e.g. the AI GM
                        // bot's join greeting) -- deliver privately instead of to
                        // the whole room. See room.js's deliverWhisper() for what
                        // "resolvable" means and why this doesn't (yet) cover the
                        // human-typed whisper feature's character-id/'gm' recipients.
                        const whisperedPrivately = chatMsg && chatMsg.whisper && chatMsg.recipient
                            ? room.deliverWhisper(roomKey, messageType, data, ws.clientId, chatMsg.recipient)
                            : false;
                        if (!whisperedPrivately) {
                            room.broadcastToRoom(roomKey, messageType, data, ws.clientId);
                        }
                        break;
                    }

                    // ─── Direct broadcast events ──────────────────────────
                    case 'media_recording':
                    case 'voice-offer':
                    case 'voice-answer':
                    case 'voice-ice-candidate':
                    case 'voice-status':
                    case 'roll-dice':
                    case 'roll-result':
                    case 'operation':
                    case 'operation_ack':
                    case 'module-push':
                    case 'module-cleanup':
                    case 'sync-state':
                    case 'combat-status-update':
                    case 'scene-status-update':
                    // NEW: AI GM Bot voice narration (optional) -- see the
                    // matching note in socketio-handlers.js's relayEvents.
                    case 'tts-audio':
                    // NEW: Reactive Soundscape (optional) -- see the
                    // matching note in socketio-handlers.js's relayEvents
                    // for the full payload shape (trackId for a GM-curated
                    // profile entry, or url/name/attribution when the
                    // AI GM Bot's SOUNDSCAPE_AUTO_SEARCH picked a Freesound
                    // result instead). Same plain pass-through relay here
                    // either way -- this transport never inspects the
                    // payload, just rebroadcasts it.
                    case 'soundboard-ambience':
                    // NEW: Assistant GM suggestion queue (optional -- see
                    // fates-edge-ai-gm-bot's modules/assistant-suggestions.js
                    // and ROADMAP.md item 2). Fired by the bot whenever it
                    // enqueues/approves/rejects a pending suggestion (SB
                    // spend + Crown Spread LLM synthesis, plus every
                    // pre-existing suggestion kind -- fact/npc-create/
                    // scene-complete/knowledge-reveal/-hide, all
                    // backfilled with the same event shape). Plain
                    // pass-through relay exactly like tts-audio/
                    // soundboard-ambience above -- the bot is the only
                    // thing that ever sends these, clients only render
                    // them; approving/rejecting still goes back over chat
                    // as `!gm approve <id>` / `!gm reject <id>`, no new
                    // client->server request type needed.
                    case 'assistant-suggestion-created':
                    case 'assistant-suggestion-resolved':
                        room.broadcastToRoom(roomKey, messageType, data, ws.clientId);
                        break;

                    // ─── Adventure Engine ──────────────────────────────────
                    // See server/adventure.js. Each of these recomputes
                    // authoritatively on the server (rather than just
                    // relaying whatever a client/AI computed locally, which
                    // is what 'adventure-timer'/'adventure-log' used to do
                    // as bare passthrough cases above) and broadcasts the
                    // canonical resulting state, so every connected
                    // client/AI agent stays in sync regardless of who
                    // drove the change.
                    case 'adventure-load': {
                        try {
                            const state = adventure.loadAdventureModule(currentRoom, data.moduleId);
                            room.broadcastToRoom(roomKey, 'adventure-loaded', state);
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    case 'adventure-reset': {
                        try {
                            const state = adventure.resetAdventure(currentRoom);
                            room.broadcastToRoom(roomKey, 'adventure-reset', state);
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    case 'adventure-scene': {
                        try {
                            const target = {};
                            if (typeof data.actIndex === 'number') target.actIndex = data.actIndex;
                            if (typeof data.sceneIndex === 'number') target.sceneIndex = data.sceneIndex;
                            const state = adventure.advanceScene(currentRoom, target);
                            room.broadcastToRoom(roomKey, 'scene-changed', state);
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    case 'adventure-encounter-start': {
                        try {
                            const state = adventure.startEncounter(currentRoom, data.ref, data.encounter || null);
                            room.broadcastToRoom(roomKey, 'encounter-started', state);
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    case 'adventure-encounter-resolve': {
                        try {
                            const state = adventure.resolveEncounter(currentRoom, { outcome: data.outcome, notes: data.notes });
                            room.broadcastToRoom(roomKey, 'encounter-resolved', state);
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    case 'adventure-timer': {
                        try {
                            const state = adventure.tickTimer(currentRoom, { scope: data.scope, ref: data.ref, name: data.name, amount: data.amount });
                            room.broadcastToRoom(roomKey, 'timer-ticked', state);
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    // NEW: ad-hoc timers (server/timers.js) -- GM/AI-
                    // improvised timers independent of any loaded
                    // adventure, deliberately kept separate from the
                    // 'adventure-timer' case above (see server/timers.js's
                    // header doc). Event names are prefixed 'adhoc-timer-'
                    // so they can't collide with 'timer-ticked' above.
                    case 'adhoc-timer-create': {
                        try {
                            const state = timers.createTimer(currentRoom, { name: data.name, segments: data.segments, description: data.description });
                            room.broadcastToRoom(roomKey, 'adhoc-timer-created', state);
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    case 'adhoc-timer-tick': {
                        try {
                            const state = timers.tickTimer(currentRoom, { ref: data.ref, name: data.name, amount: data.amount });
                            room.broadcastToRoom(roomKey, 'adhoc-timer-ticked', state);
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    case 'adhoc-timer-remove': {
                        try {
                            const state = timers.removeTimer(currentRoom, data.ref !== undefined ? data.ref : data.name);
                            room.broadcastToRoom(roomKey, 'adhoc-timer-removed', state);
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    case 'adventure-log': {
                        try {
                            const state = adventure.logBeat(currentRoom, { text: data.text, author: data.author });
                            room.broadcastToRoom(roomKey, 'adventure-log', state);
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    // NEW: knowledge state (module.knowledge[] entries) --
                    // see server/adventure.js's KNOWLEDGE STATE doc comment
                    // and the REST equivalents (POST .../adventure/knowledge/
                    // reveal|hide) in api.js. Same shape as every other
                    // Adventure Engine case here: recompute authoritatively,
                    // broadcast the canonical result.
                    case 'adventure-knowledge-reveal': {
                        try {
                            const state = adventure.revealKnowledge(currentRoom, data.id, { by: data.by });
                            room.broadcastToRoom(roomKey, 'adventure-knowledge-revealed', { id: data.id, ...state });
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    case 'adventure-knowledge-hide': {
                        try {
                            const state = adventure.hideKnowledge(currentRoom, data.id, { by: data.by });
                            room.broadcastToRoom(roomKey, 'adventure-knowledge-hidden', { id: data.id, ...state });
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    case 'adventure-state-request': {
                        ws.send(JSON.stringify({ type: 'adventure-state', ...adventure.getPublicState(currentRoom) }));
                        break;
                    }

                    // NEW: ad-hoc timers (server/timers.js) -- request/
                    // response, mirroring 'adventure-state-request' above
                    // exactly, so a client can seed its local timer list
                    // on join/mount without needing the REST routes.
                    case 'adhoc-timer-request': {
                        ws.send(JSON.stringify({ type: 'adhoc-timer-state', ...timers.getPublicState(currentRoom) }));
                        break;
                    }

                    // ─── Client list ────────────────────────────────────────
                    // The Socket.io transport has always answered this via a
                    // callback (see socketio-handlers.js's `get-clients`), but
                    // this transport never handled it at all -- websocket.js's
                    // getConnectedClients() would silently time out after 2s
                    // and resolve to [] on every call over plain WebSocket
                    // (the default transport). Echoes `requestId` so the
                    // client's generic pendingCallbacks correlation picks it
                    // up (see sendWSMessage()/handleWebSocketMessage() client-side).
                    case 'get-clients':
                        ws.send(JSON.stringify({ type: 'clients', clients: room.getClientsList(currentRoom), requestId: data.requestId }));
                        break;

                    // ─── TURN credentials ──────────────────────────────────
                    // See server/turn.js. Not gated behind anything beyond
                    // "you're connected" -- same trust boundary as any
                    // other in-room WS message.
                    case 'turn-credentials-request': {
                        const result = turn.mintCredentials(wssConfig, clientId);
                        ws.send(JSON.stringify({ type: 'turn-credentials', ...(result || { iceServers: [] }) }));
                        break;
                    }

                    // ─── Module management ──────────────────────────────────
                    // FIX: this transport had NO handling at all for any of
                    // these three message types -- only socketio-handlers.js
                    // did. Since plain WebSocket is the client's default
                    // transport (see websocket.js CONFIG.mode), every
                    // module push/cleanup/list request from the web client
                    // silently timed out (10s/5s) and resolved to an error,
                    // regardless of whether the module itself was ever
                    // reachable. Mirrors socketio-handlers.js's equivalent
                    // handlers (including the MODULES_DIR path fix -- see
                    // this file's top-of-file comment).
                    case 'module-push-request': {
                        const respond = (payload) => ws.send(JSON.stringify({ type: 'module-push-response', requestId: data.requestId, ...payload }));
                        const moduleId = data.moduleId;
                        if (!moduleId) { respond({ error: 'Module ID required' }); break; }
                        if (!isSafeModuleId(moduleId)) { respond({ error: 'Invalid module id' }); break; }
                        const modulesPath = path.join(MODULES_DIR, moduleId);
                        if (!fs.existsSync(modulesPath)) { respond({ error: 'Module not found' }); break; }
                        const manifestPath = path.join(modulesPath, 'manifest.json');
                        if (!fs.existsSync(manifestPath)) { respond({ error: 'Module manifest not found' }); break; }
                        try {
                            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                            const moduleData = { id: moduleId, manifest, files: {} };
                            for (const file of fs.readdirSync(modulesPath)) {
                                if (file === 'manifest.json') continue;
                                const filePath = path.join(modulesPath, file);
                                if (fs.statSync(filePath).isFile()) {
                                    moduleData.files[file] = fs.readFileSync(filePath, 'utf-8');
                                }
                            }
                            room.broadcastToRoom(roomKey, 'module-push', {
                                source: clientId,
                                clientName: ws.clientData?.name || 'Player',
                                module: moduleData,
                                timestamp: Date.now()
                            }, ws.clientId);
                            respond({ success: true, module: moduleData });
                        } catch (error) {
                            respond({ error: error.message });
                        }
                        break;
                    }

                    case 'module-cleanup-request': {
                        const moduleId = data.moduleId;
                        if (!moduleId) {
                            ws.send(JSON.stringify({ type: 'module-cleanup-response', requestId: data.requestId, error: 'Module ID required' }));
                            break;
                        }
                        room.broadcastToRoom(roomKey, 'module-cleanup', {
                            moduleId,
                            source: clientId,
                            clientName: ws.clientData?.name || 'Player',
                            timestamp: Date.now()
                        }, ws.clientId);
                        ws.send(JSON.stringify({ type: 'module-cleanup-response', requestId: data.requestId, success: true, moduleId }));
                        break;
                    }

                    case 'module-list': {
                        const modules = [];
                        if (fs.existsSync(MODULES_DIR)) {
                            for (const item of fs.readdirSync(MODULES_DIR)) {
                                const itemPath = path.join(MODULES_DIR, item);
                                if (!fs.statSync(itemPath).isDirectory()) continue;
                                const manifestPath = path.join(itemPath, 'manifest.json');
                                if (!fs.existsSync(manifestPath)) continue;
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
                                        route: manifest.route || null,
                                        tier: manifest.tier || manifest.tierRange || '?'
                                    });
                                } catch (e) { /* skip invalid manifest */ }
                            }
                        }
                        ws.send(JSON.stringify({ type: 'module-list-response', requestId: data.requestId, modules, count: modules.length }));
                        break;
                    }

                    case 'adventure-reference-request': {
                        try {
                            ws.send(JSON.stringify({ type: 'adventure-reference', ...adventure.getReferenceData(currentRoom) }));
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'error', message: err.message }));
                        }
                        break;
                    }

                    // ─── Presence update ───────────────────────────────────
                    case 'presence':
                        if (data.name) {
                            ws.clientData.name = clampString(data.name, MAX_NAME_LENGTH) || ws.clientData.name;
                        }
                        // SECURITY FIX: `data.role` here used to be trusted
                        // verbatim, letting any connected client grant itself
                        // 'gm' (or any other role) by sending a presence
                        // update with `role: 'gm'` -- completely bypassing
                        // the guarded request_gm/approve_gm/role_change_request
                        // flow above (which checks who's allowed to promote
                        // whom, and that only one client holds the GM seat).
                        // Role is server-authoritative and changes only
                        // through that flow; presence updates must not be
                        // able to touch it.
                        if (data.activeView) {
                            ws.clientData.activeView = data.activeView;
                        }
                        // Preserve selectedCharacter
                        const r = room.rooms.get(roomKey);
                        if (r) {
                            const clientEntry = r.clients.get(clientId);
                            if (clientEntry) {
                                clientEntry.name = ws.clientData.name;
                                clientEntry.role = ws.clientData.role;
                                if (data.activeView) clientEntry.activeView = data.activeView;
                                // selectedCharacter stays as is
                                r.clients.set(clientId, clientEntry);
                            }
                            room.broadcastToRoom(roomKey, 'presence', { clients: room.getClientsList(r) }, ws.clientId);
                        } else {
                            room.broadcastToRoom(roomKey, 'presence', data, ws.clientId);
                        }
                        break;

                    // ─── Character selection ──────────────────────────────
                    // NEW: accepts either the legacy single `character` string
                    // or a `characters` array ("Remote enabled" -- one client
                    // driving more than one PC/NPC at once). Either way, the
                    // result is normalized and capped at
                    // MAX_CONTROLLED_CHARACTERS (6) by sanitizeCharacterSelection()
                    // -- a client can't claim an unbounded slice of the room's
                    // roster. `selectedCharacter` is kept in sync as the first
                    // selected name for older clients that only read that field.
                    case 'character-select':
                        if (data.clientId) {
                            const r = room.rooms.get(roomKey);
                            if (r) {
                                const clientEntry = r.clients.get(data.clientId);
                                if (clientEntry) {
                                    const selected = sanitizeCharacterSelection(data.characters !== undefined ? data.characters : data.character);
                                    clientEntry.selectedCharacters = selected;
                                    clientEntry.selectedCharacter = selected[0] || '';
                                    r.clients.set(data.clientId, clientEntry);
                                    room.broadcastToRoom(roomKey, 'presence', { clients: room.getClientsList(r) }, ws.clientId);
                                }
                            }
                        }
                        // Also broadcast the raw event for any other listeners
                        room.broadcastToRoom(roomKey, 'character-select', data, ws.clientId);
                        break;

                    // ─── Generic event with nested type ───────────────────
                    case 'event':
                        // SECURITY FIX: `data.socketId` up to this point is
                        // whatever the SENDING client put in its own message
                        // body (js/core/websocket.js's sendEvent() sets it
                        // from the client's own getSocketId(), but nothing
                        // stops a modified/malicious client from emitting a
                        // raw WS frame with any socketId string it wants).
                        // Every feature built on this generic relay (Kon'reh's
                        // challenge/move protocol, Toll & Veil's host/guest
                        // protocol) trusts data.socketId as "who actually sent
                        // this" for turn-order and seat-ownership checks, so
                        // an unstamped passthrough let any client impersonate
                        // any other connected player. Overwrite it with the
                        // connection's own server-assigned clientId — the one
                        // piece of identity a client cannot fake — before
                        // this ever reaches another client.
                        data.socketId = ws.clientId;
                        // Check for presence update (sent via sendEvent)
                        if (data && data.type === 'presence') {
                            if (data.name) {
                                ws.clientData.name = data.name;
                            }
                            // SECURITY FIX: see the matching comment on the
                            // 'presence' case above -- role must never be
                            // settable from a client-supplied presence
                            // payload, only through the guarded GM/role
                            // request flow.
                            if (data.activeView) {
                                ws.clientData.activeView = data.activeView;
                            }
                            const r2 = room.rooms.get(roomKey);
                            if (r2) {
                                const clientEntry2 = r2.clients.get(clientId);
                                if (clientEntry2) {
                                    clientEntry2.name = ws.clientData.name;
                                    clientEntry2.role = ws.clientData.role;
                                    if (data.activeView) clientEntry2.activeView = data.activeView;
                                    r2.clients.set(clientId, clientEntry2);
                                }
                                room.broadcastToRoom(roomKey, 'presence', { clients: room.getClientsList(r2) }, ws.clientId);
                            } else {
                                room.broadcastToRoom(roomKey, 'event', data, ws.clientId);
                            }
                            break;
                        }
                        // Check for character selection (sent via sendEvent)
                        if (data && data.type === 'character-select') {
                            if (data.clientId) {
                                const r2 = room.rooms.get(roomKey);
                                if (r2) {
                                    const clientEntry2 = r2.clients.get(data.clientId);
                                    if (clientEntry2) {
                                        const selected2 = sanitizeCharacterSelection(data.characters !== undefined ? data.characters : data.character);
                                        clientEntry2.selectedCharacters = selected2;
                                        clientEntry2.selectedCharacter = selected2[0] || '';
                                        r2.clients.set(data.clientId, clientEntry2);
                                        room.broadcastToRoom(roomKey, 'presence', { clients: room.getClientsList(r2) }, ws.clientId);
                                    }
                                }
                            }
                            room.broadcastToRoom(roomKey, 'character-select', data, ws.clientId);
                            break;
                        }
                        // Otherwise, broadcast generic event
                        room.broadcastToRoom(roomKey, 'event', data, ws.clientId);
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

// NEW: async -- see socketio-handlers.js's join-room comment for the full
// rationale. `data.authToken` is optional; everything here degrades to
// exactly the previous anonymous behavior when it's absent or invalid.
async function handleHandshake(ws, roomState, data) {
    const authUser = auth.verifyTokenOptional(data.authToken);

    // See socketio-handlers.js's identical comment: rooms get GC'd when
    // empty and recreated fresh (password: null) on the next connection,
    // so a persisted password needs to be rehydrated here before it's
    // checked below, or it would silently stop being enforced between
    // any two connections to an otherwise-empty room.
    if (!roomState.password && hasAccountSupport()) {
        try {
            const persistedHash = await storage.getRoomPasswordHash(roomState.code);
            if (persistedHash) roomState.password = persistedHash;
        } catch (e) {
            logger.warn('Failed to hydrate persisted room password', { error: e.message });
        }
    }

    // Persistent ban check (by account -- survives reconnects/new
    // ephemeral clientIds, unlike the connection-time Set-based check).
    let membership = null;
    if (authUser && hasAccountSupport()) {
        try {
            if (await storage.isMemberBanned(roomState.code, authUser.userId)) {
                ws.send(JSON.stringify({ type: 'error', message: 'You are banned from this room.' }));
                ws.close(4002, 'Banned');
                return;
            }
            membership = await storage.getMembership(roomState.code, authUser.userId);
        } catch (e) {
            logger.warn('Account membership lookup failed', { error: e.message });
        }
    }

    // Password check -- known members skip it (see socketio-handlers.js).
    if (roomState.password && !membership) {
        const ok = await auth.verifyPassword(data.password, roomState.password);
        if (!ok) {
            ws.send(JSON.stringify({ type: 'error', message: 'Incorrect room password.' }));
            ws.close(4003, 'Incorrect password');
            return;
        }
    }

    // v4.8 (extended v4.12 for assistant-gm): same role-validation rules as
    // socketio-handlers.js's join-room -- self-declared 'co-gm' or
    // 'assistant-gm' is never trusted unless it's already saved on this
    // account's membership row (a grant made via room.handleRoleChangeRequest
    // with persist:true).
    const PROMOTED_ONLY_ROLES = new Set(['co-gm', 'assistant-gm']);
    let assignedRole = auth.isValidRole(data.role) ? data.role : 'player';
    if (PROMOTED_ONLY_ROLES.has(assignedRole) && membership?.role !== assignedRole) {
        assignedRole = 'player';
    }
    if (assignedRole !== 'gm' && PROMOTED_ONLY_ROLES.has(membership?.role)) {
        assignedRole = membership.role;
    }
    const existingGm = room.getExistingGm(roomState);
    if (assignedRole === 'gm' && existingGm) {
        assignedRole = 'player';
        ws.send(JSON.stringify({ type: 'error', message: 'A GM is already hosting this room. You have joined as a Player.', code: 'GM_CONFLICT' }));
    }
    // NEW: clamp -- see the matching comment in socketio-handlers.js's
    // join-room handler for why this was previously unbounded.
    ws.clientData.name = clampString(data.clientName, MAX_NAME_LENGTH) || (authUser ? authUser.username : 'Player');
    ws.clientData.role = assignedRole;
    ws.clientData.email = data.clientEmail || '';
    ws.clientData.userId = authUser ? authUser.userId : null;
    // selectedCharacter remains empty initially
    roomState.clients.set(ws.clientId, ws.clientData);

    if (authUser && hasAccountSupport()) {
        storage.upsertMembership(roomState.code, authUser.userId, {}).catch(e =>
            logger.warn('Failed to upsert room membership', { error: e.message })
        );
    }

    // v4.8: re-resolve a previously-claimed character on rejoin -- see
    // socketio-handlers.js's join-room handler for the same logic.
    if (authUser && hasAccountSupport() && typeof storage.getCharacterClaim === 'function') {
        try {
            const claim = await storage.getCharacterClaim(roomState.code, authUser.userId);
            if (claim) {
                if (!roomState.characterClaims) roomState.characterClaims = Object.create(null);
                const existingChar = Object.values(roomState.characters || {}).find(c => c.ownerId === authUser.userId);
                if (existingChar) {
                    roomState.characterClaims[authUser.userId] = room.normalizeCharKey(existingChar.name);
                    ws.clientData.selectedCharacter = existingChar.name;
                    ws.clientData.selectedCharacters = [existingChar.name];
                }
            }
        } catch (e) {
            logger.warn('Failed to resolve character claim on join', { error: e.message });
        }
    }

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

// NEW: live GM-driven room password set/change/clear over plain WS,
// mirroring socketio-handlers.js's 'set_room_password' event and the
// REST admin route POST /api/rooms/:code/password.
async function handleSetRoomPassword(ws, roomState, data) {
    const password = data && data.password;
    const hash = password ? await auth.hashPassword(String(password)) : null;
    room.setRoomPassword(roomState, hash);
    if (hasAccountSupport()) {
        storage.setRoomPasswordHash(roomState.code, hash).catch(e =>
            logger.warn('Failed to persist room password', { error: e.message })
        );
    }
    ws.send(JSON.stringify({ type: 'set_room_password_ack', success: true, passwordSet: !!hash }));
}

// ─── CHARACTER SYNC: store full characters ──────────────────────────
function handleStateUpdated(ws, roomState, data) {
    if (data.state && data.state.characters && Array.isArray(data.state.characters)) {
        roomState.characters = buildSafeDict(data.state.characters, c => c && c.name);
    } else if (data.characters && Array.isArray(data.characters)) {
        roomState.characters = buildSafeDict(data.characters, c => c && c.name);
    } else if (data.updates && typeof data.updates === 'object') {
        if (!roomState.characters) roomState.characters = {};
        for (const [name, charData] of Object.entries(data.updates)) {
            roomState.characters[name] = { 
                ...roomState.characters[name], 
                ...charData,
                playerName: charData.playerName || roomState.characters[name]?.playerName || null
            };
        }
    }

    roomState.lastActivity = Date.now();
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

// ─── WHITEBOARD ────────────────────────────────────────────────

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

// ─── SYNC REQUEST ──────────────────────────────────

function handleSyncRequest(ws, roomState) {
    ws.send(JSON.stringify({
        type: 'sync-state',
        state: roomState.whiteboard || {},
        timestamp: Date.now()
    }));
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
