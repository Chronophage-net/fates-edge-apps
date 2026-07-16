/**
 * Character editor modal
 * FIXED: Modal properly destroys itself on save
 * FIXED: Complete cleanup of DOM elements and event listeners
 * FIXED: Overlay listener cleanup
 * FIXED: Prevent duplicate listeners
 */

import { 
    getState,  
    generateId,
    escHtml, 
    safeParseInt, 
    clamp 
} from '../../core/utils.js';
import { addCharacter, getCharacter, updateCharacter} from '../../core/state.js';
import { ALL_SKILLS, defaultSkills } from '../../core/dice.js';
import { showToast } from '../../components/Toast.js';

// ============================================================
// STATE
// ============================================================

const editorState = {
    currentId: null,
    isNew: false,
    isOpen: false,
    initialized: false,
    modalElement: null,
    escListener: null,
    overlayListener: null,
    saveListener: null,
    cancelListeners: []
};

// ============================================================
// INITIALIZATION
// ============================================================

function initEditor() {
    if (editorState.initialized) return;
    
    // Use event delegation
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // Handle add buttons
        if (target.matches('[data-editor-add]')) {
            const type = target.dataset.editorAdd;
            addCEDynamic(type);
            e.preventDefault();
        }
        
        // Handle remove buttons
        if (target.matches('.editor-remove-btn')) {
            const row = target.closest('.dynamic-row');
            if (row) row.remove();
            e.preventDefault();
        }
        
        // Handle wiki add
        if (target.matches('[data-editor-wiki-add]')) {
            const type = target.dataset.editorWikiAdd;
            const select = document.getElementById(`ce-${type}-wiki`);
            if (select && select.value) {
                addCEDynamicFromWiki(type, select.value);
                select.value = '';
            }
            e.preventDefault();
        }
    });
    
    editorState.initialized = true;
}

// ============================================================
// PUBLIC API
// ============================================================

export function openEditor(id) {
    // Close any existing editor first
    closeEditor();
    
    initEditor();
    
    // Create fresh modal
    const modal = createModal();
    document.body.appendChild(modal);
    
    const title = document.getElementById('char-modal-title');
    const content = document.getElementById('char-editor-content');
    
    if (!modal || !title || !content) {
        showToast('Editor modal not found. Please refresh.', 'error');
        return;
    }
    
    let c;
    if (id) {
        c = getCharacter(id);
        if (!c) {
            showToast('Character not found', 'error');
            return;
        }
        editorState.currentId = id;
        editorState.isNew = false;
        title.textContent = 'Edit Character';
    } else {
        c = createNewCharacter();
        editorState.currentId = c.id;
        editorState.isNew = true;
        title.textContent = 'New Character';
    }
    
    editorState.isOpen = true;
    editorState.modalElement = modal;
    content.innerHTML = buildEditorHTML(c);
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    
    // Attach event listeners after rendering
    attachEditorEvents();
}

export function closeEditor() {
    // Remove modal from DOM completely
    const modal = document.getElementById('charModal');
    if (modal) {
        // Remove overlay listener
        if (editorState.overlayListener) {
            modal.removeEventListener('click', editorState.overlayListener);
            editorState.overlayListener = null;
        }
        modal.remove(); // This removes it from the DOM entirely
    }
    
    document.body.classList.remove('modal-open');
    
    // Clean up all event listeners
    if (editorState.escListener) {
        document.removeEventListener('keydown', editorState.escListener);
        editorState.escListener = null;
    }
    
    if (editorState.saveListener) {
        const saveBtn = document.getElementById('ce-save-btn');
        if (saveBtn) {
            saveBtn.removeEventListener('click', editorState.saveListener);
        }
        editorState.saveListener = null;
    }
    
    // Clean up cancel listeners
    editorState.cancelListeners.forEach(listener => {
        const btn = listener.btn;
        if (btn) {
            btn.removeEventListener('click', listener.handler);
        }
    });
    editorState.cancelListeners = [];
    
    editorState.isOpen = false;
    editorState.currentId = null;
    editorState.isNew = false;
    editorState.modalElement = null;
}

// ============================================================
// MODAL CREATION
// ============================================================

function createModal() {
    const modal = document.createElement('div');
    modal.id = 'charModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 9999;
        align-items: center;
        justify-content: center;
        padding: 1rem;
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="
            background: var(--bg2);
            border-radius: var(--radius);
            max-width: 900px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 1.5rem 2rem;
            border: 1px solid var(--border);
            position: relative;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h2 id="char-modal-title" style="margin:0;color:var(--gold);">Character Editor</h2>
                <button id="charModalClose" style="background:none;border:none;color:var(--text2);font-size:1.5rem;cursor:pointer;padding:0.2rem 0.5rem;">✕</button>
            </div>
            <div id="char-editor-content"></div>
        </div>
    `;
    
    return modal;
}

// ============================================================
// HELPERS
// ============================================================

function createNewCharacter() {
    return {
        id: generateId(),
        name: '',
        heritage: '',
        background: '',
        patron: '',
        tier: 'I',
        xp: 32,
        body: 3,
        wits: 2,
        spirit: 1,
        presence: 1,
        skills: defaultSkills(),
        talents: [],
        assets: [],
        equipment: [],
        bonds: [],
        complications: [],
        harm: 0,
        fatigue: 0,
        boons: 0,
        vtt: false
    };
}

// ============================================================
// EVENT ATTACHMENT
// ============================================================

function attachEditorEvents() {
    // Save button - store listener for cleanup
    const saveBtn = document.getElementById('ce-save-btn');
    if (saveBtn) {
        // Remove any existing listeners
        if (editorState.saveListener) {
            saveBtn.removeEventListener('click', editorState.saveListener);
        }
        editorState.saveListener = saveEditor;
        saveBtn.addEventListener('click', editorState.saveListener);
    }
    
    // Cancel/Close buttons - store listeners for cleanup
    const closeBtns = ['ce-cancel-btn', 'charModalClose'];
    for (const id of closeBtns) {
        const btn = document.getElementById(id);
        if (btn) {
            const handler = closeEditor;
            btn.addEventListener('click', handler);
            editorState.cancelListeners.push({ btn, handler });
        }
    }
    
    // Close on overlay click - remove existing first
    const modal = document.getElementById('charModal');
    if (modal) {
        if (editorState.overlayListener) {
            modal.removeEventListener('click', editorState.overlayListener);
            editorState.overlayListener = null;
        }
        const handler = (e) => {
            if (e.target === modal) {
                closeEditor();
            }
        };
        modal.addEventListener('click', handler);
        editorState.overlayListener = handler;
    }
    
    // Keyboard shortcut
    if (editorState.escListener) {
        document.removeEventListener('keydown', editorState.escListener);
    }
    editorState.escListener = (e) => {
        if (!editorState.isOpen) return;
        if (e.key === 'Escape') {
            closeEditor();
        }
    };
    document.addEventListener('keydown', editorState.escListener);
}

// ============================================================
// BUILD EDITOR HTML
// ============================================================

function buildEditorHTML(c) {
    const skillInputs = ALL_SKILLS.map(s => {
        const key = s.toLowerCase();
        const val = c.skills?.[key] ?? 0;
        return `
            <div class="skill-item">
                <label>${s}</label>
                <input type="number" id="ce-sk-${key}" value="${val}" min="0" max="5" />
            </div>
        `;
    }).join('');
    
    const talentRows = (c.talents || []).map((t, i) => dynamicRowHTML('talent', i, t)).join('');
    const assetRows = (c.assets || []).map((a, i) => dynamicRowHTML('asset', i, a)).join('');
    const equipRows = (c.equipment || []).map((e, i) => dynamicRowHTML('equipment', i, e)).join('');
    const bondRows = (c.bonds || []).map((b, i) => dynamicRowHTML('bond', i, b)).join('');
    const compRows = (c.complications || []).map((x, i) => dynamicRowHTML('complication', i, x)).join('');
    
    return `
        <div class="editor-form">
            <div class="form-row">
                <div class="field"><label>Name *</label><input id="ce-name" value="${escHtml(c.name)}" /></div>
                <div class="field"><label>Heritage</label><input id="ce-heritage" value="${escHtml(c.heritage || '')}" /></div>
            </div>
            <div class="form-row">
                <div class="field"><label>Background</label><input id="ce-background" value="${escHtml(c.background || '')}" /></div>
                <div class="field"><label>Patron</label><input id="ce-patron" value="${escHtml(c.patron || '')}" /></div>
            </div>
            <div class="form-row">
                <div class="field"><label>Tier</label><input id="ce-tier" value="${escHtml(c.tier || 'I')}" /></div>
                <div class="field"><label>Starting XP</label><input type="number" id="ce-xp" value="${c.xp || 32}" min="0" max="36" /></div>
                <div class="field" style="display:flex;align-items:end;">
                    <label class="inline-check"><input type="checkbox" id="ce-vtt" ${c.vtt ? 'checked' : ''} /> Push to VTT</label>
                </div>
            </div>
            
            <h3 style="margin:0.8rem 0 0.4rem;">Attributes</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;">
                <div class="stat-item"><label>Body</label><input type="number" id="ce-body" value="${c.body}" min="1" max="5" /></div>
                <div class="stat-item"><label>Wits</label><input type="number" id="ce-wits" value="${c.wits}" min="1" max="5" /></div>
                <div class="stat-item"><label>Spirit</label><input type="number" id="ce-spirit" value="${c.spirit}" min="1" max="5" /></div>
                <div class="stat-item"><label>Presence</label><input type="number" id="ce-presence" value="${c.presence}" min="1" max="5" /></div>
            </div>
            
            <h3 style="margin:0.8rem 0 0.4rem;">Status</h3>
            <div class="form-row">
                <div class="field small"><label>Harm</label><input type="number" id="ce-harm" value="${c.harm || 0}" min="0" max="3" /></div>
                <div class="field small"><label>Fatigue</label><input type="number" id="ce-fatigue" value="${c.fatigue || 0}" min="0" /></div>
                <div class="field small"><label>Boons</label><input type="number" id="ce-boons" value="${c.boons || 0}" min="0" max="5" /></div>
            </div>
            
            <h3 style="margin:0.8rem 0 0.4rem;">Talents</h3>
            ${wikiPickerHTML('talent', 'talents')}
            <div class="dynamic-list" id="ce-talent-list">${talentRows}</div>
            
            <h3 style="margin:0.8rem 0 0.4rem;">Assets</h3>
            ${wikiPickerHTML('asset', 'assets')}
            <div class="dynamic-list" id="ce-asset-list">${assetRows}</div>
            
            <h3 style="margin:0.8rem 0 0.4rem;">Equipment</h3>
            ${wikiPickerHTML('equipment', 'equipment')}
            <div class="dynamic-list" id="ce-equipment-list">${equipRows}</div>
            
            <h3 style="margin:0.8rem 0 0.4rem;">Bonds</h3>
            <button class="btn btn-sm" data-editor-add="bond">+ Add Bond</button>
            <div class="dynamic-list" id="ce-bond-list">${bondRows}</div>
            
            <h3 style="margin:0.8rem 0 0.4rem;">Complications</h3>
            <button class="btn btn-sm" data-editor-add="complication">+ Add Complication</button>
            <div class="dynamic-list" id="ce-complication-list">${compRows}</div>
            
            <h3 style="margin:0.8rem 0 0.4rem;">Skills</h3>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.3rem;font-size:0.85rem;">${skillInputs}</div>
            
            <div class="flex mt-1" style="gap:0.5rem;">
                <button class="btn btn-gold" id="ce-save-btn">💾 Save</button>
                <button class="btn" id="ce-cancel-btn">Cancel</button>
            </div>
        </div>
    `;
}

// ============================================================
// ROW HTML BUILDERS
// ============================================================

function dynamicRowHTML(type, idx, item = {}) {
    if (type === 'bond' || type === 'complication') {
        return `
            <div class="dynamic-row ce-${type}-row" data-index="${idx}">
                <input type="text" class="ce-${type}-name" placeholder="${type === 'bond' ? 'Bond name' : 'Complication name'}" value="${escHtml(item.name || '')}" />
                <input type="text" class="ce-${type}-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;" />
                <label class="inline-check">
                    <input type="checkbox" class="ce-${type}-start" ${item.start !== false ? 'checked' : ''} /> 
                    +2 XP
                </label>
                <button class="btn btn-xs editor-remove-btn">✕</button>
            </div>
        `;
    }
    
    return `
        <div class="dynamic-row ce-${type}-row" data-index="${idx}">
            <input type="text" class="ce-${type}-name" placeholder="Name" value="${escHtml(item.name || '')}" style="flex:2;" />
            <input type="number" class="ce-${type}-cost" placeholder="XP" value="${item.cost || 0}" min="0" style="width:70px;" />
            <button class="btn btn-xs editor-remove-btn">✕</button>
        </div>
    `;
}

// ============================================================
// WIKI PICKER
// ============================================================

function wikiPickerHTML(type, cat) {
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    const options = wikiEntries
        .filter(e => e.category === cat)
        .map(e => `
            <option value="${escHtml(String(e.id))}">
                ${escHtml(e.title)}${e.cost != null ? ' (' + e.cost + ' XP)' : ''}
            </option>
        `)
        .join('');
    
    return `
        <div class="form-row" style="margin:0.3rem 0;">
            <div class="field" style="flex:2;">
                <select id="ce-${type}-wiki">
                    <option value="">Select from wiki…</option>
                    ${options}
                </select>
            </div>
            <button class="btn btn-sm" data-editor-wiki-add="${type}">Add from Wiki</button>
            <button class="btn btn-sm" data-editor-add="${type}">+ Custom</button>
        </div>
    `;
}

// ============================================================
// SAVE EDITOR
// ============================================================

export function saveEditor() {
    const g = s => document.querySelector(s);
    const v = s => g(s)?.value || '';
    const n = s => safeParseInt(g(s)?.value);
    
    // Validate name
    const name = v('#ce-name');
    if (!name || !name.trim()) {
        showToast('Character name is required.', 'error');
        const nameInput = document.querySelector('#ce-name');
        if (nameInput) {
            nameInput.style.borderColor = 'var(--red)';
            nameInput.focus();
            setTimeout(() => nameInput.style.borderColor = '', 3000);
        }
        return;
    }
    
    // Get the existing character by ID
    let c = getCharacter(editorState.currentId);
    if (!c) {
        showToast('Character not found', 'error');
        return;
    }
    
    try {
        // Basic fields
        c.name = name.trim();
        c.heritage = v('#ce-heritage');
        c.background = v('#ce-background');
        c.patron = v('#ce-patron');
        c.tier = v('#ce-tier') || 'I';
        c.xp = clamp(n('#ce-xp'), 0, 36);
        
        // Attributes
        c.body = clamp(n('#ce-body'), 1, 5);
        c.wits = clamp(n('#ce-wits'), 1, 5);
        c.spirit = clamp(n('#ce-spirit'), 1, 5);
        c.presence = clamp(n('#ce-presence'), 1, 5);
        
        // Status
        c.harm = clamp(n('#ce-harm'), 0, 3);
        c.fatigue = Math.max(0, n('#ce-fatigue'));
        c.boons = clamp(n('#ce-boons'), 0, 5);
        c.vtt = document.getElementById('ce-vtt')?.checked || false;
        
        // Skills
        if (!c.skills) c.skills = defaultSkills();
        ALL_SKILLS.forEach(s => {
            c.skills[s.toLowerCase()] = clamp(n('#ce-sk-' + s.toLowerCase()), 0, 5);
        });
        
        // Dynamic lists
        c.talents = readDynamicList('talent');
        c.assets = readDynamicList('asset');
        c.equipment = readDynamicList('equipment');
        c.bonds = readDynamicList('bond');
        c.complications = readDynamicList('complication');
        
        // Save
        updateCharacter(editorState.currentId, c);
        
        // Close the modal FIRST (this removes it from DOM)
        closeEditor();
        
        // Then refresh the characters list
        import('./index.js').then(module => {
            if (module.renderCharList) {
                module.renderCharList();
            }
        });
        
        showToast(`Character "${c.name}" saved successfully.`, 'success');
        
    } catch (error) {
        console.error('[Editor] Error saving character:', error);
        showToast('Error saving character. Please try again.', 'error');
    }
}

// ============================================================
// READ DYNAMIC LISTS
// ============================================================

function readDynamicList(type) {
    const items = [];
    const rows = document.querySelectorAll('.ce-' + type + '-row');
    
    for (const row of rows) {
        if (type === 'bond' || type === 'complication') {
            const nameInput = row.querySelector('.ce-' + type + '-name');
            const descInput = row.querySelector('.ce-' + type + '-desc');
            const startCheck = row.querySelector('.ce-' + type + '-start');
            
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) continue;
            
            items.push({
                name,
                desc: descInput ? descInput.value.trim() : '',
                start: startCheck ? startCheck.checked : false
            });
        } else {
            const nameInput = row.querySelector('.ce-' + type + '-name');
            const costInput = row.querySelector('.ce-' + type + '-cost');
            
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) continue;
            
            items.push({
                name,
                cost: costInput ? safeParseInt(costInput.value, 0) : 0
            });
        }
    }
    
    return items;
}

// ============================================================
// DYNAMIC ROW ADDERS
// ============================================================

export function addCEDynamic(type) {
    const container = document.getElementById('ce-' + type + '-list');
    if (!container) {
        console.warn(`[Editor] Container not found: ce-${type}-list`);
        return;
    }
    
    const idx = container.children.length;
    const div = document.createElement('div');
    div.innerHTML = dynamicRowHTML(type, idx, {});
    const row = div.firstElementChild;
    container.appendChild(row);
    
    // Focus the first input
    const firstInput = row.querySelector('input[type="text"]');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 50);
    }
}

export function addCEDynamicFromWiki(type, entryId) {
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    const entry = wikiEntries.find(e => String(e.id) === String(entryId));
    
    if (!entry) {
        showToast('Wiki entry not found.', 'error');
        return;
    }
    
    const container = document.getElementById('ce-' + type + '-list');
    if (!container) return;
    
    const idx = container.children.length;
    const cost = entry.cost != null ? entry.cost : 0;
    const div = document.createElement('div');
    div.innerHTML = dynamicRowHTML(type, idx, { name: entry.title, cost });
    container.appendChild(div.firstElementChild);
    
    showToast(`Added "${entry.title}" from wiki.`, 'success');
}

// ============================================================
// SETUP EVENTS
// ============================================================

function setupEditorEvents() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (!editorState.isOpen) return;
        if (e.key === 'Escape') {
            closeEditor();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            // Ctrl+Enter or Cmd+Enter to save
            e.preventDefault();
            const saveBtn = document.getElementById('ce-save-btn');
            if (saveBtn) saveBtn.click();
        }
    });
}

// ============================================================
// INITIALIZE
// ============================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initEditor();
        setupEditorEvents();
    });
} else {
    initEditor();
    setupEditorEvents();
}

// ============================================================
// EXPOSE GLOBALS
// ============================================================

Object.assign(window, {
    addCEDynamic,
    addCEDynamicFromWiki,
    saveEditor,
    closeEditor,
    openEditor
});

// ============================================================
// EXPORTS
// ============================================================

export default {
    openEditor,
    closeEditor,
    saveEditor,
    addCEDynamic,
    addCEDynamicFromWiki
};