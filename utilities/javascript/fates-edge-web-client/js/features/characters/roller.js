/**
 * Character roller - Quick rolls for characters
 * UPDATED: Now follows Fate's Edge Player's Guide rules
 * - Uses guide's 16 core skills (unarmed, not brawl)
 * - Guide's outcome terminology (Clean Success, Success with SB, Partial, Miss)
 * - Position re-rolls (Dominant: re-roll failure, Desperate: re-roll success)
 * - 10s count as 2 successes with critical effects
 * - 1s generate Story Beats for GM
 * - Fatigue affects rolls (worsens Position or -1 die if Desperate)
 * - Harm affects rolls (-1 die at Harm 1, -2 dice at Harm 2, incapacitated at Harm 3)
 * - Boons gained on Partial (1) and Miss (2)
 * - Fatigue can substitute for Boons
 * - All 4 attributes and 16 skills selectable for creative combinations
 * - DV ladder labels (Routine, Default, Hard, Extreme)
 * - Assist dice support (up to +3 from allies)
 * - Effect tracking (Limited/Standard/Great)
 * - Regions match the guide's world chapter
 */

import { getCharacter, addRoll, saveState, getState } from '../../core/state.js';
import { performRoll } from '../../core/dice.js';
import { showToast } from '../../components/Toast.js';
import { escHtml, safeParseInt, clamp } from '../../core/utils.js';

// ============================================================
// GAME CONSTANTS (from Player's Guide)
// ============================================================

const ALL_SKILLS = [
    { name: 'Melee', attr: 'body', desc: 'Swords, axes, close-quarters weapons' },
    { name: 'Ranged', attr: 'wits', desc: 'Bows, crossbows, thrown weapons, firearms' },
    { name: 'Unarmed', attr: 'body', desc: 'Fistfighting, grappling, improvised brawling' },
    { name: 'Athletics', attr: 'body', desc: 'Running, climbing, jumping, swimming' },
    { name: 'Stealth', attr: 'wits', desc: 'Moving unseen, hiding, blending into shadows' },
    { name: 'Endurance', attr: 'body', desc: 'Resisting fatigue, harsh weather, poison, disease' },
    { name: 'Craft', attr: 'wits', desc: 'Building, repairing, creating tools, art, structures' },
    { name: 'Sway', attr: 'presence', desc: 'Persuasion, negotiation, charm' },
    { name: 'Deception', attr: 'presence', desc: 'Lying, bluffing, misdirection' },
    { name: 'Subterfuge', attr: 'wits', desc: 'Social infiltration, disguise, manipulation of information' },
    { name: 'Performance', attr: 'presence', desc: 'Entertainment, oration, acting, musical display' },
    { name: 'Insight', attr: 'spirit', desc: 'Reading emotions, detecting lies, understanding motives' },
    { name: 'Lore', attr: 'wits', desc: 'History, culture, religion, customs, general knowledge' },
    { name: 'Investigation', attr: 'wits', desc: 'Research, deduction, analysis of clues' },
    { name: 'Medicine', attr: 'wits', desc: 'Healing, anatomy, first aid, treatment' },
    { name: 'Arcana', attr: 'spirit', desc: 'Magic theory, rituals, mystical phenomena, free casting' }
];

const ATTRIBUTES = [
    { id: 'body', name: 'Body', desc: 'Physical strength, endurance, coordination' },
    { id: 'wits', name: 'Wits', desc: 'Mental acuity, perception, quick thinking' },
    { id: 'spirit', name: 'Spirit', desc: 'Willpower, intuition, mental resilience' },
    { id: 'presence', name: 'Presence', desc: 'Charisma, social influence, force of personality' }
];

const POSITIONS = [
    { id: 'dominant', label: 'Dominant', desc: 'You press your advantage. Re-roll one failure.', color: '#4caf50' },
    { id: 'controlled', label: 'Controlled', desc: 'Balanced norm. No re-rolls.', color: '#2196f3' },
    { id: 'desperate', label: 'Desperate', desc: 'You act under duress. Re-roll one success.', color: '#f44336' }
];

const DV_LADDER = [
    { value: 2, label: 'Routine', desc: 'Almost guaranteed' },
    { value: 3, label: 'Default', desc: 'A real challenge' },
    { value: 4, label: 'Hard', desc: 'Serious resistance' },
    { value: 5, label: 'Extreme', desc: 'A dramatic gamble' },
    { value: 6, label: 'Mythic', desc: 'Nearly impossible' }
];

const EFFECT_LEVELS = [
    { id: 'limited', label: 'Limited', desc: 'Reduced scope, shorter duration, partial result' },
    { id: 'standard', label: 'Standard', desc: 'Normal scope and impact' },
    { id: 'great', label: 'Great', desc: 'Maximum impact, full scope' }
];

const OUTCOME_TYPES = {
    'clean': { label: 'Clean Success', emoji: '✅', color: '#4caf50', desc: 'You achieve your goal without complication.' },
    'success_sb': { label: 'Success with SB', emoji: '⚡', color: '#ffc107', desc: 'You succeed, but the GM spends SB to add a twist.' },
    'partial': { label: 'Partial', emoji: '⚠️', color: '#ff9800', desc: 'You make progress, but the situation remains unresolved. Gain 1 Boon.' },
    'miss': { label: 'Miss', emoji: '❌', color: '#f44336', desc: 'You fail, and the situation escalates. Gain 2 Boons.' }
};

const BOON_SPEND_OPTIONS = [
    'Re-roll a single die (after seeing the result)',
    'Improve Position by 1 step before a roll',
    'Activate an on-screen Asset (1 Boon)',
    'Power certain Rites or abilities',
    'Convert to XP: 2 Boons → 1 XP (once/session during downtime, max 2 XP)'
];

const FATIGUE_RULES = 'Each Fatigue step worsens Position: Dominant → Controlled → Desperate. If already Desperate, apply −1 die per Fatigue instead. Taking Harm clears all Fatigue (the "roller-coaster" effect).';
const HARM_RULES = 'Harm 1: −1 die on related actions. Harm 2: −1 die on most actions. Harm 3: Incapacitated or dying.';
const OBLIGATION_RULES = 'Over capacity: 1 Fatigue per segment. Double capacity: clear Fatigue, mark Harm 1, trigger Patron Intrusion.';
const BOON_RULES = 'Max 5 held. At end of scene, reduce to 2 (excess lost). Earn 1 on Partial, 2 on Miss, 1 from Bonds (with intricate description).';

const FALLBACK_REGIONS = [
    'Acasia', 'Aelaerem', 'Aeler', 'Aelinnel', 'Black Banners', 'Ecktoria',
    'Linn', 'Mistlands', 'Silkstrand', 'Theona', 'Thepyrgos', 'Ubral',
    'Valewood', 'Vhasia', 'Viterra', 'Ykrul', 'Zakov', 'Vilikari',
    'Kahfagia', 'Fhara', 'Pereshi', 'Kuvani', 'Tulkani', 'Ashaan',
    'Sekogo', 'Taharka', 'Sidhi', 'Ngomebe', 'Dhahara', 'Oshiira'
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
    },
    'kahfagia': {
        prefixes: ['Ba', 'Be', 'Da', 'De', 'Fa', 'Fe', 'Ga', 'Ge', 'Ha', 'He', 'Ja', 'Ka', 'Ke', 'La', 'Le', 'Ma', 'Me', 'Na', 'Ra', 'Sa'],
        suffixes: ['a', 'ar', 'ed', 'i', 'im', 'ir', 'o', 'om', 'or', 'u', 'ud', 'ur']
    },
    'linn': {
        prefixes: ['Ae', 'Bj', 'Ei', 'Fro', 'Ha', 'Iv', 'Jo', 'Ka', 'La', 'Ma', 'No', 'Ol', 'Ror', 'Sig', 'Ste', 'Tor', 'Ulf', 'Val', 'Yr', 'Asg'],
        suffixes: ['a', 'd', 'e', 'i', 'k', 'n', 'r', 's', 't', 'v']
    }
};

// ============================================================
// STATE
// ============================================================

let container = null;
let selectedRegion = null;
let regionNames = [];
let isReady = false;
let keyboardShortcutHandler = null;

// ============================================================
// REGION MANAGEMENT
// ============================================================

async function loadRegions() {
    try {
        const decksModule = await import('../decks/index.js');
        if (decksModule.getRegionNames && decksModule.getSelectedRegion) {
            const names = decksModule.getRegionNames();
            if (names && names.length > 0) {
                regionNames = names;
                selectedRegion = decksModule.getSelectedRegion() || names[0];
                return true;
            }
        }
    } catch (e) {
        console.warn('[CharacterRoller] Could not load decks module:', e);
    }
    
    regionNames = FALLBACK_REGIONS;
    selectedRegion = regionNames[0];
    return true;
}

function getRandomRegion() {
    if (regionNames.length === 0) return 'Acasia';
    return regionNames[Math.floor(Math.random() * regionNames.length)];
}

function generateRegionName(region = null) {
    const regionKey = (region || selectedRegion || getRandomRegion()).toLowerCase();
    const style = REGION_NAME_STYLES[regionKey] || REGION_NAME_STYLES['acasia'];
    
    const prefix = style.prefixes[Math.floor(Math.random() * style.prefixes.length)];
    const suffix = style.suffixes[Math.floor(Math.random() * style.suffixes.length)];
    
    return prefix + suffix;
}

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
    
    while (names.length < count) {
        names.push(`Character_${names.length + 1}`);
    }
    
    return names;
}

// ============================================================
// FATE'S EDGE DICE MECHANICS
// ============================================================

/**
 * Determine the outcome type based on successes, DV, and story beats
 */
function determineOutcome(successes, dv, storyBeats) {
    if (successes === 0) return 'miss';
    if (successes < dv) return 'partial';
    if (storyBeats > 0) return 'success_sb';
    return 'clean';
}

/**
 * Calculate boons gained based on outcome
 */
function calculateBoonsGained(outcome) {
    if (outcome === 'partial') return 1;
    if (outcome === 'miss') return 2;
    return 0;
}

/**
 * Get the effective position after fatigue adjustments
 */
function getEffectivePosition(basePosition, fatigue, fatigueMax) {
    if (!fatigue || fatigue === 0) return basePosition;
    
    const order = ['dominant', 'controlled', 'desperate'];
    let idx = order.indexOf(basePosition);
    
    for (let i = 0; i < fatigue; i++) {
        if (idx < order.length - 1) {
            idx++;
        }
    }
    
    return order[idx];
}

/**
 * Calculate dice pool with all modifiers
 */
function calculateDicePool(attr, skill, options = {}) {
    const {
        fatigue = 0,
        fatigueMax = 0,
        harm = 0,
        position = 'controlled',
        assistDice = 0,
        boonDice = 0
    } = options;
    
    let pool = attr + skill;
    let diceModifiers = [];
    let positionAfterFatigue = position;
    let fatiguePenalty = 0;
    
    // Fatigue: worsens position or -1 die if already desperate
    if (fatigue > 0) {
        positionAfterFatigue = getEffectivePosition(position, fatigue, fatigueMax);
        if (positionAfterFatigue === 'desperate' && position === 'desperate') {
            // Already desperate: -1 die per fatigue beyond what worsened position
            const fatigueOverDesperate = fatigue - (2 - order_index(position));
            if (fatigueOverDesperate > 0) {
                fatiguePenalty = fatigueOverDesperate;
                pool -= fatiguePenalty;
                diceModifiers.push(`Fatigue: −${fatiguePenalty}d`);
            }
        }
        if (positionAfterFatigue !== position) {
            diceModifiers.push(`Fatigue: ${position} → ${positionAfterFatigue}`);
        }
    }
    
    // Harm penalties
    if (harm === 1) {
        pool -= 1;
        diceModifiers.push('Harm 1: −1d');
    } else if (harm === 2) {
        pool -= 2;
        diceModifiers.push('Harm 2: −2d');
    } else if (harm >= 3) {
        return { pool: 0, diceModifiers: ['Harm 3: Incapacitated'], positionAfterFatigue, incapacitated: true };
    }
    
    // Assist dice (max +3 from all sources)
    const assist = Math.min(assistDice, 3);
    if (assist > 0) {
        pool += assist;
        diceModifiers.push(`Assist: +${assist}d`);
    }
    
    // Boon-spent dice (re-rolls are handled separately, but pre-roll boon spent on +1d)
    if (boonDice > 0) {
        pool += boonDice;
        diceModifiers.push(`Boon: +${boonDice}d`);
    }
    
    pool = Math.max(0, pool);
    
    return { pool, diceModifiers, positionAfterFatigue, incapacitated: false };
}

function order_index(position) {
    const order = ['dominant', 'controlled', 'desperate'];
    return order.indexOf(position);
}

/**
 * Count successes, story beats, and handle 10s
 */
function countResults(dice) {
    let successes = 0;
    let storyBeats = 0;
    let tens = 0;
    let failures = 0;
    
    for (const die of dice) {
        if (die === 10) {
            successes += 2; // 10 counts as 2 successes
            tens++;
        } else if (die >= 6) {
            successes += 1;
        } else if (die === 1) {
            storyBeats += 1; // 1s give SB to GM
        } else {
            failures++;
        }
    }
    
    return { successes, storyBeats, tens, failures };
}

/**
 * Apply position re-rolls
 * Dominant: re-roll one failure
 * Desperate: re-roll one success
 */
function applyPositionRerolls(dice, position) {
    let reRolledDice = [];
    let workingDice = [...dice];
    
    if (position === 'dominant') {
        // Re-roll one failure (2-5, not 1)
        const failIdx = workingDice.findIndex(d => d >= 2 && d <= 5);
        if (failIdx >= 0) {
            const oldVal = workingDice[failIdx];
            const newVal = Math.floor(Math.random() * 10) + 1;
            workingDice[failIdx] = newVal;
            reRolledDice.push({ index: failIdx, old: oldVal, new: newVal });
        }
    } else if (position === 'desperate') {
        // Re-roll one success (6-9, not 10 — 10s are never re-rolled)
        const successIdx = workingDice.findIndex(d => d >= 6 && d <= 9);
        if (successIdx >= 0) {
            const oldVal = workingDice[successIdx];
            const newVal = Math.floor(Math.random() * 10) + 1;
            workingDice[successIdx] = newVal;
            reRolledDice.push({ index: successIdx, old: oldVal, new: newVal });
        }
    }
    
    // Note: 10s are NEVER re-rolled, even by Position effects
    return { dice: workingDice, reRolledDice };
}

// ============================================================
// CORE ROLL FUNCTION
// ============================================================

function executeRoll(attr, skill, dv, position, boonsSpent, characterData = {}) {
    const { fatigue = 0, fatigueMax = 0, harm = 0, assistDice = 0 } = characterData;
    
    // Calculate pool with modifiers
    const poolInfo = calculateDicePool(attr, skill, {
        fatigue, fatigueMax, harm, position, assistDice
    });
    
    if (poolInfo.incapacitated) {
        return {
            outcome: 'miss',
            incapacitated: true,
            dice: [],
            successes: 0,
            storyBeats: 0,
            tens: 0,
            pool: 0,
            position: position,
            effectivePosition: position,
            diceModifiers: poolInfo.diceModifiers,
            boonsGained: 2,
            note: 'Character is incapacitated (Harm 3)'
        };
    }
    
    const pool = poolInfo.pool;
    if (pool < 1) {
        return null;
    }
    
    // Roll dice
    const rawDice = [];
    for (let i = 0; i < pool; i++) {
        rawDice.push(Math.floor(Math.random() * 10) + 1);
    }
    
    // Apply position re-rolls
    const { dice, reRolledDice } = applyPositionRerolls(rawDice, poolInfo.positionAfterFatigue);
    
    // Count results
    const counts = countResults(dice);
    
    // Determine outcome
    const outcome = determineOutcome(counts.successes, dv, counts.storyBeats);
    const boonsGained = calculateBoonsGained(outcome);
    
    // Critical success effects from 10s
    let criticalEffect = null;
    if (counts.tens > 0 && counts.successes >= dv) {
        if (counts.tens === 1) {
            criticalEffect = 'Strong success — improve your Position by one step on your next action this scene, or gain a minor advantage.';
        } else if (counts.tens === 2) {
            criticalEffect = 'Exceptional success — choose two benefits from the list above.';
        } else if (counts.tens === 3) {
            criticalEffect = 'Legendary success — decisive victory; clear 1 segment from a relevant timer.';
        } else if (counts.tens >= 4) {
            criticalEffect = 'Mythic success — reshape the scene; clear 1–2 segments from a relevant timer.';
        }
    }
    
    return {
        outcome,
        dice: dice.sort((a, b) => b - a),
        rawDice,
        successes: counts.successes,
        storyBeats: counts.storyBeats,
        tens: counts.tens,
        failures: counts.failures,
        pool,
        position: position,
        effectivePosition: poolInfo.positionAfterFatigue,
        reRolledDice,
        diceModifiers: poolInfo.diceModifiers,
        boonsGained,
        boonsSpent: boonsSpent || 0,
        criticalEffect,
        dv
    };
}

// ============================================================
// CHARACTER ROLLS
// ============================================================

export function rollForCharacter(id, options = {}) {
    const c = getCharacter(id);
    if (!c) {
        showToast('Character not found.', 'error');
        return null;
    }
    
    const {
        dv = 3,
        position = 'controlled',
        boons = 0,
        note = '',
        silent = false,
        skillOverride = null,
        attrOverride = null,
        useFatigue = true,
        useHarm = true,
        assistDice = 0
    } = options;
    
    // Check for incapacitation
    if (useHarm && (c.harm || 0) >= 3) {
        if (!silent) showToast(`${c.name} is incapacitated (Harm 3) and cannot act.`, 'error');
        return null;
    }
    
    let attr, skill;
    let attrName = '', skillName = '';
    
    if (attrOverride != null && skillOverride != null) {
        attr = clamp(safeParseInt(attrOverride, 3), 1, 5);
        skill = clamp(safeParseInt(skillOverride, 0), 0, 5);
    } else {
        // Auto-detect based on highest combat skill
        const skills = c.skills || {};
        const combatSkills = {
            melee: { attr: 'body', name: 'Melee' },
            ranged: { attr: 'wits', name: 'Ranged' },
            unarmed: { attr: 'body', name: 'Unarmed' }
        };
        
        let bestSkill = null;
        let bestLevel = 0;
        for (const [key, info] of Object.entries(combatSkills)) {
            const level = skills[key] || 0;
            if (level > bestLevel) {
                bestLevel = level;
                bestSkill = { key, ...info };
            }
        }
        
        if (bestSkill && bestLevel > 0) {
            attr = c[bestSkill.attr] || 3;
            skill = bestLevel;
            attrName = bestSkill.attr;
            skillName = bestSkill.name;
        } else {
            // Fall back to highest attribute + highest skill
            const attrs = { body: c.body || 1, wits: c.wits || 1, spirit: c.spirit || 1, presence: c.presence || 1 };
            let maxAttr = 'wits';
            for (const [k, v] of Object.entries(attrs)) {
                if (v > attrs[maxAttr]) maxAttr = k;
            }
            attr = attrs[maxAttr];
            attrName = maxAttr;
            
            let maxSkill = 0;
            for (const s of ALL_SKILLS) {
                const level = skills[s.name.toLowerCase()] || 0;
                if (level > maxSkill) {
                    maxSkill = level;
                    skillName = s.name;
                }
            }
            skill = maxSkill;
        }
    }
    
    // Get character status
    const charData = {
        fatigue: useFatigue ? (c.fatigue || 0) : 0,
        fatigueMax: c.body || 1,
        harm: useHarm ? (c.harm || 0) : 0,
        assistDice: assistDice
    };
    
    try {
        const result = executeRoll(attr, skill, dv, position, boons, charData);
        if (!result) {
            if (!silent) showToast('Roll failed: dice pool must be at least 1 die.', 'error');
            return null;
        }
        
        // Add metadata
        result.characterId = id;
        result.characterName = c.name;
        result.attrUsed = attr;
        result.skillUsed = skill;
        result.attrName = attrName;
        result.skillName = skillName;
        result.note = note || `${c.name} rolls ${attrName}+${skillName}`;
        result.timestamp = Date.now();
        
        // Store in history
        addRoll(result);
        saveState();
        
        // Update character boons if gained
        if (result.boonsGained > 0) {
            const newBoons = Math.min(5, (c.boons || 0) + result.boonsGained);
            updateCharacter(id, { boons: newBoons });
        }
        
        const msg = buildRollMessage(c.name, result, attr, skill, dv, position, attrName, skillName);
        
        if (!silent) {
            sendToVTT(msg, result);
            const outcomeType = OUTCOME_TYPES[result.outcome] || OUTCOME_TYPES['miss'];
            let toastMsg = `${c.name}: ${outcomeType.label}`;
            if (result.boonsGained > 0) toastMsg += ` (+${result.boonsGained} Boons)`;
            if (result.storyBeats > 0) toastMsg += ` | ${result.storyBeats} SB to GM`;
            if (result.tens > 0 && result.successes >= dv) toastMsg += ` | ${result.tens}×10!`;
            showToast(toastMsg, result.outcome === 'clean' || result.outcome === 'success_sb' ? 'success' : 'warning');
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

export function rollForNPC(npc, options = {}) {
    if (!npc || !npc.name) {
        showToast('Invalid NPC data.', 'error');
        return null;
    }
    
    const {
        dv = 3,
        position = 'controlled',
        boons = 0,
        note = '',
        silent = false,
        skillOverride = null,
        attrOverride = null
    } = options;
    
    let attr, skill;
    
    if (attrOverride != null && skillOverride != null) {
        attr = clamp(safeParseInt(attrOverride, 3), 1, 5);
        skill = clamp(safeParseInt(skillOverride, 0), 0, 5);
    } else {
        const skills = npc.skills || {};
        const combat = Math.max(
            skills.melee || 0,
            skills.ranged || 0,
            skills.unarmed || 0
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
        const result = executeRoll(attr, skill, dv, position, boons, {});
        if (!result) return null;
        
        result.npcName = npc.name;
        result.note = note || `NPC ${npc.name} roll`;
        result.timestamp = Date.now();
        
        const msg = buildRollMessage(`NPC ${npc.name}`, result, attr, skill, dv, position, '', '');
        
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

export function customRoll(config = {}) {
    const {
        attr = 3,
        skill = 0,
        dv = 3,
        position = 'controlled',
        boons = 0,
        note = 'Custom roll',
        silent = false,
        attrName = '',
        skillName = '',
        fatigue = 0,
        harm = 0,
        assistDice = 0
    } = config;
    
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
        const result = executeRoll(attr, skill, dv, position, boons, { fatigue, harm, assistDice });
        if (!result) {
            if (!silent) showToast('Roll failed: dice pool must be at least 1 die.', 'error');
            return null;
        }
        
        result.note = note;
        result.timestamp = Date.now();
        result.isCustom = true;
        result.attrUsed = attr;
        result.skillUsed = skill;
        result.attrName = attrName;
        result.skillName = skillName;
        
        addRoll(result);
        saveState();
        
        const msg = buildRollMessage('Custom', result, attr, skill, dv, position, attrName, skillName);
        
        if (!silent) {
            sendToVTT(msg, result);
            const outcomeType = OUTCOME_TYPES[result.outcome] || OUTCOME_TYPES['miss'];
            let toastMsg = `${outcomeType.label}`;
            if (result.boonsGained > 0) toastMsg += ` (+${result.boonsGained} Boons)`;
            if (result.storyBeats > 0) toastMsg += ` | ${result.storyBeats} SB to GM`;
            showToast(toastMsg, result.outcome === 'clean' || result.outcome === 'success_sb' ? 'success' : 'warning');
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
        const cleanCount = results.filter(r => r.outcome === 'clean' || r.outcome === 'success_sb').length;
        const partialCount = results.filter(r => r.outcome === 'partial').length;
        const missCount = results.filter(r => r.outcome === 'miss').length;
        const totalSB = results.reduce((sum, r) => sum + (r.storyBeats || 0), 0);
        const totalBoons = results.reduce((sum, r) => sum + (r.boonsGained || 0), 0);
        
        showToast(
            `Rolled for ${results.length}: ${cleanCount} success, ${partialCount} partial, ${missCount} miss | ${totalSB} SB to GM, +${totalBoons} Boons`,
            'info'
        );
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
    
    const attrOptions = ATTRIBUTES.map(a => 
        `<option value="${a.id}">${a.name} — ${a.desc}</option>`
    ).join('');
    
    const skillOptions = ALL_SKILLS.map(s => 
        `<option value="${s.name.toLowerCase()}" data-attr="${s.attr}">${s.name} (${s.attr}) — ${s.desc}</option>`
    ).join('');
    
    const positionOptions = POSITIONS.map(p => 
        `<option value="${p.id}" ${p.id === 'controlled' ? 'selected' : ''}>${p.label} — ${p.desc}</option>`
    ).join('');
    
    const dvOptions = DV_LADDER.map(d => 
        `<option value="${d.value}" ${d.value === 3 ? 'selected' : ''}>DV ${d.value}: ${d.label} — ${d.desc}</option>`
    ).join('');
    
    const effectOptions = EFFECT_LEVELS.map(e => 
        `<option value="${e.id}" ${e.id === 'standard' ? 'selected' : ''}>${e.label} — ${e.desc}</option>`
    ).join('');
    
    container.innerHTML = `
        <div class="roller-container">
            <!-- Quick Roll Panel -->
            <div class="panel">
                <h3 style="margin-top:0;">🎲 Quick Roll — Fate's Edge</h3>
                <div class="info-box" style="background:var(--bg2);padding:0.6rem 0.8rem;border-radius:6px;border-left:3px solid var(--gold);margin-bottom:0.8rem;font-size:0.8rem;color:var(--text2);">
                    <strong>Dice Pool = Attribute + Skill</strong> (d10s). 
                    <strong>6+</strong> = 1 success. <strong>10</strong> = 2 successes. 
                    <strong>1</strong> = Story Beat for GM.<br>
                    <strong>Position:</strong> Dominant (re-roll failure), Controlled (normal), Desperate (re-roll success).<br>
                    <strong>Outcomes:</strong> Clean Success (S≥DV, no SB), Success with SB (S≥DV, SB>0), Partial (0<S<DV, +1 Boon), Miss (S=0, +2 Boons).
                </div>
                
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:0.5rem;">
                    <div class="field">
                        <label>Attribute</label>
                        <select id="roller-attr-select">${attrOptions}</select>
                    </div>
                    <div class="field">
                        <label>Attr Value (1-5)</label>
                        <input type="number" id="roller-attr" value="3" min="1" max="5" />
                    </div>
                    <div class="field">
                        <label>Skill</label>
                        <select id="roller-skill-select">${skillOptions}</select>
                    </div>
                    <div class="field">
                        <label>Skill Value (0-5)</label>
                        <input type="number" id="roller-skill" value="0" min="0" max="5" />
                    </div>
                    <div class="field">
                        <label>DV</label>
                        <select id="roller-dv-select">${dvOptions}</select>
                    </div>
                    <div class="field">
                        <label>Position</label>
                        <select id="roller-position">${positionOptions}</select>
                    </div>
                    <div class="field">
                        <label>Boons to Spend</label>
                        <input type="number" id="roller-boons" value="0" min="0" max="5" title="Pre-roll boon spend (e.g., +1d from boon)" />
                    </div>
                    <div class="field">
                        <label>Assist Dice</label>
                        <input type="number" id="roller-assist" value="0" min="0" max="3" title="Up to 3 allies add +1d each" />
                    </div>
                    <div class="field">
                        <label>Fatigue</label>
                        <input type="number" id="roller-fatigue" value="0" min="0" max="5" title="Worsens Position; if Desperate, -1d per Fatigue" />
                    </div>
                    <div class="field">
                        <label>Harm (0-3)</label>
                        <input type="number" id="roller-harm" value="0" min="0" max="3" title="Harm 1: -1d, Harm 2: -2d, Harm 3: Incapacitated" />
                    </div>
                    <div class="field">
                        <label>Effect</label>
                        <select id="roller-effect">${effectOptions}</select>
                    </div>
                </div>
                
                <div style="display:flex;gap:0.5rem;margin-top:0.8rem;flex-wrap:wrap;">
                    <button class="btn btn-gold" id="roller-roll-btn">🎲 Roll Dice</button>
                    <button class="btn btn-secondary" id="roller-generate-npc-btn">👤 Generate NPC Name</button>
                    <button class="btn btn-secondary" id="roller-generate-names-btn">📋 Generate Names</button>
                </div>
                
                <!-- Rules Quick Reference -->
                <details style="margin-top:0.8rem;">
                    <summary style="cursor:pointer;font-size:0.85rem;color:var(--text2);">📖 Rules Quick Reference</summary>
                    <div style="padding:0.5rem;font-size:0.8rem;color:var(--text3);">
                        <p><strong>DV Ladder:</strong> 2 (Routine) | 3 (Default) | 4 (Hard) | 5 (Extreme) | 6+ (Mythic)</p>
                        <p><strong>Position:</strong> ${POSITIONS.map(p => `${p.label} (${p.desc})`).join(' | ')}</p>
                        <p><strong>10s (Critical):</strong> 1×10: improve Position next action. 2×10: choose two benefits. 3×10: clear 1 timer segment. 4+×10: reshape scene. 10s are never re-rolled.</p>
                        <p><strong>Boons (max 5):</strong> ${BOON_SPEND_OPTIONS.join(' | ')}. Reduce to 2 at scene end.</p>
                        <p><strong>Earning Boons:</strong> Partial → +1 Boon. Miss → +2 Boons. Bond action (intricate description) → +1 Boon. GM award (rare).</p>
                        <p><strong>Fatigue:</strong> ${FATIGUE_RULES}</p>
                        <p><strong>Harm:</strong> ${HARM_RULES}</p>
                        <p><strong>Fatigue-as-Boon:</strong> If no Boons remaining, pay 1 Fatigue in place of 1 Boon (GM may veto).</p>
                    </div>
                </details>
            </div>
            
            <!-- Roll Result Panel -->
            <div class="panel" id="roller-result-panel" style="display:none;">
                <h3 id="roller-result-title">Roll Result</h3>
                <div id="roller-result-content"></div>
            </div>
            
            <!-- Name Generation Panel -->
            <div class="panel" id="roller-name-panel" style="display:none;">
                <h3>📋 Region Names</h3>
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
    const regionSelect = document.getElementById('roller-region-select');
    if (regionSelect) {
        regionSelect.addEventListener('change', () => {
            selectedRegion = regionSelect.value;
            import('../decks/index.js').then(module => {
                if (module.setSelectedRegion) module.setSelectedRegion(selectedRegion);
            }).catch(() => {});
        });
    }
    
    // Auto-set attribute value when attribute is selected
    const attrSelect = document.getElementById('roller-attr-select');
    const attrInput = document.getElementById('roller-attr');
    if (attrSelect && attrInput) {
        attrSelect.addEventListener('change', () => {
            const attrId = attrSelect.value;
            // Try to get value from active character
            const state = getState();
            const activeChar = state.characters?.find(c => c.active !== false);
            if (activeChar && activeChar[attrId]) {
                attrInput.value = activeChar[attrId];
            }
        });
    }
    
    // Auto-set skill value when skill is selected
    const skillSelect = document.getElementById('roller-skill-select');
    const skillInput = document.getElementById('roller-skill');
    if (skillSelect && skillInput) {
        skillSelect.addEventListener('change', () => {
            const skillKey = skillSelect.value;
            const state = getState();
            const activeChar = state.characters?.find(c => c.active !== false);
            if (activeChar && activeChar.skills && activeChar.skills[skillKey] != null) {
                skillInput.value = activeChar.skills[skillKey];
            }
            // Auto-set matching attribute
            const selectedOption = skillSelect.selectedOptions[0];
            if (selectedOption) {
                const skillAttr = selectedOption.dataset.attr;
                if (skillAttr && attrSelect) {
                    attrSelect.value = skillAttr;
                    if (attrInput) {
                        const activeChar = state.characters?.find(c => c.active !== false);
                        if (activeChar && activeChar[skillAttr]) {
                            attrInput.value = activeChar[skillAttr];
                        }
                    }
                }
            }
        });
    }
    
    const rollBtn = document.getElementById('roller-roll-btn');
    if (rollBtn) rollBtn.addEventListener('click', handleRollerRoll);
    
    const genNpcBtn = document.getElementById('roller-generate-npc-btn');
    if (genNpcBtn) genNpcBtn.addEventListener('click', handleGenerateNPC);
    
    const genNamesBtn = document.getElementById('roller-generate-names-btn');
    if (genNamesBtn) genNamesBtn.addEventListener('click', handleGenerateNames);
}

function handleRollerRoll() {
    const attr = safeParseInt(document.getElementById('roller-attr')?.value, 3);
    const skill = safeParseInt(document.getElementById('roller-skill')?.value, 0);
    const dv = safeParseInt(document.getElementById('roller-dv-select')?.value, 3);
    const position = document.getElementById('roller-position')?.value || 'controlled';
    const boons = safeParseInt(document.getElementById('roller-boons')?.value, 0);
    const assistDice = safeParseInt(document.getElementById('roller-assist')?.value, 0);
    const fatigue = safeParseInt(document.getElementById('roller-fatigue')?.value, 0);
    const harm = safeParseInt(document.getElementById('roller-harm')?.value, 0);
    
    const attrSelect = document.getElementById('roller-attr-select');
    const skillSelect = document.getElementById('roller-skill-select');
    const attrName = attrSelect?.selectedOptions[0]?.text?.split('—')[0]?.trim() || '';
    const skillName = skillSelect?.selectedOptions[0]?.text?.split('(')[0]?.trim() || '';
    
    const note = `Quick roll: ${attrName}+${skillName} (${selectedRegion || 'Acasia'})`;
    
    const result = customRoll({
        attr, skill, dv, position, boons, note, silent: false,
        attrName, skillName, fatigue, harm, assistDice
    });
    
    if (result) displayRollResult(result, attrName, skillName);
}

function handleGenerateNPC() {
    const region = selectedRegion || getRandomRegion();
    const name = generateRegionName(region);
    showToast(`👤 Generated NPC: ${name} (${region})`, 'success');
    
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
                <div style="color:var(--text3);font-size:0.8rem;margin-top:0.3rem;">Click "Generate Names" for more options from this region.</div>
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
        
        const title = panel.querySelector('h3');
        if (title) title.textContent = `📋 Region Names (${region})`;
    }
}

// ============================================================
// ROLL RESULT DISPLAY
// ============================================================

function displayRollResult(result, attrName = '', skillName = '') {
    const panel = document.getElementById('roller-result-panel');
    const content = document.getElementById('roller-result-content');
    const title = document.getElementById('roller-result-title');
    
    if (!panel || !content || !title) return;
    
    panel.style.display = 'block';
    title.textContent = '🎲 Roll Result';
    
    const outcomeType = OUTCOME_TYPES[result.outcome] || OUTCOME_TYPES['miss'];
    
    // Build dice display with color coding
    const diceDisplay = (result.dice || []).map(d => {
        let color, label;
        if (d === 10) { color = '#e91e63'; label = `${d} (×2!)`; }
        else if (d >= 6) { color = '#4caf50'; label = `${d} ✓`; }
        else if (d === 1) { color = '#f44336'; label = `${d} SB`; }
        else { color = '#666'; label = `${d}`; }
        
        const wasReRolled = result.reRolledDice?.some(r => r.new === d);
        return `<span style="display:inline-block;padding:0.2rem 0.4rem;margin:0.1rem;border-radius:4px;background:${color}33;border:1px solid ${color};color:${color};font-weight:${d === 10 || d >= 6 ? '600' : '400'};${wasReRolled ? 'box-shadow:0 0 4px var(--gold);' : ''}" title="${wasReRolled ? 'Re-rolled' : ''}">${label}</span>`;
    }).join(' ');
    
    // Position display
    const posInfo = POSITIONS.find(p => p.id === result.position) || POSITIONS[1];
    const effectivePosInfo = POSITIONS.find(p => p.id === result.effectivePosition) || posInfo;
    const positionChanged = result.position !== result.effectivePosition;
    
    // Re-roll info
    let reRollHtml = '';
    if (result.reRolledDice && result.reRolledDice.length > 0) {
        reRollHtml = `
            <div style="margin-top:0.3rem;font-size:0.8rem;color:var(--text2);">
                <strong>Re-rolls (${effectivePosInfo.label}):</strong>
                ${result.reRolledDice.map(r => 
                    `<span style="color:var(--text3);text-decoration:line-through;">${r.old}</span> → <span style="color:var(--gold);">${r.new}</span>`
                ).join(', ')}
            </div>
        `;
    }
    
    // Critical effect
    let criticalHtml = '';
    if (result.criticalEffect) {
        criticalHtml = `
            <div style="margin-top:0.4rem;padding:0.4rem 0.6rem;border-radius:4px;background:rgba(233,30,99,0.15);border:1px solid #e91e63;font-size:0.8rem;">
                <strong style="color:#e91e63;">💥 Critical (${result.tens}×10):</strong> ${escHtml(result.criticalEffect)}
            </div>
        `;
    }
    
    // Dice modifiers
    let modifiersHtml = '';
    if (result.diceModifiers && result.diceModifiers.length > 0) {
        modifiersHtml = `
            <div style="margin-top:0.3rem;font-size:0.75rem;color:var(--text3);">
                <strong>Modifiers:</strong> ${result.diceModifiers.join(' | ')}
            </div>
        `;
    }
    
    // Boons gained
    let boonsGainedHtml = '';
    if (result.boonsGained > 0) {
        boonsGainedHtml = `
            <div style="margin-top:0.3rem;padding:0.3rem 0.6rem;border-radius:4px;background:rgba(255,193,7,0.15);border:1px solid var(--gold);font-size:0.85rem;">
                <strong style="color:var(--gold);">⭐ Gained ${result.boonsGained} Boon${result.boonsGained > 1 ? 's' : ''}</strong>
                ${result.outcome === 'partial' ? '(Partial Success)' : '(Miss)'}
            </div>
        `;
    }
    
    // Story Beats
    let sbHtml = '';
    if (result.storyBeats > 0) {
        sbHtml = `
            <div style="margin-top:0.3rem;padding:0.3rem 0.6rem;border-radius:4px;background:rgba(244,67,54,0.1);border:1px solid #f44336;font-size:0.85rem;">
                <strong style="color:#f44336;">📜 GM gains ${result.storyBeats} Story Beat${result.storyBeats > 1 ? 's' : ''}</strong>
                — SB fuel complications, timers, and twists.
            </div>
        `;
    }
    
    // Incapacitated
    let incapHtml = '';
    if (result.incapacitated) {
        incapHtml = `
            <div style="padding:0.5rem;border-radius:4px;background:rgba(244,67,54,0.2);border:1px solid #f44336;font-size:0.9rem;">
                <strong style="color:#f44336;">💀 Incapacitated (Harm 3)</strong> — Character cannot act.
            </div>
        `;
    }
    
    content.innerHTML = `
        <div style="background:var(--bg3);padding:1rem;border-radius:var(--radius);border-left:4px solid ${outcomeType.color};">
            <!-- Outcome Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                <div>
                    <span style="font-size:1.5rem;">${outcomeType.emoji}</span>
                    <strong style="font-size:1.2rem;color:${outcomeType.color};">${outcomeType.label.toUpperCase()}</strong>
                </div>
                <div style="font-size:0.85rem;color:var(--text3);text-align:right;">
                    ${attrName && skillName ? `${attrName}+${skillName} = ${result.pool}d` : `${result.pool}d`} vs DV ${result.dv}<br>
                    Position: ${posInfo.label}${positionChanged ? ` → <span style="color:${effectivePosInfo.color};">${effectivePosInfo.label}</span> <small>(fatigue)</small>` : ''}
                </div>
            </div>
            <div style="font-size:0.85rem;color:var(--text2);margin-top:0.2rem;">${outcomeType.desc}</div>
            
            ${incapHtml}
            
            <!-- Dice Display -->
            ${!result.incapacitated ? `
                <div style="margin-top:0.6rem;padding:0.5rem;background:var(--bg2);border-radius:6px;">
                    <div style="font-size:0.8rem;color:var(--text3);margin-bottom:0.3rem;">
                        Dice (${result.pool}d10): <span style="color:#4caf50;">green = success</span> · 
                        <span style="color:#e91e63;">pink = 10 (×2)</span> · 
                        <span style="color:#f44336;">red = 1 (SB)</span> · 
                        <span style="color:#666;">gray = nothing</span>
                    </div>
                    <div style="font-size:1rem;line-height:2;">${diceDisplay}</div>
                    ${reRollHtml}
                    ${modifiersHtml}
                </div>
            ` : ''}
            
            <!-- Stats Grid -->
            ${!result.incapacitated ? `
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:0.4rem;margin-top:0.5rem;">
                    <div style="text-align:center;padding:0.3rem;background:var(--bg2);border-radius:4px;">
                        <div style="font-size:0.7rem;color:var(--text3);">Successes</div>
                        <div style="font-size:1.3rem;font-weight:700;color:${result.successes >= result.dv ? '#4caf50' : '#ff9800'};">${result.successes}</div>
                    </div>
                    <div style="text-align:center;padding:0.3rem;background:var(--bg2);border-radius:4px;">
                        <div style="font-size:0.7rem;color:var(--text3);">Story Beats</div>
                        <div style="font-size:1.3rem;font-weight:700;color:#f44336;">${result.storyBeats}</div>
                    </div>
                    <div style="text-align:center;padding:0.3rem;background:var(--bg2);border-radius:4px;">
                        <div style="font-size:0.7rem;color:var(--text3);">Tens (×2)</div>
                        <div style="font-size:1.3rem;font-weight:700;color:#e91e63;">${result.tens}</div>
                    </div>
                    <div style="text-align:center;padding:0.3rem;background:var(--bg2);border-radius:4px;">
                        <div style="font-size:0.7rem;color:var(--text3);">DV</div>
                        <div style="font-size:1.3rem;font-weight:700;color:var(--gold);">${result.dv}</div>
                    </div>
                </div>
            ` : ''}
            
            ${criticalHtml}
            ${boonsGainedHtml}
            ${sbHtml}
            
            ${result.note ? `<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--text3);"><strong>Note:</strong> ${escHtml(result.note)}</div>` : ''}
        </div>
    `;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function buildRollMessage(name, result, attr, skill, dv, position, attrName = '', skillName = '') {
    const outcomeType = OUTCOME_TYPES[result.outcome] || OUTCOME_TYPES['miss'];
    const diceStr = result.dice ? result.dice.join(' ') : '[]';
    
    let msg = `[${outcomeType.label}] ${name}: ${attrName || attr}+${skillName || skill} vs DV${dv} (${position}) → `;
    msg += diceStr;
    msg += ` | S:${result.successes || 0} SB:${result.storyBeats || 0}`;
    
    if (result.tens > 0) msg += ` 10s:${result.tens}`;
    if (result.reRolledDice && result.reRolledDice.length > 0) {
        msg += ` | Rerolls: ${result.reRolledDice.map(r => `${r.old}→${r.new}`).join(', ')}`;
    }
    if (result.boonsGained > 0) msg += ` | +${result.boonsGained} Boons`;
    if (result.criticalEffect) msg += ` | CRIT!`;
    
    if (result.note) msg += ` — ${result.note}`;
    
    return msg;
}

function sendToVTT(message, result) {
    import('../vtt/index.js')
        .then(module => {
            if (module.addChatMessage && typeof module.addChatMessage === 'function') {
                module.addChatMessage({
                    text: message,
                    sender: 'Roll',
                    rollData: {
                        outcome: result.outcome,
                        outcomeLabel: OUTCOME_TYPES[result.outcome]?.label || result.outcome,
                        dice: result.dice,
                        successes: result.successes,
                        storyBeats: result.storyBeats || 0,
                        tens: result.tens || 0,
                        boonsGained: result.boonsGained || 0,
                        criticalEffect: result.criticalEffect,
                        reRolls: result.reRolledDice?.length || 0
                    }
                });
            } else if (module.sendMessage && typeof module.sendMessage === 'function') {
                module.sendMessage(message, 'Roll', 'all', {
                    rollData: {
                        outcome: result.outcome,
                        outcomeLabel: OUTCOME_TYPES[result.outcome]?.label || result.outcome,
                        dice: result.dice,
                        successes: result.successes,
                        storyBeats: result.storyBeats || 0,
                        tens: result.tens || 0,
                        boonsGained: result.boonsGained || 0
                    }
                });
            }
        })
        .catch(err => {
            console.debug('[CharacterRoller] VTT module not available:', err.message);
        });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function getCharacterRollHistory(id, limit = 10) {
    const state = getState();
    const history = state.diceHistory || [];
    return history
        .filter(r => r.characterId === id)
        .slice(0, limit);
}

export function getRecentRolls(limit = 20) {
    const state = getState();
    return (state.diceHistory || []).slice(0, limit);
}

export function clearRollHistory(id = null) {
    const state = getState();
    if (id) {
        state.diceHistory = (state.diceHistory || []).filter(r => r.characterId !== id);
    } else {
        state.diceHistory = [];
    }
    saveState();
    showToast(`Roll history ${id ? 'for character' : ''} cleared.`, 'success');
}

export function exportRollHistory(id = null) {
    const state = getState();
    let history = state.diceHistory || [];
    
    if (id) history = history.filter(r => r.characterId === id);
    
    if (history.length === 0) {
        showToast('No roll history to export.', 'warning');
        return null;
    }
    
    const headers = ['Timestamp', 'Character', 'Outcome', 'Dice', 'Successes', 'Story Beats', 'Tens', 'Boons Gained', 'DV', 'Position', 'Note'];
    const rows = history.map(r => [
        new Date(r.timestamp || Date.now()).toLocaleString(),
        r.characterName || r.npcName || 'Unknown',
        OUTCOME_TYPES[r.outcome]?.label || r.outcome || 'Unknown',
        (r.dice || []).join(' '),
        r.successes || 0,
        r.storyBeats || 0,
        r.tens || 0,
        r.boonsGained || 0,
        r.dv || 3,
        r.position || 'controlled',
        r.note || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.map(c => `"${c}"`).join(','))].join('\n');
    return csv;
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

export function setupKeyboardShortcuts() {
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
                rollForCharacter(activeChar.id, { note: 'Quick roll (Ctrl+Shift+R)' });
            } else if (state.characters && state.characters.length > 0) {
                rollForCharacter(state.characters[0].id, { note: 'Quick roll' });
            } else {
                showToast('No characters available for quick roll.', 'warning');
            }
        }
    };
    
    document.addEventListener('keydown', keyboardShortcutHandler);
}

export function cleanupKeyboardShortcuts() {
    if (keyboardShortcutHandler) {
        document.removeEventListener('keydown', keyboardShortcutHandler);
        keyboardShortcutHandler = null;
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

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
    loadRegions,
    // Game constants for external use
    ALL_SKILLS,
    ATTRIBUTES,
    POSITIONS,
    DV_LADDER,
    OUTCOME_TYPES
};