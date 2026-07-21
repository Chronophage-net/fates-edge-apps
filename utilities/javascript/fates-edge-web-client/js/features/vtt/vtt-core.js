/**
 * VTT Core – reactive rendering functions
 * Each renderer subscribes to the store and updates its DOM element automatically.
 * Updated for unified WebSocket module with deck and module support.
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

// Sender types (for display)
export const SENDER_TYPES = {
    SYSTEM: 'System',
    ROLL: 'Roll',
    OOC: 'OOC',
    GM: 'GM',
    DECK: 'Deck',
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
// Chat renderer (reactive)
// ============================================================
let chatUnsubscribe = null;

export function renderChat() {
    if (!currentContainer) return;
    const chatContainer = currentContainer.querySelector('#chatMessages');
    if (!chatContainer) return;

    if (chatUnsubscribe) chatUnsubscribe();
    chatUnsubscribe = vttStore.subscribe('chatMessages', (messages) => {
        const allMessages = messages || [];
        const isConnected = isConnectedToServer();
        const roomCode = isConnected ? getRoomCode() : null;
        const mode = getConnectionMode ? getConnectionMode() : 'websocket';

        if (!Array.isArray(allMessages) || allMessages.length === 0) {
            setHtml(chatContainer, `
                <div class="empty-chat-state" style="padding:2rem 1rem;text-align:center;color:var(--text3);">
                    <div style="font-size:2rem;margin-bottom:0.5rem;">💬</div>
                    <div style="font-size:0.85rem;">No messages yet</div>
                    <div style="font-size:0.75rem;margin-top:0.3rem;">
                        ${isConnected ? `🌐 Connected to server${roomCode ? ` (${roomCode})` : ''}` : '📡 Messages stay local'}
                        <span style="color:var(--text4);margin-left:0.3rem;">via ${mode}</span>
                    </div>
                    <div style="font-size:0.7rem;margin-top:0.5rem;color:var(--text4);">
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
                modeBadge = ` <span class="mode-badge local" style="font-size:0.55rem;color:var(--text3);background:var(--bg4);padding:0.05rem 0.4rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--border);">📡 local</span>`;
            } else if (isLocal && isConnected) {
                modeBadge = ` <span class="mode-badge local-ws" style="font-size:0.55rem;color:var(--gold);background:var(--bg4);padding:0.05rem 0.4rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--gold);">📡 local</span>`;
            } else if (!isLocal && isConnected) {
                modeBadge = ` <span class="mode-badge synced" style="font-size:0.55rem;color:var(--green);background:var(--bg4);padding:0.05rem 0.4rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--green);">🌐 synced</span>`;
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
                <div class="chat-message" data-msg-id="${msg.id || ''}" style="padding:0.3rem 0.5rem;border-bottom:1px solid var(--border);font-size:0.85rem;transition:background 0.2s;">
                    <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                        <span style="color:var(--text2);font-size:0.7rem;">${escHtml(time)}</span>
                        <strong style="color:${senderColor};">${escHtml(sender)}${recipient}:</strong>
                        <span style="word-break:break-word;">${whisper}${sender === 'GM' ? text : escHtml(String(text))}</span>                        ${modeBadge}
                        <span class="msg-status" style="font-size:0.6rem;color:${statusColor};margin-left:auto;" title="${statusTitle}">${statusIcon}</span>
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
        return `<span style="display:inline-block;padding:0.05rem 0.3rem;margin:0.05rem;border-radius:3px;background:${bgColor};color:${textColor};font-size:0.7rem;">${label}</span>`;
    }).join(' ');
    
    const outcomeColor = getOutcomeColor(rollData.outcome || '');
    const outcomeLabel = getOutcomeLabel(rollData.outcome || '');
    const outcomeClass = getOutcomeClass(rollData.outcome || '');
    
    return `
        <div style="margin-top:0.2rem;padding:0.2rem 0.4rem;background:var(--bg2);border-radius:4px;font-size:0.7rem;">
            <div style="display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;">
                <span class="outcome-tag ${outcomeClass}" style="padding:0.05rem 0.6rem;border-radius:12px;font-weight:600;background:${outcomeColor};color:white;">${outcomeLabel}</span>
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
        <div style="margin-top:0.2rem;padding:0.2rem 0.4rem;background:var(--bg2);border-radius:4px;font-size:0.7rem;color:var(--text3);">
            <span>🃏 ${cardNames}</span>
            ${deckData.remaining !== undefined ? `<span style="margin-left:0.5rem;">Remaining: ${deckData.remaining}</span>` : ''}
        </div>
    `;
}

// ============================================================
// Party Status Grid (reactive)
// ============================================================
let charUnsubscribe = null;

export function renderVTTChars() {
    if (!currentContainer) return;
    const grid = currentContainer.querySelector('#vttCharGrid');
    if (!grid) return;

    if (charUnsubscribe) charUnsubscribe();
    charUnsubscribe = vttStore.subscribe('characters', (chars) => {
        const vttChars = chars.filter(c => c.vtt !== false);
        if (vttChars.length === 0) {
            setHtml(grid, `<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text3);font-size:0.85rem;">👤 No VTT characters</div>`);
            return;
        }
        let html = '';
        for (const char of vttChars) {
            const name = char.name || 'Unnamed';
            const harm = char.harm || 0;
            const fatigue = char.fatigue || 0;
            const boons = char.boons || 0;
            const tier = char.tier || 1;
            const isActive = char.active !== false;
            html += `
                <div class="vtt-char-card" style="background:var(--bg3);border-radius:var(--radius);padding:0.4rem 0.6rem;border-left:3px solid ${isActive ? 'var(--gold)' : 'var(--text3)'};transition:all 0.2s;${isActive ? '' : 'opacity:0.6;'}">
                    <div style="font-weight:600;font-size:0.9rem;display:flex;align-items:center;gap:0.3rem;">
                        ${isActive ? '🟢' : '⏸️'}
                        ${escHtml(name)}
                        <span style="font-size:0.6rem;color:var(--text3);background:var(--bg4);padding:0.05rem 0.4rem;border-radius:10px;">T${tier}</span>
                    </div>
                    <div style="display:flex;gap:0.8rem;font-size:0.7rem;color:var(--text2);margin-top:0.15rem;">
                        <span>❤️ ${harm}</span>
                        <span>⚡ ${fatigue}</span>
                        <span>🎲 ${boons}</span>
                    </div>
                </div>
            `;
        }
        setHtml(grid, html);
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
            setHtml(list, `<div class="empty-state" style="text-align:center;padding:0.5rem;color:var(--text3);font-size:0.8rem;">⏱️ No active timers</div>`);
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
                <div class="vtt-timer" style="margin-bottom:0.3rem;background:var(--bg3);border-radius:4px;padding:0.3rem 0.5rem;${isComplete ? 'border:1px solid var(--red);' : ''}">
                    <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
                        <span>${escHtml(name)}</span>
                        <span>${current}/${segments} ${isComplete ? '✅' : ''}</span>
                    </div>
                    <div style="width:100%;height:4px;background:var(--bg4);border-radius:2px;margin-top:2px;overflow:hidden;">
                        <div style="width:${progress}%;height:100%;background:${isComplete ? 'var(--red)' : 'var(--gold)'};border-radius:2px;transition:width 0.3s;"></div>
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
                <div style="color:var(--text3);padding:0.3rem 0;font-size:0.8rem;">
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
                <div class="presence-item" style="display:flex;align-items:center;gap:0.5rem;padding:0.2rem 0;border-bottom:1px solid var(--border);${isSelf ? 'background:var(--bg4);border-radius:4px;padding:0.2rem 0.4rem;' : ''}">
                    ${showAvatars ? `<img src="${avatarUrl}" alt="${p.name}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 32 32%22%3E%3Crect fill=%22%232c3e50%22 width=%2232%22 height=%2232%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23fff%22 font-family=%22Arial%22 font-size=%2214%22%3E${encodeURIComponent(p.name.charAt(0))}%3C/text%3E%3C/svg%3E'" />` : ''}
                    <span style="font-weight:${isSelf ? '600' : '400'};">${escHtml(p.name)}${isSelf ? ' (you)' : ''}</span>
                    <span style="font-size:0.7rem;color:var(--text2);background:var(--bg4);padding:0.05rem 0.4rem;border-radius:12px;">${p.tier ? `Tier ${p.tier}` : 'Player'}</span>
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.online !== false ? 'var(--green)' : 'var(--text3)'};margin-left:auto;" title="${p.online !== false ? 'Online' : 'Offline'}"></span>
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
            setHtml(listEl, `<span style="color:var(--text3);font-size:0.75rem;">No other voice clients.</span>`);
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
                callButton = `<button class="btn btn-sm btn-primary voice-call-btn" data-client-id="${client.id}" style="font-size:0.6rem;padding:0.1rem 0.5rem;">📞 Call</button>`;
            } else if (state === 'connected') {
                callButton = `<span style="font-size:0.6rem;color:var(--green);">● Live</span>`;
            }
            html += `
                <span class="voice-client-badge" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.2rem 0.6rem;border-radius:12px;background:var(--bg4);font-size:0.7rem;border:1px solid var(--border);">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isSpeaking};transition:background 0.3s;" title="${isSpeaking === 'var(--gold)' ? 'Speaking' : 'Silent'}"></span>
                    <span>${escHtml(client.name)}</span>
                    <span style="font-size:0.6rem;color:${statusColor};">${statusLabel}</span>
                    ${callButton}
                </span>
            `;
        }
        setHtml(listEl, html);

        // Attach click events for call buttons (dispatched as custom event)
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
// Chat Recipient Select (manual update – could be made reactive)
// ============================================================
export function populateChatRecipients() {
    const recipientSelect = q('#chatRecipient');
    if (!recipientSelect) return;
    // We'll just populate it once; it can be updated when characters change if needed
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
export function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) { /* ignore */ }
}

// ============================================================
// RE-EXPORT for convenience
// ============================================================

// Re-export these so they can be imported from vtt-core
export { getOutcomeColor, getOutcomeLabel, getOutcomeClass } from '../../core/dice.js';