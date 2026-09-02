/**
 * Core Dice Engine - Fate's Edge Resolution System
 * 
 * Provides the core dice rolling logic with support for:
 * - Seeded deterministic RNG (for static/demo deployments)
 * - Cryptographic RNG fallback
 * - Xorshift128+ PRNG implementation
 * - Story Beat generation on 1s
 * - Full resolution with Position (Dominant/Controlled/Desperate)
 * - Re-roll mechanics
 * - Boon integration
 * - Dice pool management
 * 
 * v3.3 – Exposes normalized outcome codes for VTT automation
 */

// ============================================================
// DETERMINISTIC RNG - Xorshift128+ PRNG
// ============================================================

// Module-level state (no global leaks)
let _seed = null;
let _prng = null;

/**
 * Xorshift128+ PRNG for deterministic random generation
 * Used when a seed is set for reproducible random sequences
 */
class Xorshift128 {
    constructor(seed) {
        this.seed = seed;
        this.state = this._seedToState(seed);
    }
    
    _seedToState(seed) {
        let s0 = 0;
        let s1 = 0;
        
        if (typeof seed === 'number') {
            s0 = seed;
            s1 = seed + 0x9e3779b97f4a7c15;
        } else if (typeof seed === 'string') {
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash = hash & hash;
            }
            s0 = hash;
            s1 = hash + 0x9e3779b97f4a7c15;
        } else {
            s0 = Date.now();
            s1 = Date.now() + 0x9e3779b97f4a7c15;
        }
        
        return { s0: BigInt(s0), s1: BigInt(s1) };
    }
    
    random() {
        let s0 = this.state.s0;
        let s1 = this.state.s1;
        
        let x = s1;
        let y = s0;
        
        x = x ^ (x << BigInt(23));
        x = x ^ (x >> BigInt(17));
        x = x ^ (y ^ (y >> BigInt(26)));
        
        this.state.s0 = y;
        this.state.s1 = x;
        
        const result = Number((x + y) & BigInt(0xFFFFFFFFFFFFFFFF)) / 18446744073709551616;
        return result;
    }
    
    randomInt(min, max) {
        return Math.floor(this.random() * (max - min)) + min;
    }
    
    randomIntInclusive(min, max) {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }
}

// ============================================================
// SEED MANAGEMENT
// ============================================================

/**
 * Get the current deterministic seed
 * @returns {string|null} Current seed or null if not set
 */
function getSeed() {
    return _seed;
}

/**
 * Set the deterministic seed
 * @param {string|null} seed - New seed value, or null to disable deterministic mode
 * @returns {boolean} Success
 */
function setSeed(seed) {
    _seed = seed;
    if (seed) {
        _prng = new Xorshift128(seed);
        try {
            localStorage.setItem('fates-edge-seed', seed);
        } catch (e) { /* ignore */ }
    } else {
        _prng = null;
        try {
            localStorage.removeItem('fates-edge-seed');
        } catch (e) { /* ignore */ }
    }
    return true;
}

/**
 * Generate a new random seed
 * @returns {string} New seed value
 */
function generateSeed() {
    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(4);
            window.crypto.getRandomValues(array);
            return array.reduce((acc, val) => acc + val.toString(16).padStart(8, '0'), '');
        }
    } catch (e) { /* ignore */ }
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Get a random number using deterministic PRNG if seeded, otherwise crypto/Math.random
 * @returns {number} Random number between 0 and 1
 */
function getRandom() {
    if (_prng) {
        return _prng.random();
    }
    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            return array[0] / 4294967296;
        }
    } catch (e) { /* ignore */ }
    return Math.random();
}

/**
 * Get a random integer using deterministic PRNG if seeded
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random integer
 */
function getRandomInt(min, max) {
    if (_prng) {
        return _prng.randomInt(min, max);
    }
    return Math.floor(getRandom() * (max - min)) + min;
}

/**
 * Get a random integer inclusive using deterministic PRNG if seeded
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer
 */
function getRandomIntInclusive(min, max) {
    if (_prng) {
        return _prng.randomIntInclusive(min, max);
    }
    return Math.floor(getRandom() * (max - min + 1)) + min;
}

// ============================================================
// SEED INITIALIZATION
// ============================================================

// Initialize seed from localStorage on module load
try {
    const stored = localStorage.getItem('fates-edge-seed');
    if (stored) {
        _seed = stored;
        _prng = new Xorshift128(stored);
        console.log('[Dice Core] Seed loaded from localStorage:', stored.substring(0, 8) + '...');
    }
} catch (e) { /* ignore */ }

// Also try to load from window seed (set by build script for static sites)
if (!_seed && typeof window !== 'undefined' && window.__RANDOM_SEED) {
    _seed = window.__RANDOM_SEED;
    _prng = new Xorshift128(_seed);
    try {
        localStorage.setItem('fates-edge-seed', _seed);
        console.log('[Dice Core] Seed loaded from window.__RANDOM_SEED:', _seed.substring(0, 8) + '...');
    } catch (e) { /* ignore */ }
}

// ============================================================
// SKILLS DEFINITIONS
// ============================================================

/**
 * All available skills in the game
 */
const ALL_SKILLS = [
    'Melee', 'Ranged', 'Athletics', 'Stealth',
    'Endurance', 'Craft', 'Sway', 'Deception',
    'Performance', 'Insight', 'Lore', 'Arcana'
];

/**
 * Default starting skills for new characters
 * A subset of ALL_SKILLS that characters start with
 */
const defaultSkills = [
    'Melee', 'Ranged', 'Athletics', 'Stealth',
    'Endurance', 'Craft', 'Sway', 'Deception',
    'Performance', 'Insight', 'Lore', 'Arcana'
];

// ============================================================
// OUTCOME CONSTANTS (NEW for VTT automation)
// ============================================================

export const OUTCOME_CODES = {
    CLEAN: 'clean',
    SUCCESS_SB: 'success_sb',
    PARTIAL: 'partial',
    MISS: 'miss'
};

/**
 * Count successes in a dice pool, where 10s count as 2 successes each and 6-9 count as 1.
 * @param {number[]} dice - Array of die results
 * @returns {number} Total successes
 */
function countSuccesses(dice) {
    return dice.reduce((acc, r) => acc + (r === 10 ? 2 : (r >= 6 ? 1 : 0)), 0);
}

/**
 * Count the number of 10s rolled (each 10 is a potential critical trigger).
 * @param {number[]} dice - Array of die results
 * @returns {number} Number of 10s
 */
function countTens(dice) {
    return dice.filter(r => r === 10).length;
}

/**
 * A roll is Critical only when it contains at least one 10 AND the roll actually
 * meets or exceeds the DV. A 10 on a roll that falls short of the DV is still just
 * a Partial (or Miss) — the 10 does not grant a critical on its own.
 * @param {number} tens - Number of 10s rolled
 * @param {number} successes - Total successes (10s already counted as 2)
 * @param {number} dv - Difficulty Value
 * @returns {boolean}
 */
function isCriticalRoll(tens, successes, dv) {
    return tens > 0 && successes >= dv;
}

/**
 * Get the machine‑friendly outcome code from successes, DV, and story beats.
 * @param {number} successes - Number of successes rolled
 * @param {number} dv - Difficulty Value
 * @param {number} storyBeats - Number of 1s rolled (Story Beats)
 * @returns {string} One of 'clean', 'success_sb', 'partial', 'miss'
 */
function getRollOutcomeCode(successes, dv, storyBeats = 0) {
    if (successes >= dv) {
        return storyBeats > 0 ? OUTCOME_CODES.SUCCESS_SB : OUTCOME_CODES.CLEAN;
    } else if (successes > 0) {
        return OUTCOME_CODES.PARTIAL;
    } else {
        return OUTCOME_CODES.MISS;
    }
}

/**
 * Get the human‑readable label for an outcome code.
 * @param {string} code - Outcome code (from OUTCOME_CODES)
 * @returns {string} Human‑readable label
 */
function getOutcomeLabelFromCode(code) {
    const labels = {
        [OUTCOME_CODES.CLEAN]: 'Clean Success',
        [OUTCOME_CODES.SUCCESS_SB]: 'Success with SB',
        [OUTCOME_CODES.PARTIAL]: 'Partial',
        [OUTCOME_CODES.MISS]: 'Miss'
    };
    return labels[code] || 'Unknown';
}

// ============================================================
// CORE DICE ROLLING
// ============================================================

/**
 * Roll a single die with deterministic RNG support
 * @param {number} sides - Number of sides on the die (default: 10)
 * @returns {number} Roll result (1 to sides)
 */
function rollDie(sides = 10) {
    if (sides < 1) {
        throw new Error('Die must have at least 1 side');
    }
    if (_prng) {
        return _prng.randomInt(1, sides + 1);
    }
    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            return Math.floor((array[0] / 4294967296) * sides) + 1;
        }
    } catch (e) { /* ignore */ }
    return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll multiple dice and return results
 * @param {number} count - Number of dice to roll
 * @param {number} sides - Number of sides on each die
 * @returns {number[]} Array of roll results
 */
function rollDice(count, sides = 10) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(rollDie(sides));
    }
    return results;
}

/**
 * Roll a dice pool and count successes (6+)
 * @param {number} pool - Number of dice in the pool
 * @param {number} sides - Number of sides on each die
 * @returns {Object} { dice: number[], successes: number, storyBeats: number }
 */
function rollPool(pool, sides = 10) {
    const dice = rollDice(pool, sides);
    const successes = countSuccesses(dice);
    const storyBeats = dice.filter(r => r === 1).length;
    const tens = countTens(dice);
    return { dice, successes, storyBeats, tens };
}

/**
 * Core dice pool roll with Story Beat tracking
 * @param {number} pool - Number of dice in the pool
 * @param {number} dv - Difficulty Value to beat
 * @param {Object} options - Additional options
 * @param {number} options.reRolls - Number of re-rolls allowed (default: 0)
 * @param {number} options.exploding - If truthy, 10s explode (roll again)
 * @param {string} options.position - Position (dominant, controlled, desperate)
 * @param {number} options.boons - Number of boons to add
 * @returns {Object} Roll result with successes, dice, storyBeats, etc.
 */
// DEPRECATED. This is an older, unused sibling of performRoll() below, and it
// encodes two rules that are no longer correct:
//   1. Dominant/Desperate re-roll EVERY failure/success here. The rules re-roll
//      exactly one, and 10s are never re-rolled at all.
//   2. It recomputes Story Beats after the re-roll, erasing the beat a re-rolled
//      1 had already earned (SRD 18.1 says that beat persists).
// Nothing in this repo or in fates-edge-ai-gm-bot calls it; it is kept only so
// an external consumer doesn't break on an unannounced removal. Use performRoll()
// for anything new, and delete this once the next major version lands.
function performDicePoolRoll(pool, dv, options = {}) {
    const {
        position = 'controlled',
        boons = 0,
        reRolls = 0,
        exploding = false
    } = options;
    
    // Add boons to pool
    const effectivePool = Math.min(pool + boons, 12);
    let dice = rollDice(effectivePool);
    let storyBeats = dice.filter(r => r === 1).length;
    let successes = countSuccesses(dice);
    let reRolledDice = [];
    let reRollCount = 0;
    let initialDice = [...dice];
    
    // Handle position effects
    if (position === 'dominant') {
        // Re-roll failures (dice < 6)
        const failures = dice.filter(r => r < 6);
        if (failures.length > 0) {
            const rerollResults = rollDice(failures.length);
            reRolledDice = failures.map((old, i) => ({ old, new: rerollResults[i] || 1 }));
            reRollCount = rerollResults.length;
            // Update dice array with re-roll results
            let idx = 0;
            dice = dice.map(r => {
                if (r < 6 && idx < rerollResults.length) {
                    return rerollResults[idx++];
                }
                return r;
            });
            // Recalculate successes and story beats
            successes = countSuccesses(dice);
            // Story Beats are counted additively: a re-rolled 1 keeps the beat
            // it already earned (SRD 18.1), and a new 1 adds another.
            storyBeats = initialDice.filter(r => r === 1).length +
                         rerollResults.filter(r => r === 1).length;
        }
    } else if (position === 'desperate') {
        // Re-roll successes (dice >= 6)
        const successDice = dice.filter(r => r >= 6);
        if (successDice.length > 0) {
            const rerollResults = rollDice(successDice.length);
            reRolledDice = successDice.map((old, i) => ({ old, new: rerollResults[i] || 1 }));
            reRollCount = rerollResults.length;
            // Replace success dice with re-roll results
            let idx = 0;
            dice = dice.map(r => {
                if (r >= 6 && idx < rerollResults.length) {
                    return rerollResults[idx++];
                }
                return r;
            });
            // Recalculate successes and story beats
            successes = countSuccesses(dice);
            // Story Beats are counted additively: a re-rolled 1 keeps the beat
            // it already earned (SRD 18.1), and a new 1 adds another.
            storyBeats = initialDice.filter(r => r === 1).length +
                         rerollResults.filter(r => r === 1).length;
        }
    }
    
    // Handle exploding dice (10s roll again)
    if (exploding) {
        let explodedDice = [];
        let explodeCount = 0;
        let currentDice = dice;
        let hasExploded = true;
        let maxExplosions = 5;
        
        while (hasExploded && maxExplosions > 0) {
            hasExploded = false;
            const newDice = [];
            for (const roll of currentDice) {
                if (roll === 10 && maxExplosions > 0) {
                    hasExploded = true;
                    explodeCount++;
                    const extraRoll = rollDie(10);
                    explodedDice.push(extraRoll);
                    newDice.push(extraRoll);
                    maxExplosions--;
                }
            }
            if (hasExploded) {
                currentDice = newDice;
                dice = [...dice, ...newDice];
                successes = countSuccesses(dice);
                // Add only the beats from the newly exploded dice. Recomputing
                // from the whole pool here would undo the additive count the
                // Position re-roll above established, erasing a re-rolled 1's
                // beat all over again.
                storyBeats += newDice.filter(r => r === 1).length;
            }
        }
    }

    const tens = countTens(dice);
    const critical = isCriticalRoll(tens, successes, dv);

    // Determine outcome
    let outcome, outcomeClass, resultText;
    const outcomeCode = getRollOutcomeCode(successes, dv, storyBeats);
    if (successes >= dv) {
        if (storyBeats > 0) {
            outcome = 'Success with SB';
            outcomeClass = 'success-with-sb';
            resultText = 'Success with Story Beats';
        } else {
            outcome = 'Clean Success';
            outcomeClass = 'clean-success';
            resultText = 'Clean Success';
        }
    } else if (successes > 0) {
        outcome = 'Partial';
        outcomeClass = 'partial';
        resultText = 'Partial Success';
    } else {
        outcome = 'Miss';
        outcomeClass = 'miss';
        resultText = 'Miss';
    }

    return {
        pool: effectivePool,
        dice,
        initialDice,
        successes,
        storyBeats,
        tens,
        critical,               // NEW: true only if a 10 was rolled AND successes >= dv
        dv,
        position,
        boons,
        outcome,
        outcomeClass,
        resultText,
        outcomeCode,                // NEW: machine‑friendly code
        reRolls: reRollCount,
        reRolledDice,
        deterministic: !!_seed,
        seed: _seed
    };
}

// ============================================================
// PERFORM ROLL (Full resolution with attribute + skill)
// ============================================================

/**
 * Perform a full roll with attribute, skill, and position
 * @param {number} attr - Attribute value
 * @param {number} skill - Skill value
 * @param {number} dv - Difficulty Value
 * @param {string} position - Position (dominant, controlled, desperate)
 * @param {number} boons - Number of boons to add
 * @param {Object} options - Additional options
 * @returns {Object} Full roll result
 */
function performRoll(attr, skill, dv, position = 'controlled', boons = 0, options = {}) {
    const basePool = Math.max(1, attr + skill);
    const pool = Math.min(basePool + boons, 12); // Cap at 12 dice
    
    // Roll the initial pool
    let dice = rollDice(pool);
    let storyBeats = dice.filter(r => r === 1).length;
    let successes = countSuccesses(dice);
    let reRolls = 0;
    let reRolledDice = [];
    let rerollSuccesses = 0;
    let rerollStoryBeats = 0;
    let initialDice = [...dice];
    
    // Handle position effects
    if (position === 'dominant') {
        // Dominant re-rolls ONE failure, not every failure. (SRD, Position &
        // Effect: "Dominant: Re-roll one failure (die <= 5)".) This used to
        // re-roll the whole failing half of the pool, which made Dominant
        // wildly stronger than the rules describe.
        // Which failure: the lowest. Any choice is equivalent in expectation,
        // so we pick deterministically to keep replays reproducible.
        let pick = -1;
        for (let i = 0; i < dice.length; i++) {
            if (dice[i] <= 5 && (pick === -1 || dice[i] < dice[pick])) pick = i;
        }
        if (pick !== -1) {
            const rerollResults = rollDice(1);
            reRolledDice = [{ old: dice[pick], new: rerollResults[0] }];
            reRolls = 1;
            rerollSuccesses = countSuccesses(rerollResults);
            rerollStoryBeats = rerollResults.filter(r => r === 1).length;
            const rerolledWasOne = dice[pick] === 1;
            dice = dice.map((r, i) => (i === pick ? rerollResults[0] : r));
            // Recalculate successes from the final dice.
            successes = countSuccesses(dice);
            // Story Beats are NOT recomputed from the final dice. SRD 18.1:
            // "Re-rolling a 1 does not erase its SB; if the re-rolled die also
            // shows 1, it generates additional SB." Recomputing wiped the beat
            // the original 1 had already earned — and since Dominant picks the
            // LOWEST failure, that was every 1 in the pool.
            storyBeats = dice.filter(r => r === 1).length;
            if (rerolledWasOne) storyBeats += 1;
        }
    } else if (position === 'desperate') {
        // Desperate re-rolls ONE success, and never a 10. (SRD: "Desperate:
        // Re-roll one success (die >= 6). 10s are never re-rolled.") This used
        // to re-roll every success in the pool, 10s included, which made a
        // Desperate roll nearly unwinnable rather than merely costly.
        // Which success: the lowest eligible, which is the least destructive
        // reading and is deterministic.
        let pick = -1;
        for (let i = 0; i < dice.length; i++) {
            if (dice[i] >= 6 && dice[i] < 10 && (pick === -1 || dice[i] < dice[pick])) pick = i;
        }
        if (pick !== -1) {
            const rerollResults = rollDice(1);
            reRolledDice = [{ old: dice[pick], new: rerollResults[0] }];
            reRolls = 1;
            rerollSuccesses = countSuccesses(rerollResults);
            rerollStoryBeats = rerollResults.filter(r => r === 1).length;
            const rerolledWasOne = dice[pick] === 1;
            dice = dice.map((r, i) => (i === pick ? rerollResults[0] : r));
            // Recalculate successes from the final dice.
            successes = countSuccesses(dice);
            // Story Beats are NOT recomputed from the final dice. SRD 18.1:
            // "Re-rolling a 1 does not erase its SB; if the re-rolled die also
            // shows 1, it generates additional SB." Recomputing wiped the beat
            // the original 1 had already earned — and since Dominant picks the
            // LOWEST failure, that was every 1 in the pool.
            storyBeats = dice.filter(r => r === 1).length;
            if (rerolledWasOne) storyBeats += 1;
        }
    }
    
    const tens = countTens(dice);
    const critical = isCriticalRoll(tens, successes, dv);

    // Determine outcome
    let outcome, outcomeClass, resultText;
    let storyBeatOutcome = '';
    const outcomeCode = getRollOutcomeCode(successes, dv, storyBeats);
    if (successes >= dv) {
        if (storyBeats > 0) {
            outcome = 'Success with SB';
            outcomeClass = 'success-with-sb';
            resultText = 'Success with Story Beats';
            storyBeatOutcome = 'The action succeeds, but the GM gains Story Beats to spend on complications.';
        } else {
            outcome = 'Clean Success';
            outcomeClass = 'clean-success';
            resultText = 'Clean Success';
            storyBeatOutcome = 'The action succeeds cleanly with no complications.';
        }
    } else if (successes > 0) {
        outcome = 'Partial';
        outcomeClass = 'partial';
        resultText = 'Partial Success';
        storyBeatOutcome = 'You make progress, but the situation remains unresolved. Gain 1 Boon.';
    } else {
        outcome = 'Miss';
        outcomeClass = 'miss';
        resultText = 'Miss';
        storyBeatOutcome = 'The action fails. Gain 2 Boons. The GM gains Story Beats to escalate.';
    }

    return {
        pool,
        dice,
        initialDice,
        successes,
        storyBeats,
        tens,
        critical,               // NEW: true only if a 10 was rolled AND successes >= dv
        dv,
        position,
        boons,
        attr,
        skill,
        outcome,
        outcomeClass,
        resultText,
        outcomeCode,                // NEW: machine‑friendly code
        storyBeatOutcome,
        reRolls,
        reRolledDice,
        rerollSuccesses,
        rerollStoryBeats,
        deterministic: !!_seed,
        seed: _seed
    };
}

// ============================================================
// ROLL HELPERS
// ============================================================

/**
 * Check if a roll is a success
 * @param {number} successes - Number of successes
 * @param {number} dv - Difficulty Value
 * @returns {boolean} True if success
 */
function isSuccess(successes, dv) {
    return successes >= dv;
}

/**
 * Get the outcome label for a roll
 * @param {number} successes - Number of successes
 * @param {number} dv - Difficulty Value
 * @param {number} storyBeats - Number of Story Beats
 * @returns {string} Outcome label
 */
function getOutcomeLabel(successes, dv, storyBeats = 0) {
    if (successes >= dv) {
        return storyBeats > 0 ? 'Success with SB' : 'Clean Success';
    } else if (successes > 0) {
        return 'Partial';
    } else {
        return 'Miss';
    }
}

/**
 * Get the outcome class for styling
 * @param {string} outcome - Outcome label
 * @returns {string} CSS class
 */
function getOutcomeClass(outcome) {
    const classes = {
        'Clean Success': 'clean-success',
        'Success with SB': 'success-with-sb',
        'Partial': 'partial',
        'Miss': 'miss'
    };
    return classes[outcome] || 'unknown';
}

/**
 * Get the color for an outcome
 * @param {string} outcome - Outcome label
 * @returns {string} CSS color
 */
function getOutcomeColor(outcome) {
    const colors = {
        'Clean Success': '#27ae60',
        'Success with SB': '#f1c40f',
        'Partial': '#e67e22',
        'Miss': '#e74c3c'
    };
    return colors[outcome] || '#95a5a6';
}

// ============================================================
// DICE POOL VISUALIZATION
// ============================================================

/**
 * Get a visual representation of dice results
 * @param {number[]} dice - Array of die results
 * @returns {string[]} Array of visual representations
 */
function visualizeDice(dice) {
    return dice.map(r => {
        if (r >= 6) return `[${r}✓]`;
        if (r === 1) return `[${r}⚠]`;
        return `[${r}]`;
    });
}

/**
 * Get dice HTML for display
 * @param {number[]} dice - Array of die results
 * @returns {string} HTML string
 */
function diceToHtml(dice) {
    return dice.map(r => {
        let className = 'die';
        if (r >= 6) className += ' success';
        if (r === 1) className += ' story-beat';
        if (r === 10) className += ' critical';
        return `<span class="${className}">${r}</span>`;
    }).join(' ');
}

// ============================================================
// EXPORTS
// ============================================================

// Named exports
export {
    Xorshift128,
    getSeed,
    setSeed,
    generateSeed,
    getRandom,
    getRandomInt,
    getRandomIntInclusive,
    rollDie,
    rollDice,
    rollPool,
    performDicePoolRoll,
    performRoll,
    isSuccess,
    getOutcomeLabel,
    getOutcomeClass,
    getOutcomeColor,
    visualizeDice,
    diceToHtml,
    ALL_SKILLS,
    defaultSkills,
    // NEW exports for outcome codes
    //OUTCOME_CODES,
    getRollOutcomeCode,
    getOutcomeLabelFromCode,
    // NEW exports for 10s-as-2-successes + critical detection
    countSuccesses,
    countTens,
    isCriticalRoll
};

// Default export for the module loader
export default {
    Xorshift128,
    getSeed,
    setSeed,
    generateSeed,
    getRandom,
    getRandomInt,
    getRandomIntInclusive,
    rollDie,
    rollDice,
    rollPool,
    performDicePoolRoll,
    performRoll,
    isSuccess,
    getOutcomeLabel,
    getOutcomeClass,
    getOutcomeColor,
    visualizeDice,
    diceToHtml,
    ALL_SKILLS,
    defaultSkills,
    OUTCOME_CODES,
    getRollOutcomeCode,
    getOutcomeLabelFromCode,
    countSuccesses,
    countTens,
    isCriticalRoll
};
