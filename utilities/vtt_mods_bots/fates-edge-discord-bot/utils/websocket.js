/**
 * WebSocket Client for Fate's Edge VTT Server
 * Extended with GM election/promotion support
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

        // GM state per room (only one room per client instance)
        this.clients = new Map();        // clientId -> { id, name, role, ... }
        this.gmId = null;               // clientId of current GM
        this.pendingRequests = [];       // { requesterId, requesterName }
        this.myRole = 'player';
    }

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
            const wsUrl = this.config.serverUrl;
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
            } catch (err) {
                // Ignore
            }
            this.ws = null;
        }
        this.connected = false;
        this.clientId = null;
        this.emit('disconnected');
        // Reset GM state
        this.clients.clear();
        this.gmId = null;
        this.pendingRequests = [];
        this.myRole = 'player';
    }

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

    _onOpen() {
        logger.info('✅ WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');

        // Send auth if API key provided
        if (this.config.apiKey) {
            this._sendMessage({
                type: 'auth',
                apiKey: this.config.apiKey
            });
        }

        // Join room
        this._sendMessage({
            type: 'join-room',
            roomCode: this.roomCode,
            clientData: {
                name: 'Discord Bot',
                role: 'Bot',
                platform: 'discord',
                version: '1.0.0'
            }
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

    _handleMessage(message) {
        switch (message.type) {
            case 'auth-success':
                logger.info('✅ Authentication successful');
                this.emit('auth-success');
                break;

            case 'auth-error':
                logger.error(`❌ Authentication failed: ${message.message}`);
                this.emit('auth-error', message.message);
                break;

            case 'room-state':
                this.clientId = message.clientId;
                this.emit('room-state', message);
                logger.info(`📦 Room state received. Client ID: ${this.clientId}`);
                if (message.clients) {
                    this._updateClients(message.clients);
                    const names = message.clients.map(c => c.data?.name || 'Unknown').join(', ');
                    logger.info(`👥 Clients in room: ${names}`);
                }
                break;

            case 'state-updated':
                this.emit('state-updated', message);
                break;

            case 'chat-message':
                this.emit('chat-message', message);
                break;

            case 'roll-result':
                this.emit('roll-result', message);
                break;

            case 'client-joined':
                this.emit('client-joined', message);
                const name = message.data?.name || 'Unknown';
                logger.info(`👤 ${name} joined the room`);
                // Update clients if the server provides the full list
                if (message.clients) {
                    this._updateClients(message.clients);
                }
                break;

            case 'client-left':
                this.emit('client-left', message);
                logger.info(`👤 Client left: ${message.clientId}`);
                // Remove client from local state
                this.clients.delete(message.clientId);
                if (this.gmId === message.clientId) this.gmId = null;
                // Possibly re-evaluate GM from remaining clients
                this._updateGmFromClients();
                break;

            case 'vtt-state-updated':
                this.emit('vtt-state-updated', message);
                break;

            case 'vtt-characters-updated':
                this.emit('vtt-characters-updated', message);
                break;

            case 'vtt-timers-updated':
                this.emit('vtt-timers-updated', message);
                break;

            case 'room-closed':
                this.emit('room-closed', message);
                logger.warn('⚠️ Room closed by server');
                this.disconnect();
                break;

            // ============================================================
            // GM ELECTION & PROMOTION EVENTS
            // ============================================================
            case 'presence':
                if (message.clients) {
                    this._updateClients(message.clients);
                }
                this.emit('presence', message);
                break;

            case 'gm_vote_request':
                // Store pending request (if not already)
                const { requesterId, requesterName, currentGmId, currentGmName } = message;
                if (!this.pendingRequests.find(r => r.requesterId === requesterId)) {
                    this.pendingRequests.push({ requesterId, requesterName });
                }
                this.emit('gmVoteRequest', message);
                break;

            case 'gm_role_update':
                // Update our local role if we are the target
                if (message.clientId === this.clientId) {
                    this.myRole = message.role;
                }
                // Also update the client in our map
                const client = this.clients.get(message.clientId);
                if (client) {
                    client.role = message.role;
                }
                // If it's the GM, update gmId
                if (message.role === 'gm') {
                    this.gmId = message.clientId;
                } else if (this.gmId === message.clientId) {
                    // If the GM was demoted, find new GM from remaining clients
                    this._updateGmFromClients();
                }
                this.emit('gmRoleUpdate', message);
                break;

            case 'server_announcement':
                this.emit('serverAnnouncement', message);
                break;

            case 'pong':
                // Heartbeat response - ignore
                break;

            default:
                // Forward unknown events
                this.emit('unknown', message);
        }
    }

    // ============================================================
    // Internal helper methods
    // ============================================================

    _updateClients(clientsArray) {
        this.clients.clear();
        clientsArray.forEach(c => {
            this.clients.set(c.id, c);
            if (c.role === 'gm') this.gmId = c.id;
        });
        // If no GM found, set gmId to null
        if (!clientsArray.some(c => c.role === 'gm')) {
            this.gmId = null;
        }
        // Update myRole if my clientId is known
        if (this.clientId && this.clients.has(this.clientId)) {
            this.myRole = this.clients.get(this.clientId).role;
        }
    }

    _updateGmFromClients() {
        let newGm = null;
        for (const [id, client] of this.clients) {
            if (client.role === 'gm') {
                newGm = id;
                break;
            }
        }
        this.gmId = newGm;
    }

    // ============================================================
    // Public API Methods – GM actions
    // ============================================================

    /**
     * Request to become Game Master (send to server)
     */
    requestGM() {
        this.send('request_gm');
    }

    /**
     * Approve a GM request (only valid if current GM)
     * @param {string} targetId - clientId of the requester
     */
    approveGM(targetId) {
        if (!targetId) {
            logger.warn('approveGM called without targetId');
            return;
        }
        this.send('approve_gm', { targetId });
    }

    /**
     * Get current GM client object, or null
     */
    getCurrentGM() {
        return this.gmId ? this.clients.get(this.gmId) : null;
    }

    /**
     * Get list of pending GM requests
     */
    getPendingGMRequests() {
        return this.pendingRequests;
    }

    /**
     * Clear pending requests (e.g., after approval/rejection)
     */
    clearPendingGMRequests() {
        this.pendingRequests = [];
    }

    // ============================================================
    // Existing public API methods
    // ============================================================

    sendChatMessage(text, sender = 'Discord Bot') {
        this.send('chat-message', {
            text,
            sender,
            timestamp: Date.now()
        });
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

    syncCharacters(characters) {
        this.send('vtt-characters-updated', { characters });
    }

    syncTimers(timers) {
        this.send('vtt-timers-updated', { timers });
    }

    syncState(state) {
        this.send('sync-state', { state });
    }

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