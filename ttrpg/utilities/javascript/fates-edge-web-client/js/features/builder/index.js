/**
 * Builder feature - Interactive character builder with templates
 */

import { getState, addCharacter, generateId, saveState } from '../../core/state.js';
import { ALL_SKILLS, defaultSkills, attrCost, skillCost } from '../../core/dice.js';
import { BUILD_TEMPLATES } from '../../data/templates.js';
import { escHtml, safeParseInt, clamp } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

let container = null;

/**
 * Render the builder tab
 */
export function render(el) {
    container = el;
    container.innerHTML = `
        <div id="builder-app">
            <div class="container" style="max-width:1100px;width:100%;background:var(--bg2);padding:1.5rem;border-radius:var(--radius);border:1px solid var(--border);box-shadow:0 8px 30px rgba(0,0,0,0.08);color:var(--text);">
                <h1 style="color:var(--gold);border-bottom:2px solid var(--gold);padding-bottom:0.2rem;font-weight:300;">⚔️ Fate's Edge</h1>
                <div class="subtitle" style="color:var(--text2);font-style:italic;margin:-0.3rem 0 1.5rem 0;">Interactive Character Builder – with build templates, wiki integration, and VTT push</div>
                
                <div class="template-select" style="margin:0.5rem 0 1.5rem 0;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                    <label style="margin:0;font-weight:600;">📋 Load Build Template:</label>
                    <select id="b_buildTemplate" style="width:auto;min-width:200px;">
                        <option value="">— Manual —</option>
                        ${Object.keys(BUILD_TEMPLATES || {}).map(key => `<option value="${key}">${BUILD_TEMPLATES[key].name}</option>`).join('')}
                    </select>
                    <button class="btn" id="b_loadTemplateBtn" style="flex:0 0 auto;">Apply</button>
                </div>
                
                <div class="row" style="display:flex;flex-wrap:wrap;gap:0.8rem 1.5rem;margin-bottom:0.8rem;">
                    <div class="col" style="flex:1 1 180px;"><label>Name</label><input id="b_name" placeholder="Your character" /></div>
                    <div class="col" style="flex:1 1 180px;"><label>Heritage</label><input id="b_heritage" placeholder="e.g. Human (Vhasian)" /></div>
                    <div class="col" style="flex:1 1 180px;"><label>Background</label><input id="b_background" placeholder="e.g. Dispossessed noble" /></div>
                    <div class="col" style="flex:1 1 180px;"><label>Patron</label><input id="b_patron" placeholder="e.g. The Traveler" /></div>
                </div>
                <div class="row" style="display:flex;flex-wrap:wrap;gap:0.8rem 1.5rem;margin-bottom:0.8rem;">
                    <div class="col" style="flex:1 1 180px;"><label>Tier</label><input id="b_tier" placeholder="e.g. I" /></div>
                    <div class="col" style="flex:1 1 180px;"><label>Base Starting XP</label><input id="b_startXp" type="number" value="32" step="1" min="0" /></div>
                    <div class="col" style="flex:1 1 180px;"><label class="inline-check"><input type="checkbox" id="b_pushVtt" checked /> Push to VTT</label></div>
                </div>
                
                <h2>Attributes</h2>
                <div class="attr-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.5rem 1rem;">
                    <div class="attr-item" style="display:flex;align-items:center;gap:0.5rem;"><label style="margin:0;min-width:70px;font-weight:600;">Body</label><input id="b_body" type="number" min="1" max="6" value="3" style="width:60px;text-align:center;" /></div>
                    <div class="attr-item" style="display:flex;align-items:center;gap:0.5rem;"><label style="margin:0;min-width:70px;font-weight:600;">Wits</label><input id="b_wits" type="number" min="1" max="6" value="2" style="width:60px;text-align:center;" /></div>
                    <div class="attr-item" style="display:flex;align-items:center;gap:0.5rem;"><label style="margin:0;min-width:70px;font-weight:600;">Spirit</label><input id="b_spirit" type="number" min="1" max="6" value="1" style="width:60px;text-align:center;" /></div>
                    <div class="attr-item" style="display:flex;align-items:center;gap:0.5rem;"><label style="margin:0;min-width:70px;font-weight:600;">Presence</label><input id="b_presence" type="number" min="1" max="6" value="1" style="width:60px;text-align:center;" /></div>
                </div>
                
                <h2>Skills</h2>
                <div class="skill-grid" id="b_skillGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.2rem 0.8rem;"></div>
                
                <h2>Talents</h2>
                <div class="wiki-picker" style="margin-bottom:0.4rem;max-width:320px;">
                    <select id="b_talentWiki" style="width:100%;">
                        <option value="">Add talent from wiki…</option>
                    </select>
                </div>
                <div class="dynamic-list" id="b_talentList"></div>
                <button class="add-btn" id="b_addTalentBtn" style="background:var(--gold);color:#1a141a;border:none;padding:0.4rem 1.2rem;border-radius:6px;cursor:pointer;font-size:0.9rem;margin-top:0.2rem;">+ Custom Talent</button>
                
                <h2>Assets</h2>
                <div class="wiki-picker" style="margin-bottom:0.4rem;max-width:320px;">
                    <select id="b_assetWiki">
                        <option value="">Add asset from wiki…</option>
                    </select>
                </div>
                <div class="dynamic-list" id="b_assetList"></div>
                <button class="add-btn" id="b_addAssetBtn" style="background:var(--gold);color:#1a141a;border:none;padding:0.4rem 1.2rem;border-radius:6px;cursor:pointer;font-size:0.9rem;margin-top:0.2rem;">+ Custom Asset</button>
                
                <h2>Equipment</h2>
                <div class="wiki-picker" style="margin-bottom:0.4rem;max-width:320px;">
                    <select id="b_equipWiki">
                        <option value="">Add equipment from wiki…</option>
                    </select>
                </div>
                <div class="dynamic-list" id="b_equipList"></div>
                <button class="add-btn" id="b_addEquipBtn" style="background:var(--gold);color:#1a141a;border:none;padding:0.4rem 1.2rem;border-radius:6px;cursor:pointer;font-size:0.9rem;margin-top:0.2rem;">+ Custom Equipment</button>
                
                <h2>Bonds <span style="font-weight:400;font-size:0.8rem;color:var(--text2);">(+2 start XP each, max total 36)</span></h2>
                <div class="dynamic-list" id="b_bondList"></div>
                <button class="add-btn" id="b_addBondBtn" style="background:var(--gold);color:#1a141a;border:none;padding:0.4rem 1.2rem;border-radius:6px;cursor:pointer;font-size:0.9rem;margin-top:0.2rem;">+ Add Bond</button>
                
                <h2>Complications <span style="font-weight:400;font-size:0.8rem;color:var(--text2);">(+2 start XP each, max total 36)</span></h2>
                <div class="dynamic-list" id="b_compList"></div>
                <button class="add-btn" id="b_addCompBtn" style="background:var(--gold);color:#1a141a;border:none;padding:0.4rem 1.2rem;border-radius:6px;cursor:pointer;font-size:0.9rem;margin-top:0.2rem;">+ Add Complication</button>
                
                <div class="summary" id="b_summaryBox" style="background:var(--bg3);padding:1rem 1.5rem;border-radius:10px;margin:1.5rem 0 1rem 0;display:flex;flex-wrap:wrap;gap:1.5rem 3rem;align-items:center;border-left:4px solid var(--gold);">
                    <div class="summary-item" style="display:flex;align-items:baseline;gap:0.4rem;"><label style="margin:0;font-weight:600;font-size:0.9rem;color:var(--text2);">Attributes</label> <span id="b_sumAttr" style="font-weight:700;font-size:1.1rem;color:var(--gold);min-width:40px;">0</span> XP</div>
                    <div class="summary-item" style="display:flex;align-items:baseline;gap:0.4rem;"><label style="margin:0;font-weight:600;font-size:0.9rem;color:var(--text2);">Skills</label> <span id="b_sumSkill" style="font-weight:700;font-size:1.1rem;color:var(--gold);min-width:40px;">0</span> XP</div>
                    <div class="summary-item" style="display:flex;align-items:baseline;gap:0.4rem;"><label style="margin:0;font-weight:600;font-size:0.9rem;color:var(--text2);">Talents</label> <span id="b_sumTalent" style="font-weight:700;font-size:1.1rem;color:var(--gold);min-width:40px;">0</span> XP</div>
                    <div class="summary-item" style="display:flex;align-items:baseline;gap:0.4rem;"><label style="margin:0;font-weight:600;font-size:0.9rem;color:var(--text2);">Assets</label> <span id="b_sumAsset" style="font-weight:700;font-size:1.1rem;color:var(--gold);min-width:40px;">0</span> XP</div>
                    <div class="summary-item" style="display:flex;align-items:baseline;gap:0.4rem;"><label style="margin:0;font-weight:600;font-size:0.9rem;color:var(--text2);">Equipment</label> <span id="b_sumEquip" style="font-weight:700;font-size:1.1rem;color:var(--gold);min-width:40px;">0</span> XP</div>
                    <div class="summary-item" style="display:flex;align-items:baseline;gap:0.4rem;"><label style="margin:0;font-weight:600;font-size:0.9rem;color:var(--text2);">Bond/Comp Bonus</label> <span id="b_sumBonus" style="font-weight:700;font-size:1.1rem;color:var(--gold);min-width:40px;">0</span> XP</div>
                    <div class="summary-item" style="border-left:2px solid var(--border);padding-left:1rem;display:flex;align-items:baseline;gap:0.4rem;"><label style="font-weight:700;margin:0;">Total spent</label><span id="b_sumTotal" style="font-size:1.3rem;font-weight:700;color:var(--gold);">0</span> XP</div>
                    <div class="summary-item" style="display:flex;align-items:baseline;gap:0.4rem;"><label style="font-weight:700;margin:0;">Starting XP</label><span id="b_sumStart" style="font-size:1.3rem;color:var(--gold);font-weight:700;">0</span> XP</div>
                    <div class="summary-item" style="display:flex;align-items:baseline;gap:0.4rem;"><label style="font-weight:700;margin:0;">Remaining</label><span id="b_sumRemaining" class="remaining" style="font-size:1.3rem;font-weight:700;">0</span> XP</div>
                </div>
                
                <div class="btn-group" style="display:flex;flex-wrap:wrap;gap:1rem;margin:1.5rem 0 0.5rem 0;">
                    <button class="btn" id="b_calcBtn">🧮 Recalculate XP</button>
                    <button class="btn" id="b_exportBtn">📄 Export PDF</button>
                    <button class="btn btn-secondary" id="b_resetBtn">↺ Reset Form</button>
                    <button class="btn btn-gold" id="b_saveCharBtn">🖥️ Save to Roster</button>
                </div>
                <div class="footer" style="text-align:center;margin-top:2rem;font-size:0.8rem;color:var(--text2);border-top:1px solid var(--border);padding-top:1rem;">"Every choice carries weight." — Fate's Edge</div>
            </div>
        </div>
    `;
    
    // Build skill grid
    const skillGrid = document.getElementById('b_skillGrid');
    if (skillGrid) {
        ALL_SKILLS.forEach(skill => {
            const div = document.createElement('div');
            div.className = 'skill-item';
            div.style.cssText = 'display:flex;align-items:center;gap:0.4rem;';
            const label = document.createElement('label');
            label.textContent = skill;
            label.style.cssText = 'margin:0;font-weight:400;font-size:0.85rem;min-width:70px;';
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.max = '5';
            input.value = '0';
            input.id = 'b_skill_' + skill.toLowerCase();
            input.style.cssText = 'width:50px;text-align:center;';
            input.addEventListener('input', updateBuilderSummary);
            div.appendChild(label);
            div.appendChild(input);
            skillGrid.appendChild(div);
        });
    }
    
    // Populate wiki pickers
    populateWikiPickers();
    
    // Set up event listeners
    setupBuilderEvents();
    
    // Initial summary
    setTimeout(updateBuilderSummary, 50);
}

/**
 * Populate wiki pickers
 */
function populateWikiPickers() {
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    
    const talentSelect = document.getElementById('b_talentWiki');
    if (talentSelect) {
        const filtered = wikiEntries.filter(e => e.category === 'talents' || e.category === 'talent');
        talentSelect.innerHTML = '<option value="">Add talent from wiki…</option>' + 
            filtered.map(e => `<option value="${escHtml(String(e.id))}">${escHtml(e.title)}${e.cost != null ? ' (' + e.cost + ' XP)' : ''}</option>`)
            .join('');
    }
    
    const assetSelect = document.getElementById('b_assetWiki');
    if (assetSelect) {
        const filtered = wikiEntries.filter(e => e.category === 'assets' || e.category === 'asset');
        assetSelect.innerHTML = '<option value="">Add asset from wiki…</option>' + 
            filtered.map(e => `<option value="${escHtml(String(e.id))}">${escHtml(e.title)}${e.cost != null ? ' (' + e.cost + ' XP)' : ''}</option>`)
            .join('');
    }
    
    const equipSelect = document.getElementById('b_equipWiki');
    if (equipSelect) {
        const filtered = wikiEntries.filter(e => e.category === 'equipment' || e.category === 'item');
        equipSelect.innerHTML = '<option value="">Add equipment from wiki…</option>' + 
            filtered.map(e => `<option value="${escHtml(String(e.id))}">${escHtml(e.title)}${e.cost != null ? ' (' + e.cost + ' XP)' : ''}</option>`)
            .join('');
    }
}

/**
 * Setup builder event listeners
 */
function setupBuilderEvents() {
    const $ = id => document.getElementById(id);
    
    // Calculate button
    $('b_calcBtn')?.addEventListener('click', updateBuilderSummary);
    
    // Reset button
    $('b_resetBtn')?.addEventListener('click', resetBuilder);
    
    // Save button
    $('b_saveCharBtn')?.addEventListener('click', saveCharacter);
    
    // Export PDF button
    $('b_exportBtn')?.addEventListener('click', exportPDF);
    
    // Load template button
    $('b_loadTemplateBtn')?.addEventListener('click', loadTemplate);
    
    // Add buttons for dynamic lists
    $('b_addTalentBtn')?.addEventListener('click', () => addDynamicItem('b_talentList', 'Talent'));
    $('b_addAssetBtn')?.addEventListener('click', () => addDynamicItem('b_assetList', 'Asset'));
    $('b_addEquipBtn')?.addEventListener('click', () => addDynamicItem('b_equipList', 'Equipment'));
    $('b_addBondBtn')?.addEventListener('click', () => addBondItem());
    $('b_addCompBtn')?.addEventListener('click', () => addCompItem());
    
    // Wiki picker change events - replace inline onchange with proper event listeners
    const talentSelect = document.getElementById('b_talentWiki');
    if (talentSelect) {
        talentSelect.addEventListener('change', function() {
            if (this.value) {
                builderAddFromWiki('talent', this.value);
                this.value = '';
            }
        });
    }
    
    const assetSelect = document.getElementById('b_assetWiki');
    if (assetSelect) {
        assetSelect.addEventListener('change', function() {
            if (this.value) {
                builderAddFromWiki('asset', this.value);
                this.value = '';
            }
        });
    }
    
    const equipSelect = document.getElementById('b_equipWiki');
    if (equipSelect) {
        equipSelect.addEventListener('change', function() {
            if (this.value) {
                builderAddFromWiki('equipment', this.value);
                this.value = '';
            }
        });
    }
    
    // Input listeners for summary updates
    ['b_body', 'b_wits', 'b_spirit', 'b_presence', 'b_startXp'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateBuilderSummary);
    });
}

/**
 * Add a dynamic item to a list
 */
function addDynamicItem(listId, placeholder) {
    const list = document.getElementById(listId);
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.3rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;';
    div.innerHTML = `
        <input type="text" placeholder="${placeholder} name" style="flex:2 1 120px;min-width:80px;" />
        <input type="number" placeholder="XP" min="0" value="0" style="flex:0 1 70px;width:70px;" />
        <button class="btn btn-xs" onclick="this.closest('.dynamic-row').remove();window.updateBuilderSummary()">✕</button>
    `;
    list.appendChild(div);
    updateBuilderSummary();
}

/**
 * Add a bond item
 */
function addBondItem() {
    const list = document.getElementById('b_bondList');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.3rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;';
    div.innerHTML = `
        <input type="text" placeholder="Bond name" style="flex:2 1 120px;min-width:80px;" />
        <input type="text" placeholder="Description" style="flex:2;min-width:80px;" />
        <label class="inline-check"><input type="checkbox" checked /> +2 XP</label>
        <button class="btn btn-xs" onclick="this.closest('.dynamic-row').remove();window.updateBuilderSummary()">✕</button>
    `;
    list.appendChild(div);
    updateBuilderSummary();
}

/**
 * Add a complication item
 */
function addCompItem() {
    const list = document.getElementById('b_compList');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.3rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;';
    div.innerHTML = `
        <input type="text" placeholder="Complication name" style="flex:2 1 120px;min-width:80px;" />
        <input type="text" placeholder="Description" style="flex:2;min-width:80px;" />
        <label class="inline-check"><input type="checkbox" checked /> +2 XP</label>
        <button class="btn btn-xs" onclick="this.closest('.dynamic-row').remove();window.updateBuilderSummary()">✕</button>
    `;
    list.appendChild(div);
    updateBuilderSummary();
}

/**
 * Add item from wiki
 */
export function builderAddFromWiki(type, entryId) {
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    const entry = wikiEntries.find(e => String(e.id) === String(entryId));
    if (!entry) {
        showToast('Wiki entry not found.', 'error');
        return;
    }
    
    const containerMap = {
        talent: 'b_talentList',
        asset: 'b_assetList',
        equipment: 'b_equipList'
    };
    const containerId = containerMap[type];
    if (!containerId) {
        showToast('Invalid item type.', 'error');
        return;
    }
    
    const list = document.getElementById(containerId);
    if (!list) {
        showToast('List container not found.', 'error');
        return;
    }
    
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.3rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;';
    div.innerHTML = `
        <input type="text" placeholder="${type}" value="${escHtml(entry.title)}" style="flex:2 1 120px;min-width:80px;" />
        <input type="number" placeholder="XP" min="0" value="${entry.cost || 0}" style="flex:0 1 70px;width:70px;" />
        <button class="btn btn-xs" onclick="this.closest('.dynamic-row').remove();window.updateBuilderSummary()">✕</button>
    `;
    list.appendChild(div);
    updateBuilderSummary();
    showToast(`Added "${entry.title}"`, 'success');
}

// Expose globally
window.builderAddFromWiki = builderAddFromWiki;
window.updateBuilderSummary = updateBuilderSummary;

/**
 * Update the builder summary (XP totals)
 */
function updateBuilderSummary() {
    const $ = id => document.getElementById(id);
    
    const body = safeParseInt($('b_body')?.value, 1);
    const wits = safeParseInt($('b_wits')?.value, 1);
    const spirit = safeParseInt($('b_spirit')?.value, 1);
    const presence = safeParseInt($('b_presence')?.value, 1);
    
    const attrTotal = attrCost(body) + attrCost(wits) + attrCost(spirit) + attrCost(presence);
    if ($('b_sumAttr')) $('b_sumAttr').textContent = attrTotal;
    
    let skillTotal = 0;
    ALL_SKILLS.forEach(skill => {
        const el = $('b_skill_' + skill.toLowerCase());
        if (el) skillTotal += skillCost(safeParseInt(el.value));
    });
    if ($('b_sumSkill')) $('b_sumSkill').textContent = skillTotal;
    
    let talentTotal = 0;
    $('b_talentList')?.querySelectorAll('.dynamic-row').forEach(row => {
        const xpInput = row.querySelector('input[type="number"]');
        if (xpInput) talentTotal += safeParseInt(xpInput.value);
    });
    if ($('b_sumTalent')) $('b_sumTalent').textContent = talentTotal;
    
    let assetTotal = 0;
    $('b_assetList')?.querySelectorAll('.dynamic-row').forEach(row => {
        const xpInput = row.querySelector('input[type="number"]');
        if (xpInput) assetTotal += safeParseInt(xpInput.value);
    });
    if ($('b_sumAsset')) $('b_sumAsset').textContent = assetTotal;
    
    let equipTotal = 0;
    $('b_equipList')?.querySelectorAll('.dynamic-row').forEach(row => {
        const xpInput = row.querySelector('input[type="number"]');
        if (xpInput) equipTotal += safeParseInt(xpInput.value);
    });
    if ($('b_sumEquip')) $('b_sumEquip').textContent = equipTotal;
    
    const baseXp = safeParseInt($('b_startXp')?.value, 32);
    let bondCount = 0;
    $('b_bondList')?.querySelectorAll('.dynamic-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const name = inputs[0]?.value.trim();
        if (!name) return;
        const checked = inputs[2]?.checked || false;
        if (checked) bondCount++;
    });
    let compCount = 0;
    $('b_compList')?.querySelectorAll('.dynamic-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const name = inputs[0]?.value.trim();
        if (!name) return;
        const checked = inputs[2]?.checked || false;
        if (checked) compCount++;
    });
    const startBonus = Math.min(36 - baseXp, 2 * (bondCount + compCount));
    const startXp = Math.max(0, baseXp + startBonus);
    if ($('b_sumBonus')) $('b_sumBonus').textContent = startBonus;
    if ($('b_sumStart')) $('b_sumStart').textContent = startXp;
    
    const totalSpent = attrTotal + skillTotal + talentTotal + assetTotal + equipTotal;
    if ($('b_sumTotal')) $('b_sumTotal').textContent = totalSpent;
    const remaining = Math.max(0, startXp - totalSpent);
    const remEl = $('b_sumRemaining');
    if (remEl) {
        remEl.textContent = remaining;
        remEl.className = 'remaining' + (remaining < 0 ? ' over' : '');
    }
}

/**
 * Reset the builder form
 */
function resetBuilder() {
    if (!confirm('Reset all fields?')) return;
    const $ = id => document.getElementById(id);
    
    if ($('b_name')) $('b_name').value = '';
    if ($('b_heritage')) $('b_heritage').value = '';
    if ($('b_background')) $('b_background').value = '';
    if ($('b_patron')) $('b_patron').value = '';
    if ($('b_tier')) $('b_tier').value = '';
    if ($('b_startXp')) $('b_startXp').value = '32';
    if ($('b_body')) $('b_body').value = '3';
    if ($('b_wits')) $('b_wits').value = '2';
    if ($('b_spirit')) $('b_spirit').value = '1';
    if ($('b_presence')) $('b_presence').value = '1';
    
    ALL_SKILLS.forEach(skill => {
        const el = $('b_skill_' + skill.toLowerCase());
        if (el) el.value = '0';
    });
    
    ['b_talentList', 'b_assetList', 'b_equipList', 'b_bondList', 'b_compList'].forEach(id => {
        const container = $(id);
        if (container) container.innerHTML = '';
    });
    
    if ($('b_pushVtt')) $('b_pushVtt').checked = true;
    if ($('b_buildTemplate')) $('b_buildTemplate').value = '';
    updateBuilderSummary();
    showToast('Form reset.', 'info');
}

/**
 * Load a template
 */
function loadTemplate() {
    const key = document.getElementById('b_buildTemplate')?.value;
    if (!key || !BUILD_TEMPLATES || !BUILD_TEMPLATES[key]) {
        showToast('Please select a template.', 'error');
        return;
    }
    const t = BUILD_TEMPLATES[key];
    const $ = id => document.getElementById(id);
    
    if ($('b_body')) $('b_body').value = t.body || 3;
    if ($('b_wits')) $('b_wits').value = t.wits || 2;
    if ($('b_spirit')) $('b_spirit').value = t.spirit || 1;
    if ($('b_presence')) $('b_presence').value = t.presence || 1;
    
    ALL_SKILLS.forEach(skill => {
        const el = $('b_skill_' + skill.toLowerCase());
        if (el) el.value = '0';
    });
    if (t.skills) {
        Object.entries(t.skills).forEach(([skill, val]) => {
            const el = $('b_skill_' + skill.toLowerCase());
            if (el) el.value = val;
        });
    }
    
    ['b_talentList', 'b_assetList', 'b_equipList', 'b_bondList', 'b_compList'].forEach(id => {
        const container = $(id);
        if (container) container.innerHTML = '';
    });
    
    (t.talents || []).forEach(tal => {
        const list = $('b_talentList');
        if (!list) return;
        const div = document.createElement('div');
        div.className = 'dynamic-row';
        div.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.3rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;';
        div.innerHTML = `
            <input type="text" placeholder="Talent" value="${escHtml(tal.name)}" style="flex:2 1 120px;min-width:80px;" />
            <input type="number" placeholder="XP" min="0" value="${tal.cost || 0}" style="flex:0 1 70px;width:70px;" />
            <button class="btn btn-xs" onclick="this.closest('.dynamic-row').remove();window.updateBuilderSummary()">✕</button>
        `;
        list.appendChild(div);
    });
    
    (t.assets || []).forEach(ass => {
        const list = $('b_assetList');
        if (!list) return;
        const div = document.createElement('div');
        div.className = 'dynamic-row';
        div.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.3rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;';
        div.innerHTML = `
            <input type="text" placeholder="Asset" value="${escHtml(ass.name)}" style="flex:2 1 120px;min-width:80px;" />
            <input type="number" placeholder="XP" min="0" value="${ass.cost || 0}" style="flex:0 1 70px;width:70px;" />
            <button class="btn btn-xs" onclick="this.closest('.dynamic-row').remove();window.updateBuilderSummary()">✕</button>
        `;
        list.appendChild(div);
    });
    
    (t.equipment || []).forEach(eq => {
        const list = $('b_equipList');
        if (!list) return;
        const div = document.createElement('div');
        div.className = 'dynamic-row';
        div.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.3rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;';
        div.innerHTML = `
            <input type="text" placeholder="Equipment" value="${escHtml(eq.name)}" style="flex:2 1 120px;min-width:80px;" />
            <input type="number" placeholder="XP" min="0" value="${eq.cost || 0}" style="flex:0 1 70px;width:70px;" />
            <button class="btn btn-xs" onclick="this.closest('.dynamic-row').remove();window.updateBuilderSummary()">✕</button>
        `;
        list.appendChild(div);
    });
    
    (t.bonds || []).forEach(b => {
        const list = $('b_bondList');
        if (!list) return;
        const div = document.createElement('div');
        div.className = 'dynamic-row';
        div.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.3rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;';
        div.innerHTML = `
            <input type="text" placeholder="Bond" value="${escHtml(b.name)}" style="flex:2 1 120px;min-width:80px;" />
            <input type="text" placeholder="Description" value="${escHtml(b.desc || '')}" style="flex:2;min-width:80px;" />
            <label class="inline-check"><input type="checkbox" ${b.start !== false ? 'checked' : ''} /> +2 XP</label>
            <button class="btn btn-xs" onclick="this.closest('.dynamic-row').remove();window.updateBuilderSummary()">✕</button>
        `;
        list.appendChild(div);
    });
    
    (t.comps || []).forEach(x => {
        const list = $('b_compList');
        if (!list) return;
        const div = document.createElement('div');
        div.className = 'dynamic-row';
        div.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.3rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;';
        div.innerHTML = `
            <input type="text" placeholder="Complication" value="${escHtml(x.name)}" style="flex:2 1 120px;min-width:80px;" />
            <input type="text" placeholder="Description" value="${escHtml(x.desc || '')}" style="flex:2;min-width:80px;" />
            <label class="inline-check"><input type="checkbox" ${x.start !== false ? 'checked' : ''} /> +2 XP</label>
            <button class="btn btn-xs" onclick="this.closest('.dynamic-row').remove();window.updateBuilderSummary()">✕</button>
        `;
        list.appendChild(div);
    });
    
    if ($('b_name')) $('b_name').value = t.name || '';
    if ($('b_background')) $('b_background').value = t.name ? t.name + ' template' : '';
    updateBuilderSummary();
    showToast('Template loaded.', 'success');
}

/**
 * Save the character
 */
function saveCharacter() {
    updateBuilderSummary();
    const $ = id => document.getElementById(id);
    const v = id => $(id)?.value || '';
    const n = id => safeParseInt($(id)?.value);
    
    const char = {
        id: generateId(),
        name: v('b_name'),
        heritage: v('b_heritage'),
        background: v('b_background'),
        patron: v('b_patron'),
        tier: v('b_tier') || 'I',
        body: clamp(n('b_body'), 1, 5),
        wits: clamp(n('b_wits'), 1, 5),
        spirit: clamp(n('b_spirit'), 1, 5),
        presence: clamp(n('b_presence'), 1, 5),
        xp: n('b_startXp'),
        skills: defaultSkills(),
        talents: [],
        assets: [],
        equipment: [],
        bonds: [],
        complications: [],
        harm: 0,
        fatigue: 0,
        boons: 0,
        vtt: $('b_pushVtt')?.checked || false
    };
    
    if (!char.name || char.name.trim() === '') {
        showToast('Character needs a name.', 'error');
        return;
    }
    
    // Read skills
    ALL_SKILLS.forEach(skill => {
        char.skills[skill.toLowerCase()] = clamp(n('b_skill_' + skill.toLowerCase()), 0, 5);
    });
    
    // Read talents
    $('b_talentList')?.querySelectorAll('.dynamic-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const name = inputs[0]?.value.trim();
        if (!name) return;
        char.talents.push({ name, cost: safeParseInt(inputs[1]?.value, 0) });
    });
    
    // Read assets
    $('b_assetList')?.querySelectorAll('.dynamic-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const name = inputs[0]?.value.trim();
        if (!name) return;
        char.assets.push({ name, cost: safeParseInt(inputs[1]?.value, 0) });
    });
    
    // Read equipment
    $('b_equipList')?.querySelectorAll('.dynamic-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const name = inputs[0]?.value.trim();
        if (!name) return;
        char.equipment.push({ name, cost: safeParseInt(inputs[1]?.value, 0) });
    });
    
    // Read bonds
    $('b_bondList')?.querySelectorAll('.dynamic-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const name = inputs[0]?.value.trim();
        if (!name) return;
        char.bonds.push({
            name,
            desc: inputs[1]?.value.trim() || '',
            start: inputs[2]?.checked || false
        });
    });
    
    // Read complications
    $('b_compList')?.querySelectorAll('.dynamic-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const name = inputs[0]?.value.trim();
        if (!name) return;
        char.complications.push({
            name,
            desc: inputs[1]?.value.trim() || '',
            start: inputs[2]?.checked || false
        });
    });
    
    // Calculate final XP
    const baseXp = n('b_startXp');
    const startBonus = Math.min(36 - baseXp, 2 * (char.bonds.filter(b => b.start).length + char.complications.filter(c => c.start).length));
    char.xp = baseXp + startBonus;
    
    // Add character to state
    addCharacter(char);
    showToast(`${char.name} saved.`, 'success');
    
    // Navigate to appropriate tab
    if (char.vtt) {
        const vttBtn = document.querySelector('.sidebar-nav button[data-tab="vtt"]');
        if (vttBtn) vttBtn.click();
    } else {
        const charBtn = document.querySelector('.sidebar-nav button[data-tab="characters"]');
        if (charBtn) charBtn.click();
    }
}

/**
 * Export PDF
 */
function exportPDF() {
    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showToast('jsPDF not loaded.', 'error');
            return;
        }
        showToast('PDF export coming soon!', 'info');
    } catch (e) {
        showToast('PDF export failed: ' + e.message, 'error');
        console.error(e);
    }
}

/**
 * Destroy module
 */
export function destroy() {
    container = null;
}

// Expose functions globally
window.updateBuilderSummary = updateBuilderSummary;
window.builderAddFromWiki = builderAddFromWiki;