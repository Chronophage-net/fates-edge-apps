/**
 * Search feature – Search everything (rules, documents, wiki, etc.)
 * ✅ Supports Solr backend (configurable via window.__SOLR_URL or env)
 * ✅ Falls back to local Fuse.js index
 * ✅ Auto‑generates index from /data/ static files if missing
 * ✅ Uses sessionStorage cache for generated index
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
const SOLR_URL = window.__SOLR_URL || null;          // e.g. 'http://localhost:8983/solr/fatesedge/select'

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
            </div>
            <div id="search-results" class="mt-1" style="max-height:500px;overflow-y:auto;"></div>
            <div id="search-status" class="text-muted small mt-1"></div>
        </div>
    `;
    loadSearchIndex();
    attachEvents();
    return container;
}

export function init(el) { return render(el); }

// ------------------------------------------------------------------
// 3. INDEX LOADING (Solr → local JSON → dynamic build → fallback)
// ------------------------------------------------------------------
async function loadSearchIndex() {
    if (isLoading) return;
    isLoading = true;
    const status = document.getElementById('search-status');
    if (status) status.textContent = 'Loading search index…';

    // 3a. Try Solr first (if configured)
    if (SOLR_URL) {
        const solrOk = await checkSolr();
        if (solrOk) {
            if (status) status.textContent = '✅ Connected to Solr.';
            isInitialized = true;
            isLoading = false;
            return;
        }
        if (status) status.textContent = '⚠️ Solr unavailable, falling back to local index.';
    }

    // 3b. Load Fuse.js if needed
    const FuseLib = await loadFuseLibrary();
    if (!FuseLib) {
        if (status) status.textContent = '⚠️ Failed to load search library.';
        isLoading = false;
        useFallbackIndex();
        return;
    }

    // 3c. Try to load the pre‑built search_index.json
    const prebuilt = await loadPrebuiltIndex();
    if (prebuilt && prebuilt.length > 0) {
        buildFuseIndex(FuseLib, prebuilt);
        if (status) status.textContent = `✅ ${prebuilt.length} entries indexed.`;
        isInitialized = true;
        isLoading = false;
        return;
    }

    // 3d. Try sessionStorage cache (dynamically built on previous visit)
    const cached = sessionStorage.getItem('searchIndex');
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                buildFuseIndex(FuseLib, parsed);
                if (status) status.textContent = '✅ Index loaded from cache.';
                isInitialized = true;
                isLoading = false;
                return;
            }
        } catch (e) { /* ignore */ }
    }

    // 3e. Dynamic index builder – fetch data from /data/ static files
    if (status) status.textContent = '🔍 Generating search index from data files…';
    const dynamic = await buildDynamicIndex();
    if (dynamic && dynamic.length > 0) {
        // Store in sessionStorage for next time
        try { sessionStorage.setItem('searchIndex', JSON.stringify(dynamic)); } catch (e) {}
        buildFuseIndex(FuseLib, dynamic);
        if (status) status.textContent = `✅ ${dynamic.length} entries indexed (dynamic).`;
        isInitialized = true;
        isLoading = false;
        return;
    }

    // 3f. Everything failed → hardcoded fallback
    useFallbackIndex();
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
            score: 1 - (doc.score ? doc.score / 100 : 0),  // approximate for display
        }));
    } catch (err) {
        console.error('Solr search error:', err);
        return null;  // fall back to local Fuse
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
// 6. PRE‑BUILT INDEX LOADER (search_index.json)
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

    // 7a. Load wiki.json
    try {
        const wiki = await fetch('/data/wiki.json').then(r => r.json());
        if (Array.isArray(wiki)) {
            wiki.forEach(item => entries.push({
                title: item.title || item.name || 'Wiki Entry',
                content: item.content || item.description || '',
                url: item.url || '#',
                type: 'wiki',
                category: item.category || 'Wiki'
            }));
        }
    } catch (e) { /* ignore */ }

    // 7b. Load faction manifest
    try {
        const factions = await fetch('/data/factions/manifest.json').then(r => r.json());
        if (Array.isArray(factions)) {
            factions.forEach(f => entries.push({
                title: f.name,
                content: f.description || '',
                url: `#/factions/${f.id || f.name}`,
                type: 'faction',
                category: 'Factions'
            }));
        }
    } catch (e) { /* ignore */ }

    // 7c. Load patron manifest
    try {
        const patrons = await fetch('/data/patrons/manifest.json').then(r => r.json());
        if (Array.isArray(patrons)) {
            patrons.forEach(p => entries.push({
                title: p.name,
                content: p.description || '',
                url: `#/patrons/${p.id || p.name}`,
                type: 'patron',
                category: 'Patrons'
            }));
        }
    } catch (e) { /* ignore */ }

    // 7d. Load region data (manual list from known files)
    const regionFiles = ['acasia', 'ecktoria', 'silkstrand', 'vhasia', 'ykrul'];
    for (const region of regionFiles) {
        try {
            const r = await fetch(`/data/regions/${region}.json`).then(r => r.json());
            entries.push({
                title: r.name || region,
                content: r.description || '',
                url: `#/regions/${region}`,
                type: 'region',
                category: 'Regions'
            });
        } catch (e) { /* ignore */ }
    }

    // 7e. Load docs manifest (core) to get document metadata
    try {
        const manifest = await fetch('/data/docs/manifest-core.json').then(r => r.json());
        const docs = manifest.documents || manifest;
        if (Array.isArray(docs)) {
            docs.forEach(d => {
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
    } catch (e) { /* ignore */ }

    // 7f. If nothing found, return null (will fall back to hardcoded)
    if (entries.length === 0) return null;

    // Remove duplicates by title (crude)
    const seen = new Set();
    const deduped = entries.filter(e => {
        const key = e.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return deduped;
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
    const status = document.getElementById('search-status');
    searchIndex = FALLBACK_ENTRIES;
    if (typeof Fuse !== 'undefined') {
        buildFuseIndex(Fuse, FALLBACK_ENTRIES);
    }
    if (status) {
        status.textContent = '⚠️ Using fallback index (search limited)';
        status.style.color = 'var(--gold)';
    }
    isInitialized = true;
    isLoading = false;
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
        // If Solr fails or returns nothing, fall back to Fuse
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
        const url = buildDocumentUrl(rawUrl);

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
                <a href="${url}" target="_blank" style="font-weight:600;color:var(--gold);">${escHtml(title)}</a>
                <span class="text-muted small"> (${typeLabel})</span>
                ${item.category ? `<span class="text-muted small"> • ${escHtml(item.category)}</span>` : ''}
                ${item.score !== undefined && item.score < 100 ? `<span class="text-muted small" style="font-size:0.7rem;"> • ${item.score}% match</span>` : ''}
                ${preview ? `<div class="text-muted small" style="margin-top:0.2rem;">${escHtml(preview)}</div>` : ''}
            </div>`;
    }).join('');

    container.innerHTML = html;

    const status = document.getElementById('search-status');
    if (status) status.textContent = `Found ${items.length} results for "${query}"`;
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
}

export function search(query) {
    if (!fuse) return [];
    return fuse.search(query).map(r => r.item);
}

export function reloadIndex() {
    fuse = null; searchIndex = []; isInitialized = false; isLoading = false;
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