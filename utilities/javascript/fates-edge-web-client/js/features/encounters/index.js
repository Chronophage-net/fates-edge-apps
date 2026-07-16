/**
 * Encounters feature - Manage combat and social encounters
 * Includes quick reference from The Witnessed Prey
 */

import { getState, addEncounter, deleteEncounter, updateEncounter } from '../../core/state.js';
import { escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { logToSession, addVTTEvent } from '../dashboard/scene-tools.js';

let container = null;

// Quick reference data from The Witnessed Prey
const QUICK_ADVERSARIES = [
    {
        name: 'Bandit Captain (TL 2)',
        body: 'Body 3, Melee 2, Harm 4. Rabble Rouser — On a Hit, rally 1d4 bandits. Cowardly — Flees if outnumbered.'
    },
    {
        name: 'Slasher (TL 3)',
        body: 'Body 4, Melee 3, Harm 5. Regeneration — Ignores first 2 Harm per scene. Hunger Timer [6] — When full, frenzy.'
    },
    {
        name: 'Ghostly Anchor (TL 3)',
        body: 'Spirit 4, Lore 2, Harm 3. Unfinished Business — Cannot be harmed until anchor addressed. Bargain — May offer a deal.'
    },
    {
        name: 'Oath-Keeper (TL –)',
        body: 'Cannot be fought. Demand — One story, memory, or confession. Weakness — Pay the original debt.'
    },
    {
        name: 'Thorn Courtier (TL 3)',
        body: 'Presence 4, Sway 3, Harm 3. Courteous Snare — A gift accepted is a debt owed. Iron Offense — Brandishing iron gives GM 2 SB.'
    },
    {
        name: 'Salt Prince Enforcer (TL 2)',
        body: 'Body 3, Melee 2, Harm 4. Debt Marker — Knows where you sleep. Brine Curse — Test Resolve or gain Salt-Tongue.'
    }
];

// Universal Adversary Moves (from Witnessed Prey)
const ADVERSARY_MOVES = [
    { name: 'Strike', cost: 1, effect: 'Deal Harm 1 to one target.' },
    { name: 'Heavy Strike', cost: 2, effect: 'Deal Harm 2 to one target.' },
    { name: 'Shove', cost: 1, effect: 'Push target 1 range band or knock prone.' },
    { name: 'Grapple', cost: 1, effect: 'Target Restrained until break free (DV 3).' },
    { name: 'Flurry', cost: 2, effect: 'Deal Harm 1 to two targets, or Harm 2 + Shove.' },
    { name: 'Press', cost: 1, effect: 'Worsen target\'s Position by one step.' },
    { name: 'Disarm', cost: 2, effect: 'Target drops one held item.' },
    { name: 'Trip', cost: 1, effect: 'Target is Prone.' },
    { name: 'Brace', cost: 1, effect: 'Enemy gains +1 Armor until their next turn.' },
    { name: 'Taunt', cost: 1, effect: 'Target tests Resolve (DV 3) or attacks this enemy.' },
    { name: 'Withdraw', cost: 1, effect: 'Enemy moves one range band away.' },
    { name: 'Devastating Blow', cost: 3, effect: 'Deal Harm 3 to one target.' },
    { name: 'Area Attack', cost: 3, effect: 'Deal Harm 1 to all targets in a zone.' },
    { name: 'Call for Aid', cost: 3, effect: '1d4 reinforcements arrive in 1–2 rounds.' }
];

// Quick Timer Types
const QUICK_TIMERS = [
    { name: 'Courage [4]', effect: 'Ticks each time one of them is wounded. When full, they rout.' },
    { name: 'Reinforcements [6]', effect: 'When full, a sergeant and 1d4 recruits arrive.' },
    { name: 'Devotion [4]', effect: 'Ticks each time the novice is wounded. When full, suicide attack.' },
    { name: 'Exit Strategy [4]', effect: 'When full, the assassin disengages and vanishes.' },
    { name: 'Arrest Warrant [6]', effect: 'When full, returns with 1d4 guards and a sealed writ.' },
    { name: 'Hunt [6]', effect: 'When full, attacks openly with Dominant Position.' }
];

/**
 * Render the encounters tab
 */
export function render(el) {
    container = el;
    container.innerHTML = `
        <div class="encounters-layout">
            <header class="encounters-header">
                <div>
                    <h1 class="page-title">⚔️ Encounters</h1>
                    <p class="page-sub">Build encounters, track combat, and reference adversaries.</p>
                </div>
                <button class="btn btn-gold" id="add-encounter-btn">+ New Encounter</button>
            </header>

            <div class="encounters-grid">
                <!-- Left: Encounter List -->
                <div class="encounters-main">
                    <div class="panel">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;">
                            <h3 style="margin:0;">📋 Saved Encounters</h3>
                            <div style="display:flex;gap:0.3rem;">
                                <input type="text" id="encounter-search" placeholder="🔍 Search…" style="font-size:0.8rem;padding:0.2rem 0.5rem;" />
                            </div>
                        </div>
                        <div id="encounter-list"></div>
                    </div>
                </div>

                <!-- Right: Quick Reference -->
                <div class="encounters-sidebar">
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
    attachEvents();
}

/**
 * Render quick reference cards
 */
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
        
        // Click to create encounter from adversary
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

/**
 * Render encounters
 */
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

/**
 * Create encounter from quick adversary
 */
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
    
    // Log encounter creation
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

/**
 * Delete encounter handler
 */
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

/**
 * Open encounter editor
 */
function openEncounterEditor(id) {
    import('./editor.js').then(module => {
        module.openEditor(id);
    }).catch(() => {
        showToast('Editor not available.', 'error');
    });
}

/**
 * Open combat tracker
 */
function openCombatTracker(id) {
    import('./combat.js').then(module => {
        module.openTracker(id);
    }).catch(() => {
        showToast('Combat tracker not available.', 'error');
    });
}

/**
 * Attach event listeners
 */
export function attachEvents() {
    document.getElementById('add-encounter-btn')?.addEventListener('click', () => {
        openEncounterEditor(null);
    });
    
    document.getElementById('encounter-search')?.addEventListener('input', renderEncounters);
}

function saveState() {
    // Save to localStorage
    try {
        const state = getState();
        localStorage.setItem('fates-edge-state', JSON.stringify(state));
    } catch (e) { /* ignore */ }
}

/**
 * Destroy
 */
export function destroy() {
    container = null;
}

export default {
    render,
    destroy,
    attachEvents
};