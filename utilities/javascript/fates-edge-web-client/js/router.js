/**
 * Application router – handles navigation and delegates module management to moduleLoader.
 * v3.3 – Added spellcraft route, extended for magic module.
 */

import { showToast } from './components/Toast.js';
import { moduleLoader } from './module-loader.js';

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

// Route redirects for backward compatibility
export const ROUTE_REDIRECTS = {
    'consequences': 'decks',
    'builder': 'characters',
    'regional': 'decks',
    'roller': 'dice',
    'scene-tools': 'gm-tools',   // old name → new
};

// Map of route names to module import paths (relative to js/)
const ROUTE_IMPORTS = {
    home:        () => import('./features/home/index.js'),
    dashboard:   () => import('./features/dashboard/index.js'),
    characters:  () => import('./features/characters/index.js'),
    dice:        () => import('./features/dice/index.js'),
    decks:       () => import('./features/decks/index.js'),
    encounters:  () => import('./features/encounters/index.js'),
    timers:      () => import('./features/timers/index.js'),
    factions:    () => import('./features/factions/index.js'),
    patrons:     () => import('./features/patrons/index.js'),
    docs:        () => import('./features/docs/index.js'),
    search:      () => import('./features/search/index.js'),
    settings:    () => import('./features/settings/index.js'),
    sync:        () => import('./features/sync/index.js'),
    whiteboard:  () => import('./features/whiteboard/index.js'),
    kanban:      () => import('./features/kanban/index.js'),
    wiki:        () => import('./features/wiki/index.js'),
    vtt:         () => import('./features/vtt/index.js'),
    'gm-tools':  () => import('./features/gm-tools/index.js'),
    // 👇 NEW – Spellcraft & Magic module
    spellcraft:  () => import('./features/spellcraft/index.js'),
};

// ============================================================
// STATE
// ============================================================

let currentTab = 'home';
let activeCallbacks = [];
let isInitialized = false;

// ============================================================
// RESOLVE TAB (with redirects)
// ============================================================

function resolveTab(tab) {
    const redirect = ROUTE_REDIRECTS[tab];
    if (redirect) {
        console.log(`↪️ Router: Redirecting "${tab}" → "${redirect}"`);
        return redirect;
    }
    return tab;
}

// ============================================================
// CONTENT ELEMENT MANAGEMENT
// ============================================================

function getOrCreateContentElement(resolvedTab) {
    // Try by ID
    let el = document.getElementById(`tab-${resolvedTab}`);
    if (el) return el;

    // Fallback: find any .tab-content
    el = document.querySelector('.tab-content');
    if (el) {
        el.id = `tab-${resolvedTab}`;
        return el;
    }

    // Create new inside <main> or <body>
    const container = document.querySelector('main') || document.body;
    el = document.createElement('div');
    el.id = `tab-${resolvedTab}`;
    el.className = 'tab-content';
    container.appendChild(el);
    console.log(`🆕 Created content container for tab: ${resolvedTab}`);
    return el;
}

// ============================================================
// NAVIGATION (CORE)
// ============================================================

export async function navigate(tab, options = {}) {
    const resolved = resolveTab(tab);
    const isRedirect = resolved !== tab;

    // If it's a redirect, update URL hash and call again
    if (isRedirect && !options._fromRedirect) {
        if (window.location.hash) {
            window.history.replaceState(null, '', `#${resolved}`);
        }
        return navigate(resolved, { ...options, _fromRedirect: true });
    }

    // Ensure routes are registered (lazy init)
    if (moduleLoader.importFns.size === 0) {
        registerAllRoutes();
    }

    // Check if route exists in loader
    if (!moduleLoader.importFns.has(resolved)) {
        console.warn(`⚠️ Route not found: ${resolved} (original: ${tab})`);
        const contentEl = getOrCreateContentElement(resolved);
        contentEl.innerHTML = `
            <div class="panel">
                <h3>📄 Unknown Route</h3>
                <p class="text-muted">The route "${resolved}" is not registered.</p>
                <button class="btn btn-sm mt-1" onclick="window.location.hash='home'">🏠 Go Home</button>
            </div>
        `;
        return;
    }

    // Update current tab
    currentTab = resolved;

    // Update sidebar active state
    document.querySelectorAll('.sidebar-nav button[data-tab]').forEach(btn => {
        const btnTab = btn.dataset.tab;
        const isActive = btnTab === resolved || ROUTE_REDIRECTS[btnTab] === resolved;
        btn.classList.toggle('active', isActive);
    });

    // Hide all tab contents, show the active one
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const contentEl = getOrCreateContentElement(resolved);
    contentEl.classList.add('active');

    // Delegate rendering to moduleLoader
    try {
        await moduleLoader.renderModule(resolved, contentEl);
        activeCallbacks.forEach(cb => cb(resolved, moduleLoader.getModule(resolved)));
        if (isRedirect) {
            showToast(`↪️ Redirected to ${resolved}`, 'info');
        }
    } catch (err) {
        // The loader already shows an error UI, but we also want to log and notify
        console.error(`Router: Error rendering module "${resolved}":`, err);
        showToast(`Failed to load ${resolved}: ${err.message}`, 'error');
    }
}

// ============================================================
// ROUTE REGISTRATION
// ============================================================

function registerAllRoutes() {
    for (const [tab, importer] of Object.entries(ROUTE_IMPORTS)) {
        moduleLoader.registerRoute(tab, importer);
    }
    console.log(`🔀 Router: ${Object.keys(ROUTE_IMPORTS).length} routes registered with moduleLoader.`);
}

// Public method to add/override a route (use only if needed)
export function registerRoute(tab, importFn, options = {}) {
    moduleLoader.registerRoute(tab, importFn);
}

// ============================================================
// PUBLIC API
// ============================================================

export function onNavigate(callback) {
    activeCallbacks.push(callback);
}

export function getCurrentTab() {
    return currentTab;
}

export function isActiveTab(tab) {
    return currentTab === resolveTab(tab);
}

export async function refreshCurrentTab() {
    if (currentTab) {
        await moduleLoader.refreshModule(currentTab);
    }
}

export async function preloadModule(tab) {
    const resolved = resolveTab(tab);
    return moduleLoader.preloadModule(resolved);
}

export function clearModuleCache(tab) {
    if (tab) {
        moduleLoader.unloadModule(resolveTab(tab));
    } else {
        moduleLoader.clearAll();
    }
}

export function getRoutes() {
    return Array.from(moduleLoader.importFns.keys());
}

export function hasRoute(tab) {
    return moduleLoader.importFns.has(resolveTab(tab));
}

export function getCachedModule(tab) {
    return moduleLoader.getModule(resolveTab(tab)) || null;
}

// ============================================================
// INITIALIZATION
// ============================================================

export function initRouter() {
    if (isInitialized) return;
    isInitialized = true;

    // Register all default routes
    registerAllRoutes();

    console.log(`🔀 Router initialized. Redirects:`, ROUTE_REDIRECTS);

    // Sidebar click handlers
    document.querySelectorAll('.sidebar-nav button[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab) {
                const resolved = resolveTab(tab);
                window.location.hash = resolved;
                navigate(tab);
            }
        });
    });

    // Hash change listener
    window.addEventListener('hashchange', () => {
        const tab = window.location.hash.slice(1) || 'home';
        if (tab !== currentTab) {
            navigate(tab);
        }
    });

    // Initial navigation
    let initialTab = window.location.hash.slice(1) || 'home';
    const resolvedInit = resolveTab(initialTab);
    if (resolvedInit !== initialTab) {
        window.history.replaceState(null, '', `#${resolvedInit}`);
    }
    // Defer to let DOM settle
    setTimeout(() => navigate(initialTab), 50);
}

// ============================================================
// EXPORT
// ============================================================

export default {
    initRouter,
    navigate,
    registerRoute,
    onNavigate,
    getCurrentTab,
    isActiveTab,
    refreshCurrentTab,
    preloadModule,
    clearModuleCache,
    getRoutes,
    hasRoute,
    getCachedModule,
    ROUTE_REDIRECTS,
};