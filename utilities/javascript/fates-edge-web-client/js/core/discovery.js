/**
 * Core – Manifest‑free data discovery
 * Discovers data files by testing known slugs with HEAD requests.
 * Uses localStorage caching with TTL.
 */

// ─── CACHE CONFIG ──────────────────────────────────────────────

const CACHE_TTL = 3600000; // 1 hour

// ─── PATRON SLUGS ──────────────────────────────────────────────

const KNOWN_COSMIC_SLUGS = [
    'aveh_the_rider_behind_the_storm', 'carrion_king', 'gaila_the_laughing_light',
    'grimmir_the_old_man_of_the_forest', 'ibeji_the_twin_stones', 'ikasha_she_who_sleeps',
    'inaea_angel_of_the_spider', 'isoka_angel_of_serpents', 'khemesh_the_abyssal_maw',
    'kuva_the_sky_that_takes_many_names', 'livaea_the_crimson_courtier', 'lucky_jack_the_lord_of_thieves',
    'lunara_the_silver_quiet', 'mab_queen_of_courts', 'maelstraeus_the_infernal_bargainer',
    'malachai_the_cruel_messenger', 'morag_the_hag_weaver_of_hidden_costs', 'moriraath_the_destroyer',
    'mykkiel_arbiter_of_the_covenant', 'nidhoggr_the_worldworm', 'nimorith_the_gray_benefactor',
    'oath_of_flame__light', 'oath_of_flame_light', 'oath_of_mercy_and_grace',
    'oya_the_wind_of_the_sahel', 'palinode_queen_of_encores', 'rayn_mistress_of_the_sea',
    'solara_the_still_mirror', 'the_breath_of_the_first_forge_the_spark_in_the_makers_hand',
    'the_carrion_king_lord_of_decay_and_renewal', 'the_clockwork_monad_the_iterative_forge',
    'the_confessor_beneath_the_bell', 'the_gallows_bell', 'the_inquisitor_prime_the_iron_hand_of_purity',
    'the_ninth_beyond_comprehension', 'the_pale_shepherd_guide_of_transitions',
    'the_sacred_geometry_architect_of_perfect_forms', 'the_unbroken_way_the_way_of_balance',
    'thrysos_king_of_revels', 'varnek_karn_the_deaths_negotiator', 'venara_the_unbroken_thread',
    'vorthak_the_hunger_unbound', 'xhakthul_the_thunderspeaker', 'zephyria_the_first_bloom'
];

const KNOWN_TERRESTRIAL_SLUGS = [
    'velvet-court', 'house-contarini', 'the-iron-covenant', 'silver-fang-tribe',
    'the-whispering-net', 'ashen-syndicate', 'crimson-rose'
];

const KNOWN_RELIGION_SLUGS = [
    'everflame', 'the-celestial-spire', 'church-of-the-red-stone',
    'order-of-the-void', 'temple-of-the-wandering-star'
];

// ─── REGION SLUGS ──────────────────────────────────────────────

const KNOWN_REGION_SLUGS = [
    'acasia', 'aelaerem', 'aeler', 'aelinnel', 'ecktoria',
    'kahfagia', 'midh_ahkaz', 'mistlands', 'silkstrand',
    'the_wilds', 'thepyrgos', 'ubral', 'valewood',
    'vhasia', 'viterra', 'ykrul', 'zakov', 'dungeons'
];

const FALLBACK_REGIONS = ['Acasia', 'Ecktoria', 'Vhasia', 'Viterra', 'Ykrul', 'Silkstrand'];

// ─── PATRON DISCOVERY ──────────────────────────────────────────

/**
 * Discover patron slugs for a given type.
 * @param {string} type - 'cosmic', 'terrestrial', or 'religion'
 * @param {string} dataPath - base path to the JSON files (e.g., './data/patrons/')
 * @param {string|null} fallbackPath - optional fallback path (e.g., './data/factions/')
 * @returns {Promise<string[]>} array of found slugs
 */
export async function discoverPatrons(type, dataPath, fallbackPath = null) {
    let slugs = [];
    let manifestPath = dataPath + 'manifest.json';
    const cacheKey = `fates-edge-patrons-cache-${type}`;

    // 1. Check cache
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const data = JSON.parse(cached);
            if (data.slugs && Date.now() - data.timestamp < CACHE_TTL) {
                console.log(`[Discovery] Using cached ${type} list (${data.slugs.length} items)`);
                return data.slugs;
            }
        }
    } catch (_) {}

    console.log(`[Discovery] Discovering ${type} patrons...`);

    // 2. Try manifest.json
    try {
        const res = await fetch(manifestPath);
        if (res.ok) {
            const manifest = await res.json();
            if (Array.isArray(manifest)) {
                slugs = manifest;
                console.log(`[Discovery] Loaded manifest for ${type} (${slugs.length} items)`);
            } else if (manifest.slugs && Array.isArray(manifest.slugs)) {
                slugs = manifest.slugs;
                console.log(`[Discovery] Loaded manifest slugs for ${type} (${slugs.length} items)`);
            } else {
                console.warn(`[Discovery] Manifest for ${type} is not an array or missing "slugs".`);
            }
        }
    } catch (_) {}

    // 3. Fallback to known slugs
    if (slugs.length === 0) {
        if (type === 'cosmic') slugs = KNOWN_COSMIC_SLUGS;
        else if (type === 'terrestrial') slugs = KNOWN_TERRESTRIAL_SLUGS;
        else if (type === 'religion') slugs = KNOWN_RELIGION_SLUGS;
        else return [];
        console.log(`[Discovery] Using fallback known slugs for ${type} (${slugs.length} items)`);
    }

    // 4. Test each slug with HEAD
    const found = [];
    await Promise.all(slugs.map(async (slug) => {
        let ok = false;
        try {
            const res = await fetch(`${dataPath}${slug}.json`, { method: 'HEAD' });
            if (res.ok) {
                ok = true;
                found.push(slug);
                return;
            }
        } catch (_) {}
        if (!ok && fallbackPath) {
            try {
                const res = await fetch(`${fallbackPath}${slug}.json`, { method: 'HEAD' });
                if (res.ok) {
                    found.push(slug);
                }
            } catch (_) {}
        }
    }));

    // 5. Cache result
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            slugs: found,
            timestamp: Date.now()
        }));
    } catch (_) {}

    console.log(`[Discovery] Found ${found.length} ${type} patrons (out of ${slugs.length} tested)`);
    return found;
}

// ─── REGION DISCOVERY ──────────────────────────────────────────

/**
 * Discover available region slugs by testing known region files.
 * @param {string} regionDir - directory path (default './data/regions')
 * @returns {Promise<string[]>} array of region names (display names)
 */
export async function discoverRegions(regionDir = './data/regions') {
    const cacheKey = 'fates-edge-region-cache';

    // 1. Check cache
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const { names, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TTL) {
                console.log(`[Discovery] Using cached region list (${names.length} regions)`);
                return names;
            }
        }
    } catch (_) {}

    console.log('[Discovery] Discovering available regions...');
    const found = [];

    // 2. Test each known slug with HEAD
    await Promise.all(KNOWN_REGION_SLUGS.map(async (slug) => {
        try {
            const res = await fetch(`${regionDir}/${slug}.json`, { method: 'HEAD' });
            if (res.ok) {
                // Convert slug to display name (capitalized, spaces)
                const name = slug.replace(/-/g, ' ').replace(/_/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase());
                found.push(name);
            }
        } catch (_) { /* ignore */ }
    }));

    found.sort();

    // 3. Cache result
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            names: found,
            timestamp: Date.now()
        }));
    } catch (_) {}

    console.log(`[Discovery] Discovered ${found.length} regions:`, found);
    return found;
}

/**
 * Initialize region names – either from discovery or fallback.
 * @param {string} regionDir - directory path
 * @returns {Promise<string[]>} array of region names
 */
export async function initializeRegions(regionDir = './data/regions') {
    const discovered = await discoverRegions(regionDir);
    if (discovered.length > 0) {
        return discovered;
    } else {
        console.warn('[Discovery] No region files found. Using fallback default regions.');
        return FALLBACK_REGIONS;
    }
}

// ─── BESTIARY DISCOVERY ─────────────────────────────────────────

const BESTIARY_CACHE_KEY = 'fates-edge-bestiary-discovery-cache';
const KNOWN_BESTIARY_SLUGS = [
    'goblin-scavenger', 'skeleton-knight', 'thorn-dryad',
    'slavering-hound', 'cultist-fanatic', 'shadow-wraith'
];

/**
 * Discover bestiary creature slugs.
 * Tries to load a manifest.json first, then falls back to known slugs.
 * Tests each slug with HEAD and caches the result.
 * @param {string} dataPath - path to the bestiary files (default './data/bestiary/')
 * @returns {Promise<string[]>} array of found slugs
 */
export async function discoverBestiary(dataPath = './data/bestiary/') {
    const cacheKey = BESTIARY_CACHE_KEY;

    // 1. Check cache
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const data = JSON.parse(cached);
            if (data.slugs && Date.now() - data.timestamp < CACHE_TTL) {
                console.log(`[Discovery] Using cached bestiary list (${data.slugs.length} items)`);
                return data.slugs;
            }
        }
    } catch (_) {}

    console.log('[Discovery] Discovering bestiary creatures...');
    let slugs = [];

    // 2. Try manifest.json
    try {
        const res = await fetch(`${dataPath}manifest.json`);
        if (res.ok) {
            const manifest = await res.json();
            if (Array.isArray(manifest)) {
                slugs = manifest;
                console.log(`[Discovery] Loaded bestiary manifest (${slugs.length} items)`);
            } else if (manifest.slugs && Array.isArray(manifest.slugs)) {
                slugs = manifest.slugs;
                console.log(`[Discovery] Loaded bestiary manifest slugs (${slugs.length} items)`);
            } else {
                console.warn('[Discovery] Bestiary manifest is not an array or missing "slugs".');
            }
        }
    } catch (_) {}

    // 3. Fallback to known slugs
    if (slugs.length === 0) {
        slugs = KNOWN_BESTIARY_SLUGS;
        console.log(`[Discovery] Using fallback known bestiary slugs (${slugs.length} items)`);
    }

    // 4. Test each slug with HEAD
    const found = [];
    await Promise.all(slugs.map(async (slug) => {
        try {
            const res = await fetch(`${dataPath}${slug}.json`, { method: 'HEAD' });
            if (res.ok) {
                found.push(slug);
            }
        } catch (_) { /* ignore */ }
    }));

    // 5. Cache result
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            slugs: found,
            timestamp: Date.now()
        }));
    } catch (_) {}

    console.log(`[Discovery] Found ${found.length} bestiary creatures (out of ${slugs.length} tested)`);
    return found;
}