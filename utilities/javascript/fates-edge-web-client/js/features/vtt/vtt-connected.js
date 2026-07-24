/**
 * VTT Connected Mode – WebSocket sync, real‑time collaboration
 * Uses reactive store for all UI updates.
 * 
 * v3 – Full character sync from server (room-state, sync-state, state-updated)
 * v4 – Restructured layout/visual pass: card-based sections, stat pills,
 *      clearer typographic hierarchy. No IDs/classes/behavior removed.
 */

import { vttStore } from '../../core/vtt-store.js';
import { getState, clearChatHistory, getCharacter, addVTTEvent, addSessionLogEntry, getCharacters, ensureCharacterDefaults } from '../../core/state.js';
import { performRoll } from '../../core/dice.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';
import {
    isConnectedToServer,
    sendChatMessage,
    sendRoll,
    sendEvent,
    onEvent,
    offEvent,
    getRoomCode,
    getSocketId,
    getApiBaseUrl,
    drawCards,
    shuffleDeck,
    drawCrownSpread,
    getDeckHistory,
    clearDeckHistory,
    requestModulePush,
    requestModuleCleanup,
    listModules,
    onWSEvent,
    offWSEvent,
    getConnectionMode,
    sendWSMessage
} from '../../core/websocket.js';
import {
    setContainer,
    q,
    qa,
    renderChat,
    renderVTTChars,
    renderVTTTimers,
    renderLocalPresence,
    renderVoiceClients,
    updateMessageCount,
    populateChatRecipients,
    playNotificationSound,
    VTT_CONFIG,
    getOutcomeColor,
    renderCommonRolls,
} from './vtt-core.js';
import {
    initVoice,
    toggleMute,
    getVoiceStatus,
    cleanupVoice,
    getActiveVoiceClients,
    getVoiceClient,
    initiateVoiceCall,
    onVoiceClientsChanged
} from './voice.js';

// ============================================================
// STATE
// ============================================================

let container = null;
let voiceInitialized = false;
let wsListeners = new Map();
let eventListeners = [];
let docEventListeners = []; // listeners attached to `document` rather than `container` -- must be removed from document, not container
let isDestroyed = false;
let reconnectTimer = null;
let voiceUnsubscribe = null;
let presenceInterval = null;
let deckCountInterval = null;

// Deck state
let deckState = {
    cards: [],
    history: [],
    offset: 0,
    remaining: 54
};
let defaultRegion = 'Acasia';
let loadedModules = [];

// GM state
let gmState = {
    currentGmId: null,
    currentGmName: null,
    requests: [], // { requesterId, requesterName }
    myRole: 'player'
};
let clientsMap = new Map(); // id -> { id, name, role }

// Character push guard
let charactersPushed = false;

// ============================================================
// HELPERS – Get sender from selected character
// ============================================================

function getSenderName() {
    const selected = vttStore.getSelectedCharacter();
    if (selected && selected.name) return selected.name;
    // Fallback: first active character
    const chars = vttStore.state.characters || [];
    const active = chars.find(c => c.active !== false);
    if (active && active.name) return active.name;
    return 'Player';
}

// ============================================================
// MESSAGE SENDING (with WebSocket sync)
// ============================================================

function createMessage(text, sender, recipient = 'all', metadata = {}) {
    const isConnected = isConnectedToServer();
    return {
        text,
        sender,
        recipient,
        whisper: recipient !== 'all',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        local: !isConnected,
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sent: false,
        ...metadata
    };
}

export function sendMessage(text, sender, recipient = 'all', metadata = {}) {
    if (isDestroyed) return null;
    const isConnected = isConnectedToServer();
    const msg = createMessage(text, sender, recipient, metadata);

    vttStore.addChatMessage(msg);
    // Log chat message to VTT
    if (!msg.whisper) {
        try {
            addVTTEvent({
                type: 'chat_message',
                sender: sender,
                recipient: recipient,
                text: text.substring(0, 100)
            });
        } catch (e) { /* ignore */ }
    }
    if (isConnected) {
        try {
            sendChatMessage(msg);
            setTimeout(() => {
                const msgEl = q(`[data-msg-id="${msg.id}"]`);
                if (msgEl) {
                    const statusEl = msgEl.querySelector('.msg-status');
                    if (statusEl) {
                        statusEl.textContent = '✓✓';
                        statusEl.style.color = 'var(--green)';
                        statusEl.title = 'Synced to server';
                    }
                }
            }, 500);
        } catch (error) {
            console.warn('[VTT Connected] Failed to send via WebSocket:', error);
            showToast('Message failed to send. Check connection.', 'error');
            const msgEl = q(`[data-msg-id="${msg.id}"]`);
            if (msgEl) {
                const statusEl = msgEl.querySelector('.msg-status');
                if (statusEl) {
                    statusEl.textContent = '✗';
                    statusEl.style.color = 'var(--red)';
                    statusEl.title = 'Failed to send';
                }
            }
        }
    }
    return msg;
}

// ============================================================
// DECK COMMANDS (using unified WebSocket module)
// ============================================================

async function handleDeckDraw(count = 1, region = null) {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    const regionName = region || defaultRegion;
    
    if (isConnected) {
        try {
            const result = await drawCards(count, regionName);
            if (result && result.error) {
                showToast(`Deck draw failed: ${result.error}`, 'error');
            } else {
                showToast(`🃏 Drew ${count} card${count > 1 ? 's' : ''} from ${regionName}`, 'success');
                if (result && result.remaining !== undefined) {
                    deckState.remaining = result.remaining;
                    updateDeckUI();
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to send deck draw:', error);
            showToast('Deck draw failed. Check connection.', 'error');
        }
    } else {
        // Local fallback - simple draw without region data
        const cards = buildLocalDeck(count);
        const synthesis = cards.map(c => 
            `${c.rankName} of ${c.suitName}`
        ).join(', ');
        const msg = `🃏 Drew ${count} card${count > 1 ? 's' : ''}: ${synthesis}`;
        sendMessage(msg, 'Deck', 'all');
        deckState.remaining = Math.max(0, deckState.remaining - count);
        updateDeckUI();
    }
}

async function handleCrownSpread(region = null) {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    const regionName = region || defaultRegion;
    
    if (isConnected) {
        try {
            const result = await drawCrownSpread(regionName);
            if (result && result.error) {
                showToast(`Crown Spread failed: ${result.error}`, 'error');
            } else {
                showToast(`👑 Crown Spread from ${regionName}`, 'success');
                if (result && result.remaining !== undefined) {
                    deckState.remaining = result.remaining;
                    updateDeckUI();
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to send Crown Spread:', error);
            showToast('Crown Spread failed. Check connection.', 'error');
        }
    } else {
        showToast('Crown Spread requires server connection.', 'error');
    }
}

async function handleDeckShuffle() {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    
    if (isConnected) {
        try {
            const result = await shuffleDeck();
            if (result && result.error) {
                showToast(`Shuffle failed: ${result.error}`, 'error');
            } else {
                showToast('🔀 Deck shuffled.', 'success');
                if (result && result.remaining !== undefined) {
                    deckState.remaining = result.remaining;
                    updateDeckUI();
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to shuffle deck:', error);
            showToast('Deck shuffle failed.', 'error');
        }
    } else {
        showToast('Deck shuffle requires server connection.', 'error');
    }
}

async function handleDeckHistory() {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    
    if (isConnected) {
        try {
            const result = await getDeckHistory();
            if (result && result.error) {
                showToast(`History failed: ${result.error}`, 'error');
            } else if (result && result.history) {
                const history = result.history;
                if (history.length === 0) {
                    showToast('📜 No deck history available.', 'info');
                } else {
                    const entries = history.slice(-5).map(h => 
                        `${h.type}: ${h.cards}`
                    ).join('\n');
                    showToast(`📜 Recent draws:\n${entries}`, 'info');
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to get deck history:', error);
            showToast('Failed to get deck history.', 'error');
        }
    } else {
        showToast('Deck history requires server connection.', 'error');
    }
}

async function handleClearDeckHistory() {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    
    if (isConnected) {
        try {
            const result = await clearDeckHistory();
            if (result && result.error) {
                showToast(`Clear history failed: ${result.error}`, 'error');
            } else {
                showToast('🗑️ Deck history cleared.', 'success');
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to clear deck history:', error);
            showToast('Failed to clear deck history.', 'error');
        }
    } else {
        showToast('Clear history requires server connection.', 'error');
    }
}

function updateDeckUI() {
    const countEl = q('#vtt-deck-count');
    if (countEl) countEl.textContent = String(deckState.remaining || 0);
    const headerCountEl = q('#vtt-deck-count-header');
    if (headerCountEl) headerCountEl.textContent = String(deckState.remaining || 0);
}

function buildLocalDeck(count) {
    const suits = ['hearts', 'spades', 'clubs', 'diamonds'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const rankNames = { 'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack' };
    const suitNames = { 'hearts': 'Hearts', 'spades': 'Spades', 'clubs': 'Clubs', 'diamonds': 'Diamonds' };
    
    const cards = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            cards.push({
                suit,
                rank,
                rankName: rankNames[rank] || rank,
                suitName: suitNames[suit]
            });
        }
    }
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards.slice(0, count);
}

// ============================================================
// MODULE COMMANDS (using unified WebSocket module)
// ============================================================

async function handleModuleList() {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    
    if (isConnected) {
        try {
            const result = await listModules();
            if (result && result.error) {
                showToast(`List modules failed: ${result.error}`, 'error');
            } else if (result && result.modules) {
                loadedModules = result.modules;
                const count = loadedModules.length;
                if (count === 0) {
                    showToast('📦 No modules loaded.', 'info');
                } else {
                    const names = loadedModules.map(m => m.name || m.id).join(', ');
                    showToast(`📦 ${count} module${count > 1 ? 's' : ''} loaded: ${names}`, 'info');
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to list modules:', error);
            showToast('Failed to list modules.', 'error');
        }
    } else {
        showToast('Module list requires server connection.', 'error');
    }
}

async function handleModulePush(moduleId) {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    
    if (isConnected) {
        try {
            const result = await requestModulePush(moduleId);
            if (result && result.error) {
                showToast(`Module push failed: ${result.error}`, 'error');
            } else {
                showToast(`📦 Module pushed: ${moduleId}`, 'success');
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to push module:', error);
            showToast('Module push failed.', 'error');
        }
    } else {
        showToast('Module push requires server connection.', 'error');
    }
}

async function handleModuleCleanup(moduleId) {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    
    if (isConnected) {
        try {
            const result = await requestModuleCleanup(moduleId);
            if (result && result.error) {
                showToast(`Module cleanup failed: ${result.error}`, 'error');
            } else {
                showToast(`🧹 Module cleanup: ${moduleId}`, 'success');
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to cleanup module:', error);
            showToast('Module cleanup failed.', 'error');
        }
    } else {
        showToast('Module cleanup requires server connection.', 'error');
    }
}

// ============================================================
// ROLL (with WebSocket broadcast) – uses selected character
// ============================================================

function rollConnected(postToChat = true) {
    const attrEl = q('#vtt-attr');
    const skillEl = q('#vtt-skill');
    const dvEl = q('#vtt-dv');
    const posEl = q('#vtt-pos');
    const boonsEl = q('#vtt-boons');
    const out = q('#vtt-roll-output');
    if (!attrEl || !skillEl || !dvEl || !posEl) return;

    const attr = parseInt(attrEl.value, 10) || 1;
    const skill = parseInt(skillEl.value, 10) || 0;
    const dv = parseInt(dvEl.value, 10) || 3;
    const pos = posEl.value;
    const boons = parseInt(boonsEl?.value, 10) || 0;
    const result = performRoll(attr, skill, dv, pos, boons);
    if (!result) {
        showToast('Pool must be at least 1 die.', 'error');
        return;
    }

    if (out) {
        const diceHtml = result.dice.map(die => {
            let bgColor = 'var(--bg4)', textColor = 'var(--text)', label = die;
            if (die === 10) { bgColor = 'var(--green)'; textColor = 'white'; label = '10'; }
            else if (die >= 6) { bgColor = 'var(--green)'; textColor = 'white'; }
            else if (die === 1) { bgColor = 'var(--red)'; textColor = 'white'; label = '1⚠️'; }
            return `<span class="vtt-roll-die" style="background:${bgColor};color:${textColor};">${label}</span>`;
        }).join('');
        out.innerHTML = `
            <div class="vtt-roll-result">
                <span class="outcome-tag ${result.outcomeClass}" style="display:inline-block;padding:0.15rem 0.8rem;border-radius:20px;font-weight:600;font-size:0.9rem;margin-right:0.4rem;background:${getOutcomeColor(result.outcome)};">
                    ${result.outcome}
                </span>
                <div class="vtt-roll-dice">${diceHtml}</div>
                <div class="vtt-roll-meta">
                    <span>Successes: <strong style="color:var(--green);">${result.successes}</strong></span>
                    <span>Story Beats: <strong style="color:var(--red);">${result.storyBeats}</strong></span>
                    ${result.reRolls > 0 ? `<span>Re-rolls: <strong>${result.reRolls}</strong></span>` : ''}
                </div>
            </div>
        `;
    }

    const postCheckbox = q('#vtt-post-chat');
    const shouldPost = postToChat && postCheckbox?.checked;
    if (shouldPost) {
        const sender = getSenderName();

        let msg = `[${result.outcome}] ${attr}+${skill} vs DV${dv} (${pos}) → `;
        msg += result.dice.join(' ');
        msg += ` | S:${result.successes} SB:${result.storyBeats}`;
        if (result.reRolls > 0) {
            msg += ` | Re-rolls: ${result.reRolledDice.map(r => `${r.old}→${r.new}`).join(', ')}`;
        }
        msg += ` — ${result.resultText}`;

        sendMessage(msg, sender, 'all', {
            rollData: {
                outcome: result.outcome,
                outcomeClass: result.outcomeClass,
                resultText: result.resultText,
                dice: result.dice,
                successes: result.successes,
                storyBeats: result.storyBeats,
                reRolls: result.reRolls,
                reRolledDice: result.reRolledDice
            }
        });

        if (isConnectedToServer()) {
            try {
                sendRoll({
                    ...result,
                    sender,
                    timestamp: Date.now()
                });
            } catch (e) { /* ignore */ }
        }
    }
}

// ============================================================
// SLASH COMMANDS – uses selected character
// ============================================================

function handleSlash(text) {
    const parts = text.slice(1).trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const sender = getSenderName();

    switch (cmd) {
        case 'roll': {
            const attr = parseInt(parts[1], 10) || 3;
            const skill = parseInt(parts[2], 10) || 0;
            const dv = parseInt(parts[3], 10) || 3;
            const pos = parts[4] || 'controlled';
            const boons = parseInt(parts[5], 10) || 0;
            const note = parts.slice(6).join(' ') || '';
            const result = performRoll(attr, skill, dv, pos, boons);
            if (!result) { showToast('Pool must be at least 1 die.', 'error'); return; }
            const msg = `[${result.outcome}] ${attr}+${skill} vs DV${dv} (${pos}) → ${result.dice.join(' ')} (S:${result.successes} SB:${result.storyBeats})${note ? ' — ' + note : ''}`;
            sendMessage(msg, sender, 'all', {
                rollData: {
                    outcome: result.outcome,
                    outcomeClass: result.outcomeClass,
                    resultText: result.resultText,
                    dice: result.dice,
                    successes: result.successes,
                    storyBeats: result.storyBeats,
                    reRolls: result.reRolls,
                    reRolledDice: result.reRolledDice
                }
            });
            break;
        }
        case 'timer': {
            const segments = parseInt(parts[parts.length - 1], 10) || 4;
            const name = parts.slice(1, parts.length - 1).join(' ') || 'Scene Timer';
            import('../../core/state.js').then(module => {
                const state = module.getState();
                module.addTimer({ id: state._nextId++, name, segments, current: 0 });
                const msg = `Timer created: ${name} (${segments} segments)`;
                sendMessage(msg, 'System', 'all');
                vttStore.updateTimers(state.timers || []);
                if (isConnectedToServer()) {
                    try {
                        sendEvent({ type: 'state-updated', state: getState() });
                    } catch (e) { /* ignore */ }
                }
            }).catch(err => {
                showToast('Failed to create timer', 'error');
            });
            break;
        }
        case 'deck': {
            const count = parseInt(parts[1], 10) || 1;
            const region = parts[2] || defaultRegion;
            handleDeckDraw(Math.min(count, 5), region);
            break;
        }
        case 'crown': {
            const region = parts[1] || defaultRegion;
            handleCrownSpread(region);
            break;
        }
        case 'shuffle': {
            handleDeckShuffle();
            break;
        }
        case 'history': {
            handleDeckHistory();
            break;
        }
        case 'clear-history': {
            handleClearDeckHistory();
            break;
        }
        case 'modules': {
            handleModuleList();
            break;
        }
        case 'module': {
            const moduleId = parts[1];
            if (moduleId) {
                handleModulePush(moduleId);
            } else {
                showToast('Usage: /module <moduleId>', 'error');
            }
            break;
        }
        case 'region': {
            const region = parts.slice(1).join(' ');
            if (region) {
                defaultRegion = region;
                showToast(`📍 Region set to: ${region}`, 'success');
                const regionDisplay = q('#vtt-region-display');
                if (regionDisplay) regionDisplay.textContent = region;
                if (isConnectedToServer()) {
                    try {
                        sendEvent({ type: 'region-updated', region });
                    } catch (e) { /* ignore */ }
                }
            } else {
                showToast(`📍 Current region: ${defaultRegion}`, 'info');
            }
            break;
        }
        case 'help': {
            const room = getRoomCode() || 'none';
            const mode = isConnectedToServer() ? '🌐 Connected' : '📡 Local';
            const helpText = [
                '📖 Commands:',
                '/roll attr skill dv [pos] [boons] [note] - Make a roll',
                '/timer name segments - Create a timer',
                '/deck count [region] - Draw cards from deck',
                '/crown [region] - Crown Spread',
                '/shuffle - Shuffle deck',
                '/history - Show deck history',
                '/clear-history - Clear deck history',
                '/modules - List loaded modules',
                '/module <id> - Push a module',
                '/region [name] - Get/set default region',
                '/ooc text - Send out-of-character message',
                '/status - Show party status',
                '/clear - Clear chat',
                '/help - Show this help',
                `Mode: ${mode} | Room: ${room} | Region: ${defaultRegion}`
            ].join('\n');
            sendMessage(helpText, 'System', 'all');
            break;
        }
        case 'ooc': {
            sendMessage(parts.slice(1).join(' '), 'OOC', 'all');
            break;
        }
        case 'status': {
            const chars = getCharacters().filter(c => c.vtt);
            const isConnected = isConnectedToServer();
            const room = getRoomCode() || 'none';
            const mode = isConnected ? '🌐 Connected' : '📡 Local';
            const deckCount = deckState.remaining || 0;
            if (chars.length === 0) {
                sendMessage(`📊 Mode: ${mode} | Room: ${room} | Deck: ${deckCount} cards | Region: ${defaultRegion} | No VTT characters.`, 'System', 'all');
            } else {
                const status = chars.map(c => `${c.name}: ❤️${c.harm || 0} ⚡${c.fatigue || 0} 🎲${c.boons || 0}`).join(' | ');
                sendMessage(`📊 ${status} | Mode: ${mode} | Room: ${room} | Deck: ${deckCount} cards | Region: ${defaultRegion}`, 'System', 'all');
            }
            break;
        }
        case 'clear': {
            clearChatHistory?.();
            vttStore.clearChat();
            showToast('Chat cleared locally.', 'success');
            break;
        }
        default: {
            showToast('Unknown command. Try /help', 'error');
        }
    }
}

// ============================================================
// CHARACTER PUSH TO SERVER (with dynamic API endpoint)
// Now includes attributes, skills, and avatar
// ============================================================

async function pushCharactersToServer() {
    const roomCode = getRoomCode();
    if (!roomCode || typeof roomCode !== 'string' || roomCode.trim() === '') {
        console.warn('[VTT] No valid room code, cannot push characters.');
        return;
    }

    let apiKey = localStorage.getItem('fates-edge-api-key');
    if (!apiKey) {
        const input = prompt('Enter the server API key (or leave blank if not required):', 'your-secret-key-here');
        if (input !== null) {
            apiKey = input.trim();
            if (apiKey) localStorage.setItem('fates-edge-api-key', apiKey);
        }
        if (!apiKey) {
            console.warn('[VTT] No API key – character sync disabled.');
            return;
        }
    }

    const state = getState();
    const characters = state.characters || [];
    if (characters.length === 0) {
        console.log('[VTT] No characters to push.');
        return;
    }

    const updates = {};
    characters.forEach(c => {
        if (c.name) {
            const entry = {
                harm: c.harm || 0,
                fatigue: c.fatigue || 0,
                obligation: c.obligation || 0,
                boons: c.boons || 0,
                leash: c.leash || 0,
                corruption: c.corruption || 0
            };
            // Include attributes and skills if available
            if (c.attributes) entry.attributes = c.attributes;
            if (c.skills) entry.skills = c.skills;
            if (c.avatar) entry.avatar = c.avatar;
            updates[c.name] = entry;
        }
    });

    if (Object.keys(updates).length === 0) {
        console.log('[VTT] No valid character data to push.');
        return;
    }

    // ---- Build endpoint ----
    let apiBase = getApiBaseUrl();
    if (apiBase && typeof apiBase === 'string') {
        apiBase = apiBase.split('?')[0].replace(/\/+$/, '');
        if (apiBase === '') apiBase = null;
    }

    let endpoint;
    if (apiBase) {
        endpoint = `${apiBase}/rooms/${roomCode}/characters/update`;
    } else {
        const origin = window.location.origin || '';
        endpoint = `${origin}/api/rooms/${roomCode}/characters/update`;
    }

    console.log('[VTT] Pushing characters to endpoint:', endpoint);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify({ updates })
        });

        if (response.ok) {
            console.log(`✅ Pushed ${Object.keys(updates).length} characters to room ${roomCode}.`);
            if (!charactersPushed) {
                showToast(`📤 Characters synced to server for room ${roomCode}.`, 'success');
                charactersPushed = true;
            }
        } else {
            const text = await response.text();
            console.warn(`❌ Failed to push characters: ${response.status} ${text}`);
            if (!charactersPushed) {
                showToast(`❌ Failed to sync characters (${response.status}). Check API key.`, 'error');
            }
        }
    } catch (e) {
        console.warn('❌ Error pushing characters:', e);
        if (!charactersPushed) {
            showToast('❌ Error syncing characters. Check connection.', 'error');
        }
    }
}

// ============================================================
// CHARACTER RECEIVE HELPERS
// ============================================================

function receiveCharacters(charArray) {
    if (!Array.isArray(charArray) || charArray.length === 0) {
        // If empty array, just clear the store
        vttStore.updateCharacters([]);
        return;
    }
    const normalized = charArray.map(c => ensureCharacterDefaults(c));
    vttStore.updateCharacters(normalized);
    // Also update the character grid UI
    renderVTTChars();
    // Update the selected character display if needed
    const selected = vttStore.getSelectedCharacter();
    if (selected) {
        // If selected character no longer exists, clear selection
        const stillExists = normalized.some(c => c.name === selected.name);
        if (!stillExists) {
            vttStore.selectCharacter(null);
        }
    }
    // Update chat recipients list (characters are in the store)
    populateChatRecipients();
    console.log(`[VTT] Received ${normalized.length} characters from server.`);
}

// ============================================================
// WEBSOCKET SYNC SETUP (using unified WebSocket module)
// ============================================================

function setupWebSocketSync() {
    if (!isConnectedToServer() || isDestroyed) return;

    cleanupWebSocketListeners();

    // Push current state to server using sendEvent
    try {
        sendEvent({ type: 'state-updated', state: getState() });
    } catch (e) { /* ignore */ }
    
    const chars = getCharacters();
    vttStore.updateCharacters(chars);
    vttStore.updateTimers(getState().timers || []);

    // ─── ROOM STATE (initial) ────────────────────────────────────
    const roomStateHandler = (data) => {
        if (isDestroyed) return;
        // Process characters if present
        if (data && data.characters && Array.isArray(data.characters)) {
            receiveCharacters(data.characters);
        }
        // Process other room state (deck, whiteboard, etc.) if needed
        if (data && data.deckRemaining !== undefined) {
            deckState.remaining = data.deckRemaining;
            updateDeckUI();
        }
        if (data && data.region) {
            defaultRegion = data.region;
            const regionDisplay = q('#vtt-region-display');
            if (regionDisplay) regionDisplay.textContent = defaultRegion;
        }
        // Clients are handled by presence handler
    };
    onWSEvent('room-state', roomStateHandler);
    wsListeners.set('room-state', roomStateHandler);

    // ─── SYNC STATE (response to sync-request) ──────────────────
    const syncStateHandler = (data) => {
        if (isDestroyed) return;
        // The server sends `state` (whiteboard) and sometimes `characters` separately?
        // In our server, sync-state sends characters directly in the same payload.
        // We'll check both `data.characters` and `data.state.characters` for flexibility.
        let charArray = null;
        if (data && data.characters && Array.isArray(data.characters)) {
            charArray = data.characters;
        } else if (data && data.state && data.state.characters && Array.isArray(data.state.characters)) {
            charArray = data.state.characters;
        }
        if (charArray) {
            receiveCharacters(charArray);
        }
        // Also handle whiteboard if needed
        if (data && data.state && data.state.whiteboard) {
            // whiteboard update would go here if needed
        }
        showToast('📋 Sync complete.', 'info');
    };
    onWSEvent('sync-state', syncStateHandler);
    wsListeners.set('sync-state', syncStateHandler);

    // ─── STATE UPDATED (incremental) ────────────────────────────
    const stateHandler = (data) => {
        if (isDestroyed) return;
        // If the update contains characters, process them
        if (data && data.characters && Array.isArray(data.characters)) {
            receiveCharacters(data.characters);
        } else if (data && data.state && data.state.characters && Array.isArray(data.state.characters)) {
            receiveCharacters(data.state.characters);
        }
        // Also handle timers if present
        if (data && data.timers) {
            vttStore.updateTimers(data.timers);
        }
    };
    onWSEvent('state-updated', stateHandler);
    wsListeners.set('state-updated', stateHandler);

    // Chat messages
    const chatHandler = (data) => {
        if (isDestroyed) return;
        const msg = data.message || data;
        vttStore.addChatMessage({
            ...msg,
            local: false,
            sent: true
        });
        if (msg.sender !== 'GM' && msg.sender !== 'System') {
            playNotificationSound();
        }
    };
    onWSEvent('chat-message', chatHandler);
    wsListeners.set('chat-message', chatHandler);

    // Roll results
    const rollHandler = (rollData) => {
        if (isDestroyed) return;
        showToast(`🎲 ${rollData.sender || 'Player'} rolled ${rollData.outcome}`, 'info');
    };
    onWSEvent('roll-result', rollHandler);
    wsListeners.set('roll-result', rollHandler);

    // Deck events
    const deckDrawHandler = (data) => {
        if (isDestroyed) return;
        deckState = {
            cards: data.cards || [],
            history: deckState.history || [],
            offset: Date.now(),
            remaining: data.remaining || 0
        };
        const cards = data.cards || [];
        const synthesis = data.synthesis || '';
        const region = data.region || defaultRegion;
        const cardNames = cards.map(c => 
            c.is_joker ? '🃏 Joker' : `${c.rank_name || c.rank} of ${c.suit_name || c.suit}`
        ).join(', ');
        const msg = `🃏 Drew ${cards.length} card${cards.length > 1 ? 's' : ''} from ${region}: ${cardNames}\n\n${synthesis}`;
        sendMessage(msg, 'Deck', 'all');
        updateDeckUI();
        showToast(`🃏 Drew ${cards.length} cards from ${region}`, 'success');
    };
    onWSEvent('deck-drawn', deckDrawHandler);
    wsListeners.set('deck-drawn', deckDrawHandler);

    const deckShuffleHandler = (data) => {
        if (isDestroyed) return;
        deckState = {
            cards: [],
            history: [],
            offset: Date.now(),
            remaining: data.remaining || 0
        };
        const msg = '🔀 Deck shuffled.';
        sendMessage(msg, 'Deck', 'all');
        updateDeckUI();
        showToast('🔀 Deck shuffled', 'success');
    };
    onWSEvent('deck-shuffled', deckShuffleHandler);
    wsListeners.set('deck-shuffled', deckShuffleHandler);

    const crownSpreadHandler = (data) => {
        if (isDestroyed) return;
        deckState = {
            cards: data.cards || [],
            history: deckState.history || [],
            offset: Date.now(),
            remaining: data.remaining || 0
        };
        const msg = `👑 Crown Spread: ${data.result?.synthesis || 'A powerful reading...'}`;
        sendMessage(msg, 'Deck', 'all');
        updateDeckUI();
        showToast('👑 Crown Spread delivered', 'success');
    };
    onWSEvent('crown-spread', crownSpreadHandler);
    wsListeners.set('crown-spread', crownSpreadHandler);

    const deckHistoryHandler = (data) => {
        if (isDestroyed) return;
        console.log('[VTT] Deck history received:', data);
    };
    onWSEvent('deck-history', deckHistoryHandler);
    wsListeners.set('deck-history', deckHistoryHandler);

    const deckHistoryClearedHandler = (data) => {
        if (isDestroyed) return;
        showToast('🗑️ Deck history cleared', 'info');
    };
    onWSEvent('deck-history-cleared', deckHistoryClearedHandler);
    wsListeners.set('deck-history-cleared', deckHistoryClearedHandler);

    // Module events
    const moduleListHandler = (data) => {
        if (isDestroyed) return;
        loadedModules = data.modules || [];
        const count = loadedModules.length;
        if (count === 0) {
            showToast('📦 No modules loaded.', 'info');
        } else {
            const names = loadedModules.map(m => m.name || m.id).join(', ');
            showToast(`📦 ${count} module${count > 1 ? 's' : ''} loaded: ${names}`, 'info');
        }
    };
    onWSEvent('module-list', moduleListHandler);
    wsListeners.set('module-list', moduleListHandler);

    const modulePushHandler = (data) => {
        if (isDestroyed) return;
        const module = data.module || {};
        const name = module.manifest?.name || module.id || 'Unknown';
        showToast(`📦 Module pushed: ${name}`, 'success');
    };
    onWSEvent('module-push', modulePushHandler);
    wsListeners.set('module-push', modulePushHandler);

    const moduleCleanupHandler = (data) => {
        if (isDestroyed) return;
        const moduleId = data.moduleId || 'Unknown';
        showToast(`🧹 Module cleanup: ${moduleId}`, 'info');
    };
    onWSEvent('module-cleanup', moduleCleanupHandler);
    wsListeners.set('module-cleanup', moduleCleanupHandler);

    // Region update
    const regionUpdateHandler = (data) => {
        if (isDestroyed) return;
        if (data.region) {
            defaultRegion = data.region;
            const regionDisplay = q('#vtt-region-display');
            if (regionDisplay) regionDisplay.textContent = defaultRegion;
            showToast(`📍 Region updated to: ${defaultRegion}`, 'info');
        }
    };
    onWSEvent('region-updated', regionUpdateHandler);
    wsListeners.set('region-updated', regionUpdateHandler);

    // ============================================================
    // GM ELECTION & PROMOTION EVENTS
    // ============================================================
    
    // Presence updates (clients list with roles)
    const presenceHandler = (data) => {
        if (isDestroyed) return;
        if (data.clients) {
            clientsMap.clear();
            data.clients.forEach(c => clientsMap.set(c.id, c));
            const gm = data.clients.find(c => c.role === 'gm');
            if (gm) {
                gmState.currentGmId = gm.id;
                gmState.currentGmName = gm.name;
            } else {
                gmState.currentGmId = null;
                gmState.currentGmName = null;
            }
            const myId = getSocketId();
            if (myId && clientsMap.has(myId)) {
                const myClient = clientsMap.get(myId);
                if (gmState.myRole !== myClient.role) {
                    gmState.myRole = myClient.role;
                    document.dispatchEvent(new CustomEvent('gmRoleUpdate', { detail: { role: myClient.role } }));
                }
            }
            // Push the REAL presence list (actual clients, actual online status)
            // into the store, so it isn't silently replaced by the
            // character-roster-derived fallback that runs on every periodic
            // updateCharacters() call while in local/disconnected mode.
            vttStore.updatePresence(data.clients.map(c => ({
                id: c.id,
                name: c.name || 'Player',
                online: true,
                tier: c.role === 'gm' ? 'GM' : (c.tier || 'Player'),
                avatar: c.avatar || null,
            })));
            updateGMUI();
            renderLocalPresence();
        }
    };
    onWSEvent('presence', presenceHandler);
    wsListeners.set('presence', presenceHandler);

    const gmVoteHandler = (data) => {
        if (isDestroyed) return;
        const { requesterId, requesterName, currentGmId, currentGmName } = data;
        const myId = getSocketId();
        if (gmState.myRole === 'gm' && myId === currentGmId) {
            if (!gmState.requests.find(r => r.requesterId === requesterId)) {
                gmState.requests.push({ requesterId, requesterName });
            }
            updateGMUI();
            showToast(`👑 ${requesterName} requests to become GM.`, 'info');
            playNotificationSound();
        }
    };
    onWSEvent('gm_vote_request', gmVoteHandler);
    wsListeners.set('gm_vote_request', gmVoteHandler);

    const gmRoleHandler = (data) => {
        if (isDestroyed) return;
        const { role } = data;
        gmState.myRole = role;
        document.dispatchEvent(new CustomEvent('gmRoleUpdate', { detail: { role } }));
        const myId = getSocketId();
        if (myId && clientsMap.has(myId)) {
            clientsMap.get(myId).role = role;
        }
        if (role === 'gm') {
            gmState.currentGmId = myId;
            gmState.currentGmName = 'You';
        }
        updateGMUI();
        showToast(`Your role is now: ${role.toUpperCase()}`, 'success');
    };
    onWSEvent('gm_role_update', gmRoleHandler);
    wsListeners.set('gm_role_update', gmRoleHandler);

    const announcementHandler = (data) => {
        if (isDestroyed) return;
        showToast(data.message, 'info');
    };
    onWSEvent('server_announcement', announcementHandler);
    wsListeners.set('server_announcement', announcementHandler);

    // Connection events
    const connectHandler = () => {
        if (isDestroyed) return;
        const state = getState();
        try {
            sendEvent({ type: 'state-updated', state: state });
        } catch (e) { /* ignore */ }
        const chars = getCharacters();
        vttStore.updateCharacters(chars);
        vttStore.updateTimers(state.timers || []);
        vttStore.setConnectionStatus('connected');
        showToast('Reconnected to server!', 'success');
        charactersPushed = false;
        pushCharactersToServer();
    };
    onWSEvent('connected', connectHandler);
    wsListeners.set('connected', connectHandler);

    const disconnectHandler = () => {
        if (isDestroyed) return;
        vttStore.setConnectionStatus('local');
        showToast('Disconnected from server. Messages will be local.', 'warning');
        charactersPushed = false;
    };
    onWSEvent('disconnected', disconnectHandler);
    wsListeners.set('disconnected', disconnectHandler);

    // ─── AUTO-PUSH ON HANDSHAKE ────────────────────────────────────
    const handshakeHandler = (data) => {
        if (data.success && !charactersPushed) {
            setTimeout(() => pushCharactersToServer(), 500);
        }
    };
    onWSEvent('handshake_ack', handshakeHandler);
    wsListeners.set('handshake_ack', handshakeHandler);

    console.log('[VTT Connected] WebSocket sync enabled with full character support');
}

function cleanupWebSocketListeners() {
    for (const [event, handler] of wsListeners) {
        try {
            offWSEvent(event, handler);
        } catch (e) {
            console.debug('[VTT Connected] Error removing listener:', e);
        }
    }
    wsListeners.clear();
}

// ============================================================
// GM UI UPDATE
// ============================================================

function updateGMUI() {
    const display = q('#gm-display');
    if (display) display.textContent = gmState.currentGmName || 'None';
    
    const badge = q('#gm-role-badge');
    if (badge) badge.textContent = gmState.myRole === 'gm' ? 'You are GM' : 'Player';
    
    const actions = q('#gm-actions');
    if (actions) {
        if (gmState.myRole === 'gm') {
            actions.innerHTML = `<button class="btn btn-sm btn-danger" id="vtt-gm-resign">Resign GM</button>`;
        } else {
            actions.innerHTML = `<button class="btn btn-sm btn-gold" id="vtt-gm-request">Request GM</button>`;
        }
    }
    
    const requestsContainer = q('#gm-requests');
    const requestsList = q('#gm-requests-list');
    if (gmState.myRole === 'gm' && gmState.requests.length > 0) {
        requestsContainer.style.display = 'block';
        requestsList.innerHTML = gmState.requests.map(r => `
            <div class="vtt-gm-request-row">
                <span>${escHtml(r.requesterName)}</span>
                <div class="vtt-btn-row">
                    <button class="btn btn-sm btn-green gm-approve" data-target="${r.requesterId}">Approve</button>
                    <button class="btn btn-sm btn-danger gm-reject" data-target="${r.requesterId}">Reject</button>
                </div>
            </div>
        `).join('');
    } else {
        requestsContainer.style.display = 'none';
        requestsList.innerHTML = '';
    }
}

// ============================================================
// VOICE (WebSocket signaling + UI)
// ============================================================

async function toggleVoice() {
    try {
        const state = getState();
        const userId = state.sessionId || 'vtt-' + Date.now().toString(36);
        const { initMediaModule } = await import('../../core/media.js');
        initMediaModule(userId);
    } catch (e) { /* ignore */ }
    if (isDestroyed) return;
    if (!voiceInitialized) {
        const success = await initVoice();
        if (success) {
            voiceInitialized = true;
            const toggleBtn = q('#vtt-voice-toggle');
            if (toggleBtn) {
                toggleBtn.textContent = '🎤 Voice On';
                toggleBtn.className = 'btn btn-sm btn-primary';
            }
            const containerEl = q('.flex-between .flex:last-child');
            if (containerEl && !q('#vtt-mute-toggle')) {
                const muteBtn = document.createElement('button');
                muteBtn.id = 'vtt-mute-toggle';
                muteBtn.className = 'btn btn-sm btn-green';
                muteBtn.textContent = '🎙️ Live';
                muteBtn.addEventListener('click', toggleMuteVoice);
                containerEl.appendChild(muteBtn);
            }
            showToast('Voice chat enabled!', 'success');
        }
    } else {
        cleanupVoice();
        voiceInitialized = false;
        const toggleBtn = q('#vtt-voice-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = '🎤 Voice Off';
            toggleBtn.className = 'btn btn-sm';
        }
        const muteBtn = q('#vtt-mute-toggle');
        if (muteBtn) muteBtn.remove();
        vttStore.updateVoiceClients([]);
        showToast('Voice chat disabled.', 'info');
    }
}

function toggleMuteVoice() {
    const muted = toggleMute();
    const btn = q('#vtt-mute-toggle');
    if (!btn) return;
    if (muted) {
        btn.textContent = '🔇 Muted';
        btn.className = 'btn btn-sm btn-danger';
    } else {
        btn.textContent = '🎙️ Live';
        btn.className = 'btn btn-sm btn-green';
    }
}

function callVoiceClient(clientId) {
    if (!voiceInitialized) {
        showToast('Enable voice first.', 'error');
        return;
    }
    const client = getVoiceClient(clientId);
    if (!client) {
        showToast('Client not found.', 'error');
        return;
    }
    if (client.connectionState === 'connected') {
        showToast('Already connected to ' + client.name, 'info');
        return;
    }
    initiateVoiceCall(clientId);
    showToast(`Calling ${client.name}...`, 'info');
}

// ============================================================
// EVENT HANDLING – uses selected character
// ============================================================

function handleSendMessage() {
    const input = q('#chatInput');
    const recipient = q('#chatRecipient');
    if (!input || !recipient) return;
    const text = input.value.trim();
    if (!text) return;
    if (text.startsWith('/')) {
        handleSlash(text);
        input.value = '';
        return;
    }
    const sender = getSenderName();
    sendMessage(text, sender, recipient.value);
    input.value = '';
    input.focus();
}

function attachEvents() {
    if (isDestroyed) return;
    eventListeners.forEach(({event, handler}) => {
        container.removeEventListener(event, handler);
    });
    eventListeners = [];

    docEventListeners.forEach(({event, handler}) => {
        document.removeEventListener(event, handler);
    });
    docEventListeners = [];

    const clickHandler = (e) => {
        const target = e.target.closest('button, .btn, [id]');
        if (!target) return;
        const id = target.id;
        switch (id) {
            case 'chat-send-btn': e.preventDefault(); handleSendMessage(); break;
            case 'vtt-clear-chat': clearChatHistory?.(); vttStore.clearChat(); showToast('Chat cleared.', 'success'); break;
            case 'vtt-refresh-btn': {
                const chars = getCharacters();
                vttStore.updateCharacters(chars);
                vttStore.updateTimers(getState().timers || []);
                populateChatRecipients();
                showToast('VTT refreshed.', 'info');
                break;
            }
            case 'vtt-roll-post-btn': rollConnected(true); break;
            case 'vtt-roll-only-btn': rollConnected(false); break;
            case 'vtt-add-timer': import('../../core/state.js').then(m => {
                const state = m.getState();
                const name = prompt('Timer name:', 'Scene Timer');
                if (name) {
                    const segments = parseInt(prompt('Segments:', '6') || '6');
                    const timer = { id: 'timer-' + Date.now(), name, segments, current: 0 };
                    m.addTimer(timer);
                    vttStore.updateTimers(state.timers || []);
                    showToast(`Timer "${name}" created.`, 'success');
                }
            }).catch(() => showToast('Timer feature not available', 'error')); break;
            case 'vtt-scene-end': {
                const state = getState();
                (state.characters || []).forEach(c => {
                    if (c.boons > 2) {
                        c.boons = 2;
                    }
                });
                const chars = getCharacters();
                vttStore.updateCharacters(chars);
                try {
                    sendEvent({ type: 'state-updated', state: state });
                } catch (e) { /* ignore */ }
                showToast('Scene ended, boons trimmed.', 'info');
                break;
            }
            case 'vtt-voice-toggle': toggleVoice(); break;
            case 'vtt-mute-toggle': toggleMuteVoice(); break;
            case 'vtt-deck-draw-1': handleDeckDraw(1); break;
            case 'vtt-deck-draw-2': handleDeckDraw(2); break;
            case 'vtt-deck-draw-3': handleDeckDraw(3); break;
            case 'vtt-deck-crown': handleCrownSpread(); break;
            case 'vtt-deck-shuffle': handleDeckShuffle(); break;
            case 'vtt-deck-history': handleDeckHistory(); break;
            case 'vtt-modules-list': handleModuleList(); break;
            case 'vtt-gm-request': {
                if (!isConnectedToServer()) {
                    showToast('Not connected to server.', 'error');
                    return;
                }
                sendWSMessage({ type: 'request_gm' });
                showToast('Request sent to GM.', 'info');
                break;
            }
            case 'vtt-gm-resign': {
                showToast('To step down, approve a pending request or promote another player.', 'info');
                break;
            }
        }
    };

    const gmActionHandler = (e) => {
        const approveBtn = e.target.closest('.gm-approve');
        const rejectBtn = e.target.closest('.gm-reject');
        if (!approveBtn && !rejectBtn) return;
        e.preventDefault();
        const targetId = (approveBtn || rejectBtn).dataset.target;
        if (!targetId) return;
        if (approveBtn) {
            sendWSMessage({ type: 'approve_gm', targetId });
            gmState.requests = gmState.requests.filter(r => r.requesterId !== targetId);
            updateGMUI();
            showToast(`Approved ${targetId} as GM.`, 'success');
        } else if (rejectBtn) {
            gmState.requests = gmState.requests.filter(r => r.requesterId !== targetId);
            updateGMUI();
            showToast(`Rejected request from ${targetId}.`, 'info');
        }
    };

    const keydownHandler = (e) => {
        if (e.key === 'Enter' && e.target.id === 'chatInput') {
            e.preventDefault();
            handleSendMessage();
        }
    };
    const changeHandler = (e) => {
        if (e.target.id === 'vtt-auto-scroll') {
            VTT_CONFIG.chatAutoScroll = e.target.checked;
        }
    };
    eventListeners = [
        { event: 'click', handler: clickHandler },
        { event: 'click', handler: gmActionHandler },
        { event: 'keydown', handler: keydownHandler },
        { event: 'change', handler: changeHandler }
    ];
    eventListeners.forEach(({event, handler}) => {
        container.addEventListener(event, handler);
    });

    const voiceCallHandler = (e) => {
        if (e.detail?.clientId) {
            callVoiceClient(e.detail.clientId);
        }
    };
    document.addEventListener('voice-call-request', voiceCallHandler);
    docEventListeners.push({ event: 'voice-call-request', handler: voiceCallHandler });
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    if (isDestroyed) {
        isDestroyed = false;
    }
    container = el;
    setContainer(el);
    if (!el) return;

    const isConnected = isConnectedToServer();
    const roomCode = isConnected ? getRoomCode() : null;
    const socketId = isConnected ? getSocketId() : null;
    const mode = typeof getConnectionMode === 'function' ? getConnectionMode() : 'websocket';
    const voiceStatus = getVoiceStatus();
    const voiceClients = getActiveVoiceClients();
    const deckCount = deckState.remaining || 0;

    // Build voice clients HTML (larger fonts)
    const voiceClientsHtml = voiceClients.map(id => {
        const client = getVoiceClient(id);
        const isSpeaking = client?.speaking ? 'var(--gold)' : 'var(--bg3)';
        const name = client?.name || 'Player';
        return `<span class="voice-client-badge" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.2rem 0.8rem;border-radius:20px;background:var(--bg4);font-size:0.85rem;border:1px solid var(--border);">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isSpeaking};transition:background 0.3s;"></span>
            ${escHtml(name)}
        </span>`;
    }).join('');

    el.innerHTML = `
        <div class="vtt-live-table">
        <style>
            .vtt-live-table .vtt-card {
                background: var(--bg2);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 0.9rem 1.1rem;
                box-shadow: 0 1px 3px rgba(0,0,0,0.10);
            }
            .vtt-live-table .vtt-card-header {
                display: flex; align-items: center; justify-content: space-between;
                gap: 0.5rem; margin-bottom: 0.6rem; flex-wrap: wrap;
            }
            .vtt-live-table .vtt-card-title {
                display: flex; align-items: center; gap: 0.4rem;
                font-size: 1.15rem; font-weight: 600; margin: 0; color: var(--text);
            }
            .vtt-live-table .vtt-stat-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
            .vtt-live-table .vtt-stat-pill {
                display: inline-flex; align-items: center; gap: 0.35rem;
                background: var(--bg3); border: 1px solid var(--border);
                padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; color: var(--text2);
            }
            .vtt-live-table .vtt-stat-pill strong { color: var(--text); font-weight: 600; }
            .vtt-live-table .vtt-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
            .vtt-live-table .vtt-divider { border-top: 1px solid var(--border); margin: 0.7rem 0; }
            .vtt-live-table .vtt-section-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.2rem; align-items: start; }
            .vtt-live-table .vtt-sidebar { display: flex; flex-direction: column; gap: 1.1rem; }
            .vtt-live-table .vtt-btn-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
            .vtt-live-table .vtt-field label {
                display: block; font-size: 0.78rem; color: var(--text3);
                margin-bottom: 0.2rem; text-transform: uppercase; letter-spacing: 0.02em;
            }
            .vtt-live-table .vtt-roll-result {
                background: var(--bg3); border: 1px solid var(--border);
                border-radius: calc(var(--radius) - 2px); padding: 0.65rem 0.8rem;
            }
            .vtt-live-table .vtt-roll-dice { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0.5rem 0; }
            .vtt-live-table .vtt-roll-die {
                display: inline-flex; align-items: center; justify-content: center;
                min-width: 1.9rem; height: 1.9rem; border-radius: 6px; font-weight: 700; font-size: 0.9rem;
            }
            .vtt-live-table .vtt-roll-meta { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.88rem; color: var(--text2); }
            .vtt-live-table .vtt-hint { font-size: 0.82rem; color: var(--text3); margin-top: 0.5rem; }
            .vtt-live-table .vtt-hint code { background: var(--bg4); padding: 0.05rem 0.35rem; border-radius: 4px; font-size: 0.78rem; }
            .vtt-live-table .vtt-gm-request-row {
                display: flex; align-items: center; justify-content: space-between;
                padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border); gap: 0.5rem;
            }
            .vtt-live-table .vtt-gm-request-row:last-child { border-bottom: none; }
            @media (max-width: 900px) {
                .vtt-live-table .vtt-section-grid { grid-template-columns: 1fr; }
            }
        </style>

        <div class="vtt-header" style="margin-bottom:1.2rem;">
            <h1 class="page-title" style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;font-size:1.8rem;">
                💬 VTT – Live Table
                <span class="mode-indicator vtt-stat-pill" style="color:${isConnected ? 'var(--green)' : 'var(--red)'};">${isConnected ? '🌐 Connected' : '📡 Local'}</span>
                <span class="mode-indicator vtt-stat-pill" style="font-size:0.72rem;color:var(--text3);">${mode}</span>
                <button class="btn btn-sm" onclick="window.location.hash='whiteboard'" title="Open Whiteboard">✏️ Whiteboard</button>
            </h1>
            <p class="page-sub" style="margin:0.25rem 0 0;font-size:1.05rem;color:var(--text3);">Chat, party status, quick die roller, deck, and scene timers all in one view.</p>
        </div>

        <!-- Connection & Voice Status Panel -->
        <div class="panel vtt-card" style="margin-bottom:1.1rem;">
            <div class="vtt-card-header">
                <span class="vtt-card-title">🛰️ Table Status</span>
                <span class="vtt-stat-pill">
                    <span class="vtt-dot connection-status" style="background:${isConnected ? 'var(--green)' : 'var(--red)'};"></span>
                    ${isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
            </div>
            <div class="vtt-stat-row">
                ${roomCode ? `<span class="vtt-stat-pill">🔑 Room <strong>${roomCode}</strong></span>` : ''}
                ${socketId ? `<span class="vtt-stat-pill">👤 <strong>${socketId.slice(0, 8)}</strong></span>` : ''}
                <span class="vtt-stat-pill">📍 ${defaultRegion}</span>
                <span class="vtt-stat-pill">🃏 <strong id="vtt-deck-count-header">${deckCount}</strong> cards</span>
            </div>

            <div class="vtt-divider"></div>

            <div class="vtt-stat-row" style="justify-content:space-between;">
                <div class="vtt-btn-row" style="align-items:center;">
                    <button class="btn btn-sm ${voiceInitialized ? 'btn-primary' : ''}" id="vtt-voice-toggle">${voiceInitialized ? '🎤 Voice On' : '🎤 Voice Off'}</button>
                    ${voiceInitialized ? `<button class="btn btn-sm ${voiceStatus?.muted ? 'btn-danger' : 'btn-green'}" id="vtt-mute-toggle">${voiceStatus?.muted ? '🔇 Muted' : '🎙️ Live'}</button>` : ''}
                    <span class="vtt-stat-pill" id="voice-clients-count">${voiceClients.length} voice users</span>
                </div>
            </div>
            <div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem;">
                <span style="font-size:0.9rem;color:var(--text3);">🎤</span>
                <div style="flex:1;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div id="voice-activity-bar" style="width:0%;height:100%;background:var(--bg4);border-radius:3px;transition:width 0.1s;"></div>
                </div>
                <span style="font-size:0.8rem;color:var(--text3);" id="voice-activity-label">idle</span>
            </div>
            <div id="voice-clients-list" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem;">
                ${voiceClients.length === 0 ? '<span style="color:var(--text3);font-size:0.9rem;">No other voice clients.</span>' : voiceClientsHtml}
            </div>

            <div class="vtt-divider"></div>

            <div class="vtt-card-header" style="margin-bottom:0.35rem;">
                <span class="vtt-card-title" style="font-size:1rem;">👥 Party Members</span>
                <span class="vtt-stat-pill" id="vtt-mode-badge">${isConnected ? '🌐 Online' : '📡 Local'}</span>
            </div>
            <div id="presence-list"></div>
        </div>

        <!-- GM Management Panel -->
        <div class="panel vtt-card" style="margin-bottom:1.1rem;">
            <div class="vtt-card-header">
                <span class="vtt-card-title">👑 Game Master
                    <span id="gm-display" style="font-weight:600;font-size:0.95rem;color:var(--text2);">${gmState.currentGmName || 'None'}</span>
                    <span id="gm-role-badge" class="vtt-stat-pill" style="font-size:0.78rem;">${gmState.myRole === 'gm' ? 'You are GM' : 'Player'}</span>
                </span>
                <span id="gm-actions" class="vtt-btn-row">
                    ${gmState.myRole === 'gm' ? `
                        <button class="btn btn-sm btn-danger" id="vtt-gm-resign">Resign GM</button>
                    ` : `
                        <button class="btn btn-sm btn-gold" id="vtt-gm-request">Request GM</button>
                    `}
                </span>
            </div>
            <div id="gm-requests" style="display:none;">
                <div class="vtt-divider"></div>
                <span class="text-muted" style="font-size:0.85rem;">Pending requests:</span>
                <div id="gm-requests-list"></div>
            </div>
        </div>

        <!-- Main VTT layout -->
        <div class="vtt-container vtt-section-grid">
            <!-- Chat Column -->
            <div class="chat-box vtt-card" style="display:flex;flex-direction:column;min-height:500px;">
                <div class="vtt-card-header">
                    <span class="vtt-card-title">💬 Chat</span>
                    <div class="vtt-btn-row" style="align-items:center;">
                        <span class="text-muted" id="message-count">0 messages</span>
                        <button class="btn btn-sm btn-ghost" id="vtt-clear-chat" title="Clear chat">🗑️</button>
                    </div>
                </div>
                <div class="chat-messages" id="chatMessages" style="flex:1;overflow-y:auto;padding:0.5rem;background:var(--bg3);border-radius:calc(var(--radius) - 2px);margin-bottom:0.5rem;font-size:1rem;display:flex;flex-direction:column;max-height:450px;min-height:250px;"></div>
                <!-- Selected character display (rendered by renderChat) -->
                <div id="selected-character-display" style="margin-bottom:0.4rem;padding:0.2rem 0.4rem;background:var(--bg4);border-radius:calc(var(--radius) - 2px);min-height:2.5rem;"></div>
                <div class="chat-input-row" style="display:flex;gap:0.4rem;">
                    <input type="text" id="chatInput" placeholder="Type… (/roll, /timer, /deck, /help)" style="flex:1;font-size:1rem;padding:0.5rem 0.6rem;" />
                    <select id="chatRecipient" style="flex:0 0 120px;font-size:1rem;">
                        <option value="all">All</option>
                    </select>
                    <button class="btn btn-gold" id="chat-send-btn">Send</button>
                </div>
                <div class="flex mt-1" style="flex-wrap:wrap;gap:0.9rem;font-size:0.9rem;align-items:center;">
                    <label class="inline-check"><input type="checkbox" id="vtt-post-chat" checked /> Post rolls to chat</label>
                    <label class="inline-check"><input type="checkbox" id="vtt-auto-scroll" checked /> Auto-scroll</label>
                </div>
                <div class="vtt-hint">Try <code>/roll 3 2 3</code>, <code>/deck 1</code>, <code>/crown</code>, or <code>/help</code> for the full command list.</div>
            </div>

            <!-- Sidebar -->
            <div class="vtt-sidebar">
                <!-- Party Status (vertical, scrollable) -->
                <div class="vtt-panel vtt-card">
                    <div class="vtt-card-header">
                        <span class="vtt-card-title" style="font-size:1.05rem;">👥 Party</span>
                        <button class="btn btn-sm btn-ghost" id="vtt-refresh-btn" title="Refresh">↻</button>
                    </div>
                    <div id="vttCharGrid" style="
                        max-height:220px;
                        overflow-y:auto;
                        padding-right:4px;
                        scrollbar-width:thin;
                    "></div>
                </div>

                <!-- Quick Roller + Common Rolls -->
                <div class="vtt-panel vtt-card">
                    <div class="vtt-card-header">
                        <span class="vtt-card-title" style="font-size:1.05rem;">🎲 Quick Roller</span>
                    </div>
                    <div class="vtt-dice-row" style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:end;">
                        <div class="vtt-field" style="flex:1;min-width:70px;">
                            <label>Attr</label>
                            <select id="vtt-attr" style="font-size:1rem;padding:0.25rem;width:100%;">
                                <option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option>
                            </select>
                        </div>
                        <div class="vtt-field" style="flex:1;min-width:70px;">
                            <label>Skill</label>
                            <select id="vtt-skill" style="font-size:1rem;padding:0.25rem;width:100%;">
                                <option value="0">0</option><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                            </select>
                        </div>
                        <div class="vtt-field" style="flex:0 0 80px;">
                            <label>DV</label>
                            <select id="vtt-dv" style="font-size:1rem;padding:0.25rem;width:100%;">
                                <option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5+</option>
                            </select>
                        </div>
                        <div class="vtt-field" style="flex:0 0 90px;">
                            <label>Pos</label>
                            <select id="vtt-pos" style="font-size:1rem;padding:0.25rem;width:100%;">
                                <option value="dominant">Dom</option><option value="controlled" selected>Ctrl</option><option value="desperate">Desp</option>
                            </select>
                        </div>
                        <div class="vtt-field" style="flex:0 0 70px;">
                            <label>Boons</label>
                            <input type="number" id="vtt-boons" value="0" min="0" max="5" style="font-size:1rem;padding:0.25rem;width:100%;" />
                        </div>
                    </div>
                    <!-- Common Rolls -->
                    <div id="vtt-common-rolls" style="margin-top:0.5rem;min-height:2.5rem;"></div>
                    <div class="vtt-btn-row" style="margin-top:0.5rem;">
                        <button class="btn btn-gold btn-sm" id="vtt-roll-post-btn">Roll &amp; Post</button>
                        <button class="btn btn-sm" id="vtt-roll-only-btn">Roll Only</button>
                    </div>
                    <div id="vtt-roll-output" class="mt-1" style="min-height:3rem;padding:0.2rem 0;"></div>
                </div>

                <!-- Deck Panel -->
                <div class="vtt-panel vtt-card">
                    <div class="vtt-card-header">
                        <span class="vtt-card-title" style="font-size:1.05rem;">🃏 Deck</span>
                        <span class="vtt-stat-pill">📍 <strong id="vtt-region-display">${defaultRegion}</strong></span>
                    </div>
                    <div class="vtt-btn-row">
                        <button class="btn btn-sm btn-gold" id="vtt-deck-draw-1">Draw 1</button>
                        <button class="btn btn-sm btn-gold" id="vtt-deck-draw-2">Draw 2</button>
                        <button class="btn btn-sm btn-gold" id="vtt-deck-draw-3">Draw 3</button>
                        <button class="btn btn-sm btn-primary" id="vtt-deck-crown">👑 Crown</button>
                        <button class="btn btn-sm" id="vtt-deck-shuffle">🔀</button>
                        <button class="btn btn-sm btn-ghost" id="vtt-deck-history">📜</button>
                        <button class="btn btn-sm btn-ghost" id="vtt-modules-list">📦</button>
                    </div>
                    <div class="vtt-hint">Cards remaining: <strong id="vtt-deck-count">${deckCount}</strong></div>
                </div>

                <!-- Timers -->
                <div class="vtt-panel vtt-card">
                    <div class="vtt-card-header">
                        <span class="vtt-card-title" style="font-size:1.05rem;">⏱️ Scene Timers</span>
                    </div>
                    <div id="vttTimerList"></div>
                    <div class="vtt-btn-row" style="margin-top:0.5rem;">
                        <button class="btn btn-sm" id="vtt-add-timer">+ Add Timer</button>
                        <button class="btn btn-sm" id="vtt-scene-end">🌅 Scene End</button>
                    </div>
                </div>
            </div>
        </div>
        </div>
    `;

    // Initialize reactive renderers
    renderChat();
    renderVTTChars();
    renderCommonRolls();
    renderVTTTimers();
    renderLocalPresence();
    renderVoiceClients();
    updateMessageCount();
    populateChatRecipients();

    // Normalize and set initial characters from local state (if any)
    const chars = getCharacters();
    vttStore.updateCharacters(chars);
    vttStore.updateTimers(getState().timers || []);
    vttStore.setConnectionStatus(isConnected ? 'connected' : 'local');

    if (voiceUnsubscribe) voiceUnsubscribe();
    voiceUnsubscribe = onVoiceClientsChanged((clients) => {
        vttStore.updateVoiceClients(clients);
    });

    setupWebSocketSync();
    attachEvents();
    updateGMUI();

    if (presenceInterval) clearInterval(presenceInterval);
    presenceInterval = setInterval(() => {
        if (isDestroyed || !container) {
            clearInterval(presenceInterval);
            presenceInterval = null;
            return;
        }
        const chars = getCharacters();
        vttStore.updateCharacters(chars);
        vttStore.updateTimers(getState().timers || []);
    }, VTT_CONFIG.presenceUpdateInterval);

    if (deckCountInterval) clearInterval(deckCountInterval);
    deckCountInterval = setInterval(() => {
        if (isDestroyed) {
            clearInterval(deckCountInterval);
            deckCountInterval = null;
            return;
        }
        const countEl = q('#vtt-deck-count');
        if (countEl) countEl.textContent = String(deckState.remaining || 0);
        const headerCountEl = q('#vtt-deck-count-header');
        if (headerCountEl) headerCountEl.textContent = String(deckState.remaining || 0);
    }, 5000);

    console.log('[VTT Connected] Rendered with reactive store + full character sync');
    window.getState = getState;
    window.vttStore = vttStore;
    window.pushCharactersToServer = pushCharactersToServer;
}

// ============================================================
// DESTROY
// ============================================================

export function destroy() {
    isDestroyed = true;
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }
    if (deckCountInterval) {
        clearInterval(deckCountInterval);
        deckCountInterval = null;
    }
    if (container) {
        eventListeners.forEach(({event, handler}) => {
            container.removeEventListener(event, handler);
        });
        eventListeners = [];
        container.innerHTML = '';
        setContainer(null);
        container = null;
    }
    docEventListeners.forEach(({event, handler}) => {
        document.removeEventListener(event, handler);
    });
    docEventListeners = [];
    cleanupWebSocketListeners();
    if (voiceUnsubscribe) {
        voiceUnsubscribe();
        voiceUnsubscribe = null;
    }
    if (voiceInitialized) {
        cleanupVoice();
        voiceInitialized = false;
    }
    console.log('[VTT Connected] Destroyed');
}

// ============================================================
// EXPORT
// ============================================================

export default {
    render,
    destroy,
    sendMessage,
    getContainer: () => container,
    deckDraw: handleDeckDraw,
    crownSpread: handleCrownSpread,
    deckShuffle: handleDeckShuffle,
    deckHistory: handleDeckHistory,
    clearDeckHistory: handleClearDeckHistory,
    moduleList: handleModuleList,
    modulePush: handleModulePush,
    moduleCleanup: handleModuleCleanup,
    getDefaultRegion: () => defaultRegion,
    setDefaultRegion: (region) => { 
        defaultRegion = region;
        const display = q('#vtt-region-display');
        if (display) display.textContent = region;
    },
    pushCharactersToServer,
    initVoice,
    toggleMute,
    getVoiceStatus,
    cleanupVoice,
    getActiveVoiceClients,
    getVoiceClient,
    initiateVoiceCall,
    onVoiceClientsChanged
};
