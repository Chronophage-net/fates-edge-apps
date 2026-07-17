// feature/docs/index.js - Document Library with /data/docs/ manifest discovery

import { escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

let allDocs = [];
let currentDocPath = null;
let isDarkMode = false;

// ============================================================
// CONSTANTS
// ============================================================

const DOCS_BASE_PATH = '/data/docs/';

// Manifest paths to try in order
const MANIFEST_PATHS = [
    '/data/docs/manifest.json',
    '/data/docs/manifest-core.json',
    '/data/docs/manifest-full.json'
];

// Known HTML files in /data/docs/ (from the tree)
const KNOWN_DOC_FILES = [
    'Fates_-_Edge_-_-Essentials.html',
    'Fates_-_Edge_-_-Game_-_Master_-_Screen.html',
    'Fates_-_Edge_-_-Systems_-_Reference_-_Document..html'
];

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    const container = el || document.getElementById('tab-docs');
    if (!container) return;

    isDarkMode = document.documentElement.classList.contains('light') ? false : true;
    
    container.innerHTML = `
        <h1 class="page-title">📄 Document Library</h1>
        <p class="page-sub">Browse generated HTML documents and reference files.</p>
        
        <!-- Filter Bar -->
        <div class="docs-filter-bar" style="display:flex;flex-wrap:wrap;gap:0.8rem 1rem;align-items:flex-end;padding:0.8rem 1rem;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border);margin-bottom:1.2rem;">
            <div class="filter-group" style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;flex:1 1 200px;">
                <label style="margin:0;font-size:0.8rem;font-weight:600;color:var(--text2);white-space:nowrap;">Category</label>
                <select id="docsCategoryFilter" style="padding:0.35rem 0.6rem;font-size:0.9rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);flex:0 1 160px;">
                    <option value="">All</option>
                </select>
            </div>
            <div class="filter-group" style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;flex:1 1 200px;">
                <label style="margin:0;font-size:0.8rem;font-weight:600;color:var(--text2);white-space:nowrap;">Search</label>
                <input type="text" id="docsSearchInput" placeholder="Filter by title or file…" style="padding:0.35rem 0.6rem;font-size:0.9rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);flex:1 1 180px;min-width:120px;" />
            </div>
            <div class="filter-actions" style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <button class="btn btn-sm" id="docsClearFiltersBtn" style="padding:0.35rem 0.8rem;font-size:0.8rem;">✕ Clear</button>
                <button class="btn btn-sm btn-primary" id="doc-refresh-btn" style="padding:0.35rem 0.8rem;font-size:0.8rem;">🔄 Refresh</button>
            </div>
            <span id="docsFilterStats" class="docs-filter-stats" style="font-size:0.8rem;color:var(--text2);padding:0.2rem 0 0 0.2rem;"></span>
        </div>
        
        <!-- Document Grid -->
        <div id="doc-list" class="doc-grid" style="display:flex;flex-direction:row;gap:1rem;overflow-x:auto;overflow-y:visible;padding:0.5rem 0.2rem 1rem 0.2rem;flex-wrap:nowrap;align-items:stretch;scrollbar-width:thin;scrollbar-color:var(--bg4) var(--bg2);-webkit-overflow-scrolling:touch;">
            <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;font-style:italic;min-width:100%;">📄 Loading documents…</div>
        </div>
        
        <!-- Document Viewer -->
        <div id="doc-viewer-container" style="display:none;margin-top:1.5rem;border-top:2px solid var(--border);padding-top:1rem;transition:all 0.3s ease;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;margin-bottom:0.8rem;">
                <h3 id="doc-viewer-title" style="color:var(--gold);margin:0;font-size:1.2rem;"></h3>
                <div style="display:flex;gap:0.4rem;">
                    <button class="btn btn-sm btn-primary" id="doc-copy-url">🔗 Copy Link</button>
                    <button class="btn btn-sm" id="doc-close-viewer">✕ Close</button>
                </div>
            </div>
            <div id="doc-viewer" class="doc-viewer" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;min-height:500px;height:70vh;max-height:800px;overflow-y:auto;position:relative;">
                <div class="loading" style="display:flex;align-items:center;justify-content:center;height:100%;min-height:400px;color:var(--text2);font-style:italic;padding:2rem;">Select a document to view.</div>
            </div>
        </div>
    `;
    
    loadDocList();
    attachDocEvents();
    setupThemeObserver();
}

// ============================================================
// THEME OBSERVER
// ============================================================

function setupThemeObserver() {
    if (window._themeObserver) {
        window._themeObserver.disconnect();
    }
    const observer = new MutationObserver(() => {
        const isLight = document.documentElement.classList.contains('light');
        isDarkMode = !isLight;
        if (currentDocPath) {
            loadDocument(currentDocPath, true);
        }
    });
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });
    window._themeObserver = observer;
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function attachDocEvents() {
    const catFilter = document.getElementById('docsCategoryFilter');
    const searchInput = document.getElementById('docsSearchInput');
    const clearBtn = document.getElementById('docsClearFiltersBtn');
    const copyBtn = document.getElementById('doc-copy-url');
    const closeBtn = document.getElementById('doc-close-viewer');
    const refreshBtn = document.getElementById('doc-refresh-btn');

    if (catFilter) catFilter.addEventListener('change', applyDocsFilter);
    if (searchInput) searchInput.addEventListener('input', applyDocsFilter);
    
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (catFilter) catFilter.value = '';
            if (searchInput) searchInput.value = '';
            applyDocsFilter();
            if (searchInput) searchInput.focus();
        });
    }
    
    if (copyBtn) copyBtn.addEventListener('click', copyDocUrl);
    if (closeBtn) closeBtn.addEventListener('click', closeDocViewer);
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadDocList();
            showToast('🔄 Refreshed document list', 'info');
        });
    }
}

// ============================================================
// LOAD DOCUMENT LIST - Smart manifest discovery
// ============================================================

export function loadDocList() {
    const container = document.getElementById('doc-list');
    if (!container) return;

    container.innerHTML = '<div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;font-style:italic;min-width:100%;">📄 Loading documents…</div>';

    // Try manifest locations (primary: /data/docs/manifest.json)
    let currentIndex = 0;
    
    function tryNextManifest() {
        if (currentIndex >= MANIFEST_PATHS.length) {
            // No manifest found — try to discover files
            console.warn('📭 No manifest found, attempting discovery...');
            discoverDocFiles();
            return;
        }
        
        const url = MANIFEST_PATHS[currentIndex];
        console.log(`📄 Fetching manifest: ${url}`);
        
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                // Extract documents from various manifest formats
                let documents = [];
                
                if (data.documents && Array.isArray(data.documents)) {
                    documents = data.documents;
                } else if (Array.isArray(data)) {
                    documents = data;
                } else if (typeof data === 'object') {
                    // Try to find any array property
                    for (const key of Object.keys(data)) {
                        if (Array.isArray(data[key]) && data[key].length > 0) {
                            documents = data[key];
                            break;
                        }
                    }
                }
                
                if (!documents || documents.length === 0) {
                    console.log(`📭 No documents in ${url}, trying next...`);
                    currentIndex++;
                    tryNextManifest();
                    return;
                }
                
                console.log(`✅ Loaded ${documents.length} documents from ${url}`);
                processManifest(documents);
            })
            .catch(err => {
                console.warn(`⚠️ Failed to load ${url}:`, err.message);
                currentIndex++;
                tryNextManifest();
            });
    }
    
    function discoverDocFiles() {
        // Attempt to fetch directory listing (if enabled)
        fetch(DOCS_BASE_PATH)
            .then(res => {
                if (res.ok) {
                    return res.text();
                }
                throw new Error('Directory listing not available');
            })
            .then(html => {
                // Parse directory listing for .html files
                const files = [];
                const regex = /href="([^"]+\.html)"/gi;
                let match;
                while ((match = regex.exec(html)) !== null) {
                    const file = match[1];
                    // Exclude index.html if present
                    if (file !== 'index.html') {
                        files.push(file);
                    }
                }
                if (files.length > 0) {
                    console.log(`📄 Discovered ${files.length} HTML files:`, files);
                    buildManifestFromFiles(files);
                } else {
                    // Fallback to known files
                    buildManifestFromFiles(KNOWN_DOC_FILES);
                }
            })
            .catch(() => {
                // Fallback to known files
                console.warn('Could not fetch directory listing, using known files');
                buildManifestFromFiles(KNOWN_DOC_FILES);
            });
    }
    
    function buildManifestFromFiles(files) {
        const docs = files.map(file => {
            const title = file
                .replace('.html', '')
                .replace(/_/g, ' ')
                .replace(/-\s*/g, ' ')
                .trim();
            // Determine category from filename
            let category = 'other';
            if (file.toLowerCase().includes('srd')) category = 'srd';
            else if (file.toLowerCase().includes('core')) category = 'core';
            else if (file.toLowerCase().includes('essentials')) category = 'essentials';
            else if (file.toLowerCase().includes('gm')) category = 'gm';
            else if (file.toLowerCase().includes('player')) category = 'player';
            else if (file.toLowerCase().includes('reference')) category = 'reference';
            return {
                id: file,
                path: DOCS_BASE_PATH + file,
                title: title,
                file: file,
                category: category,
                categoryLabel: formatCategoryLabel(category),
                categoryClass: getCategoryBadgeClass(category),
                core: category === 'core' || category === 'essentials',
                active: true,
                has_sections: false,
                section_count: 0,
                sections: [],
                author: null
            };
        });
        
        if (docs.length === 0) {
            // If still no docs, show empty state
            container.innerHTML = `
                <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;font-style:italic;min-width:100%;">
                    <div style="font-size:2rem;margin-bottom:0.5rem;">📭</div>
                    <p>No documents available.</p>
                    <p class="text-muted" style="font-size:0.85rem;">No HTML documents found in ${DOCS_BASE_PATH}.</p>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('doc-refresh-btn')?.click()" style="margin-top:0.5rem;">
                        🔄 Retry
                    </button>
                </div>
            `;
            allDocs = [];
            updateDocStats(0);
            return;
        }
        
        processManifest(docs);
    }
    
    function processManifest(manifest) {
        // Normalize each document — ensure path uses /data/docs/ prefix
        allDocs = manifest.map(doc => {
            let path = doc.path || doc.file || '';
            let file = doc.file || path.split('/').pop() || doc.id || '';
            
            // Normalize path: prefix with /data/docs/ if not already
            if (path && !path.startsWith(DOCS_BASE_PATH) && !path.startsWith('#') && !path.startsWith('http')) {
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                path = DOCS_BASE_PATH + cleanPath;
            } else if (path && path.startsWith('/') && !path.startsWith(DOCS_BASE_PATH)) {
                const cleanPath = path.substring(1);
                path = DOCS_BASE_PATH + cleanPath;
            }
            
            // If no valid path, construct from file or id
            if (!path || path === '' || path === '#') {
                let fileName = file;
                if (fileName && fileName !== '') {
                    if (!fileName.endsWith('.html')) {
                        fileName = fileName + '.html';
                    }
                } else if (doc.id) {
                    fileName = doc.id.endsWith('.html') ? doc.id : doc.id + '.html';
                } else if (doc.title) {
                    fileName = doc.title.replace(/\s+/g, '_').toLowerCase() + '.html';
                } else {
                    fileName = 'unknown.html';
                }
                path = DOCS_BASE_PATH + fileName;
            }
            
            // Ensure path starts with /
            if (!path.startsWith('/')) {
                path = '/' + path;
            }
            
            return {
                id: doc.id || doc.file || path,
                path: path,
                title: doc.title || file.replace('.html', '').replace(/_/g, ' ') || 'Untitled',
                category: doc.category || 'other',
                categoryLabel: doc.categoryLabel || formatCategoryLabel(doc.category || 'other'),
                categoryClass: doc.categoryClass || getCategoryBadgeClass(doc.category || 'other'),
                core: doc.core || false,
                active: doc.active !== undefined ? doc.active : true,
                file: file || path.split('/').pop(),
                author: doc.author || null,
                has_sections: doc.has_sections || false,
                section_count: doc.section_count || 0,
                sections: doc.sections || []
            };
        });

        // Only keep active docs
        allDocs = allDocs.filter(d => d.active !== false);

        console.log(`📚 ${allDocs.length} active documents:`, allDocs.map(d => d.title));

        if (allDocs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;font-style:italic;min-width:100%;">
                    <div style="font-size:2rem;margin-bottom:0.5rem;">📭</div>
                    <p>No documents available.</p>
                    <p class="text-muted" style="font-size:0.85rem;">The manifest is empty or no documents are active.</p>
                </div>
            `;
            updateDocStats(0);
            return;
        }

        populateCategoryFilter(allDocs);
        applyDocsFilter();
        showToast(`📚 Loaded ${allDocs.length} documents.`, 'success');
    }
    
    // Start the process
    tryNextManifest();
}

// ============================================================
// APPLY FILTERS
// ============================================================

export function applyDocsFilter() {
    const catFilter = document.getElementById('docsCategoryFilter');
    const searchInput = document.getElementById('docsSearchInput');
    const container = document.getElementById('doc-list');
    if (!container) return;

    const category = catFilter ? catFilter.value : '';
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = allDocs;

    if (category) {
        filtered = filtered.filter(d => d.category === category);
    }
    if (search) {
        filtered = filtered.filter(d =>
            d.title.toLowerCase().includes(search) ||
            d.file.toLowerCase().includes(search) ||
            (d.author && d.author.toLowerCase().includes(search))
        );
    }

    updateDocStats(filtered.length);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;font-style:italic;min-width:100%;">
                <div style="font-size:1.4rem;">🔍</div>
                <p>No documents match your filters.</p>
                <p class="text-muted" style="font-size:0.85rem;">Try adjusting the category or search term.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(doc => `
        <div class="doc-card" data-path="${escHtml(doc.path || '#')}" 
             style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.8rem;cursor:pointer;transition:all 0.15s;min-width:160px;max-width:200px;flex:0 0 auto;display:flex;flex-direction:column;justify-content:space-between;">
            <h4 style="color:var(--gold);margin-bottom:0.3rem;font-size:0.95rem;font-weight:600;word-break:break-word;">${escHtml(doc.title)}</h4>
            <div class="doc-meta" style="font-size:0.75rem;color:var(--text2);display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;margin-top:0.3rem;">
                <span class="doc-category-badge ${doc.categoryClass || 'other'}" 
                      style="display:inline-block;padding:0.05rem 0.5rem;border-radius:12px;font-size:0.6rem;font-weight:600;background:var(--bg4);color:var(--text2);letter-spacing:0.02em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">
                    ${escHtml(doc.categoryLabel || 'Other')}
                </span>
                ${doc.core ? '<span style="font-size:0.6rem;color:var(--gold);font-weight:600;">⭐ Core</span>' : ''}
                ${doc.author ? `<span style="font-size:0.65rem;opacity:0.7;">by ${escHtml(doc.author)}</span>` : ''}
                ${doc.has_sections ? `<span style="font-size:0.6rem;color:var(--gold);">📑 ${doc.section_count} sections</span>` : ''}
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.doc-card').forEach(card => {
        card.addEventListener('click', function() {
            const path = this.dataset.path;
            if (path && path !== '#') {
                loadDocument(path);
            } else {
                showToast('Invalid document path.', 'error');
            }
        });
        
        // Hover effect
        card.addEventListener('mouseenter', function() {
            this.style.borderColor = 'var(--gold)';
            this.style.transform = 'translateY(-2px)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.borderColor = 'var(--border)';
            this.style.transform = 'translateY(0)';
        });
    });
}

// ============================================================
// CATEGORY HELPERS
// ============================================================

function populateCategoryFilter(docs) {
    const sel = document.getElementById('docsCategoryFilter');
    if (!sel) return;

    const cats = new Set();
    docs.forEach(d => { if (d.category) cats.add(d.category); });

    const currentValue = sel.value;
    sel.innerHTML = '<option value="">All</option>';

    const order = ['srd', 'core', 'essentials', 'adventure', 'travel', 'expansion', 'resource', 'lore', 'magic', 'character', 'gm', 'player', 'bestiary', 'uploaded', 'other'];
    const sortedCats = Array.from(cats).sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });

    sortedCats.forEach(cat => {
        const label = formatCategoryLabel(cat);
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = label;
        sel.appendChild(opt);
    });

    if (currentValue && sortedCats.includes(currentValue)) {
        sel.value = currentValue;
    }
}

function formatCategoryLabel(cat) {
    const map = {
        'srd': '📜 SRD',
        'core': '⭐ Core',
        'essentials': '⚡ Essentials',
        'adventure': '🗡️ Adventures',
        'travel': '🗺️ Travel',
        'expansion': '📦 Expansions',
        'resource': '📚 Resources',
        'lore': '📖 Lore',
        'magic': '🔮 Magic',
        'character': '👤 Characters',
        'gm': '🎲 GM Guide',
        'player': '📖 Player Guide',
        'bestiary': '🐉 Bestiary',
        'uploaded': '📤 Uploaded',
        'other': '📄 Other'
    };
    return map[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

function getCategoryBadgeClass(cat) {
    const valid = ['srd', 'core', 'essentials', 'adventure', 'travel', 'expansion', 'resource', 'lore', 'magic', 'character', 'gm', 'player', 'bestiary', 'uploaded', 'other'];
    return valid.includes(cat) ? cat : 'other';
}

function updateDocStats(count) {
    const statsEl = document.getElementById('docsFilterStats');
    if (statsEl) {
        const total = allDocs.length;
        statsEl.textContent = count === total ? `${total} documents` : `${count} of ${total} documents`;
    }
}

// ============================================================
// LOAD DOCUMENT - Fetches from /data/docs/ with prefix
// ============================================================

export function loadDocument(docPath, preserveTheme = false) {
    currentDocPath = docPath;
    const viewerContainer = document.getElementById('doc-viewer-container');
    const viewer = document.getElementById('doc-viewer');
    const titleEl = document.getElementById('doc-viewer-title');
    if (!viewerContainer || !viewer || !titleEl) return;

    viewerContainer.style.display = 'block';
    titleEl.textContent = 'Loading…';
    viewer.innerHTML = '<div class="loading" style="display:flex;align-items:center;justify-content:center;height:100%;min-height:400px;color:var(--text2);font-style:italic;padding:2rem;">Loading document…</div>';

    // Build path to fetch — ensure /data/docs/ prefix
    let fetchPath = docPath;
    
    if (fetchPath && !fetchPath.startsWith(DOCS_BASE_PATH) && !fetchPath.startsWith('#') && !fetchPath.startsWith('http')) {
        const cleanPath = fetchPath.startsWith('/') ? fetchPath.substring(1) : fetchPath;
        fetchPath = DOCS_BASE_PATH + cleanPath;
    } else if (fetchPath && fetchPath.startsWith('/') && !fetchPath.startsWith(DOCS_BASE_PATH)) {
        const cleanPath = fetchPath.substring(1);
        fetchPath = DOCS_BASE_PATH + cleanPath;
    }

    console.log(`📄 Loading: ${fetchPath}`);
    
    fetch(fetchPath)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
        })
        .then(html => {
            const doc = allDocs.find(d => d.path === docPath || d.path === fetchPath);
            
            if (doc && doc.has_sections && doc.sections && doc.sections.length > 0) {
                viewer.innerHTML = `
                    <div style="padding:1rem;height:100%;overflow-y:auto;">
                        <h2 style="color:var(--gold);margin-top:0;">${escHtml(doc.title)}</h2>
                        <p class="text-muted">${doc.section_count || 0} sections</p>
                        <ul style="list-style:none;padding:0;margin-top:1rem;">
                            ${doc.sections.map((section, i) => `
                                <li style="margin:0.5rem 0;padding:0.5rem 1rem;background:var(--bg3);border-radius:4px;cursor:pointer;border:1px solid var(--border);transition:border-color 0.2s;" 
                                    onclick="loadDocument('${section.path || section.file}')"
                                    onmouseover="this.style.borderColor='var(--gold)'"
                                    onmouseout="this.style.borderColor='var(--border)'">
                                    <strong>${i+1}.</strong> ${section.title || 'Section ' + (i+1)}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
                titleEl.textContent = doc.title + ' (Sections)';
                return;
            }
            
            const themedHtml = injectThemeAndStyles(html, fetchPath);
            viewer.innerHTML = themedHtml;
            
            if (doc) {
                titleEl.textContent = doc.title;
            } else {
                const filename = fetchPath.split('/').pop().replace('.html', '').replace(/_/g, ' ');
                titleEl.textContent = filename;
            }
            
            executeScripts(viewer);
            showToast(`📄 Loaded: ${titleEl.textContent}`, 'success');
        })
        .catch(err => {
            console.error('Document load error:', err);
            viewer.innerHTML = `
                <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;font-style:italic;min-width:100%;">
                    <div style="font-size:2rem;margin-bottom:0.5rem;">❌</div>
                    <p>Could not load document.</p>
                    <p class="text-muted" style="font-size:0.85rem;">${err.message}</p>
                    <p class="text-muted" style="font-size:0.75rem;">Path: ${escHtml(fetchPath)}</p>
                    <button class="btn btn-sm btn-primary" onclick="location.reload()" style="margin-top:0.5rem;">🔄 Reload</button>
                </div>
            `;
            titleEl.textContent = 'Error';
            showToast(`Failed to load document: ${err.message}`, 'error');
        });
}

// ============================================================
// THEME INJECTION
// ============================================================

function injectThemeAndStyles(html, docPath) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;
    const isLight = document.documentElement.classList.contains('light');
    const themeClass = isLight ? 'light' : 'dark';
    
    return `
        <div class="integrated-document ${themeClass}" style="
            font-family: var(--font, 'Georgia', serif);
            line-height: 1.7;
            color: var(--text, #222);
            background: var(--bg, #fafaf6);
            padding: 0.5rem;
            max-width: 100%;
        ">
            <style>
                .integrated-document {
                    --bg: ${isLight ? '#fafafa' : '#0d0b0f'};
                    --bg2: ${isLight ? '#eaeaea' : '#18141c'};
                    --bg3: ${isLight ? '#dfdfdf' : '#231e29'};
                    --bg4: ${isLight ? '#d3d3d3' : '#2f2838'};
                    --text: ${isLight ? '#212121' : '#e6dce8'};
                    --text2: ${isLight ? '#555555' : '#b8aabf'};
                    --gold: ${isLight ? '#b8860b' : '#d4af37'};
                    --border: ${isLight ? '#bbbbbb' : '#3a3242'};
                    --accent: ${isLight ? '#8b5e3c' : '#c99a6b'};
                }
                .integrated-document h1 { font-size: 2.2rem; margin-top: 0; border-bottom: 2px solid var(--border); padding-bottom: 0.3rem; color: var(--text); }
                .integrated-document h2 { font-size: 1.8rem; margin-top: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.2rem; color: var(--text); }
                .integrated-document h3 { font-size: 1.4rem; margin-top: 1.2rem; color: var(--text); }
                .integrated-document h4 { font-size: 1.2rem; margin-top: 1rem; color: var(--text); }
                .integrated-document p { margin: 0.8rem 0; color: var(--text); }
                .integrated-document ul, .integrated-document ol { margin: 0.8rem 0 0.8rem 1.5rem; color: var(--text); }
                .integrated-document li { margin: 0.3rem 0; }
                .integrated-document blockquote { margin: 1rem 0; padding: 0.5rem 1.5rem; border-left: 4px solid var(--gold); background: var(--bg3); color: var(--text2); }
                .integrated-document table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.95rem; }
                .integrated-document th, .integrated-document td { border: 1px solid var(--border); padding: 0.5rem 0.8rem; text-align: left; color: var(--text); }
                .integrated-document th { background: var(--bg3); color: var(--gold); }
                .integrated-document code { background: var(--bg3); padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9rem; color: var(--text); }
                .integrated-document pre { background: var(--bg3); padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.9rem; color: var(--text); }
                .integrated-document img { max-width: 100%; height: auto; }
                .integrated-document a { color: var(--gold); text-decoration: none; }
                .integrated-document a:hover { text-decoration: underline; }
                @media (max-width: 768px) {
                    .integrated-document h1 { font-size: 1.8rem; }
                    .integrated-document h2 { font-size: 1.5rem; }
                    .integrated-document h3 { font-size: 1.2rem; }
                }
            </style>
            <div class="document-content">${bodyContent}</div>
        </div>
    `;
}

// ============================================================
// EXECUTE SCRIPTS
// ============================================================

function executeScripts(container) {
    const scripts = container.querySelectorAll('script');
    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        if (oldScript.src) {
            newScript.src = oldScript.src;
        } else {
            newScript.textContent = oldScript.textContent;
        }
        Array.from(oldScript.attributes).forEach(attr => {
            if (attr.name !== 'src' && attr.name !== 'type') {
                newScript.setAttribute(attr.name, attr.value);
            }
        });
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}

// ============================================================
// CLOSE VIEWER
// ============================================================

export function closeDocViewer() {
    const container = document.getElementById('doc-viewer-container');
    const viewer = document.getElementById('doc-viewer');
    if (container) container.style.display = 'none';
    if (viewer) viewer.innerHTML = '<div class="loading" style="display:flex;align-items:center;justify-content:center;height:100%;min-height:400px;color:var(--text2);font-style:italic;padding:2rem;">Select a document to view.</div>';
    currentDocPath = null;
}

// ============================================================
// COPY URL
// ============================================================

export function copyDocUrl() {
    if (!currentDocPath) {
        showToast('No document loaded.', 'error');
        return;
    }
    let url = currentDocPath;
    if (url.startsWith('#')) {
        showToast('Uploaded documents are not permanently stored.', 'info');
        return;
    }
    navigator.clipboard.writeText(window.location.origin + url)
        .then(() => showToast('Document URL copied!', 'success'))
        .catch(() => {
            prompt('Copy this URL:', window.location.origin + url);
        });
}

// ============================================================
// LIFECYCLE
// ============================================================

export function onActivate() {
    console.log('[Docs] Activated');
    if (allDocs.length === 0) {
        loadDocList();
    }
}

export function onDeactivate() {
    console.log('[Docs] Deactivated');
}

export function refresh() {
    loadDocList();
}

export function destroy() {
    if (window._themeObserver) {
        window._themeObserver.disconnect();
        window._themeObserver = null;
    }
    allDocs = [];
    currentDocPath = null;
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
    render,
    loadDocList,
    applyDocsFilter,
    loadDocument,
    closeDocViewer,
    copyDocUrl,
    onActivate,
    onDeactivate,
    refresh,
    destroy
};