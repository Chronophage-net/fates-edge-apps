/** Read current licensed bundles and older bare-array character packs. */
export function parsePregens(payload) {
    const characters = Array.isArray(payload) ? payload : payload?.data;
    if (!Array.isArray(characters)) throw new Error('The starter character pack could not be read.');
    const valid = characters.filter(character => character && typeof character.name === 'string' && character.name.trim() && character.skills && typeof character.skills === 'object' && Array.isArray(character.talents));
    if (!valid.length) throw new Error('The starter character pack contains no usable characters.');
    return valid;
}

/** Stable IDs survive a player's rename; name fallback is only for old, ID-less saves. */
export function findExistingPregen(roster, pregen) {
    return roster.find(character => pregen.id && character.id === pregen.id)
        || roster.find(character => (!character.id || !pregen.id) && character.name === pregen.name);
}
