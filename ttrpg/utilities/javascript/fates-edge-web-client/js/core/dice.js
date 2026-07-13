/**
 * Dice rolling module - Core dice engine
 * Supports standard dice notation and advanced rolling features
 */

// ============================================================
// BASIC DICE FUNCTIONS
// ============================================================

/**
 * Parse a dice notation string
 * @param {string} notation - Dice notation (e.g., "2d6+3", "d20", "3d8+5")
 * @returns {Object} Parsed dice object { count, sides, modifier, type }
 */
export function parseDiceNotation(notation) {
    if (typeof notation !== 'string') {
        throw new Error('Dice notation must be a string');
    }

    notation = notation.trim().toLowerCase();
    
    if (!notation) {
        throw new Error('Dice notation cannot be empty');
    }

    const match = notation.match(/^(\d*)?d([%f]|\d+)([+-]\d+)?$/);
    if (!match) {
        throw new Error(`Invalid dice notation: ${notation}`);
    }

    const count = match[1] ? parseInt(match[1], 10) : 1;
    let sides = match[2];
    const modifier = match[3] ? parseInt(match[3], 10) : 0;

    let type = 'standard';
    let parsedSides = 0;

    if (sides === '%') {
        parsedSides = 100;
        type = 'percentile';
    } else if (sides === 'f') {
        parsedSides = 3;
        type = 'fudge';
    } else {
        parsedSides = parseInt(sides, 10);
        if (parsedSides < 1) {
            throw new Error('Dice must have at least 1 side');
        }
    }

    return {
        count,
        sides: parsedSides,
        modifier,
        type,
        notation: notation
    };
}

/**
 * Roll a single die
 * @param {number} sides - Number of sides on the die
 * @returns {number} Roll result
 */
export function rollDie(sides) {
    if (sides < 1) {
        throw new Error('Die must have at least 1 side');
    }
    return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll multiple dice and return results
 * @param {number} count - Number of dice to roll
 * @param {number} sides - Number of sides on each die
 * @param {number} modifier - Modifier to apply (optional)
 * @returns {Object} Roll results { rolls, total, modifier, sum }
 */
export function rollDice(count, sides, modifier = 0) {
    if (count < 1) {
        throw new Error('Must roll at least 1 die');
    }
    if (sides < 1) {
        throw new Error('Die must have at least 1 side');
    }

    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(rollDie(sides));
    }

    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;

    return {
        rolls,
        count,
        sides,
        modifier,
        sum,
        total,
        average: sum / count,
        min: Math.min(...rolls),
        max: Math.max(...rolls)
    };
}

/**
 * Roll dice from a notation string
 * @param {string} notation - Dice notation (e.g., "2d6+3")
 * @param {Object} options - Additional options
 * @param {boolean} options.explode - Enable exploding dice
 * @param {boolean} options.keepHighest - Keep only the highest roll
 * @param {number} options.keepCount - Number of dice to keep
 * @param {number} options.rerollUnder - Reroll dice under this value
 * @returns {Object} Roll results
 */
export function roll(notation, options = {}) {
    const parsed = parseDiceNotation(notation);
    let rolls = [];
    let total = 0;
    
    for (let i = 0; i < parsed.count; i++) {
        let result = rollDie(parsed.sides);
        
        if (options.explode) {
            const max = parsed.sides;
            while (result === max) {
                rolls.push(result);
                result = rollDie(parsed.sides);
            }
            rolls.push(result);
        } 
        else if (options.rerollUnder && result < options.rerollUnder) {
            result = rollDie(parsed.sides);
            rolls.push(result);
        } 
        else {
            rolls.push(result);
        }
    }

    if (options.keepHighest && options.keepCount) {
        rolls.sort((a, b) => b - a);
        rolls = rolls.slice(0, options.keepCount);
    }

    if (options.keepLowest && options.keepCount) {
        rolls.sort((a, b) => a - b);
        rolls = rolls.slice(0, options.keepCount);
    }

    const sum = rolls.reduce((a, b) => a + b, 0);
    total = sum + parsed.modifier;

    const result = {
        notation,
        rolls,
        count: rolls.length,
        sides: parsed.sides,
        modifier: parsed.modifier,
        sum,
        total,
        average: sum / rolls.length,
        min: Math.min(...rolls),
        max: Math.max(...rolls),
        type: parsed.type,
        details: {
            originalCount: parsed.count,
            originalSides: parsed.sides,
            ...options
        }
    };

    if (options.keepHighest && options.keepCount === 1 && options.originalCount === 2) {
        result.advantage = true;
    } else if (options.keepLowest && options.keepCount === 1 && options.originalCount === 2) {
        result.disadvantage = true;
    }

    return result;
}

/**
 * Roll with advantage (2d20 keep highest)
 * @param {number} modifier - Modifier to apply
 * @returns {Object} Roll results
 */
export function rollWithAdvantage(modifier = 0) {
    const result = roll('2d20', { keepHighest: true, keepCount: 1 });
    result.total += modifier;
    result.modifier = modifier;
    result.advantage = true;
    return result;
}

/**
 * Roll with disadvantage (2d20 keep lowest)
 * @param {number} modifier - Modifier to apply
 * @returns {Object} Roll results
 */
export function rollWithDisadvantage(modifier = 0) {
    const result = roll('2d20', { keepLowest: true, keepCount: 1 });
    result.total += modifier;
    result.modifier = modifier;
    result.disadvantage = true;
    return result;
}

/**
 * Roll a percentile die (1-100)
 * @param {number} modifier - Modifier to apply
 * @returns {Object} Roll results
 */
export function rollPercentile(modifier = 0) {
    const tens = rollDie(10) * 10;
    const ones = rollDie(10);
    const value = (tens === 0 && ones === 0) ? 100 : tens + ones;
    
    return {
        notation: 'd%',
        rolls: [tens / 10 || 10, ones],
        value,
        total: value + modifier,
        modifier,
        type: 'percentile'
    };
}

/**
 * Roll Fudge/Fate dice (dF)
 * @param {number} modifier - Modifier to apply
 * @returns {Object} Roll results
 */
export function rollFudge(modifier = 0) {
    const results = [];
    const faces = [-1, 0, 1];
    
    for (let i = 0; i < 4; i++) {
        results.push(faces[Math.floor(Math.random() * faces.length)]);
    }
    
    const sum = results.reduce((a, b) => a + b, 0);
    
    return {
        notation: '4dF',
        rolls: results,
        total: sum + modifier,
        modifier,
        type: 'fudge',
        sum
    };
}

/**
 * Get a human-readable description of the roll
 * @param {Object} rollResult - Result from roll() function
 * @returns {string} Description
 */
export function describeRoll(rollResult) {
    if (!rollResult || typeof rollResult !== 'object') {
        return 'Invalid roll';
    }

    const parts = [];
    parts.push(`🎲 ${rollResult.notation}`);
    
    if (rollResult.rolls && rollResult.rolls.length > 0) {
        parts.push(`[${rollResult.rolls.join(', ')}]`);
    }
    
    if (rollResult.modifier !== 0) {
        const sign = rollResult.modifier > 0 ? '+' : '';
        parts.push(`${sign}${rollResult.modifier}`);
    }
    
    parts.push(`= ${rollResult.total}`);
    
    if (rollResult.advantage) {
        parts.push('(advantage)');
    }
    if (rollResult.disadvantage) {
        parts.push('(disadvantage)');
    }
    
    return parts.join(' ');
}

/**
 * Validate dice notation
 * @param {string} notation - Dice notation to validate
 * @returns {boolean} True if valid
 */
export function isValidDiceNotation(notation) {
    try {
        parseDiceNotation(notation);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get all possible results for a dice roll (for probability calculations)
 * @param {string} notation - Dice notation
 * @returns {Object} Probability information
 */
export function getDiceProbability(notation) {
    const parsed = parseDiceNotation(notation);
    const { count, sides, modifier } = parsed;
    
    if (count > 5 || sides > 20) {
        const mean = count * ((sides + 1) / 2) + modifier;
        const variance = count * ((sides * sides - 1) / 12);
        return {
            notation,
            count,
            sides,
            modifier,
            mean,
            variance,
            stdDev: Math.sqrt(variance),
            min: count + modifier,
            max: count * sides + modifier,
            approximate: true
        };
    }

    const results = {};
    const totalCombinations = Math.pow(sides, count);
    
    function generateResults(currentSum, depth) {
        if (depth === count) {
            const key = currentSum + modifier;
            results[key] = (results[key] || 0) + 1;
            return;
        }
        for (let i = 1; i <= sides; i++) {
            generateResults(currentSum + i, depth + 1);
        }
    }
    
    generateResults(0, 0);
    
    return {
        notation,
        count,
        sides,
        modifier,
        totalCombinations,
        results: Object.fromEntries(
            Object.entries(results).map(([key, value]) => [
                parseInt(key),
                value / totalCombinations
            ])
        ),
        min: count + modifier,
        max: count * sides + modifier,
        approximate: false
    };
}

// ============================================================
// FATE'S EDGE RESOLUTION ROLL
// ============================================================

/**
 * Perform a Fate's Edge resolution roll
 * @param {number} attr - Attribute rating (1-5)
 * @param {number} skill - Skill rating (0-5)
 * @param {number} dv - Difficulty Value (2-5+)
 * @param {string} position - 'dominant', 'controlled', or 'desperate'
 * @param {number} boons - Number of boons to spend (0-5)
 * @returns {object} Roll result with details
 */
export function performRoll(attr, skill, dv, position = 'controlled', boons = 0) {
    // Calculate pool size
    let pool = attr + skill + boons;
    if (pool < 1) pool = 1;
    
    // Roll the dice using core dice engine
    const result = roll(`${pool}d10`);
    const dice = result.rolls;
    
    // Count successes (6+ = success, 10 = 2 successes)
    let successes = 0;
    let storyBeats = 0;
    let initialDice = [...dice];
    
    for (const die of dice) {
        if (die === 1) storyBeats++;
        if (die >= 6) {
            successes += die === 10 ? 2 : 1;
        }
    }
    
    // Position-based re-roll
    let reRolls = 0;
    let reRolledDice = [];
    let rerollSuccesses = 0;
    let rerollStoryBeats = 0;
    
    if (position === 'dominant') {
        const failureIndex = dice.findIndex(r => r < 6);
        if (failureIndex !== -1) {
            const oldValue = dice[failureIndex];
            const newRoll = rollDie(10);
            dice[failureIndex] = newRoll;
            reRolls++;
            reRolledDice.push({ old: oldValue, new: newRoll });
            
            if (oldValue >= 6) {
                successes -= oldValue === 10 ? 2 : 1;
            }
            if (newRoll >= 6) {
                const newSuccesses = newRoll === 10 ? 2 : 1;
                successes += newSuccesses;
                rerollSuccesses += newSuccesses;
            }
            if (newRoll === 1) {
                storyBeats++;
                rerollStoryBeats++;
            }
        }
    } else if (position === 'desperate') {
        const successIndex = dice.findIndex(r => r >= 6);
        if (successIndex !== -1) {
            const oldValue = dice[successIndex];
            const newRoll = rollDie(10);
            dice[successIndex] = newRoll;
            reRolls++;
            reRolledDice.push({ old: oldValue, new: newRoll });
            
            if (oldValue >= 6) {
                successes -= oldValue === 10 ? 2 : 1;
            }
            if (newRoll >= 6) {
                const newSuccesses = newRoll === 10 ? 2 : 1;
                successes += newSuccesses;
                rerollSuccesses += newSuccesses;
            }
            if (newRoll === 1) {
                storyBeats++;
                rerollStoryBeats++;
            }
        }
    }
    
    // Determine outcome
    let outcome, outcomeClass, resultText;
    const successCount = successes;
    const sb = storyBeats;
    
    if (successCount >= dv) {
        if (sb > 0) {
            outcome = 'Success with Story Beats';
            outcomeClass = 'success-with-sb';
            resultText = `Success with ${sb} Story Beat${sb > 1 ? 's' : ''}`;
        } else {
            outcome = 'Clean Success';
            outcomeClass = 'clean-success';
            resultText = 'Clean Success';
        }
    } else if (successCount > 0) {
        outcome = 'Partial Success';
        outcomeClass = 'partial';
        resultText = `Partial Success (+1 Boon)`;
    } else {
        outcome = 'Miss';
        outcomeClass = 'miss';
        resultText = `Miss (+2 Boons)`;
    }
    
    return {
        pool: pool,
        dice: dice,
        initialDice: initialDice,
        storyBeats: storyBeats,
        successes: successCount,
        sb: storyBeats,
        dv: dv,
        position: position,
        boons: boons,
        outcome: outcome,
        outcomeClass: outcomeClass,
        resultText: resultText,
        reRolls: reRolls,
        reRolledDice: reRolledDice,
        rerollSuccesses: rerollSuccesses,
        rerollStoryBeats: rerollStoryBeats,
        summary: {
            pool: pool,
            successes: successCount,
            storyBeats: storyBeats,
            reRolls: reRolls
        }
    };
}

// ============================================================
// FATE'S EDGE GAME DATA
// ============================================================

/**
 * List of all skills in Fate's Edge
 */
export const ALL_SKILLS = [
    'Melee', 'Ranged', 'Brawl', 'Tactics', 'Athletics',
    'Stealth', 'Endurance', 'Craft', 'Survival', 'Sway',
    'Command', 'Deception', 'Performance', 'Insight',
    'Lore', 'Investigation', 'Medicine', 'Arcana', 'Ritual'
];

/**
 * Calculate attribute XP cost
 * @param {number} rating - Attribute rating (1-5)
 * @returns {number} Total XP cost
 */
export function attrCost(rating) {
    let total = 0;
    for (let i = 2; i <= rating; i++) total += i * 3;
    return total;
}

/**
 * Calculate skill XP cost
 * @param {number} level - Skill level (0-5)
 * @returns {number} Total XP cost
 */
export function skillCost(level) {
    let total = 0;
    for (let i = 1; i <= level; i++) total += i * 2;
    return total;
}

/**
 * Create default skills object with all skills at 0
 * @returns {Object} Skills object
 */
export function createDefaultSkills() {
    const o = {};
    ALL_SKILLS.forEach(s => o[s.toLowerCase()] = 0);
    return o;
}

/**
 * Alias for createDefaultSkills (backward compatibility)
 */
export const defaultSkills = createDefaultSkills;

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
    parseDiceNotation,
    rollDie,
    rollDice,
    roll,
    rollWithAdvantage,
    rollWithDisadvantage,
    rollPercentile,
    rollFudge,
    describeRoll,
    isValidDiceNotation,
    getDiceProbability,
    performRoll,
    ALL_SKILLS,
    defaultSkills,
    attrCost,
    skillCost,
    createDefaultSkills
};