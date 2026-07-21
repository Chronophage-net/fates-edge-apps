// features/factions/index.js
/**
 * Factions & Assets Feature
 * Combines faction management with assets, followers, and trusts
 * 
 * Data paths:
 * - Faction data: /factions/{id}.json
 * - Faction manifest: /factions/manifest.json
 * - Fallback: /data/factions/
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

// ============================================================
// CONSTANTS
// ============================================================

const FACTION_DATA_PATH = '/factions/';
const FACTION_MANIFEST_PATH = '/factions/manifest.json';

const FALLBACK_DATA_PATH = './data/factions/';
const FALLBACK_MANIFEST_PATH = './data/factions/manifest.json';

// Known faction slugs for discovery fallback
const KNOWN_FACTION_SLUGS = [
    'velvet-court',
    'iron-league',
    'gray-ash',
    'ecktorian-censorate',
    'bloody-fist',
    'house-contarini'
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
        name: 'The Velvet Coin',
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
    usingFallback: false
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
        console.log('📥 Loading faction data from remote...');
        
        let manifestRes = await fetch(FACTION_MANIFEST_PATH);
        let dataPath = FACTION_DATA_PATH;
        let manifestFound = false;
        
        if (!manifestRes.ok) {
            console.log('📥 Primary manifest not found, trying fallback...');
            manifestRes = await fetch(FALLBACK_MANIFEST_PATH);
            if (manifestRes.ok) {
                dataPath = FALLBACK_DATA_PATH;
                console.log('📥 Using fallback data path:', dataPath);
                manifestFound = true;
            }
        } else {
            manifestFound = true;
        }
        
        let factions = [];
        
        if (manifestFound && manifestRes.ok) {
            const manifest = await manifestRes.json();
            if (Array.isArray(manifest) && manifest.length > 0) {
                for (const factionId of manifest) {
                    try {
                        const res = await fetch(`${dataPath}${factionId}.json`);
                        if (res.ok) {
                            const data = await res.json();
                            if (!data.id) data.id = factionId;
                            factions.push(data);
                            console.log(`✅ Loaded faction: ${data.name || factionId}`);
                        } else {
                            console.warn(`⚠️ Could not load faction: ${factionId} (HTTP ${res.status})`);
                        }
                    } catch (e) {
                        console.warn(`⚠️ Error loading faction ${factionId}:`, e);
                    }
                }
            }
        }
        
        // If manifest missing or empty, try discovery
        if (factions.length === 0) {
            console.warn('📥 No manifest or no factions loaded. Attempting discovery...');
            const discovered = await discoverFactions(dataPath);
            if (discovered.length > 0) {
                factions = discovered;
                console.log(`✅ Discovered ${factions.length} factions`);
                await saveFactionManifest(factions.map(f => f.id || f.name), dataPath);
            }
        }
        
        // If still no factions, use defaults and generate manifest
        if (factions.length === 0) {
            console.warn('📥 No factions discovered. Using defaults and generating manifest.');
            state.usingFallback = true;
            loadDefaultFactions();
            const defaultIds = state.factions.map(f => f.id || f.name);
            await saveFactionManifest(defaultIds, dataPath);
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

async function discoverFactions(dataPath) {
    const discovered = [];
    
    // Try directory listing
    try {
        const dirRes = await fetch(dataPath);
        if (dirRes.ok) {
            const html = await dirRes.text();
            const matches = html.match(/href="([^"]+\.json)"/gi);
            if (matches) {
                for (const m of matches) {
                    const match = m.match(/href="([^"]+)"/i);
                    if (match && !match[1].includes('manifest')) {
                        let slug = match[1].replace(/\.json$/, '');
                        slug = slug.split('/').pop();
                        try {
                            const res = await fetch(`${dataPath}${slug}.json`);
                            if (res.ok) {
                                const data = await res.json();
                                if (!data.id) data.id = slug;
                                discovered.push(data);
                            }
                        } catch (e) { /* ignore */ }
                    }
                }
            }
        }
    } catch (e) { /* ignore */ }
    
    // Fallback to known slugs
    if (discovered.length === 0) {
        for (const slug of KNOWN_FACTION_SLUGS) {
            try {
                const res = await fetch(`${dataPath}${slug}.json`);
                if (res.ok) {
                    const data = await res.json();
                    if (!data.id) data.id = slug;
                    discovered.push(data);
                }
            } catch (e) { /* ignore */ }
        }
    }
    
    return discovered;
}

async function saveFactionManifest(names, dataPath) {
    const manifestPath = dataPath === FACTION_DATA_PATH ? FACTION_MANIFEST_PATH : FALLBACK_MANIFEST_PATH;
    try {
        const res = await fetch(manifestPath, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(names)
        });
        if (res.ok) {
            console.log(`✅ Faction manifest saved to ${manifestPath}`);
            return;
        }
    } catch (e) {
        console.warn('Could not save manifest via PUT, falling back to localStorage.', e);
    }
    
    try {
        localStorage.setItem('fates-edge-faction-manifest', JSON.stringify(names));
        console.log('Faction manifest cached in localStorage');
    } catch (e2) {
        console.warn('Could not save manifest to localStorage.', e2);
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
// RENDER
// ============================================================

export function render(el) {
    container = el;
    loadFactionData();

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
                ${renderView('factions')}
            </div>

            <div id="faction-modal" class="faction-modal" style="display:none;"></div>
        </div>
    `;

    attachEvents();
}

function renderView(view) {
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
    
    switch(view) {
        case 'factions': return renderFactions();
        case 'assets': return renderAssets();
        case 'followers': return renderFollowers();
        case 'trusts': return renderTrusts();
        default: return renderFactions();
    }
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
            <button class="btn btn-secondary" onclick="window.factionTurn()">🔄 Faction Turn</button>
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
// DETAIL VIEWS
// ============================================================

function renderFactionDetail(factionId) {
    const faction = state.factions.find(f => f.id === factionId);
    if (!faction) {
        showToast('Faction not found', 'error');
        return;
    }

    const standing = FACTION_STANDINGS[String(faction.standing)] || FACTION_STANDINGS['0'];
    const modal = document.getElementById('faction-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content faction-detail">
            <button class="modal-close" onclick="window.closeFactionModal()">✕</button>
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
                    <button class="btn btn-sm btn-primary" onclick="window.addFactionHook('${faction.id}')">➕ Add Hook</button>
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
                <button class="btn btn-secondary" onclick="window.closeFactionModal()">Close</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFactionModal();
    });
}

function renderAssetDetail(assetId) {
    const asset = state.assets.find(a => a.id === assetId);
    if (!asset) {
        showToast('Asset not found', 'error');
        return;
    }

    const status = ASSET_STATUS[asset.status || 'maintained'];
    const modal = document.getElementById('faction-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content asset-detail">
            <button class="modal-close" onclick="window.closeFactionModal()">✕</button>
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
                <button class="btn btn-secondary" onclick="window.closeFactionModal()">Close</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFactionModal();
    });
}

function renderFollowerDetail(followerId) {
    const follower = state.followers.find(f => f.id === followerId);
    if (!follower) {
        showToast('Follower not found', 'error');
        return;
    }

    const loyalty = FOLLOWER_STATES.loyalty[follower.loyalty || 'faithful'];
    const fitness = FOLLOWER_STATES.fitness[follower.fitness || 'ready'];

    const modal = document.getElementById('faction-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content follower-detail">
            <button class="modal-close" onclick="window.closeFactionModal()">✕</button>
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
                <button class="btn btn-secondary" onclick="window.closeFactionModal()">Close</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFactionModal();
    });
}

function renderTrustDetail(trustId) {
    const trust = state.trusts.find(t => t.id === trustId);
    if (!trust) {
        showToast('Trust not found', 'error');
        return;
    }

    const modal = document.getElementById('faction-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content trust-detail">
            <button class="modal-close" onclick="window.closeFactionModal()">✕</button>
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
                    <button class="btn btn-sm btn-primary" onclick="window.addTrustAsset('${trust.id}')">➕ Add Asset</button>
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
                    <button class="btn btn-sm btn-primary" onclick="window.addTrustFollower('${trust.id}')">➕ Add Follower</button>
                </div>

                ${trust.source === 'default' || state.usingFallback ? '<span class="badge badge-remote">📦 Default Trust</span>' : ''}
            </div>

            <div class="trust-detail-actions">
                <button class="btn btn-primary" onclick="window.editTrust('${trust.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteTrust('${trust.id}')">🗑️ Delete</button>
                <button class="btn btn-secondary" onclick="window.closeFactionModal()">Close</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFactionModal();
    });
}

// ============================================================
// MODAL CONTROLS
// ============================================================

window.closeFactionModal = function() {
    document.getElementById('faction-modal').style.display = 'none';
};

window.viewFaction = function(id) { renderFactionDetail(id); };
window.viewAsset = function(id) { renderAssetDetail(id); };
window.viewFollower = function(id) { renderFollowerDetail(id); };
window.viewTrust = function(id) { renderTrustDetail(id); };
window.loadDefaultFactions = function() { loadDefaultFactions(); refreshView(); showToast('Loaded default factions', 'success'); };

// ============================================================
// CRUD OPERATIONS - FACTIONS
// ============================================================

window.addFaction = function() {
    const name = prompt('Enter faction name:');
    if (!name) return;

    state.factions.push({
        id: 'faction-' + Date.now(),
        name,
        standing: 0,
        agenda: prompt('Enter agenda:') || 'None',
        agendaTimer: { segments: 6, current: 0 },
        keyNPCs: prompt('Enter key NPCs (comma-separated):')?.split(',').map(s => s.trim()) || [],
        resources: prompt('Enter resources:') || 'None listed',
        hooks: [],
        color: prompt('Enter color (hex):') || '#d4af37',
        icon: prompt('Enter icon (emoji):') || '🏛️',
        source: 'local'
    });
    saveFactionData();
    refreshView();
    showToast(`Added faction: ${name}`, 'success');
};

window.editFaction = function(id) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    const name = prompt('Enter name:', faction.name);
    if (!name) return;
    faction.name = name;
    faction.standing = parseInt(prompt('Enter standing (-3 to 3):', faction.standing) || '0');
    faction.agenda = prompt('Enter agenda:', faction.agenda) || faction.agenda;
    faction.resources = prompt('Enter resources:', faction.resources) || faction.resources;
    faction.color = prompt('Enter color:', faction.color) || faction.color;
    faction.icon = prompt('Enter icon:', faction.icon) || faction.icon;
    faction.source = 'local';
    saveFactionData();
    refreshView();
    closeFactionModal();
    showToast(`Updated faction: ${name}`, 'success');
};

window.deleteFaction = function(id) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    if (!confirm(`Delete faction "${faction.name}"?`)) return;
    state.factions = state.factions.filter(f => f.id !== id);
    saveFactionData();
    refreshView();
    closeFactionModal();
    showToast(`Deleted faction: ${faction.name}`, 'info');
};

window.changeFactionStanding = function(id, delta) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    faction.standing = Math.max(-3, Math.min(3, faction.standing + delta));
    saveFactionData();
    refreshView();
    closeFactionModal();
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
    closeFactionModal();
};

window.retreatFactionTimer = function(id) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    if (!faction.agendaTimer) faction.agendaTimer = { segments: 6, current: 0 };
    faction.agendaTimer.current = Math.max(faction.agendaTimer.current - 1, 0);
    saveFactionData();
    refreshView();
    closeFactionModal();
};

window.resetFactionTimer = function(id) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    if (!faction.agendaTimer) faction.agendaTimer = { segments: 6, current: 0 };
    faction.agendaTimer.current = 0;
    saveFactionData();
    refreshView();
    closeFactionModal();
};

window.addFactionHook = function(id) {
    const faction = state.factions.find(f => f.id === id);
    if (!faction) return;
    const hook = prompt('Enter hook:');
    if (!hook) return;
    if (!faction.hooks) faction.hooks = [];
    faction.hooks.push(hook);
    saveFactionData();
    refreshView();
    closeFactionModal();
    showToast(`Added hook: ${hook}`, 'success');
};

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
};

// ============================================================
// CRUD OPERATIONS - ASSETS
// ============================================================

window.addAsset = function() {
    const name = prompt('Enter asset name:');
    if (!name) return;

    state.assets.push({
        id: 'asset-' + Date.now(),
        name,
        type: prompt('Enter type (safehouse/network/library/workshop/contract):') || 'asset',
        tier: prompt('Enter tier (Minor/Standard/Major):') || 'Minor',
        description: prompt('Enter description:') || 'An asset.',
        cost: parseInt(prompt('Enter XP cost:') || '4'),
        status: 'maintained',
        freeUse: prompt('Enter Free Use benefit:') || '',
        sceneSurge: prompt('Enter Scene Surge benefit:') || '',
        source: 'local'
    });
    saveFactionData();
    refreshView();
    showToast(`Added asset: ${name}`, 'success');
};

window.editAsset = function(id) {
    const asset = state.assets.find(a => a.id === id);
    if (!asset) return;
    const name = prompt('Enter name:', asset.name);
    if (!name) return;
    asset.name = name;
    asset.type = prompt('Enter type:', asset.type) || asset.type;
    asset.tier = prompt('Enter tier:', asset.tier) || asset.tier;
    asset.description = prompt('Enter description:', asset.description) || asset.description;
    asset.cost = parseInt(prompt('Enter XP cost:', asset.cost) || '4');
    asset.freeUse = prompt('Enter Free Use:', asset.freeUse) || asset.freeUse;
    asset.sceneSurge = prompt('Enter Scene Surge:', asset.sceneSurge) || asset.sceneSurge;
    asset.source = 'local';
    saveFactionData();
    refreshView();
    closeFactionModal();
    showToast(`Updated asset: ${name}`, 'success');
};

window.deleteAsset = function(id) {
    const asset = state.assets.find(a => a.id === id);
    if (!asset) return;
    if (!confirm(`Delete asset "${asset.name}"?`)) return;
    state.assets = state.assets.filter(a => a.id !== id);
    saveFactionData();
    refreshView();
    closeFactionModal();
    showToast(`Deleted asset: ${asset.name}`, 'info');
};

window.changeAssetStatus = function(id, status) {
    const asset = state.assets.find(a => a.id === id);
    if (!asset) return;
    asset.status = status;
    saveFactionData();
    refreshView();
    closeFactionModal();
    const statusInfo = ASSET_STATUS[status];
    showToast(`${asset.name}: ${statusInfo.icon} ${statusInfo.label}`, 'info');
};

// ============================================================
// CRUD OPERATIONS - FOLLOWERS
// ============================================================

window.addFollower = function() {
    const name = prompt('Enter follower name:');
    if (!name) return;

    state.followers.push({
        id: 'follower-' + Date.now(),
        name,
        role: prompt('Enter role:') || 'Follower',
        cap: parseInt(prompt('Enter Cap (1-5):') || '1'),
        description: prompt('Enter description:') || 'A follower.',
        loyalty: prompt('Enter loyalty (faithful/strained/broken):') || 'faithful',
        fitness: prompt('Enter fitness (ready/hurt/down):') || 'ready',
        source: 'local'
    });
    saveFactionData();
    refreshView();
    showToast(`Added follower: ${name}`, 'success');
};

window.editFollower = function(id) {
    const follower = state.followers.find(f => f.id === id);
    if (!follower) return;
    const name = prompt('Enter name:', follower.name);
    if (!name) return;
    follower.name = name;
    follower.role = prompt('Enter role:', follower.role) || follower.role;
    follower.cap = parseInt(prompt('Enter Cap:', follower.cap) || '1');
    follower.description = prompt('Enter description:', follower.description) || follower.description;
    follower.source = 'local';
    saveFactionData();
    refreshView();
    closeFactionModal();
    showToast(`Updated follower: ${name}`, 'success');
};

window.deleteFollower = function(id) {
    const follower = state.followers.find(f => f.id === id);
    if (!follower) return;
    if (!confirm(`Delete follower "${follower.name}"?`)) return;
    state.followers = state.followers.filter(f => f.id !== id);
    saveFactionData();
    refreshView();
    closeFactionModal();
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
    closeFactionModal();
    const label = type === 'loyalty' ? 'Loyalty' : 'Fitness';
    showToast(`${label}: ${current} → ${next}`, 'info');
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
        description: prompt('Enter description:') || 'A player trust.',
        maxAssets: parseInt(prompt('Enter max asset slots:') || '2'),
        maxAssetTier: prompt('Enter max asset tier (Minor/Standard/Major):') || 'Standard',
        assets: [],
        followers: [],
        obligation: 0,
        capacity: parseInt(prompt('Enter obligation capacity:') || '4'),
        source: 'local'
    });
    saveFactionData();
    refreshView();
    showToast(`Created trust: ${name}`, 'success');
};

window.editTrust = function(id) {
    const trust = state.trusts.find(t => t.id === id);
    if (!trust) return;
    const name = prompt('Enter name:', trust.name);
    if (!name) return;
    trust.name = name;
    trust.icon = prompt('Enter icon:', trust.icon) || trust.icon;
    trust.tier = prompt('Enter tier:', trust.tier) || trust.tier;
    trust.description = prompt('Enter description:', trust.description) || trust.description;
    trust.maxAssets = parseInt(prompt('Enter max asset slots:', trust.maxAssets) || '2');
    trust.maxAssetTier = prompt('Enter max asset tier:', trust.maxAssetTier) || trust.maxAssetTier;
    trust.capacity = parseInt(prompt('Enter obligation capacity:', trust.capacity) || '4');
    trust.source = 'local';
    saveFactionData();
    refreshView();
    closeFactionModal();
    showToast(`Updated trust: ${name}`, 'success');
};

window.deleteTrust = function(id) {
    const trust = state.trusts.find(t => t.id === id);
    if (!trust) return;
    if (!confirm(`Delete trust "${trust.name}"?`)) return;
    state.trusts = state.trusts.filter(t => t.id !== id);
    saveFactionData();
    refreshView();
    closeFactionModal();
    showToast(`Deleted trust: ${trust.name}`, 'info');
};

window.addTrustAsset = function(trustId) {
    const trust = state.trusts.find(t => t.id === trustId);
    if (!trust) return;
    if (!trust.assets) trust.assets = [];

    const availableAssets = state.assets.filter(a => !trust.assets.includes(a.id));
    if (availableAssets.length === 0) {
        showToast('No available assets to add. Create a new asset first.', 'warning');
        return;
    }

    const assetOptions = availableAssets.map((a, i) => `${i+1}. ${a.name} (${a.tier})`).join('\n');
    const choice = prompt(`Select an asset to add to "${trust.name}":\n${assetOptions}\n\nEnter number:`);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= availableAssets.length) {
        showToast('Invalid selection', 'error');
        return;
    }
    const selected = availableAssets[idx];
    trust.assets.push(selected.id);

    if (trust.assets.length > (trust.maxAssets || 2)) {
        showToast(`Warning: Trust now has ${trust.assets.length} assets, exceeding its capacity of ${trust.maxAssets || 2}.`, 'warning');
    }

    saveFactionData();
    refreshView();
    closeFactionModal();
    showToast(`Added ${selected.name} to ${trust.name}`, 'success');
};

window.addTrustFollower = function(trustId) {
    const trust = state.trusts.find(t => t.id === trustId);
    if (!trust) return;
    if (!trust.followers) trust.followers = [];

    const availableFollowers = state.followers.filter(f => !trust.followers.includes(f.id));
    if (availableFollowers.length === 0) {
        showToast('No available followers to add. Create a new follower first.', 'warning');
        return;
    }

    const followerOptions = availableFollowers.map((f, i) => `${i+1}. ${f.name} (Cap ${f.cap})`).join('\n');
    const choice = prompt(`Select a follower to add to "${trust.name}":\n${followerOptions}\n\nEnter number:`);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= availableFollowers.length) {
        showToast('Invalid selection', 'error');
        return;
    }
    const selected = availableFollowers[idx];
    trust.followers.push(selected.id);

    saveFactionData();
    refreshView();
    closeFactionModal();
    showToast(`Added ${selected.name} to ${trust.name}`, 'success');
};

// ============================================================
// VIEW MANAGEMENT
// ============================================================

function refreshView() {
    const container = document.getElementById('factions-view-container');
    if (container) {
        container.innerHTML = renderView(state.viewMode);
    }
    attachEvents();
}

window.refreshFactions = function() {
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
            const view = tab.dataset.view;
            const container = document.getElementById('factions-view-container');
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