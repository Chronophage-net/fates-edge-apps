#!/usr/bin/env node

/**
 * Fate's Edge Terminal Client v1.4.0
 * A MUD-style CLI client for the Fate's Edge WebSocket server.
 * 
 * Features:
 * - Real-time chat
 * - Dice rolling (with basic parser)
 * - Deck operations (draw, shuffle, crown spread)
 * - Module management (list, push, cleanup)
 * - GM election & promotion
 * - Region setting
 * - Presence and client list
 * - ANSI colored output
 * - Admin mode (kick/ban/unban via REST API) when API key provided
 * 
 * Usage: node terminal-client.js [--api-key <key>]
 *        or set API_KEY environment variable
 */

const WebSocket = require('ws');
const readline = require('readline');
const crypto = require('crypto');

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
    defaultServerUrl: 'ws://localhost:3000',
    defaultRoom: 'ABC123',
    defaultName: 'Terminal Player',
    defaultPassword: 'password123',
    reconnectDelay: 3000,
    maxReconnectAttempts: 5
};

// ============================================================
// Admin API key (from env or command line)
// ============================================================
let adminApiKey = process.env.API_KEY || null;

// Simple command line argument parsing for --api-key
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--api-key' && i + 1 < process.argv.length) {
        adminApiKey = process.argv[++i];
    }
}

const ADMIN_MODE = !!adminApiKey;

// Derive REST API base URL from the server URL (ws:// -> http://)
function getApiBaseUrl(serverUrl) {
    // Replace ws:// or wss:// with http:// or https://
    const httpUrl = serverUrl.replace(/^ws/, 'http');
    // Remove trailing slash if present
    return httpUrl.replace(/\/$/, '') + '/api';
}

let apiBaseUrl = getApiBaseUrl(CONFIG.defaultServerUrl);

// ============================================================
// ANSI Colors
// ============================================================

const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
    white: "\x1b[37m"
};

// ============================================================
// State
// ============================================================

let ws = null;
let connected = false;
let clientName = CONFIG.defaultName;
let roomCode = CONFIG.defaultRoom;
let serverUrl = CONFIG.defaultServerUrl;
let password = CONFIG.defaultPassword;
let reconnectTimer = null;
let reconnectAttempts = 0;

// GM state
let clients = {};          // id -> { id, name, role, ... }
let gmId = null;           // clientId of current GM
let pendingRequests = [];  // [ { requesterId, requesterName }, ... ]
let myRole = 'player';     // role of this client

// Deck state
let deckRemaining = 0;
let defaultRegion = 'Acasia';

// ============================================================
// Readline Interface
// ============================================================

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.gray}>${colors.reset} `
});

// ============================================================
// Logging/Printing Helpers
// ============================================================

function printSystemMessage(msg, color = colors.gray) {
    process.stdout.write('\r\x1b[K');
    console.log(`${color}[System] ${msg}${colors.reset}`);
    rl.prompt(true);
}

function printChatMessage(sender, text) {
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.cyan}[${sender}]: ${colors.reset}${text}`);
    rl.prompt(true);
}

function printRollResult(sender, formula, result, details = '') {
    process.stdout.write('\r\x1b[K');
    const detailStr = details ? ` (${details})` : '';
    console.log(`${colors.yellow}🎲 ${sender} rolled ${formula}: ${colors.bold}${result}${colors.reset}${detailStr}`);
    rl.prompt(true);
}

function printDeckDraw(count, region, cards, synthesis) {
    process.stdout.write('\r\x1b[K');
    const cardNames = cards.map(c => {
        if (c.is_joker) return '🃏 Joker';
        return `${c.rank_name || c.rank} of ${c.suit_name || c.suit}`;
    }).join(', ');
    console.log(`${colors.magenta}🃏 Drew ${count} card${count > 1 ? 's' : ''} from ${region}:${colors.reset}`);
    console.log(`  ${cardNames}`);
    if (synthesis) {
        console.log(`${colors.dim}${synthesis}${colors.reset}`);
    }
    console.log(`${colors.gray}Cards remaining: ${deckRemaining}${colors.reset}`);
    rl.prompt(true);
}

function printCrownSpread(result) {
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.magenta}👑 Crown Spread:${colors.reset}`);
    if (result.positions) {
        result.positions.forEach(p => {
            console.log(`  ${p.icon} ${p.label}: ${p.meaning}`);
        });
    }
    if (result.wildcard) {
        console.log(`  🌟 Wildcard: ${result.wildcard}`);
    }
    rl.prompt(true);
}

function printGMStatus() {
    const gm = getCurrentGM();
    const gmName = gm ? gm.name : 'None';
    const pending = pendingRequests;
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.yellow}👑 GM Status:${colors.reset}`);
    console.log(`  Current GM: ${gmName}`);
    console.log(`  Your role: ${myRole}`);
    if (pending.length > 0) {
        console.log(`  Pending requests (${pending.length}):`);
        pending.forEach(r => console.log(`    - ${r.requesterName} (ID: ${r.requesterId})`));
    } else {
        console.log(`  No pending requests.`);
    }
    rl.prompt(true);
}

function printClientList() {
    const clientList = Object.values(clients);
    if (clientList.length === 0) {
        printSystemMessage('No clients in room.');
        return;
    }
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.cyan}👥 Clients (${clientList.length}):${colors.reset}`);
    clientList.forEach(c => {
        const isGM = c.id === gmId ? '👑 ' : '';
        const isSelf = c.id === ws?.clientId ? ' (you)' : '';
        const role = c.role || 'player';
        console.log(`  ${isGM}${c.name}${isSelf} — ${role}`);
    });
    rl.prompt(true);
}

function printHelp() {
    process.stdout.write('\r\x1b[K');
    console.log(`
${colors.magenta}╔══════════════════════════════════════════════════════════════╗
║  Fate's Edge Terminal Client v1.4.0 - Commands               ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}

${colors.yellow}Connection:${colors.reset}
  /connect [url]              Connect to server (default: ${CONFIG.defaultServerUrl})
  /disconnect                 Disconnect
  /status                     Show connection and room status

${colors.yellow}Chat & Dice:${colors.reset}
  <message>                   Send chat message
  /roll <dice> [reason]       Roll dice (e.g., /roll 3d6+2 "Attack")
  /name <name>                Change your display name

${colors.yellow}Deck:${colors.reset}
  /draw [count] [region]      Draw cards (1-5, default: 1, region: ${defaultRegion})
  /crown [region]             Perform Crown Spread
  /shuffle                    Shuffle the deck
  /deck-status                Show deck remaining

${colors.yellow}GM Management:${colors.reset}
  /gm request                 Request to become GM
  /gm approve <id|name>       Approve a GM request (GM only)
  /gm reject <id|name>        Reject a GM request (GM only)
  /gm status                  Show current GM and pending requests
  /gm list                    List all clients with roles

${colors.yellow}Modules:${colors.reset}
  /modules list               List loaded modules
  /modules push <moduleId>    Push a module to clients
  /modules cleanup <moduleId> Cleanup a module from clients

${colors.yellow}Region:${colors.reset}
  /region [name]              Set or show default region

${colors.yellow}Other:${colors.reset}
  /who                        Request presence update
  /help                       Show this help
  /quit / exit                Quit the client
${ADMIN_MODE ? `
${colors.yellow}Admin (API Key Active):${colors.reset}
  /admin players              List all clients (via REST API)
  /admin kick <player|id> [reason]  Kick a player
  /admin ban <player|id> [reason]   Ban a player
  /admin unban <clientId>     Unban a client ID
` : ''}
`);
    rl.prompt(true);
}

// ============================================================
// REST API helper (Admin mode)
// ============================================================

function makeApiRequest(endpoint, method = 'GET', data = null) {
    const url = `${apiBaseUrl}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': adminApiKey
        }
    };
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }
    return fetch(url, options)
        .then(res => {
            if (!res.ok) {
                return res.text().then(text => {
                    throw new Error(`HTTP ${res.status}: ${text}`);
                });
            }
            return res.json();
        });
}

async function getClientIdFromApi(name) {
    if (!ADMIN_MODE || !roomCode) return null;
    try {
        const result = await makeApiRequest(`/rooms/${roomCode}/clients`);
        const clientsList = result.clients || [];
        const client = clientsList.find(c => c.name && c.name.toLowerCase() === name.toLowerCase());
        return client ? client.id : null;
    } catch (err) {
        printSystemMessage(`API error: ${err.message}`, colors.red);
        return null;
    }
}

async function handleAdminCommand(args) {
    if (!ADMIN_MODE) {
        printSystemMessage('Admin mode not available. Set API_KEY environment variable or pass --api-key.', colors.red);
        return;
    }
    if (!roomCode) {
        printSystemMessage('Not connected to a room. Admin commands require a room code.', colors.red);
        return;
    }

    const subCmd = args[0]?.toLowerCase();
    const arg1 = args[1];
    const reason = args.slice(2).join(' ') || 'Admin action from terminal';

    try {
        switch (subCmd) {
            case 'players':
            case 'list':
                const listResult = await makeApiRequest(`/rooms/${roomCode}/clients`);
                const clientList = listResult.clients || [];
                printSystemMessage(`👥 Clients in room (${clientList.length}):`);
                clientList.forEach(c => {
                    console.log(`  \`${c.id}\` - ${c.name} (${c.role})`);
                });
                rl.prompt(true);
                break;

            case 'kick':
                if (!arg1) { printSystemMessage('Usage: /admin kick <player name or ID> [reason]', colors.red); return; }
                const kickTargetId = await resolveTargetId(arg1);
                if (!kickTargetId) return;
                await makeApiRequest(`/rooms/${roomCode}/clients/${kickTargetId}/kick`, 'POST', { reason });
                printSystemMessage(`👢 Kicked ${arg1} (${kickTargetId})`);
                break;

            case 'ban':
                if (!arg1) { printSystemMessage('Usage: /admin ban <player name or ID> [reason]', colors.red); return; }
                const banTargetId = await resolveTargetId(arg1);
                if (!banTargetId) return;
                await makeApiRequest(`/rooms/${roomCode}/clients/${banTargetId}/ban`, 'POST', { reason });
                printSystemMessage(`🚫 Banned ${arg1} (${banTargetId})`);
                break;

            case 'unban':
                if (!arg1) { printSystemMessage('Usage: /admin unban <client ID>', colors.red); return; }
                await makeApiRequest(`/rooms/${roomCode}/clients/${arg1}/unban`, 'POST');
                printSystemMessage(`✅ Unbanned ${arg1}`);
                break;

            default:
                printSystemMessage('Admin commands: players, kick, ban, unban');
        }
    } catch (err) {
        printSystemMessage(`Admin error: ${err.message}`, colors.red);
    }
}

async function resolveTargetId(identifier) {
    // If it looks like a client ID (ws-... or 20-character hex), use directly
    if (identifier.startsWith('ws-') || /^[a-f0-9]{20}$/i.test(identifier)) {
        return identifier;
    }
    // Otherwise, resolve by name via API
    const id = await getClientIdFromApi(identifier);
    if (!id) {
        printSystemMessage(`Player "${identifier}" not found.`, colors.red);
    }
    return id;
}

// ============================================================
// WebSocket Connection
// ============================================================

function connectToServer(url = serverUrl, room = roomCode) {
    if (connected) {
        printSystemMessage('Already connected. Use /disconnect first.');
        return;
    }

    serverUrl = url;
    roomCode = room;
    apiBaseUrl = getApiBaseUrl(serverUrl);   // update REST API base URL

    printSystemMessage(`Connecting to ${serverUrl}/${roomCode}...`);

    try {
        ws = new WebSocket(`${serverUrl}/${roomCode}`);

        ws.on('open', () => {
            connected = true;
            reconnectAttempts = 0;
            printSystemMessage('Connected! Sending handshake...');
            const handshake = {
                type: 'handshake',
                campaignCode: roomCode,
                password: password,
                clientName: clientName,
                role: 'player',
                version: '1.4.0'
            };
            ws.send(JSON.stringify(handshake));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                handleMessage(message);
            } catch (e) {
                printSystemMessage(`Failed to parse message: ${e.message}`, colors.red);
            }
        });

        ws.on('close', (code, reason) => {
            connected = false;
            printSystemMessage(`Disconnected from server (${code} - ${reason || 'No reason'})`);
            if (code !== 1000) {
                scheduleReconnect();
            }
        });

        ws.on('error', (err) => {
            printSystemMessage(`Connection error: ${err.message}`, colors.red);
            scheduleReconnect();
        });

    } catch (err) {
        printSystemMessage(`Failed to connect: ${err.message}`, colors.red);
    }
}

function disconnect() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws) {
        try {
            ws.close(1000, 'Disconnected by user');
        } catch (e) {}
        ws = null;
    }
    connected = false;
    // Reset GM state
    clients = {};
    gmId = null;
    pendingRequests = [];
    myRole = 'player';
    printSystemMessage('Disconnected.');
    rl.prompt(true);
}

function scheduleReconnect() {
    if (reconnectAttempts >= CONFIG.maxReconnectAttempts) {
        printSystemMessage('Max reconnection attempts reached. Use /connect to try again.', colors.red);
        return;
    }
    const delay = Math.min(CONFIG.reconnectDelay * Math.pow(1.5, reconnectAttempts), 30000);
    reconnectAttempts++;
    printSystemMessage(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${CONFIG.maxReconnectAttempts})...`);
    reconnectTimer = setTimeout(() => {
        if (!connected) {
            connectToServer(serverUrl, roomCode);
        }
    }, delay);
}

// ============================================================
// Message Handler (WebSocket)
// ============================================================

function handleMessage(message) {
    switch (message.type) {
        case 'handshake_ack':
            printSystemMessage(`Handshake successful! You are connected as ${clientName}.`);
            if (message.activeClients && message.activeClients.length > 0) {
                const names = message.activeClients.map(c => c.name).join(', ');
                printSystemMessage(`Players online: ${names}`);
                updateClients(message.activeClients);
            }
            break;

        case 'chat_message':
            printChatMessage(message.value?.sender || message.sender, message.value?.text || message.text);
            break;

        case 'roll_result':
            const sender = message.value?.sender || message.sender;
            const formula = message.value?.formula || message.expr || 'dice';
            const result = message.value?.result || message.total || 0;
            const rolls = message.value?.rolls || [];
            const details = rolls.length > 0 ? rolls.join(', ') : '';
            printRollResult(sender, formula, result, details);
            break;

        case 'presence':
            if (message.clients) {
                updateClients(message.clients);
                printSystemMessage(`Presence update: ${message.clients.length} clients online.`);
            }
            break;

        case 'client-joined':
            const name = message.data?.name || 'Unknown';
            printSystemMessage(`${name} joined the room.`);
            if (message.clients) updateClients(message.clients);
            break;

        case 'client-left':
            printSystemMessage(`A client left the room.`);
            if (message.clientId) {
                delete clients[message.clientId];
                if (gmId === message.clientId) {
                    gmId = null;
                    updateGmFromClients();
                }
            }
            break;

        // Deck events
        case 'deck-drawn':
            const cards = message.cards || [];
            const region = message.region || defaultRegion;
            const synthesis = message.synthesis || '';
            deckRemaining = message.remaining || 0;
            printDeckDraw(cards.length, region, cards, synthesis);
            break;

        case 'deck-shuffled':
            deckRemaining = message.remaining || 54;
            printSystemMessage(`🔀 Deck shuffled. ${deckRemaining} cards remaining.`);
            break;

        case 'crown-spread':
            printCrownSpread(message.result || {});
            deckRemaining = message.remaining || 0;
            break;

        // Module events
        case 'module-list':
            const modules = message.modules || [];
            if (modules.length === 0) {
                printSystemMessage('No modules loaded.');
            } else {
                const names = modules.map(m => m.name || m.id).join(', ');
                printSystemMessage(`📦 Loaded modules: ${names}`);
            }
            break;

        case 'module-push':
            const module = message.module || {};
            const moduleName = module.manifest?.name || module.id || 'Unknown';
            printSystemMessage(`📦 Module pushed: ${moduleName}`);
            break;

        case 'module-cleanup':
            printSystemMessage(`🧹 Module cleanup requested: ${message.moduleId || 'Unknown'}`);
            break;

        case 'region-updated':
            if (message.region) {
                defaultRegion = message.region;
                printSystemMessage(`📍 Region updated to: ${defaultRegion}`);
            }
            break;

        // GM events
        case 'gm_vote_request':
            const requesterId = message.requesterId;
            const requesterName = message.requesterName;
            const currentGmId = message.currentGmId;
            const currentGmName = message.currentGmName;
            if (myRole === 'gm' && ws && ws.clientId === currentGmId) {
                if (!pendingRequests.find(r => r.requesterId === requesterId)) {
                    pendingRequests.push({ requesterId, requesterName });
                }
                printSystemMessage(`👑 ${requesterName} requests to become GM. Use /gm approve <id|name> or /gm reject <id|name>.`, colors.yellow);
            }
            break;

        case 'gm_role_update':
            const targetId = message.clientId;
            const role = message.role;
            if (targetId === ws?.clientId) {
                myRole = role;
                printSystemMessage(`Your role is now: ${role.toUpperCase()}`, colors.green);
            }
            if (clients[targetId]) {
                clients[targetId].role = role;
            }
            if (role === 'gm') {
                gmId = targetId;
            } else if (gmId === targetId) {
                updateGmFromClients();
            }
            const client = clients[targetId];
            const clientName = client ? client.name : targetId;
            printSystemMessage(`${clientName} is now ${role.toUpperCase()}.`, colors.yellow);
            break;

        case 'server_announcement':
            printSystemMessage(`📢 ${message.message}`, colors.cyan);
            break;

        case 'room-state':
            if (message.clients) {
                updateClients(message.clients);
            }
            if (message.deckRemaining !== undefined) {
                deckRemaining = message.deckRemaining;
            }
            if (message.data && message.data.region) {
                defaultRegion = message.data.region;
            }
            printSystemMessage(`Room state received. ${Object.keys(clients).length} clients online.`);
            break;

        case 'state-updated':
            printSystemMessage(`State updated by ${message.updatedBy || 'Unknown'}`);
            break;

        case 'error':
            printSystemMessage(`Server Error: ${message.message}`, colors.red);
            break;

        case 'room-closed':
            printSystemMessage('⚠️ Room closed by server.', colors.red);
            disconnect();
            break;

        case 'pong':
            // Heartbeat response - ignore
            break;

        default:
            process.stdout.write('\r\x1b[K');
            console.log(`${colors.gray}[Unknown] ${JSON.stringify(message)}${colors.reset}`);
            rl.prompt(true);
    }
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
    if (ws && ws.clientId && clients[ws.clientId]) {
        myRole = clients[ws.clientId].role;
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

function getCurrentGM() {
    return gmId ? clients[gmId] : null;
}

function sendMessage(type, data = {}) {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
        printSystemMessage('Not connected to server.', colors.red);
        return false;
    }
    const msg = { type, ...data };
    try {
        ws.send(JSON.stringify(msg));
        return true;
    } catch (e) {
        printSystemMessage(`Failed to send message: ${e.message}`, colors.red);
        return false;
    }
}

// ============================================================
// Dice Roller
// ============================================================

function rollDice(formula) {
    const parts = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!parts) {
        const num = parseInt(formula);
        if (!isNaN(num)) {
            return { formula, total: num, rolls: [num] };
        }
        return { formula, total: 0, rolls: [], error: 'Invalid dice expression' };
    }
    const count = parseInt(parts[1]);
    const sides = parseInt(parts[2]);
    const mod = parseInt(parts[3]) || 0;
    const rolls = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        rolls.push(r);
        total += r;
    }
    total += mod;
    return { formula, total, rolls };
}

// ============================================================
// Command Processor
// ============================================================

rl.on('line', (input) => {
    const trimmed = input.trim();
    if (!trimmed) {
        rl.prompt();
        return;
    }

    if (trimmed.startsWith('/')) {
        const parts = trimmed.slice(1).split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        const argStr = args.join(' ');

        switch (cmd) {
            // Connection
            case 'connect':
                if (connected) {
                    printSystemMessage('Already connected. Use /disconnect first.');
                } else {
                    const newUrl = args[0] || CONFIG.defaultServerUrl;
                    const newRoom = args[1] || CONFIG.defaultRoom;
                    connectToServer(newUrl, newRoom);
                }
                break;

            case 'disconnect':
                if (connected) {
                    disconnect();
                } else {
                    printSystemMessage('Not connected.');
                }
                break;

            case 'status':
                const status = connected ? '🟢 Connected' : '🔴 Disconnected';
                printSystemMessage(`Status: ${status}`);
                if (connected) {
                    printSystemMessage(`Server: ${serverUrl}`);
                    printSystemMessage(`Room: ${roomCode}`);
                    printSystemMessage(`Name: ${clientName}`);
                    printSystemMessage(`Region: ${defaultRegion}`);
                    printSystemMessage(`Deck: ${deckRemaining} cards remaining`);
                    const gm = getCurrentGM();
                    printSystemMessage(`GM: ${gm ? gm.name : 'None'}`);
                    printSystemMessage(`Your role: ${myRole}`);
                    printSystemMessage(`Clients: ${Object.keys(clients).length}`);
                    if (ADMIN_MODE) {
                        printSystemMessage(`Admin mode: ✅ (API key set)`, colors.green);
                    }
                }
                break;

            case 'name':
                if (argStr) {
                    clientName = argStr;
                    printSystemMessage(`Name set to: ${clientName}`);
                } else {
                    printSystemMessage(`Current name: ${clientName}`);
                }
                break;

            case 'roll':
            case 'r':
                if (!argStr) {
                    printSystemMessage('Usage: /roll <dice> [reason] (e.g., /roll 3d6+2 "Attack")');
                    break;
                }
                const rollData = rollDice(argStr);
                if (rollData.error) {
                    printSystemMessage(rollData.error, colors.red);
                    break;
                }
                if (sendMessage('roll_result', {
                    value: {
                        sender: clientName,
                        formula: rollData.formula,
                        rolls: rollData.rolls,
                        total: rollData.total
                    }
                })) {
                    printRollResult(clientName, rollData.formula, rollData.total, rollData.rolls.join(', '));
                }
                break;

            // Deck
            case 'draw':
                const count = parseInt(args[0]) || 1;
                const region = args[1] || defaultRegion;
                if (count < 1 || count > 5) {
                    printSystemMessage('Count must be between 1 and 5.', colors.red);
                    break;
                }
                sendMessage('deck-draw', { count, region });
                break;

            case 'crown':
                const crownRegion = args[0] || defaultRegion;
                sendMessage('crown-spread', { region: crownRegion });
                break;

            case 'shuffle':
                sendMessage('deck-shuffle', {});
                break;

            case 'deck-status':
                printSystemMessage(`Deck remaining: ${deckRemaining} cards`);
                break;

            case 'region':
                if (args[0]) {
                    defaultRegion = args[0];
                    sendMessage('set-region', { region: defaultRegion });
                    printSystemMessage(`Region set to: ${defaultRegion}`);
                } else {
                    printSystemMessage(`Current region: ${defaultRegion}`);
                }
                break;

            // GM
            case 'gm':
                const gmCmd = args[0]?.toLowerCase() || '';
                const gmArg = args.slice(1).join(' ');
                switch (gmCmd) {
                    case 'request':
                        sendMessage('request_gm', {});
                        printSystemMessage('GM request sent.');
                        break;

                    case 'approve': {
                        if (!gmArg) {
                            printSystemMessage('Usage: /gm approve <id|name>');
                            break;
                        }
                        const target = findClient(gmArg);
                        if (!target) {
                            printSystemMessage(`Client "${gmArg}" not found.`, colors.red);
                            break;
                        }
                        if (myRole !== 'gm') {
                            printSystemMessage('Only current GM can approve.', colors.red);
                            break;
                        }
                        sendMessage('approve_gm', { targetId: target.id });
                        pendingRequests = pendingRequests.filter(r => r.requesterId !== target.id);
                        printSystemMessage(`✅ Approved ${target.name} as GM.`);
                        break;
                    }

                    case 'reject': {
                        if (!gmArg) {
                            printSystemMessage('Usage: /gm reject <id|name>');
                            break;
                        }
                        const target = findClient(gmArg);
                        if (!target) {
                            printSystemMessage(`Client "${gmArg}" not found.`, colors.red);
                            break;
                        }
                        pendingRequests = pendingRequests.filter(r => r.requesterId !== target.id);
                        printSystemMessage(`❌ Rejected ${target.name} as GM.`);
                        break;
                    }

                    case 'status':
                        printGMStatus();
                        break;

                    case 'list':
                        printClientList();
                        break;

                    default:
                        printSystemMessage(`Unknown GM command: ${gmCmd}. Use request, approve, reject, status, list.`);
                }
                break;

            // Modules
            case 'modules':
                const modCmd = args[0]?.toLowerCase() || '';
                const modArg = args.slice(1).join(' ');
                switch (modCmd) {
                    case 'list':
                        sendMessage('module-list', {});
                        break;
                    case 'push':
                        if (!modArg) {
                            printSystemMessage('Usage: /modules push <moduleId>');
                            break;
                        }
                        sendMessage('module-push-request', { moduleId: modArg });
                        printSystemMessage(`📦 Push requested for ${modArg}`);
                        break;
                    case 'cleanup':
                        if (!modArg) {
                            printSystemMessage('Usage: /modules cleanup <moduleId>');
                            break;
                        }
                        sendMessage('module-cleanup-request', { moduleId: modArg });
                        printSystemMessage(`🧹 Cleanup requested for ${modArg}`);
                        break;
                    default:
                        printSystemMessage('Module commands: list, push <id>, cleanup <id>');
                }
                break;

            // Admin mode (REST API)
            case 'admin':
                handleAdminCommand(args);
                break;

            case 'who':
                if (connected) {
                    sendMessage('sync_request', { entity: 'presence' });
                } else {
                    printSystemMessage('Not connected.');
                }
                break;

            case 'help':
                printHelp();
                break;

            case 'quit':
            case 'exit':
                if (ws) ws.close();
                process.exit(0);
                break;

            default:
                printSystemMessage(`Unknown command: /${cmd}. Type /help for commands.`);
        }
    } else {
        // Chat message
        if (connected) {
            sendMessage('chat_message', {
                value: {
                    sender: clientName,
                    text: trimmed,
                    timestamp: Date.now()
                }
            });
            printChatMessage(clientName, trimmed);
        } else {
            printSystemMessage('Not connected. Use /connect to join.');
        }
    }
    rl.prompt();
});

// ============================================================
// Helper: Find client by ID or name (from in-memory WS state)
// ============================================================

function findClient(idOrName) {
    if (clients[idOrName]) return clients[idOrName];
    const lower = idOrName.toLowerCase();
    for (let id in clients) {
        if (clients[id].name && clients[id].name.toLowerCase() === lower) {
            return clients[id];
        }
    }
    return null;
}

// ============================================================
// Initial Welcome
// ============================================================

console.log(`${colors.magenta}╔══════════════════════════════════════════════════════════════╗`);
console.log(`${colors.magenta}║              Fate's Edge Terminal Client v1.4.0              ║`);
console.log(`${colors.magenta}╚══════════════════════════════════════════════════════════════╝${colors.reset}`);
console.log(`Type ${colors.yellow}/help${colors.reset} for commands.`);
console.log(`Set your name with ${colors.yellow}/name <Your Name>${colors.reset}`);
console.log(`Connect with ${colors.yellow}/connect [url] [room]${colors.reset}`);
if (ADMIN_MODE) {
    console.log(`${colors.green}Admin mode enabled. Use /admin for player management.${colors.reset}`);
} else {
    console.log(`${colors.dim}Tip: Set API_KEY env to enable admin commands (kick/ban/unban).${colors.reset}`);
}
console.log('');

rl.prompt();

process.on('SIGINT', () => {
    if (ws) ws.close();
    process.exit(0);
});