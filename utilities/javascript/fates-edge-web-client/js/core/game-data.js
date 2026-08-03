// js/core/game-data.js
// Fate's Edge game data and constants.
//
// NOTE: nothing in the app currently imports this module (verified — no other file
// references 'core/game-data'). It previously listed a 19-skill set that disagreed
// with the 16-skill canonical list actually used by js/features/characters/editor.js
// and roller.js (Melee/Ranged/Unarmed/Athletics/Stealth/Endurance/Craft/Sway/
// Deception/Subterfuge/Performance/Insight/Lore/Investigation/Medicine/Arcana — no
// Brawl/Tactics/Survival/Command/Ritual). Left in place as a small standalone utility,
// but updated to match the canonical list so it doesn't silently drift if something
// starts importing it later.

export const ALL_SKILLS = [
    'Melee', 'Ranged', 'Unarmed', 'Athletics', 'Stealth', 'Endurance', 'Craft',
    'Sway', 'Deception', 'Subterfuge', 'Performance', 'Insight', 'Lore',
    'Investigation', 'Medicine', 'Arcana'
];

/**
 * Calculate attribute XP cost
 */
export function attrCost(rating) {
    let total = 0;
    for (let i = 2; i <= rating; i++) total += i * 3;
    return total;
}

/**
 * Calculate skill XP cost
 */
export function skillCost(level) {
    let total = 0;
    for (let i = 1; i <= level; i++) total += i * 2;
    return total;
}

/**
 * Create default skills object
 */
export function createDefaultSkills() {
    const o = {};
    ALL_SKILLS.forEach(s => o[s.toLowerCase()] = 0);
    return o;
}

// Alias for backward compatibility
export const defaultSkills = createDefaultSkills;
