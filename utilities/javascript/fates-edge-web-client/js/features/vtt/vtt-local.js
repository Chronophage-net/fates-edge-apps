/**
 * VTT Local Mode – no WebSocket, everything stays in the browser.
 * Uses the reactive store for all UI updates.
 * 
 * v2 – JRPG-style horizontal character cards, character selection,
 *       common rolls, larger fonts, avatar support.
 * v3 – Restructured layout/visual pass: card-based sections, stat pills,
 *      clearer typographic hierarchy. No IDs/classes/behavior removed.
 * v4 – Added the Combat Actions panel (contextual melee/ranged/tactics/
 *      talent buttons driven by the selected character's sheet). See
 *      combat-actions.js. #vtt-attr / #vtt-skill switched from <select>
 *      to <input type="number"> so weapon/talent bonuses that push a
 *      pool above the old 5-option dropdown range still work — every
 *      other reference to these fields (rollLocal, renderCommonRolls,
 *      etc.) reads `.value` the same way, so nothing else changes.
 * v5 – Added character detail panel (TTRPG sheet) and follower chat,
 *      matching the connected mode; chat height increased.
 */

import { t as i18nText } from '@core/i18n.js';
import { vttStore } from '@core/vtt-store.js';
import { getState, getCharacters, ensureCharacterDefaults, clearChatHistory, saveState } from '@core/state.js';
import { performRoll } from '@core/dice.js';
import { showToast } from '@components/Toast.js';
import { escHtml } from '@core/utils.js';
import { isConnectedToServer, isLocalOnlyMode, setLocalOnlyMode } from '@core/websocket.js';
import { collectEquipmentModifiers } from '@core/talent-effects.js';
import { RANGE_BAND_OPTIONS, RANGE_BAND_LABEL_MAP } from '@features/characters/roller.js';
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
import { renderCombatActions, resetCombatScene } from './combat-actions.js';

// ============================================================
// STATE
// ============================================================

let container = null;
let voiceInitialized = false;
let presenceInterval = null;
let eventListeners = [];
let docEventListeners = [];
let isDestroyed = false;
let voiceUnsubscribe = null;
const voiceStatus = { muted: false };

// ============================================================
// HELPERS – Get sender from selected character
// ============================================================

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
          const progressPill = c.harm > 0
            ? (isCombat
                ? `<span class="text-muted text-sm" style="color:var(--red);" title="Harm" data-i18n-attr="title:feature.vtt.vtt-local.harm">H${c.harm}</span>`
                : `<span class="text-muted text-sm" style="color:var(--orange);" title="${escHtml(objType.progressLabel)}">${objType.icon}${c.harm}/${c.maxHarm}</span>`)
            : '';
          return `
            <div style="display:flex;align-items:center;gap:0.4rem;padding:0.25rem 0.3rem;border-radius:4px;${isActive ? 'background:var(--bg4);border-inline-start:2px solid var(--gold);' : ''}font-size:0.85rem;">
              <span style="flex:0 0 1.1rem;text-align:center;">${isActive ? '▶' : ''}</span>
              <span style="flex:0 0 auto;color:${c.type === 'player' ? 'var(--blue)' : 'var(--red)'};">${weaponGlyph}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(c.name)}</span>
              ${progressPill}
              ${(isCombat && c.fatigue > 0) ? `<span class="text-muted text-sm" title="Fatigue" data-i18n-attr="title:feature.vtt.vtt-local.fatigue">F${c.fatigue}</span>` : ''}
              ${rangeHtml}
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    console.debug('[VTT Local] Mini tracker unavailable:', err?.message);
    el.innerHTML = '<div class="text-muted text-sm">Combat tracker unavailable.</div>';
  }
}

function getSenderName() {
  const selected = vttStore.getSelectedCharacter();
  if (selected && selected.name) return selected.name;
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
    // Solo/local mode has no other connected players to spoof a GM label
    // for -- see vtt-core.js's renderChatMessageText -- so it's always
    // "verified" here, the same way isGM()-style checks elsewhere treat
    // offline/solo play as full-trust.
    verifiedGM: true,
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
  const attackTypeEl = q('#vtt-attack-type');
  const rangeEl = q('#vtt-range');
  const out = q('#vtt-roll-output');
  if (!attrEl || !skillEl || !dvEl || !posEl) return;

  let attr = parseInt(attrEl.value, 10) || 1;
  const skill = parseInt(skillEl.value, 10) || 0;
  const dv = parseInt(dvEl.value, 10) || 3;
  const pos = posEl.value;
  const boons = parseInt(boonsEl?.value, 10) || 0;

  // Weapon weight-class × range-band bonus (same table as the Character
  // Roller — see core/talent-effects.js's RANGE_BONUS_TABLE). Manually
  // selected here since the Quick Roller takes raw attr/skill numbers rather
  // than a named skill/character weaponClass.
  const weaponClass = attackTypeEl?.value || '';
  const range = rangeEl?.value || '';
  let rangeNote = '';
  let rangeBonus = 0;
  if (weaponClass && range) {
    const selectedChar = vttStore.getSelectedCharacter();
    const equipMods = collectEquipmentModifiers(
      { armorType: selectedChar?.armorType, range, weaponClass, shieldType: selectedChar?.shieldType },
      true
    );
    rangeBonus = equipMods.diceBonus || 0;
    attr = Math.max(0, attr + rangeBonus);
    if (equipMods.notes.length) rangeNote = ` [${equipMods.notes.join(', ')}]`;
  }

  const result = performRoll(attr, skill, dv, pos, boons);
  if (!result) {
    showToast(i18nText("feature.vtt.vtt-local.poolMustBeAtLeast1Die", null, "Pool must be at least 1 die."), 'error');
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
        range: range || null,
        tens: result.tens,
        critical: result.critical
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
      if (!result) { showToast(i18nText("feature.vtt.vtt-local.poolMustBeAtLeast1Die", null, "Pool must be at least 1 die."), 'error'); return; }
      const msg = `[${result.outcome}] ${attr}+${skill} vs DV${dv} (${pos}) → ${result.dice.join(' ')} (S:${result.successes} SB:${result.storyBeats})${result.critical ? ' | 💥 CRIT' : ''}${note ? ' — ' + note : ''}`;
      sendMessage(msg, sender, 'all', {
        rollData: {
          outcome: result.outcome,
          outcomeClass: result.outcomeClass,
          resultText: result.resultText,
          dice: result.dice,
          successes: result.successes,
          storyBeats: result.storyBeats,
          tens: result.tens,
          critical: result.critical
        }
      });
      break;
    }
    case 'timer': {
      const name = parts.slice(1, parts.length - 1).join(' ') || 'Scene Timer';
      const segments = parseInt(parts[parts.length - 1], 10) || 4;
      import('@core/state.js').then(module => {
        const state = module.getState();
        const newTimer = { id: 'timer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), name, segments, current: 0 };
        state.timers = state.timers || [];
        state.timers.push(newTimer);
        vttStore.updateTimers(state.timers);
        sendMessage(`Timer created: ${name} (${segments} segments)`, 'System', 'all');
        showToast(i18nText("feature.vtt.vtt-local.timerValueCreated", { value0: name }, "Timer \"{{value0}}\" created."), 'success');
      }).catch(err => {
        showToast(i18nText("feature.vtt.vtt-local.failedToCreateTimer", null, "Failed to create timer"), 'error');
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
      showToast(i18nText("feature.vtt.vtt-local.chatCleared", null, "Chat cleared."), 'success');
      break;
    }
    default: {
      showToast(i18nText("feature.vtt.vtt-local.unknownCommandTryHelp", null, "Unknown command. Try /help"), 'error');
    }
  }
}

// ============================================================
// VOICE
// ============================================================

async function toggleVoice() {
  if (isDestroyed) return;
  if (!voiceInitialized) {
    const success = await initVoice();
    if (success) {
      voiceInitialized = true;
      const toggleBtn = q('#vtt-voice-toggle');
      if (toggleBtn) {
        toggleBtn.textContent = i18nText("feature.vtt.vtt-local.voiceOn", null, "🎤 Voice On");
        toggleBtn.className = 'btn btn-sm btn-primary';
      }
      const containerEl = q('.flex-between .flex:last-child');
      if (containerEl && !q('#vtt-mute-toggle')) {
        const muteBtn = document.createElement('button');
        muteBtn.id = 'vtt-mute-toggle';
        muteBtn.className = 'btn btn-sm btn-green';
        muteBtn.textContent = i18nText("feature.vtt.vtt-local.live", null, "🎙️ Live");
        muteBtn.addEventListener('click', toggleMuteVoice);
        containerEl.appendChild(muteBtn);
      }
      showToast(i18nText("feature.vtt.vtt-local.voiceChatEnabled", null, "Voice chat enabled!"), 'success');
    }
  } else {
    cleanupVoice();
    voiceInitialized = false;
    const toggleBtn = q('#vtt-voice-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = i18nText("feature.vtt.vtt-local.voiceOff", null, "🎤 Voice Off");
      toggleBtn.className = 'btn btn-sm';
    }
    const muteBtn = q('#vtt-mute-toggle');
    if (muteBtn) muteBtn.remove();
    showToast(i18nText("feature.vtt.vtt-local.voiceChatDisabled", null, "Voice chat disabled."), 'info');
  }
  updateVoiceUI();
}

function toggleMuteVoice() {
  const muted = toggleMute();
  const btn = q('#vtt-mute-toggle');
  if (!btn) return;
  if (muted) {
    btn.textContent = i18nText("feature.vtt.vtt-local.muted", null, "🔇 Muted");
    btn.className = 'btn btn-sm btn-danger';
  } else {
    btn.textContent = i18nText("feature.vtt.vtt-local.live", null, "🎙️ Live");
    btn.className = 'btn btn-sm btn-green';
  }
}

function updateVoiceUI() {
  if (!voiceInitialized) return;
  const status = getVoiceStatus();
  const muteBtn = q('#vtt-mute-toggle');
  if (!muteBtn) return;
  if (status.muted) {
    muteBtn.textContent = i18nText("feature.vtt.vtt-local.muted", null, "🔇 Muted");
    muteBtn.className = 'btn btn-sm btn-danger';
  } else {
    muteBtn.textContent = i18nText("feature.vtt.vtt-local.live", null, "🎙️ Live");
    muteBtn.className = 'btn btn-sm btn-green';
  }
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
      case 'vtt-clear-chat': clearChatHistory?.(); vttStore.clearChat(); showToast(i18nText("feature.vtt.vtt-local.chatCleared", null, "Chat cleared."), 'success'); break;
      case 'vtt-refresh-btn': {
        const chars = getCharacters();
        vttStore.updateCharacters(chars);
        vttStore.updateTimers(getState().timers || []);
        showToast(i18nText("feature.vtt.vtt-local.vttRefreshed", null, "VTT refreshed."), 'info');
        break;
      }
      case 'vtt-roll-post-btn': rollLocal(true); break;
      case 'vtt-roll-only-btn': rollLocal(false); break;
      case 'vtt-add-timer': {
        const name = prompt(i18nText("feature.vtt.vtt-local.timerName", null, "Timer name:"), 'Scene Timer');
        if (name) {
          const segments = parseInt(prompt(i18nText("feature.vtt.vtt-local.segments", null, "Segments:"), '6') || '6');
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
          showToast(i18nText("feature.vtt.vtt-local.timerValueCreated", { value0: name }, "Timer \"{{value0}}\" created."), 'success');
        }
        break;
      }
      case 'vtt-scene-end': {
        // Delegate to gm-tools' sceneEndTrimBoons() instead of duplicating the
        // boon-trim logic here — this copy used to drift from the GM Tools
        // version (it never reset once/scene talent charges or called
        // saveState() directly). Dynamic import avoids a circular top-level
        // import between vtt-local.js and gm-tools/index.js.
        import('@features/gm-tools/index.js').then(module => {
          if (typeof module.sceneEndTrimBoons === 'function') {
            module.sceneEndTrimBoons();
          }
          const chars = getCharacters();
          vttStore.updateCharacters(chars);
          resetCombatScene();
        }).catch(err => {
          console.warn('[VTT Local] sceneEndTrimBoons unavailable, falling back to local trim:', err?.message);
          const state = getState();
          (state.characters || []).forEach(c => { c.boons = Math.min(c.boons || 0, 2); });
          saveState();
          vttStore.updateCharacters(getCharacters());
          resetCombatScene();
          showToast(i18nText("feature.vtt.vtt-local.sceneEndedBoonsTrimmed", null, "Scene ended: Boons trimmed."), 'info');
        });
        break;
      }
      case 'vtt-voice-toggle': toggleVoice(); break;
      case 'vtt-mute-toggle': toggleMuteVoice(); break;
      case 'vtt-local-only-toggle': {
        const goingOffline = !isLocalOnlyMode();
        setLocalOnlyMode(goingOffline);
        showToast(
          goingOffline
            ? 'Working fully offline. No more connection attempts.'
            : 'Local-only mode off. Fate\'s Edge may connect to a server again.',
          'info'
        );
        render(container);
        break;
      }
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
    { event: 'keydown', handler: keydownHandler },
    { event: 'change', handler: changeHandler }
  ];
  eventListeners.forEach(({event, handler}) => {
    container.addEventListener(event, handler);
  });

  // ─── Follower chat listener ──────────────────────────────────────
  const followerChatHandler = (e) => {
    const { characterName, followerName, message } = e.detail;
    if (!message || !followerName) return;
    const sender = `${followerName} (${characterName})`;
    sendMessage(message, sender, 'all');
  };
  document.addEventListener('follower-chat', followerChatHandler);
  // Store for cleanup
  docEventListeners.push({ event: 'follower-chat', handler: followerChatHandler });
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
  const status = getVoiceStatus();

  const voiceClientsHtml = voiceClients.map(id => {
    const client = getVoiceClient(id);
    const speaking = !!client?.speaking;
    const isSpeaking = speaking ? 'var(--gold)' : 'var(--bg3)';
    const name = client?.name || 'Player';
    // Speaking is conveyed three ways, not just the color dot -- see the
    // matching comment in vtt-connected.js's identical badge markup.
    return `<span class="voice-client-badge" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.2rem 0.8rem;border-radius:20px;background:var(--bg4);font-size:0.85rem;border:1px solid var(--border);">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isSpeaking};transition:background 0.3s;" aria-hidden="true"></span>
      ${escHtml(name)}${speaking ? ' <span aria-hidden="true" title="Speaking">🔊</span>' : ''}<span class="sr-only">${speaking ? ', speaking' : ''}</span>
    </span>`;
  }).join('');

  el.innerHTML = `
  <div class="vtt-live-table">

    <!-- Header -->
    <div class="vtt-header">
      <h1 class="page-title">
        💬 VTT – Live Table
        <span class="mode-indicator vtt-stat-pill local">📡 Local</span>
        <button class="btn btn-sm btn-ghost" onclick="window.location.hash='whiteboard'" title="Open Whiteboard" data-i18n-attr="title:feature.vtt.vtt-local.openWhiteboard" data-i18n="feature.vtt.vtt-local.whiteboard">✏️ Whiteboard</button>
      </h1>
      <p class="page-sub" data-i18n="feature.vtt.vtt-local.chatPartyStatusQuickDieRollerAnd">Chat, party status, quick die roller, and scene timers all in one view.</p>
    </div>

    <!-- Table Status -->
    <div class="panel vtt-card status-panel">
      <div class="vtt-card-header">
        <span class="vtt-card-title" data-i18n="feature.vtt.vtt-local.tableStatus">🛰️ Table Status</span>
        <span class="vtt-stat-pill">
          <span class="vtt-dot" style="background:var(--vtt-gold);"></span>
          📡 Local mode (no server)
        </span>
      </div>
      <!-- NEW: real local-only mode. Local mode (this view) just means "not
           currently connected" -- the WS layer still auto-connects and
           retries in the background by default. This affordance is the
           discoverable, one-click way to actually turn that off (wraps
           core/websocket.js's isLocalOnlyMode()/setLocalOnlyMode(); the
           Settings > WebSocket panel has the same toggle for anyone who'd
           rather set it there). -->
      <div class="vtt-stat-row" id="vtt-local-only-row" style="justify-content:space-between;align-items:center;padding:0.5rem 0.75rem;margin-bottom:0.5rem;background:var(--vtt-surface2);border-radius:calc(var(--vtt-radius) - 2px);">
        ${isLocalOnlyMode() ? `
          <span class="text-muted" style="font-size:0.85rem;" data-i18n="feature.vtt.vtt-local.fullyOfflineNoConnectionAttemptsNoReconnect">✅ Fully offline &mdash; no connection attempts, no reconnect loop.</span>
          <button class="btn btn-sm btn-ghost" id="vtt-local-only-toggle" title="Allow connecting to a server again" data-i18n-attr="title:feature.vtt.vtt-local.allowConnectingToAServerAgain" data-i18n="feature.vtt.vtt-local.allowConnecting">🌐 Allow connecting</button>
        ` : `
          <span class="text-muted" style="font-size:0.85rem;" data-i18n="feature.vtt.vtt-local.stillTryingToReconnectInTheBackground">Still trying to reconnect in the background? Turn that off:</span>
          <button class="btn btn-sm btn-ghost" id="vtt-local-only-toggle" title="Stop all connection attempts and stay fully offline" data-i18n-attr="title:feature.vtt.vtt-local.stopAllConnectionAttemptsAndStayFully" data-i18n="feature.vtt.vtt-local.workFullyOffline">🔌 Work fully offline</button>
        `}
      </div>
      <div class="vtt-stat-row" style="justify-content:space-between;">
        <div class="vtt-btn-row" style="align-items:center;">
          <button class="btn btn-sm ${voiceInitialized ? 'btn-primary' : ''}" id="vtt-voice-toggle">${voiceInitialized ? '🎤 Voice On' : '🎤 Voice Off'}</button>
          ${voiceInitialized ? `<button class="btn btn-sm ${status?.muted ? 'btn-danger' : 'btn-green'}" id="vtt-mute-toggle">${status?.muted ? '🔇 Muted' : '🎙️ Live'}</button>` : ''}
          <span class="vtt-stat-pill" id="voice-clients-count">${voiceClients.length} voice users</span>
        </div>
      </div>
      <div id="voice-clients-list" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem;">${voiceClientsHtml}</div>
      <div class="vtt-divider"></div>
      <div class="vtt-card-header" style="margin-bottom:0.35rem;">
        <span class="vtt-card-title" style="font-size:1rem;" data-i18n="feature.vtt.vtt-local.partyMembers">👥 Party Members</span>
        <span class="vtt-stat-pill" id="vtt-mode-badge">📡 Local</span>
      </div>
      <div id="presence-list"></div>
    </div>

    <!-- Main Grid -->
    <div class="vtt-section-grid">
      <!-- Chat Column -->
      <div class="chat-box vtt-card" style="display:flex;flex-direction:column;min-height:min(55vh, 500px);">
        <div class="vtt-card-header">
          <span class="vtt-card-title" data-i18n="feature.vtt.vtt-local.chat">💬 Chat</span>
          <div class="vtt-btn-row" style="align-items:center;">
            <span class="text-muted" id="message-count" data-i18n="feature.vtt.vtt-local.0Messages">0 messages</span>
            <button class="btn btn-sm btn-ghost" id="vtt-clear-chat" title="Clear chat" data-i18n-attr="title:feature.vtt.vtt-local.clearChat">🗑️</button>
          </div>
        </div>
        <!-- Viewport-relative sizing so short/mobile viewports don't force a
             fixed 300-600px box that overflows the page; scales with vh,
             capped so huge desktop monitors don't get an absurdly tall pane.
             NEW: role="log"/aria-live="polite"/aria-relevant="additions" —
             see the matching change in vtt-connected.js's header comment. -->
        <div class="chat-messages" id="chatMessages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Chat messages" style="flex:1;overflow-y:auto;padding:0.5rem;background:var(--vtt-surface2);border-radius:calc(var(--vtt-radius) - 2px);margin-bottom:0.5rem;font-size:1rem;display:flex;flex-direction:column;max-height:min(70vh, 600px);min-height:min(35vh, 300px);" data-i18n-attr="aria-label:feature.vtt.vtt-local.chatMessages"></div>
        <div id="selected-character-display" style="margin-bottom:0.4rem;padding:0.2rem 0.4rem;background:var(--vtt-surface2);border-radius:calc(var(--vtt-radius) - 2px);min-height:2.5rem;"></div>
        <div class="chat-input-row" style="display:flex;gap:0.4rem;">
          <input type="text" id="chatInput" placeholder="Type… (/roll, /timer, /help)" style="flex:1;font-size:1rem;padding:0.5rem 0.6rem;" / data-i18n-attr="placeholder:feature.vtt.vtt-local.typeRollTimerHelp">
          <select id="chatRecipient" style="flex:0 0 120px;font-size:1rem;">
            <option value="all" data-i18n="feature.vtt.vtt-local.all">All</option>
          </select>
          <button class="btn btn-gold" id="chat-send-btn" data-i18n="feature.vtt.vtt-local.send">Send</button>
        </div>
        <div class="flex mt-1" style="flex-wrap:wrap;gap:0.9rem;font-size:0.9rem;align-items:center;">
          <label class="inline-check"><input type="checkbox" id="vtt-post-chat" checked /> Post rolls to chat</label>
          <label class="inline-check"><input type="checkbox" id="vtt-auto-scroll" checked /> Auto-scroll</label>
          <!-- NEW: "Type to Speak" -- see vtt-connected.js for the same
               checkbox and the reasoning behind it. -->
          <label class="inline-check" title="Reads new chat messages aloud, so a player who types instead of speaking is still heard" data-i18n-attr="title:feature.vtt.vtt-local.readsNewChatMessagesAloudSoA"><input type="checkbox" id="vtt-speak-messages" /> 🔊 Read aloud</label>
        </div>
        <div class="vtt-hint">Try <code>/roll 3 2 3</code> or <code>/help</code> for the full command list.</div>
      </div>

      <!-- Sidebar -->
      <div class="vtt-sidebar">
        <div class="vtt-sidebar-scroll">
          <!-- Party -->
          <div class="vtt-panel vtt-card">
            <div class="vtt-card-header">
              <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-local.party">👥 Party</span>
              <button class="btn btn-sm btn-ghost" id="vtt-refresh-btn" title="Refresh" data-i18n-attr="title:feature.vtt.vtt-local.refresh">↻</button>
            </div>
            <div id="vttCharGrid" class="vtt-char-grid"></div>
            <!-- NEW: detail panel for selected character (TTRPG sheet) -->
            <div id="vtt-char-detail" style="margin-top:0.5rem;"></div>
          </div>

          <!-- Combat Actions -->
          <div class="vtt-panel vtt-card">
            <div class="vtt-card-header">
              <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-local.combatActions">⚔️ Combat Actions</span>
            </div>
            <div id="vtt-combat-actions" style="min-height:2.5rem;"></div>
          </div>

          <!-- Mini Combat Tracker — live initiative order + range-to-you,
               without requiring the full Encounters tracker modal open.
               Reads encounters/combat.js's in-memory session (see
               getTrackerState() there); safe no-op if none is active. -->
          <div class="vtt-panel vtt-card">
            <div class="vtt-card-header">
              <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-local.combatTracker">🗡️ Combat Tracker</span>
              <button class="btn btn-sm btn-ghost" onclick="window.location.hash='encounters'" title="Open full Encounters tracker" data-i18n-attr="title:feature.vtt.vtt-local.openFullEncountersTracker">↗️</button>
            </div>
            <div id="vtt-mini-tracker-body" style="min-height:2rem;"></div>
          </div>

          <!-- Quick Roller -->
          <div class="vtt-panel vtt-card">
            <div class="vtt-card-header">
              <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-local.quickRoller">🎲 Quick Roller</span>
            </div>
            <div class="vtt-dice-row">
              <div class="vtt-field">
                <label data-i18n="feature.vtt.vtt-local.attr">Attr</label>
                <input type="number" id="vtt-attr" value="3" min="1" max="8" style="width:100%;" />
              </div>
              <div class="vtt-field">
                <label data-i18n="feature.vtt.vtt-local.skill">Skill</label>
                <input type="number" id="vtt-skill" value="2" min="0" max="12" style="width:100%;" />
              </div>
              <div class="vtt-field" style="flex:0 0 80px;">
                <label data-i18n="feature.vtt.vtt-local.dv">DV</label>
                <select id="vtt-dv">
                  <option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5+</option>
                </select>
              </div>
              <div class="vtt-field" style="flex:0 0 90px;">
                <label data-i18n="feature.vtt.vtt-local.pos">Pos</label>
                <select id="vtt-pos">
                  <option value="dominant" data-i18n="feature.vtt.vtt-local.dom">Dom</option><option value="controlled" selected data-i18n="feature.vtt.vtt-local.ctrl">Ctrl</option><option value="desperate" data-i18n="feature.vtt.vtt-local.desp">Desp</option>
                </select>
              </div>
              <div class="vtt-field" style="flex:0 0 70px;">
                <label data-i18n="feature.vtt.vtt-local.boons">Boons</label>
                <input type="number" id="vtt-boons" value="0" min="0" max="5" />
              </div>
            </div>
            <div class="vtt-dice-row" style="margin-top:0.4rem;">
              <div class="vtt-field" style="flex:1 1 140px;">
                <label data-i18n="feature.vtt.vtt-local.weapon">Weapon</label>
                <select id="vtt-attack-type" title="Weapon weight class — drives the range bonus below (Player's Guide §3.12.1-3.12.3).">
                  <option value="">— N/A —</option>
                  <option value="light" data-i18n="feature.vtt.vtt-local.light">🗡️ Light</option>
                  <option value="medium" data-i18n="feature.vtt.vtt-local.medium">⚔️ Medium</option>
                  <option value="heavy" data-i18n="feature.vtt.vtt-local.heavy">🔨 Heavy</option>
                  <option value="ranged" data-i18n="feature.vtt.vtt-local.ranged">🏹 Ranged</option>
                </select>
              </div>
              <div class="vtt-field" style="flex:1 1 160px;">
                <label data-i18n="feature.vtt.vtt-local.rangeGMSet">Range (GM-set)</label>
                <select id="vtt-range" title="The narrative range the GM told you before rolling." data-i18n-attr="title:feature.vtt.vtt-local.theNarrativeRangeTheGMToldYou">
                  ${RANGE_BAND_OPTIONS.map(r => `<option value="${r.key}">${r.label}</option>`).join('')}
                </select>
              </div>
            </div>
            <div id="vtt-common-rolls" style="margin-top:0.5rem;min-height:2.5rem;"></div>
            <div class="vtt-btn-row" style="margin-top:0.5rem;">
              <button class="btn btn-gold btn-sm" id="vtt-roll-post-btn" data-i18n="feature.vtt.vtt-local.rollPost">Roll &amp; Post</button>
              <button class="btn btn-sm" id="vtt-roll-only-btn" data-i18n="feature.vtt.vtt-local.rollOnly">Roll Only</button>
            </div>
            <div id="vtt-roll-output" class="mt-1" style="min-height:3rem;padding:0.2rem 0;"></div>
          </div>

          <!-- Timers -->
          <div class="vtt-panel vtt-card">
            <div class="vtt-card-header">
              <span class="vtt-card-title" style="font-size:1.05rem;" data-i18n="feature.vtt.vtt-local.sceneTimers">⏱️ Scene Timers</span>
            </div>
            <div id="vttTimerList"></div>
            <div class="vtt-btn-row" style="margin-top:0.5rem;">
              <button class="btn btn-sm" id="vtt-add-timer" data-i18n="feature.vtt.vtt-local.addTimer">+ Add Timer</button>
              <button class="btn btn-sm" id="vtt-scene-end" data-i18n="feature.vtt.vtt-local.sceneEnd">🌅 Scene End</button>
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
  renderMiniTracker();

  // Normalize and set initial characters
  const chars = getCharacters();
  vttStore.updateCharacters(chars);
  vttStore.updateTimers(getState().timers || []);
  vttStore.setConnectionStatus('local');

  if (voiceUnsubscribe) voiceUnsubscribe();
  voiceUnsubscribe = onVoiceClientsChanged((clients) => {
    vttStore.updateVoiceClients(clients);
  });

  attachEvents();

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

  console.log('[VTT Local] Rendered with reactive store (JRPG style + selection + detail panel)');
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
  docEventListeners.forEach(({event, handler}) => {
    document.removeEventListener(event, handler);
  });
  docEventListeners = [];
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