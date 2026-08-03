/**
 * Encounter Editor - Create and edit encounters
 * Supports title, description, difficulty, location, adversaries, and status
 * Integrated with Combat Tracker and Bestiary
 *
 * ✅ NEW: Adversaries now carry a small combat profile — Weapon Class
 * (none/light/medium/heavy, matching the character sheet's weapon
 * table) and Tactics (custom named moves, comma-separated). Both flow
 * straight into the Combat Tracker's per-adversary "🎯 Moves" panel,
 * so a boss's signature moves show up as clickable, loggable buttons
 * next to the generic Flurry/Grapple/Sunder/Enrage list.
 */

import { getState, saveState } from '../../core/state.js';
import { generateId, escHtml, safeParseInt } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { openTracker } from '../encounters/combat.js';
import { loadBestiaryData, getCreatureDescription } from './bestiary.js';

let modal = null;
let editingId = null;
let isNew = false;
let currentEncounter = null;

// Mirrors characters/editor.js WEAPON_CLASSES at a glance — kept minimal
// here since adversaries don't need the full XP-cost character sheet,
// just enough to drive the same Close/Near flavor in the Tracker.
const ADVERSARY_WEAPON_CLASSES = [
    { id: 'none', label: 'No / Unspecified Weapon' },
    { id: 'light', label: 'Light Weapon' },
    { id: 'medium', label: 'Medium Weapon' },
    { id: 'heavy', label: 'Heavy Weapon' },
];

// ============================================================
// PUBLIC API
// ============================================================

export function openEditor(id) {
    closeEditor();
    
    const state = getState();
    let encounter = null;
    if (id) {
        encounter = state.encounters?.find(e => String(e.id) === String(id));
        if (!encounter) {
            showToast('Encounter not found.', 'error');
            return;
        }
        editingId = id;
        isNew = false;
    } else {
        encounter = {
            id: generateId('enc_'),
            title: '',
            body: '',
            difficulty: 2,
            location: '',
            status: 'draft',
            adversaries: [],
            created: Date.now()
        };
        editingId = encounter.id;
        isNew = true;
    }
    currentEncounter = encounter;
    renderEditor(encounter);
}

export function closeEditor() {
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
    modal = null;
    editingId = null;
    isNew = false;
    currentEncounter = null;
}

// ============================================================
// RENDER EDITOR
// ============================================================

function weaponClassOptionsHtml(selected) {
    return ADVERSARY_WEAPON_CLASSES.map(w =>
        `<option value="${w.id}" ${selected === w.id ? 'selected' : ''}>${escHtml(w.label)}</option>`
    ).join('');
}

function adversaryRowHtml(a, i) {
    const tacticsStr = Array.isArray(a.tactics) ? a.tactics.join(', ') : (a.tactics || '');
    return `
        <div class="adv-row" data-index="${i}" style="display:flex;flex-direction:column;gap:0.3rem;margin:0.3rem 0;padding:0.4rem;border:1px solid var(--border);border-radius:8px;">
            <div style="display:flex;gap:0.3rem;align-items:center;">
                <input type="text" class="adv-name" placeholder="Name" value="${escHtml(a.name || '')}" style="flex:2;" />
                <input type="text" class="adv-body" placeholder="Description / stats" value="${escHtml(a.body || '')}" style="flex:3;" />
                <button class="btn btn-xs btn-danger adv-remove" data-index="${i}">✕</button>
            </div>
            <div style="display:flex;gap:0.3rem;align-items:center;">
                <select class="adv-weapon" style="flex:1;font-size:0.8rem;" title="Weapon class — drives Close/Near flavor in the Combat Tracker">
                    ${weaponClassOptionsHtml(a.weaponClass || 'none')}
                </select>
                <input type="text" class="adv-tactics" placeholder="Tactics (comma-separated, e.g. Web Snare, Venom Bite)" value="${escHtml(tacticsStr)}" style="flex:2;font-size:0.8rem;" />
            </div>
        </div>
    `;
}

function renderEditor(encounter) {
    modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;
        z-index: 1000; padding: 1rem; backdrop-filter: blur(8px);
    `;
    
    const advRows = (encounter.adversaries || []).map((a, i) => adversaryRowHtml(a, i)).join('');

    const trackerDisabled = isNew ? 'disabled' : '';

    modal.innerHTML = `
        <div style="background:var(--bg2);padding:1.5rem;border-radius:12px;max-width:650px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h2 style="margin:0;color:var(--gold);">${isNew ? 'New Encounter' : 'Edit Encounter'}</h2>
                <button id="editor-close" style="background:none;border:none;color:var(--text2);font-size:1.5rem;cursor:pointer;">✕</button>
            </div>
            
            <div class="form-group" style="margin-bottom:0.8rem;">
                <label>Title *</label>
                <input id="enc-title" value="${escHtml(encounter.title)}" placeholder="Encounter name" style="width:100%;" />
            </div>
            
            <div class="form-group" style="margin-bottom:0.8rem;">
                <label>Description</label>
                <textarea id="enc-body" rows="3" placeholder="Describe the encounter..." style="width:100%;">${escHtml(encounter.body || '')}</textarea>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:0.8rem;">
                <div class="form-group">
                    <label>Difficulty (1-5)</label>
                    <input type="number" id="enc-difficulty" value="${encounter.difficulty || 2}" min="1" max="5" />
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input id="enc-location" value="${escHtml(encounter.location || '')}" placeholder="Where?" />
                </div>
            </div>
            
            <div class="form-group" style="margin-bottom:0.8rem;">
                <label>Status</label>
                <select id="enc-status">
                    <option value="draft" ${encounter.status === 'draft' ? 'selected' : ''}>Draft</option>
                    <option value="active" ${encounter.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="resolved" ${encounter.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                </select>
            </div>
            
            <div style="margin-bottom:0.8rem;">
                <label>Adversaries</label>
                <div style="font-size:0.7rem;color:var(--text3);margin-bottom:0.3rem;">
                    Weapon Class and Tactics are optional — they show up as extra clickable moves next to the generic ones in the Combat Tracker.
                </div>
                <div id="adv-list">${advRows}</div>
                <div style="display:flex;gap:0.5rem;margin-top:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm" id="adv-add">+ Add Adversary</button>
                    <button class="btn btn-sm btn-ghost" id="adv-import-bestiary">📖 Import from Bestiary</button>
                </div>
            </div>
            
            <div style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem;flex-wrap:wrap;">
                <button class="btn btn-gold" id="editor-save">💾 Save</button>
                <button class="btn btn-primary" id="editor-open-tracker" ${trackerDisabled}>⚔️ Combat Tracker</button>
                <button class="btn" id="editor-cancel">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('#editor-close')?.addEventListener('click', closeEditor);
    modal.querySelector('#editor-cancel')?.addEventListener('click', closeEditor);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeEditor(); });
    
    modal.querySelector('#editor-save')?.addEventListener('click', () => saveEditor(encounter));
    
    modal.querySelector('#editor-open-tracker')?.addEventListener('click', () => {
        if (isNew) {
            const saved = saveEditor(encounter, true);
            if (saved) {
                const state = getState();
                const enc = state.encounters.find(e => e.id === editingId);
                if (enc) {
                    openTracker(enc.id);
                    closeEditor();
                }
            }
        } else {
            saveEditor(encounter, true);
            openTracker(editingId);
            closeEditor();
        }
    });
    
    modal.querySelector('#adv-add')?.addEventListener('click', () => {
        const list = document.getElementById('adv-list');
        const idx = list.children.length;
        const div = document.createElement('div');
        div.innerHTML = adversaryRowHtml({}, idx);
        const row = div.firstElementChild;
        list.appendChild(row);
        const nameInput = row.querySelector('.adv-name');
        if (nameInput) setTimeout(() => nameInput.focus(), 50);
    });
    
    modal.querySelector('#adv-import-bestiary')?.addEventListener('click', importFromBestiary);
    
    modal.querySelector('#adv-list')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('adv-remove')) {
            const row = e.target.closest('.adv-row');
            if (row) row.remove();
        }
    });
}

// ============================================================
// IMPORT FROM BESTIARY (for adversaries)
// ============================================================

async function importFromBestiary() {
    const creatures = await loadBestiaryData();
    if (!creatures || creatures.length === 0) {
        showToast('Bestiary not loaded yet.', 'error');
        return;
    }

    const searchModal = document.createElement('div');
    searchModal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.7);
        display: flex; align-items: center; justify-content: center;
        z-index: 2000; backdrop-filter: blur(8px);
    `;
    searchModal.innerHTML = `
        <div style="background: var(--bg-panel); padding: 1.5rem; border-radius: 12px;
                    max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto;">
            <h3 style="margin-top:0;">📖 Import from Bestiary</h3>
            <input type="text" id="bestiary-import-search" placeholder="Search creatures..." 
                   style="width:100%; padding:0.4rem; margin-bottom:0.5rem;">
            <div id="bestiary-import-list" style="max-height:300px; overflow-y:auto;"></div>
            <button id="bestiary-import-close" class="btn btn-sm btn-ghost" 
                    style="margin-top:0.5rem;">Cancel</button>
        </div>
    `;
    document.body.appendChild(searchModal);

    const searchInput = searchModal.querySelector('#bestiary-import-search');
    const listContainer = searchModal.querySelector('#bestiary-import-list');
    const closeBtn = searchModal.querySelector('#bestiary-import-close');

    function renderList(filter = '') {
        const term = filter.toLowerCase().trim();
        const filtered = creatures.filter(c => 
            (c.name || '').toLowerCase().includes(term) ||
            (getCreatureDescription(c) || '').toLowerCase().includes(term)
        );
        if (filtered.length === 0) {
            listContainer.innerHTML = '<div style="color:var(--text3);padding:1rem;">No creatures found.</div>';
            return;
        }
        listContainer.innerHTML = filtered.map(c => `
            <div class="bestiary-import-item" data-name="${escHtml(c.name)}" 
                 style="padding:0.4rem; border-bottom:1px solid var(--border); cursor:pointer;
                        display:flex; justify-content:space-between; align-items:center;">
                <span>${escHtml(c.name)}</span>
                <span style="font-size:0.7rem;color:var(--text3);">${c.category || ''}</span>
            </div>
        `).join('');

        listContainer.querySelectorAll('.bestiary-import-item').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.dataset.name;
                const entry = creatures.find(e => e.name === name);
                if (entry) {
                    const list = document.getElementById('adv-list');
                    const idx = list.children.length;
                    const div = document.createElement('div');
                    // 👇 NEW: carry over the bestiary entry's weaponClass/tactics, if any
                    div.innerHTML = adversaryRowHtml({
                        name: entry.name,
                        body: getCreatureDescription(entry),
                        weaponClass: entry.weaponClass || 'none',
                        tactics: entry.tactics || []
                    }, idx);
                    list.appendChild(div.firstElementChild);
                    showToast(`Added ${entry.name} to adversaries.`, 'success');
                    searchModal.remove();
                }
            });
        });
    }

    searchInput.addEventListener('input', (e) => renderList(e.target.value));
    closeBtn.addEventListener('click', () => searchModal.remove());
    searchModal.addEventListener('click', (e) => { if (e.target === searchModal) searchModal.remove(); });

    renderList('');
}

// ============================================================
// SAVE
// ============================================================

function saveEditor(baseEncounter, silent = false) {
    const title = document.getElementById('enc-title')?.value.trim();
    if (!title) {
        if (!silent) {
            showToast('Title is required.', 'error');
            const el = document.getElementById('enc-title');
            if (el) { el.focus(); el.style.borderColor = 'var(--red)'; }
        }
        return false;
    }
    
    const body = document.getElementById('enc-body')?.value.trim() || '';
    const difficulty = safeParseInt(document.getElementById('enc-difficulty')?.value, 2);
    const location = document.getElementById('enc-location')?.value.trim() || '';
    const status = document.getElementById('enc-status')?.value || 'draft';
    
    const adversaries = [];
    document.querySelectorAll('.adv-row').forEach(row => {
        const name = row.querySelector('.adv-name')?.value.trim();
        if (name) {
            const body = row.querySelector('.adv-body')?.value.trim() || '';
            const weaponClass = row.querySelector('.adv-weapon')?.value || 'none';
            const tacticsRaw = row.querySelector('.adv-tactics')?.value.trim() || '';
            const tactics = tacticsRaw ? tacticsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
            adversaries.push({ name, body, weaponClass, tactics });
        }
    });
    
    const state = getState();
    if (!state.encounters) state.encounters = [];
    
    let saved = false;
    if (isNew) {
        const newEnc = {
            id: baseEncounter.id || generateId('enc_'),
            title,
            body,
            difficulty: Math.min(Math.max(difficulty, 1), 5),
            location,
            status,
            adversaries,
            created: Date.now()
        };
        state.encounters.push(newEnc);
        editingId = newEnc.id;
        isNew = false;
        currentEncounter = newEnc;
        saved = true;
        if (!silent) showToast(`✅ Encounter "${title}" created.`, 'success');
    } else {
        const existing = state.encounters.find(e => String(e.id) === String(editingId));
        if (existing) {
            existing.title = title;
            existing.body = body;
            existing.difficulty = Math.min(Math.max(difficulty, 1), 5);
            existing.location = location;
            existing.status = status;
            existing.adversaries = adversaries;
            saved = true;
            if (!silent) showToast(`✅ Encounter "${title}" updated.`, 'success');
        } else {
            if (!silent) showToast('Encounter not found.', 'error');
            saved = false;
        }
    }
    
    if (saved) {
        saveState();
        if (!silent) {
            closeEditor();
            import('./index.js').then(module => {
                if (module.renderEncounters) module.renderEncounters();
            });
        }
    }
    return saved;
}

export default { openEditor, closeEditor };
