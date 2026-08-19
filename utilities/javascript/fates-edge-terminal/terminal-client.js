#!/usr/bin/env node

/**
 * Fate's Edge Terminal Client v2.4.0 – Adventure Engine + Full Feature Set
 * Connects to ws://<host>:<port>?room=<ROOM_CODE>
 *
 * New in 2.4.0:
 *  - Full Adventure Engine commands: load, scene, encounter, timer, log, status, reference
 *  - Handles all adventure WS events with rich formatting
 *  - Improved /status, /whoami with adventure state
 *  - Auto‑refresh adventure status on relevant broadcasts
 *  - /adventure help for command reference
 *
 * NEW: --curses / --tui flag (or EDGE_TUI=1) launches a full-screen
 * curses-style UI (blessed): scrolling log pane + live status sidebar +
 * dedicated input box, instead of the classic readline prompt. Same
 * commands, same wire protocol — just a different skin.
 */

const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────
const CONFIG = {
    version: '2.4.0',
    defaultServerUrl: 'ws://localhost:3000',
    defaultRoom: 'ABC123',
    defaultName: 'Terminal Player',
    defaultPassword: 'password123',
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

// ─── Curses/TUI mode (NEW: vanity feature) ──────────────────────
// A "curses"-style full-screen UI, built on `blessed`, opt-in via
// --curses / --tui flag (or EDGE_TUI=1). Falls back gracefully to
// classic readline mode if blessed isn't installed.
let TUI_MODE = process.argv.includes('--curses') || process.argv.includes('--tui') || process.env.EDGE_TUI === '1';
let blessed = null;
let screen = null, logBox = null, sidebarBox = null, inputBox = null;

function getApiBaseUrl(serverUrl) {
    const httpUrl = serverUrl.replace(/^ws/, 'http');
    return httpUrl.replace(/\/$/, '') + '/api';
}
let apiBaseUrl = getApiBaseUrl(CONFIG.defaultServerUrl);

// ─── ANSI color themes ───────────────────────────────────────────
const THEMES = {
    default: {
        reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
        red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[34m",
        magenta: "\x1b[35m", cyan: "\x1b[36m", gray: "\x1b[90m", white: "\x1b[37m"
    },
    dracula: {
        reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
        red: "\x1b[38;5;203m", green: "\x1b[38;5;84m", yellow: "\x1b[38;5;228m", blue: "\x1b[38;5;117m",
        magenta: "\x1b[38;5;141m", cyan: "\x1b[38;5;51m", gray: "\x1b[38;5;61m", white: "\x1b[38;5;231m"
    },
    forest: {
        reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
        red: "\x1b[38;5;130m", green: "\x1b[38;5;28m", yellow: "\x1b[38;5;178m", blue: "\x1b[38;5;24m",
        magenta: "\x1b[38;5;95m", cyan: "\x1b[38;5;30m", gray: "\x1b[38;5;101m", white: "\x1b[38;5;230m"
    },
    amber: {
        reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
        red: "\x1b[38;5;166m", green: "\x1b[38;5;107m", yellow: "\x1b[38;5;214m", blue: "\x1b[38;5;67m",
        magenta: "\x1b[38;5;172m", cyan: "\x1b[38;5;109m", gray: "\x1b[38;5;95m", white: "\x1b[38;5;223m"
    }
};
let colors = THEMES.default;

// ─── Local config ──────────────────────────────────────────────
const USER_CONFIG_FILE = path.join(__dirname, 'edge_config.json');
// NEW: authToken/authUsername -- optional account login (see /login,
// /register, /logout below). Completely optional: without them, joining
// works exactly as before (room password required every time this
// client connects). Persisted here alongside the theme so logging in
// once survives restarts, same as the existing config file already does
// for appearance settings.
let userConfig = { theme: 'default', authToken: null, authUsername: null };

function loadUserConfig() {
    try {
        const parsed = JSON.parse(fs.readFileSync(USER_CONFIG_FILE, 'utf8'));
        if (parsed && typeof parsed === 'object') userConfig = { ...userConfig, ...parsed };
    } catch (e) {}
    if (THEMES[userConfig.theme]) colors = THEMES[userConfig.theme];
}

function saveUserConfig() {
    try { fs.writeFileSync(USER_CONFIG_FILE, JSON.stringify(userConfig, null, 2), 'utf8'); } catch (e) {}
}

loadUserConfig();

// ─── Banners (unchanged) ──────────────────────────────────────
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
${colors.yellow}        ⚔️  Edge CLI v${CONFIG.version} – Where fate meets stone  ⚔️${colors.reset}
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

// Adventure state (populated from events)
let adventureState = {
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

// Session stats + roll history
let sessionStats = {
    sessionStart: Date.now(),
    rollsMade: 0,
    diceTotal: 0,
    crits: 0,
    fumbles: 0,
    messagesSent: 0,
    cardsDrawn: 0
};
const MAX_ROLL_HISTORY = 20;
let rollHistory = [];

// ─── Curses/TUI setup (NEW) ──────────────────────────────────────
// Builds a three-pane blessed screen: a scrolling log on the left,
// a live status sidebar on the right, and an input box on the bottom.
// All existing output keeps flowing through console.log/printX
// helpers unchanged — we just patch console.log to route into the
// log pane instead of stdout while TUI_MODE is active.
function initTUI() {
    try {
        blessed = require('blessed');
    } catch (e) {
        console.error(`Curses mode requested but 'blessed' isn't installed (run "npm install" in the terminal client folder). Falling back to classic mode.`);
        TUI_MODE = false;
        return;
    }

    screen = blessed.screen({ smartCSR: true, title: `Edge CLI v${CONFIG.version}`, fullUnicode: true });

    logBox = blessed.log({
        top: 0, left: 0, width: '75%', height: '100%-3',
        border: { type: 'line' }, label: ' Edge CLI ',
        tags: false, scrollback: 5000, mouse: true, keys: true, vi: true, alwaysScroll: true,
        scrollbar: { ch: ' ', inverse: true },
        style: { border: { fg: 'magenta' } }
    });

    sidebarBox = blessed.box({
        top: 0, left: '75%', width: '25%', height: '100%-3',
        border: { type: 'line' }, label: ' Status ',
        tags: true, style: { border: { fg: 'cyan' } }
    });

    inputBox = blessed.textbox({
        bottom: 0, left: 0, width: '100%', height: 3,
        border: { type: 'line' }, label: ' > ',
        inputOnFocus: true, style: { border: { fg: 'yellow' }, focus: { border: { fg: 'green' } } }
    });

    screen.append(logBox);
    screen.append(sidebarBox);
    screen.append(inputBox);

    inputBox.on('submit', (value) => {
        inputBox.clearValue();
        screen.render();
        if (value && value.trim()) handleInputLine(value);
        inputBox.focus();
    });
    // Re-focus after Escape/blur so the user isn't stranded without an input target.
    inputBox.key(['escape'], () => inputBox.focus());
    screen.key(['C-c'], () => { if (ws) ws.close(); if (screen) screen.destroy(); process.exit(0); });

    inputBox.focus();
    updateSidebar();
    screen.render();

    // Route console.log (used by every print* helper and inline command
    // output) into the log pane instead of the real stdout.
    console.log = (...args) => {
        const str = args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ');
        if (logBox) logBox.log(str);
        if (screen) screen.render();
    };
}

function updateSidebar() {
    if (!sidebarBox) return;
    const gm = getCurrentGM();
    const lines = [];
    lines.push(`{yellow-fg}{bold}Edge CLI v${CONFIG.version}{/bold}{/yellow-fg}`);
    lines.push('');
    lines.push(`{bold}Status:{/bold} ${connected ? '{green-fg}Connected{/green-fg}' : '{red-fg}Disconnected{/red-fg}'}`);
    if (connected) {
        lines.push(`Server: ${serverUrl}`);
        lines.push(`Room:   ${roomCode}`);
        lines.push(`Name:   ${clientName}`);
        lines.push(`Role:   ${myRole}`);
        lines.push(`GM:     ${gm ? gm.name : 'None'}`);
        lines.push(`Region: ${defaultRegion}`);
        lines.push(`Deck:   ${deckRemaining}`);
        lines.push(`Clients: ${Object.keys(clients).length}`);
    }
    if (adventureState.moduleId) {
        lines.push('');
        lines.push(`{magenta-fg}{bold}Adventure{/bold}{/magenta-fg}`);
        lines.push(`${adventureState.title || adventureState.moduleId}`);
        lines.push(`${adventureState.status || ''}`);
    }
    lines.push('');
    lines.push(`{cyan-fg}Session{/cyan-fg}`);
    lines.push(`Rolls: ${sessionStats.rollsMade}`);
    lines.push(`Crits: ${sessionStats.crits}  Fumbles: ${sessionStats.fumbles}`);
    if (ADMIN_MODE) { lines.push(''); lines.push('{green-fg}Admin mode ON{/green-fg}'); }
    lines.push('');
    lines.push('{white-fg}Ctrl+C to quit{/white-fg}');
    sidebarBox.setContent(lines.join('\n'));
    if (screen) screen.render();
}

if (TUI_MODE) initTUI();

// ─── Readline (classic mode only; curses mode uses the blessed input box) ──
const rl = TUI_MODE ? null : readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.gray}>${colors.reset} `
});

function promptAgain(force) {
    if (TUI_MODE) { updateSidebar(); return; }
    if (rl) rl.prompt(force);
}

// ─── Print helpers ──────────────────────────────────────────────
function printSystemMessage(msg, color = colors.gray) {
    process.stdout.write('\r\x1b[K');
    console.log(`${color}[System] ${msg}${colors.reset}`);
    promptAgain(true);
}

function printChatMessage(sender, text) {
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.cyan}[${sender}]: ${colors.reset}${text}`);
    promptAgain(true);
}

function printRollResult(sender, formula, result, details = '') {
    process.stdout.write('\r\x1b[K');
    const detailStr = details ? ` (${details})` : '';
    console.log(`${colors.yellow}🎲 ${sender} rolled ${formula}: ${colors.bold}${result}${colors.reset}${detailStr}`);
    promptAgain(true);
}

function printDeckDraw(count, region, cards, synthesis) {
    process.stdout.write('\r\x1b[K');
    const cardNames = cards.map(c => c.is_joker ? '🃏 Joker' : `${c.rank_name || c.rank} of ${c.suit_name || c.suit}`).join(', ');
    console.log(`${colors.magenta}🃏 Drew ${count} card${count > 1 ? 's' : ''} from ${region}:${colors.reset}`);
    console.log(`  ${cardNames}`);
    if (synthesis) console.log(`${colors.dim}${synthesis}${colors.reset}`);
    console.log(`${colors.gray}Cards remaining: ${deckRemaining}${colors.reset}`);
    promptAgain(true);
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
    promptAgain(true);
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
    promptAgain(true);
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
    promptAgain(true);
}

// ─── Adventure helpers ──────────────────────────────────────────
function printAdventureState(state) {
    if (!state || !state.moduleId) {
        printSystemMessage('No adventure loaded.', colors.dim);
        return;
    }
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.magenta}📖 Adventure: ${colors.bold}${state.title || state.moduleId}${colors.reset}`);
    console.log(`  Status: ${state.status || 'unknown'}`);
    if (state.currentAct) {
        console.log(`  Act: ${state.currentAct.title}`);
        if (state.currentScene) {
            console.log(`  Scene: ${state.currentScene.title}`);
            if (state.currentScene.description) {
                const desc = state.currentScene.description.length > 120
                    ? state.currentScene.description.slice(0, 120) + '…'
                    : state.currentScene.description;
                console.log(`    ${desc}`);
            }
        }
    }
    if (state.activeEncounter) {
        const enc = state.activeEncounter;
        const name = enc.name || enc.creatureId || 'Encounter';
        console.log(`  ⚔️ Active Encounter: ${name} (DV ${enc.dv || '?'}, ${enc.position || 'Controlled'})`);
        if (enc.creature) {
            console.log(`    Creature: ${enc.creature.name} (TL${enc.creature.tl})`);
        }
    }
    if (state.campaignTimers && state.campaignTimers.length) {
        console.log(`  ⏱️ Campaign Timers:`);
        state.campaignTimers.forEach(t => {
            const progress = t.current !== undefined ? `${t.current}/${t.segments}` : `${t.segments}`;
            console.log(`    - ${t.name}: ${progress}`);
        });
    }
    if (state.knowledge && state.knowledge.length) {
        const revealedCount = state.knowledge.filter(k => k.revealed).length;
        console.log(`  🗝️  Knowledge: ${revealedCount}/${state.knowledge.length} revealed (see /adventure knowledge)`);
    }
    if (state.log && state.log.length) {
        const last = state.log[state.log.length - 1];
        console.log(`  📜 Last log: ${last.message || last.type}`);
    }
    if (state.updatedAt) {
        console.log(`  🕐 Updated: ${new Date(state.updatedAt).toLocaleTimeString()}`);
    }
    promptAgain(true);
}

function printAdventureReference(ref) {
    if (!ref || !ref.moduleId) {
        printSystemMessage('No adventure loaded or no reference data available.', colors.dim);
        return;
    }
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.magenta}📚 Adventure Reference: ${ref.moduleId}${colors.reset}`);
    if (ref.bestiary && ref.bestiary.length) {
        console.log(`  🐉 Bestiary (${ref.bestiary.length}):`);
        ref.bestiary.slice(0, 5).forEach(b => {
            console.log(`    - ${b.name} (TL${b.tl}, ${b.class || b.category || ''})`);
        });
        if (ref.bestiary.length > 5) console.log(`      ... and ${ref.bestiary.length - 5} more`);
    }
    if (ref.npcs && ref.npcs.length) {
        console.log(`  👤 NPCs (${ref.npcs.length}):`);
        ref.npcs.slice(0, 5).forEach(n => {
            console.log(`    - ${n.name} (${n.role || 'NPC'})`);
        });
        if (ref.npcs.length > 5) console.log(`      ... and ${ref.npcs.length - 5} more`);
    }
    if (ref.locations && ref.locations.length) {
        console.log(`  📍 Locations (${ref.locations.length}):`);
        ref.locations.slice(0, 5).forEach(l => {
            console.log(`    - ${l.name}${l.description ? ': ' + l.description.slice(0, 60) + '…' : ''}`);
        });
        if (ref.locations.length > 5) console.log(`      ... and ${ref.locations.length - 5} more`);
    }
    if (ref.factions && ref.factions.length) {
        console.log(`  ⚑ Factions (${ref.factions.length}):`);
        ref.factions.forEach(f => {
            console.log(`    - ${f.name} (${f.goals || ''})`);
        });
    }
    if (ref.notes) {
        console.log(`  📝 Notes: ${ref.notes.slice(0, 200)}${ref.notes.length > 200 ? '…' : ''}`);
    }
    // NEW: full GM/AI-eyes-only knowledge view -- `ref` comes from
    // GET/'adventure-reference-request', the same GM-only fetch npcs/
    // bestiary/notes above already come from, so it's safe to print the
    // raw `gm` secret text here (unlike printAdventureKnowledge() below,
    // which only ever sees the player-safe subset).
    if (ref.knowledge && ref.knowledge.length) {
        console.log(`  🗝️  Knowledge (${ref.knowledge.length}, GM view):`);
        ref.knowledge.forEach(k => {
            const lock = k.revealed ? '🔓' : '🔒';
            console.log(`    ${lock} ${k.id}${k.subject ? ` (${k.subject})` : ''} — ${k.revealed ? 'REVEALED' : 'secret'}`);
            console.log(`        gm: ${(k.gm || '').slice(0, 140)}${(k.gm || '').length > 140 ? '…' : ''}`);
            if (!k.revealed) console.log(`        players know: ${k.player ?? '(nothing yet)'}`);
        });
    }
    promptAgain(true);
}

// NEW: player-safe knowledge view -- from adventureState.knowledge, which
// comes off getPublicState()'s filtered `{ id, subject, revealed, text }`
// shape (see server/adventure.js). `text` is already the correct thing
// to show regardless of revealed state, so this never needs to branch on
// it the way printAdventureReference()'s GM view does above.
function printAdventureKnowledge(knowledge) {
    if (!knowledge || !knowledge.length) {
        printSystemMessage('This adventure defines no knowledge/secret entries (or none is loaded).', colors.dim);
        return;
    }
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.magenta}🗝️  Knowledge State (${knowledge.length}):${colors.reset}`);
    knowledge.forEach(k => {
        const lock = k.revealed ? '🔓' : '🔒';
        const status = k.revealed ? colors.green + 'REVEALED' + colors.reset : colors.dim + 'secret' + colors.reset;
        console.log(`  ${lock} ${k.id}${k.subject ? ` (${k.subject})` : ''} — ${status}`);
        console.log(`      ${k.text ?? '(nothing to tell yet)'}`);
    });
    console.log(`${colors.dim}Use /adventure reveal <id> or /adventure hide <id> to change one (GM only).${colors.reset}`);
    promptAgain(true);
}

// ─── Help command ──────────────────────────────────────────────
function printHelp() {
    process.stdout.write('\r\x1b[K');
    console.log(`
${colors.magenta}╔══════════════════════════════════════════════════════════════╗
║  Edge CLI v${CONFIG.version} - Commands                                    ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}

${colors.yellow}Connection:${colors.reset}
  /connect [url] [room]      Connect (e.g., /connect ws://localhost:3000 AIGM)
  /disconnect                 Disconnect
  /status                     Show status

${colors.yellow}Account (optional):${colors.reset}
  /register <user> <pass>      Create an account and log in
  /login <user> <pass>         Log in to an existing account
  /logout                      Log out (local only)
  /whoami                      Show login status
  Logging in is optional -- takes effect on your next /connect. Lets a
  GM skip re-asking for a room password once you've joined, and makes
  bans against you survive reconnects.

${colors.yellow}Saved Characters (requires /login):${colors.reset}
  /mychar list                 List your saved characters (max 5)
  /mychar save <name> <json>   Save a character (json = character data)
  /mychar delete <id>          Delete a saved character

${colors.yellow}Chat & Dice:${colors.reset}
  <message>                   Send chat
  /roll <dice> [adv|dis] [reason]  Roll dice (e.g., /roll 1d20 adv "Attack")
  /history                    Show your last 10 rolls
  /name <name>                Change your name

${colors.yellow}Deck:${colors.reset}
  /draw [count] [region]      Draw cards (1-5)
  /crown [region]             Crown Spread
  /shuffle                    Shuffle deck
  /deck-status                Remaining cards

${colors.yellow}Adventure Engine:${colors.reset}
  /adventure help             This adventure command help
  /adventure status           Show current adventure state
  /adventure load <moduleId>  Load an adventure module
  /adventure scene [actIdx] [sceneIdx]  Advance to a specific scene (omit both to advance sequentially)
  /adventure encounter start <ref>      Start an encounter by index or name/creatureId
  /adventure encounter resolve <outcome>  Resolve active encounter (clean|partial|miss)
  /adventure timer <name> [amount]      Tick a timer (default +1)
  /adventure log <text>       Add a narrative beat to the log
  /adventure reference         Show reference data (bestiary, NPCs, locations, factions)
  /adventure knowledge         Show this adventure's knowledge/secret state (player-safe view)
  /adventure reveal <id>       Mark a knowledge entry revealed, safe to share (GM only)
  /adventure hide <id>         Mark a knowledge entry secret again (GM only)

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

${colors.yellow}You:${colors.reset}
  /whoami                      Show your identity card
  /stats                       Show session stats
  /theme [name]                Show/switch color theme (${Object.keys(THEMES).join(', ')})

${colors.yellow}Extras:${colors.reset}
  /time                        Real time + in-world Reckoning date
  /fortune                     A short fortune
  /ascii <text>                Render text as ASCII art
  /matrix                      ...you'll see
  /party                       🎉
  /who                         Request presence update
  /banner [reload|fetch]       Show a random banner; reload from cache, fetch new
  /help                        This help
  /quit / exit                 Quit
${colors.dim}(Launch with "node terminal-client.js --curses" for a full-screen curses UI.)${colors.reset}
${ADMIN_MODE ? `
${colors.yellow}Admin (API Key Active):${colors.reset}
  /admin players              List clients
  /admin kick <name|id> [reason]
  /admin ban <name|id> [reason]
  /admin unban <clientId>
` : ''}
${colors.dim}(Some commands aren't listed here. Curiosity is rewarded.)${colors.reset}
`);
    promptAgain(true);
}

function printAdventureHelp() {
    process.stdout.write('\r\x1b[K');
    console.log(`
${colors.magenta}📖 Adventure Commands${colors.reset}
  /adventure status            Show current adventure state
  /adventure load <moduleId>   Load an adventure module by its ID (from /modules list)
  /adventure scene [actIndex] [sceneIndex]  Advance to a specific scene (omit both to advance sequentially)
  /adventure encounter start <ref>   Start an encounter in the current scene (ref = index or name/creatureId)
  /adventure encounter resolve <outcome>  Resolve active encounter (clean|partial|miss)
  /adventure timer <name> [amount]  Tick a timer by name (amount defaults to +1)
  /adventure log <text>        Append a narrative beat to the adventure log
  /adventure reference          Show reference data (bestiary, NPCs, locations, factions)
  /adventure knowledge          Show this adventure's knowledge/secret state (player-safe view)
  /adventure reveal <id>        Mark a knowledge entry revealed, safe to share (GM only)
  /adventure hide <id>          Mark a knowledge entry secret again (GM only)
${colors.dim}All adventure commands require a connection and GM role (or admin).${colors.reset}
`);
    promptAgain(true);
}

// ─── ASCII art (unchanged) ─────────────────────────────────────
const FONT = {
    ' ': ["     ", "     ", "     ", "     ", "     "],
    'A': [" ### ", "#   #", "#####", "#   #", "#   #"],
    'B': ["#### ", "#   #", "#### ", "#   #", "#### "],
    'C': [" ####", "#    ", "#    ", "#    ", " ####"],
    'D': ["#### ", "#   #", "#   #", "#   #", "#### "],
    'E': ["#####", "#    ", "#### ", "#    ", "#####"],
    'F': ["#####", "#    ", "#### ", "#    ", "#    "],
    'G': [" ####", "#    ", "#  ##", "#   #", " ####"],
    'H': ["#   #", "#   #", "#####", "#   #", "#   #"],
    'I': ["#####", "  #  ", "  #  ", "  #  ", "#####"],
    'J': ["    #", "    #", "    #", "#   #", " ### "],
    'K': ["#   #", "#  # ", "###  ", "#  # ", "#   #"],
    'L': ["#    ", "#    ", "#    ", "#    ", "#####"],
    'M': ["#   #", "## ##", "# # #", "#   #", "#   #"],
    'N': ["#   #", "##  #", "# # #", "#  ##", "#   #"],
    'O': [" ### ", "#   #", "#   #", "#   #", " ### "],
    'P': ["#### ", "#   #", "#### ", "#    ", "#    "],
    'Q': [" ### ", "#   #", "#   #", "#  # ", " ## #"],
    'R': ["#### ", "#   #", "#### ", "#  # ", "#   #"],
    'S': [" ####", "#    ", " ### ", "    #", "#### "],
    'T': ["#####", "  #  ", "  #  ", "  #  ", "  #  "],
    'U': ["#   #", "#   #", "#   #", "#   #", " ### "],
    'V': ["#   #", "#   #", "#   #", " # # ", "  #  "],
    'W': ["#   #", "#   #", "# # #", "## ##", "#   #"],
    'X': ["#   #", " # # ", "  #  ", " # # ", "#   #"],
    'Y': ["#   #", " # # ", "  #  ", "  #  ", "  #  "],
    'Z': ["#####", "   # ", "  #  ", " #   ", "#####"],
    '0': [" ### ", "#   #", "#   #", "#   #", " ### "],
    '1': ["  #  ", " ##  ", "  #  ", "  #  ", "#####"],
    '2': [" ### ", "#   #", "   # ", "  #  ", "#####"],
    '3': ["#####", "   # ", "  ###", "    #", "#####"],
    '4': ["#   #", "#   #", "#####", "    #", "    #"],
    '5': ["#####", "#    ", "#### ", "    #", "#### "],
    '6': [" ### ", "#    ", "#### ", "#   #", " ### "],
    '7': ["#####", "    #", "   # ", "  #  ", "  #  "],
    '8': [" ### ", "#   #", " ### ", "#   #", " ### "],
    '9': [" ### ", "#   #", " ####", "    #", " ### "],
    '!': ["  #  ", "  #  ", "  #  ", "     ", "  #  "],
    '?': [" ### ", "#   #", "   # ", "     ", "  #  "],
};

function renderAsciiText(text) {
    const rows = ['', '', '', '', ''];
    for (const ch of text.toUpperCase()) {
        const glyph = FONT[ch] || FONT[' '];
        for (let i = 0; i < 5; i++) rows[i] += glyph[i] + ' ';
    }
    return rows.join('\n');
}

// ─── Other extras (unchanged) ────────────────────────────────
const AMBER_EPOCH_OFFSET = -862;
const SEASON_NAMES = ['Kindling', 'Greening', 'Highsun', 'Ashing', 'Frostfall', 'Deepnight'];

function getAmberReckoning(date = new Date()) {
    const arYear = date.getFullYear() + AMBER_EPOCH_OFFSET;
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date - startOfYear) / 86400000);
    const seasonIdx = Math.min(SEASON_NAMES.length - 1, Math.floor((dayOfYear / 366) * SEASON_NAMES.length));
    return `${SEASON_NAMES[seasonIdx]}, Year ${arYear} A.R.`;
}

const FORTUNES = [
    "Count exits, not victims.",
    "The wise play for breaths, not squares.",
    "A quiet move wins louder than a brilliant one.",
    "Fortune favors the prepared roll.",
    "Every road pays a toll, eventually.",
    "Seed for tomorrow; map your escape today.",
    "A locked door and a closed mind open the same way: not at all.",
    "The GM's silence is rarely peaceful.",
    "Some fates are rolled. Others are chosen.",
    "In Acasia, even the winters keep a ledger.",
    "Not all who wander the terminal are lost.",
    "The dice remember nothing. The table remembers everything.",
    "Ask for advantage. You might just get it.",
    "A natural 1 builds more character than a natural 20.",
    "42."
];

function getRandomFortune() {
    return FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
}

function playMatrixRain(durationMs = 2500) {
    // NEW: raw cursor-positioning ANSI writes fight with blessed's own
    // screen buffer in curses mode, so just print a one-liner instead.
    if (TUI_MODE) {
        console.log(`${colors.green}...you'll see (matrix rain is classic-mode only for now)${colors.reset}`);
        return Promise.resolve();
    }
    return new Promise(resolve => {
        const cols = Math.min(process.stdout.columns || 80, 120);
        const rows = Math.min(process.stdout.rows || 24, 30);
        const chars = 'アイウエオカキクケコサシスセソ0123456789$#@%&';
        const drops = new Array(cols).fill(0).map(() => Math.floor(Math.random() * rows));
        let stopped = false;
        process.stdout.write('\x1b[?25l');
        const interval = setInterval(() => {
            let out = '\x1b[H';
            const grid = Array.from({ length: rows }, () => new Array(cols).fill(' '));
            for (let c = 0; c < cols; c++) {
                const r = drops[c];
                if (r >= 0 && r < rows) grid[r][c] = chars[Math.floor(Math.random() * chars.length)];
                drops[c] = (drops[c] + 1) % (rows + Math.floor(Math.random() * 10));
            }
            for (let r = 0; r < rows; r++) out += colors.green + grid[r].join('') + colors.reset + '\n';
            process.stdout.write(out);
        }, 90);
        setTimeout(() => {
            if (stopped) return;
            stopped = true;
            clearInterval(interval);
            process.stdout.write('\x1b[?25h');
            resolve();
        }, durationMs);
    });
}

async function playPartyMode() {
    const rainbow = [colors.red, colors.yellow, colors.green, colors.cyan, colors.blue, colors.magenta];
    // NEW: in curses mode, animate via the log pane instead of raw \r writes.
    if (TUI_MODE) {
        for (let i = 0; i < 12; i++) {
            console.log(rainbow[i % rainbow.length] + '🎉 PARTY MODE 🎉' + colors.reset);
            await new Promise(r => setTimeout(r, 100));
        }
        promptAgain(true);
        return;
    }
    for (let i = 0; i < 12; i++) {
        process.stdout.write('\r\x1b[K' + rainbow[i % rainbow.length] + '🎉 PARTY MODE 🎉' + colors.reset);
        await new Promise(r => setTimeout(r, 100));
    }
    process.stdout.write('\r\x1b[K');
    promptAgain(true);
}

const COFFEE_ART = `
${colors.yellow}      ) ) )
     ( ( (
    .......
    |     |]
    \\     /
     \`---'${colors.reset}
${colors.dim}  Terminal fueled. Bug reports welcome, coffee mandatory.${colors.reset}
`;

function triggerKonami() {
    console.log(`
${colors.yellow}${colors.bold}⬆️⬆️⬇️⬇️⬅️➡️⬅️➡️🅱️🅰️${colors.reset}
${colors.magenta}You feel a strange sense of ancient power...
Nothing actually happens. This isn't that kind of game.${colors.reset}
`);
    promptAgain(true);
}

const CHAT_EASTER_EGGS = [
    { pattern: /^sudo make me a sandwich$/i, respond: () => printSystemMessage(`${colors.green}Okay.${colors.reset} 🥪 (Root privileges are a hell of a drug.)`) },
    { pattern: /^good bot$/i, respond: () => printSystemMessage('🤖 beep boop, thank you!', colors.cyan) },
    { pattern: /^bad bot$/i, respond: () => printSystemMessage('🤖 ...I am but dice and readline.', colors.gray) },
    { pattern: /^42$/, respond: () => printSystemMessage("Don't panic. 🐬", colors.yellow) },
    { pattern: /^konami$/i, respond: () => triggerKonami() },
];

// ─── REST API (admin) ──────────────────────────────────────────
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

// ─── REST API (optional account auth) ───────────────────────────
// NEW: separate from makeApiRequest() above, which always attaches the
// static admin x-api-key -- /api/auth/register and /api/auth/login don't
// require it at all, and /api/auth/me needs a per-user Bearer token
// instead. Kept as its own helper rather than overloading makeApiRequest
// so the two auth models (admin key vs. player account) can't get
// accidentally crossed.
async function makeAuthRequest(endpoint, method = 'GET', data = null, bearerToken = null) {
    const url = `${apiBaseUrl}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
    const options = { method, headers };
    if (data && method !== 'GET') options.body = JSON.stringify(data);
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
    return body;
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
                promptAgain(true);
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
            sessionStats.sessionStart = Date.now();
            printSystemMessage('Connected! Sending handshake...');
            ws.send(JSON.stringify({
                type: 'handshake',
                campaignCode: roomCode,
                password: password,
                // NEW: optional -- omitted/invalid tokens just mean an
                // anonymous join, exactly as before. See /login, /register.
                authToken: userConfig.authToken || undefined,
                clientName: clientName,
                role: 'player',
                version: CONFIG.version
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
    printSystemMessage('Disconnected.');
    promptAgain(true);
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

// ─── Dice roller (unchanged) ──────────────────────────────────
function rollOnce(formula) {
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
    return { formula, total, rolls, count, sides, mod };
}

function rollDice(formula, mode = 'normal') {
    const first = rollOnce(formula);
    if (first.error || mode === 'normal') return first;
    const second = rollOnce(formula);
    const [better, worse] = mode === 'adv'
        ? (first.total >= second.total ? [first, second] : [second, first])
        : (first.total <= second.total ? [first, second] : [second, first]);
    return { ...better, alternateTotal: worse.total, mode };
}

// ─── Command processing ──────────────────────────────────────────
// NEW: named function (was an inline rl.on('line', ...) callback) so the
// blessed input box in curses mode can drive the exact same command logic.
function handleInputLine(input) {
    const trimmed = input.trim();
    if (!trimmed) { promptAgain(); return; }

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
                    if (ADMIN_MODE) printSystemMessage(`Admin mode: ✅`, colors.green);
                    // Adventure state
                    if (adventureState.moduleId) {
                        printSystemMessage(`Adventure: ${adventureState.title || adventureState.moduleId} (${adventureState.status || 'unknown'})`, colors.magenta);
                    } else {
                        printSystemMessage(`Adventure: none loaded`, colors.dim);
                    }
                }
                break;

            case 'name':
                if (argStr) { clientName = argStr; printSystemMessage(`Name set to: ${clientName}`); }
                else printSystemMessage(`Current name: ${clientName}`);
                break;

            // ─── Optional account login (NEW) ───────────────────
            // Entirely optional -- without logging in, /connect keeps
            // working exactly as it always has. Logging in lets a GM
            // exempt you from re-entering a room's password on later
            // joins, and makes a ban against you survive reconnects
            // (see server/room.js's persistent-membership notes).
            case 'register':
            case 'login': {
                const [username, ...pwParts] = args;
                const pw = pwParts.join(' ');
                if (!username || !pw) {
                    printSystemMessage(`Usage: /${cmd} <username> <password>`);
                    break;
                }
                (async () => {
                    try {
                        const body = await makeAuthRequest(
                            cmd === 'register' ? '/auth/register' : '/auth/login',
                            'POST', { username, password: pw }
                        );
                        userConfig.authToken = body.token;
                        userConfig.authUsername = body.user?.username || username;
                        saveUserConfig();
                        printSystemMessage(`✅ ${cmd === 'register' ? 'Registered and logged in' : 'Logged in'} as ${userConfig.authUsername}. This applies on your NEXT /connect.`, colors.green);
                    } catch (e) {
                        printSystemMessage(`❌ ${cmd} failed: ${e.message}`, colors.red);
                    }
                    promptAgain();
                })();
                return; // async -- prompt is re-shown by the callback above
            }

            case 'logout':
                userConfig.authToken = null;
                userConfig.authUsername = null;
                saveUserConfig();
                printSystemMessage('Logged out. (Takes effect on your next /connect.)');
                break;

            // ─── Saved characters (NEW) ─────────────────────────
            // Thin wrapper around GET/POST/DELETE /api/account/characters,
            // the Bearer-token-protected endpoints for a logged-in user's
            // up-to-5 saved characters. Reuses makeAuthRequest() and the
            // token from /login|/register above -- no new auth plumbing.
            case 'mychar': {
                if (!userConfig.authToken) {
                    printSystemMessage('You must /login or /register first.', colors.red);
                    break;
                }
                const mySub = args[0]?.toLowerCase();
                (async () => {
                    try {
                        if (mySub === 'list' || !mySub) {
                            const body = await makeAuthRequest('/account/characters', 'GET', null, userConfig.authToken);
                            const chars = body.characters || body || [];
                            if (!chars.length) { printSystemMessage('No saved characters.'); }
                            else {
                                process.stdout.write('\r\x1b[K');
                                console.log(`${colors.cyan}🗂️ Saved Characters (${chars.length}/5):${colors.reset}`);
                                chars.forEach(c => console.log(`  \`${c.id}\` - ${c.name}`));
                                promptAgain(true);
                            }
                        } else if (mySub === 'save') {
                            const charName = args[1];
                            const jsonStr = args.slice(2).join(' ');
                            if (!charName || !jsonStr) { printSystemMessage('Usage: /mychar save <name> <json>', colors.red); promptAgain(); return; }
                            let data;
                            try { data = JSON.parse(jsonStr); } catch (e) { printSystemMessage(`Invalid JSON: ${e.message}`, colors.red); promptAgain(); return; }
                            await makeAuthRequest('/account/characters', 'POST', { name: charName, data }, userConfig.authToken);
                            printSystemMessage(`✅ Saved character "${charName}".`, colors.green);
                        } else if (mySub === 'delete') {
                            const id = args[1];
                            if (!id) { printSystemMessage('Usage: /mychar delete <id>', colors.red); promptAgain(); return; }
                            await makeAuthRequest(`/account/characters/${id}`, 'DELETE', null, userConfig.authToken);
                            printSystemMessage(`🗑️ Deleted character ${id}.`, colors.green);
                        } else {
                            printSystemMessage('Usage: /mychar list | save <name> <json> | delete <id>');
                        }
                    } catch (e) {
                        printSystemMessage(`❌ /mychar ${mySub || 'list'} failed: ${e.message}`, colors.red);
                    }
                    promptAgain();
                })();
                return; // async -- prompt is re-shown by the callback above
            }

            case 'whoami':
                if (userConfig.authUsername) {
                    printSystemMessage(`🔐 Logged in as: ${userConfig.authUsername}`, colors.green);
                } else {
                    printSystemMessage('🔓 Not logged in (playing anonymously). Use /login or /register.');
                }
                if (connected) printSystemMessage(`In-room display name: ${clientName} (${myRole})`);
                break;

            // ─── Dice rolling ──────────────────────────────────
            case 'roll':
            case 'r': {
                if (!argStr) { printSystemMessage('Usage: /roll <dice> [adv|dis] [reason]'); break; }

                let mode = 'normal';
                const modeArgs = args.filter(a => {
                    const lower = a.toLowerCase();
                    if (lower === 'adv' || lower === 'advantage') { mode = 'adv'; return false; }
                    if (lower === 'dis' || lower === 'disadvantage') { mode = 'dis'; return false; }
                    return true;
                });
                const cleanedArgStr = modeArgs.join(' ');

                const match = cleanedArgStr.match(/^([^\s"]+(?:\s+[^\s"]+)*?)(?:\s+(.+))?$/);
                let diceExpr = cleanedArgStr, reason = '';
                if (match) { diceExpr = match[1]; reason = match[2] || ''; }

                const rollData = rollDice(diceExpr, mode);
                if (rollData.error) { printSystemMessage(rollData.error, colors.red); break; }

                const isD20 = rollData.count === 1 && rollData.sides === 20;
                const natRoll = isD20 ? rollData.rolls[0] : null;
                const isCrit = isD20 && natRoll === 20;
                const isFumble = isD20 && natRoll === 1;

                if (sendMessage('roll-dice', { roll: diceExpr, reason, mode })) {
                    sessionStats.rollsMade++;
                    sessionStats.diceTotal += rollData.total;
                    if (isCrit) sessionStats.crits++;
                    if (isFumble) sessionStats.fumbles++;
                    rollHistory.push({ formula: diceExpr, total: rollData.total, crit: isCrit, fumble: isFumble, mode });
                    if (rollHistory.length > MAX_ROLL_HISTORY) rollHistory.shift();

                    let extra = '';
                    if (mode !== 'normal') extra += ` [${mode === 'adv' ? 'ADV' : 'DIS'}, other roll: ${rollData.alternateTotal}]`;
                    if (isCrit) extra += ` ${colors.green}${colors.bold}⭐ CRITICAL!${colors.reset}${colors.yellow}`;
                    if (isFumble) extra += ` ${colors.red}💀 FUMBLE!${colors.reset}${colors.yellow}`;
                    if (Math.random() < 0.02) extra += ` ${colors.magenta}✨ Fate intervenes...${colors.reset}${colors.yellow}`;
                    printRollResult(clientName, diceExpr, rollData.total, rollData.rolls.join(', ') + extra);
                }
                break;
            }

            case 'history': {
                if (!rollHistory.length) { printSystemMessage('No rolls yet this session.'); break; }
                process.stdout.write('\r\x1b[K');
                console.log(`${colors.yellow}🎲 Recent Rolls:${colors.reset}`);
                rollHistory.slice(-10).reverse().forEach(r => {
                    const tag = r.crit ? ` ${colors.green}⭐ CRIT${colors.reset}` : r.fumble ? ` ${colors.red}💀 FUMBLE${colors.reset}` : '';
                    const modeTag = r.mode && r.mode !== 'normal' ? ` (${r.mode})` : '';
                    console.log(`  ${r.formula}${modeTag} → ${colors.bold}${r.total}${colors.reset}${tag}`);
                });
                promptAgain(true);
                break;
            }

            // ─── Deck ──────────────────────────────────────────
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

            // ─── Adventure Engine ──────────────────────────────
            case 'adventure': {
                const sub = args[0]?.toLowerCase() || '';
                const subArgs = args.slice(1);
                switch (sub) {
                    case 'help':
                        printAdventureHelp();
                        break;
                    case 'status':
                        printAdventureState(adventureState);
                        break;
                    case 'load': {
                        const moduleId = subArgs[0];
                        if (!moduleId) { printSystemMessage('Usage: /adventure load <moduleId>', colors.red); break; }
                        sendMessage('adventure-load', { moduleId });
                        printSystemMessage(`📖 Requesting load of "${moduleId}"...`, colors.magenta);
                        break;
                    }
                    case 'scene': {
                        const actIdx = subArgs[0] !== undefined ? parseInt(subArgs[0]) : undefined;
                        const sceneIdx = subArgs[1] !== undefined ? parseInt(subArgs[1]) : undefined;
                        const target = {};
                        if (actIdx !== undefined) target.actIndex = actIdx;
                        if (sceneIdx !== undefined) target.sceneIndex = sceneIdx;
                        sendMessage('adventure-scene', target);
                        printSystemMessage(`🎭 Advancing scene...`, colors.magenta);
                        break;
                    }
                    case 'encounter': {
                        const encSub = subArgs[0]?.toLowerCase() || '';
                        const encArgs = subArgs.slice(1);
                        if (encSub === 'start') {
                            const ref = encArgs[0];
                            if (!ref) { printSystemMessage('Usage: /adventure encounter start <ref>', colors.red); break; }
                            // If ref looks like a number, send as number; otherwise string
                            const parsedRef = isNaN(ref) ? ref : parseInt(ref);
                            sendMessage('adventure-encounter-start', { ref: parsedRef });
                            printSystemMessage(`⚔️ Starting encounter "${ref}"...`, colors.yellow);
                        } else if (encSub === 'resolve') {
                            const outcome = encArgs[0];
                            if (!outcome) { printSystemMessage('Usage: /adventure encounter resolve <outcome> (clean|partial|miss)', colors.red); break; }
                            if (!['clean', 'partial', 'miss'].includes(outcome)) {
                                printSystemMessage('Outcome must be clean, partial, or miss.', colors.red);
                                break;
                            }
                            const notes = encArgs.slice(1).join(' ') || '';
                            sendMessage('adventure-encounter-resolve', { outcome, notes });
                            printSystemMessage(`⚔️ Resolving encounter as ${outcome}...`, colors.yellow);
                        } else {
                            printSystemMessage('Encounter subcommands: start, resolve');
                        }
                        break;
                    }
                    case 'timer': {
                        const timerName = subArgs[0];
                        const amount = subArgs[1] !== undefined ? parseInt(subArgs[1]) : 1;
                        if (!timerName) { printSystemMessage('Usage: /adventure timer <name> [amount]', colors.red); break; }
                        sendMessage('adventure-timer', { ref: timerName, amount });
                        printSystemMessage(`⏱️ Ticking timer "${timerName}" by ${amount}...`, colors.cyan);
                        break;
                    }
                    case 'log': {
                        const text = subArgs.join(' ');
                        if (!text) { printSystemMessage('Usage: /adventure log <text>', colors.red); break; }
                        sendMessage('adventure-log', { text, author: clientName });
                        printSystemMessage(`📝 Logging beat: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`, colors.gray);
                        break;
                    }
                    case 'reference':
                        sendMessage('adventure-reference-request', {});
                        printSystemMessage('📚 Requesting reference data...', colors.magenta);
                        break;
                    case 'knowledge':
                        printAdventureKnowledge(adventureState.knowledge);
                        break;
                    case 'reveal': {
                        const id = subArgs[0];
                        if (!id) { printSystemMessage('Usage: /adventure reveal <id>', colors.red); break; }
                        sendMessage('adventure-knowledge-reveal', { id, by: clientName });
                        printSystemMessage(`🔓 Requesting reveal of "${id}"...`, colors.magenta);
                        break;
                    }
                    case 'hide': {
                        const id = subArgs[0];
                        if (!id) { printSystemMessage('Usage: /adventure hide <id>', colors.red); break; }
                        sendMessage('adventure-knowledge-hide', { id, by: clientName });
                        printSystemMessage(`🔒 Requesting hide of "${id}"...`, colors.magenta);
                        break;
                    }
                    default:
                        printSystemMessage(`Unknown adventure command. Use /adventure help.`);
                }
                break;
            }

            // ─── GM ─────────────────────────────────────────────
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

            // ─── Modules ────────────────────────────────────────
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

            case 'admin':
                handleAdminCommand(args);
                break;

            // ─── Banner and fun ─────────────────────────────────
            case 'banner': {
                const sub = args[0]?.toLowerCase();
                if (sub === 'reload') {
                    loadBannerCache();
                    printSystemMessage(`Banners reloaded from cache (${bannerCache.length} loaded)`, colors.green);
                    promptAgain(true);
                } else if (sub === 'fetch') {
                    printSystemMessage('Fetching a remote banner...', colors.dim);
                    fetchRemoteBanner()
                        .then(banner => {
                            addToCache(banner);
                            console.log(banner);
                            printSystemMessage(`Added new banner to cache (now ${bannerCache.length} total)`, colors.green);
                            promptAgain(true);
                        })
                        .catch(err => {
                            printSystemMessage(`Failed to fetch: ${err.message}`, colors.red);
                            promptAgain(true);
                        });
                } else {
                    console.log(getRandomBanner());
                    promptAgain(true);
                }
                break;
            }

            case 'who':
                if (connected) sendMessage('sync-request', { entity: 'presence' });
                else printSystemMessage('Not connected.');
                break;

            case 'whoami': {
                process.stdout.write('\r\x1b[K');
                console.log(`
${colors.magenta}╔════════════════════════════════╗
║  ${colors.yellow}Identity Card${colors.magenta}                   ║
╠════════════════════════════════╣${colors.reset}
  Name:    ${colors.cyan}${clientName}${colors.reset}
  Role:    ${colors.cyan}${myRole}${colors.reset}
  Region:  ${colors.cyan}${defaultRegion}${colors.reset}
  Server:  ${colors.gray}${connected ? serverUrl : 'not connected'}${colors.reset}
  Room:    ${colors.gray}${connected ? roomCode : '—'}${colors.reset}
  Theme:   ${colors.gray}${userConfig.theme}${colors.reset}
${adventureState.moduleId ? `  Adventure: ${colors.green}${adventureState.title || adventureState.moduleId}${colors.reset}` : ''}
${colors.magenta}╚════════════════════════════════╝${colors.reset}
`);
                promptAgain(true);
                break;
            }

            case 'stats': {
                const uptimeMin = Math.floor((Date.now() - sessionStats.sessionStart) / 60000);
                process.stdout.write('\r\x1b[K');
                console.log(`
${colors.cyan}📊 Session Stats${colors.reset}
  Uptime:         ${uptimeMin}m
  Rolls made:     ${sessionStats.rollsMade}
  Dice total:     ${sessionStats.diceTotal}
  Crits (nat20):  ${sessionStats.crits}
  Fumbles (nat1): ${sessionStats.fumbles}
  Messages sent:  ${sessionStats.messagesSent}
  Cards drawn:    ${sessionStats.cardsDrawn}
`);
                promptAgain(true);
                break;
            }

            case 'theme': {
                const name = args[0]?.toLowerCase();
                if (!name) {
                    printSystemMessage(`Current theme: ${userConfig.theme}. Available: ${Object.keys(THEMES).join(', ')}`);
                    break;
                }
                if (!THEMES[name]) {
                    printSystemMessage(`Unknown theme "${name}". Available: ${Object.keys(THEMES).join(', ')}`, colors.red);
                    break;
                }
                colors = THEMES[name];
                userConfig.theme = name;
                saveUserConfig();
                if (rl) rl.setPrompt(`${colors.gray}>${colors.reset} `);
                printSystemMessage(`🎨 Theme switched to "${name}".`, colors.green);
                break;
            }

            case 'time': {
                const now = new Date();
                printSystemMessage(`🕐 Real time: ${now.toLocaleString()}`);
                printSystemMessage(`📜 Reckoning: ${getAmberReckoning(now)}`, colors.magenta);
                break;
            }

            case 'fortune':
                printSystemMessage(`🔮 ${getRandomFortune()}`, colors.magenta);
                break;

            case 'ascii': {
                if (!argStr) { printSystemMessage('Usage: /ascii <text>'); break; }
                const text = argStr.slice(0, 20);
                process.stdout.write('\r\x1b[K');
                console.log(colors.cyan + renderAsciiText(text) + colors.reset);
                promptAgain(true);
                break;
            }

            case 'matrix':
                playMatrixRain().then(() => promptAgain(true));
                break;

            case 'party':
                playPartyMode();
                break;

            case 'coffee':
                console.log(COFFEE_ART);
                promptAgain(true);
                break;

            case 'about':
                console.log(`
${colors.magenta}Fate's Edge Terminal Client${colors.reset}
${colors.dim}Built by someone who definitely tested this in production.${colors.reset}
${colors.dim}Powered by dice, dread, and an unreasonable number of ANSI codes.${colors.reset}
${colors.gray}Try typing things you shouldn't. You might find more than this.${colors.reset}
`);
                promptAgain(true);
                break;

            case 'help':
                printHelp();
                break;

            case 'quit':
            case 'exit':
                if (ws) ws.close();
                if (screen) screen.destroy();
                process.exit(0);
                break;

            default:
                printSystemMessage(`Unknown command: /${cmd}. Type /help.`);
        }
    } else {
        const egg = CHAT_EASTER_EGGS.find(e => e.pattern.test(trimmed));
        if (egg) {
            if (connected) {
                sessionStats.messagesSent++;
                sendMessage('chat-message', { text: trimmed, sender: clientName });
                printChatMessage(clientName, trimmed);
            }
            egg.respond();
        } else if (connected) {
            sessionStats.messagesSent++;
            sendMessage('chat-message', { text: trimmed, sender: clientName });
            printChatMessage(clientName, trimmed);
        } else {
            printSystemMessage('Not connected.');
        }
    }
    promptAgain();
}
if (rl) rl.on('line', handleInputLine);

// ─── Message handler (updated for adventure events) ────────────
function handleMessage(msg) {
    // ─── Adventure Engine events ──────────────────────────────
    if (msg.type === 'adventure-loaded') {
        adventureState = { ...msg }; // overwrite with full state
        printSystemMessage(`📖 Adventure loaded: ${msg.title || msg.moduleId}`, colors.magenta);
        printAdventureState(adventureState);
        return;
    }
    if (msg.type === 'scene-changed') {
        adventureState = { ...adventureState, ...msg };
        printSystemMessage(`🎭 Scene changed`, colors.magenta);
        printAdventureState(adventureState);
        return;
    }
    if (msg.type === 'encounter-started') {
        adventureState = { ...adventureState, ...msg };
        printSystemMessage(`⚔️ Encounter started: ${msg.activeEncounter?.name || 'Unknown'}`, colors.yellow);
        printAdventureState(adventureState);
        return;
    }
    if (msg.type === 'encounter-resolved') {
        adventureState = { ...adventureState, ...msg };
        const encName = msg.lastResolution?.encounter || 'Encounter';
        const outcome = msg.lastResolution?.outcome || '?';
        printSystemMessage(`⚔️ ${encName} resolved: ${outcome}`, colors.yellow);
        printAdventureState(adventureState);
        return;
    }
    if (msg.type === 'timer-ticked') {
        adventureState = { ...adventureState, ...msg };
        if (msg.tickedTimer) {
            const t = msg.tickedTimer;
            printSystemMessage(`⏱️ Timer "${t.name}" advanced: ${t.current}/${t.segments}${t.full ? ' (FULL)' : ''}`, colors.cyan);
        } else {
            printSystemMessage(`⏱️ Timer ticked.`, colors.cyan);
        }
        return;
    }
    if (msg.type === 'adventure-log') {
        adventureState = { ...adventureState, ...msg };
        if (msg.log && msg.log.length) {
            const last = msg.log[msg.log.length - 1];
            printSystemMessage(`📝 Log: ${last.message || last.text || last.type}`, colors.gray);
        }
        return;
    }
    if (msg.type === 'adventure-state') {
        adventureState = { ...adventureState, ...msg };
        printSystemMessage(`📋 Adventure state received.`, colors.magenta);
        printAdventureState(adventureState);
        return;
    }
    if (msg.type === 'adventure-reference') {
        printSystemMessage(`📚 Reference data received.`, colors.magenta);
        printAdventureReference(msg);
        return;
    }
    if (msg.type === 'adventure-reset') {
        adventureState = { ...adventureState, ...msg };
        printSystemMessage(`🔄 Adventure reset.`, colors.magenta);
        printAdventureState(adventureState);
        return;
    }
    // NEW: knowledge-state reveal/hide broadcasts (see server/adventure.js's
    // revealKnowledge()/hideKnowledge() and the matching WS cases in
    // ws-handlers.js). Payload spreads getPublicState() same as every other
    // Adventure Engine broadcast, so this also refreshes
    // adventureState.knowledge with the player-safe view.
    if (msg.type === 'adventure-knowledge-revealed') {
        adventureState = { ...adventureState, ...msg };
        printSystemMessage(`🔓 Knowledge revealed: ${msg.id}`, colors.magenta);
        return;
    }
    if (msg.type === 'adventure-knowledge-hidden') {
        adventureState = { ...adventureState, ...msg };
        printSystemMessage(`🔒 Knowledge hidden again: ${msg.id}`, colors.magenta);
        return;
    }

    // ─── Existing events (unchanged) ──────────────────────────
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
            sessionStats.cardsDrawn += (msg.cards || []).length;
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
            if (msg.adventure) {
                adventureState = { ...adventureState, ...msg.adventure };
            }
            printSystemMessage(`Room state received. ${Object.keys(clients).length} clients online.`);
            break;

        case 'state-updated':
            printSystemMessage(`State updated by ${msg.updatedBy || 'Unknown'}`);
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
            promptAgain(true);
    }
}

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

// ─── Welcome ──────────────────────────────────────────────────────
console.log(getRandomBanner());
console.log(`Type ${colors.yellow}/help${colors.reset} for commands.`);
console.log(`Set your name with ${colors.yellow}/name <Your Name>${colors.reset}`);
console.log(`Connect with ${colors.yellow}/connect [url] [room]${colors.reset}`);
if (ADMIN_MODE) console.log(`${colors.green}Admin mode enabled. Use /admin for player management.${colors.reset}`);
else console.log(`${colors.dim}Tip: Set API_KEY env to enable admin commands.${colors.reset}`);
if (!TUI_MODE) console.log(`${colors.dim}Tip: Launch with --curses for a full-screen curses UI.${colors.reset}`);
console.log(`${colors.dim}💭 ${getRandomFortune()}${colors.reset}`);
console.log('');

promptAgain();

process.on('SIGINT', () => {
    if (ws) ws.close();
    if (screen) screen.destroy();
    process.exit(0);
});