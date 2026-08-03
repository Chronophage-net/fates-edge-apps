/**
 * Talent Loader
 *
 * Loads the built-in talent catalog from /data/talents-manifest.json + /data/talents/*.json
 * (the same manifest + individual-file convention already used by data/factions and
 * data/regions) and merges it into state.talents — the same global catalog array the
 * character editor's talent catalog and the talent editor modal already read from.
 *
 * This only ever ADDS talents the player hasn't already got in their catalog (matched
 * by id); it never overwrites a talent a GM/player has since customized locally, so
 * re-running this after an update to the built-in data won't clobber house rules.
 */

import { getState, saveState } from './state.js';
import { ensureTalentEffects } from './talent-effects.js';

const MANIFEST_PATH = '/data/talents-manifest.json';
const TALENTS_BASE_PATH = '/data/talents/';

let loaded = false;
let loadingPromise = null;

async function fetchJSON(path) {
    try {
        const res = await fetch(path);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn('[TalentLoader] Failed to fetch', path, e);
        return null;
    }
}

/**
 * Load the built-in talent catalog into state.talents, once per session unless
 * `force` is passed. Safe to call repeatedly (e.g. every time the character editor
 * or talent editor opens) — it no-ops after the first successful load.
 */
export async function loadTalentCatalog(force = false) {
    if (loaded && !force) return;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        const manifest = await fetchJSON(MANIFEST_PATH);
        const slugs = Array.isArray(manifest) ? manifest : (manifest?.data || []);
        if (!slugs.length) {
            loaded = true;
            return;
        }

        const state = getState();
        if (!state.talents) state.talents = [];
        const existingIds = new Set(state.talents.map(t => t.id).filter(Boolean));

        let added = 0;
        for (const slug of slugs) {
            const data = await fetchJSON(`${TALENTS_BASE_PATH}${slug}.json`);
            if (!data || !data.id) continue;
            if (existingIds.has(data.id)) continue; // don't clobber local customizations
            ensureTalentEffects(data);
            state.talents.push(data);
            existingIds.add(data.id);
            added++;
        }

        if (added > 0) {
            saveState();
            console.log(`[TalentLoader] Loaded ${added} built-in talent(s) into the catalog.`);
        }
        loaded = true;
    })();

    try {
        await loadingPromise;
    } finally {
        loadingPromise = null;
    }
}

export default { loadTalentCatalog };
