/**
 * Spellcraft & Magic – Unified interface for all magical traditions
 *
 * "The coin that never spends is the one you don't remember taking."
 * – Serafine of the Velvet Touch
 *
 * Features:
 * - Character tracks (Obligation, Corruption, Leash, Mental Strain, Shadow/Shame/Identity)
 * - Path-specific components: Rites, Spellbook, Crafting, Calculator, Summoning, Monks, Cantor
 * - Crafting (Hedge Gifts, Quick Workings, Rituals) is available to ALL characters
 * - TAGS Calculator for Free Casters (and as a learning tool for others)
 * - Unified character selection via VTT
 */

import { vttStore } from '../../core/vtt-store.js';
import { getState, getCharacter, updateCharacter, addCharacter, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml, generateId, safeParseInt } from '../../core/utils.js';

// ─── Import sub‑components ──────────────────────────────────
import { renderRites } from './components/rites.js';
import { renderSpellbook } from './components/spellbook.js';
import { renderCalculator } from './components/calculator.js';
import { renderTrackers } from './components/trackers.js';
import { renderSummoning } from './components/summoning.js';
import { renderWitchcraft } from './components/witchcraft.js';
import { renderMonks } from './components/monks.js';
import { renderCantor } from './components/cantor.js';

// ============================================================
// CONSTANTS – Path metadata for the UI
// ============================================================

const PATH_META = {
    'none': {
        label: 'Mundane',
        icon: '👤',
        color: 'var(--text3)',
        description: 'No magical path chosen. Crafting (Hedge Gifts, rituals) is still available.'
    },
    'free-caster': {
        label: 'Free Caster',
        icon: '🔮',
        color: '#8e44ad',
        description: 'Weave the raw Weave using TAGS. No patron required – only will and grammar.'
    },
    'runekeeper': {
        label: 'Runekeeper',
        icon: '📜',
        color: '#d4af37',
        description: 'Bound to a single Patron. Your Codex and Thiasos are the instruments of your covenant.'
    },
    'invoker': {
        label: 'Invoker',
        icon: '🎴',
        color: '#e67e22',
        description: 'Carry Symbols from multiple Patrons. Power is borrowed, interest is steep.'
    },
    'cantor': {
        label: 'Cantor',
        icon: '🎵',
        color: '#6b4c9a',
        description: 'Your voice is the instrument. Sing the old songs, and the Weave answers – at a cost.'
    },
    'witch': {
        label: 'Witch',
        icon: '🧹',
        color: '#27ae60',
        description: 'Threshold magic, hedge gifts, and the quiet work of names. The hedge keeps the wolves at bay.'
    },
    'psion': {
        label: 'Psion',
        icon: '🧠',
        color: '#2980b9',
        description: 'The mind is the only focus. Mental Strain is the price of bending reality with will alone.'
    },
    'summoner': {
        label: 'Summoner',
        icon: '👁️',
        color: '#c0392b',
        description: 'Bind spirits with the Leash. Negotiate, command, and hope the price is worth the service.'
    },
    'monk': {
        label: 'Monk',
        icon: '🧘',
        color: '#f39c12',
        description: 'The body is a temple. The breath is a weapon. Stillness is the greatest disguise.'
    }
};

// ============================================================
// STYLES (injected once)
// ============================================================

const STYLE_ID = 'spellcraft-styles';

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .spellcraft-tab {
            position: relative;
            transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
            background: transparent;
            border-color: transparent;
            color: var(--text3);
        }
        .spellcraft-tab:hover {
            color: var(--text);
            background: var(--bg3);
        }
        .spellcraft-tab.active {
            background: var(--gold);
            border-color: var(--gold);
            color: #1a1400;
            font-weight: 600;
        }
        .spellcraft-content-inner {
            animation: spellcraft-fade-in 0.15s ease;
        }
        @keyframes spellcraft-fade-in {
            from { opacity: 0; transform: translateY(2px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .spellcraft-loading {
            padding: 2rem;
            text-align: center;
            color: var(--text3);
            font-size: 0.85rem;
        }
        .spellcraft-path-desc {
            color: var(--text3);
            font-size: 0.7rem;
            max-width: 320px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .spellcraft-patron-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.2rem;
            font-size: 0.75rem;
            padding: 0.05rem 0.5rem;
            border-radius: 10px;
            background: var(--bg3);
            border: 1px solid var(--border);
            color: var(--gold);
        }
    `;
    document.head.appendChild(style);
}

// ============================================================
// STATE
// ============================================================

let container = null;
let eventListeners = [];
let activeTab = 'crafting';
let renderToken = 0; // guards against a slow async tab render landing after a newer one started

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
    // Handled by the rites component's data-driven lookup. Kept as a
    // pass-through for backward compatibility with anything still importing it.
    return [];
}

// ============================================================
// RENDER – Main
// ============================================================

export function render(el) {
    container = el;
    if (!container) return;

    ensureStyles();

    const char = getCharacterData();
    if (!char) {
        container.innerHTML = `
            <div class="spellcraft-empty" style="padding:2rem;text-align:center;color:var(--text3);background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border);">
                <div style="font-size:3rem;">🧙</div>
                <h2 style="margin:0.5rem 0;">Select a Character</h2>
                <p style="margin:0 0 0.5rem;">Go to the VTT and click a character card to view their magical abilities.</p>
                <button class="btn btn-gold" id="go-to-vtt-btn">🎯 Go to VTT</button>
            </div>
        `;
        attachEvents();
        return;
    }

    const path = char.magicPath || 'none';
    const pathMeta = PATH_META[path] || PATH_META['none'];
    const patron = char.patron || null;
    const name = char.name || 'Unnamed Character';

    const tabs = getAvailableTabs(char);
    if (!tabs.some(t => t.id === activeTab)) {
        activeTab = 'crafting';
    }

    container.innerHTML = `
        <div class="spellcraft-container" style="display:flex;flex-direction:column;gap:0.8rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <header class="spellcraft-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;border-bottom:2px solid var(--border);padding-bottom:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                    <span style="font-size:1.8rem;">${escHtml(pathMeta.icon)}</span>
                    <div>
                        <h1 class="page-title" style="margin:0;font-size:1.2rem;">${escHtml(name)}</h1>
                        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;font-size:0.8rem;color:var(--text2);">
                            <span style="font-weight:600;color:${pathMeta.color};">${escHtml(pathMeta.label)}</span>
                            ${patron ? `<span class="spellcraft-patron-pill">🔮 ${escHtml(patron)}</span>` : ''}
                            <span class="spellcraft-path-desc" title="${escHtml(pathMeta.description)}">${escHtml(pathMeta.description)}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-ghost" id="spellcraft-refresh" title="Refresh">↻</button>
                    <button class="btn btn-sm btn-secondary" id="spellcraft-change-path" title="Change magic path">⚙️ Path</button>
                </div>
            </header>

            <!-- ─── Tracks ─────────────────────────────────────── -->
            <div id="trackers-container" class="panel" style="padding:0.3rem 0.5rem;background:var(--bg2);border-radius:var(--radius);"></div>

            <!-- ─── Tabs ────────────────────────────────────────── -->
            <div class="spellcraft-tabs" style="display:flex;gap:0.2rem;border-bottom:1px solid var(--border);padding-bottom:0.1rem;flex-wrap:wrap;">
                ${renderTabButtons(tabs)}
            </div>

            <!-- ─── Tab Content ────────────────────────────────── -->
            <div id="spellcraft-content" class="spellcraft-content" style="min-height:300px;">
                <div class="spellcraft-loading">Loading…</div>
            </div>

            <!-- ─── Footer / Quick Reference ────────────────────── -->
            <div class="spellcraft-footer" style="display:grid;grid-template-columns:2fr 1fr;gap:0.5rem;border-top:1px solid var(--border);padding-top:0.5rem;font-size:0.7rem;color:var(--text3);">
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <span>📖 <strong>Path:</strong> ${escHtml(pathMeta.label)}</span>
                    ${patron ? `<span>🔮 <strong>Patron:</strong> ${escHtml(patron)}</span>` : ''}
                    <span>📊 <strong>Tracks:</strong> ${escHtml(getTrackSummary(char))}</span>
                </div>
                <div style="text-align:right;font-style:italic;">
                    "The Weave remembers." – Lysandra
                </div>
            </div>

        </div>
    `;

    renderAll();
    attachEvents();
}

// ============================================================
// TAB SYSTEM
// ============================================================

function renderTabButtons(tabs) {
    return tabs.map(tab => `
        <button class="spellcraft-tab btn btn-sm${activeTab === tab.id ? ' active' : ''}" data-tab="${tab.id}">
            ${tab.icon} ${tab.label}
        </button>
    `).join('');
}

function getAvailableTabs(char) {
    const path = char.magicPath || 'none';
    const tabs = [];

    // ─── Always show Crafting (Hedge Gifts, Quick Workings, Rituals) ───
    tabs.push({ id: 'crafting', label: 'Crafting', icon: '🌿' });

    // ─── Always show Spellbook ──────────────────────────────────
    tabs.push({ id: 'spellbook', label: 'Spellbook', icon: '📚' });

    // ─── Path-specific tabs ─────────────────────────────────────
    if (path === 'free-caster') {
        tabs.push({ id: 'calculator', label: 'Calculator', icon: '🔮' });
    }

    // Runekeeper and Invoker share the Rites tab
    if (path === 'runekeeper' || path === 'invoker') {
        tabs.push({ id: 'rites', label: 'Rites', icon: '📜' });
    }

    // Cantor gets its own dedicated tab with corruption and songs
    if (path === 'cantor') {
        tabs.push({ id: 'cantor', label: 'Cantor', icon: '🎵' });
    }

    if (path === 'summoner') {
        tabs.push({ id: 'summoning', label: 'Summoning', icon: '👁️' });
    }

    // Monk is not a path gate on its own — it's available the moment a
    // character has committed to the monastic path (magicPath === 'monk'),
    // OR has already chosen a tradition. Either signal is enough to surface
    // the tab; the monks component itself gates further on learned talents.
    if (path === 'monk' || char.monasticTradition) {
        tabs.push({ id: 'monks', label: 'Monks', icon: '🧘' });
    }

    return tabs;
}

// Renders the active tab's content directly into the LIVE #spellcraft-content
// element (never a detached scratch node), and properly awaits async
// components (Calculator, Cantor, Summoning) before anything else touches
// the DOM. A render token guards against a slow render finishing after the
// user has already switched tabs or characters.
async function renderActiveTabContent() {
    const contentEl = document.getElementById('spellcraft-content');
    if (!contentEl) return;
    const char = getCharacterData();
    if (!char) return;

    const myToken = ++renderToken;
    contentEl.innerHTML = `<div class="spellcraft-loading">Loading…</div>`;

    const wrapper = document.createElement('div');
    wrapper.className = 'spellcraft-content-inner';

    try {
        switch (activeTab) {
            case 'crafting':
                renderWitchcraft(wrapper);
                break;
            case 'spellbook':
                renderSpellbook(wrapper);
                break;
            case 'calculator':
                await renderCalculator(wrapper);
                break;
            case 'rites':
                renderRites(wrapper);
                break;
            case 'cantor':
                await renderCantor(wrapper);
                break;
            case 'summoning':
                await renderSummoning(wrapper);
                break;
            case 'monks':
                renderMonks(wrapper);
                break;
            default:
                wrapper.innerHTML = `<p style="color:var(--text3);">Select a tab to view its content.</p>`;
        }
    } catch (err) {
        console.error(`Spellcraft: error rendering tab "${activeTab}":`, err);
        wrapper.innerHTML = `<p style="color:var(--red);">Failed to load this tab. Check the console for details.</p>`;
    }

    // If the user switched tabs/characters while we were awaiting, drop
    // this result on the floor instead of overwriting whatever's current.
    if (myToken !== renderToken) return;

    contentEl.innerHTML = '';
    contentEl.appendChild(wrapper);
}

function renderAll() {
    const char = getCharacterData();
    if (!char) return;

    // Render trackers
    const trackersEl = document.getElementById('trackers-container');
    if (trackersEl) renderTrackers(trackersEl);

    // Rebuild the tab bar (in case path/tradition changed which tabs show)
    const tabs = getAvailableTabs(char);
    if (!tabs.some(t => t.id === activeTab)) {
        activeTab = 'crafting';
    }
    const tabsContainer = document.querySelector('.spellcraft-tabs');
    if (tabsContainer) {
        tabsContainer.innerHTML = renderTabButtons(tabs);
    }

    // Render the active tab's content (async-safe, into the live element)
    renderActiveTabContent();
}

function switchTab(tabId) {
    if (tabId === activeTab) return;
    activeTab = tabId;

    const tabsContainer = document.querySelector('.spellcraft-tabs');
    if (tabsContainer) {
        tabsContainer.querySelectorAll('.spellcraft-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === activeTab);
        });
    }

    renderActiveTabContent();
}

// ============================================================
// TRACK SUMMARY
// ============================================================

function getTrackSummary(char) {
    const path = char.magicPath || 'none';
    const parts = [];

    if (path === 'runekeeper' || path === 'invoker') {
        const obligation = char.obligation || 0;
        const maxObligation = (char.spirit || 1) + (char.presence || 1);
        parts.push(`Obligation ${obligation}/${maxObligation}`);
    }

    if (path === 'cantor') {
        const corruption = char.corruption || 0;
        const maxCorruption = char.corruptionMax || (char.spirit || 1);
        parts.push(`Corruption ${corruption}/${maxCorruption}`);
    }

    if (path === 'summoner') {
        const leash = char.leash || 0;
        const maxLeash = char.leashMax || 4;
        const spirits = (char.boundSpirits || []).length;
        parts.push(`Leash ${leash}/${maxLeash} · ${spirits} spirits`);
    }

    if (path === 'psion') {
        const strain = char.mentalStrain || 0;
        const maxStrain = char.mentalStrainMax || (char.spirit || 1);
        parts.push(`Mental Strain ${strain}/${maxStrain}`);
    }

    if (path === 'witch') {
        const shadow = char.witch?.prices?.shadow || 0;
        const shame = char.witch?.prices?.shame || 0;
        const idStrain = char.witch?.prices?.identityStrain || 0;
        parts.push(`Shadow ${shadow} · Shame ${shame} · Identity ${idStrain}`);
    }

    if (path === 'monk' || char.monasticTradition) {
        const breath = char.breathState || 'entering';
        const tier = char.monkCorruptionTier || 0;
        parts.push(`Breath: ${breath} · Corruption Tier ${tier}`);
    }

    return parts.join(' · ') || 'No active tracks';
}

// ============================================================
// EVENTS
// ============================================================

function attachEvents() {
    // Remove old listeners
    eventListeners.forEach(({ event, handler }) => {
        if (container) container.removeEventListener(event, handler);
    });
    eventListeners = [];

    const clickHandler = (e) => {
        const tabBtn = e.target.closest('.spellcraft-tab');
        if (tabBtn) {
            switchTab(tabBtn.dataset.tab);
            return;
        }

        const target = e.target.closest('button, [id]');
        if (!target) return;

        switch (target.id) {
            case 'go-to-vtt-btn':
                window.location.hash = 'vtt';
                break;
            case 'spellcraft-refresh':
                renderAll();
                showToast('🔄 Refreshed', 'info');
                break;
            case 'spellcraft-change-path':
                changeMagicPath();
                break;
        }
    };

    if (container) {
        container.addEventListener('click', clickHandler);
        eventListeners.push({ event: 'click', handler: clickHandler });
    }

    // Listen for character selection changes (from VTT)
    const selectionHandler = () => {
        if (container) render(container);
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

    const paths = ['none', 'free-caster', 'runekeeper', 'invoker', 'cantor', 'witch', 'psion', 'summoner', 'monk'];
    const current = char.magicPath || 'none';
    const options = paths.map(p => {
        const meta = PATH_META[p];
        return `${p === current ? '▶ ' : '  '} ${p}: ${meta.label} – ${meta.description}`;
    }).join('\n');

    const choice = prompt(
        `Change magic path for ${char.name}:\n\n${options}\n\nEnter the new path (e.g., "witch" or "none"):`,
        current
    );

    if (!choice || choice === current) return;

    const trimmed = choice.trim().toLowerCase();
    if (!paths.includes(trimmed)) {
        showToast(`Invalid path. Choose from: ${paths.join(', ')}`, 'error');
        return;
    }

    const result = updateCharacter(char.id, { magicPath: trimmed });
    if (result) {
        activeTab = 'crafting';
        showToast(`⚙️ Magic path changed to ${PATH_META[trimmed].label}`, 'success');
        render(container);
    } else {
        showToast('Failed to update character.', 'error');
    }
}

// ============================================================
// DESTROY
// ============================================================

export function destroy() {
    if (container) {
        eventListeners.forEach(({ event, handler }) => {
            container.removeEventListener(event, handler);
        });
        eventListeners = [];
        container.innerHTML = '';
        container = null;
    }
}

// ============================================================
// EXPORTS
// ============================================================

export { saveCharacter };

export default {
    render,
    destroy,
};

export { render as renderSpellcraft, destroy as destroySpellcraft };