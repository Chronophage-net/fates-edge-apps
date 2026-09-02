// js/core/game-data.js
// Fate's Edge game data and constants.
//
// NOTE: nothing in the app currently imports this module (verified). Kept as a
// small standalone utility, tracking the canonical twelve-skill list in
// js/core/state.js so it can't silently drift if something starts importing it.

export const ALL_SKILLS = [
    'Melee', 'Ranged', 'Athletics', 'Stealth',
    'Endurance', 'Craft', 'Sway', 'Deception',
    'Performance', 'Insight', 'Lore', 'Arcana'
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
