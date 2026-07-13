/**
 * VTT Connected Mode – WebSocket sync, real‑time collaboration
 * Uses reactive store for all UI updates.
 */

import { vttStore } from '../../core/vtt-store.js';
import { getState, clearChatHistory, getCharacter } from '../../core/state.js';
import { performRoll } from '../../core/dice.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';
import {
    isConnectedToServer,
    syncState,
    sendChatMessage,
    sendRoll,
    onEvent,
    offEvent,
    getRoomCode,
    getSocketId
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
    getOutcomeColor
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
let isDestroyed = false;
let reconnectTimer = null;
let voiceUnsubscribe = null;
let presenceInterval = null;

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

    // Add to store – UI updates automatically via subscription
    vttStore.addChatMessage(msg);

    if (isConnected) {
        try {
            sendChatMessage(msg);
            // We'll update the status icon later via a timeout (optional)
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
            // Update the message in store to mark as failed? We'll just update the DOM directly.
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
// ROLL (with WebSocket broadcast)
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
        let html = `
            <span class="outcome-tag ${result.outcomeClass}" style="display:inline-block;padding:0.15rem 0.8rem;border-radius:20px;font-weight:600;font-size:0.8rem;margin-right:0.4rem;background:${getOutcomeColor(result.outcome)};">
                ${result.outcome}
            </span>
        `;
        const diceHtml = result.dice.map(die => {
            let bgColor = 'var(--bg4)', textColor = 'var(--text)', label = die;
            if (die === 10) { bgColor = 'var(--green)'; textColor = 'white'; label = '10'; }
            else if (die >= 6) { bgColor = 'var(--green)'; textColor = 'white'; }
            else if (die === 1) { bgColor = 'var(--red)'; textColor = 'white'; label = '1⚠️'; }
            return `<span style="display:inline-block;padding:0.1rem 0.4rem;margin:0.1rem;border-radius:4px;background:${bgColor};color:${textColor};">${label}</span>`;
        }).join(' ');
        html += `<div style="margin:0.3rem 0;">${diceHtml}</div>`;
        html += `<div style="font-size:0.75rem;color:var(--text2);">Successes: <strong style="color:var(--green);">${result.successes}</strong> | Story Beats: <strong style="color:var(--red);">${result.storyBeats}</strong>${result.reRolls > 0 ? `| Re-rolls: ${result.reRolls}` : ''}</div>`;
        out.innerHTML = html;
    }

    const postCheckbox = q('#vtt-post-chat');
    const shouldPost = postToChat && postCheckbox?.checked;
    if (shouldPost) {
        const state = getState();
        const characters = state.characters || [];
        const activeChar = characters.find(c => c.active !== false) || characters[0];
        const sender = activeChar?.name || 'GM';

        let msg = `[${result.outcome}] ${attr}+${skill} vs DV${dv} (${pos}) → `;
        msg += result.dice.join(' ');
        msg += ` | S:${result.successes} SB:${result.storyBeats}`;
        if (result.reRolls > 0) {
            msg += ` | Re-rolls: ${result.reRolledDice.map(r => `${r.old}→${r.new}`).join(', ')}`;
        }
        msg += ` — ${result.resultText}`;

        // Send via store (triggers UI update) and also via WebSocket
        sendMessage(msg, 'Roll', 'all', {
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
// SLASH COMMANDS (with WebSocket awareness)
// ============================================================

function handleSlash(text) {
    const parts = text.slice(1).trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const state = getState();
    const characters = state.characters || [];
    const activeChar = characters.find(c => c.active !== false) || characters[0];
    const sender = activeChar?.name || 'GM';

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
            sendMessage(msg, 'Roll', 'all', {
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
                // Update store with new timers
                vttStore.updateTimers(state.timers || []);
                if (isConnectedToServer()) {
                    syncState(getState());
                }
            }).catch(err => {
                showToast('Failed to create timer', 'error');
            });
            break;
        }
        case 'help': {
            const room = getRoomCode() || 'none';
            const mode = isConnectedToServer() ? '🌐 Connected' : '📡 Local';
            const helpText = [
                '📖 Commands:',
                '/roll attr skill dv [pos] [boons] [note] - Make a roll',
                '/timer name segments - Create a timer',
                '/ooc text - Send out-of-character message',
                '/status - Show party status',
                '/clear - Clear chat',
                `/help - Show this help`,
                `Mode: ${mode} | Room: ${room}`
            ].join('\n');
            sendMessage(helpText, 'System', 'all');
            break;
        }
        case 'ooc': {
            sendMessage(parts.slice(1).join(' '), 'OOC', 'all');
            break;
        }
        case 'status': {
            const chars = state.characters.filter(c => c.vtt);
            const isConnected = isConnectedToServer();
            const room = getRoomCode() || 'none';
            const mode = isConnected ? '🌐 Connected' : '📡 Local';
            if (chars.length === 0) {
                sendMessage(`📊 Mode: ${mode} | Room: ${room} | No VTT characters.`, 'System', 'all');
            } else {
                const status = chars.map(c => `${c.name}: ❤️${c.harm || 0} ⚡${c.fatigue || 0} 🎲${c.boons || 0}`).join(' | ');
                sendMessage(`📊 ${status} | Mode: ${mode} | Room: ${room}`, 'System', 'all');
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
// WEBSOCKET SYNC SETUP
// ============================================================

function setupWebSocketSync() {
    if (!isConnectedToServer() || isDestroyed) return;

    cleanupWebSocketListeners();

    // Push current state to server
    const state = getState();
    syncState(state);
    // Also update store with legacy state
    vttStore.updateCharacters(state.characters || []);
    vttStore.updateTimers(state.timers || []);

    // Listen for state updates from server
    const stateHandler = (data) => {
        if (isDestroyed) return;
        // Update store with incoming data
        vttStore.setState({
            characters: data.characters || [],
            timers: data.timers || [],
            // other fields as needed
        });
        // Optionally also sync legacy state
        // We could keep both in sync, but store is source of truth for UI
    };
    onEvent('state-updated', stateHandler);
    wsListeners.set('state-updated', stateHandler);

    // Incoming chat message
    const chatHandler = (message) => {
        if (isDestroyed) return;
        vttStore.addChatMessage({
            ...message,
            local: false,
            sent: true
        });
        if (message.sender !== 'GM' && message.sender !== 'System') {
            playNotificationSound();
        }
    };
    onEvent('chat-message', chatHandler);
    wsListeners.set('chat-message', chatHandler);

    // Incoming roll result (toast only)
    const rollHandler = (rollData) => {
        if (isDestroyed) return;
        showToast(`🎲 ${rollData.sender || 'Player'} rolled ${rollData.outcome}`, 'info');
        // The roll message was already sent via chat, so no need to add again
    };
    onEvent('roll-result', rollHandler);
    wsListeners.set('roll-result', rollHandler);

    // Reconnection events
    const connectHandler = () => {
        if (isDestroyed) return;
        const state = getState();
        syncState(state);
        vttStore.updateCharacters(state.characters || []);
        vttStore.updateTimers(state.timers || []);
        vttStore.setConnectionStatus('connected');
        showToast('Reconnected to server!', 'success');
        // Update UI badges via store? We'll handle in render.
    };
    onEvent('connected', connectHandler);
    wsListeners.set('connected', connectHandler);

    const disconnectHandler = () => {
        if (isDestroyed) return;
        vttStore.setConnectionStatus('local');
        showToast('Disconnected from server. Messages will be local.', 'warning');
        // Update UI badges via store
    };
    onEvent('disconnected', disconnectHandler);
    wsListeners.set('disconnected', disconnectHandler);

    console.log('[VTT Connected] WebSocket sync enabled');
}

function cleanupWebSocketListeners() {
    for (const [event, handler] of wsListeners) {
        try {
            offEvent(event, handler);
        } catch (e) {
            console.debug('[VTT Connected] Error removing listener:', e);
        }
    }
    wsListeners.clear();
}

// ============================================================
// VOICE (WebSocket signaling + UI) – uses store for client list
// ============================================================

async function toggleVoice() {
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
        // Clear voice clients from store
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
    // UI updates via store (voice client state changes will be pushed by voice.js)
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
    const state = getState();
    const characters = state.characters || [];
    const activeChar = characters.find(c => c.active !== false) || characters[0];
    const sender = activeChar?.name || 'Player';
    sendMessage(text, sender, recipient.value);
    input.value = '';
    input.focus();
}

function attachEvents() {
    if (isDestroyed) return;
    // Remove old listeners
    eventListeners.forEach(({event, handler}) => {
        container.removeEventListener(event, handler);
    });
    eventListeners = [];

    const clickHandler = (e) => {
        const target = e.target.closest('button, .btn, [id]');
        if (!target) return;
        const id = target.id;
        switch (id) {
            case 'chat-send-btn': e.preventDefault(); handleSendMessage(); break;
            case 'vtt-clear-chat': clearChatHistory?.(); vttStore.clearChat(); showToast('Chat cleared.', 'success'); break;
            case 'vtt-refresh-btn': {
                // Refresh from legacy state
                const state = getState();
                vttStore.updateCharacters(state.characters || []);
                vttStore.updateTimers(state.timers || []);
                populateChatRecipients();
                showToast('VTT refreshed.', 'info');
                break;
            }
            case 'vtt-roll-post-btn': rollConnected(true); break;
            case 'vtt-roll-only-btn': rollConnected(false); break;
            case 'vtt-add-timer': import('../timers/index.js').then(m => m.openTimerEditor?.()).catch(() => showToast('Timer feature not available', 'error')); break;
            case 'vtt-scene-end': {
                import('../dashboard/scene-tools.js').then(m => {
                    m.sceneEndTrimBoons?.();
                    // Update store with refreshed characters
                    const state = getState();
                    vttStore.updateCharacters(state.characters || []);
                    if (isConnectedToServer()) syncState(state);
                    showToast('Scene ended, boons trimmed.', 'info');
                }).catch(() => showToast('Scene end feature not available', 'error'));
                break;
            }
            case 'vtt-voice-toggle': toggleVoice(); break;
            case 'vtt-mute-toggle': toggleMuteVoice(); break;
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
        { event: 'keydown', handler: keydownHandler },
        { event: 'change', handler: changeHandler }
    ];
    eventListeners.forEach(({event, handler}) => {
        container.addEventListener(event, handler);
    });

    // Also listen for custom voice call requests from renderVoiceClients
    const voiceCallHandler = (e) => {
        if (e.detail?.clientId) {
            callVoiceClient(e.detail.clientId);
        }
    };
    document.addEventListener('voice-call-request', voiceCallHandler);
    eventListeners.push({ event: 'voice-call-request', handler: voiceCallHandler });
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
    const voiceStatus = getVoiceStatus();
    const voiceClients = getActiveVoiceClients();

    // Build HTML (same as before)
    el.innerHTML = `
        <div class="vtt-header" style="margin-bottom:1rem;">
            <h1 class="page-title" style="display:flex;align-items:center;gap:0.5rem;">
                💬 VTT – Live Table
                <span class="mode-indicator" style="font-size:0.7rem;font-weight:400;background:var(--bg3);padding:0.15rem 0.8rem;border-radius:20px;color:var(--green);">🌐 Connected</span>
            </h1>
            <p class="page-sub" style="margin:0.2rem 0 0;">Chat, party status, quick die roller, and scene timers all in one view.</p>
        </div>

        <!-- Connection & Voice Status Panel -->
        <div class="panel" style="padding:0.5rem 1rem;margin-bottom:1rem;">
            <div class="flex-between" style="flex-wrap:wrap;gap:0.5rem;">
                <div class="flex" style="gap:0.5rem;flex-wrap:wrap;align-items:center;">
                    <span class="connection-status" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--green);"></span>
                    <span class="text-muted small">🟢 Connected to server</span>
                    ${roomCode ? `<span class="text-muted small">🔑 Room: <strong>${roomCode}</strong></span>` : ''}
                    ${socketId ? `<span class="text-muted small">👤 ${socketId.slice(0, 8)}</span>` : ''}
                </div>
                <div class="flex" style="gap:0.4rem;flex-wrap:wrap;align-items:center;">
                    <button class="btn btn-sm ${voiceInitialized ? 'btn-primary' : ''}" id="vtt-voice-toggle">${voiceInitialized ? '🎤 Voice On' : '🎤 Voice Off'}</button>
                    ${voiceInitialized ? `<button class="btn btn-sm ${voiceStatus?.muted ? 'btn-danger' : 'btn-green'}" id="vtt-mute-toggle">${voiceStatus?.muted ? '🔇 Muted' : '🎙️ Live'}</button>` : ''}
                    <span class="text-muted small" id="voice-clients-count">${voiceClients.length} voice users</span>
                </div>
            </div>
            <!-- Voice activity bar (local microphone) -->
            <div style="margin-top:0.4rem;display:flex;align-items:center;gap:0.5rem;">
                <span style="font-size:0.7rem;color:var(--text3);">🎤</span>
                <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
                    <div id="voice-activity-bar" style="width:0%;height:100%;background:var(--bg4);border-radius:2px;transition:width 0.1s;"></div>
                </div>
                <span style="font-size:0.6rem;color:var(--text3);" id="voice-activity-label">idle</span>
            </div>
            <!-- Voice clients list -->
            <div id="voice-clients-list" style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid var(--border);">
                ${voiceClients.length === 0 ? '<span style="color:var(--text3);font-size:0.75rem;">No other voice clients.</span>' : ''}
            </div>
            <div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid var(--border);">
                <div class="flex-between">
                    <span class="text-muted small">👥 Party Members</span>
                    <span class="text-muted small" id="vtt-mode-badge" style="background:var(--bg3);padding:0.1rem 0.6rem;border-radius:12px;font-size:0.7rem;">🌐 Online</span>
                </div>
                <div id="presence-list" style="margin-top:0.2rem;"></div>
            </div>
        </div>

        <!-- Main VTT layout -->
        <div class="vtt-container" style="display:grid;grid-template-columns:2fr 1fr;gap:1.2rem;">
            <div class="chat-box" style="background:var(--bg3);border-radius:var(--radius);padding:0.6rem;display:flex;flex-direction:column;min-height:450px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
                    <h3 style="margin:0;">💬 Chat</h3>
                    <div style="display:flex;gap:0.3rem;align-items:center;font-size:0.7rem;">
                        <span class="text-muted" id="message-count">0 messages</span>
                        <button class="btn btn-sm btn-ghost" id="vtt-clear-chat" title="Clear chat">🗑️</button>
                    </div>
                </div>
                <div class="chat-messages" id="chatMessages" style="flex:1;overflow-y:auto;padding:0.4rem;background:var(--bg2);border-radius:var(--radius);margin-bottom:0.4rem;font-size:0.9rem;display:flex;flex-direction:column;max-height:400px;min-height:200px;"></div>
                <div class="chat-input-row" style="display:flex;gap:0.4rem;">
                    <input type="text" id="chatInput" placeholder="Type… (/roll, /timer, /help)" style="flex:1;" />
                    <select id="chatRecipient" style="flex:0 0 120px;">
                        <option value="all">All</option>
                    </select>
                    <button class="btn btn-gold" id="chat-send-btn">Send</button>
                </div>
                <div class="flex mt-1" style="flex-wrap:wrap;gap:0.5rem;font-size:0.8rem;">
                    <label class="inline-check"><input type="checkbox" id="vtt-post-chat" checked /> Post rolls to chat</label>
                    <label class="inline-check"><input type="checkbox" id="vtt-auto-scroll" checked /> Auto-scroll</label>
                </div>
            </div>
            <div class="vtt-sidebar" style="display:flex;flex-direction:column;gap:1.2rem;">
                <div class="vtt-panel" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <h3 style="margin:0;">👥 Party Status</h3>
                        <button class="btn btn-sm btn-ghost" id="vtt-refresh-btn" title="Refresh">↻</button>
                    </div>
                    <div class="character-status-grid" id="vttCharGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-top:0.5rem;"></div>
                </div>
                <div class="vtt-panel" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;">
                    <h3 style="margin-top:0;">🎲 Quick Roller</h3>
                    <div class="vtt-dice-row" style="display:flex;flex-wrap:wrap;gap:0.4rem;">
                        <div class="field" style="flex:1;min-width:60px;"><label>Attr</label><select id="vtt-attr"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option></select></div>
                        <div class="field" style="flex:1;min-width:60px;"><label>Skill</label><select id="vtt-skill"><option value="0">0</option><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></div>
                        <div class="field" style="flex:0 0 70px;"><label>DV</label><select id="vtt-dv"><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5+</option></select></div>
                        <div class="field" style="flex:0 0 80px;"><label>Pos</label><select id="vtt-pos"><option value="dominant">Dom</option><option value="controlled" selected>Ctrl</option><option value="desperate">Desp</option></select></div>
                        <div class="field" style="flex:0 0 60px;"><label>Boons</label><input type="number" id="vtt-boons" value="0" min="0" max="5" /></div>
                    </div>
                    <div class="flex" style="gap:0.4rem;margin-top:0.4rem;">
                        <button class="btn btn-gold btn-sm" id="vtt-roll-post-btn">Roll &amp; Post</button>
                        <button class="btn btn-sm" id="vtt-roll-only-btn">Roll Only</button>
                    </div>
                    <div id="vtt-roll-output" class="mt-1" style="font-size:0.85rem;min-height:2rem;"></div>
                </div>
                <div class="vtt-panel" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;">
                    <h3 style="margin-top:0;">⏱️ Scene Timers</h3>
                    <div id="vttTimerList"></div>
                    <div style="display:flex;gap:0.4rem;margin-top:0.5rem;">
                        <button class="btn btn-sm" id="vtt-add-timer">+ Add Timer</button>
                        <button class="btn btn-sm" id="vtt-scene-end">🌅 Scene End</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize reactive renderers (they attach subscriptions)
    renderChat();
    renderVTTChars();
    renderVTTTimers();
    renderLocalPresence();
    renderVoiceClients();
    updateMessageCount();
    populateChatRecipients();

    // Set initial connection status in store
    vttStore.setConnectionStatus(isConnected ? 'connected' : 'local');

    // Register voice client callback to update store
    if (voiceUnsubscribe) voiceUnsubscribe();
    voiceUnsubscribe = onVoiceClientsChanged((clients) => {
        vttStore.updateVoiceClients(clients);
    });

    // Setup WebSocket sync
    setupWebSocketSync();

    // Attach DOM events
    attachEvents();

    // Start presence update interval (keeps characters in sync with legacy state)
    if (presenceInterval) clearInterval(presenceInterval);
    presenceInterval = setInterval(() => {
        if (isDestroyed || !container) {
            clearInterval(presenceInterval);
            presenceInterval = null;
            return;
        }
        // Sync legacy state to store
        const state = getState();
        vttStore.updateCharacters(state.characters || []);
        vttStore.updateTimers(state.timers || []);
    }, VTT_CONFIG.presenceUpdateInterval);

    console.log('[VTT Connected] Rendered with reactive store');
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
    if (container) {
        eventListeners.forEach(({event, handler}) => {
            container.removeEventListener(event, handler);
        });
        eventListeners = [];
        container.innerHTML = '';
        setContainer(null);
        container = null;
    }
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
};