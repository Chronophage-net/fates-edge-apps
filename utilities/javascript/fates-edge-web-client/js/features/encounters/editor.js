/**
 * Encounter Editor - Create and edit encounters
 * Supports title, description, difficulty (TL 1-10), location, adversaries, and status
 * Integrated with Combat Tracker and Bestiary
 * ✅ Preserves bestiary TL, class, category, stats, and sb_spends on adversaries
 */

import { getState, saveState } from '../../core/state.js';
import { generateId, escHtml, safeParseInt } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { openTracker } from './combat.js';
import { loadBestiaryData, getCreatureDescription } from './bestiary.js';

let modal = null;
let editingId = null;
let isNew = false;
let currentEncounter = null;

// ============================================================
// HELPERS
// ============================================================

function attr(val) {
    return escHtml(String(val ?? '')).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeJsonParse(str, fallback) {
    try { return JSON.parse(str); } catch (_) { return fallback; }
}

function getCategoryBadgeColor(category) {
    const map = {
        'beast': 'green', 'undead': 'red', 'humanoid': 'blue', 'fiend': 'purple',
        'construct': 'gold', 'plant': 'green', 'dragon': 'red', 'elemental': 'blue',
        'celestial': 'gold', 'abomination': 'purple'
    };
    return map[(category || '').toLowerCase()] || 'gold';
}

function tlToMaxHarm(tl) {
    return Math.max(1, (safeParseInt(tl, 2) + 2));
}

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
            difficulty: 3,
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

function renderEditor(encounter) {
    modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;
        z-index: 1000; padding: 1rem; backdrop-filter: blur(8px);
    `;

    const advRows = (encounter.adversaries || []).map((a, i) => `
        <div class="adv-row" data-index="${i}" style="display:flex;gap:0.35rem;margin:0.3rem 0;align-items:center;flex-wrap:wrap;">
            <input type="text" class="adv-name" placeholder="Name" value="${attr(a.name || '')}" style="flex:2;min-width:120px;" />
            <input type="text" class="adv-body" placeholder="Description / stats" value="${attr(a.body || '')}" style="flex:3;min-width:150px;" />
            <input type="hidden" class="adv-tl" value="${a.tl !== undefined ? attr(String(a.tl)) : ''}" />
            <input type="hidden" class="adv-class" value="${attr(a.class || '')}" />
            <input type="hidden" class="adv-category" value="${attr(a.category || '')}" />
            <input type="hidden" class="adv-stats" value="${attr(JSON.stringify(a.stats || {}))}" />
            <input type="hidden" class="adv-sb-spends" value="${attr(JSON.stringify(a.sb_spends || []))}" />
            ${a.tl !== undefined ? `<span class="badge" style="font-size:0.65rem;background:rgba(255,100,100,0.15);color:var(--red);padding:0.05rem 0.4rem;border-radius:10px;">TL${a.tl}</span>` : ''}
            ${a.class ? `<span class="badge" style="font-size:0.65rem;background:rgba(100,180,255,0.15);color:var(--accent);padding:0.05rem 0.4rem;border-radius:10px;">Class ${attr(a.class)}</span>` : ''}
            ${a.category ? `<span class="badge badge-${getCategoryBadgeColor(a.category)}" style="font-size:0.65rem;color:white;padding:0.05rem 0.4rem;border-radius:10px;">${escHtml(a.category)}</span>` : ''}
            <button class="btn btn-xs btn-danger adv-remove" data-index="${i}">✕</button>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:var(--bg2);padding:1.5rem;border-radius:12px;max-width:680px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h2 style="margin:0;color:var(--gold);">${isNew ? 'New Encounter' : 'Edit Encounter'}</h2>
                <button id="editor-close" style="background:none;border:none;color:var(--text2);font-size:1.5rem;cursor:pointer;">✕</button>
            </div>

            <div class="form-group" style="margin-bottom:0.8rem;">
                <label>Title *</label>
                <input id="enc-title" value="${attr(encounter.title)}" placeholder="Encounter name" style="width:100%;" />
            </div>

            <div class="form-group" style="margin-bottom:0.8rem;">
                <label>Description</label>
                <textarea id="enc-body" rows="3" placeholder="Describe the encounter..." style="width:100%;">${attr(encounter.body || '')}</textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:0.8rem;">
                <div class="form-group">
                    <label>Threat Level (1-10)</label>
                    <input type="number" id="enc-difficulty" value="${encounter.difficulty || 3}" min="1" max="10" />
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input id="enc-location" value="${attr(encounter.location || '')}" placeholder="Where?" />
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
                <label style="display:block;margin-bottom:0.3rem;">Adversaries</label>
                <div id="adv-list">${advRows}</div>
                <div style="display:flex;gap:0.5rem;margin-top:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-sm" id="adv-add">+ Add Adversary</button>
                    <button class="btn btn-sm btn-ghost" id="adv-import-bestiary">📖 Import from Bestiary</button>
                </div>
            </div>

            <div style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem;flex-wrap:wrap;">
                <button class="btn btn-gold" id="editor-save">💾 Save</button>
                <button class="btn btn-primary" id="editor-open-tracker">⚔️ Open Combat Tracker</button>
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
        const saved = saveEditor(encounter, true);
        if (saved) {
            const state = getState();
            const enc = state.encounters.find(e => String(e.id) === String(editingId));
            if (enc) {
                openTracker(enc.id);
                closeEditor();
            }
        }
    });

    modal.querySelector('#adv-add')?.addEventListener('click', () => {
        const list = document.getElementById('adv-list');
        const div = document.createElement('div');
        div.className = 'adv-row';
        div.style.cssText = 'display:flex;gap:0.35rem;margin:0.3rem 0;align-items:center;flex-wrap:wrap;';
        div.innerHTML = `
            <input type="text" class="adv-name" placeholder="Name" style="flex:2;min-width:120px;" />
            <input type="text" class="adv-body" placeholder="Description / stats" style="flex:3;min-width:150px;" />
            <input type="hidden" class="adv-tl" value="" />
            <input type="hidden" class="adv-class" value="" />
            <input type="hidden" class="adv-category" value="" />
            <input type="hidden" class="adv-stats" value="{}" />
            <input type="hidden" class="adv-sb-spends" value="[]" />
            <button class="btn btn-xs btn-danger adv-remove">✕</button>
        `;
        list.appendChild(div);
        const nameInput = div.querySelector('.adv-name');
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
// IMPORT FROM BESTIARY
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
                    max-width: 520px; width: 100%; max-height: 80vh; overflow-y: auto;">
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
            <div class="bestiary-import-item" data-name="${attr(c.name)}"
                 style="padding:0.5rem; border-bottom:1px solid var(--border); cursor:pointer;
                        display:flex; justify-content:space-between; align-items:center;flex-wrap:wrap;gap:0.4rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                    <strong style="font-size:0.9rem;">${escHtml(c.name)}</strong>
                    ${c.tl !== undefined ? `<span style="font-size:0.65rem;color:var(--red);">TL${c.tl}</span>` : ''}
                    ${c.class ? `<span style="font-size:0.65rem;color:var(--accent);">Class ${escHtml(c.class)}</span>` : ''}
                    ${c.category ? `<span class="badge badge-${getCategoryBadgeColor(c.category)}" style="font-size:0.6rem;color:white;">${escHtml(c.category)}</span>` : ''}
                </div>
                <span style="font-size:0.75rem;color:var(--text3);max-width:220px;overflow:hidden;text-overflow:ellipsis;">
                    ${escHtml((getCreatureDescription(c) || '').slice(0, 60))}${((getCreatureDescription(c) || '').length > 60 ? '…' : '')}
                </span>
            </div>
        `).join('');

        listContainer.querySelectorAll('.bestiary-import-item').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.dataset.name;
                const entry = creatures.find(e => e.name === name);
                if (!entry) return;

                const list = document.getElementById('adv-list');
                const div = document.createElement('div');
                div.className = 'adv-row';
                div.style.cssText = 'display:flex;gap:0.35rem;margin:0.3rem 0;align-items:center;flex-wrap:wrap;';
                div.innerHTML = `
                    <input type="text" class="adv-name" placeholder="Name" value="${attr(entry.name)}" style="flex:2;min-width:120px;" />
                    <input type="text" class="adv-body" placeholder="Description / stats" value="${attr(getCreatureDescription(entry))}" style="flex:3;min-width:150px;" />
                    <input type="hidden" class="adv-tl" value="${entry.tl !== undefined ? attr(String(entry.tl)) : ''}" />
                    <input type="hidden" class="adv-class" value="${attr(entry.class || '')}" />
                    <input type="hidden" class="adv-category" value="${attr(entry.category || '')}" />
                    <input type="hidden" class="adv-stats" value="${attr(JSON.stringify(entry.stats || {}))}" />
                    <input type="hidden" class="adv-sb-spends" value="${attr(JSON.stringify(entry.sb_spends || []))}" />
                    ${entry.tl !== undefined ? `<span class="badge" style="font-size:0.65rem;background:rgba(255,100,100,0.15);color:var(--red);padding:0.05rem 0.4rem;border-radius:10px;">TL${entry.tl}</span>` : ''}
                    ${entry.class ? `<span class="badge" style="font-size:0.65rem;background:rgba(100,180,255,0.15);color:var(--accent);padding:0.05rem 0.4rem;border-radius:10px;">Class ${escHtml(entry.class)}</span>` : ''}
                    ${entry.category ? `<span class="badge badge-${getCategoryBadgeColor(entry.category)}" style="font-size:0.65rem;color:white;padding:0.05rem 0.4rem;border-radius:10px;">${escHtml(entry.category)}</span>` : ''}
                    <button class="btn btn-xs btn-danger adv-remove">✕</button>
                `;
                list.appendChild(div);
                showToast(`Added ${entry.name} to adversaries.`, 'success');
                searchModal.remove();
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
    const difficulty = Math.min(Math.max(safeParseInt(document.getElementById('enc-difficulty')?.value, 3), 1), 10);
    const location = document.getElementById('enc-location')?.value.trim() || '';
    const status = document.getElementById('enc-status')?.value || 'draft';

    const adversaries = [];
    document.querySelectorAll('.adv-row').forEach(row => {
        const name = row.querySelector('.adv-name')?.value.trim();
        if (name) {
            const tlVal = row.querySelector('.adv-tl')?.value.trim();
            adversaries.push({
                name,
                body: row.querySelector('.adv-body')?.value.trim() || '',
                tl: tlVal ? safeParseInt(tlVal, undefined) : undefined,
                class: row.querySelector('.adv-class')?.value.trim() || '',
                category: row.querySelector('.adv-category')?.value.trim() || '',
                stats: safeJsonParse(row.querySelector('.adv-stats')?.value.trim() || '{}', {}),
                sb_spends: safeJsonParse(row.querySelector('.adv-sb-spends')?.value.trim() || '[]', [])
            });
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
            difficulty,
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
            existing.difficulty = difficulty;
            existing.location = location;
            existing.status = status;
            existing.adversaries = adversaries;
            currentEncounter = existing;
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