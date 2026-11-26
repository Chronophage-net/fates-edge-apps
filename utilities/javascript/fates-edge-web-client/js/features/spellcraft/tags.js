/**
 * The spell tag vocabulary, reconciled with the rules.
 *
 * Two sources define tags, and both are used here:
 *  - SRD 11 (Tags & Effects): the eight element tags, the common effect tags,
 *    and the detailed tag entries. "A spell is a combination of one or more
 *    element tags and one or more effect tags."
 *  - The Threadweaver's Spellbook (Caster expansion), Tag Reference: the Weave
 *    tags casters name (BURNING, FORCE, SCRY, LEAP...).
 *
 * Cost: DV = 1 + the sum of tag costs. An ordinary tag costs 1, a dangerous
 * tag 2 (SRD 11 dangerous list, plus SUBVERT by its own entry and GRAVITY by
 * the Threadweaver table, which agree with everything else).
 *
 * The app once offered eleven tags of its own. Those with an SRD equivalent
 * are kept only as aliases, so saved spells still read correctly:
 * LIGHT -> ILLUMINATE, PROTECT -> DEFEND, SENSE -> REVEAL, BLESS -> SANCTIFY,
 * SHADOW and SILENCE -> VEIL, REFLECT -> COUNTER, STORE -> BOOST.
 */

export const TAG_FAMILIES = {
    'Element':         { color: '#e67e22', icon: '🜂' },
    'Weave Elemental': { color: '#f39c12', icon: '🔥' },
    'Kinetic':         { color: '#e74c3c', icon: '💥' },
    'Mind':            { color: '#1abc9c', icon: '🧠' },
    'Life':            { color: '#27ae60', icon: '🌿' },
    'Space':           { color: '#9b59b6', icon: '🌀' },
    'Creation':        { color: '#d35400', icon: '✨' },
    'Time':            { color: '#8e44ad', icon: '⏳' },
    'Protection':      { color: '#2980b9', icon: '🛡️' },
    'Knowledge':       { color: '#2ecc71', icon: '🔍' },
    'Bond & Oath':     { color: '#c0392b', icon: '⛓️' },
};

const T = (name, family, source, description, cost = 1) => ({ name, family, source, description, cost });

export const TAGS = [
    // ── SRD elements ──────────────────────────────────────────
    T('AIR', 'Element', 'SRD', 'Movement, sound, wind, speed. Backlash: scatter, vertigo, deafening gusts.'),
    T('FIRE', 'Element', 'SRD', 'Energy, destruction, light, passion. Backlash: burns, smoke, uncontrolled blaze.'),
    T('EARTH', 'Element', 'SRD', 'Solidity, stone, metal, endurance. Backlash: rubble, heavy footing, tremors.'),
    T('WATER', 'Element', 'SRD', 'Fluidity, healing, cold, emotion. Backlash: flood, slippery ground, dampness.'),
    T('FORTUNE', 'Element', 'SRD', 'Chance, luck, unpredictability. Backlash: random mishap, fragile success.'),
    T('LIFE', 'Element', 'SRD', 'Vitality, growth, healing, nature. Backlash: overgrowth, fever, parasitic plants.'),
    T('FATE', 'Element', 'SRD', 'Destiny, inevitability, causality. Backlash: options close, fixed outcome.'),
    T('DEATH', 'Element', 'SRD', 'Death/Dreams (Obishaal): endings, sleep, thresholds, memory. Backlash: whispers, numbness, threshold shifts.'),

    // ── Threadweaver Weave elementals ─────────────────────────
    T('BURNING', 'Weave Elemental', 'Threadweaver', 'Ignites, heats, or smokes a target. A candle, a torch, a dry leaf. Not a person.'),
    T('FREEZING', 'Weave Elemental', 'Threadweaver', 'Cools, chills, or encases in frost. A lock may stiffen; a puddle may harden.'),
    T('STORM', 'Weave Elemental', 'Threadweaver', 'Calls lightning, thunder, or static charge. Loud and visible.'),
    T('STONE', 'Weave Elemental', 'Threadweaver', 'Hardens, weights, or shapes stone and earth. A wall may rise; a floor may crack.'),
    T('WAVE', 'Weave Elemental', 'Threadweaver', 'Moves water or creates pressure. A current may push; a cistern may empty.'),
    T('WIND', 'Weave Elemental', 'Threadweaver', 'Moves air. A gust may shove; a breeze may cool.'),

    // ── Kinetic ───────────────────────────────────────────────
    T('FORCE', 'Kinetic', 'Threadweaver', 'Pushes, pulls, or strikes with invisible pressure. A door may slam; a weapon may fly from a hand.'),
    T('AREA', 'Kinetic', 'SRD', 'Expands the effect to a zone: everyone within Near is affected, friend or foe.'),
    T('STRIKE', 'Kinetic', 'SRD', 'Focuses the spell on a single target. Stacks: [FATE][STRIKE][STRIKE] is DV 4.'),
    T('WALL', 'Kinetic', 'Threadweaver', 'Creates a barrier of force, element, or illusion. A wall may block, hide, or fall.'),
    T('BIND', 'Kinetic', 'SRD', 'Restrains a target with roots, ropes, or invisible chains. Temporary.'),
    T('DISPEL', 'Kinetic', 'SRD', 'End an ongoing magical effect or construct.'),

    // ── Mind ──────────────────────────────────────────────────
    T('VEIL', 'Mind', 'SRD', 'Obscure a person, object, or zone.'),
    T('SCRY', 'Mind', 'Threadweaver', 'Reveals a distant location or object. A glimpse, not a full view.'),
    T('MEMORY', 'Mind', 'Threadweaver', 'Touches the past. A recollection may sharpen, blur, or vanish.'),
    T('COMMAND', 'Mind', 'SRD', 'Issue a clear order to a sapient target.'),
    T('FEAR', 'Mind', 'Threadweaver', 'Instills dread. The target may flee, freeze, or falter.'),
    T('READ', 'Mind', 'SRD', "Sense the target's current dominant emotion or a single surface thought."),
    T('DOMINATE', 'Mind', 'SRD', "Imposes the caster's will on a sentient creature. The target resists.", 2),
    T('SUBVERT', 'Mind', 'SRD', 'Coerce obedience or twist existing loyalties.', 2),

    // ── Life ──────────────────────────────────────────────────
    T('HEAL', 'Life', 'SRD', 'Restores Fatigue. [LIFE][HEAL] removes 1 Fatigue; [LIFE][HEAL][HEAL] removes 2 or downgrades Harm 1.'),
    T('PURIFY', 'Life', 'Threadweaver', 'Removes poison, disease, or corruption. Some stains are permanent.'),
    T('STRENGTHEN', 'Life', 'Threadweaver', 'Temporarily enhances a body: a faster sprint, a harder punch, a steadier hand.'),
    T('WAKEN', 'Life', 'Threadweaver', 'Rouses a sleeping or stunned creature.'),
    T('BEAST', 'Life', 'Threadweaver', 'Communicates with or influences an animal.'),
    T('BOOST', 'Life', 'SRD', 'Gain +1 die on a single related roll, or clear 1 Fatigue.'),

    // ── Space ─────────────────────────────────────────────────
    T('LEAP', 'Space', 'SRD', 'Teleports the caster within Near range. Line of sight required.', 2),
    T('FOLD', 'Space', 'SRD', 'Bends space around an obstacle. Teleport (Self) [AIR][FOLD] is DV 4.', 2),
    T('GATE', 'Space', 'SRD', 'Creates a two-way portal between two locations.', 2),
    T('GRAVITY', 'Space', 'Threadweaver', 'Alters local gravity. A target may float, stumble, or crush.', 2),
    T('PASSAGE', 'Space', 'SRD', 'Declare a route as permitted or easy.'),
    T('TRANSPORT', 'Space', 'SRD', 'Move a target across an obstacle (blink, lift, pull).'),
    T('THRESHOLD', 'Space', 'SRD', 'Interact with a boundary: door, gate, portal, or conceptual threshold.'),

    // ── Creation ──────────────────────────────────────────────
    T('CREATE', 'Creation', 'SRD', 'Manifests a mundane object from nothing. It crumbles after a scene.', 2),
    T('SUMMON', 'Creation', 'SRD', 'Calls a spirit, elemental, or minor Outsider. Not compelled; negotiation follows.', 2),
    T('TRANSMUTE', 'Creation', 'SRD', 'Changes one substance into another, temporarily.', 2),
    T('ANIMATE', 'Creation', 'SRD', 'Gives motion to an inanimate object.', 2),
    T('TRANSFORM', 'Creation', 'SRD', 'Take on a new form for the scene: +1 Armor, +1 die to a skill, or a minor supernatural ability.', 2),
    T('CONJURE', 'Creation', 'SRD', 'Create a useful object, cover, or hazard.'),
    T('MEND', 'Creation', 'SRD', 'Restore a damaged object to functioning order for the duration of the scene.'),
    T('REPAIR', 'Creation', 'SRD', 'Fully restore a damaged object, tool, or piece of equipment.'),

    // ── Time ──────────────────────────────────────────────────
    T('REWIND', 'Time', 'SRD', 'Reverses a few heartbeats. An action is undone.', 2),
    T('TIME', 'Time', 'SRD', 'Slow or haste in a small zone (Near). +2 DV instead when rewinding or stopping time (GM discretion).'),

    // ── Protection ────────────────────────────────────────────
    T('DEFEND', 'Protection', 'SRD', '+1 die to one defense roll per copy: [AIR][DEFEND] DV 3, [AIR][DEFEND][DEFEND] DV 4.'),
    T('BARRIER', 'Protection', 'SRD', 'Create cover, obstruction, or a physical wall.'),
    T('FORTIFY', 'Protection', 'SRD', 'Harden a person, place, or object against a specific vector (fire, blades, fear, persuasion).'),
    T('WARD', 'Protection', 'SRD', 'Challenge Outsiders crossing a warded edge or zone.'),
    T('UNWARD', 'Protection', 'SRD', 'Unmake or suppress a [WARD] created by a Talent, Ability, or Spell.'),
    T('SEAL', 'Protection', 'SRD', 'Magically lock a container, door, or portal (not spirits).'),
    T('UNSEAL', 'Protection', 'SRD', 'Magically unlock a container, door, or portal sealed by [SEAL].'),
    T('COUNTER', 'Protection', 'SRD', 'Interrupt a spell, rite, or ritual in progress.'),
    T('CLEANSE', 'Protection', 'SRD', 'Remove or suppress a Condition (poison, disease, curse, fear).'),
    T('LIBERATE', 'Protection', 'SRD', 'Automatically escape one mundane physical restraint (ropes, manacles, grapple).'),
    T('BURDEN', 'Protection', 'SRD', 'Take a Condition or 1 Fatigue from an ally onto yourself.'),

    // ── Knowledge ─────────────────────────────────────────────
    T('REVEAL', 'Knowledge', 'SRD', 'Expose illusions, disguises, or hidden clauses.'),
    T('ILLUMINATE', 'Knowledge', 'SRD', 'Creates small, sustained light. Light (Cantrip) is [FIRE][ILLUMINATE].'),
    T('TRUTH', 'Knowledge', 'SRD', 'Ask the GM one yes/no or short-answer question about the present situation.'),
    T('SECRET', 'Knowledge', 'SRD', 'Reveal a deeply hidden fact the target actively conceals.'),
    T('OMEN', 'Knowledge', 'SRD', 'Glimpse a likely future tied to a specific action or decision.'),
    T('DREAM', 'Knowledge', 'SRD', 'Enter a trance; ask the GM one question about a past event or a possible future.'),
    T('MARK', 'Knowledge', 'SRD', 'Tag a target for tracking or leverage.'),

    // ── Bond & Oath ───────────────────────────────────────────
    T('BOND', 'Bond & Oath', 'SRD', 'Strengthen or create a positive tie between a target and a person, place, or ideal.'),
    T('OATH', 'Bond & Oath', 'SRD', 'Bind parties to terms; breaking has teeth.'),
    T('SANCTIFY', 'Bond & Oath', 'SRD', 'Consecrate a zone to a code or Patron.'),
    T('CURSE', 'Bond & Oath', 'SRD', 'Inflict a sticky hindrance with a clear release condition.'),
    T('BANISH', 'Bond & Oath', 'SRD', 'Drive a visible Outsider toward departure.'),
    T('PRESSURE', 'Bond & Oath', 'SRD', 'All enemies in the zone suffer -1 die to physical actions.'),
    T('ERASURE', 'Bond & Oath', 'SRD', 'Annihilate a small object, erase a specific memory, or void a formal debt, oath, or contract.'),
];

/** Former app-only tag names mapped to the rules tag that replaces them. */
export const TAG_ALIASES = {
    LIGHT: 'ILLUMINATE', PROTECT: 'DEFEND', SENSE: 'REVEAL', BLESS: 'SANCTIFY',
    SHADOW: 'VEIL', SILENCE: 'VEIL', REFLECT: 'COUNTER', STORE: 'BOOST',
};

const BY_NAME = new Map(TAGS.map(t => [t.name, t]));

/** Upper-case, bracket-free, alias-resolved tag name. */
export function canonicalTag(tag) {
    const key = String(tag ?? '').replace(/[[\]]/g, '').trim().toUpperCase();
    return TAG_ALIASES[key] || key;
}

/** The tag record, or null if the name is not a rules tag. */
export function getTag(tag) {
    return BY_NAME.get(canonicalTag(tag)) || null;
}

/** 1 for an ordinary tag, 2 for a dangerous one; an unknown tag costs 1. */
export function tagCost(tag) {
    return getTag(tag)?.cost ?? 1;
}

export const DANGEROUS_TAGS = new Set(TAGS.filter(t => t.cost === 2).map(t => t.name));

/** SRD: DV = 1 + the sum of tag costs. */
export function spellDV(tags = []) {
    return 1 + tags.reduce((sum, tag) => sum + tagCost(tag), 0);
}

export function tagColor(tag) {
    const t = getTag(tag);
    return t ? TAG_FAMILIES[t.family].color : 'var(--text3)';
}
