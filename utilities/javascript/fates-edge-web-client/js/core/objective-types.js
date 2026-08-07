// Objective type registry — id, label, icon, and terminology for the
// two directions a clock can move: "progress" (toward the objective's
// resolution) and "relief"/setback (toward failure or an obstacle
// pushing back). Combat is the one type with real Harm/Fatigue/armor
// mechanics behind it; everything else is a narrative clock using this
// vocabulary for its two directions.
//
// This exact shape is shared with fates-edge-socket-server and
// fates-edge-ai-gm-bot — keep them in sync.
export const OBJECTIVE_TYPES = {
    combat:          { label: 'Combat',              icon: '⚔️', progressLabel: 'Harm',            progressVerb: 'damage',  reliefLabel: 'Heal',       reliefVerb: 'heal',    description: 'A fight — tracks Harm toward defeat.' },
    obstruction:     { label: 'Obstruction',         icon: '🚧', progressLabel: 'Progress',        progressVerb: 'progress', reliefLabel: 'Setback',    reliefVerb: 'setback', description: 'Pushing through a physical or logistical barrier.' },
    skill_challenge: { label: 'Skill Challenge',     icon: '🎯', progressLabel: 'Progress',        progressVerb: 'progress', reliefLabel: 'Setback',    reliefVerb: 'setback', description: 'A multi-roll challenge toward a goal.' },
    trap_ward:       { label: 'Trap / Ward',         icon: '🪤', progressLabel: 'Disarm Progress', progressVerb: 'disarm',  reliefLabel: 'Trigger',    reliefVerb: 'trigger', description: 'Disabling or surviving a trap or magical ward.' },
    lockpick:        { label: 'Lockpick',            icon: '🔓', progressLabel: 'Tumblers',        progressVerb: 'pick',    reliefLabel: 'Jam',        reliefVerb: 'jam',     description: 'Working a lock or similarly fine mechanism.' },
    heist:           { label: 'Heist',               icon: '🕶️', progressLabel: 'Heat',            progressVerb: 'heat',    reliefLabel: 'Cover',      reliefVerb: 'cover',   description: 'A caper with rising suspicion or alarm.' },
    social:          { label: 'Social / Negotiation', icon: '🗣️', progressLabel: 'Leverage',        progressVerb: 'sway',    reliefLabel: 'Resistance', reliefVerb: 'resist', description: 'A negotiation, debate, or persuasion.' },
    // Freeform escape hatch: the GM types their own timer label and "tick"
    // label instead of picking from the fixed list above. `progressLabel`
    // doubles as the overall Timer Label; `progressVerb`/`reliefVerb` both
    // default to the same "tick" word since a freeform clock usually only
    // moves one direction (advance) — a custom relief label can still be
    // supplied per-instance if the GM wants a two-directional clock.
    custom:          { label: 'Custom / Freeform',    icon: '🕘', progressLabel: 'Timer',           progressVerb: 'tick',    reliefLabel: 'Tick Back',  reliefVerb: 'tick back', description: 'A freeform clock with your own label — type your own Timer Label and Tick label.', isCustom: true },
};

// back-compat: existing data with no `type` field is treated as combat
export const DEFAULT_OBJECTIVE_TYPE = 'combat';

/**
 * Resolve an objective type id to its registry entry. Never throws —
 * missing, falsy, or unrecognized ids fall back to the combat entry so
 * old saved data (which has no `type` field at all) behaves exactly as
 * it always has.
 * @param {string|undefined|null} id
 * @returns {typeof OBJECTIVE_TYPES[keyof typeof OBJECTIVE_TYPES]}
 */
export function getObjectiveType(id) {
    if (id && Object.prototype.hasOwnProperty.call(OBJECTIVE_TYPES, id)) {
        return OBJECTIVE_TYPES[id];
    }
    return OBJECTIVE_TYPES[DEFAULT_OBJECTIVE_TYPE];
}

/** True if the given type id is the freeform/custom escape hatch. */
export function isCustomType(id) {
    return id === 'custom';
}

/**
 * Resolve an objective type entry the way the UI should actually render
 * it — same as getObjectiveType(), but for `custom` entries, overlays
 * any GM-supplied `customLabel` (Timer Label) / `customTickLabel` (Tick
 * label) found on the owning object (an encounter, scene, or combatant)
 * over the generic "Timer"/"Tick" defaults. Falls back to the generic
 * custom defaults if no override was supplied, so this never renders an
 * empty label.
 * @param {string|undefined|null} id
 * @param {{customLabel?: string, customTickLabel?: string}} [source]
 */
export function resolveObjectiveType(id, source = {}) {
    const entry = getObjectiveType(id);
    if (!entry.isCustom) return entry;
    const progressLabel = (source.customLabel || '').trim() || entry.progressLabel;
    const tick = (source.customTickLabel || '').trim() || entry.progressVerb;
    return {
        ...entry,
        progressLabel,
        progressVerb: tick,
        reliefLabel: `${progressLabel} (Back)`,
        reliefVerb: tick,
    };
}

/** True if the given type id (or missing/unrecognized id) is combat. */
export function isCombatType(id) {
    return !id || !Object.prototype.hasOwnProperty.call(OBJECTIVE_TYPES, id) || id === 'combat';
}

/** Ordered list of [id, entry] pairs, for populating <select> dropdowns. */
export function listObjectiveTypes() {
    return Object.entries(OBJECTIVE_TYPES);
}
