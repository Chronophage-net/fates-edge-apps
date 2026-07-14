/**
 * Character roller - Quick rolls for characters
 * Supports characters, NPCs, and custom roll configurations
 */

import { getCharacter, addRoll, saveState, getState } from '../../core/state.js';
import { performRoll } from '../../core/dice.js';
import { showToast } from '../../components/Toast.js';

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_DV = 3;
const DEFAULT_POSITION = 'controlled';
const DEFAULT_BOONS = 0;
const MAX_ROLL_RESULTS = 100;

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
// HELPER FUNCTIONS
// ============================================================

/**
 * Build a chat message from roll results
 */
function buildRollMessage(name, result, attr, skill, dv, position) {
    const diceStr = result.dice.join(' ');
    let msg = `[${result.outcome}] ${name}: ${attr}+${skill} vs DV${dv} (${position}) → `;
    msg += diceStr;
    msg += ` | S:${result.successes} SB:${result.storyBeats || 0}`;
    
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
            }
        })
        .catch(err => {
            console.warn('[CharacterRoller] Could not send to VTT:', err);
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

// Add global keyboard shortcut for quick rolls (Ctrl+Shift+R)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        const activeChar = getState().characters?.find(c => c.active !== false);
        if (activeChar) {
            rollForCharacter(activeChar.id, { note: 'Quick roll' });
        }
    }
});

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
    exportRollHistory
};