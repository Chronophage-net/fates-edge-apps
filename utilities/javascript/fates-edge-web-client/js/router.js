/**
 * VTT Local Module
 * Local Virtual Tabletop functionality
 */

import { vttStore } from '../../core/vtt-store.js';
import { 
    escHtml, 
    getStorage, 
    setStorage, 
    createElement,
    setHtml,
    getState,
    updateState
} from '../../core/utils.js';
import { 
    getOutcomeColor, 
    getOutcomeLabel, 
    getOutcomeClass 
} from '../../core/dice.js';
import { 
    renderChat, 
    renderVTTChars, 
    renderVTTTimers, 
    renderLocalPresence, 
    renderVoiceClients,
    updateMessageCount,
    populateChatRecipients,
    setContainer,
    VTT_CONFIG,
    SENDER_TYPES,
    q,
    qa
} from './vtt-core.js';
import { isConnectedToServer, sendMessage, onEvent } from '../../core/websocket.js';
import { showToast } from '../../components/Toast.js';

// ============================================================
// State
// ============================================================

let container = null;
let isInitialized = false;
let voiceClients = [];
let localStream = null;
let peerConnections = new Map();

// ============================================================
// Render
// ============================================================

export function render(el) {
    container = el;
    setContainer(el);
    
    // Build VTT UI
    el.innerHTML = `
        <div class="vtt-container" style="display:flex;flex-direction:column;height:100%;gap:0.5rem;padding:0.5rem;">
            <!-- Header -->
            <div class="vtt-header" style="display:flex;justify-content:space-between;align-items:center;padding:0.25rem 0.5rem;background:var(--bg2);border-radius:var(--radius);">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span style="font-weight:600;font-size:0.9rem;">🎲 Virtual Tabletop</span>
                    <span id="connection-status" style="font-size:0.7rem;padding:0.05rem 0.5rem;border-radius:12px;background:var(--bg3);color:var(--text3);">📡 Local</span>
                    <span id="message-count" style="font-size:0.7rem;color:var(--text3);">0 messages</span>
                </div>
                <div style="display:flex;gap:0.3rem;">
                    <button class="btn btn-sm btn-secondary" id="vtt-sync-btn" style="font-size:0.7rem;padding:0.1rem 0.5rem;">🔄 Sync</button>
                    <button class="btn btn-sm btn-secondary" id="vtt-clear-chat" style="font-size:0.7rem;padding:0.1rem 0.5rem;">🗑️ Clear</button>
                </div>
            </div>
            
            <!-- Main Grid -->
            <div class="vtt-grid" style="display:grid;grid-template-columns:1fr 300px;gap:0.5rem;flex:1;min-height:0;">
                <!-- Left: Chat -->
                <div class="vtt-chat-panel" style="display:flex;flex-direction:column;background:var(--bg2);border-radius:var(--radius);overflow:hidden;min-height:0;">
                    <div class="vtt-chat-messages" id="chatMessages" style="flex:1;overflow-y:auto;padding:0.3rem;min-height:0;max-height:400px;"></div>
                    <div class="vtt-chat-input" style="display:flex;gap:0.3rem;padding:0.3rem;border-top:1px solid var(--border);flex-shrink:0;">
                        <select id="chatRecipient" style="font-size:0.7rem;padding:0.2rem 0.3rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);">
                            <option value="all">All</option>
                            <option value="gm">GM</option>
                        </select>
                        <input type="text" id="chatInput" placeholder="Type a message... /roll 2d6" style="flex:1;font-size:0.8rem;padding:0.2rem 0.5rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);">
                        <button class="btn btn-sm btn-primary" id="chatSendBtn" style="font-size:0.7rem;padding:0.1rem 0.5rem;">Send</button>
                    </div>
                </div>
                
                <!-- Right: Sidebar -->
                <div class="vtt-sidebar" style="display:flex;flex-direction:column;gap:0.5rem;overflow-y:auto;min-height:0;">
                    <!-- Characters -->
                    <div class="vtt-char-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem;">
                        <div style="font-weight:600;font-size:0.8rem;margin-bottom:0.2rem;">👤 Party</div>
                        <div id="vttCharGrid" style="display:grid;grid-template-columns:1fr;gap:0.2rem;max-height:150px;overflow-y:auto;"></div>
                    </div>
                    
                    <!-- Presence -->
                    <div class="vtt-presence-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem;">
                        <div style="font-weight:600;font-size:0.8rem;margin-bottom:0.2rem;">👥 Presence</div>
                        <div id="presence-list" style="max-height:100px;overflow-y:auto;"></div>
                    </div>
                    
                    <!-- Timers -->
                    <div class="vtt-timers-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem;">
                        <div style="font-weight:600;font-size:0.8rem;margin-bottom:0.2rem;">⏱️ Timers</div>
                        <div id="vttTimerList" style="max-height:80px;overflow-y:auto;"></div>
                    </div>
                    
                    <!-- Voice -->
                    <div class="vtt-voice-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-weight:600;font-size:0.8rem;">🎙️ Voice</span>
                            <span id="voice-clients-count" style="font-size:0.7rem;color:var(--text3);">0 users</span>
                        </div>
                        <div id="voice-clients-list" style="display:flex;flex-wrap:wrap;gap:0.2rem;padding:0.2rem 0;max-height:60px;overflow-y:auto;"></div>
                        <div style="display:flex;gap:0.3rem;margin-top:0.2rem;">
                            <button class="btn btn-sm btn-secondary" id="voice-join-btn" style="font-size:0.6rem;padding:0.05rem 0.4rem;">🎤 Join</button>
                            <button class="btn btn-sm btn-secondary" id="voice-leave-btn" style="font-size:0.6rem;padding:0.05rem 0.4rem;">🔇 Leave</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Set container for query helpers
    setContainer(el);
    
    // Initialize renderers
    renderChat();
    renderVTTChars();
    renderVTTTimers();
    renderLocalPresence();
    renderVoiceClients();
    updateMessageCount();
    populateChatRecipients();
    
    // Setup event listeners
    attachEvents();
    
    // Update connection status
    updateConnectionStatus();
    
    isInitialized = true;
}

// ============================================================
// Event Handlers
// ============================================================

export function attachEvents() {
    if (!container) return;
    
    // Chat send
    const sendBtn = q('#chatSendBtn');
    const chatInput = q('#chatInput');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', () => handleChatSend());
    }
    
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleChatSend();
            }
        });
    }
    
    // Sync button
    const syncBtn = q('#vtt-sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            const state = getState();
            const message = { type: 'sync', state, timestamp: Date.now() };
            sendMessage(message);
            showToast('Syncing state...', 'info');
        });
    }
    
    // Clear chat button
    const clearBtn = q('#vtt-clear-chat');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all chat messages?')) {
                vttStore.update({ chatMessages: [] });
                showToast('Chat cleared', 'info');
            }
        });
    }
    
    // Voice join
    const joinBtn = q('#voice-join-btn');
    if (joinBtn) {
        joinBtn.addEventListener('click', () => {
            joinVoice();
        });
    }
    
    // Voice leave
    const leaveBtn = q('#voice-leave-btn');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
            leaveVoice();
        });
    }
    
    // Listen for WebSocket events
    onEvent('chat-message', (data) => {
        handleIncomingChat(data);
    });
    
    onEvent('roll-result', (data) => {
        handleIncomingRoll(data);
    });
    
    onEvent('state-updated', (data) => {
        if (data.state) {
            updateState(data.state);
            showToast('State synced from server', 'success');
        }
    });
    
    // Voice events
    onEvent('voice-offer', (data) => {
        handleVoiceOffer(data);
    });
    
    onEvent('voice-answer', (data) => {
        handleVoiceAnswer(data);
    });
    
    onEvent('voice-ice-candidate', (data) => {
        handleVoiceICECandidate(data);
    });
    
    // Voice call request from vtt-core
    document.addEventListener('voice-call-request', (e) => {
        const { clientId } = e.detail;
        initiateVoiceCall(clientId);
    });
}

// ============================================================
// Chat Functions
// ============================================================

function handleChatSend() {
    const input = q('#chatInput');
    const recipientSelect = q('#chatRecipient');
    
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    
    const recipient = recipientSelect ? recipientSelect.value : 'all';
    
    // Check for roll command
    if (text.startsWith('/roll')) {
        const rollExpr = text.slice(6).trim();
        if (rollExpr) {
            handleRollCommand(rollExpr, recipient);
        }
        input.value = '';
        return;
    }
    
    // Check for other commands
    if (text.startsWith('/')) {
        handleCommand(text, recipient);
        input.value = '';
        return;
    }
    
    // Normal chat message
    const message = {
        id: 'msg_' + Date.now(),
        sender: 'You',
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recipient: recipient,
        local: !isConnectedToServer(),
        timestamp: Date.now()
    };
    
    // Add to store
    const messages = vttStore.state.chatMessages || [];
    vttStore.update({ chatMessages: [message, ...messages] });
    
    // Send via WebSocket if connected
    if (isConnectedToServer()) {
        sendMessage({ type: 'chat', ...message });
    }
    
    input.value = '';
    input.focus();
}

function handleRollCommand(rollExpr, recipient) {
    try {
        // Parse roll expression (e.g., "2d6+2")
        const rollResult = performRoll(rollExpr);
        
        if (rollResult) {
            const message = {
                id: 'roll_' + Date.now(),
                sender: 'Roll',
                text: `🎲 ${rollExpr} = ${rollResult.total}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                recipient: recipient,
                local: !isConnectedToServer(),
                timestamp: Date.now(),
                rollData: rollResult
            };
            
            const messages = vttStore.state.chatMessages || [];
            vttStore.update({ chatMessages: [message, ...messages] });
            
            if (isConnectedToServer()) {
                sendMessage({ type: 'roll', ...message });
            }
        }
    } catch (err) {
        showToast(`Roll error: ${err.message}`, 'error');
    }
}

function handleCommand(text, recipient) {
    const parts = text.slice(1).split(' ');
    const cmd = parts[0].toLowerCase();
    
    switch (cmd) {
        case 'help':
            showHelpMessage(recipient);
            break;
        case 'clear':
            vttStore.update({ chatMessages: [] });
            showToast('Chat cleared', 'info');
            break;
        case 'status':
            showStatusMessage(recipient);
            break;
        default:
            showToast(`Unknown command: ${cmd}. Type /help for commands.`, 'warning');
    }
}

function showHelpMessage(recipient) {
    const helpText = `📖 Commands: /roll 2d6+2, /help, /clear, /status`;
    const message = {
        id: 'help_' + Date.now(),
        sender: 'System',
        text: helpText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recipient: recipient,
        local: true,
        timestamp: Date.now()
    };
    const messages = vttStore.state.chatMessages || [];
    vttStore.update({ chatMessages: [message, ...messages] });
}

function showStatusMessage(recipient) {
    const isConnected = isConnectedToServer();
    const statusText = `📡 Status: ${isConnected ? '🌐 Connected to server' : '📡 Local mode'}`;
    const message = {
        id: 'status_' + Date.now(),
        sender: 'System',
        text: statusText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recipient: recipient,
        local: true,
        timestamp: Date.now()
    };
    const messages = vttStore.state.chatMessages || [];
    vttStore.update({ chatMessages: [message, ...messages] });
}

function handleIncomingChat(data) {
    if (!data || !data.text) return;
    // Add to store if not already present
    const messages = vttStore.state.chatMessages || [];
    const exists = messages.some(m => m.id === data.id);
    if (!exists) {
        const message = {
            ...data,
            local: false,
            sent: true
        };
        vttStore.update({ chatMessages: [message, ...messages] });
    }
}

function handleIncomingRoll(data) {
    if (!data || !data.rollData) return;
    const messages = vttStore.state.chatMessages || [];
    const exists = messages.some(m => m.id === data.id);
    if (!exists) {
        const message = {
            ...data,
            local: false,
            sent: true
        };
        vttStore.update({ chatMessages: [message, ...messages] });
    }
}

// ============================================================
// Voice Functions
// ============================================================

async function joinVoice() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        showToast('🎤 Voice joined', 'success');
        
        // Notify others
        if (isConnectedToServer()) {
            sendMessage({
                type: 'voice-status',
                status: 'joined',
                name: getState().playerName || 'Player'
            });
        }
    } catch (err) {
        showToast(`Failed to join voice: ${err.message}`, 'error');
    }
}

function leaveVoice() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    peerConnections.forEach((pc) => {
        pc.close();
    });
    peerConnections.clear();
    
    showToast('🔇 Voice left', 'info');
    
    if (isConnectedToServer()) {
        sendMessage({
            type: 'voice-status',
            status: 'left'
        });
    }
}

async function initiateVoiceCall(clientId) {
    if (!localStream) {
        showToast('Please join voice first', 'warning');
        return;
    }
    
    try {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
        
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendMessage({
                    type: 'voice-ice-candidate',
                    target: clientId,
                    candidate: event.candidate
                });
            }
        };
        
        pc.ontrack = (event) => {
            const audio = new Audio();
            audio.srcObject = event.streams[0];
            audio.play();
        };
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        sendMessage({
            type: 'voice-offer',
            target: clientId,
            offer: offer
        });
        
        peerConnections.set(clientId, pc);
        showToast(`Calling...`, 'info');
    } catch (err) {
        showToast(`Call failed: ${err.message}`, 'error');
    }
}

function handleVoiceOffer(data) {
    // Handle incoming voice offer
    // Implementation would go here
}

function handleVoiceAnswer(data) {
    // Handle incoming voice answer
    // Implementation would go here
}

function handleVoiceICECandidate(data) {
    // Handle incoming ICE candidate
    // Implementation would go here
}

// ============================================================
// Utility Functions
// ============================================================

function updateConnectionStatus() {
    const statusEl = q('#connection-status');
    if (!statusEl) return;
    
    const isConnected = isConnectedToServer();
    if (isConnected) {
        statusEl.textContent = '🌐 Connected';
        statusEl.style.background = 'var(--green)';
        statusEl.style.color = 'white';
    } else {
        statusEl.textContent = '📡 Local';
        statusEl.style.background = 'var(--bg3)';
        statusEl.style.color = 'var(--text3)';
    }
}

function performRoll(expr) {
    // Parse and perform a dice roll
    // This is a simplified version - you'd want to use the full dice module
    const parts = expr.split('d');
    const count = parseInt(parts[0]) || 1;
    const rest = parts[1] || '6';
    const modParts = rest.split('+');
    const sides = parseInt(modParts[0]) || 6;
    const mod = modParts.length > 1 ? parseInt(modParts[1]) || 0 : 0;
    
    const dice = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        dice.push(roll);
        total += roll;
    }
    total += mod;
    
    // Calculate outcome based on dice values
    const successes = dice.filter(d => d >= 6).length;
    const storyBeats = dice.filter(d => d === 10).length;
    let outcome = 'failure';
    if (successes >= 3) outcome = 'critical';
    else if (successes >= 2) outcome = 'success';
    else if (successes >= 1) outcome = 'partial';
    
    return {
        dice,
        total,
        successes,
        storyBeats,
        outcome,
        expression: expr
    };
}

// ============================================================
// Lifecycle
// ============================================================

export function onActivate() {
    // Refresh all renderers
    renderChat();
    renderVTTChars();
    renderVTTTimers();
    renderLocalPresence();
    renderVoiceClients();
    updateMessageCount();
    updateConnectionStatus();
}

export function onDeactivate() {
    // Clean up if needed
}

// ============================================================
// Export
// ============================================================

export default {
    render,
    attachEvents,
    onActivate,
    onDeactivate
};