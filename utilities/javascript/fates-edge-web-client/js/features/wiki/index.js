/**
 * Wiki feature – modern, clean documentation-style interface.
 * FIXED: Exports renderWiki so editor can refresh.
 * FIXED: Proper event listener cleanup.
 */

import { t as i18nText } from '@core/i18n.js';
import { getState, addWikiEntry, updateWikiEntry, deleteWikiEntry, saveState } from '@core/state.js';
import { escHtml, debounce } from '@core/utils.js';
import { showToast } from '@components/Toast.js';
import { renderWikiMarkdown as renderMarkdown } from './markdown.js';

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
                <h1 class="wiki-title" data-i18n="feature.wiki.wiki">📖 Wiki</h1>
                <p class="wiki-subtitle" data-i18n="feature.wiki.referenceRulesPatronsRegionsEquipmentTalentsAssets">Reference rules, patrons, regions, equipment, talents, assets, and more. Markdown supported.</p>
            </header>

            <div class="wiki-grid">
                <!-- Sidebar -->
                <aside class="wiki-sidebar">
                    <div class="wiki-sidebar-section">
                        <h3 data-i18n="feature.wiki.categories">📂 Categories</h3>
                        <ul class="wiki-category-list" id="wiki-category-list"></ul>
                    </div>
                    <div class="wiki-sidebar-section">
                        <h3 data-i18n="feature.wiki.tags">🏷️ Tags</h3>
                        <div class="wiki-tag-cloud" id="wiki-tag-cloud"></div>
                    </div>
                    <div class="wiki-sidebar-section">
                        <h3 data-i18n="feature.wiki.stats">ℹ️ Stats</h3>
                        <div id="wiki-stats-sidebar">
                            <div>Total: <span id="wiki-total-count">0</span></div>
                            <div>Local: <span id="wiki-local-count">0</span></div>
                            <div>Bundled: <span id="wiki-remote-count">0</span></div>
                            <div>Hidden: <span id="wiki-hidden-count">0</span></div>
                        </div>
                    </div>
                    <div class="wiki-sidebar-section">
                        <button class="btn btn-gold btn-sm wiki-sidebar-action" id="wiki-add-btn" data-i18n="feature.wiki.addEntry">+ Add entry</button>
                        <!-- Reload and Import All are maintenance actions, not
                             everyday ones: Import All copies every bundled
                             entry into local storage and Reload re-fetches the
                             bundle. Both are quiet utility controls so the one
                             action people actually want stays the loud one. -->
                        <div class="wiki-sidebar-utils">
                            <button class="btn btn-xs btn-utility" id="wiki-reload-btn" title="Re-fetch the bundled wiki" data-i18n="feature.wiki.reloadBundled">Reload bundled</button>
                            <button class="btn btn-xs btn-utility" id="wiki-import-btn" title="Copy every bundled entry into your own wiki" data-i18n="feature.wiki.importAll">Import all</button>
                        </div>
                    </div>
                </aside>

                <!-- Main Content -->
                <main class="wiki-content">
                    <div class="wiki-toolbar">
                        <div class="wiki-search-wrap">
                            <input type="text" id="wiki-search" placeholder="🔍 Search wiki…" class="wiki-search-input" / data-i18n-attr="placeholder:feature.wiki.searchWiki">
                        </div>
                        <div class="wiki-filter-wrap">
                            <!-- Options are filled from the entries that
                                 actually exist (see refreshCategoryFilter).
                                 This used to be a hardcoded list of eleven
                                 categories, nine of which matched nothing in
                                 the shipped data while four real categories
                                 were missing from it entirely. -->
                            <select id="wiki-cat-filter" class="wiki-filter-select">
                                <option value="" data-i18n="feature.wiki.allCategories">All Categories</option>
                            </select>
                        </div>
                        <div class="wiki-filter-wrap">
                            <select id="wiki-region-filter" class="wiki-filter-select">
                                <option value="">All regions</option>
                            </select>
                        </div>
                        <div id="wiki-status" class="wiki-status"></div>
                    </div>
                    <div class="wiki-resultbar">
                        <span id="wiki-result-count" class="wiki-result-count"></span>
                        <span id="wiki-active-filters" class="wiki-active-filters"></span>
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
    if (status) status.textContent = i18nText("feature.wiki.loadingBundledWiki", null, "📥 Loading bundled wiki…");

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
                    // Facets the bundled data carries and the card now shows:
                    // a one-line subtitle, the region the entry belongs to,
                    // and the suit/number of the draw card it came from.
                    subtitle: entry.subtitle || '',
                    category: entry.category || 'lore',
                    body: entry.body || '',
                    tags: Array.isArray(entry.tags) ? entry.tags :
                          (entry.tags ? String(entry.tags).split(',').map(t => t.trim()).filter(Boolean) : []),
                    cost: entry.cost != null ? Number(entry.cost) : null,
                    slot: entry.slot || '',
                    region: entry.region || '',
                    suit: entry.suit || '',
                    card: entry.card != null ? entry.card : null,
                    stub: !!entry.stub,
                    source: 'remote'
                });
                added++;
            });
            saveState();
            if (status) status.textContent = i18nText("feature.wiki.loadedValueBundledEntries", { value0: added }, "✅ Loaded {{value0}} bundled entries.");
            renderWiki();
            if (added > 0) showToast(i18nText("feature.wiki.loadedValueBundledWikiEntries", { value0: added }, "📥 Loaded {{value0}} bundled wiki entries."), 'success');
            return { added, total: entries.length };
        })
        .catch(err => {
            console.warn('Remote wiki load failed:', err);
            const status = document.getElementById('wiki-status');
            if (status) status.textContent = i18nText("feature.wiki.couldNotLoadBundledWikiValueUsing", { value0: err.message }, "⚠️ Could not load bundled wiki ({{value0}}). Using local entries only.");
            renderWiki();
            return { added: 0, total: 0, error: err };
        });
}

// ─── Card rendering ───────────────────────────────────────────────────

const SUIT_GLYPH = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

// How much rendered body to show before the card offers to expand. The old
// code cut at 300 characters of *raw* text and showed that slice escaped,
// so every long entry displayed its Markdown source (asterisks, backticks,
// list markers) until it was expanded, while short entries rendered
// properly. Now both render, and the clamp is a CSS line-clamp instead —
// the content is the same either way, only its height changes.
const CLAMP_CHARS = 320;

export function renderEntryCard(e) {
    const isRemote = e.source === 'remote';
    if (isRemote && (window._hiddenRemoteIds || []).includes(String(e.id))) return '';

    const id = escHtml(String(e.id));
    const body = e.body || '';
    const isLong = body.length > CLAMP_CHARS;
    const isStub = !!e.stub || !body.trim();

    const suit = (e.suit || '').toLowerCase();
    const pip = SUIT_GLYPH[suit]
        ? `<span class="wiki-card-pip suit-${escHtml(suit)}" title="${escHtml(suit)}${e.card ? ' ' + e.card : ''}">${SUIT_GLYPH[suit]}${e.card ? `<span class="pip-num">${escHtml(String(e.card))}</span>` : ''}</span>`
        : '';

    const facets = [
        e.region ? `<span class="wiki-facet wiki-facet-region">${escHtml(e.region)}</span>` : '',
        e.cost != null ? `<span class="wiki-facet wiki-facet-cost">${escHtml(String(e.cost))} XP</span>` : '',
        e.slot ? `<span class="wiki-facet">${escHtml(e.slot)}</span>` : '',
    ].filter(Boolean).join('');

    const tags = (e.tags || []);
    const tagBadges = tags.slice(0, 5)
        .map(t => `<button type="button" class="wiki-tag-chip" data-action="tag" data-tag="${escHtml(t)}">#${escHtml(t)}</button>`)
        .join('');
    const moreTags = tags.length > 5 ? `<span class="wiki-tag-more">+${tags.length - 5}</span>` : '';

    // Destructive and hide controls are deliberately quiet: they sit in a
    // hover-revealed strip rather than competing with the entry's content.
    // See .wiki-entry-tools / .btn-danger in css/app.css.
    const tools = isRemote
        ? (isEntryCloned(e)
            ? `<span class="wiki-cloned-note">Cloned</span>`
            : `<button class="btn btn-xs btn-quiet" data-action="clone" data-id="${id}">Clone to my wiki</button>
               <button class="btn btn-xs btn-danger btn-icon" data-action="hide" data-id="${id}" title="Hide this bundled entry" aria-label="Hide this bundled entry">✕</button>`)
        : `<button class="btn btn-xs btn-quiet" data-action="edit" data-id="${id}">Edit</button>
           <button class="btn btn-xs btn-danger btn-icon" data-action="delete" data-id="${id}" title="Delete this entry" aria-label="Delete this entry">🗑</button>`;

    const summary = isStub
        ? `<p class="wiki-entry-stub">No description recorded for this entry yet.</p>`
        : `<div class="wiki-entry-body${isLong ? ' is-clamped' : ''}">${renderMarkdown(body)}</div>`;

    return `
        <article class="wiki-entry-card${isStub ? ' is-stub' : ''}" data-id="${id}">
            <header class="wiki-entry-header">
                ${pip}
                <div class="wiki-entry-heading">
                    <h3 class="wiki-entry-title">${escHtml(e.title)}</h3>
                    ${e.subtitle ? `<p class="wiki-entry-subtitle">${escHtml(e.subtitle)}</p>` : ''}
                </div>
                <span class="wiki-entry-category" data-action="category" data-cat="${escHtml(e.category || 'uncategorized')}">${escHtml(e.category || 'uncategorized')}</span>
            </header>
            ${facets ? `<div class="wiki-entry-facets">${facets}</div>` : ''}
            <div class="wiki-entry-summary">${summary}</div>
            ${tags.length ? `<div class="wiki-entry-tags">${tagBadges}${moreTags}</div>` : ''}
            <footer class="wiki-entry-tools">
                ${isLong ? `<button class="btn btn-xs btn-quiet wiki-expand-btn" data-action="expand" data-id="${id}">Read more</button>` : '<span></span>'}
                <span class="wiki-entry-actions">${tools}</span>
            </footer>
        </article>
    `;
}

// ─── Render Wiki (exported) ───────────────────────────────────────────

export function renderWiki() {
    const entries = getFilteredEntries();
    const el = document.getElementById('wiki-list');
    if (!el) return;

    updateStats();
    refreshFacetFilters();
    renderSidebar(entries);
    updateResultBar(entries.length);

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

    el.innerHTML = entries.map(e => renderEntryCard(e)).filter(Boolean).join('');

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
            case 'tag': {
                const input = document.getElementById('wiki-search');
                if (input) { input.value = target.dataset.tag || ''; renderWiki(); }
                break;
            }
            case 'category': {
                const select = document.getElementById('wiki-cat-filter');
                if (select) { select.value = target.dataset.cat || ''; renderWiki(); }
                break;
            }
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
            `<button type="button" class="wiki-tag" data-tag="${escHtml(tag)}">#${escHtml(tag)} <span class="count">${count}</span></button>`
        ).join('');
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

/**
 * Fill the category and region selects from the entries that exist, keeping
 * whatever the user had chosen if it is still a valid option. Called on
 * every render because the bundled wiki arrives asynchronously — the first
 * render happens before it has loaded.
 */
function refreshFacetFilters() {
    const all = getState().wikiEntries || [];
    const fill = (selectId, values, allLabel) => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const current = select.value;
        const sorted = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const signature = sorted.join('|');
        if (select.dataset.signature === signature) return;   // nothing changed
        select.dataset.signature = signature;
        select.innerHTML = `<option value="">${allLabel}</option>` +
            sorted.map(v => `<option value="${escHtml(v)}">${escHtml(v)}</option>`).join('');
        if (sorted.includes(current)) select.value = current;
    };
    fill('wiki-cat-filter', all.map(e => e.category), 'All categories');
    fill('wiki-region-filter', all.map(e => e.region), 'All regions');
}

function updateResultBar(shown) {
    const countEl = document.getElementById('wiki-result-count');
    const total = (getState().wikiEntries || []).length;
    if (countEl) {
        countEl.textContent = shown === total
            ? `${total} entries`
            : `${shown} of ${total} entries`;
    }
    const chips = [];
    const search = document.getElementById('wiki-search')?.value?.trim();
    const cat = document.getElementById('wiki-cat-filter')?.value;
    const region = document.getElementById('wiki-region-filter')?.value;
    if (search) chips.push(['search', `“${search}”`]);
    if (cat) chips.push(['cat', cat]);
    if (region) chips.push(['region', region]);
    const el = document.getElementById('wiki-active-filters');
    if (el) {
        el.innerHTML = chips.map(([kind, label]) =>
            `<button type="button" class="wiki-filter-chip" data-action="clear-filter" data-kind="${kind}">${escHtml(label)} <span aria-hidden="true">×</span></button>`
        ).join('');
    }
}

function updateStats() {
    const state = getState();
    const entries = state.wikiEntries || [];
    const hidden = state.hiddenRemoteIds || [];
    const total = entries.length;
    const local = entries.filter(e => e.source !== 'remote').length;
    const remote = entries.filter(e => e.source === 'remote').length;

    // Null-guarded: renderWiki() is also called from the editor after a
    // save, and from loadRemoteWiki()'s async callback, either of which can
    // land after the user has navigated away and the sidebar is gone. The
    // unguarded version threw there, which aborted the whole render.
    const setCount = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setCount('wiki-total-count', total);
    setCount('wiki-local-count', local);
    setCount('wiki-remote-count', remote);
    setCount('wiki-hidden-count', hidden.length);
}

function getFilteredEntries() {
    const state = getState();
    const search = document.getElementById('wiki-search')?.value?.toLowerCase() || '';
    const cat = document.getElementById('wiki-cat-filter')?.value || '';
    let entries = state.wikiEntries || [];

    if (search) {
        entries = entries.filter(e =>
            (e.title || '').toLowerCase().includes(search) ||
            (e.subtitle || '').toLowerCase().includes(search) ||
            (e.body || '').toLowerCase().includes(search) ||
            (e.region || '').toLowerCase().includes(search) ||
            (e.tags || []).some(t => t.toLowerCase().includes(search))
        );
    }
    if (cat) {
        entries = entries.filter(e => e.category === cat);
    }
    const region = document.getElementById('wiki-region-filter')?.value || '';
    if (region) {
        entries = entries.filter(e => e.region === region);
    }

    // Sort: local first, then remote, then by title
    entries.sort((a, b) => {
        if (a.source === 'remote' && b.source !== 'remote') return 1;
        if (a.source !== 'remote' && b.source === 'remote') return -1;
        // Entries whose text has not been written yet sink below the ones
        // that have something to read.
        const aStub = !!a.stub || !(a.body || '').trim();
        const bStub = !!b.stub || !(b.body || '').trim();
        if (aStub !== bStub) return aStub ? 1 : -1;
        return (a.title || '').localeCompare(b.title || '');
    });

    return entries;
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
        showToast(i18nText("feature.wiki.bundledEntryNotFound", null, "Bundled entry not found."), 'error');
        return;
    }

    if (isEntryCloned(remote)) {
        showToast(i18nText("feature.wiki.valueAlreadyCloned", { value0: remote.title }, "\"{{value0}}\" already cloned."), 'warning');
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
    showToast(i18nText("feature.wiki.clonedValueFromBundledWiki", { value0: remote.title }, "📋 Cloned \"{{value0}}\" from bundled wiki."), 'success');

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
    showToast(i18nText("feature.wiki.hiddenValueFromView", { value0: entry.title }, "🚫 Hidden \"{{value0}}\" from view."), 'info');
}

function deleteWikiHandler(id) {
    const state = getState();
    const entries = state.wikiEntries || [];
    const entry = entries.find(e => String(e.id) === String(id));
    if (!entry) return;

    if (entry.source === 'remote') {
        if (!confirm(i18nText("feature.wiki.hideBundledEntryValue", { value0: entry.title }, "Hide bundled entry \"{{value0}}\"?"))) return;
        hideRemoteEntry(id);
    } else {
        if (!confirm(i18nText("feature.wiki.deleteWikiEntryValue", { value0: entry.title }, "Delete wiki entry \"{{value0}}\"?"))) return;
        state.wikiEntries = entries.filter(e => String(e.id) !== String(id));
        saveState();
        renderWiki();
        showToast(i18nText("feature.wiki.deletedValue", { value0: entry.title }, "🗑️ Deleted \"{{value0}}\"."), 'success');
    }
}

function importAllFromWiki() {
    const state = getState();
    const entries = state.wikiEntries || [];
    const remoteEntries = entries.filter(e => e.source === 'remote');

    if (remoteEntries.length === 0) {
        showToast(i18nText("feature.wiki.noBundledEntriesToImport", null, "No bundled entries to import."), 'warning');
        return;
    }

    const toImport = remoteEntries.filter(remote => !isEntryCloned(remote));

    if (toImport.length === 0) {
        showToast(i18nText("feature.wiki.allBundledEntriesAlreadyCloned", null, "All bundled entries already cloned."), 'info');
        return;
    }

    if (!confirm(i18nText("feature.wiki.importAllValueBundledEntries", { value0: toImport.length }, "Import all {{value0}} bundled entries?"))) return;

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
    showToast(i18nText("feature.wiki.importedValueBundledEntries", { value0: imported }, "📥 Imported {{value0}} bundled entries."), 'success');
}

// ─── Toggle Body ──────────────────────────────────────────────────────

export function toggleWikiBody(id) {
    const card = Array.from(document.querySelectorAll('.wiki-entry-card')).find(el => el.dataset.id === String(id));
    if (!card) return;
    const body = card.querySelector('.wiki-entry-body');
    const expandBtn = card.querySelector('.wiki-expand-btn');
    if (!body) return;
    const clamped = body.classList.toggle('is-clamped');
    if (expandBtn) expandBtn.textContent = clamped ? 'Read more' : 'Show less';
}
window.toggleWikiBody = toggleWikiBody;

// ─── Editor Integration ──────────────────────────────────────────────

export function openWikiEditor(id) {
    import('./editor.js')
        .then(module => {
            if (module.openEditor) {
                module.openEditor(id);
            } else {
                showToast(i18nText("feature.wiki.editorModuleNotAvailable", null, "Editor module not available."), 'error');
            }
        })
        .catch(err => {
            console.error('Failed to load editor:', err);
            showToast(i18nText("feature.wiki.failedToLoadEditorPleaseCheckConsole", null, "Failed to load editor. Please check console."), 'error');
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
    const region = document.getElementById('wiki-region-filter');
    const filterBar = document.getElementById('wiki-active-filters');
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
    if (region) {
        addEventListenerSafe(region, 'change', renderWiki);
    }
    if (filterBar) {
        addEventListenerSafe(filterBar, 'click', (ev) => {
            const chip = ev.target.closest('[data-action="clear-filter"]');
            if (!chip) return;
            const byKind = { search: 'wiki-search', cat: 'wiki-cat-filter', region: 'wiki-region-filter' };
            const el = document.getElementById(byKind[chip.dataset.kind]);
            if (el) { el.value = ''; renderWiki(); }
        });
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