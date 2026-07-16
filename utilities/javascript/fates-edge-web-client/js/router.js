/**
 * Application router - handles navigation between tabs
 */

import { showToast } from './components/Toast.js';

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

// Route redirects for backward compatibility
const ROUTE_REDIRECTS = {
    'consequences': 'decks',
    'builder': 'characters',
    'regional': 'decks',
    'roller': 'dice',
    'scene-tools': 'gm-tools'  // redirect old name to new
};

// Map of route names to module import paths
// All imports are relative to the js/ directory, so use './features/...'
const ROUTE_IMPORTS = {
    home: () => import('./features/home/index.js'),
    characters: () => import('./features/characters/index.js'),
    dice: () => import('./features/dice/index.js'),
    decks: () => import('./features/decks/index.js'),
    encounters: () => import('./features/encounters/index.js'),
    timers: () => import('./features/timers/index.js'),
    factions: () => import('./features/factions/index.js'),
    patrons: () => import('./features/patrons/index.js'),
    docs: () => import('./features/docs/index.js'),
    search: () => import('./features/search/index.js'),
    settings: () => import('./features/settings/index.js'),
    sync: () => import('./features/sync/index.js'),
    whiteboard: () => import('./features/whiteboard/index.js'),
    kanban: () => import('./features/kanban/index.js'),
    wiki: () => import('./features/wiki/index.js'),
    vtt: () => import('./features/vtt/index.js'),
    'gm-tools': () => import('./features/gm-tools/index.js'),
    // 'travel-planner' is embedded in gm-tools
};

// Optional: routes that can be safely stubbed if missing
const STUBBABLE_ROUTES = ['dice', 'encounters', 'vtt', 'timers'];

// ============================================================
// STATE
// ============================================================

const routes = new Map();
let currentTab = 'home';
let activeCallbacks = [];
let isInitialized = false;
const moduleCache = new Map();

// ============================================================
// ROUTE MANAGEMENT
// ============================================================

export function registerRoute(tab, module, options = {}) {
    routes.set(tab, { module, options });
}

function resolveRoute(tab) {
    if (ROUTE_REDIRECTS[tab]) {
        const redirectTarget = ROUTE_REDIRECTS[tab];
        console.log(`↪️ Router: Redirecting "${tab}" → "${redirectTarget}"`);
        return redirectTarget;
    }
    return tab;
}

// Register all default routes
function registerDefaultRoutes() {
    // Clear any existing routes (in case of re-init)
    routes.clear();

    for (const [tab, importer] of Object.entries(ROUTE_IMPORTS)) {
        routes.set(tab, { module: importer, options: {} });
    }

    console.log(`🔀 Router: ${routes.size} routes registered.`);
}

// ============================================================
// NAVIGATION
// ============================================================

export async function navigate(tab, options = {}) {
    const resolvedTab = resolveRoute(tab);
    const isRedirect = resolvedTab !== tab;

    if (isRedirect && !options._fromRedirect) {
        if (window.location.hash) {
            const newHash = resolvedTab;
            window.history.replaceState(null, '', `#${newHash}`);
        }
        return navigate(resolvedTab, { ...options, _fromRedirect: true });
    }

    // If route not registered, try to register defaults again (lazy)
    if (!routes.has(resolvedTab)) {
        registerDefaultRoutes();
        // If still not found, show placeholder
        if (!routes.has(resolvedTab)) {
            console.warn(`Route not found: ${resolvedTab} (original: ${tab})`);
            const contentEl = getOrCreateContentElement(resolvedTab);
            if (contentEl) {
                contentEl.innerHTML = renderPlaceholder(resolvedTab, 'Route not configured.');
            }
            return;
        }
    }

    currentTab = resolvedTab;

    // Update sidebar active state
    document.querySelectorAll('.sidebar-nav button[data-tab]').forEach(btn => {
        const btnTab = btn.dataset.tab;
        const isActive = btnTab === resolvedTab || (ROUTE_REDIRECTS[btnTab] === resolvedTab);
        btn.classList.toggle('active', isActive);
    });

    // Update tab content visibility
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });

    const contentEl = getOrCreateContentElement(resolvedTab, tab);
    if (contentEl) {
        contentEl.classList.add('active');
    } else {
        console.error(`Could not get or create content element for tab: ${resolvedTab}`);
        return;
    }

    // Check cache
    if (moduleCache.has(resolvedTab)) {
        const cached = moduleCache.get(resolvedTab);
        if (cached && typeof cached.render === 'function') {
            cached.render(contentEl);
        } else if (cached && typeof cached.default?.render === 'function') {
            cached.default.render(contentEl);
        }
        activeCallbacks.forEach(cb => cb(resolvedTab, cached));
        return;
    }

    // Load module
    const route = routes.get(resolvedTab);
    if (route && route.module) {
        try {
            // Show loading indicator
            contentEl.innerHTML = `
                <div class="panel" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem;min-height:200px;">
                    <div style="font-size:2rem;margin-bottom:1rem;">⏳</div>
                    <h3 style="color:var(--text2);">Loading ${resolvedTab}...</h3>
                    <p class="text-muted" style="font-size:0.85rem;">Please wait</p>
                </div>
            `;

            let module;
            try {
                module = await route.module();
            } catch (importError) {
                // If module fails to load, try stub
                if (STUBBABLE_ROUTES.includes(resolvedTab)) {
                    module = createStubModule(resolvedTab);
                    showToast(`⚠️ "${resolvedTab}" is not available; showing placeholder`, 'warning');
                } else {
                    throw importError;
                }
            }

            if (module) {
                moduleCache.set(resolvedTab, module);

                if (module && typeof module.render === 'function') {
                    module.render(contentEl);
                } else if (module && typeof module.default?.render === 'function') {
                    module.default.render(contentEl);
                } else if (module && typeof module.default === 'function') {
                    module.default(contentEl);
                } else {
                    // Module loaded but no render function
                    contentEl.innerHTML = renderPlaceholder(resolvedTab, 'Module loaded but no render function found.');
                }

                // Attach events and activate
                if (module && typeof module.attachEvents === 'function') {
                    module.attachEvents();
                } else if (module && typeof module.default?.attachEvents === 'function') {
                    module.default.attachEvents();
                }

                if (module && typeof module.onActivate === 'function') {
                    await module.onActivate();
                } else if (module && typeof module.default?.onActivate === 'function') {
                    await module.default.onActivate();
                }

                activeCallbacks.forEach(cb => cb(resolvedTab, module));

                if (isRedirect) {
                    showToast(`↪️ Redirected to ${resolvedTab}`, 'info');
                }
            }
        } catch (err) {
            console.error(`Failed to load route ${resolvedTab}:`, err);
            contentEl.innerHTML = renderError(resolvedTab, err);
            showToast(`Failed to load ${resolvedTab}: ${err.message}`, 'error');
        }
    } else {
        contentEl.innerHTML = renderPlaceholder(resolvedTab, 'Module not configured for this route.');
    }
}

// ============================================================
// CONTENT ELEMENT HELPERS
// ============================================================

function getOrCreateContentElement(resolvedTab, originalTab) {
    // Try to find by resolved tab name
    let contentEl = document.getElementById(`tab-${resolvedTab}`);
    if (contentEl) return contentEl;

    // Try by original tab name
    if (originalTab && originalTab !== resolvedTab) {
        contentEl = document.getElementById(`tab-${originalTab}`);
        if (contentEl) return contentEl;
    }

    // Try to find any element with class 'tab-content'
    contentEl = document.querySelector('.tab-content');
    if (contentEl) {
        // Reuse the first tab-content found
        contentEl.id = `tab-${resolvedTab}`;
        return contentEl;
    }

    // Create a new container inside the main area
    const main = document.querySelector('main') || document.body;
    contentEl = document.createElement('div');
    contentEl.id = `tab-${resolvedTab}`;
    contentEl.className = 'tab-content active';
    main.appendChild(contentEl);
    console.log(`Created temporary container for tab: ${resolvedTab}`);
    return contentEl;
}

// ============================================================
// RENDER HELPERS
// ============================================================

function renderPlaceholder(tab, message) {
    const title = tab.charAt(0).toUpperCase() + tab.slice(1);
    return `
        <div class="panel">
            <h3>📄 ${title}</h3>
            <p class="text-muted">${message}</p>
            <p class="text-muted small" style="font-size:0.8rem;color:var(--text3);">Route: ${tab}</p>
            <button class="btn btn-sm mt-1" onclick="window.location.hash='home'">🏠 Go Home</button>
        </div>
    `;
}

function renderError(tab, err) {
    return `
        <div class="panel">
            <h3>⚠️ Error</h3>
            <p class="text-muted">Failed to load this feature.</p>
            <p class="text-muted small" style="font-size:0.8rem;color:var(--red);">${err.message || 'Unknown error'}</p>
            <button class="btn btn-sm mt-1" onclick="location.reload()">↻ Retry</button>
        </div>
    `;
}

function createStubModule(tab) {
    const title = tab.charAt(0).toUpperCase() + tab.slice(1);
    return {
        render: (el) => {
            el.innerHTML = `
                <div class="panel">
                    <h3>🚧 ${title}</h3>
                    <p class="text-muted">This feature is not yet implemented.</p>
                    <p class="text-muted small" style="font-size:0.8rem;color:var(--text3);">Route: ${tab}</p>
                    <button class="btn btn-sm mt-1" onclick="window.location.hash='home'">🏠 Go Home</button>
                </div>
            `;
        },
        onActivate: () => {},
        onDeactivate: () => {},
        attachEvents: () => {}
    };
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
    const resolved = resolveRoute(tab);
    return currentTab === resolved;
}

export function getRedirectTarget(tab) {
    return ROUTE_REDIRECTS[tab] || tab;
}

export async function refreshCurrentTab() {
    if (currentTab) {
        moduleCache.delete(currentTab);
        await navigate(currentTab, { _refresh: true });
    }
}

export async function preloadModule(tab) {
    const resolvedTab = resolveRoute(tab);
    if (moduleCache.has(resolvedTab)) {
        return moduleCache.get(resolvedTab);
    }

    const route = routes.get(resolvedTab);
    if (route && route.module) {
        try {
            const module = await route.module();
            moduleCache.set(resolvedTab, module);
            return module;
        } catch (err) {
            console.warn(`Failed to preload ${resolvedTab}:`, err);
            return null;
        }
    }
    return null;
}

export function clearModuleCache(tab) {
    if (tab) {
        const resolvedTab = resolveRoute(tab);
        moduleCache.delete(resolvedTab);
    } else {
        moduleCache.clear();
    }
}

export function getRoutes() {
    return Array.from(routes.keys());
}

export function hasRoute(tab) {
    const resolvedTab = resolveRoute(tab);
    return routes.has(resolvedTab);
}

export function getCachedModule(tab) {
    const resolvedTab = resolveRoute(tab);
    return moduleCache.get(resolvedTab);
}

// ============================================================
// INITIALIZATION
// ============================================================

export function initRouter() {
    if (isInitialized) return;
    isInitialized = true;

    // Register all default routes
    registerDefaultRoutes();

    console.log(`🔀 Router initialized with ${routes.size} routes and redirects:`, ROUTE_REDIRECTS);

    // Sidebar navigation
    document.querySelectorAll('.sidebar-nav button[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab) {
                const resolvedTab = resolveRoute(tab);
                window.location.hash = resolvedTab;
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
    const resolvedInitial = resolveRoute(initialTab);
    if (resolvedInitial !== initialTab) {
        window.history.replaceState(null, '', `#${resolvedInitial}`);
    }

    setTimeout(() => {
        navigate(initialTab);
    }, 50);
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
    getRedirectTarget,
    refreshCurrentTab,
    preloadModule,
    clearModuleCache,
    getRoutes,
    hasRoute,
    getCachedModule,
};