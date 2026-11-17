/** Read current licensed bundles and older bare-array character packs. */
const CORE_SKILLS = [
    'melee', 'ranged', 'athletics', 'stealth', 'endurance', 'craft',
    'sway', 'deception', 'performance', 'insight', 'lore', 'arcana'
];

const RETIRED_SKILLS = {
    unarmed: 'melee', brawl: 'melee', subterfuge: 'deception',
    investigation: 'insight', tactics: 'insight', medicine: 'craft',
    ritual: 'lore', survival: 'endurance', command: 'sway', resolve: 'endurance'
};

export function parsePregens(payload) {
    const characters = Array.isArray(payload) ? payload : payload?.data;
    if (!Array.isArray(characters)) throw new Error('The starter character pack could not be read.');
    const valid = characters.filter(character => character && typeof character.name === 'string' && character.name.trim() && character.skills && typeof character.skills === 'object' && Array.isArray(character.talents));
    if (!valid.length) throw new Error('The starter character pack contains no usable characters.');
    return valid.map(character => {
        const normalized = { ...character, skills: { ...character.skills } };
        for (const attribute of ['body', 'wits', 'spirit', 'presence']) {
            normalized[attribute] = Math.max(1, Number(normalized[attribute]) || 0);
        }
        for (const [retired, current] of Object.entries(RETIRED_SKILLS)) {
            if (normalized.skills[retired] === undefined) continue;
            normalized.skills[current] = Math.max(
                Number(normalized.skills[current]) || 0,
                Number(normalized.skills[retired]) || 0
            );
            delete normalized.skills[retired];
        }
        for (const skill of CORE_SKILLS) normalized.skills[skill] ??= 0;
        return normalized;
    });
}

/** Stable IDs survive a player's rename; name fallback is only for old, ID-less saves. */
export function findExistingPregen(roster, pregen) {
    return roster.find(character => pregen.id && character.id === pregen.id)
        || roster.find(character => (!character.id || !pregen.id) && character.name === pregen.name);
}
