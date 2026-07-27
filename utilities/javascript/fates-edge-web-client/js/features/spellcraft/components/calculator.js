/**
 * TAGS Calculator – Spellcrafting Interface for Free Casters
 * 
 * "Before you shape the Weave, you must answer three questions."
 * – Lysandra of the Amber Gate
 * 
 * Features:
 * - Tag autocomplete from wiki.json (via fetch)
 * - Visual spell construction with tag badges
 * - DV calculation with breakdown
 * - Backlash risk assessment
 * - Save to spellbook
 * - Spell history
 * - Quick reference for all tags
 * - Roll test with core dice module
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { showToast } from '../../../components/Toast.js';
import { escHtml, generateId } from '../../../core/utils.js';
import { getState } from '../../../core/state.js';
import { performRoll } from '../../../core/dice.js';

// ============================================================
// STATE
// ============================================================

let tagDefinitions = null;
let spellHistory = [];
let activeTags = [];
let calculatorContainer = null;

// ============================================================
// WIKI LOADER
// ============================================================

async function loadWikiTags() {
    if (tagDefinitions) return tagDefinitions;
    
    try {
        const response = await fetch('./data/wiki.json');
        if (response.ok) {
            const data = await response.json();
            const tags = new Map();
            
            if (data.data && Array.isArray(data.data)) {
                for (const entry of data.data) {
                    if (entry.tags && entry.tags.includes('magic')) {
                        const tagName = entry.title?.toUpperCase();
                        if (tagName && entry.cost !== undefined) {
                            tags.set(tagName, {
                                name: tagName,
                                mod: entry.cost || 1,
                                category: entry.category || 'magic',
                                description: entry.body || ''
                            });
                        }
                    }
                }
            }
            
            if (tags.size > 0) {
                tagDefinitions = tags;
                return tagDefinitions;
            }
        }
    } catch (e) {
        console.warn('Could not load wiki.json, using hardcoded tags.');
    }
    
    tagDefinitions = buildTagDefinitions();
    return tagDefinitions;
}

function buildTagDefinitions() {
    const map = new Map();
    const raw = {
        'Burning': { mod: 1, category: 'Elemental', description: 'Ignite, heat, combustion, smoke' },
        'Freezing': { mod: 1, category: 'Elemental', description: 'Ice, slowing, brittle shatter, cold' },
        'Storm': { mod: 1, category: 'Elemental', description: 'Lightning, shock, arc, thunder' },
        'Stone': { mod: 1, category: 'Elemental', description: 'Walls, spikes, tremors, armor' },
        'Wave': { mod: 1, category: 'Elemental', description: 'Crushing water, currents, pressure' },
        'Wind': { mod: 1, category: 'Elemental', description: 'Levitation, gusts, deflection, push/pull' },
        'Force': { mod: 1, category: 'Force', description: 'Kinetic power, shields, blasts, telekinesis' },
        'Area': { mod: 1, category: 'Force', description: 'Cone, circle, corridor, zone effect' },
        'Strike': { mod: 1, category: 'Force', description: 'Single target precision' },
        'Wall': { mod: 1, category: 'Force', description: 'Barrier or blockade' },
        'Bind': { mod: 1, category: 'Force', description: 'Restrain, hold, suspend, entangle' },
        'Dispel': { mod: 1, category: 'Force', description: 'Suppress magic, unravel ongoing effects' },
        'Veil': { mod: 1, category: 'Mind/Illusion', description: 'Conceal, blur, illusion, silence' },
        'Scry': { mod: 1, category: 'Mind/Illusion', description: 'Reveal hidden, see distance, read traces' },
        'Memory': { mod: 1, category: 'Mind/Illusion', description: 'Erase, alter, restore memories' },
        'Command': { mod: 1, category: 'Mind/Illusion', description: 'Compel a short action (one word)' },
        'Fear': { mod: 1, category: 'Mind/Illusion', description: 'Panic, flee, break morale' },
        'HEAL': { mod: 1, category: 'Life/Body', description: 'Close wounds, restore flesh, reduce Harm 1' },
        'Purify': { mod: 1, category: 'Life/Body', description: 'Remove poison, corruption, disease' },
        'Strengthen': { mod: 1, category: 'Life/Body', description: 'Enhance body, armor, senses (temporary)' },
        'Waken': { mod: 1, category: 'Life/Body', description: 'Counter sleep, paralysis, stun' },
        'Beast': { mod: 1, category: 'Life/Body', description: 'Speak with or influence animals' },
        'Leap': { mod: 2, category: 'Space/Motion', description: 'Jump far, blink across short space (Near)' },
        'Fold': { mod: 2, category: 'Space/Motion', description: 'Short-range teleport, vanish-reappear (Far)' },
        'Gate': { mod: 2, category: 'Space/Motion', description: 'Long distance passage, open/close path' },
        'Gravity': { mod: 2, category: 'Space/Motion', description: 'Crush, lift, suspend, walk on walls/ceiling' },
        'Create': { mod: 2, category: 'Creation', description: 'Manifest mundane matter briefly (1 scene)' },
        'Summon': { mod: 2, category: 'Creation', description: 'Call a being or construct' },
        'Transmute': { mod: 2, category: 'Creation', description: 'Turn one thing into another (temporary)' },
        'Animate': { mod: 2, category: 'Creation', description: 'Make objects act with intent (1 scene)' },
        'Sense': { mod: 1, category: 'Utility', description: 'Detect presence of a named tag/element' },
        'Reveal': { mod: 1, category: 'Utility', description: 'Unveil hidden, glamoured, or invisible things' },
        'Light': { mod: 1, category: 'Utility', description: 'Create illumination (glow, torch-bright)' },
        'Shadow': { mod: 1, category: 'Utility', description: 'Deepen darkness, hide edges, obscure' },
        'Silence': { mod: 1, category: 'Utility', description: 'Suppress sound in zone or on target' },
        'Protect': { mod: 1, category: 'Utility', description: 'Reduce/deflect next harm (Armor 1)' },
        'Counter': { mod: 1, category: 'Reaction', description: 'Interrupt a casting/ritual in its window' },
        'Reflect': { mod: 2, category: 'Reaction', description: 'Turn next targeted effect back on its source' },
        'Store': { mod: 2, category: 'Utility', description: 'Bank 1-2 successes in a vessel (once)' },
        'Curse': { mod: 2, category: 'Affliction', description: 'Attach hostile tag/timer to target' },
        'Bless': { mod: 1, category: 'Affliction', description: 'Grant favourable tag (luck, favor, ward-key)' }
    };
    
    for (const [name, data] of Object.entries(raw)) {
        map.set(name, { ...data, name });
    }
    return map;
}

// ============================================================
// CATEGORY COLORS
// ============================================================

const CATEGORY_COLORS = {
    'Elemental': '#e67e22',
    'Force': '#e74c3c',
    'Mind/Illusion': '#8e44ad',
    'Life/Body': '#27ae60',
    'Space/Motion': '#2980b9',
    'Creation': '#f39c12',
    'Utility': '#7f8c8d',
    'Reaction': '#c0392b',
    'Affliction': '#d35400'
};

const CATEGORY_ICONS = {
    'Elemental': '🔥',
    'Force': '💥',
    'Mind/Illusion': '🧠',
    'Life/Body': '💚',
    'Space/Motion': '🌀',
    'Creation': '✨',
    'Utility': '🔧',
    'Reaction': '⚡',
    'Affliction': '💀'
};

// ============================================================
// MAIN RENDER
// ============================================================

async function renderCalculator(el) {
    calculatorContainer = el;
    const char = getCharacterData();
    if (!char || char.magicPath !== 'free-caster') {
        el.innerHTML = `
            <div style="text-align:center;padding:1rem;color:var(--text3);">
                <div style="font-size:2rem;">🔮</div>
                <p>Free Caster calculator is only available for Free Casters.</p>
                <p style="font-size:0.85rem;">Select a character with the Free Caster magic path.</p>
            </div>
        `;
        return;
    }

    // Load wiki tags
    await loadWikiTags();

    // Load spell history from character
    if (char.spellbook) {
        spellHistory = char.spellbook.filter(s => s.source === 'custom' || s.source === 'calculator' || s.source === 'tags-calculator');
    }

    el.innerHTML = `
        <div class="calculator-container" style="display:flex;flex-direction:column;gap:0.5rem;">
            <!-- Header -->
            <div class="calculator-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:1px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.2rem;">🔮</span>
                    <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">The Weave's Grammar</span>
                    <span style="font-size:0.7rem;color:var(--text3);">TAGS Calculator</span>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-secondary" onclick="window.calculatorClear()">✕ Clear</button>
                    <button class="btn btn-xs btn-secondary" onclick="window.calculatorRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- Spell Construction -->
            <div class="calculator-workspace" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <!-- Left: Input -->
                <div style="display:flex;flex-direction:column;gap:0.3rem;">
                    <div style="font-size:0.8rem;color:var(--text3);">"Name your tags. The Weave listens."</div>
                    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                        <div style="flex:1;min-width:150px;position:relative;">
                            <input type="text" id="tags-input" placeholder="Type a tag..." style="width:100%;font-size:0.9rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem 0.5rem;color:var(--text);" />
                            <div id="tag-suggestions" style="position:absolute;top:100%;left:0;right:0;background:var(--bg1);border:1px solid var(--border);border-radius:var(--radius);max-height:150px;overflow-y:auto;display:none;z-index:10;"></div>
                        </div>
                        <button class="btn btn-sm btn-primary" id="add-tag-btn">➕ Add Tag</button>
                    </div>
                    <div id="active-tags" style="display:flex;flex-wrap:wrap;gap:0.2rem;min-height:2rem;padding:0.2rem;background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border);">
                        <span style="font-size:0.7rem;color:var(--text3);">Click a tag to remove it.</span>
                    </div>
                </div>

                <!-- Right: Result -->
                <div id="calc-result" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;border:1px solid var(--border);min-height:100px;display:flex;flex-direction:column;justify-content:center;">
                    <div style="text-align:center;color:var(--text3);font-size:0.85rem;">
                        <div style="font-size:2rem;">✧</div>
                        <p>Add tags to weave your spell.</p>
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap;padding:0.2rem 0;">
                <button class="btn btn-sm btn-gold" id="save-spell-btn">💾 Save as Spell</button>
                <button class="btn btn-sm btn-secondary" id="roll-test-btn">🎲 Test Cast</button>
                <button class="btn btn-sm btn-secondary" id="clear-tags-btn">🧹 Clear Tags</button>
                <button class="btn btn-sm btn-ghost" onclick="window.calculatorShowHistory()">📜 History</button>
            </div>

            <!-- Tag Library -->
            <div class="calculator-library" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.8rem;font-weight:600;color:var(--gold);">📖 The Weave's Lexicon</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${tagDefinitions ? tagDefinitions.size : 0} tags</span>
                </div>
                <div id="tag-library" style="display:flex;flex-wrap:wrap;gap:0.2rem;max-height:100px;overflow-y:auto;">
                    ${tagDefinitions ? renderTagLibrary() : '<span style="font-size:0.7rem;color:var(--text3);">Loading tags...</span>'}
                </div>
            </div>

            <!-- Quick Reference -->
            <div class="calculator-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.2rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.4rem;">
                <div>📐 <strong>DV:</strong> 1 + tags + modifiers</div>
                <div>⚡ <strong>Dangerous:</strong> +2 DV</div>
                <div>💥 <strong>Backlash:</strong> DV 1-3: Low, 4-5: Medium, 6+: High</div>
                <div>📖 <strong>Tags:</strong> Intent + Grammar</div>
            </div>
        </div>
    `;

    // Attach events
    attachEvents(el);
}

// ============================================================
// TAG LIBRARY RENDER
// ============================================================

function renderTagLibrary() {
    if (!tagDefinitions) return '';
    
    const sorted = Array.from(tagDefinitions.keys()).sort();
    const groups = {};
    
    for (const tag of sorted) {
        const def = tagDefinitions.get(tag);
        const cat = def.category || 'Utility';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(tag);
    }
    
    let html = '';
    for (const [category, tags] of Object.entries(groups)) {
        const color = CATEGORY_COLORS[category] || 'var(--text3)';
        const icon = CATEGORY_ICONS[category] || '📌';
        html += `
            <div style="display:flex;align-items:center;gap:0.2rem;margin-right:0.5rem;">
                <span style="font-size:0.6rem;color:${color};">${icon}</span>
                <span style="font-size:0.55rem;color:${color};">${category}</span>
                <span style="display:flex;gap:0.1rem;flex-wrap:wrap;">
                    ${tags.map(t => `
                        <span class="tag-pill" style="font-size:0.55rem;padding:0.05rem 0.3rem;border-radius:8px;background:var(--bg3);border:1px solid ${color};color:${color};cursor:pointer;" onclick="window.calculatorAddTag('${t}')">${escHtml(t)}</span>
                    `).join('')}
                </span>
            </div>
        `;
    }
    return html;
}

// ============================================================
// EVENT ATTACHMENT
// ============================================================

function attachEvents(el) {
    const input = el.querySelector('#tags-input');
    const addBtn = el.querySelector('#add-tag-btn');
    const clearBtn = el.querySelector('#clear-tags-btn');
    const saveBtn = el.querySelector('#save-spell-btn');
    const rollBtn = el.querySelector('#roll-test-btn');
    const suggestions = el.querySelector('#tag-suggestions');

    // Add tag on Enter or button click
    const addTag = () => {
        if (!input) return;
        const value = input.value.trim().toUpperCase();
        if (!value) return;
        window.calculatorAddTag(value);
        input.value = '';
        input.focus();
        if (suggestions) suggestions.style.display = 'none';
    };

    if (addBtn) addBtn.addEventListener('click', addTag);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
            }
        });
        
        // Autocomplete
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim().toUpperCase();
            if (!query || !tagDefinitions) {
                if (suggestions) suggestions.style.display = 'none';
                return;
            }
            
            const matches = Array.from(tagDefinitions.keys())
                .filter(t => t.startsWith(query))
                .slice(0, 8);
            
            if (matches.length === 0) {
                if (suggestions) suggestions.style.display = 'none';
                return;
            }
            
            if (suggestions) {
                suggestions.style.display = 'block';
                suggestions.innerHTML = matches.map(m => `
                    <div class="suggestion-item" style="padding:0.2rem 0.5rem;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.8rem;color:var(--text);" onclick="window.calculatorAddTag('${m}'); document.getElementById('tags-input').value=''; document.getElementById('tag-suggestions').style.display='none';">
                        ${escHtml(m)}
                        ${tagDefinitions.get(m) ? `<span style="font-size:0.6rem;color:var(--text3);">(${tagDefinitions.get(m).category || 'magic'})</span>` : ''}
                    </div>
                `).join('');
            }
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => { if (suggestions) suggestions.style.display = 'none'; }, 200);
        });
    }

    if (clearBtn) clearBtn.addEventListener('click', window.calculatorClear);
    if (saveBtn) saveBtn.addEventListener('click', window.calculatorSaveSpell);
    if (rollBtn) rollBtn.addEventListener('click', window.calculatorTestCast);

    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
        if (suggestions && !suggestions.contains(e.target) && e.target !== input) {
            suggestions.style.display = 'none';
        }
    });
}

// ============================================================
// GLOBAL FUNCTIONS (onclick handlers)
// ============================================================

window.calculatorAddTag = function(tag) {
    const upper = tag.toUpperCase();
    if (!tagDefinitions || !tagDefinitions.has(upper)) {
        showToast(`Unknown tag: "${tag}"`, 'warning');
        return;
    }
    if (activeTags.includes(upper)) {
        showToast(`"${tag}" already added.`, 'info');
        return;
    }
    activeTags.push(upper);
    updateResult();
};

window.calculatorRemoveTag = function(tag) {
    activeTags = activeTags.filter(t => t !== tag);
    updateResult();
};

window.calculatorClear = function() {
    activeTags = [];
    updateResult();
    const input = document.getElementById('tags-input');
    if (input) input.value = '';
};

window.calculatorRefresh = function() {
    activeTags = [];
    if (calculatorContainer) renderCalculator(calculatorContainer);
    showToast('🔄 Calculator refreshed.', 'info');
};

window.calculatorSaveSpell = function() {
    if (activeTags.length === 0) {
        showToast('Add some tags first.', 'error');
        return;
    }

    const char = getCharacterData();
    if (!char) return;

    const name = prompt('Spell name:', activeTags.join(' '));
    if (!name) return;
    const description = prompt('Effect description:', '') || '';

    // Compute DV
    let dv = 1 + activeTags.length;
    let totalMod = 0;
    for (const tag of activeTags) {
        if (tagDefinitions && tagDefinitions.has(tag)) {
            totalMod += tagDefinitions.get(tag).mod || 1;
        }
    }
    dv += totalMod;

    const newSpell = {
        id: generateId('spell_'),
        name: name.trim(),
        description: description.trim(),
        tags: activeTags.slice(),
        dv: dv,
        cost: {},
        source: 'calculator',
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    if (!char.spellbook) char.spellbook = [];
    char.spellbook.push(newSpell);
    saveCharacter({ spellbook: char.spellbook });
    showToast(`✨ "${name}" saved to spellbook.`, 'success');
    
    // Add to history
    spellHistory.push(newSpell);
    activeTags = [];
    updateResult();
};

window.calculatorTestCast = function() {
    if (activeTags.length === 0) {
        showToast('Add some tags first.', 'error');
        return;
    }

    const char = getCharacterData();
    if (!char) return;

    // Compute DV
    let dv = 1 + activeTags.length;
    let totalMod = 0;
    for (const tag of activeTags) {
        if (tagDefinitions && tagDefinitions.has(tag)) {
            totalMod += tagDefinitions.get(tag).mod || 1;
        }
    }
    dv += totalMod;

    // Dice pool: Wits + Arcana
    const wits = char.wits || 1;
    const arcana = char.skills?.arcana || 0;
    const pool = wits + arcana;

    if (pool < 1) {
        showToast('Dice pool must be at least 1 die. Increase your Wits or Arcana.', 'error');
        return;
    }

    // Roll using core dice module
    const result = performRoll(pool, dv);

    // Determine outcome
    let outcomeLabel, backlashSeverity;
    if (result.successes >= dv && result.storyBeats === 0) {
        outcomeLabel = 'Clean Success';
        backlashSeverity = 'None';
    } else if (result.successes >= dv && result.storyBeats > 0) {
        outcomeLabel = 'Success with SB';
        backlashSeverity = 'Minor';
    } else if (result.successes > 0 && result.successes < dv) {
        outcomeLabel = 'Partial Success';
        backlashSeverity = 'Moderate';
    } else {
        outcomeLabel = 'Miss';
        backlashSeverity = 'Major';
    }

    let backlashDesc = '';
    if (backlashSeverity === 'Minor') {
        backlashDesc = 'Fatigue +1 or -1 die on next roll (GM choice).';
    } else if (backlashSeverity === 'Moderate') {
        backlashDesc = 'Harm 1 (stress) or a minor Condition.';
    } else if (backlashSeverity === 'Major') {
        backlashDesc = 'Harm 2, permanent Scar, or reality fracture (GM choice).';
    } else {
        backlashDesc = 'No backlash.';
    }

    const spellName = activeTags.join(' ');

    // Show result in a modal
    const html = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div><strong>${escHtml(spellName)}</strong> (DV ${dv})</div>
            <div>Pool: ${pool}d (Wits ${wits} + Arcana ${arcana})</div>
            <div>Roll: ${result.dice.join(', ')} → ${result.successes} successes</div>
            ${result.storyBeats > 0 ? `<div style="color:var(--text3);">${result.storyBeats} Story Beats generated</div>` : ''}
            <div><strong>Outcome:</strong> ${outcomeLabel}</div>
            ${backlashSeverity !== 'None' ? `<div style="color:var(--red);">⚡ Backlash: ${backlashSeverity} — ${backlashDesc}</div>` : '<div style="color:var(--green);">✅ No backlash.</div>'}
            ${result.criticalEffect ? `<div style="color:var(--gold);">✨ Critical: ${result.criticalEffect}</div>` : ''}
            <div style="font-size:0.8rem;color:var(--text2);">"The Weave's receipt is your teacher." – Lysandra</div>
        </div>
    `;

    showToastWithHTML(html, result.successes >= dv ? 'success' : 'warning');
};

window.calculatorShowHistory = function() {
    if (spellHistory.length === 0) {
        showToast('No spell history yet.', 'info');
        return;
    }
    
    const list = spellHistory.slice(-5).reverse().map(s =>
        `• ${s.name} (DV ${s.dv}) – ${s.tags.join(' ')}`
    ).join('\n');
    
    showToastWithHTML(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="font-weight:600;">📜 Recent Spells</div>
            <div style="font-size:0.85rem;color:var(--text2);max-height:200px;overflow-y:auto;">${escHtml(list)}</div>
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `, 'info');
};

// ============================================================
// UPDATE RESULT
// ============================================================

function updateResult() {
    const resultDiv = document.getElementById('calc-result');
    const tagsContainer = document.getElementById('active-tags');
    
    if (!resultDiv || !tagsContainer) return;

    // Update tags display
    if (activeTags.length === 0) {
        tagsContainer.innerHTML = `<span style="font-size:0.7rem;color:var(--text3);">Click a tag to remove it.</span>`;
    } else {
        tagsContainer.innerHTML = activeTags.map(tag => {
            const def = tagDefinitions ? tagDefinitions.get(tag) : null;
            const color = def ? CATEGORY_COLORS[def.category] || 'var(--gold)' : 'var(--gold)';
            return `
                <span class="tag-badge" style="display:inline-flex;align-items:center;gap:0.2rem;padding:0.1rem 0.4rem;border-radius:12px;background:${color}22;border:1px solid ${color};font-size:0.75rem;color:${color};cursor:pointer;" onclick="window.calculatorRemoveTag('${tag}')">
                    ${escHtml(tag)}
                    <span style="font-size:0.6rem;">✕</span>
                </span>
            `;
        }).join('');
    }

    // Compute results
    if (activeTags.length === 0) {
        resultDiv.innerHTML = `
            <div style="text-align:center;color:var(--text3);font-size:0.85rem;">
                <div style="font-size:2rem;">✧</div>
                <p>Add tags to weave your spell.</p>
            </div>
        `;
        return;
    }

    let dv = 1 + activeTags.length;
    let totalMod = 0;
    let breakdown = [];
    let unknownTags = [];

    for (const tag of activeTags) {
        if (tagDefinitions && tagDefinitions.has(tag)) {
            const def = tagDefinitions.get(tag);
            const mod = def.mod || 1;
            totalMod += mod;
            const danger = mod > 1 ? '⚡' : '';
            breakdown.push(`${tag}${danger} (${mod})`);
        } else {
            unknownTags.push(tag);
            breakdown.push(`${tag} (?)`);
        }
    }
    dv += totalMod;

    // Backlash risk
    let risk = 'Low';
    let riskColor = 'var(--green)';
    if (dv >= 6) { risk = 'High'; riskColor = 'var(--red)'; }
    else if (dv >= 4) { risk = 'Medium'; riskColor = 'var(--orange)'; }

    // Build spell preview
    const spellName = activeTags.join(' ');

    resultDiv.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0.2rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;font-size:0.95rem;color:var(--gold);">${escHtml(spellName)}</span>
                <span style="font-size:0.8rem;color:var(--text3);">DV ${dv}</span>
            </div>
            <div style="font-size:0.7rem;color:var(--text3);">
                ${breakdown.join(' + ')}
                ${unknownTags.length ? `<span style="color:var(--red);"> ⚠️ Unknown: ${unknownTags.join(', ')}</span>` : ''}
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;font-size:0.75rem;">
                <span>Tags: ${activeTags.length}</span>
                <span>Modifiers: +${totalMod}</span>
                <span style="color:${riskColor};">Risk: ${risk}</span>
            </div>
            ${risk === 'High' ? `<div style="font-size:0.7rem;color:var(--red);">⚠️ High risk of catastrophic backlash!</div>` : ''}
            <div style="font-size:0.65rem;color:var(--text3);font-style:italic;margin-top:0.1rem;">
                "The Weave's receipt is your teacher." – Lysandra
            </div>
        </div>
    `;
}

// ============================================================
// TOAST WITH HTML
// ============================================================

function showToastWithHTML(html, type = 'info') {
    // Use the same helper from spellbook if available, or fallback
    if (typeof window.spellbookShowToastWithHTML === 'function') {
        window.spellbookShowToastWithHTML(html, type);
        return;
    }

    // Fallback implementation
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.5rem; border-radius: var(--radius);
        max-width: 450px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 80vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.textContent = `
            @keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 10000);
}

// ============================================================
// EXPORT
// ============================================================

export { renderCalculator, loadWikiTags }; 