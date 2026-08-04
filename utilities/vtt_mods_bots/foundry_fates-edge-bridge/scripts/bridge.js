/**
 * Fate's Edge Bridge v2.1.0 - Core WebSocket Connection
 * Supports: Chat, Rolls, Deck, Crown Spread, Modules, Regions,
 *           GM Election/Promotion, Characters (full sync),
 *           Whiteboard, Grid Combat, and Adventure Engine.
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
    characters: new Map(),          // name -> full character object
    whiteboard: { drawings: [], notes: [], images: [] },
    gridCombat: { enabled: false, tokens: [], gridType: 'square' },
    
    // Adventure Engine State
    adventureState: {
        moduleId: null,
        title: null,
        status: null,
        currentAct: null,
        currentScene: null,
        activeEncounter: null,
        campaignTimers: [],
        log: [],
        updatedAt: null
    },
    
    // GM State
    clients: new Map(),          // clientId -> { id, name, role, ... }
    gmId: null,                  // clientId of current GM
    pendingRequests: [],         // { requesterId, requesterName }
    myRole: 'player',            // role of the Foundry client itself
    
    // ============================================================
    // Initialization
    // ============================================================
    
    initialize() {
        Hooks.on('fates-edge-bridge-settings-changed', () => {
            if (this.connected) {
                this.disconnect();
            }
            if (game.settings.get('fates-edge-bridge', 'autoConnect')) {
                this.connect();
            }
        });
        
        // FIXED: 'chatMessage' is a pre-flight core hook fired with
        // (chatLog, messageText: string, chatData: object) -- there is no
        // message.content/.user on those arguments, so the old handler's
        // `message.content` check silently always failed and chat sync
        // never fired. 'createChatMessage' is the actual Document hook
        // that fires once a ChatMessage has been created, with the real
        // ChatMessage document as its first argument.
        //
        // There is also no core Foundry hook named 'diceRoll'; dice rolls
        // arrive through the same 'createChatMessage' hook as an ordinary
        // chat message whose `.rolls` array is non-empty, so both syncs
        // are now driven from one hook (see hookChatMessage below).
        Hooks.on('createChatMessage', (chatMessage) => {
            this.hookChatMessage(chatMessage);
        });

        Hooks.on('canvasReady', () => {
            this.hookSceneChange();
        });
        
        console.log('⚔️ Fate\'s Edge Bridge v2.1.0 initialized');
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
        const password = game.settings.get('fates-edge-bridge', 'password') || '';
        // NEW: optional -- see settings.js's authToken registration.
        const authToken = game.settings.get('fates-edge-bridge', 'authToken') || '';
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
        this._updateStatusUI('connecting');
        
        try {
            const protocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
            const wsUrl = serverUrl.replace(/^https?:\/\//, '');
            const fullUrl = `${protocol}://${wsUrl}?room=${encodeURIComponent(roomCode)}`;
            
            this.ws = new WebSocket(fullUrl);
            
            this.ws.onopen = () => this._onOpen(playerName, password, authToken);
            this.ws.onmessage = (event) => this._onMessage(event);
            this.ws.onerror = (error) => this._onError(error);
            this.ws.onclose = (event) => this._onClose(event);
            
        } catch (err) {
            console.error('❌ Failed to connect:', err);
            ui.notifications.error(`⚠️ Fate's Edge: Connection failed - ${err.message}`);
            this._updateStatusUI('disconnected');
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
                this.ws.close(1000, 'Disconnected by user');
            } catch (err) {
                // Ignore
            }
            this.ws = null;
        }
        
        this.connected = false;
        this.clientId = null;
        this.reconnectAttempts = 0;
        
        // Clear state
        this.clients.clear();
        this.gmId = null;
        this.pendingRequests = [];
        this.myRole = 'player';
        this.characters.clear();
        this.whiteboard = { drawings: [], notes: [], images: [] };
        this.gridCombat = { enabled: false, tokens: [], gridType: 'square' };
        this.adventureState = {
            moduleId: null,
            title: null,
            status: null,
            currentAct: null,
            currentScene: null,
            activeEncounter: null,
            campaignTimers: [],
            log: [],
            updatedAt: null
        };
        
        console.log('🔌 Disconnected from Fate\'s Edge server');
        this._updateStatusUI('disconnected');
        this._updateGmUI();
        this._updateDeckUI();
    },
    
    // ============================================================
    // WebSocket Event Handlers
    // ============================================================
    
    _onOpen(playerName, password, authToken) {
        console.log('✅ WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this._updateStatusUI('connected');

        const message = {
            type: 'handshake',
            clientName: playerName,
            role: game.user.isGM ? 'gm' : 'player',
            password: password,
            version: '2.1.0'
        };
        // NEW: optional -- an absent/invalid token just means an
        // anonymous join, same as before this was added.
        if (authToken) {
            message.authToken = authToken;
        }
        this.ws.send(JSON.stringify(message));
        console.log('📤 Handshake sent');
        
        this.heartbeatInterval = setInterval(() => {
            if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
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
            case 'handshake_ack':
                this._handleHandshakeAck(data);
                break;
            case 'room-state':
                this._handleRoomState(data);
                break;
            case 'state-updated':
                this._handleStateUpdated(data);
                break;
            case 'sync-state':
                this._handleSyncState(data);
                break;
            case 'chat-message':
                this._handleChatMessage(data);
                break;
            case 'roll-result':
                this._handleRollResult(data);
                break;
            case 'player-joined':
                this._handlePlayerJoined(data);
                break;
            case 'player-left':
                this._handlePlayerLeft(data);
                break;
            // Deck Events
            case 'deck-drawn':
                this._handleDeckDrawn(data);
                break;
            case 'deck-shuffled':
                this._handleDeckShuffled(data);
                break;
            case 'deck-history':
                this._handleDeckHistory(data);
                break;
            case 'deck-history-cleared':
                this._handleDeckHistoryCleared(data);
                break;
            case 'crown-spread':
                this._handleCrownSpread(data);
                break;
            // Module Events
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
                this._handleRegionUpdated(data);
                break;
            // Whiteboard
            case 'whiteboard-update':
                this._handleWhiteboardUpdate(data);
                break;
            // Character updates
            case 'character-update':
                this._handleCharacterUpdate(data);
                break;
            case 'character-update-bulk':
                this._handleCharacterUpdateBulk(data);
                break;
            // GM Events
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
            // Adventure Engine events
            case 'adventure-loaded':
                this._handleAdventureLoaded(data);
                break;
            case 'scene-changed':
                this._handleSceneChanged(data);
                break;
            case 'encounter-started':
                this._handleEncounterStarted(data);
                break;
            case 'encounter-resolved':
                this._handleEncounterResolved(data);
                break;
            case 'timer-ticked':
                this._handleTimerTicked(data);
                break;
            case 'adventure-log':
                this._handleAdventureLog(data);
                break;
            case 'adventure-state':
                this._handleAdventureState(data);
                break;
            case 'adventure-reference':
                this._handleAdventureReference(data);
                break;
            case 'adventure-reset':
                this._handleAdventureReset(data);
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
        this._updateStatusUI('disconnected');
    },
    
    _onClose(event) {
        console.log(`🔌 WebSocket closed: ${event.code} - ${event.reason || 'No reason'}`);
        this.connected = false;
        this.clientId = null;
        this._updateStatusUI('disconnected');
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
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
    
    _handleHandshakeAck(data) {
        this.clientId = data.clientId;
        this.myRole = data.clientRole || 'player';
        console.log(`✅ Handshake successful. Client ID: ${this.clientId}, Role: ${this.myRole}`);
        ui.notifications.info(`✅ Fate's Edge: Connected to room ${this.roomCode}`);
        
        if (data.activeClients) {
            this._updateClients(data.activeClients);
            const names = data.activeClients.map(c => c.name).join(', ');
            console.log(`👥 Clients in room: ${names}`);
        }
        
        this._sendRegionUpdate(this.defaultRegion);
        this._updateGmUI();
        this._updateDeckUI();
    },
    
    _handleRoomState(data) {
        console.log('📦 Room state received');
        if (data.characters) {
            this._updateCharacters(data.characters);
        }
        if (data.whiteboard) {
            this.whiteboard = data.whiteboard;
            if (this.whiteboard.gridCombat) {
                this.gridCombat = this.whiteboard.gridCombat;
            }
        }
        if (data.deckRemaining !== undefined) {
            this.deckState.remaining = data.deckRemaining;
        }
        if (data.region) {
            this.defaultRegion = data.region;
        }
        if (data.clients) {
            this._updateClients(data.clients);
        }
        // Adventure state may be included
        if (data.adventure) {
            this.adventureState = { ...this.adventureState, ...data.adventure };
        }
        this._updateGmUI();
        this._updateDeckUI();
        Hooks.call('fates-edge-room-state', data);
    },
    
    _handleStateUpdated(data) {
        console.log('🔄 State updated');
        if (data.characters) {
            this._updateCharacters(data.characters);
        }
        if (data.timers) {
            this._updateTimers(data.timers);
        }
        Hooks.call('fates-edge-state-updated', data);
    },
    
    _handleSyncState(data) {
        const state = data.state || {};
        if (state.characters) {
            this._updateCharacters(state.characters);
        }
        if (state.whiteboard) {
            this.whiteboard = state.whiteboard;
            if (this.whiteboard.gridCombat) {
                this.gridCombat = this.whiteboard.gridCombat;
            }
        }
        if (state.timers) {
            this._updateTimers(state.timers);
        }
        console.log('📋 Sync state received');
        Hooks.call('fates-edge-sync-state', data);
    },
    
    _handleChatMessage(data) {
        console.log(`💬 ${data.sender}: ${data.text}`);
        const isSystem = data.sender === 'System';
        const chatData = {
            user: game.user,
            content: `<b>${isSystem ? '📢' : '[Fate\'s Edge]'} ${data.sender}:</b> ${data.text}`,
            whisper: []
        };
        ChatMessage.create(chatData);
        Hooks.call('fates-edge-chat-message', data);
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
        Hooks.call('fates-edge-roll-result', data);
    },
    
    _handlePlayerJoined(data) {
        const name = data.clientName || 'Unknown';
        console.log(`👤 ${name} joined`);
        if (data.clients) {
            this._updateClients(data.clients);
        }
        ui.notifications.info(`👤 Fate's Edge: ${name} joined the room`);
        this._updateGmUI();
        Hooks.call('fates-edge-player-joined', data);
    },
    
    _handlePlayerLeft(data) {
        const name = data.clientName || 'Unknown';
        console.log(`👤 ${name} left`);
        if (data.clientId) {
            this.clients.delete(data.clientId);
            if (this.gmId === data.clientId) {
                this.gmId = null;
                this._updateGmFromClients();
            }
        }
        if (data.clients) {
            this._updateClients(data.clients);
        }
        ui.notifications.info(`👤 Fate's Edge: ${name} left the room`);
        this._updateGmUI();
        Hooks.call('fates-edge-player-left', data);
    },
    
    // ============================================================
    // Deck Handlers
    // ============================================================
    
    _handleDeckDrawn(data) {
        const cards = data.cards || [];
        const synthesis = data.synthesis || '';
        const region = data.region || this.defaultRegion;
        this.deckState.remaining = data.remaining || 0;
        
        console.log(`🃏 ${cards.length} card(s) drawn from ${region}`);
        
        const cardNames = cards.map(c => {
            if (c.is_joker) return '🃏 Joker';
            return `${c.rank_name || c.rank} of ${c.suit_name || c.suit}`;
        }).join(', ');
        
        const content = `
            <div style="border: 2px solid #d4af37; border-radius: 8px; padding: 10px; margin: 5px 0; background: rgba(212, 175, 55, 0.1);">
                <h3 style="color: #d4af37; margin-top: 0;">🃏 Deck Draw - ${region}</h3>
                <p><strong>${cards.length} card(s) drawn:</strong></p>
                <p style="font-size: 0.9em;">${cardNames}</p>
                <hr style="border-color: #d4af37; margin: 5px 0;">
                <p style="font-style: italic;">${synthesis}</p>
                <p style="font-size: 0.8em; color: #888; margin-top: 5px;">Cards remaining: ${this.deckState.remaining}</p>
            </div>
        `;
        ChatMessage.create({ user: game.user, content, whisper: [] });
        this._createJournalEntry(`Deck Draw - ${region}`, `Cards: ${cardNames}\n\n${synthesis}`);
        this._updateDeckUI();
        Hooks.call('fates-edge-deck-drawn', data);
    },
    
    _handleDeckShuffled(data) {
        this.deckState.remaining = data.remaining || 54;
        console.log(`🔀 Deck shuffled (${this.deckState.remaining} cards remaining)`);
        const content = `
            <div style="border: 2px solid #d4af37; border-radius: 8px; padding: 10px; margin: 5px 0; background: rgba(212, 175, 55, 0.1);">
                <h3 style="color: #d4af37; margin-top: 0;">🔀 Deck Shuffled</h3>
                <p>${this.deckState.remaining} cards remaining.</p>
            </div>
        `;
        ChatMessage.create({ user: game.user, content, whisper: [] });
        this._updateDeckUI();
        Hooks.call('fates-edge-deck-shuffled', data);
    },
    
    _handleDeckHistory(data) {
        this.deckState.history = data.history || [];
        console.log(`📜 Deck history: ${this.deckState.history.length} entries`);
        Hooks.call('fates-edge-deck-history', data);
    },
    
    _handleDeckHistoryCleared(data) {
        this.deckState.history = [];
        console.log('🗑️ Deck history cleared');
        Hooks.call('fates-edge-deck-history-cleared', data);
    },
    
    _handleCrownSpread(data) {
        const result = data.result || {};
        const region = data.region || this.defaultRegion;
        console.log(`👑 Crown Spread from ${region}`);
        
        let content = `<div style="border: 2px solid #d4af37; border-radius: 8px; padding: 10px; margin: 5px 0; background: rgba(212, 175, 55, 0.1);">`;
        content += `<h3 style="color: #d4af37; margin-top: 0;">👑 Crown Spread - ${region}</h3>`;
        const positions = ['🌱 Root', '🏔️ Crest', '👑 Crown', '🤝 Left Hand'];
        if (result.positions) {
            result.positions.forEach((p, i) => {
                if (i < positions.length) {
                    content += `<p><strong>${positions[i]}:</strong> ${p.meaning || '...'}</p>`;
                }
            });
        }
        content += `<p><strong>🌟 Wildcard:</strong> ${result.wildcard || '...'}</p>`;
        content += `</div>`;
        ChatMessage.create({ user: game.user, content, whisper: [] });
        
        let journalContent = `Crown Spread - ${region}\n\n`;
        if (result.positions) {
            result.positions.forEach((p, i) => {
                if (i < positions.length) {
                    journalContent += `${positions[i]}: ${p.meaning || '...'}\n\n`;
                }
            });
        }
        journalContent += `Wildcard: ${result.wildcard || '...'}`;
        this._createJournalEntry(`Crown Spread - ${region}`, journalContent);
        this._updateDeckUI();
        Hooks.call('fates-edge-crown-spread', data);
    },
    
    // ============================================================
    // Module Handlers
    // ============================================================
    
    _handleModuleList(data) {
        this.loadedModules = data.modules || [];
        console.log(`📦 ${this.loadedModules.length} modules loaded`);
        const names = this.loadedModules.map(m => m.name || m.id).join(', ');
        ui.notifications.info(`📦 Fate's Edge: ${this.loadedModules.length} modules loaded`);
        ChatMessage.create({
            user: game.user,
            content: `<b>📦 Loaded Modules:</b><br>${names}`,
            whisper: []
        });
        Hooks.call('fates-edge-module-list', data);
    },
    
    _handleModulePush(data) {
        const module = data.module || {};
        const name = module.manifest?.name || module.id || 'Unknown';
        console.log(`📦 Module pushed: ${name}`);
        ui.notifications.info(`📦 Fate's Edge: Module "${name}" pushed`);
        Hooks.call('fates-edge-module-push', data);
    },
    
    _handleModuleCleanup(data) {
        const moduleId = data.moduleId || 'Unknown';
        console.log(`🧹 Module cleanup: ${moduleId}`);
        ui.notifications.info(`🧹 Fate's Edge: Module cleanup requested: ${moduleId}`);
        Hooks.call('fates-edge-module-cleanup', data);
    },
    
    _handleRegionUpdated(data) {
        if (data.region) {
            this.defaultRegion = data.region;
            console.log(`📍 Region updated to: ${this.defaultRegion}`);
            ui.notifications.info(`📍 Fate's Edge: Region updated to ${this.defaultRegion}`);
            Hooks.call('fates-edge-region-updated', data);
        }
    },
    
    // ============================================================
    // Whiteboard Handlers
    // ============================================================
    
    _handleWhiteboardUpdate(data) {
        if (data.whiteboard) {
            this.whiteboard = data.whiteboard;
            if (this.whiteboard.gridCombat) {
                this.gridCombat = this.whiteboard.gridCombat;
            }
            console.log(`📋 Whiteboard updated: ${this.whiteboard.drawings?.length || 0} drawings, ${this.whiteboard.notes?.length || 0} notes, ${this.whiteboard.images?.length || 0} images`);
            if (this.gridCombat.enabled) {
                console.log(`⚔️ Grid combat: ${this.gridCombat.gridType}, ${this.gridCombat.tokens?.length || 0} tokens`);
            }
            Hooks.call('fates-edge-whiteboard-update', data);
        }
    },
    
    // ============================================================
    // Character Handlers
    // ============================================================
    
    _updateCharacters(charactersArray) {
        this.characters.clear();
        charactersArray.forEach(c => {
            if (c.name) {
                this.characters.set(c.name, c);
            }
        });
        console.log(`👥 ${this.characters.size} characters synced`);
        this._syncCharactersToJournal();
        Hooks.call('fates-edge-characters-updated', this.characters);
    },
    
    _handleCharacterUpdate(data) {
        if (data.name && data.field !== undefined) {
            let char = this.characters.get(data.name);
            if (!char) {
                char = { name: data.name };
                this.characters.set(data.name, char);
            }
            char[data.field] = data.value;
            console.log(`⚡ ${data.name}.${data.field} = ${data.value}`);
            this._syncCharactersToJournal();
            Hooks.call('fates-edge-character-update', data);
        }
    },
    
    _handleCharacterUpdateBulk(data) {
        if (data.updates) {
            Object.entries(data.updates).forEach(([name, fields]) => {
                let char = this.characters.get(name);
                if (!char) {
                    char = { name };
                    this.characters.set(name, char);
                }
                Object.assign(char, fields);
            });
            console.log(`📋 Bulk update: ${Object.keys(data.updates).length} characters`);
            this._syncCharactersToJournal();
            Hooks.call('fates-edge-character-bulk-update', data);
        }
    },
    
    _syncCharactersToJournal() {
        for (const [name, char] of this.characters) {
            this._createJournalEntry(`[Fate's Edge] ${name}`, this._formatCharacter(char));
        }
    },
    
    _formatCharacter(char) {
        let content = `<h2>${char.name}</h2>`;
        content += `<p><b>Harm:</b> ${char.harm || 0}</p>`;
        content += `<p><b>Fatigue:</b> ${char.fatigue || 0}</p>`;
        content += `<p><b>Boons:</b> ${char.boons || 0}</p>`;
        if (char.tier) content += `<p><b>Tier:</b> ${char.tier}</p>`;
        if (char.attributes) {
            content += `<p><b>Attributes:</b> ${Object.entries(char.attributes).map(([k,v]) => `${k}: ${v}`).join(', ')}</p>`;
        }
        if (char.skills) {
            content += `<p><b>Skills:</b> ${Object.entries(char.skills).map(([k,v]) => `${k}: ${v}`).join(', ')}</p>`;
        }
        if (char.heritage) content += `<p><b>Heritage:</b> ${char.heritage}</p>`;
        if (char.background) content += `<p><b>Background:</b> ${char.background}</p>`;
        if (char.patron) content += `<p><b>Patron:</b> ${char.patron}</p>`;
        content += `<hr><p><small>Synced from Fate's Edge VTT v2.1.0</small></p>`;
        return content;
    },
    
    // ============================================================
    // Timer Handlers
    // ============================================================
    
    _updateTimers(timers) {
        console.log(`⏱️ ${timers.length} timers synced`);
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
                <hr><p><small>Synced from Fate's Edge VTT v2.1.0</small></p>
            `;
            this._createJournalEntry(`[Fate's Edge] Timer - ${timerName}`, content);
        });
        Hooks.call('fates-edge-timers-updated', timers);
    },
    
    // ============================================================
    // GM Handlers
    // ============================================================
    
    _handlePresence(data) {
        if (data.clients) {
            this._updateClients(data.clients);
            this._updateGmUI();
        }
        Hooks.call('fates-edge-presence', data);
    },
    
    _handleGmVoteRequest(data) {
        const { requesterId, requesterName, currentGmId, currentGmName } = data;
        if (this.myRole === 'gm' && this.clientId === currentGmId) {
            if (!this.pendingRequests.find(r => r.requesterId === requesterId)) {
                this.pendingRequests.push({ requesterId, requesterName });
            }
            this._updateGmUI();
            ui.notifications.info(`👑 ${requesterName} requests to become GM. Use the GM panel to approve.`);
        }
        Hooks.call('fates-edge-gm-vote-request', data);
    },
    
    _handleGmRoleUpdate(data) {
        const { clientId, role } = data;
        if (clientId === this.clientId) {
            this.myRole = role;
        }
        const client = this.clients.get(clientId);
        if (client) {
            client.role = role;
        }
        if (role === 'gm') {
            this.gmId = clientId;
        } else if (this.gmId === clientId) {
            this._updateGmFromClients();
        }
        this._updateGmUI();
        ui.notifications.info(`👑 ${this.clients.get(clientId)?.name || clientId} is now ${role.toUpperCase()}.`);
        Hooks.call('fates-edge-gm-role-update', data);
    },
    
    _handleServerAnnouncement(data) {
        ui.notifications.info(`📢 Fate's Edge: ${data.message}`);
        ChatMessage.create({
            user: game.user,
            content: `<b>📢 ${data.message}</b>`,
            whisper: []
        });
        Hooks.call('fates-edge-server-announcement', data);
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
    
    _send(type, data = {}) {
        if (!this.connected || !this.ws) {
            ui.notifications.warn('⚠️ Fate\'s Edge: Not connected to server');
            return false;
        }
        this.ws.send(JSON.stringify({ type, ...data }));
        return true;
    },
    
    sendChatMessage(text, sender = null) {
        return this._send('chat-message', { text, sender: sender || game.user.name, timestamp: Date.now() });
    },
    
    sendRoll(expr, reason = null) {
        return this._send('roll-dice', { expr, reason: reason || 'Dice roll', sender: game.user.name, timestamp: Date.now() });
    },
    
    sendDeckDraw(count = 1, region = null) {
        const regionName = region || this.defaultRegion;
        return this._send('deck-draw', { count: Math.min(count, 5), region: regionName });
    },
    
    sendCrownSpread(region = null) {
        const regionName = region || this.defaultRegion;
        return this._send('crown-spread', { region: regionName });
    },
    
    sendDeckShuffle() {
        return this._send('deck-shuffle', {});
    },
    
    sendRegionUpdate(region) {
        this.defaultRegion = region;
        return this._send('set-region', { region });
    },
    
    sendModuleList() {
        return this._send('module-list', {});
    },
    
    sendSyncRequest(entity = 'all') {
        return this._send('sync-request', { entity });
    },
    
    syncCharacters(characters) {
        return this._send('state-updated', { characters });
    },
    
    requestGM() {
        return this._send('request_gm', {});
    },
    
    approveGM(targetId) {
        if (this.myRole !== 'gm') {
            ui.notifications.warn('⚠️ Only the current GM can approve.');
            return false;
        }
        this.pendingRequests = this.pendingRequests.filter(r => r.requesterId !== targetId);
        this._updateGmUI();
        return this._send('approve_gm', { targetId });
    },
    
    // ─── Adventure Engine send methods ─────────────────────────
    
    sendAdventureLoad(moduleId) {
        if (!moduleId) {
            ui.notifications.warn('⚠️ Module ID required');
            return false;
        }
        return this._send('adventure-load', { moduleId });
    },
    
    sendAdventureScene(actIndex = null, sceneIndex = null) {
        const target = {};
        if (actIndex !== null && !isNaN(actIndex)) target.actIndex = Number(actIndex);
        if (sceneIndex !== null && !isNaN(sceneIndex)) target.sceneIndex = Number(sceneIndex);
        return this._send('adventure-scene', target);
    },
    
    sendAdventureEncounterStart(ref) {
        if (ref === undefined || ref === null) {
            ui.notifications.warn('⚠️ Encounter reference required');
            return false;
        }
        return this._send('adventure-encounter-start', { ref });
    },
    
    sendAdventureEncounterResolve(outcome, notes = '') {
        if (!['clean', 'partial', 'miss'].includes(outcome)) {
            ui.notifications.warn('⚠️ Outcome must be clean, partial, or miss');
            return false;
        }
        return this._send('adventure-encounter-resolve', { outcome, notes });
    },
    
    sendAdventureTimer(name, amount = 1, scope = 'scene') {
        if (!name) {
            ui.notifications.warn('⚠️ Timer name required');
            return false;
        }
        return this._send('adventure-timer', { ref: name, amount, scope });
    },
    
    sendAdventureLog(text, author = null) {
        if (!text) {
            ui.notifications.warn('⚠️ Log text required');
            return false;
        }
        return this._send('adventure-log', { text, author: author || game.user.name });
    },
    
    sendAdventureStatus() {
        return this._send('adventure-state-request', {});
    },
    
    sendAdventureReference() {
        return this._send('adventure-reference-request', {});
    },
    
    sendAdventureReset() {
        return this._send('adventure-reset', {});
    },
    
    // ============================================================
    // Adventure Engine Handlers (NEW)
    // ============================================================
    
    _handleAdventureLoaded(data) {
        this.adventureState = { ...this.adventureState, ...data };
        console.log(`📖 Adventure loaded: ${data.title || data.moduleId}`);
        const content = `
            <h2>📖 Adventure Loaded</h2>
            <p><b>Title:</b> ${data.title || data.moduleId}</p>
            <p><b>Status:</b> ${data.status || 'active'}</p>
            <p><b>Tier:</b> ${data.tier || '?'}</p>
            ${data.currentAct ? `<p><b>Act:</b> ${data.currentAct.title}</p>` : ''}
            ${data.currentScene ? `<p><b>Scene:</b> ${data.currentScene.title}</p>` : ''}
            <hr><p><small>Synced from Fate's Edge VTT v2.1.0</small></p>
        `;
        this._createJournalEntry(`[Fate's Edge] Adventure: ${data.title || data.moduleId}`, content);
        ui.notifications.info(`📖 Fate's Edge: Adventure "${data.title || data.moduleId}" loaded`);
        Hooks.call('fates-edge-adventure-loaded', data);
    },
    
    _handleSceneChanged(data) {
        this.adventureState = { ...this.adventureState, ...data };
        const act = data.currentAct?.title || 'Unknown';
        const scene = data.currentScene?.title || 'Unknown';
        console.log(`🎭 Scene changed: ${act} / ${scene}`);
        const content = `
            <h2>🎭 Scene Changed</h2>
            <p><b>Act:</b> ${act}</p>
            <p><b>Scene:</b> ${scene}</p>
            ${data.currentScene?.description ? `<p><i>${data.currentScene.description}</i></p>` : ''}
            <hr><p><small>Synced from Fate's Edge VTT v2.1.0</small></p>
        `;
        this._createJournalEntry(`[Fate's Edge] Scene: ${scene}`, content);
        ui.notifications.info(`🎭 Fate's Edge: Scene changed to "${scene}"`);
        Hooks.call('fates-edge-scene-changed', data);
    },
    
    _handleEncounterStarted(data) {
        this.adventureState = { ...this.adventureState, ...data };
        const enc = data.activeEncounter || {};
        const name = enc.name || enc.creatureId || 'Encounter';
        const dv = enc.dv || '?';
        const pos = enc.position || 'Controlled';
        console.log(`⚔️ Encounter started: ${name}`);
        const content = `
            <h2>⚔️ Encounter Started</h2>
            <p><b>Name:</b> ${name}</p>
            <p><b>DV:</b> ${dv}</p>
            <p><b>Position:</b> ${pos}</p>
            ${enc.creature ? `<p><b>Creature:</b> ${enc.creature.name} (TL${enc.creature.tl})</p>` : ''}
            <hr><p><small>Synced from Fate's Edge VTT v2.1.0</small></p>
        `;
        this._createJournalEntry(`[Fate's Edge] Encounter: ${name}`, content);
        ui.notifications.warn(`⚔️ Fate's Edge: Encounter "${name}" started!`);
        Hooks.call('fates-edge-encounter-started', data);
    },
    
    _handleEncounterResolved(data) {
        this.adventureState = { ...this.adventureState, ...data };
        const resolution = data.lastResolution || {};
        const encName = resolution.encounter || 'Encounter';
        const outcome = resolution.outcome || '?';
        const resultText = resolution.result || '';
        console.log(`⚔️ Encounter resolved: ${encName} (${outcome})`);
        const content = `
            <h2>⚔️ Encounter Resolved</h2>
            <p><b>Encounter:</b> ${encName}</p>
            <p><b>Outcome:</b> ${outcome}</p>
            ${resultText ? `<p><i>${resultText}</i></p>` : ''}
            ${resolution.notes ? `<p><b>Notes:</b> ${resolution.notes}</p>` : ''}
            <hr><p><small>Synced from Fate's Edge VTT v2.1.0</small></p>
        `;
        this._createJournalEntry(`[Fate's Edge] Encounter Resolved: ${encName}`, content);
        ui.notifications.info(`⚔️ Fate's Edge: Encounter "${encName}" resolved as ${outcome}`);
        Hooks.call('fates-edge-encounter-resolved', data);
    },
    
    _handleTimerTicked(data) {
        this.adventureState = { ...this.adventureState, ...data };
        const timer = data.tickedTimer || {};
        const name = timer.name || 'Timer';
        const current = timer.current ?? 0;
        const segments = timer.segments || 1;
        const full = timer.full || false;
        console.log(`⏱️ Timer ticked: ${name} ${current}/${segments}`);
        const progress = Math.round((current / segments) * 100);
        const color = full ? '#cc3333' : '#d4af37';
        const content = `
            <h2>⏱️ Timer Ticked: ${name}</h2>
            <p><b>Progress:</b> ${current}/${segments}</p>
            <div style="width:100%;height:10px;background:#333;border-radius:5px;overflow:hidden;border:1px solid #555;">
                <div style="width:${Math.min(progress, 100)}%;height:100%;background:${color};border-radius:5px;transition:width 0.3s;"></div>
            </div>
            <p><b>Status:</b> ${full ? '⚠️ COMPLETE' : '⏳ Active'}</p>
            <hr><p><small>Synced from Fate's Edge VTT v2.1.0</small></p>
        `;
        this._createJournalEntry(`[Fate's Edge] Timer: ${name}`, content);
        if (full) ui.notifications.warn(`⚠️ Fate's Edge: Timer "${name}" is complete!`);
        Hooks.call('fates-edge-timer-ticked', data);
    },
    
    _handleAdventureLog(data) {
        this.adventureState = { ...this.adventureState, ...data };
        const log = data.log || [];
        if (log.length) {
            const last = log[log.length - 1];
            console.log(`📝 Adventure log: ${last.message || last.text || last.type}`);
            const content = `
                <h2>📝 Adventure Log</h2>
                <p><b>${last.author || 'GM'}:</b> ${last.message || last.text || last.type}</p>
                <p><i>${new Date(last.timestamp).toLocaleString()}</i></p>
                <hr><p><small>Synced from Fate's Edge VTT v2.1.0</small></p>
            `;
            this._createJournalEntry(`[Fate's Edge] Log Entry`, content);
            Hooks.call('fates-edge-adventure-log', data);
        }
    },
    
    _handleAdventureState(data) {
        this.adventureState = { ...this.adventureState, ...data };
        console.log('📋 Adventure state received');
        Hooks.call('fates-edge-adventure-state', data);
    },
    
    _handleAdventureReference(data) {
        console.log('📚 Adventure reference received');
        let content = `<h2>📚 Adventure Reference: ${data.moduleId}</h2>`;
        if (data.bestiary && data.bestiary.length) {
            content += `<h3>🐉 Bestiary (${data.bestiary.length})</h3><ul>`;
            data.bestiary.forEach(b => {
                content += `<li><b>${b.name}</b> (TL${b.tl}) - ${b.class || b.category || ''}</li>`;
            });
            content += `</ul>`;
        }
        if (data.npcs && data.npcs.length) {
            content += `<h3>👤 NPCs (${data.npcs.length})</h3><ul>`;
            data.npcs.forEach(n => {
                content += `<li><b>${n.name}</b> (${n.role || 'NPC'})${n.motivation ? ` - ${n.motivation}` : ''}</li>`;
            });
            content += `</ul>`;
        }
        if (data.locations && data.locations.length) {
            content += `<h3>📍 Locations (${data.locations.length})</h3><ul>`;
            data.locations.forEach(l => {
                content += `<li><b>${l.name}</b>${l.description ? `: ${l.description}` : ''}</li>`;
            });
            content += `</ul>`;
        }
        if (data.factions && data.factions.length) {
            content += `<h3>⚑ Factions (${data.factions.length})</h3><ul>`;
            data.factions.forEach(f => {
                content += `<li><b>${f.name}</b>${f.goals ? ` - ${f.goals}` : ''}</li>`;
            });
            content += `</ul>`;
        }
        if (data.notes) {
            content += `<h3>📝 Notes</h3><p>${data.notes}</p>`;
        }
        content += `<hr><p><small>Synced from Fate's Edge VTT v2.1.0</small></p>`;
        this._createJournalEntry(`[Fate's Edge] Reference: ${data.moduleId}`, content);
        ui.notifications.info(`📚 Fate's Edge: Reference data for "${data.moduleId}" received`);
        Hooks.call('fates-edge-adventure-reference', data);
    },
    
    _handleAdventureReset(data) {
        this.adventureState = { ...this.adventureState, ...data };
        console.log('🔄 Adventure reset');
        const content = `
            <h2>🔄 Adventure Reset</h2>
            <p>The adventure has been reset to its initial state.</p>
            <hr><p><small>Synced from Fate's Edge VTT v2.1.0</small></p>
        `;
        this._createJournalEntry(`[Fate's Edge] Adventure Reset`, content);
        ui.notifications.info('🔄 Fate\'s Edge: Adventure reset to start');
        Hooks.call('fates-edge-adventure-reset', data);
    },
    
    // ============================================================
    // Utility Functions
    // ============================================================
    
    _createJournalEntry(title, content) {
        let journal = game.journal.find(j => j.name === title);
        const formattedContent = `<div style="font-family: 'Times New Roman', serif; padding: 10px;">${content.replace(/\n/g, '<br>')}</div>`;
        if (!journal) {
            JournalEntry.create({
                name: title,
                content: formattedContent,
                folder: null,
                permissions: { default: 0, [game.user.id]: 3 }
            });
        } else {
            journal.update({ content: formattedContent });
        }
    },
    
    _parseDiceExpression(expr) {
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
    
    _updateDeckUI() {
        const deckEl = document.getElementById('fates-edge-deck');
        if (deckEl) {
            deckEl.innerHTML = `🃏 ${this.deckState.remaining}`;
        }
        Hooks.call('fates-edge-deck-ui-updated', this.deckState);
    },
    
    _updateGmUI() {
        Hooks.call('fates-edge-gm-state-changed', {
            clients: this.clients,
            gmId: this.gmId,
            pendingRequests: this.pendingRequests,
            myRole: this.myRole,
            currentGM: this.getCurrentGM()
        });
    },
    
    // ============================================================
    // Public Accessors
    // ============================================================
    
    getCurrentGM() {
        return this.gmId ? this.clients.get(this.gmId) : null;
    },
    
    getPendingGMRequests() {
        return this.pendingRequests;
    },
    
    clearPendingGMRequests() {
        this.pendingRequests = [];
        this._updateGmUI();
    },
    
    // ============================================================
    // Foundry Hooks
    // ============================================================
    
    // FIXED: this now receives a real ChatMessage document (see the
    // 'createChatMessage' hook registration above), not the old
    // pre-flight (chatLog, messageText, chatData) tuple whose first
    // argument never had a `.content`/`.user`/`.whisper`. `.author` is
    // the current (v12+) accessor for who sent the message -- `.user` is
    // its deprecated alias, kept here only as a fallback for older
    // Foundry versions still within this module's compatibility range.
    hookChatMessage(chatMessage) {
        const content = chatMessage.content;
        const whisper = chatMessage.whisper && chatMessage.whisper.length > 0;
        const senderName = (chatMessage.author || chatMessage.user)?.name || 'Unknown';

        // Dice rolls: a ChatMessage created from a Roll has a non-empty
        // `.rolls` array (v11+). Route these to sendRoll instead of
        // sendChatMessage, mirroring what used to be a separate (and
        // nonexistent) 'diceRoll' hook.
        if (chatMessage.rolls && chatMessage.rolls.length > 0) {
            if (!game.settings.get('fates-edge-bridge', 'syncRolls')) return;
            if (whisper) return;
            const roll = chatMessage.rolls[0];
            this.hookDiceRoll(roll);
            return;
        }

        if (!game.settings.get('fates-edge-bridge', 'syncChat')) return;
        if (content && !content.includes('[Fate\'s Edge]') && !whisper) {
            this.sendChatMessage(content, senderName);
        }
    },

    hookDiceRoll(roll) {
        this.sendRoll(roll.formula, roll.total);
    },

    hookSceneChange() {
        if (!game.settings.get('fates-edge-bridge', 'syncScenes')) return;
        const scene = game.scenes.active;
        if (scene && scene.name) {
            // FIXED: this used to call sendSyncRequest('scene'), which is
            // a READ-only pull (server ignores the 'entity' field and
            // just pushes back whiteboard+character state) -- it never
            // actually told the server Foundry's scene had changed,
            // despite the module advertising a "scene-sync" feature and
            // the README describing an outbound broadcast. Broadcasts the
            // new scene name via the non-destructive 'scene-status-update'
            // relay event instead (server relays it as-is, no room state
            // is touched -- unlike 'sync-state', which overwrites the
            // whole room whiteboard object).
            this._send('scene-status-update', { scene: { name: scene.name } });
        }
    }
};

// Add global access for macro use
window.FatesEdgeBridge = FatesEdgeBridge;