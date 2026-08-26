/**
 * Fate's Edge Roll20 API Module v2.1.0
 * Connects Roll20 to the Fate's Edge WebSocket Server
 * 
 * New in 2.1.0: Adventure Engine support (load, scene, encounter, timer, log, status, reference, reset)
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
 * - Adventure Engine (load, scene, encounter, timer, log, status, reference, reset)
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
 *    - FATES_EDGE_ROOM_PASSWORD: Optional (only needed for the first
 *      anonymous join to a password-protected room)
 *    - FATES_EDGE_AUTH_TOKEN: Optional per-account login token (from the
 *      server's optional accounts feature). Skips re-entering the room
 *      password on later joins, and gives this GM connection a real
 *      account identity. Leave unset for unchanged anonymous behavior.
 */

// ============================================================
// Configuration
// ============================================================

var CONFIG = {
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
    password: getConfigVar('FATES_EDGE_ROOM_PASSWORD', ''),  // optional room password
    // NEW: optional per-user JWT from the server's optional accounts
    // feature (server/auth.js). Get one via the web client's Account
    // panel, or the terminal/python client's login command, then set it
    // here. Leave blank for the exact same anonymous-GM behavior as
    // before this was added.
    authToken: getConfigVar('FATES_EDGE_AUTH_TOKEN', '')
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

var ws = null;
var connected = false;
var reconnectTimer = null;
var reconnectAttempts = 0;
var MAX_RECONNECT_ATTEMPTS = 10;
var heartbeatInterval = null;
var clientId = null;

// VTT state
var vttCharacters = new Map();        // name -> full character object
var vttTimers = [];
var deckState = {
    cards: [],
    history: [],
    offset: 0,
    remaining: 54
};
var currentRegion = CONFIG.defaultRegion;
var loadedModules = [];
var whiteboard = { drawings: [], notes: [], images: [] };
var gridCombat = { enabled: false, tokens: [], gridType: 'square' };

// Adventure Engine state
var adventureState = {
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

// NEW: Ad-hoc timers (server/timers.js) -- deliberately SEPARATE from
// adventureState.campaignTimers above. Those belong to a loaded
// adventure module's authored content; these are GM/AI-improvised
// timers that exist independent of any adventure being loaded, so they
// get their own state array and their own request/response + broadcast
// events ('adhoc-timer-*') instead of being folded into adventureState.
var adhocTimers = [];

// GM State
var clients = {};           // clientId -> { id, name, role, ... }
var gmId = null;            // clientId of current GM
var pendingRequests = [];   // [ { requesterId, requesterName }, ... ]
var myRole = 'player';      // role of this Roll20 client

// ============================================================
// Logging
// ============================================================

function log(message, level) {
    level = level || 'info';
    var prefix = '⚔️ Fate\'s Edge v2.1.0:';
    var timestamp = new Date().toISOString();
    switch (level) {
        case 'error':
            console.error(prefix + ' ' + message);
            break;
        case 'warn':
            console.warn(prefix + ' ' + message);
            break;
        case 'info':
        default:
            console.log(prefix + ' ' + message);
            break;
    }
}

function logWS(direction, data) {
    // Uncomment for verbose debugging
    // console.log(direction + ' ' + JSON.stringify(data));
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

    log('Connecting to ' + CONFIG.serverUrl + ' as ' + getPlayerName() + '...');

    try {
        var wsUrl = CONFIG.serverUrl + '?room=' + encodeURIComponent(CONFIG.roomCode);
        ws = new WebSocket(wsUrl);

        ws.onopen = onOpen;
        ws.onmessage = onMessage;
        ws.onerror = onError;
        ws.onclose = onClose;

    } catch (err) {
        log('Connection error: ' + err.message, 'error');
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
    adventureState = {
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
    adhocTimers = [];
    log('Disconnected');
    updateStatus('disconnected');
}

function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        log('Max reconnection attempts reached. Will retry on next API call.');
        return;
    }

    var delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
    reconnectAttempts++;

    log('Reconnecting in ' + delay + 'ms (attempt ' + reconnectAttempts + '/' + MAX_RECONNECT_ATTEMPTS + ')');

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    reconnectTimer = setTimeout(function() {
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

    var playerName = getPlayerName();
    var handshake = {
        type: 'handshake',
        clientName: playerName,
        role: 'gm',
        password: CONFIG.password || ''
    };
    // NEW: optional -- an absent/invalid token just means an anonymous
    // join, same as before this was added.
    if (CONFIG.authToken) {
        handshake.authToken = CONFIG.authToken;
    }
    sendMessage(handshake);

    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    heartbeatInterval = setInterval(function() {
        if (connected && ws && ws.readyState === WebSocket.OPEN) {
            sendMessage({ type: 'ping' });
        }
    }, 30000);

    updateStatus('connected');
}

function onMessage(event) {
    try {
        var data = JSON.parse(event.data);
        handleMessage(data);
    } catch (err) {
        log('Failed to parse message: ' + err.message, 'error');
    }
}

function handleMessage(data) {
    logWS('📨', data);

    switch (data.type) {
        case 'connected':
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

        // NEW: optional AI GM voice narration (see the AI GM Bot's
        // TTS_ENABLED/TTS_URL). The Roll20 API sandbox has no audio
        // playback capability at all -- no Web Audio API, no way to
        // host/attach the synthesized bytes as a Jukebox track (that
        // API only plays pre-uploaded tracks by ID, and the sandbox has
        // no fetch/filesystem access to upload one at runtime) -- so
        // there's nothing this integration can actually DO with the
        // audio. Explicitly handled (rather than falling through to the
        // "Unhandled message type" default below) so that's a
        // documented limitation, not a silent gap. The narration TEXT
        // still reaches Roll20 chat as usual via the separate
        // 'chat-message' event above.
        case 'tts-audio':
            handleTtsAudio(data);
            break;

        // NEW: optional Reactive Soundscape -- same sandbox limitation as
        // tts-audio above (no fetch/filesystem access to resolve a
        // trackId into a playable Roll20 audio asset), so this is also
        // logged-only. Roll20's own Jukebox has no API-driven "play by
        // arbitrary external id" mechanism to bridge into here.
        case 'soundboard-ambience':
            handleSoundboardAmbience(data);
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

        // NEW: Assistant GM suggestion queue (optional -- see the AI GM
        // Bot's modules/assistant-suggestions.js and ROADMAP.md item 2 in
        // that repo). Fired whenever the bot, in Assistant GM mode,
        // proposes something needing human approval -- a new fact/NPC/
        // scene advance/knowledge change, or (new) an LLM-synthesized SB
        // spend complication / Crown Spread interpretation. Rendered as
        // a Roll20 chat-button card (see handleAssistantSuggestionCreated
        // below) -- clicking it sends `!fates-edge suggestion approve/
        // reject <id>` as this player, which the '!fates-edge suggestion'
        // command below turns into the existing `!gm approve/reject <id>`
        // chat command. No new client->server request type.
        case 'assistant-suggestion-created':
            handleAssistantSuggestionCreated(data);
            break;

        case 'assistant-suggestion-resolved':
            handleAssistantSuggestionResolved(data);
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

        // v4.8: Co-GM / Player / Spectator changes -- distinct from
        // 'gm_role_update' above, which stays dedicated to the single GM
        // seat. See server/room.js's handleRoleChangeRequest.
        case 'role_update':
            handleRoleUpdate(data);
            break;

        case 'character_claimed':
        case 'character_released':
            // No Roll20-side state to update yet (this script doesn't
            // track claims locally) -- just surfaced to chat for now.
            break;

        case 'server_announcement':
            handleServerAnnouncement(data);
            break;

        // ─── Adventure Engine events ──────────────────────
        case 'adventure-loaded':
            handleAdventureLoaded(data);
            break;

        case 'scene-changed':
            handleSceneChanged(data);
            break;

        case 'encounter-started':
            handleEncounterStarted(data);
            break;

        case 'encounter-resolved':
            handleEncounterResolved(data);
            break;

        case 'timer-ticked':
            handleTimerTicked(data);
            break;

        // NEW: ad-hoc timers (server/timers.js) -- separate event names
        // ('adhoc-timer-*') so they never collide with 'timer-ticked'
        // above, which is specifically the adventure module's own
        // campaign/scene timers.
        case 'adhoc-timer-created':
        case 'adhoc-timer-ticked':
        case 'adhoc-timer-removed':
        case 'adhoc-timer-state':
            handleAdhocTimerState(data);
            break;

        case 'adventure-log':
            handleAdventureLog(data);
            break;

        case 'adventure-state':
            handleAdventureState(data);
            break;

        case 'adventure-reference':
            handleAdventureReference(data);
            break;

        case 'adventure-reset':
            handleAdventureReset(data);
            break;

        case 'adventure-knowledge-revealed':
            handleAdventureKnowledgeRevealed(data);
            break;

        case 'adventure-knowledge-hidden':
            handleAdventureKnowledgeHidden(data);
            break;
        // ─── end new ────────────────────────────────────────

        case 'room-closed':
            log('Room closed by server', 'warn');
            disconnect();
            break;

        case 'pong':
            // Heartbeat response - ignore
            break;

        default:
            log('Unhandled message type: ' + data.type);
    }
}

function onError(error) {
    log('WebSocket error: ' + (error.message || 'Unknown error'), 'error');
    scheduleReconnect();
}

function onClose(event) {
    log('WebSocket closed: ' + event.code + ' - ' + (event.reason || 'No reason'));
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
    log('✅ Handshake successful. Client ID: ' + clientId + ', Role: ' + myRole);

    if (data.activeClients) {
        updateClients(data.activeClients);
        var names = data.activeClients.map(function(c) { return c.name; }).join(', ');
        log('Clients in room: ' + names);
    }

    sendMessage({
        type: 'set-region',
        region: currentRegion
    });

    if (CONFIG.syncCharacters) {
        var chars = collectCharacters();
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
    if (data.adventure) {
        adventureState = mergeAdventureState(adventureState, data.adventure);
    }
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
    var state = data.state || {};
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
    log('💬 ' + data.sender + ': ' + data.text);
    if (CONFIG.syncChat) {
        sendToChat('[Fate\'s Edge] ' + escapeChatText(data.sender) + ': ' + escapeChatText(data.text));
    }
}

function handleTtsAudio(data) {
    // See the switch-case comment above -- logged for diagnostics only;
    // the Roll20 API sandbox cannot play the audio itself.
    log('🔊 AI GM narration audio received (not playable in the Roll20 API sandbox): "' + (data.text || '').slice(0, 60) + '"');
}

function handleSoundboardAmbience(data) {
    // See the switch-case comment above -- logged for diagnostics only.
    // `url` (+ optional `name`) is the newer shape: the AI GM Bot's
    // SOUNDSCAPE_AUTO_SEARCH found no GM-curated trackId for this mood
    // and searched Freesound itself instead. Still not playable here
    // either way -- same sandbox limitation, no fetch/filesystem access
    // to pull audio into Roll20's Jukebox regardless of which shape.
    var ref = data.trackId
        ? 'trackId="' + data.trackId + '"'
        : data.url
            ? 'url="' + data.url + '"' + (data.name ? ' name="' + data.name + '"' : '')
            : 'trackId="?"';
    log('🎵 Ambience cue received: mood="' + (data.mood || '?') + '" ' + ref + ' (not playable in the Roll20 API sandbox)');
}

function handleRollResult(data) {
    log('🎲 ' + data.sender + ' rolled: ' + (data.expr || 'Dice'));
    if (CONFIG.syncRolls) {
        var resultText = data.result;
        if (data.rolls && data.rolls.length > 0) {
            resultText = data.rolls.join(' + ') + ' = ' + data.total;
        }
        sendToChat('🎲 ' + escapeChatText(data.sender) + ' rolled **' + escapeChatText(data.expr) + '**: ' + escapeChatText(resultText));
    }
}

function handlePlayerJoined(data) {
    if (data.clients) {
        updateClients(data.clients);
        var name = data.clientName || 'Unknown';
        log('👤 ' + name + ' joined');
        sendToChat('👤 ' + escapeChatText(name) + ' has joined the Fate\'s Edge session.');
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
    var name = data.clientName || 'Unknown';
    log('👤 ' + name + ' left');
    sendToChat('👤 ' + escapeChatText(name) + ' has left the Fate\'s Edge session.');
    updateGMUI();
}

// ============================================================
// Adventure Engine Handlers
// ============================================================

function mergeAdventureState(existing, incoming) {
    var merged = {};
    for (var key in existing) {
        if (existing.hasOwnProperty(key)) {
            merged[key] = existing[key];
        }
    }
    for (var key in incoming) {
        if (incoming.hasOwnProperty(key)) {
            merged[key] = incoming[key];
        }
    }
    return merged;
}

function handleAdventureLoaded(data) {
    adventureState = mergeAdventureState(adventureState, data);
    var title = data.title || data.moduleId || 'Unknown';
    log('📖 Adventure loaded: ' + title);
    var msg = '📖 **Adventure Loaded:** ' + title + '\n';
    msg += 'Status: ' + (data.status || 'active') + '\n';
    if (data.currentAct) {
        msg += 'Act: ' + data.currentAct.title + '\n';
    }
    if (data.currentScene) {
        msg += 'Scene: ' + data.currentScene.title + '\n';
    }
    sendToChat(msg);
    // Create a handout/journal entry
    createHandout('Adventure: ' + title, msg);
}

function handleSceneChanged(data) {
    adventureState = mergeAdventureState(adventureState, data);
    var act = data.currentAct ? data.currentAct.title : 'Unknown';
    var scene = data.currentScene ? data.currentScene.title : 'Unknown';
    log('🎭 Scene changed: ' + act + ' / ' + scene);
    var msg = '🎭 **Scene Changed**\nAct: ' + act + '\nScene: ' + scene;
    if (data.currentScene && data.currentScene.description) {
        msg += '\n' + data.currentScene.description;
    }
    sendToChat(msg);
    createHandout('Scene: ' + scene, msg);
}

function handleEncounterStarted(data) {
    adventureState = mergeAdventureState(adventureState, data);
    var enc = data.activeEncounter || {};
    var name = enc.name || enc.creatureId || 'Encounter';
    var dv = enc.dv || '?';
    var pos = enc.position || 'Controlled';
    log('⚔️ Encounter started: ' + name);
    var msg = '⚔️ **Encounter Started:** ' + name + '\n';
    msg += 'DV: ' + dv + '\n';
    msg += 'Position: ' + pos;
    if (enc.creature) {
        msg += '\nCreature: ' + enc.creature.name + ' (TL' + enc.creature.tl + ')';
    }
    sendToChat(msg);
    createHandout('Encounter: ' + name, msg);
}

function handleEncounterResolved(data) {
    adventureState = mergeAdventureState(adventureState, data);
    var resolution = data.lastResolution || {};
    var encName = resolution.encounter || 'Encounter';
    var outcome = resolution.outcome || '?';
    var resultText = resolution.result || '';
    log('⚔️ Encounter resolved: ' + encName + ' (' + outcome + ')');
    var msg = '⚔️ **Encounter Resolved:** ' + encName + '\n';
    msg += 'Outcome: ' + outcome + '\n';
    if (resultText) {
        msg += resultText + '\n';
    }
    if (resolution.notes) {
        msg += 'Notes: ' + resolution.notes;
    }
    sendToChat(msg);
    createHandout('Encounter Resolved: ' + encName, msg);
}

function handleTimerTicked(data) {
    adventureState = mergeAdventureState(adventureState, data);
    var timer = data.tickedTimer || {};
    var name = timer.name || 'Timer';
    var current = timer.current || 0;
    var segments = timer.segments || 1;
    var full = timer.full || false;
    log('⏱️ Timer ticked: ' + name + ' ' + current + '/' + segments);
    var bar = generateProgressBar(current, segments);
    var msg = '⏱️ **Timer:** ' + name + '\n';
    msg += '[' + bar + '] ' + current + '/' + segments + '\n';
    msg += 'Status: ' + (full ? '⚠️ COMPLETE' : '⏳ Active');
    sendToChat(msg);
    if (full) {
        sendToChat('⚠️ Timer "' + name + '" is complete!');
    }
    createHandout('Timer: ' + name, msg);
}

// NEW: ad-hoc timers (server/timers.js) -- see the case-statement
// comment above for why this is separate from handleTimerTicked().
function handleAdhocTimerState(data) {
    adhocTimers = data.timers || [];
    if (data.tickedTimer) {
        var t = data.tickedTimer;
        var bar = generateProgressBar(t.current || 0, t.segments || 1);
        var msg = '⏱️ **Ad-Hoc Timer:** ' + (t.name || 'Timer') + '\n';
        msg += '[' + bar + '] ' + (t.current || 0) + '/' + (t.segments || 1) + '\n';
        msg += 'Status: ' + (t.full ? '⚠️ COMPLETE' : '⏳ Active');
        sendToChat(msg);
        return;
    }
    if (!adhocTimers.length) {
        sendToChat('⏱️ No active ad-hoc timers.');
        return;
    }
    var listMsg = '⏱️ **Ad-Hoc Timers**\n';
    adhocTimers.forEach(function(t) {
        var bar = generateProgressBar(t.current || 0, t.segments || 1);
        listMsg += t.name + ' [' + bar + '] ' + t.current + '/' + t.segments + (t.full ? ' ⚠️' : '') + '\n';
    });
    sendToChat(listMsg);
}

function handleAdventureLog(data) {
    adventureState = mergeAdventureState(adventureState, data);
    var logData = data.log || [];
    if (logData.length > 0) {
        var last = logData[logData.length - 1];
        var author = last.author || 'GM';
        var message = last.message || last.text || last.type;
        log('📝 Adventure log: ' + message);
        sendToChat('📝 **' + escapeChatText(author) + ':** ' + escapeChatText(message));
    }
}

function handleAdventureState(data) {
    adventureState = mergeAdventureState(adventureState, data);
    log('📋 Adventure state received');
    var msg = '📋 **Adventure Status**\n';
    msg += 'Title: ' + (adventureState.title || 'None') + '\n';
    msg += 'Status: ' + (adventureState.status || 'unknown') + '\n';
    if (adventureState.currentAct) {
        msg += 'Act: ' + adventureState.currentAct.title + '\n';
    }
    if (adventureState.currentScene) {
        msg += 'Scene: ' + adventureState.currentScene.title + '\n';
    }
    if (adventureState.activeEncounter) {
        var enc = adventureState.activeEncounter;
        var encName = enc.name || enc.creatureId || 'Encounter';
        msg += 'Encounter: ' + encName + ' (DV ' + (enc.dv || '?') + ', ' + (enc.position || 'Controlled') + ')\n';
    }
    if (adventureState.campaignTimers && adventureState.campaignTimers.length > 0) {
        var timerStr = adventureState.campaignTimers.map(function(t) {
            return t.name + ': ' + (t.current || 0) + '/' + t.segments;
        }).join(', ');
        msg += 'Campaign Timers: ' + timerStr + '\n';
    }
    if (adventureState.log && adventureState.log.length > 0) {
        var lastLog = adventureState.log[adventureState.log.length - 1];
        msg += 'Last log: ' + (lastLog.message || lastLog.text || lastLog.type);
    }
    sendToChat(msg);
}

function handleAdventureReference(data) {
    log('📚 Adventure reference received');
    var msg = '📚 **Reference: ' + (data.moduleId || 'Unknown') + '**\n';
    if (data.bestiary && data.bestiary.length > 0) {
        msg += '🐉 Bestiary (' + data.bestiary.length + '):\n';
        data.bestiary.slice(0, 5).forEach(function(b) {
            msg += '  - ' + b.name + ' (TL' + b.tl + ')\n';
        });
        if (data.bestiary.length > 5) {
            msg += '  ... and ' + (data.bestiary.length - 5) + ' more\n';
        }
    }
    if (data.npcs && data.npcs.length > 0) {
        msg += '👤 NPCs (' + data.npcs.length + '):\n';
        data.npcs.slice(0, 5).forEach(function(n) {
            msg += '  - ' + n.name + ' (' + (n.role || 'NPC') + ')\n';
        });
        if (data.npcs.length > 5) {
            msg += '  ... and ' + (data.npcs.length - 5) + ' more\n';
        }
    }
    if (data.locations && data.locations.length > 0) {
        msg += '📍 Locations (' + data.locations.length + '):\n';
        data.locations.slice(0, 5).forEach(function(l) {
            msg += '  - ' + l.name + '\n';
        });
        if (data.locations.length > 5) {
            msg += '  ... and ' + (data.locations.length - 5) + ' more\n';
        }
    }
    if (data.factions && data.factions.length > 0) {
        msg += '⚑ Factions (' + data.factions.length + '):\n';
        data.factions.forEach(function(f) {
            msg += '  - ' + f.name + '\n';
        });
    }
    if (data.notes) {
        msg += '📝 Notes: ' + data.notes + '\n';
    }
    // NEW: full GM/AI-eyes-only knowledge view -- `data` here is the same
    // GM-only reference fetch npcs/bestiary/notes above already come from,
    // so `gm`/`revealCondition` are safe to print raw.
    if (data.knowledge && data.knowledge.length > 0) {
        msg += '🗝️ Knowledge (' + data.knowledge.length + '):\n';
        data.knowledge.forEach(function(k) {
            var lock = k.revealed ? '🔓 REVEALED' : '🔒 secret';
            msg += '  ' + lock + ' — ' + k.id + (k.subject ? ' (' + k.subject + ')' : '') + '\n';
            if (k.revealed) {
                msg += '    ' + (k.gm || '') + '\n';
            } else {
                msg += '    truth (DO NOT reveal): ' + (k.gm || '') + '\n';
                msg += '    players currently know: ' + (k.player != null ? k.player : '(nothing yet)') + '\n';
                if (k.revealCondition) {
                    msg += '    reveal when: ' + k.revealCondition + '\n';
                }
            }
        });
    }
    sendToChat(msg);
    createHandout('Reference: ' + data.moduleId, msg);
}

function handleAdventureReset(data) {
    adventureState = mergeAdventureState(adventureState, data);
    log('🔄 Adventure reset');
    sendToChat('🔄 Adventure has been reset to its initial state.');
}

// NEW: knowledge state reveal/hide -- see sendAdventureKnowledgeReveal/
// Hide() below and server/adventure.js's revealKnowledge()/hideKnowledge().
// `data` here is getPublicState()'s player-safe view (`text`/`revealed`,
// no `gm`), same shape every other Adventure Engine broadcast above
// carries -- not the GM-only reference fetch handleAdventureReference()
// uses.
function handleAdventureKnowledgeRevealed(data) {
    adventureState = mergeAdventureState(adventureState, data);
    log('🔓 Knowledge revealed: ' + data.id);
    var entry = null;
    if (data.knowledge) {
        for (var i = 0; i < data.knowledge.length; i++) {
            if (data.knowledge[i].id === data.id) { entry = data.knowledge[i]; break; }
        }
    }
    sendToChat('🔓 Knowledge revealed: ' + data.id + (entry && entry.text ? '\n' + entry.text : ''));
}

function handleAdventureKnowledgeHidden(data) {
    adventureState = mergeAdventureState(adventureState, data);
    log('🔒 Knowledge hidden: ' + data.id);
    sendToChat('🔒 Knowledge hidden again: ' + data.id);
}

function generateProgressBar(current, max) {
    var filled = Math.floor((current / max) * 10);
    var bar = '';
    for (var i = 0; i < 10; i++) {
        bar += (i < filled) ? '▰' : '▱';
    }
    return bar;
}

function createHandout(title, content) {
    try {
        if (typeof Campaign !== 'undefined' && Campaign.createJournalEntry) {
            Campaign.createJournalEntry({
                name: title,
                content: content.replace(/\n/g, '<br>'),
                gm: false,
                players: true
            });
            log('📄 Created handout: ' + title);
        }
    } catch (err) {
        log('Failed to create handout: ' + err.message, 'warn');
    }
}

// ============================================================
// Deck Handlers
// ============================================================

function handleDeckDrawn(data) {
    var cards = data.cards || [];
    var synthesis = data.synthesis || '';
    var region = data.region || currentRegion;
    deckState.cards = cards;
    deckState.remaining = data.remaining || 0;

    log('🃏 ' + cards.length + ' card(s) drawn from ' + region);

    if (CONFIG.syncDeck) {
        var cardNames = cards.map(function(c) {
            if (c.is_joker) return '🃏 Joker';
            return (c.rank_name || c.rank) + ' of ' + (c.suit_name || c.suit);
        }).join(', ');

        var msg = '🃏 **' + cards.length + ' card(s) drawn from ' + region + '**\n';
        msg += cardNames + '\n\n';
        msg += synthesis;
        sendToChat(msg);
        createHandout('Deck Draw - ' + region, msg);
    }
}

function handleDeckShuffled(data) {
    deckState.cards = [];
    deckState.history = [];
    deckState.remaining = data.remaining || 54;
    log('🔀 Deck shuffled (' + deckState.remaining + ' cards remaining)');
    if (CONFIG.syncDeck) {
        sendToChat('🔀 The Deck of Consequences has been shuffled. ' + deckState.remaining + ' cards remaining.');
    }
}

function handleDeckHistory(data) {
    var history = data.history || [];
    deckState.history = history;
    log('📜 Deck history: ' + history.length + ' entries');
}

function handleDeckHistoryCleared(data) {
    deckState.history = [];
    log('🗑️ Deck history cleared');
    if (CONFIG.syncDeck) {
        sendToChat('🗑️ Deck history has been cleared.');
    }
}

function handleCrownSpread(data) {
    var cards = data.cards || [];
    var result = data.result || {};
    var region = data.region || currentRegion;

    log('👑 Crown Spread from ' + region);

    if (CONFIG.syncDeck) {
        var msg = '👑 **Crown Spread from ' + region + '**\n\n';
        if (result.positions) {
            result.positions.forEach(function(p) {
                msg += p.icon + ' **' + p.label + ':** ' + p.meaning + '\n';
            });
        }
        if (result.wildcard) {
            msg += '\n🌟 **Wildcard:** ' + result.wildcard;
        }
        sendToChat(msg);
        createHandout('Crown Spread - ' + region, msg);
    }
}

// suggestionId -> true, purely to give a friendly "already resolved"
// message if a player double-clicks a button after someone else already
// acted on it (Roll20 doesn't let a script disable/remove a button once
// sent, unlike the web client/Discord/Foundry integrations, which can
// edit their own message in place). Session lifetime only.
var resolvedAssistantSuggestions = {};

function handleAssistantSuggestionCreated(data) {
    var id = data.id;
    var kind = data.kind || 'suggestion';
    var text = data.preview || data.label || kind;
    if (!id) return;
    log('📋 Assistant GM proposal (' + kind + '): ' + text);
    var msg = '📋 **Assistant GM Proposal** [' + kind + ']\n' + text + '\n\n' +
        '[✅ Approve](!fates-edge suggestion approve ' + id + ') ' +
        '[🗑️ Reject](!fates-edge suggestion reject ' + id + ')';
    sendToChat(msg);
}

function handleAssistantSuggestionResolved(data) {
    var id = data.id;
    var outcome = data.outcome;
    if (!id) return;
    resolvedAssistantSuggestions[id] = outcome;
    var outcomeLabel = { approved: '✅ Approved', rejected: '🗑️ Rejected', 'auto-rejected': '🗑️ Auto-rejected (another option was approved)' }[outcome] || outcome;
    sendToChat('📋 Suggestion ' + id + ': ' + outcomeLabel);
}

// ============================================================
// Module Handlers
// ============================================================

function handleModuleList(data) {
    loadedModules = data.modules || [];
    log('📦 ' + loadedModules.length + ' modules loaded');
    if (loadedModules.length > 0) {
        var names = loadedModules.map(function(m) { return m.name || m.id; }).join(', ');
        sendToChat('📦 Modules loaded: ' + names);
    }
}

function handleModulePush(data) {
    var module = data.module || {};
    var name = module.manifest ? module.manifest.name : (module.id || 'Unknown');
    log('📦 Module pushed: ' + name);
    sendToChat('📦 Module pushed: ' + name);
}

function handleModuleCleanup(data) {
    var moduleId = data.moduleId || 'Unknown';
    log('🧹 Module cleanup: ' + moduleId);
    sendToChat('🧹 Module cleanup requested: ' + moduleId);
}

function handleRegionUpdated(data) {
    if (data.region) {
        currentRegion = data.region;
        log('📍 Region updated to: ' + currentRegion);
        sendToChat('📍 Region updated to: ' + currentRegion);
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
        log('📋 Whiteboard updated: ' + (whiteboard.drawings ? whiteboard.drawings.length : 0) + ' drawings, ' + (whiteboard.notes ? whiteboard.notes.length : 0) + ' notes, ' + (whiteboard.images ? whiteboard.images.length : 0) + ' images');
        if (gridCombat.enabled) {
            log('⚔️ Grid combat: ' + gridCombat.gridType + ', ' + (gridCombat.tokens ? gridCombat.tokens.length : 0) + ' tokens');
        }
    }
}

// ============================================================
// Character Handlers
// ============================================================

function updateCharacters(charactersArray) {
    vttCharacters.clear();
    charactersArray.forEach(function(c) {
        if (c.name) {
            vttCharacters.set(c.name, c);
        }
    });
    log('👥 ' + vttCharacters.size + ' characters synced');

    if (CONFIG.syncCharacters) {
        syncToRoll20Characters();
    }
}

function handleCharacterUpdate(data) {
    if (data.name && data.field !== undefined) {
        var char = vttCharacters.get(data.name);
        if (!char) {
            char = { name: data.name };
            vttCharacters.set(data.name, char);
        }
        char[data.field] = data.value;
        log('⚡ ' + data.name + '.' + data.field + ' = ' + data.value);
        if (CONFIG.syncCharacters) {
            syncToRoll20Characters();
        }
    }
}

function handleCharacterUpdateBulk(data) {
    if (data.updates) {
        var names = Object.keys(data.updates);
        names.forEach(function(name) {
            var fields = data.updates[name];
            var char = vttCharacters.get(name);
            if (!char) {
                char = { name: name };
                vttCharacters.set(name, char);
            }
            for (var key in fields) {
                if (fields.hasOwnProperty(key)) {
                    char[key] = fields[key];
                }
            }
        });
        log('📋 Bulk update: ' + names.length + ' characters');
        if (CONFIG.syncCharacters) {
            syncToRoll20Characters();
        }
    }
}

function syncToRoll20Characters() {
    // Update Roll20 character sheets
    if (typeof Campaign !== 'undefined' && Campaign.characters) {
        Campaign.characters.forEach(function(roll20Char) {
            var vttChar = vttCharacters.get(roll20Char.name);
            if (vttChar) {
                updateCharacterSheet(roll20Char, vttChar);
            }
        });
    }

    // Update journal entries
    vttCharacters.forEach(function(char, name) {
        createOrUpdateJournalEntry(char);
    });
}

function updateCharacterSheet(roll20Char, vttChar) {
    var attributes = [
        { name: 'harm', value: vttChar.harm || 0 },
        { name: 'fatigue', value: vttChar.fatigue || 0 },
        { name: 'boons', value: vttChar.boons || 0 },
        { name: 'tier', value: vttChar.tier || 1 }
    ];

    if (roll20Char.set) {
        attributes.forEach(function(attr) {
            roll20Char.set(attr.name, attr.value);
        });
        log('Updated character sheet: ' + roll20Char.name);
    }
}

function createOrUpdateJournalEntry(char) {
    var name = char.name || 'Unnamed';
    var content = '';
    content += '<h2>' + name + '</h2>';
    content += '<p><b>Harm:</b> ' + (char.harm || 0) + '</p>';
    content += '<p><b>Fatigue:</b> ' + (char.fatigue || 0) + '</p>';
    content += '<p><b>Boons:</b> ' + (char.boons || 0) + '</p>';
    if (char.tier) {
        content += '<p><b>Tier:</b> ' + char.tier + '</p>';
    }
    if (char.attributes) {
        var attrStr = '';
        for (var key in char.attributes) {
            if (char.attributes.hasOwnProperty(key)) {
                attrStr += key + ': ' + char.attributes[key] + ', ';
            }
        }
        if (attrStr) {
            content += '<p><b>Attributes:</b> ' + attrStr.slice(0, -2) + '</p>';
        }
    }
    if (char.skills) {
        var skillStr = '';
        for (var key in char.skills) {
            if (char.skills.hasOwnProperty(key)) {
                skillStr += key + ': ' + char.skills[key] + ', ';
            }
        }
        if (skillStr) {
            content += '<p><b>Skills:</b> ' + skillStr.slice(0, -2) + '</p>';
        }
    }
    if (char.heritage) {
        content += '<p><b>Heritage:</b> ' + char.heritage + '</p>';
    }
    if (char.background) {
        content += '<p><b>Background:</b> ' + char.background + '</p>';
    }
    if (char.patron) {
        content += '<p><b>Patron:</b> ' + char.patron + '</p>';
    }
    content += '<hr><p><small>Synced from Fate\'s Edge VTT v2.1.0</small></p>';

    try {
        if (typeof Campaign !== 'undefined' && Campaign.findJournalEntry) {
            var existing = Campaign.findJournalEntry(name);
            if (existing) {
                existing.set('content', content);
                log('Updated journal entry: ' + name);
            } else if (Campaign.createJournalEntry) {
                Campaign.createJournalEntry({
                    name: name,
                    content: content,
                    gm: false,
                    players: true
                });
                log('Created journal entry: ' + name);
            }
        }
    } catch (err) {
        log('Failed to update journal: ' + err.message, 'warn');
    }
}

// ============================================================
// Timer Handlers
// ============================================================

function updateTimers(timers) {
    vttTimers.length = 0;
    timers.forEach(function(timer) {
        vttTimers.push(timer);
    });
    if (CONFIG.syncTimers) {
        timers.forEach(function(timer) {
            var progress = ((timer.current || 0) / (timer.segments || 1) * 100);
            var bar = generateProgressBar(timer.current || 0, timer.segments || 1);
            var status = (timer.current || 0) >= (timer.segments || 1) ? '⚠️ COMPLETE' : '⏳ Active';
            sendToChat('⏱️ **' + timer.name + '** [' + bar + '] ' + timer.current + '/' + timer.segments + ' - ' + status);
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
    var requesterId = data.requesterId;
    var requesterName = data.requesterName;
    var currentGmId = data.currentGmId;
    if (myRole === 'gm' && clientId === currentGmId) {
        if (!pendingRequests.some(function(r) { return r.requesterId === requesterId; })) {
            pendingRequests.push({ requesterId: requesterId, requesterName: requesterName });
        }
        updateGMUI();
        sendToChat('👑 ' + requesterName + ' requests to become GM. Use !fates-edge gm approve <name> or !fates-edge gm reject <name>', 'gm');
    }
}

function handleGmRoleUpdate(data) {
    var targetId = data.clientId;
    var role = data.role;
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
    var name = clients[targetId] ? clients[targetId].name : targetId;
    sendToChat('👑 ' + escapeChatText(name) + ' is now ' + role.toUpperCase() + '.');
}

// v4.8: Co-GM / Player / Spectator role update -- `data.targetId` (not
// `clientId`) is who the change applies to.
function handleRoleUpdate(data) {
    var targetId = data.targetId;
    var role = data.role;
    var persist = data.persist;
    if (targetId === clientId) {
        myRole = role;
    }
    if (clients[targetId]) {
        clients[targetId].role = role;
    }
    updateGMUI();
    var name = clients[targetId] ? clients[targetId].name : targetId;
    var roleLabels = { 'co-gm': 'Co-GM', 'assistant-gm': 'Assistant GM', player: 'Player', spectator: 'Spectator' };
    var persistNote = (role === 'co-gm' || role === 'assistant-gm') ? (persist ? ' (saved)' : ' (this session only)') : '';
    sendToChat('🎭 ' + escapeChatText(name) + ' is now ' + (roleLabels[role] || role) + persistNote + '.');
}

function handleServerAnnouncement(data) {
    sendToChat('📢 ' + escapeChatText(data.message));
}

// ============================================================
// Client & GM Helpers
// ============================================================

function updateClients(clientsArray) {
    clients = {};
    clientsArray.forEach(function(c) {
        clients[c.id] = c;
        if (c.role === 'gm') gmId = c.id;
    });
    if (!clientsArray.some(function(c) { return c.role === 'gm'; })) {
        gmId = null;
    }
    if (clientId && clients[clientId]) {
        myRole = clients[clientId].role;
    }
}

function updateGmFromClients() {
    for (var id in clients) {
        if (clients.hasOwnProperty(id) && clients[id].role === 'gm') {
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
        log('Failed to send message: ' + err.message, 'error');
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

function sendRoll(expr, reason) {
    reason = reason || null;
    if (!expr) return;
    sendMessage({
        type: 'roll-dice',
        expr: expr,
        sender: getPlayerName(),
        reason: reason || 'Dice roll',
        timestamp: Date.now()
    });
}

function sendDeckDraw(count, region) {
    count = count || 1;
    region = region || currentRegion;
    sendMessage({
        type: 'deck-draw',
        count: Math.min(count, 5),
        region: region
    });
    log('🃏 Drawing ' + count + ' card(s) from ' + region);
}

function sendCrownSpread(region) {
    region = region || currentRegion;
    sendMessage({
        type: 'crown-spread',
        region: region
    });
    log('👑 Crown Spread from ' + region);
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
    log('📍 Region updated to: ' + region);
}

function sendModuleList() {
    sendMessage({ type: 'module-list' });
    log('📦 Module list requested');
}

function sendSyncRequest(entity) {
    entity = entity || 'all';
    sendMessage({ type: 'sync-request', entity: entity });
}

function syncCharacters(characters) {
    sendMessage({
        type: 'state-updated',
        characters: characters
    });
}

// ============================================================
// Adventure Engine Send Functions
// ============================================================

function sendAdventureLoad(moduleId) {
    if (!moduleId) {
        log('Module ID required', 'error');
        return;
    }
    sendMessage({ type: 'adventure-load', moduleId: moduleId });
    log('📖 Load adventure: ' + moduleId);
    sendToChat('📖 Requested load of adventure: ' + moduleId);
}

function sendAdventureScene(actIndex, sceneIndex) {
    var target = {};
    if (actIndex !== undefined && actIndex !== null && !isNaN(actIndex)) {
        target.actIndex = Number(actIndex);
    }
    if (sceneIndex !== undefined && sceneIndex !== null && !isNaN(sceneIndex)) {
        target.sceneIndex = Number(sceneIndex);
    }
    // NOTE: the server reads actIndex/sceneIndex flat off the message body
    // (see ws-handlers.js's 'adventure-scene' case), NOT nested under a
    // `target` key. Nesting them here (as this used to) meant the server
    // always saw both as undefined and silently fell back to sequential
    // advance, ignoring whatever act/scene the caller asked for.
    sendMessage(Object.assign({ type: 'adventure-scene' }, target));
    var msg = '🎭 Scene change requested';
    if (target.actIndex !== undefined) msg += ' to act ' + target.actIndex;
    if (target.sceneIndex !== undefined) msg += ', scene ' + target.sceneIndex;
    if (!target.actIndex && !target.sceneIndex) msg += ' (sequential)';
    log(msg);
    sendToChat(msg);
}

function sendAdventureEncounterStart(ref) {
    if (ref === undefined || ref === null) {
        log('Encounter reference required', 'error');
        return;
    }
    sendMessage({ type: 'adventure-encounter-start', ref: ref });
    log('⚔️ Starting encounter: ' + ref);
    sendToChat('⚔️ Starting encounter: ' + ref);
}

function sendAdventureEncounterResolve(outcome, notes) {
    notes = notes || '';
    if (!outcome || ['clean', 'partial', 'miss'].indexOf(outcome) === -1) {
        log('Outcome must be clean, partial, or miss', 'error');
        return;
    }
    sendMessage({ type: 'adventure-encounter-resolve', outcome: outcome, notes: notes });
    log('⚔️ Resolving encounter as ' + outcome);
    sendToChat('⚔️ Encounter resolved as ' + outcome);
}

function sendAdventureTimer(name, amount, scope) {
    amount = amount || 1;
    scope = scope || 'scene';
    if (!name) {
        log('Timer name required', 'error');
        return;
    }
    sendMessage({ type: 'adventure-timer', ref: name, amount: amount, scope: scope });
    log('⏱️ Ticking timer: ' + name + ' by ' + amount);
    sendToChat('⏱️ Ticking timer "' + name + '" by ' + amount);
}

function sendAdventureLog(text, author) {
    author = author || getPlayerName();
    if (!text) {
        log('Log text required', 'error');
        return;
    }
    sendMessage({ type: 'adventure-log', text: text, author: author });
    log('📝 Logging beat: ' + text);
    sendToChat('📝 ' + author + ': ' + text);
}

function sendAdventureStatus() {
    sendMessage({ type: 'adventure-state-request' });
    log('📋 Requesting adventure status');
    sendToChat('📋 Requesting adventure status...');
}

function sendAdventureReference() {
    sendMessage({ type: 'adventure-reference-request' });
    log('📚 Requesting adventure reference');
    sendToChat('📚 Requesting adventure reference...');
}

// NEW: ad-hoc timers (server/timers.js) -- see the case-statement
// comment near handleAdhocTimerState() for why these are separate
// send functions from sendAdventureTimer() above.
function sendAdhocTimerAdd(name, segments, description) {
    if (!name || !segments) {
        log('Timer name and segments required', 'error');
        return;
    }
    sendMessage({ type: 'adhoc-timer-create', name: name, segments: segments, description: description || '' });
    log('⏱️ Creating ad-hoc timer: ' + name + ' (' + segments + ' segments)');
    sendToChat('⏱️ Creating timer "' + name + '" (' + segments + ' segments)...');
}

function sendAdhocTimerTick(name, amount) {
    amount = amount || 1;
    if (!name) {
        log('Timer name required', 'error');
        return;
    }
    sendMessage({ type: 'adhoc-timer-tick', name: name, amount: amount });
    log('⏱️ Ticking ad-hoc timer: ' + name + ' by ' + amount);
    sendToChat('⏱️ Ticking timer "' + name + '" by ' + amount);
}

function sendAdhocTimerRemove(name) {
    if (!name) {
        log('Timer name required', 'error');
        return;
    }
    sendMessage({ type: 'adhoc-timer-remove', name: name });
    log('⏱️ Removing ad-hoc timer: ' + name);
    sendToChat('⏱️ Removing timer "' + name + '"...');
}

function sendAdhocTimerList() {
    sendMessage({ type: 'adhoc-timer-request' });
    log('⏱️ Requesting ad-hoc timer list');
}

function sendAdventureReset() {
    sendMessage({ type: 'adventure-reset' });
    log('🔄 Resetting adventure');
    sendToChat('🔄 Resetting adventure...');
}

function sendAdventureKnowledgeReveal(id) {
    if (!id) {
        log('Knowledge entry id required', 'error');
        return;
    }
    sendMessage({ type: 'adventure-knowledge-reveal', id: id, by: getPlayerName() });
    log('🔓 Revealing knowledge: ' + id);
    sendToChat('🔓 Requesting reveal of "' + id + '"...');
}

function sendAdventureKnowledgeHide(id) {
    if (!id) {
        log('Knowledge entry id required', 'error');
        return;
    }
    sendMessage({ type: 'adventure-knowledge-hide', id: id, by: getPlayerName() });
    log('🔒 Hiding knowledge: ' + id);
    sendToChat('🔒 Requesting hide of "' + id + '"...');
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
    sendMessage({ type: 'approve_gm', targetId: targetId });
    pendingRequests = pendingRequests.filter(function(r) { return r.requesterId !== targetId; });
    updateGMUI();
    sendToChat('✅ Approved GM for ' + targetId);
}

// ============================================================
// v4.8: Role (Co-GM / Player / Spectator) + Character Registration
// Public Methods
// ============================================================

// GM-only server-side (a Co-GM sender is rejected by the server) --
// `role` is 'co-gm' | 'player' | 'spectator'; `persist` mirrors the
// server's session-only vs. saved distinction for Co-GM grants.
function changeRole(targetId, role, persist) {
    if (!connected) {
        log('Not connected - cannot change role', 'error');
        return false;
    }
    if (myRole !== 'gm') {
        sendToChat('❌ Only the current GM can change roles.');
        return false;
    }
    sendMessage({ type: 'role_change_request', targetId: targetId, role: role, persist: !!persist });
    return true;
}

function claimCharacter(characterId, character) {
    if (!connected) {
        log('Not connected - cannot claim character', 'error');
        return false;
    }
    sendMessage({ type: 'claim-character', characterId: characterId, character: character });
    return true;
}

function releaseCharacter() {
    if (!connected) return false;
    sendMessage({ type: 'release-character' });
    return true;
}

function rejectGM(targetId) {
    pendingRequests = pendingRequests.filter(function(r) { return r.requesterId !== targetId; });
    updateGMUI();
    sendToChat('❌ Rejected GM request from ' + targetId);
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
            var player = User.getActivePlayer();
            if (player && player.name) {
                return player.name;
            }
        }
    } catch (err) {
        // Ignore
    }
    return 'Roll20 GM';
}

// Roll20's sendChat() renders a subset of HTML in the chat pane and treats
// messages starting with "!" as API commands (or "/" as built-in slash
// commands) even when called from a script, not just when typed by a user.
// Several call sites below interpolate text that originates on the other
// side of the WebSocket connection (chat text, sender/client names, dice
// expressions, adventure-log entries) -- i.e. it isn't something this
// script controls. Escaping it before it reaches sendChat() prevents a
// malicious/compromised peer from injecting HTML into the GM's chat pane
// or smuggling a leading "!"/"/" into a rendered message.
function escapeChatText(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function sendToChat(message, type) {
    type = type || 'public';
    if (typeof sendChat !== 'undefined') {
        if (type === 'gm') {
            sendChat('GM', message);
        } else {
            sendChat('Fate\'s Edge', message);
        }
    } else {
        console.log('[CHAT] ' + message);
    }
}

function updateStatus(status) {
    var statusMsg = status === 'connected'
        ? '🟢 Connected to Fate\'s Edge v2.1.0'
        : '🔴 Disconnected from Fate\'s Edge';
    log(statusMsg);
}

function collectCharacters() {
    var characters = [];
    try {
        if (typeof Campaign !== 'undefined' && Campaign.characters) {
            Campaign.characters.forEach(function(char) {
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
        log('Failed to collect characters: ' + err.message, 'error');
    }
    return characters;
}

function parseDiceExpression(expr) {
    var parts = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!parts) {
        var num = parseInt(expr) || 0;
        return { total: num, rolls: [num] };
    }

    var count = parseInt(parts[1]);
    var sides = parseInt(parts[2]);
    var modifier = parseInt(parts[3]) || 0;

    var rolls = [];
    var total = 0;
    for (var i = 0; i < count; i++) {
        var roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
    }
    total += modifier;

    return { total: total, rolls: rolls };
}

// ============================================================
// Roll20 Hooks
// ============================================================

try {
    // Chat message hook
    on('chat:message', function(msg) {
        if (msg.type !== 'general') return;
        if (!CONFIG.syncChat) return;
        if (msg.who === 'Fate\'s Edge') return;

        var text = msg.content;
        text = text.replace(/<[^>]+>/g, '');
        text = text.replace(/^Fate's Edge:\s*/, '');
        if (!text.trim()) return;

        sendChatMessage(text.trim());
    });

    // Dice roll hook
    on('chat:message', function(msg) {
        if (msg.type !== 'rollresult') return;
        if (!CONFIG.syncRolls) return;

        var content = msg.content;
        var match = content.match(/<div[^>]*>(.*?)<\/div>/i);
        if (match) {
            var text = match[1].replace(/<[^>]+>/g, '').trim();
            var rollMatch = text.match(/\[\[([^\]]+)\]\]/);
            if (rollMatch) {
                var expr = rollMatch[1];
                sendRoll(expr);
            }
        }
    });

    // Page change hook
    if (typeof on === 'function') {
        on('change:campaign:currentpage', function() {
            if (!CONFIG.syncScenes) return;
            try {
                var page = Campaign.currentPage;
                if (page && page.name) {
                    // NOTE: this used to send `{ type: 'sync-state', state: {...} }`.
                    // On the server, a client-sent 'sync-state' is handled
                    // identically to 'whiteboard-update' -- it REPLACES the
                    // room's entire whiteboard object (drawings, notes,
                    // images, grid-combat tokens, everything) with whatever
                    // is in `state`. Since scene sync defaults to on, every
                    // GM page change was silently wiping the shared
                    // whiteboard for the whole room. 'scene-status-update'
                    // is a plain broadcast-only event the server relays
                    // as-is without touching any room state, which is what
                    // this notification actually needs.
                    sendMessage({
                        type: 'scene-status-update',
                        scene: { name: page.name }
                    });
                }
            } catch (err) {
                log('Failed to sync scene: ' + err.message, 'error');
            }
        });
    }

} catch (err) {
    log('Failed to register hooks: ' + err.message, 'error');
}

// ============================================================
// API Commands for Roll20 Macros
// ============================================================

function registerCommands() {
    on('ready', function() {
        if (CONFIG.autoConnect) {
            connect();
        }

        on('chat:message', function(msg) {
            if (msg.type !== 'api') return;
            var args = msg.content.split(' ');
            var command = args[0];

            if (command === '!fates-edge') {
                var subcommand = args[1] || '';
                var param = args.slice(2).join(' ');

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
                        var statusMsg = connected ? '🟢 Connected' : '🔴 Disconnected';
                        sendToChat('Fate\'s Edge status: ' + statusMsg);
                        sendToChat('Region: ' + currentRegion);
                        sendToChat('Deck: ' + deckState.remaining + ' cards remaining');
                        sendToChat('Modules: ' + loadedModules.length + ' loaded');
                        sendToChat('Characters: ' + vttCharacters.size + ' synced');
                        sendToChat('Whiteboard: ' + (whiteboard.drawings ? whiteboard.drawings.length : 0) + ' drawings, ' + (whiteboard.notes ? whiteboard.notes.length : 0) + ' notes, ' + (whiteboard.images ? whiteboard.images.length : 0) + ' images');
                        if (gridCombat.enabled) {
                            sendToChat('⚔️ Grid combat: ' + gridCombat.gridType + ', ' + (gridCombat.tokens ? gridCombat.tokens.length : 0) + ' tokens');
                        }
                        var gm = getCurrentGM();
                        sendToChat('GM: ' + (gm ? gm.name : 'None'));
                        sendToChat('Your role: ' + myRole);
                        if (adventureState.title) {
                            sendToChat('Adventure: ' + adventureState.title + ' (' + adventureState.status + ')');
                            if (adventureState.currentScene) {
                                sendToChat('  Scene: ' + adventureState.currentScene.title);
                            }
                            if (adventureState.activeEncounter) {
                                var enc = adventureState.activeEncounter;
                                sendToChat('  Encounter: ' + (enc.name || enc.creatureId || 'Active'));
                            }
                        }
                        break;

                    case 'send':
                        if (param) {
                            sendChatMessage(param);
                            sendToChat('📤 Sent: ' + param);
                        }
                        break;

                    case 'roll':
                        if (param) {
                            var rollResult = parseDiceExpression(param);
                            sendRoll(param);
                            sendToChat('🎲 Rolled: ' + param + ' = ' + rollResult.total);
                        }
                        break;

                    // Deck Commands
                    case 'draw':
                        var count = parseInt(param) || 1;
                        sendDeckDraw(Math.min(count, 5));
                        sendToChat('🃏 Drawing ' + Math.min(count, 5) + ' cards...');
                        break;

                    case 'crown':
                        sendCrownSpread(param || currentRegion);
                        sendToChat('👑 Crown Spread from ' + (param || currentRegion) + '...');
                        break;

                    // NEW: Assistant GM suggestion Approve/Reject chat
                    // buttons (see handleAssistantSuggestionCreated
                    // above). Roll20 API buttons work by sending this
                    // exact command as a chat message when clicked --
                    // this just relays it to the AI GM Bot as the same
                    // `!gm approve/reject <id>` chat command a human GM
                    // would type, over the existing chat-message
                    // connection. No new client->server request type.
                    case 'suggestion':
                        var subAction = args[2];
                        var suggId = args[3];
                        if ((subAction !== 'approve' && subAction !== 'reject') || !suggId) {
                            sendToChat('Usage: !fates-edge suggestion approve|reject <id>');
                            break;
                        }
                        if (resolvedAssistantSuggestions[suggId]) {
                            sendToChat('📋 Suggestion ' + suggId + ' was already resolved (' + resolvedAssistantSuggestions[suggId] + ').');
                            break;
                        }
                        sendChatMessage('!gm ' + subAction + ' ' + suggId);
                        sendToChat((subAction === 'approve' ? '✅ Approving' : '🗑️ Rejecting') + ' ' + suggId + '...');
                        break;

                    case 'shuffle':
                        sendDeckShuffle();
                        sendToChat('🔀 Shuffling deck...');
                        break;

                    case 'region':
                        if (param) {
                            sendRegionUpdate(param);
                            sendToChat('📍 Region set to: ' + param);
                        } else {
                            sendToChat('📍 Current region: ' + currentRegion);
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
                            var chars = collectCharacters();
                            syncCharacters(chars);
                            sendToChat('📤 Synced ' + chars.length + ' characters');
                        } else if (param === 'scene') {
                            try {
                                var page = Campaign.currentPage;
                                if (page && page.name) {
                                    // See the note in the change:campaign:currentpage
                                    // hook above -- 'sync-state' overwrites the whole
                                    // room whiteboard. 'scene-status-update' is a
                                    // safe, broadcast-only alternative.
                                    sendMessage({
                                        type: 'scene-status-update',
                                        scene: { name: page.name }
                                    });
                                    sendToChat('🎬 Synced scene: ' + page.name);
                                }
                            } catch (err) {
                                sendToChat('Failed to sync scene: ' + err.message);
                            }
                        } else {
                            sendSyncRequest(param || 'all');
                            sendToChat('🔄 Sync requested');
                        }
                        break;

                    // GM Commands
                    case 'gm':
                        var gmSub = args[2] || '';
                        var gmParam = args.slice(3).join(' ');

                        if (gmSub === 'request') {
                            requestGM();
                        } else if (gmSub === 'approve') {
                            if (!gmParam) {
                                sendToChat('Usage: !fates-edge gm approve <playerId>');
                                break;
                            }
                            var target = null;
                            for (var id in clients) {
                                if (clients.hasOwnProperty(id)) {
                                    var c = clients[id];
                                    if (c.id === gmParam || c.name.toLowerCase() === gmParam.toLowerCase()) {
                                        target = c;
                                        break;
                                    }
                                }
                            }
                            if (!target) {
                                sendToChat('❌ Player "' + gmParam + '" not found. Use !fates-edge gm list to see clients.');
                                break;
                            }
                            approveGM(target.id);
                        } else if (gmSub === 'reject') {
                            if (!gmParam) {
                                sendToChat('Usage: !fates-edge gm reject <playerId>');
                                break;
                            }
                            var target = null;
                            for (var id in clients) {
                                if (clients.hasOwnProperty(id)) {
                                    var c = clients[id];
                                    if (c.id === gmParam || c.name.toLowerCase() === gmParam.toLowerCase()) {
                                        target = c;
                                        break;
                                    }
                                }
                            }
                            if (!target) {
                                sendToChat('❌ Player "' + gmParam + '" not found.');
                                break;
                            }
                            rejectGM(target.id);
                        } else if (gmSub === 'status') {
                            var gm = getCurrentGM();
                            var gmName = gm ? gm.name : 'None';
                            var pending = getPendingRequests();
                            sendToChat('👑 **GM Status**\nCurrent GM: ' + gmName + '\nPending requests: ' + pending.length);
                            if (pending.length > 0) {
                                var list = pending.map(function(r) { return r.requesterName; }).join(', ');
                                sendToChat('Requests from: ' + list);
                            }
                        } else if (gmSub === 'list') {
                            var clientList = '';
                            for (var id in clients) {
                                if (clients.hasOwnProperty(id)) {
                                    var c = clients[id];
                                    var isGM = c.id === gmId ? '👑 ' : '';
                                    var isSelf = c.id === clientId ? ' (you)' : '';
                                    clientList += isGM + c.name + isSelf + ' — ' + c.role + '\n';
                                }
                            }
                            sendToChat('👥 **Clients**\n' + clientList);
                        } else {
                            sendToChat('GM Commands:\n!fates-edge gm request        - Request to become GM\n!fates-edge gm approve <name> - Approve a pending GM request (GM only)\n!fates-edge gm reject <name>  - Reject a pending GM request (GM only)\n!fates-edge gm status         - Show current GM and pending requests\n!fates-edge gm list           - List all clients with roles');
                        }
                        break;

                    // ─── v4.8: Role Commands (Co-GM / Player / Spectator) ────
                    // Separate from 'gm' above, which stays dedicated to the
                    // single GM seat -- promoting/demoting anyone else goes
                    // through here instead.
                    case 'role':
                        var roleSub = args[2] || '';
                        var roleParams = args.slice(3);

                        if (roleSub === 'set') {
                            var roleTarget = roleParams[0];
                            var roleValue = roleParams[1];
                            var rolePersist = roleParams[2] === 'save';
                            if (!roleTarget || !roleValue) {
                                sendToChat('Usage: !fates-edge role set <player> <co-gm|assistant-gm|player|spectator> [save]');
                                break;
                            }
                            var rTarget = null;
                            for (var rid in clients) {
                                if (clients.hasOwnProperty(rid)) {
                                    var rc = clients[rid];
                                    if (rc.id === roleTarget || rc.name.toLowerCase() === roleTarget.toLowerCase()) {
                                        rTarget = rc;
                                        break;
                                    }
                                }
                            }
                            if (!rTarget) {
                                sendToChat('❌ Client "' + roleTarget + '" not found. Use !fates-edge role list to see clients.');
                                break;
                            }
                            if (changeRole(rTarget.id, roleValue, rolePersist)) {
                                sendToChat('🎭 Requested: ' + rTarget.name + ' → ' + roleValue + (rolePersist ? ' (saved)' : ''));
                            }
                        } else if (roleSub === 'list') {
                            var roleList = '';
                            for (var lid in clients) {
                                if (clients.hasOwnProperty(lid)) {
                                    var lc = clients[lid];
                                    var lIsSelf = lc.id === clientId ? ' (you)' : '';
                                    roleList += lc.name + lIsSelf + ' — ' + lc.role + '\n';
                                }
                            }
                            sendToChat('🎭 **Roles**\n' + roleList);
                        } else {
                            sendToChat('Role Commands:\n!fates-edge role set <player> <co-gm|assistant-gm|player|spectator> [save] - Change a client\'s role (GM only; "save" persists a Co-GM/Assistant GM grant across reconnects). "assistant-gm" is typically assigned to the AI GM Bot\'s own client.\n!fates-edge role list - List all clients with roles');
                        }
                        break;

                    // ─── NEW: Adventure Engine Commands ──────────────────────

                    case 'adventure':
                        var advSub = args[2] || '';
                        var advParams = args.slice(3);

                        if (advSub === 'load') {
                            if (!advParams[0]) {
                                sendToChat('Usage: !fates-edge adventure load <moduleId>');
                                break;
                            }
                            sendAdventureLoad(advParams[0]);
                        } else if (advSub === 'scene') {
                            var actIdx = advParams[0] !== undefined ? parseInt(advParams[0]) : undefined;
                            var sceneIdx = advParams[1] !== undefined ? parseInt(advParams[1]) : undefined;
                            sendAdventureScene(actIdx, sceneIdx);
                        } else if (advSub === 'encounter') {
                            var encSub = advParams[0] || '';
                            var encRef = advParams[1] || '';
                            if (encSub === 'start') {
                                if (!encRef) {
                                    sendToChat('Usage: !fates-edge adventure encounter start <ref>');
                                    break;
                                }
                                sendAdventureEncounterStart(encRef);
                            } else if (encSub === 'resolve') {
                                var outcome = advParams[1] || '';
                                var notes = advParams.slice(2).join(' ');
                                if (!outcome || ['clean', 'partial', 'miss'].indexOf(outcome) === -1) {
                                    sendToChat('Usage: !fates-edge adventure encounter resolve <clean|partial|miss> [notes]');
                                    break;
                                }
                                sendAdventureEncounterResolve(outcome, notes);
                            } else {
                                sendToChat('Encounter subcommands: start <ref>, resolve <outcome> [notes]');
                            }
                        } else if (advSub === 'timer') {
                            var timerName = advParams[0] || '';
                            var timerAmount = advParams[1] !== undefined ? parseInt(advParams[1]) : 1;
                            var timerScope = advParams[2] || 'scene';
                            if (!timerName) {
                                sendToChat('Usage: !fates-edge adventure timer <name> [amount] [scene|campaign]');
                                break;
                            }
                            sendAdventureTimer(timerName, timerAmount, timerScope);
                        } else if (advSub === 'log') {
                            var logText = advParams.join(' ');
                            if (!logText) {
                                sendToChat('Usage: !fates-edge adventure log <text> [author]');
                                break;
                            }
                            // Author is the last word if we want, but we'll let the user specify author as an optional param
                            // For simplicity, we'll use the provided author if exactly one param after text? Hard to parse.
                            // We'll default to the player name and let the user include author in the text if they want.
                            sendAdventureLog(logText);
                        } else if (advSub === 'status') {
                            sendAdventureStatus();
                        } else if (advSub === 'reference') {
                            sendAdventureReference();
                        } else if (advSub === 'reset') {
                            sendAdventureReset();
                        } else if (advSub === 'reveal') {
                            if (!advParams[0]) {
                                sendToChat('Usage: !fates-edge adventure reveal <id>');
                                break;
                            }
                            sendAdventureKnowledgeReveal(advParams[0]);
                        } else if (advSub === 'hide') {
                            if (!advParams[0]) {
                                sendToChat('Usage: !fates-edge adventure hide <id>');
                                break;
                            }
                            sendAdventureKnowledgeHide(advParams[0]);
                        } else {
                            sendToChat('Adventure Commands:\n!fates-edge adventure load <moduleId>\n!fates-edge adventure scene [actIndex] [sceneIndex]\n!fates-edge adventure encounter start <ref>\n!fates-edge adventure encounter resolve <clean|partial|miss> [notes]\n!fates-edge adventure timer <name> [amount] [scene|campaign]\n!fates-edge adventure log <text>\n!fates-edge adventure status\n!fates-edge adventure reference\n!fates-edge adventure reset\n!fates-edge adventure reveal <id>\n!fates-edge adventure hide <id>');
                        }
                        break;

                    // ─── NEW: Ad-Hoc Timer Commands (server/timers.js) ───
                    // Deliberately a SEPARATE top-level command from
                    // "adventure timer" above -- see the case-statement
                    // comment near handleAdhocTimerState() for the full
                    // rationale (GM/AI-improvised timers independent of
                    // any loaded adventure module).
                    case 'timer':
                        var timerSub = args[2] || '';
                        var timerParams = args.slice(3);

                        if (timerSub === 'add') {
                            var newTimerName = timerParams[0] || '';
                            var newTimerSegments = timerParams[1] !== undefined ? parseInt(timerParams[1]) : undefined;
                            var newTimerDesc = timerParams.slice(2).join(' ');
                            if (!newTimerName || !newTimerSegments) {
                                sendToChat('Usage: !fates-edge timer add <name> <segments> [description]');
                                break;
                            }
                            sendAdhocTimerAdd(newTimerName, newTimerSegments, newTimerDesc);
                        } else if (timerSub === 'tick') {
                            var tickTimerName = timerParams[0] || '';
                            var tickAmount = timerParams[1] !== undefined ? parseInt(timerParams[1]) : 1;
                            if (!tickTimerName) {
                                sendToChat('Usage: !fates-edge timer tick <name> [amount]');
                                break;
                            }
                            sendAdhocTimerTick(tickTimerName, tickAmount);
                        } else if (timerSub === 'remove') {
                            var removeTimerName = timerParams[0] || '';
                            if (!removeTimerName) {
                                sendToChat('Usage: !fates-edge timer remove <name>');
                                break;
                            }
                            sendAdhocTimerRemove(removeTimerName);
                        } else if (timerSub === 'list' || timerSub === 'status' || timerSub === '') {
                            sendAdhocTimerList();
                        } else {
                            sendToChat('Timer Commands:\n!fates-edge timer add <name> <segments> [description]\n!fates-edge timer tick <name> [amount]\n!fates-edge timer remove <name>\n!fates-edge timer list');
                        }
                        break;

                    // ─── end new ────────────────────────────────────────

                    default:
                        sendToChat([
                            'Fate\'s Edge v2.1.0 Commands:',
                            '!fates-edge connect                - Connect to server',
                            '!fates-edge disconnect             - Disconnect',
                            '!fates-edge status                 - Show status',
                            '!fates-edge send <message>         - Send chat',
                            '!fates-edge roll <dice>            - Roll dice',
                            '!fates-edge draw [N]               - Draw N cards (1-5)',
                            '!fates-edge crown [region]         - Crown Spread',
                            '!fates-edge shuffle                - Shuffle deck',
                            '!fates-edge region [name]          - Set/get region',
                            '!fates-edge modules list           - List modules',
                            '!fates-edge sync [characters|scene|all] - Sync state',
                            '!fates-edge gm ...                 - GM management (see !fates-edge gm help)',
                            '!fates-edge adventure ...          - Adventure Engine (see !fates-edge adventure help)'
                        ].join('\n'));
                }
            }
        });
    });
}

// ============================================================
// Initialize
// ============================================================

registerCommands();

log('Fate\'s Edge Roll20 API module v2.1.0 loaded');
log('Server: ' + CONFIG.serverUrl);
log('Room: ' + CONFIG.roomCode);
log('Region: ' + currentRegion);
log('Auto-connect: ' + CONFIG.autoConnect);

if (CONFIG.autoConnect) {
    connect();
}