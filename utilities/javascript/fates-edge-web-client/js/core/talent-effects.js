/**
 * Talent Effects Engine
 *
 * Gives talents actual mechanical teeth. Previously a talent was pure metadata —
 * tier/category/cost/prerequisites/effect were all stored, but nothing in the app
 * ever read talent.effect to change a roll. This module defines a small, structured
 * effect grammar that talents (and, by extension, other future content like gear)
 * can use, plus the logic to:
 *   1. Interpret common free-text mechanical shorthand ("+1d Stealth", "ignore armor
 *      penalty", "improve Position by 1") into structured effects, so existing wiki/
 *      talent text isn't wasted work — this is the lightweight "text interpreter."
 *   2. Collect the structured effects that apply to a given roll (die bonuses,
 *      Position shifts, ignored penalties, conditional re-rolls).
 *   3. Track and consume "charges" for use-limited talents (once/scene, once/session,
 *      once/arc, once/campaign), and reset them at the appropriate boundary.
 *
 * Effect object shape (stored on talent.effects[]):
 *   { type: 'die_bonus',      scope: 'skill'|'attribute'|'any', key: 'stealth', amount: 1 }
 *   { type: 'position_shift', amount: 1 }                         // +1 = toward Dominant
 *   { type: 'ignore_penalty', source: 'fatigue'|'harm'|'armor',   amount: 1 }
 *   { type: 'reroll',         trigger: 'always'|'on_miss'|'on_partial', dice: 1 }
 *
 * A talent's `effects` array is opt-in — talents with no effects behave exactly as
 * before (flavor text only). `useLimit` on the talent (passive/once-scene/once-
 * session/once-arc/once-campaign/unlimited/custom) governs whether an effect is
 * always on or must be "spent" via consumeTalentCharge().
 */

// ============================================================
// CONSTANTS
// ============================================================

export const EFFECT_TYPES = {
    DIE_BONUS: 'die_bonus',
    POSITION_SHIFT: 'position_shift',
    IGNORE_PENALTY: 'ignore_penalty',
    REROLL: 'reroll',
};

// useLimit values that don't require charge-tracking (always available)
const UNLIMITED_USE = new Set(['passive', 'unlimited']);
// useLimit values that map to a resettable scope
const SCOPED_USE = new Set(['once-scene', 'once-session', 'once-arc', 'once-campaign']);

// ============================================================
// TEXT INTERPRETER
// ============================================================

const SKILL_KEYS = [
    'melee', 'ranged', 'unarmed', 'athletics', 'stealth', 'endurance', 'craft',
    'sway', 'deception', 'subterfuge', 'performance', 'insight', 'lore',
    'investigation', 'medicine', 'arcana'
];
const ATTR_KEYS = ['body', 'wits', 'spirit', 'presence'];

/**
 * Best-effort parse of a free-text mechanical effect summary (the kind of text
 * already found in talent.effect and in data/wiki.json entries, e.g.
 * "+2d melee when moving Near→Far") into structured effect objects.
 *
 * This is intentionally a small pattern matcher, not a full rules DSL — it covers
 * the shorthand GMs/authors already use by hand. Anything it can't confidently
 * parse is simply left out of the returned array; the free-text summary is always
 * preserved on the talent regardless of whether it parses.
 *
 * @param {string} text
 * @returns {Array<object>} zero or more structured effect objects
 */
export function parseEffectText(text) {
    if (!text || typeof text !== 'string') return [];
    const effects = [];
    const lower = text.toLowerCase();

    // "+1d stealth", "+2 dice melee", "-1d ranged"
    const dieBonusRe = /([+-]\s?\d+)\s*d(?:ice)?\b\s*(?:to\s+)?([a-z ]+?)(?=[,.;()]|$| when| once| per )/g;
    let m;
    while ((m = dieBonusRe.exec(lower)) !== null) {
        const amount = parseInt(m[1].replace(/\s/g, ''), 10);
        const rawKey = m[2].trim();
        if (!rawKey || Number.isNaN(amount)) continue;
        const skillMatch = SKILL_KEYS.find(k => rawKey.includes(k));
        const attrMatch = !skillMatch && ATTR_KEYS.find(k => rawKey.includes(k));
        if (skillMatch) {
            effects.push({ type: EFFECT_TYPES.DIE_BONUS, scope: 'skill', key: skillMatch, amount });
        } else if (attrMatch) {
            effects.push({ type: EFFECT_TYPES.DIE_BONUS, scope: 'attribute', key: attrMatch, amount });
        } else if (/\ball\b|\bany roll\b|\ball rolls\b/.test(rawKey)) {
            effects.push({ type: EFFECT_TYPES.DIE_BONUS, scope: 'any', key: null, amount });
        }
    }

    // "improve position by 1", "improve your position by one step"
    const posRe = /improve (?:your )?position(?: by)? (one|two|1|2) ?step?/;
    const posM = lower.match(posRe);
    if (posM) {
        const amount = posM[1] === 'two' || posM[1] === '2' ? 2 : 1;
        effects.push({ type: EFFECT_TYPES.POSITION_SHIFT, amount });
    }

    // "ignore armor penalty", "ignore fatigue penalty", "ignore harm penalty"
    const ignoreRe = /ignore (?:the )?(armor|fatigue|harm)(?: die)? penalt(?:y|ies)/g;
    while ((m = ignoreRe.exec(lower)) !== null) {
        effects.push({ type: EFFECT_TYPES.IGNORE_PENALTY, source: m[1], amount: 1 });
    }

    // "reroll on a miss", "re-roll on partial"
    if (/re-?roll/.test(lower)) {
        let trigger = 'always';
        if (/on (?:a )?miss/.test(lower)) trigger = 'on_miss';
        else if (/on (?:a )?partial/.test(lower)) trigger = 'on_partial';
        effects.push({ type: EFFECT_TYPES.REROLL, trigger, dice: 1 });
    }

    return effects;
}

/**
 * Ensure a talent has an `effects` array, deriving one from its free-text
 * `effect` field if it doesn't already have structured effects. Non-destructive:
 * never overwrites an existing effects array (so hand-authored structured effects
 * always win over the text guesser).
 */
export function ensureTalentEffects(talent) {
    if (!talent || typeof talent !== 'object') return talent;
    if (!Array.isArray(talent.effects)) {
        talent.effects = parseEffectText(talent.effect || talent.description || '');
    }
    return talent;
}

// ============================================================
// CHARGE TRACKING (use-limited talents)
// ============================================================

function talentKey(talent) {
    return talent.id || talent.name;
}

/**
 * Does this talent require charge-tracking at all?
 */
export function isLimitedUse(talent) {
    return SCOPED_USE.has(talent.useLimit);
}

/**
 * Has this talent already been used up for its current scope, on this character?
 * character.talentUses is a map: { [talentKey]: { usedAt: 'scene'|'session'|..., count } }
 */
export function hasChargeAvailable(character, talent) {
    if (!talent) return false;
    if (!isLimitedUse(talent)) return true; // passive/unlimited/custom: always usable
    const uses = character.talentUses || {};
    const entry = uses[talentKey(talent)];
    return !entry || !entry.spent;
}

/**
 * Mark a use-limited talent's charge as spent. Returns the updated talentUses map
 * (caller is responsible for persisting it via updateCharacter).
 */
export function consumeTalentCharge(character, talent) {
    if (!talent || !isLimitedUse(talent)) return character.talentUses || {};
    const uses = { ...(character.talentUses || {}) };
    uses[talentKey(talent)] = { spent: true, spentAt: new Date().toISOString(), scope: talent.useLimit };
    return uses;
}

/**
 * Reset all charges for a given scope boundary (e.g. call this when a scene or
 * session ends). scope must be one of 'once-scene' | 'once-session' | 'once-arc' | 'once-campaign'.
 */
export function resetTalentCharges(character, scope) {
    const uses = { ...(character.talentUses || {}) };
    for (const key of Object.keys(uses)) {
        if (uses[key].scope === scope) delete uses[key];
    }
    return uses;
}

// ============================================================
// MODIFIER COLLECTION (used by the roller)
// ============================================================

/**
 * Collect the mechanical modifiers that a character's talents (and, optionally,
 * their equipped armor/weapon) contribute to a specific roll. Pure function — does
 * NOT mutate character state or consume charges; call consumeTalentCharge()
 * separately once a roll actually executes.
 *
 * @param {object} character - character record (talents[], talentUses, armorType, weaponClass)
 * @param {object} rollContext - { attrKey, skillKey, harm, fatigue }
 * @returns {{ diceBonus:number, positionShift:number, ignoredHarm:number, ignoredFatigue:number,
 *             rerolls: Array<{trigger:string,dice:number}>, applied: Array<{talent:object, effect:object}> }}
 */
export function collectTalentModifiers(character, rollContext = {}) {
    const { attrKey = null, skillKey = null } = rollContext;
    const result = { diceBonus: 0, positionShift: 0, ignoredHarm: 0, ignoredFatigue: 0, ignoredArmor: 0, rerolls: [], applied: [] };
    const talents = Array.isArray(character?.talents) ? character.talents : [];

    for (const talent of talents) {
        ensureTalentEffects(talent);
        if (!talent.effects || talent.effects.length === 0) continue;
        if (!hasChargeAvailable(character, talent)) continue; // charge already spent this scope

        let talentApplied = false;
        for (const effect of talent.effects) {
            switch (effect.type) {
                case EFFECT_TYPES.DIE_BONUS: {
                    const matches =
                        effect.scope === 'any' ||
                        (effect.scope === 'skill' && effect.key === skillKey) ||
                        (effect.scope === 'attribute' && effect.key === attrKey);
                    if (matches) {
                        result.diceBonus += effect.amount || 0;
                        talentApplied = true;
                    }
                    break;
                }
                case EFFECT_TYPES.POSITION_SHIFT:
                    result.positionShift += effect.amount || 0;
                    talentApplied = true;
                    break;
                case EFFECT_TYPES.IGNORE_PENALTY:
                    if (effect.source === 'harm') result.ignoredHarm += effect.amount || 0;
                    else if (effect.source === 'fatigue') result.ignoredFatigue += effect.amount || 0;
                    else if (effect.source === 'armor') result.ignoredArmor += effect.amount || 0;
                    talentApplied = true;
                    break;
                case EFFECT_TYPES.REROLL:
                    result.rerolls.push({ trigger: effect.trigger || 'always', dice: effect.dice || 1 });
                    talentApplied = true;
                    break;
                default:
                    break;
            }
        }
        if (talentApplied) {
            result.applied.push({ talent });
        }
    }

    return result;
}

/**
 * WEAPON WEIGHT-CLASS × RANGE-BAND DICE BONUS TABLE
 *
 * Per Nick's correction against the actual rulebook (Player's Guide §3.12.1–
 * 3.12.3): there is only ONE weapon axis, not two — weaponClass itself is
 * Light / Medium / Heavy / Ranged (matches editor.js's WEAPON_CLASSES 1:1,
 * with 'ranged' added as a 4th option there). The earlier "two independent
 * axes" design (weapon CLASS separate from a derived melee/reach/ranged
 * TYPE) was a misreading — scrapped in favor of this.
 *
 * Close/Near numbers for Light/Medium/Heavy are the book's Melee Modifiers
 * table (§3.12.2) verbatim:
 *   Light:  Close +2d, Near +1d  (fast, concealable)
 *   Medium: Close +1d, Near +2d  (balanced, battlefield standard)
 *   Heavy:  Close -1d, Near +3d  (punishing, slow)
 * Ranged's Close/Near/Far collapse the book's Light/Medium/Heavy Ranged
 * sub-table (§3.12.3, each with its own Tempo) into one representative curve
 * (roughly the Medium/"Standard" tempo row) since the tracker only exposes
 * one flat "Ranged" option: Close -2d (proxy for the book's flat "Ranged
 * attack in Close range → Desperate" rule — this pipeline works in dice, not
 * Position), Near +2d, Far +1d.
 *
 * Reach and Absent don't exist in the book at all — they're this GM's own
 * extended-band house rule on top of the RAW 3-band Close/Near/Far (see
 * encounters/combat.js's 5-band RANGE_BANDS). Only Heavy melee (halberd,
 * greatsword — weapons with real reach) can threaten the Reach band; every
 * other class is blocked there and at Far/Absent. Values are tunable
 * defaults, not hard rules-text — blocked bands get a stiff -3d rather than
 * a hard stop, since this is a manual player-driven roll (no auto opponent
 * lookup) and the GM/table should still be free to call for the roll anyway.
 *
 * Band keys match encounters/combat.js's RANGE_BANDS exactly (Medium's
 * internal key stays 'near' for backward compatibility):
 *   close | near(=Medium) | reach | far | absent
 */
const RANGE_BONUS_TABLE = {
    light:  { close:  2, near:  1, reach: -3, far: -3, absent: -3 },
    medium: { close:  1, near:  2, reach: -3, far: -3, absent: -3 },
    heavy:  { close: -1, near:  3, reach:  0, far: -3, absent: -3 },
    ranged: { close: -2, near:  2, reach:  2, far:  1, absent: -3 },
};

const RANGE_BAND_LABELS = { close: 'Close', near: 'Medium', reach: 'Reach', far: 'Far', absent: 'Absent' };

// Bands each weapon class can't really threaten — used only for the note
// text, the -3d above already carries the mechanical weight.
const BLOCKED_BANDS = {
    light: new Set(['reach', 'far', 'absent']),
    medium: new Set(['reach', 'far', 'absent']),
    heavy: new Set(['far', 'absent']),
    ranged: new Set(['absent']),
};

// SHIELDS (Player's Guide §3.12.5, see data/wiki.json ids 71-72/79 for the
// authored reference text) — previously pure character-sheet flavor with
// zero runtime effect (editor.js's SHIELD_TYPES/shieldType field was never
// read by the roller). Buckler and Heater both carry "off-hand occupied;
// -1d to ranged attacks" per the wiki reference; Pavise trades mobility
// instead (bulky, cannot move while planted) rather than a ranged penalty.
// The Defend bonus and Harm→Fatigue conversion are situational (they apply
// to a defend action / incoming damage, not the generic dice-pool this
// function feeds) so they're surfaced as reminder notes rather than an
// automatic dice change.
const SHIELD_RANGED_PENALTY = { none: 0, buckler: 1, heater: 1, pavise: 0 };
const SHIELD_LABELS = { buckler: 'Buckler', heater: 'Heater', pavise: 'Pavise' };
const SHIELD_DEFEND_NOTE = {
    buckler: 'Buckler equipped: +1d Defend once per scene — off-hand occupied, -1d Ranged',
    heater: 'Heater equipped: +1d Defend; converts 1 Harm→1 Fatigue per scene — off-hand occupied, -1d Ranged',
    pavise: 'Pavise equipped: heavy cover cone when planted; bulky, cannot move while planted',
};

/**
 * ARMOR/WEAPON/SHIELD MODIFIERS
 * Mirrors the structured-effect shape above so armor/weapon bonuses can flow
 * through the same modifier pipeline as talents instead of being display-only.
 * `physicalSkill` should be true when the skill being rolled is Melee/Ranged/
 * Unarmed/Athletics (the "physical skills" armor penalties apply to).
 *
 * @param {object} opts
 * @param {string} [opts.armorType]
 * @param {string} [opts.weaponClass] - 'light'|'medium'|'heavy'|'ranged' — the single axis that drives the range bonus below (see editor.js's WEAPON_CLASSES).
 * @param {string} [opts.range] - one of close|near|reach|far|absent; the range band the player selected for this roll.
 * @param {string} [opts.shieldType] - 'none'|'buckler'|'heater'|'pavise' (see editor.js's SHIELD_TYPES).
 * @param {number} [opts.ignoredArmor]
 */
export function collectEquipmentModifiers({ armorType, weaponClass, range, shieldType, ignoredArmor = 0 } = {}, physicalSkill = false) {
    const result = { diceBonus: 0, notes: [] };

    const ARMOR_PENALTY = { none: 0, light: 0, medium: 1, heavy: 2, superior: 0, mythic: 0 };
    if (physicalSkill && armorType && ARMOR_PENALTY[armorType]) {
        const penalty = Math.max(0, ARMOR_PENALTY[armorType] - ignoredArmor);
        if (penalty > 0) {
            result.diceBonus -= penalty;
            result.notes.push(`${armorType[0].toUpperCase() + armorType.slice(1)} armor: −${penalty}d`);
        }
    }

    // Weapon weight-class × range-band bonus.
    if (weaponClass && range) {
        const table = RANGE_BONUS_TABLE[weaponClass];
        if (table && table[range] !== undefined) {
            const bonus = table[range];
            result.diceBonus += bonus;
            const bandLabel = RANGE_BAND_LABELS[range] || range;
            const blocked = BLOCKED_BANDS[weaponClass]?.has(range);
            const suffix = blocked ? ' (out of effective reach)' : '';
            const classLabel = weaponClass[0].toUpperCase() + weaponClass.slice(1);
            result.notes.push(`${classLabel} weapon @ ${bandLabel}: ${bonus >= 0 ? '+' : ''}${bonus}d${suffix}`);
        }
    }

    // Shield penalty/reminder.
    if (shieldType && shieldType !== 'none') {
        const rangedPenalty = SHIELD_RANGED_PENALTY[shieldType] || 0;
        if (rangedPenalty > 0 && weaponClass === 'ranged') {
            result.diceBonus -= rangedPenalty;
            result.notes.push(`${SHIELD_LABELS[shieldType] || shieldType} shield: −${rangedPenalty}d Ranged (bulky)`);
        } else if (SHIELD_DEFEND_NOTE[shieldType]) {
            result.notes.push(SHIELD_DEFEND_NOTE[shieldType]);
        }
    }

    return result;
}

export default {
    EFFECT_TYPES,
    parseEffectText,
    ensureTalentEffects,
    isLimitedUse,
    hasChargeAvailable,
    consumeTalentCharge,
    resetTalentCharges,
    collectTalentModifiers,
    collectEquipmentModifiers,
};
