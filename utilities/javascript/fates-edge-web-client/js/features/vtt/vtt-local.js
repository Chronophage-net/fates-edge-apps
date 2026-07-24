/**
 * VTT Local Mode – no WebSocket, everything stays in the browser.
 * Uses the reactive store for all UI updates.
 * 
 * v2 – JRPG-style horizontal character cards, character selection,
 *       common rolls, larger fonts, avatar support.
 * v3 – Restructured layout/visual pass: card-based sections, stat pills,
 *      clearer typographic hierarchy. No IDs/classes/behavior removed.
 */

import { vttStore } from '../../core/vtt-store.js';
import { getState, getCharacters, ensureCharacterDefaults, clearChatHistory } from '../../core/state.js';
import { performRoll } from '../../core/dice.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';
import { isConnectedToServer } from '../../core/websocket.js';
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
import { initVoice, toggleMute, getVoiceStatus, cleanupVoice, getActiveVoiceClients, getVoiceClient, onVoiceClientsChanged } from './voice.js';

// ============================================================
// STATE
// ============================================================

let container = null;
let voiceInitialized = false;
let presenceInterval = null;
let eventListeners = [];
let isDestroyed = false;
let voiceUnsubscribe = null;

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
// MESSAGE SENDING (local only)
// ============================================================

function createLocalMessage(text, sender, recipient = 'all', metadata = {}) {
  return {
    text,
    sender,
    recipient,
    whisper: recipient !== 'all',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now(),
    local: true,
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    sent: false,
    ...metadata
  };
}

export function sendMessage(text, sender, recipient = 'all', metadata = {}) {
  if (isDestroyed) return null;
  const msg = createLocalMessage(text, sender, recipient, metadata);
  vttStore.addChatMessage(msg);
  return msg;
}

// ============================================================
// ROLL – uses selected character for sender name
// ============================================================

function rollLocal(postToChat = true) {
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
    msg += ` — ${result.resultText}`;
    sendMessage(msg, sender, 'all', {
      rollData: {
        outcome: result.outcome,
        outcomeClass: result.outcomeClass,
        resultText: result.resultText,
        dice: result.dice,
        successes: result.successes,
        storyBeats: result.storyBeats,
        reRolls: result.reRolls
      }
    });
  }
}

// ============================================================
// SLASH COMMANDS – use selected character
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
          storyBeats: result.storyBeats
        }
      });
      break;
    }
    case 'timer': {
      const segments = parseInt(parts[parts.length - 1], 10) || 4;
      const name = parts.slice(1, parts.length - 1).join(' ') || 'Scene Timer';
      import('../../core/state.js').then(module => {
        const state = module.getState();
        const newTimer = { id: state._nextId++, name, segments, current: 0 };
        module.addTimer(newTimer);
        vttStore.updateTimers(state.timers || []);
        const msg = `Timer created: ${name} (${segments} segments)`;
        sendMessage(msg, 'System', 'all');
      }).catch(err => {
        showToast('Failed to create timer', 'error');
      });
      break;
    }
    case 'help': {
      const helpText = [
        '📖 Commands:',
        '/roll attr skill dv [pos] [boons] [note] - Make a roll',
        '/timer name segments - Create a timer',
        '/ooc text - Send out-of-character message',
        '/status - Show party status',
        '/clear - Clear chat',
        '/help - Show this help',
        '📡 Local mode (no server)'
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
      if (chars.length === 0) {
        sendMessage('📡 Local mode | No VTT characters.', 'System', 'all');
      } else {
        const status = chars.map(c => `${c.name}: ❤️${c.harm || 0} ⚡${c.fatigue || 0} 🎲${c.boons || 0}`).join(' | ');
        sendMessage(`📊 ${status} | 📡 Local mode`, 'System', 'all');
      }
      break;
    }
    case 'clear': {
      clearChatHistory?.();
      vttStore.clearChat();
      showToast('Chat cleared.', 'success');
      break;
    }
    default: {
      showToast('Unknown command. Try /help', 'error');
    }
  }
}

// ============================================================
// VOICE (unchanged)
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
    showToast('Voice chat disabled.', 'info');
  }
  updateVoiceUI();
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

function updateVoiceUI() {
  if (!voiceInitialized) return;
  const status = getVoiceStatus();
  const muteBtn = q('#vtt-mute-toggle');
  if (!muteBtn) return;
  if (status.muted) {
    muteBtn.textContent = '🔇 Muted';
    muteBtn.className = 'btn btn-sm btn-danger';
  } else {
    muteBtn.textContent = '🎙️ Live';
    muteBtn.className = 'btn btn-sm btn-green';
  }
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
        const chars = getCharacters();
        vttStore.updateCharacters(chars);
        vttStore.updateTimers(getState().timers || []);
        showToast('VTT refreshed.', 'info');
        break;
      }
      case 'vtt-roll-post-btn': rollLocal(true); break;
      case 'vtt-roll-only-btn': rollLocal(false); break;
      case 'vtt-add-timer': {
        const name = prompt('Timer name:', 'Scene Timer');
        if (name) {
          const segments = parseInt(prompt('Segments:', '6') || '6');
          const state = getState();
          const newTimer = { 
            id: 'timer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), 
            name, 
            segments, 
            current: 0 
          };
          state.timers = state.timers || [];
          state.timers.push(newTimer);
          vttStore.updateTimers(state.timers);
          sendMessage(`Timer created: ${name} (${segments} segments)`, 'System', 'all');
          showToast(`Timer "${name}" created.`, 'success');
        }
        break;
      }
      case 'vtt-scene-end': {
        const state = getState();
        let trimmed = 0;
        (state.characters || []).forEach(c => {
          const before = c.boons || 0;
          c.boons = Math.min(c.boons || 0, 2);
          if (before > c.boons) trimmed += (before - c.boons);
        });
        // Re‑normalize characters after modification
        const chars = getCharacters();
        vttStore.updateCharacters(chars);
        if (trimmed > 0) {
          showToast(`Scene ended: trimmed ${trimmed} excess Boons.`, 'success');
        } else {
          showToast('Scene ended: all Boons already at 2 or below.', 'info');
        }
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

  const voiceClients = getActiveVoiceClients();
  const voiceAvailable = isConnectedToServer();

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
        @media (max-width: 900px) {
            .vtt-live-table .vtt-section-grid { grid-template-columns: 1fr; }
        }
    </style>

    <div class="vtt-header" style="margin-bottom:1.2rem;">
      <h1 class="page-title" style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;font-size:1.8rem;">
        💬 VTT – Live Table
        <span class="mode-indicator vtt-stat-pill" style="color:var(--gold);">📡 Local</span>
        <button class="btn btn-sm" onclick="window.location.hash='whiteboard'" title="Open Whiteboard">✏️ Whiteboard</button>
      </h1>
      <p class="page-sub" style="margin:0.25rem 0 0;font-size:1.05rem;color:var(--text3);">Chat, party status, quick die roller, and scene timers all in one view.</p>
    </div>

    <div class="panel vtt-card" style="margin-bottom:1.1rem;">
      <div class="vtt-card-header">
        <span class="vtt-card-title">🛰️ Table Status</span>
        <span class="vtt-stat-pill">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--gold);"></span>
          📡 Local mode (no server)
        </span>
      </div>
      <div class="vtt-stat-row" style="justify-content:space-between;">
        <div class="vtt-btn-row" style="align-items:center;">
          <button class="btn btn-sm ${voiceInitialized ? 'btn-primary' : ''}" id="vtt-voice-toggle"
            ${voiceAvailable ? '' : 'disabled'} title="${voiceAvailable ? 'Toggle voice chat' : 'Voice requires a server connection'}">
            ${voiceAvailable ? (voiceInitialized ? '🎤 Voice On' : '🎤 Voice Off') : '🎤 Voice (unavailable)'}
          </button>
          ${voiceInitialized ? `<button class="btn btn-sm ${getVoiceStatus()?.muted ? 'btn-danger' : 'btn-green'}" id="vtt-mute-toggle">${getVoiceStatus()?.muted ? '🔇 Muted' : '🎙️ Live'}</button>` : ''}
          <span class="vtt-stat-pill" id="voice-clients-count">${voiceClients.length} voice users</span>
        </div>
      </div>
      <div id="voice-clients-list" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem;">${voiceClientsHtml}</div>

      <div class="vtt-divider"></div>

      <div class="vtt-card-header" style="margin-bottom:0.35rem;">
        <span class="vtt-card-title" style="font-size:1rem;">👥 Party Members</span>
        <span class="vtt-stat-pill" id="vtt-mode-badge">📡 Local</span>
      </div>
      <div id="presence-list"></div>
    </div>

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
          <input type="text" id="chatInput" placeholder="Type… (/roll, /timer, /help)" style="flex:1;font-size:1rem;padding:0.5rem 0.6rem;" />
          <select id="chatRecipient" style="flex:0 0 120px;font-size:1rem;">
            <option value="all">All</option>
          </select>
          <button class="btn btn-gold" id="chat-send-btn">Send</button>
        </div>
        <div class="flex mt-1" style="flex-wrap:wrap;gap:0.9rem;font-size:0.9rem;align-items:center;">
          <label class="inline-check"><input type="checkbox" id="vtt-post-chat" checked /> Post rolls to chat</label>
          <label class="inline-check"><input type="checkbox" id="vtt-auto-scroll" checked /> Auto-scroll</label>
        </div>
        <div class="vtt-hint">Try <code>/roll 3 2 3</code> or <code>/help</code> for the full command list.</div>
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

  // Normalize and set initial characters
  const chars = getCharacters();
  vttStore.updateCharacters(chars);
  vttStore.updateTimers(getState().timers || []);
  vttStore.setConnectionStatus('local');

  // Register voice client callback to update the store
  if (voiceUnsubscribe) voiceUnsubscribe();
  voiceUnsubscribe = onVoiceClientsChanged((clients) => {
    vttStore.updateVoiceClients(clients);
  });

  // Attach DOM events
  attachEvents();

  // Start presence update interval
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

  console.log('[VTT Local] Rendered with reactive store (JRPG style + selection)');
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
  if (voiceUnsubscribe) {
    voiceUnsubscribe();
    voiceUnsubscribe = null;
  }
  if (voiceInitialized) {
    cleanupVoice();
    voiceInitialized = false;
  }
  console.log('[VTT Local] Destroyed');
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
