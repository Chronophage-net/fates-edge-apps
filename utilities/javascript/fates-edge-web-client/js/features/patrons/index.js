// features/patrons/index.js
/**
 * Patrons feature - Display and manage Patrons (Cosmic, Terrestrial, and Trusts)
 * 
 * Data paths:
 * - Cosmic patron data: /data/patrons/{id}.json
 * - Cosmic manifest: /data/patrons/manifest.json
 * - Terrestrial patron data: /data/terrestrial/{id}.json (fallback: /data/factions/{id}.json)
 * - Terrestrial manifest: /data/terrestrial/manifest.json (fallback: /data/factions/manifest.json)
 * - Religions: /data/religions/{id}.json
 * - Religion manifest: /data/religions/manifest.json
 * 
 * Patron data structure supports nested rites with descriptions,
 * corruption tables, lore, cults, gifts, and more.
 * 
 * Terrestrial patrons are factions with additional patron-specific fields.
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

// ============================================================
// CONSTANTS
// ============================================================

const COSMIC_DATA_PATH = '/data/patrons/';
const COSMIC_MANIFEST_PATH = '/data/patrons/manifest.json';

const TERRESTRIAL_DATA_PATH = '/data/terrestrial/';
const TERRESTRIAL_MANIFEST_PATH = '/data/terrestrial/manifest.json';
const TERRESTRIAL_FALLBACK_DATA_PATH = '/data/factions/';
const TERRESTRIAL_FALLBACK_MANIFEST_PATH = '/data/factions/manifest.json';

const RELIGION_DATA_PATH = '/data/religions/';
const RELIGION_MANIFEST_PATHS = [
    '/data/religions/manifest.json',
    '/data/docs/religions-manifest.json'
];

const KNOWN_COSMIC_PATRON_SLUGS = [
    'aveh_the_rider_behind_the_storm',
    'carrion_king',
    'gaila_the_laughing_light',
    'grimmir_the_old_man_of_the_forest',
    'ibeji_the_twin_stones',
    'ikasha_she_who_sleeps',
    'inaea_angel_of_the_spider',
    'isoka_angel_of_serpents',
    'khemesh_the_abyssal_maw',
    'kuva_the_sky_that_takes_many_names',
    'livaea_the_crimson_courtier',
    'lucky_jack_the_lord_of_thieves',
    'lunara_the_silver_quiet',
    'mab_queen_of_courts',
    'maelstraeus_the_infernal_bargainer',
    'malachai_the_cruel_messenger',
    'morag_the_hag_weaver_of_hidden_costs',
    'moriraath_the_destroyer',
    'mykkiel_arbiter_of_the_covenant',
    'nidhoggr_the_worldworm',
    'nimorith_the_gray_benefactor',
    'oath_of_flame__light',
    'oath_of_flame_light',
    'oath_of_mercy_and_grace',
    'oya_the_wind_of_the_sahel',
    'palinode_queen_of_encores',
    'rayn_mistress_of_the_sea',
    'solara_the_still_mirror',
    'the_breath_of_the_first_forge_the_spark_in_the_makers_hand',
    'the_carrion_king_lord_of_decay_and_renewal',
    'the_clockwork_monad_the_iterative_forge',
    'the_confessor_beneath_the_bell',
    'the_gallows_bell',
    'the_inquisitor_prime_the_iron_hand_of_purity',
    'the_ninth_beyond_comprehension',
    'the_pale_shepherd_guide_of_transitions',
    'the_sacred_geometry_architect_of_perfect_forms',
    'the_unbroken_way_the_way_of_balance',
    'thrysos_king_of_revels',
    'varnek_karn_the_deaths_negotiator',
    'venara_the_unbroken_thread',
    'vorthak_the_hunger_unbound',
    'xhakthul_the_thunderspeaker',
    'zephyria_the_first_bloom'
];

// ============================================================
// DEFAULT DATA
// ============================================================

const DEFAULT_COSMIC_PATRONS = [
    // Add your default cosmic patrons here. For brevity, I'll include one example.
    // In your actual file, you can copy the full list from your previous version.
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
    // Add all other default cosmic patrons here
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

// Safely convert any value to a string for display
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

// Extract a plain text description from a patron object
function getPatronDescription(patron) {
    if (!patron) return 'No description available.';
    
    // If there's a direct description string, use it
    if (typeof patron.description === 'string') return patron.description;
    
    // If description is an object (like in the JSON)
    if (patron.description && typeof patron.description === 'object') {
        // If it has a description field, use that
        if (patron.description.description) return patron.description.description;
        // If it has a lore field, use that
        if (patron.description.lore) return patron.description.lore;
        // If it has a quote, use that
        if (patron.description.quote) return patron.description.quote;
        // If it has a text field, use that
        if (patron.description.text) return patron.description.text;
        // If it has followers, combine with others
        let parts = [];
        if (patron.description.followers) parts.push(patron.description.followers);
        if (patron.description.apocalyptic_aspect) parts.push(patron.description.apocalyptic_aspect);
        if (parts.length > 0) return parts.join('\n\n');
    }
    
    // If there's a lore field at top level
    if (patron.lore && typeof patron.lore === 'object') {
        if (patron.lore.description) return patron.lore.description;
        if (patron.lore.lore) return patron.lore.lore;
    }
    if (typeof patron.lore === 'string') return patron.lore;
    
    // Fallback: try to get any string from the object
    return safeString(patron.description) || 'No description available.';
}

// Get a plain text summary for the tile
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

// Normalize a patron object to have consistent fields
function normalizePatron(p) {
    if (!p) return p;
    const result = { ...p };
    // If there's a title but no name, use title as name
    if (!result.name && result.title) result.name = result.title;
    // If there's a subtitle but no domain, use subtitle as domain
    if (!result.domain && result.subtitle) result.domain = result.subtitle;
    // If description is an object, extract it
    if (result.description && typeof result.description === 'object') {
        // If there's a lore.description, use that as the main description
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
    expandedRites: new Set(),
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
        // Load religions
        await loadReligions();

        // --- Load Cosmic Patrons ---
        let cosmicManifest = null;
        try {
            const res = await fetch(COSMIC_MANIFEST_PATH);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) cosmicManifest = data;
            }
        } catch (e) { /* ignore */ }

        let cosmicPatrons = [];
        if (cosmicManifest) {
            for (const entry of cosmicManifest) {
                let patronId = typeof entry === 'string' ? entry : (entry.id || entry.slug || entry.name);
                if (!patronId) continue;
                patronId = String(patronId).toLowerCase().replace(/[^a-z0-9_-]/g, '');
                try {
                    const res = await fetch(`${COSMIC_DATA_PATH}${patronId}.json`);
                    if (res.ok) {
                        const data = await res.json();
                        if (!data.id) data.id = patronId;
                        cosmicPatrons.push(normalizePatron(data));
                    }
                } catch (e) { /* ignore */ }
            }
        }

        if (cosmicPatrons.length === 0) {
            // Discovery fallback
            for (const slug of KNOWN_COSMIC_PATRON_SLUGS) {
                try {
                    const res = await fetch(`${COSMIC_DATA_PATH}${slug}.json`);
                    if (res.ok) {
                        const data = await res.json();
                        if (!data.id) data.id = slug;
                        cosmicPatrons.push(normalizePatron(data));
                    }
                } catch (e) { /* ignore */ }
            }
        }

        if (cosmicPatrons.length > 0) {
            state.cosmicPatrons = cosmicPatrons;
            state.dataLoaded = true;
            state.usingFallback = false;
            // Save manifest for future
            try {
                await fetch(COSMIC_MANIFEST_PATH, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cosmicPatrons.map(p => p.id || p.name))
                });
            } catch (e) { /* ignore */ }
        }

        // --- Load Terrestrial Patrons ---
        let terrestrialManifest = null;
        let terrestrialDataPath = TERRESTRIAL_DATA_PATH;
        try {
            const res = await fetch(TERRESTRIAL_MANIFEST_PATH);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    terrestrialManifest = data;
                }
            }
        } catch (e) {
            // fallback to factions
            try {
                const res = await fetch(TERRESTRIAL_FALLBACK_MANIFEST_PATH);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        terrestrialManifest = data;
                        terrestrialDataPath = TERRESTRIAL_FALLBACK_DATA_PATH;
                    }
                }
            } catch (e2) { /* ignore */ }
        }

        let terrestrialPatrons = [];
        if (terrestrialManifest) {
            for (const entry of terrestrialManifest) {
                let factionId = typeof entry === 'string' ? entry : (entry.id || entry.slug || entry.name);
                if (!factionId) continue;
                factionId = String(factionId).toLowerCase().replace(/[^a-z0-9_-]/g, '');
                try {
                    const res = await fetch(`${terrestrialDataPath}${factionId}.json`);
                    if (res.ok) {
                        const data = await res.json();
                        if (!data.id) data.id = factionId;
                        // If it has patron-like fields, store it; otherwise mark as generic faction
                        if (data.assetSlots !== undefined || data.maxAssetTier !== undefined || data.leverage) {
                            terrestrialPatrons.push(normalizePatron(data));
                        } else {
                            data._type = 'faction';
                            terrestrialPatrons.push(normalizePatron(data));
                        }
                    }
                } catch (e) { /* ignore */ }
            }
        }

        if (terrestrialPatrons.length === 0) {
            // Use defaults
            terrestrialPatrons = DEFAULT_TERRESTRIAL_PATRONS.map(normalizePatron);
            state.usingFallback = true;
            showToast('⚠️ No terrestrial patron files found. Using defaults.', 'warning');
        }
        state.terrestrialPatrons = terrestrialPatrons;

        // --- Auto-populate any empty categories with defaults ---
        if (state.cosmicPatrons.length === 0) {
            state.cosmicPatrons = DEFAULT_COSMIC_PATRONS.map(normalizePatron);
            state.usingFallback = true;
            showToast('⚠️ No cosmic patron files found. Using defaults.', 'warning');
        }
        if (state.religions.length === 0) {
            state.religions = [...DEFAULT_RELIGIONS];
        }
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

async function loadReligions() {
    let religions = [];
    let manifestData = null;
    for (const path of RELIGION_MANIFEST_PATHS) {
        try {
            const res = await fetch(path);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    manifestData = data;
                    break;
                } else if (data && data.religions && Array.isArray(data.religions)) {
                    manifestData = data.religions;
                    break;
                }
            }
        } catch (e) { /* ignore */ }
    }

    if (manifestData && manifestData.length > 0) {
        for (const entry of manifestData) {
            let id = typeof entry === 'string' ? entry : (entry.id || entry.slug);
            if (!id) continue;
            id = id.toLowerCase().replace(/[^a-z0-9_-]/g, '');
            try {
                const res = await fetch(`${RELIGION_DATA_PATH}${id}.json`);
                if (res.ok) {
                    const data = await res.json();
                    if (!data.id) data.id = id;
                    religions.push(data);
                }
            } catch (e) { /* ignore */ }
        }
    }

    if (religions.length === 0) {
        religions = DEFAULT_RELIGIONS;
    }

    state.religions = religions;
    console.log(`📚 Loaded ${state.religions.length} religions`);
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
// RENDER: COSMIC PATRONS (two-row scrollable grid, names visible)
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
// PATRON DETAIL
// ============================================================

function renderPatronDetail(patronId) {
    const patron = state.cosmicPatrons.find(p => p.id === patronId);
    if (!patron) {
        showToast('Patron not found', 'error');
        return;
    }

    // Update the description area
    const descArea = document.getElementById('cosmic-description-area');
    if (descArea) {
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
            <div style="margin:0.3rem 0 0 0;color:var(--text2);font-size:0.9rem;line-height:1.5;max-height:120px;overflow-y:auto;">
                ${escHtml(desc)}
            </div>
        `;
    }
}

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

    // Build rites HTML
    let ritesHtml = '';
    if (patron.rites && patron.rites.length > 0) {
        const hasDetailedRites = typeof patron.rites[0] === 'object';
        if (hasDetailedRites) {
            ritesHtml = `
                <div class="patron-detail-section">
                    <h3>🔮 Rites (${patron.rites.length})</h3>
                    <div class="rites-list">
                        ${patron.rites.map((r, idx) => {
                            const riteId = `${patron.id}-${idx}`;
                            const isExpanded = state.expandedRites.has(riteId);
                            const hasDesc = r.description && safeString(r.description).length > 0;
                            let detailsHtml = '';
                            if (hasDesc) {
                                detailsHtml = `
                                    <div class="rite-details ${isExpanded ? 'expanded' : 'collapsed'}" 
                                         id="rite-details-${riteId}" 
                                         style="${isExpanded ? '' : 'display:none;'}">
                                        <div class="rite-description">${escHtml(safeString(r.description))}</div>
                                        ${r.tier ? `<div class="rite-meta"><strong>Tier:</strong> ${escHtml(safeString(r.tier))}</div>` : ''}
                                        ${r.xp ? `<div class="rite-meta"><strong>XP:</strong> ${escHtml(safeString(r.xp))}</div>` : ''}
                                        ${r.action ? `<div class="rite-meta"><strong>Action:</strong> ${escHtml(safeString(r.action))}</div>` : ''}
                                        ${r.range ? `<div class="rite-meta"><strong>Range:</strong> ${escHtml(safeString(r.range))}</div>` : ''}
                                        ${r.resist ? `<div class="rite-meta"><strong>Resist:</strong> ${escHtml(safeString(r.resist))}</div>` : ''}
                                        ${r.materials ? `<div class="rite-meta"><strong>Materials:</strong> ${escHtml(safeString(r.materials))}</div>` : ''}
                                        ${r.cost ? `<div class="rite-meta"><strong>Cost:</strong> ${escHtml(safeString(r.cost))}</div>` : ''}
                                        ${r.duration ? `<div class="rite-meta"><strong>Duration:</strong> ${escHtml(safeString(r.duration))}</div>` : ''}
                                        ${r.invoke ? `<div class="rite-meta"><strong>Invoke:</strong> ${escHtml(safeString(r.invoke))}</div>` : ''}
                                        ${r.requires ? `<div class="rite-meta"><strong>Requires:</strong> ${escHtml(safeString(r.requires))}</div>` : ''}
                                        ${r.effect ? `<div class="rite-meta"><strong>Effect:</strong> ${escHtml(safeString(r.effect))}</div>` : ''}
                                        ${r.push_it ? `<div class="rite-meta"><strong>Push It:</strong> ${escHtml(safeString(r.push_it))}</div>` : ''}
                                        ${r.timer ? `<div class="rite-meta"><strong>Timer:</strong> ${escHtml(safeString(r.timer))}</div>` : ''}
                                        ${r.tags && r.tags.length > 0 ? `<div class="rite-tags">${r.tags.map(t => `<span class="badge badge-tag">${escHtml(safeString(t))}</span>`).join('')}</div>` : ''}
                                    </div>
                                `;
                            }
                            const riteName = safeString(r.name);
                            const riteTier = safeString(r.tier || '');
                            return `
                                <div class="rite-item ${hasDesc ? 'rite-expandable' : ''}" data-rite-id="${riteId}">
                                    <div class="rite-header" onclick="${hasDesc ? `window.toggleRite('${riteId}')` : ''}">
                                        <span class="rite-name">${escHtml(riteName)}</span>
                                        ${riteTier ? `<span class="rite-tier">${escHtml(riteTier)}</span>` : ''}
                                        ${hasDesc ? `<span class="rite-expand-icon">${isExpanded ? '▾' : '▸'}</span>` : ''}
                                    </div>
                                    ${detailsHtml}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            ritesHtml = `
                <div class="patron-detail-section">
                    <h3>🔮 Rites (${patron.rites.length})</h3>
                    <ul>
                        ${patron.rites.map(r => `<li>${escHtml(safeString(r))}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    }

    const currentObligation = getPatronObligation('default-character', patron.id);

    // Build the modal content
    modal.innerHTML = `
        <div class="modal-content patron-detail" style="width: 90%; max-width: 1200px; max-height: 90vh; overflow-y: auto;">
            <button class="modal-close" onclick="window.closePatronModal()">✕</button>
            <div class="patron-detail-header">
                <div class="patron-detail-icon" style="font-size:3rem;">${escHtml(icon)}</div>
                <div>
                    <h2>${escHtml(name)}</h2>
                    <div class="patron-detail-domain">${escHtml(domain)}</div>
                    ${religion ? `<span class="badge badge-religion" style="background:var(--gold);color:var(--bg);">⛪ ${escHtml(religion)}</span>` : ''}
                    ${patron.source === 'default' ? '<span class="badge badge-remote" style="font-size:0.7rem;">📦 Default Data</span>' : ''}
                    <div style="margin-top:0.3rem;font-size:0.9rem;">
                        Obligation: <strong>${currentObligation}</strong>
                        <button class="btn btn-xs btn-primary" onclick="window.addPatronObligation('default-character', '${patron.id}', 1)">➕</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.clearPatronObligation('default-character', '${patron.id}', 1)">➖</button>
                    </div>
                </div>
            </div>
            <div class="patron-detail-body">
                ${desc ? `<div class="patron-detail-section"><h3>📖 Description</h3><p>${escHtml(desc)}</p></div>` : ''}
                ${patron.lore && typeof patron.lore === 'object' ? `<div class="patron-detail-section"><h3>📚 Lore</h3><p style="white-space:pre-wrap;">${escHtml(safeString(patron.lore.description || patron.lore))}</p></div>` : ''}
                ${patron.domain_focus ? `<div class="patron-detail-section"><h3>🎯 Domain Focus</h3><ul>${patron.domain_focus.map(d => `<li>${escHtml(safeString(d))}</li>`).join('')}</ul></div>` : ''}
                ${patron.patrons_gift ? `<div class="patron-detail-section"><h3>🎁 Patron's Gift</h3><p><strong>${escHtml(safeString(patron.patrons_gift.name || 'Gift'))}</strong></p><p>${escHtml(safeString(patron.patrons_gift.description))}</p>${patron.patrons_gift.effect ? `<p><strong>Effect:</strong> ${escHtml(safeString(patron.patrons_gift.effect))}</p>` : ''}${patron.patrons_gift.cost ? `<p class="text-muted">Cost: ${escHtml(safeString(patron.patrons_gift.cost))}</p>` : ''}</div>` : ''}
                ${ritesHtml}
                ${patron.corruption ? `<div class="patron-detail-section"><h3>⚠️ Corruption</h3><table style="width:100%;border-collapse:collapse;font-size:0.9rem;"><thead><tr><th>Tier</th><th>Benefit</th><th>Cost / Quirk</th></tr></thead><tbody>${patron.corruption.map(c => `<tr><td>${escHtml(safeString(c.tier))}</td><td>${escHtml(safeString(c.benefit))}</td><td>${escHtml(safeString(c.cost))}</td></tr>`).join('')}</tbody></table></div>` : ''}
                ${patron.cantors_and_cults ? `<div class="patron-detail-section"><h3>🎶 Cantors & Cults</h3>${patron.cantors_and_cults.cantors ? `<p><strong>Cantors:</strong> ${escHtml(safeString(patron.cantors_and_cults.cantors.description || patron.cantors_and_cults.cantors))}</p>` : ''}${patron.cantors_and_cults.cult ? `<p><strong>Cult:</strong> ${escHtml(safeString(patron.cantors_and_cults.cult.description || patron.cantors_and_cults.cult))}</p>` : ''}</div>` : ''}
                ${patron.witchcraft ? `<div class="patron-detail-section"><h3>🧹 Witchcraft</h3>${patron.witchcraft.description ? `<p>${escHtml(safeString(patron.witchcraft.description))}</p>` : ''}${patron.witchcraft.tools ? `<p><strong>Tool:</strong> ${escHtml(safeString(patron.witchcraft.tools.name || ''))} — ${escHtml(safeString(patron.witchcraft.tools.description || ''))}</p>` : ''}${patron.witchcraft.hedge_gifts ? `<div><strong>Hedge Gifts:</strong></div><ul>${patron.witchcraft.hedge_gifts.map(g => `<li><strong>${escHtml(safeString(g.name))}</strong> (${escHtml(safeString(g.xp))} XP): ${escHtml(safeString(g.description))}</li>`).join('')}</ul>` : ''}</div>` : ''}
                ${patron.playstyle_notes ? `<div class="patron-detail-section"><h3>🎮 Playstyle Notes</h3>${patron.playstyle_notes.description ? `<p>${escHtml(safeString(patron.playstyle_notes.description))}</p>` : ''}${patron.playstyle_notes.emphasizes ? `<div><strong>Emphasizes:</strong></div><ul>${patron.playstyle_notes.emphasizes.map(e => `<li>${escHtml(safeString(e))}</li>`).join('')}</ul>` : ''}</div>` : ''}
                ${patron.quotes ? `<div class="patron-detail-section"><h3>💬 Quotes</h3>${patron.quotes.map(q => `<blockquote style="margin:0.5rem 0;padding:0.5rem 1rem;background:var(--bg3);border-left:4px solid var(--gold);"><em>${escHtml(safeString(q.text))}</em> — ${escHtml(safeString(q.speaker))}</blockquote>`).join('')}</div>` : ''}
            </div>
            <div class="patron-detail-actions">
                <button class="btn btn-sm" onclick="window.editPatron('${patron.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="window.deletePatron('${patron.id}')">🗑️ Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()">Close</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePatronModal();
    });
};

// ============================================================
// TERRESTRIAL PATRON DETAIL
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
            <div style="margin:0.3rem 0 0 0;color:var(--text2);font-size:0.9rem;line-height:1.5;max-height:120px;overflow-y:auto;">
                ${escHtml(desc)}
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
    const summary = getPatronSummary(patron);
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
        <div class="modal-content patron-detail" style="width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <button class="modal-close" onclick="window.closePatronModal()">✕</button>
            <div class="patron-detail-header">
                <div style="font-size:3rem;">${escHtml(icon)}</div>
                <div>
                    <h2>${escHtml(name)}</h2>
                    <div style="color:var(--text3);">${escHtml(type)}</div>
                    <div style="color:var(--text3);">Tier ${escHtml(tier)}</div>
                </div>
            </div>
            <div class="patron-detail-body">
                ${desc ? `<div class="patron-detail-section"><h3>📖 Description</h3><p>${escHtml(desc)}</p></div>` : ''}
                ${location ? `<div class="patron-detail-section"><h3>📍 Location</h3><p>${escHtml(location)}</p></div>` : ''}
                ${leverage ? `<div class="patron-detail-section"><h3>💰 Leverage</h3><p>${escHtml(leverage)}</p></div>` : ''}
                ${debtTrigger ? `<div class="patron-detail-section"><h3>⚡ Debt Trigger</h3><p>${escHtml(debtTrigger)}</p></div>` : ''}
                ${quirk ? `<div class="patron-detail-section"><h3>🌀 Quirk</h3><p>${escHtml(quirk)}</p></div>` : ''}
                <div class="patron-detail-section"><h3>📊 Stats</h3>
                    <ul>
                        <li>Asset Slots: ${escHtml(assetSlots)}</li>
                        <li>Max Asset Tier: ${escHtml(maxAssetTier)}</li>
                        <li>Obligation Capacity: ${escHtml(obligationCapacity)}</li>
                    </ul>
                </div>
                ${patron.agendaTimer ? `<div class="patron-detail-section"><h3>⏱️ Agenda Timer</h3><div>${safeString(patron.agendaTimer.current || 0)}/${safeString(patron.agendaTimer.segments || 6)}</div><div class="timer-bar"><div class="timer-bar-fill" style="width:${((patron.agendaTimer?.current||0)/(patron.agendaTimer?.segments||6))*100}%;"></div></div></div>` : ''}
                ${patron.keyNPCs ? `<div class="patron-detail-section"><h3>👤 Key NPCs</h3><ul>${patron.keyNPCs.map(n => `<li>${escHtml(safeString(n))}</li>`).join('')}</ul></div>` : ''}
                ${patron.hooks ? `<div class="patron-detail-section"><h3>🔗 Hooks</h3><ul>${patron.hooks.map(h => `<li>${escHtml(safeString(h))}</li>`).join('')}</ul></div>` : ''}
            </div>
            <div class="patron-detail-actions">
                <button class="btn btn-sm" onclick="window.editTerrestrial('${patron.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteTerrestrial('${patron.id}')">🗑️ Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()">Close</button>
            </div>
        </div>
    `;
};

// ============================================================
// RITE TOGGLE
// ============================================================

window.toggleRite = function(riteId) {
    const details = document.getElementById(`rite-details-${riteId}`);
    if (!details) return;
    const isExpanded = details.style.display !== 'none';
    details.style.display = isExpanded ? 'none' : 'block';
    const item = details.closest('.rite-item');
    if (item) {
        const icon = item.querySelector('.rite-expand-icon');
        if (icon) icon.textContent = isExpanded ? '▸' : '▾';
    }
    if (isExpanded) state.expandedRites.delete(riteId);
    else state.expandedRites.add(riteId);
};

// ============================================================
// MODAL CONTROLS
// ============================================================

window.closePatronModal = function() {
    document.getElementById('patron-modal').style.display = 'none';
};

window.closeAssetModal = function() {
    document.getElementById('asset-modal').style.display = 'none';
};

window.viewPatron = function(id) {
    renderPatronDetail(id);
};

window.viewReligion = function(id) {
    renderReligionDetail(id);
};

window.viewTrust = function(id) {
    renderTrustDetail(id);
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
    // Re-render description area
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
// CRUD OPERATIONS - COSMIC PATRONS
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
    patron.title = name; // keep both for compatibility
    patron.domain = prompt('Enter patron domain:', patron.domain || patron.subtitle) || patron.domain;
    patron.icon = prompt('Enter patron icon:', patron.icon) || patron.icon;
    patron.description = prompt('Enter description:', patron.description) || patron.description;
    patron.sigil = prompt('Enter sigil:', patron.sigil) || patron.sigil;
    patron.corruption = prompt('Enter corruption:', patron.corruption) || patron.corruption;
    patron.source = 'local';
    savePatronData();
    refreshView();
    closePatronModal();
    showToast(`Updated patron: ${name}`, 'success');
};

window.deletePatron = function(id) {
    const patron = state.cosmicPatrons.find(p => p.id === id);
    if (!patron) return;
    if (!confirm(`Delete patron "${patron.name || patron.title}"?`)) return;
    state.cosmicPatrons = state.cosmicPatrons.filter(p => p.id !== id);
    savePatronData();
    refreshView();
    closePatronModal();
    showToast(`Deleted patron: ${patron.name || patron.title}`, 'info');
};

// ============================================================
// CRUD OPERATIONS - TERRESTRIAL PATRONS
// ============================================================

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
    closePatronModal();
    showToast(`Updated terrestrial patron: ${name}`, 'success');
};

window.deleteTerrestrial = function(id) {
    const patron = state.terrestrialPatrons.find(p => p.id === id);
    if (!patron) return;
    if (!confirm(`Delete terrestrial patron "${patron.name || patron.title}"?`)) return;
    state.terrestrialPatrons = state.terrestrialPatrons.filter(p => p.id !== id);
    savePatronData();
    refreshView();
    closePatronModal();
    showToast(`Deleted terrestrial patron: ${patron.name || patron.title}`, 'info');
};

// ============================================================
// CRUD OPERATIONS - RELIGIONS
// ============================================================

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
    closePatronModal();
    showToast(`Updated religion: ${name}`, 'success');
};

window.deleteReligion = function(id) {
    const religion = state.religions.find(r => r.id === id);
    if (!religion) return;
    if (!confirm(`Delete religion "${religion.name}"?`)) return;
    state.religions = state.religions.filter(r => r.id !== id);
    savePatronData();
    refreshView();
    closePatronModal();
    showToast(`Deleted religion: ${religion.name}`, 'info');
};

// ============================================================
// CRUD OPERATIONS - TRUSTS
// ============================================================

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
    closePatronModal();
    showToast(`Updated trust: ${name}`, 'success');
};

window.deleteTrust = function(id) {
    const trust = state.trusts.find(t => t.id === id);
    if (!trust) return;
    if (!confirm(`Delete trust "${trust.name}"?`)) return;
    state.trusts = state.trusts.filter(t => t.id !== id);
    savePatronData();
    refreshView();
    closePatronModal();
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