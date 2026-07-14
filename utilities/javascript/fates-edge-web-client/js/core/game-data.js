// js/core/dice.js
// Fate's Edge game data and constants

export const ALL_SKILLS = [
    'Melee', 'Ranged', 'Brawl', 'Tactics', 'Athletics',
    'Stealth', 'Endurance', 'Craft', 'Survival', 'Sway',
    'Command', 'Deception', 'Performance', 'Insight',
    'Lore', 'Investigation', 'Medicine', 'Arcana', 'Ritual'
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
