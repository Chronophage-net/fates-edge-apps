/**
 * Witchcraft – The Hedge and the Threshold
 *
 * "The hedge is what keeps the wolves from the flock. I am the one who tends the hedge."
 * – The Gray Wanderer
 *
 * Witchcraft is a practice, not just a path. Any character can learn Hedge Gifts,
 * but those who walk the Witch path gain deeper access to the Weave's hidden grammar.
 *
 * Features:
 * - Universal Hedge Gifts (from hardcoded list + patron gifts)
 * - Weaver selection from patron data
 * - Price tracks: Shadow, Shame, Identity Strain
 * - Promise Timers
 * - Full Ritual system
 * - Quick Workings
 * - Crafting with ingredients (wiki‑driven): forage, purchase, combine, craft from recipe
 * - Crafted item inventory with uses tracking
 * - Magic path detection
 * - All data for ingredients & recipes loaded from /data/wiki.json (with fallbacks)
 *
 * ────────────────────────────────────────────────────────────────────────
 * BUGFIX NOTE (read this before touching saveCharacter calls below):
 * getWitchState(char) does `if (!char.witch) char.witch = {}` and returns a
 * live reference into the character object, and getPriceTracks/
 * getHedgeGifts/getPromiseTimers/getFullRituals/getCraftedItems all read
 * and mutate through that same reference. That means char.witch already
 * holds the up-to-date {prices, hedgeGifts, promiseTimers, rituals,
 * crafted, ingredients} object at the moment we call saveCharacter.
 *
 * The previous version of this file called saveCharacter with only ONE of
 * those sub-keys at a time, e.g. saveCharacter({ witch: { prices } }) or
 * saveCharacter({ witch: { crafted } }). If saveCharacter's merge is a
 * normal shallow merge (as it appears to be elsewhere in this codebase,
 * e.g. cantor.js's saveCharacter({ fatigue, corruption })), passing
 * `witch: { prices }` REPLACES char.witch entirely with just { prices },
 * silently deleting hedgeGifts/promiseTimers/rituals/crafted every time.
 * In practice: add a Hedge Gift, then tick a Promise Timer, and the gift
 * you just added would vanish.
 *
 * Fix: always pass the whole, already-mutated char.witch object, so
 * nothing sibling gets clobbered regardless of merge depth.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────────────
 * CONSISTENCY PASS (patron loading + dice engine):
 * This file's witchcraft lookups (findPatronWitchcraft / getAllWitchcraft-
 * Patrons) read straight from `getState().patrons`, but this file never
 * actually loaded that data itself — it silently relied on some OTHER
 * panel (Patrons, Cantor, Rites) having been opened first to populate it.
 * That meant opening Witchcraft as the very first thing in a session could
 * show an empty weaver list for no visible reason. This file now calls the
 * same shared `patrons/index.js` loader everyone else uses, at the top of
 * `renderWitchcraft` and before `witchChooseWeaver` runs, so it always has
 * current data regardless of what the player clicked first.
 *
 * Also replaced this file's private `rollDice()` (which tracked "ones" as
 * a proxy for Story Beats) with the shared `performRoll()` from
 * `core/dice.js`, whose `storyBeats` field is that same concept — this
 * file no longer runs its own, independently-tuned dice math.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────────────
 * WIKI DATA LOADING (new in this rewrite):
 * This file now loads ingredients and recipes from `/data/wiki.json`
 * via the same mechanism as characters/index.js (state.wikiEntries).
 * If the wiki isn't loaded yet, we fetch it on demand (ensureWikiLoaded).
 * Fallback data is provided so the panel works even without network.
 * ────────────────────────────────────────────────────────────────────────
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId, safeParseInt } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';
import { getState, saveState } from '../../../core/state.js';
import { performRoll } from '../../../core/dice.js';
import patrons from '../../patrons/index.js';

const { loadPatronData: ensurePatronDataLoaded } = patrons;

// ============================================================
// CONSTANTS – Universal Hedge Gifts (available to all)
// ============================================================

const UNIVERSAL_HEDGE_GIFTS = [
    { id: 'steady-hand', name: 'Steady Hand', effect: 'Remove 1 Fatigue from yourself or a touched ally.', limit: 'Once per scene' },
    { id: 'salt-line', name: 'Salt Line', effect: 'Pour a line of salt; spirits must test Spirit+Resolve (DV 3) to cross.', limit: 'Once per scene' },
    { id: 'hearth-sense', name: 'Hearth-Sense', effect: 'Ask the GM one yes/no question about a threshold, boundary, or debt.', limit: 'Once per scene' },
    { id: 'unlit-candle', name: 'The Unlit Candle', effect: 'Extinguish a light source; create dim light or darkness in Near range.', limit: 'Once per session' },
    { id: 'knot-of-favor', name: 'Knot of Favor', effect: 'Tie a knot; you and allies gain +1 die to one type of roll for the scene.', limit: 'Once per scene' },
    { id: 'warm-hand', name: 'Warm Hand', effect: 'Touch someone; their next physical action gains +1 die or suffers -1 die.', limit: 'Once per scene' },
    { id: 'counting-eighth', name: 'Counting the Eighth', effect: 'Whisper a number (1-8); if GM\'s SB count matches, gain +2 dice.', limit: 'Once per scene' },
    { id: 'threshold-whisper', name: 'Threshold Whisper', effect: 'Learn the nature of a threshold (door, bridge, boundary) with a touch.', limit: 'Once per scene' },
    { id: 'red-thread', name: 'Red Thread', effect: 'Tie a thread on a door; next person crossing forgets why they entered (Resist DV 2).', limit: 'Once per session' },
    { id: 'cup-mark', name: 'Cup-Mark', effect: 'Leave a cup-mark on a stone; return before dawn to ignore one minor social complication.', limit: 'Once per session' }
];

// ─── Price Track Thresholds ───────────────────────────────────

const PRICE_THRESHOLDS = {
    shadow: { label: 'Shadow', icon: '🌑', max: 5, warningAt: 3, color: 'var(--purple)' },
    shame: { label: 'Shame', icon: '😞', max: 5, warningAt: 3, color: 'var(--red)' },
    identityStrain: { label: 'Identity Strain', icon: '🌀', max: 5, warningAt: 3, color: 'var(--gold)' }
};

// ============================================================
// WIKI DATA LOADING
// ============================================================

/**
 * Ensures wiki data is loaded into state.wikiEntries.
 * If not present, fetches from /data/wiki.json.
 */
async function ensureWikiLoaded(force = false) {
    const state = getState();
    if (state.wikiEntries && !force) return;

    try {
        const response = await fetch('/data/wiki.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        state.wikiEntries = data.data || [];
        // Also store raw for other modules
        state.wikiData = data;
        saveState();
        console.log('[Witchcraft] Wiki data loaded:', state.wikiEntries.length, 'entries');
    } catch (err) {
        console.warn('[Witchcraft] Failed to load wiki.json, using fallback data.', err);
        // Provide fallback entries for ingredients and recipes (matching the hardcoded ones)
        state.wikiEntries = [
            // Ingredients (common and rare)
            { id: 430, title: 'Herbs', category: 'ingredient', body: 'Common herbs.', tags: ['common', 'herb', 'forage'], cost: 0, icon: '🌿' },
            { id: 431, title: 'Clean cloth', category: 'ingredient', body: 'Clean linen.', tags: ['common', 'fabric', 'forage'], cost: 0, icon: '🧻' },
            { id: 432, title: 'Rare herb', category: 'ingredient', body: 'Rare herb.', tags: ['rare', 'herb', 'purchase'], cost: 1, icon: '🌱' },
            { id: 433, title: 'Distilled water', category: 'ingredient', body: 'Pure water.', tags: ['common', 'liquid', 'forage'], cost: 0, icon: '💧' },
            { id: 434, title: 'Charcoal', category: 'ingredient', body: 'Charcoal.', tags: ['common', 'mineral', 'forage'], cost: 0, icon: '🪵' },
            { id: 435, title: 'Valerian root', category: 'ingredient', body: 'Valerian.', tags: ['common', 'herb', 'forage'], cost: 0, icon: '🌰' },
            { id: 436, title: 'Honey', category: 'ingredient', body: 'Honey.', tags: ['common', 'food', 'forage'], cost: 0, icon: '🍯' },
            { id: 437, title: 'Moonwater', category: 'ingredient', body: 'Moonwater.', tags: ['rare', 'liquid', 'purchase'], cost: 1, icon: '🌙' },
            { id: 438, title: 'Salt', category: 'ingredient', body: 'Salt.', tags: ['common', 'mineral', 'forage'], cost: 0, icon: '🧂' },
            { id: 439, title: 'Blessed ash', category: 'ingredient', body: 'Blessed ash.', tags: ['rare', 'ash', 'purchase'], cost: 1, icon: '🔥' },
            { id: 440, title: 'Iron filings', category: 'ingredient', body: 'Iron filings.', tags: ['common', 'mineral', 'forage'], cost: 0, icon: '⚙️' },
            { id: 441, title: 'Nightshade', category: 'ingredient', body: 'Nightshade.', tags: ['rare', 'herb', 'purchase'], cost: 1, icon: '☠️' },
            { id: 442, title: 'Pure water', category: 'ingredient', body: 'Pure spring water.', tags: ['common', 'liquid', 'forage'], cost: 0, icon: '💧' },
            { id: 443, title: 'Blood', category: 'ingredient', body: 'Blood.', tags: ['common', 'liquid', 'forage'], cost: 0, icon: '🩸' },
            { id: 444, title: 'Chamomile', category: 'ingredient', body: 'Chamomile.', tags: ['common', 'herb', 'forage'], cost: 0, icon: '🌼' },
            { id: 445, title: 'Moonwort', category: 'ingredient', body: 'Moonwort.', tags: ['rare', 'herb', 'purchase'], cost: 1, icon: '🌙' },
            { id: 446, title: 'Sulphur', category: 'ingredient', body: 'Sulphur.', tags: ['common', 'mineral', 'forage'], cost: 0, icon: '🟡' },
            { id: 447, title: 'Saltpetre', category: 'ingredient', body: 'Saltpetre.', tags: ['common', 'mineral', 'forage'], cost: 0, icon: '🧪' },
            { id: 448, title: 'Olive oil', category: 'ingredient', body: 'Olive oil.', tags: ['common', 'liquid', 'forage'], cost: 0, icon: '🫒' },
            { id: 449, title: 'Incense', category: 'ingredient', body: 'Incense.', tags: ['common', 'herb', 'forage'], cost: 0, icon: '🪔' },
            // Recipes (mirroring hardcoded CRAFTING_RECIPES)
            { id: 450, title: 'Healing Poultice', category: 'recipe', body: 'Remove 1 Fatigue when applied during a short rest.', tags: ['recipe', 'medicine', 'minor'], ingredients: ['Herbs', 'Clean cloth'], skill: 'medicine', dv: 2, xpCost: 1, tier: 'minor', effect: 'Remove 1 Fatigue when applied during a short rest.', icon: '🩹' },
            { id: 451, title: 'Antidote', category: 'recipe', body: 'Remove one Poisoned Condition.', tags: ['recipe', 'medicine', 'minor'], ingredients: ['Rare herb', 'Distilled water', 'Charcoal'], skill: 'medicine', dv: 3, xpCost: 2, tier: 'minor', effect: 'Remove one Poisoned Condition.', icon: '🧪' },
            { id: 452, title: 'Sleep Draught', category: 'recipe', body: 'Target tests Spirit+Resolve (DV 3) or falls asleep for 1 hour.', tags: ['recipe', 'craft', 'minor'], ingredients: ['Valerian root', 'Honey', 'Moonwater'], skill: 'craft', dv: 3, xpCost: 1, tier: 'minor', effect: 'Target tests Spirit+Resolve (DV 3) or falls asleep for 1 hour.', icon: '💤' },
            { id: 453, title: 'Ward Salt', category: 'recipe', body: 'Line wards against spirits and undead (Spirit+Resolve DV 4 to cross).', tags: ['recipe', 'lore', 'minor'], ingredients: ['Salt', 'Blessed ash', 'Iron filings'], skill: 'lore', dv: 3, xpCost: 2, tier: 'minor', effect: 'Line wards against spirits and undead (Spirit+Resolve DV 4 to cross).', icon: '🧂' },
            { id: 454, title: 'Truth Serum', category: 'recipe', body: 'Target tests Spirit+Resolve (DV 4) or speaks only truth for one exchange.', tags: ['recipe', 'craft', 'standard'], ingredients: ['Nightshade', 'Pure water', 'Blood'], skill: 'craft', dv: 4, xpCost: 3, tier: 'standard', effect: 'Target tests Spirit+Resolve (DV 4) or speaks only truth for one exchange.', icon: '🔮' },
            { id: 455, title: 'Moon Tea', category: 'recipe', body: '+1 die on next Wits or Spirit roll within 1 hour.', tags: ['recipe', 'craft', 'minor'], ingredients: ['Chamomile', 'Moonwort', 'Honey'], skill: 'craft', dv: 2, xpCost: 1, tier: 'minor', effect: '+1 die on next Wits or Spirit roll within 1 hour.', icon: '🌙' },
            { id: 456, title: 'Fire Powder', category: 'recipe', body: 'Creates a small fire (Harm 2, Area) in Close range. One use.', tags: ['recipe', 'craft', 'standard'], ingredients: ['Sulphur', 'Charcoal', 'Saltpetre'], skill: 'craft', dv: 4, xpCost: 3, tier: 'standard', effect: 'Creates a small fire (Harm 2, Area) in Close range. One use.', icon: '🔥' },
            { id: 457, title: 'Blessed Oil', category: 'recipe', body: 'Anoints a weapon or threshold; counts as [WARD] or [BLESSED] for one scene.', tags: ['recipe', 'lore', 'standard'], ingredients: ['Olive oil', 'Incense'], skill: 'lore', dv: 3, xpCost: 2, tier: 'standard', effect: 'Anoints a weapon or threshold; counts as [WARD] or [BLESSED] for one scene.', icon: '🕯️' }
        ];
        // Also ensure state.wikiData exists
        state.wikiData = { data: state.wikiEntries };
        saveState();
    }
}

// ============================================================
// CRAFTING DATA PARSING
// ============================================================

function parseIngredientsFromWiki(entries) {
    const map = {};
    for (const entry of entries) {
        if (entry.category === 'ingredient' && entry.title) {
            map[entry.title] = {
                name: entry.title,
                cost: entry.cost !== undefined ? entry.cost : 0,
                common: entry.tags?.includes('common') ?? true,
                icon: entry.icon || '🧪',
                description: entry.body || ''
            };
        }
    }
    return map;
}

function parseRecipesFromWiki(entries) {
    const recipes = {};
    for (const entry of entries) {
        if (entry.category === 'recipe' && entry.title) {
            const id = String(entry.id) || entry.title.toLowerCase().replace(/ /g, '-');
            recipes[id] = {
                id: id,
                name: entry.title,
                description: entry.body || '',
                effect: entry.effect || entry.body || '',
                materials: entry.ingredients || [],
                ingredients: entry.ingredients || [],
                skill: entry.skill || 'craft',
                dv: entry.dv !== undefined ? entry.dv : 3,
                xpCost: entry.xpCost !== undefined ? entry.xpCost : 1,
                tier: entry.tier || 'minor',
                icon: entry.icon || '🔧'
            };
        }
    }
    return recipes;
}

// ─── Fallback data (in case parsing fails) ────────────────────

// Hardcoded ingredient definitions (same as before, used as fallback)
const FALLBACK_INGREDIENTS = {
    'Herbs': { name: 'Herbs', cost: 0, common: true, icon: '🌿' },
    'Clean cloth': { name: 'Clean cloth', cost: 0, common: true, icon: '🧻' },
    'Rare herb': { name: 'Rare herb', cost: 1, common: false, icon: '🌱' },
    'Distilled water': { name: 'Distilled water', cost: 0, common: true, icon: '💧' },
    'Charcoal': { name: 'Charcoal', cost: 0, common: true, icon: '🪵' },
    'Valerian root': { name: 'Valerian root', cost: 0, common: true, icon: '🌰' },
    'Honey': { name: 'Honey', cost: 0, common: true, icon: '🍯' },
    'Moonwater': { name: 'Moonwater', cost: 1, common: false, icon: '🌙' },
    'Salt': { name: 'Salt', cost: 0, common: true, icon: '🧂' },
    'Blessed ash': { name: 'Blessed ash', cost: 1, common: false, icon: '🔥' },
    'Iron filings': { name: 'Iron filings', cost: 0, common: true, icon: '⚙️' },
    'Nightshade': { name: 'Nightshade', cost: 1, common: false, icon: '☠️' },
    'Pure water': { name: 'Pure water', cost: 0, common: true, icon: '💧' },
    'Blood': { name: 'Blood', cost: 0, common: true, icon: '🩸' },
    'Chamomile': { name: 'Chamomile', cost: 0, common: true, icon: '🌼' },
    'Moonwort': { name: 'Moonwort', cost: 1, common: false, icon: '🌙' },
    'Sulphur': { name: 'Sulphur', cost: 0, common: true, icon: '🟡' },
    'Saltpetre': { name: 'Saltpetre', cost: 0, common: true, icon: '🧪' },
    'Olive oil': { name: 'Olive oil', cost: 0, common: true, icon: '🫒' },
    'Incense': { name: 'Incense', cost: 0, common: true, icon: '🪔' }
};

const FALLBACK_RECIPES = {
    'healing-poultice': {
        id: 'healing-poultice',
        name: '🩹 Healing Poultice',
        description: 'A balm of herbs and salves that speeds recovery.',
        effect: 'Remove 1 Fatigue when applied during a short rest.',
        materials: ['Herbs (1 Supply)', 'Clean cloth', 'Time (1 hour)'],
        ingredients: ['Herbs', 'Clean cloth'],
        skill: 'medicine',
        dv: 2,
        xpCost: 1,
        tier: 'minor',
        icon: '🩹'
    },
    'antidote': {
        id: 'antidote',
        name: '🧪 Antidote',
        description: 'A bitter draught that neutralises common poisons.',
        effect: 'Remove one Poisoned Condition.',
        materials: ['Specific herb (rare)', 'Distilled water', 'Charcoal'],
        ingredients: ['Rare herb', 'Distilled water', 'Charcoal'],
        skill: 'medicine',
        dv: 3,
        xpCost: 2,
        tier: 'minor',
        icon: '🧪'
    },
    'sleep-draught': {
        id: 'sleep-draught',
        name: '💤 Sleep Draught',
        description: 'A sweet syrup that induces deep, dreamless sleep.',
        effect: 'Target tests Spirit+Resolve (DV 3) or falls asleep for 1 hour.',
        materials: ['Valerian root', 'Honey', 'Moonwater'],
        ingredients: ['Valerian root', 'Honey', 'Moonwater'],
        skill: 'craft',
        dv: 3,
        xpCost: 1,
        tier: 'minor',
        icon: '💤'
    },
    'ward-salt': {
        id: 'ward-salt',
        name: '🧂 Ward Salt',
        description: 'Salt blessed with protective herbs and iron filings.',
        effect: 'Line wards against spirits and undead (Spirit+Resolve DV 4 to cross).',
        materials: ['Salt (1 Supply)', 'Blessed ash', 'Iron filings'],
        ingredients: ['Salt', 'Blessed ash', 'Iron filings'],
        skill: 'lore',
        dv: 3,
        xpCost: 2,
        tier: 'minor',
        icon: '🧂'
    },
    'truth-serum': {
        id: 'truth-serum',
        name: '🔮 Truth Serum',
        description: 'A clear liquid that loosens the tongue.',
        effect: 'Target tests Spirit+Resolve (DV 4) or speaks only truth for one exchange.',
        materials: ['Nightshade (carefully prepared)', 'Pure water', 'A drop of blood'],
        ingredients: ['Nightshade', 'Pure water', 'Blood'],
        skill: 'craft',
        dv: 4,
        xpCost: 3,
        tier: 'standard',
        icon: '🔮'
    },
    'moon-tea': {
        id: 'moon-tea',
        name: '🌙 Moon Tea',
        description: 'A calming infusion that sharpens dreams and intuition.',
        effect: '+1 die on next Wits or Spirit roll within 1 hour.',
        materials: ['Chamomile', 'Moonwort', 'Honey'],
        ingredients: ['Chamomile', 'Moonwort', 'Honey'],
        skill: 'craft',
        dv: 2,
        xpCost: 1,
        tier: 'minor',
        icon: '🌙'
    },
    'fire-powder': {
        id: 'fire-powder',
        name: '🔥 Fire Powder',
        description: 'A volatile powder that ignites on contact with air.',
        effect: 'Creates a small fire (Harm 2, Area) in Close range. One use.',
        materials: ['Sulphur', 'Charcoal', 'Saltpetre'],
        ingredients: ['Sulphur', 'Charcoal', 'Saltpetre'],
        skill: 'craft',
        dv: 4,
        xpCost: 3,
        tier: 'standard',
        icon: '🔥'
    },
    'blessed-oil': {
        id: 'blessed-oil',
        name: '🕯️ Blessed Oil',
        description: 'Oil consecrated to a Patron or Threshold.',
        effect: 'Anoints a weapon or threshold; counts as [WARD] or [BLESSED] for one scene.',
        materials: ['Olive oil', 'Incense', 'A prayer or rite'],
        ingredients: ['Olive oil', 'Incense'],
        skill: 'lore',
        dv: 3,
        xpCost: 2,
        tier: 'standard',
        icon: '🕯️'
    }
};

// ============================================================
// WITCHCRAFT LOOKUP
// ============================================================

function findPatronWitchcraft(patronId) {
    const state = getState();

    if (state.patrons?.cosmic) {
        const patron = state.patrons.cosmic.find(p => p.id === patronId);
        if (patron && patron.witchcraft) {
            return { patron, witchcraft: patron.witchcraft };
        }
    }

    if (state.patrons?.terrestrial) {
        const patron = state.patrons.terrestrial.find(p => p.id === patronId);
        if (patron && patron.witchcraft) {
            return { patron, witchcraft: patron.witchcraft };
        }
    }

    if (state.patrons?.religions) {
        for (const religion of state.patrons.religions) {
            if (religion.orders) {
                const order = religion.orders.find(o => o.id === patronId);
                if (order && order.witchcraft) {
                    return { patron: order, witchcraft: order.witchcraft, religion: religion.name };
                }
            }
        }
    }

    return null;
}

function getAllWitchcraftPatrons() {
    const state = getState();
    const results = [];

    if (state.patrons?.cosmic) {
        for (const patron of state.patrons.cosmic) {
            if (patron.witchcraft) {
                results.push({
                    patronId: patron.id,
                    patronName: patron.name || patron.title || patron.id,
                    patronIcon: patron.icon || '🧙',
                    witchcraft: patron.witchcraft,
                    source: 'cosmic'
                });
            }
        }
    }

    if (state.patrons?.terrestrial) {
        for (const patron of state.patrons.terrestrial) {
            if (patron.witchcraft) {
                results.push({
                    patronId: patron.id,
                    patronName: patron.name || patron.title || patron.id,
                    patronIcon: patron.icon || '🏛️',
                    witchcraft: patron.witchcraft,
                    source: 'terrestrial'
                });
            }
        }
    }

    if (state.patrons?.religions) {
        for (const religion of state.patrons.religions) {
            if (religion.orders) {
                for (const order of religion.orders) {
                    if (order.witchcraft) {
                        results.push({
                            patronId: order.id,
                            patronName: order.name || order.id,
                            patronIcon: order.icon || religion.icon || '⛪',
                            witchcraft: order.witchcraft,
                            source: 'religion',
                            religion: religion.name
                        });
                    }
                }
            }
        }
    }

    return results;
}

// ============================================================
// HELPERS
// ============================================================

function safeString(val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => safeString(v)).join(', ');
    if (typeof val === 'object') {
        if (val.name) return safeString(val.name);
        if (val.label) return safeString(val.label);
        if (val.description) return safeString(val.description);
        if (val.effect) return safeString(val.effect);
        try { return JSON.stringify(val); } catch (e) { return '[object]'; }
    }
    return String(val);
}

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

function getTierFromXp(xp) {
    if (xp < 40) return 'I';
    if (xp < 90) return 'II';
    if (xp < 150) return 'III';
    if (xp < 220) return 'IV';
    return 'V';
}

// ─── Magic Paths Reference ─────────────────────────────────────
const MAGIC_PATH_REFERENCE = [
    { icon: '🔥', label: 'Free Caster', blurb: 'Raw TAGS grammar, no patron — pure will and improvisation.' },
    { icon: '📖', label: 'Runekeeper', blurb: 'Bound to one patron via Thiasos or Codex; steady Rites.' },
    { icon: '🔯', label: 'Invoker', blurb: 'Carries Symbols from multiple patrons; risks Cross-Resonance.' },
    { icon: '🎵', label: 'Cantor', blurb: "Sings a patron's Rites as Songs; Corruption blooms with Pushing." },
    { icon: '👁️', label: 'Summoner', blurb: 'Binds spirits from the Bestiary; manages the Leash.' },
    { icon: '🌿', label: 'Witch', blurb: 'Hedge magic at Thresholds, paid in Shadow, Shame, Identity Strain.' },
    { icon: '🧠', label: 'Psion', blurb: 'Mind-born power fueled by Mental Strain.' },
    { icon: '🧘', label: 'Monk', blurb: 'Patron-optional path of Breath States and monastic Techniques.' },
    { icon: '🦅', label: 'Familiar Only', blurb: 'A bonded companion without a full magic path.' },
    { icon: '🍃', label: 'Hedge Gifts', blurb: 'Small universal gifts available to any character.' }
];

function renderMagicPathReferenceHtml(highlightLabel) {
    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.4rem;text-align:left;margin-top:0.8rem;">
            ${MAGIC_PATH_REFERENCE.map(p => `
                <div style="padding:0.4rem 0.5rem;border-radius:var(--radius);background:var(--bg2);border:1px solid ${p.label === highlightLabel ? 'var(--gold)' : 'var(--border)'};">
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:1.1rem;">${p.icon}</span>
                        <strong style="font-size:0.82rem;${p.label === highlightLabel ? 'color:var(--gold);' : ''}">${p.label}</strong>
                    </div>
                    <div style="font-size:0.68rem;color:var(--text3);margin-top:0.15rem;line-height:1.3;">${p.blurb}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================
// WITCHCRAFT STATE (per character)
// ============================================================

function getWitchState(char) {
    if (!char.witch) char.witch = {};
    return char.witch;
}

function getPriceTracks(char) {
    const w = getWitchState(char);
    if (!w.prices) w.prices = { shadow: 0, shame: 0, identityStrain: 0 };
    return w.prices;
}

function getPromiseTimers(char) {
    const w = getWitchState(char);
    if (!w.promiseTimers) w.promiseTimers = [];
    return w.promiseTimers;
}

function getHedgeGifts(char) {
    const w = getWitchState(char);
    if (!w.hedgeGifts) w.hedgeGifts = [];
    return w.hedgeGifts;
}

function getFullRituals(char) {
    const w = getWitchState(char);
    if (!w.rituals) w.rituals = [];
    return w.rituals;
}

function getCraftedItems(char) {
    const w = getWitchState(char);
    if (!w.crafted) w.crafted = [];
    return w.crafted;
}

function getIngredients(char) {
    const w = getWitchState(char);
    if (!w.ingredients) w.ingredients = [];
    return w.ingredients;
}

// ============================================================
// MAIN RENDER – Path-aware
// ============================================================

export async function renderWitchcraft(el) {
    const char = getCharacterData();
    if (!char) {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🧹</div>
                <p>Select a character to view their hedge magic.</p>
                <div style="margin-top:0.5rem;font-weight:600;color:var(--gold);">📚 Magic Paths Reference</div>
                ${renderMagicPathReferenceHtml('Witch')}
            </div>
        `;
        return;
    }

    // Ensure patron data is loaded
    await ensurePatronDataLoaded();
    // Ensure wiki data is loaded
    await ensureWikiLoaded();

    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    // Parse ingredients and recipes from wiki (or fallback)
    let ingredientMap = parseIngredientsFromWiki(wikiEntries);
    let recipeMap = parseRecipesFromWiki(wikiEntries);

    // If no entries found, use fallback
    if (Object.keys(ingredientMap).length === 0) {
        ingredientMap = FALLBACK_INGREDIENTS;
    }
    if (Object.keys(recipeMap).length === 0) {
        recipeMap = FALLBACK_RECIPES;
    }

    const isWitch = char.magicPath === 'witch';
    const hasHedgeGifts = (char.hedgeGifts || []).length > 0 || (char.witch?.hedgeGifts || []).length > 0;
    const hasCraftOfTheHedge = (char.talents || []).some(t =>
        t.name === 'Craft of the Hedge' || t.id === 'craft-of-the-hedge'
    );

    if (!isWitch && !hasHedgeGifts && !hasCraftOfTheHedge) {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🧹</div>
                <p>Hedge magic is available to all characters with the <strong>Craft of the Hedge</strong> talent.</p>
                <p style="font-size:0.85rem;">Learn Hedge Gifts, craft items, and work with thresholds.</p>
                <p style="font-size:0.75rem;color:var(--text2);">Witches gain deeper access to rituals and price tracks.</p>
            </div>
        `;
        return;
    }

    const patronId = char.patron;
    const witchcraftData = patronId ? findPatronWitchcraft(patronId) : null;
    const prices = getPriceTracks(char);
    const timers = getPromiseTimers(char);
    const gifts = getHedgeGifts(char);
    const rituals = getFullRituals(char);
    const crafted = getCraftedItems(char);
    const ingredients = getIngredients(char);
    const allPatrons = getAllWitchcraftPatrons();

    // Build list of available gifts for dropdown (universal + patron)
    const patronGifts = witchcraftData?.witchcraft?.hedge_gifts || [];
    const availableGifts = [...UNIVERSAL_HEDGE_GIFTS, ...patronGifts];
    const seen = new Set();
    const uniqueGifts = availableGifts.filter(g => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
    });

    const identityThreshold = prices.identityStrain >= 3;
    const showFullWitch = isWitch;

    // Build recipe options for dropdown
    const recipeOptions = Object.values(recipeMap);
    // List of ingredient names for quick reference
    const ingredientNames = Object.keys(ingredientMap);

    el.innerHTML = `
        <div class="witchcraft-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="witchcraft-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;background:linear-gradient(135deg, var(--bg2) 0%, var(--bg1) 100%);border-radius:var(--radius) var(--radius) 0 0;padding:0.3rem 0.8rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🧹</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Hedge Magic</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.3rem;">${isWitch ? 'Witch' : 'Hedge-Gifted'}</span>
                        ${witchcraftData ? `<span style="font-size:0.6rem;color:var(--text3);">· ${witchcraftData.patron.name}</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="window.witchQuickWork()">⚡ Quick Work</button>
                    ${showFullWitch ? `<button class="btn btn-sm btn-secondary" onclick="window.witchFullRitual()">🕯️ Ritual</button>` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="window.witchAddGift()">🌿 Gift</button>
                    <button class="btn btn-sm btn-ghost" onclick="window.witchRefresh()" title="Reloads patron data from disk, bypassing any cached copy">🔄</button>
                </div>
            </div>

            <!-- ─── Price Tracks (Witches only) ────────────────── -->
            ${showFullWitch ? `
                <div class="witchcraft-prices" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.3rem;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;${identityThreshold ? 'border:2px solid var(--red);' : 'border:1px solid var(--border);'}">
                    ${Object.entries(PRICE_THRESHOLDS).map(([key, meta]) => {
                        const value = prices[key] || 0;
                        const pct = Math.min(100, (value / meta.max) * 100);
                        const isWarning = value >= meta.warningAt;
                        return `
                            <div style="text-align:center;">
                                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                                    <span style="color:${meta.color};">${meta.icon} ${meta.label}</span>
                                    <span style="font-weight:600;color:${isWarning ? 'var(--red)' : 'var(--text)'};">${value}/${meta.max}</span>
                                </div>
                                <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                                    <div style="width:${pct}%;height:100%;background:${isWarning ? 'var(--red)' : meta.color};border-radius:3px;transition:width 0.3s;"></div>
                                </div>
                                ${isWarning ? `<div style="font-size:0.5rem;color:var(--red);">⚠️ Near threshold</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                    <div style="display:flex;gap:0.2rem;align-items:center;justify-content:center;">
                        <button class="btn btn-xs btn-ghost" onclick="window.witchClearPrices()" style="font-size:0.6rem;">✕ Clear</button>
                    </div>
                </div>
            ` : ''}

            <!-- ─── Weaver Display ─────────────────────────────── -->
            ${witchcraftData ? renderWeaver(witchcraftData, char) : renderNoWeaver(allPatrons)}

            <!-- ─── Hedge Gifts ────────────────────────────────── -->
            <div class="witchcraft-gifts" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🌿 Hedge Gifts</span>
                    <div style="display:flex;gap:0.2rem;align-items:center;">
                        <span style="font-size:0.6rem;color:var(--text3);">${gifts.length} learned</span>
                        <select id="witch-gift-select" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.3rem;max-width:140px;">
                            ${uniqueGifts.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                        </select>
                        <button class="btn btn-xs btn-secondary" onclick="window.witchAddGiftFromSelect()">+ Add</button>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:200px;overflow-y:auto;">
                    ${gifts.length === 0 ? `
                        <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                            No hedge gifts learned. Select a gift from the dropdown and click "Add".
                        </div>
                    ` : gifts.map(g => renderGiftItem(g, char)).join('')}
                </div>
            </div>

            <!-- ─── Promise Timers ────────────────────────────── -->
            <div class="witchcraft-timers" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⏳ Promise Timers</span>
                    <div style="display:flex;gap:0.2rem;">
                        <span style="font-size:0.6rem;color:var(--text3);">${timers.length} active</span>
                        <button class="btn btn-xs btn-secondary" onclick="window.witchAddTimer()">+ Add</button>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:150px;overflow-y:auto;">
                    ${timers.length === 0 ? `
                        <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                            No active promises. When you make a deal, track it here.
                        </div>
                    ` : timers.map(t => renderTimerItem(t, char)).join('')}
                </div>
            </div>

            <!-- ─── Crafting & Ingredients ────────────────────── -->
            <div class="witchcraft-crafting" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;flex-direction:column;gap:0.3rem;">
                    <!-- Top row: actions -->
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                        <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🔧 Alchemy & Crafting</span>
                        <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                            <button class="btn btn-xs btn-secondary" onclick="window.witchForageIngredient()">🌿 Forage</button>
                            <button class="btn btn-xs btn-secondary" onclick="window.witchPurchaseIngredient()">💰 Buy Rare</button>
                            <button class="btn btn-xs btn-primary" onclick="window.witchCombineIngredients()">⚗️ Combine</button>
                            <button class="btn btn-xs btn-gold" onclick="window.witchCraftFromRecipe()">📜 Craft Recipe</button>
                        </div>
                    </div>

                    <!-- Ingredients inventory -->
                    <div style="font-size:0.75rem;color:var(--text3);">
                        <strong>Ingredients:</strong> 
                        ${ingredients.length === 0 ? 'None' : ingredients.map(i => {
                            const def = ingredientMap[i] || { name: i, icon: '🧪', cost: 0, common: true };
                            return `<span style="display:inline-block;background:var(--bg3);border-radius:4px;padding:0.05rem 0.4rem;margin:0.1rem;border:1px solid var(--border);">
                                ${def.icon || '🧪'} ${i} 
                                <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveIngredient('${i}')" style="font-size:0.5rem;color:var(--red);padding:0 0.2rem;">✕</button>
                            </span>`;
                        }).join('')}
                    </div>

                    <!-- Crafted items list -->
                    <div style="max-height:120px;overflow-y:auto;">
                        ${crafted.length === 0 ? `
                            <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.3rem 0;">
                                No crafted items. Combine ingredients or craft a recipe.
                            </div>
                        ` : crafted.map(c => renderCraftedItem(c, char)).join('')}
                    </div>
                </div>
            </div>

            <!-- ─── Full Rituals (Witches only) ────────────────── -->
            ${showFullWitch ? `
                <div class="witchcraft-rituals" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                        <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🕯️ Full Rituals</span>
                        <span style="font-size:0.6rem;color:var(--text3);">${rituals.length} performed</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:120px;overflow-y:auto;">
                        ${rituals.length === 0 ? `
                            <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                                No rituals performed. Perform a ritual to shape the world.
                            </div>
                        ` : rituals.slice(-5).reverse().map(r => renderRitualItem(r, char)).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- ─── Quick Reference ────────────────────────────── -->
            <div class="witchcraft-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.1rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.15rem 0.3rem;border:1px solid var(--border);">
                <div>🌿 <strong>Gifts:</strong> No-roll, limited scope</div>
                <div>⚡ <strong>Quick:</strong> Single action, roll required</div>
                ${showFullWitch ? `<div>🕯️ <strong>Ritual:</strong> Extended, lasting effects</div>` : ''}
                <div>🔧 <strong>Craft:</strong> Ingredients, recipes, XP</div>
                <div>⏳ <strong>Timer:</strong> When full, price comes due</div>
            </div>

            <!-- ─── The Gray Wanderer's Wisdom ──────────────────── -->
            <div class="witchcraft-wisdom" style="background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.5rem;border-left:4px solid var(--gold);font-size:0.7rem;color:var(--text3);font-style:italic;">
                "${witchcraftData?.witchcraft?.quote || 'The hedge is what keeps the wolves from the flock. I am the one who tends the hedge.'}"
                <span style="display:block;text-align:right;font-size:0.6rem;color:var(--text2);">— The Gray Wanderer</span>
            </div>

        </div>
    `;
}

// ============================================================
// RENDER HELPERS
// ============================================================

function renderWeaver(witchcraftData, char) {
    const patron = witchcraftData.patron;
    const wc = witchcraftData.witchcraft;
    const color = wc.color || '#d4af37';
    const icon = patron.icon || '🧙';
    const name = patron.name || patron.title || 'The Weaver';
    const description = wc.description || 'A witch of the hedge.';
    const signatureRite = wc.signature_rite || 'Unknown';
    const hedgeGifts = wc.hedge_gifts || [];

    return `
        <div class="witchcraft-weaver" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid ${color};border:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                <span style="font-size:1.2rem;">${icon}</span>
                <span style="font-weight:600;font-size:0.95rem;color:${color};">${name}</span>
                <span style="font-size:0.7rem;color:var(--text3);">${description}</span>
                ${witchcraftData.religion ? `<span style="font-size:0.6rem;color:var(--text3);">⛪ ${witchcraftData.religion}</span>` : ''}
            </div>
            ${wc.lore ? `<div style="font-size:0.75rem;color:var(--text2);margin:0.15rem 0;">${wc.lore}</div>` : ''}
            ${signatureRite ? `<div style="font-size:0.75rem;color:var(--text2);"><strong>Signature Rite:</strong> ${signatureRite}</div>` : ''}
            ${hedgeGifts.length > 0 ? `
                <div style="display:flex;gap:0.3rem;font-size:0.65rem;color:var(--text3);flex-wrap:wrap;margin-top:0.1rem;">
                    ${hedgeGifts.map(g => `<span>🌿 ${g.name}</span>`).join(' · ')}
                </div>
            ` : ''}
        </div>
    `;
}

function renderNoWeaver(allPatrons) {
    const list = allPatrons.map(p =>
        `• ${p.patronIcon} ${p.patronName}: ${p.witchcraft.name || 'Witchcraft'}`
    ).join('\n');

    return `
        <div class="witchcraft-no-weaver" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
            <div style="font-size:1.5rem;">🧙</div>
            <p>No weaver selected. Choose a patron who offers witchcraft.</p>
            <div style="font-size:0.7rem;text-align:left;max-height:80px;overflow-y:auto;padding:0.2rem;background:var(--bg3);border-radius:var(--radius);margin:0.2rem 0;">
                ${list || 'No patrons with witchcraft found. Check your patron JSON files.'}
            </div>
            <button class="btn btn-sm btn-primary" onclick="window.witchChooseWeaver()">Choose Weaver</button>
        </div>
    `;
}

function renderGiftItem(gift, char) {
    return `
        <div class="gift-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
            <div style="flex:1;min-width:0;">
                <span style="font-weight:600;">${escHtml(gift.name)}</span>
                <span style="font-size:0.65rem;color:var(--text3);">${escHtml(gift.effect)}</span>
                ${gift.limit ? `<span style="font-size:0.55rem;color:var(--text2);">(${gift.limit})</span>` : ''}
            </div>
            <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveGift('${gift.id || gift.name}')" style="color:var(--red);font-size:0.6rem;">✕</button>
        </div>
    `;
}

function renderTimerItem(timer, char) {
    const pct = Math.min(100, ((timer.current || 0) / (timer.segments || 4)) * 100);
    const isFull = pct >= 100;
    return `
        <div class="timer-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;">
                    <span style="font-weight:600;color:${isFull ? 'var(--red)' : 'var(--text)'};">${escHtml(timer.name)}</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${timer.current || 0}/${timer.segments || 4}</span>
                </div>
                <div style="width:100%;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${isFull ? 'var(--red)' : pct > 80 ? 'var(--orange)' : 'var(--gold)'};border-radius:2px;"></div>
                </div>
                ${timer.description ? `<div style="font-size:0.6rem;color:var(--text2);">${escHtml(timer.description)}</div>` : ''}
                ${isFull ? `<div style="font-size:0.6rem;color:var(--red);">⚠️ DUE!</div>` : ''}
            </div>
            <div style="display:flex;gap:0.2rem;">
                <button class="btn btn-xs btn-secondary" onclick="window.witchTickTimer('${timer.id}')" style="font-size:0.6rem;">+</button>
                <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveTimer('${timer.id}')" style="color:var(--red);font-size:0.6rem;">✕</button>
            </div>
        </div>
    `;
}

function renderCraftedItem(item, char) {
    const uses = item.uses || 1;
    return `
        <div class="crafted-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
            <div style="flex:1;min-width:0;">
                <span style="font-weight:600;">${escHtml(item.name)}</span>
                <span style="font-size:0.65rem;color:var(--text3);">${escHtml(item.effect)}</span>
                ${item.quality ? `<span style="font-size:0.55rem;color:${item.quality === 'standard' ? 'var(--green)' : 'var(--orange)'};">(${item.quality})</span>` : ''}
                <span style="font-size:0.55rem;color:var(--text2);">${uses} uses</span>
            </div>
            <div style="display:flex;gap:0.2rem;">
                <button class="btn btn-xs btn-gold" onclick="window.witchUseCraftedItem('${item.id}')" style="font-size:0.6rem;">Use</button>
                <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveCraftedItem('${item.id}')" style="color:var(--red);font-size:0.6rem;">✕</button>
            </div>
        </div>
    `;
}

function renderRitualItem(ritual, char) {
    return `
        <div class="ritual-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.7rem;">
            <div style="flex:1;min-width:0;">
                <span style="font-weight:600;">${escHtml(ritual.name)}</span>
                <span style="font-size:0.6rem;color:var(--text3);">${ritual.result || 'Pending'}</span>
                ${ritual.effect ? `<span style="font-size:0.6rem;color:var(--text2);">— ${escHtml(ritual.effect)}</span>` : ''}
            </div>
            <span style="font-size:0.5rem;color:var(--text3);">${ritual.date || ''}</span>
        </div>
    `;
}

// ============================================================
// GLOBAL FUNCTIONS (exposed to HTML onclick)
// ============================================================

// ─── Hedge Gifts ──────────────────────────────────────────────

window.witchAddGiftFromSelect = function() {
    const char = getCharacterData();
    if (!char) return;

    const hasCraft = (char.talents || []).some(t =>
        t.name === 'Craft of the Hedge' || t.id === 'craft-of-the-hedge'
    );
    if (!hasCraft && char.magicPath !== 'witch') {
        showToast('Learn the "Craft of the Hedge" talent first.', 'error');
        return;
    }

    const select = document.getElementById('witch-gift-select');
    if (!select) return;
    const giftId = select.value;
    const patronData = char.patron ? findPatronWitchcraft(char.patron) : null;
    const patronGifts = patronData?.witchcraft?.hedge_gifts || [];
    const available = [...UNIVERSAL_HEDGE_GIFTS, ...patronGifts];
    const selected = available.find(g => g.id === giftId);
    if (!selected) {
        showToast('Gift not found.', 'error');
        return;
    }

    const gifts = getHedgeGifts(char);
    if (gifts.some(g => g.name === selected.name)) {
        showToast('Already learned this gift.', 'warning');
        return;
    }

    gifts.push({ ...selected, id: generateId('gift_') });
    saveCharacter({ witch: char.witch });
    showToast(`🌿 Learned "${selected.name}"`, 'success');
    window.witchRefresh();
};

window.witchAddGift = function() {
    const select = document.getElementById('witch-gift-select');
    if (select) {
        window.witchAddGiftFromSelect();
    } else {
        showToast('Please refresh the panel to see the gift selection dropdown.', 'info');
    }
};

window.witchRemoveGift = function(giftId) {
    const char = getCharacterData();
    if (!char) return;
    let gifts = getHedgeGifts(char);
    gifts = gifts.filter(g => g.id !== giftId && g.name !== giftId);
    char.witch.hedgeGifts = gifts;
    saveCharacter({ witch: char.witch });
    showToast('Removed gift.', 'info');
    window.witchRefresh();
};

// ─── Ingredients ─────────────────────────────────────────────

/**
 * Returns the current ingredient map (from wiki or fallback).
 */
function getIngredientMap() {
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    let map = parseIngredientsFromWiki(wikiEntries);
    if (Object.keys(map).length === 0) map = FALLBACK_INGREDIENTS;
    return map;
}

window.witchForageIngredient = function() {
    const char = getCharacterData();
    if (!char) return;

    const ingredientMap = getIngredientMap();
    const common = Object.values(ingredientMap).filter(i => i.common);
    if (common.length === 0) {
        showToast('No common ingredients defined.', 'error');
        return;
    }
    const picked = common[Math.floor(Math.random() * common.length)];
    const ingredients = getIngredients(char);
    ingredients.push(picked.name);
    saveCharacter({ witch: char.witch });
    showToast(`🌿 Foraged ${picked.icon} ${picked.name}`, 'success');
    window.witchRefresh();
};

window.witchPurchaseIngredient = function() {
    const char = getCharacterData();
    if (!char) return;

    const ingredientMap = getIngredientMap();
    const rare = Object.values(ingredientMap).filter(i => !i.common);
    if (rare.length === 0) {
        showToast('No rare ingredients defined.', 'error');
        return;
    }
    const list = rare.map((i, idx) => `${idx+1}. ${i.icon} ${i.name} (${i.cost} XP)`).join('\n');
    const choice = prompt(`💰 Purchase a rare ingredient (costs XP):\n\n${list}\n\nEnter number:`, '1');
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= rare.length) {
        showToast('Invalid selection.', 'error');
        return;
    }
    const picked = rare[idx];
    const totalXp = char.totalXp || 0;
    const spent = char.xpSpent || 0;
    const available = totalXp - spent;
    if (available < picked.cost) {
        showToast(`Not enough XP. Need ${picked.cost}, have ${available}.`, 'error');
        return;
    }
    char.xpSpent = spent + picked.cost;
    const ingredients = getIngredients(char);
    ingredients.push(picked.name);
    saveCharacter({ xpSpent: char.xpSpent, witch: char.witch });
    showToast(`💰 Purchased ${picked.icon} ${picked.name} for ${picked.cost} XP`, 'success');
    window.witchRefresh();
};

window.witchRemoveIngredient = function(ingredientName) {
    const char = getCharacterData();
    if (!char) return;
    let ingredients = getIngredients(char);
    const index = ingredients.indexOf(ingredientName);
    if (index === -1) return;
    ingredients.splice(index, 1);
    char.witch.ingredients = ingredients;
    saveCharacter({ witch: char.witch });
    showToast(`Removed ${ingredientName}.`, 'info');
    window.witchRefresh();
};

// ─── Combine Ingredients (free‑form) ─────────────────────────

window.witchCombineIngredients = function() {
    const char = getCharacterData();
    if (!char) return;

    const ingredients = getIngredients(char);
    if (ingredients.length === 0) {
        showToast('You have no ingredients to combine.', 'error');
        return;
    }

    const list = ingredients.map((name, i) => `${i+1}. ${name}`).join('\n');
    const selection = prompt(`⚗️ Select up to 3 ingredients (by number, separated by commas):\n\n${list}\n\nExample: 1,3,5`, '');
    if (!selection) return;

    const indices = selection.split(',').map(s => parseInt(s.trim()) - 1).filter(n => !isNaN(n) && n >= 0 && n < ingredients.length);
    if (indices.length === 0) {
        showToast('No valid ingredients selected.', 'error');
        return;
    }

    const selectedNames = indices.map(i => ingredients[i]);
    const remaining = ingredients.filter((_, i) => !indices.includes(i));
    char.witch.ingredients = remaining;

    // Check against recipes
    const recipeMap = getRecipeMap();
    let matchedRecipe = null;
    for (const recipe of Object.values(recipeMap)) {
        const recipeIngs = recipe.ingredients || [];
        const allPresent = selectedNames.every(name =>
            recipeIngs.some(r => r.toLowerCase() === name.toLowerCase())
        );
        if (allPresent && selectedNames.length > 0) {
            matchedRecipe = recipe;
            break;
        }
    }

    if (matchedRecipe) {
        // Successfully crafted a known recipe
        const crafted = getCraftedItems(char);
        crafted.push({
            id: generateId('crafted_'),
            name: matchedRecipe.name,
            effect: matchedRecipe.effect,
            quality: 'standard',
            uses: matchedRecipe.tier === 'standard' ? 2 : 1,
            recipe: matchedRecipe.id,
            icon: matchedRecipe.icon || '🔧',
            createdAt: Date.now()
        });
        saveCharacter({ witch: char.witch });
        showToast(`⚗️ Successfully crafted ${matchedRecipe.icon} ${matchedRecipe.name}!`, 'success');
    } else {
        // No recipe matched – random concoction
        const randomEffects = [
            'A bubbly green liquid that smells of mint; drink it to restore 1 Fatigue.',
            'A grey powder that sparkles; it can be thrown to create a flash of light (distract enemies).',
            'A sticky tar that hardens on contact; can be used to patch a leak or jam a lock.',
            'A sweet syrup that induces vivid dreams; take it to gain +1 die on a future Wits roll.',
            'A bitter tonic that purges the system; removes one Poisoned condition (if any).'
        ];
        const effect = randomEffects[Math.floor(Math.random() * randomEffects.length)];
        const crafted = getCraftedItems(char);
        crafted.push({
            id: generateId('crafted_'),
            name: '🧪 Unknown Concoction',
            effect: effect,
            quality: 'flawed',
            uses: 1,
            recipe: null,
            icon: '🧪',
            createdAt: Date.now()
        });
        saveCharacter({ witch: char.witch });
        showToast(`⚗️ You created an unknown concoction: ${effect}`, 'info');
    }

    window.witchRefresh();
};

// ─── Craft from Recipe (guided) ──────────────────────────────

function getRecipeMap() {
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    let map = parseRecipesFromWiki(wikiEntries);
    if (Object.keys(map).length === 0) map = FALLBACK_RECIPES;
    return map;
}

window.witchCraftFromRecipe = function() {
    const char = getCharacterData();
    if (!char) return;

    const recipeMap = getRecipeMap();
    const recipeList = Object.values(recipeMap);
    if (recipeList.length === 0) {
        showToast('No recipes available.', 'error');
        return;
    }

    // Build a readable list
    const list = recipeList.map((r, i) =>
        `${i+1}. ${r.icon} ${r.name} (DV ${r.dv}, ${r.xpCost} XP, ${r.tier})`
    ).join('\n');

    const choice = prompt(`📜 Choose a recipe to craft:\n\n${list}\n\nEnter number:`, '1');
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= recipeList.length) {
        showToast('Invalid selection.', 'error');
        return;
    }

    const recipe = recipeList[idx];
    const required = recipe.ingredients || [];
    const ingredients = getIngredients(char);

    // Check if we have all required ingredients
    const missing = required.filter(req => !ingredients.some(i => i.toLowerCase() === req.toLowerCase()));
    if (missing.length > 0) {
        const proceed = confirm(
            `You are missing: ${missing.join(', ')}.\n` +
            `Do you want to attempt to craft anyway? (You may fail or create a flawed item.)`
        );
        if (!proceed) return;
        // We'll still allow the craft, but the roll will be harder?
        // Actually, we'll allow it but maybe reduce quality on failure.
        // Or we could suggest foraging/purchasing. For simplicity, we allow it.
    }

    // Perform the crafting roll
    const skillLevel = char.skills?.[recipe.skill] || 0;
    const attr = recipe.skill === 'medicine' ? 'wits' :
                 recipe.skill === 'craft' ? 'wits' : 'spirit';
    const attrValue = char[attr] || 1;
    const pool = attrValue + skillLevel;
    const dv = recipe.dv;

    // Check XP
    const totalXp = char.totalXp || 0;
    const spent = char.xpSpent || 0;
    const available = totalXp - spent;
    if (available < recipe.xpCost) {
        showToast(`Not enough XP. Need ${recipe.xpCost}, have ${available}.`, 'error');
        return;
    }

    // Roll
    const result = performRoll(pool, dv);
    let success = false;
    let outcome = '';
    let boons = 0;
    let sbCount = 0;

    if (result.successes >= dv) {
        success = true;
        outcome = '✅ Success';
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = '⚠️ Partial';
        boons = 1;
    } else {
        outcome = '❌ Failure';
        sbCount = result.storyBeats || 1;
        boons = 2;
    }

    // Deduct XP if successful or partial
    if (success || outcome === '⚠️ Partial') {
        char.xpSpent = (char.xpSpent || 0) + recipe.xpCost;
        saveCharacter({ xpSpent: char.xpSpent });
    }

    // Boons
    if (boons > 0) {
        char.boons = (char.boons || 0) + boons;
        if (char.boons > 5) char.boons = 5;
        saveCharacter({ boons: char.boons });
    }

    // Consume ingredients if we have them (or partial)
    // We'll consume only the ones we have, and if missing, we still consume what we have.
    // For simplicity, we consume all that we have of the required ingredients.
    const consumed = [];
    for (const req of required) {
        const idx = ingredients.findIndex(i => i.toLowerCase() === req.toLowerCase());
        if (idx !== -1) {
            consumed.push(ingredients[idx]);
            ingredients.splice(idx, 1);
        }
    }
    char.witch.ingredients = ingredients;

    // Add item if success or partial
    let craftedItem = null;
    if (success || outcome === '⚠️ Partial') {
        const quality = success ? 'standard' : 'flawed';
        craftedItem = {
            id: generateId('crafted_'),
            name: recipe.name,
            effect: recipe.effect,
            quality: quality,
            uses: recipe.tier === 'standard' ? 2 : 1,
            recipe: recipe.id,
            icon: recipe.icon || '🔧',
            createdAt: Date.now()
        };
        const crafted = getCraftedItems(char);
        crafted.push(craftedItem);
        saveCharacter({ witch: char.witch });
        showToast(`🔧 Crafted "${recipe.name}"!`, 'success');
    } else {
        showToast('❌ Crafting failed. Components wasted.', 'error');
    }

    // Show detailed result
    const outcomeColor = success ? 'var(--green)' : outcome === '⚠️ Partial' ? 'var(--orange)' : 'var(--red)';
    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">🔧 Crafting: ${escHtml(recipe.name)}</div>
            <div style="font-size:0.8rem;color:var(--text2);">${escHtml(recipe.description)}</div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${pool}d · DV: ${dv}</div>
            <div style="font-size:0.7rem;color:var(--text3);">Roll: ${result.dice.join(', ')}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${outcomeColor};">${outcome}</div>
            ${success || outcome === '⚠️ Partial' ? `<div style="color:var(--text3);font-size:0.75rem;">Cost: ${recipe.xpCost} XP</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.75rem;">⭐ +${boons} Boon${boons > 1 ? 's' : ''}</div>` : ''}
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${sbCount} SB</div>` : ''}
            ${consumed.length > 0 ? `<div style="font-size:0.7rem;color:var(--text3);">Consumed: ${consumed.join(', ')}</div>` : ''}
            ${missing.length > 0 ? `<div style="font-size:0.7rem;color:var(--orange);">Missing ingredients: ${missing.join(', ')}</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>
        </div>
    `;

    showToastWithHTML(msg, 'info');
    window.witchRefresh();
};

// ─── Quick Work ───────────────────────────────────────────────

window.witchQuickWork = function() {
    const char = getCharacterData();
    if (!char) return;

    const threshold = prompt('⚡ Name the threshold (door, tide line, wound, vow, breath):', 'door');
    if (!threshold) return;

    const layerOptions = '1. Echo (past memory, accumulated intention)\n2. Veil (present boundary, current state)\n3. Flow (future direction, will of elements)';
    const layerChoice = prompt(`Choose a layer:\n\n${layerOptions}\n\nEnter 1, 2, or 3:`, '2');
    if (!layerChoice) return;
    const layerMap = { '1': 'Echo', '2': 'Veil', '3': 'Flow' };
    const layer = layerMap[layerChoice];
    if (!layer) { showToast('Invalid layer. Choose 1, 2, or 3.', 'error'); return; }

    const tag = prompt('Choose a single Tag (e.g., BIND, LIGHT, SILENCE, BURNING, HEAL, WARD):', 'BIND');
    if (!tag) return;

    const pos = prompt('Position: Controlled (you have time) or Desperate (threatened)', 'Controlled');
    const isDesperate = pos.toLowerCase() === 'desperate';

    const wits = char.wits || 1;
    const lore = char.skills?.lore || 0;
    const pool = wits + lore;
    const dv = isDesperate ? 4 : 3;
    const result = performRoll(pool, dv);

    let outcome, priceType, sbCount = 0, boons = 0;
    if (result.successes >= dv && result.storyBeats === 0) {
        outcome = '✨ Clean Success';
        priceType = 'none';
    } else if (result.successes >= dv && result.storyBeats > 0) {
        outcome = '⚠️ Success with SB';
        priceType = 'shadow';
        sbCount = result.storyBeats;
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = '⚠️ Partial Success';
        priceType = 'shame';
        sbCount = result.storyBeats;
        boons = 1;
    } else {
        outcome = '💀 Miss';
        priceType = 'identity';
        sbCount = result.storyBeats || 1;
        boons = 2;
    }

    const isWitch = char.magicPath === 'witch';
    let priceApplied = false;
    if (isWitch && priceType !== 'none') {
        const prices = getPriceTracks(char);
        if (priceType === 'shadow') {
            prices.shadow += 1;
            priceApplied = true;
        } else if (priceType === 'shame') {
            prices.shame += 1;
            priceApplied = true;
        } else if (priceType === 'identity') {
            prices.identityStrain += 1;
            priceApplied = true;
        }
        if (priceApplied) {
            saveCharacter({ witch: char.witch });
            if (prices.identityStrain >= 3) {
                showToast('🌀 Identity Strain threshold reached! Risk losing something of yourself.', 'error');
            }
        }
    }

    if (boons > 0) {
        char.boons = (char.boons || 0) + boons;
        if (char.boons > 5) char.boons = 5;
        saveCharacter({ boons: char.boons });
    }

    const outcomeColor = outcome === '✨ Clean Success' ? 'var(--green)' :
                         outcome === '⚠️ Success with SB' ? 'var(--gold)' :
                         outcome === '⚠️ Partial Success' ? 'var(--orange)' : 'var(--red)';

    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">⚡ Quick Working</div>
            <div style="font-size:0.85rem;color:var(--text2);">
                <div><strong>Threshold:</strong> ${escHtml(threshold)}</div>
                <div><strong>Layer:</strong> ${escHtml(layer)} · <strong>Tag:</strong> ${escHtml(tag)}</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${pool}d · DV: ${dv} · Position: ${isDesperate ? 'Desperate' : 'Controlled'}</div>
            <div style="font-size:0.7rem;color:var(--text3);">Roll: ${result.dice.join(', ')}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${outcomeColor};">${outcome}</div>
            ${priceApplied ? `<div style="color:var(--red);font-size:0.8rem;">Price: ${priceType} (+1)</div>` : '<div style="color:var(--green);">No price.</div>'}
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${sbCount} SB</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.75rem;">⭐ +${boons} Boon${boons > 1 ? 's' : ''}</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>
        </div>
    `;

    showToastWithHTML(msg, outcome === '✨ Clean Success' ? 'success' : 'info');
    window.witchRefresh();
};

// ─── Full Ritual ──────────────────────────────────────────────

window.witchFullRitual = function() {
    const char = getCharacterData();
    if (!char) return;

    if (char.magicPath !== 'witch') {
        showToast('Full rituals require the Witch magic path.', 'error');
        return;
    }

    const threshold = prompt('🕯️ Step 1: Identify the Threshold (door, crossroads, grave, hearth):', 'Crossroads');
    if (!threshold) return;

    const witness = prompt('Step 2: Choose a Witness (person, spirit, Hollowed):', 'The Pale Shepherd');
    if (!witness) return;

    const will = prompt('Step 3: Name the Will (what do you intend to change?):', 'Heal the land');
    if (!will) return;

    const price = prompt('Step 4: Set the Price (memory, name, lock of hair, promise, blood):', 'Memory of a childhood home');
    if (!price) return;

    const dv = safeParseInt(prompt('Step 5: Difficulty (DV 3-6):', '4'), 4);
    const spirit = char.spirit || 1;
    const lore = char.skills?.lore || 0;
    const pool = spirit + lore;
    const result = performRoll(pool, dv);

    let outcome, success = false, boons = 0, sbCount = 0;
    if (result.successes >= dv && result.storyBeats === 0) {
        outcome = '✅ Success';
        success = true;
    } else if (result.successes >= dv && result.storyBeats > 0) {
        outcome = '⚠️ Success with Echo';
        success = true;
        sbCount = result.storyBeats;
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = '⚠️ Partial Success';
        boons = 1;
    } else {
        outcome = '❌ Failure';
        sbCount = result.storyBeats || 1;
        boons = 2;
    }

    const prices = getPriceTracks(char);
    prices.identityStrain += 1;
    saveCharacter({ witch: char.witch });
    if (prices.identityStrain >= 3) {
        showToast('🌀 Identity Strain threshold reached! Risk losing something of yourself.', 'error');
    }

    if (boons > 0) {
        char.boons = (char.boons || 0) + boons;
        if (char.boons > 5) char.boons = 5;
        saveCharacter({ boons: char.boons });
    }

    const rituals = getFullRituals(char);
    rituals.push({
        id: generateId('ritual_'),
        name: will.slice(0, 30) + (will.length > 30 ? '...' : ''),
        effect: will,
        threshold,
        witness,
        price,
        dv,
        result: success ? 'Success' : outcome,
        date: new Date().toLocaleDateString()
    });
    saveCharacter({ witch: char.witch });

    const outcomeColor = success ? 'var(--green)' : outcome === '⚠️ Partial Success' ? 'var(--orange)' : 'var(--red)';

    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">🕯️ Full Ritual</div>
            <div style="font-size:0.85rem;color:var(--text2);">
                <div><strong>Threshold:</strong> ${escHtml(threshold)}</div>
                <div><strong>Witness:</strong> ${escHtml(witness)}</div>
                <div><strong>Will:</strong> ${escHtml(will)}</div>
                <div><strong>Price:</strong> ${escHtml(price)}</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${pool}d · DV: ${dv}</div>
            <div style="font-size:0.7rem;color:var(--text3);">Roll: ${result.dice.join(', ')}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${result.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${outcomeColor};">${outcome}</div>
            <div style="color:var(--red);font-size:0.8rem;">🌀 Identity Strain +1</div>
            ${sbCount > 0 ? `<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${sbCount} SB</div>` : ''}
            ${boons > 0 ? `<div style="color:var(--gold);font-size:0.75rem;">⭐ +${boons} Boon${boons > 1 ? 's' : ''}</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>
        </div>
    `;

    showToastWithHTML(msg, success ? 'success' : 'info');
    window.witchRefresh();
};

// ─── Promise Timers ────────────────────────────────────────────

window.witchAddTimer = function() {
    const char = getCharacterData();
    if (!char) return;

    const name = prompt('⏳ Promise name:', 'Debt to the Web');
    if (!name) return;
    const segments = safeParseInt(prompt('Segments (default 4):', '4'), 4);
    const description = prompt('Description (when due):', 'Price comes due') || '';

    const timers = getPromiseTimers(char);
    timers.push({
        id: generateId('timer_'),
        name,
        segments: Math.max(1, segments),
        current: 0,
        description,
        createdAt: Date.now()
    });
    saveCharacter({ witch: char.witch });
    showToast(`⏳ Promise "${name}" created.`, 'success');
    window.witchRefresh();
};

window.witchTickTimer = function(timerId) {
    const char = getCharacterData();
    if (!char) return;
    const timers = getPromiseTimers(char);
    const timer = timers.find(t => t.id === timerId);
    if (!timer) return showToast('Timer not found.', 'error');

    timer.current = (timer.current || 0) + 1;
    if (timer.current >= timer.segments) {
        showToast(`⏳ "${timer.name}" is full! The price comes due.`, 'warning');
    }
    saveCharacter({ witch: char.witch });
    window.witchRefresh();
};

window.witchRemoveTimer = function(timerId) {
    const char = getCharacterData();
    if (!char) return;
    let timers = getPromiseTimers(char);
    timers = timers.filter(t => t.id !== timerId);
    char.witch.promiseTimers = timers;
    saveCharacter({ witch: char.witch });
    showToast('Timer removed.', 'info');
    window.witchRefresh();
};

// ─── Price Management ─────────────────────────────────────────

window.witchClearPrices = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!confirm('Clear all price tracks?')) return;
    const prices = getPriceTracks(char);
    prices.shadow = 0;
    prices.shame = 0;
    prices.identityStrain = 0;
    saveCharacter({ witch: char.witch });
    showToast('Prices cleared.', 'info');
    window.witchRefresh();
};

// ─── Crafted Item Usage ──────────────────────────────────────

window.witchUseCraftedItem = function(itemId) {
    const char = getCharacterData();
    if (!char) return;
    const crafted = getCraftedItems(char);
    const item = crafted.find(c => c.id === itemId);
    if (!item) return showToast('Item not found.', 'error');

    const effect = item.effect || 'The item is used.';
    showToast(`🧪 Used "${item.name}": ${effect}`, 'success');

    item.uses = (item.uses || 1) - 1;
    if (item.uses <= 0) {
        window.witchRemoveCraftedItem(itemId);
    } else {
        saveCharacter({ witch: char.witch });
        window.witchRefresh();
    }
};

window.witchRemoveCraftedItem = function(itemId) {
    const char = getCharacterData();
    if (!char) return;
    let crafted = getCraftedItems(char);
    crafted = crafted.filter(c => c.id !== itemId);
    char.witch.crafted = crafted;
    saveCharacter({ witch: char.witch });
    showToast('Item removed.', 'info');
    window.witchRefresh();
};

// ─── Weaver Selection ─────────────────────────────────────────

window.witchChooseWeaver = async function() {
    const char = getCharacterData();
    if (!char) return;

    await ensurePatronDataLoaded();

    const allPatrons = getAllWitchcraftPatrons();
    if (allPatrons.length === 0) {
        showToast('No patrons with witchcraft found.', 'error');
        return;
    }

    const list = allPatrons.map((p, i) =>
        `${i+1}. ${p.patronIcon} ${p.patronName} – ${p.witchcraft.name || 'Witchcraft'}`
    ).join('\n');

    const choice = prompt(`🧙 Choose a weaver:\n\n${list}\n\nEnter the number:`, '1');
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= allPatrons.length) {
        showToast('Invalid selection.', 'error');
        return;
    }

    const selected = allPatrons[idx];
    char.patron = selected.patronId;
    saveCharacter({ patron: selected.patronId });
    showToast(`🧙 Chosen weaver: ${selected.patronName}`, 'success');
    window.witchRefresh();
};

// ─── Refresh ──────────────────────────────────────────────────

window.witchRefresh = async function() {
    showToast('🔄 Reloading patron and wiki data…', 'info');
    await ensurePatronDataLoaded(true);
    await ensureWikiLoaded(true);

    const existing = document.querySelector('.witchcraft-container');
    const mount = existing ? existing.parentElement : document.getElementById('spellcraft-content');
    if (mount) {
        await renderWitchcraft(mount);
    } else {
        import('../index.js').then(module => {
            if (module.renderActiveTabContent) module.renderActiveTabContent();
        });
    }
    showToast('✅ Hedge magic refreshed.', 'success');
};

// ============================================================
// TOAST WITH HTML (shared)
// ============================================================

function showToastWithHTML(html, type = 'info') {
    const existing = document.querySelector('.custom-toast-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'custom-toast-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.2rem; border-radius: var(--radius);
        max-width: 420px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 80vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.textContent = `
            @keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 10000);
}

// ============================================================
// EXPORT – keep single default export
// ============================================================

export default { renderWitchcraft };