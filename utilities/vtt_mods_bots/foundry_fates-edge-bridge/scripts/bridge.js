/**
 * Fate's Edge Bridge v1.2.0 - Core WebSocket Connection
 * Supports Deck of Consequences, Crown Spread, Modules, Regions, and GM Election/Promotion
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
    
    // State
    deckState: {
        cards: [],
        history: [],
        offset: 0,
        remaining: 54
    },
    defaultRegion: 'Acasia',
    loadedModules: [],
    
    // GM State
    clients: new Map(),          // clientId -> { id, name, role, ... }
    gmId: null,                  // clientId of current GM
    pendingRequests: [],         // { requesterId, requesterName }
    myRole: 'player',            // role of the Foundry client itself
    
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
        
        // Register for chat message hooks
        Hooks.on('chatMessage', (message) => {
            this.hookChatMessage(message);
        });
        
        // Register for dice roll hooks
        Hooks.on('diceRoll', (roll) => {
            this.hookDiceRoll(roll);
        });
        
        // Register for scene change hooks
        Hooks.on('canvasReady', () => {
            this.hookSceneChange();
        });
        
        console.log('⚔️ Fate\'s Edge Bridge v1.2.0 initialized (with GM support)');
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
        this.defaultRegion = game.settings.get('fates-edge-bridge', 'defaultRegion') || 'Acasia';
        
        if (!serverUrl) {
            ui.notifications.warn('⚠️ Fate\'s Edge: No server URL configured');
            return;
        }
        
        if (!roomCode) {
            ui.notifications.warn('⚠️ Fate\'s Edge: No room code configured');
            return;
        }
        
        console.log(`🔗 Connecting to Fate's Edge server: ${serverUrl}`);
        console.log(`🏠 Room: ${roomCode}, Player: ${playerName}, Region: ${this.defaultRegion}`);
        
        try {
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
        
        // Clear GM state
        this.clients.clear();
        this.gmId = null;
        this.pendingRequests = [];
        this.myRole = 'player';
        
        console.log('🔌 Disconnected from Fate\'s Edge server');
        this._updateStatusUI('disconnected');
        this._updateGmUI(); // refresh GM UI
    },
    
    // ============================================================
    // WebSocket Event Handlers
    // ============================================================
    
    _onOpen(roomCode, playerName) {
        console.log('✅ WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        
        // Join the room with extended client data
        this.ws.send(JSON.stringify({
            type: 'join-room',
            roomCode: roomCode,
            clientData: {
                name: playerName,
                role: game.user.isGM ? 'GM' : 'Player',
                userId: game.user.id,
                foundry: true,
                version: game.data.version || 'unknown',
                region: this.defaultRegion
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
            // New Deck Events
            case 'deck-drawn':
                this._handleDeckDrawn(data);
                break;
            case 'deck-shuffled':
                this._handleDeckShuffled(data);
                break;
            case 'crown-spread':
                this._handleCrownSpread(data);
                break;
            // New Module Events
            case 'module-list':
                this._handleModuleList(data);
                break;
            case 'module-push':
                this._handleModulePush(data);
                break;
            case 'module-cleanup':
                this._handleModuleCleanup(data);
                break;
            case 'region-updated':
                this._handleRegionUpdate(data);
                break;
            // ============================================================
            // GM Election & Promotion Events
            // ============================================================
            case 'presence':
                this._handlePresence(data);
                break;
            case 'gm_vote_request':
                this._handleGmVoteRequest(data);
                break;
            case 'gm_role_update':
                this._handleGmRoleUpdate(data);
                break;
            case 'server_announcement':
                this._handleServerAnnouncement(data);
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
        
        if (data.data && data.data.vtt) {
            this._syncVttState(data.data.vtt);
        }
        
        if (data.data && data.data.deck) {
            this.deckState.cards = data.data.deck.cards || [];
            this.deckState.history = data.data.deck.history || [];
            this.deckState.remaining = data.data.deck.cards?.length || 0;
            this._updateDeckUI();
        }
        
        if (data.clients) {
            // Update client list and GM state
            this._updateClients(data.clients);
            const clientNames = data.clients.map(c => c.data?.name || 'Unknown').join(', ');
            console.log(`👥 Clients in room: ${clientNames}`);
        }
        
        // Send region info
        this._sendRegionUpdate(this.defaultRegion);
        this._updateGmUI(); // initial GM UI
    },
    
    _handleStateUpdate(data) {
        console.log('🔄 State updated:', data);
        
        if (data.state && data.state.vtt) {
            this._syncVttState(data.state.vtt);
        }
        if (data.state && data.state.deck) {
            this.deckState.cards = data.state.deck.cards || [];
            this.deckState.remaining = data.state.deck.cards?.length || 0;
            this._updateDeckUI();
        }
    },
    
    _handleChatMessage(data) {
        console.log('💬 Chat:', data.sender, ':', data.text);
        
        const chatData = {
            user: game.user,
            content: `<b>[Fate's Edge] ${data.sender}:</b> ${data.text}`,
            whisper: []
        };
        
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
        // Update clients if full list provided
        if (data.clients) {
            this._updateClients(data.clients);
            this._updateGmUI();
        }
    },
    
    _handleClientLeft(data) {
        console.log(`👤 Client left: ${data}`);
        // Remove from local client map if we know the ID
        if (data.clientId) {
            this.clients.delete(data.clientId);
            if (this.gmId === data.clientId) {
                this.gmId = null;
                this._updateGmFromClients();
            }
            this._updateGmUI();
        }
        ui.notifications.info(`👤 Fate's Edge: A client left the room`);
    },
    
    _handleVoiceStatus(data) {
        console.log('🎤 Voice status:', data);
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
    // Deck Handlers
    // ============================================================
    
    _handleDeckDrawn(data) {
        const cards = data.cards || [];
        const synthesis = data.synthesis || '';
        const region = data.region || this.defaultRegion;
        const count = cards.length;
        
        this.deckState.remaining = data.remaining || (this.deckState.cards?.length || 0);
        
        console.log(`🃏 ${count} card${count > 1 ? 's' : ''} drawn from ${region}`);
        
        const cardNames = cards.map(c => {
            if (c.is_joker) return '🃏 Joker';
            return `${c.rank_name || c.rank} of ${c.suit_name || c.suit}`;
        }).join(', ');
        
        const chatData = {
            user: game.user,
            content: `
                <div style="border: 2px solid #d4af37; border-radius: 8px; padding: 10px; margin: 5px 0; background: rgba(212, 175, 55, 0.1);">
                    <h3 style="color: #d4af37; margin-top: 0;">🃏 Deck Draw - ${region}</h3>
                    <p><strong>${count} card${count > 1 ? 's' : ''} drawn:</strong></p>
                    <p style="font-size: 0.9em;">${cardNames}</p>
                    <hr style="border-color: #d4af37; margin: 5px 0;">
                    <p style="font-style: italic;">${synthesis}</p>
                    <p style="font-size: 0.8em; color: #888; margin-top: 5px;">Cards remaining: ${this.deckState.remaining}</p>
                </div>
            `,
            whisper: []
        };
        
        ChatMessage.create(chatData);
        
        // Also create a journal entry
        this._createDeckJournal(`Deck Draw - ${region}`, `Cards: ${cardNames}\n\n${synthesis}`);
        
        this._updateDeckUI();
    },
    
    _handleDeckShuffled(data) {
        this.deckState.cards = [];
        this.deckState.history = [];
        this.deckState.remaining = data.remaining || 54;
        
        console.log(`🔀 Deck shuffled (${this.deckState.remaining} cards remaining)`);
        
        const chatData = {
            user: game.user,
            content: `
                <div style="border: 2px solid #d4af37; border-radius: 8px; padding: 10px; margin: 5px 0; background: rgba(212, 175, 55, 0.1);">
                    <h3 style="color: #d4af37; margin-top: 0;">🔀 Deck Shuffled</h3>
                    <p>${this.deckState.remaining} cards remaining in the deck.</p>
                </div>
            `,
            whisper: []
        };
        
        ChatMessage.create(chatData);
        this._updateDeckUI();
    },
    
    _handleCrownSpread(data) {
        const result = data.result || {};
        const cards = data.cards || [];
        const region = data.region || this.defaultRegion;
        
        console.log(`👑 Crown Spread from ${region}`);
        
        let msg = `<div style="border: 2px solid #d4af37; border-radius: 8px; padding: 10px; margin: 5px 0; background: rgba(212, 175, 55, 0.1);">`;
        msg += `<h3 style="color: #d4af37; margin-top: 0;">👑 Crown Spread - ${region}</h3>`;
        
        const positions = ['🌱 Root', '🏔️ Crest', '👑 Crown', '🤝 Left Hand'];
        if (result.positions) {
            result.positions.forEach((p, i) => {
                if (i < positions.length) {
                    msg += `<p><strong>${positions[i]}:</strong> ${p.meaning || '...'}</p>`;
                }
            });
        }
        msg += `<p><strong>🌟 Wildcard:</strong> ${result.wildcard || '...'}</p>`;
        msg += `</div>`;
        
        const chatData = {
            user: game.user,
            content: msg,
            whisper: []
        };
        
        ChatMessage.create(chatData);
        
        // Create a journal entry for the Crown Spread
        let journalContent = `Crown Spread - ${region}\n\n`;
        if (result.positions) {
            result.positions.forEach((p, i) => {
                if (i < positions.length) {
                    journalContent += `${positions[i]}: ${p.meaning || '...'}\n\n`;
                }
            });
        }
        journalContent += `Wildcard: ${result.wildcard || '...'}`;
        
        this._createDeckJournal(`Crown Spread - ${region}`, journalContent);
        this._updateDeckUI();
    },
    
    _createDeckJournal(title, content) {
        const journalName = `[Fate\'s Edge] ${title}`;
        let journal = game.journal.find(j => j.name === journalName);
        
        const formattedContent = `<div style="font-family: 'Times New Roman', serif; padding: 10px;">${content.replace(/\n/g, '<br>')}</div>`;
        
        if (!journal) {
            JournalEntry.create({
                name: journalName,
                content: formattedContent,
                folder: null,
                permissions: {
                    default: 0,
                    [game.user.id]: 3
                }
            });
        } else {
            journal.update({ content: formattedContent });
        }
    },
    
    // ============================================================
    // Module Handlers
    // ============================================================
    
    _handleModuleList(data) {
        this.loadedModules = data.modules || [];
        console.log(`📦 ${this.loadedModules.length} modules loaded`);
        
        if (this.loadedModules.length > 0) {
            const names = this.loadedModules.map(m => m.name || m.id).join(', ');
            ui.notifications.info(`📦 Fate's Edge: ${this.loadedModules.length} modules loaded`);
            
            const chatData = {
                user: game.user,
                content: `<b>📦 Loaded Modules:</b><br>${names}`,
                whisper: []
            };
            ChatMessage.create(chatData);
        }
    },
    
    _handleModulePush(data) {
        const module = data.module || {};
        const name = module.manifest?.name || module.id || 'Unknown';
        console.log(`📦 Module pushed: ${name}`);
        ui.notifications.info(`📦 Fate's Edge: Module "${name}" pushed`);
    },
    
    _handleModuleCleanup(data) {
        const moduleId = data.moduleId || 'Unknown';
        console.log(`🧹 Module cleanup: ${moduleId}`);
        ui.notifications.info(`🧹 Fate's Edge: Module cleanup requested: ${moduleId}`);
    },
    
    _handleRegionUpdate(data) {
        if (data.region) {
            this.defaultRegion = data.region;
            console.log(`📍 Region updated to: ${this.defaultRegion}`);
            ui.notifications.info(`📍 Fate's Edge: Region updated to ${this.defaultRegion}`);
        }
    },
    
    // ============================================================
    // GM Handlers
    // ============================================================
    
    _handlePresence(data) {
        console.log('👥 Presence update:', data);
        if (data.clients) {
            this._updateClients(data.clients);
            this._updateGmUI();
        }
    },
    
    _handleGmVoteRequest(data) {
        console.log('👑 GM vote request:', data);
        const { requesterId, requesterName, currentGmId, currentGmName } = data;
        
        // Only show if we are the current GM
        if (this.myRole === 'gm' && this.clientId === currentGmId) {
            // Store pending request if not already
            if (!this.pendingRequests.find(r => r.requesterId === requesterId)) {
                this.pendingRequests.push({ requesterId, requesterName });
            }
            this._updateGmUI();
            ui.notifications.info(`👑 ${requesterName} requests to become GM. Use the GM panel to approve.`);
        }
    },
    
    _handleGmRoleUpdate(data) {
        console.log('👑 GM role update:', data);
        const { clientId, role } = data;
        
        // Update our local role if it's for us
        if (clientId === this.clientId) {
            this.myRole = role;
        }
        
        // Update client in map
        const client = this.clients.get(clientId);
        if (client) {
            client.role = role;
        }
        
        // Update gmId
        if (role === 'gm') {
            this.gmId = clientId;
        } else if (this.gmId === clientId) {
            this._updateGmFromClients();
        }
        
        this._updateGmUI();
        ui.notifications.info(`👑 ${this.clients.get(clientId)?.name || clientId} is now ${role.toUpperCase()}.`);
    },
    
    _handleServerAnnouncement(data) {
        console.log('📢 Server announcement:', data);
        ui.notifications.info(`📢 Fate's Edge: ${data.message}`);
    },
    
    // ============================================================
    // Sync Functions
    // ============================================================
    
    _syncVttState(vttState) {
        if (!vttState) return;
        
        if (vttState.characters) {
            this._syncCharacters(vttState.characters);
        }
        
        if (vttState.timers) {
            this._syncTimers(vttState.timers);
        }
        
        if (vttState.scene) {
            this._syncScene(vttState.scene);
        }
    },
    
    _syncCharacters(characters) {
        console.log('👥 Syncing characters:', characters);
        
        characters.forEach(char => {
            const charName = char.name || 'Unnamed';
            const content = `
                <h2>${charName}</h2>
                <p><b>Harm:</b> ${char.harm || 0}</p>
                <p><b>Fatigue:</b> ${char.fatigue || 0}</p>
                <p><b>Boons:</b> ${char.boons || 0}</p>
                ${char.tier ? `<p><b>Tier:</b> ${char.tier}</p>` : ''}
                ${char.description ? `<p>${char.description}</p>` : ''}
                <hr>
                <p><small>Synced from Fate's Edge VTT v1.2.0</small></p>
            `;
            
            const journalName = `[Fate's Edge] ${charName}`;
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
    
    _syncTimers(timers) {
        console.log('⏱️ Syncing timers:', timers);
        
        timers.forEach(timer => {
            const timerName = timer.name || 'Timer';
            const progress = ((timer.current || 0) / (timer.segments || 1)) * 100;
            const color = (timer.current || 0) >= (timer.segments || 1) ? '#cc3333' : '#d4af37';
            
            const content = `
                <h2>⏱️ ${timerName}</h2>
                <p><b>Progress:</b> ${timer.current || 0}/${timer.segments || 0}</p>
                <p><b>Status:</b> ${timer.current >= timer.segments ? '⚠️ COMPLETE' : '⏳ Active'}</p>
                <div style="width:100%;height:10px;background:#333;border-radius:5px;overflow:hidden;border:1px solid #555;">
                    <div style="width:${Math.min(progress, 100)}%;height:100%;background:${color};border-radius:5px;transition:width 0.3s;"></div>
                </div>
                <hr>
                <p><small>Synced from Fate's Edge VTT v1.2.0</small></p>
            `;
            
            const journalName = `[Fate's Edge] Timer - ${timerName}`;
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
            const scene = game.scenes.find(s => s.name === sceneData.name);
            if (scene && !scene.active) {
                scene.activate();
                ui.notifications.info(`🌐 Fate's Edge: Switched to scene "${sceneData.name}"`);
            }
        }
    },
    
    // ============================================================
    // Client & GM Internal Helpers
    // ============================================================
    
    _updateClients(clientsArray) {
        this.clients.clear();
        clientsArray.forEach(c => {
            this.clients.set(c.id, c);
            if (c.role === 'gm') this.gmId = c.id;
        });
        if (!clientsArray.some(c => c.role === 'gm')) {
            this.gmId = null;
        }
        // Update myRole if my clientId is known
        if (this.clientId && this.clients.has(this.clientId)) {
            this.myRole = this.clients.get(this.clientId).role;
        }
    },
    
    _updateGmFromClients() {
        for (const [id, client] of this.clients) {
            if (client.role === 'gm') {
                this.gmId = id;
                return;
            }
        }
        this.gmId = null;
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
    
    // New: Deck Send Functions
    sendDeckDraw(count = 1, region = null) {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        
        const regionName = region || this.defaultRegion;
        const message = {
            type: 'deck-draw',
            count: Math.min(count, 5),
            region: regionName
        };
        
        this.ws.send(JSON.stringify(message));
        console.log(`🃏 Drawing ${count} card${count > 1 ? 's' : ''} from ${regionName}`);
    },
    
    sendCrownSpread(region = null) {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        
        const regionName = region || this.defaultRegion;
        const message = {
            type: 'deck-draw',
            count: 5,
            region: regionName
        };
        
        this.ws.send(JSON.stringify(message));
        console.log(`👑 Crown Spread from ${regionName}`);
    },
    
    sendDeckShuffle() {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        
        this.ws.send(JSON.stringify({ type: 'deck-shuffle' }));
        console.log('🔀 Deck shuffle requested');
    },
    
    _sendRegionUpdate(region) {
        if (!this.connected || !this.ws) return;
        
        this.ws.send(JSON.stringify({
            type: 'set-region',
            region: region
        }));
        console.log(`📍 Region updated to: ${region}`);
    },
    
    sendModuleList() {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        
        this.ws.send(JSON.stringify({ type: 'module-list' }));
        console.log('📦 Module list requested');
    },
    
    // ============================================================
    // GM Public Methods
    // ============================================================
    
    /**
     * Request to become Game Master
     */
    requestGM() {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        this.ws.send(JSON.stringify({ type: 'request_gm' }));
        console.log('👑 GM request sent');
        ui.notifications.info('👑 GM request sent. Waiting for approval.');
    },
    
    /**
     * Approve a GM request (only valid if current GM)
     * @param {string} targetId - clientId of the requester
     */
    approveGM(targetId) {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return;
        }
        if (!targetId) {
            console.warn('approveGM called without targetId');
            return;
        }
        this.ws.send(JSON.stringify({ type: 'approve_gm', targetId }));
        // Remove from pending list optimistically
        this.pendingRequests = this.pendingRequests.filter(r => r.requesterId !== targetId);
        this._updateGmUI();
        console.log(`👑 Approved GM for ${targetId}`);
        ui.notifications.info(`✅ GM approved for ${targetId}`);
    },
    
    /**
     * Get current GM client object, or null
     */
    getCurrentGM() {
        return this.gmId ? this.clients.get(this.gmId) : null;
    },
    
    /**
     * Get list of pending GM requests
     */
    getPendingGMRequests() {
        return this.pendingRequests;
    },
    
    /**
     * Clear pending requests (e.g., after approval/rejection)
     */
    clearPendingGMRequests() {
        this.pendingRequests = [];
        this._updateGmUI();
    },
    
    // ============================================================
    // Sync Functions
    // ============================================================
    
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
        // Support Fate/Fudge dice
        if (expr.toLowerCase().includes('df')) {
            const parts = expr.match(/^(\d*)dF([+-]\d+)?$/i);
            if (parts) {
                const count = parseInt(parts[1]) || 4;
                const modifier = parseInt(parts[2]) || 0;
                const rolls = [];
                let total = 0;
                for (let i = 0; i < count; i++) {
                    const roll = Math.floor(Math.random() * 3) - 1;
                    rolls.push(roll);
                    total += roll;
                }
                total += modifier;
                return { total, rolls };
            }
        }
        
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
    
    _updateDeckUI() {
        const deckEl = document.getElementById('fates-edge-deck');
        if (deckEl) {
            deckEl.innerHTML = `🃏 ${this.deckState.remaining}`;
        }
    },
    
    _updateGmUI() {
        // This is called whenever GM state changes.
        // The main.js will listen to 'gmStateChanged' event and refresh the UI.
        // We also update the global variable for UI access.
        Hooks.call('fates-edge-gm-state-changed', {
            clients: this.clients,
            gmId: this.gmId,
            pendingRequests: this.pendingRequests,
            myRole: this.myRole,
            currentGM: this.getCurrentGM()
        });
    },
    
    // ============================================================
    // Foundry Hooks
    // ============================================================
    
    hookChatMessage(message) {
        if (game.settings.get('fates-edge-bridge', 'syncChat')) {
            // Don't sync our own messages
            if (message.content && !message.content.includes('[Fate\'s Edge]')) {
                this.sendChatMessage(message.content, message.user?.name || 'Unknown');
            }
        }
    },
    
    hookDiceRoll(roll) {
        if (game.settings.get('fates-edge-bridge', 'syncRolls')) {
            this.sendRoll(roll.formula, roll.total);
        }
    },
    
    hookSceneChange() {
        if (game.settings.get('fates-edge-bridge', 'syncScenes')) {
            const scene = game.scenes.active;
            if (scene && scene.name) {
                this.syncVttState({ scene: { name: scene.name } });
            }
        }
    }
};

// Add global access for macro use
window.FatesEdgeBridge = FatesEdgeBridge;