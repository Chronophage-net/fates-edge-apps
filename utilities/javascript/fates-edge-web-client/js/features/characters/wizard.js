/**
 * Character Wizard - Step-by-step character creation
 * FIXED: Proper step management, data persistence, and validation
 */

import { getState, addCharacter, generateId } from '../../core/state.js';
import { ALL_SKILLS, defaultSkills } from '../../core/dice.js';
import { escHtml, safeParseInt, clamp } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

// ============================================================
// STATE
// ============================================================

const wizardState = {
    step: 0,
    data: null,
    isOpen: false,
    initialized: false
};

// ============================================================
// INITIALIZATION
// ============================================================

function initWizard() {
    if (wizardState.initialized) return;
    
    // Use event delegation for dynamic content
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // Handle add buttons
        if (target.matches('[data-wizard-add]')) {
            const prefix = target.dataset.wizardAdd;
            addWizardDynamic(prefix);
            e.preventDefault();
        }
        
        // Handle remove buttons (delegated)
        if (target.matches('.wizard-remove-btn')) {
            const row = target.closest('.dynamic-row');
            if (row) {
                row.remove();
                // Trigger save of current step data
                collectWizardStep();
            }
            e.preventDefault();
        }
    });
    
    wizardState.initialized = true;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Open the character wizard
 */
export function openWizard() {
    initWizard();
    
    // Reset state
    const data = {
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
        vtt: true,
        // Track which step has data to prevent data loss
        _stepDataCollected: {}
    };
    
    wizardState.data = data;
    wizardState.step = 0;
    wizardState.isOpen = true;
    
    const modal = document.getElementById('wizardModal');
    if (modal) {
        modal.classList.add('open');
        renderWizardStep();
    } else {
        showToast('Wizard modal not found. Please refresh.', 'error');
    }
}

/**
 * Close the wizard
 */
export function closeWizard() {
    const modal = document.getElementById('wizardModal');
    if (modal) {
        modal.classList.remove('open');
    }
    wizardState.isOpen = false;
    wizardState.data = null;
    wizardState.step = 0;
}

// ============================================================
// NAVIGATION
// ============================================================

export function wizardBack() {
    if (wizardState.step > 0 && wizardState.data) {
        // Save current step before going back
        collectWizardStep();
        wizardState.step--;
        renderWizardStep();
    }
}

export function wizardNext() {
    if (!wizardState.data) {
        showToast('Wizard not initialized.', 'error');
        return;
    }
    
    // Collect and validate current step
    if (!collectWizardStep()) {
        return; // Validation failed
    }
    
    if (wizardState.step < 4) {
        wizardState.step++;
        renderWizardStep();
    } else {
        finishWizard();
    }
}

// ============================================================
// STEP COLLECTION & VALIDATION
// ============================================================

function collectWizardStep() {
    const d = wizardState.data;
    if (!d) return false;
    
    const step = wizardState.step;
    
    try {
        switch (step) {
            case 0:
                return collectBasicInfo(d);
            case 1:
                return collectAttributes(d);
            case 2:
                return collectSkills(d);
            case 3:
                return collectDynamicItems(d);
            default:
                return true;
        }
    } catch (error) {
        console.error('[Wizard] Error collecting step data:', error);
        showToast('Error collecting data. Please try again.', 'error');
        return false;
    }
}

function collectBasicInfo(d) {
    const name = getValue('#wz-name');
    if (!name || !name.trim()) {
        showToast('Character name is required.', 'error');
        // Highlight the field
        const nameInput = document.querySelector('#wz-name');
        if (nameInput) {
            nameInput.style.borderColor = 'var(--red)';
            nameInput.focus();
            setTimeout(() => {
                nameInput.style.borderColor = '';
            }, 3000);
        }
        return false;
    }
    
    d.name = name.trim();
    d.heritage = getValue('#wz-heritage');
    d.background = getValue('#wz-background');
    d.patron = getValue('#wz-patron');
    d.tier = getValue('#wz-tier') || 'I';
    
    d._stepDataCollected[0] = true;
    return true;
}

function collectAttributes(d) {
    d.body = clamp(getNumber('#wz-body'), 1, 5);
    d.wits = clamp(getNumber('#wz-wits'), 1, 5);
    d.spirit = clamp(getNumber('#wz-spirit'), 1, 5);
    d.presence = clamp(getNumber('#wz-presence'), 1, 5);
    d._stepDataCollected[1] = true;
    return true;
}

function collectSkills(d) {
    if (!d.skills) d.skills = defaultSkills();
    ALL_SKILLS.forEach(s => {
        const key = s.toLowerCase();
        const val = getNumber(`#wz-sk-${key}`);
        d.skills[key] = clamp(val, 0, 5);
    });
    d._stepDataCollected[2] = true;
    return true;
}

function collectDynamicItems(d) {
    // Read from DOM with proper error handling
    d.talents = readWizardDynamicList('wz-talent');
    d.assets = readWizardDynamicList('wz-asset');
    d.equipment = readWizardDynamicList('wz-equip');
    d.bonds = readWizardBondList();
    d.complications = readWizardCompList();
    d._stepDataCollected[3] = true;
    return true;
}

// ============================================================
// DOM HELPERS
// ============================================================

function getValue(selector) {
    const el = document.querySelector(selector);
    return el ? el.value : '';
}

function getNumber(selector) {
    const el = document.querySelector(selector);
    return el ? safeParseInt(el.value, 0) : 0;
}

// ============================================================
// DATA READERS
// ============================================================

function readWizardDynamicList(prefix) {
    const items = [];
    const rows = document.querySelectorAll(`.${prefix}-row`);
    
    for (const row of rows) {
        const nameInput = row.querySelector(`.${prefix}-name`) || row.querySelector('input[type="text"]');
        const costInput = row.querySelector(`.${prefix}-cost`) || row.querySelector('input[type="number"]');
        
        const name = nameInput ? nameInput.value.trim() : '';
        const cost = costInput ? safeParseInt(costInput.value, 0) : 0;
        
        if (name) {
            items.push({ name, cost });
        }
    }
    
    return items;
}

function readWizardBondList() {
    const items = [];
    const rows = document.querySelectorAll('.wz-bond-row');
    
    for (const row of rows) {
        const nameInput = row.querySelector('.wz-bond-name');
        const descInput = row.querySelector('.wz-bond-desc');
        const startCheck = row.querySelector('.wz-bond-start');
        
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) continue;
        
        items.push({
            name,
            desc: descInput ? descInput.value.trim() : '',
            start: startCheck ? startCheck.checked : false
        });
    }
    
    return items;
}

function readWizardCompList() {
    const items = [];
    const rows = document.querySelectorAll('.wz-comp-row');
    
    for (const row of rows) {
        const nameInput = row.querySelector('.wz-comp-name');
        const descInput = row.querySelector('.wz-comp-desc');
        const startCheck = row.querySelector('.wz-comp-start');
        
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) continue;
        
        items.push({
            name,
            desc: descInput ? descInput.value.trim() : '',
            start: startCheck ? startCheck.checked : false
        });
    }
    
    return items;
}

// ============================================================
// FINISH WIZARD
// ============================================================

function finishWizard() {
    const d = wizardState.data;
    if (!d) {
        showToast('No character data to save.', 'error');
        return;
    }
    
    // Final validation
    if (!d.name || !d.name.trim()) {
        showToast('Character name is required.', 'error');
        wizardState.step = 0;
        renderWizardStep();
        return;
    }
    
    // Calculate starting XP with bonds and complications
    const bondBonus = (d.bonds || []).filter(b => b.start).length * 2;
    const compBonus = (d.complications || []).filter(c => c.start).length * 2;
    const startBonus = Math.min(bondBonus + compBonus, 4); // Max 4 bonus XP
    d.xp = 32 + startBonus;
    
    // Determine if we should push to VTT
    const pushCheck = document.getElementById('wz-push-vtt');
    if (pushCheck) {
        d.vtt = pushCheck.checked;
    }
    
    // Save the character
    try {
        addCharacter(d);
        showToast(`✨ Character "${d.name}" created successfully!`, 'success');
        
        // Close wizard
        closeWizard();
        
        // Refresh character list
        import('./index.js').then(module => {
            if (module.renderCharList) {
                module.renderCharList();
            }
        });
        
        // Navigate to VTT if requested
        if (d.vtt) {
            const vttBtn = document.querySelector('.sidebar-nav button[data-tab="vtt"]');
            if (vttBtn) {
                setTimeout(() => vttBtn.click(), 300);
            }
        }
    } catch (error) {
        console.error('[Wizard] Error saving character:', error);
        showToast('Error saving character. Please try again.', 'error');
    }
}

// ============================================================
// RENDER
// ============================================================

function renderWizardStep() {
    const d = wizardState.data;
    if (!d) return;
    
    const stepsEl = document.getElementById('wizard-steps');
    const nextBtn = document.getElementById('wizard-next');
    const backBtn = document.getElementById('wizard-back');
    const titleEl = document.getElementById('wizard-title');
    const modal = document.getElementById('wizardModal');
    
    if (!stepsEl || !nextBtn || !backBtn) {
        console.warn('[Wizard] Required elements not found');
        return;
    }
    
    // Update UI
    if (titleEl) {
        titleEl.textContent = `Character Wizard — Step ${wizardState.step + 1} of 5`;
    }
    
    backBtn.style.display = wizardState.step === 0 ? 'none' : 'inline-block';
    nextBtn.textContent = wizardState.step === 4 ? '✨ Finish' : 'Next →';
    
    // Build step HTML
    let html = '';
    try {
        switch (wizardState.step) {
            case 0: html = renderStep0(d); break;
            case 1: html = renderStep1(d); break;
            case 2: html = renderStep2(d); break;
            case 3: html = renderStep3(d); break;
            case 4: html = renderStep4(d); break;
            default: html = '<p>Unknown step</p>';
        }
    } catch (error) {
        console.error('[Wizard] Error rendering step:', error);
        html = '<p class="error">Error rendering step. Please refresh.</p>';
    }
    
    stepsEl.innerHTML = html;
    
    // Recalculate XP in step 4
    if (wizardState.step === 4) {
        updateSummaryXP();
    }
}

// ============================================================
// STEP RENDERERS
// ============================================================

function renderStep0(d) {
    return `
        <div class="wizard-step active">
            <h3>Who are you?</h3>
            <p class="text-muted" style="font-size:0.85rem;margin-bottom:0.8rem;">Tell us about your character's identity.</p>
            <div class="form-row">
                <div class="field"><label>Name *</label>
                    <input id="wz-name" value="${escHtml(d.name)}" placeholder="Enter character name..." />
                    <span class="field-hint">This is required.</span>
                </div>
                <div class="field"><label>Heritage</label>
                    <input id="wz-heritage" value="${escHtml(d.heritage)}" placeholder="e.g., Human, Elf, Dwarf" />
                </div>
            </div>
            <div class="form-row">
                <div class="field"><label>Background</label>
                    <input id="wz-background" value="${escHtml(d.background)}" placeholder="e.g., Soldier, Scholar, Outlaw" />
                </div>
                <div class="field"><label>Patron</label>
                    <input id="wz-patron" value="${escHtml(d.patron)}" placeholder="e.g., A god, a mentor, or an organization" />
                </div>
            </div>
            <div class="form-row">
                <div class="field small"><label>Tier</label>
                    <input id="wz-tier" value="${escHtml(d.tier)}" placeholder="e.g., I, II, III" />
                    <span class="field-hint">Optional tier indicator (I, II, III, etc.)</span>
                </div>
            </div>
        </div>
    `;
}

function renderStep1(d) {
    return `
        <div class="wizard-step active">
            <h3>Attributes (1–5)</h3>
            <p class="text-muted" style="font-size:0.85rem;margin-bottom:0.8rem;">Distribute your character's core attributes.</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                <div class="stat-item">
                    <label>Body</label>
                    <input type="number" id="wz-body" value="${d.body}" min="1" max="5" />
                    <span class="field-hint">Physical prowess</span>
                </div>
                <div class="stat-item">
                    <label>Wits</label>
                    <input type="number" id="wz-wits" value="${d.wits}" min="1" max="5" />
                    <span class="field-hint">Mental acuity</span>
                </div>
                <div class="stat-item">
                    <label>Spirit</label>
                    <input type="number" id="wz-spirit" value="${d.spirit}" min="1" max="5" />
                    <span class="field-hint">Willpower and intuition</span>
                </div>
                <div class="stat-item">
                    <label>Presence</label>
                    <input type="number" id="wz-presence" value="${d.presence}" min="1" max="5" />
                    <span class="field-hint">Charisma and social influence</span>
                </div>
            </div>
        </div>
    `;
}

function renderStep2(d) {
    const skillsHtml = ALL_SKILLS.map(s => {
        const key = s.toLowerCase();
        const val = d.skills?.[key] ?? 0;
        return `
            <div class="skill-item">
                <label>${s}</label>
                <input type="number" id="wz-sk-${key}" value="${val}" min="0" max="5" />
            </div>
        `;
    }).join('');
    
    return `
        <div class="wizard-step active">
            <h3>Skills (0–5)</h3>
            <p class="text-muted" style="font-size:0.85rem;margin-bottom:0.8rem;">Set your character's skill ranks.</p>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.4rem;font-size:0.85rem;">
                ${skillsHtml}
            </div>
        </div>
    `;
}

function renderStep3(d) {
    const talentRows = (d.talents || []).map((t, i) => 
        wizardDynamicRowHtml('wz-talent', i, t.name, t.cost)
    ).join('');
    
    const assetRows = (d.assets || []).map((a, i) => 
        wizardDynamicRowHtml('wz-asset', i, a.name, a.cost)
    ).join('');
    
    const equipRows = (d.equipment || []).map((e, i) => 
        wizardDynamicRowHtml('wz-equip', i, e.name, e.cost)
    ).join('');
    
    const bondRows = (d.bonds || []).map((b, i) => 
        wizardBondRowHtml(i, b)
    ).join('');
    
    const compRows = (d.complications || []).map((c, i) => 
        wizardCompRowHtml(i, c)
    ).join('');
    
    return `
        <div class="wizard-step active">
            <h3>Talents, Assets, Equipment, Bonds &amp; Complications</h3>
            <p class="text-muted" style="font-size:0.85rem;margin-bottom:0.8rem;">Add the details that make your character unique.</p>
            
            <h4>Talents</h4>
            <div id="wz-talent-list">${talentRows}</div>
            <button class="btn btn-sm" data-wizard-add="wz-talent">+ Add Talent</button>
            
            <h4 class="mt-1">Assets</h4>
            <div id="wz-asset-list">${assetRows}</div>
            <button class="btn btn-sm" data-wizard-add="wz-asset">+ Add Asset</button>
            
            <h4 class="mt-1">Equipment</h4>
            <div id="wz-equip-list">${equipRows}</div>
            <button class="btn btn-sm" data-wizard-add="wz-equip">+ Add Equipment</button>
            
            <h4 class="mt-1">Bonds <span class="text-muted" style="font-size:0.75rem;">(+2 start XP each, max +4)</span></h4>
            <div id="wz-bond-list">${bondRows}</div>
            <button class="btn btn-sm" data-wizard-add="wz-bond">+ Add Bond</button>
            
            <h4 class="mt-1">Complications <span class="text-muted" style="font-size:0.75rem;">(+2 start XP each, max +4)</span></h4>
            <div id="wz-comp-list">${compRows}</div>
            <button class="btn btn-sm" data-wizard-add="wz-comp">+ Add Complication</button>
        </div>
    `;
}

function renderStep4(d) {
    const bondBonus = (d.bonds || []).filter(b => b.start).length * 2;
    const compBonus = (d.complications || []).filter(c => c.start).length * 2;
    const totalBonus = Math.min(bondBonus + compBonus, 4);
    const startXp = 32 + totalBonus;
    
    return `
        <div class="wizard-step active">
            <h3>Summary</h3>
            <div style="background:var(--bg3);padding:1.2rem;border-radius:var(--radius);">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;">
                    <div>
                        <h4 style="margin:0 0 0.2rem 0;">${escHtml(d.name || 'Unnamed')}</h4>
                        <p class="text-muted" style="margin:0;">
                            ${escHtml(d.heritage || '')} ${d.background ? '· ' + escHtml(d.background) : ''}
                            ${d.patron ? '· ' + escHtml(d.patron) : ''}
                        </p>
                    </div>
                    <span style="background:var(--gold);color:var(--bg);padding:0.2rem 0.8rem;border-radius:20px;font-weight:600;">
                        Tier ${escHtml(d.tier || 'I')}
                    </span>
                </div>
                
                <hr style="border-color:var(--border);margin:0.6rem 0;" />
                
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div><span class="text-muted">Attributes:</span> B${d.body} W${d.wits} S${d.spirit} P${d.presence}</div>
                    <div><span class="text-muted">Starting XP:</span> <strong>${startXp}</strong> (32 + ${totalBonus} bonus)</div>
                </div>
                
                <div style="margin-top:0.5rem;">
                    <div><span class="text-muted">Talents:</span> ${(d.talents || []).map(t => t.name).join(', ') || '—'}</div>
                    <div><span class="text-muted">Assets:</span> ${(d.assets || []).map(a => a.name).join(', ') || '—'}</div>
                    <div><span class="text-muted">Equipment:</span> ${(d.equipment || []).map(e => e.name).join(', ') || '—'}</div>
                    <div><span class="text-muted">Bonds:</span> ${(d.bonds || []).map(b => b.name).join(', ') || '—'}</div>
                    <div><span class="text-muted">Complications:</span> ${(d.complications || []).map(c => c.name).join(', ') || '—'}</div>
                </div>
                
                <hr style="border-color:var(--border);margin:0.6rem 0;" />
                
                <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
                    <label class="inline-check">
                        <input type="checkbox" id="wz-push-vtt" ${d.vtt ? 'checked' : ''} /> 
                        Push to VTT
                    </label>
                    <label class="inline-check">
                        <input type="checkbox" id="wz-add-to-campaign" checked /> 
                        Add to campaign
                    </label>
                </div>
            </div>
            
            <p class="text-muted" style="font-size:0.8rem;margin-top:0.8rem;">
                💡 Review the summary above. Click "Finish" to create your character.
            </p>
        </div>
    `;
}

function updateSummaryXP() {
    // Recalculate and display XP in step 4
    const d = wizardState.data;
    if (!d || wizardState.step !== 4) return;
    
    const bondBonus = (d.bonds || []).filter(b => b.start).length * 2;
    const compBonus = (d.complications || []).filter(c => c.start).length * 2;
    const totalBonus = Math.min(bondBonus + compBonus, 4);
    const startXp = 32 + totalBonus;
    
    // Update the XP display
    const xpDisplay = document.querySelector('#wizard-steps .summary-xp-display');
    if (xpDisplay) {
        xpDisplay.textContent = startXp;
    }
}

// ============================================================
// ROW HTML BUILDERS
// ============================================================

function wizardDynamicRowHtml(prefix, idx, name = '', cost = 0) {
    return `
        <div class="dynamic-row ${prefix}-row" data-index="${idx}">
            <input type="text" class="${prefix}-name" placeholder="Name" value="${escHtml(name || '')}" />
            <input type="number" class="${prefix}-cost" placeholder="XP cost" value="${cost || 0}" min="0" style="width:70px;" />
            <button class="btn btn-xs wizard-remove-btn">✕</button>
        </div>
    `;
}

function wizardBondRowHtml(idx, item = {}) {
    return `
        <div class="dynamic-row wz-bond-row" data-index="${idx}">
            <input type="text" class="wz-bond-name" placeholder="Bond name" value="${escHtml(item.name || '')}" />
            <input type="text" class="wz-bond-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;" />
            <label class="inline-check">
                <input type="checkbox" class="wz-bond-start" ${item.start !== false ? 'checked' : ''} /> 
                +2 XP
            </label>
            <button class="btn btn-xs wizard-remove-btn">✕</button>
        </div>
    `;
}

function wizardCompRowHtml(idx, item = {}) {
    return `
        <div class="dynamic-row wz-comp-row" data-index="${idx}">
            <input type="text" class="wz-comp-name" placeholder="Complication name" value="${escHtml(item.name || '')}" />
            <input type="text" class="wz-comp-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;" />
            <label class="inline-check">
                <input type="checkbox" class="wz-comp-start" ${item.start !== false ? 'checked' : ''} /> 
                +2 XP
            </label>
            <button class="btn btn-xs wizard-remove-btn">✕</button>
        </div>
    `;
}

// ============================================================
// DYNAMIC ROW ADDERS
// ============================================================

export function addWizardDynamic(prefix) {
    const container = document.getElementById(prefix + '-list');
    if (!container) {
        console.warn(`[Wizard] Container not found: ${prefix}-list`);
        return;
    }
    
    const idx = container.children.length;
    const div = document.createElement('div');
    div.innerHTML = wizardDynamicRowHtml(prefix, idx);
    const row = div.firstElementChild;
    container.appendChild(row);
    
    // Focus the name input
    const nameInput = row.querySelector('input[type="text"]');
    if (nameInput) {
        setTimeout(() => nameInput.focus(), 50);
    }
    
    // Auto-collect data after adding
    setTimeout(() => collectWizardStep(), 10);
}

export function addWizardBond() {
    const container = document.getElementById('wz-bond-list');
    if (!container) {
        console.warn('[Wizard] Bond list container not found');
        return;
    }
    
    const idx = container.children.length;
    const div = document.createElement('div');
    div.innerHTML = wizardBondRowHtml(idx);
    const row = div.firstElementChild;
    container.appendChild(row);
    
    // Focus the name input
    const nameInput = row.querySelector('.wz-bond-name');
    if (nameInput) {
        setTimeout(() => nameInput.focus(), 50);
    }
    
    setTimeout(() => collectWizardStep(), 10);
}

export function addWizardComp() {
    const container = document.getElementById('wz-comp-list');
    if (!container) {
        console.warn('[Wizard] Complication list container not found');
        return;
    }
    
    const idx = container.children.length;
    const div = document.createElement('div');
    div.innerHTML = wizardCompRowHtml(idx);
    const row = div.firstElementChild;
    container.appendChild(row);
    
    // Focus the name input
    const nameInput = row.querySelector('.wz-comp-name');
    if (nameInput) {
        setTimeout(() => nameInput.focus(), 50);
    }
    
    setTimeout(() => collectWizardStep(), 10);
}

// ============================================================
// SETUP EVENT LISTENERS
// ============================================================

function setupWizardEvents() {
    const modal = document.getElementById('wizardModal');
    const backBtn = document.getElementById('wizard-back');
    const nextBtn = document.getElementById('wizard-next');
    const closeBtn = document.getElementById('wizardModalClose');
    
    if (backBtn) {
        backBtn.addEventListener('click', wizardBack);
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', wizardNext);
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeWizard);
    }
    
    // Close on overlay click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeWizard();
            }
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (!wizardState.isOpen) return;
        
        if (e.key === 'Escape') {
            closeWizard();
        } else if (e.key === 'Enter' && !e.target.matches('textarea')) {
            // Don't trigger on textareas, but do on input fields
            const nextBtn = document.getElementById('wizard-next');
            if (nextBtn) {
                e.preventDefault();
                nextBtn.click();
            }
        }
    });
}

// ============================================================
// INITIALIZE ON LOAD
// ============================================================

// Use DOMContentLoaded for setup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initWizard();
        setupWizardEvents();
    });
} else {
    initWizard();
    setupWizardEvents();
}

// ============================================================
// EXPOSE GLOBALS (for inline handlers)
// ============================================================

// Export functions to window for inline onclick handlers
// Use Object.assign to avoid overwriting existing properties
Object.assign(window, {
    addWizardDynamic,
    addWizardBond,
    addWizardComp,
    wizardBack,
    wizardNext,
    closeWizard
});

// ============================================================
// EXPORTS
// ============================================================

export default {
    openWizard,
    closeWizard,
    wizardBack,
    wizardNext,
    addWizardDynamic,
    addWizardBond,
    addWizardComp
};