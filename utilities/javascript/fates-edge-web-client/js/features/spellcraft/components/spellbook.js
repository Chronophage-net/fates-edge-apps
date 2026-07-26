/**
 * Spellbook – Custom spells for Free Casters / Threadweavers
 *
 * A grimoire of TAGS combinations, signature spells, and the Weave's receipts.
 * "Record your spells. The Weave respects repetition."
 * – Lysandra of the Amber Gate
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId, safeParseInt } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';

// ============================================================
// HELPERS
// ============================================================

function safeString(val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => safeString(v)).join(', ');
    if (typeof val === 'object') {
        if (val.name) return safeString(val.name);
        if (val.label) return safeString(val.label);
        if (val.description) return safeString(val.description);
        if (val.effect) return safeString(val.effect);
        if (val.text) return safeString(val.text);
        try { return JSON.stringify(val); } catch (e) { return '[object]'; }
    }
    return String(val);
}

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

const TAG_COLORS = {
    'Burning': '#e67e22', 'Freezing': '#3498db', 'Storm': '#f1c40f', 
    'Stone': '#7f8c8d', 'Wave': '#2980b9', 'Wind': '#ecf0f1',
    'Force': '#e74c3c', 'Area': '#9b59b6', 'Strike': '#c0392b',
    'Wall': '#2c3e50', 'Bind': '#e67e22', 'Dispel': '#8e44ad',
    'Veil': '#1abc9c', 'Scry': '#2ecc71', 'Memory': '#f39c12',
    'Command': '#d35400', 'Fear': '#c0392b',
    'HEAL': '#27ae60', 'Purify': '#2ecc71', 'Strengthen': '#f1c40f',
    'Waken': '#e67e22', 'Beast': '#d35400',
    'Leap': '#8e44ad', 'Fold': '#8e44ad', 'Gate': '#c0392b', 'Gravity': '#2c3e50',
    'Create': '#f39c12', 'Summon': '#9b59b6', 'Transmute': '#e74c3c', 'Animate': '#e67e22',
    'Sense': '#3498db', 'Reveal': '#1abc9c', 'Light': '#f1c40f',
    'Shadow': '#2c3e50', 'Silence': '#7f8c8d', 'Protect': '#27ae60',
    'Counter': '#c0392b', 'Reflect': '#8e44ad', 'Store': '#d35400',
    'Curse': '#c0392b', 'Bless': '#27ae60'
};

// ============================================================
// MAIN RENDER
// ============================================================

export function renderSpellbook(el) {
    const char = getCharacterData();
    if (!char) {
        el.innerHTML = `<p style="color:var(--text3);">Select a character to view their spellbook.</p>`;
        return;
    }

    // Ensure spellbook exists
    if (!char.spellbook) char.spellbook = [];

    const spells = char.spellbook;
    const sortBy = localStorage.getItem('fates-edge-spellbook-sort') || 'name';
    const sorted = sortSpells(spells, sortBy);

    const signatureCount = spells.filter(s => s.signature).length;

    let html = `
        <div class="spellbook-container" style="display:flex;flex-direction:column;gap:0.5rem;">
            <!-- Header -->
            <div class="spellbook-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:1px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.2rem;">📚</span>
                    <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Spellbook</span>
                    <span style="font-size:0.7rem;color:var(--text3);">${spells.length} spells ${signatureCount > 0 ? `· ⭐ ${signatureCount} signature` : ''}</span>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="window.spellbookAddSpell()">➕ Add</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.spellbookImport()">📥 Import</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.spellbookExport()">📤 Export</button>
                    <button class="btn btn-sm btn-ghost" onclick="window.spellbookClearAll()" style="color:var(--red);">🗑️</button>
                </div>
            </div>

            <!-- Sort controls -->
            <div class="spellbook-controls" style="display:flex;gap:0.3rem;align-items:center;font-size:0.8rem;flex-wrap:wrap;">
                <span style="color:var(--text3);">Sort by:</span>
                <select id="spellbook-sort-select" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.8rem;">
                    <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Name</option>
                    <option value="dv" ${sortBy === 'dv' ? 'selected' : ''}>DV</option>
                    <option value="recent" ${sortBy === 'recent' ? 'selected' : ''}>Recent</option>
                    <option value="usage" ${sortBy === 'usage' ? 'selected' : ''}>Usage</option>
                </select>
                <button class="btn btn-xs btn-ghost" onclick="window.spellbookSort('name')">🔤</button>
                <button class="btn btn-xs btn-ghost" onclick="window.spellbookSort('dv')">#️⃣</button>
                <button class="btn btn-xs btn-ghost" onclick="window.spellbookSort('recent')">🕒</button>
                <button class="btn btn-xs btn-ghost" onclick="window.spellbookSort('usage')">📊</button>
                <span style="margin-left:auto;font-size:0.7rem;color:var(--text3);">${spells.length === 0 ? 'Empty' : `${spells.length} spells`}</span>
            </div>

            <!-- Spell list -->
            <div class="spellbook-list" style="display:flex;flex-direction:column;gap:0.3rem;max-height:400px;overflow-y:auto;padding:0.1rem;">
    `;

    if (sorted.length === 0) {
        html += `
            <div class="spellbook-empty" style="text-align:center;color:var(--text3);padding:1rem 0;">
                <div style="font-size:2rem;">📖</div>
                <p>No spells yet.</p>
                <p style="font-size:0.85rem;">Create your first spell using the TAGS calculator or the Add button.</p>
                <p style="font-size:0.75rem;color:var(--text2);">"The Weave does not reward empty pages." – Lysandra</p>
            </div>
        `;
    } else {
        sorted.forEach((spell, index) => {
            html += renderSpellItem(spell, index);
        });
    }

    html += `
            </div>
        </div>
    `;

    el.innerHTML = html;

    // Attach sort change listener
    const sortSelect = el.querySelector('#spellbook-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            localStorage.setItem('fates-edge-spellbook-sort', e.target.value);
            renderSpellbook(el);
        });
    }
}

// ============================================================
// RENDER SINGLE SPELL ITEM
// ============================================================

function renderSpellItem(spell, index) {
    const id = spell.id;
    const name = safeString(spell.name || 'Unnamed Spell');
    const tags = spell.tags || [];
    const dv = spell.dv || 0;
    const description = safeString(spell.effect || spell.description || '');
    const signature = spell.signature || false;
    const usage = spell.usage || 0;
    const cost = spell.cost || {};

    // Build tag badges
    const tagBadges = tags.map(tag => {
        const color = TAG_COLORS[tag] || 'var(--text3)';
        const mod = window.TAGS_REFERENCE?.[tag]?.mod ?? (tag.length > 4 ? 2 : 1); // fallback heuristic
        return `<span class="tag-badge" style="display:inline-block;padding:0.05rem 0.4rem;margin:0.05rem;border-radius:8px;background:${color}22;border:1px solid ${color};font-size:0.65rem;color:${color};">${escHtml(tag)}</span>`;
    }).join(' ');

    const costDisplay = cost.obligation ? `⛓️ ${cost.obligation}` : cost.xp ? `${cost.xp} XP` : '';

    return `
        <div class="spell-item" data-spell-id="${escHtml(id)}" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:3px solid ${signature ? 'var(--gold)' : 'var(--border)'};">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    ${signature ? '<span style="color:var(--gold);font-size:0.8rem;">⭐</span>' : ''}
                    <span style="font-weight:600;font-size:0.9rem;">${escHtml(name)}</span>
                    ${dv ? `<span style="font-size:0.7rem;color:var(--text3);">DV ${dv}</span>` : ''}
                    ${usage > 0 ? `<span style="font-size:0.6rem;color:var(--text2);">cast ${usage}x</span>` : ''}
                </div>
                <div style="display:flex;gap:0.2rem;align-items:center;">
                    ${costDisplay ? `<span style="font-size:0.6rem;color:var(--text3);">${escHtml(costDisplay)}</span>` : ''}
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookUse('${escHtml(id)}')" title="Cast this spell" style="color:var(--gold);">🔮</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookToggleSignature('${escHtml(id)}')" title="${signature ? 'Remove signature' : 'Mark as signature'}" style="${signature ? 'color:var(--gold);' : 'color:var(--text3);'}">⭐</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookEdit('${escHtml(id)}')">✏️</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookDelete('${escHtml(id)}')" style="color:var(--red);">✕</button>
                </div>
            </div>
            ${description ? `<div style="font-size:0.8rem;color:var(--text2);margin-top:0.1rem;line-height:1.4;">${formatText(description)}</div>` : ''}
            ${tags.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:0.1rem;margin-top:0.1rem;">${tagBadges}</div>` : ''}
        </div>
    `;
}

// ============================================================
// SORTING
// ============================================================

function sortSpells(spells, sortBy) {
    const sorted = [...spells];
    switch (sortBy) {
        case 'name':
            sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
        case 'dv':
            sorted.sort((a, b) => (a.dv || 0) - (b.dv || 0));
            break;
        case 'recent':
            sorted.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            break;
        case 'usage':
            sorted.sort((a, b) => (b.usage || 0) - (a.usage || 0));
            break;
        default:
            sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return sorted;
}

// ============================================================
// CRUD OPERATIONS (Global functions for onclick)
// ============================================================

window.spellbookAddSpell = function() {
    const char = getCharacterData();
    if (!char) return;

    // Prompt for spell details
    const name = prompt('Spell name:');
    if (!name) return;
    const description = prompt('Description / Effect:') || '';
    const tagsInput = prompt('Tags (space-separated, e.g., FIRE STRIKE AREA):') || '';
    const tags = tagsInput.trim() ? tagsInput.split(/\s+/) : [];
    const dv = safeParseInt(prompt('DV (difficulty):') || '0', 0);
    const costObligation = safeParseInt(prompt('Obligation cost (if any):') || '0', 0);

    const newSpell = {
        id: generateId('spell_'),
        name: name.trim(),
        description: description.trim(),
        tags: tags.map(t => t.toUpperCase()),
        dv: dv,
        cost: {},
        signature: false,
        usage: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'custom'
    };

    if (costObligation > 0) {
        newSpell.cost.obligation = costObligation;
    }

    char.spellbook.push(newSpell);
    saveCharacter({ spellbook: char.spellbook });
    showToast(`Spell "${name}" added to spellbook.`, 'success');
    renderSpellbook(document.getElementById('spellbook-container'));
};

window.spellbookEdit = function(id) {
    const char = getCharacterData();
    if (!char) return;
    const spell = char.spellbook.find(s => s.id === id);
    if (!spell) return showToast('Spell not found.', 'error');

    const name = prompt('Spell name:', spell.name);
    if (name === null) return;
    const description = prompt('Description:', spell.description || '') || '';
    const tagsInput = prompt('Tags (space-separated):', (spell.tags || []).join(' ')) || '';
    const tags = tagsInput.trim() ? tagsInput.split(/\s+/) : [];
    const dv = safeParseInt(prompt('DV:', spell.dv || 0), 0);
    const costObligation = safeParseInt(prompt('Obligation cost:', spell.cost?.obligation || 0), 0);

    spell.name = name.trim();
    spell.description = description.trim();
    spell.tags = tags.map(t => t.toUpperCase());
    spell.dv = dv;
    if (costObligation > 0) {
        spell.cost = { obligation: costObligation };
    } else {
        delete spell.cost?.obligation;
        if (Object.keys(spell.cost).length === 0) delete spell.cost;
    }
    spell.updatedAt = Date.now();

    saveCharacter({ spellbook: char.spellbook });
    showToast('Spell updated.', 'success');
    renderSpellbook(document.getElementById('spellbook-container'));
};

window.spellbookDelete = function(id) {
    const char = getCharacterData();
    if (!char) return;
    const spell = char.spellbook.find(s => s.id === id);
    if (!spell) return;
    if (!confirm(`Delete spell "${spell.name}"?`)) return;
    char.spellbook = char.spellbook.filter(s => s.id !== id);
    saveCharacter({ spellbook: char.spellbook });
    showToast(`Deleted "${spell.name}"`, 'info');
    renderSpellbook(document.getElementById('spellbook-container'));
};

window.spellbookClearAll = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!char.spellbook || char.spellbook.length === 0) {
        showToast('Spellbook is already empty.', 'info');
        return;
    }
    if (!confirm('Delete ALL spells from your spellbook?')) return;
    char.spellbook = [];
    saveCharacter({ spellbook: char.spellbook });
    showToast('Spellbook cleared.', 'info');
    renderSpellbook(document.getElementById('spellbook-container'));
};

window.spellbookToggleSignature = function(id) {
    const char = getCharacterData();
    if (!char) return;
    const spell = char.spellbook.find(s => s.id === id);
    if (!spell) return;
    spell.signature = !spell.signature;
    spell.updatedAt = Date.now();
    saveCharacter({ spellbook: char.spellbook });
    showToast(spell.signature ? `⭐ "${spell.name}" is now signature.` : `"${spell.name}" is no longer signature.`, 'info');
    renderSpellbook(document.getElementById('spellbook-container'));
};

window.spellbookSort = function(by) {
    localStorage.setItem('fates-edge-spellbook-sort', by);
    const el = document.getElementById('spellbook-container');
    if (el) renderSpellbook(el);
};

// ============================================================
// USE SPELL – Roll and Apply Backlash
// ============================================================

window.spellbookUse = function(id) {
    const char = getCharacterData();
    if (!char) return;
    const spell = char.spellbook.find(s => s.id === id);
    if (!spell) return showToast('Spell not found.', 'error');

    // Determine dice pool: Wits + Arcana (or Spirit + Arcana if the player prefers)
    // We'll use Wits as default (precision) but allow choice
    const wits = char.wits || 1;
    const spirit = char.spirit || 1;
    const arcana = char.skills?.arcana || 0;
    const pool = wits + arcana; // could also be spirit

    const dv = spell.dv || 1;

    // Roll dice
    const successes = rollDice(pool);
    const ones = countOnes(pool); // we don't have individual dice, so simulate

    // Determine outcome
    let outcome, sbCount, backlashSeverity;
    if (successes >= dv && ones === 0) {
        outcome = 'Clean Success';
        sbCount = 0;
        backlashSeverity = 'None';
    } else if (successes >= dv && ones > 0) {
        outcome = 'Success with SB';
        sbCount = ones;
        backlashSeverity = 'Minor';
    } else if (successes > 0 && successes < dv) {
        outcome = 'Partial Success';
        sbCount = ones;
        backlashSeverity = 'Moderate';
    } else {
        outcome = 'Miss';
        sbCount = ones;
        backlashSeverity = 'Major';
    }

    // Update usage count
    spell.usage = (spell.usage || 0) + 1;
    spell.updatedAt = Date.now();
    saveCharacter({ spellbook: char.spellbook });

    // Build result message
    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div><strong>${escHtml(spell.name)}</strong> (DV ${dv})</div>
            <div>Pool: ${pool}d (Wits ${wits} + Arcana ${arcana})</div>
            <div>Rolled: ${successes} successes, ${ones} ones</div>
            <div><strong>Outcome:</strong> ${outcome}</div>
            ${backlashSeverity !== 'None' ? `<div style="color:var(--red);">Backlash: ${backlashSeverity}</div>` : '<div style="color:var(--green);">No backlash.</div>'}
            ${sbCount > 0 ? `<div style="color:var(--text3);">GM gains ${sbCount} Story Beat${sbCount > 1 ? 's' : ''}.</div>` : ''}
            <div style="font-size:0.8rem;color:var(--text2);">"The Weave's receipt is your teacher." – Lysandra</div>
        </div>
    `;

    // Show a modal with the result
    showToastWithHTML(msg, outcome === 'Clean Success' ? 'success' : outcome === 'Miss' ? 'error' : 'info');
};

// ============================================================
// IMPORT / EXPORT
// ============================================================

window.spellbookExport = function() {
    const char = getCharacterData();
    if (!char) return;
    const spells = char.spellbook || [];
    if (spells.length === 0) {
        showToast('No spells to export.', 'info');
        return;
    }
    const data = JSON.stringify(spells, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spellbook-${char.name || 'caster'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${spells.length} spells.`, 'success');
};

window.spellbookImport = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (!Array.isArray(imported)) {
                    showToast('Invalid spellbook data.', 'error');
                    return;
                }
                const char = getCharacterData();
                if (!char) return;
                if (!char.spellbook) char.spellbook = [];
                // Merge or replace? We'll append with new IDs to avoid collisions.
                let added = 0;
                imported.forEach(spell => {
                    // Basic validation
                    if (!spell.name) return;
                    // Generate new ID to avoid clashes
                    spell.id = generateId('spell_');
                    spell.source = 'imported';
                    spell.createdAt = Date.now();
                    spell.updatedAt = Date.now();
                    char.spellbook.push(spell);
                    added++;
                });
                saveCharacter({ spellbook: char.spellbook });
                showToast(`Imported ${added} spells.`, 'success');
                renderSpellbook(document.getElementById('spellbook-container'));
            } catch (err) {
                showToast('Failed to parse spellbook JSON.', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

// ============================================================
// DICE HELPERS (simulated)
// ============================================================

function rollDice(pool) {
    let successes = 0;
    for (let i = 0; i < pool; i++) {
        const roll = Math.floor(Math.random() * 10) + 1;
        if (roll >= 6) successes++;
        if (roll === 10) successes++; // 10s count twice
    }
    return successes;
}

function countOnes(pool) {
    let ones = 0;
    for (let i = 0; i < pool; i++) {
        if (Math.floor(Math.random() * 10) + 1 === 1) ones++;
    }
    return ones;
}

// ============================================================
// TOAST WITH HTML (custom)
// ============================================================

function showToastWithHTML(html, type = 'info') {
    // Use existing toast system if it supports HTML
    // Fallback: create a temporary modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.5rem; border-radius: var(--radius);
        max-width: 400px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;
    inner.innerHTML = html + `<br><button class="btn btn-sm btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);
    // Auto-close after 8 seconds
    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 8000);
}

// ============================================================
// EXPORT
// ============================================================

export default { renderSpellbook };