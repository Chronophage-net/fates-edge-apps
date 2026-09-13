/**
 * Search feature – Search everything (rules, documents, wiki, etc.)
 * ✅ Supports Solr backend (configurable via window.__SOLR_URL)
 * ✅ Supports Elasticsearch backend (configurable via window.__ES_URL)
 * ✅ Falls back to local Fuse.js index
 * ✅ Reads the shared background index (core/search-index.js), which
 *    crawls the document corpus on idle and persists it to IndexedDB
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

import { escHtml, buildDocumentUrl, getBaseUrl } from '@core/utils.js';
import {
    loadIndex as loadSharedIndex,
    buildIndex as buildSharedIndex,
    rebuildIndex as rebuildSharedIndex,
    getEntries as getSharedEntries,
    onIndexProgress,
} from '@core/search-index.js';

let container = null;
let fuse = null;
let searchIndex = [];
let isInitialized = false;
let isLoading = false;
let activeBackend = null; // 'solr' | 'elasticsearch' | 'fuse' | null (not yet loaded)

// Default fallback when everything else fails
const FALLBACK_ENTRIES = [
    { title: "Fate's Edge Toolkit", content: "Welcome to the Fate's Edge Toolkit. Search for rules, documents, and more.", url: "index.html", type: "document", category: "Home" },
    { title: "Getting Started", content: "Rules, characters, dice, encounters, factions, and table tools for Fate's Edge.", url: "index.html", type: "document", category: "Guide" },
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
        <h1 class="page-title" data-i18n="feature.search.searchEverything">🔍 Search Everything</h1>
        <p class="page-sub" data-i18n="feature.search.findRulesDocumentsWikiEntriesAndMore">Find rules, documents, wiki entries, and more.</p>
        <div class="panel">
            <div class="form-row">
                <div class="field large">
                    <input type="text" id="search-input" placeholder="Type your search…" autofocus / data-i18n-attr="placeholder:feature.search.typeYourSearch">
                </div>
                <button class="btn btn-gold" id="search-button" data-i18n="feature.search.search">Search</button>
                <button class="btn btn-utility btn-sm" id="search-rebuild-btn" title="Re-crawl the documents and rebuild the index" data-i18n="feature.search.rebuildIndex">Rebuild index</button>
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

    // 3c. Serve whatever the background indexer has already persisted.
    //
    // core/search-index.js starts crawling at app boot, so by the time
    // anyone opens this tab the index is usually warm and this returns
    // instantly from IndexedDB. If it is not warm yet we ask for a build
    // and follow along via the progress subscription set up below.
    let shared = getSharedEntries();
    if (!shared.length) shared = await loadSharedIndex();

    if (shared.length > 0) {
        buildFuseIndex(FuseLib, shared);
        updateStatus(`${shared.length} entries indexed.`, 'success');
        isInitialized = true;
        isLoading = false;
        subscribeToIndexProgress();
        return;
    }

    // 3d. Nothing persisted yet -- build now and show progress as it goes.
    subscribeToIndexProgress();
    updateStatus('Indexing documents…', 'info');
    const built = await buildSharedIndex();
    if (built && built.length > 0) {
        buildFuseIndex(FuseLib, built);
        updateStatus(`${built.length} entries indexed.`, 'success');
        isInitialized = true;
        isLoading = false;
        return;
    }

    // 3e. Nothing indexable was reachable at all (offline, or the data
    // directory is missing) -- keep the tab usable with the hardcoded
    // starter entries rather than an empty box.
    updateStatus('Using fallback index (search limited).', 'warning');
    useFallbackIndex();
}

// Keep the tab's Fuse index and status line in step with the background
// indexer. Without this, a build that finishes while the Search tab is open
// would sit in IndexedDB unused until the next navigation.
let unsubscribeProgress = null;
function subscribeToIndexProgress() {
    if (unsubscribeProgress) return;
    unsubscribeProgress = onIndexProgress((status) => {
        if (status.phase === 'building') {
            const { done, total } = status;
            updateStatus(total ? `Indexing documents… ${done}/${total}` : 'Indexing documents…', 'info');
            return;
        }
        if (status.phase === 'ready' && status.count) {
            const fresh = getSharedEntries();
            if (typeof Fuse !== 'undefined' && fresh.length) {
                buildFuseIndex(Fuse, fresh);
                isInitialized = true;
            }
            updateStatus(`${status.count} entries indexed.`, 'success');
        }
        if (status.phase === 'error') {
            updateStatus('Indexing failed. Search is limited to what was already indexed.', 'warning');
        }
    });
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
        const preview = item.preview || (content.length > 200 ? content.substring(0, 200) + '…' : content);

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
            newBtn.disabled = true;
            updateStatus('Rebuilding index…', 'info');
            fuse = null;
            searchIndex = [];
            isInitialized = false;
            isLoading = false;
            const results = document.getElementById('search-results');
            if (results) results.innerHTML = '';
            subscribeToIndexProgress();
            try {
                const rebuilt = await rebuildSharedIndex();
                if (rebuilt && rebuilt.length && typeof Fuse !== 'undefined') {
                    buildFuseIndex(Fuse, rebuilt);
                    isInitialized = true;
                    updateStatus(`${rebuilt.length} entries indexed.`, 'success');
                }
            } finally {
                newBtn.disabled = false;
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
    if (unsubscribeProgress) { unsubscribeProgress(); unsubscribeProgress = null; }
    container = null; fuse = null; searchIndex = []; isInitialized = false; isLoading = false; activeBackend = null;
}

export default {
    render, init, performSearch, attachEvents, search, reloadIndex, getSearchStatus, destroy
};
