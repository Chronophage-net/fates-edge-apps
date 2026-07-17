/**
 * Encounter Editor - Create and edit encounters
 * Supports title, description, difficulty, location, adversaries, and status
 */

import { getState, saveState } from '../../core/state.js';
import { generateId, escHtml, safeParseInt } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

let modal = null;
let editingId = null;
let isNew = false;

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
    
    renderEditor(encounter);
}

export function closeEditor() {
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
    modal = null;
    editingId = null;
    isNew = false;
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
        <div class="adv-row" data-index="${i}" style="display:flex;gap:0.3rem;margin:0.2rem 0;align-items:center;">
            <input type="text" class="adv-name" placeholder="Name" value="${escHtml(a.name || '')}" style="flex:2;" />
            <input type="text" class="adv-body" placeholder="Description / stats" value="${escHtml(a.body || '')}" style="flex:3;" />
            <button class="btn btn-xs btn-danger adv-remove" data-index="${i}">✕</button>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:var(--bg2);padding:1.5rem;border-radius:12px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid var(--border);">
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
                <div id="adv-list">${advRows}</div>
                <button class="btn btn-sm" id="adv-add">+ Add Adversary</button>
            </div>
            
            <div style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem;">
                <button class="btn btn-gold" id="editor-save">💾 Save</button>
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
    
    modal.querySelector('#adv-add')?.addEventListener('click', () => {
        const list = document.getElementById('adv-list');
        const idx = list.children.length;
        const div = document.createElement('div');
        div.className = 'adv-row';
        div.dataset.index = idx;
        div.style.cssText = 'display:flex;gap:0.3rem;margin:0.2rem 0;align-items:center;';
        div.innerHTML = `
            <input type="text" class="adv-name" placeholder="Name" style="flex:2;" />
            <input type="text" class="adv-body" placeholder="Description / stats" style="flex:3;" />
            <button class="btn btn-xs btn-danger adv-remove" data-index="${idx}">✕</button>
        `;
        list.appendChild(div);
        const nameInput = div.querySelector('.adv-name');
        if (nameInput) setTimeout(() => nameInput.focus(), 50);
    });
    
    // Delegate remove buttons
    modal.querySelector('#adv-list')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('adv-remove')) {
            const row = e.target.closest('.adv-row');
            if (row) row.remove();
        }
    });
}

// ============================================================
// SAVE
// ============================================================

function saveEditor(baseEncounter) {
    const title = document.getElementById('enc-title')?.value.trim();
    if (!title) {
        showToast('Title is required.', 'error');
        const el = document.getElementById('enc-title');
        if (el) { el.focus(); el.style.borderColor = 'var(--red)'; }
        return;
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
            adversaries.push({ name, body });
        }
    });
    
    const state = getState();
    if (!state.encounters) state.encounters = [];
    
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
        showToast(`✅ Encounter "${title}" created.`, 'success');
    } else {
        const existing = state.encounters.find(e => String(e.id) === String(editingId));
        if (existing) {
            existing.title = title;
            existing.body = body;
            existing.difficulty = Math.min(Math.max(difficulty, 1), 5);
            existing.location = location;
            existing.status = status;
            existing.adversaries = adversaries;
            showToast(`✅ Encounter "${title}" updated.`, 'success');
        } else {
            showToast('Encounter not found.', 'error');
            return;
        }
    }
    
    saveState();
    closeEditor();
    import('./index.js').then(module => {
        if (module.renderEncounters) module.renderEncounters();
    });
}

export default { openEditor, closeEditor };