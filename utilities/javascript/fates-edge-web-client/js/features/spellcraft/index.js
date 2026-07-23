/**
 * Spellcraft & Magic – Unified interface for all magical traditions
 * 
 * Displays:
 * - Character's magic path, patron, tracks
 * - Patron-specific Rites / Songs / Arts / Spirits
 * - Spellbook (custom spells)
 * - TAGS Calculator for Free Casters
 * - Trackers (Obligation, Corruption, Leash, Mental Strain, etc.)
 */

import { vttStore } from '../../core/vtt-store.js';
import { getState, getCharacter, updateCharacter, addCharacter, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml, generateId, safeParseInt } from '../../core/utils.js';

// Import sub‑components
import { renderRites } from './components/rites.js';
import { renderSpellbook } from './components/spellbook.js';
import { renderCalculator } from './components/calculator.js';
import { renderTrackers } from './components/trackers.js';
import { renderSummoning } from './components/summoning.js';

// ============================================================
// DATA – Patrons and their Rites (extracted from grimoire)
// ============================================================
const PATRON_DATA = {
  'Grimmir': {
    name: 'Grimmir',
    domain: 'Wild',
    rites: [
      { name: 'The Speaking Seed', cost: 4, effect: 'Commune with local plant life.', type: 'Low' },
      { name: 'The Thornveil', cost: 7, effect: 'Raise a living barrier.', type: 'Standard' },
      { name: 'The World\'s Wound', cost: 13, obligation: 7, effect: 'Heal a blighted place.', type: 'Advanced' }
    ],
    corruptionTable: [
      { tier: 1, benefit: '+1 die to Nature rolls', cost: 'Hair grows moss' },
      { tier: 2, benefit: 'Speak with beasts', cost: 'Eat only raw food' }
    ]
  },
  'Mykkiel': {
    name: 'Mykkiel',
    domain: 'Covenant',
    rites: [
      { name: 'Rite of Hallowed Ground', cost: 5, effect: 'Create sacred space.', type: 'Low' },
      { name: 'The Covenant Seal', cost: 9, effect: 'Bind a covenant with penalties.', type: 'Standard' },
      { name: 'Divine Judgment', cost: 13, obligation: 7, effect: 'Pronounce judgment on a breaker.', type: 'Advanced' }
    ]
  },
  // ... add others from grimoire (Morag, Inaea, Isoka, etc.)
};

// TAGS reference (from grimoire)
const TAGS_REFERENCE = {
  'Burning': { category: 'Elemental', mod: 1 },
  'Freezing': { category: 'Elemental', mod: 1 },
  'Storm': { category: 'Elemental', mod: 1 },
  'Stone': { category: 'Elemental', mod: 1 },
  'Wave': { category: 'Elemental', mod: 1 },
  'Wind': { category: 'Elemental', mod: 1 },
  'Force': { category: 'Force', mod: 1 },
  'Area': { category: 'Force', mod: 1 },
  'Strike': { category: 'Force', mod: 1 },
  'Wall': { category: 'Force', mod: 1 },
  'Bind': { category: 'Force', mod: 1 },
  'Dispel': { category: 'Force', mod: 1 },
  'Veil': { category: 'Mind/Illusion', mod: 1 },
  'Scry': { category: 'Mind/Illusion', mod: 1 },
  'Memory': { category: 'Mind/Illusion', mod: 1 },
  'Command': { category: 'Mind/Illusion', mod: 1 },
  'Fear': { category: 'Mind/Illusion', mod: 1 },
  'HEAL': { category: 'Life/Body', mod: 1 },
  'Purify': { category: 'Life/Body', mod: 1 },
  'Strengthen': { category: 'Life/Body', mod: 1 },
  'Waken': { category: 'Life/Body', mod: 1 },
  'Beast': { category: 'Life/Body', mod: 1 },
  'Leap': { category: 'Space/Motion', mod: 2 },
  'Fold': { category: 'Space/Motion', mod: 2 },
  'Gate': { category: 'Space/Motion', mod: 2 },
  'Gravity': { category: 'Space/Motion', mod: 2 },
  'Create': { category: 'Creation', mod: 2 },
  'Summon': { category: 'Creation', mod: 2 },
  'Transmute': { category: 'Creation', mod: 2 },
  'Animate': { category: 'Creation', mod: 2 },
  'Sense': { category: 'Utility', mod: 1 },
  'Reveal': { category: 'Utility', mod: 1 },
  'Light': { category: 'Utility', mod: 1 },
  'Shadow': { category: 'Utility', mod: 1 },
  'Silence': { category: 'Utility', mod: 1 },
  'Protect': { category: 'Utility', mod: 1 },
  'Counter': { category: 'Reaction', mod: 1 },
  'Reflect': { category: 'Reaction', mod: 2 },
  'Store': { category: 'Utility', mod: 2 },
  'Curse': { category: 'Affliction', mod: 2 },
  'Bless': { category: 'Affliction', mod: 1 },
};

// ============================================================
// STATE
// ============================================================
let container = null;
let selectedCharId = null;
let eventListeners = [];

// ============================================================
// HELPERS (exported for sub‑components)
// ============================================================

export function getCharacterData() {
  const id = vttStore.getSelectedCharacterId();
  if (!id) {
    showToast('Select a character first.', 'error');
    return null;
  }
  const char = getCharacter(id);
  if (!char) {
    showToast('Character not found.', 'error');
    return null;
  }
  return char;
}

function saveCharacter(updates) {
  const id = vttStore.getSelectedCharacterId();
  if (!id) return false;
  const result = updateCharacter(id, updates);
  if (result) {
    renderAll();
    return true;
  }
  return false;
}

export function getPatronRites(patronName) {
  const patron = PATRON_DATA[patronName];
  return patron ? patron.rites : [];
}

// ============================================================
// RENDER – Main
// ============================================================

export function render(el) {
  container = el;
  if (!container) return;

  // Ensure we have a character selected
  const char = getCharacterData();
  if (!char) {
    container.innerHTML = `
      <div class="panel" style="padding:2rem;text-align:center;color:var(--text3);">
        <div style="font-size:3rem;">🧙</div>
        <h2>Select a Character</h2>
        <p>Go to the VTT and click a character card to view their magical abilities.</p>
        <button class="btn btn-gold" id="go-to-vtt-btn">Go to VTT</button>
      </div>
    `;
    attachEvents();
    return;
  }

  // Build the UI based on magic path
  const path = char.magicPath || 'none';
  const patron = char.patron || null;
  const isFreeCaster = path === 'free-caster';
  const hasPatron = patron && PATRON_DATA[patron];

  container.innerHTML = `
    <div class="spellcraft-header">
      <div class="flex-between" style="flex-wrap:wrap;gap:0.5rem;">
        <div>
          <h1 class="page-title" style="margin:0;">🧙 Spellcraft</h1>
          <p class="page-sub" style="margin:0.2rem 0 0;">
            ${escHtml(char.name)} – ${path ? path.toUpperCase() : 'No Magic Path'}
            ${patron ? `· Patron: ${escHtml(patron)}` : ''}
          </p>
        </div>
        <div style="display:flex;gap:0.4rem;">
          <button class="btn btn-sm btn-ghost" id="spellcraft-refresh" title="Refresh">↻</button>
          <button class="btn btn-sm" id="spellcraft-change-path">⚙️ Change Path</button>
        </div>
      </div>
    </div>

    <!-- Tracks -->
    <div id="trackers-container" class="panel" style="margin-bottom:1rem;"></div>

    <!-- Main Grid -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.2rem;">
      <!-- Left Column: Spellbook / Rites / Calculator -->
      <div style="display:flex;flex-direction:column;gap:1rem;">
        <!-- Rites / Songs / Arts (depending on path) -->
        <div id="rites-container" class="panel"></div>

        <!-- Spellbook (custom spells) -->
        <div id="spellbook-container" class="panel"></div>

        <!-- TAGS Calculator (for Free Casters only) -->
        ${isFreeCaster ? `<div id="calculator-container" class="panel"></div>` : ''}

        <!-- Summoning (for Summoners) -->
        ${path === 'summoner' ? `<div id="summoning-container" class="panel"></div>` : ''}
      </div>

      <!-- Right Column: Info / Quick Reference -->
      <div style="display:flex;flex-direction:column;gap:1rem;">
        <div class="panel" style="background:var(--bg2);">
          <h3 style="margin-top:0;">📖 Quick Reference</h3>
          <div id="quick-ref" style="font-size:0.9rem;color:var(--text2);">
            <p>Select a character to view their magical abilities.</p>
            <p><strong>Path:</strong> ${escHtml(path)}</p>
            ${patron ? `<p><strong>Patron:</strong> ${escHtml(patron)}</p>` : ''}
          </div>
        </div>
        <div class="panel" style="background:var(--bg2);">
          <h3 style="margin-top:0;">⚡ TAGS Reference</h3>
          <div id="tags-reference" style="max-height:300px;overflow-y:auto;font-size:0.8rem;">
            ${Object.entries(TAGS_REFERENCE).map(([tag, info]) =>
              `<span class="tag-badge" style="display:inline-block;padding:0.05rem 0.4rem;margin:0.1rem;border-radius:3px;background:var(--bg4);border:1px solid var(--border);">${tag} (${info.mod})</span>`
            ).join(' ')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Render sub-components
  renderAll();
  attachEvents();
}

function renderAll() {
  // Render trackers
  const trackersEl = document.getElementById('trackers-container');
  if (trackersEl) renderTrackers(trackersEl);

  // Render rites / songs / arts
  const ritesEl = document.getElementById('rites-container');
  if (ritesEl) renderRites(ritesEl);

  // Render spellbook
  const spellbookEl = document.getElementById('spellbook-container');
  if (spellbookEl) renderSpellbook(spellbookEl);

  // Render calculator (if free caster)
  const calcEl = document.getElementById('calculator-container');
  if (calcEl) renderCalculator(calcEl);

  // Render summoning (if summoner)
  const summonEl = document.getElementById('summoning-container');
  if (summonEl) renderSummoning(summonEl);
}

// ============================================================
// EVENTS
// ============================================================

function attachEvents() {
  // Remove old listeners
  eventListeners.forEach(({event, handler}) => {
    container.removeEventListener(event, handler);
  });
  eventListeners = [];

  const clickHandler = (e) => {
    const target = e.target.closest('button, [id]');
    if (!target) return;
    const id = target.id;

    switch (id) {
      case 'go-to-vtt-btn':
        window.location.hash = 'vtt';
        break;
      case 'spellcraft-refresh':
        renderAll();
        showToast('Refreshed', 'info');
        break;
      case 'spellcraft-change-path':
        changeMagicPath();
        break;
      // Add more actions here (add spell, delete spell, etc.)
    }
  };

  container.addEventListener('click', clickHandler);
  eventListeners.push({ event: 'click', handler: clickHandler });

  // Listen for character selection changes (from VTT)
  const selectionHandler = () => {
    render(container);
  };
  document.addEventListener('characterSelected', selectionHandler);
  eventListeners.push({ event: 'characterSelected', handler: selectionHandler });
}

// ============================================================
// ACTIONS
// ============================================================

function changeMagicPath() {
  const char = getCharacterData();
  if (!char) return;

  const paths = ['none', 'runekeeper', 'invoker', 'cantor', 'witch', 'psion', 'summoner', 'free-caster'];
  const current = char.magicPath || 'none';
  const idx = paths.indexOf(current);
  const next = paths[(idx + 1) % paths.length];
  const result = updateCharacter(char.id, { magicPath: next });
  if (result) {
    showToast(`Magic path changed to ${next}`, 'success');
    renderAll();
  }
}

// ============================================================
// DESTROY
// ============================================================

export function destroy() {
  if (container) {
    eventListeners.forEach(({event, handler}) => {
      container.removeEventListener(event, handler);
    });
    eventListeners = [];
    container.innerHTML = '';
    container = null;
  }
}

// ============================================================
// EXPORTS (for sub‑components)
// ============================================================

export { saveCharacter };

export default {
  render,
  destroy,
};

export { render as renderSpellcraft, destroy as destroySpellcraft };