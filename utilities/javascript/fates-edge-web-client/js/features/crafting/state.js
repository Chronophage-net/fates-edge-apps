/**
 * Crafting feature — character-side persisted state helpers.
 *
 * Everything here is a small pure(ish) function operating on a `char`
 * object (or a plain array/value pulled off one) with no DOM/vttStore/
 * saveCharacter dependency, so it's exercised directly by
 * tests/unit/crafting.test.js without needing the DOM shim. Actually
 * persisting a change (calling saveCharacter/updateCharacter) is the
 * caller's job — see js/features/crafting/index.js's action functions.
 */

// ============================================================
// CHARACTER-SIDE STATE ACCESSORS
// ============================================================

export function getCraftState(char) {
    if (!char.crafting) char.crafting = {};
    return char.crafting;
}

export function getIngredients(char) {
    const c = getCraftState(char);
    if (!c.ingredients) c.ingredients = [];
    return c.ingredients;
}

export function getCraftedItems(char) {
    const c = getCraftState(char);
    if (!c.crafted) c.crafted = [];
    return c.crafted;
}

export function getAttunedItems(char) {
    const c = getCraftState(char);
    if (!c.attuned) c.attuned = [];
    return c.attuned;
}

export function getCraftingLog(char) {
    const c = getCraftState(char);
    if (!c.log) c.log = [];
    return c.log;
}

// Appends an entry to the character's crafting log (most-recent-first,
// capped at 10) and returns the updated log. Pure w.r.t. persistence —
// callers are responsible for saveCharacter()/updateCharacter() after.
export function addToCraftingLog(char, entry) {
    const log = getCraftingLog(char);
    log.unshift({ ...entry, timestamp: Date.now() });
    if (log.length > 10) log.length = 10; // keep last 10
    char.crafting.log = log;
    return log;
}

export function availableXp(char) {
    return (char.totalXp || 0) - (char.xpSpent || 0);
}

// ============================================================
// FORAGING LIMIT (per downtime)
//
// Not specified anywhere in the rulebook (the Player's Guide's
// "Foraging and Subsistence by Region" table, world_interactions.tex,
// is a travel-survival mechanic with its own DV/roll, unrelated to this
// panel's one-click "grab a free common ingredient" button). This cap
// is a web-client-only economy/pacing decision, not a documented rule —
// pick a different number here if your table wants a different pace.
// Chosen to match the game's existing fondness for "3" (attunement
// limit, combine-up-to-3-ingredients).
// ============================================================

export const FORAGE_LIMIT_PER_DOWNTIME = 3;

export function getForageCount(char) {
    return getCraftState(char).forageCount || 0;
}

export function canForage(char) {
    return getForageCount(char) < FORAGE_LIMIT_PER_DOWNTIME;
}

// Increments the character's forage count for the current downtime.
// Returns the new count. Caller should check canForage() first.
export function recordForageAttempt(char) {
    const c = getCraftState(char);
    c.forageCount = (c.forageCount || 0) + 1;
    return c.forageCount;
}

// Resets forage attempts to 0 — called once per downtime tick (see
// index.js's handleDowntimeTick()), same cadence as upkeep decay.
export function resetForageCount(char) {
    getCraftState(char).forageCount = 0;
}

// ============================================================
// ATTUNEMENT / UPKEEP / DECAY (exported for tests — see
// tests/unit/crafting.test.js and
// tests/integration/downtime-tick-integration.test.js)
// ============================================================

export const ATTUNEMENT_LIMIT = 3;

// "Efficient" upkeep: pay XP equal to ceil(cost / 3), minimum 1.
export function upkeepCostFor(item) {
    const cost = item.cost || 0;
    return Math.max(1, Math.ceil(cost / 3));
}

// "Intensive" upkeep: a flat 1 XP plus spending a downtime scene (the
// scene itself isn't numerically tracked here — it's a narrative/table
// cost enforced by the GM, same as the "Scene" button's tooltip says).
export function intensiveUpkeepCostFor(item) {
    return 1;
}

// Whether a new item can be attuned given the currently-attuned list.
// Already-attuned items can always be toggled off regardless of count.
export function canAttune(attunedItems, entryId) {
    const alreadyAttuned = attunedItems.some(a => a.id === entryId);
    if (alreadyAttuned) return true;
    return attunedItems.length < ATTUNEMENT_LIMIT;
}

export function conditionMeta(condition) {
    if (condition === 'compromised') return { label: 'Compromised', color: 'var(--red)' };
    if (condition === 'neglected') return { label: 'Neglected', color: 'var(--orange)' };
    return { label: 'Maintained', color: 'var(--green)' };
}

// ────────────────────────────────────────────────────────────────────
// DECAY STATE (Maintained -> Neglected -> Compromised)
//
// Player's Guide, sections/items.tex "Attunement and Upkeep":
//   "If you neglect upkeep, the item becomes Neglected (no benefit
//    until you pay the upkeep retroactively). If neglected for two
//    consecutive downtimes, it becomes Compromised (requires a quest
//    to restore)."
//   "Unlike ordinary magic items, artifacts require no upkeep."
//
// A "downtime" here is whatever the table's GM calls one — there's no
// in-app calendar. The app's stand-in is the 'downtime-tick' event
// (see js/features/factions/index.js's "GM Downtime (Faction Turn)"
// button), which fires once per GM-adjudicated downtime and index.js
// listens for. Each attuned item tracks a `paidUpkeepThisDowntime`
// flag, set true by paying upkeep (either mode) and consumed/reset by
// the next tick.
// ────────────────────────────────────────────────────────────────────

export const DECAY_ORDER = ['maintained', 'neglected', 'compromised'];

// One step down the decay track. Compromised is a floor, not a cycle.
export function advanceDecay(condition) {
    const idx = DECAY_ORDER.indexOf(condition || 'maintained');
    const next = idx === -1 ? 0 : Math.min(idx + 1, DECAY_ORDER.length - 1);
    return DECAY_ORDER[next];
}

// Artifacts require no upkeep at all (items.tex "No Upkeep, but No
// Escape") — they never decay regardless of attunement.
export function itemRequiresUpkeep(item) {
    return item.category !== 'artifact';
}

// Applies one downtime's worth of decay/renewal to a list of attuned
// items (mutates and returns them). Pure w.r.t. everything except the
// items themselves, so it's testable without touching character/save
// state or the DOM.
export function applyDowntimeTick(attunedItems) {
    for (const item of attunedItems) {
        if (!itemRequiresUpkeep(item)) continue;
        if (item.paidUpkeepThisDowntime) {
            item.condition = 'maintained';
        } else {
            item.condition = advanceDecay(item.condition);
        }
        item.paidUpkeepThisDowntime = false;
    }
    return attunedItems;
}

// ============================================================
// FLAWS (SRD 6.9.4)
//
// A Partial at the bench does not produce a worse item — it produces an
// item with a named property. A Flaw is not a minus; it is usually the
// most interesting thing about the piece, and the SRD tells the GM to pay
// Boons to a player who leans into one at the worst possible moment.
// ============================================================

export const FLAWS = [
    { id: 'thirsty',     name: 'Thirsty',     effect: 'It wants something first — blood, oil, a spoken name, a coin left out overnight. Feed it, or roll one Position worse.' },
    { id: 'loud',        name: 'Loud',        effect: 'It announces you. Using it hands the GM 1 SB.' },
    { id: 'remembering', name: 'Remembering', effect: "It does what its materials' previous owner wanted, occasionally, and the GM picks when." },
    { id: 'brittle',     name: 'Brittle',     effect: 'On a Miss while using it, it breaks. Not damaged — broken.' },
    { id: 'marked',      name: 'Marked',      effect: 'Anyone who knows the craft can recognise the hand that made it, and that hand is yours.' }
];

export function flawById(id) {
    return FLAWS.find(f => f.id === id) || null;
}

// Obligation marked when a Wonder is finished, by its Talent-equivalent
// tier (SRD 6.9.5). You cannot make magic; you can only borrow it and put
// it somewhere it will stay. A caster with no Patron marks it anyway.
export function wonderObligationFor(xpCost) {
    const xp = Number(xpCost) || 0;
    if (xp <= 0) return 0;   // a Provision or a Work costs no Obligation
    if (xp <= 2) return 1;   // Minor
    if (xp <= 4) return 2;   // Major
    if (xp <= 6) return 3;   // Prestige
    return 4;                // Epic
}
