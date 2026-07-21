/**
 * Search feature – Search everything (rules, documents, wiki, etc.)
 * ✅ Supports Solr backend (configurable via window.__SOLR_URL or env)
 * ✅ Falls back to local Fuse.js index
 * ✅ Auto‑generates index from /data/ static files if missing
 * ✅ Uses sessionStorage cache for generated index
 * ✅ Debug logging to help diagnose issues
 */

import { escHtml, buildDocumentUrl, getBaseUrl } from '../../core/utils.js';

let container = null;
let fuse = null;
let searchIndex = [];
let isInitialized = false;
let isLoading = false;

// Default fallback when everything else fails
const FALLBACK_ENTRIES = [
    { title: "Fate's Edge Toolkit", content: "Welcome to the Fate's Edge Toolkit. Search for rules, documents, and more.", url: "index.html", type: "document", category: "Home" },
    { title: "Getting Started", content: "The Fate's Edge Toolkit is a comprehensive toolset for running Fate's Edge campaigns.", url: "index.html", type: "document", category: "Guide" },
    { title: "Search Documentation", content: "Search is powered by Fuse.js. Type at least 2 characters to start searching.", url: "#", type: "document", category: "Info" }
];

// ------------------------------------------------------------------
// 1. CONFIGURATION – Solr URL (set via global or env)
// ------------------------------------------------------------------
const SOLR_URL = window.__SOLR_URL || null;

// ------------------------------------------------------------------
// 2. RENDER
// ------------------------------------------------------------------
export function render(el) {
    container = el;
    container.innerHTML = `
        <h1 class="page-title">🔍 Search Everything</h1>
        <p class="page-sub">Find rules, documents, wiki entries, and more.</p>
        <div class="panel">
            <div class="form-row">
                <div class="field large">
                    <input type="text" id="search-input" placeholder="Type your search…" autofocus />
                </div>
                <button class="btn btn-gold" id="search-button">Search</button>
                <button class="btn btn-secondary" id="search-rebuild-btn">🔄 Rebuild Index</button>
            </div>
            <div id="search-status" class="text-muted small mt-1" style="padding:0.3rem 0;"></div>
            <div id="search-results" class="mt-1" style="max-height:500px;overflow-y:auto;"></div>
        </div>
    `;
    loadSearchIndex();
    attachEvents();
    return container;
}

export function init(el) { return render(el); }

// ------------------------------------------------------------------
// 3. INDEX LOADING
// ------------------------------------------------------------------
async function loadSearchIndex() {
    if (isLoading) return;
    isLoading = true;
    updateStatus('Loading search index…', 'info');

    // 3a. Try Solr first (if configured)
    if (SOLR_URL) {
        const solrOk = await checkSolr();
        if (solrOk) {
            updateStatus('✅ Connected to Solr.', 'success');
            isInitialized = true;
            isLoading = false;
            return;
        }
        updateStatus('⚠️ Solr unavailable, falling back to local index.', 'warning');
    }

    // 3b. Load Fuse.js
    const FuseLib = await loadFuseLibrary();
    if (!FuseLib) {
        updateStatus('⚠️ Failed to load search library. Using fallback.', 'warning');
        isLoading = false;
        useFallbackIndex();
        return;
    }

    // 3c. Try sessionStorage cache first (fastest)
    const cached = sessionStorage.getItem('searchIndex');
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                buildFuseIndex(FuseLib, parsed);
                updateStatus(`✅ ${parsed.length} entries indexed (cache).`, 'success');
                isInitialized = true;
                isLoading = false;
                return;
            }
        } catch (e) { /* ignore */ }
    }

    // 3d. Try pre-built search_index.json
    const prebuilt = await loadPrebuiltIndex();
    if (prebuilt && prebuilt.length > 0) {
        buildFuseIndex(FuseLib, prebuilt);
        try { sessionStorage.setItem('searchIndex', JSON.stringify(prebuilt)); } catch (e) {}
        updateStatus(`✅ ${prebuilt.length} entries indexed (pre-built).`, 'success');
        isInitialized = true;
        isLoading = false;
        return;
    }

    // 3e. Dynamic index builder
    updateStatus('🔍 Generating search index from data files…', 'info');
    const dynamic = await buildDynamicIndex();
    if (dynamic && dynamic.length > 0) {
        try { sessionStorage.setItem('searchIndex', JSON.stringify(dynamic)); } catch (e) {}
        buildFuseIndex(FuseLib, dynamic);
        updateStatus(`✅ ${dynamic.length} entries indexed (dynamic).`, 'success');
        isInitialized = true;
        isLoading = false;
        return;
    }

    // 3f. Everything failed → hardcoded fallback
    updateStatus('⚠️ Using fallback index (search limited).', 'warning');
    useFallbackIndex();
}

function updateStatus(msg, type = 'info') {
    const status = document.getElementById('search-status');
    if (!status) return;
    status.textContent = msg;
    status.style.color = type === 'success' ? 'var(--green)' :
                         type === 'warning' ? 'var(--gold)' :
                         type === 'error' ? 'var(--red)' : 'var(--text3)';
}

// ------------------------------------------------------------------
// 4. SOLR SUPPORT
// ------------------------------------------------------------------
async function checkSolr() {
    try {
        const res = await fetch(`${SOLR_URL}?q=*:*&rows=0&wt=json`, { cache: 'no-cache' });
        return res.ok;
    } catch {
        return false;
    }
}

async function solrSearch(query) {
    const params = new URLSearchParams({
        q: query,
        rows: 50,
        wt: 'json',
        fl: 'title,content,url,type,category,score',
    });
    try {
        const res = await fetch(`${SOLR_URL}?${params}`, { cache: 'no-cache' });
        if (!res.ok) throw new Error('Solr query failed');
        const data = await res.json();
        return (data.response?.docs || []).map(doc => ({
            title: doc.title || 'Untitled',
            content: doc.content || '',
            url: doc.url || '#',
            type: doc.type || 'document',
            category: doc.category || '',
            score: 1 - (doc.score ? doc.score / 100 : 0),
        }));
    } catch (err) {
        console.error('Solr search error:', err);
        return null;
    }
}

// ------------------------------------------------------------------
// 5. FUSE.JS LOADING
// ------------------------------------------------------------------
async function loadFuseLibrary() {
    if (typeof Fuse !== 'undefined') return Fuse;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';
        script.onload = () => resolve(typeof Fuse !== 'undefined' ? Fuse : null);
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
    });
}

// ------------------------------------------------------------------
// 6. PRE‑BUILT INDEX LOADER
// ------------------------------------------------------------------
async function loadPrebuiltIndex() {
    const baseUrl = getBaseUrl();
    const paths = [
        `${baseUrl}build/search_index.json`,
        `${baseUrl}search_index.json`,
        'build/search_index.json',
        'search_index.json'
    ];
    for (const p of paths) {
        try {
            const res = await fetch(p, { cache: 'no-cache' });
            if (!res.ok) continue;
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) return data;
        } catch {}
    }
    return null;
}

// ------------------------------------------------------------------
// 7. DYNAMIC INDEX BUILDER (from /data/ static files)
// ------------------------------------------------------------------
async function buildDynamicIndex() {
    const entries = [];
    const baseUrl = getBaseUrl();

    // Helper to safely fetch and parse JSON
    async function fetchJSON(url) {
        try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok) return null;
            return await res.json();
        } catch { return null; }
    }

    // 7a. Wiki
    const wikiData = await fetchJSON('/data/wiki.json');
    if (Array.isArray(wikiData)) {
        wikiData.forEach(item => {
            entries.push({
                title: item.title || item.name || 'Wiki Entry',
                content: item.content || item.description || '',
                url: item.url || '#',
                type: 'wiki',
                category: item.category || 'Wiki'
            });
        });
    }

    // 7b. Factions (manifest + individual files)
    const factionManifest = await fetchJSON('/data/factions/manifest.json');
    if (Array.isArray(factionManifest)) {
        for (const f of factionManifest) {
            const id = typeof f === 'string' ? f : f.id || f.name;
            if (!id) continue;
            // Try to load the actual faction file for more content
            const factionData = await fetchJSON(`/data/factions/${id}.json`);
            if (factionData) {
                entries.push({
                    title: factionData.name || id,
                    content: factionData.description || factionData.agenda || '',
                    url: `#/factions/${id}`,
                    type: 'faction',
                    category: 'Factions'
                });
            } else {
                entries.push({
                    title: id,
                    content: '',
                    url: `#/factions/${id}`,
                    type: 'faction',
                    category: 'Factions'
                });
            }
        }
    }

    // 7c. Patrons (cosmic)
    const patronManifest = await fetchJSON('/data/patrons/manifest.json');
    if (Array.isArray(patronManifest)) {
        for (const p of patronManifest) {
            const id = typeof p === 'string' ? p : p.id || p.name;
            if (!id) continue;
            const patronData = await fetchJSON(`/data/patrons/${id}.json`);
            if (patronData) {
                // Extract description from nested structure
                let desc = '';
                if (patronData.lore && patronData.lore.description) desc = patronData.lore.description;
                else if (patronData.description) desc = typeof patronData.description === 'string' ? patronData.description : JSON.stringify(patronData.description);
                entries.push({
                    title: patronData.name || patronData.title || id,
                    content: desc || patronData.subtitle || '',
                    url: `#/patrons/${id}`,
                    type: 'patron',
                    category: 'Patrons'
                });
            } else {
                entries.push({
                    title: id,
                    content: '',
                    url: `#/patrons/${id}`,
                    type: 'patron',
                    category: 'Patrons'
                });
            }
        }
    }

    // 7d. Regions (try to find region files)
    const knownRegions = ['acasia', 'ecktoria', 'silkstrand', 'vhasia', 'ykrul', 'valewood', 'aelinnel', 'aelaerem', 'aeler', 'mistlands', 'thepyrgos', 'ubral', 'zakov', 'kahfagia'];
    for (const region of knownRegions) {
        const regionData = await fetchJSON(`/data/regions/${region}.json`);
        if (regionData) {
            let desc = '';
            if (regionData.overview) {
                desc = regionData.overview.tagline || '';
                if (regionData.overview.genre) desc += ' ' + regionData.overview.genre;
                if (regionData.overview.mood) desc += ' ' + regionData.overview.mood;
            }
            entries.push({
                title: regionData.title || regionData.name || region,
                content: desc || '',
                url: `#/regions/${region}`,
                type: 'region',
                category: 'Regions'
            });
        }
    }

    // 7e. Core documents from manifest
    const docManifest = await fetchJSON('/data/docs/manifest-core.json');
    if (docManifest && docManifest.documents) {
        docManifest.documents.forEach(d => {
            if (d.title) {
                entries.push({
                    title: d.title,
                    content: d.description || d.title,
                    url: buildDocumentUrl(`/data/docs/${d.file || d.id || ''}`),
                    type: 'document',
                    category: d.category || 'Documents'
                });
            }
        });
    }

    // Deduplicate
    const seen = new Set();
    const deduped = entries.filter(e => {
        const key = (e.title + e.type).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`[Search] Built dynamic index with ${deduped.length} entries`);
    return deduped.length > 0 ? deduped : null;
}

// ------------------------------------------------------------------
// 8. FUSE INDEX CREATION
// ------------------------------------------------------------------
function buildFuseIndex(FuseLib, indexData) {
    searchIndex = indexData;
    fuse = new FuseLib(indexData, {
        keys: [
            { name: 'title', weight: 0.7 },
            { name: 'content', weight: 0.3 },
            { name: 'category', weight: 0.2 }
        ],
        includeScore: true,
        threshold: 0.4,
        minMatchCharLength: 2,
        ignoreLocation: true,
        useExtendedSearch: true
    });
}

function useFallbackIndex() {
    searchIndex = FALLBACK_ENTRIES;
    if (typeof Fuse !== 'undefined') {
        buildFuseIndex(Fuse, FALLBACK_ENTRIES);
    }
    isInitialized = true;
    isLoading = false;
    updateStatus(`⚠️ Using fallback index (${FALLBACK_ENTRIES.length} entries).`, 'warning');
}

// ------------------------------------------------------------------
// 9. PERFORM SEARCH
// ------------------------------------------------------------------
export async function performSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '<span class="text-muted">Type at least 2 characters.</span>';
        return;
    }

    // Try Solr first if connected
    if (SOLR_URL && isInitialized) {
        const solrResults = await solrSearch(query);
        if (solrResults && solrResults.length > 0) {
            renderResults(solrResults, query);
            return;
        }
    }

    if (!fuse) {
        resultsContainer.innerHTML = '<span class="text-muted">Search index not loaded yet. Please wait…</span>';
        return;
    }

    const results = fuse.search(query);
    const items = results.map(r => ({
        ...r.item,
        score: r.score !== undefined ? Math.round((1 - r.score) * 100) : 100
    }));
    renderResults(items, query);
}

function renderResults(items, query) {
    const container = document.getElementById('search-results');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = '<span class="text-muted">No results found. Try different keywords.</span>';
        return;
    }

    const html = items.slice(0, 50).map(item => {
        const title = item.title || 'Untitled';
        const content = item.content || '';
        const rawUrl = item.url || '#';
        const url = rawUrl.startsWith('#') ? rawUrl : buildDocumentUrl(rawUrl);

        const typeMap = {
            'srd': '📖 SRD', 'document': '📄 Document', 'wiki': '📚 Wiki',
            'character': '👤 Character', 'spell': '✨ Spell', 'talent': '⭐ Talent',
            'rite': '🔮 Rite', 'faction': '🏴 Faction', 'patron': '✨ Patron',
            'region': '🗺️ Region'
        };
        const typeLabel = typeMap[item.type] || '📄 Document';
        const preview = content.length > 200 ? content.substring(0, 200) + '…' : content;

        return `
            <div class="search-result" style="padding:0.5rem 0;border-bottom:1px solid var(--border);">
                <a href="${url}" ${url.startsWith('#') ? `onclick="window.location.hash='${url.substring(1)}';return false;"` : `target="_blank"`} style="font-weight:600;color:var(--gold);">${escHtml(title)}</a>
                <span class="text-muted small"> (${typeLabel})</span>
                ${item.category ? `<span class="text-muted small"> • ${escHtml(item.category)}</span>` : ''}
                ${item.score !== undefined && item.score < 100 ? `<span class="text-muted small" style="font-size:0.7rem;"> • ${item.score}% match</span>` : ''}
                ${preview ? `<div class="text-muted small" style="margin-top:0.2rem;">${escHtml(preview)}</div>` : ''}
            </div>`;
    }).join('');

    container.innerHTML = html;
    updateStatus(`Found ${items.length} results for "${query}"`, 'success');
}

// ------------------------------------------------------------------
// 10. EVENT HANDLERS
// ------------------------------------------------------------------
export function attachEvents() {
    const input = container.querySelector('#search-input');
    if (input) {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        newInput.addEventListener('input', e => performSearch(e.target.value.trim()));
        newInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') performSearch(e.target.value.trim());
        });
        setTimeout(() => newInput.focus(), 100);
    }

    const btn = container.querySelector('#search-button');
    if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const inputEl = container.querySelector('#search-input');
            if (inputEl) performSearch(inputEl.value.trim());
        });
    }

    const rebuildBtn = container.querySelector('#search-rebuild-btn');
    if (rebuildBtn) {
        const newBtn = rebuildBtn.cloneNode(true);
        rebuildBtn.parentNode.replaceChild(newBtn, rebuildBtn);
        newBtn.addEventListener('click', async () => {
            updateStatus('🔄 Rebuilding index…', 'info');
            sessionStorage.removeItem('searchIndex');
            fuse = null;
            searchIndex = [];
            isInitialized = false;
            isLoading = false;
            const results = document.getElementById('search-results');
            if (results) results.innerHTML = '';
            await loadSearchIndex();
            if (isInitialized) {
                updateStatus('✅ Index rebuilt successfully.', 'success');
            }
        });
    }
}

export function search(query) {
    if (!fuse) return [];
    return fuse.search(query).map(r => r.item);
}

export function reloadIndex() {
    fuse = null; searchIndex = []; isInitialized = false; isLoading = false;
    sessionStorage.removeItem('searchIndex');
    loadSearchIndex();
}

export function getSearchStatus() {
    return { isInitialized, indexCount: searchIndex.length, fuseAvailable: fuse !== null, baseUrl: getBaseUrl(), isLoading };
}

export function destroy() {
    container = null; fuse = null; searchIndex = []; isInitialized = false; isLoading = false;
}

export default {
    render, init, performSearch, attachEvents, search, reloadIndex, getSearchStatus, destroy
};