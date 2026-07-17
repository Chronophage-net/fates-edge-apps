/**
 * Character Wizard – Step-by-step character creation
 * ✅ Auto-creates modal with inline CSS
 * ✅ No duplicate event listeners
 * ✅ Robust error handling
 * ✅ Handles defaultSkills as function or object
 * ✅ No top-level await (compatible with Vite build)
 */

import { generateId, escHtml, safeParseInt, clamp } from '../../core/utils.js';
import { addCharacter } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';

// ─── Import from dice.js with fallback ──────────────────────────────

// Static import – will fail if the module doesn't export these, but we provide fallback
import { ALL_SKILLS as importedAllSkills, defaultSkills as importedDefaultSkills } from '../../core/dice.js';

// Normalize ALL_SKILLS
const ALL_SKILLS = Array.isArray(importedAllSkills) ? importedAllSkills : [
    'Acrobatics', 'Arcana', 'Athletics', 'Deception', 'History',
    'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature',
    'Perception', 'Performance', 'Persuasion', 'Religion', 'Stealth',
    'Survival'
];

// Normalize defaultSkills
let defaultSkills;
if (typeof importedDefaultSkills === 'function') {
    defaultSkills = importedDefaultSkills;
} else {
    // If it's an object or undefined, wrap it to return a clone
    const skillsObj = importedDefaultSkills || {};
    defaultSkills = () => ({ ...skillsObj });
}

// If for some reason defaultSkills is still not set, provide a fallback
if (!defaultSkills) {
    defaultSkills = () => {
        const skills = {};
        ALL_SKILLS.forEach(s => skills[s.toLowerCase()] = 0);
        return skills;
    };
}

// ─── State ──────────────────────────────────────────────────────────────

const state = {
    step: 0,
    data: null,
    isOpen: false,
    modal: null,
    _listeners: [], // for cleanup
};

// ─── Modal CSS (fallback) ─────────────────────────────────────────────

function injectModalStyles() {
    if (document.getElementById('wizard-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'wizard-modal-styles';
    style.textContent = `
        /* Modal container */
        #wizardModal {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 10000;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            animation: wizardFadeIn 0.25s ease;
        }
        #wizardModal.open {
            display: flex;
        }
        @keyframes wizardFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .wizard-overlay {
            position: absolute;
            inset: 0;
            cursor: pointer;
        }
        .wizard-content {
            position: relative;
            background: var(--bg, #1e1e2e);
            color: var(--text, #e0e0e0);
            border-radius: 12px;
            max-width: 720px;
            width: 92%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 1.5rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.7);
            border: 1px solid var(--border, #333);
        }
        .wizard-progress-step {
            flex: 1;
            height: 4px;
            background: var(--border, #444);
            border-radius: 2px;
            transition: background 0.3s;
        }
        .wizard-progress-step.active {
            background: var(--gold, #c9a84c);
        }
        .dynamic-row {
            display: flex;
            gap: 0.3rem;
            margin: 0.2rem 0;
            align-items: center;
            flex-wrap: wrap;
        }
        .dynamic-row input[type="text"] { flex: 1; min-width: 100px; }
        .dynamic-row input[type="number"] { width: 60px; }
        .wizard-remove-btn {
            padding: 0 0.4rem;
            background: transparent;
            border: none;
            color: var(--text2, #aaa);
            cursor: pointer;
            font-size: 1.2rem;
        }
        .wizard-remove-btn:hover { color: var(--red, #e74c3c); }
        .stat-item {
            background: var(--bg2, #2a2a2a);
            padding: 0.5rem;
            border-radius: 8px;
            text-align: center;
        }
        .field-hint { color: var(--text3, #888); font-size: 0.75rem; }
        .text-muted { color: var(--text2, #aaa); }
        .btn-sm { font-size: 0.8rem; padding: 0.2rem 0.6rem; }
        .btn-xs { font-size: 0.7rem; padding: 0.1rem 0.3rem; }
    `;
    document.head.appendChild(style);
}

// ─── Modal Creation ────────────────────────────────────────────────────

function ensureModal() {
    let modal = document.getElementById('wizardModal');
    if (modal) return modal;

    injectModalStyles();

    modal = document.createElement('div');
    modal.id = 'wizardModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="wizard-overlay"></div>
        <div class="wizard-content">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h3 id="wizard-title" style="margin:0;">Character Wizard</h3>
                <button id="wizardModalClose" style="font-size:1.8rem;line-height:1;padding:0 0.3rem;background:none;border:none;color:var(--text2);cursor:pointer;">&times;</button>
            </div>
            <div id="wizard-progress" style="display:flex;gap:0.5rem;margin-bottom:1.2rem;justify-content:center;">
                ${[1,2,3,4,5].map(() => `<div class="wizard-progress-step"></div>`).join('')}
            </div>
            <div id="wizard-steps"></div>
            <div style="display:flex;justify-content:space-between;margin-top:1.2rem;padding-top:0.8rem;border-top:1px solid var(--border, #444);">
                <button id="wizard-back" class="btn btn-secondary">← Back</button>
                <button id="wizard-next" class="btn btn-gold">Next →</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

// ─── Event Helpers ─────────────────────────────────────────────────────

function clearListeners() {
    state._listeners.forEach(({ el, event, fn }) => el.removeEventListener(event, fn));
    state._listeners = [];
}

function addListener(el, event, fn) {
    el.addEventListener(event, fn);
    state._listeners.push({ el, event, fn });
}

// ─── Public API ─────────────────────────────────────────────────────────

export function openWizard() {
    console.log('[Wizard] openWizard called');
    try {
        const modal = ensureModal();
        state.modal = modal;

        // Reset data
        state.data = {
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
            _stepDataCollected: {},
        };
        state.step = 0;
        state.isOpen = true;

        // Show modal
        modal.classList.add('open');
        modal.style.display = 'flex';

        renderStep();
        attachEvents();
        console.log('[Wizard] Wizard opened successfully');
    } catch (err) {
        console.error('[Wizard] openWizard error:', err);
        showToast('Could not open the character wizard: ' + (err.message || err), 'error');
    }
}

export function closeWizard() {
    state.isOpen = false;
    clearListeners();
    const modal = state.modal || document.getElementById('wizardModal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
    }
    state.data = null;
    state.step = 0;
}

export function wizardBack() {
    if (state.step > 0 && state.data) {
        collectStepData();
        state.step--;
        renderStep();
    }
}

export function wizardNext() {
    if (!state.data) {
        showToast('Wizard not initialized.', 'error');
        return;
    }
    if (!collectStepData()) return; // validation failed
    if (state.step < 4) {
        state.step++;
        renderStep();
    } else {
        finishWizard();
    }
}

// ─── Data Collection ────────────────────────────────────────────────────

function collectStepData() {
    const d = state.data;
    if (!d) return false;
    const step = state.step;

    try {
        switch (step) {
            case 0: return collectBasicInfo(d);
            case 1: return collectAttributes(d);
            case 2: return collectSkills(d);
            case 3: return collectDynamicItems(d);
            default: return true;
        }
    } catch (err) {
        console.error('[Wizard] collect error:', err);
        showToast('Error collecting data. Try again.', 'error');
        return false;
    }
}

function collectBasicInfo(d) {
    const nameInput = document.querySelector('#wz-name');
    const name = nameInput?.value.trim() || '';
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
    d.heritage = getVal('#wz-heritage');
    d.background = getVal('#wz-background');
    d.patron = getVal('#wz-patron');
    d.tier = getVal('#wz-tier') || 'I';
    d._stepDataCollected[0] = true;
    return true;
}

function collectAttributes(d) {
    d.body = clamp(getNum('#wz-body'), 1, 5);
    d.wits = clamp(getNum('#wz-wits'), 1, 5);
    d.spirit = clamp(getNum('#wz-spirit'), 1, 5);
    d.presence = clamp(getNum('#wz-presence'), 1, 5);
    d._stepDataCollected[1] = true;
    return true;
}

function collectSkills(d) {
    if (!d.skills) d.skills = defaultSkills();
    ALL_SKILLS.forEach(s => {
        const key = s.toLowerCase();
        const val = getNum(`#wz-sk-${key}`);
        d.skills[key] = clamp(val, 0, 5);
    });
    d._stepDataCollected[2] = true;
    return true;
}

function collectDynamicItems(d) {
    d.talents = readDynamicList('wz-talent');
    d.assets = readDynamicList('wz-asset');
    d.equipment = readDynamicList('wz-equip');
    d.bonds = readBondList();
    d.complications = readCompList();
    d._stepDataCollected[3] = true;
    return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getVal(selector) {
    const el = document.querySelector(selector);
    return el ? el.value : '';
}
function getNum(selector) {
    const el = document.querySelector(selector);
    return el ? safeParseInt(el.value, 0) : 0;
}

function readDynamicList(prefix) {
    const items = [];
    document.querySelectorAll(`.${prefix}-row`).forEach(row => {
        const nameInput = row.querySelector(`.${prefix}-name`) || row.querySelector('input[type="text"]');
        const costInput = row.querySelector(`.${prefix}-cost`) || row.querySelector('input[type="number"]');
        const name = nameInput?.value.trim() || '';
        const cost = costInput ? safeParseInt(costInput.value, 0) : 0;
        if (name) items.push({ name, cost });
    });
    return items;
}

function readBondList() {
    const items = [];
    document.querySelectorAll('.wz-bond-row').forEach(row => {
        const name = row.querySelector('.wz-bond-name')?.value.trim() || '';
        if (!name) return;
        items.push({
            name,
            desc: row.querySelector('.wz-bond-desc')?.value.trim() || '',
            start: row.querySelector('.wz-bond-start')?.checked || false,
        });
    });
    return items;
}

function readCompList() {
    const items = [];
    document.querySelectorAll('.wz-comp-row').forEach(row => {
        const name = row.querySelector('.wz-comp-name')?.value.trim() || '';
        if (!name) return;
        items.push({
            name,
            desc: row.querySelector('.wz-comp-desc')?.value.trim() || '',
            start: row.querySelector('.wz-comp-start')?.checked || false,
        });
    });
    return items;
}

// ─── Finish ────────────────────────────────────────────────────────────

function finishWizard() {
    const d = state.data;
    if (!d) {
        showToast('No character data to save.', 'error');
        return;
    }
    if (!d.name || !d.name.trim()) {
        showToast('Character name is required.', 'error');
        state.step = 0;
        renderStep();
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
        showToast(`✨ "${d.name}" created successfully!`, 'success');
        closeWizard();

        // Refresh character list
        import('./index.js')
            .then(mod => { if (mod.renderCharList) mod.renderCharList(); })
            .catch(() => {});

        if (d.vtt) {
            const vttBtn = document.querySelector('.sidebar-nav button[data-tab="vtt"]');
            if (vttBtn) setTimeout(() => vttBtn.click(), 300);
        }
    } catch (err) {
        console.error('[Wizard] Save error:', err);
        showToast('Error saving character. Please try again.', 'error');
    }
}

// ─── Rendering ─────────────────────────────────────────────────────────

function renderStep() {
    const d = state.data;
    if (!d) return;

    const stepsEl = document.getElementById('wizard-steps');
    const nextBtn = document.getElementById('wizard-next');
    const backBtn = document.getElementById('wizard-back');
    const titleEl = document.getElementById('wizard-title');

    if (!stepsEl || !nextBtn || !backBtn) {
        console.warn('[Wizard] Required DOM elements missing.');
        return;
    }

    titleEl.textContent = `Character Wizard — Step ${state.step + 1} of 5`;
    backBtn.style.display = state.step === 0 ? 'none' : 'inline-block';
    nextBtn.textContent = state.step === 4 ? '✨ Finish' : 'Next →';

    // Update progress
    document.querySelectorAll('.wizard-progress-step').forEach((el, idx) => {
        el.style.background = idx <= state.step ? 'var(--gold)' : 'var(--border)';
    });

    let html = '';
    try {
        switch (state.step) {
            case 0: html = renderStep0(d); break;
            case 1: html = renderStep1(d); break;
            case 2: html = renderStep2(d); break;
            case 3: html = renderStep3(d); break;
            case 4: html = renderStep4(d); break;
            default: html = '<p>Unknown step</p>';
        }
    } catch (err) {
        console.error('[Wizard] Render error:', err);
        html = '<p class="error">Error rendering step. Please refresh.</p>';
    }
    stepsEl.innerHTML = html;

    if (state.step === 4) setTimeout(updateSummaryXP, 50);

    const firstInput = stepsEl.querySelector('input, select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
}

// ─── Step Renderers ────────────────────────────────────────────────────

function renderStep0(d) {
    return `
        <div>
            <h3 style="margin-top:0;">🪪 Identity</h3>
            <p class="text-muted" style="font-size:0.9rem;margin-bottom:1rem;">Tell us who your character is.</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                <div>
                    <label>Name <span style="color:var(--red);">*</span></label>
                    <input id="wz-name" value="${escHtml(d.name)}" placeholder="Enter character name..." autofocus />
                    <span class="field-hint">Required</span>
                </div>
                <div>
                    <label>Heritage</label>
                    <input id="wz-heritage" value="${escHtml(d.heritage)}" placeholder="e.g., Human, Elf" />
                </div>
                <div>
                    <label>Background</label>
                    <input id="wz-background" value="${escHtml(d.background)}" placeholder="e.g., Soldier, Scholar" />
                </div>
                <div>
                    <label>Patron</label>
                    <input id="wz-patron" value="${escHtml(d.patron)}" placeholder="God, mentor, or organization" />
                </div>
                <div style="grid-column:1/2;">
                    <label>Tier</label>
                    <input id="wz-tier" value="${escHtml(d.tier)}" placeholder="e.g., I, II" style="max-width:100px;" />
                </div>
            </div>
        </div>
    `;
}

function renderStep1(d) {
    return `
        <div>
            <h3 style="margin-top:0;">⚡ Attributes (1–5)</h3>
            <p class="text-muted" style="font-size:0.9rem;margin-bottom:1rem;">Distribute your core attributes.</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.8rem;">
                ${['Body','Wits','Spirit','Presence'].map((attr, i) => {
                    const id = ['body','wits','spirit','presence'][i];
                    const val = d[id] ?? 0;
                    return `
                        <div class="stat-item">
                            <label style="font-weight:600;">${attr}</label>
                            <input type="number" id="wz-${id}" value="${val}" min="1" max="5" style="width:100%;text-align:center;font-size:1.2rem;" />
                            <span class="field-hint">1–5</span>
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
        <div>
            <h3 style="margin-top:0;">📚 Skills (0–5)</h3>
            <p class="text-muted" style="font-size:0.9rem;margin-bottom:1rem;">Set your character's skill ranks.</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.4rem;">
                ${skillsHtml}
            </div>
        </div>
    `;
}

function renderStep3(d) {
    const dynamicList = (prefix, label, rows) => `
        <div style="margin-top:0.6rem;">
            <h4 style="margin:0.4rem 0 0.2rem;">${label}</h4>
            <div id="${prefix}-list">${rows}</div>
            <button class="btn btn-sm btn-secondary" data-wizard-add="${prefix}">+ Add ${label}</button>
        </div>
    `;

    const talentRows = (d.talents || []).map((t, i) => dynamicRowHtml('wz-talent', i, t.name, t.cost)).join('');
    const assetRows = (d.assets || []).map((a, i) => dynamicRowHtml('wz-asset', i, a.name, a.cost)).join('');
    const equipRows = (d.equipment || []).map((e, i) => dynamicRowHtml('wz-equip', i, e.name, e.cost)).join('');
    const bondRows = (d.bonds || []).map((b, i) => bondRowHtml(i, b)).join('');
    const compRows = (d.complications || []).map((c, i) => compRowHtml(i, c)).join('');

    return `
        <div>
            <h3 style="margin-top:0;">🧩 Details</h3>
            <p class="text-muted" style="font-size:0.9rem;margin-bottom:0.5rem;">Add talents, assets, equipment, bonds, and complications.</p>
            ${dynamicList('wz-talent', 'Talents', talentRows)}
            ${dynamicList('wz-asset', 'Assets', assetRows)}
            ${dynamicList('wz-equip', 'Equipment', equipRows)}
            ${dynamicList('wz-bond', 'Bonds', bondRows)}
            ${dynamicList('wz-comp', 'Complications', compRows)}
            <p class="text-muted" style="font-size:0.8rem;margin-top:0.5rem;">Bonds and complications with checkbox give +2 starting XP each (max +4).</p>
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
        <div>
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
    if (state.step !== 4) return;
    const d = state.data;
    if (!d) return;
    const bondBonus = (d.bonds || []).filter(b => b.start).length * 2;
    const compBonus = (d.complications || []).filter(c => c.start).length * 2;
    const totalBonus = Math.min(bondBonus + compBonus, 4);
    const xpEl = document.getElementById('wizard-summary-xp');
    if (xpEl) xpEl.textContent = 32 + totalBonus;
}

// ─── Row HTML Builders ─────────────────────────────────────────────────

function dynamicRowHtml(prefix, idx, name = '', cost = 0) {
    return `
        <div class="dynamic-row ${prefix}-row" data-index="${idx}">
            <input type="text" class="${prefix}-name" placeholder="Name" value="${escHtml(name || '')}" style="flex:2;" />
            <input type="number" class="${prefix}-cost" placeholder="XP" value="${cost || 0}" min="0" style="width:60px;" />
            <button class="wizard-remove-btn">✕</button>
        </div>
    `;
}

function bondRowHtml(idx, item = {}) {
    return `
        <div class="dynamic-row wz-bond-row" data-index="${idx}">
            <input type="text" class="wz-bond-name" placeholder="Bond name" value="${escHtml(item.name || '')}" style="flex:1;min-width:100px;" />
            <input type="text" class="wz-bond-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;min-width:120px;" />
            <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;">
                <input type="checkbox" class="wz-bond-start" ${item.start !== false ? 'checked' : ''} /> +2 XP
            </label>
            <button class="wizard-remove-btn">✕</button>
        </div>
    `;
}

function compRowHtml(idx, item = {}) {
    return `
        <div class="dynamic-row wz-comp-row" data-index="${idx}">
            <input type="text" class="wz-comp-name" placeholder="Complication name" value="${escHtml(item.name || '')}" style="flex:1;min-width:100px;" />
            <input type="text" class="wz-comp-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;min-width:120px;" />
            <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;">
                <input type="checkbox" class="wz-comp-start" ${item.start !== false ? 'checked' : ''} /> +2 XP
            </label>
            <button class="wizard-remove-btn">✕</button>
        </div>
    `;
}

// ─── Dynamic Add ───────────────────────────────────────────────────────

export function addWizardDynamic(prefix) {
    const container = document.getElementById(prefix + '-list');
    if (!container) {
        console.warn(`[Wizard] Container not found: ${prefix}-list`);
        return;
    }
    const idx = container.children.length;
    let html;
    if (prefix === 'wz-bond') html = bondRowHtml(idx);
    else if (prefix === 'wz-comp') html = compRowHtml(idx);
    else html = dynamicRowHtml(prefix, idx);

    const div = document.createElement('div');
    div.innerHTML = html;
    const row = div.firstElementChild;
    container.appendChild(row);
    const nameInput = row.querySelector('input[type="text"]');
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
    if (state.step === 3) collectStepData();
}

// ─── Event Setup ──────────────────────────────────────────────────────

function attachEvents() {
    const modal = state.modal || document.getElementById('wizardModal');
    if (!modal) return;

    clearListeners();

    // Buttons
    addListener(document.getElementById('wizard-back'), 'click', wizardBack);
    addListener(document.getElementById('wizard-next'), 'click', wizardNext);
    addListener(document.getElementById('wizardModalClose'), 'click', closeWizard);

    // Overlay click
    const overlay = modal.querySelector('.wizard-overlay');
    if (overlay) addListener(overlay, 'click', closeWizard);

    // Keyboard: Escape to close, Enter to next
    const keyHandler = (e) => {
        if (!state.isOpen) return;
        if (e.key === 'Escape') closeWizard();
        else if (e.key === 'Enter' && !e.target.matches('textarea')) {
            const next = document.getElementById('wizard-next');
            if (next) { e.preventDefault(); next.click(); }
        }
    };
    addListener(document, 'keydown', keyHandler);

    // Delegated click for dynamic add/remove and checkbox updates
    const clickHandler = (e) => {
        const target = e.target;

        // Add button
        if (target.matches('[data-wizard-add]')) {
            const prefix = target.dataset.wizardAdd;
            addWizardDynamic(prefix);
            e.preventDefault();
        }

        // Remove button
        if (target.matches('.wizard-remove-btn')) {
            const row = target.closest('.dynamic-row');
            if (row) row.remove();
            if (state.step === 3) collectStepData();
            e.preventDefault();
        }

        // Checkbox change updates XP on step 4
        if (target.matches('.wz-bond-start, .wz-comp-start')) {
            if (state.isOpen && state.step === 4) {
                setTimeout(updateSummaryXP, 50);
            }
        }
    };
    addListener(document, 'click', clickHandler);
}

// ─── Initialisation ────────────────────────────────────────────────────

// Pre-create modal and attach listeners once when the module loads
// (does nothing if modal already exists)
ensureModal();

// ─── Expose to window (for inline handlers) ──────────────────────────

Object.assign(window, {
    addWizardDynamic,
    wizardBack,
    wizardNext,
    closeWizard,
});

// ─── Exports ──────────────────────────────────────────────────────────

export default {
    openWizard,
    closeWizard,
    wizardBack,
    wizardNext,
    addWizardDynamic,
};