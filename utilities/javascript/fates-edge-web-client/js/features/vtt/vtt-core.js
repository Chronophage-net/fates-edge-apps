/**
 * VTT Core – reactive rendering functions
 * Updated for:
 * - Vertical JRPG-style roster (scrollable list)
 * - Single-click selection with highlighting
 * - Auto-populate Quick Roller from selected character
 * - Common rolls with auto-population
 * - Larger, more readable UI
 * - Avatar support
 */

import { vttStore } from '../../core/vtt-store.js';
import { escHtml, getStorage, setHtml, createElement } from '../../core/utils.js';
import { isConnectedToServer, getRoomCode, getSocketId, getConnectionMode } from '../../core/websocket.js';
import { getOutcomeColor, getOutcomeLabel, getOutcomeClass } from '../../core/dice.js';

// ============================================================
// Configuration
// ============================================================
export const VTT_CONFIG = {
    maxChatMessages: 200,
    chatAutoScroll: true,
    presenceUpdateInterval: 5000,
};

export const SENDER_TYPES = {
    SYSTEM: 'System',
    ROLL: 'Roll',
    OOC: 'OOC',
    GM: 'GM',
    DECK: 'Deck',
};

export const COMMON_ROLLS = {
    Stealth: { attr: 'body', skill: 'stealth' },
    Investigate: { attr: 'mind', skill: 'investigate' },
    Perception: { attr: 'mind', skill: 'perception' },
    Athletics: { attr: 'body', skill: 'athletics' },
    Acrobatics: { attr: 'body', skill: 'acrobatics' },
    Persuasion: { attr: 'soul', skill: 'persuasion' },
    Deception: { attr: 'soul', skill: 'deception' },
    Insight: { attr: 'mind', skill: 'insight' },
    Survival: { attr: 'body', skill: 'survival' },
    Medicine: { attr: 'mind', skill: 'medicine' },
    Arcana: { attr: 'mind', skill: 'arcana' },
    Intimidation: { attr: 'soul', skill: 'intimidation' },
};

// ============================================================
// Container & query helpers
// ============================================================
let currentContainer = null;

export function setContainer(el) {
    currentContainer = el;
}

export function q(selector) {
    if (!currentContainer) return null;
    return currentContainer.querySelector(selector);
}

export function qa(selector) {
    if (!currentContainer) return [];
    return currentContainer.querySelectorAll(selector);
}

// ============================================================
// Chat renderer (reactive) – with selected character display
// ============================================================
let chatUnsubscribe = null;
let selectedCharUnsubscribe = null;

export function renderChat() {
    if (!currentContainer) return;
    const chatContainer = currentContainer.querySelector('#chatMessages');
    if (!chatContainer) return;

    const selectedDisplay = currentContainer.querySelector('#selected-character-display');
    if (selectedDisplay) {
        if (selectedCharUnsubscribe) selectedCharUnsubscribe();
        selectedCharUnsubscribe = vttStore.subscribe('selectedCharacterId', (id) => {
            const char = id ? vttStore.getSelectedCharacter() : null;
            if (char) {
                const avatarHtml = char.avatar
                    ? `<img src="${char.avatar}" alt="${escHtml(char.name)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);" />`
                    : `<span style="font-size:1.8rem;">🧑</span>`;
                selectedDisplay.innerHTML = `
                    <div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.2rem 0.8rem;border-radius:20px;border:2px solid var(--gold);">
                        ${avatarHtml}
                        <span style="font-weight:700;font-size:1rem;">${escHtml(char.name)}</span>
                        <span style="font-size:0.7rem;color:var(--text2);">(selected)</span>
                        <button class="btn btn-xs btn-ghost" id="clear-selected-char" title="Deselect" style="padding:0 0.3rem;">✕</button>
                    </div>
                `;
                const clearBtn = selectedDisplay.querySelector('#clear-selected-char');
                if (clearBtn) {
                    clearBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        vttStore.selectCharacter(null);
                    });
                }
            } else {
                selectedDisplay.innerHTML = `<span style="color:var(--text3);font-size:0.9rem;">No character selected</span>`;
            }
        });
    }

    if (chatUnsubscribe) chatUnsubscribe();
    chatUnsubscribe = vttStore.subscribe('chatMessages', (messages) => {
        const allMessages = messages || [];
        const isConnected = isConnectedToServer();
        const roomCode = isConnected ? getRoomCode() : null;
        const mode = getConnectionMode ? getConnectionMode() : 'websocket';

        if (!Array.isArray(allMessages) || allMessages.length === 0) {
            setHtml(chatContainer, `
                <div class="empty-chat-state" style="padding:2rem 1rem;text-align:center;color:var(--text3);">
                    <div style="font-size:2.5rem;margin-bottom:0.5rem;">💬</div>
                    <div style="font-size:1.1rem;">No messages yet</div>
                    <div style="font-size:0.9rem;margin-top:0.3rem;">
                        ${isConnected ? `🌐 Connected to server${roomCode ? ` (${roomCode})` : ''}` : '📡 Messages stay local'}
                        <span style="color:var(--text4);margin-left:0.3rem;">via ${mode}</span>
                    </div>
                    <div style="font-size:0.8rem;margin-top:0.5rem;color:var(--text4);">
                        Type /help for commands
                    </div>
                </div>
            `);
            return;
        }

        const displayMessages = allMessages.length > VTT_CONFIG.maxChatMessages
            ? allMessages.slice(-VTT_CONFIG.maxChatMessages)
            : allMessages;

        let html = '';
        for (const msg of displayMessages) {
            if (!msg || typeof msg !== 'object') continue;
            const sender = msg.sender || 'Unknown';
            const text = msg.text || '';
            const time = msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isSystem = sender === SENDER_TYPES.SYSTEM || sender === SENDER_TYPES.ROLL;
            const isOOC = sender === SENDER_TYPES.OOC;
            const isGM = sender === SENDER_TYPES.GM;
            const isDeck = sender === SENDER_TYPES.DECK;
            const isLocal = msg.local !== false;

            let senderColor = 'var(--text)';
            if (isSystem) senderColor = 'var(--gold)';
            else if (isOOC) senderColor = 'var(--blue)';
            else if (isGM) senderColor = 'var(--red)';
            else if (isDeck) senderColor = 'var(--purple)';

            const whisper = msg.whisper ? '🔒 ' : '';
            const recipient = msg.recipient && msg.recipient !== 'all' ? ` → ${escHtml(msg.recipient)}` : '';

            let modeBadge = '';
            if (isLocal && !isConnected) {
                modeBadge = ` <span class="mode-badge local" style="font-size:0.65rem;color:var(--text3);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--border);">📡 local</span>`;
            } else if (isLocal && isConnected) {
                modeBadge = ` <span class="mode-badge local-ws" style="font-size:0.65rem;color:var(--gold);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--gold);">📡 local</span>`;
            } else if (!isLocal && isConnected) {
                modeBadge = ` <span class="mode-badge synced" style="font-size:0.65rem;color:var(--green);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--green);">🌐 synced</span>`;
            }

            let statusIcon = '✓';
            let statusColor = 'var(--text3)';
            let statusTitle = 'Local only';
            if (msg.sent === true) {
                statusIcon = '✓✓';
                statusColor = 'var(--green)';
                statusTitle = 'Synced to server';
            } else if (msg.sent === false) {
                statusIcon = '✗';
                statusColor = 'var(--red)';
                statusTitle = 'Failed to send';
            } else if (isLocal) {
                statusIcon = '✓';
                statusColor = 'var(--text3)';
                statusTitle = 'Local only';
            } else {
                statusIcon = '✓✓';
                statusColor = 'var(--green)';
                statusTitle = 'Synced to server';
            }

            html += `
                <div class="chat-message" data-msg-id="${msg.id || ''}" style="padding:0.4rem 0.6rem;border-bottom:1px solid var(--border);font-size:1rem;transition:background 0.2s;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span style="color:var(--text2);font-size:0.8rem;">${escHtml(time)}</span>
                        <strong style="color:${senderColor};font-size:1rem;">${escHtml(sender)}${recipient}:</strong>
                        <span style="word-break:break-word;font-size:1rem;">${whisper}${escHtml(String(text))}</span>
                        ${modeBadge}
                        <span class="msg-status" style="font-size:0.7rem;color:${statusColor};margin-left:auto;" title="${statusTitle}">${statusIcon}</span>
                    </div>
                    ${msg.rollData ? renderRollDetails(msg.rollData) : ''}
                    ${msg.deckData ? renderDeckDetails(msg.deckData) : ''}
                </div>
            `;
        }

        setHtml(chatContainer, html);
        if (VTT_CONFIG.chatAutoScroll) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    });
}

function renderRollDetails(rollData) {
    if (!rollData) return '';
    const diceHtml = (rollData.dice || []).map(die => {
        let bgColor = 'var(--bg4)';
        let textColor = 'var(--text)';
        let label = die;
        if (die === 10) {
            bgColor = 'var(--green)';
            textColor = 'white';
            label = '10';
        } else if (die >= 6) {
            bgColor = 'var(--green)';
            textColor = 'white';
        } else if (die === 1) {
            bgColor = 'var(--red)';
            textColor = 'white';
            label = '1⚠️';
        }
        return `<span style="display:inline-block;padding:0.05rem 0.4rem;margin:0.05rem;border-radius:4px;background:${bgColor};color:${textColor};font-size:0.8rem;">${label}</span>`;
    }).join(' ');
    
    const outcomeColor = getOutcomeColor(rollData.outcome || '');
    const outcomeLabel = getOutcomeLabel(rollData.outcome || '');
    const outcomeClass = getOutcomeClass(rollData.outcome || '');
    
    return `
        <div style="margin-top:0.3rem;padding:0.3rem 0.5rem;background:var(--bg2);border-radius:6px;font-size:0.85rem;">
            <div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;">
                <span class="outcome-tag ${outcomeClass}" style="padding:0.1rem 0.8rem;border-radius:20px;font-weight:700;background:${outcomeColor};color:white;font-size:0.9rem;">${outcomeLabel}</span>
                <span>🎲 ${diceHtml}</span>
                <span style="color:var(--text3);">S:${rollData.successes || 0} SB:${rollData.storyBeats || 0}</span>
            </div>
        </div>
    `;
}

function renderDeckDetails(deckData) {
    if (!deckData) return '';
    const cards = deckData.cards || [];
    const cardNames = cards.map(c => 
        c.is_joker ? '🃏 Joker' : `${c.rank_name || c.rank} of ${c.suit_name || c.suit}`
    ).join(', ');
    
    return `
        <div style="margin-top:0.3rem;padding:0.3rem 0.5rem;background:var(--bg2);border-radius:6px;font-size:0.85rem;color:var(--text3);">
            <span>🃏 ${cardNames}</span>
            ${deckData.remaining !== undefined ? `<span style="margin-left:0.5rem;">Remaining: ${deckData.remaining}</span>` : ''}
        </div>
    `;
}

// ============================================================
// Party Status – Vertical JRPG-style roster (scrollable list)
// ============================================================
let charUnsubscribe = null;

export function renderVTTChars() {
    if (!currentContainer) return;
    const grid = currentContainer.querySelector('#vttCharGrid');
    if (!grid) return;

    if (charUnsubscribe) charUnsubscribe();
    charUnsubscribe = vttStore.subscribe('characters', (chars) => {
        const vttChars = chars.filter(c => c.vtt !== false);
        const selectedId = vttStore.getSelectedCharacterId();

        if (vttChars.length === 0) {
            setHtml(grid, `<div style="text-align:center;padding:1.5rem;color:var(--text3);font-size:1.1rem;">👤 No VTT characters</div>`);
            return;
        }

        let html = `<div style="display:flex;flex-direction:column;gap:0.4rem;">`;
        for (const char of vttChars) {
            const name = char.name || 'Unnamed';
            const harm = char.harm || 0;
            const fatigue = char.fatigue || 0;
            const boons = char.boons || 0;
            const tier = char.tier || 1;
            const isSelected = char.id === selectedId;

            const avatarHtml = char.avatar
                ? `<img src="${char.avatar}" alt="${escHtml(name)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'};flex-shrink:0;" />`
                : `<span style="font-size:1.6rem;flex-shrink:0;">🧑</span>`;

            html += `
                <div class="vtt-char-card" data-char-id="${char.id}" style="
                    display:flex;
                    align-items:center;
                    gap:0.8rem;
                    background:var(--bg3);
                    border-radius:var(--radius);
                    padding:0.4rem 0.8rem;
                    border:2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'};
                    box-shadow: ${isSelected ? '0 0 12px rgba(212,175,55,0.4)' : 'none'};
                    transition:all 0.2s;
                    cursor:pointer;
                ">
                    ${avatarHtml}
                    <div style="display:flex;flex-direction:column;justify-content:center;flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                            <span style="font-weight:700;font-size:1rem;">${escHtml(name)}</span>
                            <span style="font-size:0.65rem;color:var(--text3);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:12px;">T${tier}</span>
                            ${isSelected ? `<span style="font-size:0.65rem;color:var(--gold);font-weight:600;">👑 Selected</span>` : ''}
                        </div>
                        <div style="display:flex;gap:0.8rem;font-size:0.85rem;color:var(--text2);margin-top:0.1rem;">
                            <span>❤️ ${harm}</span>
                            <span>⚡ ${fatigue}</span>
                            <span>🎲 ${boons}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
        setHtml(grid, html);

        grid.querySelectorAll('.vtt-char-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const id = card.dataset.charId;
                if (id) {
                    vttStore.selectCharacter(id);
                }
            });
        });
    });
}

// ============================================================
// Auto-populate Quick Roller from selected character
// ============================================================
let rollerPopulateUnsubscribe = null;

function populateRollerFromSelected(char) {
    if (!char) return;
    const attrSelect = q('#vtt-attr');
    const skillSelect = q('#vtt-skill');
    const boonsInput = q('#vtt-boons');
    if (attrSelect) {
        const body = char.attributes?.body ?? 3;
        if ([1,2,3,4,5].includes(body)) {
            attrSelect.value = body;
        } else {
            attrSelect.value = 3;
        }
    }
    if (skillSelect) {
        skillSelect.value = 0;
    }
    if (boonsInput) {
        boonsInput.value = char.boons ?? 0;
    }
}

export function initRollerAutoPopulate() {
    if (rollerPopulateUnsubscribe) return;
    rollerPopulateUnsubscribe = vttStore.subscribe('selectedCharacterId', (id) => {
        const char = id ? vttStore.getSelectedCharacter() : null;
        if (char) {
            populateRollerFromSelected(char);
        }
    });
}

// ============================================================
// Common Rolls Renderer
// ============================================================
let commonRollsUnsubscribe = null;

export function renderCommonRolls() {
    if (!currentContainer) return;
    const container = currentContainer.querySelector('#vtt-common-rolls');
    if (!container) return;

    initRollerAutoPopulate();

    if (commonRollsUnsubscribe) commonRollsUnsubscribe();
    commonRollsUnsubscribe = vttStore.subscribe('selectedCharacterId', (id) => {
        const char = id ? vttStore.getSelectedCharacter() : null;
        if (!char) {
            setHtml(container, `<span style="color:var(--text3);font-size:0.9rem;">Select a character to use common rolls.</span>`);
            return;
        }

        let html = `<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.4rem;">`;
        for (const [label, config] of Object.entries(COMMON_ROLLS)) {
            const attrVal = char.attributes?.[config.attr] ?? 3;
            const skillVal = char.skills?.[config.skill] ?? 0;
            html += `
                <button class="btn btn-sm btn-secondary common-roll-btn" 
                        data-attr="${attrVal}" 
                        data-skill="${skillVal}"
                        data-label="${label}"
                        style="font-size:0.8rem;padding:0.1rem 0.6rem;">
                    ${label} (${attrVal}+${skillVal})
                </button>
            `;
        }
        html += `</div>`;
        setHtml(container, html);

        container.querySelectorAll('.common-roll-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const attr = parseInt(btn.dataset.attr, 10) || 3;
                const skill = parseInt(btn.dataset.skill, 10) || 0;
                const label = btn.dataset.label;
                const attrSelect = q('#vtt-attr');
                const skillSelect = q('#vtt-skill');
                if (attrSelect) attrSelect.value = attr;
                if (skillSelect) skillSelect.value = skill;
                const boonsInput = q('#vtt-boons');
                if (boonsInput && char) {
                    boonsInput.value = char.boons || 0;
                }
                const output = q('#vtt-roll-output');
                if (output) {
                    output.innerHTML = `<span style="color:var(--text2);">⚡ ${label} prepared (Attr ${attr} + Skill ${skill})</span>`;
                }
                const rollerPanel = q('.vtt-panel:has(#vtt-roll-output)');
                if (rollerPanel) rollerPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });
    });
}

// ============================================================
// Timers (reactive)
// ============================================================
let timerUnsubscribe = null;

export function renderVTTTimers() {
    if (!currentContainer) return;
    const list = currentContainer.querySelector('#vttTimerList');
    if (!list) return;

    if (timerUnsubscribe) timerUnsubscribe();
    timerUnsubscribe = vttStore.subscribe('timers', (timers) => {
        if (!timers || timers.length === 0) {
            setHtml(list, `<div class="empty-state" style="text-align:center;padding:0.8rem;color:var(--text3);font-size:0.9rem;">⏱️ No active timers</div>`);
            return;
        }
        let html = '';
        for (const timer of timers) {
            const name = timer.name || 'Timer';
            const current = timer.current || 0;
            const segments = timer.segments || 1;
            const progress = segments > 0 ? Math.min((current / segments) * 100, 100) : 0;
            const isComplete = progress >= 100;
            html += `
                <div class="vtt-timer" style="margin-bottom:0.4rem;background:var(--bg3);border-radius:6px;padding:0.4rem 0.6rem;${isComplete ? 'border:1px solid var(--red);' : ''}">
                    <div style="display:flex;justify-content:space-between;font-size:0.9rem;">
                        <span style="font-weight:600;">${escHtml(name)}</span>
                        <span>${current}/${segments} ${isComplete ? '✅' : ''}</span>
                    </div>
                    <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;margin-top:4px;overflow:hidden;">
                        <div style="width:${progress}%;height:100%;background:${isComplete ? 'var(--red)' : 'var(--gold)'};border-radius:3px;transition:width 0.3s;"></div>
                    </div>
                </div>
            `;
        }
        setHtml(list, html);
    });
}

// ============================================================
// Presence (reactive with WebSocket integration)
// ============================================================
let presenceUnsubscribe = null;

export function renderLocalPresence() {
    if (!currentContainer) return;
    const presenceList = currentContainer.querySelector('#presence-list');
    if (!presenceList) return;

    if (presenceUnsubscribe) presenceUnsubscribe();
    presenceUnsubscribe = vttStore.subscribe('presence', (presence) => {
        const isConnected = isConnectedToServer();
        const roomCode = isConnected ? getRoomCode() : null;
        const socketId = isConnected ? getSocketId() : null;
        
        if (!presence || presence.length === 0) {
            setHtml(presenceList, `
                <div style="color:var(--text3);padding:0.4rem 0;font-size:0.9rem;">
                    ${isConnected ? '🌐 Connected, no other players' : '📡 Local mode'}
                    ${roomCode ? ` (${roomCode})` : ''}
                </div>
            `);
            return;
        }
        const showAvatars = getStorage('fates-edge-show-avatars', 'true') !== 'false';
        let html = '';
        for (const p of presence) {
            const isSelf = p.id === socketId;
            const avatarUrl = showAvatars
                ? p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&size=32&background=2c3e50&color=fff`
                : '';
            html += `
                <div class="presence-item" style="display:flex;align-items:center;gap:0.6rem;padding:0.3rem 0;border-bottom:1px solid var(--border);${isSelf ? 'background:var(--bg4);border-radius:6px;padding:0.3rem 0.6rem;' : ''}">
                    ${showAvatars ? `<img src="${avatarUrl}" alt="${escHtml(p.name)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 32 32%22%3E%3Crect fill=%22%232c3e50%22 width=%2232%22 height=%2232%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23fff%22 font-family=%22Arial%22 font-size=%2214%22%3E${encodeURIComponent(p.name.charAt(0))}%3C/text%3E%3C/svg%3E'" />` : ''}
                    <span style="font-weight:${isSelf ? '600' : '400'};font-size:0.95rem;">${escHtml(p.name)}${isSelf ? ' (you)' : ''}</span>
                    <span style="font-size:0.8rem;color:var(--text2);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:12px;">${p.tier ? `Tier ${p.tier}` : 'Player'}</span>
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.online !== false ? 'var(--green)' : 'var(--text3)'};margin-left:auto;" title="${p.online !== false ? 'Online' : 'Offline'}"></span>
                </div>
            `;
        }
        setHtml(presenceList, html);
    });
}

// ============================================================
// Voice Clients (reactive)
// ============================================================
let voiceUnsubscribe = null;

export function renderVoiceClients() {
    if (!currentContainer) return;
    const listEl = currentContainer.querySelector('#voice-clients-list');
    const countEl = currentContainer.querySelector('#voice-clients-count');
    if (!listEl || !countEl) return;

    if (voiceUnsubscribe) voiceUnsubscribe();
    voiceUnsubscribe = vttStore.subscribe('voiceClients', (clients) => {
        countEl.textContent = `${clients.length} voice user${clients.length !== 1 ? 's' : ''}`;
        if (!clients || clients.length === 0) {
            setHtml(listEl, `<span style="color:var(--text3);font-size:0.85rem;">No other voice clients.</span>`);
            return;
        }
        let html = '';
        for (const client of clients) {
            const isSpeaking = client.speaking ? 'var(--gold)' : 'var(--bg3)';
            const state = client.connectionState || 'idle';
            let statusLabel = '';
            let statusColor = 'var(--text3)';
            let callButton = '';
            switch (state) {
                case 'connected':
                    statusLabel = '🔗 Connected';
                    statusColor = 'var(--green)';
                    break;
                case 'connecting':
                    statusLabel = '⏳ Connecting...';
                    statusColor = 'var(--gold)';
                    break;
                case 'failed':
                    statusLabel = '❌ Failed';
                    statusColor = 'var(--red)';
                    break;
                default:
                    statusLabel = '📡 Idle';
                    break;
            }
            if (state !== 'connected' && state !== 'connecting') {
                callButton = `<button class="btn btn-sm btn-primary voice-call-btn" data-client-id="${client.id}" style="font-size:0.7rem;padding:0.1rem 0.6rem;">📞 Call</button>`;
            } else if (state === 'connected') {
                callButton = `<span style="font-size:0.7rem;color:var(--green);">● Live</span>`;
            }
            html += `
                <span class="voice-client-badge" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.8rem;border-radius:20px;background:var(--bg4);font-size:0.85rem;border:1px solid var(--border);">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isSpeaking};transition:background 0.3s;" title="${isSpeaking === 'var(--gold)' ? 'Speaking' : 'Silent'}"></span>
                    <span style="font-weight:500;">${escHtml(client.name)}</span>
                    <span style="font-size:0.7rem;color:${statusColor};">${statusLabel}</span>
                    ${callButton}
                </span>
            `;
        }
        setHtml(listEl, html);

        listEl.querySelectorAll('.voice-call-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const clientId = btn.dataset.clientId;
                const event = new CustomEvent('voice-call-request', { detail: { clientId } });
                document.dispatchEvent(event);
            });
        });
    });
}

// ============================================================
// Message Count (reactive)
// ============================================================
let countUnsubscribe = null;

export function updateMessageCount() {
    if (!currentContainer) return;
    const countEl = currentContainer.querySelector('#message-count');
    if (!countEl) return;

    if (countUnsubscribe) countUnsubscribe();
    countUnsubscribe = vttStore.subscribe('chatMessages', (messages) => {
        const count = messages ? messages.length : 0;
        countEl.textContent = `${count} message${count !== 1 ? 's' : ''}`;
    });
}

// ============================================================
// Chat Recipient Select
// ============================================================
export function populateChatRecipients() {
    const recipientSelect = q('#chatRecipient');
    if (!recipientSelect) return;
    setHtml(recipientSelect, '');
    const options = [{ value: 'all', label: 'All' }, { value: 'gm', label: 'GM' }];
    const chars = vttStore.state.characters || [];
    for (const char of chars) {
        options.push({
            value: char.id || char.name.toLowerCase().replace(/\s+/g, '-'),
            label: char.name || 'Unnamed'
        });
    }
    for (const opt of options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        recipientSelect.appendChild(option);
    }
}

// ============================================================
// Notification sound (helper)
// ============================================================
let notificationAudioCtx = null;

export function playNotificationSound() {
    try {
        if (!notificationAudioCtx) {
            notificationAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const audioCtx = notificationAudioCtx;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
        // The oscillator/gain nodes are cheap and garbage-collected once stopped;
        // only the AudioContext itself needs to be long-lived, so it's reused
        // above instead of creating (and never closing) a new one each time.
    } catch (e) { /* ignore */ }
}

// ============================================================
// RE-EXPORT for convenience
// ============================================================

export { getOutcomeColor, getOutcomeLabel, getOutcomeClass } from '../../core/dice.js';
