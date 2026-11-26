// Character Tiers (SRD 15). Its own module so that both core/utils.js and
// core/dice.js can import it: utils re-exports dice, so a dice -> utils import
// would be circular and read TIERS before it was initialised.

/**
 * Character Tiers, from the SRD (15, Advancement): XP range, standing and the
 * mechanical limits each tier sets. This is the one table the app uses; the
 * character, wizard, editor, roller and spellcraft screens all read it.
 * (It replaces a bronze/silver/gold/platinum scale on 20/50/100 XP that
 * matched nothing in the rules.)
 */
export const TIERS = [
    { tier: 'I',   name: 'Rookie',   min: 0,   max: 40,       standing: 'Local',       maxPool: 8,  maxFollowers: 2, maxBoons: 5, color: '#8bc34a' },
    { tier: 'II',  name: 'Seasoned', min: 41,  max: 90,       standing: 'Regional',    maxPool: 9,  maxFollowers: 3, maxBoons: 5, color: '#4caf50' },
    { tier: 'III', name: 'Veteran',  min: 91,  max: 150,      standing: 'National',    maxPool: 10, maxFollowers: 4, maxBoons: 5, color: '#ff9800' },
    { tier: 'IV',  name: 'Paragon',  min: 151, max: 220,      standing: 'Continental', maxPool: 10, maxFollowers: 4, maxBoons: 6, color: '#e91e63' },
    { tier: 'V',   name: 'Mythic',   min: 221, max: Infinity, standing: 'Legendary',   maxPool: 10, maxFollowers: 4, maxBoons: 7, color: '#9c27b0' },
];

/**
 * The SRD Tier for a total XP. Returns the tier object
 * ({ tier: 'I'..'V', name, min, max, standing, maxPool, maxFollowers, maxBoons, color }).
 * Non-numeric or negative XP is treated as 0 (Tier I).
 * @param {number} xp - Total experience points
 * @returns {object}
 */
export function getTierFromXp(xp) {
    const n = Number(xp);
    const value = Number.isFinite(n) && n > 0 ? n : 0;
    return TIERS.find(t => value >= t.min && value <= t.max) || TIERS[TIERS.length - 1];
}

/** A Tier object by its numeral ('I'..'V'), or Tier I if unknown. */
export function getTierInfo(tier) {
    const key = typeof tier === 'object' && tier ? tier.tier : String(tier || '').toUpperCase();
    return TIERS.find(t => t.tier === key) || TIERS[0];
}

/** Display colour for a Tier (numeral or tier object). */
export function getTierColor(tier) {
    return getTierInfo(tier).color;
}

/** SRD: max dice pool by Tier (8 / 9 / 10). */
export function maxPoolForXp(xp) {
    return getTierFromXp(xp).maxPool;
}

/** SRD: Boons held, 5 (6 at Tier IV, 7 at Tier V). */
export function maxBoonsForXp(xp) {
    return getTierFromXp(xp).maxBoons;
}
