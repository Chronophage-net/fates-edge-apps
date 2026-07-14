/**
 * Search feature - Search everything (rules, documents, wiki, etc.)
 */

// Fix the import - use the correct path
import { escHtml, buildDocumentUrl, getBaseUrl } from '../../core/utils.js';

let container = null;
let fuse = null;
let searchIndex = [];
let isInitialized = false;
let isLoading = false;

// Default fallback search entries when no index is available
const FALLBACK_ENTRIES = [
    {
        title: "Fate's Edge Toolkit",
        content: "Welcome to the Fate's Edge Toolkit. Search for rules, documents, and more.",
        url: "index.html",
        type: "document",
        category: "Home"
    },
    {
        title: "Getting Started",
        content: "The Fate's Edge Toolkit is a comprehensive toolset for running Fate's Edge campaigns.",
        url: "index.html",
        type: "document",
        category: "Guide"
    },
    {
        title: "Search Documentation",
        content: "Search is powered by Fuse.js. Type at least 2 characters to start searching.",
        url: "#",
        type: "document",
        category: "Info"
    }
];

/**
 * Render the search tab - Main entry point
 */
export function render(el) {
    console.log('🔍 Search.render() called');
    
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

/**
 * Initialize the module (alias for render)
 */
export function init(el) {
    console.log('🔍 Search.init() called');
    return render(el);
}

/**
 * Get the base URL for the application
 */
function getAppBaseUrl() {
    // Use the same logic as utils/urls.js
    const pathname = window.location.pathname;
    
    // Check for known deployment paths
    if (pathname.includes('/kon-reh/')) {
        return '/kon-reh/';
    }
    if (pathname.includes('/fates-edge-toolkit/')) {
        return '/fates-edge-toolkit/';
    }
    
    // If we're in a subdirectory, use the directory name
    const match = pathname.match(/^\/([^/]+)\//);
    if (match) {
        return '/' + match[1] + '/';
    }
    
    return '/';
}

/**
 * Load search index
 */
function loadSearchIndex() {
    if (isLoading) return;
    isLoading = true;
    
    const status = document.getElementById('search-status');
    if (status) {
        status.textContent = 'Loading search index…';
    }
    
    // Load Fuse.js if not available
    if (typeof Fuse === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';
        script.onload = () => {
            if (typeof Fuse !== 'undefined') {
                loadIndexWithFuse(Fuse);
            } else {
                if (status) status.textContent = '⚠️ Failed to load search library.';
                isLoading = false;
                useFallbackIndex();
            }
        };
        script.onerror = () => {
            if (status) status.textContent = '⚠️ Failed to load search library.';
            isLoading = false;
            useFallbackIndex();
        };
        document.head.appendChild(script);
    } else {
        loadIndexWithFuse(Fuse);
    }
}

/**
 * Use fallback index when real index is unavailable
 */
function useFallbackIndex() {
    const status = document.getElementById('search-status');
    searchIndex = FALLBACK_ENTRIES;
    
    if (typeof Fuse !== 'undefined') {
        fuse = new Fuse(Fuse, searchIndex, {
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
    
    if (status) {
        status.textContent = '⚠️ Using fallback index (search limited)';
        status.style.color = 'var(--gold)';
    }
    isInitialized = true;
    isLoading = false;
    console.log('🔍 Using fallback search index');
}

function loadIndexWithFuse(FuseLib) {
    const status = document.getElementById('search-status');
    const baseUrl = getAppBaseUrl();
    
    console.log('🔍 Loading search index, base URL:', baseUrl);
    console.log('🔍 Current location:', window.location.href);
    
    // Build paths to try - most specific first
    const paths = [
        // Full URL with base path
        window.location.origin + baseUrl + 'build/search_index.json',
        window.location.origin + baseUrl + 'search_index.json',
        // Without base path (if site is at root)
        window.location.origin + '/build/search_index.json',
        window.location.origin + '/search_index.json',
        // Relative paths
        baseUrl + 'build/search_index.json',
        baseUrl + 'search_index.json',
        'build/search_index.json',
        '../build/search_index.json',
        '../../build/search_index.json',
        'search_index.json'
    ];
    
    // Also try with .html extension (some servers serve it that way)
    const htmlPaths = paths.map(p => p.replace('.json', '.html'));
    const allPaths = [...paths, ...htmlPaths];
    
    let triedPaths = [];
    let attemptCount = 0;
    const maxAttempts = allPaths.length;
    
    function tryNextPath() {
        if (attemptCount >= maxAttempts) {
            console.warn('🔍 Search index not found in any path:', triedPaths);
            if (status) {
                status.textContent = '⚠️ Search index not available. Using fallback.';
                status.style.color = 'var(--gold)';
            }
            fuse = null;
            isLoading = false;
            useFallbackIndex();
            return;
        }
        
        const path = allPaths[attemptCount];
        attemptCount++;
        triedPaths.push(path);
        
        // Normalize path - if it starts with /, add origin
        let fetchUrl = path;
        if (path.startsWith('/')) {
            fetchUrl = window.location.origin + path;
        } else if (!path.startsWith('http://') && !path.startsWith('https://')) {
            // Relative path - try with and without origin
            fetchUrl = path;
        }
        
        console.debug(`🔍 Trying path ${attemptCount}/${maxAttempts}:`, fetchUrl);
        
        fetch(fetchUrl, {
            // Add cache-busting parameter to avoid stale caches
            cache: 'no-cache'
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (!data || !Array.isArray(data) || data.length === 0) {
                    console.warn('🔍 Search index is empty:', data);
                    if (status) {
                        status.textContent = '⚠️ Search index is empty. Using fallback.';
                        status.style.color = 'var(--gold)';
                    }
                    // Use fallback instead of trying next path
                    useFallbackIndex();
                    return;
                }
                
                searchIndex = data;
                fuse = new FuseLib(searchIndex, {
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
                
                if (status) {
                    status.textContent = `✅ ${searchIndex.length} entries indexed.`;
                    status.style.color = '';
                }
                isInitialized = true;
                isLoading = false;
                console.log(`🔍 Search initialized with ${searchIndex.length} entries from ${path}`);
            })
            .catch(err => {
                console.debug(`🔍 Failed to load from ${path}:`, err.message);
                // Try next path
                tryNextPath();
            });
    }
    
    tryNextPath();
}

/**
 * Perform search
 */
export function performSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    
    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '<span class="text-muted">Type at least 2 characters.</span>';
        return;
    }
    
    if (!fuse) {
        resultsContainer.innerHTML = '<span class="text-muted">Search index not loaded yet. Please wait…</span>';
        return;
    }
    
    const results = fuse.search(query);
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<span class="text-muted">No results found. Try different keywords.</span>';
        return;
    }
    
    const html = results.slice(0, 50).map(({ item, score }) => {
        const title = item.title || 'Untitled';
        const content = item.content || '';
        const rawUrl = item.url || '#';
        
        // Use the imported buildDocumentUrl function
        let url = buildDocumentUrl(rawUrl);
        
        const typeMap = {
            'srd': '📖 SRD',
            'document': '📄 Document',
            'wiki': '📚 Wiki',
            'character': '👤 Character',
            'spell': '✨ Spell',
            'talent': '⭐ Talent',
            'rite': '🔮 Rite'
        };
        const typeLabel = typeMap[item.type] || '📄 Document';
        
        const preview = content.length > 200 ? content.substring(0, 200) + '…' : content;
        const scorePercent = score !== undefined ? Math.round((1 - score) * 100) : 100;
        
        return `
            <div class="search-result" style="padding:0.5rem 0;border-bottom:1px solid var(--border);">
                <a href="${url}" target="_blank" style="font-weight:600;color:var(--gold);">${escHtml(title)}</a>
                <span class="text-muted small"> (${typeLabel})</span>
                ${item.category ? `<span class="text-muted small"> • ${escHtml(item.category)}</span>` : ''}
                ${scorePercent < 100 ? `<span class="text-muted small" style="font-size:0.7rem;"> • ${scorePercent}% match</span>` : ''}
                ${preview ? `<div class="text-muted small" style="margin-top:0.2rem;">${escHtml(preview)}</div>` : ''}
            </div>
        `;
    }).join('');
    
    resultsContainer.innerHTML = html;
    
    // Update status with result count
    const status = document.getElementById('search-status');
    if (status) {
        status.textContent = `Found ${results.length} results for "${query}"`;
    }
}

/**
 * Attach event listeners
 */
export function attachEvents() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-button');
    
    if (input) {
        // Remove any existing listeners by cloning
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        newInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            performSearch(query);
        });
        
        newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = e.target.value.trim();
                performSearch(query);
            }
        });
        
        // Focus after a short delay
        setTimeout(() => newInput.focus(), 100);
    }
    
    const newBtn = document.getElementById('search-button');
    if (newBtn) {
        const cloneBtn = newBtn.cloneNode(true);
        newBtn.parentNode.replaceChild(cloneBtn, newBtn);
        
        cloneBtn.addEventListener('click', () => {
            const inputEl = document.getElementById('search-input');
            if (inputEl) {
                const query = inputEl.value.trim();
                performSearch(query);
            }
        });
    }
}

/**
 * Search programmatically
 */
export function search(query) {
    if (!fuse) {
        console.warn('Search not initialized');
        return [];
    }
    return fuse.search(query);
}

/**
 * Reload search index
 */
export function reloadIndex() {
    fuse = null;
    searchIndex = [];
    isInitialized = false;
    isLoading = false;
    loadSearchIndex();
    // Use showToast if available
    if (typeof showToast !== 'undefined') {
        showToast('Reloading search index…', 'info');
    }
}

/**
 * Get search status
 */
export function getSearchStatus() {
    return {
        isInitialized,
        indexCount: searchIndex.length,
        fuseAvailable: fuse !== null,
        indexAvailable: searchIndex.length > 0 && !searchIndex.some(e => e.title === "Fate's Edge Toolkit" && e.content.includes("fallback")),
        usingFallback: searchIndex.some(e => e.title === "Fate's Edge Toolkit" && e.content.includes("fallback")),
        baseUrl: getAppBaseUrl(),
        isLoading
    };
}

/**
 * Destroy module
 */
export function destroy() {
    container = null;
    fuse = null;
    searchIndex = [];
    isInitialized = false;
    isLoading = false;
    
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-button');
    
    if (input) {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
    }
    
    if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    }
    
    console.log('🔍 Search module destroyed');
}

// Export default object
const SearchModule = {
    render,
    init,
    performSearch,
    attachEvents,
    search,
    reloadIndex,
    getSearchStatus,
    destroy
};

export default SearchModule;

// Also export as module for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchModule;
}