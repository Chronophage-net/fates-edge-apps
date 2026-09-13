/**
 * Background search index.
 *
 * Before this module the search index was built lazily, only when someone
 * opened the Search tab, and it was thrown away with the tab session --
 * `sessionStorage` survives a reload but not a new tab, so most visits paid
 * the full build cost again. It also never indexed the documents: the old
 * dynamic builder read `manifest-core.json` and indexed each document's
 * *title and one-line description*, so searching for a phrase that appears
 * in the SRD, an expansion or an anthology found nothing at all.
 *
 * This builds the real thing, in the background:
 *
 *   - Every document in `/data/docs/manifest.json` (and every page of the
 *     multi-page books inside it) is fetched, reduced to text, and indexed
 *     with its headings, so a search can actually reach into the corpus.
 *   - The result is persisted in IndexedDB, so a returning visitor gets a
 *     warm index on first paint instead of rebuilding.
 *   - Building happens on idle callbacks with a small concurrency limit, so
 *     it never competes with the app's own boot work, and it re-checks
 *     periodically so a rebuilt data directory is picked up without a
 *     hard refresh.
 *
 * Nothing here touches the DOM. The Search feature subscribes to progress
 * events (`onIndexProgress`) and renders whatever state it finds.
 */

import { getBaseUrl, buildDocumentUrl } from './utils.js';

const DB_NAME = 'fates-edge-search';
const DB_VERSION = 1;
const STORE_NAME = 'index';
const RECORD_KEY = 'documents';

// Bump when the shape of an index entry changes, so stale records built by
// an older build are discarded rather than served.
const INDEX_SCHEMA_VERSION = 3;

// How long a persisted index is trusted before a background refresh is
// scheduled. Six hours is long enough that a normal session never rebuilds
// and short enough that an author editing /data/docs sees their changes the
// next time they leave the tab open over lunch.
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

// How often the periodic check runs while the app is open. The check is
// cheap -- it compares a manifest fingerprint and a timestamp -- and only
// triggers a rebuild when something actually changed or the index aged out.
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

// Parallel fetches. The documents are same-origin static files, so this is
// about not saturating the connection during boot rather than politeness.
const FETCH_CONCURRENCY = 4;

// Per-document text kept for matching. Whole documents would make the
// persisted index tens of megabytes for a corpus this size; this keeps the
// opening of each document, which is where titles, summaries and the terms
// people actually search for live.
const MAX_CONTENT_CHARS = 2400;

let entries = [];
let builtAt = 0;
let fingerprint = '';
let building = false;
let buildAbort = null;
let refreshTimer = null;
let started = false;

const listeners = new Set();

// ------------------------------------------------------------------
// Progress events
// ------------------------------------------------------------------

/**
 * Subscribe to indexer progress. Fires with
 * `{ phase, done, total, count, error }` where phase is one of
 * 'idle' | 'loading' | 'building' | 'ready' | 'error'.
 * Returns an unsubscribe function.
 */
export function onIndexProgress(callback) {
    if (typeof callback !== 'function') return () => {};
    listeners.add(callback);
    // Hand the subscriber the current state immediately, so a feature that
    // mounts after the index is already warm doesn't sit on a blank status
    // line waiting for an event that has already been and gone.
    try { callback(getIndexStatus()); } catch (e) { /* a bad subscriber is not our problem */ }
    return () => listeners.delete(callback);
}

function emit(extra = {}) {
    const payload = { ...getIndexStatus(), ...extra };
    for (const fn of listeners) {
        try { fn(payload); } catch (e) { console.warn('[SearchIndex] listener threw:', e); }
    }
}

export function getIndexStatus() {
    return {
        phase: building ? 'building' : entries.length ? 'ready' : 'idle',
        count: entries.length,
        builtAt,
        isStale: isStale(),
        building,
    };
}

// ------------------------------------------------------------------
// IndexedDB persistence
// ------------------------------------------------------------------

function openDatabase() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function readPersisted() {
    try {
        const db = await openDatabase();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return null;
    }
}

async function writePersisted(record) {
    try {
        const db = await openDatabase();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({ key: RECORD_KEY, ...record });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        // A private window, a storage-blocked browser, or a quota refusal.
        // The in-memory index still works for this session; the only cost
        // is rebuilding next time.
        console.warn('[SearchIndex] could not persist index:', e && e.message);
    }
}

export async function clearPersistedIndex() {
    try {
        const db = await openDatabase();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(RECORD_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { /* nothing to clear */ }
}

// ------------------------------------------------------------------
// Fetch helpers
// ------------------------------------------------------------------

async function fetchJSON(url, signal) {
    try {
        const res = await fetch(url, { cache: 'no-cache', signal });
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
}

async function fetchText(url, signal) {
    try {
        const res = await fetch(url, { cache: 'no-cache', signal });
        if (!res.ok) return null;
        return await res.text();
    } catch { return null; }
}

/**
 * Run `task` over `items` with at most `limit` in flight.
 * Results keep input order; a task that throws yields null.
 */
async function mapLimit(items, limit, task) {
    const results = new Array(items.length);
    let cursor = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
        while (cursor < items.length) {
            const i = cursor++;
            try { results[i] = await task(items[i], i); }
            catch { results[i] = null; }
        }
    });
    await Promise.all(workers);
    return results;
}

/**
 * Wait for an idle moment (or a short timeout) before continuing, so the
 * indexer yields to anything the app is doing on the main thread.
 */
function idle(timeout = 500) {
    return new Promise((resolve) => {
        if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout });
        else setTimeout(resolve, 0);
    });
}

// ------------------------------------------------------------------
// HTML -> searchable text
// ------------------------------------------------------------------

/**
 * Reduce a document to the text worth matching against.
 *
 * Uses DOMParser rather than a regex strip so that script and style bodies,
 * which are pure noise and often the largest thing in these files, never
 * reach the index. Navigation and reader chrome are dropped for the same
 * reason: every document carries the same "Where to start / Core mechanic"
 * aside, and indexing it makes every document match those words equally.
 */
export function extractText(html) {
    if (!html) return { text: '', headings: [] };
    let doc;
    try {
        doc = new DOMParser().parseFromString(html, 'text/html');
    } catch {
        return { text: '', headings: [] };
    }
    doc.querySelectorAll('script, style, noscript, nav, .fe-reader-note, .fe-reader-contents, .fe-collection-contents, footer')
        .forEach(el => el.remove());

    const headings = Array.from(doc.querySelectorAll('h1, h2, h3'))
        .map(h => (h.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 40);

    const body = doc.body || doc.documentElement;
    const text = (body ? body.textContent || '' : '').replace(/\s+/g, ' ').trim();
    return { text, headings };
}

export function firstSentences(text, max = 260) {
    if (!text) return '';
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd()) + '…';
}

// ------------------------------------------------------------------
// Index building
// ------------------------------------------------------------------

/**
 * Flatten the docs manifest into one indexable unit per readable page.
 * A book with a `pages` array becomes one entry per page, so a hit inside
 * "combat.html" links to that page rather than the book's cover.
 */
export function expandManifest(manifest) {
    const docs = manifest?.documents || manifest;
    if (!Array.isArray(docs)) return [];
    const units = [];
    for (const doc of docs) {
        if (doc.active === false) continue;
        const dir = (doc.path || '/data/docs/').replace(/^\.\//, '/');
        const base = dir.endsWith('/') ? dir : dir.replace(/[^/]+$/, '');
        const label = doc.categoryLabel || doc.category || 'Documents';
        if (Array.isArray(doc.pages) && doc.pages.length) {
            for (const page of doc.pages) {
                if (!page || !page.file) continue;
                units.push({
                    url: `${base}${page.file}`,
                    title: page.title || page.label || doc.title,
                    book: doc.title,
                    category: label,
                    type: doc.category === 'anthology' ? 'anthology' : 'document',
                });
            }
        } else {
            const file = doc.file || '';
            if (!file && !dir.endsWith('.html')) continue;
            units.push({
                url: dir.endsWith('.html') ? dir : `${base}${file}`,
                title: doc.title || file.replace(/\.html$/, ''),
                book: null,
                category: label,
                type: doc.category === 'anthology' ? 'anthology' : 'document',
            });
        }
    }
    return units;
}

async function indexDocuments(signal, report) {
    const baseUrl = getBaseUrl();
    const manifest = await fetchJSON(`${baseUrl}data/docs/manifest.json`, signal)
        || await fetchJSON('./data/docs/manifest.json', signal);
    const units = expandManifest(manifest);
    if (!units.length) return [];

    let done = 0;
    const built = await mapLimit(units, FETCH_CONCURRENCY, async (unit) => {
        if (signal?.aborted) return null;
        // Yield between documents so a 200-file crawl never blocks a frame.
        await idle();
        const html = await fetchText(unit.url, signal);
        done++;
        report(done, units.length);
        if (!html) return null;
        const { text, headings } = extractText(html);
        if (!text) return null;
        return {
            title: unit.book && unit.title !== unit.book ? `${unit.book} — ${unit.title}` : unit.title,
            content: `${headings.join(' · ')} ${text}`.slice(0, MAX_CONTENT_CHARS),
            preview: firstSentences(text),
            url: unit.url,
            type: unit.type,
            category: unit.category,
        };
    });
    return built.filter(Boolean);
}

async function indexStructuredData(signal) {
    const out = [];
    const asArray = (payload) => Array.isArray(payload) ? payload : (payload?.data ?? []);

    // Wiki
    for (const item of asArray(await fetchJSON('./data/wiki.json', signal))) {
        const body = item.body || item.content || item.description || '';
        out.push({
            title: item.title || item.name || 'Wiki Entry',
            content: `${body} ${(item.tags || []).join(' ')}`.slice(0, MAX_CONTENT_CHARS),
            preview: firstSentences(body),
            url: '#/wiki',
            type: 'wiki',
            category: item.category || 'Wiki',
        });
    }

    // Factions and patrons, from their manifests.
    for (const [dir, type, label] of [['factions', 'faction', 'Factions'], ['patrons', 'patron', 'Patrons']]) {
        const manifest = asArray(await fetchJSON(`./data/${dir}/manifest.json`, signal));
        const ids = manifest.map(m => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
        const loaded = await mapLimit(ids, FETCH_CONCURRENCY, async (id) => {
            const data = await fetchJSON(`./data/${dir}/${id}.json`, signal);
            if (!data) return { title: id, content: '', preview: '', url: `#/${dir}/${id}`, type, category: label };
            let desc = data.lore?.description || data.description || data.agenda || data.subtitle || '';
            if (typeof desc !== 'string') desc = JSON.stringify(desc);
            return {
                title: data.name || data.title || id,
                content: desc.slice(0, MAX_CONTENT_CHARS),
                preview: firstSentences(desc),
                url: `#/${dir}/${id}`,
                type,
                category: label,
            };
        });
        out.push(...loaded.filter(Boolean));
    }

    // Regions, from the canonical manifest rather than a hardcoded list --
    // the old builder carried fourteen region ids inline and silently
    // missed every region added since.
    const regionIds = asArray(await fetchJSON('./data/regions/manifest.json', signal))
        .map(r => (typeof r === 'string' ? r : r.id || r.name)).filter(Boolean);
    const regions = await mapLimit(regionIds, FETCH_CONCURRENCY, async (id) => {
        const data = await fetchJSON(`./data/regions/${id}.json`, signal);
        if (!data) return null;
        const o = data.overview || {};
        const desc = [o.tagline, o.genre, o.mood].filter(Boolean).join(' ');
        return {
            title: data.title || data.name || id,
            content: desc.slice(0, MAX_CONTENT_CHARS),
            preview: firstSentences(desc),
            url: `#/regions/${id}`,
            type: 'region',
            category: 'Regions',
        };
    });
    out.push(...regions.filter(Boolean));

    return out;
}

function dedupe(list) {
    const seen = new Set();
    return list.filter(e => {
        const key = `${(e.title || '').toLowerCase()}|${e.type}|${e.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * A cheap change-detector for the corpus: the docs manifest's own shape.
 * If a document is added, removed, retitled or re-pathed, this changes and
 * the periodic check rebuilds. It deliberately does not hash document
 * bodies -- that would mean fetching everything to decide whether to fetch
 * everything.
 */
async function computeFingerprint(signal) {
    const baseUrl = getBaseUrl();
    const manifest = await fetchJSON(`${baseUrl}data/docs/manifest.json`, signal)
        || await fetchJSON('./data/docs/manifest.json', signal);
    const units = expandManifest(manifest);
    return `${INDEX_SCHEMA_VERSION}:${units.length}:${units.map(u => u.url).join('|').length}`;
}

/**
 * Build the index. Safe to call repeatedly -- a build already in flight is
 * returned rather than duplicated.
 */
export async function buildIndex({ force = false } = {}) {
    if (building) return entries;
    if (!force && entries.length && !isStale()) return entries;

    building = true;
    buildAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const signal = buildAbort?.signal;
    emit({ phase: 'building', done: 0, total: 0 });

    try {
        const report = (done, total) => emit({ phase: 'building', done, total });
        const [docs, structured] = await Promise.all([
            indexDocuments(signal, report),
            indexStructuredData(signal),
        ]);
        if (signal?.aborted) return entries;

        const next = dedupe([...docs, ...structured]);
        if (next.length) {
            entries = next;
            builtAt = Date.now();
            fingerprint = await computeFingerprint(signal);
            await writePersisted({ entries, builtAt, fingerprint, schema: INDEX_SCHEMA_VERSION });
        }
        console.log(`[SearchIndex] indexed ${entries.length} entries (${docs.length} document pages)`);
        emit({ phase: 'ready' });
        return entries;
    } catch (e) {
        console.warn('[SearchIndex] build failed:', e);
        emit({ phase: 'error', error: e && e.message });
        return entries;
    } finally {
        building = false;
        buildAbort = null;
    }
}

function isStale() {
    return !builtAt || (Date.now() - builtAt) > MAX_AGE_MS;
}

/**
 * Load whatever was persisted, without building. Returns the entries.
 */
export async function loadIndex() {
    if (entries.length) return entries;
    emit({ phase: 'loading' });
    const record = await readPersisted();
    if (record && Array.isArray(record.entries) && record.schema === INDEX_SCHEMA_VERSION) {
        entries = record.entries;
        builtAt = record.builtAt || 0;
        fingerprint = record.fingerprint || '';
        emit({ phase: 'ready' });
    } else {
        emit({ phase: 'idle' });
    }
    return entries;
}

export function getEntries() { return entries; }

/**
 * Start background indexing: warm from storage immediately, build on idle
 * if there is nothing usable or what we have has aged out, then re-check on
 * an interval and whenever the tab comes back to the foreground.
 *
 * Idempotent -- calling it twice does not start two schedulers.
 */
export function startBackgroundIndexing({ immediate = false } = {}) {
    if (started) return;
    started = true;

    const kick = async () => {
        await loadIndex();
        // A warm index is served immediately; the refresh, if one is needed,
        // happens underneath it rather than blocking the first search.
        const changed = await hasCorpusChanged();
        if (!entries.length || isStale() || changed) await buildIndex({ force: changed });
    };

    if (immediate) {
        kick();
    } else if (typeof requestIdleCallback === 'function') {
        // The timeout is the point: on a busy boot there may be no idle
        // period for a while, and the index should not wait indefinitely.
        requestIdleCallback(() => kick(), { timeout: 4000 });
    } else {
        setTimeout(kick, 1500);
    }

    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
        if (document.hidden || building) return;
        if (isStale() || await hasCorpusChanged()) await buildIndex({ force: true });
    }, REFRESH_INTERVAL_MS);

    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !building && isStale()) buildIndex({ force: true });
        });
    }
}

async function hasCorpusChanged() {
    if (!fingerprint) return false;
    try {
        const current = await computeFingerprint();
        return !!current && current !== fingerprint;
    } catch { return false; }
}

/**
 * Drop everything and rebuild from scratch. This is what the Search tab's
 * rebuild control calls.
 */
export async function rebuildIndex() {
    if (buildAbort) buildAbort.abort();
    entries = [];
    builtAt = 0;
    fingerprint = '';
    building = false;
    await clearPersistedIndex();
    return buildIndex({ force: true });
}

export function stopBackgroundIndexing() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
    if (buildAbort) buildAbort.abort();
    started = false;
}

export default {
    startBackgroundIndexing,
    stopBackgroundIndexing,
    buildIndex,
    rebuildIndex,
    loadIndex,
    getEntries,
    getIndexStatus,
    onIndexProgress,
    clearPersistedIndex,
};
