/**
 * VTT Core – reactive rendering functions
 * Each renderer subscribes to the store and updates its DOM element automatically.
 */

import { vttStore } from '../../core/vtt-store.js';
import { escHtml } from '../../core/utils.js';
import { isConnectedToServer } from '../../core/websocket.js';

// ============================================================
// ASSERT helper (missing)
// ============================================================

/**
 * Simple assert function for development
 * @param {boolean} condition - The condition to check
 * @param {string} message - Error message if condition fails
 * @throws {Error} If condition is false
 */
function assert(condition, message) {
    if (!condition) {
        const error = new Error(message || 'Assertion failed');
        console.error('[VTT Core] Assertion failed:', error);
        throw error;
    }
}

// ============================================================
// Configuration
// ============================================================
export const VTT_CONFIG = {
  maxChatMessages: 200,
  chatAutoScroll: true,
  presenceUpdateInterval: 5000,
};

// ... rest of your vtt-core.js code ...
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
// Colour helper
// ============================================================
export function getOutcomeColor(outcome) {
  const colors = {
    'Critical': 'var(--gold)',
    'Success': 'var(--green)',
    'Mixed': 'var(--blue)',
    'Failure': 'var(--red)',
    'Miss': 'var(--red)'
  };
  return colors[outcome] || 'var(--bg3)';
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

    if (!Array.isArray(allMessages) || allMessages.length === 0) {
      chatContainer.innerHTML = `
        <div class="empty-chat-state" style="padding:2rem 1rem;text-align:center;color:var(--text3);">
          <div style="font-size:2rem;margin-bottom:0.5rem;">💬</div>
          <div style="font-size:0.85rem;">No messages yet</div>
          <div style="font-size:0.75rem;margin-top:0.3rem;">
            ${isConnected ? '🌐 Connected to server' : '📡 Messages stay local'}
          </div>
          <div style="font-size:0.7rem;margin-top:0.5rem;color:var(--text4);">
            Type /help for commands
          </div>
        </div>
      `;
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
      const isLocal = msg.local !== false;

      let senderColor = 'var(--text)';
      if (isSystem) senderColor = 'var(--gold)';
      else if (isOOC) senderColor = 'var(--blue)';
      else if (isGM) senderColor = 'var(--red)';

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
            <span style="word-break:break-word;">${whisper}${escHtml(String(text))}</span>
            ${modeBadge}
            <span class="msg-status" style="font-size:0.6rem;color:${statusColor};margin-left:auto;" title="${statusTitle}">${statusIcon}</span>
          </div>
          ${msg.rollData ? renderRollDetails(msg.rollData) : ''}
        </div>
      `;
    }

    chatContainer.innerHTML = html;
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
  return `
    <div style="margin-top:0.2rem;padding:0.2rem 0.4rem;background:var(--bg2);border-radius:4px;font-size:0.7rem;">
      <div style="display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;">
        <span class="outcome-tag ${rollData.outcomeClass || ''}" style="padding:0.05rem 0.6rem;border-radius:12px;font-weight:600;background:var(--bg3);">${rollData.outcome || ''}</span>
        <span>🎲 ${diceHtml}</span>
        <span style="color:var(--text3);">S:${rollData.successes || 0} SB:${rollData.storyBeats || 0}</span>
      </div>
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
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text3);font-size:0.85rem;">👤 No VTT characters</div>`;
      return;
    }
    let html = '';
    for (const char of vttChars) {
      const name = char.name || 'Unnamed';
      const harm = char.harm || 0;
      const fatigue = char.fatigue || 0;
      const boons = char.boons || 0;
      html += `
        <div class="vtt-char-card" style="background:var(--bg3);border-radius:var(--radius);padding:0.4rem 0.6rem;border-left:3px solid var(--gold);transition:all 0.2s;">
          <div style="font-weight:600;font-size:0.9rem;">${escHtml(name)}</div>
          <div style="display:flex;gap:0.8rem;font-size:0.7rem;color:var(--text2);margin-top:0.15rem;">
            <span>❤️ ${harm}</span>
            <span>⚡ ${fatigue}</span>
            <span>🎲 ${boons}</span>
          </div>
        </div>
      `;
    }
    grid.innerHTML = html;
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
      list.innerHTML = `<div class="empty-state" style="text-align:center;padding:0.5rem;color:var(--text3);font-size:0.8rem;">⏱️ No active timers</div>`;
      return;
    }
    let html = '';
    for (const timer of timers) {
      const name = timer.name || 'Timer';
      const current = timer.current || 0;
      const segments = timer.segments || 1;
      const progress = segments > 0 ? Math.min((current / segments) * 100, 100) : 0;
      html += `
        <div class="vtt-timer" style="margin-bottom:0.3rem;background:var(--bg3);border-radius:4px;padding:0.3rem 0.5rem;">
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
            <span>${escHtml(name)}</span>
            <span>${current}/${segments}</span>
          </div>
          <div style="width:100%;height:4px;background:var(--bg4);border-radius:2px;margin-top:2px;overflow:hidden;">
            <div style="width:${progress}%;height:100%;background:${progress >= 100 ? 'var(--red)' : 'var(--gold)'};border-radius:2px;transition:width 0.3s;"></div>
          </div>
        </div>
      `;
    }
    list.innerHTML = html;
  });
}

// ============================================================
// Presence (reactive)
// ============================================================
let presenceUnsubscribe = null;

export function renderLocalPresence() {
  if (!currentContainer) return;
  const presenceList = currentContainer.querySelector('#presence-list');
  if (!presenceList) return;

  if (presenceUnsubscribe) presenceUnsubscribe();
  presenceUnsubscribe = vttStore.subscribe('presence', (presence) => {
    if (!presence || presence.length === 0) {
      presenceList.innerHTML = `<div style="color:var(--text3);padding:0.3rem 0;font-size:0.8rem;">No VTT characters</div>`;
      return;
    }
    const showAvatars = localStorage.getItem('fates-edge-show-avatars') !== 'false';
    presenceList.innerHTML = presence.map(p => {
      const avatarUrl = showAvatars
        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&size=32&background=2c3e50&color=fff`
        : '';
      return `
        <div class="presence-item" style="display:flex;align-items:center;gap:0.5rem;padding:0.2rem 0;border-bottom:1px solid var(--border);">
          ${showAvatars ? `<img src="${avatarUrl}" alt="${p.name}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" />` : ''}
          <span style="font-weight:400;">${escHtml(p.name)}</span>
          <span style="font-size:0.7rem;color:var(--text2);background:var(--bg4);padding:0.05rem 0.4rem;border-radius:12px;">${p.tier ? `Tier ${p.tier}` : 'Player'}</span>
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.online ? 'var(--green)' : 'var(--gold)'};margin-left:auto;" title="${p.online ? 'Online' : 'Local'}"></span>
        </div>
      `;
    }).join('');
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
      listEl.innerHTML = `<span style="color:var(--text3);font-size:0.75rem;">No other voice clients.</span>`;
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
    listEl.innerHTML = html;

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
  recipientSelect.innerHTML = '';
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