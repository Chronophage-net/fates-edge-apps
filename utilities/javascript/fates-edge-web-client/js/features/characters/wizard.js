/**
 * Character Wizard - Step-by-step character creation
 * ✅ Modal auto-created if missing
 * ✅ Improved validation with inline feedback
 * ✅ Better UI with progress indicator
 * ✅ Robust event handling and cleanup
 * ✅ XSS protected with escHtml
 */

import { generateId, escHtml, safeParseInt, clamp } from '../../core/utils.js';
import { addCharacter } from '../../core/state.js';
import { ALL_SKILLS, defaultSkills } from '../../core/dice.js';
import { showToast } from '../../components/Toast.js';

// ============================================================
// STATE
// ============================================================

const wizardState = {
    step: 0,
    data: null,
    isOpen: false,
    initialized: false,
    escapeHandler: null,
    modal: null
};

// ============================================================
// MODAL CREATION (if missing)
// ============================================================

function ensureModal() {
    let modal = document.getElementById('wizardModal');
    if (modal) return modal;

    // Build modal from scratch
    modal = document.createElement('div');
    modal.id = 'wizardModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content" style="max-width:720px;max-height:90vh;overflow-y:auto;padding:1.5rem;">
            <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h3 id="wizard-title" style="margin:0;">Character Wizard</h3>
                <button id="wizardModalClose" class="btn btn-ghost" style="font-size:1.8rem;line-height:1;padding:0 0.3rem;">&times;</button>
            </div>

            <!-- Progress indicator -->
            <div id="wizard-progress" style="display:flex;gap:0.5rem;margin-bottom:1.2rem;justify-content:center;">
                ${[1,2,3,4,5].map(i => `
                    <div class="wizard-progress-step" data-step="${i-1}" style="flex:1;height:4px;background:var(--border);border-radius:2px;transition:background 0.3s;"></div>
                `).join('')}
            </div>

            <div id="wizard-steps" class="modal-body"></div>

            <div class="modal-footer" style="display:flex;justify-content:space-between;margin-top:1.2rem;padding-top:0.8rem;border-top:1px solid var(--border);">
                <button id="wizard-back" class="btn btn-secondary">← Back</button>
                <button id="wizard-next" class="btn btn-gold">Next →</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

// ============================================================
// INITIALIZATION
// ============================================================

function initWizard() {
    if (wizardState.initialized) return;

    // Event delegation for dynamic list items (add/remove)
    document.addEventListener('click', (e) => {
        const target = e.target;

        if (target.matches('[data-wizard-add]')) {
            const prefix = target.dataset.wizardAdd;
            addWizardDynamic(prefix);
            e.preventDefault();
        }

        if (target.matches('.wizard-remove-btn')) {
            const row = target.closest('.dynamic-row');
            if (row) row.remove();
            collectWizardStep();
            e.preventDefault();
        }

        // Checkbox change triggers XP recalculation in summary
        if (target.matches('.wz-bond-start, .wz-comp-start')) {
            if (wizardState.isOpen && wizardState.step === 4) {
                setTimeout(updateSummaryXP, 50);
            }
        }
    });

    // Also handle dynamic add via custom events for button clicks in non-delegated areas
    wizardState.initialized = true;
}

// ============================================================
// PUBLIC API
// ============================================================

export function openWizard() {
    initWizard();

    // Ensure modal exists
    const modal = ensureModal();
    wizardState.modal = modal;

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
        _stepDataCollected: {}
    };

    wizardState.data = data;
    wizardState.step = 0;
    wizardState.isOpen = true;

    // Show modal
    modal.classList.add('open');
    modal.style.display = 'flex';

    renderWizardStep();
    setupWizardEvents();
}

export function closeWizard() {
    if (wizardState.escapeHandler) {
        document.removeEventListener('keydown', wizardState.escapeHandler);
        wizardState.escapeHandler = null;
    }

    const modal = wizardState.modal || document.getElementById('wizardModal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
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

    if (!collectWizardStep()) return; // validation failed

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
            case 0: return collectBasicInfo(d);
            case 1: return collectAttributes(d);
            case 2: return collectSkills(d);
            case 3: return collectDynamicItems(d);
            default: return true;
        }
    } catch (error) {
        console.error('[Wizard] Collection error:', error);
        showToast('Error collecting data. Please try again.', 'error');
        return false;
    }
}

function collectBasicInfo(d) {
    const nameInput = document.querySelector('#wz-name');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
        showToast('Character name is required.', 'error');
        if (nameInput) {
            nameInput.style.borderColor = 'var(--red)';
            nameInput.focus();
            setTimeout(() => nameInput.style.borderColor = '', 3000);
        }
        return false;
    }

    d.name = name;
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
        if (name) items.push({ name, cost });
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

    if (!d.name || !d.name.trim()) {
        showToast('Character name is required.', 'error');
        wizardState.step = 0;
        renderWizardStep();
        return;
    }

    const bondBonus = (d.bonds || []).filter(b => b.start).length * 2;
    const compBonus = (d.complications || []).filter(c => c.start).length * 2;
    const totalBonus = Math.min(bondBonus + compBonus, 4);
    d.xp = 32 + totalBonus;

    const pushCheck = document.getElementById('wz-push-vtt');
    if (pushCheck) d.vtt = pushCheck.checked;

    try {
        addCharacter(d);
        showToast(`✨ Character "${d.name}" created successfully!`, 'success');
        closeWizard();

        // Refresh character list
        import('./index.js').then(module => {
            if (module.renderCharList) module.renderCharList();
        });

        if (d.vtt) {
            const vttBtn = document.querySelector('.sidebar-nav button[data-tab="vtt"]');
            if (vttBtn) setTimeout(() => vttBtn.click(), 300);
        }
    } catch (error) {
        console.error('[Wizard] Save error:', error);
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

    if (!stepsEl || !nextBtn || !backBtn) {
        console.warn('[Wizard] Required elements missing');
        return;
    }

    if (titleEl) {
        titleEl.textContent = `Character Wizard — Step ${wizardState.step + 1} of 5`;
    }

    backBtn.style.display = wizardState.step === 0 ? 'none' : 'inline-block';
    nextBtn.textContent = wizardState.step === 4 ? '✨ Finish' : 'Next →';

    // Update progress
    document.querySelectorAll('.wizard-progress-step').forEach((el, idx) => {
        el.style.background = idx <= wizardState.step ? 'var(--gold)' : 'var(--border)';
    });

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
        console.error('[Wizard] Render error:', error);
        html = '<p class="error">Error rendering step. Please refresh.</p>';
    }

    stepsEl.innerHTML = html;

    if (wizardState.step === 4) {
        setTimeout(updateSummaryXP, 50);
    }

    // Focus first input for better UX
    const firstInput = stepsEl.querySelector('input, select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
}

// ============================================================
// STEP RENDERERS (improved layout and styling)
// ============================================================

function renderStep0(d) {
    return `
        <div class="wizard-step active">
            <h3 style="margin-top:0;">🪪 Identity</h3>
            <p class="text-muted" style="font-size:0.9rem;margin-bottom:1rem;">Tell us who your character is.</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                <div class="field">
                    <label>Name <span style="color:var(--red);">*</span></label>
                    <input id="wz-name" value="${escHtml(d.name)}" placeholder="Enter character name..." autofocus />
                    <span class="field-hint" style="color:var(--text3);font-size:0.75rem;">Required</span>
                </div>
                <div class="field">
                    <label>Heritage</label>
                    <input id="wz-heritage" value="${escHtml(d.heritage)}" placeholder="e.g., Human, Elf, Dwarf" />
                </div>
                <div class="field">
                    <label>Background</label>
                    <input id="wz-background" value="${escHtml(d.background)}" placeholder="e.g., Soldier, Scholar" />
                </div>
                <div class="field">
                    <label>Patron</label>
                    <input id="wz-patron" value="${escHtml(d.patron)}" placeholder="God, mentor, or organization" />
                </div>
                <div class="field" style="grid-column:1/2;">
                    <label>Tier</label>
                    <input id="wz-tier" value="${escHtml(d.tier)}" placeholder="e.g., I, II, III" style="max-width:100px;" />
                    <span class="field-hint" style="color:var(--text3);font-size:0.75rem;">Optional tier indicator</span>
                </div>
            </div>
        </div>
    `;
}

function renderStep1(d) {
    return `
        <div class="wizard-step active">
            <h3 style="margin-top:0;">⚡ Attributes (1–5)</h3>
            <p class="text-muted" style="font-size:0.9rem;margin-bottom:1rem;">Distribute your core attributes. Higher is better.</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.8rem;">
                ${['Body','Wits','Spirit','Presence'].map((attr, i) => {
                    const id = ['body','wits','spirit','presence'][i];
                    const val = d[id] ?? 0;
                    return `
                        <div class="stat-item" style="background:var(--bg2);padding:0.5rem;border-radius:var(--radius);text-align:center;">
                            <label style="font-weight:600;">${attr}</label>
                            <input type="number" id="wz-${id}" value="${val}" min="1" max="5" style="width:100%;text-align:center;font-size:1.2rem;" />
                            <span class="field-hint" style="font-size:0.7rem;color:var(--text3);">1–5</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderStep2(d) {
    const skillsHtml = ALL_SKILLS.map(s => {
        const key = s.toLowerCase();
        const val = d.skills?.[key] ?? 0;
        return `
            <div style="display:flex;align-items:center;gap:0.3rem;background:var(--bg2);padding:0.2rem 0.4rem;border-radius:4px;">
                <label style="flex:1;font-size:0.85rem;">${escHtml(s)}</label>
                <input type="number" id="wz-sk-${key}" value="${val}" min="0" max="5" style="width:50px;text-align:center;" />
            </div>
        `;
    }).join('');

    return `
        <div class="wizard-step active">
            <h3 style="margin-top:0;">📚 Skills (0–5)</h3>
            <p class="text-muted" style="font-size:0.9rem;margin-bottom:1rem;">Set your character's skill ranks.</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.4rem;">
                ${skillsHtml}
            </div>
        </div>
    `;
}

function renderStep3(d) {
    const dynamicList = (prefix, label, rows, rowFn) => `
        <div style="margin-top:0.6rem;">
            <h4 style="margin:0.4rem 0 0.2rem;">${label}</h4>
            <div id="${prefix}-list">${rows}</div>
            <button class="btn btn-sm btn-secondary" data-wizard-add="${prefix}">+ Add ${label}</button>
        </div>
    `;

    const talentRows = (d.talents || []).map((t, i) => wizardDynamicRowHtml('wz-talent', i, t.name, t.cost)).join('');
    const assetRows = (d.assets || []).map((a, i) => wizardDynamicRowHtml('wz-asset', i, a.name, a.cost)).join('');
    const equipRows = (d.equipment || []).map((e, i) => wizardDynamicRowHtml('wz-equip', i, e.name, e.cost)).join('');
    const bondRows = (d.bonds || []).map((b, i) => wizardBondRowHtml(i, b)).join('');
    const compRows = (d.complications || []).map((c, i) => wizardCompRowHtml(i, c)).join('');

    return `
        <div class="wizard-step active">
            <h3 style="margin-top:0;">🧩 Details</h3>
            <p class="text-muted" style="font-size:0.9rem;margin-bottom:0.5rem;">Add talents, assets, equipment, bonds, and complications.</p>
            ${dynamicList('wz-talent', 'Talents', talentRows)}
            ${dynamicList('wz-asset', 'Assets', assetRows)}
            ${dynamicList('wz-equip', 'Equipment', equipRows)}
            ${dynamicList('wz-bond', 'Bonds', bondRows)}
            ${dynamicList('wz-comp', 'Complications', compRows)}
            <p class="text-muted" style="font-size:0.8rem;margin-top:0.5rem;">Bonds and complications marked with checkbox give +2 starting XP each (max +4 total).</p>
        </div>
    `;
}

function renderStep4(d) {
    const bondBonus = (d.bonds || []).filter(b => b.start).length * 2;
    const compBonus = (d.complications || []).filter(c => c.start).length * 2;
    const totalBonus = Math.min(bondBonus + compBonus, 4);
    const startXp = 32 + totalBonus;

    const totalTalents = (d.talents || []).length;
    const totalAssets = (d.assets || []).length;
    const totalEquip = (d.equipment || []).length;
    const totalBonds = (d.bonds || []).length;
    const totalComps = (d.complications || []).length;

    return `
        <div class="wizard-step active">
            <h3 style="margin-top:0;">📋 Summary</h3>
            <div style="background:var(--bg2);padding:1rem;border-radius:var(--radius);">
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
                    <div>
                        <h4 style="margin:0 0 0.2rem;">${escHtml(d.name || 'Unnamed')}</h4>
                        <p style="margin:0;font-size:0.9rem;color:var(--text2);">
                            ${escHtml(d.heritage || '')} ${d.background ? '· ' + escHtml(d.background) : ''}
                            ${d.patron ? '· ' + escHtml(d.patron) : ''}
                        </p>
                    </div>
                    <span style="background:var(--gold);color:var(--bg);padding:0.2rem 0.8rem;border-radius:20px;font-weight:600;align-self:start;">Tier ${escHtml(d.tier || 'I')}</span>
                </div>
                <hr style="border-color:var(--border);margin:0.6rem 0;" />
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem 1rem;">
                    <div><span class="text-muted">Attributes:</span> B${d.body} W${d.wits} S${d.spirit} P${d.presence}</div>
                    <div><span class="text-muted">Starting XP:</span> <strong id="wizard-summary-xp">${startXp}</strong> (32 + ${totalBonus} bonus)</div>
                    <div><span class="text-muted">Talents:</span> ${totalTalents}</div>
                    <div><span class="text-muted">Assets:</span> ${totalAssets}</div>
                    <div><span class="text-muted">Equipment:</span> ${totalEquip}</div>
                    <div><span class="text-muted">Bonds:</span> ${totalBonds}</div>
                    <div><span class="text-muted">Complications:</span> ${totalComps}</div>
                </div>
                <hr style="border-color:var(--border);margin:0.6rem 0;" />
                <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
                    <label><input type="checkbox" id="wz-push-vtt" ${d.vtt ? 'checked' : ''} /> Push to VTT</label>
                    <label><input type="checkbox" id="wz-add-to-campaign" checked /> Add to campaign</label>
                </div>
            </div>
            <p class="text-muted" style="font-size:0.85rem;margin-top:0.8rem;">Review the summary above, then click <strong>Finish</strong> to create your character.</p>
        </div>
    `;
}

function updateSummaryXP() {
    if (wizardState.step !== 4) return;
    const d = wizardState.data;
    if (!d) return;

    const bondBonus = (d.bonds || []).filter(b => b.start).length * 2;
    const compBonus = (d.complications || []).filter(c => c.start).length * 2;
    const totalBonus = Math.min(bondBonus + compBonus, 4);
    const startXp = 32 + totalBonus;

    const xpEl = document.getElementById('wizard-summary-xp');
    if (xpEl) xpEl.textContent = startXp;
}

// ============================================================
// ROW HTML BUILDERS
// ============================================================

function wizardDynamicRowHtml(prefix, idx, name = '', cost = 0) {
    return `
        <div class="dynamic-row ${prefix}-row" data-index="${idx}" style="display:flex;gap:0.3rem;margin:0.2rem 0;align-items:center;">
            <input type="text" class="${prefix}-name" placeholder="Name" value="${escHtml(name || '')}" style="flex:2;" />
            <input type="number" class="${prefix}-cost" placeholder="XP" value="${cost || 0}" min="0" style="width:60px;" />
            <button class="btn btn-xs wizard-remove-btn" style="padding:0 0.4rem;">✕</button>
        </div>
    `;
}

function wizardBondRowHtml(idx, item = {}) {
    return `
        <div class="dynamic-row wz-bond-row" data-index="${idx}" style="display:flex;gap:0.3rem;margin:0.2rem 0;align-items:center;flex-wrap:wrap;">
            <input type="text" class="wz-bond-name" placeholder="Bond name" value="${escHtml(item.name || '')}" style="flex:1;min-width:100px;" />
            <input type="text" class="wz-bond-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;min-width:120px;" />
            <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;">
                <input type="checkbox" class="wz-bond-start" ${item.start !== false ? 'checked' : ''} /> +2 XP
            </label>
            <button class="btn btn-xs wizard-remove-btn" style="padding:0 0.4rem;">✕</button>
        </div>
    `;
}

function wizardCompRowHtml(idx, item = {}) {
    return `
        <div class="dynamic-row wz-comp-row" data-index="${idx}" style="display:flex;gap:0.3rem;margin:0.2rem 0;align-items:center;flex-wrap:wrap;">
            <input type="text" class="wz-comp-name" placeholder="Complication name" value="${escHtml(item.name || '')}" style="flex:1;min-width:100px;" />
            <input type="text" class="wz-comp-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;min-width:120px;" />
            <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;">
                <input type="checkbox" class="wz-comp-start" ${item.start !== false ? 'checked' : ''} /> +2 XP
            </label>
            <button class="btn btn-xs wizard-remove-btn" style="padding:0 0.4rem;">✕</button>
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
    let html;
    if (prefix === 'wz-bond') {
        html = wizardBondRowHtml(idx);
    } else if (prefix === 'wz-comp') {
        html = wizardCompRowHtml(idx);
    } else {
        html = wizardDynamicRowHtml(prefix, idx);
    }

    const div = document.createElement('div');
    div.innerHTML = html;
    const row = div.firstElementChild;
    container.appendChild(row);

    const nameInput = row.querySelector('input[type="text"]');
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
    setTimeout(collectWizardStep, 10);
}

// ============================================================
// EVENT SETUP
// ============================================================

function setupWizardEvents() {
    const modal = wizardState.modal || document.getElementById('wizardModal');
    const backBtn = document.getElementById('wizard-back');
    const nextBtn = document.getElementById('wizard-next');
    const closeBtn = document.getElementById('wizardModalClose');

    if (backBtn) backBtn.addEventListener('click', wizardBack);
    if (nextBtn) nextBtn.addEventListener('click', wizardNext);
    if (closeBtn) closeBtn.addEventListener('click', closeWizard);

    // Close on overlay click
    if (modal) {
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeWizard);
        }
    }

    // Keyboard shortcuts
    if (wizardState.escapeHandler) {
        document.removeEventListener('keydown', wizardState.escapeHandler);
    }
    wizardState.escapeHandler = (e) => {
        if (!wizardState.isOpen) return;
        if (e.key === 'Escape') {
            closeWizard();
        } else if (e.key === 'Enter' && !e.target.matches('textarea')) {
            const nextBtn = document.getElementById('wizard-next');
            if (nextBtn) {
                e.preventDefault();
                nextBtn.click();
            }
        }
    };
    document.addEventListener('keydown', wizardState.escapeHandler);
}

// ============================================================
// INITIALIZE ON LOAD
// ============================================================

function init() {
    initWizard();
    // Ensure modal is created early (optional)
    ensureModal();
    setupWizardEvents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================================
// EXPOSE GLOBALS (for inline handlers if needed)
// ============================================================

Object.assign(window, {
    addWizardDynamic,
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
    addWizardDynamic
};