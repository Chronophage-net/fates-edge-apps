// features/factions/index.js
/**
 * Factions & Assets Feature
 * Combines faction management with assets, followers, and trusts
 *
 * Data path:
 * - Faction data: ./data/factions/{id}.json
 * - All data is discovered without a manifest.json – we test known slugs.
 *
 * NOTE: No pop-up modals or browser prompt()/confirm() dialogs are used here.
 * Viewing, adding, and editing all happen as inline full views within the
 * tab content area (swap-in "screens"), consistent with the rest of the app.
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

// ============================================================
// CONSTANTS
// ============================================================

const FACTION_DATA_PATH = './data/factions/';

// Known faction slugs – extend as needed
const KNOWN_FACTION_SLUGS = [
    'velvet-court',
    'iron-league',
    'gray-ash',
    'ecktorian-censorate',
    'bloody-fist',
    'house-contarini',
    'the-silver-fang',
    'crimson-rose-syndicate',
    'order-of-the-iron-covenant',
    'whispering-net',
    'ashen-syndicate',
    'the-velvet-coin'
];

const FACTION_STANDINGS = {
    '-3': { label: 'Enemy', color: '#c45a5a', icon: '💀', desc: 'Actively works against the party' },
    '-2': { label: 'Hostile', color: '#d97a7a', icon: '⚔️', desc: 'Openly opposes the party' },
    '-1': { label: 'Unfriendly', color: '#e8a07a', icon: '👎', desc: 'Distrustful and difficult' },
    '0': { label: 'Neutral', color: '#a8a4b8', icon: '➖', desc: 'Indifferent' },
    '1': { label: 'Friendly', color: '#8ac49a', icon: '👍', desc: 'Generally helpful' },
    '2': { label: 'Supportive', color: '#6baa7a', icon: '🤝', desc: 'Actively aids the party' },
    '3': { label: 'Ally', color: '#4a8a5a', icon: '💚', desc: 'Will sacrifice for the party' }
};

const ASSET_STATUS = {
    maintained: { label: 'Maintained', color: '#6baa7a', icon: '✅' },
    neglected: { label: 'Neglected', color: '#e8c84a', icon: '⚠️' },
    compromised: { label: 'Compromised', color: '#c45a5a', icon: '❌' }
};

const FOLLOWER_STATES = {
    loyalty: {
        faithful: { label: 'Faithful', color: '#6baa7a', icon: '💚' },
        strained: { label: 'Strained', color: '#e8c84a', icon: '⚠️' },
        broken: { label: 'Broken', color: '#c45a5a', icon: '💔' }
    },
    fitness: {
        ready: { label: 'Ready', color: '#6baa7a', icon: '✅' },
        hurt: { label: 'Hurt', color: '#e8c84a', icon: '🩹' },
        down: { label: 'Down', color: '#c45a5a', icon: '❌' }
    }
};

// ============================================================
// DISCOVERY CACHE
// ============================================================

const CACHE_KEY = 'fates-edge-factions-cache';
const CACHE_TTL = 3600000; // 1 hour

/**
 * Discover available faction files by testing each known slug.
 * Results are cached in localStorage for 1 hour.
 */
async function discoverFactions() {
    // Check cache first
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp < CACHE_TTL) {
                console.log(`[Factions] Using cached list (${data.slugs.length} factions)`);
                return data.slugs;
            }
        }
    } catch (_) {}

    console.log('[Factions] Discovering available factions...');
    const found = [];

    // Test each slug with HEAD request
    await Promise.all(KNOWN_FACTION_SLUGS.map(async (slug) => {
        try {
            const res = await fetch(`${FACTION_DATA_PATH}${slug}.json`, { method: 'HEAD' });
            if (res.ok) {
                found.push(slug);
            }
        } catch (_) { /* ignore */ }
    }));

    // Sort for consistency
    found.sort();

    // Cache the result
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            slugs: found,
            timestamp: Date.now()
        }));
    } catch (_) {}

    console.log(`[Factions] Found ${found.length} factions`);
    return found;
}

// ============================================================
// DEFAULT DATA
// ============================================================

const DEFAULT_FACTIONS = [
    {
        id: 'velvet-court',
        name: 'The Velvet Court',
        standing: 0,
        agenda: 'Control Silkstrand\'s underworld',
        agendaTimer: { segments: 6, current: 0 },
        keyNPCs: ['Madam Serafine', 'Old Kes', 'Sister Agatha'],
        resources: 'Information network, forgery, laundering',
        hooks: ['A rival faction is moving into the Dye District'],
        color: '#8b6bb5',
        icon: '🎭',
        source: 'default'
    },
    {
        id: 'iron-league',
        name: 'The Iron League',
        standing: 0,
        agenda: 'Consolidate mercenary contracts',
        agendaTimer: { segments: 8, current: 2 },
        keyNPCs: ['The Black Colonel', 'Captain Rusk'],
        resources: 'Mercenary companies, military intelligence',
        hooks: ['Payday is late - morale is dropping'],
        color: '#c45a5a',
        icon: '⚔️',
        source: 'default'
    },
    {
        id: 'gray-ash',
        name: 'Gray Ash Ykrul',
        standing: 1,
        agenda: 'Secure winter grazing lands',
        agendaTimer: { segments: 6, current: 0 },
        keyNPCs: ['Khatun Sarnai', 'Yelü'],
        resources: 'Steppe riders, remounts, steppe knowledge',
        hooks: ['A white squall is coming'],
        color: '#5a8ab5',
        icon: '🐺',
        source: 'default'
    },
    {
        id: 'ecktorian-censorate',
        name: 'Ecktorian Censorate',
        standing: -1,
        agenda: 'Root out heresy and illegal magic',
        agendaTimer: { segments: 10, current: 4 },
        keyNPCs: ['Censor Cassia', 'Prefect Marcellus'],
        resources: 'Legal authority, archive access, witch-hunters',
        hooks: ['They are investigating the party\'s activities'],
        color: '#d48a5a',
        icon: '⚖️',
        source: 'default'
    },
    {
        id: 'bloody-fist',
        name: 'The Bloody Fist Company',
        standing: 0,
        agenda: 'Secure profitable contracts and expand influence',
        agendaTimer: { segments: 6, current: 1 },
        keyNPCs: ['Captain Rusk', 'The Veteran Sergeant'],
        resources: 'Soldiers, siege equipment, camp followers',
        hooks: ['A contract dispute is brewing', 'Payday is late'],
        color: '#8b0000',
        icon: '✊',
        source: 'default'
    },
    {
        id: 'house-contarini',
        name: 'House Contarini (Vilikari)',
        standing: 1,
        agenda: 'Expand trade routes into Acasia',
        agendaTimer: { segments: 8, current: 3 },
        keyNPCs: ['Tema', 'Factor Voss'],
        resources: 'Trade network, legal influence, grain',
        hooks: ['A rival house is undercutting their prices'],
        color: '#2980b9',
        icon: '🏛️',
        source: 'default'
    }
];

const DEFAULT_ASSETS = [
    {
        id: 'safehouse-dye-district',
        name: 'Safehouse: Dye District',
        type: 'safehouse',
        tier: 'Minor',
        description: 'A converted spice warehouse near the Dye Yards. Hidden compartments, false walls, and a landlord who never saw you.',
        cost: 4,
        status: 'maintained',
        freeUse: 'Start an entry/exit scene Dominant',
        sceneSurge: 'Produce a hidden egress; convert one pursuit consequence into a temporary complication',
        source: 'default'
    },
    {
        id: 'informant-network-docks',
        name: 'Informant Network: Docks',
        type: 'network',
        tier: 'Minor',
        description: 'Eyes and ears on the waterfront. Porters, lamplighters, and urchins who watch for coin and gossip.',
        cost: 4,
        status: 'maintained',
        freeUse: 'Targeted inquiry begins Dominant',
        sceneSurge: 'Reveal a hidden schedule or route; mitigate 1 SB from ambush/surprise',
        source: 'default'
    },
    {
        id: 'mercenary-contract',
        name: 'Mercenary Contract (Cap 2)',
        type: 'contract',
        tier: 'Standard',
        description: 'A small trained unit of mercenaries. Loyal to coin, but reliable.',
        cost: 8,
        status: 'maintained',
        freeUse: 'Introduce temporary off-screen security that downgrades "raid" to "attempted raid"',
        sceneSurge: 'One on-screen intervention that improves Position for a withdrawal or breach',
        source: 'default'
    },
    {
        id: 'healing-house',
        name: 'Healing House',
        type: 'infrastructure',
        tier: 'Standard',
        description: 'Beds, herbs, and a healer who asks few questions. A place to recover from injuries.',
        cost: 8,
        status: 'neglected',
        freeUse: 'During downtime, clear Harm 1 or Fatigue 2 from one ally',
        sceneSurge: 'Stabilize now; convert a Severe injury consequence into a 4-segment Recovery timer',
        source: 'default'
    }
];

const DEFAULT_FOLLOWERS = [
    {
        id: 'pip-the-locksmith',
        name: '"Pip" the Locksmith\'s Apprentice',
        role: 'Infiltrator',
        cap: 1,
        description: 'A young locksmith with nimble fingers and a nervous laugh. Knows the Dye District like the back of his hand. Owes you for saving him from a press gang.',
        loyalty: 'faithful',
        fitness: 'ready',
        source: 'default'
    },
    {
        id: 'quick-lena',
        name: '"Quick" Lena',
        role: 'Informant / Thief',
        cap: 2,
        description: 'A Sidhi rogue with mismatched eyes and a nervous laugh. Owes a debt to a Sidhi smuggler named Peyton. Has a soft spot for urchins.',
        loyalty: 'strained',
        fitness: 'ready',
        source: 'default'
    },
    {
        id: 'tomas-the-guard',
        name: 'Tomas the Guard',
        role: 'Watchman',
        cap: 1,
        description: 'A night watchman who looks the other way for a price. His wife is sick and he needs the coin.',
        loyalty: 'faithful',
        fitness: 'ready',
        source: 'default'
    }
];

const DEFAULT_TRUSTS = [
    {
        id: 'velvet-coin-trust',
        name: 'The Silk Coin',
        icon: '🪙',
        tier: 'I',
        description: 'A thieves\' guild operating in the shadows of Silkstrand. Founded by exiles from the Silk Coin, now a legitimate (and illegitimate) organization with hands in smuggling, information, and the occasional heist.',
        maxAssets: 2,
        maxAssetTier: 'Standard',
        assets: ['safehouse-dye-district', 'informant-network-docks'],
        followers: ['quick-lena', 'pip-the-locksmith'],
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
    factions: [],
    assets: [],
    followers: [],
    trusts: [],
    viewMode: 'factions',
    isLoading: false,
    dataLoaded: false,
    usingFallback: false,
    // Screen stack: null = list view. Otherwise { screen: 'view'|'edit'|'add', kind: 'faction'|'asset'|'follower'|'trust', id }
    screen: null
};

// ============================================================
// LOAD DATA
// ============================================================

export function loadFactionData() {
    const saved = getState();
    if (saved.factions) {
        state.factions = saved.factions.factions || [];
        state.assets = saved.factions.assets || [];
        state.followers = saved.factions.followers || [];
        state.trusts = saved.factions.trusts || [];

        if (state.factions.length > 0 || state.assets.length > 0) {
            console.log(`📦 Loaded from state: ${state.factions.length} factions, ${state.assets.length} assets, ${state.followers.length} followers, ${state.trusts.length} trusts`);
            state.dataLoaded = true;
            state.usingFallback = false;
            return;
        }
    }

    loadRemoteFactions();
}

async function loadRemoteFactions() {
    if (state.isLoading) return;
    state.isLoading = true;

    try {
        // Discover available faction slugs
        const slugs = await discoverFactions();

        let factions = [];

        if (slugs.length > 0) {
            for (const slug of slugs) {
                try {
                    const res = await fetch(`${FACTION_DATA_PATH}${slug}.json`);
                    if (res.ok) {
                        const data = await res.json();
                        if (!data.id) data.id = slug;
                        factions.push(data);
                        console.log(`✅ Loaded faction: ${data.name || slug}`);
                    } else {
                        console.warn(`⚠️ Could not load faction: ${slug} (HTTP ${res.status})`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Error loading faction ${slug}:`, e);
                }
            }
        }

        // If no factions loaded, use defaults
        if (factions.length === 0) {
            console.warn('📥 No factions discovered. Using defaults.');
            state.usingFallback = true;
            loadDefaultFactions();
            showToast('⚠️ No faction files found. Using default factions.', 'warning');
        } else {
            state.factions = factions;
            state.dataLoaded = true;
            state.usingFallback = false;
        }

        // Save to global state
        const saved = getState();
        if (!saved.factions) saved.factions = {};
        saved.factions.factions = state.factions;
        saved.factions.assets = state.assets;
        saved.factions.followers = state.followers;
        saved.factions.trusts = state.trusts;
        saveState();

    } catch (error) {
        console.warn('Failed to load remote factions:', error);
        state.usingFallback = true;
        loadDefaultFactions();
        showToast('⚠️ Error loading factions. Using defaults.', 'error');
    } finally {
        state.isLoading = false;
    }
}

function loadDefaultFactions() {
    state.factions = [...DEFAULT_FACTIONS];
    state.assets = [...DEFAULT_ASSETS];
    state.followers = [...DEFAULT_FOLLOWERS];
    state.trusts = [...DEFAULT_TRUSTS];
    state.dataLoaded = true;
    state.usingFallback = true;
    console.log(`📦 Using default faction data (${state.factions.length} factions, ${state.assets.length} assets, ${state.followers.length} followers, ${state.trusts.length} trusts)`);
}

function saveFactionData() {
    const saved = getState();
    if (!saved.factions) saved.factions = {};
    saved.factions.factions = state.factions;
    saved.factions.assets = state.assets;
    saved.factions.followers = state.followers;
    saved.factions.trusts = state.trusts;
    saveState();
}

// ============================================================
// RENDER: SHELL
// ============================================================

export function render(el) {
    container = el;
    loadFactionData();
    state.screen = null;
    renderShell();
}

function renderShell() {
    const usingFallback = state.usingFallback;

    container.innerHTML = `
        <div class="factions-modern-layout">
            <header class="factions-header">
                <h1 class="factions-title">🏛️ Factions & Assets</h1>
                <p class="factions-subtitle">Manage factions, assets, followers, and trusts.</p>
                ${!state.dataLoaded ? '<p class="text-muted" style="font-size:0.85rem;">⏳ Loading faction data...</p>' :
                  `<p class="text-muted" style="font-size:0.85rem;">📚 ${state.factions.length} factions, ${state.assets.length} assets, ${state.followers.length} followers</p>`}
                ${usingFallback ? `<div style="color:var(--warn);font-size:0.85rem;margin-top:0.3rem;">⚠️ No faction files found – using fallback defaults.</div>` : ''}
            </header>

            <div class="factions-tabs">
                <button class="factions-tab active" data-view="factions">🏛️ Factions</button>
                <button class="factions-tab" data-view="assets">📦 Assets</button>
                <button class="factions-tab" data-view="followers">👤 Followers</button>
                <button class="factions-tab" data-view="trusts">🤝 Trusts</button>
            </div>

            <div id="factions-view-container" class="factions-view-container">
                ${renderScreen()}
            </div>
        </div>
    `;

    attachEvents();
}

function refreshView() {
    const el = document.getElementById('factions-view-container');
    if (el) {
        el.innerHTML = renderScreen();
    }
    attachEvents();
}

// Routes to either the tab list view or an inline detail/edit/add screen.
function renderScreen() {
    if (state.screen) {
        switch (state.screen.mode) {
            case 'view': return renderDetailScreen(state.screen.kind, state.screen.id);
            case 'edit': return renderFormScreen(state.screen.kind, state.screen.id);
            case 'add': return renderFormScreen(state.screen.kind, null);
        }
    }
    return renderListView(state.viewMode);
}

function renderListView(view) {
    state.viewMode = view;
    if (!state.dataLoaded) {
        return `
            <div class="factions-empty">
                <div style="font-size:3rem;">⏳</div>
                <div>Loading faction data...</div>
                <div class="text-muted" style="font-size:0.85rem;">Please wait</div>
            </div>
        `;
    }

    switch (view) {
        case 'factions': return renderFactions();
        case 'assets': return renderAssets();
        case 'followers': return renderFollowers();
        case 'trusts': return renderTrusts();
        default: return renderFactions();
    }
}

function goTo(mode, kind, id) {
    state.screen = mode ? { mode, kind, id } : null;
    refreshView();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// ============================================================
// RENDER: FACTIONS
// ============================================================

function renderFactions() {
    if (state.factions.length === 0) {
        return `
            <div class="factions-empty">
                <div style="font-size:3rem;">🏛️</div>
                <div>No factions tracked yet.</div>
                <button class="btn btn-primary" onclick="window.addFaction()">➕ Add Faction</button>
                <button class="btn btn-secondary" onclick="window.loadDefaultFactions()">📥 Load Defaults</button>
            </div>
        `;
    }

    const standings = state.factions.map(f => f.standing);
    const avgStanding = standings.length > 0 ? standings.reduce((a, b) => a + b, 0) / standings.length : 0;
    const mandate = Math.min(6, Math.max(0, Math.round(avgStanding + 3)));
    const crisis = Math.min(6, Math.max(0, Math.round(6 - mandate + (standings.filter(s => s < 0).length * 0.5))));

    return `
        <div class="factions-summary">
            <div class="summary-card">
                <span class="summary-icon">📈</span>
                <span class="summary-label">Mandate</span>
                <span class="summary-value">${mandate}/6</span>
                <div class="summary-bar">
                    <div class="summary-bar-fill" style="width:${(mandate/6)*100}%;background:var(--green);"></div>
                </div>
            </div>
            <div class="summary-card">
                <span class="summary-icon">⚠️</span>
                <span class="summary-label">Crisis</span>
                <span class="summary-value">${crisis}/6</span>
                <div class="summary-bar">
                    <div class="summary-bar-fill" style="width:${(crisis/6)*100}%;background:var(--red);"></div>
                </div>
            </div>
            <div class="summary-card">
                <span class="summary-icon">🏛️</span>
                <span class="summary-label">Factions</span>
                <span class="summary-value">${state.factions.length}</span>
                <div class="summary-bar"><div class="summary-bar-fill" style="width:100%;background:var(--gold);"></div></div>
            </div>
        </div>

        <div class="factions-grid">
            ${state.factions.map(f => {
                const standing = FACTION_STANDINGS[String(f.standing)] || FACTION_STANDINGS['0'];
                return `
                    <div class="faction-card" onclick="window.viewFaction('${f.id}')" style="border-top:3px solid ${f.color || 'var(--gold)'};">
                        <div class="faction-card-header">
                            <span class="faction-icon">${f.icon || '🏛️'}</span>
                            <span class="faction-name">${escHtml(f.name)}</span>
                            <span class="faction-standing" style="color:${standing.color};">
                                ${standing.icon} ${standing.label}
                            </span>
                        </div>
                        <div class="faction-agenda">
                            <span class="agenda-label">Agenda:</span>
                            <span class="agenda-text">${escHtml(f.agenda || 'None')}</span>
                        </div>
                        <div class="faction-timer">
                            <span>⏱️ Timer: ${f.agendaTimer?.current || 0}/${f.agendaTimer?.segments || 6}</span>
                            <div class="timer-bar">
                                <div class="timer-bar-fill" style="width:${((f.agendaTimer?.current || 0) / (f.agendaTimer?.segments || 6)) * 100}%;"></div>
                            </div>
                        </div>
                        <div class="faction-hooks">
                            ${(f.hooks || []).slice(0, 2).map(h => `
                                <span class="hook-tag">🔗 ${escHtml(h)}</span>
                            `).join('')}
                            ${(f.hooks || []).length > 2 ? `<span class="hook-tag">+${f.hooks.length - 2}</span>` : ''}
                        </div>
                        ${f.source === 'default' || state.usingFallback ? '<span class="badge badge-remote" style="font-size:0.6rem;">📦 Default</span>' : ''}
                    </div>
                `;
            }).join('')}
        </div>

        <div class="factions-actions">
            <button class="btn btn-primary" onclick="window.addFaction()">➕ Add Faction</button>
            <button class="btn btn-secondary" onclick="window.factionTurn()" title="Advances faction agendas/standing AND fires a downtime-tick other features (e.g. Crafting's magic item upkeep) listen for — see Player's Guide ch. 11 Downtime, 'the world may advance timers while you rest'.">🔄 GM Downtime (Faction Turn)</button>
            <button class="btn btn-secondary" onclick="window.refreshFactions()">🔄 Refresh</button>
            <button class="btn btn-secondary" onclick="window.loadDefaultFactions()">📥 Load Defaults</button>
        </div>
    `;
}

// ============================================================
// RENDER: ASSETS
// ============================================================

function renderAssets() {
    if (state.assets.length === 0) {
        return `
            <div class="factions-empty">
                <div style="font-size:3rem;">📦</div>
                <div>No assets tracked yet.</div>
                <button class="btn btn-primary" onclick="window.addAsset()">➕ Add Asset</button>
                <button class="btn btn-secondary" onclick="window.loadDefaultFactions()">📥 Load Defaults</button>
            </div>
        `;
    }

    return `
        <div class="assets-grid">
            ${state.assets.map(a => {
                const status = ASSET_STATUS[a.status || 'maintained'];
                return `
                    <div class="asset-card" onclick="window.viewAsset('${a.id}')">
                        <div class="asset-card-tier">${a.tier || 'Minor'}</div>
                        <div class="asset-card-name">${escHtml(a.name)}</div>
                        <div class="asset-card-type">${escHtml(a.type || 'asset')}</div>
                        <div class="asset-card-status" style="color:${status.color};">${status.icon} ${status.label}</div>
                        <div class="asset-card-cost">${a.cost || 4} XP</div>
                        ${a.source === 'default' || state.usingFallback ? '<span class="badge badge-remote" style="font-size:0.6rem;">📦 Default</span>' : ''}
                    </div>
                `;
            }).join('')}
        </div>

        <div class="factions-actions">
            <button class="btn btn-primary" onclick="window.addAsset()">➕ Add Asset</button>
            <button class="btn btn-secondary" onclick="window.refreshFactions()">🔄 Refresh</button>
        </div>
    `;
}

// ============================================================
// RENDER: FOLLOWERS
// ============================================================

function renderFollowers() {
    if (state.followers.length === 0) {
        return `
            <div class="factions-empty">
                <div style="font-size:3rem;">👤</div>
                <div>No followers tracked yet.</div>
                <button class="btn btn-primary" onclick="window.addFollower()">➕ Add Follower</button>
                <button class="btn btn-secondary" onclick="window.loadDefaultFactions()">📥 Load Defaults</button>
            </div>
        `;
    }

    return `
        <div class="followers-grid">
            ${state.followers.map(f => {
                const loyalty = FOLLOWER_STATES.loyalty[f.loyalty || 'faithful'];
                const fitness = FOLLOWER_STATES.fitness[f.fitness || 'ready'];
                return `
                    <div class="follower-card" onclick="window.viewFollower('${f.id}')">
                        <div class="follower-card-header">
                            <span class="follower-name">${escHtml(f.name)}</span>
                            <span class="follower-cap">Cap ${f.cap || 1}</span>
                        </div>
                        <div class="follower-role">${escHtml(f.role || 'Follower')}</div>
                        <div class="follower-states">
                            <span class="follower-state" style="color:${loyalty.color};">${loyalty.icon} ${loyalty.label}</span>
                            <span class="follower-state" style="color:${fitness.color};">${fitness.icon} ${fitness.label}</span>
                        </div>
                        ${f.description ? `<div class="follower-desc">${escHtml(f.description)}</div>` : ''}
                        ${f.source === 'default' || state.usingFallback ? '<span class="badge badge-remote" style="font-size:0.6rem;">📦 Default</span>' : ''}
                    </div>
                `;
            }).join('')}
        </div>

        <div class="factions-actions">
            <button class="btn btn-primary" onclick="window.addFollower()">➕ Add Follower</button>
            <button class="btn btn-secondary" onclick="window.refreshFactions()">🔄 Refresh</button>
        </div>
    `;
}

// ============================================================
// RENDER: TRUSTS
// ============================================================

function renderTrusts() {
    if (state.trusts.length === 0) {
        return `
            <div class="factions-empty">
                <div style="font-size:3rem;">🤝</div>
                <div>No trusts created yet.</div>
                <button class="btn btn-primary" onclick="window.addTrust()">➕ Create Trust</button>
                <button class="btn btn-secondary" onclick="window.loadDefaultFactions()">📥 Load Defaults</button>
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
                        <span>📦 ${t.assets?.length || 0} Assets</span>
                        <span>👤 ${t.followers?.length || 0} Followers</span>
                        <span>⚡ ${t.obligation || 0}/${t.capacity || 4}</span>
                    </div>
                    ${t.source === 'default' || state.usingFallback ? '<span class="badge badge-remote" style="font-size:0.6rem;">📦 Default</span>' : ''}
                </div>
            `).join('')}
        </div>

        <div class="factions-actions">
            <button class="btn btn-primary" onclick="window.addTrust()">➕ Create Trust</button>
            <button class="btn btn-secondary" onclick="window.refreshFactions()">🔄 Refresh</button>
        </div>
    `;
}

// ============================================================
// DETAIL SCREENS (inline, replace list — no popups)
// ============================================================

function backButton(kind) {
    return `<button class="btn btn-secondary editor-back" onclick="window.closeFactionScreen('${kind}')">← Back</button>`;
}

function renderDetailScreen(kind, id) {
    switch (kind) {
        case 'faction': return renderFactionDetail(id);
        case 'asset': return renderAssetDetail(id);
        case 'follower': return renderFollowerDetail(id);
        case 'trust': return renderTrustDetail(id);
        default: return renderListView(state.viewMode);
    }
}

function renderFactionDetail(factionId) {
    const faction = state.factions.find(f => f.id === factionId);
    if (!faction) {
        showToast('Faction not found', 'error');
        return renderListView('factions');
    }

    const standing = FACTION_STANDINGS[String(faction.standing)] || FACTION_STANDINGS['0'];
    return `
        <div class="editor-screen faction-detail">
            ${backButton('faction')}
            <div class="faction-detail-header">
                <span class="faction-detail-icon">${faction.icon || '🏛️'}</span>
                <div>
                    <h2>${escHtml(faction.name)}</h2>
                    <div class="faction-detail-standing" style="color:${standing.color};">
                        ${standing.icon} ${standing.label} — ${standing.desc}
                    </div>
                </div>
            </div>

            <div class="faction-detail-body">
                <div class="faction-detail-section">
                    <h3>🎯 Agenda</h3>
                    <p>${escHtml(faction.agenda || 'None')}</p>
                </div>

                <div class="faction-detail-section">
                    <h3>⏱️ Progress</h3>
                    <div class="timer-display">
                        <span>${faction.agendaTimer?.current || 0}/${faction.agendaTimer?.segments || 6}</span>
                        <div class="timer-bar">
                            <div class="timer-bar-fill" style="width:${((faction.agendaTimer?.current || 0) / (faction.agendaTimer?.segments || 6)) * 100}%;"></div>
                        </div>
                    </div>
                    <div class="timer-controls">
                        <button class="btn btn-sm btn-primary" onclick="window.tickFactionTimer('${faction.id}')">⏱️ Tick +1</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.retreatFactionTimer('${faction.id}')">↩️ Retreat -1</button>
                        <button class="btn btn-sm btn-warning" onclick="window.resetFactionTimer('${faction.id}')">⟳ Reset</button>
                    </div>
                </div>

                <div class="faction-detail-section">
                    <h3>👤 Key NPCs</h3>
                    <ul>
                        ${(faction.keyNPCs || []).map(npc => `<li>${escHtml(npc)}</li>`).join('')}
                        ${(faction.keyNPCs || []).length === 0 ? '<li class="text-muted">No NPCs listed</li>' : ''}
                    </ul>
                </div>

                <div class="faction-detail-section">
                    <h3>💪 Resources</h3>
                    <p>${escHtml(faction.resources || 'None listed')}</p>
                </div>

                <div class="faction-detail-section">
                    <h3>🔗 Hooks</h3>
                    <ul>
                        ${(faction.hooks || []).map(h => `<li>🔗 ${escHtml(h)}</li>`).join('')}
                        ${(faction.hooks || []).length === 0 ? '<li class="text-muted">No hooks yet.</li>' : ''}
                    </ul>
                    <form class="inline-add-form" onsubmit="window.addFactionHook(event, '${faction.id}')">
                        <input type="text" name="hook" placeholder="New hook..." required />
                        <button type="submit" class="btn btn-sm btn-primary">➕ Add Hook</button>
                    </form>
                </div>

                <div class="faction-detail-section">
                    <h3>📊 Standing</h3>
                    <div class="standing-controls">
                        <button class="btn btn-sm btn-secondary" onclick="window.changeFactionStanding('${faction.id}', -1)">➖</button>
                        <span style="font-weight:600;color:${standing.color};">${standing.icon} ${standing.label}</span>
                        <button class="btn btn-sm btn-secondary" onclick="window.changeFactionStanding('${faction.id}', 1)">➕</button>
                    </div>
                </div>
            </div>

            <div class="faction-detail-actions">
                <button class="btn btn-primary" onclick="window.editFaction('${faction.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteFaction('${faction.id}')">🗑️ Delete</button>
                ${backButton('faction')}
            </div>
        </div>
    `;
}

function renderAssetDetail(assetId) {
    const asset = state.assets.find(a => a.id === assetId);
    if (!asset) {
        showToast('Asset not found', 'error');
        return renderListView('assets');
    }

    const status = ASSET_STATUS[asset.status || 'maintained'];
    return `
        <div class="editor-screen asset-detail">
            ${backButton('asset')}
            <div class="asset-detail-header">
                <span class="asset-detail-icon">📦</span>
                <div>
                    <h2>${escHtml(asset.name)}</h2>
                    <div class="asset-detail-tier">${asset.tier || 'Minor'} Asset</div>
                </div>
            </div>

            <div class="asset-detail-body">
                <div class="asset-detail-section">
                    <h3>📖 Description</h3>
                    <p>${escHtml(asset.description || 'No description.')}</p>
                </div>

                <div class="asset-detail-section">
                    <h3>💰 Cost</h3>
                    <p>${asset.cost || 4} XP</p>
                </div>

                <div class="asset-detail-section">
                    <h3>📊 Status</h3>
                    <p class="asset-status" style="color:${status.color};">${status.icon} ${status.label}</p>
                    <div class="status-controls">
                        <button class="btn btn-sm btn-secondary" onclick="window.changeAssetStatus('${asset.id}', 'maintained')">✅ Maintained</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.changeAssetStatus('${asset.id}', 'neglected')">⚠️ Neglected</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.changeAssetStatus('${asset.id}', 'compromised')">❌ Compromised</button>
                    </div>
                </div>

                ${asset.freeUse ? `
                <div class="asset-detail-section">
                    <h3>🔄 Free Use</h3>
                    <p>${escHtml(asset.freeUse)}</p>
                </div>
                ` : ''}

                ${asset.sceneSurge ? `
                <div class="asset-detail-section">
                    <h3>⚡ Scene Surge</h3>
                    <p>${escHtml(asset.sceneSurge)}</p>
                </div>
                ` : ''}

                ${asset.source === 'default' || state.usingFallback ? '<span class="badge badge-remote">📦 Default Asset</span>' : ''}
            </div>

            <div class="asset-detail-actions">
                <button class="btn btn-primary" onclick="window.editAsset('${asset.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteAsset('${asset.id}')">🗑️ Delete</button>
                ${backButton('asset')}
            </div>
        </div>
    `;
}

function renderFollowerDetail(followerId) {
    const follower = state.followers.find(f => f.id === followerId);
    if (!follower) {
        showToast('Follower not found', 'error');
        return renderListView('followers');
    }

    const loyalty = FOLLOWER_STATES.loyalty[follower.loyalty || 'faithful'];
    const fitness = FOLLOWER_STATES.fitness[follower.fitness || 'ready'];

    return `
        <div class="editor-screen follower-detail">
            ${backButton('follower')}
            <div class="follower-detail-header">
                <span class="follower-detail-icon">👤</span>
                <div>
                    <h2>${escHtml(follower.name)}</h2>
                    <div class="follower-detail-role">${escHtml(follower.role || 'Follower')} · Cap ${follower.cap || 1}</div>
                </div>
            </div>

            <div class="follower-detail-body">
                <div class="follower-detail-section">
                    <h3>📖 Description</h3>
                    <p>${escHtml(follower.description || 'No description.')}</p>
                </div>

                <div class="follower-detail-section">
                    <h3>📊 States</h3>
                    <div class="state-grid">
                        <div class="state-item">
                            <span class="state-label">Loyalty</span>
                            <span class="state-value" style="color:${loyalty.color};">${loyalty.icon} ${loyalty.label}</span>
                        </div>
                        <div class="state-item">
                            <span class="state-label">Fitness</span>
                            <span class="state-value" style="color:${fitness.color};">${fitness.icon} ${fitness.label}</span>
                        </div>
                    </div>
                    <div class="state-controls">
                        <button class="btn btn-sm btn-primary" onclick="window.changeFollowerState('${follower.id}', 'loyalty')">Change Loyalty</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.changeFollowerState('${follower.id}', 'fitness')">Change Fitness</button>
                    </div>
                </div>

                ${follower.source === 'default' || state.usingFallback ? '<span class="badge badge-remote">📦 Default Follower</span>' : ''}
            </div>

            <div class="follower-detail-actions">
                <button class="btn btn-primary" onclick="window.editFollower('${follower.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteFollower('${follower.id}')">🗑️ Delete</button>
                ${backButton('follower')}
            </div>
        </div>
    `;
}

function renderTrustDetail(trustId) {
    const trust = state.trusts.find(t => t.id === trustId);
    if (!trust) {
        showToast('Trust not found', 'error');
        return renderListView('trusts');
    }

    const availableAssets = state.assets.filter(a => !(trust.assets || []).includes(a.id));
    const availableFollowers = state.followers.filter(f => !(trust.followers || []).includes(f.id));

    return `
        <div class="editor-screen trust-detail">
            ${backButton('trust')}
            <div class="trust-detail-header">
                <span class="trust-detail-icon">${trust.icon || '🤝'}</span>
                <div>
                    <h2>${escHtml(trust.name)}</h2>
                    <div class="trust-detail-tier">Tier ${trust.tier || 'I'} Trust</div>
                </div>
            </div>

            <div class="trust-detail-body">
                <div class="trust-detail-section">
                    <h3>📖 Description</h3>
                    <p>${escHtml(trust.description || 'A player trust.')}</p>
                </div>

                <div class="trust-detail-section">
                    <h3>📊 Stats</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Asset Slots</span>
                            <span class="stat-value">${trust.maxAssets || 2}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Max Asset Tier</span>
                            <span class="stat-value">${trust.maxAssetTier || 'Standard'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Obligation</span>
                            <span class="stat-value">${trust.obligation || 0}/${trust.capacity || 4}</span>
                        </div>
                    </div>
                </div>

                <div class="trust-detail-section">
                    <h3>📦 Assets (${trust.assets?.length || 0})</h3>
                    ${(trust.assets || []).length > 0 ? `
                        <ul>
                            ${trust.assets.map(aId => {
                                const asset = state.assets.find(a => a.id === aId);
                                return `<li>${asset ? escHtml(asset.name) : escHtml(aId)} (${asset?.tier || 'Unknown'})</li>`;
                            }).join('')}
                        </ul>
                    ` : '<p class="text-muted">No assets.</p>'}
                    ${availableAssets.length > 0 ? `
                        <form class="inline-add-form" onsubmit="window.addTrustAsset(event, '${trust.id}')">
                            <select name="assetId" required>
                                <option value="" disabled selected>Select an asset…</option>
                                ${availableAssets.map(a => `<option value="${a.id}">${escHtml(a.name)} (${escHtml(a.tier || 'Minor')})</option>`).join('')}
                            </select>
                            <button type="submit" class="btn btn-sm btn-primary">➕ Add Asset</button>
                        </form>
                    ` : '<p class="text-muted" style="font-size:0.85rem;">No available assets to add.</p>'}
                </div>

                <div class="trust-detail-section">
                    <h3>👤 Followers (${trust.followers?.length || 0})</h3>
                    ${(trust.followers || []).length > 0 ? `
                        <ul>
                            ${trust.followers.map(fId => {
                                const follower = state.followers.find(f => f.id === fId);
                                return `<li>${follower ? escHtml(follower.name) : escHtml(fId)} (Cap ${follower?.cap || '?'})</li>`;
                            }).join('')}
                        </ul>
                    ` : '<p class="text-muted">No followers.</p>'}
                    ${availableFollowers.length > 0 ? `
                        <form class="inline-add-form" onsubmit="window.addTrustFollower(event, '${trust.id}')">
                            <select name="followerId" required>
                                <option value="" disabled selected>Select a follower…</option>
                                ${availableFollowers.map(f => `<option value="${f.id}">${escHtml(f.name)} (Cap ${f.cap})</option>`).join('')}
                            </select>
                            <button type="submit" class="btn btn-sm btn-primary">➕ Add Follower</button>
                        </form>
                    ` : '<p class="text-muted" style="font-size:0.85rem;">No available followers to add.</p>'}
                </div>

                ${trust.source === 'default' || state.usingFallback ? '<span class="badge badge-remote">📦 Default Trust</span>' : ''}
            </div>

            <div class="trust-detail-actions">
                <button class="btn btn-primary" onclick="window.editTrust('${trust.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteTrust('${trust.id}')">🗑️ Delete</button>
                ${backButton('trust')}
            </div>
        </div>
    `;
}

// ============================================================
// FORM SCREENS (add / edit — real fields, no prompt())
// ============================================================

function renderFormScreen(kind, id) {
    switch (kind) {
        case 'faction': return renderFactionForm(id);
        case 'asset': return renderAssetForm(id);
        case 'follower': return renderFollowerForm(id);
        case 'trust': return renderTrustForm(id);
        default: return renderListView(state.viewMode);
    }
}

function renderFactionForm(id) {
    const faction = id ? state.factions.find(f => f.id === id) : null;
    const isEdit = !!faction;
    const f = faction || { name: '', standing: 0, agenda: '', keyNPCs: [], resources: '', color: '#d4af37', icon: '🏛️' };

    return `
        <div class="editor-screen faction-form">
            ${backButton('faction')}
            <h2>${isEdit ? '✏️ Edit Faction' : '➕ New Faction'}</h2>
            <form class="fe-form" onsubmit="window.submitFactionForm(event, ${isEdit ? `'${id}'` : 'null'})">
                <label>Name
                    <input type="text" name="name" value="${escHtml(f.name)}" required />
                </label>
                <label>Standing (-3 to 3)
                    <input type="number" name="standing" min="-3" max="3" value="${f.standing ?? 0}" />
                </label>
                <label>Agenda
                    <input type="text" name="agenda" value="${escHtml(f.agenda || '')}" />
                </label>
                <label>Key NPCs (comma-separated)
                    <input type="text" name="keyNPCs" value="${escHtml((f.keyNPCs || []).join(', '))}" />
                </label>
                <label>Resources
                    <input type="text" name="resources" value="${escHtml(f.resources || '')}" />
                </label>
                <label>Color
                    <input type="text" name="color" value="${escHtml(f.color || '#d4af37')}" />
                </label>
                <label>Icon (emoji)
                    <input type="text" name="icon" value="${escHtml(f.icon || '🏛️')}" />
                </label>
                <div class="fe-form-actions">
                    <button type="submit" class="btn btn-primary">💾 Save</button>
                    <button type="button" class="btn btn-secondary" onclick="window.closeFactionScreen('faction')">Cancel</button>
                </div>
            </form>
        </div>
    `;
}

function renderAssetForm(id) {
    const asset = id ? state.assets.find(a => a.id === id) : null;
    const isEdit = !!asset;
    const a = asset || { name: '', type: '', tier: 'Minor', description: '', cost: 4, freeUse: '', sceneSurge: '' };

    return `
        <div class="editor-screen asset-form">
            ${backButton('asset')}
            <h2>${isEdit ? '✏️ Edit Asset' : '➕ New Asset'}</h2>
            <form class="fe-form" onsubmit="window.submitAssetForm(event, ${isEdit ? `'${id}'` : 'null'})">
                <label>Name
                    <input type="text" name="name" value="${escHtml(a.name)}" required />
                </label>
                <label>Type (safehouse/network/library/workshop/contract)
                    <input type="text" name="type" value="${escHtml(a.type || '')}" />
                </label>
                <label>Tier (Minor/Standard/Major)
                    <input type="text" name="tier" value="${escHtml(a.tier || 'Minor')}" />
                </label>
                <label>Description
                    <textarea name="description" rows="3">${escHtml(a.description || '')}</textarea>
                </label>
                <label>XP Cost
                    <input type="number" name="cost" min="0" value="${a.cost ?? 4}" />
                </label>
                <label>Free Use
                    <input type="text" name="freeUse" value="${escHtml(a.freeUse || '')}" />
                </label>
                <label>Scene Surge
                    <input type="text" name="sceneSurge" value="${escHtml(a.sceneSurge || '')}" />
                </label>
                <div class="fe-form-actions">
                    <button type="submit" class="btn btn-primary">💾 Save</button>
                    <button type="button" class="btn btn-secondary" onclick="window.closeFactionScreen('asset')">Cancel</button>
                </div>
            </form>
        </div>
    `;
}

function renderFollowerForm(id) {
    const follower = id ? state.followers.find(f => f.id === id) : null;
    const isEdit = !!follower;
    const f = follower || { name: '', role: 'Follower', cap: 1, description: '', loyalty: 'faithful', fitness: 'ready' };

    return `
        <div class="editor-screen follower-form">
            ${backButton('follower')}
            <h2>${isEdit ? '✏️ Edit Follower' : '➕ New Follower'}</h2>
            <form class="fe-form" onsubmit="window.submitFollowerForm(event, ${isEdit ? `'${id}'` : 'null'})">
                <label>Name
                    <input type="text" name="name" value="${escHtml(f.name)}" required />
                </label>
                <label>Role
                    <input type="text" name="role" value="${escHtml(f.role || 'Follower')}" />
                </label>
                <label>Cap (1-5)
                    <input type="number" name="cap" min="1" max="5" value="${f.cap ?? 1}" />
                </label>
                <label>Description
                    <textarea name="description" rows="3">${escHtml(f.description || '')}</textarea>
                </label>
                <label>Loyalty
                    <select name="loyalty">
                        ${Object.keys(FOLLOWER_STATES.loyalty).map(k => `<option value="${k}" ${f.loyalty === k ? 'selected' : ''}>${FOLLOWER_STATES.loyalty[k].label}</option>`).join('')}
                    </select>
                </label>
                <label>Fitness
                    <select name="fitness">
                        ${Object.keys(FOLLOWER_STATES.fitness).map(k => `<option value="${k}" ${f.fitness === k ? 'selected' : ''}>${FOLLOWER_STATES.fitness[k].label}</option>`).join('')}
                    </select>
                </label>
                <div class="fe-form-actions">
                    <button type="submit" class="btn btn-primary">💾 Save</button>
                    <button type="button" class="btn btn-secondary" onclick="window.closeFactionScreen('follower')">Cancel</button>
                </div>
            </form>
        </div>
    `;
}

function renderTrustForm(id) {
    const trust = id ? state.trusts.find(t => t.id === id) : null;
    const isEdit = !!trust;
    const t = trust || { name: '', icon: '🤝', tier: 'I', description: '', maxAssets: 2, maxAssetTier: 'Standard', capacity: 4 };

    return `
        <div class="editor-screen trust-form">
            ${backButton('trust')}
            <h2>${isEdit ? '✏️ Edit Trust' : '➕ New Trust'}</h2>
            <form class="fe-form" onsubmit="window.submitTrustForm(event, ${isEdit ? `'${id}'` : 'null'})">
                <label>Name
                    <input type="text" name="name" value="${escHtml(t.name)}" required />
                </label>
                <label>Icon (emoji)
                    <input type="text" name="icon" value="${escHtml(t.icon || '🤝')}" />
                </label>
                <label>Tier (I-III)
                    <input type="text" name="tier" value="${escHtml(t.tier || 'I')}" />
                </label>
                <label>Description
                    <textarea name="description" rows="3">${escHtml(t.description || '')}</textarea>
                </label>
                <label>Max Asset Slots
                    <input type="number" name="maxAssets" min="0" value="${t.maxAssets ?? 2}" />
                </label>
                <label>Max Asset Tier
                    <input type="text" name="maxAssetTier" value="${escHtml(t.maxAssetTier || 'Standard')}" />
                </label>
                <label>Obligation Capacity
                    <input type="number" name="capacity" min="0" value="${t.capacity ?? 4}" />
                </label>
                <div class="fe-form-actions">
                    <button type="submit" class="btn btn-primary">💾 Save</button>
                    <button type="button" class="btn btn-secondary" onclick="window.closeFactionScreen('trust')">Cancel</button>
                </div>
            </form>
        </div>
    `;
}

// ============================================================
// SCREEN CONTROLS
// ============================================================

window.closeFactionScreen = function(kind) {
    const listView = { faction: 'factions', asset: 'assets', follower: 'followers', trust: 'trusts' }[kind] || 'factions';
    state.viewMode = listView;
    goTo(null);
};

window.viewFaction = function(id) { goTo('view', 'faction', id); };
window.viewAsset = function(id) { goTo('view', 'asset', id); };
window.viewFollower = function(id) { goTo('view', 'follower', id); };
window.viewTrust = function(id) { goTo('view', 'trust', id); };
window.loadDefaultFactions = function() {
    loadDefaultFactions();
    refreshView();
    showToast('Loaded default factions', 'success');
};

// ============================================================
// CRUD OPERATIONS - FACTIONS
// ============================================================

window.addFaction = function() { goTo('add', 'faction', null); };
window.editFaction = function(id) { goTo('edit', 'faction', id); };

window.submitFactionForm = function(evt, id) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const name = (fd.get('name') || '').trim();
    if (!name) return;

    const data = {
        name,
        standing: Math.max(-3, Math.min(3, parseInt(fd.get('standing') || '0', 10) || 0)),
        agenda: (fd.get('agenda') || '').trim() || 'None',
        keyNPCs: (fd.get('keyNPCs') || '').split(',').map(s => s.trim()).filter(Boolean),
        resources: (fd.get('resources') || '').trim() || 'None listed',
        color: (fd.get('color') || '').trim() || '#d4af37',
        icon: (fd.get('icon') || '').trim() || '🏛️'
    };

    if (id) {
        const faction = state.factions.find(f => f.id === id);
        if (!faction) return;
        Object.assign(faction, data, { source: 'local' });
        showToast(`Updated faction: ${name}`, 'success');
    } else {
        state.factions.push({
            id: 'faction-' + Date.now(),
            ...data,
            agendaTimer: { segments: 6, current: 0 },
            hooks: [],
            source: 'local'
        });
        showToast(`Added faction: ${name}`, 'success');
    }
    saveFactionData();
    state.viewMode = 'factions';
    goTo(id ? 'view' : null, id ? 'faction' : undefined, id || undefined);
};

window.deleteFaction = function(id) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    if (!confirm(`Delete faction "${faction.name}"?`)) return;
    state.factions = state.factions.filter(f => f.id !== id);
    saveFactionData();
    state.viewMode = 'factions';
    goTo(null);
    showToast(`Deleted faction: ${faction.name}`, 'info');
};

window.changeFactionStanding = function(id, delta) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    faction.standing = Math.max(-3, Math.min(3, faction.standing + delta));
    saveFactionData();
    refreshView();
    showToast(`${faction.name} standing: ${FACTION_STANDINGS[String(faction.standing)].label}`, 'info');
};

window.tickFactionTimer = function(id) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    if (!faction.agendaTimer) faction.agendaTimer = { segments: 6, current: 0 };
    faction.agendaTimer.current = Math.min(faction.agendaTimer.current + 1, faction.agendaTimer.segments);
    if (faction.agendaTimer.current >= faction.agendaTimer.segments) {
        showToast(`⚠️ ${faction.name} has achieved its agenda!`, 'warning');
        faction.agendaTimer.current = 0;
    }
    saveFactionData();
    refreshView();
};

window.retreatFactionTimer = function(id) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    if (!faction.agendaTimer) faction.agendaTimer = { segments: 6, current: 0 };
    faction.agendaTimer.current = Math.max(faction.agendaTimer.current - 1, 0);
    saveFactionData();
    refreshView();
};

window.resetFactionTimer = function(id) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    if (!faction.agendaTimer) faction.agendaTimer = { segments: 6, current: 0 };
    faction.agendaTimer.current = 0;
    saveFactionData();
    refreshView();
};

window.addFactionHook = function(evt, id) {
    evt.preventDefault();
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    const hook = (new FormData(evt.target).get('hook') || '').trim();
    if (!hook) return;
    if (!faction.hooks) faction.hooks = [];
    faction.hooks.push(hook);
    saveFactionData();
    refreshView();
    showToast(`Added hook: ${hook}`, 'success');
};

// "Faction Turn" doubles as the app's stand-in for a GM-adjudicated
// "downtime" passing (Player's Guide ch. 11: "Downtime is not a pause...
// the world may advance timers -- faction agendas, rival plans -- while
// you rest"). Kept the original name/global (nothing else in the app
// calls it by a different name) but it now also broadcasts a
// 'downtime-tick' CustomEvent so any other feature that cares about "a
// downtime has passed" -- currently just Crafting's magic-item upkeep
// decay (Maintained -> Neglected -> Compromised, see items.tex
// "Attunement and Upkeep") -- can react without factions/index.js needing
// to know that feature exists. See js/features/crafting/index.js's
// `document.addEventListener('downtime-tick', ...)`.
window.factionTurn = function() {
    let changes = [];
    state.factions.forEach(f => {
        const roll = Math.floor(Math.random() * 6) + 1;
        let change = 0;
        if (roll <= 2) change = -1;
        else if (roll >= 5) change = 1;
        if (change !== 0) {
            if (!f.agendaTimer) f.agendaTimer = { segments: 6, current: 0 };
            const old = f.agendaTimer.current;
            f.agendaTimer.current = Math.max(0, Math.min(f.agendaTimer.current + change, f.agendaTimer.segments));
            if (f.agendaTimer.current >= f.agendaTimer.segments) {
                changes.push(`⚠️ ${f.name} achieved its agenda!`);
                f.agendaTimer.current = 0;
            } else if (f.agendaTimer.current !== old) {
                changes.push(`${f.name}: ${old} → ${f.agendaTimer.current} (${change > 0 ? '+' : ''}${change})`);
            }
        }
        if (Math.random() < 0.2) {
            const oldStanding = f.standing;
            f.standing = Math.max(-3, Math.min(3, f.standing + (Math.random() < 0.5 ? 1 : -1)));
            if (f.standing !== oldStanding) {
                changes.push(`${f.name} standing: ${FACTION_STANDINGS[String(oldStanding)].label} → ${FACTION_STANDINGS[String(f.standing)].label}`);
            }
        }
    });
    saveFactionData();
    refreshView();
    if (changes.length > 0) {
        showToast('🔄 Faction turn complete: ' + changes.join('; '), 'success');
    } else {
        showToast('🔄 Faction turn complete - no changes', 'info');
    }
    // NEW: broadcast that a downtime has passed so unrelated features
    // (Crafting upkeep decay, and anything added later) can react.
    document.dispatchEvent(new CustomEvent('downtime-tick', { detail: { source: 'faction-turn' } }));
};

// ============================================================
// CRUD OPERATIONS - ASSETS
// ============================================================

window.addAsset = function() { goTo('add', 'asset', null); };
window.editAsset = function(id) { goTo('edit', 'asset', id); };

window.submitAssetForm = function(evt, id) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const name = (fd.get('name') || '').trim();
    if (!name) return;

    const data = {
        name,
        type: (fd.get('type') || '').trim() || 'asset',
        tier: (fd.get('tier') || '').trim() || 'Minor',
        description: (fd.get('description') || '').trim() || 'An asset.',
        cost: parseInt(fd.get('cost') || '4', 10) || 4,
        freeUse: (fd.get('freeUse') || '').trim(),
        sceneSurge: (fd.get('sceneSurge') || '').trim()
    };

    if (id) {
        const asset = state.assets.find(a => a.id === id);
        if (!asset) return;
        Object.assign(asset, data, { source: 'local' });
        showToast(`Updated asset: ${name}`, 'success');
    } else {
        state.assets.push({
            id: 'asset-' + Date.now(),
            ...data,
            status: 'maintained',
            source: 'local'
        });
        showToast(`Added asset: ${name}`, 'success');
    }
    saveFactionData();
    state.viewMode = 'assets';
    goTo(id ? 'view' : null, id ? 'asset' : undefined, id || undefined);
};

window.deleteAsset = function(id) {
    const asset = state.assets.find(a => a.id === id);
    if (!asset) return;
    if (!confirm(`Delete asset "${asset.name}"?`)) return;
    state.assets = state.assets.filter(a => a.id !== id);
    saveFactionData();
    state.viewMode = 'assets';
    goTo(null);
    showToast(`Deleted asset: ${asset.name}`, 'info');
};

window.changeAssetStatus = function(id, status) {
    const asset = state.assets.find(a => a.id === id);
    if (!asset) return;
    asset.status = status;
    saveFactionData();
    refreshView();
    const statusInfo = ASSET_STATUS[status];
    showToast(`${asset.name}: ${statusInfo.icon} ${statusInfo.label}`, 'info');
};

// ============================================================
// CRUD OPERATIONS - FOLLOWERS
// ============================================================

window.addFollower = function() { goTo('add', 'follower', null); };
window.editFollower = function(id) { goTo('edit', 'follower', id); };

window.submitFollowerForm = function(evt, id) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const name = (fd.get('name') || '').trim();
    if (!name) return;

    const data = {
        name,
        role: (fd.get('role') || '').trim() || 'Follower',
        cap: parseInt(fd.get('cap') || '1', 10) || 1,
        description: (fd.get('description') || '').trim() || 'A follower.',
        loyalty: fd.get('loyalty') || 'faithful',
        fitness: fd.get('fitness') || 'ready'
    };

    if (id) {
        const follower = state.followers.find(f => f.id === id);
        if (!follower) return;
        Object.assign(follower, data, { source: 'local' });
        showToast(`Updated follower: ${name}`, 'success');
    } else {
        state.followers.push({
            id: 'follower-' + Date.now(),
            ...data,
            source: 'local'
        });
        showToast(`Added follower: ${name}`, 'success');
    }
    saveFactionData();
    state.viewMode = 'followers';
    goTo(id ? 'view' : null, id ? 'follower' : undefined, id || undefined);
};

window.deleteFollower = function(id) {
    const follower = state.followers.find(f => f.id === id);
    if (!follower) return;
    if (!confirm(`Delete follower "${follower.name}"?`)) return;
    state.followers = state.followers.filter(f => f.id !== id);
    saveFactionData();
    state.viewMode = 'followers';
    goTo(null);
    showToast(`Deleted follower: ${follower.name}`, 'info');
};

window.changeFollowerState = function(id, type) {
    const follower = state.followers.find(f => f.id === id);
    if (!follower) return;
    const states = type === 'loyalty'
        ? ['faithful', 'strained', 'broken']
        : ['ready', 'hurt', 'down'];
    const current = follower[type] || states[0];
    const idx = states.indexOf(current);
    const next = states[(idx + 1) % states.length];
    follower[type] = next;
    saveFactionData();
    refreshView();
    const label = type === 'loyalty' ? 'Loyalty' : 'Fitness';
    showToast(`${label}: ${current} → ${next}`, 'info');
};

// ============================================================
// CRUD OPERATIONS - TRUSTS
// ============================================================

window.addTrust = function() { goTo('add', 'trust', null); };
window.editTrust = function(id) { goTo('edit', 'trust', id); };

window.submitTrustForm = function(evt, id) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const name = (fd.get('name') || '').trim();
    if (!name) return;

    const data = {
        name,
        icon: (fd.get('icon') || '').trim() || '🤝',
        tier: (fd.get('tier') || '').trim() || 'I',
        description: (fd.get('description') || '').trim() || 'A player trust.',
        maxAssets: parseInt(fd.get('maxAssets') || '2', 10) || 2,
        maxAssetTier: (fd.get('maxAssetTier') || '').trim() || 'Standard',
        capacity: parseInt(fd.get('capacity') || '4', 10) || 4
    };

    if (id) {
        const trust = state.trusts.find(t => t.id === id);
        if (!trust) return;
        Object.assign(trust, data, { source: 'local' });
        showToast(`Updated trust: ${name}`, 'success');
    } else {
        state.trusts.push({
            id: 'trust-' + Date.now(),
            ...data,
            assets: [],
            followers: [],
            obligation: 0,
            source: 'local'
        });
        showToast(`Created trust: ${name}`, 'success');
    }
    saveFactionData();
    state.viewMode = 'trusts';
    goTo(id ? 'view' : null, id ? 'trust' : undefined, id || undefined);
};

window.deleteTrust = function(id) {
    const trust = state.trusts.find(t => t.id === id);
    if (!trust) return;
    if (!confirm(`Delete trust "${trust.name}"?`)) return;
    state.trusts = state.trusts.filter(t => t.id !== id);
    saveFactionData();
    state.viewMode = 'trusts';
    goTo(null);
    showToast(`Deleted trust: ${trust.name}`, 'info');
};

window.addTrustAsset = function(evt, trustId) {
    evt.preventDefault();
    const trust = state.trusts.find(t => t.id === trustId);
    if (!trust) return;
    if (!trust.assets) trust.assets = [];

    const assetId = new FormData(evt.target).get('assetId');
    const selected = state.assets.find(a => a.id === assetId);
    if (!selected) return;
    trust.assets.push(selected.id);

    if (trust.assets.length > (trust.maxAssets || 2)) {
        showToast(`Warning: Trust now has ${trust.assets.length} assets, exceeding its capacity of ${trust.maxAssets || 2}.`, 'warning');
    }

    saveFactionData();
    refreshView();
    showToast(`Added ${selected.name} to ${trust.name}`, 'success');
};

window.addTrustFollower = function(evt, trustId) {
    evt.preventDefault();
    const trust = state.trusts.find(t => t.id === trustId);
    if (!trust) return;
    if (!trust.followers) trust.followers = [];

    const followerId = new FormData(evt.target).get('followerId');
    const selected = state.followers.find(f => f.id === followerId);
    if (!selected) return;
    trust.followers.push(selected.id);

    saveFactionData();
    refreshView();
    showToast(`Added ${selected.name} to ${trust.name}`, 'success');
};

// ============================================================
// VIEW MANAGEMENT
// ============================================================

window.refreshFactions = function() {
    // Clear cache and reload
    localStorage.removeItem(CACHE_KEY);
    loadFactionData();
    refreshView();
    showToast('Factions refreshed', 'success');
};

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    document.querySelectorAll('.factions-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.factions-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.screen = null;
            const view = tab.dataset.view;
            const el = document.getElementById('factions-view-container');
            if (el) {
                el.innerHTML = renderListView(view);
                attachEvents();
            }
        });
    });
}

// ============================================================
// LIFECYCLE METHODS
// ============================================================

export function onActivate() {
    console.log('[Factions] Activated');
    if (!state.dataLoaded) {
        loadFactionData();
    }
    refreshView();
}

export function onDeactivate() {
    console.log('[Factions] Deactivated');
}

export function refresh() {
    localStorage.removeItem(CACHE_KEY);
    loadFactionData();
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
    loadFactionData,
    loadRemoteFactions,
    loadDefaultFactions,
    saveFactionData
};
