/**
 * Fate's Edge Roll20 API Module v1.2.0
 * Connects Roll20 to the Fate's Edge WebSocket Server
 * 
 * Features:
 * - Real-time chat sync
 * - Dice roll sync
 * - Character sync (Harm, Fatigue, Boons, Tier)
 * - Timer sync
 * - Scene sync (via Roll20 page switching)
 * - Presence/voice indicators
 * - Auto-reconnect
 * - Player name mapping (Roll20 name → VTT name)
 * - Deck of Consequences sync
 * - Crown Spread support
 * - Module management
 * - Region support
 * 
 * Installation:
 * 1. In Roll20, go to Settings → API Scripts
 * 2. Paste this script
 * 3. Set the following environment variables in Roll20 API:
 *    - FATES_EDGE_SERVER_URL: ws://your-server:3000
 *    - FATES_EDGE_ROOM_CODE: ABC123
 *    - FATES_EDGE_PLAYER_NAME: Optional (defaults to Roll20 display name)
 *    - FATES_EDGE_API_KEY: Your API key
 *    - FATES_EDGE_AUTO_CONNECT: true/false
 *    - FATES_EDGE_DEFAULT_REGION: Acasia
 */

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
    serverUrl: getConfigVar('FATES_EDGE_SERVER_URL', 'ws://localhost:3000'),
    roomCode: getConfigVar('FATES_EDGE_ROOM_CODE', ''),
    apiKey: getConfigVar('FATES_EDGE_API_KEY', ''),
    autoConnect: getConfigVar('FATES_EDGE_AUTO_CONNECT', 'true') === 'true',
    syncChat: getConfigVar('FATES_EDGE_SYNC_CHAT', 'true') === 'true',
    syncRolls: getConfigVar('FATES_EDGE_SYNC_ROLLS', 'true') === 'true',
    syncCharacters: getConfigVar('FATES_EDGE_SYNC_CHARACTERS', 'true') === 'true',
    syncTimers: getConfigVar('FATES_EDGE_SYNC_TIMERS', 'true') === 'true',
    syncScenes: getConfigVar('FATES_EDGE_SYNC_SCENES', 'true') === 'true',
    syncDeck: getConfigVar('FATES_EDGE_SYNC_DECK', 'true') === 'true',
    playerName: getConfigVar('FATES_EDGE_PLAYER_NAME', ''),
    defaultRegion: getConfigVar('FATES_EDGE_DEFAULT_REGION', 'Acasia')
};

function getConfigVar(name, defaultValue) {
    if (typeof global !== 'undefined' && global[name] !== undefined) {
        return global[name];
    }
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
        return process.env[name];
    }
    return defaultValue;
}

// ============================================================
// State
// ============================================================

let ws = null;
let connected = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let heartbeatInterval = null;
let clientId = null;

// Track state
const vttCharacters = new Map();
const vttTimers = [];
const deckState = {
    cards: [],
    history: [],
    offset: 0,
    remaining: 54
};
let currentRegion = CONFIG.defaultRegion;
let loadedModules = [];

// ============================================================
// Logging (Roll20-friendly)
// ============================================================

function log(message, level = 'info') {
    const prefix = '⚔️ Fate\'s Edge v1.2.0:';
    const timestamp = new Date().toISOString();
    switch (level) {
        case 'error':
            console.error(`${prefix} ${message}`);
            break;
        case 'warn':
            console.warn(`${prefix} ${message}`);
            break;
        case 'info':
        default:
            console.log(`${prefix} ${message}`);
            break;
    }
}

function logWS(direction, data) {
    // Uncomment for verbose debugging
    // console.log(`${direction} ${JSON.stringify(data)}`);
}

// ============================================================
// WebSocket Connection
// ============================================================

function connect() {
    if (connected) {
        log('Already connected');
        return;
    }

    if (!CONFIG.roomCode) {
        log('Room code not configured. Set FATES_EDGE_ROOM_CODE');
        return;
    }

    if (!CONFIG.serverUrl) {
        log('Server URL not configured. Set FATES_EDGE_SERVER_URL');
        return;
    }

    log(`Connecting to ${CONFIG.serverUrl} as ${getPlayerName()}...`);

    try {
        const wsUrl = CONFIG.serverUrl;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => onOpen();
        ws.onmessage = (event) => onMessage(event);
        ws.onerror = (error) => onError(error);
        ws.onclose = (event) => onClose(event);

    } catch (err) {
        log(`Connection error: ${err.message}`, 'error');
        scheduleReconnect();
    }
}

function disconnect() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (ws) {
        try {
            ws.close(1000, 'Disconnected by user');
        } catch (err) {
            // Ignore
        }
        ws = null;
    }

    connected = false;
    clientId = null;
    reconnectAttempts = 0;
    log('Disconnected');
    updateStatus('disconnected');
}

function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        log('Max reconnection attempts reached. Will retry on next API call.');
        return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
    reconnectAttempts++;

    log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    reconnectTimer = setTimeout(() => {
        if (!connected) {
            connect();
        }
    }, delay);
}

// ============================================================
// WebSocket Event Handlers
// ============================================================

function onOpen() {
    log('WebSocket connected');
    connected = true;
    reconnectAttempts = 0;

    if (CONFIG.apiKey) {
        sendMessage({
            type: 'auth',
            apiKey: CONFIG.apiKey
        });
    }

    // Join room with extended client data
    sendMessage({
        type: 'join-room',
        roomCode: CONFIG.roomCode,
        clientData: {
            name: getPlayerName(),
            role: 'GM',
            platform: 'roll20',
            version: '1.2.0',
            region: currentRegion
        }
    });

    // Start heartbeat
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    heartbeatInterval = setInterval(() => {
        if (connected && ws && ws.readyState === WebSocket.OPEN) {
            sendMessage({ type: 'ping' });
        }
    }, 30000);

    updateStatus('connected');
    log(`Connected to room ${CONFIG.roomCode} (region: ${currentRegion})`);
}

function onMessage(event) {
    try {
        const data = JSON.parse(event.data);
        handleMessage(data);
    } catch (err) {
        log(`Failed to parse message: ${err.message}`, 'error');
    }
}

function handleMessage(data) {
    logWS('📨', data);

    switch (data.type) {
        case 'auth-success':
            log('Authentication successful');
            break;

        case 'auth-error':
            log('Authentication failed: ' + (data.message || 'Invalid API key'), 'error');
            break;

        case 'room-state':
            handleRoomState(data);
            break;

        case 'state-updated':
            handleStateUpdate(data);
            break;

        case 'chat-message':
            handleChatMessage(data);
            break;

        case 'roll-result':
            handleRollResult(data);
            break;

        case 'client-joined':
            handleClientJoined(data);
            break;

        case 'client-left':
            handleClientLeft(data);
            break;

        case 'voice-status':
            handleVoiceStatus(data);
            break;

        case 'vtt-state-updated':
            handleVttStateUpdate(data);
            break;

        case 'vtt-characters-updated':
            handleVttCharactersUpdate(data);
            break;

        case 'vtt-timers-updated':
            handleVttTimersUpdate(data);
            break;

        // New Deck Events
        case 'deck-drawn':
            handleDeckDrawn(data);
            break;

        case 'deck-shuffled':
            handleDeckShuffled(data);
            break;

        case 'crown-spread':
            handleCrownSpread(data);
            break;

        // New Module Events
        case 'module-list':
            handleModuleList(data);
            break;

        case 'module-push':
            handleModulePush(data);
            break;

        case 'module-cleanup':
            handleModuleCleanup(data);
            break;

        case 'region-updated':
            handleRegionUpdate(data);
            break;

        case 'room-closed':
            log('Room closed by server', 'warn');
            disconnect();
            break;

        case 'pong':
            // Heartbeat response - ignore
            break;

        default:
            log(`Unhandled message type: ${data.type}`);
    }
}

function onError(error) {
    log(`WebSocket error: ${error.message || 'Unknown error'}`, 'error');
    scheduleReconnect();
}

function onClose(event) {
    log(`WebSocket closed: ${event.code} - ${event.reason || 'No reason'}`);
    connected = false;
    clientId = null;

    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    updateStatus('disconnected');

    if (event.code !== 1000) {
        scheduleReconnect();
    }
}

// ============================================================
// Message Handlers
// ============================================================

function handleRoomState(data) {
    log(`Room state received. Client ID: ${data.clientId}`);
    clientId = data.clientId;

    if (data.data && data.data.vtt) {
        syncVttState(data.data.vtt);
    }

    if (data.data && data.data.deck) {
        deckState.cards = data.data.deck.cards || [];
        deckState.history = data.data.deck.history || [];
        deckState.remaining = data.data.deck.cards?.length || 0;
    }

    // Log clients
    if (data.clients) {
        const names = data.clients.map(c => c.data?.name || 'Unknown').join(', ');
        log(`Clients in room: ${names}`);
    }

    // Send region info
    sendMessage({
        type: 'set-region',
        region: currentRegion
    });
}

function handleStateUpdate(data) {
    log('State updated');
    if (data.state && data.state.vtt) {
        syncVttState(data.state.vtt);
    }
    if (data.state && data.state.deck) {
        deckState.cards = data.state.deck.cards || [];
        deckState.remaining = data.state.deck.cards?.length || 0;
    }
}

function handleChatMessage(data) {
    log(`💬 ${data.sender}: ${data.text}`);

    if (CONFIG.syncChat) {
        const msg = `[Fate's Edge] ${data.sender}: ${data.text}`;
        sendToChat(msg);

        if (data.sender !== getPlayerName()) {
            sendToChat(`⚠️ ${data.sender} says: ${data.text}`, 'gm');
        }
    }
}

function handleRollResult(data) {
    log(`🎲 ${data.sender} rolled: ${data.expr || 'Dice'}`);

    if (CONFIG.syncRolls) {
        let resultText = data.result;
        if (data.rolls && data.rolls.length > 0) {
            resultText = `${data.rolls.join(' + ')} = ${data.total}`;
        }

        const msg = `🎲 ${data.sender} rolled:\n${data.expr || 'Dice Roll'}\n**Result:** ${resultText}`;
        sendToChat(msg);
    }
}

function handleClientJoined(data) {
    const name = data.data?.name || 'Unknown';
    log(`👤 ${name} joined the room`);
    sendToChat(`👤 ${name} has joined the Fate's Edge session.`);
}

function handleClientLeft(data) {
    log(`👤 Client left: ${data}`);
    sendToChat(`👤 A client has left the Fate's Edge session.`);
}

function handleVoiceStatus(data) {
    log(`🎤 Voice status: ${data.name} ${data.enabled ? 'enabled' : 'disabled'}`);
    updateVoiceUI(data);
}

function handleVttStateUpdate(data) {
    log('VTT state update');
    if (data.vtt) {
        syncVttState(data.vtt);
    }
}

function handleVttCharactersUpdate(data) {
    log(`👥 Characters update: ${data.characters?.length || 0} characters`);
    if (data.characters) {
        syncCharacters(data.characters);
    }
}

function handleVttTimersUpdate(data) {
    log(`⏱️ Timers update: ${data.timers?.length || 0} timers`);
    if (data.timers) {
        syncTimers(data.timers);
    }
}

// ============================================================
// Deck Handlers
// ============================================================

function handleDeckDrawn(data) {
    const cards = data.cards || [];
    const synthesis = data.synthesis || '';
    const region = data.region || currentRegion;
    const count = cards.length;

    deckState.cards = deckState.cards || [];
    deckState.remaining = data.remaining || (deckState.cards.length);

    log(`🃏 ${count} card${count > 1 ? 's' : ''} drawn from ${region}`);

    if (CONFIG.syncDeck) {
        const cardNames = cards.map(c => {
            if (c.is_joker) return '🃏 Joker';
            return `${c.rank_name || c.rank} of ${c.suit_name || c.suit}`;
        }).join(', ');

        const msg = `🃏 **${count} card${count > 1 ? 's' : ''} drawn from ${region}**\n${cardNames}\n\n${synthesis}`;
        sendToChat(msg);

        // Create a handout with the draw results
        createDeckHandout(`Deck Draw - ${region}`, msg);
    }
}

function handleDeckShuffled(data) {
    deckState.cards = [];
    deckState.history = [];
    deckState.remaining = data.remaining || 54;

    log(`🔀 Deck shuffled (${deckState.remaining} cards remaining)`);

    if (CONFIG.syncDeck) {
        sendToChat(`🔀 The Deck of Consequences has been shuffled. ${deckState.remaining} cards remaining.`);
    }
}

function handleCrownSpread(data) {
    const result = data.result || {};
    const cards = data.cards || [];
    const region = data.region || currentRegion;

    log(`👑 Crown Spread from ${region}`);

    if (CONFIG.syncDeck) {
        let msg = `👑 **Crown Spread from ${region}**\n\n`;
        msg += `🌱 **Root:** ${result.positions?.[0]?.meaning || '...'}\n`;
        msg += `🏔️ **Crest:** ${result.positions?.[1]?.meaning || '...'}\n`;
        msg += `👑 **Crown:** ${result.positions?.[2]?.meaning || '...'}\n`;
        msg += `🤝 **Left Hand:** ${result.positions?.[3]?.meaning || '...'}\n`;
        msg += `🌟 **Wildcard:** ${result.wildcard || '...'}`;

        sendToChat(msg);

        // Create a handout with the Crown Spread
        createDeckHandout(`Crown Spread - ${region}`, msg);
    }
}

function createDeckHandout(title, content) {
    try {
        // In Roll20, create a journal entry (handout)
        if (typeof Campaign !== 'undefined' && Campaign.createJournalEntry) {
            Campaign.createJournalEntry({
                name: title,
                content: content.replace(/\n/g, '<br>'),
                gm: false,
                players: true
            });
            log(`📄 Created handout: ${title}`);
        }
    } catch (err) {
        log(`Failed to create handout: ${err.message}`, 'warn');
    }
}

// ============================================================
// Module Handlers
// ============================================================

function handleModuleList(data) {
    loadedModules = data.modules || [];
    log(`📦 ${loadedModules.length} modules loaded`);

    if (loadedModules.length > 0) {
        const names = loadedModules.map(m => m.name || m.id).join(', ');
        sendToChat(`📦 Modules loaded: ${names}`);
    }
}

function handleModulePush(data) {
    const module = data.module || {};
    const name = module.manifest?.name || module.id || 'Unknown';
    log(`📦 Module pushed: ${name}`);
    sendToChat(`📦 Module pushed: ${name}`);
}

function handleModuleCleanup(data) {
    const moduleId = data.moduleId || 'Unknown';
    log(`🧹 Module cleanup: ${moduleId}`);
    sendToChat(`🧹 Module cleanup requested: ${moduleId}`);
}

function handleRegionUpdate(data) {
    if (data.region) {
        currentRegion = data.region;
        log(`📍 Region updated to: ${currentRegion}`);
        sendToChat(`📍 Region updated to: ${currentRegion}`);
    }
}

// ============================================================
// Sync Functions
// ============================================================

function syncVttState(vttState) {
    if (!vttState) return;

    if (vttState.characters) {
        syncCharacters(vttState.characters);
    }

    if (vttState.timers) {
        syncTimers(vttState.timers);
    }

    if (vttState.scene && CONFIG.syncScenes) {
        syncScene(vttState.scene);
    }
}

function syncCharacters(characters) {
    if (!CONFIG.syncCharacters) return;

    vttCharacters.clear();
    characters.forEach(char => {
        vttCharacters.set(char.name || 'Unknown', char);
    });

    if (typeof Campaign !== 'undefined' && Campaign.characters) {
        Campaign.characters.forEach(roll20Char => {
            const vttChar = vttCharacters.get(roll20Char.name);
            if (vttChar) {
                updateCharacterSheet(roll20Char, vttChar);
            }
        });
    }

    characters.forEach(char => {
        createOrUpdateJournalEntry(char);
    });
}

function updateCharacterSheet(roll20Char, vttChar) {
    const attributes = [
        { name: 'harm', value: vttChar.harm || 0 },
        { name: 'fatigue', value: vttChar.fatigue || 0 },
        { name: 'boons', value: vttChar.boons || 0 },
        { name: 'tier', value: vttChar.tier || 1 }
    ];

    if (roll20Char.set) {
        attributes.forEach(attr => {
            roll20Char.set(attr.name, attr.value);
        });
        log(`Updated character: ${roll20Char.name}`);
    }
}

function createOrUpdateJournalEntry(char) {
    const name = char.name || 'Unnamed';
    const content = `
        <h2>${name}</h2>
        <p><b>Harm:</b> ${char.harm || 0}</p>
        <p><b>Fatigue:</b> ${char.fatigue || 0}</p>
        <p><b>Boons:</b> ${char.boons || 0}</p>
        ${char.tier ? `<p><b>Tier:</b> ${char.tier}</p>` : ''}
        ${char.description ? `<p><i>${char.description}</i></p>` : ''}
        <hr>
        <p><small>Synced from Fate's Edge VTT v1.2.0</small></p>
    `;

    // Try to find existing journal entry
    try {
        if (typeof Campaign !== 'undefined' && Campaign.findJournalEntry) {
            const existing = Campaign.findJournalEntry(name);
            if (existing) {
                existing.set('content', content);
                log(`Updated journal entry: ${name}`);
            } else if (Campaign.createJournalEntry) {
                Campaign.createJournalEntry({
                    name: name,
                    content: content,
                    gm: false,
                    players: true
                });
                log(`Created journal entry: ${name}`);
            }
        }
    } catch (err) {
        log(`Failed to update journal: ${err.message}`, 'warn');
    }
}

function syncTimers(timers) {
    if (!CONFIG.syncTimers) return;

    vttTimers.length = 0;
    vttTimers.push(...timers);

    timers.forEach(timer => {
        const progress = ((timer.current || 0) / (timer.segments || 1) * 100);
        const bar = '▰'.repeat(Math.floor(progress / 10)) + '▱'.repeat(10 - Math.floor(progress / 10));
        const status = (timer.current || 0) >= (timer.segments || 1) ? '⚠️ COMPLETE' : '⏳ Active';
        sendToChat(`⏱️ **${timer.name}** [${bar}] ${timer.current}/${timer.segments} - ${status}`);
    });
}

function syncScene(sceneData) {
    if (!CONFIG.syncScenes) return;

    if (sceneData.name) {
        if (typeof Campaign !== 'undefined' && Campaign.setCurrentPage) {
            const pages = Campaign.pages;
            const match = pages.find(p => p.name === sceneData.name);
            if (match) {
                Campaign.setCurrentPage(match.id);
                log(`Switched to page: ${sceneData.name}`);
                sendToChat(`🎬 Switched to page: ${sceneData.name}`);
            } else {
                log(`Page not found: ${sceneData.name}`, 'warn');
            }
        }
    }
}

// ============================================================
// Send Functions
// ============================================================

function sendMessage(data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        log('Not connected - message not sent', 'warn');
        return;
    }

    if (CONFIG.apiKey && !data.apiKey) {
        data.apiKey = CONFIG.apiKey;
    }

    try {
        ws.send(JSON.stringify(data));
        logWS('📤', data);
    } catch (err) {
        log(`Failed to send message: ${err.message}`, 'error');
    }
}

function sendChatMessage(text) {
    if (!text) return;

    sendMessage({
        type: 'chat-message',
        text: text,
        sender: getPlayerName(),
        timestamp: Date.now()
    });
}

function sendRoll(expr, reason = null) {
    if (!expr) return;

    try {
        const roll = new Roll(expr);
        const total = roll.total;
        const rolls = roll.rolls;

        sendMessage({
            type: 'roll-dice',
            expr: expr,
            result: total,
            rolls: rolls,
            total: total,
            reason: reason || 'Dice roll',
            sender: getPlayerName(),
            timestamp: Date.now()
        });
    } catch (err) {
        log(`Failed to roll: ${err.message}`, 'error');
    }
}

// ============================================================
// New: Deck Send Functions
// ============================================================

function sendDeckDraw(count = 1, region = null) {
    const regionName = region || currentRegion;
    sendMessage({
        type: 'deck-draw',
        count: Math.min(count, 5),
        region: regionName
    });
    log(`🃏 Drawing ${count} card${count > 1 ? 's' : ''} from ${regionName}`);
}

function sendCrownSpread(region = null) {
    const regionName = region || currentRegion;
    sendMessage({
        type: 'deck-draw',
        count: 5,
        region: regionName
    });
    log(`👑 Crown Spread from ${regionName}`);
}

function sendDeckShuffle() {
    sendMessage({
        type: 'deck-shuffle'
    });
    log('🔀 Deck shuffle requested');
}

function sendRegionUpdate(region) {
    currentRegion = region;
    sendMessage({
        type: 'set-region',
        region: region
    });
    log(`📍 Region updated to: ${region}`);
}

function sendModuleList() {
    sendMessage({
        type: 'module-list'
    });
    log('📦 Module list requested');
}

// ============================================================
// Utility Functions
// ============================================================

function getPlayerName() {
    if (CONFIG.playerName) {
        return CONFIG.playerName;
    }
    try {
        if (typeof User !== 'undefined' && User.getActivePlayer) {
            const player = User.getActivePlayer();
            if (player && player.name) {
                return player.name;
            }
        }
    } catch (err) {
        // Ignore
    }
    return 'Roll20 GM';
}

function sendToChat(message, type = 'public') {
    if (typeof sendChat !== 'undefined') {
        if (type === 'gm') {
            sendChat('GM', message);
        } else {
            sendChat('Fate\'s Edge', message);
        }
    } else {
        console.log(`[CHAT] ${message}`);
    }
}

function updateStatus(status) {
    const statusMsg = status === 'connected' 
        ? '🟢 Connected to Fate\'s Edge v1.2.0' 
        : '🔴 Disconnected from Fate\'s Edge';
    log(statusMsg);
}

function updateVoiceUI(data) {
    const status = data.enabled ? '🎤 Voice On' : '🎤 Voice Off';
    log(`Voice: ${data.name} - ${status}`);
}

// ============================================================
// API Commands for Roll20 Macros (Updated)
// ============================================================

function registerCommands() {
    on('ready', () => {
        if (CONFIG.autoConnect) {
            connect();
        }

        on('chat:message', (msg) => {
            if (msg.type !== 'api') return;
            const args = msg.content.split(' ');

            if (args[0] === '!fates-edge') {
                const command = args[1] || '';
                const param = args.slice(2).join(' ');

                switch (command) {
                    case 'connect':
                        connect();
                        sendToChat('Connecting to Fate\'s Edge...');
                        break;

                    case 'disconnect':
                        disconnect();
                        sendToChat('Disconnected from Fate\'s Edge.');
                        break;

                    case 'status':
                        const status = connected ? '🟢 Connected' : '🔴 Disconnected';
                        sendToChat(`Fate's Edge status: ${status}`);
                        sendToChat(`Region: ${currentRegion}`);
                        sendToChat(`Deck: ${deckState.remaining} cards remaining`);
                        sendToChat(`Modules: ${loadedModules.length} loaded`);
                        break;

                    case 'send':
                        if (param) {
                            sendChatMessage(param);
                            sendToChat(`📤 Sent: ${param}`);
                        }
                        break;

                    case 'roll':
                        if (param) {
                            const rollResult = parseDiceExpression(param);
                            sendRoll(param);
                            sendToChat(`🎲 Rolled: ${param} = ${rollResult.total}`);
                        }
                        break;

                    // New Commands
                    case 'draw':
                        const count = parseInt(param) || 1;
                        sendDeckDraw(Math.min(count, 5));
                        sendToChat(`🃏 Drawing ${Math.min(count, 5)} cards...`);
                        break;

                    case 'crown':
                        sendCrownSpread(param || currentRegion);
                        sendToChat(`👑 Crown Spread from ${param || currentRegion}...`);
                        break;

                    case 'shuffle':
                        sendDeckShuffle();
                        sendToChat('🔀 Shuffling deck...');
                        break;

                    case 'region':
                        if (param) {
                            sendRegionUpdate(param);
                            sendToChat(`📍 Region set to: ${param}`);
                        } else {
                            sendToChat(`📍 Current region: ${currentRegion}`);
                        }
                        break;

                    case 'modules':
                        if (param === 'list') {
                            sendModuleList();
                            sendToChat('📦 Requesting module list...');
                        }
                        break;

                    case 'sync':
                        if (param === 'characters') {
                            const chars = collectCharacters();
                            syncCharacters(chars);
                            sendToChat(`📤 Synced ${chars.length} characters`);
                        } else if (param === 'scene') {
                            syncScene({ name: Campaign.currentPage.name });
                            sendToChat(`🎬 Synced scene: ${Campaign.currentPage.name}`);
                        }
                        break;

                    default:
                        sendToChat(`
                            Fate's Edge v1.2.0 Commands:
                            !fates-edge connect - Connect to server
                            !fates-edge disconnect - Disconnect
                            !fates-edge status - Show status
                            !fates-edge send <message> - Send chat
                            !fates-edge roll <dice> - Roll dice
                            !fates-edge draw [N] - Draw N cards (1-5)
                            !fates-edge crown [region] - Crown Spread
                            !fates-edge shuffle - Shuffle deck
                            !fates-edge region [name] - Set/get region
                            !fates-edge modules list - List modules
                            !fates-edge sync characters - Sync characters
                            !fates-edge sync scene - Sync current scene
                        `);
                }
            }
        });
    });
}

function collectCharacters() {
    const characters = [];
    try {
        if (typeof Campaign !== 'undefined' && Campaign.characters) {
            Campaign.characters.forEach(char => {
                characters.push({
                    name: char.name,
                    harm: char.get('harm') || 0,
                    fatigue: char.get('fatigue') || 0,
                    boons: char.get('boons') || 0,
                    tier: char.get('tier') || 1
                });
            });
        }
    } catch (err) {
        log(`Failed to collect characters: ${err.message}`, 'error');
    }
    return characters;
}

function parseDiceExpression(expr) {
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

// ============================================================
// Roll20 Hooks (Updated)
// ============================================================

try {
    // Chat message hook
    on('chat:message', (msg) => {
        if (msg.type !== 'general') return;
        if (!CONFIG.syncChat) return;
        if (msg.who === 'Fate\'s Edge') return;

        let text = msg.content;
        text = text.replace(/<[^>]+>/g, '');
        text = text.replace(/^Fate's Edge:\s*/, '');
        if (!text.trim()) return;

        sendChatMessage(text.trim());
    });

    // Dice roll hook
    on('chat:message', (msg) => {
        if (msg.type !== 'rollresult') return;
        if (!CONFIG.syncRolls) return;

        const content = msg.content;
        const match = content.match(/<div[^>]*>(.*?)<\/div>/i);
        if (match) {
            const text = match[1].replace(/<[^>]+>/g, '').trim();
            const rollMatch = text.match(/\[\[([^\]]+)\]\]/);
            if (rollMatch) {
                const expr = rollMatch[1];
                sendRoll(expr);
            }
        }
    });

    // Page change hook
    if (typeof on === 'function') {
        on('change:campaign:currentpage', () => {
            if (!CONFIG.syncScenes) return;
            try {
                const page = Campaign.currentPage;
                if (page && page.name) {
                    syncScene({ name: page.name });
                }
            } catch (err) {
                log(`Failed to sync scene: ${err.message}`, 'error');
            }
        });
    }

} catch (err) {
    log(`Failed to register hooks: ${err.message}`, 'error');
}

// ============================================================
// Initialize
// ============================================================

// Register commands
registerCommands();

log('Fate\'s Edge Roll20 API module v1.2.0 loaded');
log(`Server: ${CONFIG.serverUrl}`);
log(`Room: ${CONFIG.roomCode}`);
log(`Region: ${currentRegion}`);
log(`Auto-connect: ${CONFIG.autoConnect}`);

if (CONFIG.autoConnect) {
    connect();
}