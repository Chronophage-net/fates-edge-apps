/**
 * Application router - handles navigation between tabs
 */

import { showToast } from './components/Toast.js';

const routes = new Map();
let currentTab = 'home';
let activeCallbacks = [];
let isInitialized = false;

// Route redirects for backward compatibility
const ROUTE_REDIRECTS = {
    'consequences': 'decks',
    'regional': 'decks'
};

// Cache for loaded modules to prevent reloading
const moduleCache = new Map();

/**
 * Register a route
 */
export function registerRoute(tab, module, options = {}) {
    routes.set(tab, { module, options });
}

/**
 * Resolve a route with redirect support
 */
function resolveRoute(tab) {
    // Check if this is a redirect
    if (ROUTE_REDIRECTS[tab]) {
        const redirectTarget = ROUTE_REDIRECTS[tab];
        console.log(`↪️ Router: Redirecting "${tab}" → "${redirectTarget}"`);
        return redirectTarget;
    }
    return tab;
}

/**
 * Navigate to a tab
 */
export async function navigate(tab, options = {}) {
    // Resolve redirects
    const resolvedTab = resolveRoute(tab);
    const isRedirect = resolvedTab !== tab;

    // If this was a redirect, update the URL hash without triggering another navigation
    if (isRedirect && !options._fromRedirect) {
        // Update URL hash silently
        if (window.location.hash) {
            const newHash = resolvedTab;
            // Use replaceState to avoid adding to history
            window.history.replaceState(null, '', `#${newHash}`);
        }
        // Navigate to the resolved tab with redirect flag
        return navigate(resolvedTab, { ...options, _fromRedirect: true });
    }

    // Check if route exists
    if (!routes.has(resolvedTab)) {
        console.warn(`Route not found: ${resolvedTab} (original: ${tab})`);

        // Show a friendly message
        const contentEl = document.getElementById(`tab-${resolvedTab}`);
        if (contentEl) {
            contentEl.innerHTML = `
                <div class="panel">
                    <h3>📄 ${resolvedTab.charAt(0).toUpperCase() + resolvedTab.slice(1)}</h3>
                    <p class="text-muted">This feature is being set up.</p>
                    <p class="text-muted small">Route not registered: ${resolvedTab}</p>
                    ${isRedirect ? `<p class="text-muted small">Redirected from: ${tab}</p>` : ''}
                    <button class="btn btn-sm mt-1" onclick="window.location.hash='home'">🏠 Go Home</button>
                </div>
            `;
        }
        return;
    }

    currentTab = resolvedTab;

    // Update sidebar
    document.querySelectorAll('.sidebar-nav button[data-tab]').forEach(btn => {
        const btnTab = btn.dataset.tab;
        // Check if this button should be active (handle redirects)
        const isActive = btnTab === resolvedTab ||
                         (ROUTE_REDIRECTS[btnTab] === resolvedTab);
        btn.classList.toggle('active', isActive);
    });

    // Show tab content
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });

    // Try to find the content element (handle redirects)
    let contentEl = document.getElementById(`tab-${resolvedTab}`);
    if (!contentEl) {
        // Try the original tab name
        contentEl = document.getElementById(`tab-${tab}`);
    }

    if (contentEl) {
        contentEl.classList.add('active');
    } else {
        console.warn(`No content element found for tab: ${resolvedTab}`);
        return;
    }

    // Check if module is cached
    if (moduleCache.has(resolvedTab)) {
        const cached = moduleCache.get(resolvedTab);
        console.log(`📦 Using cached module: ${resolvedTab}`);

        if (cached && typeof cached.render === 'function') {
            cached.render(contentEl);
        } else if (cached && typeof cached.default?.render === 'function') {
            cached.default.render(contentEl);
        }

        // Notify callbacks
        activeCallbacks.forEach(cb => cb(resolvedTab, cached));
        return;
    }

    // Load module
    const route = routes.get(resolvedTab);
    if (route && route.module) {
        try {
            // Show loading state
            contentEl.innerHTML = `
                <div class="panel" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem;min-height:200px;">
                    <div style="font-size:2rem;margin-bottom:1rem;">⏳</div>
                    <h3 style="color:var(--text2);">Loading ${resolvedTab}...</h3>
                    <p class="text-muted" style="font-size:0.85rem;">Please wait</p>
                </div>
            `;

            // Dynamic import
            const module = await route.module();

            // Cache the module
            moduleCache.set(resolvedTab, module);

            // Render the module
            if (module && typeof module.render === 'function') {
                module.render(contentEl);
            } else if (module && typeof module.default?.render === 'function') {
                module.default.render(contentEl);
            } else if (module && typeof module.default === 'function') {
                module.default(contentEl);
            } else if (contentEl) {
                // Fallback placeholder
                contentEl.innerHTML = `
                    <div class="panel">
                        <h3>${resolvedTab.charAt(0).toUpperCase() + resolvedTab.slice(1)}</h3>
                        <p class="text-muted">Module loaded but no render function found.</p>
                        <p class="text-muted small">Available exports: ${Object.keys(module).join(', ')}</p>
                    </div>
                `;
            }

            // Attach events if available
            if (module && typeof module.attachEvents === 'function') {
                module.attachEvents();
            } else if (module && typeof module.default?.attachEvents === 'function') {
                module.default.attachEvents();
            }

            // Call onActivate if available
            if (module && typeof module.onActivate === 'function') {
                await module.onActivate();
            } else if (module && typeof module.default?.onActivate === 'function') {
                await module.default.onActivate();
            }

            // Notify callbacks
            activeCallbacks.forEach(cb => cb(resolvedTab, module));

            // Show success toast for redirects
            if (isRedirect) {
                showToast(`↪️ Redirected to ${resolvedTab}`, 'info');
            }

        } catch (err) {
            console.error(`Failed to load route ${resolvedTab}:`, err);
            contentEl.innerHTML = `
                <div class="panel">
                    <h3>⚠️ Error</h3>
                    <p class="text-muted">Failed to load this feature.</p>
                    <p class="text-muted small" style="font-size:0.8rem;color:var(--red);">${err.message || 'Unknown error'}</p>
                    <button class="btn btn-sm mt-1" onclick="location.reload()">↻ Retry</button>
                </div>
            `;
            showToast(`Failed to load ${resolvedTab}: ${err.message}`, 'error');
        }
    } else {
        // Route exists but no module loader
        contentEl.innerHTML = `
            <div class="panel">
                <h3>${resolvedTab.charAt(0).toUpperCase() + resolvedTab.slice(1)}</h3>
                <p class="text-muted">Module not configured for this route.</p>
            </div>
        `;
    }
}

/**
 * Register a callback for navigation events
 */
export function onNavigate(callback) {
    activeCallbacks.push(callback);
}

/**
 * Get the current tab
 */
export function getCurrentTab() {
    return currentTab;
}

/**
 * Check if a tab is active
 */
export function isActiveTab(tab) {
    const resolved = resolveRoute(tab);
    return currentTab === resolved;
}

/**
 * Get redirect target for a tab
 */
export function getRedirectTarget(tab) {
    return ROUTE_REDIRECTS[tab] || tab;
}

/**
 * Initialize the router
 */
export function initRouter() {
    if (isInitialized) return;
    isInitialized = true;

    console.log('🔀 Router initialized with redirects:', ROUTE_REDIRECTS);
    console.log('📋 Registered routes:', Array.from(routes.keys()));

    // Handle sidebar clicks
    document.querySelectorAll('.sidebar-nav button[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab) {
                // Resolve redirect for URL hash
                const resolvedTab = resolveRoute(tab);
                // Update URL hash with resolved tab
                window.location.hash = resolvedTab;
                // Navigate (will handle redirects internally)
                navigate(tab);
            }
        });
    });

    // Handle hash changes
    window.addEventListener('hashchange', () => {
        const tab = window.location.hash.slice(1) || 'home';
        // Don't navigate if it's the same as current to avoid loops
        if (tab !== currentTab) {
            navigate(tab);
        }
    });

    // Initial navigation from hash or default
    const initialTab = window.location.hash.slice(1) || 'home';

    // Check if the initial tab is a redirect
    const resolvedInitial = resolveRoute(initialTab);
    if (resolvedInitial !== initialTab) {
        // Update the URL hash to the resolved tab
        window.history.replaceState(null, '', `#${resolvedInitial}`);
    }

    // Navigate to the initial tab
    setTimeout(() => {
        navigate(initialTab);
    }, 50);
}

/**
 * Refresh the current tab
 */
export async function refreshCurrentTab() {
    if (currentTab) {
        // Clear cache for this tab to force reload
        moduleCache.delete(currentTab);
        await navigate(currentTab, { _refresh: true });
    }
}

/**
 * Preload a module without navigating
 */
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
            console.log(`📦 Preloaded module: ${resolvedTab}`);
            return module;
        } catch (err) {
            console.warn(`Failed to preload ${resolvedTab}:`, err);
            return null;
        }
    }
    return null;
}

/**
 * Clear module cache
 */
export function clearModuleCache(tab) {
    if (tab) {
        const resolvedTab = resolveRoute(tab);
        moduleCache.delete(resolvedTab);
        console.log(`🧹 Cleared cache for: ${resolvedTab}`);
    } else {
        moduleCache.clear();
        console.log('🧹 Cleared all module cache');
    }
}

/**
 * Get all registered routes
 */
export function getRoutes() {
    return Array.from(routes.keys());
}

/**
 * Check if a route is registered
 */
export function hasRoute(tab) {
    const resolvedTab = resolveRoute(tab);
    return routes.has(resolvedTab);
}

/**
 * Get module from cache
 */
export function getCachedModule(tab) {
    const resolvedTab = resolveRoute(tab);
    return moduleCache.get(resolvedTab);
}

// Export default for module compatibility
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
    getCachedModule
};
