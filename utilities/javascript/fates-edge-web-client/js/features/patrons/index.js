// features/patrons/index.js
/**
 * Patrons feature - Display and manage Patrons (Cosmic, Terrestrial, and Trusts)
 *
 * Data paths:
 * - Cosmic patron data: /data/patrons/{id}.json
 * - Terrestrial patron data: /data/terrestrial/{id}.json (fallback: /data/factions/{id}.json)
 * - Religions: /data/religions/{id}.json
 *
 * All data is discovered without a manifest.json – we test known slugs.
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

// ============================================================
// CONSTANTS
// ============================================================

const COSMIC_DATA_PATH = './data/patrons/';
const TERRESTRIAL_DATA_PATH = './data/terrestrial/';
const TERRESTRIAL_FALLBACK_DATA_PATH = './data/factions/';
const RELIGION_DATA_PATH = './data/religions/';

// Known slugs for each category – extend as needed
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

// Known terrestrial/faction slugs (you can expand this)
const KNOWN_TERRESTRIAL_SLUGS = [
    'velvet-court', 'house-contarini', 'the-iron-covenant', 'silver-fang-tribe',
    'the-whispering-net', 'ashen-syndicate', 'crimson-rose'
];

// Known religion slugs
const KNOWN_RELIGION_SLUGS = [
    'everflame', 'the-celestial-spire', 'church-of-the-red-stone',
    'order-of-the-void', 'temple-of-the-wandering-star'
];

// ============================================================
// DEFAULT DATA
// ============================================================

const DEFAULT_COSMIC_PATRONS = [
    {
        id: 'the-traveler',
        name: 'The Traveler',
        icon: '🚶',
        domain: 'Ways & Journeys',
        subtitle: 'Guide of the Lost',
        description: 'The Traveler is the eternal guide of the road, guardian of those who walk the paths between what is and what might be.',
        lore: 'The Traveler has no fixed form, but appears as a wanderer at every crossroads.',
        rites: [],
        source: 'default'
    },
    {
        id: 'oath-of-flame-light',
        name: 'Oath of Flame & Light',
        icon: '🔥',
        domain: 'Dawn & Vows',
        subtitle: 'The Unquenchable Fire',
        description: 'The Oath of Flame & Light demands that those who swear within its radiance speak truly and pay the cost of keeping their word.',
        lore: 'Born from the first dawn fire, this patron is invoked by paladins and healers.',
        rites: [],
        source: 'default'
    }
];

const DEFAULT_TERRESTRIAL_PATRONS = [
    {
        id: 'velvet-court',
        name: 'The Velvet Court',
        icon: '🎭',
        type: 'Crime Syndicate',
        tier: 'II',
        description: 'A shadowy network of smugglers and information brokers operating in Silkstrand.',
        location: 'Silkstrand',
        leverage: 'Smuggling routes, information, forgery',
        debtTrigger: 'When Obligation fills, they demand a heist or assassination.',
        quirk: 'Every member wears a velvet glove on their left hand.',
        assetSlots: 4,
        maxAssetTier: 'Standard',
        obligationCapacity: 'Spirit+Presence+2',
        keyNPCs: ['Madam Serafine', 'Old Kes', 'Sister Agatha'],
        hooks: ['A rival faction is moving into the Dye District'],
        agendaTimer: { segments: 6, current: 2 },
        source: 'default'
    },
    {
        id: 'house-contarini',
        name: 'House Contarini',
        icon: '🏛️',
        type: 'Noble House',
        tier: 'II',
        description: 'A powerful Vilikari family with deep connections in the Archivolt and trade networks.',
        location: 'Vilikari Marches',
        leverage: 'Legal influence, grain contracts, safe passage',
        debtTrigger: 'When Obligation fills, they demand a political favor or a sealed document.',
        quirk: 'Their seal is a cracked marble column.',
        assetSlots: 4,
        maxAssetTier: 'Standard',
        obligationCapacity: 'Spirit+Presence+1',
        keyNPCs: ['Tema', 'Factor Voss'],
        hooks: ['A rival house is undercutting their prices'],
        agendaTimer: { segments: 8, current: 3 },
        source: 'default'
    }
];

const DEFAULT_TRUSTS = [
    {
        id: 'velvet-coin-trust',
        name: 'The Velvet Coin',
        icon: '🪙',
        tier: 'I',
        description: 'A thieves\' guild operating in the shadows of Silkstrand.',
        maxAssets: 2,
        maxAssetTier: 'Standard',
        assets: [],
        followers: [],
        obligation: 0,
        capacity: 4,
        source: 'default'
    }
];

const DEFAULT_RELIGIONS = [
    {
        id: 'everflame',
        name: 'The Everflame',
        icon: '🔥',
        description: 'The state religion of Ecktoria, born from the imperial forge.',
        lore: 'The Everflame began as a cult of the imperial forge.',
        doctrines: ['The flame witnesses all.', 'Confession must be public.'],
        practices: ['The Candle Test', 'The Unspoken Ninth Citation'],
        orders: [
            { id: 'oath_of_flame__light', name: 'Oath of Flame & Light', role: 'Warriors and crusaders' }
        ],
        source: 'default'
    }
];

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
        if (val.lore) return safeString(val.lore);
        try { return JSON.stringify(val); } catch (e) { return '[object]'; }
    }
    return String(val);
}

function getPatronDescription(patron) {
    if (!patron) return 'No description available.';
    if (typeof patron.description === 'string') return patron.description;
    if (patron.description && typeof patron.description === 'object') {
        if (patron.description.description) return patron.description.description;
        if (patron.description.lore) return patron.description.lore;
        if (patron.description.quote) return patron.description.quote;
        if (patron.description.text) return patron.description.text;
        let parts = [];
        if (patron.description.followers) parts.push(patron.description.followers);
        if (patron.description.apocalyptic_aspect) parts.push(patron.description.apocalyptic_aspect);
        if (parts.length > 0) return parts.join('\n\n');
    }
    if (patron.lore && typeof patron.lore === 'object') {
        if (patron.lore.description) return patron.lore.description;
        if (patron.lore.lore) return patron.lore.lore;
    }
    if (typeof patron.lore === 'string') return patron.lore;
    return safeString(patron.description) || 'No description available.';
}

function getPatronSummary(patron) {
    if (!patron) return '';
    if (patron.subtitle && typeof patron.subtitle === 'string') return patron.subtitle;
    if (patron.domain && typeof patron.domain === 'string') return patron.domain;
    if (patron.type && typeof patron.type === 'string') return patron.type;
    if (patron.agenda && typeof patron.agenda === 'string') return patron.agenda;
    if (patron.description) {
        const desc = getPatronDescription(patron);
        const firstSentence = desc.split('.')[0] || desc;
        return firstSentence.substring(0, 80) + (firstSentence.length > 80 ? '...' : '');
    }
    return '';
}

function normalizePatron(p) {
    if (!p) return p;
    const result = { ...p };
    if (!result.name && result.title) result.name = result.title;
    if (!result.domain && result.subtitle) result.domain = result.subtitle;
    if (result.description && typeof result.description === 'object') {
        if (result.description.description) {
            result._rawDescription = result.description;
            result.description = result.description.description;
        } else if (result.lore && result.lore.description) {
            result._rawDescription = result.description;
            result.description = result.lore.description;
        }
    }
    return result;
}

// Format text: escape HTML but preserve line breaks
function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

// ============================================================
// DISCOVERY (manifest‑free)
// ============================================================

const CACHE_KEY = 'fates-edge-patrons-cache';
const CACHE_TTL = 3600000; // 1 hour

async function discoverPatrons(type) {
    // type: 'cosmic', 'terrestrial', 'religion'
    let slugs = [];
    let dataPath = '';
    let fallbackPath = null;

    switch (type) {
        case 'cosmic':
            slugs = KNOWN_COSMIC_SLUGS;
            dataPath = COSMIC_DATA_PATH;
            break;
        case 'terrestrial':
            slugs = KNOWN_TERRESTRIAL_SLUGS;
            dataPath = TERRESTRIAL_DATA_PATH;
            fallbackPath = TERRESTRIAL_FALLBACK_DATA_PATH;
            break;
        case 'religion':
            slugs = KNOWN_RELIGION_SLUGS;
            dataPath = RELIGION_DATA_PATH;
            break;
        default:
            return [];
    }

    // Check cache
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            if (data[type] && Date.now() - data.timestamp < CACHE_TTL) {
                console.log(`[Patrons] Using cached ${type} list (${data[type].length} items)`);
                return data[type];
            }
        }
    } catch (_) {}

    console.log(`[Patrons] Discovering ${type} patrons...`);
    const found = [];

    // Test primary path
    await Promise.all(slugs.map(async (slug) => {
        try {
            const res = await fetch(`${dataPath}${slug}.json`, { method: 'HEAD' });
            if (res.ok) {
                found.push(slug);
                return;
            }
        } catch (_) {}
        // If primary fails and we have a fallback, try that
        if (fallbackPath) {
            try {
                const res = await fetch(`${fallbackPath}${slug}.json`, { method: 'HEAD' });
                if (res.ok) {
                    found.push(slug);
                }
            } catch (_) {}
        }
    }));

    // Update cache
    try {
        const cacheData = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        cacheData[type] = found;
        cacheData.timestamp = Date.now();
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (_) {}

    console.log(`[Patrons] Found ${found.length} ${type} patrons`);
    return found;
}

// ============================================================
// STATE
// ============================================================

let container = null;
let state = {
    cosmicPatrons: [],
    terrestrialPatrons: [],
    trusts: [],
    religions: [],
    selectedPatron: null,
    selectedTrust: null,
    selectedAsset: null,
    selectedReligion: null,
    viewMode: 'cosmic',
    isLoading: false,
    dataLoaded: false,
    usingFallback: false,
    obligation: {},
    expandedRites: new Set(),       // stores rite IDs for persistence
    expandedSections: new Set()
};

// ============================================================
// LOAD DATA
// ============================================================

export function loadPatronData() {
    const saved = getState();
    if (saved.patrons) {
        state.cosmicPatrons = (saved.patrons.cosmic || []).map(normalizePatron);
        state.terrestrialPatrons = (saved.patrons.terrestrial || []).map(normalizePatron);
        state.trusts = saved.patrons.trusts || [];
        state.religions = saved.patrons.religions || [];
        state.obligation = saved.patrons.obligation || {};
        if (state.cosmicPatrons.length > 0 || state.terrestrialPatrons.length > 0) {
            console.log(`📦 Loaded from state: ${state.cosmicPatrons.length} cosmic, ${state.terrestrialPatrons.length} terrestrial, ${state.religions.length} religions`);
            state.dataLoaded = true;
            state.usingFallback = false;
            return;
        }
    }
    loadRemotePatrons();
}

async function loadRemotePatrons() {
    if (state.isLoading) return;
    state.isLoading = true;

    try {
        // Discover slugs for each category
        const cosmicSlugs = await discoverPatrons('cosmic');
        const terrestrialSlugs = await discoverPatrons('terrestrial');
        const religionSlugs = await discoverPatrons('religion');

        // Fetch cosmic patrons
        let cosmicPatrons = [];
        for (const slug of cosmicSlugs) {
            try {
                const res = await fetch(`${COSMIC_DATA_PATH}${slug}.json`);
                if (res.ok) {
                    const data = await res.json();
                    if (!data.id) data.id = slug;
                    cosmicPatrons.push(normalizePatron(data));
                }
            } catch (e) { /* ignore */ }
        }
        if (cosmicPatrons.length === 0) {
            cosmicPatrons = DEFAULT_COSMIC_PATRONS.map(normalizePatron);
            state.usingFallback = true;
            showToast('⚠️ No cosmic patron files found. Using defaults.', 'warning');
        }
        state.cosmicPatrons = cosmicPatrons;

        // Fetch terrestrial patrons
        let terrestrialPatrons = [];
        for (const slug of terrestrialSlugs) {
            try {
                // Try primary path
                let res = await fetch(`${TERRESTRIAL_DATA_PATH}${slug}.json`);
                if (!res.ok) {
                    // Try fallback
                    res = await fetch(`${TERRESTRIAL_FALLBACK_DATA_PATH}${slug}.json`);
                }
                if (res.ok) {
                    const data = await res.json();
                    if (!data.id) data.id = slug;
                    terrestrialPatrons.push(normalizePatron(data));
                }
            } catch (e) { /* ignore */ }
        }
        if (terrestrialPatrons.length === 0) {
            terrestrialPatrons = DEFAULT_TERRESTRIAL_PATRONS.map(normalizePatron);
            state.usingFallback = true;
            showToast('⚠️ No terrestrial patron files found. Using defaults.', 'warning');
        }
        state.terrestrialPatrons = terrestrialPatrons;

        // Fetch religions
        let religions = [];
        for (const slug of religionSlugs) {
            try {
                const res = await fetch(`${RELIGION_DATA_PATH}${slug}.json`);
                if (res.ok) {
                    const data = await res.json();
                    if (!data.id) data.id = slug;
                    religions.push(data);
                }
            } catch (e) { /* ignore */ }
        }
        if (religions.length === 0) {
            religions = DEFAULT_RELIGIONS;
            state.usingFallback = true;
            showToast('⚠️ No religion files found. Using defaults.', 'warning');
        }
        state.religions = religions;

        // Trusts – they are usually created by users, so only use defaults if empty
        if (state.trusts.length === 0) {
            state.trusts = [...DEFAULT_TRUSTS];
        }

        state.dataLoaded = true;
        savePatronData();

    } catch (error) {
        console.warn('Failed to load remote patrons:', error);
        loadDefaultPatrons();
        showToast('⚠️ Error loading patrons. Using defaults.', 'error');
    } finally {
        state.isLoading = false;
    }
}

function loadDefaultPatrons() {
    state.cosmicPatrons = DEFAULT_COSMIC_PATRONS.map(normalizePatron);
    state.terrestrialPatrons = DEFAULT_TERRESTRIAL_PATRONS.map(normalizePatron);
    state.trusts = [...DEFAULT_TRUSTS];
    if (state.religions.length === 0) {
        state.religions = [...DEFAULT_RELIGIONS];
    }
    state.dataLoaded = true;
    state.usingFallback = true;
    console.log(`📦 Using defaults: ${state.cosmicPatrons.length} cosmic, ${state.terrestrialPatrons.length} terrestrial, ${state.religions.length} religions`);
}

function savePatronData() {
    const saved = getState();
    if (!saved.patrons) saved.patrons = {};
    saved.patrons.cosmic = state.cosmicPatrons;
    saved.patrons.terrestrial = state.terrestrialPatrons;
    saved.patrons.trusts = state.trusts;
    saved.patrons.religions = state.religions;
    saved.patrons.obligation = state.obligation;
    saveState();
}

// ============================================================
// OBLIGATION MANAGEMENT
// ============================================================

export function getPatronObligation(characterId, patronId) {
    if (!state.obligation[characterId]) return 0;
    return state.obligation[characterId][patronId] || 0;
}

export function setPatronObligation(characterId, patronId, value) {
    if (!state.obligation[characterId]) state.obligation[characterId] = {};
    state.obligation[characterId][patronId] = Math.max(0, value);
    savePatronData();
}

export function addPatronObligation(characterId, patronId, amount = 1) {
    const current = getPatronObligation(characterId, patronId);
    setPatronObligation(characterId, patronId, current + amount);
}

export function clearPatronObligation(characterId, patronId, amount = 1) {
    const current = getPatronObligation(characterId, patronId);
    setPatronObligation(characterId, patronId, current - amount);
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    loadPatronData();

    const usingFallback = state.usingFallback;

    container.innerHTML = `
        <div class="patrons-modern-layout">
            <header class="patrons-header" style="margin-bottom:0.5rem;">
                <h1 class="patrons-title">👁️ Patrons & Resources</h1>
                <p class="patrons-subtitle">Cosmic patrons, terrestrial powers, religions, and the assets they grant.</p>
                ${!state.dataLoaded ? '<p class="text-muted" style="font-size:0.85rem;">⏳ Loading data...</p>' : `<p class="text-muted" style="font-size:0.85rem;">📚 ${state.cosmicPatrons.length} cosmic, ${state.terrestrialPatrons.length} terrestrial, ${state.religions.length} religions</p>`}
                ${usingFallback ? `<div style="color:var(--warn);font-size:0.85rem;margin-top:0.3rem;">⚠️ Using fallback defaults for some data.</div>` : ''}
            </header>

            <div class="patrons-tabs" style="display:flex;gap:0.3rem;margin-bottom:0.5rem;flex-wrap:wrap;">
                <button class="patrons-tab active" data-view="cosmic">🌟 Cosmic</button>
                <button class="patrons-tab" data-view="terrestrial">🏛️ Terrestrial</button>
                <button class="patrons-tab" data-view="trusts">🤝 Trusts</button>
                <button class="patrons-tab" data-view="religions">⛪ Religions</button>
            </div>

            <div id="patrons-view-container" class="patrons-view-container">
                ${renderView('cosmic')}
            </div>

            <div id="patron-modal" class="patron-modal" style="display:none;"></div>
            <div id="asset-modal" class="patron-modal" style="display:none;"></div>
        </div>
    `;

    attachEvents();
}

function renderView(view) {
    state.viewMode = view;
    if (!state.dataLoaded) {
        return `<div class="patrons-empty"><div style="font-size:3rem;">⏳</div><div>Loading...</div></div>`;
    }

    switch(view) {
        case 'cosmic': return renderCosmicPatrons();
        case 'terrestrial': return renderTerrestrialPatrons();
        case 'trusts': return renderTrusts();
        case 'religions': return renderReligions();
        default: return renderCosmicPatrons();
    }
}

// ============================================================
// RENDER: COSMIC PATRONS
// ============================================================

function renderCosmicPatrons() {
    if (state.cosmicPatrons.length === 0) {
        return `
            <div class="patrons-empty">
                <div style="font-size:3rem;">🌟</div>
                <div>No cosmic patrons loaded.</div>
                <button class="btn btn-primary" onclick="window.loadDefaultPatrons()">📥 Load Defaults</button>
            </div>
        `;
    }

    const characterId = 'default-character';
    const obligationMap = state.obligation[characterId] || {};

    return `
        <div style="display:flex;flex-direction:column;gap:0.8rem;">
            <div class="patrons-scroll-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem;max-height:220px;overflow-y:auto;padding:0.2rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg2);">
                ${state.cosmicPatrons.map(p => {
                    const obl = obligationMap[p.id] || 0;
                    const name = safeString(p.name || p.title || 'Unnamed');
                    const summary = getPatronSummary(p);
                    return `
                        <div class="patron-tile" onclick="window.viewPatron('${p.id}')" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.5rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;text-align:center;border-left:3px solid ${p.color || 'var(--gold)'};transition:all 0.2s;">
                            <div style="font-size:1.5rem;">${safeString(p.icon || '🌟')}</div>
                            <div style="font-size:0.75rem;font-weight:600;color:var(--text);">${escHtml(name)}</div>
                            <div style="font-size:0.6rem;color:var(--text3);">${escHtml(summary)}</div>
                            <div style="font-size:0.55rem;color:var(--text2);margin-top:0.1rem;">Oblig: ${obl}</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div id="cosmic-description-area" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);min-height:80px;">
                <p style="color:var(--text2);font-style:italic;margin:0;">Select a patron above to see their description and details.</p>
            </div>

            <div class="patrons-actions" style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="window.addCosmicPatron()">➕ Add Cosmic</button>
                <button class="btn btn-secondary btn-sm" onclick="window.refreshPatrons()">🔄 Refresh</button>
                <button class="btn btn-secondary btn-sm" onclick="window.loadDefaultPatrons()">📥 Load Defaults</button>
            </div>
        </div>
    `;
}

// ============================================================
// RENDER: TERRESTRIAL PATRONS
// ============================================================

function renderTerrestrialPatrons() {
    if (state.terrestrialPatrons.length === 0) {
        return `
            <div class="patrons-empty">
                <div style="font-size:3rem;">🏛️</div>
                <div>No terrestrial patrons loaded.</div>
                <button class="btn btn-primary" onclick="window.addTerrestrialPatron()">➕ Add Terrestrial</button>
                <button class="btn btn-secondary" onclick="window.loadDefaultPatrons()">📥 Load Defaults</button>
            </div>
        `;
    }

    return `
        <div style="display:flex;flex-direction:column;gap:0.8rem;">
            <div class="patrons-scroll-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem;max-height:220px;overflow-y:auto;padding:0.2rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg2);">
                ${state.terrestrialPatrons.map(p => {
                    const name = safeString(p.name || p.title || 'Unnamed');
                    const summary = getPatronSummary(p);
                    return `
                        <div class="patron-tile" onclick="window.viewTerrestrial('${p.id}')" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.5rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;text-align:center;border-left:3px solid ${p.color || '#2980b9'};transition:all 0.2s;">
                            <div style="font-size:1.5rem;">${safeString(p.icon || '🏛️')}</div>
                            <div style="font-size:0.75rem;font-weight:600;color:var(--text);">${escHtml(name)}</div>
                            <div style="font-size:0.6rem;color:var(--text3);">${escHtml(summary)}</div>
                            <div style="font-size:0.55rem;color:var(--text2);">Tier ${safeString(p.tier || 'I')}</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div id="terrestrial-description-area" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);min-height:80px;">
                <p style="color:var(--text2);font-style:italic;margin:0;">Select a terrestrial patron to see details.</p>
            </div>

            <div class="patrons-actions" style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="window.addTerrestrialPatron()">➕ Add Terrestrial</button>
                <button class="btn btn-secondary btn-sm" onclick="window.refreshPatrons()">🔄 Refresh</button>
            </div>
        </div>
    `;
}

// ============================================================
// RENDER: RELIGIONS, TRUSTS
// ============================================================

function renderReligions() {
    if (state.religions.length === 0) {
        return `
            <div class="patrons-empty">
                <div style="font-size:3rem;">⛪</div>
                <div>No religions loaded.</div>
                <button class="btn btn-primary" onclick="window.addReligion()">➕ Add Religion</button>
            </div>
        `;
    }

    return `
        <div class="religions-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.5rem;">
            ${state.religions.map(r => {
                const name = safeString(r.name || r.title || 'Unnamed');
                const orders = r.orders ? r.orders.length : 0;
                return `
                    <div class="religion-card" onclick="window.viewReligion('${r.id}')" style="background:var(--bg3);border-radius:var(--radius);padding:0.5rem;cursor:pointer;border-left:3px solid var(--gold);">
                        <div style="font-size:1.5rem;">${safeString(r.icon || '⛪')}</div>
                        <div style="font-weight:600;">${escHtml(name)}</div>
                        <div style="font-size:0.7rem;color:var(--text3);">${orders} Orders</div>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="patrons-actions" style="margin-top:0.5rem;">
            <button class="btn btn-primary" onclick="window.addReligion()">➕ Add Religion</button>
            <button class="btn btn-secondary" onclick="window.refreshPatrons()">🔄 Refresh</button>
        </div>
    `;
}

function renderTrusts() {
    if (state.trusts.length === 0) {
        return `
            <div class="patrons-empty">
                <div style="font-size:3rem;">🤝</div>
                <div>No trusts created yet.</div>
                <button class="btn btn-primary" onclick="window.addTrust()">➕ Create Trust</button>
            </div>
        `;
    }

    return `
        <div class="trusts-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.5rem;">
            ${state.trusts.map(t => {
                const name = safeString(t.name || t.title || 'Unnamed');
                const tier = safeString(t.tier || 'I');
                return `
                    <div class="trust-card" onclick="window.viewTrust('${t.id}')" style="background:var(--bg3);border-radius:var(--radius);padding:0.5rem;cursor:pointer;border-left:3px solid var(--gold);">
                        <div style="font-size:1.5rem;">${safeString(t.icon || '🤝')}</div>
                        <div style="font-weight:600;">${escHtml(name)}</div>
                        <div style="font-size:0.7rem;color:var(--text3);">Tier ${escHtml(tier)}</div>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="patrons-actions" style="margin-top:0.5rem;">
            <button class="btn btn-primary" onclick="window.addTrust()">➕ Create Trust</button>
            <button class="btn btn-secondary" onclick="window.refreshPatrons()">🔄 Refresh</button>
        </div>
    `;
}

// ============================================================
// PATRON DETAIL (Main view) – no toggle, full description
// ============================================================

function renderPatronDetail(patronId) {
    const patron = state.cosmicPatrons.find(p => p.id === patronId);
    if (!patron) {
        showToast('Patron not found', 'error');
        return;
    }

    const descArea = document.getElementById('cosmic-description-area');
    if (!descArea) return;

    const desc = getPatronDescription(patron);
    const name = safeString(patron.name || patron.title || 'Unnamed');
    const summary = getPatronSummary(patron);

    descArea.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <span style="font-size:1.5rem;">${safeString(patron.icon || '🌟')}</span>
            <span style="font-weight:600;font-size:1.1rem;">${escHtml(name)}</span>
            <span style="color:var(--text3);font-size:0.85rem;">${escHtml(summary)}</span>
            <span style="color:var(--text3);font-size:0.75rem;margin-left:auto;">Obligation: ${getPatronObligation('default-character', patron.id)}</span>
            <button class="btn btn-xs btn-primary" onclick="window.addPatronObligation('default-character', '${patron.id}', 1)">➕</button>
            <button class="btn btn-xs btn-secondary" onclick="window.clearPatronObligation('default-character', '${patron.id}', 1)">➖</button>
            <button class="btn btn-xs btn-ghost" onclick="window.openPatronDetailModal('${patron.id}')">📖 Full Details</button>
        </div>
        <div style="margin:0.3rem 0 0 0;color:var(--text2);font-size:0.9rem;line-height:1.5;overflow-y:auto;">
            ${formatText(desc)}
        </div>
    `;
}

// ============================================================
// HELPER: Check if a rite has any detail fields worth expanding
// ============================================================

function riteHasDetails(r) {
    if (!r) return false;
    // The primary descriptive text may be in description OR effect
    const hasMainText = safeString(r.description || r.effect || '').length > 0;
    const hasMeta = r.tier || r.xp || r.action || r.range || r.resist ||
        r.materials || r.cost || r.duration || r.invoke || r.requires ||
        r.push_it || r.timer ||
        (r.tags && r.tags.length > 0);
    return hasMainText || hasMeta;
}

// ============================================================
// MODAL: FULL DETAIL (Cosmic Patron)
// ============================================================

window.openPatronDetailModal = function(patronId) {
    const patron = state.cosmicPatrons.find(p => p.id === patronId);
    if (!patron) {
        showToast('Patron not found', 'error');
        return;
    }

    const modal = document.getElementById('patron-modal');
    modal.style.display = 'block';

    const name = safeString(patron.name || patron.title || 'Unnamed');
    const summary = getPatronSummary(patron);
    const desc = getPatronDescription(patron);
    const icon = safeString(patron.icon || '🌟');
    const domain = safeString(patron.domain || patron.subtitle || 'Unknown Domain');
    const religion = safeString(patron.religion || '');
    const currentObligation = getPatronObligation('default-character', patron.id);

    // --- FIX: Build rites HTML with working expand/collapse ---
    // The key bug was: hasDesc checked r.description, but rite data uses r.effect.
    // Now we use riteHasDetails() which checks both + all meta fields.
    let ritesHtml = '';
    if (patron.rites && patron.rites.length > 0) {
        const hasDetailedRites = typeof patron.rites[0] === 'object';
        if (hasDetailedRites) {
            ritesHtml = `
                <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;margin-bottom:0.8rem;border-left:4px solid var(--gold);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 0.5rem 0;flex-wrap:wrap;gap:0.3rem;">
                        <h3 style="margin:0;color:var(--gold);">🔮 Rites (${patron.rites.length})</h3>
                        <div style="display:flex;gap:0.3rem;">
                            <button class="btn btn-xs btn-secondary" onclick="window.expandAllRites()">📖 Expand All</button>
                            <button class="btn btn-xs btn-secondary" onclick="window.collapseAllRites()">📕 Collapse All</button>
                        </div>
                    </div>
                    <div class="rites-list" style="display:flex;flex-direction:column;gap:0.5rem;">
                        ${patron.rites.map((r, idx) => {
                            const riteId = `${patron.id}-rite-${idx}`;
                            const isExpanded = state.expandedRites.has(riteId);
                            const hasDetails = riteHasDetails(r);
                            const riteName = safeString(r.name);
                            const riteTier = safeString(r.tier || '');
                            // Use effect as the primary descriptive text (fallback to description)
                            const riteMainText = safeString(r.description || r.effect || '');

                            let detailsHtml = '';
                            if (hasDetails) {
                                detailsHtml = `
                                    <div class="rite-details" style="margin-top:0.4rem;padding:0.5rem 0.8rem;background:var(--bg3);border-radius:var(--radius);${isExpanded ? '' : 'display:none;'}">
                                        ${riteMainText ? `<div class="rite-description" style="margin-bottom:0.4rem;line-height:1.5;">${formatText(riteMainText)}</div>` : ''}
                                        ${r.push_it ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);margin-bottom:0.3rem;"><strong>⚡ Push It:</strong> ${formatText(safeString(r.push_it))}</div>` : ''}
                                        ${r.tier ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>Tier:</strong> ${escHtml(safeString(r.tier))}</div>` : ''}
                                        ${r.xp ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>XP:</strong> ${escHtml(safeString(r.xp))}</div>` : ''}
                                        ${r.action ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>Action:</strong> ${escHtml(safeString(r.action))}</div>` : ''}
                                        ${r.range ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>Range:</strong> ${escHtml(safeString(r.range))}</div>` : ''}
                                        ${r.resist ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>Resist:</strong> ${escHtml(safeString(r.resist))}</div>` : ''}
                                        ${r.materials ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>Materials:</strong> ${formatText(safeString(r.materials))}</div>` : ''}
                                        ${r.cost ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>Cost:</strong> ${formatText(safeString(r.cost))}</div>` : ''}
                                        ${r.duration ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>Duration:</strong> ${escHtml(safeString(r.duration))}</div>` : ''}
                                        ${r.invoke ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>Invoke:</strong> ${escHtml(safeString(r.invoke))}</div>` : ''}
                                        ${r.requires ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>Requires:</strong> ${formatText(safeString(r.requires))}</div>` : ''}
                                        ${r.timer ? `<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);"><strong>Timer:</strong> ${escHtml(safeString(r.timer))}</div>` : ''}
                                        ${r.tags && r.tags.length > 0 ? `<div class="rite-tags" style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.3rem;">${r.tags.map(t => `<span class="badge badge-tag" style="background:var(--bg2);padding:0.1rem 0.4rem;border-radius:8px;font-size:0.7rem;color:var(--text3);">${escHtml(safeString(t))}</span>`).join('')}</div>` : ''}
                                    </div>
                                `;
                            }
                            return `
                                <div class="rite-item ${hasDetails ? 'rite-expandable' : ''}" data-rite-id="${escHtml(riteId)}" style="background:var(--bg3);border-radius:var(--radius);padding:0.4rem 0.8rem;border-left:3px solid ${riteTier ? 'var(--gold)' : 'var(--border)'};">
                                    <div class="rite-header" ${hasDetails ? `onclick="window.toggleRite(this)"` : ''} style="display:flex;justify-content:space-between;align-items:center;cursor:${hasDetails ? 'pointer' : 'default'};">
                                        <span class="rite-name" style="font-weight:600;">${escHtml(riteName)}</span>
                                        <span style="display:flex;align-items:center;gap:0.5rem;">
                                            ${riteTier ? `<span class="rite-tier" style="font-size:0.75rem;color:var(--text3);">${escHtml(riteTier)}</span>` : ''}
                                            ${r.xp ? `<span style="font-size:0.7rem;color:var(--text3);">${escHtml(safeString(r.xp))} XP</span>` : ''}
                                            ${r.action ? `<span style="font-size:0.7rem;color:var(--text3);">${escHtml(safeString(r.action))}</span>` : ''}
                                            ${hasDetails ? `<span class="rite-expand-icon" style="font-size:0.8rem;color:var(--text3);">${isExpanded ? '▾' : '▸'}</span>` : ''}
                                        </span>
                                    </div>
                                    ${detailsHtml}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            // Simple list of rites
            ritesHtml = `
                <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;margin-bottom:0.8rem;border-left:4px solid var(--gold);">
                    <h3 style="margin:0 0 0.5rem 0;color:var(--gold);">🔮 Rites (${patron.rites.length})</h3>
                    <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                        ${patron.rites.map(r => `<li>${escHtml(safeString(r))}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    }

    // Build the modal content with improved styling
    modal.innerHTML = `
        <div class="modal-content patron-detail" style="width: 90%; max-width: 1200px; max-height: 90vh; overflow-y: auto; background:var(--bg1); padding:1.5rem; border-radius:var(--radius);">
            <button class="modal-close" onclick="window.closePatronModal()" style="float:right;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text3);">✕</button>
            <div class="patron-detail-header" style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;border-bottom:1px solid var(--border);padding-bottom:0.5rem;">
                <div class="patron-detail-icon" style="font-size:3rem;">${escHtml(icon)}</div>
                <div style="flex:1;">
                    <h2 style="margin:0;color:var(--gold);">${escHtml(name)}</h2>
                    <div class="patron-detail-domain" style="color:var(--text2);font-size:1.1rem;">${escHtml(domain)}</div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.3rem;">
                        ${religion ? `<span class="badge badge-religion" style="background:var(--gold);color:var(--bg);padding:0.1rem 0.5rem;border-radius:12px;font-size:0.8rem;">⛪ ${escHtml(religion)}</span>` : ''}
                        ${patron.source === 'default' ? '<span class="badge badge-remote" style="background:var(--bg3);color:var(--text3);padding:0.1rem 0.5rem;border-radius:12px;font-size:0.7rem;">📦 Default Data</span>' : ''}
                    </div>
                    <div style="margin-top:0.5rem;font-size:0.9rem;display:flex;gap:0.5rem;align-items:center;">
                        <span>Obligation: <strong>${currentObligation}</strong></span>
                        <button class="btn btn-xs btn-primary" onclick="window.addPatronObligation('default-character', '${patron.id}', 1)">➕</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.clearPatronObligation('default-character', '${patron.id}', 1)">➖</button>
                    </div>
                </div>
            </div>

            <div class="patron-detail-body" style="display:flex;flex-direction:column;gap:0.8rem;">
                ${desc ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">📖 Description</h3>
                        <p style="margin:0;white-space:pre-wrap;">${formatText(desc)}</p>
                    </div>
                ` : ''}

                ${patron.lore && typeof patron.lore === 'object' ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">📚 Lore</h3>
                        <p style="margin:0;white-space:pre-wrap;">${formatText(safeString(patron.lore.description || patron.lore))}</p>
                    </div>
                ` : ''}

                ${patron.domain_focus ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🎯 Domain Focus</h3>
                        <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                            ${patron.domain_focus.map(d => `<li>${escHtml(safeString(d))}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${patron.runekeeper_options ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">📜 Runekeeper Options</h3>
                        ${patron.runekeeper_options.thiasos ? `
                            <div style="margin-bottom:0.5rem;">
                                <strong>Thiasos (Familiar):</strong>
                                <p style="margin:0.2rem 0;">${formatText(safeString(patron.runekeeper_options.thiasos.description))}</p>
                                ${patron.runekeeper_options.thiasos.care ? `<p style="margin:0.2rem 0;font-size:0.85rem;color:var(--text3);"><strong>Care:</strong> ${formatText(safeString(patron.runekeeper_options.thiasos.care))}</p>` : ''}
                            </div>
                        ` : ''}
                        ${patron.runekeeper_options.codex ? `
                            <div>
                                <strong>Codex:</strong>
                                <p style="margin:0.2rem 0;">${formatText(safeString(patron.runekeeper_options.codex.description))}</p>
                                ${patron.runekeeper_options.codex.upkeep ? `<p style="margin:0.2rem 0;font-size:0.85rem;color:var(--text3);"><strong>Upkeep:</strong> ${formatText(safeString(patron.runekeeper_options.codex.upkeep))}</p>` : ''}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                ${patron.patrons_gift ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🎁 Patron's Gift</h3>
                        <p style="margin:0;"><strong>${escHtml(safeString(patron.patrons_gift.name || 'Gift'))}</strong></p>
                        <p style="margin:0.3rem 0 0 0;">${formatText(safeString(patron.patrons_gift.description))}</p>
                        ${patron.patrons_gift.effect ? `<p style="margin:0.3rem 0 0 0;"><strong>Effect:</strong> ${formatText(safeString(patron.patrons_gift.effect))}</p>` : ''}
                        ${patron.patrons_gift.cost ? `<p style="margin:0.3rem 0 0 0;color:var(--text3);">Cost: ${formatText(safeString(patron.patrons_gift.cost))}</p>` : ''}
                    </div>
                ` : ''}

                ${ritesHtml}

                ${patron.corruption ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--red);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--red);">⚠️ Corruption</h3>
                        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                            <thead><tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:0.2rem 0.5rem;">Tier</th><th style="text-align:left;padding:0.2rem 0.5rem;">Benefit</th><th style="text-align:left;padding:0.2rem 0.5rem;">Cost / Quirk</th></tr></thead>
                            <tbody>${patron.corruption.map(c => `<tr style="border-bottom:1px solid var(--border);"><td style="padding:0.2rem 0.5rem;">${escHtml(safeString(c.tier))}</td><td style="padding:0.2rem 0.5rem;">${escHtml(safeString(c.benefit))}</td><td style="padding:0.2rem 0.5rem;">${escHtml(safeString(c.cost))}</td></tr>`).join('')}</tbody>
                        </table>
                    </div>
                ` : ''}

                ${patron.monastic_tradition ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">⛩️ Monastic Tradition: ${escHtml(safeString(patron.monastic_tradition.name))}</h3>
                        ${patron.monastic_tradition.quote ? `<blockquote style="margin:0.3rem 0;padding:0.5rem 1rem;background:var(--bg3);border-radius:var(--radius);border-left:4px solid var(--gold);"><em>${formatText(safeString(patron.monastic_tradition.quote))}</em></blockquote>` : ''}
                        ${patron.monastic_tradition.prerequisites ? `<p style="margin:0.3rem 0;"><strong>Prerequisites:</strong> ${escHtml(safeString(patron.monastic_tradition.prerequisites))}</p>` : ''}
                        ${patron.monastic_tradition.debt_resistant_frame ? `<p style="margin:0.3rem 0;"><strong>Debt-Resistant Frame:</strong> ${formatText(safeString(patron.monastic_tradition.debt_resistant_frame))}</p>` : ''}
                        ${patron.monastic_tradition.techniques ? `
                            <div style="margin-top:0.5rem;"><strong>Techniques:</strong></div>
                            <div style="display:flex;flex-direction:column;gap:0.3rem;margin-top:0.3rem;">
                                ${patron.monastic_tradition.techniques.map((tech, idx) => {
                                    const techId = `${patron.id}-tech-${idx}`;
                                    const techExpanded = state.expandedRites.has(techId);
                                    const techHasDetails = tech.effect || tech.cost || tech.requirement;
                                    return `
                                        <div class="rite-item ${techHasDetails ? 'rite-expandable' : ''}" data-rite-id="${escHtml(techId)}" style="background:var(--bg3);border-radius:var(--radius);padding:0.4rem 0.8rem;border-left:3px solid var(--border);">
                                            <div class="rite-header" ${techHasDetails ? `onclick="window.toggleRite(this)"` : ''} style="display:flex;justify-content:space-between;align-items:center;cursor:${techHasDetails ? 'pointer' : 'default'};">
                                                <span style="font-weight:600;">${escHtml(safeString(tech.name))}</span>
                                                <span style="display:flex;align-items:center;gap:0.5rem;">
                                                    ${tech.tier ? `<span style="font-size:0.75rem;color:var(--text3);">${escHtml(safeString(tech.tier))}</span>` : ''}
                                                    ${tech.xp ? `<span style="font-size:0.7rem;color:var(--text3);">${escHtml(safeString(tech.xp))} XP</span>` : ''}
                                                    ${techHasDetails ? `<span class="rite-expand-icon" style="font-size:0.8rem;color:var(--text3);">${techExpanded ? '▾' : '▸'}</span>` : ''}
                                                </span>
                                            </div>
                                            ${techHasDetails ? `
                                                <div class="rite-details" style="margin-top:0.4rem;padding:0.5rem 0.8rem;background:var(--bg2);border-radius:var(--radius);${techExpanded ? '' : 'display:none;'}">
                                                    ${tech.effect ? `<div style="margin-bottom:0.3rem;line-height:1.5;">${formatText(safeString(tech.effect))}</div>` : ''}
                                                    ${tech.cost ? `<div style="font-size:0.85rem;color:var(--text2);"><strong>Cost:</strong> ${escHtml(safeString(tech.cost))}</div>` : ''}
                                                    ${tech.requirement ? `<div style="font-size:0.85rem;color:var(--text2);"><strong>Requirement:</strong> ${escHtml(safeString(tech.requirement))}</div>` : ''}
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : ''}
                        ${patron.monastic_tradition.master_technique ? `
                            <div style="margin-top:0.5rem;">
                                <strong>Master Technique: ${escHtml(safeString(patron.monastic_tradition.master_technique.name))}</strong>
                                <p style="margin:0.2rem 0;">${formatText(safeString(patron.monastic_tradition.master_technique.description))}</p>
                                ${patron.monastic_tradition.master_technique.xp ? `<p style="font-size:0.85rem;color:var(--text3);">XP: ${escHtml(safeString(patron.monastic_tradition.master_technique.xp))}</p>` : ''}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                ${patron.cantors_and_cults ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🎶 Cantors & Cults</h3>
                        ${patron.cantors_and_cults.cantors ? `<p style="margin:0.3rem 0;"><strong>Cantors:</strong> ${formatText(safeString(patron.cantors_and_cults.cantors.description || patron.cantors_and_cults.cantors))}</p>` : ''}
                        ${patron.cantors_and_cults.cult ? `<p style="margin:0.3rem 0;"><strong>Cult:</strong> ${formatText(safeString(patron.cantors_and_cults.cult.description || patron.cantors_and_cults.cult))}</p>` : ''}
                    </div>
                ` : ''}

                ${patron.witchcraft ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🧹 Witchcraft</h3>
                        ${patron.witchcraft.description ? `<p style="margin:0.3rem 0;">${formatText(safeString(patron.witchcraft.description))}</p>` : ''}
                        ${patron.witchcraft.tools ? `<p style="margin:0.3rem 0;"><strong>Tool:</strong> ${formatText(safeString(patron.witchcraft.tools.name || ''))} — ${formatText(safeString(patron.witchcraft.tools.description || ''))}</p>` : ''}
                        ${patron.witchcraft.hedge_gifts ? `
                            <div><strong>Hedge Gifts:</strong></div>
                            <ul style="margin:0.3rem 0 0 0;padding-left:1.2rem;list-style-type:disc;">
                                ${patron.witchcraft.hedge_gifts.map(g => `<li><strong>${escHtml(safeString(g.name))}</strong> (${escHtml(safeString(g.xp))} XP): ${formatText(safeString(g.description))}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </div>
                ` : ''}

                ${patron.playstyle_notes ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🎮 Playstyle Notes</h3>
                        ${patron.playstyle_notes.description ? `<p style="margin:0.3rem 0;">${formatText(safeString(patron.playstyle_notes.description))}</p>` : ''}
                        ${patron.playstyle_notes.emphasizes ? `
                            <div><strong>Emphasizes:</strong></div>
                            <ul style="margin:0.3rem 0 0 0;padding-left:1.2rem;list-style-type:disc;">
                                ${patron.playstyle_notes.emphasizes.map(e => `<li>${escHtml(safeString(e))}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </div>
                ` : ''}

                ${patron.sample_adventure ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🎲 Sample Adventure</h3>
                        <p style="margin:0.3rem 0;"><strong>${escHtml(safeString(patron.sample_adventure.title))}</strong></p>
                        <p style="margin:0.2rem 0;">${formatText(safeString(patron.sample_adventure.description))}</p>
                        ${patron.sample_adventure.quote ? `<blockquote style="margin:0.3rem 0;padding:0.5rem 1rem;background:var(--bg3);border-radius:var(--radius);border-left:4px solid var(--gold);"><em>${formatText(safeString(patron.sample_adventure.quote))}</em></blockquote>` : ''}
                    </div>
                ` : ''}

                ${patron.quotes ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">💬 Quotes</h3>
                        ${patron.quotes.map(q => `
                            <blockquote style="margin:0.5rem 0;padding:0.5rem 1rem;background:var(--bg3);border-radius:var(--radius);border-left:4px solid var(--gold);">
                                <em>${formatText(safeString(q.text))}</em>
                                <footer style="margin-top:0.2rem;color:var(--text3);font-size:0.85rem;">— ${escHtml(safeString(q.speaker))}</footer>
                            </blockquote>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="patron-detail-actions" style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:0.5rem;">
                <button class="btn btn-sm" onclick="window.editPatron('${patron.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="window.deletePatron('${patron.id}')">🗑️ Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()">Close</button>
            </div>
        </div>
    `;

    // FIX: use onclick assignment instead of addEventListener to avoid listener accumulation
    modal.onclick = (e) => {
        if (e.target === modal) window.closePatronModal();
    };
};

// ============================================================
// RITE TOGGLE – using "this" for reliable DOM traversal
// ============================================================

window.toggleRite = function(headerElement) {
    // Find the parent rite-item
    const item = headerElement.closest('.rite-item');
    if (!item) {
        console.warn('[Patrons] Could not find .rite-item for toggle');
        return;
    }
    // Find the details div inside this item
    const details = item.querySelector('.rite-details');
    if (!details) {
        console.warn('[Patrons] No .rite-details found in .rite-item');
        return;
    }
    // Toggle display
    const isExpanded = details.style.display !== 'none';
    details.style.display = isExpanded ? 'none' : 'block';
    // Update expand icon
    const icon = item.querySelector('.rite-expand-icon');
    if (icon) {
        icon.textContent = isExpanded ? '▸' : '▾';
    }
    // Update persisted state via data-rite-id
    const riteId = item.dataset.riteId;
    if (riteId) {
        if (isExpanded) state.expandedRites.delete(riteId);
        else state.expandedRites.add(riteId);
    }
};

// ============================================================
// EXPAND ALL / COLLAPSE ALL RITES
// ============================================================

window.expandAllRites = function() {
    const modal = document.getElementById('patron-modal');
    if (!modal) return;
    modal.querySelectorAll('.rite-item.rite-expandable').forEach(item => {
        const details = item.querySelector('.rite-details');
        if (details) {
            details.style.display = 'block';
            const icon = item.querySelector('.rite-expand-icon');
            if (icon) icon.textContent = '▾';
            const riteId = item.dataset.riteId;
            if (riteId) state.expandedRites.add(riteId);
        }
    });
};

window.collapseAllRites = function() {
    const modal = document.getElementById('patron-modal');
    if (!modal) return;
    modal.querySelectorAll('.rite-item.rite-expandable').forEach(item => {
        const details = item.querySelector('.rite-details');
        if (details) {
            details.style.display = 'none';
            const icon = item.querySelector('.rite-expand-icon');
            if (icon) icon.textContent = '▸';
            const riteId = item.dataset.riteId;
            if (riteId) state.expandedRites.delete(riteId);
        }
    });
};

// ============================================================
// TERRESTRIAL PATRON DETAIL (Main view & Modal)
// ============================================================

window.viewTerrestrial = function(id) {
    const patron = state.terrestrialPatrons.find(p => p.id === id);
    if (!patron) {
        showToast('Terrestrial patron not found', 'error');
        return;
    }

    const descArea = document.getElementById('terrestrial-description-area');
    if (descArea) {
        const desc = getPatronDescription(patron);
        const name = safeString(patron.name || patron.title || 'Unnamed');
        const summary = getPatronSummary(patron);
        descArea.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                <span style="font-size:1.5rem;">${safeString(patron.icon || '🏛️')}</span>
                <span style="font-weight:600;font-size:1.1rem;">${escHtml(name)}</span>
                <span style="color:var(--text3);font-size:0.85rem;">${escHtml(summary)}</span>
                <button class="btn btn-xs btn-ghost" onclick="window.openTerrestrialDetailModal('${patron.id}')" style="margin-left:auto;">📖 Full Details</button>
            </div>
            <div style="margin:0.3rem 0 0 0;color:var(--text2);font-size:0.9rem;line-height:1.5;overflow-y:auto;">
                ${formatText(desc)}
            </div>
        `;
    }
};

window.openTerrestrialDetailModal = function(id) {
    const patron = state.terrestrialPatrons.find(p => p.id === id);
    if (!patron) {
        showToast('Terrestrial patron not found', 'error');
        return;
    }

    const modal = document.getElementById('patron-modal');
    modal.style.display = 'block';

    const name = safeString(patron.name || patron.title || 'Unnamed');
    const desc = getPatronDescription(patron);
    const icon = safeString(patron.icon || '🏛️');
    const type = safeString(patron.type || patron.agenda || 'Terrestrial Patron');
    const tier = safeString(patron.tier || 'I');
    const location = safeString(patron.location || '');
    const leverage = safeString(patron.leverage || '');
    const debtTrigger = safeString(patron.debtTrigger || '');
    const quirk = safeString(patron.quirk || '');
    const assetSlots = safeString(patron.assetSlots || 0);
    const maxAssetTier = safeString(patron.maxAssetTier || 'Minor');
    const obligationCapacity = safeString(patron.obligationCapacity || 'Spirit+Presence');

    modal.innerHTML = `
        <div class="modal-content patron-detail" style="width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; background:var(--bg1); padding:1.5rem; border-radius:var(--radius);">
            <button class="modal-close" onclick="window.closePatronModal()" style="float:right;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text3);">✕</button>
            <div class="patron-detail-header" style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;border-bottom:1px solid var(--border);padding-bottom:0.5rem;">
                <div style="font-size:3rem;">${escHtml(icon)}</div>
                <div>
                    <h2 style="margin:0;color:var(--gold);">${escHtml(name)}</h2>
                    <div style="color:var(--text2);">${escHtml(type)}</div>
                    <div style="color:var(--text3);">Tier ${escHtml(tier)}</div>
                </div>
            </div>

            <div class="patron-detail-body" style="display:flex;flex-direction:column;gap:0.8rem;">
                ${desc ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">📖 Description</h3>
                        <p style="margin:0;white-space:pre-wrap;">${formatText(desc)}</p>
                    </div>
                ` : ''}

                ${location ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">📍 Location</h3>
                        <p style="margin:0;">${escHtml(location)}</p>
                    </div>
                ` : ''}

                ${leverage ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">💰 Leverage</h3>
                        <p style="margin:0;">${escHtml(leverage)}</p>
                    </div>
                ` : ''}

                ${debtTrigger ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">⚡ Debt Trigger</h3>
                        <p style="margin:0;">${escHtml(debtTrigger)}</p>
                    </div>
                ` : ''}

                ${quirk ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">🌀 Quirk</h3>
                        <p style="margin:0;">${escHtml(quirk)}</p>
                    </div>
                ` : ''}

                <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                    <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">📊 Stats</h3>
                    <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                        <li>Asset Slots: ${escHtml(assetSlots)}</li>
                        <li>Max Asset Tier: ${escHtml(maxAssetTier)}</li>
                        <li>Obligation Capacity: ${escHtml(obligationCapacity)}</li>
                    </ul>
                </div>

                ${patron.agendaTimer ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">⏱️ Agenda Timer</h3>
                        <div style="margin:0.3rem 0;">${safeString(patron.agendaTimer.current || 0)}/${safeString(patron.agendaTimer.segments || 6)}</div>
                        <div class="timer-bar" style="width:100%;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;">
                            <div class="timer-bar-fill" style="height:100%;width:${((patron.agendaTimer?.current||0)/(patron.agendaTimer?.segments||6))*100}%;background:var(--gold);"></div>
                        </div>
                    </div>
                ` : ''}

                ${patron.keyNPCs ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">👤 Key NPCs</h3>
                        <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                            ${patron.keyNPCs.map(n => `<li>${escHtml(safeString(n))}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${patron.hooks ? `
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">🔗 Hooks</h3>
                        <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                            ${patron.hooks.map(h => `<li>${escHtml(safeString(h))}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>

            <div class="patron-detail-actions" style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:0.5rem;">
                <button class="btn btn-sm" onclick="window.editTerrestrial('${patron.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteTerrestrial('${patron.id}')">🗑️ Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()">Close</button>
            </div>
        </div>
    `;

    // FIX: use onclick assignment instead of addEventListener to avoid listener accumulation
    modal.onclick = (e) => {
        if (e.target === modal) window.closePatronModal();
    };
};

// ============================================================
// MODAL CONTROLS & VIEW HANDLERS
// ============================================================

window.closePatronModal = function() {
    document.getElementById('patron-modal').style.display = 'none';
};

window.closeAssetModal = function() {
    document.getElementById('asset-modal').style.display = 'none';
};

// The main view handler – updates description and, if modal is open, refreshes modal
window.viewPatron = function(id) {
    renderPatronDetail(id);
    // If the modal is open, update its content with the new patron
    const modal = document.getElementById('patron-modal');
    if (modal && modal.style.display !== 'none') {
        window.openPatronDetailModal(id);
    }
};

window.viewReligion = function(id) {
    // For now, just open a simple modal or use the terrestrial modal
    const religion = state.religions.find(r => r.id === id);
    if (!religion) {
        showToast('Religion not found', 'error');
        return;
    }
    const modal = document.getElementById('patron-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="width:90%;max-width:600px;max-height:90vh;overflow-y:auto;background:var(--bg1);padding:1.5rem;border-radius:var(--radius);">
            <button class="modal-close" onclick="window.closePatronModal()" style="float:right;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text3);">✕</button>
            <h2 style="color:var(--gold);">${escHtml(religion.name)}</h2>
            <div style="font-size:1.5rem;">${safeString(religion.icon || '⛪')}</div>
            ${religion.description ? `<p>${formatText(religion.description)}</p>` : ''}
            ${religion.lore ? `<p><strong>Lore:</strong> ${formatText(religion.lore)}</p>` : ''}
            ${religion.doctrines ? `<div><strong>Doctrines:</strong><ul>${religion.doctrines.map(d => `<li>${escHtml(d)}</li>`).join('')}</ul></div>` : ''}
            ${religion.practices ? `<div><strong>Practices:</strong><ul>${religion.practices.map(p => `<li>${escHtml(p)}</li>`).join('')}</ul></div>` : ''}
            ${religion.orders ? `<div><strong>Orders:</strong><ul>${religion.orders.map(o => `<li>${escHtml(o.name)} (${escHtml(o.role)})</li>`).join('')}</ul></div>` : ''}
            <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()" style="margin-top:0.5rem;">Close</button>
        </div>
    `;
    modal.onclick = (e) => {
        if (e.target === modal) window.closePatronModal();
    };
};

window.viewTrust = function(id) {
    const trust = state.trusts.find(t => t.id === id);
    if (!trust) {
        showToast('Trust not found', 'error');
        return;
    }
    const modal = document.getElementById('patron-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="width:90%;max-width:600px;max-height:90vh;overflow-y:auto;background:var(--bg1);padding:1.5rem;border-radius:var(--radius);">
            <button class="modal-close" onclick="window.closePatronModal()" style="float:right;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text3);">✕</button>
            <h2 style="color:var(--gold);">${escHtml(trust.name)}</h2>
            <div style="font-size:1.5rem;">${safeString(trust.icon || '🤝')}</div>
            <div>Tier ${escHtml(trust.tier || 'I')}</div>
            ${trust.description ? `<p>${formatText(trust.description)}</p>` : ''}
            <div><strong>Obligation:</strong> ${trust.obligation || 0}/${trust.capacity || 4}</div>
            <div><strong>Assets:</strong> ${trust.assets?.length || 0}</div>
            <div><strong>Followers:</strong> ${trust.followers?.length || 0}</div>
            <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()" style="margin-top:0.5rem;">Close</button>
        </div>
    `;
    modal.onclick = (e) => {
        if (e.target === modal) window.closePatronModal();
    };
};

window.loadDefaultPatrons = function() {
    loadDefaultPatrons();
    refreshView();
    showToast('Loaded default patrons', 'success');
};

// ============================================================
// OBLIGATION WINDOW FUNCTIONS
// ============================================================

window.addPatronObligation = function(characterId, patronId, amount = 1) {
    addPatronObligation(characterId, patronId, amount);
    const patron = state.cosmicPatrons.find(p => p.id === patronId);
    if (patron) renderPatronDetail(patronId);
    showToast(`Added ${amount} Obligation to ${patronId}`, 'success');
};

window.clearPatronObligation = function(characterId, patronId, amount = 1) {
    clearPatronObligation(characterId, patronId, amount);
    const patron = state.cosmicPatrons.find(p => p.id === patronId);
    if (patron) renderPatronDetail(patronId);
    showToast(`Cleared ${amount} Obligation from ${patronId}`, 'info');
};

// ============================================================
// CRUD OPERATIONS (cosmic, terrestrial, religions, trusts)
// ============================================================

window.addCosmicPatron = function() {
    const name = prompt('Enter patron name:');
    if (!name) return;
    const domain = prompt('Enter patron domain:') || 'Unknown';
    const icon = prompt('Enter patron icon (emoji):') || '🌟';

    state.cosmicPatrons.push(normalizePatron({
        id: 'patron-' + Date.now(),
        name,
        domain,
        icon,
        description: prompt('Enter description:') || 'A cosmic patron of the Amaranthine.',
        rites: prompt('Enter rites (comma-separated):')?.split(',').map(s => s.trim()) || [],
        rivals: prompt('Enter rivals (comma-separated):')?.split(',').map(s => s.trim()) || [],
        sigil: prompt('Enter sigil description:') || 'Unknown',
        corruption: prompt('Enter corruption effect:') || 'None',
        source: 'local'
    }));
    savePatronData();
    refreshView();
    showToast(`Added patron: ${name}`, 'success');
};

window.editPatron = function(id) {
    const patron = state.cosmicPatrons.find(p => p.id === id);
    if (!patron) return;
    const name = prompt('Enter patron name:', patron.name || patron.title);
    if (!name) return;
    patron.name = name;
    patron.title = name;
    patron.domain = prompt('Enter patron domain:', patron.domain || patron.subtitle) || patron.domain;
    patron.icon = prompt('Enter patron icon:', patron.icon) || patron.icon;
    patron.description = prompt('Enter description:', patron.description) || patron.description;
    patron.sigil = prompt('Enter sigil:', patron.sigil) || patron.sigil;
    patron.corruption = prompt('Enter corruption:', patron.corruption) || patron.corruption;
    patron.source = 'local';
    savePatronData();
    refreshView();
    window.closePatronModal();
    showToast(`Updated patron: ${name}`, 'success');
};

window.deletePatron = function(id) {
    const patron = state.cosmicPatrons.find(p => p.id === id);
    if (!patron) return;
    if (!confirm(`Delete patron "${patron.name || patron.title}"?`)) return;
    state.cosmicPatrons = state.cosmicPatrons.filter(p => p.id !== id);
    savePatronData();
    refreshView();
    window.closePatronModal();
    showToast(`Deleted patron: ${patron.name || patron.title}`, 'info');
};

window.addTerrestrialPatron = function() {
    const name = prompt('Enter terrestrial patron name:');
    if (!name) return;

    state.terrestrialPatrons.push(normalizePatron({
        id: 'terr-' + Date.now(),
        name,
        type: prompt('Enter type (creditor/fence/sanctuary/military/tribal):') || 'patron',
        tier: prompt('Enter tier (I-V):') || 'I',
        description: prompt('Enter description:') || 'A terrestrial patron of the Amaranthine.',
        location: prompt('Enter location:') || 'Unknown',
        leverage: prompt('Enter leverage:') || 'None listed',
        debtTrigger: prompt('Enter debt trigger:') || 'When Obligation fills, they call in a debt.',
        quirk: prompt('Enter quirk:') || '',
        assetSlots: parseInt(prompt('Enter asset slots:') || '2'),
        maxAssetTier: prompt('Enter max asset tier (Minor/Standard/Major):') || 'Minor',
        obligationCapacity: prompt('Enter obligation capacity (Spirit+Presence or fixed):') || 'Spirit+Presence',
        source: 'local'
    }));
    savePatronData();
    refreshView();
    showToast(`Added terrestrial patron: ${name}`, 'success');
};

window.editTerrestrial = function(id) {
    const patron = state.terrestrialPatrons.find(p => p.id === id);
    if (!patron) return;
    const name = prompt('Enter name:', patron.name || patron.title);
    if (!name) return;
    patron.name = name;
    patron.title = name;
    patron.type = prompt('Enter type:', patron.type) || patron.type;
    patron.tier = prompt('Enter tier:', patron.tier) || patron.tier;
    patron.description = prompt('Enter description:', patron.description) || patron.description;
    patron.location = prompt('Enter location:', patron.location) || patron.location;
    patron.leverage = prompt('Enter leverage:', patron.leverage) || patron.leverage;
    patron.debtTrigger = prompt('Enter debt trigger:', patron.debtTrigger) || patron.debtTrigger;
    patron.quirk = prompt('Enter quirk:', patron.quirk) || patron.quirk;
    patron.assetSlots = parseInt(prompt('Enter asset slots:', patron.assetSlots) || '2');
    patron.maxAssetTier = prompt('Enter max asset tier:', patron.maxAssetTier) || patron.maxAssetTier;
    patron.obligationCapacity = prompt('Enter obligation capacity:', patron.obligationCapacity) || patron.obligationCapacity;
    patron.source = 'local';
    savePatronData();
    refreshView();
    window.closePatronModal();
    showToast(`Updated terrestrial patron: ${name}`, 'success');
};

window.deleteTerrestrial = function(id) {
    const patron = state.terrestrialPatrons.find(p => p.id === id);
    if (!patron) return;
    if (!confirm(`Delete terrestrial patron "${patron.name || patron.title}"?`)) return;
    state.terrestrialPatrons = state.terrestrialPatrons.filter(p => p.id !== id);
    savePatronData();
    refreshView();
    window.closePatronModal();
    showToast(`Deleted terrestrial patron: ${patron.name || patron.title}`, 'info');
};

window.addReligion = function() {
    const name = prompt('Enter religion name:');
    if (!name) return;
    const icon = prompt('Enter icon (emoji):') || '⛪';

    state.religions.push({
        id: 'religion-' + Date.now(),
        name,
        icon,
        description: prompt('Enter description:') || 'A religion of the Amaranthine.',
        lore: prompt('Enter lore:') || '',
        doctrines: prompt('Enter doctrines (comma-separated):')?.split(',').map(s => s.trim()) || [],
        practices: prompt('Enter practices (comma-separated):')?.split(',').map(s => s.trim()) || [],
        orders: [],
        source: 'local'
    });
    savePatronData();
    refreshView();
    showToast(`Added religion: ${name}`, 'success');
};

window.editReligion = function(id) {
    const religion = state.religions.find(r => r.id === id);
    if (!religion) return;
    const name = prompt('Enter religion name:', religion.name);
    if (!name) return;
    religion.name = name;
    religion.icon = prompt('Enter icon:', religion.icon) || religion.icon;
    religion.description = prompt('Enter description:', religion.description) || religion.description;
    religion.lore = prompt('Enter lore:', religion.lore) || religion.lore;
    religion.doctrines = prompt('Enter doctrines (comma-separated):', religion.doctrines.join(','))?.split(',').map(s => s.trim()) || [];
    religion.practices = prompt('Enter practices (comma-separated):', religion.practices.join(','))?.split(',').map(s => s.trim()) || [];
    religion.source = 'local';
    savePatronData();
    refreshView();
    window.closePatronModal();
    showToast(`Updated religion: ${name}`, 'success');
};

window.deleteReligion = function(id) {
    const religion = state.religions.find(r => r.id === id);
    if (!religion) return;
    if (!confirm(`Delete religion "${religion.name}"?`)) return;
    state.religions = state.religions.filter(r => r.id !== id);
    savePatronData();
    refreshView();
    window.closePatronModal();
    showToast(`Deleted religion: ${religion.name}`, 'info');
};

window.addTrust = function() {
    const name = prompt('Enter trust name:');
    if (!name) return;

    state.trusts.push({
        id: 'trust-' + Date.now(),
        name,
        icon: prompt('Enter icon (emoji):') || '🤝',
        tier: prompt('Enter tier (I-III):') || 'I',
        description: prompt('Enter description:') || 'A player trust formed by the party.',
        maxAssets: parseInt(prompt('Enter max asset slots:') || '2'),
        maxAssetTier: prompt('Enter max asset tier (Minor/Standard/Major):') || 'Standard',
        assets: [],
        followers: [],
        obligation: 0,
        capacity: parseInt(prompt('Enter obligation capacity:') || '4'),
        source: 'local'
    });
    savePatronData();
    refreshView();
    showToast(`Created trust: ${name}`, 'success');
};

window.editTrust = function(id) {
    const trust = state.trusts.find(t => t.id === id);
    if (!trust) return;
    const name = prompt('Enter trust name:', trust.name);
    if (!name) return;
    trust.name = name;
    trust.icon = prompt('Enter icon:', trust.icon) || trust.icon;
    trust.tier = prompt('Enter tier:', trust.tier) || trust.tier;
    trust.description = prompt('Enter description:', trust.description) || trust.description;
    trust.maxAssets = parseInt(prompt('Enter max asset slots:', trust.maxAssets) || '2');
    trust.maxAssetTier = prompt('Enter max asset tier:', trust.maxAssetTier) || trust.maxAssetTier;
    trust.capacity = parseInt(prompt('Enter obligation capacity:', trust.capacity) || '4');
    trust.source = 'local';
    savePatronData();
    refreshView();
    window.closePatronModal();
    showToast(`Updated trust: ${name}`, 'success');
};

window.deleteTrust = function(id) {
    const trust = state.trusts.find(t => t.id === id);
    if (!trust) return;
    if (!confirm(`Delete trust "${trust.name}"?`)) return;
    state.trusts = state.trusts.filter(t => t.id !== id);
    savePatronData();
    refreshView();
    window.closePatronModal();
    showToast(`Deleted trust: ${trust.name}`, 'info');
};

// ============================================================
// VIEW MANAGEMENT
// ============================================================

function refreshView() {
    const container = document.getElementById('patrons-view-container');
    if (container) {
        container.innerHTML = renderView(state.viewMode);
    }
    attachEvents();
}

window.refreshPatrons = function() {
    // Clear cache and reload
    localStorage.removeItem(CACHE_KEY);
    loadPatronData();
    refreshView();
    showToast('Patrons refreshed', 'success');
};

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    document.querySelectorAll('.patrons-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.patrons-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const view = tab.dataset.view;
            const container = document.getElementById('patrons-view-container');
            if (container) {
                container.innerHTML = renderView(view);
                attachEvents();
            }
        });
    });
}

// ============================================================
// LIFECYCLE METHODS
// ============================================================

export function onActivate() {
    console.log('[Patrons] Activated');
    if (!state.dataLoaded) {
        loadPatronData();
    }
    refreshView();
}

export function onDeactivate() {
    console.log('[Patrons] Deactivated');
}

export function refresh() {
    localStorage.removeItem(CACHE_KEY);
    loadPatronData();
    refreshView();
}

export function destroy() {
    container = null;
}

// ============================================================
// EXPORTS
// ============================================================

export default {
    render,
    destroy,
    onActivate,
    onDeactivate,
    refresh,
    loadPatronData,
    loadRemotePatrons,
    loadDefaultPatrons,
    savePatronData,
    getPatronObligation,
    setPatronObligation,
    addPatronObligation,
    clearPatronObligation
};