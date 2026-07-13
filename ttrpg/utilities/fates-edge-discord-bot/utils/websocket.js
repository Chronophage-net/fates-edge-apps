/**
 * WebSocket Client for Fate's Edge VTT Server
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
                break;

            case 'client-left':
                this.emit('client-left', message);
                logger.info(`👤 Client left: ${message.clientId}`);
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

            case 'pong':
                // Heartbeat response - ignore
                break;

            default:
                // Forward unknown events
                this.emit('unknown', message);
        }
    }

    _onError(error) {
        logger.error(`❌ WebSocket error: ${error.message}`);
        this.emit('error', error);
        this._scheduleReconnect();
    }

    _onClose(code, reason) {
        logger.info(`🔌 WebSocket closed: ${code} - ${reason || 'No reason'}`);
        this.connected = false;
        this.clientId = null;
        this._cleanup();

        if (code !== 1000) {
            this._scheduleReconnect();
        }
        this.emit('disconnected', { code, reason });
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
            logger.error('❌ Max reconnection attempts reached');
            this.emit('reconnect-failed');
            return;
        }

        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;

        logger.info(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            if (!this.connected) {
                this.connect();
            }
        }, delay);
    }

    // ============================================================
    // Public API Methods
    // ============================================================

    sendChatMessage(text, sender = 'Discord Bot') {
        this.send('chat-message', {
            text,
            sender,
            timestamp: Date.now()
        });
    }

    sendRoll(expr, reason = null, sender = 'Discord Bot') {
        // Parse dice expression
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
