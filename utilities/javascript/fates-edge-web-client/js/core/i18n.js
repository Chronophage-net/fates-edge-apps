// core/i18n.js
/**
 * Internationalisation (i18n) runtime.
 *
 * WHY THIS EXISTS
 *   Every user-visible string in the toolkit used to be written inline, in
 *   English, at the point it was rendered — in index.html's shell and in
 *   ~120 feature modules. That is fine until somebody wants the interface in
 *   another language, at which point there is no seam to translate at. This
 *   module is that seam. It is deliberately tiny (no dependencies, no build
 *   step, ~1 kB of catalogue lookup) because the app is plain ESM served by
 *   Vite, and adding an i18n framework would have been a much larger change
 *   to review than the problem warrants.
 *
 * THE ONE RULE: IT CAN NEVER MAKE THE UI WORSE
 *   Translation is being introduced into a working application, so every
 *   path here degrades to "show the English that was already there":
 *
 *     - The English catalogue is imported STATICALLY, so `t()` is
 *       synchronous and correct from the very first call — there is no
 *       window during boot where keys render as raw dotted paths.
 *     - A missing key in the active locale falls back to the base language
 *       ('pt-BR' -> 'pt'), then to English, then to an explicit fallback
 *       argument, and only then to the key itself.
 *     - `applyTranslations()` leaves an element completely untouched when
 *       its key resolves to nothing, so annotating markup with `data-i18n`
 *       can never blank out text that has no translation yet.
 *     - Nothing here throws. A malformed catalogue, an absent
 *       `document.documentElement` (the headless test shim), a locale file
 *       that fails to load — each is caught, warned about once, and the app
 *       carries on in English.
 *
 * HOW A LOCALE IS CHOSEN
 *   Stored preference ('fates-edge-locale') -> the browser's
 *   navigator.languages, matched against what we ship (exact match first,
 *   then base language) -> 'en'. Storing the string 'auto' means "keep
 *   following the browser", mirroring how core/theme-manager.js treats
 *   'auto' as a meta-preference rather than a registered theme.
 *
 * EXTENSIBILITY
 *   `registerLocale()` is public and mirrors theme-manager's
 *   `registerTheme()`, so a module pack can ship a translation the same way
 *   it can ship a theme, without this file knowing about it.
 */

import { getStorage, setStorage, removeStorage } from './utils.js';
import enCatalog from '../../locales/en.json' with { type: 'json' };
import { LOCALES, LOADERS } from '../../locales/index.js';

const STORAGE_KEY = 'fates-edge-locale';
const FALLBACK_LOCALE = 'en';

/** code -> flat { 'nav.home.label': 'Home' } catalogue. */
const catalogs = new Map();

/** code -> descriptor, seeded from locales/index.js and extendable at runtime. */
const registry = new Map();

let currentPreference = null; // 'auto', or a locale code
let currentLocale = FALLBACK_LOCALE; // the code actually in effect
const warnedKeys = new Set();

// ============================================================
// CATALOGUE SHAPE
// ============================================================

/**
 * Catalogues are authored as nested JSON (readable for translators) and
 * used as flat dotted keys (cheap to look up, and stable when a nested
 * object later gains siblings). Flattening happens once, at registration.
 *
 * Keys beginning with '$' are metadata ($meta) and are skipped.
 */
function flatten(obj, prefix = '', out = {}) {
    if (!obj || typeof obj !== 'object') return out;
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue;
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            flatten(value, path, out);
        } else if (typeof value === 'string') {
            out[path] = value;
        } else if (Array.isArray(value)) {
            out[path] = value.map(v => String(v)).join('\n');
        }
    }
    return out;
}

// ============================================================
// REGISTRY
// ============================================================

/**
 * @param {object} descriptor
 * @param {string} descriptor.code       BCP-47 code, e.g. 'fr' or 'pt-BR'
 * @param {string} descriptor.name       English name, e.g. 'French'
 * @param {string} descriptor.nativeName Name in the language itself
 * @param {'ltr'|'rtl'} [descriptor.dir='ltr']
 * @param {object} [catalog]             nested catalogue; may be supplied later
 */
export function registerLocale(descriptor, catalog) {
    if (!descriptor || !descriptor.code) {
        console.warn('[i18n] registerLocale() needs at least { code }:', descriptor);
        return;
    }
    const entry = {
        dir: 'ltr',
        name: descriptor.code,
        nativeName: descriptor.name || descriptor.code,
        ...descriptor,
    };
    registry.set(entry.code, entry);
    if (catalog) {
        try {
            catalogs.set(entry.code, flatten(catalog));
        } catch (e) {
            console.warn(`[i18n] Could not read the catalogue for "${entry.code}" — it will fall back to English.`, e);
        }
    }
    // A locale registered after it was already selected (a pack finishing
    // install, say) should take effect immediately rather than waiting for
    // the next manual switch — same reasoning as theme-manager's
    // registerTheme().
    if (currentLocale === entry.code) applyLocaleToDocument();
}

/** Every locale we can offer, English first, then alphabetical by name. */
export function getLocales() {
    return Array.from(registry.values())
        .slice()
        .sort((a, b) => (a.code === FALLBACK_LOCALE ? -1 : b.code === FALLBACK_LOCALE ? 1 : a.name.localeCompare(b.name)))
        .map(({ code, name, nativeName, dir }) => ({ code, name, nativeName, dir }));
}

export function getLocaleDescriptor(code) {
    return registry.get(code) || null;
}

/** The code actually in effect right now ('auto' already resolved). */
export function getLocale() {
    return currentLocale;
}

/** The raw stored choice — a locale code, or 'auto'. */
export function getLocalePreference() {
    return currentPreference;
}

export function isRTL(code = currentLocale) {
    return (registry.get(code)?.dir || 'ltr') === 'rtl';
}

/**
 * Share of the English catalogue that `code` actually translates, 0-1.
 * Used by Settings to be honest about partial translations instead of
 * presenting every language as if it were finished.
 */
export function getCoverage(code = currentLocale) {
    const source = catalogs.get(FALLBACK_LOCALE) || {};
    const total = Object.keys(source).length;
    if (!total) return 1;
    if (code === FALLBACK_LOCALE) return 1;
    const target = catalogs.get(code) || {};
    let done = 0;
    for (const key of Object.keys(source)) {
        const value = target[key];
        if (typeof value === 'string' && value.length) done++;
    }
    return done / total;
}

// ============================================================
// LOOKUP
// ============================================================

/** 'pt-BR' -> ['pt-BR', 'pt', 'en'] — the order a key is searched in. */
function chainFor(code) {
    const chain = [];
    if (code) {
        chain.push(code);
        const base = String(code).split('-')[0];
        if (base && base !== code) chain.push(base);
    }
    if (!chain.includes(FALLBACK_LOCALE)) chain.push(FALLBACK_LOCALE);
    return chain;
}

/** Raw lookup with no interpolation. Returns null when nothing matches. */
export function lookup(key, code = currentLocale) {
    if (!key) return null;
    for (const candidate of chainFor(code)) {
        const value = catalogs.get(candidate)?.[key];
        if (typeof value === 'string' && value.length) return value;
    }
    return null;
}

/** Does any catalogue in the chain know this key? */
export function hasKey(key, code = currentLocale) {
    return lookup(key, code) !== null;
}

/**
 * `{{name}}` placeholders, substituted from `params`. A placeholder with no
 * matching param is left exactly as written — a visible, greppable mistake
 * is better than a silently empty sentence.
 */
function interpolate(template, params) {
    if (!params || typeof template !== 'string' || template.indexOf('{{') === -1) return template;
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name) => (
        Object.prototype.hasOwnProperty.call(params, name) && params[name] != null
            ? String(params[name])
            : whole
    ));
}

/**
 * Translate `key`.
 *
 * @param {string} key
 * @param {object} [params]            values for {{placeholders}}
 * @param {string} [fallback]          English text to show if no catalogue
 *                                     has the key. Pass the literal string
 *                                     that used to be hardcoded at the call
 *                                     site and a missing key is invisible to
 *                                     the user.
 * @returns {string}
 */
export function t(key, params, fallback) {
    try {
        if (!key) return typeof fallback === 'string' ? interpolate(fallback, params) : '';
        const found = lookup(key);
        if (found !== null) return interpolate(found, params);
        if (typeof fallback === 'string') return interpolate(fallback, params);
        if (!warnedKeys.has(key)) {
            warnedKeys.add(key);
            console.warn(`[i18n] No string for "${key}" in "${currentLocale}" or English — showing the key.`);
        }
        return key;
    } catch (e) {
        return typeof fallback === 'string' ? fallback : String(key);
    }
}

/**
 * Plural-aware translation. Looks for `<key>.<category>` where category is
 * whatever Intl.PluralRules says for this locale ('one', 'other', 'few',
 * 'many', ...), falling back to `<key>.other`, then `<key>`.
 *
 *   tn('plurals.characterCount', 3) -> "3 characters"
 *
 * Using Intl rather than an `n === 1` check matters: Polish, Russian and
 * Arabic all need categories English does not have.
 */
export function tn(key, count, params, fallback) {
    let category = count === 1 ? 'one' : 'other';
    try {
        category = new Intl.PluralRules(currentLocale).select(count);
    } catch { /* Intl missing or bad locale tag — the English guess stands */ }

    const merged = { count, ...(params || {}) };
    const candidates = [`${key}.${category}`, `${key}.other`, key];
    for (const candidate of candidates) {
        const found = lookup(candidate);
        if (found !== null) return interpolate(found, merged);
    }
    return t(key, merged, fallback);
}

// ============================================================
// Intl FORMATTING HELPERS
// ============================================================
// Numbers, dates and lists are as locale-specific as words are, and every
// one of these degrades to the English/ISO-ish default rather than throwing
// on an environment without full ICU data.

export function formatNumber(value, options) {
    try { return new Intl.NumberFormat(currentLocale, options).format(value); }
    catch { return String(value); }
}

export function formatDate(value, options = { dateStyle: 'medium' }) {
    try { return new Intl.DateTimeFormat(currentLocale, options).format(new Date(value)); }
    catch { return String(value); }
}

export function formatList(values, options = { style: 'long', type: 'conjunction' }) {
    const arr = Array.from(values || []).map(String);
    try { return new Intl.ListFormat(currentLocale, options).format(arr); }
    catch { return arr.join(', '); }
}

export function formatRelativeTime(value, unit, options = { numeric: 'auto' }) {
    try { return new Intl.RelativeTimeFormat(currentLocale, options).format(value, unit); }
    catch { return `${value} ${unit}`; }
}

// ============================================================
// DOM APPLICATION
// ============================================================

/**
 * Translates a DOM subtree that was authored with English text inline.
 *
 *   <span class="nav-label" data-i18n="nav.home.label">Home</span>
 *   <button data-i18n-attr="title:nav.home.title;aria-label:nav.home.title">
 *   <p data-i18n-html="settings.language.intro">…markup allowed…</p>
 *
 * The English in the markup is the fallback, and stays authoritative: the
 * first pass records it in `data-i18n-src`, so switching from French back to
 * English restores the exact original rather than needing a catalogue round
 * trip. An element whose key resolves to nothing is skipped entirely.
 *
 * @param {ParentNode} [root=document]
 * @returns {number} how many elements were touched (handy in tests)
 */
export function applyTranslations(root) {
    const scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope || typeof scope.querySelectorAll !== 'function') return 0;

    let touched = 0;

    const each = (selector, fn) => {
        let nodes = [];
        try { nodes = Array.from(scope.querySelectorAll(selector) || []); } catch { return; }
        for (const el of nodes) {
            try { if (fn(el)) touched++; } catch { /* one bad node must not stop the pass */ }
        }
    };

    each('[data-i18n]', (el) => {
        const key = el.getAttribute('data-i18n');
        if (el.getAttribute('data-i18n-src') === null) el.setAttribute('data-i18n-src', el.textContent ?? '');
        const src = el.getAttribute('data-i18n-src');
        const value = lookup(key);
        const next = value !== null ? value : src;
        if (next == null || el.textContent === next) return false;
        el.textContent = next;
        return true;
    });

    each('[data-i18n-html]', (el) => {
        const key = el.getAttribute('data-i18n-html');
        if (el.getAttribute('data-i18n-html-src') === null) el.setAttribute('data-i18n-html-src', el.innerHTML ?? '');
        const src = el.getAttribute('data-i18n-html-src');
        const value = lookup(key);
        const next = value !== null ? value : src;
        if (next == null || el.innerHTML === next) return false;
        el.innerHTML = next;
        return true;
    });

    // "title:nav.home.title;aria-label:nav.home.title;placeholder:gate.placeholder"
    each('[data-i18n-attr]', (el) => {
        const spec = el.getAttribute('data-i18n-attr') || '';
        let changed = false;
        for (const pair of spec.split(';')) {
            const idx = pair.indexOf(':');
            if (idx < 1) continue;
            const attr = pair.slice(0, idx).trim();
            const key = pair.slice(idx + 1).trim();
            if (!attr || !key) continue;
            const srcAttr = `data-i18n-src-${attr}`;
            if (el.getAttribute(srcAttr) === null) el.setAttribute(srcAttr, el.getAttribute(attr) ?? '');
            const src = el.getAttribute(srcAttr);
            const value = lookup(key);
            const next = value !== null ? value : src;
            if (next == null || el.getAttribute(attr) === next) continue;
            el.setAttribute(attr, next);
            changed = true;
        }
        return changed;
    });

    return touched;
}

function applyLocaleToDocument() {
    try {
        const root = typeof document !== 'undefined' ? document.documentElement : null;
        if (root) {
            root.setAttribute('lang', currentLocale);
            root.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
        }
    } catch { /* headless test shim has no documentElement */ }
    applyTranslations();
}

// ============================================================
// DETECTION, LOADING, SWITCHING
// ============================================================

/** Best shipped locale for what the browser asks for, or null. */
export function detectBrowserLocale() {
    let wanted = [];
    try {
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        wanted = nav ? (nav.languages && nav.languages.length ? Array.from(nav.languages) : [nav.language]).filter(Boolean) : [];
    } catch { wanted = []; }

    for (const tag of wanted) {
        if (registry.has(tag)) return tag;
    }
    for (const tag of wanted) {
        const base = String(tag).split('-')[0];
        if (registry.has(base)) return base;
        const sibling = Array.from(registry.keys()).find(code => code.split('-')[0] === base);
        if (sibling) return sibling;
    }
    return null;
}

function resolvePreference(pref) {
    if (pref && pref !== 'auto' && registry.has(pref)) return pref;
    return detectBrowserLocale() || FALLBACK_LOCALE;
}

/**
 * Fetches a locale's catalogue if it isn't loaded yet. Resolves to true when
 * the catalogue is available afterwards; false means the app should (and
 * will) stay on English.
 */
export async function loadLocale(code) {
    if (!code || code === FALLBACK_LOCALE) return true;
    if (catalogs.has(code)) return true;
    const loader = LOADERS[code];
    if (!loader) return false;
    try {
        const mod = await loader();
        const catalog = mod?.default ?? mod;
        catalogs.set(code, flatten(catalog));
        return true;
    } catch (e) {
        console.warn(`[i18n] Could not load the "${code}" catalogue — staying in English.`, e);
        return false;
    }
}

/**
 * @param {string} codeOrAuto  a registered locale code, or 'auto'
 * @param {object} [opts]
 * @param {boolean} [opts.persist=true]
 */
export async function setLocale(codeOrAuto, { persist = true } = {}) {
    const isAuto = codeOrAuto === 'auto';
    if (!isAuto && !registry.has(codeOrAuto)) {
        console.warn(`[i18n] Unknown locale "${codeOrAuto}" — staying on "${currentLocale}".`);
        return currentLocale;
    }

    const resolved = resolvePreference(isAuto ? 'auto' : codeOrAuto);
    const loaded = await loadLocale(resolved);

    currentPreference = isAuto ? 'auto' : codeOrAuto;
    currentLocale = loaded ? resolved : FALLBACK_LOCALE;

    if (persist) {
        // 'auto' is stored as no key at all — the absence of a preference IS
        // "keep following the browser", the same way theme-manager treats
        // its own 'auto'. Removing the key (rather than writing a literal
        // null) keeps `getStorage(...) || 'auto'` in initI18n() honest and
        // leaves no stale value behind for a future reader to misread.
        if (isAuto) removeStorage(STORAGE_KEY);
        else setStorage(STORAGE_KEY, currentPreference);
    }

    applyLocaleToDocument();

    try {
        document.dispatchEvent(new CustomEvent('locale-changed', {
            detail: { preference: currentPreference, locale: currentLocale, dir: isRTL() ? 'rtl' : 'ltr' }
        }));
    } catch { /* no document in some test paths */ }

    return currentLocale;
}

/** Convenience subscription; returns an unsubscribe function. */
export function onLocaleChange(callback) {
    if (typeof callback !== 'function') return () => {};
    const handler = (e) => callback(e?.detail || { locale: currentLocale });
    try { document.addEventListener('locale-changed', handler); } catch { return () => {}; }
    return () => { try { document.removeEventListener('locale-changed', handler); } catch {} };
}

/**
 * Registers every shipped locale, then applies the user's choice.
 * Safe to call more than once. Always resolves — never rejects — so a
 * failure here can't stop app boot.
 */
export async function initI18n() {
    try {
        // English is registered with its catalogue already in hand, so `t()`
        // works synchronously from this point on even if everything below
        // fails.
        registerLocale(LOCALES.find(l => l.code === FALLBACK_LOCALE) || { code: 'en', name: 'English', nativeName: 'English' }, enCatalog);
        for (const descriptor of LOCALES) {
            if (descriptor.code !== FALLBACK_LOCALE) registerLocale(descriptor);
        }

        const stored = getStorage(STORAGE_KEY, null);
        await setLocale(stored || 'auto', { persist: false });
    } catch (e) {
        console.warn('[i18n] Initialisation failed — the interface stays in English.', e);
        currentLocale = FALLBACK_LOCALE;
        currentPreference = 'auto';
    }
    return currentLocale;
}

/** Test seam: drop all state so a suite can start from a clean registry. */
export function __resetI18nForTests() {
    catalogs.clear();
    registry.clear();
    warnedKeys.clear();
    currentPreference = null;
    currentLocale = FALLBACK_LOCALE;
}

export default {
    initI18n,
    t,
    tn,
    setLocale,
    getLocale,
    getLocalePreference,
    getLocales,
    getLocaleDescriptor,
    getCoverage,
    registerLocale,
    loadLocale,
    detectBrowserLocale,
    applyTranslations,
    onLocaleChange,
    hasKey,
    isRTL,
    formatNumber,
    formatDate,
    formatList,
    formatRelativeTime,
};
