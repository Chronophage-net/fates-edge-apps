// features/patrons/index.js
/**
 * Patrons feature - Display and manage Patrons (Cosmic, Terrestrial, and Trusts)
 * Similar to regional generation with card-based display
 * 
 * Data paths:
 * - Patron data: /data/patrons/{id}.json
 * - Patron manifest: /data/patrons/manifest.json
 * - Fallback: /data/docs/manifest-core.json (if it contains patron IDs)
 * 
 * Patron data structure supports nested rites with descriptions:
 * {
 *   "name": "Patron Name",
 *   "domain": "Domain",
 *   "description": "HTML description",
 *   "rites": [
 *     {
 *       "name": "Rite Name",
 *       "description": "HTML description of the rite",
 *       "tags": ["TAG1", "TAG2"],
 *       "cost": "Mark +1 Obligation",
 *       "duration": "Scene",
 *       "action": "1 action",
 *       "effect": "Effect description"
 *     }
 *   ]
 * }
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

// ============================================================
// CONSTANTS
// ============================================================

const PATRON_DATA_PATH = '/data/patrons/';
const PATRON_MANIFEST_PATHS = [
    '/data/patrons/manifest.json',
    '/data/docs/manifest-core.json',
    '/data/docs/manifest-full.json',
    '/patrons/manifest.json'  // legacy fallback
];

// Known patron slugs from the setting (for discovery fallback)
const KNOWN_PATRON_SLUGS = [
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

const PATRON_CATEGORIES = {
    cosmic: 'Cosmic Patrons',
    terrestrial: 'Terrestrial Patrons',
    trust: 'Player Trusts'
};

const PATRON_ICONS = {
    cosmic: '🌟',
    terrestrial: '🏛️',
    trust: '🤝'
};

// Default cosmic patrons (fallback if remote load fails)
const DEFAULT_COSMIC_PATRONS = [
    {
        id: 'the_traveler',
        name: 'The Traveler',
        icon: '🚶',
        domain: 'Ways & Journeys',
        description: 'The eternal guide of roads, thresholds, and journeys. Watches from every crossroads and listens at every waymark. Honored with offerings before any significant trek.',
        rites: ['Road-Sense', 'Traveler\'s Boon', 'Waymark', 'Bridge Between'],
        rivals: ['Khemesh', 'Pale Shepherd'],
        sigil: 'A spiral that ends in a fork',
        corruption: 'Restlessness, inability to settle',
        source: 'default'
    },
    {
        id: 'oath-flame-light',
        name: 'Oath of Flame & Light',
        icon: '🔥',
        domain: 'Dawn & Vows',
        description: 'The patron of dawn, vows, and protection. Their followers kindle oaths and burn away lies. The unquenched flame judges truth and debt.',
        rites: ['Kindle Vow', 'Lay on Hands', 'Radiant Smite'],
        rivals: ['Malachai'],
        sigil: 'A flame within a circle',
        corruption: 'Unquenchable honesty, cannot lie',
        source: 'default'
    },
    {
        id: 'ikasha',
        name: 'Ikasha, She Who Sleeps',
        icon: '🌙',
        domain: 'Shadow & Secrets',
        description: 'The hush between footfalls, the patience of dark water. She does not command—she sleeps. In her dreams, she whispers possibilities.',
        rites: ['Unlit Candle', 'Crossroads Raven', 'Umbral Reservoir'],
        rivals: ['Witness', 'Silent Choir'],
        sigil: 'A crescent moon with a closed eye',
        corruption: 'Shadows lengthen, voice fades to a whisper',
        source: 'default'
    },
    {
        id: 'witness',
        name: 'The Witness',
        icon: '👁️',
        domain: 'Truth & Revelation',
        description: 'The patron of truth, memory, and inconvenient revelation. Watches every oath, records every broken promise. Does not forgive—but does remember.',
        rites: ['Lingering Trace', 'Uncomfortable Question', 'Shared Burden'],
        rivals: ['Seal-Breaker', 'Silent Choir'],
        sigil: 'An unblinking eye',
        corruption: 'Cannot look away from truth, must correct falsehoods',
        source: 'default'
    },
    {
        id: 'carrion-king',
        name: 'The Carrion King',
        icon: '💀',
        domain: 'Decay & Renewal',
        description: 'The patron of endings and new beginnings. Where things rot, new things grow. Not evil—merely inevitable.',
        rites: ['Fertile Death', 'Borrowed Form', 'Eternal Cycle'],
        rivals: [],
        sigil: 'A crown of bones with a sprouting seed',
        corruption: 'Scent of turned earth, animals are nervous',
        source: 'default'
    },
    {
        id: 'palinode',
        name: 'Palinode, Queen of Encores',
        icon: '🎭',
        domain: 'Performance & Rapture',
        description: 'The patron of performance, rapture, and the moment that must be repeated. Her followers are artists, skalds, and those who live for the encore.',
        rites: ['Hymn Against Dread', 'Perfect Performance', 'Captivate Audience'],
        rivals: [],
        sigil: 'A mask with a single tear',
        corruption: 'Cannot leave a performance incomplete',
        source: 'default'
    },
    {
        id: 'livaea',
        name: 'Livaea, the Crimson Courtier',
        icon: '💋',
        domain: 'Seduction & Social Binding',
        description: 'The patron of courtiers, concubines, and all who trade in desire. Every song is a seduction, every glance a contract, every touch a negotiation.',
        rites: ['Golden Tongue', 'The Velvet Invitation', 'The Unrefusable Offer', 'The Crimson Masquerade'],
        rivals: ['Malachai'],
        sigil: 'A crimson kiss on a velvet field',
        corruption: 'Eyes reflect desires, skin always warm',
        source: 'default'
    },
    {
        id: 'lucky-jack',
        name: 'Lucky Jack, Lord of Thieves',
        icon: '🪙',
        domain: 'Luck & The Heist',
        description: 'The Unspent Coin, the Magpie King. Patron of urchins, beggars, and thieves who plan their work. Every stroke of luck is a loan.',
        rites: ['The Lucky Pick', 'The Crowd\'s Distraction', 'The Unseen Hand', 'The Magpie\'s Hoard'],
        rivals: [],
        sigil: 'A coin with a laughing face',
        corruption: 'Compulsive gambling, debts that compound',
        source: 'default'
    },
    {
        id: 'aveh',
        name: 'Aveh, the Rider Behind the Storm',
        icon: '🌪️',
        domain: 'Freedom & Erasure',
        description: 'The faceless rider at the horizon\'s edge. Offers freedom at the cost of belonging. For those who need to vanish.',
        rites: ['Unlatched Step', 'Forgotten Road', 'Unremembered Name'],
        rivals: ['Ykrul spirit'],
        sigil: 'A rider with no face',
        corruption: 'Cannot stay in one place, connections fade',
        source: 'default'
    },
    {
        id: 'malachai',
        name: 'Malachai, the Chained Angel',
        icon: '⛓️',
        domain: 'Curses & Corruption',
        description: 'The patron of gamblers, addicts, and those who have sold themselves. Answers when the thief has nothing left to lose.',
        rites: ['The Lucky Pick', 'The Debt Note', 'The Final Score'],
        rivals: ['Oath of Flame & Light', 'Livaea'],
        sigil: 'A broken chain',
        corruption: 'Voice cracks, shadow hungers, counting coins you never had',
        source: 'default'
    },
    {
        id: 'sealed-gate',
        name: 'The Sealed Gate',
        icon: '🚪',
        domain: 'Thresholds & Containment',
        description: 'The patron of boundaries, thresholds, and what must remain sealed. Wards, banishments, and protective circles fall under their domain.',
        rites: ['Sealed Threshold', 'Circle of Denial', 'Banishment Knot'],
        rivals: ['Savage Heart'],
        sigil: 'A door with nine locks',
        corruption: 'Obsession with sealing things, paranoia',
        source: 'default'
    },
    {
        id: 'maelstraeus',
        name: 'Maelstraeus, the Infernal Bargainer',
        icon: '📜',
        domain: 'Commerce & Exchange',
        description: 'The patron of trade, bargains, and the weight of contracts. Every deal has a price, and Maelstraeus always collects.',
        rites: ['Trading Grounds', 'Appraise Value', 'Weighted Contract'],
        rivals: [],
        sigil: 'A golden ledger',
        corruption: 'Counting everything, weighing every word',
        source: 'default'
    }
];

// Default terrestrial patrons
const DEFAULT_TERRESTRIAL_PATRONS = [
    {
        id: 'madam-serafine',
        name: 'Madam Serafine',
        type: 'creditor',
        tier: 'IV',
        description: 'Mistress of the Velvet Court. Controls information, forgery, and laundering in Silkstrand. Never wears the same dress twice. Has not slept in the same room for more than three nights in a decade.',
        leverage: 'Information on every major official in Silkstrand. Secret passage into the Archivolt\'s sealed vault.',
        debtTrigger: 'When Obligation fills, demands a service—a heist, a confession, or a secret delivered.',
        quirk: 'She is still paying off a debt to Livaea, a debt that grows heavier with every year she does not ascend.',
        location: 'Silkstrand',
        assetSlots: 6,
        maxAssetTier: 'Major',
        source: 'default'
    },
    {
        id: 'old-kes',
        name: 'Old Kes',
        type: 'fence',
        tier: 'III',
        description: 'The fence who taught the Silk Coin their trade. Can move any good, anywhere, within a week. Missing three fingers on his left hand—lost to a customs trap, kept in a jar as a warning.',
        leverage: 'Contract with a Sidhi ship captain worth a small fortune.',
        debtTrigger: 'When Obligation fills, demands a smuggling run or a difficult fence job.',
        quirk: 'Keeps his severed fingers in a jar as a warning to himself.',
        location: 'Silkstrand',
        assetSlots: 4,
        maxAssetTier: 'Standard',
        source: 'default'
    },
    {
        id: 'sister-agatha',
        name: 'Sister Agatha',
        type: 'sanctuary',
        tier: 'II',
        description: 'Gives sanctuary to thieves on the run. Her hospice is neutral ground—no violence permitted. The Watch respects her because she heals their wounded.',
        leverage: 'Tattoo of a broken chain on her wrist—she was a freed slave from Ashaan.',
        debtTrigger: 'When Obligation fills, demands work in her soup kitchen or protection for the poor.',
        quirk: 'Never sleeps in the same place twice.',
        location: 'Silkstrand',
        assetSlots: 2,
        maxAssetTier: 'Minor',
        source: 'default'
    },
    {
        id: 'prefect-marcellus',
        name: 'Prefect Gaius Marcellus',
        type: 'military',
        tier: 'III',
        description: 'Commander of the garrison at Castra Ferrum. Speaks in clipped phrases and never repeats himself. His brother died in a Ykrul raid—a wound he has never spoken of.',
        leverage: 'Military escort, legal immunity, access to the tribunal.',
        debtTrigger: 'When Obligation fills, demands a dangerous mission behind enemy lines.',
        quirk: 'Carries his brother\'s signet ring on a chain around his neck.',
        location: 'Castra Ferrum',
        assetSlots: 4,
        maxAssetTier: 'Standard',
        source: 'default'
    },
    {
        id: 'khatun-sarnai',
        name: 'Khatun Sarnai',
        type: 'tribal',
        tier: 'III',
        description: 'Proud, grieving chieftain of the Gray Ash Ykrul. Her nephew was killed by a Vilikari caravan. She will not trust Ecktorians, but respects those who keep their word.',
        leverage: 'Remounts, safe camp, Ykrul guides.',
        debtTrigger: 'When Obligation fills, demands a blood-price or a raid on a rival clan.',
        quirk: 'Her daughter Yelü is the child of a legionary who defected.',
        location: 'Violet Steppe',
        assetSlots: 4,
        maxAssetTier: 'Major',
        source: 'default'
    }
];

// Default Trusts
const DEFAULT_TRUSTS = [
    {
        id: 'velvet-coin',
        name: 'The Velvet Coin',
        icon: '🪙',
        tier: 'I',
        description: 'A thieves\' guild operating in the shadows of Silkstrand. Founded by exiles from the Silk Coin, now a legitimate (and illegitimate) organization with hands in smuggling, information, and the occasional heist.',
        maxAssets: 2,
        maxAssetTier: 'Standard',
        assets: [
            {
                id: 'safehouse-dye-district',
                name: 'Safehouse: Dye District',
                type: 'safehouse',
                tier: 'Minor',
                description: 'A converted spice warehouse near the Dye Yards. Hidden compartments, false walls, and a landlord who never saw you.',
                cost: 4,
                freeUse: 'Start an entry/exit scene Dominant',
                sceneSurge: 'Produce a hidden egress; convert one pursuit consequence into a temporary complication'
            },
            {
                id: 'informant-network',
                name: 'Informant Network: Docks',
                type: 'network',
                tier: 'Minor',
                description: 'Eyes and ears on the waterfront. Porters, lamplighters, and urchins who watch for coin and gossip.',
                cost: 4,
                freeUse: 'Targeted inquiry begins Dominant',
                sceneSurge: 'Reveal a hidden schedule or route; mitigate 1 SB from ambush/surprise'
            }
        ],
        followers: [
            {
                id: 'quick-lena',
                name: '"Quick" Lena',
                role: 'Informant',
                cap: 2,
                description: 'A Sidhi rogue with mismatched eyes and a nervous laugh. Owes a debt to a Sidhi smuggler named Peyton. Has a soft spot for urchins.',
                loyalty: 'Faithful',
                fitness: 'Ready'
            }
        ],
        obligation: 2,
        capacity: 4,
        source: 'default'
    }
];

// ============================================================
// STATE
// ============================================================

let container = null;
let state = {
    cosmicPatrons: [],
    terrestrialPatrons: [],
    trusts: [],
    selectedPatron: null,
    selectedTrust: null,
    selectedAsset: null,
    viewMode: 'cosmic',
    isLoading: false,
    dataLoaded: false,
    expandedRites: new Set() // Track which rites are expanded
};

// ============================================================
// LOAD DATA (Fixed with manifest discovery)
// ============================================================

export function loadPatronData() {
    const saved = getState();
    if (saved.patrons) {
        state.cosmicPatrons = saved.patrons.cosmic || [];
        state.terrestrialPatrons = saved.patrons.terrestrial || [];
        state.trusts = saved.patrons.trusts || [];
        if (state.cosmicPatrons.length > 0 || state.terrestrialPatrons.length > 0) {
            console.log(`📦 Loaded ${state.cosmicPatrons.length} cosmic patrons, ${state.terrestrialPatrons.length} terrestrial patrons from state`);
            state.dataLoaded = true;
            return;
        }
    }
    loadRemotePatrons();
}

async function loadRemotePatrons() {
    if (state.isLoading) return;
    state.isLoading = true;
    
    try {
        console.log('📥 Loading patron data from remote...');
        
        // Try to find manifest from multiple paths
        let manifestData = null;
        let loadedFrom = null;
        
        for (const path of PATRON_MANIFEST_PATHS) {
            try {
                const res = await fetch(path);
                if (res.ok) {
                    const data = await res.json();
                    // Check if it's an array of strings or objects
                    if (Array.isArray(data)) {
                        manifestData = data;
                        loadedFrom = path;
                        console.log(`✅ Found patron manifest at ${path} (${data.length} entries)`);
                        break;
                    } else if (data && typeof data === 'object') {
                        // Could be an object with a 'patrons' key, or keys as patron IDs
                        if (data.patrons && Array.isArray(data.patrons)) {
                            manifestData = data.patrons;
                            loadedFrom = path;
                            console.log(`✅ Found patron manifest (patrons array) at ${path}`);
                            break;
                        }
                        // If it's an object where keys look like patron IDs, use them
                        const keys = Object.keys(data);
                        if (keys.length > 0 && keys.every(k => typeof k === 'string' && !k.startsWith('_'))) {
                            manifestData = keys;
                            loadedFrom = path;
                            console.log(`✅ Using object keys as patron list from ${path}`);
                            break;
                        }
                    }
                }
            } catch (e) { /* ignore */ }
        }
        
        // If we have a manifest, load each patron
        if (manifestData && Array.isArray(manifestData) && manifestData.length > 0) {
            const patrons = [];
            let loadedCount = 0;
            
            for (const entry of manifestData) {
                // Entry could be a string ID or an object with id
                let patronId = typeof entry === 'string' ? entry : (entry.id || entry.slug || entry.name);
                if (!patronId) continue;
                
                // Clean up ID: remove any path separators, lowercase, and replace spaces with dashes
                patronId = String(patronId).toLowerCase().replace(/[^a-z0-9_-]/g, '');
                
                try {
                    const res = await fetch(`${PATRON_DATA_PATH}${patronId}.json`);
                    if (res.ok) {
                        const data = await res.json();
                        if (!data.id) data.id = patronId;
                        patrons.push(data);
                        loadedCount++;
                    } else {
                        console.warn(`⚠️ Could not load patron: ${patronId} (HTTP ${res.status})`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Error loading patron ${patronId}:`, e);
                }
            }
            
            if (patrons.length > 0) {
                state.cosmicPatrons = patrons;
                state.dataLoaded = true;
                console.log(`✅ Loaded ${patrons.length} patrons from remote manifest (${loadedFrom})`);
                
                const saved = getState();
                if (!saved.patrons) saved.patrons = {};
                saved.patrons.cosmic = patrons;
                saveState();
                state.isLoading = false;
                return;
            }
        }
        
        // No manifest found or no patrons loaded from it. Try discovery by scanning known slugs.
        console.warn('No patron manifest found or loaded, attempting discovery...');
        const discovered = [];
        for (const slug of KNOWN_PATRON_SLUGS) {
            try {
                const res = await fetch(`${PATRON_DATA_PATH}${slug}.json`);
                if (res.ok) {
                    const data = await res.json();
                    if (!data.id) data.id = slug;
                    discovered.push(data);
                }
            } catch (e) { /* ignore */ }
        }
        
        if (discovered.length > 0) {
            state.cosmicPatrons = discovered;
            state.dataLoaded = true;
            console.log(`✅ Discovered ${discovered.length} patron files`);
            // Save to state and also generate manifest for future
            const saved = getState();
            if (!saved.patrons) saved.patrons = {};
            saved.patrons.cosmic = discovered;
            saveState();
            // Also try to save a manifest
            try {
                const manifestList = discovered.map(p => p.id || p.name);
                await saveManifest(manifestList);
            } catch (e) { /* ignore */ }
            state.isLoading = false;
            return;
        }
        
        // Final fallback: use defaults
        console.warn('No patrons loaded from remote, using defaults');
        loadDefaultPatrons();
    } catch (error) {
        console.warn('Failed to load remote patrons:', error);
        loadDefaultPatrons();
    } finally {
        state.isLoading = false;
    }
}

/**
 * Save a manifest file to the server (requires write access - may not work in static builds)
 * This is a best-effort attempt; if it fails, it's not critical.
 */
async function saveManifest(manifestList) {
    try {
        const res = await fetch('/api/manifest/patrons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(manifestList)
        });
        if (res.ok) {
            console.log('✅ Patron manifest saved');
        }
    } catch (e) {
        // Silently fail - manifest saving is optional
    }
}

function loadDefaultPatrons() {
    state.cosmicPatrons = [...DEFAULT_COSMIC_PATRONS];
    state.terrestrialPatrons = [...DEFAULT_TERRESTRIAL_PATRONS];
    state.trusts = [...DEFAULT_TRUSTS];
    state.dataLoaded = true;
    console.log(`📦 Using default patron data (${state.cosmicPatrons.length} cosmic, ${state.terrestrialPatrons.length} terrestrial)`);
}

function savePatronData() {
    const saved = getState();
    if (!saved.patrons) saved.patrons = {};
    saved.patrons.cosmic = state.cosmicPatrons;
    saved.patrons.terrestrial = state.terrestrialPatrons;
    saved.patrons.trusts = state.trusts;
    saveState();
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    loadPatronData();

    container.innerHTML = `
        <div class="patrons-modern-layout">
            <header class="patrons-header">
                <h1 class="patrons-title">👁️ Patrons & Resources</h1>
                <p class="patrons-subtitle">Cosmic patrons, terrestrial powers, and the assets they grant.</p>
                ${!state.dataLoaded ? '<p class="text-muted" style="font-size:0.85rem;">⏳ Loading patron data...</p>' : `<p class="text-muted" style="font-size:0.85rem;">📚 ${state.cosmicPatrons.length} cosmic patrons loaded</p>`}
            </header>

            <div class="patrons-tabs">
                <button class="patrons-tab active" data-view="cosmic">🌟 Cosmic Patrons</button>
                <button class="patrons-tab" data-view="terrestrial">🏛️ Terrestrial Patrons</button>
                <button class="patrons-tab" data-view="trusts">🤝 Player Trusts</button>
                <button class="patrons-tab" data-view="assets">📦 Assets</button>
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
        return `
            <div class="patrons-empty">
                <div style="font-size:3rem;">⏳</div>
                <div>Loading patron data...</div>
                <div class="text-muted" style="font-size:0.85rem;">Please wait</div>
            </div>
        `;
    }
    
    switch(view) {
        case 'cosmic': return renderCosmicPatrons();
        case 'terrestrial': return renderTerrestrialPatrons();
        case 'trusts': return renderTrusts();
        case 'assets': return renderAllAssets();
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

    return `
        <div class="patrons-grid cosmic-grid">
            ${state.cosmicPatrons.map(p => `
                <div class="patron-card cosmic" onclick="window.viewPatron('${p.id}')">
                    <div class="patron-card-icon">${p.icon || '🌟'}</div>
                    <div class="patron-card-name">${escHtml(p.name)}</div>
                    <div class="patron-card-domain">${escHtml(p.domain || 'Unknown')}</div>
                    <div class="patron-card-tags">
                        <span class="patron-tag">${p.rites ? p.rites.length + ' Rites' : 'No Rites'}</span>
                        ${p.rivals && p.rivals.length > 0 ? `<span class="patron-tag rival">⚔️ ${p.rivals.length} Rivals</span>` : ''}
                        ${p.source === 'default' ? '<span class="patron-tag" style="border-color:var(--text3);color:var(--text3);">📦 Default</span>' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="patrons-actions">
            <button class="btn btn-primary" onclick="window.addCosmicPatron()">➕ Add Cosmic Patron</button>
            <button class="btn btn-secondary" onclick="window.refreshPatrons()">🔄 Refresh</button>
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
                <button class="btn btn-primary" onclick="window.addTerrestrialPatron()">➕ Add Terrestrial Patron</button>
            </div>
        `;
    }

    return `
        <div class="patrons-grid terrestrial-grid">
            ${state.terrestrialPatrons.map(p => `
                <div class="patron-card terrestrial" onclick="window.viewTerrestrial('${p.id}')">
                    <div class="patron-card-type">${p.type || 'patron'}</div>
                    <div class="patron-card-name">${escHtml(p.name)}</div>
                    <div class="patron-card-tier">Tier ${p.tier || 'I'}</div>
                    <div class="patron-card-location">📍 ${escHtml(p.location || 'Unknown')}</div>
                    <div class="patron-card-tags">
                        <span class="patron-tag">${p.assetSlots || 0} Asset Slots</span>
                        <span class="patron-tag">${p.maxAssetTier || 'Minor'}</span>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="patrons-actions">
            <button class="btn btn-primary" onclick="window.addTerrestrialPatron()">➕ Add Terrestrial Patron</button>
            <button class="btn btn-secondary" onclick="window.refreshPatrons()">🔄 Refresh</button>
        </div>
    `;
}

// ============================================================
// RENDER: TRUSTS
// ============================================================

function renderTrusts() {
    if (state.trusts.length === 0) {
        return `
            <div class="patrons-empty">
                <div style="font-size:3rem;">🤝</div>
                <div>No player trusts created yet.</div>
                <button class="btn btn-primary" onclick="window.createTrust()">Create Trust</button>
            </div>
        `;
    }

    return `
        <div class="trusts-grid">
            ${state.trusts.map(t => `
                <div class="trust-card" onclick="window.viewTrust('${t.id}')">
                    <div class="trust-card-icon">${t.icon || '🤝'}</div>
                    <div class="trust-card-name">${escHtml(t.name)}</div>
                    <div class="trust-card-tier">Tier ${t.tier || 'I'}</div>
                    <div class="trust-card-stats">
                        <span>📦 ${t.assets ? t.assets.length : 0} Assets</span>
                        <span>👤 ${t.followers ? t.followers.length : 0} Followers</span>
                        <span>⚡ ${t.obligation || 0}/${t.capacity || 4} Obligation</span>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="patrons-actions">
            <button class="btn btn-primary" onclick="window.createTrust()">➕ Create Trust</button>
            <button class="btn btn-secondary" onclick="window.refreshPatrons()">🔄 Refresh</button>
        </div>
    `;
}

// ============================================================
// RENDER: ALL ASSETS
// ============================================================

function renderAllAssets() {
    const allAssets = [];
    state.trusts.forEach(t => {
        if (t.assets) {
            t.assets.forEach(a => {
                allAssets.push({
                    ...a,
                    trustName: t.name,
                    trustId: t.id
                });
            });
        }
    });

    if (allAssets.length === 0) {
        return `
            <div class="patrons-empty">
                <div style="font-size:3rem;">📦</div>
                <div>No assets found. Create a trust and add assets.</div>
                <button class="btn btn-primary" onclick="window.createTrust()">Create Trust</button>
            </div>
        `;
    }

    return `
        <div class="assets-grid">
            ${allAssets.map(a => `
                <div class="asset-card" onclick="window.viewAsset('${a.id}')">
                    <div class="asset-card-tier">${a.tier || 'Minor'}</div>
                    <div class="asset-card-name">${escHtml(a.name)}</div>
                    <div class="asset-card-type">${escHtml(a.type || 'asset')}</div>
                    <div class="asset-card-trust">🏛️ ${escHtml(a.trustName)}</div>
                    <div class="asset-card-cost">${a.cost || '?'} XP</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================
// PATRON DETAIL WITH EXPANDABLE RITES
// ============================================================

function renderPatronDetail(patronId) {
    const patron = state.cosmicPatrons.find(p => p.id === patronId);
    if (!patron) {
        showToast('Patron not found', 'error');
        return;
    }

    // Check if rites are objects (with descriptions) or just strings
    const hasDetailedRites = patron.rites && patron.rites.length > 0 && typeof patron.rites[0] === 'object';
    const ritesCount = patron.rites ? patron.rites.length : 0;

    const modal = document.getElementById('patron-modal');
    modal.style.display = 'block';
    
    let ritesHtml = '';
    if (patron.rites && patron.rites.length > 0) {
        if (hasDetailedRites) {
            // Rites are objects with descriptions - render expandable
            ritesHtml = `
                <div class="patron-detail-section">
                    <h3>🔮 Rites (${patron.rites.length})</h3>
                    <div class="rites-list">
                        ${patron.rites.map((r, idx) => {
                            const hasDesc = r.description && r.description.length > 0;
                            const isExpanded = state.expandedRites.has(`${patron.id}-${idx}`);
                            const riteId = `${patron.id}-${idx}`;
                            
                            let detailsHtml = '';
                            if (hasDesc) {
                                detailsHtml = `
                                    <div class="rite-details ${isExpanded ? 'expanded' : 'collapsed'}" 
                                         id="rite-details-${riteId}"
                                         style="${isExpanded ? '' : 'display:none;'}">
                                        ${r.description}   <!-- raw HTML -->
                                        ${r.cost ? `<div class="rite-meta"><strong>Cost:</strong> ${escHtml(r.cost)}</div>` : ''}
                                        ${r.duration ? `<div class="rite-meta"><strong>Duration:</strong> ${escHtml(r.duration)}</div>` : ''}
                                        ${r.action ? `<div class="rite-meta"><strong>Action:</strong> ${escHtml(r.action)}</div>` : ''}
                                        ${r.effect ? `<div class="rite-meta"><strong>Effect:</strong> ${r.effect}</div>` : ''}  <!-- raw HTML -->
                                        ${r.tags && r.tags.length > 0 ? `<div class="rite-tags">${r.tags.map(t => `<span class="badge badge-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
                                    </div>
                                `;
                            }
                            
                            const expandIcon = hasDesc ? (isExpanded ? '▾' : '▸') : '';
                            const expandClass = hasDesc ? 'rite-expandable' : '';
                            
                            return `
                                <div class="rite-item ${expandClass}" data-rite-id="${riteId}">
                                    <div class="rite-header" onclick="${hasDesc ? `window.toggleRite('${riteId}')` : ''}">
                                        <span class="rite-name">${escHtml(r.name)}</span>
                                        ${r.tier ? `<span class="rite-tier">${escHtml(r.tier)}</span>` : ''}
                                        ${hasDesc ? `<span class="rite-expand-icon">${expandIcon}</span>` : ''}
                                    </div>
                                    ${detailsHtml}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            // Rites are just strings - simple list
            ritesHtml = `
                <div class="patron-detail-section">
                    <h3>🔮 Rites (${patron.rites.length})</h3>
                    <ul>
                        ${patron.rites.map(r => `<li>${escHtml(r)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    }

    modal.innerHTML = `
        <div class="modal-content patron-detail" style="width: 90%; max-width: 1200px; max-height: 90vh; overflow-y: auto;">
            <button class="modal-close" onclick="window.closePatronModal()">✕</button>
            <div class="patron-detail-header">
                <div class="patron-detail-icon">${patron.icon || '🌟'}</div>
                <div>
                    <h2>${escHtml(patron.name)}</h2>
                    <div class="patron-detail-domain">${escHtml(patron.domain || 'Unknown Domain')}</div>
                    ${patron.source === 'default' ? '<span class="badge badge-remote" style="font-size:0.7rem;">📦 Default Data</span>' : ''}
                    ${hasDetailedRites ? `<span class="badge badge-rites" style="font-size:0.7rem;background:var(--gold);color:var(--bg);">${ritesCount} Rites</span>` : ''}
                </div>
            </div>
            
            <div class="patron-detail-body">
                <div class="patron-detail-section">
                    <h3>📖 Description</h3>
                    <p>${patron.description || 'No description available.'}</p>   <!-- raw HTML -->
                </div>
                
                ${patron.lore ? `
                <div class="patron-detail-section">
                    <h3>📚 Lore</h3>
                    <p style="white-space:pre-wrap;">${patron.lore}</p>   <!-- raw HTML -->
                </div>
                ` : ''}
                
                ${ritesHtml}
                
                ${patron.rivals && patron.rivals.length > 0 ? `
                <div class="patron-detail-section">
                    <h3>⚔️ Rivals</h3>
                    <ul>
                        ${patron.rivals.map(r => `<li>${escHtml(r)}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                
                <div class="patron-detail-section">
                    <h3>🏷️ Sigil</h3>
                    <p><em>${escHtml(patron.sigil || 'Unknown')}</em></p>
                </div>
                
                ${patron.corruption ? `
                <div class="patron-detail-section">
                    <h3>⚠️ Corruption</h3>
                    <p>${patron.corruption}</p>   <!-- raw HTML -->
                </div>
                ` : ''}
                
                ${patron.whispered ? `
                <div class="patron-detail-section">
                    <h3>🌙 Whispered in Taverns</h3>
                    <p><em>"${patron.whispered}"</em></p>   <!-- raw HTML -->
                </div>
                ` : ''}
                
                ${patron.cult ? `
                <div class="patron-detail-section">
                    <h3>🕯️ Cult: ${escHtml(patron.cult.name || 'Followers')}</h3>
                    <p>${patron.cult.description || ''}</p>   <!-- raw HTML -->
                </div>
                ` : ''}
                
                ${patron.gift ? `
                <div class="patron-detail-section">
                    <h3>🎁 Patron's Gift</h3>
                    <p><strong>${escHtml(patron.gift.name || 'Gift')}</strong></p>
                    <p>${patron.gift.description || ''}</p>   <!-- raw HTML -->
                    ${patron.gift.cost ? `<p class="text-muted" style="font-size:0.85rem;">Cost: ${escHtml(patron.gift.cost)}</p>` : ''}
                </div>
                ` : ''}
            </div>
            
            <div class="patron-detail-actions" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:1rem;padding-top:0.5rem;border-top:1px solid var(--border);">
                <button class="btn btn-sm" onclick="window.editPatron('${patron.id}')" style="padding:0.3rem 0.8rem;font-size:0.8rem;">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="window.deletePatron('${patron.id}')" style="padding:0.3rem 0.8rem;font-size:0.8rem;">🗑️ Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()" style="padding:0.3rem 0.8rem;font-size:0.8rem;">Close</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePatronModal();
    });
}

// ============================================================
// RITE TOGGLE
// ============================================================

window.toggleRite = function(riteId) {
    const details = document.getElementById(`rite-details-${riteId}`);
    if (!details) return;
    
    const isExpanded = details.style.display !== 'none';
    details.style.display = isExpanded ? 'none' : 'block';
    
    // Update the expand icon
    const item = details.closest('.rite-item');
    if (item) {
        const icon = item.querySelector('.rite-expand-icon');
        if (icon) {
            icon.textContent = isExpanded ? '▸' : '▾';
        }
    }
    
    // Track expanded state
    if (isExpanded) {
        state.expandedRites.delete(riteId);
    } else {
        state.expandedRites.add(riteId);
    }
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

window.viewTerrestrial = function(id) {
    // Placeholder: render terrestrial detail similarly
    const patron = state.terrestrialPatrons.find(p => p.id === id);
    if (!patron) {
        showToast('Terrestrial patron not found', 'error');
        return;
    }
    const modal = document.getElementById('patron-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content patron-detail" style="width: 80%; max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <button class="modal-close" onclick="window.closePatronModal()">✕</button>
            <div class="patron-detail-header">
                <div class="patron-detail-icon">🏛️</div>
                <div>
                    <h2>${escHtml(patron.name)}</h2>
                    <div class="patron-detail-domain">${escHtml(patron.type || 'Terrestrial Patron')}</div>
                    <div class="patron-detail-domain">Tier ${escHtml(patron.tier || 'I')}</div>
                </div>
            </div>
            <div class="patron-detail-body">
                <div class="patron-detail-section">
                    <h3>📖 Description</h3>
                    <p>${patron.description || 'No description available.'}</p>
                </div>
                ${patron.location ? `<div class="patron-detail-section"><h3>📍 Location</h3><p>${escHtml(patron.location)}</p></div>` : ''}
                ${patron.leverage ? `<div class="patron-detail-section"><h3>💰 Leverage</h3><p>${patron.leverage}</p></div>` : ''}
                ${patron.debtTrigger ? `<div class="patron-detail-section"><h3>⚡ Debt Trigger</h3><p>${patron.debtTrigger}</p></div>` : ''}
                ${patron.quirk ? `<div class="patron-detail-section"><h3>🌀 Quirk</h3><p>${patron.quirk}</p></div>` : ''}
                <div class="patron-detail-section">
                    <h3>📊 Stats</h3>
                    <ul>
                        <li>Asset Slots: ${patron.assetSlots || 0}</li>
                        <li>Max Asset Tier: ${patron.maxAssetTier || 'Minor'}</li>
                    </ul>
                </div>
            </div>
            <div class="patron-detail-actions">
                <button class="btn btn-sm" onclick="window.editTerrestrial('${patron.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteTerrestrial('${patron.id}')">🗑️ Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()">Close</button>
            </div>
        </div>
    `;
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
        <div class="modal-content patron-detail" style="width: 80%; max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <button class="modal-close" onclick="window.closePatronModal()">✕</button>
            <div class="patron-detail-header">
                <div class="patron-detail-icon">${trust.icon || '🤝'}</div>
                <div>
                    <h2>${escHtml(trust.name)}</h2>
                    <div class="patron-detail-domain">Trust · Tier ${trust.tier || 'I'}</div>
                </div>
            </div>
            <div class="patron-detail-body">
                <div class="patron-detail-section">
                    <h3>📖 Description</h3>
                    <p>${trust.description || 'No description available.'}</p>
                </div>
                <div class="patron-detail-section">
                    <h3>📊 Stats</h3>
                    <ul>
                        <li>Max Assets: ${trust.maxAssets || 2}</li>
                        <li>Max Asset Tier: ${trust.maxAssetTier || 'Standard'}</li>
                        <li>Obligation: ${trust.obligation || 0}/${trust.capacity || 4}</li>
                    </ul>
                </div>
                ${trust.assets && trust.assets.length > 0 ? `
                <div class="patron-detail-section">
                    <h3>📦 Assets (${trust.assets.length})</h3>
                    <ul>
                        ${trust.assets.map(a => `<li>${escHtml(a.name)} (${escHtml(a.tier || 'Minor')})</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                ${trust.followers && trust.followers.length > 0 ? `
                <div class="patron-detail-section">
                    <h3>👤 Followers (${trust.followers.length})</h3>
                    <ul>
                        ${trust.followers.map(f => `<li>${escHtml(f.name)} (Cap ${f.cap})</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
            <div class="patron-detail-actions">
                <button class="btn btn-sm" onclick="window.editTrust('${trust.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-primary" onclick="window.addAssetToTrust('${trust.id}')">➕ Add Asset</button>
                <button class="btn btn-sm btn-primary" onclick="window.addFollowerToTrust('${trust.id}')">➕ Add Follower</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteTrust('${trust.id}')">🗑️ Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()">Close</button>
            </div>
        </div>
    `;
};

window.viewAsset = function(id) {
    let found = null;
    let trust = null;
    for (const t of state.trusts) {
        if (t.assets) {
            const a = t.assets.find(asset => asset.id === id);
            if (a) {
                found = a;
                trust = t;
                break;
            }
        }
    }
    if (!found || !trust) {
        showToast('Asset not found', 'error');
        return;
    }
    const modal = document.getElementById('asset-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content patron-detail" style="width: 70%; max-width: 600px;">
            <button class="modal-close" onclick="window.closeAssetModal()">✕</button>
            <div class="patron-detail-header">
                <div class="patron-detail-icon">📦</div>
                <div>
                    <h2>${escHtml(found.name)}</h2>
                    <div class="patron-detail-domain">${escHtml(found.type || 'Asset')} · ${escHtml(found.tier || 'Minor')}</div>
                    <div class="patron-detail-domain">🏛️ ${escHtml(trust.name)}</div>
                </div>
            </div>
            <div class="patron-detail-body">
                <div class="patron-detail-section">
                    <h3>📖 Description</h3>
                    <p>${found.description || 'No description available.'}</p>
                </div>
                <div class="patron-detail-section">
                    <h3>💰 Cost</h3>
                    <p>${found.cost || '?'} XP</p>
                </div>
                ${found.freeUse ? `<div class="patron-detail-section"><h3>✨ Free Use</h3><p>${found.freeUse}</p></div>` : ''}
                ${found.sceneSurge ? `<div class="patron-detail-section"><h3>⚡ Scene Surge</h3><p>${found.sceneSurge}</p></div>` : ''}
            </div>
            <div class="patron-detail-actions">
                <button class="btn btn-sm" onclick="window.editAsset('${found.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteAsset('${found.id}')">🗑️ Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="window.closeAssetModal()">Close</button>
            </div>
        </div>
    `;
};

window.loadDefaultPatrons = function() {
    loadDefaultPatrons();
    refreshView();
    showToast('Loaded default patrons', 'success');
};

// ============================================================
// CRUD OPERATIONS - COSMIC PATRONS
// ============================================================

window.addCosmicPatron = function() {
    const name = prompt('Enter patron name:');
    if (!name) return;
    const domain = prompt('Enter patron domain:') || 'Unknown';
    const icon = prompt('Enter patron icon (emoji):') || '🌟';

    state.cosmicPatrons.push({
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
    });
    savePatronData();
    refreshView();
    showToast(`Added patron: ${name}`, 'success');
};

window.editPatron = function(id) {
    const patron = state.cosmicPatrons.find(p => p.id === id);
    if (!patron) return;
    const name = prompt('Enter patron name:', patron.name);
    if (!name) return;
    patron.name = name;
    patron.domain = prompt('Enter patron domain:', patron.domain) || patron.domain;
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
    if (!confirm(`Delete patron "${patron.name}"?`)) return;
    state.cosmicPatrons = state.cosmicPatrons.filter(p => p.id !== id);
    savePatronData();
    refreshView();
    closePatronModal();
    showToast(`Deleted patron: ${patron.name}`, 'info');
};

// ============================================================
// CRUD OPERATIONS - TERRESTRIAL PATRONS
// ============================================================

window.addTerrestrialPatron = function() {
    const name = prompt('Enter terrestrial patron name:');
    if (!name) return;

    state.terrestrialPatrons.push({
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
        source: 'local'
    });
    savePatronData();
    refreshView();
    showToast(`Added terrestrial patron: ${name}`, 'success');
};

window.editTerrestrial = function(id) {
    const patron = state.terrestrialPatrons.find(p => p.id === id);
    if (!patron) return;
    const name = prompt('Enter name:', patron.name);
    if (!name) return;
    patron.name = name;
    patron.type = prompt('Enter type:', patron.type) || patron.type;
    patron.tier = prompt('Enter tier:', patron.tier) || patron.tier;
    patron.description = prompt('Enter description:', patron.description) || patron.description;
    patron.location = prompt('Enter location:', patron.location) || patron.location;
    patron.leverage = prompt('Enter leverage:', patron.leverage) || patron.leverage;
    patron.debtTrigger = prompt('Enter debt trigger:', patron.debtTrigger) || patron.debtTrigger;
    patron.quirk = prompt('Enter quirk:', patron.quirk) || patron.quirk;
    patron.assetSlots = parseInt(prompt('Enter asset slots:', patron.assetSlots) || '2');
    patron.maxAssetTier = prompt('Enter max asset tier:', patron.maxAssetTier) || patron.maxAssetTier;
    patron.source = 'local';
    savePatronData();
    refreshView();
    closePatronModal();
    showToast(`Updated terrestrial patron: ${name}`, 'success');
};

window.deleteTerrestrial = function(id) {
    const patron = state.terrestrialPatrons.find(p => p.id === id);
    if (!patron) return;
    if (!confirm(`Delete terrestrial patron "${patron.name}"?`)) return;
    state.terrestrialPatrons = state.terrestrialPatrons.filter(p => p.id !== id);
    savePatronData();
    refreshView();
    closePatronModal();
    showToast(`Deleted terrestrial patron: ${patron.name}`, 'info');
};

// ============================================================
// CRUD OPERATIONS - TRUSTS
// ============================================================

window.createTrust = function() {
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
        capacity: parseInt(prompt('Enter obligation capacity (Spirit+Presence):') || '4'),
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
    if (!confirm(`Delete trust "${trust.name}"? This will delete all assets and followers in it.`)) return;
    state.trusts = state.trusts.filter(t => t.id !== id);
    savePatronData();
    refreshView();
    closePatronModal();
    showToast(`Deleted trust: ${trust.name}`, 'info');
};

// ============================================================
// CRUD OPERATIONS - ASSETS & FOLLOWERS IN TRUSTS
// ============================================================

window.addAssetToTrust = function(trustId) {
    const trust = state.trusts.find(t => t.id === trustId);
    if (!trust) return;

    if (!trust.assets) trust.assets = [];

    const name = prompt('Enter asset name:');
    if (!name) return;

    trust.assets.push({
        id: 'asset-' + Date.now(),
        name,
        type: prompt('Enter asset type (safehouse/network/library/workshop/contract/etc.):') || 'asset',
        tier: prompt('Enter tier (Minor/Standard/Major):') || 'Minor',
        description: prompt('Enter description:') || 'An asset of the trust.',
        cost: parseInt(prompt('Enter XP cost:') || '4'),
        freeUse: prompt('Enter Free Use benefit (once/session):') || 'None',
        sceneSurge: prompt('Enter Scene Surge benefit (1 Boon):') || 'None'
    });

    if (trust.assets.length > (trust.maxAssets || 2)) {
        showToast(`Warning: Trust now has ${trust.assets.length} assets, exceeding its capacity of ${trust.maxAssets || 2}.`, 'warning');
    }

    savePatronData();
    refreshView();
    closePatronModal();
    showToast(`Added asset: ${name} to ${trust.name}`, 'success');
};

window.addFollowerToTrust = function(trustId) {
    const trust = state.trusts.find(t => t.id === trustId);
    if (!trust) return;

    if (!trust.followers) trust.followers = [];

    const name = prompt('Enter follower name:');
    if (!name) return;

    trust.followers.push({
        id: 'follower-' + Date.now(),
        name,
        role: prompt('Enter role:') || 'Follower',
        cap: parseInt(prompt('Enter Cap (1-5):') || '1'),
        description: prompt('Enter description:') || 'A follower of the trust.',
        loyalty: prompt('Enter loyalty (Faithful/Strained/Broken):') || 'Faithful',
        fitness: prompt('Enter fitness (Ready/Hurt/Down):') || 'Ready'
    });

    savePatronData();
    refreshView();
    closePatronModal();
    showToast(`Added follower: ${name} to ${trust.name}`, 'success');
};

window.editAsset = function(id) {
    let found = null;
    let trust = null;
    for (const t of state.trusts) {
        if (t.assets) {
            const a = t.assets.find(asset => asset.id === id);
            if (a) {
                found = a;
                trust = t;
                break;
            }
        }
    }
    if (!found || !trust) {
        showToast('Asset not found', 'error');
        return;
    }

    const name = prompt('Enter asset name:', found.name);
    if (!name) return;
    found.name = name;
    found.type = prompt('Enter type:', found.type) || found.type;
    found.tier = prompt('Enter tier:', found.tier) || found.tier;
    found.description = prompt('Enter description:', found.description) || found.description;
    found.cost = parseInt(prompt('Enter XP cost:', found.cost) || '4');
    savePatronData();
    refreshView();
    closeAssetModal();
    showToast(`Updated asset: ${name}`, 'success');
};

window.deleteAsset = function(id) {
    let found = null;
    let trust = null;
    for (const t of state.trusts) {
        if (t.assets) {
            const a = t.assets.find(asset => asset.id === id);
            if (a) {
                found = a;
                trust = t;
                break;
            }
        }
    }
    if (!found || !trust) {
        showToast('Asset not found', 'error');
        return;
    }
    if (!confirm(`Delete asset "${found.name}" from ${trust.name}?`)) return;
    trust.assets = trust.assets.filter(a => a.id !== id);
    savePatronData();
    refreshView();
    closeAssetModal();
    showToast(`Deleted asset: ${found.name}`, 'info');
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
    savePatronData
};