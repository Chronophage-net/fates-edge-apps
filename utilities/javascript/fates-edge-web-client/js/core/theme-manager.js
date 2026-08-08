// core/theme-manager.js
/**
 * Theme Manager
 *
 * Generalizes the app's previous dark/light-only, hardcoded toggle (which
 * used to live duplicated in both app.js's setupTheme() and
 * settings/index.js's setTheme() — two independent copies of the same
 * documentElement.classList.add/remove('light') + localStorage dance) into a
 * small named-theme registry that:
 *
 *   1. Anything can call `registerTheme()` — this module has zero
 *      dependencies on the pack system, so it's usable standalone (e.g. a
 *      future settings-only "custom accent color" feature) as well as by it.
 *   2. pack-manager.js registers a theme automatically when a pack.json
 *      manifest includes a `theme` block — see its installPack()/
 *      loadInstalledPacks() — so a module pack (like a future "Modern Noir"
 *      cyberpunk reskin pack) can ship a theme alongside its routes/data
 *      with no extra work beyond declaring it in the manifest.
 *   3. The two built-ins (`dark`, `light`) are registered here too, so the
 *      whole app — built-in and pack-supplied alike — goes through exactly
 *      one code path to apply a theme.
 *
 * HOW A THEME APPLIES
 *   Every theme gets `document.documentElement.dataset.theme = theme.id`
 *   (a plain CSS hook: `html[data-theme="modern-noir"] { ... }`), plus:
 *     - `variables`: a flat { '--gold': '#00fff2', ... } object. Injected as
 *       a single <style id="theme-vars-override"> scoped to
 *       `html[data-theme="<id>"]`, so it only takes effect while that theme
 *       is active and is fully cleared (not just overridden) when switching
 *       away — no residual variables leak into the next theme.
 *     - `cssUrl`: an optional full stylesheet (a blob: URL for pack-authored
 *       themes, or a real path for the two built-ins/dev-authored themes)
 *       for changes variables can't express — fonts, border shapes,
 *       component-specific overrides, background textures, etc. Applied via
 *       a single <link id="theme-css-override">, swapped (not stacked) on
 *       every theme change.
 *   `isDark: false` also toggles the legacy `.light` class on <html> that
 *   the pre-existing `html.light` variable block (see app.css) and a few
 *   feature modules (docs/index.js's code-viewer highlight theme) already
 *   key off of — so both the old convention and the new one stay in sync
 *   without those call sites needing to change.
 *
 * "auto" IS NOT A REGISTERED THEME — it's a meta-preference (matches
 * prefers-color-scheme, no localStorage entry) that resolves to the `dark`
 * or `light` registered theme at apply-time, exactly like the old toggle did.
 */

import { getStorage, setStorage } from './utils.js';

const STORAGE_KEY = 'fates-edge-theme';
const VARS_STYLE_ID = 'theme-vars-override';
const CSS_LINK_ID = 'theme-css-override';

const themes = new Map(); // id -> theme descriptor
let currentPreference = null; // what the user picked: a theme id, or 'auto'

// ============================================================
// REGISTRY
// ============================================================

/**
 * @param {object} theme
 * @param {string} theme.id - unique, e.g. 'modern-noir'
 * @param {string} theme.label - display name, e.g. 'Modern Noir'
 * @param {string} [theme.icon] - emoji/short glyph for theme pickers
 * @param {boolean} [theme.isDark=true] - drives the legacy `.light` class
 * @param {Object<string,string>} [theme.variables] - CSS custom property overrides
 * @param {string} [theme.cssUrl] - additional stylesheet URL (blob: or real path)
 */
export function registerTheme(theme) {
    if (!theme || !theme.id || !theme.label) {
        console.warn('[ThemeManager] registerTheme() needs at least {id, label}:', theme);
        return;
    }
    themes.set(theme.id, { isDark: true, ...theme });
    // If this theme is the one currently (or about to be) active, re-apply
    // so a late registration (e.g. a pack finishing install) takes effect
    // immediately instead of waiting for the next manual switch.
    if (resolvePreference(currentPreference) === theme.id) {
        applyResolvedTheme(theme.id);
    }
}

/**
 * Removes a theme from the registry (e.g. pack uninstall). If it was the
 * active theme, falls back to 'dark' rather than leaving the app on a theme
 * that no longer exists.
 */
export function unregisterTheme(id) {
    if (!themes.has(id) || id === 'dark' || id === 'light') return; // never unregister the built-ins
    themes.delete(id);
    if (resolvePreference(currentPreference) === id) {
        setTheme('dark');
    }
}

/** @returns {Array<{id:string,label:string,icon?:string,isDark:boolean}>} */
export function getThemes() {
    return Array.from(themes.values()).map(({ id, label, icon, isDark }) => ({ id, label, icon, isDark }));
}

export function getTheme(id) {
    return themes.get(id) || null;
}

/** The raw stored preference — a theme id, or 'auto'. */
export function getCurrentPreference() {
    return currentPreference;
}

/** The theme id actually applied right now (auto resolved to dark/light). */
export function getResolvedThemeId() {
    return document.documentElement.dataset.theme || 'dark';
}

// ============================================================
// APPLYING A THEME
// ============================================================

function resolvePreference(pref) {
    if (pref !== 'auto') return pref;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
}

function clearInjected() {
    document.getElementById(VARS_STYLE_ID)?.remove();
    document.getElementById(CSS_LINK_ID)?.remove();
}

function applyResolvedTheme(resolvedId) {
    const theme = themes.get(resolvedId) || themes.get('dark');
    if (!theme) return; // registerTheme('dark', ...) hasn't run yet — initTheme() always does this first

    document.documentElement.dataset.theme = theme.id;
    document.documentElement.classList.toggle('light', theme.isDark === false);

    clearInjected();

    if (theme.variables && Object.keys(theme.variables).length) {
        const decls = Object.entries(theme.variables).map(([k, v]) => `${k}: ${v};`).join(' ');
        const style = document.createElement('style');
        style.id = VARS_STYLE_ID;
        style.textContent = `html[data-theme="${theme.id}"] { ${decls} }`;
        document.head.appendChild(style);
    }

    if (theme.cssUrl) {
        const link = document.createElement('link');
        link.id = CSS_LINK_ID;
        link.rel = 'stylesheet';
        link.href = theme.cssUrl;
        document.head.appendChild(link);
    }
}

/**
 * @param {string} idOrAuto - a registered theme id, or 'auto'
 * @param {object} [opts]
 * @param {boolean} [opts.persist=true] - write the choice to localStorage
 */
export function setTheme(idOrAuto, { persist = true } = {}) {
    const isAuto = idOrAuto === 'auto';
    if (!isAuto && !themes.has(idOrAuto)) {
        console.warn(`[ThemeManager] Unknown theme "${idOrAuto}" — falling back to dark.`);
        idOrAuto = 'dark';
    }

    currentPreference = idOrAuto;
    applyResolvedTheme(resolvePreference(idOrAuto));

    if (persist) {
        if (isAuto) setStorage(STORAGE_KEY, null); // matches old behavior: 'auto' = no stored key
        else setStorage(STORAGE_KEY, idOrAuto);
    }

    document.dispatchEvent(new CustomEvent('theme-changed', {
        detail: { preference: currentPreference, resolvedId: getResolvedThemeId() }
    }));
}

// ============================================================
// INITIALIZATION
// ============================================================

let systemThemeListenerAttached = false;

/**
 * Registers the two built-ins and applies whatever the user last picked
 * (falling back to system preference, exactly like the old setupTheme()/
 * setTheme('auto') did). Safe to call once at boot; pack-supplied themes
 * register themselves separately (see pack-manager.js) and can be picked
 * any time afterward.
 */
export function initTheme() {
    if (!themes.has('dark')) {
        registerTheme({ id: 'dark', label: 'Dark', icon: '🌙', isDark: true });
    }
    if (!themes.has('light')) {
        registerTheme({ id: 'light', label: 'Light', icon: '☀️', isDark: false });
    }

    const stored = getStorage(STORAGE_KEY, null);
    setTheme(stored || 'auto', { persist: false });

    if (!systemThemeListenerAttached && window.matchMedia) {
        systemThemeListenerAttached = true;
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (currentPreference === 'auto') applyResolvedTheme(resolvePreference('auto'));
        });
    }
}

export default {
    registerTheme,
    unregisterTheme,
    getThemes,
    getTheme,
    getCurrentPreference,
    getResolvedThemeId,
    setTheme,
    initTheme,
};
