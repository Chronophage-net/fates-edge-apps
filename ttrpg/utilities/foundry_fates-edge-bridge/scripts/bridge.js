/**
 * Fate's Edge Bridge - Core WebSocket Connection
 */

export const FatesEdgeBridge = {
    ws: null,
    connected: false,
    roomCode: null,
    clientId: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    heartbeatInterval: null,
    
    // ============================================================
    // Initialization
    // ============================================================
    
    initialize() {
        // Listen for settings changes
        Hooks.on('fates-edge-bridge-settings-changed', () => {
            if (this.connected) {
                this.disconnect();
            }
            if (game.settings.get('fates-edge-bridge', 'autoConnect')) {
                this.connect();
            }
        });
    },
    
    // ============================================================
    // Connection Management
    // ============================================================
    
    connect() {
        if (this.connected) {
            console.log('🔌 Already connected to Fate\'s Edge server');
            return;
        }
        
        const serverUrl = game.settings.get('fates-edge-bridge', 'serverUrl');
        const roomCode = game.settings.get('fates-edge-bridge', 'roomCode');
        const playerName = game.settings.get('fates-edge-bridge', 'playerName') || game.user.name || 'Foundry GM';
        
        if (!serverUrl) {
            ui.notifications.warn('⚠️ Fate\'s Edge: No server URL configured');
            return;
        }
        
        if (!roomCode) {
            ui.notifications.warn('⚠️ Fate\'s Edge: No room code configured');
            return;
        }
        
        console.log(`🔗 Connecting to Fate's Edge server: ${serverUrl}`);
        console.log(`🏠 Room: ${roomCode}, Player: ${playerName}`);
        
        try {
            // Determine protocol (ws or wss)
            const protocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
            const wsUrl = serverUrl.replace(/^https?:\/\//, '');
            const fullUrl = `${protocol}://${wsUrl}`;
            
            this.ws = new WebSocket(fullUrl);
            
            this.ws.onopen = () => this._onOpen(roomCode, playerName);
            this.ws.onmessage = (event) => this._onMessage(event);
            this.ws.onerror = (error) => this._onError(error);
            this.ws.onclose = (event) => this._onClose(event);
            
        } catch (err) {
            console.error('❌ Failed to connect:', err);
            ui.notifications.error(`⚠️ Fate's Edge: Connection failed - ${err.message}`);
        }
    },
    
    disconnect() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            try {
                this.ws.close();
            } catch (err) {
                // Ignore
            }
            this.ws = null;
        }
        
        this.connected = false;
        this.clientId = null;
        this.reconnectAttempts = 0;
        
        console.log('🔌 Disconnected from Fate\'s Edge server');
        this._updateStatusUI('disconnected');
    },
    
    // ============================================================
    // WebSocket Event Handlers
    // ============================================================
    
    _onOpen(roomCode, playerName) {
        console.log('✅ WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        
        // Join the room
        this.ws.send(JSON.stringify({
            type: 'join-room',
            roomCode: roomCode,
            clientData: {
                name: playerName,
                role: game.user.isGM ? 'GM' : 'Player',
                userId: game.user.id,
                foundry: true,
                version: game.data.version || 'unknown'
            }
        }));
        
        // Start heartbeat
        this.heartbeatInterval = setInterval(() => {
            if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
        
        this._updateStatusUI('connected');
        ui.notifications.info(`✅ Fate's Edge: Connected to room ${roomCode}`);
    },
    
    _onMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this._handleMessage(data);
        } catch (err) {
            console.warn('⚠️ Failed to parse WebSocket message:', err);
        }
    },
    
    _handleMessage(data) {
        switch (data.type) {
            case 'room-state':
                this._handleRoomState(data);
                break;
            case 'state-updated':
                this._handleStateUpdate(data);
                break;
            case 'chat-message':
                this._handleChatMessage(data);
                break;
            case 'roll-result':
                this._handleRollResult(data);
                break;
            case 'client-joined':
                this._handleClientJoined(data);
                break;
            case 'client-left':
                this._handleClientLeft(data);
                break;
            case 'voice-status':
                this._handleVoiceStatus(data);
                break;
            case 'vtt-state-updated':
                this._handleVttStateUpdate(data);
                break;
            case 'vtt-characters-updated':
                this._handleVttCharactersUpdate(data);
                break;
            case 'vtt-timers-updated':
                this._handleVttTimersUpdate(data);
                break;
            case 'room-closed':
                ui.notifications.warn('⚠️ Fate\'s Edge: Room closed by server');
                this.disconnect();
                break;
            case 'pong':
                // Heartbeat response - ignore
                break;
            default:
                console.debug('📨 Unhandled message type:', data.type);
        }
    },
    
    _onError(error) {
        console.error('❌ WebSocket error:', error);
        ui.notifications.error('⚠️ Fate\'s Edge: WebSocket error - check console');
    },
    
    _onClose(event) {
        console.log(`🔌 WebSocket closed: ${event.code} - ${event.reason || 'No reason'}`);
        this.connected = false;
        this.clientId = null;
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        this._updateStatusUI('disconnected');
        
        // Attempt to reconnect if not manually disconnected
        if (event.code !== 1000) {
            this._attemptReconnect();
        }
    },
    
    // ============================================================
    // Reconnection
    // ============================================================
    
    _attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            ui.notifications.error('⚠️ Fate\'s Edge: Max reconnection attempts reached');
            return;
        }
        
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            if (!this.connected) {
                this.connect();
            }
        }, delay);
    },
    
    // ============================================================
    // Message Handlers
    // ============================================================
    
    _handleRoomState(data) {
        console.log('📦 Received room state:', data);
        
        this.clientId = data.clientId;
        
        // Update Foundry with VTT state if present
        if (data.data && data.data.vtt) {
            this._syncVttState(data.data.vtt);
        }
        
        // Display connected clients
        if (data.clients) {
            const clientNames = data.clients.map(c => c.data?.name || 'Unknown').join(', ');
            console.log(`👥 Clients in room: ${clientNames}`);
        }
    },
    
    _handleStateUpdate(data) {
        console.log('🔄 State updated:', data);
        
        if (data.state && data.state.vtt) {
            this._syncVttState(data.state.vtt);
        }
    },
    
    _handleChatMessage(data) {
        console.log('💬 Chat:', data.sender, ':', data.text);
        
        // Display in Foundry chat
        const chatData = {
            user: game.user,
            content: `<b>[Fate's Edge] ${data.sender}:</b> ${data.text}`,
            whisper: []
        };
        
        // If this is from a specific client, maybe whisper to GM
        if (data.sender && data.sender !== game.user.name) {
            // Show to all
        }
        
        ChatMessage.create(chatData);
    },
    
    _handleRollResult(data) {
        console.log('🎲 Roll:', data);
        
        let resultText = data.result;
        if (data.rolls && data.rolls.length > 0) {
            resultText = `${data.rolls.join(' + ')} = ${data.total}`;
        }
        
        const chatData = {
            user: game.user,
            content: `<b>[Fate's Edge] ${data.sender} rolled:</b><br>🎲 ${data.expr || 'Dice Roll'}<br><b>Result:</b> ${resultText}${data.reason ? `<br><i>${data.reason}</i>` : ''}`,
            whisper: []
        };
        
        ChatMessage.create(chatData);
    },
    
    _handleClientJoined(data) {
        const name = data.data?.name || 'Unknown';
        console.log(`👤 Client joined: ${name}`);
        ui.notifications.info(`👤 Fate's Edge: ${name} joined the room`);
    },
    
    _handleClientLeft(data) {
        console.log(`👤 Client left: ${data}`);
        ui.notifications.info(`👤 Fate's Edge: A client left the room`);
    },
    
    _handleVoiceStatus(data) {
        console.log('🎤 Voice status:', data);
        // Update voice UI if needed
        this._updateVoiceUI(data);
    },
    
    _handleVttStateUpdate(data) {
        console.log('🔄 VTT state update:', data);
        this._syncVttState(data.vtt);
    },
    
    _handleVttCharactersUpdate(data) {
        console.log('👥 Characters update:', data);
        if (data.characters) {
            this._syncCharacters(data.characters);
        }
    },
    
    _handleVttTimersUpdate(data) {
        console.log('⏱️ Timers update:', data);
        if (data.timers) {
            this._syncTimers(data.timers);
        }
    },
    
    // ============================================================
    // Sync Functions
    // ============================================================
    
    _syncVttState(vttState) {
        if (!vttState) return;
        
        // Sync characters
        if (vttState.characters) {
            this._syncCharacters(vttState.characters);
        }
        
        // Sync timers
        if (vttState.timers) {
            this._syncTimers(vttState.timers);
        }
        
        // Sync scene
        if (vttState.scene) {
            this._syncScene(vttState.scene);
        }
    },
    
    _syncCharacters(characters) {
        // Update Foundry actors or create journal entries for VTT characters
        console.log('👥 Syncing characters:', characters);
        
        // For now, just create a journal entry or update chat
        characters.forEach(char => {
            const charName = char.name || 'Unnamed';
            const content = `
                <h2>${charName}</h2>
                <p><b>Harm:</b> ${char.harm || 0}</p>
                <p><b>Fatigue:</b> ${char.fatigue || 0}</p>
                <p><b>Boons:</b> ${char.boons || 0}</p>
                ${char.tier ? `<p><b>Tier:</b> ${char.tier}</p>` : ''}
                ${char.description ? `<p>${char.description}</p>` : ''}
            `;
            
            // Find or create a journal entry
            const journalName = `VTT Character - ${charName}`;
            let journal = game.journal.find(j => j.name === journalName);
            
            if (!journal) {
                // Create new journal entry
                JournalEntry.create({
                    name: journalName,
                    content: content,
                    folder: null,
                    permissions: {
                        default: 0,
                        [game.user.id]: 3
                    }
                });
            } else {
                // Update existing journal
                journal.update({ content: content });
            }
        });
    },
    
    _syncTimers(timers) {
        console.log('⏱️ Syncing timers:', timers);
        
        // Create or update journal entries for timers
        timers.forEach(timer => {
            const timerName = timer.name || 'Timer';
            const content = `
                <h2>⏱️ ${timerName}</h2>
                <p><b>Progress:</b> ${timer.current || 0}/${timer.segments || 0}</p>
                <p><b>Status:</b> ${timer.current >= timer.segments ? '⚠️ COMPLETE' : '⏳ Active'}</p>
                <div style="width:100%;height:10px;background:#333;border-radius:5px;overflow:hidden;">
                    <div style="width:${((timer.current || 0) / (timer.segments || 1)) * 100}%;height:100%;background:${(timer.current || 0) >= (timer.segments || 1) ? '#cc3333' : '#d4af37'};border-radius:5px;transition:width 0.3s;"></div>
                </div>
            `;
            
            const journalName = `VTT Timer - ${timerName}`;
            let journal = game.journal.find(j => j.name === journalName);
            
            if (!journal) {
                JournalEntry.create({
                    name: journalName,
                    content: content,
                    folder: null,
                    permissions: {
                        default: 0,
                        [game.user.id]: 3
                    }
                });
            } else {
                journal.update({ content: content });
            }
        });
    },
    
    _syncScene(sceneData) {
        console.log('🎬 Syncing scene:', sceneData);
        
        if (sceneData.name) {
            // Try to find and activate the scene
            const scene = game.scenes.find(s => s.name === sceneData.name);
            if (scene && !scene.active) {
                scene.activate();
                ui.notifications.info(`🌐 Fate's Edge: Switched to scene "${sceneData.name}"`);
            }
        }
    },
    
    // ============================================================
    // Send Functions
    // ============================================================
    
    sendChatMessage(text, sender = null) {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        
        const message = {
            type: 'chat-message',
            text: text,
            sender: sender || game.user.name,
            timestamp: Date.now()
        };
        
        this.ws.send(JSON.stringify(message));
    },
    
    sendRoll(rollExpr, reason = null) {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        
        // Parse dice expression
        const rollResult = this._parseDiceExpression(rollExpr);
        
        const message = {
            type: 'roll-dice',
            expr: rollExpr,
            result: rollResult.total,
            rolls: rollResult.rolls,
            total: rollResult.total,
            reason: reason || 'Dice roll',
            sender: game.user.name,
            timestamp: Date.now()
        };
        
        this.ws.send(JSON.stringify(message));
    },
    
    syncVttState(state) {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        
        const message = {
            type: 'sync-state',
            state: {
                vtt: state
            }
        };
        
        this.ws.send(JSON.stringify(message));
    },
    
    syncCharacters(characters) {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        
        const message = {
            type: 'vtt-characters-updated',
            characters: characters
        };
        
        this.ws.send(JSON.stringify(message));
    },
    
    syncTimers(timers) {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        
        const message = {
            type: 'vtt-timers-updated',
            timers: timers
        };
        
        this.ws.send(JSON.stringify(message));
    },
    
    // ============================================================
    // Dice Parser
    // ============================================================
    
    _parseDiceExpression(expr) {
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
    },
    
    // ============================================================
    // UI Updates
    // ============================================================
    
    _updateStatusUI(status) {
        const statusEl = document.getElementById('fates-edge-status');
        if (!statusEl) return;
        
        switch (status) {
            case 'connected':
                statusEl.innerHTML = '🟢 Connected';
                statusEl.style.color = '#43b581';
                break;
            case 'disconnected':
                statusEl.innerHTML = '🔴 Disconnected';
                statusEl.style.color = '#f04747';
                break;
            case 'connecting':
                statusEl.innerHTML = '🟡 Connecting...';
                statusEl.style.color = '#faa61a';
                break;
            default:
                statusEl.innerHTML = '⚪ Unknown';
                statusEl.style.color = '#747f8d';
        }
    },
    
    _updateVoiceUI(data) {
        // Update voice status display
        const voiceEl = document.getElementById('fates-edge-voice');
        if (!voiceEl) return;
        
        if (data.enabled) {
            voiceEl.innerHTML = '🎤 Voice On';
            voiceEl.style.color = '#43b581';
        } else {
            voiceEl.innerHTML = '🎤 Voice Off';
            voiceEl.style.color = '#747f8d';
        }
    },
    
    // ============================================================
    // Foundry Hooks
    // ============================================================
    
    // Called when a chat message is sent in Foundry
    hookChatMessage(message) {
        // Optionally sync Foundry chat to the VTT
        if (game.settings.get('fates-edge-bridge', 'syncChat')) {
            this.sendChatMessage(message.content, message.user?.name || 'Unknown');
        }
    },
    
    // Called when a dice roll is made in Foundry
    hookDiceRoll(roll) {
        // Optionally sync Foundry rolls to the VTT
        if (game.settings.get('fates-edge-bridge', 'syncRolls')) {
            this.sendRoll(roll.formula, roll.total);
        }
    }
};

// Add global access for macro use
window.FatesEdgeBridge = FatesEdgeBridge;
