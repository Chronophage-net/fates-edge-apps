/**
 * Wiki feature – modern, clean documentation-style interface.
 * FIXED: Exports renderWiki so editor can refresh.
 * FIXED: Proper event listener cleanup.
 */

import { getState, addWikiEntry, updateWikiEntry, deleteWikiEntry, saveState } from '../../core/state.js';
import { escHtml, debounce } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

// ─── Configuration ──────────────────────────────────────────────────────

const WIKI_REMOTE_URL = './data/wiki.json';   // absolute path from site root

let container = null;
let _eventListeners = [];   // for cleanup

// ─── Render ─────────────────────────────────────────────────────────────

export function render(el) {
    container = el;
    container.innerHTML = `
        <div class="wiki-modern-layout">
            <header class="wiki-header">
                <h1 class="wiki-title">📖 Wiki</h1>
                <p class="wiki-subtitle">Reference rules, patrons, regions, equipment, talents, assets, and more. Markdown supported.</p>
            </header>

            <div class="wiki-grid">
                <!-- Sidebar -->
                <aside class="wiki-sidebar">
                    <div class="wiki-sidebar-section">
                        <h3>📂 Categories</h3>
                        <ul class="wiki-category-list" id="wiki-category-list"></ul>
                    </div>
                    <div class="wiki-sidebar-section">
                        <h3>🏷️ Tags</h3>
                        <div class="wiki-tag-cloud" id="wiki-tag-cloud"></div>
                    </div>
                    <div class="wiki-sidebar-section">
                        <h3>ℹ️ Stats</h3>
                        <div id="wiki-stats-sidebar">
                            <div>Total: <span id="wiki-total-count">0</span></div>
                            <div>Local: <span id="wiki-local-count">0</span></div>
                            <div>Bundled: <span id="wiki-remote-count">0</span></div>
                            <div>Hidden: <span id="wiki-hidden-count">0</span></div>
                        </div>
                    </div>
                    <div class="wiki-sidebar-section">
                        <button class="btn btn-primary btn-sm" id="wiki-add-btn" style="width:100%;">+ Add Entry</button>
                        <button class="btn btn-sm btn-secondary" id="wiki-reload-btn" style="width:100%;margin-top:0.3rem;">🔄 Reload Bundled</button>
                        <button class="btn btn-sm btn-ghost" id="wiki-import-btn" style="width:100%;margin-top:0.3rem;">📥 Import All</button>
                    </div>
                </aside>

                <!-- Main Content -->
                <main class="wiki-content">
                    <div class="wiki-toolbar">
                        <div class="wiki-search-wrap">
                            <input type="text" id="wiki-search" placeholder="🔍 Search wiki…" class="wiki-search-input" />
                        </div>
                        <div class="wiki-filter-wrap">
                            <select id="wiki-cat-filter" class="wiki-filter-select">
                                <option value="">All Categories</option>
                                <option value="rules">📜 Rules</option>
                                <option value="patrons">👁️ Patrons</option>
                                <option value="regions">🌍 Regions</option>
                                <option value="magic">🔮 Magic</option>
                                <option value="combat">⚔️ Combat</option>
                                <option value="lore">📚 Lore</option>
                                <option value="talents">🧠 Talents</option>
                                <option value="assets">🏛️ Assets</option>
                                <option value="equipment">⚒️ Equipment</option>
                                <option value="characters">👤 Characters</option>
                                <option value="monsters">🐉 Monsters</option>
                            </select>
                        </div>
                        <div id="wiki-status" class="wiki-status"></div>
                    </div>

                    <div id="wiki-list-container">
                        <div id="wiki-list"></div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderWiki();
    attachEvents();
    loadRemoteWiki();   // try to load bundled wiki
}

// ─── Load Remote Wiki ──────────────────────────────────────────────────

export function loadRemoteWiki() {
    const status = document.getElementById('wiki-status');
    if (status) status.textContent = '📥 Loading bundled wiki…';

    return fetch(WIKI_REMOTE_URL)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
            return res.json();
        })
        .then(data => {
            // --- FIX: handle various structures ---
            let entries = [];
            if (Array.isArray(data)) {
                entries = data;
            } else if (data && typeof data === 'object') {
                // Try common keys: entries, items, data, wiki, etc.
                for (const key of ['entries', 'items', 'data', 'wiki', 'docs']) {
                    if (Array.isArray(data[key])) {
                        entries = data[key];
                        break;
                    }
                }
                if (entries.length === 0) {
                    // If still empty, treat the object itself as a single entry?
                    // Or log a warning and use empty array.
                    console.warn('Wiki data is an object but no array property found. Using empty array.');
                }
            }

            if (!Array.isArray(entries) || entries.length === 0) {
                throw new Error('wiki.json must contain an array (or an object with an "entries" array).');
            }

            const state = getState();
            if (!state.wikiEntries) state.wikiEntries = [];
            if (!state.hiddenRemoteIds) state.hiddenRemoteIds = [];

            // Remove existing remote entries
            state.wikiEntries = state.wikiEntries.filter(e => e.source !== 'remote');

            let added = 0;
            entries.forEach((entry, idx) => {
                if (!entry || !entry.title) return;
                const remoteId = 'remote-' + (entry.id || idx);
                if (state.hiddenRemoteIds.includes(remoteId)) return;

                const localDup = state.wikiEntries.find(e =>
                    e.title.toLowerCase().trim() === entry.title.toLowerCase().trim()
                );
                if (localDup) return;

                state.wikiEntries.push({
                    id: remoteId,
                    title: entry.title,
                    category: entry.category || 'lore',
                    body: entry.body || '',
                    tags: Array.isArray(entry.tags) ? entry.tags :
                          (entry.tags ? String(entry.tags).split(',').map(t => t.trim()).filter(Boolean) : []),
                    cost: entry.cost != null ? Number(entry.cost) : null,
                    slot: entry.slot || '',
                    source: 'remote'
                });
                added++;
            });
            saveState();
            if (status) status.textContent = `✅ Loaded ${added} bundled entries.`;
            renderWiki();
            if (added > 0) showToast(`📥 Loaded ${added} bundled wiki entries.`, 'success');
            return { added, total: entries.length };
        })
        .catch(err => {
            console.warn('Remote wiki load failed:', err);
            const status = document.getElementById('wiki-status');
            if (status) status.textContent = `⚠️ Could not load bundled wiki (${err.message}). Using local entries only.`;
            renderWiki();
            return { added: 0, total: 0, error: err };
        });
}

// ─── Render Wiki (exported) ───────────────────────────────────────────

export function renderWiki() {
    const entries = getFilteredEntries();
    const el = document.getElementById('wiki-list');
    if (!el) return;

    updateStats();
    renderSidebar(entries);

    if (entries.length === 0) {
        el.innerHTML = `
            <div class="wiki-empty-state">
                <div style="font-size:3rem;margin-bottom:0.5rem;">📖</div>
                <div>No matching entries.</div>
                <div style="font-size:0.9rem;color:var(--text3);">Try adjusting your search or filter.</div>
            </div>
        `;
        return;
    }

    el.innerHTML = entries.map(e => {
        const isRemote = e.source === 'remote';
        const isHidden = isRemote && (window._hiddenRemoteIds || []).includes(String(e.id));
        if (isHidden) return '';

        const sourceBadge = isRemote
            ? `<span class="badge badge-remote">📦 Bundled</span>`
            : `<span class="badge badge-local">📝 Local</span>`;
        const costBadge = e.cost != null ? `<span class="badge badge-cost">${e.cost} XP</span>` : '';
        const tagBadges = (e.tags || []).slice(0, 4).map(t => `<span class="badge badge-tag">#${escHtml(t)}</span>`).join('');
        const moreTags = (e.tags || []).length > 4 ? `<span class="badge badge-more">+${(e.tags || []).length - 4}</span>` : '';

        let actions = '';
        if (isRemote) {
            const isCloned = isEntryCloned(e);
            if (isCloned) {
                actions = `<span class="badge badge-cloned" style="color:var(--green);">✅ Cloned</span>`;
            } else {
                actions = `
                    <button class="btn btn-xs btn-primary wiki-clone-btn" data-id="${escHtml(String(e.id))}">📋 Clone</button>
                    <button class="btn btn-xs btn-ghost wiki-hide-btn" data-id="${escHtml(String(e.id))}" title="Hide this entry">✕</button>
                `;
            }
        } else {
            actions = `
                <button class="btn btn-xs btn-primary wiki-edit-btn" data-id="${escHtml(String(e.id))}">✏️ Edit</button>
                <button class="btn btn-xs btn-danger wiki-delete-btn" data-id="${escHtml(String(e.id))}">🗑️</button>
            `;
        }

        const bodyPreview = e.body
            ? `<div class="wiki-entry-preview">${escHtml(e.body.slice(0, 300))}${e.body.length > 300 ? '…' : ''}</div>`
            : '';

        return `
            <div class="wiki-entry-card" data-id="${escHtml(String(e.id))}">
                <div class="wiki-entry-header">
                    <h3 class="wiki-entry-title" onclick="window.toggleWikiBody('${escHtml(String(e.id))}')">
                        ${escHtml(e.title)}
                    </h3>
                    <div class="wiki-entry-meta">
                        <span class="wiki-entry-category">${escHtml(e.category || 'uncategorized')}</span>
                        ${sourceBadge}
                        ${costBadge}
                    </div>
                </div>
                <div class="wiki-entry-tags">
                    ${tagBadges}
                    ${moreTags}
                </div>
                <div class="wiki-entry-summary" id="wiki-body-${escHtml(String(e.id))}">
                    ${bodyPreview}
                    ${e.body && e.body.length > 300 ? `<div class="wiki-entry-full" style="display:none;">${renderMarkdown(e.body)}</div>` : renderMarkdown(e.body)}
                </div>
                <div class="wiki-entry-actions">
                    ${actions}
                    ${e.body && e.body.length > 300 ? `<button class="btn btn-xs btn-ghost wiki-expand-btn" data-id="${escHtml(String(e.id))}">▼ Expand</button>` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Attach event listeners using delegation on the list container
    // Use click delegation to avoid re-binding each time
    // We'll attach a single delegated listener in attachEvents instead
    // But for now, we'll attach directly as before for simplicity.
    // However, to avoid duplicate listeners, we'll clean up any previous listeners.
    // We'll move this to attachEvents.
    // Instead, we'll attach event listeners in a separate function called from attachEvents.
    attachWikiItemEvents();
}

// ─── Attach item events (delegated) ──────────────────────────────────

function attachWikiItemEvents() {
    const list = document.getElementById('wiki-list');
    if (!list) return;

    // Remove any previous listener to avoid duplicates
    if (list._wikiListener) {
        list.removeEventListener('click', list._wikiListener);
    }

    const handler = (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        switch (action) {
            case 'edit':
                openWikiEditor(id);
                break;
            case 'clone':
                cloneRemoteWikiEntry(id);
                break;
            case 'delete':
                deleteWikiHandler(id);
                break;
            case 'hide':
                hideRemoteEntry(id);
                break;
            case 'expand':
                toggleWikiBody(id);
                break;
        }
    };

    list.addEventListener('click', handler);
    list._wikiListener = handler;
}

// ─── Sidebar, Stats, Filter ──────────────────────────────────────────

function renderSidebar(entries) {
    // Categories
    const catList = document.getElementById('wiki-category-list');
    if (catList) {
        const cats = {};
        entries.forEach(e => {
            const c = e.category || 'uncategorized';
            cats[c] = (cats[c] || 0) + 1;
        });
        const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
        catList.innerHTML = sorted.map(([cat, count]) =>
            `<li><a href="#" class="wiki-category-link" data-cat="${escHtml(cat)}">${escHtml(cat)} <span class="count">(${count})</span></a></li>`
        ).join('');
        catList.querySelectorAll('.wiki-category-link').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const cat = a.dataset.cat;
                const filter = document.getElementById('wiki-cat-filter');
                if (filter) {
                    filter.value = cat;
                    renderWiki();
                }
            });
        });
    }

    // Tag cloud
    const tagCloud = document.getElementById('wiki-tag-cloud');
    if (tagCloud) {
        const tagCount = {};
        entries.forEach(e => {
            (e.tags || []).forEach(t => {
                tagCount[t] = (tagCount[t] || 0) + 1;
            });
        });
        const sortedTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
        tagCloud.innerHTML = sortedTags.map(([tag, count]) =>
            `<span class="wiki-tag" data-tag="${escHtml(tag)}">#${escHtml(tag)} <span class="count">(${count})</span></span>`
        ).join(' ');
        tagCloud.querySelectorAll('.wiki-tag').forEach(el => {
            el.addEventListener('click', () => {
                const search = document.getElementById('wiki-search');
                if (search) {
                    search.value = el.dataset.tag;
                    renderWiki();
                }
            });
        });
    }
}

function updateStats() {
    const state = getState();
    const entries = state.wikiEntries || [];
    const hidden = state.hiddenRemoteIds || [];
    const total = entries.length;
    const local = entries.filter(e => e.source !== 'remote').length;
    const remote = entries.filter(e => e.source === 'remote').length;

    document.getElementById('wiki-total-count').textContent = total;
    document.getElementById('wiki-local-count').textContent = local;
    document.getElementById('wiki-remote-count').textContent = remote;
    document.getElementById('wiki-hidden-count').textContent = hidden.length;
}

function getFilteredEntries() {
    const state = getState();
    const search = document.getElementById('wiki-search')?.value?.toLowerCase() || '';
    const cat = document.getElementById('wiki-cat-filter')?.value || '';
    let entries = state.wikiEntries || [];

    if (search) {
        entries = entries.filter(e =>
            (e.title || '').toLowerCase().includes(search) ||
            (e.body || '').toLowerCase().includes(search) ||
            (e.tags || []).some(t => t.toLowerCase().includes(search))
        );
    }
    if (cat) {
        entries = entries.filter(e => e.category === cat);
    }

    // Sort: local first, then remote, then by title
    entries.sort((a, b) => {
        if (a.source === 'remote' && b.source !== 'remote') return 1;
        if (a.source !== 'remote' && b.source === 'remote') return -1;
        return (a.title || '').localeCompare(b.title || '');
    });

    return entries;
}

function renderMarkdown(text) {
    if (!text) return '';
    try {
        if (window.marked) {
            if (typeof window.marked.parse === 'function') {
                return window.marked.parse(text);
            }
            if (typeof window.marked === 'function') {
                return window.marked(text);
            }
        }
        return escHtml(text).replace(/\n/g, '<br>');
    } catch (e) {
        return escHtml(text);
    }
}

// ─── Entry Management ──────────────────────────────────────────────────

function isEntryCloned(entry) {
    const state = getState();
    const entries = state.wikiEntries || [];
    return entries.some(e =>
        e.source !== 'remote' &&
        e.title.toLowerCase().trim() === entry.title.toLowerCase().trim()
    );
}

function cloneRemoteWikiEntry(remoteId) {
    const state = getState();
    const entries = state.wikiEntries || [];
    const remote = entries.find(w => String(w.id) === String(remoteId) && w.source === 'remote');

    if (!remote) {
        showToast('Bundled entry not found.', 'error');
        return;
    }

    if (isEntryCloned(remote)) {
        showToast(`"${remote.title}" already cloned.`, 'warning');
        return;
    }

    const clone = {
        ...remote,
        id: 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        source: 'local',
        title: remote.title,
    };

    if (!state.wikiEntries) state.wikiEntries = [];
    state.wikiEntries.push(clone);
    saveState();
    renderWiki();
    showToast(`📋 Cloned "${remote.title}" from bundled wiki.`, 'success');

    setTimeout(() => openWikiEditor(clone.id), 300);
}

function hideRemoteEntry(remoteId) {
    const state = getState();
    const entries = state.wikiEntries || [];
    const entry = entries.find(e => String(e.id) === String(remoteId));
    if (!entry) return;

    if (!state.hiddenRemoteIds) state.hiddenRemoteIds = [];
    state.hiddenRemoteIds.push(String(remoteId));
    state.wikiEntries = entries.filter(e => String(e.id) !== String(remoteId));
    saveState();
    renderWiki();
    showToast(`🚫 Hidden "${entry.title}" from view.`, 'info');
}

function deleteWikiHandler(id) {
    const state = getState();
    const entries = state.wikiEntries || [];
    const entry = entries.find(e => String(e.id) === String(id));
    if (!entry) return;

    if (entry.source === 'remote') {
        if (!confirm(`Hide bundled entry "${entry.title}"?`)) return;
        hideRemoteEntry(id);
    } else {
        if (!confirm(`Delete wiki entry "${entry.title}"?`)) return;
        state.wikiEntries = entries.filter(e => String(e.id) !== String(id));
        saveState();
        renderWiki();
        showToast(`🗑️ Deleted "${entry.title}".`, 'success');
    }
}

function importAllFromWiki() {
    const state = getState();
    const entries = state.wikiEntries || [];
    const remoteEntries = entries.filter(e => e.source === 'remote');

    if (remoteEntries.length === 0) {
        showToast('No bundled entries to import.', 'warning');
        return;
    }

    const toImport = remoteEntries.filter(remote => !isEntryCloned(remote));

    if (toImport.length === 0) {
        showToast('All bundled entries already cloned.', 'info');
        return;
    }

    if (!confirm(`Import all ${toImport.length} bundled entries?`)) return;

    let imported = 0;
    toImport.forEach(remote => {
        const clone = {
            ...remote,
            id: 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            source: 'local',
            title: remote.title,
        };
        state.wikiEntries.push(clone);
        imported++;
    });

    saveState();
    renderWiki();
    showToast(`📥 Imported ${imported} bundled entries.`, 'success');
}

// ─── Toggle Body ──────────────────────────────────────────────────────

export function toggleWikiBody(id) {
    const card = document.querySelector(`.wiki-entry-card[data-id="${id}"]`);
    if (!card) return;
    const fullBody = card.querySelector('.wiki-entry-full');
    const preview = card.querySelector('.wiki-entry-preview');
    const expandBtn = card.querySelector('.wiki-expand-btn');
    if (fullBody) {
        const isHidden = fullBody.style.display === 'none';
        fullBody.style.display = isHidden ? 'block' : 'none';
        if (preview) preview.style.display = isHidden ? 'none' : 'block';
        if (expandBtn) expandBtn.textContent = isHidden ? '▲ Collapse' : '▼ Expand';
    }
}
window.toggleWikiBody = toggleWikiBody;

// ─── Editor Integration ──────────────────────────────────────────────

export function openWikiEditor(id) {
    import('./editor.js')
        .then(module => {
            if (module.openEditor) {
                module.openEditor(id);
            } else {
                showToast('Editor module not available.', 'error');
            }
        })
        .catch(err => {
            console.error('Failed to load editor:', err);
            showToast('Failed to load editor. Please check console.', 'error');
        });
}

// ─── Event Listeners ──────────────────────────────────────────────────

function addEventListenerSafe(el, event, handler) {
    if (!el) return;
    el.addEventListener(event, handler);
    _eventListeners.push({ el, event, handler });
}

export function attachEvents() {
    // Clean up previous listeners
    detachEvents();

    const search = document.getElementById('wiki-search');
    const cat = document.getElementById('wiki-cat-filter');
    const addBtn = document.getElementById('wiki-add-btn');
    const reloadBtn = document.getElementById('wiki-reload-btn');
    const importBtn = document.getElementById('wiki-import-btn');

    if (search) {
        const debouncedRender = debounce(renderWiki, 200);
        addEventListenerSafe(search, 'input', debouncedRender);
    }
    if (cat) {
        addEventListenerSafe(cat, 'change', renderWiki);
    }
    if (addBtn) {
        addEventListenerSafe(addBtn, 'click', () => openWikiEditor(null));
    }
    if (reloadBtn) {
        addEventListenerSafe(reloadBtn, 'click', () => {
            loadRemoteWiki().then(() => renderWiki());
        });
    }
    if (importBtn) {
        addEventListenerSafe(importBtn, 'click', importAllFromWiki);
    }
}

export function detachEvents() {
    _eventListeners.forEach(({ el, event, handler }) => {
        el.removeEventListener(event, handler);
    });
    _eventListeners = [];
}

// ─── Lifecycle ─────────────────────────────────────────────────────────

export function refresh() {
    renderWiki();
}

export function destroy() {
    detachEvents();
    container = null;
}

// ─── Exports ──────────────────────────────────────────────────────────

export default {
    render,
    destroy,
    refresh,
    loadRemoteWiki,
    renderWiki,
    toggleWikiBody,
    openWikiEditor,
    attachEvents,
    detachEvents,
};