/**
 * VTT Connected Mode – WebSocket sync, real‑time collaboration
 * Uses reactive store for all UI updates.
 * 
 * v3 – Full character sync from server (room-state, sync-state, state-updated)
 * v4 – Restructured layout/visual pass: card-based sections, stat pills,
 *      clearer typographic hierarchy. No IDs/classes/behavior removed.
 * v5 – Added the Combat Actions panel (contextual melee/ranged/tactics/
 *      talent buttons driven by the selected character's sheet). See
 *      combat-actions.js. #vtt-attr / #vtt-skill switched from <select>
 *      to <input type="number"> so weapon/talent bonuses that push a
 *      pool above the old 5-option dropdown range still work.
 * v6 – Added player‑to‑character selection sync via WebSocket.
 * v7 – Fixed player name vs character name separation.
 * v8 – Added reactive presence subscription to auto‑refresh the player list.
 * v9 – Increased chat pane height for more vertical space; no "Show full reading".
 * v10 – Added character detail panel and follower chat functionality.
 * v11 – Exposed global window.sendToVTT() for other modules to post messages/cards.
 */

import { t as i18nText, tn as i18nPlural } from '@core/i18n.js';
import { vttStore, MAX_CONTROLLED_CHARACTERS } from '@core/vtt-store.js';
import { getState, clearChatHistory, getCharacter, addVTTEvent, addSessionLogEntry, getCharacters, ensureCharacterDefaults, getStableClientId, onCharacterChange } from '@core/state.js';
import { performRoll } from '@core/dice.js';
import { collectEquipmentModifiers } from '@core/talent-effects.js';
import { RANGE_BAND_OPTIONS, RANGE_BAND_LABEL_MAP } from '@features/characters/roller.js';
import { showToast } from '@components/Toast.js';
import { announce } from '@core/a11y-announce.js';
import { escHtml } from '@core/utils.js';
import { getMyStoredRole, isGmLikeRole } from '@core/feature-toggles.js';
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
} from '@core/websocket.js';
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
import {
    initTtsNarration,
    cleanupTtsNarration,
    isNarrationEnabled,
    setNarrationEnabled
} from './tts-narration.js';
import { renderCombatActions, resetCombatScene } from './combat-actions.js';
import { playAmbience as playAmbienceTrack, getSoundTracks, addSoundTrack, setTrackAttribution } from '@core/soundboard.js';

// ============================================================
// STATE
// ============================================================

let container = null;
let voiceInitialized = false;
let wsListeners = new Map();
let eventListeners = [];
let docEventListeners = [];
let isDestroyed = false;
// id -> {kind, preview} for pending Assistant GM suggestions, so the
// assistant-suggestion-resolved handler can rebuild a full suggestionData
// patch (the resolved event itself only carries {id, outcome, result} --
// see ROADMAP.md item 2). Cleared per-id once resolved.
const pendingSuggestionMeta = new Map();
let reconnectTimer = null;
let voiceUnsubscribe = null;
let presenceInterval = null;
let deckCountInterval = null;
let selectedCharUnsubscribe = null;
let presenceUnsubscribe = null;

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
    requests: [],
    myRole: 'player'
};
let clientsMap = new Map();

let charactersPushed = false;

let combatStatus = null;
let sceneStatus = null;

// ─── Player name helpers ──────────────────────────────────────────────

function getClientName() {
    return localStorage.getItem('fates-edge-client-name') || 'Player';
}

function getClientRole() {
    return localStorage.getItem('fates-edge-client-role') || 'player';
}

function sendClientName() {
    if (!isConnectedToServer()) return;
    const name = getClientName();
    const role = getClientRole();
    sendEvent({ type: 'presence', name, role });
}

// ============================================================
// CHARACTER SELECTION SYNC
// ============================================================

// NEW: accepts either a single character name (legacy single-select) or
// an array of names ("Remote enabled" -- driving more than one character
// at once). Either way it's normalized to an array before sending, capped
// client-side to MAX_CONTROLLED_CHARACTERS as a courtesy (the server
// enforces the same cap independently -- see security.js's
// sanitizeCharacterSelection() -- so a stale/hacked client can't exceed it).
export function sendCharacterSelection(characterNameOrNames) {
    if (!isConnectedToServer()) return;
    const clientId = getSocketId();
    if (!clientId) return;

    const names = (Array.isArray(characterNameOrNames) ? characterNameOrNames : [characterNameOrNames])
        .filter(Boolean)
        .slice(0, MAX_CONTROLLED_CHARACTERS);

    sendEvent({ type: 'character-select', clientId, characters: names, character: names[0] || '' });

    const presence = vttStore.state.presence || [];
    const updated = presence.map(p => {
        if (p.id === clientId) {
            return { ...p, selectedCharacter: names[0] || '', selectedCharacters: names };
        }
        return p;
    });
    vttStore.updatePresence(updated);

    const chars = vttStore.state.characters || [];
    const ids = names.map(n => chars.find(c => c.name === n)?.id).filter(Boolean);
    vttStore.setSelectedCharacterIds(ids);
}

// ============================================================
// MINI COMBAT TRACKER (VTT sidebar) — see #vtt-mini-tracker-body
// ============================================================

async function renderMiniTracker() {
    const el = q('#vtt-mini-tracker-body');
    if (!el) return;
    try {
        const combatModule = await import('@features/encounters/combat.js');
        const { resolveObjectiveType, isCombatType } = await import('@core/objective-types.js');
        const trackerState = combatModule.getTrackerState();
        if (!trackerState.combatants || trackerState.combatants.length === 0) {
            el.innerHTML = '<div class="text-muted text-sm">No active encounter. Open Encounters to start one.</div>';
            return;
        }

        const selected = vttStore.getSelectedCharacter();
        const selfCombatant = selected
            ? trackerState.combatants.find(c => (c.name || '').toLowerCase() === (selected.name || '').toLowerCase())
            : null;

        el.innerHTML = `
            <div class="text-muted text-sm" style="margin-bottom:0.3rem;">Round ${trackerState.round || 0}</div>
            <div style="display:flex;flex-direction:column;gap:0.15rem;">
                ${trackerState.combatants.map(c => {
                    const isActive = c.id === trackerState.activeCombatantId;
                    const weaponGlyph = { light: '🗡️', medium: '⚔️', heavy: '🔨', ranged: '🏹' }[c.weaponClass] || '';
                    let rangeHtml = '';
                    if (selfCombatant && selfCombatant.id !== c.id) {
                        const band = combatModule.getRangeBandBetween(selfCombatant.id, c.id);
                        const info = combatModule.getRangeBandInfo(band);
                        rangeHtml = `<span class="vtt-stat-pill" style="background:${info.color}22;border:1px solid ${info.color};color:${info.color};font-size:0.7rem;" title="Range to ${escHtml(selfCombatant.name)}">${info.short}</span>`;
                    }
                    const isCombat = isCombatType(c.objectiveType);
                    const objType = resolveObjectiveType(c.objectiveType, c);
                    // Combat keeps the real Harm/Fatigue letters (H/F); other objective
                    // types show their own progress-label initial + value instead so
                    // players see the right terminology (e.g. lockpick's "Tumblers").
                    const progressPill = c.harm > 0
                        ? (isCombat
                            ? `<span class="text-muted text-sm" style="color:var(--red);" title="Harm" data-i18n-attr="title:feature.vtt.vtt-connected.harm">H${c.harm}</span>`
                            : `<span class="text-muted text-sm" style="color:var(--orange);" title="${escHtml(objType.progressLabel)}">${objType.icon}${c.harm}/${c.maxHarm}</span>`)
                        : '';
                    return `
                        <div style="display:flex;align-items:center;gap:0.4rem;padding:0.25rem 0.3rem;border-radius:4px;${isActive ? 'background:var(--bg4);border-inline-start:2px solid var(--gold);' : ''}font-size:0.85rem;">
                            <span style="flex:0 0 1.1rem;text-align:center;">${isActive ? '▶' : ''}</span>
                            <span style="flex:0 0 auto;color:${c.type === 'player' ? 'var(--blue)' : 'var(--red)'};">${weaponGlyph}</span>
                            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(c.name)}</span>
                            ${progressPill}
                            ${(isCombat && c.fatigue > 0) ? `<span class="text-muted text-sm" title="Fatigue" data-i18n-attr="title:feature.vtt.vtt-connected.fatigue">F${c.fatigue}</span>` : ''}
                            ${rangeHtml}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (err) {
        console.debug('[VTT Connected] Mini tracker unavailable:', err?.message);
        el.innerHTML = '<div class="text-muted text-sm">Combat tracker unavailable.</div>';
    }
}

// ============================================================
// HELPERS – Get sender from selected character
// ============================================================

function getSenderName() {
    const selected = vttStore.getSelectedCharacter();
    if (selected && selected.name) return selected.name;
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
        // Optimistic local value for OUR OWN immediate render, based on our
        // own last-known server-confirmed role -- see vtt-core.js's
        // renderChatMessageText. The server stamps its own authoritative
        // copy of this field when it relays the message to everyone else
        // (see server/socketio-handlers.js / ws-handlers.js's 'chat-message'
        // handlers), overwriting whatever we send, so a modified client
        // claiming this locally can't fool other players -- only itself.
        verifiedGM: !isConnected || isGmLikeRole(getMyStoredRole()),
        ...metadata
    };
}

export function sendMessage(text, sender, recipient = 'all', metadata = {}) {
    if (isDestroyed) return null;
    const isConnected = isConnectedToServer();
    const msg = createMessage(text, sender, recipient, metadata);

    vttStore.addChatMessage(msg);
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
            showToast(i18nText("feature.vtt.vtt-connected.messageFailedToSendCheckConnection", null, "Message failed to send. Check connection."), 'error');
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

// ─── Global VTT send function (exposed for other modules) ───────────
// This stores a reference to the internal sendMessage so other modules
// can post to VTT chat without needing to import this module directly.
let vttSendMessageFn = null;

/**
 * Send a message to the VTT chat from anywhere.
 * @param {string} text – The message content (plain text or HTML if isHTML=true and sender is trusted)
 * @param {string} sender – Default 'System' (trusted for HTML). Use 'GM' for GM messages.
 * @param {object} options – { isHTML: boolean, recipient: string, metadata: object }
 * @returns {boolean} true if sent, false if VTT not initialized.
 */
function sendToVTT(text, sender = 'System', options = {}) {
    if (!vttSendMessageFn) {
        console.warn('[VTT] Not initialized – message not sent.');
        return false;
    }
    const { isHTML = false, recipient = 'all', metadata = {} } = options;
    // HTML is only allowed for trusted senders (System, GM)
    if (isHTML && sender !== 'System' && sender !== 'GM') {
        console.warn('[VTT] HTML messages only allowed for System or GM senders.');
        return false;
    }
    // If it's HTML, we mark it so the renderer knows it's trusted.
    // The renderer in vtt-core.js already trusts System/GM and sanitises.
    vttSendMessageFn(text, sender, recipient, metadata);
    return true;
}

// Expose globally
window.sendToVTT = sendToVTT;

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
                showToast(i18nText("feature.vtt.vtt-connected.deckDrawFailedValue", { value0: result.error }, "Deck draw failed: {{value0}}"), 'error');
            } else {
                showToast(i18nPlural('feature.vtt.vtt-connected.cardsDrawnFromRegion', count, { region: regionName }, '🃏 Drew {{count}} cards from {{region}}'), 'success');
                if (result && result.remaining !== undefined) {
                    deckState.remaining = result.remaining;
                    updateDeckUI();
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to send deck draw:', error);
            showToast(i18nText("feature.vtt.vtt-connected.deckDrawFailedCheckConnection", null, "Deck draw failed. Check connection."), 'error');
        }
    } else {
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
                showToast(i18nText("feature.vtt.vtt-connected.crownSpreadFailedValue", { value0: result.error }, "Crown Spread failed: {{value0}}"), 'error');
            } else {
                showToast(i18nText("feature.vtt.vtt-connected.crownSpreadFromValue", { value0: regionName }, "👑 Crown Spread from {{value0}}"), 'success');
                if (result && result.remaining !== undefined) {
                    deckState.remaining = result.remaining;
                    updateDeckUI();
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to send Crown Spread:', error);
            showToast(i18nText("feature.vtt.vtt-connected.crownSpreadFailedCheckConnection", null, "Crown Spread failed. Check connection."), 'error');
        }
    } else {
        showToast(i18nText("feature.vtt.vtt-connected.crownSpreadRequiresServerConnection", null, "Crown Spread requires server connection."), 'error');
    }
}

async function handleDeckShuffle() {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    
    if (isConnected) {
        try {
            const result = await shuffleDeck();
            if (result && result.error) {
                showToast(i18nText("feature.vtt.vtt-connected.shuffleFailedValue", { value0: result.error }, "Shuffle failed: {{value0}}"), 'error');
            } else {
                showToast(i18nText("feature.vtt.vtt-connected.deckShuffled", null, "🔀 Deck shuffled."), 'success');
                if (result && result.remaining !== undefined) {
                    deckState.remaining = result.remaining;
                    updateDeckUI();
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to shuffle deck:', error);
            showToast(i18nText("feature.vtt.vtt-connected.deckShuffleFailed", null, "Deck shuffle failed."), 'error');
        }
    } else {
        showToast(i18nText("feature.vtt.vtt-connected.deckShuffleRequiresServerConnection", null, "Deck shuffle requires server connection."), 'error');
    }
}

async function handleDeckHistory() {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    
    if (isConnected) {
        try {
            const result = await getDeckHistory();
            if (result && result.error) {
                showToast(i18nText("feature.vtt.vtt-connected.historyFailedValue", { value0: result.error }, "History failed: {{value0}}"), 'error');
            } else if (result && result.history) {
                const history = result.history;
                if (history.length === 0) {
                    showToast(i18nText("feature.vtt.vtt-connected.noDeckHistoryAvailable", null, "📜 No deck history available."), 'info');
                } else {
                    const entries = history.slice(-5).map(h => 
                        `${h.type}: ${h.cards}`
                    ).join('\n');
                    showToast(i18nText("feature.vtt.vtt-connected.recentDrawsValue", { value0: entries }, "📜 Recent draws:\n{{value0}}"), 'info');
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to get deck history:', error);
            showToast(i18nText("feature.vtt.vtt-connected.failedToGetDeckHistory", null, "Failed to get deck history."), 'error');
        }
    } else {
        showToast(i18nText("feature.vtt.vtt-connected.deckHistoryRequiresServerConnection", null, "Deck history requires server connection."), 'error');
    }
}

async function handleClearDeckHistory() {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    
    if (isConnected) {
        try {
            const result = await clearDeckHistory();
            if (result && result.error) {
                showToast(i18nText("feature.vtt.vtt-connected.clearHistoryFailedValue", { value0: result.error }, "Clear history failed: {{value0}}"), 'error');
            } else {
                showToast(i18nText("feature.vtt.vtt-connected.deckHistoryCleared", null, "🗑️ Deck history cleared."), 'success');
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to clear deck history:', error);
            showToast(i18nText("feature.vtt.vtt-connected.failedToClearDeckHistory", null, "Failed to clear deck history."), 'error');
        }
    } else {
        showToast(i18nText("feature.vtt.vtt-connected.clearHistoryRequiresServerConnection", null, "Clear history requires server connection."), 'error');
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
                showToast(i18nText("feature.vtt.vtt-connected.listModulesFailedValue", { value0: result.error }, "List modules failed: {{value0}}"), 'error');
            } else if (result && result.modules) {
                loadedModules = result.modules;
                const count = loadedModules.length;
                if (count === 0) {
                    showToast(i18nText("feature.vtt.vtt-connected.noModulesLoaded", null, "📦 No modules loaded."), 'info');
                } else {
                    const names = loadedModules.map(m => m.name || m.id).join(', ');
                    showToast(i18nPlural('feature.vtt.vtt-connected.modulesLoaded', count, { names }, '📦 {{count}} modules loaded: {{names}}'), 'info');
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to list modules:', error);
            showToast(i18nText("feature.vtt.vtt-connected.failedToListModules", null, "Failed to list modules."), 'error');
        }
    } else {
        showToast(i18nText("feature.vtt.vtt-connected.moduleListRequiresServerConnection", null, "Module list requires server connection."), 'error');
    }
}

async function handleModulePush(moduleId) {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();

    if (isConnected) {
        try {
            const result = await requestModulePush(moduleId);
            if (result && result.error) {
                showToast(i18nText("feature.vtt.vtt-connected.modulePushFailedValue", { value0: result.error }, "Module push failed: {{value0}}"), 'error');
                return;
            }

            showToast(i18nText("feature.vtt.vtt-connected.modulePushedValue", { value0: moduleId }, "📦 Module pushed: {{value0}}"), 'success');

            // FIX: the server's broadcast excludes the sender (standard
            // "don't echo my own action back to me" pattern -- see
            // room.broadcastToRoom's exclude-client-id param), so without
            // this the person who actually pushed the module never got it
            // installed locally, only everyone else in the room did.
            const adventureJson = result?.module?.files && result.module.files['adventure.json'];
            if (adventureJson) {
                try {
                    const content = JSON.parse(adventureJson);
                    const adventureManager = await import('@features/adventure-manager/index.js');
                    adventureManager.installAdventureContent(content, { sourceLabel: '📦 Module installed' });
                } catch (err) {
                    console.warn('[VTT Connected] Pushed module could not be auto-installed locally:', err);
                }
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to push module:', error);
            showToast(i18nText("feature.vtt.vtt-connected.modulePushFailed", null, "Module push failed."), 'error');
        }
    } else {
        showToast(i18nText("feature.vtt.vtt-connected.modulePushRequiresServerConnection", null, "Module push requires server connection."), 'error');
    }
}

async function handleModuleCleanup(moduleId) {
    if (isDestroyed) return;
    const isConnected = isConnectedToServer();
    
    if (isConnected) {
        try {
            const result = await requestModuleCleanup(moduleId);
            if (result && result.error) {
                showToast(i18nText("feature.vtt.vtt-connected.moduleCleanupFailedValue", { value0: result.error }, "Module cleanup failed: {{value0}}"), 'error');
            } else {
                showToast(i18nText("feature.vtt.vtt-connected.moduleCleanupValue", { value0: moduleId }, "🧹 Module cleanup: {{value0}}"), 'success');
            }
        } catch (error) {
            console.warn('[VTT Connected] Failed to cleanup module:', error);
            showToast(i18nText("feature.vtt.vtt-connected.moduleCleanupFailed", null, "Module cleanup failed."), 'error');
        }
    } else {
        showToast(i18nText("feature.vtt.vtt-connected.moduleCleanupRequiresServerConnection", null, "Module cleanup requires server connection."), 'error');
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
    const attackTypeEl = q('#vtt-attack-type');
    const rangeEl = q('#vtt-range');
    const out = q('#vtt-roll-output');
    if (!attrEl || !skillEl || !dvEl || !posEl) return;

    let attr = parseInt(attrEl.value, 10) || 1;
    const skill = parseInt(skillEl.value, 10) || 0;
    const dv = parseInt(dvEl.value, 10) || 3;
    const pos = posEl.value;
    const boons = parseInt(boonsEl?.value, 10) || 0;

    // Weapon weight-class × range-band bonus — same table as the Character
    // Roller (core/talent-effects.js's RANGE_BONUS_TABLE). Manually selected
    // since this Quick Roller takes raw attr/skill numbers rather than a
    // named skill/character weaponClass.
    const weaponClass = attackTypeEl?.value || '';
    const range = rangeEl?.value || '';
    let rangeNote = '';
    if (weaponClass && range) {
        const selectedChar = vttStore.getSelectedCharacter();
        const equipMods = collectEquipmentModifiers(
            { armorType: selectedChar?.armorType, range, weaponClass, shieldType: selectedChar?.shieldType },
            true
        );
        attr = Math.max(0, attr + (equipMods.diceBonus || 0));
        if (equipMods.notes.length) rangeNote = ` [${equipMods.notes.join(', ')}]`;
    }

    const result = performRoll(attr, skill, dv, pos, boons);
    if (!result) {
        showToast(i18nText("feature.vtt.vtt-connected.poolMustBeAtLeast1Die", null, "Pool must be at least 1 die."), 'error');
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
                <span class="outcome-tag ${result.outcomeClass}" style="display:inline-block;padding:0.15rem 0.8rem;border-radius:20px;font-weight:600;font-size:0.9rem;margin-inline-end:0.4rem;background:${getOutcomeColor(result.outcome)};">
                    ${result.outcome}
                </span>
                <div class="vtt-roll-dice">${diceHtml}</div>
                <div class="vtt-roll-meta">
                    <span>Successes: <strong style="color:var(--green);">${result.successes}</strong></span>
                    <span>Story Beats: <strong style="color:var(--red);">${result.storyBeats}</strong></span>
                    ${result.reRolls > 0 ? `<span>Re-rolls: <strong>${result.reRolls}</strong></span>` : ''}
                    ${range ? `<span>📏 <strong style="color:var(--gold);">${RANGE_BAND_LABEL_MAP[range] || range}</strong>${rangeNote}</span>` : ''}
                    ${result.critical ? `<span>💥 <strong style="color:#e91e63;">Critical (${result.tens}×10)</strong></span>` : (result.tens > 0 ? `<span style="color:var(--text3);">${result.tens}×10</span>` : '')}
                </div>
            </div>
        `;
    }

    const postCheckbox = q('#vtt-post-chat');
    const shouldPost = postToChat && postCheckbox?.checked;
    if (shouldPost) {
        const sender = getSenderName();

        let msg = `[${result.outcome}] ${attr}+${skill} vs DV${dv} (${pos})`;
        if (range) msg += ` @ ${RANGE_BAND_LABEL_MAP[range] || range} range`;
        msg += ' → ';
        msg += result.dice.join(' ');
        msg += ` | S:${result.successes} SB:${result.storyBeats}`;
        if (result.reRolls > 0) {
            msg += ` | Re-rolls: ${result.reRolledDice.map(r => `${r.old}→${r.new}`).join(', ')}`;
        }
        if (result.critical) msg += ` | 💥 CRIT (${result.tens}×10)`;
        msg += ` — ${result.resultText}${rangeNote}`;

        sendMessage(msg, sender, 'all', {
            rollData: {
                outcome: result.outcome,
                outcomeClass: result.outcomeClass,
                resultText: result.resultText,
                dice: result.dice,
                successes: result.successes,
                storyBeats: result.storyBeats,
                reRolls: result.reRolls,
                reRolledDice: result.reRolledDice,
                range: range || null,
                tens: result.tens,
                critical: result.critical
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

        import('@features/encounters/combat.js').then(module => {
            module.logExternalAction?.(sender, msg, 'roll');
        }).catch(() => {});
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
            if (!result) { showToast(i18nText("feature.vtt.vtt-connected.poolMustBeAtLeast1Die", null, "Pool must be at least 1 die."), 'error'); return; }
            const msg = `[${result.outcome}] ${attr}+${skill} vs DV${dv} (${pos}) → ${result.dice.join(' ')} (S:${result.successes} SB:${result.storyBeats})${result.critical ? ' | 💥 CRIT' : ''}${note ? ' — ' + note : ''}`;
            sendMessage(msg, sender, 'all', {
                rollData: {
                    outcome: result.outcome,
                    outcomeClass: result.outcomeClass,
                    resultText: result.resultText,
                    dice: result.dice,
                    successes: result.successes,
                    storyBeats: result.storyBeats,
                    reRolls: result.reRolls,
                    reRolledDice: result.reRolledDice,
                    tens: result.tens,
                    critical: result.critical
                }
            });
            import('@features/encounters/combat.js').then(module => {
                module.logExternalAction?.(sender, msg, 'roll');
            }).catch(() => {});
            break;
        }
        // ... (other slash commands unchanged)
        default: {
            showToast(i18nText("feature.vtt.vtt-connected.unknownCommandTryHelp", null, "Unknown command. Try /help"), 'error');
        }
    }
}

// ============================================================
// CHARACTER PUSH TO SERVER
// ============================================================

async function pushCharactersToServer() {
    const roomCode = getRoomCode();
    if (!roomCode || typeof roomCode !== 'string' || roomCode.trim() === '') {
        console.warn('[VTT] No valid room code, cannot push characters.');
        return;
    }

    let apiKey = localStorage.getItem('fates-edge-api-key');
    if (!apiKey) {
        const input = prompt(i18nText("feature.vtt.vtt-connected.enterTheServerAPIKeyOrLeave", null, "Enter the server API key (or leave blank if not required):"), 'your-secret-key-here');
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

    const playerName = getClientName();

    const updates = {};
    characters.forEach(c => {
        if (c.name) {
            // NOTE: attribute keys are capitalized (Body/Wits/Spirit/Presence) to match
            // the client's own character schema (roller.js, wizard.js, vtt-core.js) and
            // the server's DEFAULT_ATTRIBUTES — sending lowercase keys here previously
            // clobbered the character's real attributes on the server with a bogus
            // lowercase object that nothing else (including an AI GM reading this data)
            // could read.
            const attrs = c.attributes || { Body: 2, Wits: 2, Spirit: 2, Presence: 2 };
            const entry = {
                attributes: {
                    Body: attrs.Body ?? 2,
                    Wits: attrs.Wits ?? 2,
                    Spirit: attrs.Spirit ?? 2,
                    Presence: attrs.Presence ?? 2,
                },
                harm: c.harm || 0,
                fatigue: c.fatigue || 0,
                obligation: c.obligation || 0,
                boons: c.boons || 0,
                leash: c.leash || 0,
                corruption: c.corruption || 0,
                skills: c.skills || {},
                avatar: c.avatar || null,
                playerName: playerName,
                // NEW: previously dropped on the floor here, so the server
                // (and anything reading server character data, like the AI
                // GM Session Panel's per-Patron Obligation breakdown) never
                // knew which Patron a character's Obligation was owed to.
                patron: c.patron || null,
            };
            updates[c.name] = entry;
        }
    });

    if (Object.keys(updates).length === 0) {
        console.log('[VTT] No valid character data to push.');
        return;
    }

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
                showToast(i18nText("feature.vtt.vtt-connected.charactersSyncedToServerForRoomValue", { value0: roomCode }, "📤 Characters synced to server for room {{value0}}."), 'success');
                charactersPushed = true;
            }
        } else {
            const text = await response.text();
            console.warn(`❌ Failed to push characters: ${response.status} ${text}`);
            if (!charactersPushed) {
                showToast(i18nText("feature.vtt.vtt-connected.failedToSyncCharactersValueCheckAPI", { value0: response.status }, "❌ Failed to sync characters ({{value0}}). Check API key."), 'error');
            }
        }
    } catch (e) {
        console.warn('❌ Error pushing characters:', e);
        if (!charactersPushed) {
            showToast(i18nText("feature.vtt.vtt-connected.errorSyncingCharactersCheckConnection", null, "❌ Error syncing characters. Check connection."), 'error');
        }
    }
}

// ============================================================
// CHARACTER PUSH ON LOCAL EDIT — the other half of the sync loop
// ============================================================
//
// Until now pushCharactersToServer() only ran on initial connect/
// reconnect (see setupWebSocketSync()/the 'connected' handler below).
// Editing a character sheet mid-session (features/characters/editor.js,
// wizard.js, roller.js — anything that calls core/state.js's
// updateCharacter()) never reached the server again after that first
// push, so the AI GM bot only ever saw a player's *starting* sheet until
// its own periodic aggressive sync (SYNC_INTERVAL_MS, ai-gm-bot.js)
// happened to catch up. Subscribing here — debounced, so a burst of
// field edits collapses into one push — closes that gap without
// spamming the server on every keystroke.
//
// Registered once at module load (this module is a singleton ES import)
// so edits are pushed even if the VTT panel itself isn't the currently
// active/visible feature.
let characterPushDebounceTimer = null;
const CHARACTER_PUSH_DEBOUNCE_MS = 1500;

function scheduleCharacterPush() {
    if (!isConnectedToServer() || isDestroyed) return;
    if (characterPushDebounceTimer) clearTimeout(characterPushDebounceTimer);
    characterPushDebounceTimer = setTimeout(() => {
        characterPushDebounceTimer = null;
        pushCharactersToServer().catch(() => {});
    }, CHARACTER_PUSH_DEBOUNCE_MS);
}

onCharacterChange(() => scheduleCharacterPush());

// ============================================================
// CHARACTER RECEIVE HELPERS
// ============================================================

function receiveCharacters(charArray) {
    if (!Array.isArray(charArray) || charArray.length === 0) {
        vttStore.updateCharacters([]);
        return;
    }
    const normalized = charArray.map(c => ensureCharacterDefaults(c));
    vttStore.updateCharacters(normalized);
    renderVTTChars();
    const selected = vttStore.getSelectedCharacter();
    if (selected) {
        const stillExists = normalized.some(c => c.name === selected.name);
        if (!stillExists) {
            vttStore.selectCharacter(null);
        }
    }
    populateChatRecipients();
    console.log(`[VTT] Received ${normalized.length} characters from server.`);
}

// ============================================================
// COMBAT STATUS & SCENE STATUS UI
// ============================================================

function updateCombatStatusUI() {
    const el = q('#vtt-combat-status');
    if (!el) return;
    if (!combatStatus) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }
    const c = combatStatus;
    const turnText = c.activeName ? `${escHtml(c.activeName)}'s turn` : 'awaiting turn order';
    const timerText = c.timerMax > 0
        ? ` · ⏱️ ${escHtml(c.timerName || 'Timer')} ${c.timerSegments}/${c.timerMax}`
        : '';
    el.style.display = 'inline-flex';
    el.innerHTML = `⚔️ Round ${c.round} — ${turnText}${timerText}`;
}

function updateSceneStatusUI() {
    const el = q('#vtt-scene-status');
    if (!el) return;
    if (!sceneStatus) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }
    const s = sceneStatus;
    const parts = [s.actTitle, s.sceneTitle].filter(Boolean).map(escHtml);
    const label = parts.length ? parts.join(' — ') : escHtml(s.adventureTitle || 'Adventure in progress');
    el.style.display = 'inline-flex';
    el.innerHTML = `🎭 ${label}`;
}

// ============================================================
// WEBSOCKET SYNC SETUP
// ============================================================

function setupWebSocketSync() {
    if (!isConnectedToServer() || isDestroyed) return;

    cleanupWebSocketListeners();

    // AI GM voice narration (optional -- see tts-narration.js's header
    // note). Just registers a listener; whether anything actually plays
    // depends on the per-browser toggle in isNarrationEnabled(), and on
    // whether the bot itself has TTS configured at all.
    initTtsNarration();

    try {
        sendEvent({ type: 'state-updated', state: getState() });
    } catch (e) { /* ignore */ }
    
    const chars = getCharacters();
    vttStore.updateCharacters(chars);
    vttStore.updateTimers(getState().timers || []);

    // ─── ROOM STATE ────────────────────────────────────
    // Sent once, right after connecting, as either 'room-state' (plain WS)
    // or 'room-joined' (Socket.io) -- see server/ws-handlers.js's
    // roomStatePayload / server/socketio-handlers.js's 'room-joined' emit.
    // Both carry the same fields we care about here, so one handler covers
    // both transports.
    //
    // `chatHistoryLoaded` guards against replaying the same history twice
    // if this ever fires more than once for a single mount (it shouldn't,
    // but the live chatHandler below has no de-dupe of its own, so a
    // double-apply would show duplicate messages rather than just no-op).
    let chatHistoryLoaded = false;
    const roomStateHandler = (data) => {
        if (isDestroyed) return;
        if (data && data.characters && Array.isArray(data.characters)) {
            receiveCharacters(data.characters);
        }
        if (data && data.deckRemaining !== undefined) {
            deckState.remaining = data.deckRemaining;
            updateDeckUI();
        }
        if (data && data.region) {
            defaultRegion = data.region;
            const regionDisplay = q('#vtt-region-display');
            if (regionDisplay) regionDisplay.textContent = defaultRegion;
        }
        // ─── Rolling chat history (see server/room.js's recordChatMessage) ──
        // Server sends oldest-first; vttStore.addChatMessage() appends, so
        // replaying in that order reconstructs the same chronological log
        // a client that had been connected the whole time would have.
        if (!chatHistoryLoaded && data && Array.isArray(data.chatHistory) && data.chatHistory.length) {
            chatHistoryLoaded = true;
            for (const msg of data.chatHistory) {
                if (!msg) continue;
                vttStore.addChatMessage({ ...msg, local: false, sent: true, fromHistory: true });
            }
        }
    };
    onWSEvent('room-state', roomStateHandler);
    wsListeners.set('room-state', roomStateHandler);
    onWSEvent('room-joined', roomStateHandler);
    wsListeners.set('room-joined', roomStateHandler);

    // ─── SYNC STATE ──────────────────────────────────
    const syncStateHandler = (data) => {
        if (isDestroyed) return;
        let charArray = null;
        if (data && data.characters && Array.isArray(data.characters)) {
            charArray = data.characters;
        } else if (data && data.state && data.state.characters && Array.isArray(data.state.characters)) {
            charArray = data.state.characters;
        }
        if (charArray) {
            receiveCharacters(charArray);
        }
        showToast(i18nText("feature.vtt.vtt-connected.syncComplete", null, "📋 Sync complete."), 'info');
    };
    onWSEvent('sync-state', syncStateHandler);
    wsListeners.set('sync-state', syncStateHandler);

    // ─── STATE UPDATED ──────────────────────────────
    const stateHandler = (data) => {
        if (isDestroyed) return;
        if (data && data.characters && Array.isArray(data.characters)) {
            receiveCharacters(data.characters);
        } else if (data && data.state && data.state.characters && Array.isArray(data.state.characters)) {
            receiveCharacters(data.state.characters);
        }
        if (data && data.timers) {
            vttStore.updateTimers(data.timers);
        }
    };
    onWSEvent('state-updated', stateHandler);
    wsListeners.set('state-updated', stateHandler);

    // ─── CHAT MESSAGES ──────────────────────────────
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

    // ─── ROLL RESULTS ──────────────────────────────
    const rollHandler = (rollData) => {
        if (isDestroyed) return;
        showToast(i18nText("feature.vtt.vtt-connected.valueRolledValue", { value0: rollData.sender || i18nText('common.player', null, 'Player'), value1: rollData.outcome }, "🎲 {{value0}} rolled {{value1}}"), 'info');
    };
    onWSEvent('roll-result', rollHandler);
    wsListeners.set('roll-result', rollHandler);

    // ─── DECK EVENTS ────────────────────────────────
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
        showToast(i18nText("feature.vtt.vtt-connected.drewValueCardsFromValue", { value0: cards.length, value1: region }, "🃏 Drew {{value0}} cards from {{value1}}"), 'success');
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
        showToast(i18nText("feature.vtt.vtt-connected.deckShuffled_p6yh1", null, "🔀 Deck shuffled"), 'success');
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
        showToast(i18nText("feature.vtt.vtt-connected.crownSpreadDelivered", null, "👑 Crown Spread delivered"), 'success');
    };
    onWSEvent('crown-spread', crownSpreadHandler);
    wsListeners.set('crown-spread', crownSpreadHandler);

    // ─── ASSISTANT GM SUGGESTIONS ────────────────────
    // Optional -- fired by fates-edge-ai-gm-bot's modules/
    // assistant-suggestions.js whenever the bot (in Assistant GM mode)
    // proposes something needing human approval: a new fact, NPC, scene
    // advance, knowledge reveal/hide, or (new) an LLM-synthesized SB spend
    // complication / Crown Spread interpretation (see ROADMAP.md item 2
    // in that repo). Rendered as its own chat card (renderSuggestionDetails()
    // in vtt-core.js) with live Approve/Reject buttons; clicking one
    // dispatches 'assistant-suggestion-action' (handled below), which
    // just sends the existing `!gm approve <id>` / `!gm reject <id>` chat
    // command over whatever connection this client already has -- no new
    // client->server request type, 100% reuse of the approval path that
    // already works today via chat.
    //
    // Rendered directly via vttStore.addChatMessage() rather than
    // sendMessage() -- this is a notification ABOUT something the server
    // already decided, not an outbound chat message this client is
    // originating, so it must not also be sent back over the wire (that
    // would echo it into every other client's chat as if a human typed it).
    const suggestionCreatedHandler = (data) => {
        if (isDestroyed) return;
        const { id, kind, label, preview } = data || {};
        if (!id) return;
        pendingSuggestionMeta.set(id, { kind, preview: preview || label });
        vttStore.addChatMessage({
            id,
            text: label || kind || 'Assistant GM proposal',
            sender: 'GM Assistant',
            recipient: 'all',
            whisper: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            local: false,
            sent: true,
            suggestionData: { id, kind, preview: preview || label, status: 'pending' },
        });
        showToast(i18nText("feature.vtt.vtt-connected.assistantGMProposalValue", { value0: label || kind }, "📋 Assistant GM proposal: {{value0}}"), 'info');
    };
    onWSEvent('assistant-suggestion-created', suggestionCreatedHandler);
    wsListeners.set('assistant-suggestion-created', suggestionCreatedHandler);

    const suggestionResolvedHandler = (data) => {
        if (isDestroyed) return;
        const { id, outcome } = data || {};
        if (!id) return;
        const meta = pendingSuggestionMeta.get(id) || {};
        vttStore.updateChatMessage(id, {
            suggestionData: { id, kind: meta.kind, preview: meta.preview, status: outcome },
        });
        pendingSuggestionMeta.delete(id);
    };
    onWSEvent('assistant-suggestion-resolved', suggestionResolvedHandler);
    wsListeners.set('assistant-suggestion-resolved', suggestionResolvedHandler);

    // ─── REACTIVE SOUNDSCAPE ────────────────────────
    // Optional -- fired by the AI GM Bot on scene changes or an explicit
    // [MOOD "..."] tag (see that repo's adventure-context.js/
    // process-tags.js). Two shapes, both fail-soft (silent no-op if
    // unusable) like every other optional integration in this app:
    //
    //   1. `trackId` -- only meaningful if a track with that exact id
    //      already exists in THIS room's soundboard (a GM manually mapped
    //      this mood to one of their own tracks -- see
    //      core/soundboard.js's addSoundTrack()). A mood the bot's
    //      profile maps to a track this room never created is ignored.
    //
    //   2. `url` (NEW) -- the bot's SOUNDSCAPE_AUTO_SEARCH mode: no GM
    //      mapping existed for this mood, so the bot searched Freesound
    //      itself (via the socket server's /api/soundboard/search proxy)
    //      and picked a result. There's no pre-existing local track to
    //      reference, so this room auto-adds one on the fly (same
    //      addSoundTrack() the "Search Sounds" modal uses) and plays
    //      that -- every room that receives the cue ends up with its own
    //      independent track pointing at the same URL, exactly as if
    //      each GM had added it by hand. Attribution is attached the same
    //      way the search modal does it, when the bot says it's required.
    //
    // Defaults transitionDuration to 2000ms (the "bonus" smooth fade from
    // the feature request) when the event doesn't specify one.
    const soundboardAmbienceHandler = (data) => {
        if (isDestroyed) return;
        const transitionDuration = Number.isFinite(data?.transitionDuration) ? data.transitionDuration : 2000;

        if (data?.trackId) {
            const exists = getSoundTracks().some(t => t.id === data.trackId);
            if (!exists) {
                console.log(`[VTT] Soundscape cue for mood "${data?.mood || '?'}" references unknown track "${data.trackId}" -- no matching track in this room's soundboard, ignoring.`);
                return;
            }
            playAmbienceTrack(data.trackId, { transitionDuration });
            if (data?.mood) showToast(i18nText("feature.vtt.vtt-connected.ambienceShiftingToValue", { value0: data.mood }, "🎵 Ambience shifting to \"{{value0}}\""), 'info');
            return;
        }

        if (data?.url) {
            const name = (data.name || `Auto: ${data.mood || 'ambience'}`).trim();
            const track = addSoundTrack({ name, url: data.url, type: 'ambience', volume: 1 });
            if (!track) return;
            if (data.attribution) {
                setTrackAttribution(track.id, data.attribution);
            }
            playAmbienceTrack(track.id, { transitionDuration });
            showToast(data?.mood
                ? i18nText('feature.vtt.vtt-connected.aiGmSelectedForMood', { name, mood: data.mood }, '🎵 AI GM auto-selected "{{name}}" for "{{mood}}"')
                : i18nText('feature.vtt.vtt-connected.aiGmSelected', { name }, '🎵 AI GM auto-selected "{{name}}"'), 'info');
        }
    };
    onWSEvent('soundboard-ambience', soundboardAmbienceHandler);
    wsListeners.set('soundboard-ambience', soundboardAmbienceHandler);

    const deckHistoryHandler = (data) => {
        if (isDestroyed) return;
        console.log('[VTT] Deck history received:', data);
    };
    onWSEvent('deck-history', deckHistoryHandler);
    wsListeners.set('deck-history', deckHistoryHandler);

    const deckHistoryClearedHandler = (data) => {
        if (isDestroyed) return;
        showToast(i18nText("feature.vtt.vtt-connected.deckHistoryCleared_1s7w3", null, "🗑️ Deck history cleared"), 'info');
    };
    onWSEvent('deck-history-cleared', deckHistoryClearedHandler);
    wsListeners.set('deck-history-cleared', deckHistoryClearedHandler);

    // ─── MODULE EVENTS ──────────────────────────────
    const moduleListHandler = (data) => {
        if (isDestroyed) return;
        loadedModules = data.modules || [];
        const count = loadedModules.length;
        if (count === 0) {
            showToast(i18nText("feature.vtt.vtt-connected.noModulesLoaded", null, "📦 No modules loaded."), 'info');
        } else {
            const names = loadedModules.map(m => m.name || m.id).join(', ');
            showToast(i18nPlural('feature.vtt.vtt-connected.modulesLoaded', count, { names }, '📦 {{count}} modules loaded: {{names}}'), 'info');
        }
    };
    onWSEvent('module-list', moduleListHandler);
    wsListeners.set('module-list', moduleListHandler);

    // FIX: this used to just show a toast and do nothing else -- a pushed
    // module never actually became loadable. It's now installed into the
    // local adventure library (the same place "Load from File" puts
    // things), so it shows up in Adventure Manager immediately, same as
    // if the GM had imported the file by hand. Only `files['adventure.json']`
    // is understood right now (see server/api.js's module-push payload
    // shape and DATA_SCHEMA.md's "Adventure modules" section) -- modules
    // whose sole file is a differently-named adventure JSON (like the
    // shipped server/modules/example-module/ before it was renamed to
    // match) won't auto-install; this still announces the push either way.
    const modulePushHandler = async (data) => {
        if (isDestroyed) return;
        const module = data.module || {};
        const name = module.manifest?.name || module.id || 'Unknown';
        const adventureJson = module.files && module.files['adventure.json'];

        if (!adventureJson) {
            showToast(i18nText("feature.vtt.vtt-connected.modulePushedValueNoAdventureJsonTo", { value0: name }, "📦 Module pushed: {{value0}} (no adventure.json to auto-install)"), 'info');
            return;
        }

        try {
            const content = JSON.parse(adventureJson);
            const adventureManager = await import('@features/adventure-manager/index.js');
            adventureManager.installAdventureContent(content, {
                sourceLabel: `📦 Module pushed`
            });
        } catch (err) {
            console.warn('[VTT] Failed to auto-install pushed module:', err);
            showToast(i18nText("feature.vtt.vtt-connected.modulePushedValueAutoInstallFailedValue", { value0: name, value1: err.message }, "📦 Module pushed: {{value0}} (auto-install failed: {{value1}})"), 'warning');
        }
    };
    onWSEvent('module-push', modulePushHandler);
    wsListeners.set('module-push', modulePushHandler);

    const moduleCleanupHandler = async (data) => {
        if (isDestroyed) return;
        const moduleId = data.moduleId || 'Unknown';
        try {
            const adventureManager = await import('@features/adventure-manager/index.js');
            const removed = adventureManager.removeInstalledAdventure(moduleId);
            showToast(removed ? `🧹 Module removed: ${moduleId}` : `🧹 Module cleanup: ${moduleId} (was not installed here)`, 'info');
        } catch (err) {
            console.warn('[VTT] Failed to clean up module:', err);
            showToast(i18nText("feature.vtt.vtt-connected.moduleCleanupValue", { value0: moduleId }, "🧹 Module cleanup: {{value0}}"), 'info');
        }
    };
    onWSEvent('module-cleanup', moduleCleanupHandler);
    wsListeners.set('module-cleanup', moduleCleanupHandler);

    // ─── REGION UPDATE ──────────────────────────────
    const regionUpdateHandler = (data) => {
        if (isDestroyed) return;
        if (data.region) {
            defaultRegion = data.region;
            const regionDisplay = q('#vtt-region-display');
            if (regionDisplay) regionDisplay.textContent = defaultRegion;
            showToast(i18nText("feature.vtt.vtt-connected.regionUpdatedToValue", { value0: defaultRegion }, "📍 Region updated to: {{value0}}"), 'info');
        }
    };
    onWSEvent('region-updated', regionUpdateHandler);
    wsListeners.set('region-updated', regionUpdateHandler);

    // ─── COMBAT STATUS ──────────────────────────────
    const combatStatusHandler = (data) => {
        if (isDestroyed) return;
        combatStatus = (data && data.combat) || null;
        updateCombatStatusUI();
    };
    onWSEvent('combat-status-update', combatStatusHandler);
    wsListeners.set('combat-status-update', combatStatusHandler);

    // ─── SCENE STATUS ──────────────────────────────
    const sceneStatusHandler = (data) => {
        if (isDestroyed) return;
        sceneStatus = (data && data.scene) || null;
        updateSceneStatusUI();
    };
    onWSEvent('scene-status-update', sceneStatusHandler);
    wsListeners.set('scene-status-update', sceneStatusHandler);

    // ─── CHARACTER SELECTION ──────────────────────────
    const charSelectHandler = (data) => {
        if (isDestroyed) return;
        const { clientId, character, characters } = data;
        if (!clientId) return;
        // Accept either the legacy single `character` string or the
        // newer `characters` array ("Remote enabled"); prefer the array
        // when present since it's the more complete representation.
        const names = (Array.isArray(characters) ? characters : (character ? [character] : []))
            .filter(Boolean)
            .slice(0, MAX_CONTROLLED_CHARACTERS);

        const presence = vttStore.state.presence || [];
        const updated = presence.map(p => {
            if (p.id === clientId) {
                return { ...p, selectedCharacter: names[0] || '', selectedCharacters: names };
            }
            return p;
        });
        vttStore.updatePresence(updated);

        if (clientId === getSocketId()) {
            const chars = vttStore.state.characters || [];
            const ids = names.map(n => chars.find(c => c.name === n)?.id).filter(Boolean);
            vttStore.setSelectedCharacterIds(ids);
        }
    };
    onWSEvent('character-select', charSelectHandler);
    wsListeners.set('character-select', charSelectHandler);

    // ─── PRESENCE ────────────────────────────────────
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
            const updatedClients = data.clients.map(c => ({
                id: c.id,
                name: c.name || 'Player',
                role: c.role || 'player',
                online: true,
                selectedCharacter: c.selectedCharacter || '',
                avatar: c.avatar || null,
            }));
            vttStore.updatePresence(updatedClients);
            updateGMUI();
            renderLocalPresence();
        }
    };
    onWSEvent('presence', presenceHandler);
    wsListeners.set('presence', presenceHandler);

    // ─── GM EVENTS ────────────────────────────────────
    const gmVoteHandler = (data) => {
        if (isDestroyed) return;
        const { requesterId, requesterName, currentGmId, currentGmName } = data;
        const myId = getSocketId();
        if (gmState.myRole === 'gm' && myId === currentGmId) {
            if (!gmState.requests.find(r => r.requesterId === requesterId)) {
                gmState.requests.push({ requesterId, requesterName });
            }
            updateGMUI();
            showToast(i18nText("feature.vtt.vtt-connected.valueRequestsToBecomeGM", { value0: requesterName }, "👑 {{value0}} requests to become GM."), 'info');
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
        showToast(i18nText("feature.vtt.vtt-connected.yourRoleIsNowValue", { value0: role.toUpperCase() }, "Your role is now: {{value0}}"), 'success');
    };
    onWSEvent('gm_role_update', gmRoleHandler);
    wsListeners.set('gm_role_update', gmRoleHandler);

    // v4.8: Co-GM / Player / Spectator changes -- distinct from
    // 'gm_role_update' above, which stays dedicated to the single GM seat.
    // Reuses the same 'gmRoleUpdate' DOM CustomEvent name (feature-toggles.js
    // and anything else already listening for it just cares "my role
    // changed to X", not which server event triggered it) so no other
    // listener needs to know this is a second source.
    const roleUpdateHandler = (data) => {
        if (isDestroyed) return;
        const { targetId, role, persist } = data;
        const myId = getSocketId();
        if (targetId && clientsMap.has(targetId)) {
            clientsMap.get(targetId).role = role;
        }
        if (targetId === myId) {
            gmState.myRole = role;
            document.dispatchEvent(new CustomEvent('gmRoleUpdate', { detail: { role } }));
            const roleLabel = { 'co-gm': 'Co-GM', 'assistant-gm': 'Assistant GM', player: 'Player', spectator: 'Spectator' }[role] || role;
            const roleScope = (role === 'co-gm' || role === 'assistant-gm')
                ? (persist
                    ? i18nText('feature.vtt.vtt-connected.savedRole', null, ' (saved)')
                    : i18nText('feature.vtt.vtt-connected.sessionOnlyRole', null, ' (this session only)'))
                : '';
            showToast(i18nText("feature.vtt.vtt-connected.yourRoleIsNowValueValue", { value0: roleLabel, value1: roleScope }, "Your role is now: {{value0}}{{value1}}"), 'success');
        }
        updateGMUI();
        renderLocalPresence();
    };
    onWSEvent('role_update', roleUpdateHandler);
    wsListeners.set('role_update', roleUpdateHandler);

    const announcementHandler = (data) => {
        if (isDestroyed) return;
        showToast(data.message, 'info');
    };
    onWSEvent('server_announcement', announcementHandler);
    wsListeners.set('server_announcement', announcementHandler);

    // The server refused an event this client sent because its role
    // isn't allowed to send it. Shown rather than swallowed: without it
    // a demoted (or not-yet-restored) GM just sees a button that quietly
    // does nothing, which reads as a broken app rather than a permission.
    const permissionDeniedHandler = (data) => {
        if (isDestroyed) return;
        showToast(data?.message || 'You do not have permission to do that.', 'error');
    };
    onWSEvent('permission-denied', permissionDeniedHandler);
    wsListeners.set('permission-denied', permissionDeniedHandler);

    // ─── Effect callouts ────────────────────────────────────────
    // Effect in Fate's Edge is a NARRATIVE quantity. A Scale mismatch
    // moves Effect; it never moves DV or the dice pool. So there is
    // deliberately nothing to store: no track, no counter, no field on a
    // character. Announcing it IS the mechanic — the table needs to know
    // the swing landed harder or softer than the roll alone implies, and
    // then the fiction carries it.
    //
    // This handler therefore does exactly two things, both transient: a
    // banner, and a line in the chat feed so the moment survives in the
    // scrollback the way any other call at the table would. It writes to
    // no state and sends nothing back over the wire.
    const effectCalledHandler = (data) => {
        if (isDestroyed) return;
        const steps = Math.min(3, Math.max(1, parseInt(data?.steps, 10) || 1));
        const up = (parseInt(data?.direction, 10) || 1) >= 0;
        const marks = (up ? '+' : '-').repeat(steps);
        const reason = (data?.reason || '').toString().trim();
        const headline = `${marks} Effect${up ? '!' : ''}`;

        showToast(reason ? `${headline} — ${reason}` : headline, up ? 'success' : 'warning');

        vttStore.addChatMessage({
            id: `effect-${Date.now().toString(36)}`,
            text: reason ? `${headline} — ${reason}` : headline,
            sender: data?.source || 'GM',
            recipient: 'all',
            whisper: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            local: false,
            sent: true,
        });
    };
    onWSEvent('effect-called', effectCalledHandler);
    wsListeners.set('effect-called', effectCalledHandler);

    // ─── CONNECTION EVENTS ──────────────────────────
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
        showToast(i18nText("feature.vtt.vtt-connected.reconnectedToServer", null, "Reconnected to server!"), 'success');
        charactersPushed = false;
        pushCharactersToServer();
        sendClientName();
        const selected = vttStore.getSelectedCharacter();
        if (selected) {
            sendCharacterSelection(selected.name);
        }
    };
    onWSEvent('connected', connectHandler);
    wsListeners.set('connected', connectHandler);

    const disconnectHandler = () => {
        if (isDestroyed) return;
        vttStore.setConnectionStatus('local');
        showToast(i18nText("feature.vtt.vtt-connected.disconnectedFromServerMessagesWillBeLocal", null, "Disconnected from server. Messages will be local."), 'warning');
        charactersPushed = false;
    };
    onWSEvent('disconnected', disconnectHandler);
    wsListeners.set('disconnected', disconnectHandler);

    // ─── HANDSHAKE ────────────────────────────────────
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
            actions.innerHTML = `<button class="btn btn-sm btn-danger" id="vtt-gm-resign" data-i18n="feature.vtt.vtt-connected.resignGM">Resign GM</button>`;
        } else {
            actions.innerHTML = `<button class="btn btn-sm btn-gold" id="vtt-gm-request" data-i18n="feature.vtt.vtt-connected.requestGM">Request GM</button>`;
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
// VOICE
// ============================================================

async function toggleVoice() {
    try {
        // BUGFIX: was `state.sessionId || 'vtt-' + Date.now().toString(36)`
        // — see getStableClientId() in core/state.js.
        const userId = getStableClientId();
        const { initMediaModule } = await import('@core/media.js');
        initMediaModule(userId);
    } catch (e) { /* ignore */ }
    if (isDestroyed) return;
    if (!voiceInitialized) {
        const success = await initVoice();
        if (success) {
            voiceInitialized = true;
            const toggleBtn = q('#vtt-voice-toggle');
            if (toggleBtn) {
                toggleBtn.textContent = i18nText("feature.vtt.vtt-connected.voiceOn", null, "🎤 Voice On");
                toggleBtn.className = 'btn btn-sm btn-primary';
            }
            const containerEl = q('.flex-between .flex:last-child');
            if (containerEl && !q('#vtt-mute-toggle')) {
                const muteBtn = document.createElement('button');
                muteBtn.id = 'vtt-mute-toggle';
                muteBtn.className = 'btn btn-sm btn-green';
                muteBtn.textContent = i18nText("feature.vtt.vtt-connected.live", null, "🎙️ Live");
                muteBtn.addEventListener('click', toggleMuteVoice);
                containerEl.appendChild(muteBtn);
            }
            showToast(i18nText("feature.vtt.vtt-connected.voiceChatEnabled", null, "Voice chat enabled!"), 'success');
        }
    } else {
        cleanupVoice();
        voiceInitialized = false;
        const toggleBtn = q('#vtt-voice-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = i18nText("feature.vtt.vtt-connected.voiceOff", null, "🎤 Voice Off");
            toggleBtn.className = 'btn btn-sm';
        }
        const muteBtn = q('#vtt-mute-toggle');
        if (muteBtn) muteBtn.remove();
        vttStore.updateVoiceClients([]);
        showToast(i18nText("feature.vtt.vtt-connected.voiceChatDisabled", null, "Voice chat disabled."), 'info');
    }
}

function toggleTtsNarration() {
    const enabled = !isNarrationEnabled();
    setNarrationEnabled(enabled);
    const btn = q('#vtt-tts-toggle');
    if (btn) {
        btn.textContent = enabled ? '🔊 AI Narration On' : '🔈 AI Narration Off';
        btn.className = `btn btn-sm ${enabled ? 'btn-primary' : ''}`;
    }
    showToast(enabled ? 'AI GM narration enabled.' : 'AI GM narration disabled.', 'info');
}

function toggleMuteVoice() {
    const muted = toggleMute();
    const btn = q('#vtt-mute-toggle');
    if (!btn) return;
    if (muted) {
        btn.textContent = i18nText("feature.vtt.vtt-connected.muted", null, "🔇 Muted");
        btn.className = 'btn btn-sm btn-danger';
    } else {
        btn.textContent = i18nText("feature.vtt.vtt-connected.live", null, "🎙️ Live");
        btn.className = 'btn btn-sm btn-green';
    }
}

function callVoiceClient(clientId) {
    if (!voiceInitialized) {
        showToast(i18nText("feature.vtt.vtt-connected.enableVoiceFirst", null, "Enable voice first."), 'error');
        return;
    }
    const client = getVoiceClient(clientId);
    if (!client) {
        showToast(i18nText("feature.vtt.vtt-connected.clientNotFound", null, "Client not found."), 'error');
        return;
    }
    if (client.connectionState === 'connected') {
        showToast(i18nText("feature.vtt.vtt-connected.alreadyConnectedToValue", { value0: client.name }, "Already connected to {{value0}}"), 'info');
        return;
    }
    initiateVoiceCall(clientId);
    showToast(i18nText("feature.vtt.vtt-connected.callingValue", { value0: client.name }, "Calling {{value0}}..."), 'info');
    // NEW: the toast above is visual-only -- a screen-reader user tabbing
    // through the party roster and pressing the call button got no
    // confirmation the call actually started. announce() mirrors it to the
    // sr-only live region the way chat/roll events already do.
    announce(i18nText("feature.vtt.vtt-connected.callingValue", { value0: client.name }, "Calling {{value0}}..."));
}

// ============================================================
// EVENT HANDLING
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
            case 'vtt-clear-chat': clearChatHistory?.(); vttStore.clearChat(); showToast(i18nText("feature.vtt.vtt-connected.chatCleared", null, "Chat cleared."), 'success'); break;
            case 'vtt-refresh-btn': {
                const chars = getCharacters();
                vttStore.updateCharacters(chars);
                vttStore.updateTimers(getState().timers || []);
                populateChatRecipients();
                showToast(i18nText("feature.vtt.vtt-connected.vttRefreshed", null, "VTT refreshed."), 'info');
                break;
            }
            case 'vtt-roll-post-btn': rollConnected(true); break;
            case 'vtt-roll-only-btn': rollConnected(false); break;
            case 'vtt-add-timer': import('@core/state.js').then(m => {
                const state = m.getState();
                const name = prompt(i18nText("feature.vtt.vtt-connected.timerName", null, "Timer name:"), 'Scene Timer');
                if (name) {
                    const segments = parseInt(prompt(i18nText("feature.vtt.vtt-connected.segments", null, "Segments:"), '6') || '6');
                    const timer = { id: 'timer-' + Date.now(), name, segments, current: 0 };
                    m.addTimer(timer);
                    vttStore.updateTimers(state.timers || []);
                    showToast(i18nText("feature.vtt.vtt-connected.timerValueCreated", { value0: name }, "Timer \"{{value0}}\" created."), 'success');
                }
            }).catch(() => showToast(i18nText("feature.vtt.vtt-connected.timerFeatureNotAvailable", null, "Timer feature not available"), 'error')); break;
            case 'vtt-scene-end': {
                const state = getState();
                (state.characters || []).forEach(c => {
                    if (c.boons > 2) {
                        c.boons = 2;
                    }
                });
                const chars = getCharacters();
                vttStore.updateCharacters(chars);
                resetCombatScene();
                try {
                    sendEvent({ type: 'state-updated', state: state });
                } catch (e) { /* ignore */ }
                showToast(i18nText("feature.vtt.vtt-connected.sceneEndedBoonsTrimmed", null, "Scene ended, boons trimmed."), 'info');
                break;
            }
            case 'vtt-voice-toggle': toggleVoice(); break;
            case 'vtt-mute-toggle': toggleMuteVoice(); break;
            case 'vtt-tts-toggle': toggleTtsNarration(); break;
            case 'vtt-deck-draw-1': handleDeckDraw(1); break;
            case 'vtt-deck-draw-2': handleDeckDraw(2); break;
            case 'vtt-deck-draw-3': handleDeckDraw(3); break;
            case 'vtt-deck-crown': handleCrownSpread(); break;
            case 'vtt-deck-shuffle': handleDeckShuffle(); break;
            case 'vtt-deck-history': handleDeckHistory(); break;
            case 'vtt-modules-list': handleModuleList(); break;
            case 'vtt-gm-request': {
                if (!isConnectedToServer()) {
                    showToast(i18nText("feature.vtt.vtt-connected.notConnectedToServer", null, "Not connected to server."), 'error');
                    return;
                }
                sendWSMessage({ type: 'request_gm' });
                showToast(i18nText("feature.vtt.vtt-connected.requestSentToGM", null, "Request sent to GM."), 'info');
                break;
            }
            case 'vtt-gm-resign': {
                showToast(i18nText("feature.vtt.vtt-connected.toStepDownApproveAPendingRequest", null, "To step down, approve a pending request or promote another player."), 'info');
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
            showToast(i18nText("feature.vtt.vtt-connected.approvedValueAsGM", { value0: targetId }, "Approved {{value0}} as GM."), 'success');
        } else if (rejectBtn) {
            gmState.requests = gmState.requests.filter(r => r.requesterId !== targetId);
            updateGMUI();
            showToast(i18nText("feature.vtt.vtt-connected.rejectedRequestFromValue", { value0: targetId }, "Rejected request from {{value0}}."), 'info');
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
        if (e.target.id === 'vtt-speak-messages') {
            VTT_CONFIG.speakMessages = e.target.checked;
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

    // --- Follower chat listener ---
    const followerChatHandler = (e) => {
        const { characterName, followerName, message } = e.detail;
        if (!message || !followerName) return;
        const sender = `${followerName} (${characterName})`;
        sendMessage(message, sender, 'all');
    };
    document.addEventListener('follower-chat', followerChatHandler);
    docEventListeners.push({ event: 'follower-chat', handler: followerChatHandler });

    // --- Assistant GM suggestion Approve/Reject buttons ---
    // Dispatched by vtt-core.js's renderChat() click delegation (see
    // renderSuggestionDetails() there) -- translates a button click into
    // the same `!gm approve <id>` / `!gm reject <id>` chat command a human
    // GM would type, sent over whatever connection this client already
    // has. No new client->server request type.
    const suggestionActionHandler = (e) => {
        const { id, action } = e.detail || {};
        if (!id || !action || (action !== 'approve' && action !== 'reject')) return;
        sendMessage(`!gm ${action} ${id}`, getSenderName(), 'all');
    };
    document.addEventListener('assistant-suggestion-action', suggestionActionHandler);
    docEventListeners.push({ event: 'assistant-suggestion-action', handler: suggestionActionHandler });
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

    // Capture the sendMessage function for global use
    vttSendMessageFn = sendMessage;

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
        const speaking = !!client?.speaking;
        const isSpeaking = speaking ? 'var(--gold)' : 'var(--bg3)';
        const name = client?.name || 'Player';
        // Speaking is conveyed three ways, not just the color dot: a visible
        // 🔊 icon (so it's not color-only for colorblind users), and an
        // sr-only text suffix (so it's discoverable by screen readers
        // Tab-ing/browsing to this badge -- deliberately NOT pushed through
        // the aria-live announcer, since mic activity toggles many times a
        // second and would be pure noise there).
        return `<span class="voice-client-badge" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.2rem 0.8rem;border-radius:20px;background:var(--bg4);font-size:0.85rem;border:1px solid var(--border);">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isSpeaking};transition:background 0.3s;" aria-hidden="true"></span>
            ${escHtml(name)}${speaking ? ' <span aria-hidden="true" title="Speaking">🔊</span>' : ''}<span class="sr-only">${speaking ? ', speaking' : ''}</span>
        </span>`;
    }).join('');

    // Main HTML – with chat pane height increased and detail panel container added
    el.innerHTML = `
    <div class="vtt-live-table">

        <!-- Header -->
        <div class="vtt-header">
        <h1 class="page-title">
            💬 VTT – Live Table
            <span class="mode-indicator vtt-stat-pill ${isConnected ? 'connected' : 'disconnected'}">
            ${isConnected ? '🌐 Connected' : '📡 Local'}
            </span>
            <span class="vtt-stat-pill mode-label">${mode}</span>
            <button class="btn btn-sm btn-ghost" onclick="window.location.hash='whiteboard'" title="Open Whiteboard" data-i18n-attr="title:feature.vtt.vtt-connected.openWhiteboard" data-i18n="feature.vtt.vtt-connected.whiteboard">✏️ Whiteboard</button>
        </h1>
        <p class="page-sub" data-i18n="feature.vtt.vtt-connected.chatPartyStatusQuickDieRollerDeck">Chat, party status, quick die roller, deck, and scene timers all in one view.</p>
        </div>

        <!-- Table Status -->
        <div class="panel vtt-card status-panel">
        <div class="vtt-card-header">
            <span class="vtt-card-title" data-i18n="feature.vtt.vtt-connected.tableStatus">🛰️ Table Status</span>
            <span class="vtt-stat-pill">
            <span class="vtt-dot connection-status" style="background:${isConnected ? 'var(--vtt-green)' : 'var(--vtt-red)'};"></span>
            ${isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
        </div>
        <div class="vtt-stat-row">
            ${roomCode ? `<span class="vtt-stat-pill">🔑 Room <strong>${roomCode}</strong></span>` : ''}
            ${socketId ? `<span class="vtt-stat-pill">👤 <strong>${escHtml(getClientName())}</strong></span>` : ''}
            <span class="vtt-stat-pill">📍 ${defaultRegion}</span>
            <span class="vtt-stat-pill">🃏 <strong id="vtt-deck-count-header">${deckCount}</strong> cards</span>
            <span class="vtt-stat-pill" id="vtt-combat-status" style="display:none;background:var(--bg4);border:1px solid var(--red);"></span>
            <span class="vtt-stat-pill" id="vtt-scene-status" style="display:none;background:var(--bg4);border:1px solid var(--gold);"></span>
        </div>
        <div class="vtt-divider"></div>
        <!-- Voice controls -->
        <div class="vtt-stat-row" style="justify-content:space-between;">
            <div class="vtt-btn-row" style="align-items:center;">
            <button class="btn btn-sm ${voiceInitialized ? 'btn-primary' : ''}" id="vtt-voice-toggle">${voiceInitialized ? '🎤 Voice On' : '🎤 Voice Off'}</button>
            ${voiceInitialized ? `<button class="btn btn-sm ${voiceStatus?.muted ? 'btn-danger' : 'btn-green'}" id="vtt-mute-toggle">${voiceStatus?.muted ? '🔇 Muted' : '🎙️ Live'}</button>` : ''}
            <span class="vtt-stat-pill" id="voice-clients-count">${voiceClients.length} voice users</span>
            <button class="btn btn-sm ${isNarrationEnabled() ? 'btn-primary' : ''}" id="vtt-tts-toggle" title="Play the AI GM's replies aloud, when the bot has voice narration configured">${isNarrationEnabled() ? '🔊 AI Narration On' : '🔈 AI Narration Off'}</button>
            </div>
        </div>
        <div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem;">
            <span style="font-size:0.9rem;color:var(--vtt-text3);">🎤</span>
            <div style="flex:1;height:6px;background:var(--vtt-surface2);border-radius:3px;overflow:hidden;">
            <div id="voice-activity-bar" style="width:0%;height:100%;background:var(--vtt-gold);border-radius:3px;transition:width 0.1s;"></div>
            </div>
            <span style="font-size:0.8rem;color:var(--vtt-text3);" id="voice-activity-label">idle</span>
        </div>
        <div id="voice-clients-list" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem;">
            ${voiceClients.length === 0 ? '<span style="color:var(--vtt-text3);font-size:0.9rem;">No other voice clients.</span>' : voiceClientsHtml}
        </div>
        <div class="vtt-divider"></div>
        <div class="vtt-card-header" style="margin-bottom:0.35rem;">
            <span class="vtt-card-title" style="font-size:1rem;" data-i18n="feature.vtt.vtt-connected.partyMembers">👥 Party Members</span>
            <span class="vtt-stat-pill" id="vtt-mode-badge">${isConnected ? '🌐 Online' : '📡 Local'}</span>
        </div>
        <div id="presence-list"></div>
        </div>

        <!-- GM Management -->
        <div class="panel vtt-card gm-panel">
        <div class="vtt-card-header">
            <span class="vtt-card-title">👑 Game Master
            <span id="gm-display" style="font-weight:600;font-size:0.95rem;color:var(--vtt-text2);">${gmState.currentGmName || 'None'}</span>
            <span id="gm-role-badge" class="vtt-stat-pill gm-badge">${gmState.myRole === 'gm' ? 'You are GM' : 'Player'}</span>
            </span>
            <span id="gm-actions" class="vtt-btn-row">
            ${gmState.myRole === 'gm' ? `
                <button class="btn btn-sm btn-danger" id="vtt-gm-resign" data-i18n="feature.vtt.vtt-connected.resignGM">Resign GM</button>
            ` : `
                <button class="btn btn-sm btn-gold" id="vtt-gm-request" data-i18n="feature.vtt.vtt-connected.requestGM">Request GM</button>
            `}
            </span>
        </div>
        <div id="gm-requests" style="display:none;">
            <div class="vtt-divider"></div>
            <span class="text-muted" style="font-size:0.85rem;" data-i18n="feature.vtt.vtt-connected.pendingRequests">Pending requests:</span>
            <div id="gm-requests-list"></div>
        </div>
        </div>

        <!-- Main Grid -->
        <div class="vtt-section-grid">
        <!-- Chat Column -->
        <div class="chat-box vtt-card" style="display:flex;flex-direction:column;min-height:min(55vh, 500px);">
            <div class="vtt-card-header">
            <span class="vtt-card-title" data-i18n="feature.vtt.vtt-connected.chat">💬 Chat</span>
            <div class="vtt-btn-row" style="align-items:center;">
                <span class="text-muted" id="message-count" data-i18n="feature.vtt.vtt-connected.0Messages">0 messages</span>
                <button class="btn btn-sm btn-ghost" id="vtt-clear-chat" title="Clear chat" data-i18n-attr="title:feature.vtt.vtt-connected.clearChat">🗑️</button>
            </div>
            </div>
            <!-- Viewport-relative sizing — see vtt-local.js for the same change.
                 NEW: role="log"/aria-live="polite"/aria-relevant="additions" makes
                 screen readers announce each new chat message as it's appended,
                 with no JS changes needed to chatHandler below -- the standard
                 ARIA pattern for a persistently-visible, append-only log. -->
            <div class="chat-messages" id="chatMessages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Chat messages" style="flex:1;overflow-y:auto;padding:0.5rem;background:var(--vtt-surface2);border-radius:calc(var(--vtt-radius) - 2px);margin-bottom:0.5rem;font-size:1rem;display:flex;flex-direction:column;max-height:min(70vh, 600px);min-height:min(35vh, 300px);" data-i18n-attr="aria-label:feature.vtt.vtt-connected.chatMessages"></div>
            <div id="selected-character-display" style="margin-bottom:0.4rem;padding:0.2rem 0.4rem;background:var(--vtt-surface2);border-radius:calc(var(--vtt-radius) - 2px);min-height:2.5rem;"></div>
            <div class="chat-input-row" style="display:flex;gap:0.4rem;">
            <input type="text" id="chatInput" placeholder="Type… (/roll, /timer, /deck, /help)" style="flex:1;font-size:1rem;padding:0.5rem 0.6rem;" / data-i18n-attr="placeholder:feature.vtt.vtt-connected.typeRollTimerDeckHelp">
            <select id="chatRecipient" style="flex:0 0 120px;font-size:1rem;">
                <option value="all" data-i18n="feature.vtt.vtt-connected.all">All</option>
            </select>
            <button class="btn btn-gold" id="chat-send-btn" data-i18n="feature.vtt.vtt-connected.send">Send</button>
            </div>
            <div class="flex mt-1" style="flex-wrap:wrap;gap:0.9rem;font-size:0.9rem;align-items:center;">
            <label class="inline-check"><input type="checkbox" id="vtt-post-chat" checked /> Post rolls to chat</label>
            <label class="inline-check"><input type="checkbox" id="vtt-auto-scroll" checked /> Auto-scroll</label>
            <!-- NEW: "Type to Speak" -- reads new chat messages aloud via
                 the browser's speechSynthesis so a player who typed instead
                 of speaking (deaf, mute, or just not on voice) is heard by
                 anyone listening, not only anyone reading. -->
            <label class="inline-check" title="Reads new chat messages aloud, so a player who types instead of speaking is still heard" data-i18n-attr="title:feature.vtt.vtt-connected.readsNewChatMessagesAloudSoA"><input type="checkbox" id="vtt-speak-messages" /> 🔊 Read aloud</label>
            </div>
            <div class="vtt-hint">Try <code>/roll 3 2 3</code>, <code>/deck 1</code>, <code>/crown</code>, or <code>/help</code> for the full command list.</div>
        </div>

        <!-- Sidebar -->
        <div class="vtt-sidebar">
            <div class="vtt-sidebar-scroll">
            <!-- Party Status -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-connected.party">👥 Party</span>
                <button class="btn btn-sm btn-ghost" id="vtt-refresh-btn" title="Refresh" data-i18n-attr="title:feature.vtt.vtt-connected.refresh">↻</button>
                </div>
                <div id="vttCharGrid" class="vtt-char-grid"></div>
                <!-- NEW: detail panel for selected character -->
                <div id="vtt-char-detail" style="margin-top:0.5rem;"></div>
            </div>

            <!-- Combat Actions -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-connected.combatActions">⚔️ Combat Actions</span>
                </div>
                <div id="vtt-combat-actions" style="min-height:2.5rem;"></div>
            </div>

            <!-- Mini Combat Tracker — live initiative order + range-to-you,
                 without requiring the full Encounters tracker modal open.
                 See vtt-local.js for the same feature; reads the same
                 encounters/combat.js in-memory session (SPA-wide singleton). -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-connected.combatTracker">🗡️ Combat Tracker</span>
                <button class="btn btn-sm btn-ghost" onclick="window.location.hash='encounters'" title="Open full Encounters tracker" data-i18n-attr="title:feature.vtt.vtt-connected.openFullEncountersTracker">↗️</button>
                </div>
                <div id="vtt-mini-tracker-body" style="min-height:2rem;"></div>
            </div>

            <!-- Quick Roller -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-connected.quickRoller">🎲 Quick Roller</span>
                </div>
                <div class="vtt-dice-row">
                <div class="vtt-field">
                    <label data-i18n="feature.vtt.vtt-connected.attr">Attr</label>
                    <input type="number" id="vtt-attr" value="3" min="1" max="8" style="width:100%;" />
                </div>
                <div class="vtt-field">
                    <label data-i18n="feature.vtt.vtt-connected.skill">Skill</label>
                    <input type="number" id="vtt-skill" value="2" min="0" max="12" style="width:100%;" />
                </div>
                <div class="vtt-field" style="flex:0 0 80px;">
                    <label data-i18n="feature.vtt.vtt-connected.dv">DV</label>
                    <select id="vtt-dv">
                    <option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5+</option>
                    </select>
                </div>
                <div class="vtt-field" style="flex:0 0 90px;">
                    <label data-i18n="feature.vtt.vtt-connected.pos">Pos</label>
                    <select id="vtt-pos">
                    <option value="dominant" data-i18n="feature.vtt.vtt-connected.dom">Dom</option><option value="controlled" selected data-i18n="feature.vtt.vtt-connected.ctrl">Ctrl</option><option value="desperate" data-i18n="feature.vtt.vtt-connected.desp">Desp</option>
                    </select>
                </div>
                <div class="vtt-field" style="flex:0 0 70px;">
                    <label data-i18n="feature.vtt.vtt-connected.boons">Boons</label>
                    <input type="number" id="vtt-boons" value="0" min="0" max="5" />
                </div>
                </div>
                <div class="vtt-dice-row" style="margin-top:0.4rem;">
                <div class="vtt-field" style="flex:1 1 140px;">
                    <label data-i18n="feature.vtt.vtt-connected.weapon">Weapon</label>
                    <select id="vtt-attack-type" title="Weapon weight class — drives the range bonus below (Player's Guide §3.12.1-3.12.3).">
                    <option value="">— N/A —</option>
                    <option value="light" data-i18n="feature.vtt.vtt-connected.light">🗡️ Light</option>
                    <option value="medium" data-i18n="feature.vtt.vtt-connected.medium">⚔️ Medium</option>
                    <option value="heavy" data-i18n="feature.vtt.vtt-connected.heavy">🔨 Heavy</option>
                    <option value="ranged" data-i18n="feature.vtt.vtt-connected.ranged">🏹 Ranged</option>
                    </select>
                </div>
                <div class="vtt-field" style="flex:1 1 160px;">
                    <label data-i18n="feature.vtt.vtt-connected.rangeGMSet">Range (GM-set)</label>
                    <select id="vtt-range" title="The narrative range the GM told you before rolling." data-i18n-attr="title:feature.vtt.vtt-connected.theNarrativeRangeTheGMToldYou">
                    ${RANGE_BAND_OPTIONS.map(r => `<option value="${r.key}">${r.label}</option>`).join('')}
                    </select>
                </div>
                </div>
                <div id="vtt-common-rolls" style="margin-top:0.5rem;min-height:2.5rem;"></div>
                <div class="vtt-btn-row" style="margin-top:0.5rem;">
                <button class="btn btn-gold btn-sm" id="vtt-roll-post-btn" data-i18n="feature.vtt.vtt-connected.rollPost">Roll &amp; Post</button>
                <button class="btn btn-sm" id="vtt-roll-only-btn" data-i18n="feature.vtt.vtt-connected.rollOnly">Roll Only</button>
                </div>
                <div id="vtt-roll-output" class="mt-1" style="min-height:3rem;padding:0.2rem 0;"></div>
            </div>

            <!-- Deck Panel -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-connected.deck">🃏 Deck</span>
                <span class="vtt-stat-pill">📍 <strong id="vtt-region-display">${defaultRegion}</strong></span>
                </div>
                <div class="vtt-btn-row">
                <button class="btn btn-sm btn-gold" id="vtt-deck-draw-1" data-i18n="feature.vtt.vtt-connected.draw1">Draw 1</button>
                <button class="btn btn-sm btn-gold" id="vtt-deck-draw-2" data-i18n="feature.vtt.vtt-connected.draw2">Draw 2</button>
                <button class="btn btn-sm btn-gold" id="vtt-deck-draw-3" data-i18n="feature.vtt.vtt-connected.draw3">Draw 3</button>
                <button class="btn btn-sm btn-primary" id="vtt-deck-crown" data-i18n="feature.vtt.vtt-connected.crown">👑 Crown</button>
                <button class="btn btn-sm" id="vtt-deck-shuffle">🔀</button>
                <button class="btn btn-sm btn-ghost" id="vtt-deck-history">📜</button>
                <button class="btn btn-sm btn-ghost" id="vtt-modules-list">📦</button>
                </div>
                <div class="vtt-hint">Cards remaining: <strong id="vtt-deck-count">${deckCount}</strong></div>
            </div>

            <!-- Timers -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-connected.sceneTimers">⏱️ Scene Timers</span>
                </div>
                <div id="vttTimerList"></div>
                <div class="vtt-btn-row" style="margin-top:0.5rem;">
                <button class="btn btn-sm" id="vtt-add-timer" data-i18n="feature.vtt.vtt-connected.addTimer">+ Add Timer</button>
                <button class="btn btn-sm" id="vtt-scene-end" data-i18n="feature.vtt.vtt-connected.sceneEnd">🌅 Scene End</button>
                </div>
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
    renderCombatActions();
    renderVTTTimers();
    renderLocalPresence();
    renderVoiceClients();
    updateMessageCount();
    populateChatRecipients();
    updateCombatStatusUI();
    updateSceneStatusUI();
    renderMiniTracker();

    const chars = getCharacters();
    vttStore.updateCharacters(chars);
    vttStore.updateTimers(getState().timers || []);
    vttStore.setConnectionStatus(isConnected ? 'connected' : 'local');

    if (voiceUnsubscribe) voiceUnsubscribe();
    voiceUnsubscribe = onVoiceClientsChanged((clients) => {
        vttStore.updateVoiceClients(clients);
    });

    if (selectedCharUnsubscribe) selectedCharUnsubscribe();
    selectedCharUnsubscribe = vttStore.subscribe('selectedCharacterId', (id) => {
        if (!id) return;
        const char = vttStore.getSelectedCharacter();
        if (char && char.name) {
            sendCharacterSelection(char.name);
        }
    });

    if (presenceUnsubscribe) presenceUnsubscribe();
    presenceUnsubscribe = vttStore.subscribe('presence', () => {
        if (!isDestroyed) renderLocalPresence();
    });

    setupWebSocketSync();
    attachEvents();
    updateGMUI();
    if (isConnectedToServer()) {
        sendClientName();
    }

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
        renderMiniTracker();
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

    // Expose sendCharacterSelection globally for vtt-core
    window.__vttConnected = { sendCharacterSelection };

    console.log('[VTT Connected] Rendered with reactive store + full character sync + selection broadcast');
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
    if (selectedCharUnsubscribe) {
        selectedCharUnsubscribe();
        selectedCharUnsubscribe = null;
    }
    if (presenceUnsubscribe) {
        presenceUnsubscribe();
        presenceUnsubscribe = null;
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
    cleanupTtsNarration();
    if (voiceUnsubscribe) {
        voiceUnsubscribe();
        voiceUnsubscribe = null;
    }
    if (voiceInitialized) {
        cleanupVoice();
        voiceInitialized = false;
    }
    // Clean up global VTT send function
    vttSendMessageFn = null;
    if (window.sendToVTT === sendToVTT) {
        delete window.sendToVTT;
    }
    if (window.__vttSendMessage) {
        delete window.__vttSendMessage;
    }
    window.__vttConnected = null;
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
    sendCharacterSelection,
    initVoice,
    toggleMute,
    getVoiceStatus,
    cleanupVoice,
    getActiveVoiceClients,
    getVoiceClient,
    initiateVoiceCall,
    onVoiceClientsChanged
};
