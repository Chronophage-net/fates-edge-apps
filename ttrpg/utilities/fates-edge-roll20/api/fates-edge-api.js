/**
 * Fate's Edge Roll20 API Module
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
    playerName: getConfigVar('FATES_EDGE_PLAYER_NAME', '')
};

function getConfigVar(name, defaultValue) {
    // Roll20 API environment variables are accessible via global scope
    // In Roll20, you set these in the API console
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

// Track Roll20 state
const vttCharacters = new Map();
const vttTimers = [];

// ============================================================
// Logging (Roll20-friendly)
// ============================================================

function log(message, level = 'info') {
    const prefix = '⚔️ Fate\'s Edge:';
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
        // Roll20 uses a modified WebSocket implementation
        // We need to use the 'wss' protocol if the server uses SSL
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

    // Send authentication if API key is configured
    if (CONFIG.apiKey) {
        sendMessage({
            type: 'auth',
            apiKey: CONFIG.apiKey
        });
    }

    // Join room
    sendMessage({
        type: 'join-room',
        roomCode: CONFIG.roomCode,
        clientData: {
            name: getPlayerName(),
            role: 'GM',
            platform: 'roll20',
            version: '1.0.0'
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
    log(`Connected to room ${CONFIG.roomCode}`);
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

    // Attempt to reconnect if not manually disconnected
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

    // Log clients
    if (data.clients) {
        const names = data.clients.map(c => c.data?.name || 'Unknown').join(', ');
        log(`Clients in room: ${names}`);
    }
}

function handleStateUpdate(data) {
    log('State updated');
    if (data.state && data.state.vtt) {
        syncVttState(data.state.vtt);
    }
}

function handleChatMessage(data) {
    log(`💬 ${data.sender}: ${data.text}`);

    if (CONFIG.syncChat) {
        // Send to Roll20 chat
        const msg = `[Fate's Edge] ${data.sender}: ${data.text}`;
        sendToChat(msg);

        // Also show as a GM whisper if it's important
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
    // Update voice UI state
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

    // Update Roll20 character sheets if they exist
    // Roll20 characters are accessed via the 'Campaign' object
    if (typeof Campaign !== 'undefined' && Campaign.characters) {
        // Find matching characters and update their attributes
        Campaign.characters.forEach(roll20Char => {
            const vttChar = vttCharacters.get(roll20Char.name);
            if (vttChar) {
                updateCharacterSheet(roll20Char, vttChar);
            }
        });
    }

    // Create journal entries for VTT characters
    characters.forEach(char => {
        createOrUpdateJournalEntry(char);
    });
}

function updateCharacterSheet(roll20Char, vttChar) {
    // Update Roll20 character attributes
    // This uses Roll20's character sheet API
    const attributes = [
        { name: 'harm', value: vttChar.harm || 0 },
        { name: 'fatigue', value: vttChar.fatigue || 0 },
        { name: 'boons', value: vttChar.boons || 0 },
        { name: 'tier', value: vttChar.tier || 1 }
    ];

    // Roll20 doesn't have a direct API for updating attributes from scripts
    // The recommended approach is to use the 'set' method on the character
    // Note: In Roll20 API, you need to be a GM to modify characters
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
        <p><small>Synced from Fate's Edge VTT</small></p>
    `;

    // Create or update journal entry
    // Note: Roll20 API doesn't have direct journal access from scripts
    // This would need to be done through a macro or the UI
    log(`Journal entry for ${name} would be created/updated`);
}

function syncTimers(timers) {
    if (!CONFIG.syncTimers) return;

    vttTimers.length = 0;
    vttTimers.push(...timers);

    // Display timers in chat or as a macro
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
        // Roll20 uses 'pages' instead of scenes
        // In the API, you can switch pages with 'Campaign.setCurrentPage'
        if (typeof Campaign !== 'undefined' && Campaign.setCurrentPage) {
            // Find the page with matching name
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

    // Add API key if available
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

    // Roll in Roll20 and send result
    try {
        // Use Roll20's dice parser
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

function syncVttState(state) {
    sendMessage({
        type: 'sync-state',
        state: { vtt: state }
    });
}

function syncCharacters(characters) {
    sendMessage({
        type: 'vtt-characters-updated',
        characters: characters
    });
}

function syncTimers(timers) {
    sendMessage({
        type: 'vtt-timers-updated',
        timers: timers
    });
}

// ============================================================
// Utility Functions
// ============================================================

function getPlayerName() {
    if (CONFIG.playerName) {
        return CONFIG.playerName;
    }
    // Try to get Roll20 player name
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
    // Roll20 API sendChat function
    if (typeof sendChat !== 'undefined') {
        if (type === 'gm') {
            sendChat('GM', message);
        } else {
            sendChat('Fate\'s Edge', message);
        }
    } else {
        // Fallback: use console
        console.log(`[CHAT] ${message}`);
    }
}

function updateStatus(status) {
    // Update some visible indicator in Roll20
    // This could be a macro or a custom API command
    const statusMsg = status === 'connected' 
        ? '🟢 Connected to Fate\'s Edge' 
        : '🔴 Disconnected from Fate\'s Edge';
    log(statusMsg);
}

function updateVoiceUI(data) {
    // Update voice status display - could be used for macros
    const status = data.enabled ? '🎤 Voice On' : '🎤 Voice Off';
    log(`Voice: ${data.name} - ${status}`);
}

// ============================================================
// API Commands for Roll20 Macros
// ============================================================

// Register commands for use in Roll20 macros
// These can be called via the API command system

function registerCommands() {
    // Roll20 API command registration
    // Note: This uses the 'on' function from Roll20 API
    on('ready', () => {
        if (CONFIG.autoConnect) {
            connect();
        }

        // Register commands
        // !fates-edge connect|disconnect|status|send|roll|sync
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

                    case 'sync':
                        if (param === 'characters') {
                            const chars = collectCharacters();
                            syncCharacters(chars);
                            sendToChat(`📤 Synced ${chars.length} characters`);
                        } else if (param === 'scene') {
                            syncScene({ name: Campaign.currentPage.name });
                        }
                        break;

                    default:
                        sendToChat(`
                            Fate's Edge Commands:
                            !fates-edge connect - Connect to server
                            !fates-edge disconnect - Disconnect
                            !fates-edge status - Show connection status
                            !fates-edge send <message> - Send chat message
                            !fates-edge roll <dice> - Roll dice
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
// Roll20 Hooks
// ============================================================

// Hook into Roll20 events
try {
    // Chat message hook
    on('chat:message', (msg) => {
        if (msg.type !== 'general') return;
        if (!CONFIG.syncChat) return;
        if (msg.who === 'Fate\'s Edge') return; // Skip our own messages

        // Extract text content
        let text = msg.content;
        // Strip HTML tags
        text = text.replace(/<[^>]+>/g, '');
        // Strip 'Fate's Edge:' prefix if present
        text = text.replace(/^Fate's Edge:\s*/, '');
        // Skip empty
        if (!text.trim()) return;

        sendChatMessage(text.trim());
    });

    // Dice roll hook
    on('chat:message', (msg) => {
        if (msg.type !== 'rollresult') return;
        if (!CONFIG.syncRolls) return;

        // Parse the roll result
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

log('Fate\'s Edge Roll20 API module loaded');
log(`Server: ${CONFIG.serverUrl}`);
log(`Room: ${CONFIG.roomCode}`);
log(`Auto-connect: ${CONFIG.autoConnect}`);

if (CONFIG.autoConnect) {
    connect();
}
