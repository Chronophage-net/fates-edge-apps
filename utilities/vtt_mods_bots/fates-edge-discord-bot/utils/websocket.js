/**
 * WebSocket Client for Fate's Edge VTT Server
 * v3 – Full compatibility with plain WebSocket handshake,
 * GM election, Ban/Kick, and all new events.
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const logger = require('./logger');

class VTTClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.ws = null;
        this.connected = false;
        this.clientId = null;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.heartbeatInterval = null;
        this.roomCode = config.roomCode;
        this.pendingMessages = [];

        // GM state
        this.clients = new Map();
        this.gmId = null;
        this.pendingRequests = [];
        this.myRole = 'player';

        // Deck, modules, region, etc.
        this.deck = { cards: [], history: [] };
        this.modules = [];
        this.defaultRegion = 'Acasia';
        this.whiteboard = {};
        this.characters = {};
        this.gridCombat = {};
    }

    // ─── Connection ──────────────────────────────────────────────

    connect(roomCode = this.roomCode) {
        if (this.connected) {
            logger.warn('Already connected to VTT server');
            return;
        }

        if (roomCode) {
            this.roomCode = roomCode;
        }

        if (!this.roomCode) {
            logger.error('❌ No room code provided');
            this.emit('error', new Error('Room code required'));
            return;
        }

        logger.info(`🔌 Connecting to VTT server: ${this.config.serverUrl}`);
        logger.info(`🏠 Room: ${this.roomCode}`);

        try {
            const wsUrl = `${this.config.serverUrl}?room=${encodeURIComponent(this.roomCode)}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => this._onOpen());
            this.ws.on('message', (data) => this._onMessage(data));
            this.ws.on('error', (error) => this._onError(error));
            this.ws.on('close', (code, reason) => this._onClose(code, reason));

        } catch (err) {
            logger.error(`❌ Connection error: ${err.message}`);
            this.emit('error', err);
            this._scheduleReconnect();
        }
    }

    disconnect() {
        logger.info('🔌 Disconnecting from VTT server');
        this._cleanup();
        if (this.ws) {
            try {
                this.ws.close(1000, 'Disconnected by user');
            } catch (err) { /* ignore */ }
            this.ws = null;
        }
        this.connected = false;
        this.clientId = null;
        this.emit('disconnected');
        this.clients.clear();
        this.gmId = null;
        this.pendingRequests = [];
        this.myRole = 'player';
    }

    // ─── Send messages ────────────────────────────────────────────

    send(type, data = {}) {
        const message = { type, ...data };
        this._sendMessage(message);
    }

    _sendMessage(message) {
        if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                const json = JSON.stringify(message);
                this.ws.send(json);
                this.emit('sent', message);
                return true;
            } catch (err) {
                logger.error(`❌ Failed to send message: ${err.message}`);
                this.pendingMessages.push(message);
                return false;
            }
        } else {
            this.pendingMessages.push(message);
            return false;
        }
    }

    // ─── WebSocket event handlers ──────────────────────────────

    _onOpen() {
        logger.info('✅ WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');

        // Send handshake (plain WebSocket protocol)
        const playerName = this.config.botName || 'Discord Bot';
        this._sendMessage({
            type: 'handshake',
            clientName: playerName,
            role: 'player',
            password: this.config.password || ''
        });

        // Send any pending messages
        while (this.pendingMessages.length > 0) {
            const msg = this.pendingMessages.shift();
            this._sendMessage(msg);
        }

        // Start heartbeat
        this.heartbeatInterval = setInterval(() => {
            if (this.connected) {
                this._sendMessage({ type: 'ping' });
            }
        }, 30000);
    }

    _onMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            this.emit('message', message);
            this._handleMessage(message);
        } catch (err) {
            logger.error(`❌ Failed to parse message: ${err.message}`);
        }
    }

    _onError(error) {
        logger.error(`❌ WebSocket error: ${error.message}`);
        this.emit('error', error);
    }

    _onClose(code, reason) {
        logger.info(`🔌 WebSocket closed (${code} - ${reason || 'No reason'})`);
        this._cleanup();
        this.connected = false;
        this.clientId = null;
        this.emit('disconnected');

        if (code !== 1000) {
            this._scheduleReconnect();
        }
    }

    // ─── Message dispatcher ──────────────────────────────────────

    _handleMessage(message) {
        switch (message.type) {
            case 'connected':
                // Server sends connected message with clientId? Actually it sends separate.
                // We'll capture clientId from handshake_ack.
                break;

            case 'handshake_ack':
                this.clientId = message.clientId;
                this.myRole = message.clientRole || 'player';
                logger.info(`✅ Handshake successful. Client ID: ${this.clientId}, Role: ${this.myRole}`);
                this.emit('handshake_ack', message);
                if (message.activeClients) {
                    this._updateClients(message.activeClients);
                }
                break;

            case 'room-state':
                this.emit('room-state', message);
                if (message.clients) this._updateClients(message.clients);
                if (message.characters) {
                    this.characters = {};
                    message.characters.forEach(c => { if (c.name) this.characters[c.name] = c; });
                }
                if (message.deckRemaining !== undefined) {
                    this.deck.cards = Array(message.deckRemaining).fill(null); // placeholder
                }
                if (message.whiteboard) {
                    this.whiteboard = message.whiteboard;
                    if (this.whiteboard.gridCombat) {
                        this.gridCombat = this.whiteboard.gridCombat;
                    }
                }
                if (message.region) this.defaultRegion = message.region;
                this.emit('roomState', message);
                break;

            case 'presence':
                if (message.clients) this._updateClients(message.clients);
                this.emit('presence', message);
                break;

            case 'gm_vote_request':
                if (!this.pendingRequests.find(r => r.requesterId === message.requesterId)) {
                    this.pendingRequests.push({
                        requesterId: message.requesterId,
                        requesterName: message.requesterName
                    });
                }
                this.emit('gmVoteRequest', message);
                break;

            case 'gm_role_update':
                if (message.clientId === this.clientId) {
                    this.myRole = message.role;
                }
                const client = this.clients.get(message.clientId);
                if (client) client.role = message.role;
                if (message.role === 'gm') this.gmId = message.clientId;
                else if (this.gmId === message.clientId) this._updateGmFromClients();
                this.emit('gmRoleUpdate', message);
                break;

            // v4.8: Co-GM / Player / Spectator changes. Distinct from
            // 'gm_role_update' above, which is only ever fired for the
            // single GM seat itself (see server/room.js's
            // handleGmRequest/handleGmApproval vs. the newer
            // handleRoleChangeRequest). `message.targetId` here (not
            // `clientId`) is who the role change applies to.
            case 'role_update': {
                if (message.targetId === this.clientId) {
                    this.myRole = message.role;
                }
                const target = this.clients.get(message.targetId);
                if (target) target.role = message.role;
                this.emit('roleUpdate', message);
                break;
            }

            case 'character_claimed':
                this.emit('characterClaimed', message);
                break;

            case 'character_released':
                this.emit('characterReleased', message);
                break;

            case 'server_announcement':
                this.emit('serverAnnouncement', message);
                break;

            case 'kicked':
                logger.warn(`🚫 Bot was kicked: ${message.reason || 'No reason'}`);
                this.emit('kicked', message);
                break;

            // ─── Chat & Rolls ──────────────────────────────────────
            case 'chat-message':
                this.emit('chat-message', message);
                break;

            // NEW: optional AI GM voice narration -- see
            // utils/tts-voice.js and events/ready.js's 'tts-audio'
            // listener.
            case 'tts-audio':
                this.emit('tts-audio', message);
                break;

            // NEW: optional Reactive Soundscape -- see events/ready.js's
            // 'soundboard-ambience' listener, which posts a "now playing"
            // embed. No voice/audio playback here (unlike tts-audio) --
            // ambience audio plays in players' own web clients, this is
            // just a text notification for the Discord channel.
            case 'soundboard-ambience':
                this.emit('soundboard-ambience', message);
                break;

            case 'roll-result':
                this.emit('roll-result', message);
                break;

            // ─── Deck ──────────────────────────────────────────────
            case 'deck-drawn':
                this.deck.cards = message.cards || [];
                this.deck.remaining = message.remaining || 0;
                this.emit('deckDrawn', message);
                break;

            case 'deck-shuffled':
                this.deck.remaining = message.remaining || 54;
                this.emit('deckShuffled', message);
                break;

            case 'deck-history':
                this.deck.history = message.history || [];
                this.emit('deckHistory', message);
                break;

            case 'deck-history-cleared':
                this.deck.history = [];
                this.emit('deckHistoryCleared', message);
                break;

            case 'crown-spread':
                this.emit('crownSpread', message);
                break;

            // NEW: Assistant GM suggestion queue (optional -- see the AI
            // GM Bot's modules/assistant-suggestions.js and ROADMAP.md
            // item 2 in that repo). Fired whenever the bot, in Assistant
            // GM mode, proposes something needing human approval -- a new
            // fact/NPC/scene advance/knowledge change, or (new) an
            // LLM-synthesized SB spend complication / Crown Spread
            // interpretation. See events/ready.js's listeners for the
            // embed-with-buttons rendering and events/interactionCreate.js
            // for the button -> `!gm approve/reject <id>` translation.
            case 'assistant-suggestion-created':
                this.emit('assistantSuggestionCreated', message);
                break;

            case 'assistant-suggestion-resolved':
                this.emit('assistantSuggestionResolved', message);
                break;

            // ─── Modules ────────────────────────────────────────────
            case 'module-list':
                this.modules = message.modules || [];
                this.emit('moduleList', message);
                break;

            case 'module-push':
                this.emit('modulePush', message);
                break;

            case 'module-cleanup':
                this.emit('moduleCleanup', message);
                break;

            // ─── Region ─────────────────────────────────────────────
            case 'region-updated':
                if (message.region) {
                    this.defaultRegion = message.region;
                }
                this.emit('regionUpdated', message);
                break;

            // ─── Whiteboard ─────────────────────────────────────────
            case 'whiteboard-update':
                this.whiteboard = message.whiteboard || {};
                if (this.whiteboard.gridCombat) {
                    this.gridCombat = this.whiteboard.gridCombat;
                }
                this.emit('whiteboardUpdate', message);
                break;

            // ─── Sync ──────────────────────────────────────────────
            case 'sync-state':
                const state = message.state || {};
                if (state.characters) {
                    this.characters = {};
                    state.characters.forEach(c => { if (c.name) this.characters[c.name] = c; });
                }
                if (state.whiteboard) {
                    this.whiteboard = state.whiteboard;
                    if (this.whiteboard.gridCombat) {
                        this.gridCombat = this.whiteboard.gridCombat;
                    }
                }
                this.emit('syncState', message);
                break;

            case 'state-updated':
                if (message.characters) {
                    this.characters = {};
                    message.characters.forEach(c => { if (c.name) this.characters[c.name] = c; });
                }
                this.emit('stateUpdated', message);
                break;

            // ─── Character updates ──────────────────────────────────
            case 'character-update':
                if (message.name && message.field !== undefined) {
                    if (!this.characters[message.name]) this.characters[message.name] = { name: message.name };
                    this.characters[message.name][message.field] = message.value;
                }
                this.emit('characterUpdate', message);
                break;

            case 'character-update-bulk':
                if (message.updates) {
                    Object.entries(message.updates).forEach(([name, data]) => {
                        if (!this.characters[name]) this.characters[name] = { name };
                        Object.assign(this.characters[name], data);
                    });
                }
                this.emit('characterUpdateBulk', message);
                break;

            // ─── Client events ─────────────────────────────────────
            case 'player-joined':
                if (message.clients) this._updateClients(message.clients);
                this.emit('playerJoined', message);
                break;

            case 'player-left':
                if (message.clientId) {
                    this.clients.delete(message.clientId);
                    if (this.gmId === message.clientId) this._updateGmFromClients();
                }
                if (message.clients) this._updateClients(message.clients);
                this.emit('playerLeft', message);
                break;

            case 'room-closed':
                this.emit('roomClosed', message);
                this.disconnect();
                break;

            case 'pong':
                // Heartbeat response
                break;

            // NEW: ad-hoc timers (server/timers.js) -- GM/AI-improvised
            // timers that live server-side, independent of any loaded
            // adventure module. Deliberately a separate event name
            // ('adhocTimerState') from anything adventure-related, and
            // fired for all four server broadcasts (created/ticked/
            // removed/the request/response reply) since they all carry
            // the same { timers, ... } shape -- see commands/timer.js.
            case 'adhoc-timer-created':
            case 'adhoc-timer-ticked':
            case 'adhoc-timer-removed':
            case 'adhoc-timer-state':
                this.emit('adhocTimerState', message);
                break;

            default:
                // Forward unknown events
                this.emit('unknown', message);
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────

    _updateClients(clientsArray) {
        this.clients.clear();
        clientsArray.forEach(c => {
            this.clients.set(c.id, {
                id: c.id,
                name: c.name || c.data?.name || 'Unknown',
                role: c.role || 'player',
                email: c.email || ''
            });
            if (c.role === 'gm') this.gmId = c.id;
        });
        if (!clientsArray.some(c => c.role === 'gm')) this.gmId = null;
        if (this.clientId && this.clients.has(this.clientId)) {
            this.myRole = this.clients.get(this.clientId).role;
        }
    }

    _updateGmFromClients() {
        for (const [id, client] of this.clients) {
            if (client.role === 'gm') {
                this.gmId = id;
                return;
            }
        }
        this.gmId = null;
    }

    _cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    _scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('❌ Max reconnect attempts reached.');
            this.emit('reconnectFailed');
            return;
        }
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        logger.info(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    // ─── Public API ──────────────────────────────────────────────

    getApiBaseUrl() {
        const wsUrl = this.config.serverUrl;
        const httpUrl = wsUrl.replace(/^ws/, 'http');
        return httpUrl.replace(/\/$/, '') + '/api';
    }

    getCurrentGM() {
        return this.gmId ? this.clients.get(this.gmId) : null;
    }

    getPendingGMRequests() {
        return this.pendingRequests;
    }

    clearPendingGMRequests() {
        this.pendingRequests = [];
    }

    requestGM() {
        this.send('request_gm');
    }

    approveGM(targetId) {
        if (!targetId) {
            logger.warn('approveGM called without targetId');
            return;
        }
        this.send('approve_gm', { targetId });
    }

    // ─── v4.8: Roles (Co-GM / Player / Spectator) ────────────────
    // GM and Co-GM should be treated the same for "has GM powers"
    // purposes -- mirrors server/security.js's isGmLike().
    isGmLike(role = this.myRole) {
        return role === 'gm' || role === 'co-gm';
    }

    /** GM-only server-side (a Co-GM sender is rejected by the server) --
     *  `role` is 'co-gm' | 'player' | 'spectator'; `persist` mirrors the
     *  server's session-only vs. saved distinction for Co-GM grants. */
    changeRole(targetId, role, persist = false) {
        if (!targetId || !role) {
            logger.warn('changeRole called without targetId or role');
            return;
        }
        this.send('role_change_request', { targetId, role, persist });
    }

    // ─── v4.8: Character registration (claim/release) ───────────
    claimCharacter(characterId, character) {
        this.send('claim-character', { characterId, character });
    }

    releaseCharacter() {
        this.send('release-character', {});
    }

    // ─── Ban / Kick ──────────────────────────────────────────────

    getClientIdByName(name) {
        for (const [id, client] of this.clients) {
            if (client.name && client.name.toLowerCase() === name.toLowerCase()) {
                return id;
            }
        }
        return null;
    }

    kickClient(targetId, reason = 'Kicked by admin') {
        this.send('kick_client', { targetId, reason });
    }

    banClient(targetId, reason = 'Banned by admin') {
        this.send('ban_client', { targetId, reason });
    }

    unbanClient(targetId) {
        this.send('unban_client', { targetId });
    }

    // ─── Chat & Rolls ────────────────────────────────────────────

    sendChatMessage(text, sender = 'Discord Bot') {
        this.send('chat-message', { text, sender, timestamp: Date.now() });
    }

    sendRoll(expr, reason = null, sender = 'Discord Bot') {
        const result = this._parseDice(expr);
        this.send('roll-dice', {
            expr,
            result: result.total,
            rolls: result.rolls,
            total: result.total,
            reason,
            sender,
            timestamp: Date.now()
        });
        return result;
    }

    // ─── Deck ─────────────────────────────────────────────────────

    drawCards(count = 1, region = null) {
        this.send('deck-draw', { count, region: region || this.defaultRegion });
    }

    shuffleDeck() {
        this.send('deck-shuffle');
    }

    crownSpread(region = null) {
        this.send('crown-spread', { region: region || this.defaultRegion });
    }

    getDeckHistory(limit = 50) {
        this.send('deck-history', { limit });
    }

    clearDeckHistory() {
        this.send('deck-history-clear');
    }

    // ─── Modules ─────────────────────────────────────────────────

    listModules() {
        this.send('module-list');
    }

    pushModule(moduleId) {
        this.send('module-push-request', { moduleId });
    }

    cleanupModule(moduleId) {
        this.send('module-cleanup-request', { moduleId });
    }

    // ─── Region ──────────────────────────────────────────────────

    setRegion(region) {
        this.defaultRegion = region;
        this.send('set-region', { region });
    }

    // ─── Sync ─────────────────────────────────────────────────────

    syncState(state) {
        this.send('sync-state', { state });
    }

    syncCharacters(characters) {
        this.send('state-updated', { characters });
    }

    // ─── Timers ──────────────────────────────────────────────────
    // UPDATED: /vtttimer's freeform, GM-named timers now hit the
    // server's own ad-hoc timer system (server/timers.js) instead of
    // being tracked only in this bot's local memory -- that system
    // exists exactly for this: a GM/AI-improvised timer independent of
    // any loaded adventure module (as opposed to adventure.js's scene/
    // campaign `campaignTimers`, which only exist by name inside a
    // *loaded adventure module* and are driven by 'adventure-timer'/
    // POST /adventure/timer -- a deliberately separate system, see
    // that file's header doc). This makes /vtttimer's timers real,
    // shared, persistent room state instead of a Discord-bot-only echo
    // that vanished on restart and was invisible to every other client.
    createAdhocTimer(name, segments, description) {
        this.send('adhoc-timer-create', { name, segments, description });
    }

    tickAdhocTimer(name, amount = 1) {
        this.send('adhoc-timer-tick', { name, amount });
    }

    removeAdhocTimer(name) {
        this.send('adhoc-timer-remove', { name });
    }

    requestAdhocTimers() {
        this.send('adhoc-timer-request', {});
    }

    // Still used for a plain, non-destructive combat-status broadcast
    // (server relays 'combat-status-update' verbatim, no room state
    // touched) -- kept for whatever else on the wire listens for it,
    // separate from the real timer state above.
    syncTimers(timers) {
        this.send('combat-status-update', { timers, source: 'discord-bot', timestamp: Date.now() });
    }

    // ─── Whiteboard ──────────────────────────────────────────────

    getWhiteboard() {
        this.send('sync-request', { entity: 'whiteboard' });
    }

    // ─── Dice parser ─────────────────────────────────────────────

    _parseDice(expr) {
        const parts = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
        if (!parts) {
            const num = parseInt(expr) || 0;
            return { total: num, rolls: [num] };
        }
        const count = parseInt(parts[1]);
        const sides = parseInt(parts[2]);
        const modifier = parseInt(parts[3]) || 0;
        const rolls = [];
        let total = 0;
        for (let i = 0; i < count; i++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            rolls.push(roll);
            total += roll;
        }
        total += modifier;
        return { total, rolls };
    }
}

module.exports = VTTClient;