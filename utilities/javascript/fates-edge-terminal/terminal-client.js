#!/usr/bin/env node

/**
 * Fate's Edge Terminal Client v2.3.0 – Full WebSocket + REST API integration
 * Supports all server features:
 *   - Chat, dice rolls, deck, GM election, modules, region
 *   - Character management (list, view, update stats)
 *   - Whiteboard sync (draw, notes, images)
 *   - Grid combat (tokens, zones, combat toggle)
 *   - Admin commands (kick, ban, unban)
 *   - Dynamic ANSI banners
 */

const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────
const CONFIG = {
    defaultServerUrl: 'ws://localhost:10000',
    defaultRoom: 'ABC123',
    defaultName: 'Terminal Player',
    defaultPassword: '',
    reconnectDelay: 3000,
    maxReconnectAttempts: 5
};

// ─── Admin API key ──────────────────────────────────────────────
let adminApiKey = process.env.API_KEY || null;
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--api-key' && i + 1 < process.argv.length) {
        adminApiKey = process.argv[++i];
    }
}
const ADMIN_MODE = !!adminApiKey;

function getApiBaseUrl(serverUrl) {
    const httpUrl = serverUrl.replace(/^ws/, 'http');
    return httpUrl.replace(/\/$/, '') + '/api';
}
let apiBaseUrl = getApiBaseUrl(CONFIG.defaultServerUrl);

// ─── ANSI colors ─────────────────────────────────────────────────
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

// ─── Banners (unchanged) ────────────────────────────────────────
const BANNER_CACHE_FILE = path.join(__dirname, 'banner_cache.json');
const MAX_CACHE_SIZE = 20;
const MIN_CACHE_SIZE = 5;

const DEFAULT_BANNER = `
${colors.magenta}╔══════════════════════════════════════════════════════════╗
║                                                          ║
${colors.green}               __====-_  _-====___
        _--^^^#####//      \\\\#####^^^--_
     _-^##########// (    ) \\\\##########^-_
    -############//  |\\^^/|  \\\\############-
  _/############//   (@::@)   \\\\############\\_
 /#############((     \\\\//     ))#############\\
-###############\\    (oo)    //###############-
-#################\\  / UUU \\ //#################-
-###################\\/  (_)  \\//###################-
_#/|##########/\\#(   (_)   )#/\\##########|\\#_
|/ |#/\\#/\\#/\\/  \\#  |_|  #/  \\/\\/#/\\#/\\#| \\|
\`  |/  V  V  \`   V  )#(   V   '  V  V  \\|  '
                \`|  \`'   |
                 \\       |
                  \\  |  |
                  (  | |
                 ___)(___)
${colors.reset}
${colors.yellow}        ⚔️  Edge CLI v2.3.0 – Where fate meets stone  ⚔️${colors.reset}
${colors.magenta}╚══════════════════════════════════════════════════════════╝${colors.reset}
`;

const REMOTE_BANNER_URLS = [
    'https://ansi.hrtk.in/ungenannt_motherofsorrows.ans',
    'https://ansi.hrtk.in/us-die2.ans',
    'https://ansi.hrtk.in/fil-blaq.ans',
    'https://ansi.hrtk.in/shark-side-of-the-block.ans',
    'https://ansi.hrtk.in/NOIR014.ans',
    'https://ansi.hrtk.in/gdr-mim2.ans',
    'https://ansi.hrtk.in/SHD-UNCR.ans',
    'https://ansi.hrtk.in/22-NVR4.ans',
    'https://ansi.hrtk.in/VLDMULTI.ans',
    'https://ansi.hrtk.in/gr-zeit.ans'
];

let bannerCache = [];

function loadBannerCache() {
    try {
        const data = fs.readFileSync(BANNER_CACHE_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
            bannerCache = parsed.slice(0, MAX_CACHE_SIZE);
            return true;
        }
    } catch (e) {}
    bannerCache = [DEFAULT_BANNER];
    saveBannerCache();
    return false;
}

function saveBannerCache() {
    try {
        fs.writeFileSync(BANNER_CACHE_FILE, JSON.stringify(bannerCache, null, 2), 'utf8');
    } catch (e) {}
}

function addToCache(banner) {
    if (!banner || typeof banner !== 'string') return;
    if (bannerCache.includes(banner)) return;
    bannerCache.push(banner);
    if (bannerCache.length > MAX_CACHE_SIZE) {
        bannerCache = bannerCache.slice(-MAX_CACHE_SIZE);
    }
    saveBannerCache();
}

async function fetchRemoteBanner() {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const url = REMOTE_BANNER_URLS[Math.floor(Math.random() * REMOTE_BANNER_URLS.length)];
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            if (!text.includes('\x1b') || text.length < 20) {
                throw new Error('Not a valid ANSI art file');
            }
            return text;
        } catch (err) {
            if (attempt === maxAttempts - 1) throw err;
        }
    }
}

async function ensureBannerCache() {
    if (bannerCache.length >= MIN_CACHE_SIZE) return;
    const needed = MIN_CACHE_SIZE - bannerCache.length;
    let fetched = 0;
    for (let i = 0; i < needed * 2; i++) {
        if (fetched >= needed) break;
        try {
            const banner = await fetchRemoteBanner();
            addToCache(banner);
            fetched++;
        } catch (err) {}
    }
    if (bannerCache.length === 0) {
        bannerCache.push(DEFAULT_BANNER);
        saveBannerCache();
    }
}

function getRandomBanner() {
    if (!bannerCache.length) {
        bannerCache.push(DEFAULT_BANNER);
        saveBannerCache();
    }
    return bannerCache[Math.floor(Math.random() * bannerCache.length)];
}

loadBannerCache();
setTimeout(() => {
    ensureBannerCache().catch(() => {});
}, 500);

// ─── State ───────────────────────────────────────────────────────
let ws = null;
let connected = false;
let clientName = CONFIG.defaultName;
let roomCode = CONFIG.defaultRoom;
let serverUrl = CONFIG.defaultServerUrl;
let password = CONFIG.defaultPassword;
let reconnectTimer = null;
let reconnectAttempts = 0;

let clients = {};
let gmId = null;
let pendingRequests = [];
let myRole = 'player';
let deckRemaining = 0;
let defaultRegion = 'Acasia';
let characters = {}; // keyed by character name

// ─── Readline ──────────────────────────────────────────────────
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.gray}>${colors.reset} `
});

// ─── Print helpers ──────────────────────────────────────────────
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
    const cardNames = cards.map(c => c.is_joker ? '🃏 Joker' : `${c.rank_name || c.rank} of ${c.suit_name || c.suit}`).join(', ');
    console.log(`${colors.magenta}🃏 Drew ${count} card${count > 1 ? 's' : ''} from ${region}:${colors.reset}`);
    console.log(`  ${cardNames}`);
    if (synthesis) console.log(`${colors.dim}${synthesis}${colors.reset}`);
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
    if (result.wildcard) console.log(`  🌟 Wildcard: ${result.wildcard}`);
    rl.prompt(true);
}

function printGMStatus() {
    const gm = getCurrentGM();
    const gmName = gm ? gm.name : 'None';
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.yellow}👑 GM Status:${colors.reset}`);
    console.log(`  Current GM: ${gmName}`);
    console.log(`  Your role: ${myRole}`);
    if (pendingRequests.length > 0) {
        console.log(`  Pending requests (${pendingRequests.length}):`);
        pendingRequests.forEach(r => console.log(`    - ${r.requesterName} (ID: ${r.requesterId})`));
    } else {
        console.log(`  No pending requests.`);
    }
    rl.prompt(true);
}

function printClientList() {
    const list = Object.values(clients);
    if (list.length === 0) { printSystemMessage('No clients in room.'); return; }
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.cyan}👥 Clients (${list.length}):${colors.reset}`);
    list.forEach(c => {
        const isGM = c.id === gmId ? '👑 ' : '';
        const isSelf = c.id === ws?.clientId ? ' (you)' : '';
        console.log(`  ${isGM}${c.name}${isSelf} — ${c.role || 'player'}`);
    });
    rl.prompt(true);
}

function printCharacterList() {
    const names = Object.keys(characters);
    if (names.length === 0) {
        printSystemMessage('No characters found in room state.');
        return;
    }
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.cyan}👤 Characters (${names.length}):${colors.reset}`);
    names.forEach(name => {
        const c = characters[name];
        const hp = c.harm !== undefined ? `❤️${c.harm}` : '';
        const fatigue = c.fatigue ? `⚡${c.fatigue}` : '';
        const boons = c.boons ? `🎲${c.boons}` : '';
        const avatar = c.avatar ? '🖼️' : '';
        console.log(`  ${avatar} ${colors.bold}${name}${colors.reset} ${hp} ${fatigue} ${boons}`);
        if (c.attributes) {
            const attrStr = Object.entries(c.attributes).map(([k,v]) => `${k}:${v}`).join(' ');
            console.log(`    ${colors.dim}${attrStr}${colors.reset}`);
        }
    });
    rl.prompt(true);
}

function printHelp() {
    process.stdout.write('\r\x1b[K');
    console.log(`
${colors.magenta}╔══════════════════════════════════════════════════════════════╗
║  Edge CLI v2.3.0 - Commands                                    ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}

${colors.yellow}Connection:${colors.reset}
  /connect [url] [room]      Connect (e.g., /connect ws://localhost:10000 AIGM)
  /disconnect                 Disconnect
  /status                     Show status

${colors.yellow}Chat & Dice:${colors.reset}
  <message>                   Send chat
  /roll <dice> [reason]       Roll dice (e.g., /roll 3d6+2 "Attack")
  /name <name>                Change your name

${colors.yellow}Deck:${colors.reset}
  /draw [count] [region]      Draw cards (1-5)
  /crown [region]             Crown Spread
  /shuffle                    Shuffle deck
  /deck-status                Remaining cards

${colors.yellow}Characters (NEW):${colors.reset}
  /chars list                 List characters in room
  /chars view <name>          View character details
  /chars update <name> <field> <value>  Update a character stat
  /chars sync                 Force sync characters from server

${colors.yellow}Grid Combat (NEW):${colors.reset}
  /grid on                    Enable grid combat
  /grid off                   Disable grid combat
  /grid status                Show grid combat status
  /token add <name> [x] [y] [color]  Add token
  /token list                 List tokens
  /token remove <id>          Remove token
  /token move <id> <x> <y>    Move token

${colors.yellow}Whiteboard (NEW):${colors.reset}
  /wb status                  Show whiteboard summary
  /wb sync                    Force sync whiteboard from server

${colors.yellow}GM Management:${colors.reset}
  /gm request                 Request GM
  /gm approve <id|name>       Approve GM request (GM only)
  /gm reject <id|name>        Reject GM request (GM only)
  /gm status                  Show GM and pending
  /gm list                    List clients

${colors.yellow}Modules:${colors.reset}
  /modules list               List modules
  /modules push <moduleId>    Push module
  /modules cleanup <moduleId> Cleanup module

${colors.yellow}Region:${colors.reset}
  /region [name]              Set or show default region

${colors.yellow}Other:${colors.reset}
  /who                        Request presence update
  /banner [reload|fetch]      Show a random banner; reload from cache, fetch new
  /help                       This help
  /quit / exit                Quit
${ADMIN_MODE ? `
${colors.yellow}Admin (API Key Active):${colors.reset}
  /admin players              List clients
  /admin kick <name|id> [reason]
  /admin ban <name|id> [reason]
  /admin unban <clientId>
` : ''}
`);
    rl.prompt(true);
}

// ─── REST API (admin + characters + grid) ──────────────────────
async function makeApiRequest(endpoint, method = 'GET', data = null) {
    const url = `${apiBaseUrl}${endpoint}`;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json', 'x-api-key': adminApiKey }
    };
    if (data && method !== 'GET') options.body = JSON.stringify(data);
    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
}

async function getClientIdFromApi(name) {
    if (!ADMIN_MODE || !roomCode) return null;
    try {
        const result = await makeApiRequest(`/rooms/${roomCode}/clients`);
        const client = result.clients.find(c => c.name.toLowerCase() === name.toLowerCase());
        return client ? client.id : null;
    } catch (err) {
        printSystemMessage(`API error: ${err.message}`, colors.red);
        return null;
    }
}

async function resolveTargetId(identifier) {
    if (identifier.startsWith('ws-') || /^[a-f0-9]{20}$/i.test(identifier)) return identifier;
    const id = await getClientIdFromApi(identifier);
    if (!id) printSystemMessage(`Player "${identifier}" not found.`, colors.red);
    return id;
}

async function handleAdminCommand(args) {
    if (!ADMIN_MODE) { printSystemMessage('Admin mode not available.', colors.red); return; }
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }

    const subCmd = args[0]?.toLowerCase();
    const arg1 = args[1];
    const reason = args.slice(2).join(' ') || 'Admin action';

    try {
        switch (subCmd) {
            case 'players':
            case 'list': {
                const result = await makeApiRequest(`/rooms/${roomCode}/clients`);
                printSystemMessage(`👥 Clients in room (${result.clients.length}):`);
                result.clients.forEach(c => console.log(`  \`${c.id}\` - ${c.name} (${c.role})`));
                rl.prompt(true);
                break;
            }
            case 'kick': {
                if (!arg1) { printSystemMessage('Usage: /admin kick <name|id> [reason]', colors.red); return; }
                const targetId = await resolveTargetId(arg1);
                if (!targetId) return;
                await makeApiRequest(`/rooms/${roomCode}/clients/${targetId}/kick`, 'POST', { reason });
                printSystemMessage(`👢 Kicked ${arg1}`);
                break;
            }
            case 'ban': {
                if (!arg1) { printSystemMessage('Usage: /admin ban <name|id> [reason]', colors.red); return; }
                const targetId = await resolveTargetId(arg1);
                if (!targetId) return;
                await makeApiRequest(`/rooms/${roomCode}/clients/${targetId}/ban`, 'POST', { reason });
                printSystemMessage(`🚫 Banned ${arg1}`);
                break;
            }
            case 'unban': {
                if (!arg1) { printSystemMessage('Usage: /admin unban <clientId>', colors.red); return; }
                await makeApiRequest(`/rooms/${roomCode}/clients/${arg1}/unban`, 'POST');
                printSystemMessage(`✅ Unbanned ${arg1}`);
                break;
            }
            default: printSystemMessage('Admin commands: players, kick, ban, unban');
        }
    } catch (err) {
        printSystemMessage(`Admin error: ${err.message}`, colors.red);
    }
}

// ─── Character API commands ─────────────────────────────────────
async function listCharacters() {
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }
    try {
        const result = await makeApiRequest(`/rooms/${roomCode}/characters`);
        characters = {};
        (result.characters || []).forEach(c => { if (c.name) characters[c.name] = c; });
        printCharacterList();
    } catch (err) {
        printSystemMessage(`Failed to list characters: ${err.message}`, colors.red);
    }
}

async function viewCharacter(name) {
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }
    try {
        const result = await makeApiRequest(`/rooms/${roomCode}/characters/${encodeURIComponent(name)}`);
        console.log(`${colors.cyan}Character: ${colors.bold}${result.name}${colors.reset}`);
        Object.keys(result).forEach(key => {
            if (key === 'name') return;
            console.log(`  ${key}: ${typeof result[key] === 'object' ? JSON.stringify(result[key]) : result[key]}`);
        });
        rl.prompt(true);
    } catch (err) {
        printSystemMessage(`Failed to view character: ${err.message}`, colors.red);
    }
}

async function updateCharacter(name, field, value) {
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }
    const updates = {};
    updates[field] = value;
    try {
        await makeApiRequest(`/rooms/${roomCode}/characters/update`, 'POST', { updates: { [name]: updates } });
        printSystemMessage(`✅ Updated ${name}.${field} = ${value}`);
    } catch (err) {
        printSystemMessage(`Failed to update character: ${err.message}`, colors.red);
    }
}

// ─── Grid Combat API ────────────────────────────────────────────
async function toggleGrid(enabled) {
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }
    try {
        await makeApiRequest(`/rooms/${roomCode}/grid-combat`, 'POST', { enabled });
        printSystemMessage(`Grid combat ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
        printSystemMessage(`Failed to toggle grid: ${err.message}`, colors.red);
    }
}

async function addToken(name, x, y, color = '#d4af37') {
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }
    const data = { name, x: x || 0, y: y || 0, color };
    try {
        const result = await makeApiRequest(`/rooms/${roomCode}/tokens`, 'POST', data);
        printSystemMessage(`✅ Token added: ${name} (ID: ${result.id})`);
    } catch (err) {
        printSystemMessage(`Failed to add token: ${err.message}`, colors.red);
    }
}

async function listTokens() {
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }
    try {
        const result = await makeApiRequest(`/rooms/${roomCode}/tokens`);
        const tokens = result.tokens || [];
        if (tokens.length === 0) {
            printSystemMessage('No tokens in room.');
        } else {
            console.log(`${colors.cyan}Tokens (${tokens.length}):${colors.reset}`);
            tokens.forEach(t => {
                console.log(`  ${t.id}: ${t.name} (${t.x},${t.y}) [${t.color}]`);
            });
            rl.prompt(true);
        }
    } catch (err) {
        printSystemMessage(`Failed to list tokens: ${err.message}`, colors.red);
    }
}

async function removeToken(id) {
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }
    try {
        await makeApiRequest(`/rooms/${roomCode}/tokens/${id}`, 'DELETE');
        printSystemMessage(`✅ Token ${id} removed.`);
    } catch (err) {
        printSystemMessage(`Failed to remove token: ${err.message}`, colors.red);
    }
}

async function moveToken(id, x, y) {
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }
    try {
        await makeApiRequest(`/rooms/${roomCode}/tokens/${id}/move`, 'POST', { x, y });
        printSystemMessage(`✅ Token ${id} moved to (${x},${y}).`);
    } catch (err) {
        printSystemMessage(`Failed to move token: ${err.message}`, colors.red);
    }
}

// ─── Whiteboard API ─────────────────────────────────────────────
async function getWhiteboardStatus() {
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }
    try {
        const wb = await makeApiRequest(`/rooms/${roomCode}/whiteboard`);
        console.log(`${colors.cyan}Whiteboard state:${colors.reset}`);
        console.log(`  Drawings: ${wb.drawings?.length || 0}`);
        console.log(`  Notes: ${wb.notes?.length || 0}`);
        console.log(`  Images: ${wb.images?.length || 0}`);
        if (wb.gridCombat) {
            const gc = wb.gridCombat;
            console.log(`  Grid Combat: ${gc.enabled ? 'enabled' : 'disabled'}`);
            console.log(`  Tokens: ${gc.tokens?.length || 0}`);
            console.log(`  Grid Type: ${gc.gridType || 'square'}`);
        }
        rl.prompt(true);
    } catch (err) {
        printSystemMessage(`Failed to get whiteboard: ${err.message}`, colors.red);
    }
}

async function syncWhiteboard() {
    if (!roomCode) { printSystemMessage('Not connected to a room.', colors.red); return; }
    try {
        const wb = await makeApiRequest(`/rooms/${roomCode}/whiteboard`);
        // In a real client, we could display or store it; here we just confirm
        printSystemMessage(`Whiteboard synced (${wb.drawings?.length || 0} drawings, ${wb.notes?.length || 0} notes, ${wb.images?.length || 0} images).`);
    } catch (err) {
        printSystemMessage(`Failed to sync whiteboard: ${err.message}`, colors.red);
    }
}

// ─── WebSocket connection ───────────────────────────────────────
function connectToServer(url = serverUrl, room = roomCode) {
    if (connected) { printSystemMessage('Already connected.'); return; }

    serverUrl = url;
    roomCode = room;
    apiBaseUrl = getApiBaseUrl(serverUrl);

    const wsUrl = `${serverUrl}?room=${encodeURIComponent(roomCode)}`;
    printSystemMessage(`Connecting to ${wsUrl}...`);

    try {
        ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            connected = true;
            reconnectAttempts = 0;
            printSystemMessage('Connected! Sending handshake...');
            ws.send(JSON.stringify({
                type: 'handshake',
                campaignCode: roomCode,
                password: password,
                clientName: clientName,
                role: 'player',
                version: '2.3.0'
            }));
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                handleMessage(msg);
            } catch (e) {
                printSystemMessage(`Failed to parse message: ${e.message}`, colors.red);
            }
        });

        ws.on('close', (code, reason) => {
            connected = false;
            printSystemMessage(`Disconnected (${code} - ${reason || 'No reason'})`);
            if (code !== 1000) scheduleReconnect();
        });

        ws.on('error', (err) => {
            printSystemMessage(`WebSocket error: ${err.message || err}`, colors.red);
        });

    } catch (err) {
        printSystemMessage(`Failed to connect: ${err.message}`, colors.red);
        scheduleReconnect();
    }
}

function disconnect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.close(1000, 'Disconnected by user'); ws = null; }
    connected = false;
    clients = {};
    gmId = null;
    pendingRequests = [];
    myRole = 'player';
    characters = {};
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
        if (!connected) connectToServer(serverUrl, roomCode);
    }, delay);
}

// ─── Message handler ────────────────────────────────────────────
function handleMessage(msg) {
    switch (msg.type) {
        case 'handshake_ack':
            printSystemMessage(`Handshake successful! You are ${clientName}.`);
            if (msg.activeClients) {
                const names = msg.activeClients.map(c => c.name).join(', ');
                printSystemMessage(`Players online: ${names}`);
                updateClients(msg.activeClients);
            }
            break;

        case 'chat-message':
            printChatMessage(msg.sender, msg.text);
            break;

        case 'roll-result':
            printRollResult(msg.sender, msg.formula || 'dice', msg.result || 0, (msg.rolls || []).join(', '));
            break;

        case 'presence':
            if (msg.clients) {
                updateClients(msg.clients);
                printSystemMessage(`Presence update: ${msg.clients.length} clients online.`);
            }
            break;

        case 'sync-state':
            const state = msg.state || {};
            const keys = Object.keys(state);
            const summary = keys.length ? keys.join(', ') : 'empty';
            printSystemMessage(`📋 State sync: ${summary}`, colors.cyan);
            if (state.gridCombat) {
                const gc = state.gridCombat;
                printSystemMessage(`   Grid Combat: ${gc.enabled ? 'enabled' : 'disabled'}, tokens: ${gc.tokens?.length || 0}`, colors.dim);
            }
            break;

        case 'client-joined':
            printSystemMessage(`${msg.clientName || 'Someone'} joined.`);
            if (msg.clients) updateClients(msg.clients);
            break;

        case 'client-left':
            if (msg.clientId) {
                delete clients[msg.clientId];
                if (gmId === msg.clientId) { gmId = null; updateGmFromClients(); }
                printSystemMessage(`A client left.`);
            }
            break;

        case 'deck-drawn':
            deckRemaining = msg.remaining || 0;
            printDeckDraw((msg.cards || []).length, msg.region || defaultRegion, msg.cards || [], msg.synthesis || '');
            break;

        case 'deck-shuffled':
            deckRemaining = msg.remaining || 54;
            printSystemMessage(`🔀 Deck shuffled. ${deckRemaining} cards remaining.`);
            break;

        case 'crown-spread':
            printCrownSpread(msg.result || {});
            deckRemaining = msg.remaining || 0;
            break;

        case 'module-list':
            const mods = msg.modules || [];
            if (mods.length) {
                const names = mods.map(m => m.name || m.id).join(', ');
                printSystemMessage(`📦 Loaded modules: ${names}`);
            } else {
                printSystemMessage('No modules loaded.');
            }
            break;

        case 'module-push':
            const mod = msg.module || {};
            printSystemMessage(`📦 Module pushed: ${mod.manifest?.name || mod.id || 'Unknown'}`);
            break;

        case 'module-cleanup':
            printSystemMessage(`🧹 Module cleanup: ${msg.moduleId || 'Unknown'}`);
            break;

        case 'region-updated':
            if (msg.region) {
                defaultRegion = msg.region;
                printSystemMessage(`📍 Region updated to: ${defaultRegion}`);
            }
            break;

        case 'gm_vote_request':
            if (myRole === 'gm' && ws && ws.clientId === msg.currentGmId) {
                if (!pendingRequests.find(r => r.requesterId === msg.requesterId)) {
                    pendingRequests.push({ requesterId: msg.requesterId, requesterName: msg.requesterName });
                }
                printSystemMessage(`👑 ${msg.requesterName} requests GM. Use /gm approve|reject.`, colors.yellow);
            }
            break;

        case 'gm_role_update':
            if (msg.clientId === ws?.clientId) {
                myRole = msg.role;
                printSystemMessage(`Your role is now: ${msg.role.toUpperCase()}`, colors.green);
            }
            if (clients[msg.clientId]) clients[msg.clientId].role = msg.role;
            if (msg.role === 'gm') gmId = msg.clientId;
            else if (gmId === msg.clientId) updateGmFromClients();
            const target = clients[msg.clientId];
            printSystemMessage(`${target ? target.name : msg.clientId} is now ${msg.role.toUpperCase()}.`, colors.yellow);
            break;

        case 'server_announcement':
            printSystemMessage(`📢 ${msg.message}`, colors.cyan);
            break;

        case 'room-state':
            if (msg.clients) updateClients(msg.clients);
            if (msg.deckRemaining !== undefined) deckRemaining = msg.deckRemaining;
            if (msg.data?.region) defaultRegion = msg.data.region;
            if (msg.characters && Array.isArray(msg.characters)) {
                characters = {};
                msg.characters.forEach(c => { if (c.name) characters[c.name] = c; });
            }
            printSystemMessage(`Room state received. ${Object.keys(clients).length} clients online.`);
            break;

        case 'state-updated':
            if (msg.characters && Array.isArray(msg.characters)) {
                characters = {};
                msg.characters.forEach(c => { if (c.name) characters[c.name] = c; });
                printSystemMessage(`Characters updated (${Object.keys(characters).length} total).`);
            } else {
                printSystemMessage(`State updated by ${msg.updatedBy || 'Unknown'}`);
            }
            break;

        case 'character-update':
            if (msg.name) {
                if (!characters[msg.name]) characters[msg.name] = { name: msg.name };
                characters[msg.name][msg.field] = msg.value;
                printSystemMessage(`⚡ ${msg.name}.${msg.field} = ${msg.value}`);
            }
            break;

        case 'character-update-bulk':
            if (msg.updates) {
                Object.entries(msg.updates).forEach(([name, data]) => {
                    if (!characters[name]) characters[name] = { name };
                    Object.assign(characters[name], data);
                });
                printSystemMessage(`📋 Bulk character update (${Object.keys(msg.updates).length} characters).`);
            }
            break;

        case 'error':
            printSystemMessage(`Server Error: ${msg.message}`, colors.red);
            break;

        case 'room-closed':
            printSystemMessage('⚠️ Room closed by server.', colors.red);
            disconnect();
            break;

        case 'pong':
            // ignore
            break;

        default:
            process.stdout.write('\r\x1b[K');
            console.log(`${colors.gray}[Unknown] ${JSON.stringify(msg)}${colors.reset}`);
            rl.prompt(true);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────
function updateClients(clientsArray) {
    clients = {};
    clientsArray.forEach(c => {
        clients[c.id] = c;
        if (c.role === 'gm') gmId = c.id;
    });
    if (!clientsArray.some(c => c.role === 'gm')) gmId = null;
    if (ws && ws.clientId && clients[ws.clientId]) myRole = clients[ws.clientId].role;
}

function updateGmFromClients() {
    for (let id in clients) {
        if (clients[id].role === 'gm') { gmId = id; return; }
    }
    gmId = null;
}

function getCurrentGM() { return gmId ? clients[gmId] : null; }

function findClient(idOrName) {
    if (clients[idOrName]) return clients[idOrName];
    const lower = idOrName.toLowerCase();
    for (let id in clients) {
        if (clients[id].name && clients[id].name.toLowerCase() === lower) return clients[id];
    }
    return null;
}

function sendMessage(type, data = {}) {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
        printSystemMessage('Not connected.', colors.red);
        return false;
    }
    try {
        ws.send(JSON.stringify({ type, ...data }));
        return true;
    } catch (e) {
        printSystemMessage(`Send failed: ${e.message}`, colors.red);
        return false;
    }
}

// ─── Dice roller ──────────────────────────────────────────────────
function rollDice(formula) {
    const parts = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!parts) {
        const num = parseInt(formula);
        if (!isNaN(num)) return { formula, total: num, rolls: [num] };
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

// ─── Command processing ──────────────────────────────────────────
rl.on('line', (input) => {
    const trimmed = input.trim();
    if (!trimmed) { rl.prompt(); return; }

    if (trimmed.startsWith('/')) {
        const parts = trimmed.slice(1).split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        const argStr = args.join(' ');

        switch (cmd) {
            case 'connect':
                if (connected) { printSystemMessage('Already connected.'); break; }
                const newUrl = args[0] || CONFIG.defaultServerUrl;
                const newRoom = args[1] || CONFIG.defaultRoom;
                connectToServer(newUrl, newRoom);
                break;

            case 'disconnect':
                disconnect();
                break;

            case 'status':
                printSystemMessage(`Status: ${connected ? '🟢 Connected' : '🔴 Disconnected'}`);
                if (connected) {
                    printSystemMessage(`Server: ${serverUrl}`);
                    printSystemMessage(`Room: ${roomCode}`);
                    printSystemMessage(`Name: ${clientName}`);
                    printSystemMessage(`Region: ${defaultRegion}`);
                    printSystemMessage(`Deck: ${deckRemaining} cards`);
                    const gm = getCurrentGM();
                    printSystemMessage(`GM: ${gm ? gm.name : 'None'}`);
                    printSystemMessage(`Your role: ${myRole}`);
                    printSystemMessage(`Clients: ${Object.keys(clients).length}`);
                    printSystemMessage(`Characters: ${Object.keys(characters).length}`);
                    if (ADMIN_MODE) printSystemMessage(`Admin mode: ✅`, colors.green);
                }
                break;

            case 'name':
                if (argStr) { clientName = argStr; printSystemMessage(`Name set to: ${clientName}`); }
                else printSystemMessage(`Current name: ${clientName}`);
                break;

            case 'roll':
            case 'r':
                if (!argStr) { printSystemMessage('Usage: /roll <dice> [reason]'); break; }
                const match = argStr.match(/^([^\s"]+(?:\s+[^\s"]+)*?)(?:\s+(.+))?$/);
                let diceExpr = argStr, reason = '';
                if (match) { diceExpr = match[1]; reason = match[2] || ''; }
                const rollData = rollDice(diceExpr);
                if (rollData.error) { printSystemMessage(rollData.error, colors.red); break; }
                if (sendMessage('roll-dice', { roll: diceExpr, reason })) {
                    printRollResult(clientName, diceExpr, rollData.total, rollData.rolls.join(', '));
                }
                break;

            case 'draw':
                const count = parseInt(args[0]) || 1;
                const region = args[1] || defaultRegion;
                if (count < 1 || count > 5) { printSystemMessage('Count must be 1-5.', colors.red); break; }
                sendMessage('deck-draw', { count, region });
                break;

            case 'crown':
                sendMessage('crown-spread', { region: args[0] || defaultRegion });
                break;

            case 'shuffle':
                sendMessage('deck-shuffle', {});
                break;

            case 'deck-status':
                printSystemMessage(`Deck remaining: ${deckRemaining} cards`);
                break;

            case 'region':
                if (args[0]) { defaultRegion = args[0]; sendMessage('set-region', { region: defaultRegion }); printSystemMessage(`Region set to: ${defaultRegion}`); }
                else printSystemMessage(`Current region: ${defaultRegion}`);
                break;

            case 'gm': {
                const sub = args[0]?.toLowerCase() || '';
                const gmArg = args.slice(1).join(' ');
                switch (sub) {
                    case 'request':
                        sendMessage('request_gm', {});
                        printSystemMessage('GM request sent.');
                        break;
                    case 'approve': {
                        if (!gmArg) { printSystemMessage('Usage: /gm approve <id|name>'); break; }
                        const target = findClient(gmArg);
                        if (!target) { printSystemMessage(`Client "${gmArg}" not found.`, colors.red); break; }
                        if (myRole !== 'gm') { printSystemMessage('Only current GM can approve.', colors.red); break; }
                        sendMessage('approve_gm', { targetId: target.id });
                        pendingRequests = pendingRequests.filter(r => r.requesterId !== target.id);
                        printSystemMessage(`✅ Approved ${target.name} as GM.`);
                        break;
                    }
                    case 'reject': {
                        if (!gmArg) { printSystemMessage('Usage: /gm reject <id|name>'); break; }
                        const target = findClient(gmArg);
                        if (!target) { printSystemMessage(`Client "${gmArg}" not found.`, colors.red); break; }
                        pendingRequests = pendingRequests.filter(r => r.requesterId !== target.id);
                        printSystemMessage(`❌ Rejected ${target.name} as GM.`);
                        break;
                    }
                    case 'status': printGMStatus(); break;
                    case 'list': printClientList(); break;
                    default: printSystemMessage(`Unknown GM command: ${sub}. Use request, approve, reject, status, list.`);
                }
                break;
            }

            case 'modules': {
                const modCmd = args[0]?.toLowerCase() || '';
                const modArg = args.slice(1).join(' ');
                switch (modCmd) {
                    case 'list': sendMessage('module-list', {}); break;
                    case 'push':
                        if (!modArg) { printSystemMessage('Usage: /modules push <moduleId>'); break; }
                        sendMessage('module-push', { moduleId: modArg });
                        printSystemMessage(`📦 Push requested for ${modArg}`);
                        break;
                    case 'cleanup':
                        if (!modArg) { printSystemMessage('Usage: /modules cleanup <moduleId>'); break; }
                        sendMessage('module-cleanup', { moduleId: modArg });
                        printSystemMessage(`🧹 Cleanup requested for ${modArg}`);
                        break;
                    default: printSystemMessage('Module commands: list, push <id>, cleanup <id>');
                }
                break;
            }

            // ─── NEW: Character commands ──────────────────────────
            case 'chars': {
                const charCmd = args[0]?.toLowerCase() || '';
                const charArg1 = args[1];
                const charArg2 = args[2];
                const charArg3 = args[3];
                switch (charCmd) {
                    case 'list':
                        if (!connected) { printSystemMessage('Not connected.'); break; }
                        listCharacters();
                        break;
                    case 'view':
                        if (!charArg1) { printSystemMessage('Usage: /chars view <name>'); break; }
                        viewCharacter(charArg1);
                        break;
                    case 'update':
                        if (!charArg1 || !charArg2 || charArg3 === undefined) {
                            printSystemMessage('Usage: /chars update <name> <field> <value>');
                            break;
                        }
                        updateCharacter(charArg1, charArg2, charArg3);
                        break;
                    case 'sync':
                        if (!connected) { printSystemMessage('Not connected.'); break; }
                        sendMessage('sync-request', { entity: 'characters' });
                        printSystemMessage('Character sync requested.');
                        break;
                    default:
                        printSystemMessage('Character commands: list, view <name>, update <name> <field> <value>, sync');
                }
                break;
            }

            // ─── NEW: Grid Combat ────────────────────────────────
            case 'grid': {
                const gridCmd = args[0]?.toLowerCase();
                switch (gridCmd) {
                    case 'on':
                        toggleGrid(true);
                        break;
                    case 'off':
                        toggleGrid(false);
                        break;
                    case 'status':
                        if (!connected) { printSystemMessage('Not connected.'); break; }
                        sendMessage('sync-request', { entity: 'grid' });
                        printSystemMessage('Grid status requested.');
                        break;
                    default:
                        printSystemMessage('Grid commands: on, off, status');
                }
                break;
            }

            case 'token': {
                const tokenCmd = args[0]?.toLowerCase();
                const tokenArgs = args.slice(1);
                switch (tokenCmd) {
                    case 'add':
                        if (tokenArgs.length < 1) { printSystemMessage('Usage: /token add <name> [x] [y] [color]'); break; }
                        const name = tokenArgs[0];
                        const x = parseInt(tokenArgs[1]) || 0;
                        const y = parseInt(tokenArgs[2]) || 0;
                        const color = tokenArgs[3] || '#d4af37';
                        addToken(name, x, y, color);
                        break;
                    case 'list':
                        listTokens();
                        break;
                    case 'remove':
                        if (!tokenArgs[0]) { printSystemMessage('Usage: /token remove <id>'); break; }
                        removeToken(tokenArgs[0]);
                        break;
                    case 'move':
                        if (tokenArgs.length < 3) { printSystemMessage('Usage: /token move <id> <x> <y>'); break; }
                        moveToken(tokenArgs[0], parseInt(tokenArgs[1]), parseInt(tokenArgs[2]));
                        break;
                    default:
                        printSystemMessage('Token commands: add, list, remove, move');
                }
                break;
            }

            // ─── NEW: Whiteboard ──────────────────────────────────
            case 'wb': {
                const wbCmd = args[0]?.toLowerCase();
                switch (wbCmd) {
                    case 'status':
                        getWhiteboardStatus();
                        break;
                    case 'sync':
                        syncWhiteboard();
                        break;
                    default:
                        printSystemMessage('Whiteboard commands: status, sync');
                }
                break;
            }

            case 'admin':
                handleAdminCommand(args);
                break;

            case 'banner': {
                const sub = args[0]?.toLowerCase();
                if (sub === 'reload') {
                    loadBannerCache();
                    printSystemMessage(`Banners reloaded from cache (${bannerCache.length} loaded)`, colors.green);
                    rl.prompt(true);
                } else if (sub === 'fetch') {
                    printSystemMessage('Fetching a remote banner...', colors.dim);
                    fetchRemoteBanner()
                        .then(banner => {
                            addToCache(banner);
                            console.log(banner);
                            printSystemMessage(`Added new banner to cache (now ${bannerCache.length} total)`, colors.green);
                            rl.prompt(true);
                        })
                        .catch(err => {
                            printSystemMessage(`Failed to fetch: ${err.message}`, colors.red);
                            rl.prompt(true);
                        });
                } else {
                    console.log(getRandomBanner());
                    rl.prompt(true);
                }
                break;
            }

            case 'who':
                if (connected) sendMessage('sync-request', { entity: 'presence' });
                else printSystemMessage('Not connected.');
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
                printSystemMessage(`Unknown command: /${cmd}. Type /help.`);
        }
    } else {
        if (connected) {
            sendMessage('chat-message', { text: trimmed, sender: clientName });
            printChatMessage(clientName, trimmed);
        } else {
            printSystemMessage('Not connected.');
        }
    }
    rl.prompt();
});

// ─── Welcome ──────────────────────────────────────────────────────
console.log(getRandomBanner());
console.log(`Type ${colors.yellow}/help${colors.reset} for commands.`);
console.log(`Set your name with ${colors.yellow}/name <Your Name>${colors.reset}`);
console.log(`Connect with ${colors.yellow}/connect [url] [room]${colors.reset}`);
if (ADMIN_MODE) console.log(`${colors.green}Admin mode enabled. Use /admin for player management.${colors.reset}`);
else console.log(`${colors.dim}Tip: Set API_KEY env to enable admin commands.${colors.reset}`);
console.log('');

rl.prompt();

process.on('SIGINT', () => {
    if (ws) ws.close();
    process.exit(0);
});