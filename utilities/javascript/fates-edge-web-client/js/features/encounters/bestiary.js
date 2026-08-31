/**
 * Bestiary – Creature reference with wiki integration
 * Uses multi‑path discovery (like Search) with fallback to manifest + individual files
 * Integrated with Combat Tracker: one-click to open tracker with creature added
 *
 * Now supports:
 * - tl 1–10 (the single adversary rating; see the SRD, 'Rating an Adversary'),
 *   harm_levels, nature, services, price, lore, signs, connections
 * - Story Beat (SB) moves sub-panel with GM SB bank
 * - Creature-specific sb_spends rendered in detail modal
 * - Filtering by TL, nature, region
 * - Detail modal shows all relevant fields
 * - Combat Tracker integration uses tl for default difficulty/HP
 */

import { getState, saveState } from '@core/state.js';
import { escHtml } from '@core/utils.js';
import { showToast } from '@components/Toast.js';
import { logToSession, addVTTEvent } from '@features/gm-tools/index.js';
import { discoverBestiary } from '@core/discovery.js';
import { openTracker } from './combat.js'; // 👈 Integration import

// Harm Levels follow from Threat Level, per the SRD's adversary rating.
// "None (puzzle)" is the one override and is carried on the creature itself.
export function harmLevelsForTl(tl) {
    const n = parseInt(tl, 10) || 1;
    if (n <= 4) return '3 (standard)';
    if (n <= 6) return '8 (advanced)';
    if (n <= 9) return '8 per phase';
    return 'None (puzzle)';
}

let container = null;
let bestiaryData = [];
let wikiData = {};

// ============================================================
// STORY BEAT STATE (local, no dependency on combat)
// ============================================================

const SB_BANK_KEY = 'fates-edge-gm-sb-bank';
let gmStoryBeats = 0;

const DEFAULT_SB_MOVES = [
    {
        cost: 1,
        name: 'Minor Complication',
        effect: 'Tick a timer +1, leave a trace, make a noise, or introduce a small distraction.'
    },
    {
        cost: 2,
        name: 'Moderate Complication',
        effect: 'Raise an alarm, worsen the party’s Position, introduce a lesser foe, or damage an asset.'
    },
    {
        cost: 3,
        name: 'Major Complication',
        effect: 'Bring reinforcements, shift the scene, test a bond, or land a serious consequence.'
    }
];

function loadStoryBeatsBank() {
    try {
        const stored = localStorage.getItem(SB_BANK_KEY);
        gmStoryBeats = stored ? Math.max(0, parseInt(stored, 10)) : 0;
    } catch (_) {
        gmStoryBeats = 0;
    }
}

function saveStoryBeatsBank() {
    try {
        localStorage.setItem(SB_BANK_KEY, String(gmStoryBeats));
    } catch (_) {}
}

function adjustStoryBeats(delta) {
    gmStoryBeats = Math.max(0, gmStoryBeats + delta);
    saveStoryBeatsBank();
    renderStoryBeatsPanel();
}

function spendStoryBeats(cost, label) {
    if (gmStoryBeats < cost) {
        showToast(`Need ${cost} SB; only ${gmStoryBeats} available.`, 'warning');
        return false;
    }
    gmStoryBeats -= cost;
    saveStoryBeatsBank();
    renderStoryBeatsPanel();
    try {
        logToSession(`💥 SB spent (${cost}): ${label}`, 'danger');
        addVTTEvent('sb_spent', { cost, label });
    } catch (e) { /* ignore */ }
    showToast(`Spent ${cost} SB — ${label}`, 'success');
    return true;
}

// ============================================================
// CONSTANTS – Multiple possible paths for bestiary.json
// ============================================================

const BESTIARY_PATHS = [
    '/data/bestiary.json',
    '/data/bestiary/bestiary.json',
    'data/bestiary.json',
    'data/bestiary/bestiary.json',
    './data/bestiary.json',
    './data/bestiary/bestiary.json'
];

const BESTIARY_INDIVIDUAL_PATH = './data/bestiary/';
const CACHE_KEY = 'fates-edge-bestiary-cache';

// Hardcoded fallback entries (if everything else fails)
const FALLBACK_ENTRIES = [
    { id: 'goblin-scavenger', name: 'Goblin Scavenger', category: 'humanoid', tl: 1, harmLevels: '3 (standard)', description: 'A small, green-skinned creature with sharp teeth and a greedy glint.' },
    { id: 'skeleton-knight', name: 'Skeleton Knight', category: 'undead', tl: 2, harmLevels: '3 (standard)', description: 'An animated suit of armor with hollow eye sockets glowing with pale blue light.' },
    { id: 'thorn-dryad', name: 'Thorn Dryad', category: 'fey', tl: 3, harmLevels: '3 (standard)', description: 'A fey creature with bark-like skin and thorny vines for hair.' }
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

// ─── flatten wrapped { "Creature Name": {...fields} } entries ───
function flattenWrappedEntry(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    if (raw.name) return raw;
    const keys = Object.keys(raw);
    if (keys.length === 1 && raw[keys[0]] && typeof raw[keys[0]] === 'object') {
        const name = keys[0];
        const inner = raw[keys[0]];
        return {
            name,
            // prefer summary or lore for description, but keep all fields
            description: inner.summary || inner.lore || inner.description || '',
            summary: inner.summary || '',
            lore: inner.lore || '',
            locations: inner.locations || [],
            connections: inner.connections || [],
            page: inner.page || '',
            // new fields
            tl: inner.tl,
            harm_levels: inner.harm_levels,
            nature: inner.nature,
            services: inner.services || [],
            price: inner.price,
            signs: inner.signs || [],
            sb_spends: inner.sb_spends || null,
            // preserve any other fields
            ...inner
        };
    }
    return raw;
}

function normalizeCreature(c) {
    if (!c) return c;
    let result = flattenWrappedEntry(c);
    result = { ...result };
    if (!result.name && result.title) result.name = result.title;
    if (result.description && typeof result.description === 'object') {
        if (result.description.description) {
            result._rawDescription = result.description;
            result.description = result.description.description;
        } else if (result.lore && result.lore.description) {
            result._rawDescription = result.description;
            result.description = result.lore.description;
        }
    }
    // Ensure numeric tl
    if (result.tl !== undefined && result.tl !== null) {
        result.tl = parseInt(result.tl, 10);
    }
    return result;
}

function sortByName(a, b) {
    const nameA = (a.name || a.title || '').toLowerCase();
    const nameB = (b.name || b.title || '').toLowerCase();
    return nameA.localeCompare(nameB);
}

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

// 👇 EXPORTED for use by combat
export function getCreatureDescription(entry) {
    if (!entry) return 'No description available.';
    if (typeof entry.description === 'string' && entry.description) return entry.description;
    if (entry.description && typeof entry.description === 'object') {
        if (entry.description.description) return entry.description.description;
        if (entry.description.lore) return entry.description.lore;
        if (entry.description.quote) return entry.description.quote;
        if (entry.description.text) return entry.description.text;
        let parts = [];
        if (entry.description.followers) parts.push(entry.description.followers);
        if (entry.description.apocalyptic_aspect) parts.push(entry.description.apocalyptic_aspect);
        if (parts.length > 0) return parts.join('\n\n');
    }
    if (entry.summary) return entry.summary;
    if (entry.lore && typeof entry.lore === 'object') {
        if (entry.lore.description) return entry.lore.description;
        if (entry.lore.lore) return entry.lore.lore;
    }
    if (typeof entry.lore === 'string') return entry.lore;
    return safeString(entry.description) || 'No description available.';
}

function formatSBMove(move) {
    const cost = parseInt(move.cost, 10) || 1;
    const name = move.name || 'Unnamed Move';
    const effect = move.effect || move.description || '';
    return `
        <div class="sb-move" style="
            background:var(--bg2);
            border:1px solid var(--border);
            border-radius:var(--radius-sm);
            padding:0.4rem 0.6rem;
            margin-bottom:0.3rem;
            font-size:0.8rem;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">
                <strong style="color:var(--danger);">${escHtml(name)}</strong>
                <button class="btn btn-xs btn-danger sb-spend-btn" data-cost="${cost}" data-label="${escHtml(name)}" title="Spend ${cost} SB">
                    ${cost} SB
                </button>
            </div>
            <div style="color:var(--text2);margin-top:0.2rem;">${escHtml(effect)}</div>
        </div>
    `;
}

// ============================================================
// DATA LOADING – Multi‑path discovery + shared discoverBestiary
// ============================================================

async function loadBestiaryFromPaths() {
    for (const path of BESTIARY_PATHS) {
        try {
            // Add cache-busting timestamp
            const url = path + (path.includes('?') ? '&' : '?') + 't=' + Date.now();
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const flattened = data.map(flattenWrappedEntry).filter(e => e && e.name);
                    if (flattened.length > 0) {
                        console.log(`[Bestiary] Loaded from ${path} (${flattened.length} entries)`);
                        return flattened.map(normalizeCreature);
                    }
                    console.warn(`[Bestiary] ${path} returned ${data.length} entries but none had a resolvable name after flattening.`);
                }
            }
        } catch (_) { /* ignore */ }
    }
    return null;
}

async function loadBestiaryFromIndividualFiles() {
    const slugs = await discoverBestiary(BESTIARY_INDIVIDUAL_PATH);
    if (slugs.length === 0) return null;
    const creatures = [];
    for (const slug of slugs) {
        try {
            const fileRes = await fetch(`${BESTIARY_INDIVIDUAL_PATH}${slug}.json?t=${Date.now()}`, { cache: 'no-cache' });
            if (fileRes.ok) {
                const data = await fileRes.json();
                const flat = flattenWrappedEntry(data);
                if (!flat.id) flat.id = slug;
                creatures.push(normalizeCreature(flat));
            }
        } catch (_) {}
    }
    if (creatures.length > 0) {
        console.log(`[Bestiary] Loaded ${creatures.length} creatures from individual files via discovery`);
        return creatures.sort(sortByName);
    }
    return null;
}

async function loadFallbackBestiary() {
    console.log('[Bestiary] Using hardcoded fallback entries');
    return FALLBACK_ENTRIES.map(normalizeCreature);
}

export async function loadBestiaryData() {
    // Try cache first (but only if not too old? we'll use it but still refresh)
    try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            if (Array.isArray(data) && data.length > 0) {
                console.log(`[Bestiary] Loaded ${data.length} entries from cache`);
                bestiaryData = data;
                return bestiaryData;
            }
        }
    } catch (_) {}

    // Fetch fresh
    let data = await loadBestiaryFromPaths();
    if (data) {
        bestiaryData = data;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {}
        return bestiaryData;
    }

    data = await loadBestiaryFromIndividualFiles();
    if (data) {
        bestiaryData = data;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {}
        return bestiaryData;
    }

    data = await loadFallbackBestiary();
    bestiaryData = data;
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {}
    return bestiaryData;
}

export async function loadWikiData() {
    try {
        const response = await fetch('/data/wiki.json?t=' + Date.now(), { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        wikiData = data || {};
        return wikiData;
    } catch (err) {
        console.warn('Failed to load wiki:', err);
        wikiData = {};
        return {};
    }
}

// ============================================================
// RENDER
// ============================================================

export async function render(el) {
    container = el;
    container.innerHTML = `
        <div class="bestiary-layout" style="padding:1rem;">
            <header style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem;">
                <div>
                    <h1 class="page-title" style="margin:0;">📖 Bestiary</h1>
                    <p class="page-sub" style="margin:0.2rem 0 0;">Creatures, monsters, and spirits of the Crown Spread.</p>
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                    <input type="text" id="bestiary-search" placeholder="🔍 Search…" style="font-size:0.9rem;padding:0.3rem 0.6rem;width:140px;" />
                    <button class="btn btn-sm btn-ghost" id="bestiary-refresh" title="Refresh data">↻</button>
                </div>
            </header>

            <!-- Filter Bar -->
            <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.8rem;align-items:center;background:var(--bg-panel);padding:0.4rem 0.6rem;border-radius:var(--radius-sm);border:1px solid var(--border);">
                <span style="font-size:0.75rem;color:var(--text3);margin-right:0.2rem;">Filter:</span>
                <select id="bestiary-filter-tl" style="font-size:0.75rem;padding:0.1rem 0.3rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;">
                    <option value="all">All TL</option>
                    ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}">TL ${n}</option>`).join('')}
                </select>
                <select id="bestiary-filter-nature" style="font-size:0.75rem;padding:0.1rem 0.3rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;max-width:120px;">
                    <option value="all">All Natures</option>
                    <!-- options will be populated from data -->
                </select>
                <select id="bestiary-filter-region" style="font-size:0.75rem;padding:0.1rem 0.3rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;max-width:120px;">
                    <option value="all">All Regions</option>
                    <!-- options will be populated from data -->
                </select>
                <button class="btn btn-xs btn-secondary" id="bestiary-clear-filters" style="font-size:0.7rem;">✕ Clear</button>
            </div>

            <div style="display:grid;grid-template-columns:2fr 1fr;gap:1rem;">
                <div class="bestiary-list" id="bestiary-list" style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:0.5rem;max-height:70vh;overflow-y:auto;">
                    <div style="text-align:center;padding:2rem;color:var(--text3);">
                        <div style="font-size:2rem;margin-bottom:0.5rem;">🔄</div>
                        <div>Loading bestiary…</div>
                    </div>
                </div>
                <div class="bestiary-sidebar" style="display:flex;flex-direction:column;gap:0.8rem;">
                    <div class="panel" style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:0.8rem;">
                        <h3 style="margin-top:0;">📋 Quick Categories</h3>
                        <div id="bestiary-categories" style="display:flex;flex-wrap:wrap;gap:0.3rem;"></div>
                    </div>
                    <div class="panel" id="bestiary-sb-panel" style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:0.8rem;">
                        <h3 style="margin-top:0;">⚡ Story Beats</h3>
                        <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;">
                            <span style="font-size:0.8rem;color:var(--text2);">Bank:</span>
                            <button class="btn btn-xs btn-ghost" id="sb-minus" style="font-weight:bold;">−</button>
                            <input type="number" id="sb-bank-input" value="0" min="0" style="width:50px;font-size:0.85rem;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.15rem;" />
                            <button class="btn btn-xs btn-ghost" id="sb-plus" style="font-weight:bold;">+</button>
                        </div>
                        <div id="sb-moves-list" style="display:flex;flex-direction:column;gap:0.2rem;"></div>
                        <div style="font-size:0.7rem;color:var(--text3);margin-top:0.4rem;">
                            Spend SB on monster moves or default complications. Creature-specific moves appear in detail view.
                        </div>
                    </div>
                    <div class="panel" style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:0.8rem;">
                        <h3 style="margin-top:0;">🔗 Wiki Cross‑Reference</h3>
                        <div id="bestiary-wiki-refs" style="font-size:0.85rem;color:var(--text2);">
                            Select a creature to see wiki links.
                        </div>
                    </div>
                    <div class="panel" style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:0.8rem;">
                        <h3 style="margin-top:0;">⚔️ Quick Actions</h3>
                        <div style="display:flex;flex-direction:column;gap:0.3rem;">
                            <button class="btn btn-sm btn-gold" id="bestiary-add-encounter">+ Add as Encounter</button>
                            <button class="btn btn-sm" id="bestiary-add-adversary">+ Add as Adversary</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    loadStoryBeatsBank();
    await loadBestiaryData();
    await loadWikiData();
    populateFilterOptions();
    renderBestiaryList();
    renderCategories();
    renderStoryBeatsPanel();
    attachEvents();
}

// ============================================================
// STORY BEAT PANEL
// ============================================================

function renderStoryBeatsPanel() {
    const bankInput = document.getElementById('sb-bank-input');
    if (bankInput) bankInput.value = gmStoryBeats;

    const movesList = document.getElementById('sb-moves-list');
    if (!movesList) return;

    movesList.innerHTML = DEFAULT_SB_MOVES.map(formatSBMove).join('');

    movesList.querySelectorAll('.sb-spend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cost = parseInt(btn.dataset.cost, 10);
            const label = btn.dataset.label;
            spendStoryBeats(cost, label);
        });
    });
}

// ============================================================
// POPULATE FILTER DROPDOWNS
// ============================================================

function populateFilterOptions() {
    const natures = [...new Set(bestiaryData.map(e => e.nature).filter(Boolean))];
    const regions = [...new Set(bestiaryData.flatMap(e => e.connections || []).filter(Boolean))];

    const natureSelect = document.getElementById('bestiary-filter-nature');
    if (natureSelect) {
        natureSelect.innerHTML = '<option value="all">All Natures</option>' +
            natures.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('');
    }

    const regionSelect = document.getElementById('bestiary-filter-region');
    if (regionSelect) {
        regionSelect.innerHTML = '<option value="all">All Regions</option>' +
            regions.map(r => `<option value="${escHtml(r)}">${escHtml(r)}</option>`).join('');
    }
}

// ============================================================
// RENDER LIST with filters
// ============================================================

function renderBestiaryList() {
    const listEl = document.getElementById('bestiary-list');
    if (!listEl) return;

    // Get filter values
    const searchTerm = (document.getElementById('bestiary-search')?.value || '').toLowerCase().trim();
    const tlFilter = document.getElementById('bestiary-filter-tl')?.value || 'all';
    const natureFilter = document.getElementById('bestiary-filter-nature')?.value || 'all';
    const regionFilter = document.getElementById('bestiary-filter-region')?.value || 'all';

    const filteredData = bestiaryData.filter(entry => {
        const name = (entry.name || '').toLowerCase();
        const desc = (getCreatureDescription(entry) || '').toLowerCase();
        const category = (entry.category || '').toLowerCase();
        const matchSearch = name.includes(searchTerm) || desc.includes(searchTerm) || category.includes(searchTerm);
        if (!matchSearch) return false;

        // TL
        if (tlFilter !== 'all') {
            const entryTl = entry.tl !== undefined ? parseInt(entry.tl, 10) : null;
            if (entryTl !== parseInt(tlFilter, 10)) return false;
        }

        // Nature
        if (natureFilter !== 'all') {
            if ((entry.nature || '').toLowerCase() !== natureFilter.toLowerCase()) return false;
        }

        // Region
        if (regionFilter !== 'all') {
            const conns = (entry.connections || []).map(c => c.toLowerCase());
            if (!conns.some(c => c.includes(regionFilter.toLowerCase()))) return false;
        }

        return true;
    });

    if (filteredData.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center;padding:2rem;color:var(--text3);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">🦴</div>
                <div>${bestiaryData.length === 0 ? 'No bestiary data loaded.' : 'No creatures match your filters.'}</div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filteredData.map(entry => {
        const name = entry.name || 'Unnamed';
        const safeName = name.replace(/["']/g, '');
        const categoryBadge = entry.category
            ? `<span class="badge badge-${getCategoryBadgeColor(entry.category)}" style="font-size:0.65rem;">${escHtml(entry.category)}</span>`
            : '';
        const tlDisplay = entry.tl ? `TL ${entry.tl}` : '';
        const harmDisplay = entry.harm_levels ? `${entry.harm_levels} Harm Levels` : '';
        const description = getCreatureDescription(entry);

        return `
            <div class="bestiary-entry" data-id="${entry.id || safeName}" style="
                background:var(--bg3);
                border:1px solid var(--border);
                border-radius:var(--radius-sm);
                padding:0.6rem 0.8rem;
                margin-bottom:0.4rem;
                cursor:pointer;
                transition:border-color 0.2s, background 0.2s;
                display:flex;
                flex-wrap:wrap;
                justify-content:space-between;
                align-items:center;
            ">
                <div style="flex:1;min-width:150px;">
                    <div style="font-weight:600;display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        ${escHtml(name)}
                        ${categoryBadge}
                        ${tlDisplay ? `<span style="font-size:0.7rem;color:var(--text2);background:var(--bg2);padding:0.05rem 0.4rem;border-radius:12px;">${tlDisplay}</span>` : ''}
                        ${classDisplay ? `<span style="font-size:0.7rem;color:var(--text2);background:var(--bg2);padding:0.05rem 0.4rem;border-radius:12px;">${harmDisplay}</span>` : ''}
                        ${entry.nature ? `<span style="font-size:0.65rem;color:var(--text3);">${escHtml(entry.nature)}</span>` : ''}
                    </div>
                    <div style="font-size:0.8rem;color:var(--text2);">
                        ${description ? escHtml(description.slice(0, 100)) + (description.length > 100 ? '…' : '') : ''}
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-primary bestiary-detail" data-name="${escHtml(safeName)}" title="Details">📄</button>
                    <button class="btn btn-xs btn-gold bestiary-add-adversary" data-name="${escHtml(safeName)}" title="Add as Adversary">⚔️</button>
                    <button class="btn btn-xs btn-gold bestiary-open-tracker" data-name="${escHtml(safeName)}" title="Open Combat Tracker">🎯</button>
                </div>
            </div>
        `;
    }).join('');

    // Attach events – use case‑insensitive lookup
    listEl.querySelectorAll('.bestiary-detail').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            const entry = bestiaryData.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
            if (entry) showCreatureDetail(entry);
        });
    });

    listEl.querySelectorAll('.bestiary-add-adversary').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            const entry = bestiaryData.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
            if (entry) addCreatureAsAdversary(entry);
            else showToast(`Creature "${name}" not found.`, 'error');
        });
    });

    listEl.querySelectorAll('.bestiary-open-tracker').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            const entry = bestiaryData.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
            if (entry) openTrackerForCreature(entry);
            else showToast(`Creature "${name}" not found.`, 'error');
        });
    });

    listEl.querySelectorAll('.bestiary-entry').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.dataset.id;
            const entry = bestiaryData.find(e => (e.id || e.name || '').toLowerCase() === id.toLowerCase());
            if (entry) showCreatureDetail(entry);
        });
    });
}

// ============================================================
// CATEGORY BADGE COLORS
// ============================================================

function getCategoryBadgeColor(category) {
    if (!category) return 'gold';
    const map = {
        'beast': 'green',
        'undead': 'red',
        'humanoid': 'blue',
        'fiend': 'purple',
        'construct': 'gold',
        'plant': 'green',
        'dragon': 'red',
        'elemental': 'blue',
        'celestial': 'gold',
        'abomination': 'purple'
    };
    return map[category.toLowerCase()] || 'gold';
}

// ============================================================
// RENDER CATEGORIES
// ============================================================

function renderCategories() {
    const el = document.getElementById('bestiary-categories');
    if (!el) return;
    const categories = [...new Set(bestiaryData.map(e => e.category).filter(Boolean))];
    if (categories.length === 0) {
        el.innerHTML = '<span style="color:var(--text3);font-size:0.8rem;">No categories available.</span>';
        return;
    }
    el.innerHTML = categories.map(cat => `
        <span class="category-pill" data-category="${escHtml(cat)}" style="
            display:inline-block;
            background:var(--bg2);
            border:1px solid var(--border);
            border-radius:20px;
            padding:0.1rem 0.6rem;
            font-size:0.7rem;
            cursor:pointer;
            transition:all 0.2s;
            color:var(--text2);
        ">${escHtml(cat)}</span>
    `).join('');

    el.querySelectorAll('.category-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const cat = pill.dataset.category;
            const searchInput = document.getElementById('bestiary-search');
            if (searchInput) {
                searchInput.value = cat;
                renderBestiaryList();
            }
        });
    });
}

// ============================================================
// DETAIL VIEW (modal) – now shows all new fields + SB moves
// ============================================================

function showCreatureDetail(entry) {
    const name = entry.name || 'Unnamed';
    const wikiEntry = wikiData[name] || wikiData[name.toLowerCase()] || null;
    const wikiLink = wikiEntry ? `<div style="margin-top:0.5rem;"><strong>Wiki:</strong> <a href="#" onclick="window.openWiki('${encodeURIComponent(name)}')">${escHtml(name)}</a></div>` : '';

    // Build sections
    let statsHtml = '';
    if (entry.stats && typeof entry.stats === 'object') {
        statsHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;font-size:0.85rem;">';
        for (const [key, value] of Object.entries(entry.stats)) {
            statsHtml += `<div style="font-weight:600;">${escHtml(key)}</div><div>${escHtml(String(value))}</div>`;
        }
        statsHtml += '</div>';
    }

    let extraHtml = '';
    if (entry.locations && entry.locations.length > 0) {
        extraHtml += `<div style="margin-top:0.5rem;"><strong>Locations:</strong> ${entry.locations.map(l => escHtml(l)).join(', ')}</div>`;
    }
    if (entry.connections && entry.connections.length > 0) {
        extraHtml += `<div style="margin-top:0.3rem;"><strong>Connections:</strong> ${entry.connections.map(c => escHtml(c)).join(', ')}</div>`;
    }
    if (entry.signs && entry.signs.length > 0) {
        extraHtml += `<div style="margin-top:0.3rem;"><strong>Signs:</strong> ${entry.signs.map(s => escHtml(s)).join(', ')}</div>`;
    }

    // Summoner-specific info
    let summonerHtml = '';
    if (entry.nature || entry.services || entry.price) {
        summonerHtml = `<div style="margin-top:0.5rem;border-top:1px solid var(--border);padding-top:0.5rem;">
            <h4 style="margin:0 0 0.3rem 0;color:var(--gold);">🔮 Summoner Notes</h4>`;
        if (entry.nature) summonerHtml += `<div><strong>Nature:</strong> ${escHtml(entry.nature)}</div>`;
        if (entry.services && entry.services.length > 0) {
            summonerHtml += `<div><strong>Services:</strong> ${entry.services.map(s => escHtml(s)).join(', ')}</div>`;
        }
        if (entry.price) summonerHtml += `<div><strong>Price:</strong> ${escHtml(entry.price)}</div>`;
        summonerHtml += `</div>`;
    }

    // Story Beat moves for this creature
    let sbMovesHtml = '';
    if (entry.sb_spends && Array.isArray(entry.sb_spends) && entry.sb_spends.length > 0) {
        sbMovesHtml = entry.sb_spends.map(formatSBMove).join('');
    } else {
        sbMovesHtml = `<p style="font-size:0.8rem;color:var(--text3);margin:0 0 0.4rem 0;">
            No specific Story Beat moves recorded yet. Use the default SB menu in the sidebar.
        </p>` + DEFAULT_SB_MOVES.map(formatSBMove).join('');
    }

    const description = getCreatureDescription(entry);
    const lore = entry.lore ? formatText(entry.lore) : '';

    // Inline editor screen — takes over the bestiary view in place instead
    // of floating above it as a pop-up.
    const overlay = document.createElement('div');
    overlay.className = 'editor-screen-host';

    overlay.innerHTML = `
        <div class="editor-screen" style="max-width:600px;margin:0 auto;">
            <button class="btn btn-secondary editor-back creature-detail-close">← Back</button>
            <h2 style="margin-top:0;color:var(--gold);display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                ${escHtml(name)}
                ${entry.tl ? `<span style="font-size:0.7rem;color:var(--text2);background:var(--bg2);padding:0.05rem 0.5rem;border-radius:12px;">TL ${entry.tl}</span>` : ''}
                ${entry.harm_levels ? `<span style="font-size:0.7rem;color:var(--text2);background:var(--bg2);padding:0.05rem 0.5rem;border-radius:12px;">Harm Levels: ${escHtml(entry.harm_levels)}</span>` : ''}
            </h2>
            ${entry.category ? `<span class="badge badge-${getCategoryBadgeColor(entry.category)}" style="margin-bottom:0.5rem;">${escHtml(entry.category)}</span>` : ''}
            ${description ? `<div style="margin:0.5rem 0;line-height:1.5;">${escHtml(description)}</div>` : ''}
            ${lore ? `<div style="margin:0.5rem 0;line-height:1.5;background:var(--bg2);padding:0.5rem;border-radius:var(--radius-sm);border-left:3px solid var(--gold);"><strong>Lore:</strong> ${lore}</div>` : ''}
            ${statsHtml}
            ${extraHtml}
            ${summonerHtml}
            ${wikiLink}
            <div style="margin-top:0.6rem;border-top:1px solid var(--border);padding-top:0.6rem;">
                <h4 style="margin:0 0 0.4rem 0;color:var(--danger);">⚡ Story Beat Moves</h4>
                ${sbMovesHtml}
            </div>
            <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button class="btn btn-sm btn-gold add-adversary-from-detail" data-name="${escHtml(name)}">⚔️ Add as Adversary</button>
                <button class="btn btn-sm btn-primary add-encounter-from-detail" data-name="${escHtml(name)}">📋 Add to Encounter</button>
                <button class="btn btn-sm btn-gold open-tracker-from-detail" data-name="${escHtml(name)}">🎯 Open Tracker</button>
            </div>
        </div>
    `;

    const hostContainer = document.getElementById('app-content') || document.body;
    const hiddenSiblings = Array.from(hostContainer.children);
    hiddenSiblings.forEach(ch => { ch.style.display = 'none'; });
    hostContainer.appendChild(overlay);
    window.scrollTo({ top: 0 });

    const closeDetail = () => {
        overlay.remove();
        hiddenSiblings.forEach(ch => { ch.style.display = ''; });
    };

    overlay.querySelector('.creature-detail-close').addEventListener('click', closeDetail);

    overlay.querySelector('.add-adversary-from-detail').addEventListener('click', () => {
        addCreatureAsAdversary(entry);
        closeDetail();
    });

    overlay.querySelector('.add-encounter-from-detail').addEventListener('click', () => {
        addCreatureToEncounter(entry);
        closeDetail();
    });

    overlay.querySelector('.open-tracker-from-detail').addEventListener('click', () => {
        openTrackerForCreature(entry);
        overlay.remove();
    });

    overlay.querySelectorAll('.sb-spend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cost = parseInt(btn.dataset.cost, 10);
            const label = btn.dataset.label;
            spendStoryBeats(cost, `${name}: ${label}`);
        });
    });
}

window.openWiki = function(name) {
    const event = new CustomEvent('wiki-navigate', { detail: { query: name } });
    document.dispatchEvent(event);
};

// ============================================================
// ACTIONS
// ============================================================

export function addCreatureAsAdversary(entry) {
    if (!entry || !entry.name) {
        showToast('Invalid creature data.', 'error');
        return;
    }
    const description = getCreatureDescription(entry);
    const state = getState();
    if (!state.encounters) state.encounters = [];
    let targetEncounter = state.encounters.find(e => e.status === 'active') || state.encounters[0];
    if (!targetEncounter) {
        const newEnc = {
            id: 'enc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            title: `Encounter with ${entry.name}`,
            body: description || '',
            difficulty: entry.tl || 2,
            location: '',
            status: 'draft',
            adversaries: [],
            created: Date.now()
        };
        state.encounters.push(newEnc);
        targetEncounter = newEnc;
    }
    const exists = targetEncounter.adversaries.some(a => a.name.toLowerCase() === entry.name.toLowerCase());
    if (!exists) {
        // Adversaries in Fate's Edge have no hit points. What they have is
        // Harm Levels — 3, 8, 8-per-phase, or None (a puzzle, not a fight) —
        // derived from TL unless the creature states None. See the SRD,
        // "Harm Levels, not Hit Points". This used to synthesise
        // `hp = tl * 10 + 10`, a stat the rules do not have.
        const stats = entry.stats ? { ...entry.stats } : {};
        targetEncounter.adversaries.push({
            name: entry.name,
            body: description || '',
            tl: entry.tl || 2,
            harmLevels: entry.harm_levels || harmLevelsForTl(entry.tl || 2),
            stats: stats,
            _original: {
                tl: entry.tl,
                harm_levels: entry.harm_levels,
                nature: entry.nature
            }
        });
        saveState();
        showToast(`⚔️ Added "${entry.name}" as adversary.`, 'success');
        try {
            logToSession(`⚔️ Adversary added: ${entry.name}`, 'warning');
            addVTTEvent('adversary_added', { name: entry.name });
        } catch (e) { /* ignore */ }
    } else {
        showToast(`"${entry.name}" already in encounter.`, 'info');
    }
}

function addCreatureToEncounter(entry) {
    if (!entry || !entry.name) {
        showToast('Invalid creature data.', 'error');
        return;
    }
    const description = getCreatureDescription(entry);
    const state = getState();
    if (!state.encounters) state.encounters = [];
    const newEnc = {
        id: 'enc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title: `${entry.name} Encounter`,
        body: description || '',
        difficulty: entry.tl || 2,
        location: '',
        status: 'draft',
        adversaries: [{
            name: entry.name,
            body: description || '',
            tl: entry.tl || 2,
            harmLevels: entry.harm_levels || harmLevelsForTl(entry.tl || 2),
            stats: entry.stats || {}
        }],
        created: Date.now()
    };
    state.encounters.push(newEnc);
    saveState();
    showToast(`📋 Created new encounter: ${newEnc.title}`, 'success');
    try {
        logToSession(`📋 Encounter created from bestiary: ${newEnc.title}`, 'info');
        addVTTEvent('encounter_created_from_bestiary', { name: newEnc.title });
    } catch (e) { /* ignore */ }
}

// 👇 Function to add creature and open tracker
function openTrackerForCreature(entry) {
    // Ensure added as adversary
    addCreatureAsAdversary(entry);
    // Find the encounter we just added to
    const state = getState();
    const encounter = state.encounters.find(e => e.status === 'active') || state.encounters[state.encounters.length - 1];
    if (encounter) {
        openTracker(encounter.id);
    } else {
        showToast('Could not find encounter to open tracker.', 'error');
    }
}

// ============================================================
// EVENTS
// ============================================================

function attachEvents() {
    const search = document.getElementById('bestiary-search');
    if (search) {
        search.addEventListener('input', () => renderBestiaryList());
    }

    // Filter dropdowns
    ['bestiary-filter-tl', 'bestiary-filter-nature', 'bestiary-filter-region'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => renderBestiaryList());
    });

    document.getElementById('bestiary-clear-filters')?.addEventListener('click', () => {
        document.getElementById('bestiary-filter-tl').value = 'all';
        document.getElementById('bestiary-filter-nature').value = 'all';
        document.getElementById('bestiary-filter-region').value = 'all';
        renderBestiaryList();
    });

    const refresh = document.getElementById('bestiary-refresh');
    if (refresh) {
        refresh.addEventListener('click', async () => {
            sessionStorage.removeItem(CACHE_KEY);
            await loadBestiaryData();
            await loadWikiData();
            populateFilterOptions();
            renderBestiaryList();
            renderCategories();
            showToast('Bestiary refreshed.', 'info');
        });
    }

    const addEncounterBtn = document.getElementById('bestiary-add-encounter');
    if (addEncounterBtn) {
        addEncounterBtn.addEventListener('click', () => {
            const event = new CustomEvent('navigate-tab', { detail: { tab: 'encounters' } });
            document.dispatchEvent(event);
            setTimeout(() => {
                const addBtn = document.getElementById('add-encounter-btn');
                if (addBtn) addBtn.click();
            }, 300);
        });
    }

    const addAdversaryBtn = document.getElementById('bestiary-add-adversary');
    if (addAdversaryBtn) {
        addAdversaryBtn.addEventListener('click', () => {
            const name = prompt('Enter creature name to add as adversary:');
            if (name) {
                const entry = bestiaryData.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
                if (entry) {
                    addCreatureAsAdversary(entry);
                } else {
                    showToast(`No creature found with name "${name}".`, 'error');
                }
            }
        });
    }

    // Story Beat bank controls
    const sbMinus = document.getElementById('sb-minus');
    const sbPlus = document.getElementById('sb-plus');
    const sbInput = document.getElementById('sb-bank-input');

    if (sbMinus) {
        sbMinus.addEventListener('click', () => adjustStoryBeats(-1));
    }
    if (sbPlus) {
        sbPlus.addEventListener('click', () => adjustStoryBeats(1));
    }
    if (sbInput) {
        sbInput.addEventListener('change', () => {
            const val = parseInt(sbInput.value, 10);
            gmStoryBeats = isNaN(val) ? 0 : Math.max(0, val);
            saveStoryBeatsBank();
            renderStoryBeatsPanel();
        });
    }
}

// ============================================================
// LIFECYCLE
// ============================================================

export function destroy() {
    container = null;
}

// ============================================================
// EXPORTS
// ============================================================

export {
    gmStoryBeats,
    adjustStoryBeats,
    spendStoryBeats,
    saveStoryBeatsBank,
    loadStoryBeatsBank,
    DEFAULT_SB_MOVES
};

export default {
    render,
    destroy,
    attachEvents,
    loadBestiaryData,
    loadWikiData,
    addCreatureAsAdversary,
    getCreatureDescription
};