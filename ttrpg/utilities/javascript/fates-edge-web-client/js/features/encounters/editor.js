/**
 * Encounter Editor - Create and edit encounters with adversary management
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

let currentEditorId = null;
let modal = null;
let templateOverlay = null;

// Quick adversary templates from Witnessed Prey
const ADVERSARY_TEMPLATES = [
    { name: 'Bandit Rabble (TL 1)', body: 'Body 2, Wits 1, Spirit 1, Presence 1. Harm: 2. Key: Melee 1. Rabble — On a Miss, GM gains 1 SB.' },
    { name: 'City Watch Recruit (TL 2)', body: 'Body 2, Wits 1, Spirit 1, Presence 2. Harm: 3. Key: Melee 1, Command 1. Alarm — On Partial/Miss, advance Reinforcements timer.' },
    { name: 'Cult Novice (TL 1)', body: 'Body 1, Wits 1, Spirit 2, Presence 1. Harm: 2. Key: Lore 1, Sway 1. Faith\'s Crumble — Can be discredited.' },
    { name: 'Assassin (TL 3)', body: 'Body 3, Wits 3, Spirit 2, Presence 2. Harm: 4. Key: Stealth 3, Melee 2. First Strike — Dominant on first round.' },
    { name: 'Ghostly Anchor (TL 3)', body: 'Spirit 4, Lore 2, Harm 3. Unfinished Business — Cannot be harmed until anchor addressed. Bargain — May offer a deal.' },
    { name: 'Hobgoblin (TL 2-3)', body: 'Body 3, Wits 2, Spirit 2, Presence 2. Harm: 4. Key: Melee 3, Command 2. Tactical Awareness — Cannot be surprised.' },
    { name: 'Bugbear (TL 3)', body: 'Body 4, Wits 3, Spirit 2, Presence 1. Harm: 5. Key: Melee 4, Stealth 3. Surprise Strike — +2 Harm from Hidden.' },
    { name: 'Lesser Vampire (TL 3)', body: 'Body 3, Wits 3, Spirit 3, Presence 3. Harm: 5. Key: Melee 2, Sway 2. Blood Drain — Heals on hit.' }
];

/**
 * Open the encounter editor
 */
export function openEditor(id) {
    const state = getState();
    if (!state.encounters) state.encounters = [];
    const entry = id ? state.encounters.find(e => String(e.id) === String(id)) : null;
    currentEditorId = id;

    // Build modal
    modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;
        z-index: 1000; padding: 1rem;
    `;
    modal.id = 'encounter-editor-modal';
    
    const adversaryList = entry?.adversaries || [];
    
    modal.innerHTML = `
        <div style="background: var(--bg2); padding: 1.5rem 2rem; border-radius: var(--radius); max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h2 style="margin:0;color:var(--gold);">${entry ? '✏️ Edit Encounter' : '🆕 New Encounter'}</h2>
                <button id="enc-modal-close" style="background:none;border:none;color:var(--text2);font-size:1.5rem;cursor:pointer;">✕</button>
            </div>
            
            <div class="field">
                <label>Title *</label>
                <input id="enc-title" value="${entry ? escHtml(entry.title) : ''}" style="width:100%;" placeholder="e.g., Ambush at the Bridge" />
            </div>
            
            <div class="field">
                <label>Description</label>
                <textarea id="enc-body" rows="3" style="width:100%;" placeholder="Describe the encounter...">${entry ? escHtml(entry.body) : ''}</textarea>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                <div class="field">
                    <label>Location</label>
                    <input id="enc-location" value="${entry ? escHtml(entry.location || '') : ''}" style="width:100%;" placeholder="Where?" />
                </div>
                <div class="field">
                    <label>Difficulty (1-5)</label>
                    <input id="enc-difficulty" type="number" min="1" max="5" value="${entry ? entry.difficulty : 3}" style="width:100%;" />
                </div>
            </div>
            
            <div class="field">
                <label>Status</label>
                <select id="enc-status" style="width:100%;">
                    <option value="draft" ${entry?.status === 'draft' ? 'selected' : ''}>📝 Draft</option>
                    <option value="active" ${entry?.status === 'active' ? 'selected' : ''}>⚔️ Active</option>
                    <option value="resolved" ${entry?.status === 'resolved' ? 'selected' : ''}>✅ Resolved</option>
                    <option value="archived" ${entry?.status === 'archived' ? 'selected' : ''}>📦 Archived</option>
                </select>
            </div>
            
            <div style="border-top:1px solid var(--border);padding-top:0.8rem;margin-top:0.8rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                    <h4 style="margin:0;">👾 Adversaries</h4>
                    <div style="display:flex;gap:0.3rem;">
                        <button class="btn btn-xs btn-primary" id="enc-add-adversary">+ Add</button>
                        <button class="btn btn-xs btn-ghost" id="enc-add-template">📋 Template</button>
                    </div>
                </div>
                <div id="enc-adversary-list" style="margin-top:0.3rem;max-height:150px;overflow-y:auto;">
                    ${adversaryList.map((a, i) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.2rem 0.4rem;background:var(--bg3);border-radius:4px;margin-bottom:0.2rem;font-size:0.85rem;">
                            <span style="flex:1;">${escHtml(a.name)}</span>
                            <button class="btn btn-xs btn-ghost enc-remove-adversary" data-index="${i}" style="color:var(--red);">✕</button>
                        </div>
                    `).join('')}
                    ${adversaryList.length === 0 ? '<div style="color:var(--text3);font-size:0.8rem;padding:0.3rem;">No adversaries added yet.</div>' : ''}
                </div>
            </div>
            
            <div style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem;">
                <button class="btn btn-gold" id="enc-save" style="flex:1;">💾 Save</button>
                <button class="btn btn-ghost" id="enc-cancel">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('#enc-modal-close')?.addEventListener('click', closeEditor);
    modal.querySelector('#enc-cancel')?.addEventListener('click', closeEditor);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeEditor(); });
    
    modal.querySelector('#enc-save')?.addEventListener('click', saveEncounter);
    modal.querySelector('#enc-add-adversary')?.addEventListener('click', addAdversary);
    modal.querySelector('#enc-add-template')?.addEventListener('click', () => openTemplateSelector());
    
    modal.querySelectorAll('.enc-remove-adversary').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.index);
            removeAdversary(idx);
        });
    });
}

function closeEditor() {
    // Close template overlay first if open
    closeTemplateSelector();
    
    if (modal) {
        // Remove modal from DOM
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
        modal = null;
    }
    currentEditorId = null;
}

function closeTemplateSelector() {
    if (templateOverlay) {
        // Remove template overlay from DOM
        if (templateOverlay.parentNode) {
            templateOverlay.parentNode.removeChild(templateOverlay);
        }
        templateOverlay = null;
    }
}

function addAdversary() {
    const listEl = document.getElementById('enc-adversary-list');
    if (!listEl) return;
    
    const name = prompt('Enter adversary name:');
    if (!name) return;
    
    const body = prompt('Enter adversary details (stats, traits):') || '';
    
    // Get current list
    const state = getState();
    const entry = currentEditorId ? state.encounters.find(e => String(e.id) === String(currentEditorId)) : null;
    if (!entry) {
        // Create temporary list
        const tempList = [];
        const existing = listEl.querySelectorAll('.enc-remove-adversary');
        existing.forEach(btn => {
            const idx = parseInt(btn.dataset.index);
            // We need to track this differently
        });
        // Simpler: re-render
        renderAdversaryList([...getAdversariesFromDOM(), { name, body }]);
        return;
    }
    
    if (!entry.adversaries) entry.adversaries = [];
    entry.adversaries.push({ name, body });
    renderAdversaryList(entry.adversaries);
    showToast(`Added "${name}"`, 'success');
}

/**
 * Open a template selector dropdown instead of a number prompt
 */
function openTemplateSelector() {
    // Close any existing template overlay
    closeTemplateSelector();
    
    // Create a small modal/overlay for template selection
    templateOverlay = document.createElement('div');
    templateOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 2000; padding: 1rem;
    `;
    templateOverlay.id = 'template-selector-overlay';
    
    const optionsHtml = ADVERSARY_TEMPLATES.map((t, i) => 
        `<option value="${i}">${t.name}</option>`
    ).join('');
    
    templateOverlay.innerHTML = `
        <div style="background: var(--bg2); padding: 1.5rem 2rem; border-radius: var(--radius); max-width: 500px; width: 100%; border: 1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h3 style="margin:0;color:var(--gold);">📋 Select Adversary Template</h3>
                <button id="template-close" style="background:none;border:none;color:var(--text2);font-size:1.5rem;cursor:pointer;">✕</button>
            </div>
            
            <div class="field">
                <label>Template</label>
                <select id="template-select" style="width:100%;padding:0.5rem;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg2);color:var(--text);">
                    <option value="">— Select a template —</option>
                    ${optionsHtml}
                </select>
            </div>
            
            <div id="template-preview" style="margin-top:0.5rem;padding:0.5rem;background:var(--bg3);border-radius:var(--radius);font-size:0.85rem;color:var(--text2);min-height:60px;display:none;">
                <strong>Preview:</strong>
                <span id="template-preview-body"></span>
            </div>
            
            <div style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem;">
                <button class="btn btn-gold" id="template-confirm" style="flex:1;">✅ Add Template</button>
                <button class="btn btn-ghost" id="template-cancel">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(templateOverlay);
    
    // Preview on select change
    const select = templateOverlay.querySelector('#template-select');
    const preview = templateOverlay.querySelector('#template-preview');
    const previewBody = templateOverlay.querySelector('#template-preview-body');
    
    select.addEventListener('change', () => {
        const idx = parseInt(select.value);
        if (!isNaN(idx) && idx >= 0 && idx < ADVERSARY_TEMPLATES.length) {
            const template = ADVERSARY_TEMPLATES[idx];
            previewBody.textContent = template.body;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    });
    
    // Confirm button
    templateOverlay.querySelector('#template-confirm').addEventListener('click', () => {
        const idx = parseInt(select.value);
        if (isNaN(idx) || idx < 0 || idx >= ADVERSARY_TEMPLATES.length) {
            showToast('Please select a template.', 'error');
            return;
        }
        
        const template = ADVERSARY_TEMPLATES[idx];
        const state = getState();
        const entry = currentEditorId ? state.encounters.find(e => String(e.id) === String(currentEditorId)) : null;
        
        if (!entry) {
            // Create a new encounter with this template
            const newEntry = {
                id: 'enc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                title: template.name,
                body: template.body,
                difficulty: 3,
                status: 'draft',
                adversaries: [{ name: template.name, body: template.body }],
                created: Date.now()
            };
            state.encounters.push(newEntry);
            saveState();
            // Remove the template selector overlay
            closeTemplateSelector();
            closeEditor();
            // Re-render list
            if (window.renderEncounters) window.renderEncounters();
            showToast(`🃏 Created from "${template.name}"`, 'success');
            return;
        }
        
        if (!entry.adversaries) entry.adversaries = [];
        entry.adversaries.push({ name: template.name, body: template.body });
        renderAdversaryList(entry.adversaries);
        closeTemplateSelector();
        showToast(`Added "${template.name}"`, 'success');
    });
    
    // Cancel / Close
    templateOverlay.querySelector('#template-cancel').addEventListener('click', closeTemplateSelector);
    templateOverlay.querySelector('#template-close').addEventListener('click', closeTemplateSelector);
    templateOverlay.addEventListener('click', (e) => {
        if (e.target === templateOverlay) closeTemplateSelector();
    });
}

function getAdversariesFromDOM() {
    const list = [];
    const items = document.querySelectorAll('#enc-adversary-list .enc-remove-adversary');
    items.forEach(btn => {
        const idx = parseInt(btn.dataset.index);
        const name = btn.parentElement.querySelector('span')?.textContent || '';
        list.push({ name, body: '' });
    });
    return list;
}

function renderAdversaryList(adversaries) {
    const listEl = document.getElementById('enc-adversary-list');
    if (!listEl) return;
    
    listEl.innerHTML = adversaries.map((a, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.2rem 0.4rem;background:var(--bg3);border-radius:4px;margin-bottom:0.2rem;font-size:0.85rem;">
            <span style="flex:1;cursor:pointer;" title="${escHtml(a.body || '')}">${escHtml(a.name)}</span>
            <button class="btn btn-xs btn-ghost enc-remove-adversary" data-index="${i}" style="color:var(--red);">✕</button>
        </div>
    `).join('');
    
    if (adversaries.length === 0) {
        listEl.innerHTML = '<div style="color:var(--text3);font-size:0.8rem;padding:0.3rem;">No adversaries added yet.</div>';
    }
    
    // Attach remove events
    listEl.querySelectorAll('.enc-remove-adversary').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.index);
            removeAdversary(idx);
        });
    });
}

function removeAdversary(idx) {
    const state = getState();
    const entry = currentEditorId ? state.encounters.find(e => String(e.id) === String(currentEditorId)) : null;
    if (!entry) return;
    if (!entry.adversaries) return;
    entry.adversaries.splice(idx, 1);
    renderAdversaryList(entry.adversaries);
    showToast('Adversary removed.', 'info');
}

function saveEncounter() {
    const title = document.getElementById('enc-title')?.value.trim();
    const body = document.getElementById('enc-body')?.value.trim();
    const location = document.getElementById('enc-location')?.value.trim();
    const difficulty = parseInt(document.getElementById('enc-difficulty')?.value || '3', 10);
    const status = document.getElementById('enc-status')?.value || 'draft';
    
    if (!title) {
        showToast('Title is required.', 'error');
        return;
    }
    
    const state = getState();
    if (!state.encounters) state.encounters = [];
    
    // Get adversaries from DOM
    const adversaryItems = document.querySelectorAll('#enc-adversary-list .enc-remove-adversary');
    const adversaries = [];
    adversaryItems.forEach(btn => {
        const name = btn.parentElement.querySelector('span')?.textContent || '';
        adversaries.push({ name, body: '' });
    });
    
    if (currentEditorId) {
        // Update existing
        const entry = state.encounters.find(e => String(e.id) === String(currentEditorId));
        if (entry) {
            entry.title = title;
            entry.body = body;
            entry.location = location;
            entry.difficulty = difficulty;
            entry.status = status;
            entry.adversaries = adversaries;
        }
    } else {
        // Create new
        const newEntry = {
            id: 'enc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            title,
            body,
            location,
            difficulty,
            status,
            adversaries,
            created: Date.now()
        };
        state.encounters.push(newEntry);
    }
    
    saveState();
    
    // Close the modal first
    closeEditor();
    
    // Then re-render the list
    if (window.renderEncounters) window.renderEncounters();
    
    showToast(`✅ Encounter "${title}" saved.`, 'success');
}

export default { openEditor };
