/**
 * Fate's Edge Roll20 API Module v2.0.0
 * Connects Roll20 to the Fate's Edge WebSocket Server
 * 
 * Features:
 * - Real-time chat sync
 * - Dice roll sync
 * - Character sync (full attributes, skills, avatar)
 * - Timer sync
 * - Scene sync (via Roll20 page switching)
 * - Presence/voice indicators
 * - Auto-reconnect
 * - Deck of Consequences (draw, shuffle, crown spread)
 * - Region support
 * - Module management
 * - GM election & promotion
 * - Whiteboard summary (drawings, notes, images)
 * - Grid combat status (tokens, zones)
 * 
 * Installation:
 * 1. In Roll20, go to Settings → API Scripts
 * 2. Paste this script
 * 3. Set environment variables in Roll20 API:
 *    - FATES_EDGE_SERVER_URL: ws://your-server:10000
 *    - FATES_EDGE_ROOM_CODE: ABC123
 *    - FATES_EDGE_PLAYER_NAME: Optional (defaults to Roll20 display name)
 *    - FATES_EDGE_API_KEY: Your API key (if required)
 *    - FATES_EDGE_AUTO_CONNECT: true/false
 *    - FATES_EDGE_DEFAULT_REGION: Acasia
 */

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
    serverUrl: getConfigVar('FATES_EDGE_SERVER_URL', 'ws://localhost:10000'),
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
    defaultRegion: getConfigVar('FATES_EDGE_DEFAULT_REGION', 'Acasia'),
    password: getConfigVar('FATES_EDGE_ROOM_PASSWORD', '')  // optional room password
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

// VTT state
const vttCharacters = new Map();        // name -> full character object
const vttTimers = [];
const deckState = {
    cards: [],
    history: [],
    offset: 0,
    remaining: 54
};
let currentRegion = CONFIG.defaultRegion;
let loadedModules = [];
let whiteboard = { drawings: [], notes: [], images: [] };
let gridCombat = { enabled: false, tokens: [], gridType: 'square' };

// GM State
let clients = {};           // clientId -> { id, name, role, ... }
let gmId = null;            // clientId of current GM
let pendingRequests = [];   // [ { requesterId, requesterName }, ... ]
let myRole = 'player';      // role of this Roll20 client

// ============================================================
// Logging
// ============================================================

function log(message, level = 'info') {
    const prefix = '⚔️ Fate\'s Edge v2.0.0:';
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
        const wsUrl = `${CONFIG.serverUrl}?room=${encodeURIComponent(CONFIG.roomCode)}`;
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
        } catch (err) { /* ignore */ }
        ws = null;
    }

    connected = false;
    clientId = null;
    reconnectAttempts = 0;
    clients = {};
    gmId = null;
    pendingRequests = [];
    myRole = 'player';
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

    // Send handshake (plain WebSocket protocol)
    const playerName = getPlayerName();
    sendMessage({
        type: 'handshake',
        clientName: playerName,
        role: 'gm',   // Roll20 is typically GM
        password: CONFIG.password || ''
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
        case 'connected':
            // Server sends initial connected message; ignore
            break;

        case 'handshake_ack':
            handleHandshakeAck(data);
            break;

        case 'room-state':
            handleRoomState(data);
            break;

        case 'state-updated':
            handleStateUpdated(data);
            break;

        case 'sync-state':
            handleSyncState(data);
            break;

        case 'chat-message':
            handleChatMessage(data);
            break;

        case 'roll-result':
            handleRollResult(data);
            break;

        case 'player-joined':
            handlePlayerJoined(data);
            break;

        case 'player-left':
            handlePlayerLeft(data);
            break;

        // Deck Events
        case 'deck-drawn':
            handleDeckDrawn(data);
            break;

        case 'deck-shuffled':
            handleDeckShuffled(data);
            break;

        case 'deck-history':
            handleDeckHistory(data);
            break;

        case 'deck-history-cleared':
            handleDeckHistoryCleared(data);
            break;

        case 'crown-spread':
            handleCrownSpread(data);
            break;

        // Module Events
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
            handleRegionUpdated(data);
            break;

        // Whiteboard
        case 'whiteboard-update':
            handleWhiteboardUpdate(data);
            break;

        // Character updates
        case 'character-update':
            handleCharacterUpdate(data);
            break;

        case 'character-update-bulk':
            handleCharacterUpdateBulk(data);
            break;

        // GM Events
        case 'presence':
            handlePresence(data);
            break;

        case 'gm_vote_request':
            handleGmVoteRequest(data);
            break;

        case 'gm_role_update':
            handleGmRoleUpdate(data);
            break;

        case 'server_announcement':
            handleServerAnnouncement(data);
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

function handleHandshakeAck(data) {
    clientId = data.clientId;
    myRole = data.clientRole || 'player';
    log(`✅ Handshake successful. Client ID: ${clientId}, Role: ${myRole}`);

    if (data.activeClients) {
        updateClients(data.activeClients);
        const names = data.activeClients.map(c => c.name).join(', ');
        log(`Clients in room: ${names}`);
    }

    // Send region info
    sendMessage({
        type: 'set-region',
        region: currentRegion
    });

    // Sync characters if any exist locally
    if (CONFIG.syncCharacters) {
        const chars = collectCharacters();
        if (chars.length > 0) {
            syncCharacters(chars);
        }
    }
}

function handleRoomState(data) {
    log('📦 Room state received');
    if (data.characters) {
        updateCharacters(data.characters);
    }
    if (data.whiteboard) {
        whiteboard = data.whiteboard;
        if (whiteboard.gridCombat) {
            gridCombat = whiteboard.gridCombat;
        }
    }
    if (data.deckRemaining !== undefined) {
        deckState.remaining = data.deckRemaining;
    }
    if (data.region) {
        currentRegion = data.region;
    }
    if (data.clients) {
        updateClients(data.clients);
    }
    // Update UI
    updateGMUI();
}

function handleStateUpdated(data) {
    if (data.characters) {
        updateCharacters(data.characters);
    }
    if (data.timers) {
        updateTimers(data.timers);
    }
    log('State updated');
}

function handleSyncState(data) {
    const state = data.state || {};
    if (state.characters) {
        updateCharacters(state.characters);
    }
    if (state.whiteboard) {
        whiteboard = state.whiteboard;
        if (whiteboard.gridCombat) {
            gridCombat = whiteboard.gridCombat;
        }
    }
    if (state.timers) {
        updateTimers(state.timers);
    }
    log('Sync state received');
}

function handleChatMessage(data) {
    log(`💬 ${data.sender}: ${data.text}`);
    if (CONFIG.syncChat) {
        sendToChat(`[Fate's Edge] ${data.sender}: ${data.text}`);
    }
}

function handleRollResult(data) {
    log(`🎲 ${data.sender} rolled: ${data.expr || 'Dice'}`);
    if (CONFIG.syncRolls) {
        let resultText = data.result;
        if (data.rolls && data.rolls.length > 0) {
            resultText = `${data.rolls.join(' + ')} = ${data.total}`;
        }
        sendToChat(`🎲 ${data.sender} rolled **${data.expr}**: ${resultText}`);
    }
}

function handlePlayerJoined(data) {
    if (data.clients) {
        updateClients(data.clients);
        const name = data.clientName || 'Unknown';
        log(`👤 ${name} joined`);
        sendToChat(`👤 ${name} has joined the Fate's Edge session.`);
    }
}

function handlePlayerLeft(data) {
    if (data.clientId) {
        delete clients[data.clientId];
        if (gmId === data.clientId) {
            gmId = null;
            updateGmFromClients();
        }
    }
    if (data.clients) {
        updateClients(data.clients);
    }
    const name = data.clientName || 'Unknown';
    log(`👤 ${name} left`);
    sendToChat(`👤 ${name} has left the Fate's Edge session.`);
    updateGMUI();
}

// ============================================================
// Deck Handlers
// ============================================================

function handleDeckDrawn(data) {
    const cards = data.cards || [];
    const synthesis = data.synthesis || '';
    const region = data.region || currentRegion;
    deckState.cards = cards;
    deckState.remaining = data.remaining || 0;

    log(`🃏 ${cards.length} card(s) drawn from ${region}`);

    if (CONFIG.syncDeck) {
        const cardNames = cards.map(c => {
            if (c.is_joker) return '🃏 Joker';
            return `${c.rank_name || c.rank} of ${c.suit_name || c.suit}`;
        }).join(', ');

        let msg = `🃏 **${cards.length} card(s) drawn from ${region}**\n`;
        msg += `${cardNames}\n\n`;
        msg += synthesis;
        sendToChat(msg);
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

function handleDeckHistory(data) {
    const history = data.history || [];
    deckState.history = history;
    log(`📜 Deck history: ${history.length} entries`);
}

function handleDeckHistoryCleared(data) {
    deckState.history = [];
    log('🗑️ Deck history cleared');
    if (CONFIG.syncDeck) {
        sendToChat('🗑️ Deck history has been cleared.');
    }
}

function handleCrownSpread(data) {
    const cards = data.cards || [];
    const result = data.result || {};
    const region = data.region || currentRegion;

    log(`👑 Crown Spread from ${region}`);

    if (CONFIG.syncDeck) {
        let msg = `👑 **Crown Spread from ${region}**\n\n`;
        if (result.positions) {
            result.positions.forEach(p => {
                msg += `${p.icon} **${p.label}:** ${p.meaning}\n`;
            });
        }
        if (result.wildcard) {
            msg += `\n🌟 **Wildcard:** ${result.wildcard}`;
        }
        sendToChat(msg);
        createDeckHandout(`Crown Spread - ${region}`, msg);
    }
}

function createDeckHandout(title, content) {
    try {
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

function handleRegionUpdated(data) {
    if (data.region) {
        currentRegion = data.region;
        log(`📍 Region updated to: ${currentRegion}`);
        sendToChat(`📍 Region updated to: ${currentRegion}`);
    }
}

// ============================================================
// Whiteboard & Grid Combat Handlers
// ============================================================

function handleWhiteboardUpdate(data) {
    if (data.whiteboard) {
        whiteboard = data.whiteboard;
        if (whiteboard.gridCombat) {
            gridCombat = whiteboard.gridCombat;
        }
        log(`📋 Whiteboard updated: ${whiteboard.drawings?.length || 0} drawings, ${whiteboard.notes?.length || 0} notes, ${whiteboard.images?.length || 0} images`);
        if (gridCombat.enabled) {
            log(`⚔️ Grid combat: ${gridCombat.gridType}, ${gridCombat.tokens?.length || 0} tokens`);
        }
    }
}

// ============================================================
// Character Handlers
// ============================================================

function updateCharacters(charactersArray) {
    vttCharacters.clear();
    charactersArray.forEach(c => {
        if (c.name) {
            vttCharacters.set(c.name, c);
        }
    });
    log(`👥 ${vttCharacters.size} characters synced`);

    if (CONFIG.syncCharacters) {
        syncToRoll20Characters();
    }
}

function handleCharacterUpdate(data) {
    if (data.name && data.field !== undefined) {
        let char = vttCharacters.get(data.name);
        if (!char) {
            char = { name: data.name };
            vttCharacters.set(data.name, char);
        }
        char[data.field] = data.value;
        log(`⚡ ${data.name}.${data.field} = ${data.value}`);
        if (CONFIG.syncCharacters) {
            syncToRoll20Characters();
        }
    }
}

function handleCharacterUpdateBulk(data) {
    if (data.updates) {
        Object.entries(data.updates).forEach(([name, fields]) => {
            let char = vttCharacters.get(name);
            if (!char) {
                char = { name };
                vttCharacters.set(name, char);
            }
            Object.assign(char, fields);
        });
        log(`📋 Bulk update: ${Object.keys(data.updates).length} characters`);
        if (CONFIG.syncCharacters) {
            syncToRoll20Characters();
        }
    }
}

function syncToRoll20Characters() {
    // Update Roll20 character sheets
    if (typeof Campaign !== 'undefined' && Campaign.characters) {
        Campaign.characters.forEach(roll20Char => {
            const vttChar = vttCharacters.get(roll20Char.name);
            if (vttChar) {
                updateCharacterSheet(roll20Char, vttChar);
            }
        });
    }

    // Update journal entries
    for (const [name, char] of vttCharacters) {
        createOrUpdateJournalEntry(char);
    }
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
        log(`Updated character sheet: ${roll20Char.name}`);
    }
}

function createOrUpdateJournalEntry(char) {
    const name = char.name || 'Unnamed';
    let content = `
        <h2>${name}</h2>
        <p><b>Harm:</b> ${char.harm || 0}</p>
        <p><b>Fatigue:</b> ${char.fatigue || 0}</p>
        <p><b>Boons:</b> ${char.boons || 0}</p>
        ${char.tier ? `<p><b>Tier:</b> ${char.tier}</p>` : ''}
    `;
    if (char.attributes) {
        content += `<p><b>Attributes:</b> ${Object.entries(char.attributes).map(([k,v]) => `${k}: ${v}`).join(', ')}</p>`;
    }
    if (char.skills) {
        content += `<p><b>Skills:</b> ${Object.entries(char.skills).map(([k,v]) => `${k}: ${v}`).join(', ')}</p>`;
    }
    if (char.heritage) {
        content += `<p><b>Heritage:</b> ${char.heritage}</p>`;
    }
    if (char.background) {
        content += `<p><b>Background:</b> ${char.background}</p>`;
    }
    if (char.patron) {
        content += `<p><b>Patron:</b> ${char.patron}</p>`;
    }
    content += `<hr><p><small>Synced from Fate's Edge VTT v2.0.0</small></p>`;

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

// ============================================================
// Timer Handlers
// ============================================================

function updateTimers(timers) {
    vttTimers.length = 0;
    vttTimers.push(...timers);
    if (CONFIG.syncTimers) {
        timers.forEach(timer => {
            const progress = ((timer.current || 0) / (timer.segments || 1) * 100);
            const bar = '▰'.repeat(Math.floor(progress / 10)) + '▱'.repeat(10 - Math.floor(progress / 10));
            const status = (timer.current || 0) >= (timer.segments || 1) ? '⚠️ COMPLETE' : '⏳ Active';
            sendToChat(`⏱️ **${timer.name}** [${bar}] ${timer.current}/${timer.segments} - ${status}`);
        });
    }
}

// ============================================================
// GM Handlers
// ============================================================

function handlePresence(data) {
    if (data.clients) {
        updateClients(data.clients);
        updateGMUI();
    }
}

function handleGmVoteRequest(data) {
    const { requesterId, requesterName, currentGmId, currentGmName } = data;
    if (myRole === 'gm' && clientId === currentGmId) {
        if (!pendingRequests.find(r => r.requesterId === requesterId)) {
            pendingRequests.push({ requesterId, requesterName });
        }
        updateGMUI();
        sendToChat(`👑 ${requesterName} requests to become GM. Use !fates-edge gm approve <name> or !fates-edge gm reject <name>`, 'gm');
    }
}

function handleGmRoleUpdate(data) {
    const { clientId: targetId, role } = data;
    if (targetId === clientId) {
        myRole = role;
    }
    if (clients[targetId]) {
        clients[targetId].role = role;
    }
    if (role === 'gm') {
        gmId = targetId;
    } else if (gmId === targetId) {
        updateGmFromClients();
    }
    updateGMUI();
    const name = clients[targetId]?.name || targetId;
    sendToChat(`👑 ${name} is now ${role.toUpperCase()}.`);
}

function handleServerAnnouncement(data) {
    sendToChat(`📢 ${data.message}`);
}

// ============================================================
// Client & GM Helpers
// ============================================================

function updateClients(clientsArray) {
    clients = {};
    clientsArray.forEach(c => {
        clients[c.id] = c;
        if (c.role === 'gm') gmId = c.id;
    });
    if (!clientsArray.some(c => c.role === 'gm')) {
        gmId = null;
    }
    if (clientId && clients[clientId]) {
        myRole = clients[clientId].role;
    }
}

function updateGmFromClients() {
    for (let id in clients) {
        if (clients[id].role === 'gm') {
            gmId = id;
            return;
        }
    }
    gmId = null;
}

function updateGMUI() {
    if (typeof state !== 'undefined') {
        state.set('fatesEdgeGmId', gmId);
        state.set('fatesEdgeMyRole', myRole);
        state.set('fatesEdgePendingRequests', pendingRequests);
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
    sendMessage({
        type: 'roll-dice',
        expr: expr,
        sender: getPlayerName(),
        reason: reason || 'Dice roll',
        timestamp: Date.now()
    });
}

function sendDeckDraw(count = 1, region = null) {
    const regionName = region || currentRegion;
    sendMessage({
        type: 'deck-draw',
        count: Math.min(count, 5),
        region: regionName
    });
    log(`🃏 Drawing ${count} card(s) from ${regionName}`);
}

function sendCrownSpread(region = null) {
    const regionName = region || currentRegion;
    sendMessage({
        type: 'crown-spread',
        region: regionName
    });
    log(`👑 Crown Spread from ${regionName}`);
}

function sendDeckShuffle() {
    sendMessage({ type: 'deck-shuffle' });
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
    sendMessage({ type: 'module-list' });
    log('📦 Module list requested');
}

function sendSyncRequest(entity = 'all') {
    sendMessage({ type: 'sync-request', entity });
}

function syncCharacters(characters) {
    sendMessage({
        type: 'state-updated',
        characters: characters
    });
}

// ============================================================
// GM Public Methods
// ============================================================

function requestGM() {
    if (!connected) {
        log('Not connected - cannot request GM', 'error');
        return;
    }
    sendMessage({ type: 'request_gm' });
    sendToChat('👑 GM request sent. Waiting for approval.');
}

function approveGM(targetId) {
    if (!connected) {
        log('Not connected - cannot approve GM', 'error');
        return;
    }
    if (myRole !== 'gm') {
        log('Only current GM can approve', 'error');
        return;
    }
    sendMessage({ type: 'approve_gm', targetId });
    pendingRequests = pendingRequests.filter(r => r.requesterId !== targetId);
    updateGMUI();
    sendToChat(`✅ Approved GM for ${targetId}`);
}

function rejectGM(targetId) {
    pendingRequests = pendingRequests.filter(r => r.requesterId !== targetId);
    updateGMUI();
    sendToChat(`❌ Rejected GM request from ${targetId}`);
}

function getCurrentGM() {
    return gmId ? clients[gmId] : null;
}

function getPendingRequests() {
    return pendingRequests;
}

function getClients() {
    return clients;
}

function getMyRole() {
    return myRole;
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
        ? '🟢 Connected to Fate\'s Edge v2.0.0'
        : '🔴 Disconnected from Fate\'s Edge';
    log(statusMsg);
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
// Roll20 Hooks
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
                    sendMessage({
                        type: 'sync-state',
                        state: { scene: { name: page.name } }
                    });
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
// API Commands for Roll20 Macros
// ============================================================

function registerCommands() {
    on('ready', () => {
        if (CONFIG.autoConnect) {
            connect();
        }

        on('chat:message', (msg) => {
            if (msg.type !== 'api') return;
            const args = msg.content.split(' ');
            const command = args[0];

            if (command === '!fates-edge') {
                const subcommand = args[1] || '';
                const param = args.slice(2).join(' ');

                switch (subcommand) {
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
                        sendToChat(`Characters: ${vttCharacters.size} synced`);
                        sendToChat(`Whiteboard: ${whiteboard.drawings?.length || 0} drawings, ${whiteboard.notes?.length || 0} notes, ${whiteboard.images?.length || 0} images`);
                        if (gridCombat.enabled) {
                            sendToChat(`⚔️ Grid combat: ${gridCombat.gridType}, ${gridCombat.tokens?.length || 0} tokens`);
                        }
                        const gm = getCurrentGM();
                        sendToChat(`GM: ${gm ? gm.name : 'None'}`);
                        sendToChat(`Your role: ${myRole}`);
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

                    // Deck Commands
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
                            try {
                                const page = Campaign.currentPage;
                                if (page && page.name) {
                                    sendMessage({
                                        type: 'sync-state',
                                        state: { scene: { name: page.name } }
                                    });
                                    sendToChat(`🎬 Synced scene: ${page.name}`);
                                }
                            } catch (err) {
                                sendToChat(`Failed to sync scene: ${err.message}`);
                            }
                        } else {
                            sendSyncRequest(param || 'all');
                            sendToChat('🔄 Sync requested');
                        }
                        break;

                    // GM Commands
                    case 'gm':
                        const gmSub = args[2] || '';
                        const gmParam = args.slice(3).join(' ');

                        if (gmSub === 'request') {
                            requestGM();
                        } else if (gmSub === 'approve') {
                            if (!gmParam) {
                                sendToChat('Usage: !fates-edge gm approve <playerId>');
                                break;
                            }
                            const target = Object.values(clients).find(c =>
                                c.id === gmParam || c.name.toLowerCase() === gmParam.toLowerCase()
                            );
                            if (!target) {
                                sendToChat(`❌ Player "${gmParam}" not found. Use !fates-edge gm list to see clients.`);
                                break;
                            }
                            approveGM(target.id);
                        } else if (gmSub === 'reject') {
                            if (!gmParam) {
                                sendToChat('Usage: !fates-edge gm reject <playerId>');
                                break;
                            }
                            const target = Object.values(clients).find(c =>
                                c.id === gmParam || c.name.toLowerCase() === gmParam.toLowerCase()
                            );
                            if (!target) {
                                sendToChat(`❌ Player "${gmParam}" not found.`);
                                break;
                            }
                            rejectGM(target.id);
                        } else if (gmSub === 'status') {
                            const gm = getCurrentGM();
                            const gmName = gm ? gm.name : 'None';
                            const pending = getPendingRequests();
                            sendToChat(`👑 **GM Status**\nCurrent GM: ${gmName}\nPending requests: ${pending.length}`);
                            if (pending.length > 0) {
                                const list = pending.map(r => r.requesterName).join(', ');
                                sendToChat(`Requests from: ${list}`);
                            }
                        } else if (gmSub === 'list') {
                            const clientList = Object.values(clients).map(c => {
                                const isGM = c.id === gmId ? '👑 ' : '';
                                const isSelf = c.id === clientId ? ' (you)' : '';
                                return `${isGM}${c.name}${isSelf} — ${c.role}`;
                            }).join('\n');
                            sendToChat(`👥 **Clients**\n${clientList}`);
                        } else {
                            sendToChat(`
GM Commands:
!fates-edge gm request        - Request to become GM
!fates-edge gm approve <name> - Approve a pending GM request (GM only)
!fates-edge gm reject <name>  - Reject a pending GM request (GM only)
!fates-edge gm status         - Show current GM and pending requests
!fates-edge gm list           - List all clients with roles
`);
                        }
                        break;

                    default:
                        sendToChat(`
Fate's Edge v2.0.0 Commands:
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
!fates-edge sync [characters|scene|all] - Sync state
!fates-edge gm ... - GM management (see !fates-edge gm help)
`);
                }
            }
        });
    });
}

// ============================================================
// Initialize
// ============================================================

registerCommands();

log('Fate\'s Edge Roll20 API module v2.0.0 loaded');
log(`Server: ${CONFIG.serverUrl}`);
log(`Room: ${CONFIG.roomCode}`);
log(`Region: ${currentRegion}`);
log(`Auto-connect: ${CONFIG.autoConnect}`);

if (CONFIG.autoConnect) {
    connect();
}