/**
 * Character roller - Quick rolls for characters
 * Now with region-aware naming for characters and NPCs
 * Integrates with decks module for region data
 */

import { getCharacter, addRoll, saveState, getState } from '../../core/state.js';
import { performRoll } from '../../core/dice.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_DV = 3;
const DEFAULT_POSITION = 'controlled';
const DEFAULT_BOONS = 0;
const MAX_ROLL_RESULTS = 100;

// Fallback region names if decks module isn't available
const FALLBACK_REGIONS = [
    'Acasia', 'Ecktoria', 'Vhasia', 'Viterra', 'Ykrul', 
    'Silkstrand', 'Mistlands', 'The Pyrgos', 'Ubral', 
    'Valewood', 'Aelinnel', 'Aelaerem', 'Zakov'
];

// Region-specific name suffixes and prefixes for character generation
const REGION_NAME_STYLES = {
    'acasia': { 
        prefixes: ['Al', 'Ar', 'Bel', 'Cal', 'Dal', 'El', 'Gal', 'Hal', 'Ith', 'Kal', 'Lor', 'Mer', 'Nor', 'Or', 'Pal', 'Quin', 'Ral', 'Sel', 'Thal', 'Val'],
        suffixes: ['ain', 'an', 'ar', 'as', 'el', 'en', 'er', 'eth', 'ian', 'iel', 'is', 'ith', 'on', 'or', 'os', 'us', 'yn', 'ys']
    },
    'ecktoria': {
        prefixes: ['Ae', 'Ca', 'Ce', 'Ci', 'Co', 'Cu', 'De', 'Di', 'Do', 'Ec', 'Ed', 'Fa', 'Fe', 'Fi', 'Fo', 'Ga', 'Ge', 'Gi', 'Go', 'Ha'],
        suffixes: ['ia', 'ius', 'ix', 'on', 'or', 'um', 'us', 'yn']
    },
    'vhasia': {
        prefixes: ['An', 'Ar', 'Da', 'Eo', 'Er', 'Es', 'Eth', 'Ev', 'Fa', 'Fi', 'Ga', 'Ge', 'Gi', 'Go', 'Gra', 'Ha', 'He', 'Ho', 'Hy', 'Ia'],
        suffixes: ['el', 'en', 'es', 'eth', 'ian', 'iel', 'il', 'is', 'ith', 'ix', 'on', 'or', 'os', 'us', 'yn']
    },
    'viterra': {
        prefixes: ['Al', 'An', 'Ar', 'Ber', 'Car', 'Cor', 'Dar', 'Der', 'El', 'Er', 'Far', 'Fer', 'Gar', 'Ger', 'Har', 'Her', 'Kar', 'Ker', 'Lar', 'Ler'],
        suffixes: ['ain', 'an', 'en', 'er', 'es', 'eth', 'ian', 'iel', 'is', 'ith', 'on', 'or', 'os', 'us', 'yn']
    },
    'ykrul': {
        prefixes: ['Ba', 'Bo', 'Bu', 'Da', 'Do', 'Du', 'Ga', 'Go', 'Gu', 'Ha', 'Ho', 'Hu', 'Ka', 'Ko', 'Ku', 'Ma', 'Mo', 'Mu', 'Na', 'No'],
        suffixes: ['ak', 'al', 'an', 'ar', 'ek', 'el', 'en', 'er', 'ik', 'il', 'in', 'ir', 'ok', 'ol', 'on', 'or', 'uk', 'ul', 'un', 'ur']
    },
    'silkstrand': {
        prefixes: ['Ai', 'Ay', 'Ca', 'Ce', 'Ci', 'Da', 'De', 'Di', 'Ea', 'Ei', 'Fa', 'Fi', 'Ga', 'Ge', 'Gi', 'Ha', 'He', 'Hi', 'Ia', 'Ka'],
        suffixes: ['a', 'e', 'i', 'o', 'u', 'ae', 'ai', 'ea', 'ei', 'ia', 'ie', 'oe', 'ua', 'ue', 'ui']
    },
    'mistlands': {
        prefixes: ['Ao', 'Bra', 'Bro', 'Dro', 'Eo', 'Era', 'Eri', 'Fen', 'Fro', 'Gao', 'Gra', 'Gri', 'Hra', 'Hro', 'Iro', 'Iva', 'Kra', 'Kro', 'Lor', 'Lra'],
        suffixes: ['d', 'el', 'en', 'er', 'eth', 'ian', 'iel', 'is', 'ith', 'on', 'or', 'os', 'us', 'yn']
    },
    'thepyrgos': {
        prefixes: ['An', 'Ar', 'Ath', 'Cos', 'Cri', 'Dem', 'Di', 'Dio', 'Ere', 'Eri', 'Gan', 'Geo', 'Hep', 'Her', 'Ion', 'Kos', 'Ly', 'Mys', 'Nep', 'Pyr'],
        suffixes: ['eon', 'es', 'ian', 'iel', 'is', 'ith', 'on', 'or', 'os', 'us', 'yn']
    },
    'ubral': {
        prefixes: ['Ae', 'An', 'Ar', 'As', 'Aur', 'Eo', 'Er', 'Es', 'Gra', 'Gri', 'Hae', 'Hal', 'Har', 'Hau', 'Io', 'Ion', 'Ir', 'Is', 'Kau', 'Kri'],
        suffixes: ['ael', 'al', 'an', 'ar', 'el', 'en', 'er', 'eth', 'ian', 'iel', 'is', 'ith', 'on', 'or', 'os', 'us', 'yn']
    },
    'valewood': {
        prefixes: ['Al', 'An', 'Ar', 'Bal', 'Bel', 'Bry', 'Cal', 'Cam', 'Dar', 'Ed', 'El', 'Em', 'Ery', 'Fen', 'Gael', 'Glen', 'Haf', 'Hal', 'Hed', 'Hel'],
        suffixes: ['an', 'ar', 'el', 'en', 'er', 'eth', 'ian', 'iel', 'is', 'ith', 'on', 'or', 'os', 'us', 'yn', 'ys']
    },
    'aelinnel': {
        prefixes: ['Ae', 'Aer', 'Al', 'An', 'Ar', 'Eo', 'Er', 'Es', 'Ev', 'Fa', 'Fe', 'Fi', 'Fo', 'Ge', 'Gi', 'Go', 'Ha', 'He', 'Hi', 'Ho'],
        suffixes: ['ael', 'ain', 'an', 'ar', 'el', 'en', 'er', 'eth', 'ian', 'iel', 'is', 'ith', 'on', 'or', 'os', 'us', 'yn']
    },
    'aelaerem': {
        prefixes: ['Ae', 'Aer', 'Al', 'An', 'Ar', 'Aur', 'Eo', 'Er', 'Es', 'Ev', 'Fa', 'Fe', 'Fi', 'Fo', 'Ge', 'Gi', 'Go', 'Ha', 'He', 'Hi'],
        suffixes: ['ael', 'ain', 'an', 'ar', 'el', 'en', 'er', 'eth', 'ian', 'iel', 'is', 'ith', 'on', 'or', 'os', 'us', 'yn']
    },
    'zakov': {
        prefixes: ['Al', 'An', 'Ar', 'As', 'Av', 'Az', 'Bel', 'Ber', 'Ce', 'Cor', 'Dal', 'Dar', 'Eo', 'Er', 'Es', 'Ev', 'Ez', 'Fer', 'Ga', 'Gar'],
        suffixes: ['ain', 'an', 'ar', 'el', 'en', 'er', 'eth', 'ian', 'iel', 'is', 'ith', 'on', 'or', 'os', 'us', 'yn']
    }
};

// ============================================================
// STATE
// ============================================================

let container = null;
let selectedRegion = null;
let regionNames = [];
let isReady = false;

// Keyboard shortcut handler reference for cleanup
let keyboardShortcutHandler = null;

// ============================================================
// REGION MANAGEMENT
// ============================================================

/**
 * Load region data from the decks module
 */
async function loadRegions() {
    try {
        const decksModule = await import('../decks/index.js');
        if (decksModule.getRegionNames && decksModule.getSelectedRegion) {
            const names = decksModule.getRegionNames();
            if (names && names.length > 0) {
                regionNames = names;
                selectedRegion = decksModule.getSelectedRegion() || names[0];
                console.log('[CharacterRoller] Loaded regions from decks module:', regionNames);
                return true;
            }
        }
    } catch (e) {
        console.warn('[CharacterRoller] Could not load decks module:', e);
    }
    
    // Fallback: use hardcoded list
    regionNames = FALLBACK_REGIONS;
    selectedRegion = regionNames[0];
    console.log('[CharacterRoller] Using fallback regions:', regionNames);
    return true;
}

/**
 * Get a random region name
 */
function getRandomRegion() {
    if (regionNames.length === 0) return 'Acasia';
    return regionNames[Math.floor(Math.random() * regionNames.length)];
}

/**
 * Generate a region-appropriate name
 */
function generateRegionName(region = null) {
    const regionKey = (region || selectedRegion || getRandomRegion()).toLowerCase();
    const style = REGION_NAME_STYLES[regionKey] || REGION_NAME_STYLES['acasia'];
    
    const prefix = style.prefixes[Math.floor(Math.random() * style.prefixes.length)];
    const suffix = style.suffixes[Math.floor(Math.random() * style.suffixes.length)];
    
    return prefix + suffix;
}

/**
 * Get a list of generated names for a region
 */
function generateRegionNames(count = 10, region = null) {
    const names = [];
    const used = new Set();
    let attempts = 0;
    const maxAttempts = count * 3;
    
    while (names.length < count && attempts < maxAttempts) {
        attempts++;
        const name = generateRegionName(region);
        if (!used.has(name)) {
            used.add(name);
            names.push(name);
        }
    }
    
    // If we couldn't generate enough unique names, add generic ones
    while (names.length < count) {
        names.push(`Character_${names.length + 1}`);
    }
    
    return names;
}

// ============================================================
// CHARACTER ROLLS
// ============================================================

/**
 * Roll for a character in the VTT
 * @param {string} id - Character ID
 * @param {Object} options - Roll options
 * @param {number} options.dv - Difficulty value (default: 3)
 * @param {string} options.position - Position (dominant/controlled/desperate)
 * @param {number} options.boons - Number of boons (default: 0)
 * @param {string} options.note - Optional note for the roll
 * @param {boolean} options.silent - If true, don't show toast (default: false)
 * @param {string} options.skillOverride - Force a specific skill
 * @param {string} options.attrOverride - Force a specific attribute
 * @returns {Object|null} The roll result or null if failed
 */
export function rollForCharacter(id, options = {}) {
    const c = getCharacter(id);
    if (!c) {
        showToast('Character not found.', 'error');
        return null;
    }
    
    const {
        dv = DEFAULT_DV,
        position = DEFAULT_POSITION,
        boons = DEFAULT_BOONS,
        note = '',
        silent = false,
        skillOverride = null,
        attrOverride = null
    } = options;
    
    // Determine attribute and skill
    let attr, skill;
    
    if (attrOverride && skillOverride) {
        // Use overrides if provided
        attr = Math.max(1, Math.min(5, attrOverride));
        skill = Math.max(0, Math.min(5, skillOverride));
    } else {
        // Auto-detect based on combat skills
        const skills = c.skills || {};
        const combat = Math.max(
            skills.melee || 0,
            skills.ranged || 0,
            skills.brawl || 0
        );
        
        if (combat > 0) {
            attr = c.body || 3;
            skill = combat;
        } else {
            attr = c.wits || 2;
            skill = skills.stealth || 0;
        }
    }
    
    // Perform the roll
    try {
        const result = performRoll(attr, skill, dv, position, boons);
        if (!result) {
            if (!silent) showToast('Roll failed: pool must be at least 1 die.', 'error');
            return null;
        }
        
        // Add metadata
        result.characterId = id;
        result.characterName = c.name;
        result.note = note || `${c.name} roll`;
        result.timestamp = Date.now();
        
        // Store in history
        addRoll(result);
        saveState();
        
        // Build chat message
        const msg = buildRollMessage(c.name, result, attr, skill, dv, position);
        
        // Send to VTT chat
        if (!silent) {
            sendToVTT(msg, result);
            showToast(`${c.name} rolled ${result.outcome}`, 'info');
        }
        
        return result;
    } catch (error) {
        console.error('[CharacterRoller] Error rolling for character:', error);
        if (!silent) showToast('Error performing roll.', 'error');
        return null;
    }
}

// ============================================================
// NPC ROLLS
// ============================================================

/**
 * Roll for an NPC
 * @param {Object} npc - NPC object
 * @param {Object} options - Roll options (same as rollForCharacter)
 * @returns {Object|null} The roll result or null if failed
 */
export function rollForNPC(npc, options = {}) {
    if (!npc || !npc.name) {
        showToast('Invalid NPC data.', 'error');
        return null;
    }
    
    const {
        dv = DEFAULT_DV,
        position = DEFAULT_POSITION,
        boons = DEFAULT_BOONS,
        note = '',
        silent = false,
        skillOverride = null,
        attrOverride = null
    } = options;
    
    let attr, skill;
    
    if (attrOverride && skillOverride) {
        attr = Math.max(1, Math.min(5, attrOverride));
        skill = Math.max(0, Math.min(5, skillOverride));
    } else {
        const skills = npc.skills || {};
        const combat = Math.max(
            skills.melee || 0,
            skills.ranged || 0,
            skills.brawl || 0
        );
        
        if (combat > 0) {
            attr = npc.body || 3;
            skill = combat;
        } else {
            attr = npc.wits || 2;
            skill = skills.stealth || 0;
        }
    }
    
    try {
        const result = performRoll(attr, skill, dv, position, boons);
        if (!result) return null;
        
        result.npcName = npc.name;
        result.note = note || `NPC ${npc.name} roll`;
        result.timestamp = Date.now();
        
        const msg = buildRollMessage(`NPC ${npc.name}`, result, attr, skill, dv, position);
        
        if (!silent) {
            sendToVTT(msg, result);
        }
        
        return result;
    } catch (error) {
        console.error('[CharacterRoller] Error rolling for NPC:', error);
        return null;
    }
}

// ============================================================
// CUSTOM ROLLS
// ============================================================

/**
 * Roll with custom parameters (no character needed)
 * @param {Object} config - Roll configuration
 * @param {number} config.attr - Attribute value (1-5)
 * @param {number} config.skill - Skill value (0-5)
 * @param {number} config.dv - Difficulty value
 * @param {string} config.position - Position (dominant/controlled/desperate)
 * @param {number} config.boons - Number of boons
 * @param {string} config.note - Roll note
 * @param {boolean} config.silent - If true, don't show toast
 * @returns {Object|null} The roll result or null if failed
 */
export function customRoll(config = {}) {
    const {
        attr = 3,
        skill = 0,
        dv = DEFAULT_DV,
        position = DEFAULT_POSITION,
        boons = DEFAULT_BOONS,
        note = 'Custom roll',
        silent = false
    } = config;
    
    // Validate
    if (attr < 1 || attr > 5) {
        if (!silent) showToast('Attribute must be between 1 and 5.', 'error');
        return null;
    }
    
    if (skill < 0 || skill > 5) {
        if (!silent) showToast('Skill must be between 0 and 5.', 'error');
        return null;
    }
    
    if (boons < 0 || boons > 5) {
        if (!silent) showToast('Boons must be between 0 and 5.', 'error');
        return null;
    }
    
    try {
        const result = performRoll(attr, skill, dv, position, boons);
        if (!result) {
            if (!silent) showToast('Roll failed: pool must be at least 1 die.', 'error');
            return null;
        }
        
        result.note = note;
        result.timestamp = Date.now();
        result.isCustom = true;
        
        // Store in history
        addRoll(result);
        saveState();
        
        const msg = buildRollMessage('Custom', result, attr, skill, dv, position);
        
        if (!silent) {
            sendToVTT(msg, result);
            showToast(`Roll: ${result.outcome}`, 'info');
        }
        
        return result;
    } catch (error) {
        console.error('[CharacterRoller] Error performing custom roll:', error);
        if (!silent) showToast('Error performing roll.', 'error');
        return null;
    }
}

// ============================================================
// BATCH ROLLS
// ============================================================

/**
 * Roll for multiple characters at once
 * @param {string[]} ids - Array of character IDs
 * @param {Object} options - Roll options (same as rollForCharacter)
 * @returns {Object[]} Array of roll results
 */
export function rollForCharacters(ids, options = {}) {
    if (!Array.isArray(ids) || ids.length === 0) {
        showToast('No characters selected.', 'error');
        return [];
    }
    
    const results = [];
    for (const id of ids) {
        const result = rollForCharacter(id, { ...options, silent: true });
        if (result) results.push(result);
    }
    
    if (results.length > 0) {
        const summary = `Rolled for ${results.length} character${results.length > 1 ? 's' : ''}`;
        showToast(summary, 'info');
    }
    
    return results;
}

// ============================================================
// REGION-AWARE RENDER
// ============================================================

export async function renderRollerUI(el) {
    container = el;
    await loadRegions();
    isReady = true;
    
    container.innerHTML = `
        <div class="roller-container">
            <div class="panel">
                <h3 style="margin-top:0;">🎲 Quick Roll</h3>
                <div style="display:flex;flex-wrap:wrap;gap:0.8rem;align-items:end;">
                    <div class="field" style="flex:1;min-width:120px;">
                        <label>Region</label>
                        <select id="roller-region-select">
                            ${regionNames.map(name => 
                                `<option value="${name}" ${name === selectedRegion ? 'selected' : ''}>${name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="field" style="flex:1;min-width:100px;">
                        <label>Attribute (1-5)</label>
                        <input type="number" id="roller-attr" value="3" min="1" max="5" />
                    </div>
                    <div class="field" style="flex:1;min-width:100px;">
                        <label>Skill (0-5)</label>
                        <input type="number" id="roller-skill" value="0" min="0" max="5" />
                    </div>
                    <div class="field" style="flex:1;min-width:100px;">
                        <label>DV</label>
                        <input type="number" id="roller-dv" value="3" min="0" max="10" />
                    </div>
                    <div class="field" style="flex:0 0 140px;">
                        <label>Position</label>
                        <select id="roller-position">
                            <option value="dominant">Dominant</option>
                            <option value="controlled" selected>Controlled</option>
                            <option value="desperate">Desperate</option>
                        </select>
                    </div>
                    <div class="field" style="flex:0 0 100px;">
                        <label>Boons</label>
                        <input type="number" id="roller-boons" value="0" min="0" max="5" />
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;margin-top:0.8rem;flex-wrap:wrap;">
                    <button class="btn btn-gold" id="roller-roll-btn">🎲 Roll</button>
                    <button class="btn btn-secondary" id="roller-generate-npc-btn">👤 Generate NPC Name</button>
                    <button class="btn btn-secondary" id="roller-generate-names-btn">📋 Generate Names</button>
                </div>
            </div>
            
            <div class="panel" id="roller-result-panel" style="display:none;">
                <h3 id="roller-result-title">Roll Result</h3>
                <div id="roller-result-content"></div>
            </div>
            
            <div class="panel" id="roller-name-panel" style="display:none;">
                <h3>📋 Region Names (${selectedRegion || 'Acasia'})</h3>
                <div id="roller-name-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.3rem;max-height:200px;overflow-y:auto;"></div>
            </div>
        </div>
    `;
    
    attachRollerEvents();
}

// ============================================================
// ROLLER EVENTS
// ============================================================

function attachRollerEvents() {
    // Region selector change
    const regionSelect = document.getElementById('roller-region-select');
    if (regionSelect) {
        regionSelect.addEventListener('change', () => {
            selectedRegion = regionSelect.value;
            // Update decks module if available
            import('../decks/index.js').then(module => {
                if (module.setSelectedRegion) {
                    module.setSelectedRegion(selectedRegion);
                }
            }).catch(() => {});
        });
    }
    
    // Roll button
    const rollBtn = document.getElementById('roller-roll-btn');
    if (rollBtn) {
        rollBtn.addEventListener('click', handleRollerRoll);
    }
    
    // Generate NPC name
    const genNpcBtn = document.getElementById('roller-generate-npc-btn');
    if (genNpcBtn) {
        genNpcBtn.addEventListener('click', handleGenerateNPC);
    }
    
    // Generate names list
    const genNamesBtn = document.getElementById('roller-generate-names-btn');
    if (genNamesBtn) {
        genNamesBtn.addEventListener('click', handleGenerateNames);
    }
}

function handleRollerRoll() {
    const attr = parseInt(document.getElementById('roller-attr')?.value || '3', 10);
    const skill = parseInt(document.getElementById('roller-skill')?.value || '0', 10);
    const dv = parseInt(document.getElementById('roller-dv')?.value || '3', 10);
    const position = document.getElementById('roller-position')?.value || 'controlled';
    const boons = parseInt(document.getElementById('roller-boons')?.value || '0', 10);
    
    const note = `Quick roll (${selectedRegion || 'Acasia'})`;
    
    const result = customRoll({ attr, skill, dv, position, boons, note, silent: false });
    
    if (result) {
        displayRollResult(result);
    }
}

function handleGenerateNPC() {
    const region = selectedRegion || getRandomRegion();
    const name = generateRegionName(region);
    showToast(`👤 Generated NPC: ${name} (${region})`, 'success');
    
    // Display in result panel
    const panel = document.getElementById('roller-result-panel');
    const content = document.getElementById('roller-result-content');
    const title = document.getElementById('roller-result-title');
    
    if (panel && content && title) {
        panel.style.display = 'block';
        title.textContent = '👤 Generated NPC';
        content.innerHTML = `
            <div style="background:var(--bg3);padding:0.8rem 1rem;border-radius:var(--radius);border-left:4px solid var(--gold);">
                <div style="font-size:1.4rem;font-weight:600;color:var(--gold);">${escHtml(name)}</div>
                <div style="color:var(--text2);font-size:0.9rem;">Region: ${escHtml(region)}</div>
                <div style="color:var(--text3);font-size:0.8rem;margin-top:0.3rem;">Click "Generate Names" to see more options.</div>
            </div>
        `;
    }
}

function handleGenerateNames() {
    const region = selectedRegion || getRandomRegion();
    const names = generateRegionNames(16, region);
    
    const panel = document.getElementById('roller-name-panel');
    const list = document.getElementById('roller-name-list');
    
    if (panel && list) {
        panel.style.display = 'block';
        list.innerHTML = names.map(name => `
            <div style="background:var(--bg2);padding:0.3rem 0.6rem;border-radius:4px;font-size:0.9rem;text-align:center;border:1px solid var(--border);">
                ${escHtml(name)}
            </div>
        `).join('');
        
        // Update panel title
        const title = panel.querySelector('h3');
        if (title) {
            title.textContent = `📋 Region Names (${region})`;
        }
    }
}

function displayRollResult(result) {
    const panel = document.getElementById('roller-result-panel');
    const content = document.getElementById('roller-result-content');
    const title = document.getElementById('roller-result-title');
    
    if (!panel || !content || !title) return;
    
    panel.style.display = 'block';
    title.textContent = '🎲 Roll Result';
    
    const outcomeEmoji = {
        'critical': '💥',
        'success': '✅',
        'partial': '⚠️',
        'failure': '❌',
        'desperate': '🔥'
    }[result.outcome] || '🎲';
    
    content.innerHTML = `
        <div style="background:var(--bg3);padding:0.8rem 1rem;border-radius:var(--radius);border-left:4px solid var(--gold);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                <div>
                    <span style="font-size:1.2rem;">${outcomeEmoji}</span>
                    <strong style="font-size:1.1rem;color:var(--gold);">${result.outcome.toUpperCase()}</strong>
                </div>
                <div style="font-size:0.9rem;color:var(--text2);">
                    ${result.dice ? result.dice.join(' ') : ''}
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:0.3rem;margin-top:0.5rem;font-size:0.85rem;">
                <div><span class="text-muted">Successes:</span> ${result.successes || 0}</div>
                <div><span class="text-muted">Story Beats:</span> ${result.storyBeats || 0}</div>
                ${result.reRolls ? `<div><span class="text-muted">Re-rolls:</span> ${result.reRolls}</div>` : ''}
                ${result.note ? `<div style="grid-column:1/-1;"><span class="text-muted">Note:</span> ${escHtml(result.note)}</div>` : ''}
            </div>
        </div>
    `;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build a chat message from roll results
 */
function buildRollMessage(name, result, attr, skill, dv, position) {
    const diceStr = result.dice ? result.dice.join(' ') : '[]';
    let msg = `[${result.outcome}] ${name}: ${attr}+${skill} vs DV${dv} (${position}) → `;
    msg += diceStr;
    msg += ` | S:${result.successes || 0} SB:${result.storyBeats || 0}`;
    
    if (result.reRolls > 0) {
        msg += ` | Re-rolls: ${result.reRolledDice?.map(r => `${r.old}→${r.new}`).join(', ') || result.reRolls}`;
    }
    
    if (result.note) {
        msg += ` — ${result.note}`;
    }
    
    return msg;
}

/**
 * Send a roll result to the VTT chat
 */
function sendToVTT(message, result) {
    // Try to get the VTT module
    import('../vtt/index.js')
        .then(module => {
            // Try different ways the VTT module might expose chat functionality
            if (module.addChatMessage && typeof module.addChatMessage === 'function') {
                module.addChatMessage({ 
                    text: message, 
                    sender: 'Roll',
                    rollData: {
                        outcome: result.outcome,
                        outcomeClass: result.outcomeClass,
                        resultText: result.resultText,
                        dice: result.dice,
                        successes: result.successes,
                        storyBeats: result.storyBeats || 0,
                        reRolls: result.reRolls || 0
                    }
                });
            } else if (module.sendMessage && typeof module.sendMessage === 'function') {
                // Some VTT modules export sendMessage directly
                module.sendMessage(message, 'Roll', 'all', {
                    rollData: {
                        outcome: result.outcome,
                        outcomeClass: result.outcomeClass,
                        resultText: result.resultText,
                        dice: result.dice,
                        successes: result.successes,
                        storyBeats: result.storyBeats || 0,
                        reRolls: result.reRolls || 0
                    }
                });
            } else if (module.default && typeof module.default.sendMessage === 'function') {
                // Try default export
                module.default.sendMessage(message, 'Roll', 'all', {
                    rollData: {
                        outcome: result.outcome,
                        outcomeClass: result.outcomeClass,
                        resultText: result.resultText,
                        dice: result.dice,
                        successes: result.successes,
                        storyBeats: result.storyBeats || 0,
                        reRolls: result.reRolls || 0
                    }
                });
            } else {
                console.warn('[CharacterRoller] VTT module loaded but no sendMessage or addChatMessage found');
            }
        })
        .catch(err => {
            // VTT module not available - that's fine, rolls are still stored locally
            console.debug('[CharacterRoller] VTT module not available:', err.message);
        });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get roll history for a character
 * @param {string} id - Character ID
 * @param {number} limit - Max number of results to return
 * @returns {Object[]} Array of roll results
 */
export function getCharacterRollHistory(id, limit = 10) {
    const state = getState();
    const history = state.diceHistory || [];
    return history
        .filter(r => r.characterId === id)
        .slice(0, limit);
}

/**
 * Get recent rolls
 * @param {number} limit - Max number of results to return
 * @returns {Object[]} Array of roll results
 */
export function getRecentRolls(limit = 20) {
    const state = getState();
    return (state.diceHistory || [])
        .slice(0, limit);
}

/**
 * Clear roll history
 * @param {string} id - Optional character ID to clear only for that character
 */
export function clearRollHistory(id = null) {
    const state = getState();
    if (id) {
        state.diceHistory = (state.diceHistory || [])
            .filter(r => r.characterId !== id);
    } else {
        state.diceHistory = [];
    }
    saveState();
    showToast(`Roll history ${id ? 'for character' : ''} cleared.`, 'success');
}

/**
 * Export roll history as CSV
 * @param {string} id - Optional character ID to export only for that character
 * @returns {string} CSV data
 */
export function exportRollHistory(id = null) {
    const state = getState();
    let history = state.diceHistory || [];
    
    if (id) {
        history = history.filter(r => r.characterId === id);
    }
    
    if (history.length === 0) {
        showToast('No roll history to export.', 'warning');
        return null;
    }
    
    const headers = ['Timestamp', 'Character', 'Outcome', 'Dice', 'Successes', 'Story Beats', 'Note'];
    const rows = history.map(r => [
        new Date(r.timestamp || Date.now()).toLocaleString(),
        r.characterName || r.npcName || 'Unknown',
        r.outcome || 'Unknown',
        (r.dice || []).join(' '),
        r.successes || 0,
        r.storyBeats || 0,
        r.note || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return csv;
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

/**
 * Setup keyboard shortcuts for quick rolls
 */
export function setupKeyboardShortcuts() {
    // Remove existing handler if any
    if (keyboardShortcutHandler) {
        document.removeEventListener('keydown', keyboardShortcutHandler);
        keyboardShortcutHandler = null;
    }
    
    keyboardShortcutHandler = (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            const state = getState();
            const activeChar = state.characters?.find(c => c.active !== false);
            if (activeChar) {
                rollForCharacter(activeChar.id, { note: 'Quick roll' });
            } else if (state.characters && state.characters.length > 0) {
                // If no active character, use the first one
                rollForCharacter(state.characters[0].id, { note: 'Quick roll' });
            } else {
                showToast('No characters available for quick roll.', 'warning');
            }
        }
    };
    
    document.addEventListener('keydown', keyboardShortcutHandler);
}

/**
 * Clean up keyboard shortcuts
 */
export function cleanupKeyboardShortcuts() {
    if (keyboardShortcutHandler) {
        document.removeEventListener('keydown', keyboardShortcutHandler);
        keyboardShortcutHandler = null;
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

// Auto-setup when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadRegions();
        setupKeyboardShortcuts();
    });
} else {
    loadRegions();
    setupKeyboardShortcuts();
}

// ============================================================
// EXPORTS
// ============================================================

export default {
    rollForCharacter,
    rollForNPC,
    customRoll,
    rollForCharacters,
    getCharacterRollHistory,
    getRecentRolls,
    clearRollHistory,
    exportRollHistory,
    setupKeyboardShortcuts,
    cleanupKeyboardShortcuts,
    renderRollerUI,
    generateRegionName,
    generateRegionNames,
    getRegionNames: () => regionNames,
    getSelectedRegion: () => selectedRegion,
    loadRegions
};