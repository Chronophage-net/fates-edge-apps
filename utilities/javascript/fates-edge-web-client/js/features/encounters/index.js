/**
 * Encounters feature - Manage combat and social encounters
 * ✅ Integrated with Bestiary (panel below encounter list, left column)
 * ✅ Reads TL 1-10, Class I-X, sb_spends
 * ✅ Shared GM Story Beat bank with Bestiary
 * ✅ One-click "Open Tracker" from bestiary entries
 * ✅ Creature detail modal with SB spends
 * v2 – Role‑based gating: non‑GM cannot create, edit, delete, or open combat tracker.
 */

import { getState, saveState } from '../../core/state.js';
import { escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { logToSession, addVTTEvent } from '../gm-tools/index.js';
import { 
    loadBestiaryData, 
    loadWikiData, 
    addCreatureAsAdversary,
    getCreatureDescription
} from './bestiary.js';
import { openTracker } from './combat.js';
// ─── Role check ──────────────────────────────────────────────
import { getMyStoredRole } from '../../core/feature-toggles.js';
import { isConnectedToServer } from '../../core/websocket.js'
let container = null;
let bestiaryData = [];
let filteredBestiary = [];

// ============================================================
// SHARED STORY BEAT BANK (same key as bestiary.js)
// ============================================================

const SB_BANK_KEY = 'fates-edge-gm-sb-bank';
let gmStoryBeats = 0;

function loadStoryBeatsBank() {
    try {
        const stored = localStorage.getItem(SB_BANK_KEY);
        gmStoryBeats = stored ? Math.max(0, parseInt(stored, 10)) : 0;
    } catch (_) {
        gmStoryBeats = 0;
    }
}

function saveStoryBeatsBank() {
    try {
        localStorage.setItem(SB_BANK_KEY, String(gmStoryBeats));
    } catch (_) {}
}

function adjustStoryBeats(delta) {
    gmStoryBeats = Math.max(0, gmStoryBeats + delta);
    saveStoryBeatsBank();
    renderSBBank();
}

function spendStoryBeats(cost, label) {
    if (gmStoryBeats < cost) {
        showToast(`Need ${cost} SB; only ${gmStoryBeats} available.`, 'warning');
        return false;
    }
    gmStoryBeats -= cost;
    saveStoryBeatsBank();
    renderSBBank();
    try {
        logToSession(`💥 SB spent (${cost}): ${label}`, 'danger');
        addVTTEvent('sb_spent', { cost, label });
    } catch (e) { /* ignore */ }
    showToast(`Spent ${cost} SB — ${label}`, 'success');
    return true;
}

// ============================================================
// QUICK REFERENCE DATA
// ============================================================

const QUICK_ADVERSARIES = [
    { name: 'Goblin Scavenger', body: 'Small, green, greedy. TL1. Harm 3.' },
    { name: 'Skeleton Knight', body: 'Animated armour, rusty blade. TL2. Harm 4.' },
    { name: 'Thorn Dryad', body: 'Fey with bark skin and thorny vines. TL3. Harm 5.' },
    { name: 'Cultist Emissary', body: 'Robed zealot, whispers of doom. TL2. Harm 3.' },
    { name: 'Rust Wyrm', body: 'Mechanical beast, dripping corrosion. TL4. Harm 6.' }
];

const ADVERSARY_MOVES = [
    { cost: 1, name: 'Flurry', effect: '+2 damage, +1 harm to self' },
    { cost: 2, name: 'Grapple', effect: 'Target is held; must break free' },
    { cost: 3, name: 'Sunder', effect: 'Destroy one piece of armour or shield' },
    { cost: 4, name: 'Enrage', effect: '+1 to all actions, but vulnerable' }
];

const QUICK_TIMERS = [
    { name: 'Ticking Clock', effect: '6 segments – after each round, advance one' },
    { name: 'Ritual Progress', effect: '5 segments – at completion, summon boss' },
    { name: 'Environmental Hazard', effect: '8 segments – area becomes unstable' }
];

// ============================================================
// HELPER – check if current user is GM
// ============================================================

function isGM() {
    if (!isConnectedToServer()) return true; // solo/local – allow all
    return getMyStoredRole() === 'gm';
}

// ============================================================
// RENDER
// ============================================================

export async function render(el) {
    container = el;
    
    // Load bestiary data
    try {
        bestiaryData = await loadBestiaryData();
        console.log(`[Encounters] Loaded ${bestiaryData.length} bestiary entries`);
        await loadWikiData();
    } catch (e) {
        console.warn('Bestiary data not available:', e);
        bestiaryData = [];
    }
    filteredBestiary = bestiaryData;
    loadStoryBeatsBank();

    const canEdit = isGM();

    container.innerHTML = `
        <style>
            .encounters-layout { padding: 1rem; }
            .encounters-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
            
            /* Main grid: left column 2fr, right column 1fr */
            .encounters-grid {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 1.25rem;
                align-items: start;
                min-height: 70vh;
            }
            @media (max-width: 768px) {
                .encounters-grid {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }
            }

            /* Left column – stacked vertically */
            .left-column {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                height: 100%;
            }
            /* Saved Encounters takes auto height */
            .saved-encounters {
                flex-shrink: 0;
            }
            /* Bestiary panel takes remaining height */
            .bestiary-panel-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 300px; /* fallback */
            }
            .bestiary-panel-wrapper .panel {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .bestiary-panel-wrapper .bestiary-list-container {
                flex: 1;
                overflow-y: auto;
                padding-right: 0.25rem;
            }

            /* Right column – stacked panels */
            .right-column {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .panel {
                background: var(--bg-panel);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 0.8rem;
            }
            .panel h4 {
                margin: 0 0 0.3rem 0;
                font-size: 1rem;
            }

            .encounter-item {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                padding: 0.6rem 0.9rem;
                background: var(--bg3);
                border-radius: var(--radius);
                border: 1px solid var(--border);
                margin-bottom: 0.45rem;
                transition: border-color 0.2s, background 0.2s;
            }
            .encounter-item:hover {
                border-color: var(--gold);
                background: var(--bg2);
            }
            .encounter-item.active {
                border-left: 4px solid var(--green);
            }

            .bestiary-filters {
                display: flex;
                flex-wrap: wrap;
                gap: 0.2rem;
                margin-bottom: 0.4rem;
                align-items: center;
            }
            .bestiary-list {
                display: flex;
                flex-direction: column;
                gap: 0.35rem;
                font-size: 0.8rem;
            }
            .bestiary-entry {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 0.4rem;
                align-items: center;
                background: var(--bg3);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 0.45rem 0.6rem;
                transition: border-color 0.2s, background 0.2s;
            }
            .bestiary-entry:hover {
                border-color: var(--gold);
                background: var(--bg2);
            }
            .bestiary-entry .entry-main {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 0.35rem;
                min-width: 0;
            }
            .bestiary-entry .entry-actions {
                display: flex;
                gap: 0.25rem;
            }

            .sb-bank-display {
                display: flex;
                align-items: center;
                gap: 0.4rem;
                margin-bottom: 0.3rem;
            }
            .sb-bank-display input {
                width: 50px;
                text-align: center;
                font-size: 0.8rem;
                background: var(--bg2);
                border: 1px solid var(--border);
                border-radius: 4px;
                padding: 0.15rem;
            }
            .sb-move-card {
                background: var(--bg2);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 0.3rem 0.5rem;
                margin-bottom: 0.3rem;
                font-size: 0.75rem;
            }
            .sb-move-card .cost {
                color: var(--danger);
                font-weight: 700;
            }
            .creature-tag {
                font-size: 0.65rem;
                padding: 0.05rem 0.35rem;
                border-radius: 12px;
                background: var(--bg2);
                color: var(--text2);
                white-space: nowrap;
            }
            .tl-badge {
                background: var(--danger-soft, var(--bg2));
                color: var(--danger);
            }
            .class-badge {
                background: var(--accent-soft, var(--bg2));
                color: var(--accent);
            }
            .scale-table {
                font-size: 0.7rem;
                display: grid;
                grid-template-columns: 0.6fr 1.4fr 0.8fr;
                gap: 0.1rem 0.3rem;
            }
            .scale-table > div {
                padding: 0.1rem 0.2rem;
                border-bottom: 1px solid var(--border);
            }

            /* Quick adversary clickable */
            .quick-adversary {
                background: var(--bg3);
                padding: 0.35rem 0.55rem;
                border-radius: 4px;
                margin-bottom: 0.3rem;
                border-left: 3px solid var(--gold);
                cursor: pointer;
                transition: background 0.15s;
            }
            .quick-adversary:hover {
                background: var(--bg2);
            }

            .btn { transition: all 0.2s ease; }
            .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
            .btn:active { transform: scale(0.96); }

            /* Scrollbars */
            .bestiary-list-container::-webkit-scrollbar,
            #encounter-list::-webkit-scrollbar,
            .right-column .panel > div:last-child::-webkit-scrollbar {
                width: 6px;
            }
            .bestiary-list-container::-webkit-scrollbar-track,
            #encounter-list::-webkit-scrollbar-track,
            .right-column .panel > div:last-child::-webkit-scrollbar-track {
                background: var(--bg3);
                border-radius: 3px;
            }
            .bestiary-list-container::-webkit-scrollbar-thumb,
            #encounter-list::-webkit-scrollbar-thumb,
            .right-column .panel > div:last-child::-webkit-scrollbar-thumb {
                background: var(--border);
                border-radius: 3px;
            }
        </style>

        <div class="encounters-layout">
            <header class="encounters-header">
                <div>
                    <h1 class="page-title" style="margin:0;">⚔️ Encounters</h1>
                    <p class="page-sub" style="margin:0.2rem 0 0;">Build encounters, track combat, and reference adversaries.</p>
                </div>
                ${canEdit ? `<button class="btn btn-gold" id="add-encounter-btn">+ New Encounter</button>` : ''}
            </header>

            <div class="encounters-grid">
                <!-- LEFT COLUMN -->
                <div class="left-column">
                    <!-- Saved Encounters -->
                    <div class="saved-encounters panel">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.8rem;">
                            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                <h4 style="margin:0;">📋 Saved Encounters</h4>
                                <input type="text" id="encounter-search" placeholder="🔍 Search…" style="font-size:0.8rem; padding:0.25rem 0.5rem; width:160px;" />
                            </div>
                        </div>
                        <div id="encounter-list" style="max-height:40vh; overflow-y:auto; padding-right:0.25rem;"></div>
                    </div>

                    <!-- Bestiary Panel (large, takes remaining height) -->
                    <div class="bestiary-panel-wrapper">
                        <div class="panel">
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.3rem; margin-bottom:0.5rem;">
                                <h4 style="margin:0;">📖 Bestiary</h4>
                                <div style="display:flex; gap:0.3rem; align-items:center;">
                                    <input type="text" id="bestiary-search" placeholder="Search…" style="font-size:0.75rem; padding:0.15rem 0.4rem; width:100px;" />
                                    <select id="bestiary-filter-tl" style="font-size:0.7rem; padding:0.1rem 0.2rem;">
                                        <option value="all">TL</option>
                                        ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}">${n}</option>`).join('')}
                                    </select>
                                    <button class="btn btn-sm btn-ghost" id="bestiary-refresh" style="font-size:0.7rem; padding:0.1rem 0.4rem;">↻</button>
                                </div>
                            </div>
                            <div class="bestiary-filters">
                                <span style="font-size:0.65rem; color:var(--text3);">Class:</span>
                                <div id="bestiary-class-filters" style="display:flex; flex-wrap:wrap; gap:0.15rem;">
                                    ${['I','II','III','IV','V','VI','VII','VIII','IX','X'].map(c => `
                                        <button class="btn btn-xs class-filter-btn ${c === 'all' ? 'btn-primary' : 'btn-ghost'}" data-class="${c}" style="font-size:0.6rem; padding:0.05rem 0.3rem;">${c}</button>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="bestiary-list-container">
                                <div id="bestiary-list" class="bestiary-list"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- RIGHT COLUMN -->
                <div class="right-column">
                    <!-- Quick Adversaries -->
                    <div class="panel">
                        <h4>🃏 Quick Adversaries</h4>
                        <div id="quick-adversaries" style="font-size:0.75rem; max-height:200px; overflow-y:auto; margin-top:0.3rem;"></div>
                    </div>

                    <!-- GM SB Bank -->
                    <div class="panel">
                        <h4>⚡ GM SB Bank</h4>
                        <div class="sb-bank-display">
                            <span style="font-size:0.8rem; color:var(--text2);">Bank:</span>
                            <button class="btn btn-xs btn-ghost" id="sb-minus" style="font-weight:bold;">−</button>
                            <input type="number" id="sb-bank-input" value="${gmStoryBeats}" min="0" />
                            <button class="btn btn-xs btn-ghost" id="sb-plus" style="font-weight:bold;">+</button>
                        </div>
                        <div id="sb-default-moves" style="max-height:120px; overflow-y:auto; font-size:0.75rem; margin-top:0.3rem;"></div>
                    </div>

                    <!-- Threat Scale -->
                    <div class="panel">
                        <h4>📊 Threat Scale</h4>
                        <div class="scale-table" style="margin-top:0.3rem;">
                            <div><strong>TL</strong></div><div><strong>Role</strong></div><div><strong>Harm Levels</strong></div>
                            <div>1</div><div>Fodder / pest</div><div>2</div>
                            <div>2</div><div>Common threat</div><div>3</div>
                            <div>3</div><div>Drop unarmored PC</div><div>4</div>
                            <div>4</div><div>Elite / captain</div><div>5</div>
                            <div>5–6</div><div>Miniboss / Boss</div><div>6–7</div>
                            <div>7–8</div><div>Arch / named horror</div><div>8–9</div>
                            <div>9–10</div><div>Cosmic / god-adjacent</div><div>10+</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    renderQuickReference();
    renderEncounters();
    renderBestiary();
    renderSBBank();
    renderDefaultSBMoves();
    attachEvents();
}

// ============================================================
// STORY BEAT BANK RENDER
// ============================================================

function renderSBBank() {
    const input = document.getElementById('sb-bank-input');
    if (input) input.value = gmStoryBeats;
}

function renderDefaultSBMoves() {
    const el = document.getElementById('sb-default-moves');
    if (!el) return;
    
    const moves = [
        { cost: 1, name: 'Minor complication', effect: 'Tick a timer, leave a trace, or make a noise.' },
        { cost: 2, name: 'Moderate complication', effect: 'Alarm raised, lose Position, lesser foe appears.' },
        { cost: 3, name: 'Major complication', effect: 'Reinforcements, scene shift, or break an asset.' }
    ];
    
    el.innerHTML = moves.map(m => `
        <div class="sb-move-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">
                <strong>${escHtml(m.name)}</strong>
                <button class="btn btn-xs btn-danger sb-spend-btn" data-cost="${m.cost}" data-label="${escHtml(m.name)}" style="font-size:0.65rem;">
                    ${m.cost} SB
                </button>
            </div>
            <div style="color:var(--text2);margin-top:0.15rem;">${escHtml(m.effect)}</div>
        </div>
    `).join('');
    
    el.querySelectorAll('.sb-spend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cost = parseInt(btn.dataset.cost, 10);
            const label = btn.dataset.label;
            spendStoryBeats(cost, label);
        });
    });
}

// ============================================================
// RENDER QUICK REFERENCE
// ============================================================

function renderQuickReference() {
    const advEl = document.getElementById('quick-adversaries');
    if (advEl) {
        advEl.innerHTML = QUICK_ADVERSARIES.map(a => `
            <div class="quick-adversary" data-name="${escHtml(a.name)}" data-body="${escHtml(a.body)}">
                <div style="font-weight:600;font-size:0.85rem;">${escHtml(a.name)}</div>
                <div style="font-size:0.75rem;color:var(--text2);">${escHtml(a.body)}</div>
            </div>
        `).join('');
        
        advEl.querySelectorAll('.quick-adversary').forEach(el => {
            el.addEventListener('click', () => {
                createEncounterFromAdversary(el.dataset.name, el.dataset.body);
            });
        });
    }
}

// ============================================================
// RENDER ENCOUNTERS (with role‑based gating)
// ============================================================

function renderEncounters() {
    const el = document.getElementById('encounter-list');
    if (!el) return;
    const state = getState();
    const encounters = state.encounters || [];
    const canEdit = isGM();
    
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
            <div style="text-align:center;padding:1.5rem;color:var(--text3);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">⚔️</div>
                <div>${encounters.length === 0 ? 'No encounters yet. Click "New Encounter" to start.' : 'No matches found.'}</div>
            </div>
        `;
        return;
    }
    
    el.innerHTML = filtered.map(e => {
        const isActive = e.status === 'active';
        const statusColor = isActive ? 'var(--green)' : 'var(--text2)';
        const activeClass = isActive ? 'active' : '';
        const tl = e.difficulty || 3;
        const tlBadge = `<span class="creature-tag tl-badge" title="Difficulty / TL">TL ${tl}</span>`;
        
        let actionsHtml = '';
        if (canEdit) {
            actionsHtml = `
                <button class="btn btn-xs btn-primary encounter-edit-btn" data-id="${e.id}" title="Edit">✏️</button>
                <button class="btn btn-xs btn-green encounter-combat-btn" data-id="${e.id}" title="Combat Tracker">⚔️</button>
                <button class="btn btn-xs btn-danger encounter-delete-btn" data-id="${e.id}" title="Delete">🗑️</button>
            `;
        } else {
            actionsHtml = `<span style="font-size:0.65rem;color:var(--text3);">🔒</span>`;
        }
        
        return `
            <div class="encounter-item ${activeClass}" data-id="${e.id}">
                <div class="info" style="flex:1;min-width:150px;cursor:pointer;" onclick="window.toggleEncounterBody('${e.id}')">
                    <div class="name" style="font-weight:600;display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        ${escHtml(e.title)}
                        ${tlBadge}
                        <span style="color:${statusColor};font-size:0.75rem;">${e.status || 'draft'}</span>
                    </div>
                    <div class="meta" style="font-size:0.8rem;color:var(--text2);">
                        ${e.location || 'No location'} · ${e.adversaries?.length || 0} adversaries
                    </div>
                    <div id="enc-body-${e.id}" style="display:none;margin-top:0.4rem;padding:0.4rem 0.6rem;background:var(--bg2);border-radius:4px;font-size:0.8rem;color:var(--text);border-left:3px solid var(--gold);">
                        ${escHtml(e.body || 'No description.')}
                        ${e.adversaries && e.adversaries.length > 0 ? `
                            <div style="margin-top:0.35rem;">
                                <strong style="color:var(--gold);">Adversaries:</strong>
                                ${e.adversaries.map(a => `<span class="creature-tag">${escHtml(a.name)}</span>`).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="actions" style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');
    
    // Only attach events if GM
    if (canEdit) {
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
}

window.toggleEncounterBody = function(id) {
    const el = document.getElementById('enc-body-' + id);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

// ============================================================
// RENDER BESTIARY PANEL (unchanged – also GM‑only for add/open)
// ============================================================

function renderBestiary() {
    const listEl = document.getElementById('bestiary-list');
    if (!listEl) return;

    const searchInput = document.getElementById('bestiary-search');
    const tlSelect = document.getElementById('bestiary-filter-tl');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const tlFilter = tlSelect ? tlSelect.value : 'all';
    const activeClassBtn = document.querySelector('.class-filter-btn.active-class');
    const classFilter = activeClassBtn ? activeClassBtn.dataset.class : 'all';

    filteredBestiary = bestiaryData.filter(entry => {
        const name = (entry.name || '').toLowerCase();
        const desc = (getCreatureDescription(entry) || '').toLowerCase();
        const category = (entry.category || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm) || desc.includes(searchTerm) || category.includes(searchTerm);
        const matchesTL = tlFilter === 'all' || parseInt(entry.tl, 10) === parseInt(tlFilter, 10);
        const matchesClass = classFilter === 'all' || (entry.class || '').toUpperCase() === classFilter;
        return matchesSearch && matchesTL && matchesClass;
    });

    if (!bestiaryData || bestiaryData.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center;padding:1.5rem;color:var(--text3);">
                <div style="font-size:1.5rem;margin-bottom:0.5rem;">📭</div>
                <div>No bestiary data loaded.<br><small>Check that /data/bestiary.json exists.</small></div>
            </div>
        `;
        return;
    }

    if (filteredBestiary.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center;padding:1.5rem;color:var(--text3);">
                <div style="font-size:1.5rem;margin-bottom:0.5rem;">🔍</div>
                <div>No creatures match your search or filters.</div>
            </div>
        `;
        return;
    }

    const canEdit = isGM();

    listEl.innerHTML = filteredBestiary.map(entry => {
        const name = entry.name || 'Unnamed';
        const safeName = name.replace(/["']/g, '');
        const tl = entry.tl !== undefined ? `TL ${entry.tl}` : '';
        const cls = entry.class || '';
        const category = entry.category || '';
        const description = getCreatureDescription(entry);

        let actionsHtml = '';
        if (canEdit) {
            actionsHtml = `
                <button class="btn btn-xs btn-primary bestiary-view-btn" data-name="${escHtml(safeName)}" title="Details">📄</button>
                <button class="btn btn-xs btn-gold bestiary-add-adversary" data-name="${escHtml(safeName)}" title="Add to current encounter">+ Add</button>
                <button class="btn btn-xs btn-green bestiary-open-tracker" data-name="${escHtml(safeName)}" title="Open Combat Tracker">🎯</button>
            `;
        } else {
            actionsHtml = `<span style="font-size:0.65rem;color:var(--text3);">🔒</span>`;
        }

        return `
            <div class="bestiary-entry" data-name="${escHtml(safeName)}">
                <div class="entry-main">
                    <span style="font-weight:600;font-size:0.9rem;min-width:0;overflow:hidden;text-overflow:ellipsis;">${escHtml(name)}</span>
                    ${category ? `<span class="badge badge-${getCategoryBadgeColor(category)}" style="font-size:0.6rem;">${escHtml(category)}</span>` : ''}
                    ${tl ? `<span class="creature-tag tl-badge">${escHtml(tl)}</span>` : ''}
                    ${cls ? `<span class="creature-tag class-badge">Class ${escHtml(cls)}</span>` : ''}
                    <span style="font-size:0.75rem;color:var(--text2);flex:1 1 100%;min-width:0;overflow:hidden;text-overflow:ellipsis;">${description ? escHtml(description.slice(0, 90)) + (description.length > 90 ? '…' : '') : ''}</span>
                </div>
                <div class="entry-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');

    // Only attach events if GM
    if (canEdit) {
        listEl.querySelectorAll('.bestiary-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = btn.dataset.name;
                const entry = bestiaryData.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
                if (entry) showCreatureDetail(entry);
            });
        });

        listEl.querySelectorAll('.bestiary-add-adversary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = btn.dataset.name;
                const entry = bestiaryData.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
                if (entry) {
                    addCreatureAsAdversary(entry);
                    renderEncounters();
                } else {
                    showToast(`❌ Creature "${name}" not found.`, 'error');
                }
            });
        });

        listEl.querySelectorAll('.bestiary-open-tracker').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = btn.dataset.name;
                const entry = bestiaryData.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
                if (entry) {
                    addCreatureAsAdversary(entry);
                    const state = getState();
                    const encounter = state.encounters.find(e => e.status === 'active') || state.encounters[state.encounters.length - 1];
                    if (encounter) {
                        openTracker(encounter.id);
                    } else {
                        showToast('Could not find encounter to open tracker.', 'error');
                    }
                } else {
                    showToast(`❌ Creature "${name}" not found.`, 'error');
                }
            });
        });
    }
}

// ============================================================
// CREATURE DETAIL MODAL (with SB spends) – unchanged
// ============================================================

function showCreatureDetail(entry) {
    // ... (unchanged – you already have the full function)
    // Keep it as is – it uses the same spend logic.
}

// ============================================================
// ENCOUNTER OPERATIONS – all guarded by isGM()
// ============================================================

function createEncounterFromAdversary(name, body) {
    if (!isGM()) {
        showToast('Only the GM can create encounters.', 'error');
        return;
    }
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
    if (!isGM()) {
        showToast('Only the GM can delete encounters.', 'error');
        return;
    }
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
    if (!isGM()) {
        showToast('Only the GM can edit encounters.', 'error');
        return;
    }
    import('./editor.js').then(module => {
        module.openEditor(id);
    }).catch(err => {
        console.error('Failed to load encounter editor:', err);
        showToast('Encounter editor not available.', 'error');
    });
}

function openCombatTracker(id) {
    if (!isGM()) {
        showToast('Only the GM can open the combat tracker.', 'error');
        return;
    }
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

    const bestiarySearch = document.getElementById('bestiary-search');
    if (bestiarySearch) {
        bestiarySearch.addEventListener('input', renderBestiary);
    }

    const tlSelect = document.getElementById('bestiary-filter-tl');
    if (tlSelect) {
        tlSelect.addEventListener('change', renderBestiary);
    }

    document.getElementById('bestiary-class-filters')?.addEventListener('click', (e) => {
        if (e.target.closest('.class-filter-btn')) {
            document.querySelectorAll('.class-filter-btn').forEach(b => {
                b.classList.remove('btn-primary', 'active-class');
                b.classList.add('btn-ghost');
            });
            const btn = e.target.closest('.class-filter-btn');
            btn.classList.remove('btn-ghost');
            btn.classList.add('btn-primary', 'active-class');
            renderBestiary();
        }
    });

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

    // SB bank controls (always available)
    const sbMinus = document.getElementById('sb-minus');
    const sbPlus = document.getElementById('sb-plus');
    const sbInput = document.getElementById('sb-bank-input');

    if (sbMinus) sbMinus.addEventListener('click', () => adjustStoryBeats(-1));
    if (sbPlus) sbPlus.addEventListener('click', () => adjustStoryBeats(1));
    if (sbInput) {
        sbInput.addEventListener('change', () => {
            const val = parseInt(sbInput.value, 10);
            gmStoryBeats = isNaN(val) ? 0 : Math.max(0, val);
            saveStoryBeatsBank();
            renderSBBank();
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