/**
 * Search feature – Search everything (rules, documents, wiki, etc.)
 * ✅ Supports Solr backend (configurable via window.__SOLR_URL)
 * ✅ Supports Elasticsearch backend (configurable via window.__ES_URL)
 * ✅ Falls back to local Fuse.js index
 * ✅ Auto‑generates index from /data/ static files if missing
 * ✅ Uses sessionStorage cache for generated index
 * ✅ Debug logging to help diagnose issues
 *
 * Both server backends are opt-in and mutually exclusive at query time —
 * this is a client-side toolkit with no build-time server config, so
 * "configured" just means `window.__SOLR_URL`/`window.__ES_URL` was set
 * (e.g. by whoever deploys this build, in a small inline <script> before
 * this module loads). Neither backend is set up or required by default;
 * the zero-config path is the local Fuse.js index, which needs nothing
 * external at all. If both are set, Solr wins (matches this feature's
 * original behavior) unless window.__SEARCH_BACKEND explicitly picks
 * one ('solr' | 'elasticsearch').
 *
 * Security note (applies to both backends, not new here): queries go
 * straight from the browser to the configured URL via fetch(). That
 * means the endpoint needs either open CORS or a client-embedded
 * credential (window.__ES_API_KEY below) — there's no server-side proxy
 * in this toolkit. Don't point either at an endpoint you wouldn't want
 * a curious visitor hitting directly with browser devtools open.
 */

import { escHtml, buildDocumentUrl, getBaseUrl } from '../../core/utils.js';

let container = null;
let fuse = null;
let searchIndex = [];
let isInitialized = false;
let isLoading = false;
let activeBackend = null; // 'solr' | 'elasticsearch' | 'fuse' | null (not yet loaded)

// Default fallback when everything else fails
const FALLBACK_ENTRIES = [
    { title: "Fate's Edge Toolkit", content: "Welcome to the Fate's Edge Toolkit. Search for rules, documents, and more.", url: "index.html", type: "document", category: "Home" },
    { title: "Getting Started", content: "The Fate's Edge Toolkit is a comprehensive toolset for running Fate's Edge campaigns.", url: "index.html", type: "document", category: "Guide" },
    { title: "Search Documentation", content: "Search is powered by Fuse.js. Type at least 2 characters to start searching.", url: "#", type: "document", category: "Info" }
];

// ------------------------------------------------------------------
// 1. CONFIGURATION – backend URLs (read live from window, not cached at
// import time -- these used to be top-level consts, which meant whoever
// set window.__SOLR_URL had to do so before this module was ever
// imported by anything, including indirectly. Reading them fresh on
// every call also makes them reconfigurable at runtime, e.g. from a
// Settings panel, without a page reload.)
// ------------------------------------------------------------------
function getSolrUrl() { return window.__SOLR_URL || null; }
// Base URL for one Elasticsearch index, e.g. "https://es.example.com/fatesedge"
// (no trailing slash, no /_search suffix -- that's appended per-request below).
function getEsUrl() { return window.__ES_URL || null; }
// Optional -- sent as `Authorization: ApiKey <value>` if set. Elasticsearch's
// own API key format (base64 "id:secret") is expected here, not a raw secret.
function getEsApiKey() { return window.__ES_API_KEY || null; }
// 'solr' | 'elasticsearch' | undefined (auto: Solr wins if both configured,
// for backward compatibility with existing __SOLR_URL-only deployments).
function getBackendPreference() { return window.__SEARCH_BACKEND || null; }

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
export async function loadSearchIndex() {
    if (isLoading) return;
    isLoading = true;
    updateStatus('Loading search index…', 'info');

    // 3a. Try a configured server backend first (Solr and/or Elasticsearch).
    // Explicit window.__SEARCH_BACKEND wins; otherwise Solr wins if both are
    // configured (matches this feature's original Solr-only behavior).
    const backendPref = getBackendPreference();
    const tryOrder = backendPref === 'elasticsearch' ? ['elasticsearch', 'solr']
        : backendPref === 'solr' ? ['solr', 'elasticsearch']
        : ['solr', 'elasticsearch'];

    for (const backend of tryOrder) {
        if (backend === 'solr' && getSolrUrl()) {
            if (await checkSolr()) {
                activeBackend = 'solr';
                updateStatus('✅ Connected to Solr.', 'success');
                isInitialized = true;
                isLoading = false;
                return;
            }
            updateStatus('⚠️ Solr unavailable, trying next option…', 'warning');
        }
        if (backend === 'elasticsearch' && getEsUrl()) {
            if (await checkElasticsearch()) {
                activeBackend = 'elasticsearch';
                updateStatus('✅ Connected to Elasticsearch.', 'success');
                isInitialized = true;
                isLoading = false;
                return;
            }
            updateStatus('⚠️ Elasticsearch unavailable, trying next option…', 'warning');
        }
    }

    // 3b. Load Fuse.js
    activeBackend = 'fuse';
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
export async function checkSolr() {
    try {
        const res = await fetch(`${getSolrUrl()}?q=*:*&rows=0&wt=json`, { cache: 'no-cache' });
        return res.ok;
    } catch {
        return false;
    }
}

export async function solrSearch(query) {
    const params = new URLSearchParams({
        q: query,
        rows: 50,
        wt: 'json',
        fl: 'title,content,url,type,category,score',
    });
    try {
        const res = await fetch(`${getSolrUrl()}?${params}`, { cache: 'no-cache' });
        if (!res.ok) throw new Error('Solr query failed');
        const data = await res.json();
        // Normalized against the top hit in this response, so `score` is
        // always a 0-100 "% match" like renderResults() expects (matches
        // how the Fuse.js path and the Elasticsearch path both score).
        const maxScore = data.response?.maxScore || 0;
        return (data.response?.docs || []).map(doc => ({
            title: doc.title || 'Untitled',
            content: doc.content || '',
            url: doc.url || '#',
            type: doc.type || 'document',
            category: doc.category || '',
            score: maxScore > 0 && doc.score ? Math.round((doc.score / maxScore) * 100) : 100,
        }));
    } catch (err) {
        console.error('Solr search error:', err);
        return null;
    }
}

// ------------------------------------------------------------------
// 4b. ELASTICSEARCH SUPPORT
// ------------------------------------------------------------------
function esHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const apiKey = getEsApiKey();
    if (apiKey) headers['Authorization'] = `ApiKey ${apiKey}`;
    return headers;
}

export async function checkElasticsearch() {
    try {
        const res = await fetch(`${getEsUrl()}/_search`, {
            method: 'POST',
            headers: esHeaders(),
            body: JSON.stringify({ size: 0, query: { match_all: {} } }),
            cache: 'no-cache',
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function elasticsearchSearch(query) {
    try {
        const res = await fetch(`${getEsUrl()}/_search`, {
            method: 'POST',
            headers: esHeaders(),
            body: JSON.stringify({
                size: 50,
                query: {
                    multi_match: {
                        query,
                        fields: ['title^3', 'content', 'category^2'],
                        fuzziness: 'AUTO',
                    },
                },
            }),
            cache: 'no-cache',
        });
        if (!res.ok) throw new Error(`Elasticsearch query failed (${res.status})`);
        const data = await res.json();
        const hits = data.hits?.hits || [];
        // Elasticsearch relevance scores aren't bounded 0-1 like Solr's can
        // be treated as -- normalize against this response's own top hit,
        // same approach as the Solr path above, so both read the same way
        // in the results list ("N% match").
        const maxScore = data.hits?.max_score || 0;
        return hits.map(hit => {
            const src = hit._source || {};
            return {
                title: src.title || 'Untitled',
                content: src.content || '',
                url: src.url || '#',
                type: src.type || 'document',
                category: src.category || '',
                score: maxScore > 0 ? Math.round((hit._score / maxScore) * 100) : 100,
            };
        });
    } catch (err) {
        console.error('Elasticsearch search error:', err);
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
    const wikiData = await fetchJSON('./data/wiki.json');
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
    const factionManifest = await fetchJSON('./data/factions/manifest.json');
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
    const patronManifest = await fetchJSON('./data/patrons/manifest.json');
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
    const docManifest = await fetchJSON('./data/docs/manifest-core.json');
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

    // Query whichever server backend connected during loadSearchIndex(), if any.
    if (isInitialized && activeBackend === 'solr') {
        const solrResults = await solrSearch(query);
        if (solrResults && solrResults.length > 0) {
            renderResults(solrResults, query);
            return;
        }
    }
    if (isInitialized && activeBackend === 'elasticsearch') {
        const esResults = await elasticsearchSearch(query);
        if (esResults && esResults.length > 0) {
            renderResults(esResults, query);
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
    fuse = null; searchIndex = []; isInitialized = false; isLoading = false; activeBackend = null;
    sessionStorage.removeItem('searchIndex');
    loadSearchIndex();
}

export function getSearchStatus() {
    return {
        isInitialized,
        indexCount: searchIndex.length,
        fuseAvailable: fuse !== null,
        baseUrl: getBaseUrl(),
        isLoading,
        backend: activeBackend, // 'solr' | 'elasticsearch' | 'fuse' | null
        solrConfigured: !!getSolrUrl(),
        elasticsearchConfigured: !!getEsUrl(),
    };
}

export function destroy() {
    container = null; fuse = null; searchIndex = []; isInitialized = false; isLoading = false; activeBackend = null;
}

export default {
    render, init, performSearch, attachEvents, search, reloadIndex, getSearchStatus, destroy
};