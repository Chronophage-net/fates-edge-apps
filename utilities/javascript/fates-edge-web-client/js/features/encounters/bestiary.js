/**
 * Bestiary – Creature reference with wiki integration
 * Uses manifest discovery (like patrons) with fallback to /data/bestiary.json
 */

import { getState, saveState } from '../../core/state.js';
import { escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { logToSession, addVTTEvent } from '../gm-tools/index.js';

let container = null;
let bestiaryData = [];
let wikiData = {};

// ============================================================
// CONSTANTS
// ============================================================

const BESTIARY_DATA_PATH = './data/bestiary/';
const CACHE_KEY = 'fates-edge-bestiary-cache';
const CACHE_TTL = 3600000; // 1 hour

// Fallback known slugs (used if manifest missing)
const KNOWN_SLUGS = [
    'goblin-scavenger', 'skeleton-knight', 'thorn-dryad',
    'slavering-hound', 'cultist-fanatic', 'shadow-wraith'
];

// ============================================================
// HELPERS (reused from patrons pattern)
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

function normalizeCreature(c) {
    if (!c) return c;
    const result = { ...c };
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

function getCreatureDescription(entry) {
    if (!entry) return 'No description available.';
    if (typeof entry.description === 'string') return entry.description;
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
    if (entry.lore && typeof entry.lore === 'object') {
        if (entry.lore.description) return entry.lore.description;
        if (entry.lore.lore) return entry.lore.lore;
    }
    if (typeof entry.lore === 'string') return entry.lore;
    return safeString(entry.description) || 'No description available.';
}

// ============================================================
// DISCOVERY (manifest‑first, fallback to known slugs & bestiary.json)
// ============================================================

async function discoverBestiarySlugs() {
    // Check cache
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            if (data.slugs && Date.now() - data.timestamp < CACHE_TTL) {
                console.log(`[Bestiary] Using cached slugs (${data.slugs.length} items)`);
                return data.slugs;
            }
        }
    } catch (_) {}

    let slugs = [];

    // 1. Try to fetch manifest.json
    try {
        const res = await fetch(BESTIARY_DATA_PATH + 'manifest.json');
        if (res.ok) {
            const manifest = await res.json();
            if (Array.isArray(manifest)) {
                slugs = manifest;
                console.log(`[Bestiary] Loaded manifest (${slugs.length} items)`);
            } else if (manifest.slugs && Array.isArray(manifest.slugs)) {
                slugs = manifest.slugs;
                console.log(`[Bestiary] Loaded manifest slugs (${slugs.length} items)`);
            } else {
                console.warn('[Bestiary] Manifest is not an array or missing "slugs".');
            }
        }
    } catch (_) {}

    // 2. If no manifest, fall back to known slugs
    if (slugs.length === 0) {
        slugs = KNOWN_SLUGS;
        console.log(`[Bestiary] Using fallback known slugs (${slugs.length} items)`);
    }

    // 3. Test each slug with HEAD
    const found = [];
    await Promise.all(slugs.map(async (slug) => {
        try {
            const res = await fetch(`${BESTIARY_DATA_PATH}${slug}.json`, { method: 'HEAD' });
            if (res.ok) {
                found.push(slug);
            }
        } catch (_) {}
    }));

    // 4. If no files found, try the single bestiary.json as fallback
    if (found.length === 0) {
        try {
            const res = await fetch('/data/bestiary.json', { method: 'HEAD' });
            if (res.ok) {
                // Single file mode – we'll handle this separately in loadBestiaryData
                console.log('[Bestiary] Found single bestiary.json, using that instead.');
                // We'll store a special marker
                found.push('_single_file_');
            }
        } catch (_) {}
    }

    // Update cache
    try {
        const cacheData = { slugs: found, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (_) {}

    console.log(`[Bestiary] Found ${found.length} creature files (or single file)`);
    return found;
}

// ============================================================
// DATA LOADING
// ============================================================

export async function loadBestiaryData() {
    try {
        const slugs = await discoverBestiarySlugs();

        // If we have the single file marker, fetch the monolithic JSON
        if (slugs.length === 1 && slugs[0] === '_single_file_') {
            const response = await fetch('/data/bestiary.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            bestiaryData = Array.isArray(data) ? data.filter(e => e && e.name) : [];
            bestiaryData.sort(sortByName);
            console.log(`[Bestiary] Loaded ${bestiaryData.length} creatures from bestiary.json`);
            return bestiaryData;
        }

        // Otherwise, fetch each individual file
        const creatures = [];
        for (const slug of slugs) {
            try {
                const res = await fetch(`${BESTIARY_DATA_PATH}${slug}.json`);
                if (res.ok) {
                    const data = await res.json();
                    if (!data.id) data.id = slug;
                    creatures.push(normalizeCreature(data));
                }
            } catch (e) { /* ignore */ }
        }
        bestiaryData = creatures.filter(e => e && e.name).sort(sortByName);
        console.log(`[Bestiary] Loaded ${bestiaryData.length} creatures from individual files`);
        return bestiaryData;
    } catch (err) {
        console.warn('Failed to load bestiary:', err);
        showToast('Could not load bestiary data.', 'error');
        bestiaryData = [];
        return [];
    }
}

export async function loadWikiData() {
    try {
        const response = await fetch('/data/wiki.json');
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
                    <p class="page-sub" style="margin:0.2rem 0 0;">Creatures, monsters, and NPCs of the Crown Spread.</p>
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center;">
                    <input type="text" id="bestiary-search" placeholder="🔍 Search creatures…" style="font-size:0.9rem;padding:0.3rem 0.6rem;" />
                    <button class="btn btn-sm btn-ghost" id="bestiary-refresh" title="Refresh data">↻</button>
                </div>
            </header>
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
                    <div class="panel" style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:0.8rem;">
                        <h3 style="margin-top:0;">🔗 Wiki Cross‑Reference</h3>
                        <div id="bestiary-wiki-refs" style="font-size:0.85rem;color:var(--text2);">
                            Select a creature to see wiki links.
                        </div>
                    </div>
                    <div class="panel" style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:0.8rem;">
                        <h3 style="margin-top:0;">⚡ Quick Actions</h3>
                        <div style="display:flex;flex-direction:column;gap:0.3rem;">
                            <button class="btn btn-sm btn-gold" id="bestiary-add-encounter">+ Add as Encounter</button>
                            <button class="btn btn-sm" id="bestiary-add-adversary">+ Add as Adversary</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    await loadBestiaryData();
    await loadWikiData();
    renderBestiaryList();
    renderCategories();
    attachEvents();
}

// ============================================================
// RENDER LIST (same as before, with safe handling)
// ============================================================

function renderBestiaryList(filter = '') {
    const listEl = document.getElementById('bestiary-list');
    if (!listEl) return;

    const searchTerm = filter.toLowerCase().trim();
    const filteredData = bestiaryData.filter(entry => {
        const name = (entry.name || '').toLowerCase();
        const desc = (entry.description || '').toLowerCase();
        const category = (entry.category || '').toLowerCase();
        return name.includes(searchTerm) || desc.includes(searchTerm) || category.includes(searchTerm);
    });

    if (filteredData.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center;padding:2rem;color:var(--text3);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">🦴</div>
                <div>${bestiaryData.length === 0 ? 'No bestiary data loaded.' : 'No creatures match your search.'}</div>
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
        const tier = entry.tier ? `TL ${entry.tier}` : '';
        const description = entry.description || '';

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
                        ${tier ? `<span style="font-size:0.7rem;color:var(--text2);background:var(--bg2);padding:0.05rem 0.4rem;border-radius:12px;">${tier}</span>` : ''}
                    </div>
                    <div style="font-size:0.8rem;color:var(--text2);">
                        ${description ? escHtml(description.slice(0, 100)) + (description.length > 100 ? '…' : '') : ''}
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-primary bestiary-detail" data-name="${escHtml(safeName)}" title="Details">📄</button>
                    <button class="btn btn-xs btn-gold bestiary-add-adversary" data-name="${escHtml(safeName)}" title="Add as Adversary">⚔️</button>
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
                searchInput.value = `category:${cat}`;
                renderBestiaryList(searchInput.value);
            }
        });
    });
}

// ============================================================
// DETAIL VIEW (modal) – same as before, simplified
// ============================================================

function showCreatureDetail(entry) {
    const name = entry.name || 'Unnamed';
    const wikiEntry = wikiData[name] || wikiData[name.toLowerCase()] || null;
    const wikiLink = wikiEntry ? `<div style="margin-top:0.5rem;"><strong>Wiki:</strong> <a href="#" onclick="window.openWiki('${encodeURIComponent(name)}')">${escHtml(name)}</a></div>` : '';

    let statsHtml = '';
    if (entry.stats && typeof entry.stats === 'object') {
        statsHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;font-size:0.85rem;">';
        for (const [key, value] of Object.entries(entry.stats)) {
            statsHtml += `<div style="font-weight:600;">${escHtml(key)}</div><div>${escHtml(String(value))}</div>`;
        }
        statsHtml += '</div>';
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);
        display:flex;justify-content:center;align-items:center;z-index:1000;
        padding:1rem;
    `;
    overlay.innerHTML = `
        <div style="
            background:var(--bg-panel);
            border:1px solid var(--border);
            border-radius:var(--radius);
            max-width:600px;
            width:100%;
            max-height:80vh;
            overflow-y:auto;
            padding:1.5rem 2rem;
            position:relative;
            animation:scaleIn 0.2s ease-out;
        ">
            <button class="modal-close" style="position:absolute;top:0.5rem;right:0.5rem;background:transparent;border:none;font-size:1.5rem;cursor:pointer;color:var(--text2);">&times;</button>
            <h2 style="margin-top:0;color:var(--gold);display:flex;gap:0.5rem;align-items:center;">
                ${escHtml(name)}
                ${entry.tier ? `<span style="font-size:0.7rem;color:var(--text2);background:var(--bg2);padding:0.05rem 0.5rem;border-radius:12px;">TL ${entry.tier}</span>` : ''}
            </h2>
            ${entry.category ? `<span class="badge badge-${getCategoryBadgeColor(entry.category)}" style="margin-bottom:0.5rem;">${escHtml(entry.category)}</span>` : ''}
            ${entry.description ? `<div style="margin:0.5rem 0;line-height:1.5;">${escHtml(entry.description)}</div>` : ''}
            ${statsHtml}
            ${wikiLink}
            <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button class="btn btn-sm btn-gold add-adversary-from-detail" data-name="${escHtml(name)}">⚔️ Add as Adversary</button>
                <button class="btn btn-sm btn-primary add-encounter-from-detail" data-name="${escHtml(name)}">📋 Add to Encounter</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('.add-adversary-from-detail').addEventListener('click', () => {
        addCreatureAsAdversary(entry);
        overlay.remove();
    });

    overlay.querySelector('.add-encounter-from-detail').addEventListener('click', () => {
        addCreatureToEncounter(entry);
        overlay.remove();
    });
}

window.openWiki = function(name) {
    const event = new CustomEvent('wiki-navigate', { detail: { query: name } });
    document.dispatchEvent(event);
};

// ============================================================
// ACTIONS (unchanged)
// ============================================================

export function addCreatureAsAdversary(entry) {
    if (!entry || !entry.name) {
        showToast('Invalid creature data.', 'error');
        return;
    }
    const state = getState();
    if (!state.encounters) state.encounters = [];
    let targetEncounter = state.encounters.find(e => e.status === 'active') || state.encounters[0];
    if (!targetEncounter) {
        const newEnc = {
            id: 'enc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            title: `Encounter with ${entry.name}`,
            body: entry.description || '',
            difficulty: entry.tier || 2,
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
        targetEncounter.adversaries.push({
            name: entry.name,
            body: entry.description || '',
            tier: entry.tier || 2,
            stats: entry.stats || {}
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
    const state = getState();
    if (!state.encounters) state.encounters = [];
    const newEnc = {
        id: 'enc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title: `${entry.name} Encounter`,
        body: entry.description || '',
        difficulty: entry.tier || 2,
        location: '',
        status: 'draft',
        adversaries: [{
            name: entry.name,
            body: entry.description || '',
            tier: entry.tier || 2,
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

// ============================================================
// EVENTS
// ============================================================

function attachEvents() {
    const search = document.getElementById('bestiary-search');
    if (search) {
        search.addEventListener('input', (e) => {
            renderBestiaryList(e.target.value);
        });
    }

    const refresh = document.getElementById('bestiary-refresh');
    if (refresh) {
        refresh.addEventListener('click', async () => {
            localStorage.removeItem(CACHE_KEY);
            await loadBestiaryData();
            await loadWikiData();
            renderBestiaryList(document.getElementById('bestiary-search')?.value || '');
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

export default {
    render,
    destroy,
    attachEvents,
    loadBestiaryData,
    loadWikiData,
    addCreatureAsAdversary
};