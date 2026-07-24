/**
 * Encounters feature - Manage combat and social encounters
 * Includes quick reference from The Witnessed Prey
 * ✅ Integrated with Bestiary (panel below encounter list, left column)
 */

import { getState, saveState } from '../../core/state.js';
import { escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { logToSession, addVTTEvent } from '../gm-tools/index.js';
// Adjust the path to match your actual bestiary location
// Example: if bestiary.js is in js/features/bestiary/bestiary.js
import { loadBestiaryData, loadWikiData, addCreatureAsAdversary } from './bestiary.js';

let container = null;
let bestiaryData = [];
let filteredBestiary = [];

// Quick reference data (unchanged)
const QUICK_ADVERSARIES = [
    // ... (same as before)
];

const ADVERSARY_MOVES = [
    // ... (same as before)
];

const QUICK_TIMERS = [
    // ... (same as before)
];

// ============================================================
// RENDER
// ============================================================

export async function render(el) {
    container = el;
    
    // Load bestiary data
    try {
        bestiaryData = await loadBestiaryData();
        await loadWikiData(); // optional
    } catch (e) {
        console.warn('Bestiary data not available:', e);
        bestiaryData = [];
    }
    filteredBestiary = bestiaryData;

    container.innerHTML = `
        <div class="encounters-layout">
            <header class="encounters-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem;">
                <div>
                    <h1 class="page-title" style="margin:0;">⚔️ Encounters</h1>
                    <p class="page-sub" style="margin:0.2rem 0 0;">Build encounters, track combat, and reference adversaries.</p>
                </div>
                <button class="btn btn-gold" id="add-encounter-btn">+ New Encounter</button>
            </header>

            <!-- Main grid: left column (encounters + bestiary) | right column (quick refs) -->
            <div class="encounters-grid" style="display:grid;grid-template-columns:2fr 1fr;gap:1.5rem;align-items:start;">
                <!-- Left Column -->
                <div class="encounters-left" style="display:flex;flex-direction:column;gap:1rem;">
                    <!-- Saved Encounters -->
                    <div class="panel">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;">
                            <h3 style="margin:0;">📋 Saved Encounters</h3>
                            <div style="display:flex;gap:0.3rem;">
                                <input type="text" id="encounter-search" placeholder="🔍 Search…" style="font-size:0.8rem;padding:0.2rem 0.5rem;" />
                            </div>
                        </div>
                        <div id="encounter-list"></div>
                    </div>

                    <!-- Bestiary (full width below encounters) -->
                    <div class="panel bestiary-panel">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;">
                            <h3 style="margin:0;">📖 Bestiary</h3>
                            <div style="display:flex;gap:0.3rem;">
                                <input type="text" id="bestiary-search" placeholder="🔍 Search creatures…" style="font-size:0.8rem;padding:0.2rem 0.5rem;" />
                                <button class="btn btn-sm btn-ghost" id="bestiary-refresh" title="Refresh data">↻</button>
                            </div>
                        </div>
                        <div id="bestiary-list" style="max-height:300px;overflow-y:auto;display:flex;flex-wrap:wrap;gap:0.3rem;padding:0.2rem 0;"></div>
                    </div>
                </div>

                <!-- Right Column: Quick Reference (unchanged) -->
                <div class="encounters-sidebar" style="display:flex;flex-direction:column;gap:0.8rem;">
                    <!-- Quick Adversaries -->
                    <div class="panel">
                        <h3 style="margin-top:0;">🃏 Quick Adversaries</h3>
                        <div id="quick-adversaries" style="font-size:0.85rem;max-height:300px;overflow-y:auto;"></div>
                    </div>
                    <!-- Adversary Moves -->
                    <div class="panel">
                        <h3 style="margin-top:0;">🎯 Adversary Moves (SB Costs)</h3>
                        <div id="adversary-moves" style="font-size:0.8rem;max-height:200px;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:0.2rem 0.5rem;"></div>
                    </div>
                    <!-- Quick Timers -->
                    <div class="panel">
                        <h3 style="margin-top:0;">⏱️ Quick Timers</h3>
                        <div id="quick-timers" style="font-size:0.8rem;"></div>
                    </div>
                    <!-- Threat Level Scaling -->
                    <div class="panel">
                        <h3 style="margin-top:0;">📊 Threat Level Scaling</h3>
                        <div style="font-size:0.75rem;display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.1rem;">
                            <div><strong>TL</strong></div><div><strong>Use</strong></div><div><strong>Bonus</strong></div>
                            <div>0</div><div>Flavor</div><div>-1</div>
                            <div>1</div><div>Minion</div><div>+0</div>
                            <div>2</div><div>Elite</div><div>+1</div>
                            <div>3</div><div>Mini-boss</div><div>+2</div>
                            <div>4+</div><div>Major Boss</div><div>+3</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    renderQuickReference();
    renderEncounters();
    renderBestiary();
    attachEvents();
}

// ============================================================
// RENDER QUICK REFERENCE (unchanged)
// ============================================================

function renderQuickReference() {
    // Adversaries
    const advEl = document.getElementById('quick-adversaries');
    if (advEl) {
        advEl.innerHTML = QUICK_ADVERSARIES.map(a => `
            <div style="background:var(--bg3);padding:0.3rem 0.5rem;border-radius:4px;margin-bottom:0.3rem;border-left:3px solid var(--gold);cursor:pointer;" class="quick-adversary" data-name="${escHtml(a.name)}" data-body="${escHtml(a.body)}">
                <div style="font-weight:600;font-size:0.85rem;">${escHtml(a.name)}</div>
                <div style="font-size:0.75rem;color:var(--text2);">${escHtml(a.body)}</div>
            </div>
        `).join('');
        
        advEl.querySelectorAll('.quick-adversary').forEach(el => {
            el.addEventListener('click', () => {
                const name = el.dataset.name;
                const body = el.dataset.body;
                createEncounterFromAdversary(name, body);
            });
        });
    }
    
    // Adversary Moves
    const movesEl = document.getElementById('adversary-moves');
    if (movesEl) {
        movesEl.innerHTML = ADVERSARY_MOVES.map(m => `
            <div style="padding:0.1rem 0.2rem;border-bottom:1px solid var(--border);">
                <span style="font-weight:600;color:var(--gold);">${m.cost} SB</span>
                <span style="color:var(--text);">${escHtml(m.name)}</span>
                <span style="font-size:0.65rem;color:var(--text3);display:block;">${escHtml(m.effect)}</span>
            </div>
        `).join('');
    }
    
    // Quick Timers
    const timersEl = document.getElementById('quick-timers');
    if (timersEl) {
        timersEl.innerHTML = QUICK_TIMERS.map(t => `
            <div style="padding:0.15rem 0;border-bottom:1px solid var(--border);">
                <span style="font-weight:600;color:var(--accent);">${escHtml(t.name)}</span>
                <span style="font-size:0.7rem;color:var(--text2);display:block;">${escHtml(t.effect)}</span>
            </div>
        `).join('');
    }
}

// ============================================================
// RENDER ENCOUNTERS (unchanged)
// ============================================================

function renderEncounters() {
    const el = document.getElementById('encounter-list');
    if (!el) return;
    const state = getState();
    const encounters = state.encounters || [];
    
    const search = document.getElementById('encounter-search')?.value?.toLowerCase() || '';
    let filtered = encounters;
    if (search) {
        filtered = encounters.filter(e => 
            (e.title || '').toLowerCase().includes(search) || 
            (e.body || '').toLowerCase().includes(search)
        );
    }
    
    if (filtered.length === 0) {
        el.innerHTML = `
            <div style="text-align:center;padding:2rem;color:var(--text3);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">⚔️</div>
                <div>${encounters.length === 0 ? 'No encounters yet. Click "New Encounter" to start.' : 'No matches found.'}</div>
            </div>
        `;
        return;
    }
    
    el.innerHTML = filtered.map(e => {
        const statusColor = e.status === 'active' ? 'var(--green)' : 'var(--text2)';
        const difficultyStars = '⭐'.repeat(Math.min(e.difficulty || 3, 5)) + '☆'.repeat(Math.max(0, 5 - (e.difficulty || 3)));
        return `
            <div class="encounter-item" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:0.6rem 1rem;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border);margin-bottom:0.4rem;transition:border-color 0.2s;">
                <div class="info" style="flex:1;min-width:150px;cursor:pointer;" onclick="window.toggleEncounterBody('${e.id}')">
                    <div class="name" style="font-weight:600;">${escHtml(e.title)}</div>
                    <div class="meta" style="font-size:0.8rem;color:var(--text2);">
                        ${difficultyStars} · ${e.location || 'No location'} · <span style="color:${statusColor}">${e.status || 'draft'}</span>
                    </div>
                    <div id="enc-body-${e.id}" style="display:none;margin-top:0.3rem;padding:0.3rem 0.5rem;background:var(--bg2);border-radius:4px;font-size:0.8rem;color:var(--text);">
                        ${e.body || 'No description.'}
                        ${e.adversaries && e.adversaries.length > 0 ? `<div style="margin-top:0.2rem;font-weight:600;color:var(--gold);">Adversaries: ${e.adversaries.map(a => a.name).join(', ')}</div>` : ''}
                    </div>
                </div>
                <div class="actions" style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-primary encounter-edit-btn" data-id="${e.id}" title="Edit">✏️</button>
                    <button class="btn btn-xs btn-green encounter-combat-btn" data-id="${e.id}" title="Combat Tracker">⚔️</button>
                    <button class="btn btn-xs btn-danger encounter-delete-btn" data-id="${e.id}" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners
    el.querySelectorAll('.encounter-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEncounterEditor(btn.dataset.id);
        });
    });
    el.querySelectorAll('.encounter-combat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCombatTracker(btn.dataset.id);
        });
    });
    el.querySelectorAll('.encounter-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteEncounterHandler(btn.dataset.id);
        });
    });
}

// Body toggle
window.toggleEncounterBody = function(id) {
    const el = document.getElementById('enc-body-' + id);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

// ============================================================
// RENDER BESTIARY PANEL (improved)
// ============================================================

function renderBestiary() {
    const listEl = document.getElementById('bestiary-list');
    if (!listEl) return;

    const searchInput = document.getElementById('bestiary-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    // Filter and also filter out entries without a name
    filteredBestiary = bestiaryData.filter(entry => {
        const name = (entry.name || '').toLowerCase();
        const desc = (entry.description || '').toLowerCase();
        const category = (entry.category || '').toLowerCase();
        return (name || desc || category).includes(searchTerm);
    });

    if (!bestiaryData || bestiaryData.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center;padding:1rem;color:var(--text3);width:100%;">
                📭 No bestiary data loaded. Check that /data/bestiary.json exists.
            </div>
        `;
        return;
    }

    if (filteredBestiary.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center;padding:1rem;color:var(--text3);width:100%;">
                🔍 No creatures match your search.
            </div>
        `;
        return;
    }

    listEl.innerHTML = filteredBestiary.map(entry => {
        // Safely extract fields with defaults
        const name = entry.name || 'Unnamed';
        const safeName = name.replace(/["']/g, '');
        const tier = entry.tier ? `TL${entry.tier}` : '';
        const category = entry.category || '';
        const description = entry.description || '';

        return `
            <div class="bestiary-entry" data-name="${escHtml(safeName)}" style="
                background:var(--bg3);
                border:1px solid var(--border);
                border-radius:var(--radius-sm);
                padding:0.3rem 0.6rem;
                display:flex;
                align-items:center;
                gap:0.4rem;
                flex-wrap:wrap;
                transition:border-color 0.2s;
                cursor:default;
            ">
                <span style="font-weight:600;font-size:0.85rem;">${escHtml(name)}</span>
                ${category ? `<span class="badge badge-${getCategoryBadgeColor(category)}" style="font-size:0.6rem;">${escHtml(category)}</span>` : ''}
                ${tier ? `<span style="font-size:0.65rem;color:var(--text2);background:var(--bg2);padding:0.05rem 0.3rem;border-radius:12px;">${tier}</span>` : ''}
                <span style="font-size:0.75rem;color:var(--text2);flex:1;min-width:100px;">${description ? escHtml(description.slice(0, 80)) + (description.length > 80 ? '…' : '') : ''}</span>
                <button class="btn btn-xs btn-gold bestiary-add-adversary" data-name="${escHtml(safeName)}" title="Add to current encounter">+ Add</button>
            </div>
        `;
    }).join('');

    // Attach add buttons – use the bestiaryData array for lookup (case‑insensitive)
    listEl.querySelectorAll('.bestiary-add-adversary').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            // Find by case‑insensitive match
            const entry = bestiaryData.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
            if (entry) {
                addCreatureAsAdversary(entry);
                showToast(`⚔️ Added "${entry.name}" to encounter.`, 'success');
            } else {
                showToast(`❌ Creature "${name}" not found in bestiary.`, 'error');
            }
        });
    });

    // Click on entry to show a brief description (optional)
    listEl.querySelectorAll('.bestiary-entry').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            const name = row.dataset.name;
            const entry = bestiaryData.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
            if (entry) {
                showToast(`${entry.name}: ${entry.description || 'No description.'}`, 'info');
            }
        });
    });
}

// Helper: category badge color (same as in bestiary.js)
function getCategoryBadgeColor(category) {
    const map = {
        'beast': 'green',
        'undead': 'red',
        'humanoid': 'blue',
        'fiend': 'purple',
        'construct': 'gold',
        'plant': 'green',
        'dragon': 'red',
        'elemental': 'blue',
        'celestial': 'gold',
        'abomination': 'purple'
    };
    return map[category.toLowerCase()] || 'gold';
}

// ============================================================
// ENCOUNTER OPERATIONS (unchanged)
// ============================================================

function createEncounterFromAdversary(name, body) {
    const state = getState();
    if (!state.encounters) state.encounters = [];
    
    const newEntry = {
        id: 'enc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title: name,
        body: body,
        difficulty: 2,
        location: '',
        status: 'draft',
        adversaries: [{ name: name, body: body }],
        created: Date.now()
    };
    state.encounters.push(newEntry);
    saveState();
    
    try {
        logToSession(`⚔️ Encounter created: ${newEntry.title}`, 'warning');
        addVTTEvent('encounter_created', { 
            name: newEntry.title, 
            id: newEntry.id,
            status: newEntry.status 
        });
    } catch (e) { /* ignore */ }
    
    renderEncounters();
    showToast(`🃏 Created encounter from "${name}"`, 'success');
}

function deleteEncounterHandler(id) {
    if (!confirm('Delete encounter?')) return;
    const state = getState();
    const encounter = state.encounters.find(e => e.id === id);
    if (encounter) {
        try {
            logToSession(`🗑️ Encounter deleted: ${encounter.title}`, 'info');
            addVTTEvent('encounter_deleted', { name: encounter.title, id: encounter.id });
        } catch (e) { /* ignore */ }
    }
    state.encounters = (state.encounters || []).filter(e => e.id !== id);
    saveState();
    renderEncounters();
    showToast('Encounter deleted.', 'success');
}

function openEncounterEditor(id) {
    import('./editor.js').then(module => {
        module.openEditor(id);
    }).catch(err => {
        console.error('Failed to load encounter editor:', err);
        showToast('Encounter editor not available.', 'error');
    });
}

function openCombatTracker(id) {
    import('./combat.js').then(module => {
        module.openTracker(id);
    }).catch(err => {
        console.error('Failed to load combat tracker:', err);
        showToast('Combat tracker not available.', 'error');
    });
}

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    const addBtn = document.getElementById('add-encounter-btn');
    if (addBtn) {
        const newBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newBtn, addBtn);
        newBtn.addEventListener('click', () => {
            openEncounterEditor(null);
        });
    }
    
    const search = document.getElementById('encounter-search');
    if (search) {
        search.addEventListener('input', renderEncounters);
    }

    // Bestiary search
    const bestiarySearch = document.getElementById('bestiary-search');
    if (bestiarySearch) {
        bestiarySearch.addEventListener('input', renderBestiary);
    }

    // Refresh bestiary
    const refreshBtn = document.getElementById('bestiary-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            try {
                bestiaryData = await loadBestiaryData();
                await loadWikiData();
                renderBestiary();
                showToast('Bestiary refreshed.', 'info');
            } catch (e) {
                showToast('Failed to refresh bestiary.', 'error');
            }
        });
    }
}

// ============================================================
// LIFECYCLE
// ============================================================

export function destroy() {
    container = null;
}

export default {
    render,
    destroy,
    attachEvents
};
