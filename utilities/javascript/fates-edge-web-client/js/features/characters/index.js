/**
 * Characters feature module
 * Manages character creation, editing, and talent catalogue
 */

import { 
    getState, 
    getCharacter, 
    addCharacter, 
    updateCharacter, 
    deleteCharacter, 
    saveState, 
    generateId,
    escHtml 
} from '../../core/utils.js';
import { createCharacterCard } from '../../components/CharacterCard.js';
import { showToast } from '../../components/Toast.js';

let container = null;
let talentPanelVisible = false;

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    container.innerHTML = `
        <div class="characters-header">
            <div class="flex-between" style="flex-wrap:wrap;gap:0.5rem;">
                <div>
                    <h1 class="page-title" style="margin:0;">👤 Characters</h1>
                    <p class="page-sub" style="margin:0.2rem 0 0;">Create and manage your party.</p>
                </div>
                <div class="flex" style="gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-gold" id="wizardCharBtn">+ New Character (Wizard)</button>
                    <button class="btn btn-sm btn-primary" id="openTalentsBtn">🧙‍♂️ Talents</button>
                </div>
            </div>
        </div>
        
        <!-- Character List -->
        <div class="panel" id="char-list-container">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">
                <h3 style="margin:0;">Your Characters</h3>
                <div style="display:flex;gap:0.3rem;font-size:0.8rem;">
                    <span id="char-count" class="text-muted"></span>
                </div>
            </div>
            <div class="char-list" id="char-list"></div>
        </div>
        
        <!-- Talent Catalogue - Compact -->
        <div class="panel" id="talent-panel" style="position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <h3 style="margin:0;">🧠 Talent Catalogue</h3>
                    <span class="text-muted" style="font-size:0.7rem;" id="talent-count"></span>
                </div>
                <div style="display:flex;gap:0.3rem;">
                    <button class="btn btn-sm btn-ghost" id="talent-toggle-btn" title="Toggle talent list visibility">−</button>
                    <button class="btn btn-sm btn-ghost" id="talent-add-btn" title="Add custom talent">+</button>
                </div>
            </div>
            <div id="talent-list-container" style="max-height:200px;overflow-y:auto;margin-top:0.5rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg2);padding:0.3rem;"></div>
        </div>
    `;
    
    renderCharList();
    renderTalentList();
    attachEvents();
}

// ============================================================
// CHARACTER LIST
// ============================================================

function renderCharList() {
    const list = document.getElementById('char-list');
    if (!list) return;
    
    const state = getState();
    const characters = state.characters || [];
    
    // Update count
    const countEl = document.getElementById('char-count');
    if (countEl) {
        countEl.textContent = `${characters.length} character${characters.length !== 1 ? 's' : ''}`;
    }
    
    if (characters.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="text-align:center;padding:2rem;color:var(--text3);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">👤</div>
                <div>No characters yet.</div>
                <div style="font-size:0.8rem;margin-top:0.3rem;">Click "New Character" to create your first hero.</div>
            </div>
        `;
        return;
    }
    
    // Use CharacterCard component with delegation
    list.innerHTML = characters.map(char => {
        const card = createCharacterCard(char, {
            onEdit: () => {}, // Handled by delegation
            onDelete: () => {},
            onToggleVTT: () => {},
            onRoll: () => {}
        });
        // Store character ID on the card for delegation
        const wrapper = document.createElement('div');
        wrapper.dataset.charId = char.id;
        wrapper.appendChild(card);
        return wrapper.outerHTML;
    }).join('');
    
    // Setup event delegation for character actions
    list.addEventListener('click', handleCharacterAction);
}

function handleCharacterAction(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    
    const card = target.closest('[data-char-id]');
    if (!card) return;
    
    const id = card.dataset.charId;
    const action = target.dataset.action;
    
    switch (action) {
        case 'edit':
            openCharacterEditor(id);
            break;
        case 'delete':
            deleteCharacterHandler(id);
            break;
        case 'vtt':
            togglePushToVTT(id);
            break;
        case 'roll':
            rollForCharacter(id);
            break;
    }
}

// ============================================================
// TALENT LIST - Compact & Scrolling
// ============================================================

function renderTalentList() {
    const container = document.getElementById('talent-list-container');
    if (!container) return;
    
    const state = getState();
    const localTalents = state.talents || [];
    const wikiEntries = state.wikiEntries || [];
    const remoteTalents = wikiEntries.filter(e => 
        e.category === 'talents' || e.category === 'talent'
    );
    
    const total = localTalents.length + remoteTalents.length;
    const countEl = document.getElementById('talent-count');
    if (countEl) {
        countEl.textContent = `(${total} total)`;
    }
    
    if (total === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:0.5rem;color:var(--text3);font-size:0.85rem;">
                No talents defined. Clone from wiki or add custom.
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // Local talents first
    if (localTalents.length > 0) {
        html += localTalents.map(t => `
            <div class="talent-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.2rem 0.4rem;border-bottom:1px solid var(--border);font-size:0.8rem;gap:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;flex:1;min-width:0;">
                    <span style="font-weight:500;white-space:nowrap;">${escHtml(t.name)}</span>
                    <span style="color:var(--gold);font-weight:600;font-size:0.7rem;white-space:nowrap;">${t.cost || 0}XP</span>
                    ${t.description ? `<span style="color:var(--text2);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">— ${escHtml(t.description)}</span>` : ''}
                </div>
                <div style="display:flex;gap:0.2rem;flex-shrink:0;">
                    <button class="btn btn-xs btn-ghost talent-edit-btn" data-id="${t.id}" title="Edit">✏️</button>
                    <button class="btn btn-xs btn-ghost talent-delete-btn" data-id="${t.id}" title="Delete" style="color:var(--red);">✕</button>
                </div>
            </div>
        `).join('');
    }
    
    // Wiki talents (with separator if both exist)
    if (remoteTalents.length > 0) {
        if (localTalents.length > 0) {
            html += `<div style="padding:0.2rem 0.4rem;color:var(--text3);font-size:0.7rem;border-bottom:1px solid var(--border);">📚 From Wiki</div>`;
        }
        
        html += remoteTalents.map(t => `
            <div class="talent-item wiki-talent" style="display:flex;justify-content:space-between;align-items:center;padding:0.2rem 0.4rem;border-bottom:1px solid var(--border);font-size:0.8rem;gap:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;flex:1;min-width:0;">
                    <span style="font-weight:500;color:var(--text2);white-space:nowrap;">${escHtml(t.title)}</span>
                    ${t.cost != null ? `<span style="color:var(--gold);font-weight:600;font-size:0.7rem;white-space:nowrap;">${t.cost}XP</span>` : ''}
                    ${t.body ? `<span style="color:var(--text3);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">— ${escHtml(t.body)}</span>` : ''}
                </div>
                <button class="btn btn-xs btn-ghost talent-clone-btn" data-id="${escHtml(String(t.id))}" title="Clone to local" style="color:var(--green);">📋</button>
            </div>
        `).join('');
    }
    
    container.innerHTML = html;
    
    // Attach events to talent buttons (using delegation on container)
    container.querySelectorAll('.talent-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTalentEditor(btn.dataset.id);
        });
    });
    
    container.querySelectorAll('.talent-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTalentHandler(btn.dataset.id);
        });
    });
    
    container.querySelectorAll('.talent-clone-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            cloneTalentFromWiki(btn.dataset.id);
        });
    });
}

// ============================================================
// CHARACTER OPERATIONS
// ============================================================

function openCharacterEditor(id) {
    import('./editor.js').then(module => {
        if (module.openEditor) {
            module.openEditor(id);
        } else {
            showToast('Editor module not available.', 'error');
        }
    }).catch(() => {
        showToast('Failed to load editor.', 'error');
    });
}

function deleteCharacterHandler(id) {
    const char = getCharacter(id);
    if (!char) return;
    if (!confirm(`Delete "${char.name || 'character'}"?`)) return;
    
    deleteCharacter(id);
    renderCharList();
    showToast(`"${char.name || 'Character'}" deleted.`, 'success');
}

function togglePushToVTT(id) {
    const char = getCharacter(id);
    if (!char) return;
    
    const newVtt = !char.vtt;
    const updated = updateCharacter(id, { vtt: newVtt });
    if (updated) {
        renderCharList();
        showToast(
            newVtt 
                ? `"${char.name || 'Character'}" pushed to VTT.` 
                : `"${char.name || 'Character'}" removed from VTT.`,
            'success'
        );
        // Refresh VTT if it's active
        const vttBtn = document.querySelector('.sidebar-nav button[data-tab="vtt"]');
        if (vttBtn) vttBtn.click();
    }
}

function rollForCharacter(id) {
    import('./roller.js').then(module => {
        if (module.rollForCharacter) {
            module.rollForCharacter(id);
        } else {
            showToast('Roller module not available.', 'error');
        }
    }).catch(() => {
        showToast('Failed to load roller.', 'error');
    });
}

// ============================================================
// TALENT OPERATIONS
// ============================================================

function openTalentEditor(id) {
    import('./talent-editor.js')
        .then(module => {
            if (module.openEditor) {
                module.openEditor(id);
            } else {
                createInlineTalentEditor(id);
            }
        })
        .catch(() => {
            createInlineTalentEditor(id);
        });
}

function createInlineTalentEditor(id) {
    const state = getState();
    const talents = state.talents || [];
    const talent = talents.find(t => String(t.id) === String(id));
    if (!talent) {
        showToast('Talent not found.', 'error');
        return;
    }
    
    // Create a simple inline edit row
    const container = document.getElementById('talent-list-container');
    if (!container) return;
    
    const row = container.querySelector(`[data-talent-id="${id}"]`) || 
                container.querySelector(`.talent-edit-btn[data-id="${id}"]`)?.closest('.talent-item');
    
    if (row) {
        // Replace row with edit form
        row.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:0.3rem;padding:0.2rem 0;width:100%;">
                <input type="text" id="talent-edit-name" value="${escHtml(talent.name)}" style="flex:2;min-width:100px;font-size:0.8rem;" placeholder="Name" />
                <input type="number" id="talent-edit-cost" value="${talent.cost || 0}" style="width:60px;font-size:0.8rem;" placeholder="XP" />
                <input type="text" id="talent-edit-desc" value="${escHtml(talent.description || '')}" style="flex:3;min-width:150px;font-size:0.8rem;" placeholder="Description" />
                <button class="btn btn-xs btn-gold talent-edit-save" data-id="${id}">💾</button>
                <button class="btn btn-xs talent-edit-cancel" data-id="${id}">✕</button>
            </div>
        `;
        
        // Focus name
        setTimeout(() => {
            const nameInput = document.getElementById('talent-edit-name');
            if (nameInput) nameInput.focus();
        }, 50);
        
        // Save handler
        const saveBtn = row.querySelector('.talent-edit-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const nameEl = document.getElementById('talent-edit-name');
                const costEl = document.getElementById('talent-edit-cost');
                const descEl = document.getElementById('talent-edit-desc');
                
                if (!nameEl || !nameEl.value.trim()) {
                    showToast('Talent name is required.', 'error');
                    return;
                }
                
                talent.name = nameEl.value.trim();
                talent.cost = parseInt(costEl?.value) || 0;
                talent.description = descEl?.value.trim() || '';
                
                state.talents = talents;
                saveState();
                renderTalentList();
                showToast('Talent updated.', 'success');
            });
        }
        
        // Cancel handler
        const cancelBtn = row.querySelector('.talent-edit-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                renderTalentList();
            });
        }
    }
}

function deleteTalentHandler(id) {
    const state = getState();
    const talents = state.talents || [];
    const talent = talents.find(t => String(t.id) === String(id));
    if (!talent) return;
    
    if (!confirm(`Delete talent "${talent.name}"?`)) return;
    
    state.talents = talents.filter(t => String(t.id) !== String(id));
    saveState();
    renderTalentList();
    showToast('Talent deleted.', 'success');
}

function cloneTalentFromWiki(remoteId) {
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    const remote = wikiEntries.find(w => 
        String(w.id) === String(remoteId) && 
        (w.category === 'talents' || w.category === 'talent')
    );
    
    if (!remote) {
        showToast('Wiki talent not found.', 'error');
        return;
    }
    
    if (!state.talents) state.talents = [];
    
    // Check if already cloned
    const existing = state.talents.find(t => 
        t.name === remote.title && t.source === 'wiki-clone'
    );
    if (existing) {
        showToast(`"${remote.title}" already cloned.`, 'warning');
        return;
    }
    
    const newTalent = {
        id: generateId('talent_'),
        name: remote.title,
        cost: remote.cost != null ? remote.cost : 0,
        description: remote.body || remote.description || '',
        source: 'wiki-clone',
        clonedFrom: remote.id,
        createdAt: new Date().toISOString()
    };
    
    state.talents.push(newTalent);
    saveState();
    renderTalentList();
    showToast(`Cloned "${remote.title}" from wiki.`, 'success');
}

function addCustomTalent() {
    const state = getState();
    if (!state.talents) state.talents = [];
    
    const newTalent = {
        id: generateId('talent_'),
        name: 'New Talent',
        cost: 0,
        description: '',
        source: 'custom',
        createdAt: new Date().toISOString()
    };
    
    state.talents.push(newTalent);
    saveState();
    renderTalentList();
    
    // Open editor for the new talent
    setTimeout(() => {
        openTalentEditor(newTalent.id);
    }, 100);
}

// ============================================================
// TALENT PANEL TOGGLE
// ============================================================

function toggleTalentPanel() {
    const container = document.getElementById('talent-list-container');
    const toggleBtn = document.getElementById('talent-toggle-btn');
    
    if (!container || !toggleBtn) return;
    
    talentPanelVisible = !talentPanelVisible;
    
    if (talentPanelVisible) {
        container.style.display = 'block';
        toggleBtn.textContent = '−';
        toggleBtn.title = 'Collapse talent list';
    } else {
        container.style.display = 'none';
        toggleBtn.textContent = '+';
        toggleBtn.title = 'Expand talent list';
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    // Use event delegation for persistent buttons
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // Wizard button
        if (target.id === 'wizardCharBtn' || target.closest('#wizardCharBtn')) {
            import('./wizard.js').then(module => {
                if (module.openWizard) module.openWizard();
                else showToast('Wizard module not available.', 'error');
            }).catch(() => showToast('Failed to load wizard.', 'error'));
            e.preventDefault();
        }
        
        // Talents button (scroll to panel)
        if (target.id === 'openTalentsBtn' || target.closest('#openTalentsBtn')) {
            const panel = document.getElementById('talent-panel');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Expand if collapsed
                if (!talentPanelVisible) {
                    toggleTalentPanel();
                }
            }
            e.preventDefault();
        }
        
        // Talent toggle
        if (target.id === 'talent-toggle-btn' || target.closest('#talent-toggle-btn')) {
            toggleTalentPanel();
            e.preventDefault();
        }
        
        // Add talent button
        if (target.id === 'talent-add-btn' || target.closest('#talent-add-btn')) {
            addCustomTalent();
            e.preventDefault();
        }
    });
    
    // Keyboard shortcut: Ctrl+Shift+T for talents
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'T') {
            e.preventDefault();
            const panel = document.getElementById('talent-panel');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (!talentPanelVisible) toggleTalentPanel();
            }
        }
    });
}

// ============================================================
// INITIALIZATION & DESTROY
// ============================================================

export function init(el) {
    return render(el);
}

export function destroy() {
    container = null;
}

// ============================================================
// EXPORTS
// ============================================================

export { renderCharList, renderTalentList };

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
    render,
    init,
    destroy,
    renderCharList,
    renderTalentList,
    attachEvents
};