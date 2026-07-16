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
    'builder': 'characters',
    'regional': 'decks',
    'roller': 'dice'
};

const moduleCache = new Map();

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

    if (!routes.has(resolvedTab)) {
        console.warn(`Route not found: ${resolvedTab} (original: ${tab})`);
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

    document.querySelectorAll('.sidebar-nav button[data-tab]').forEach(btn => {
        const btnTab = btn.dataset.tab;
        const isActive = btnTab === resolvedTab || (ROUTE_REDIRECTS[btnTab] === resolvedTab);
        btn.classList.toggle('active', isActive);
    });

    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });

    let contentEl = document.getElementById(`tab-${resolvedTab}`);
    if (!contentEl) {
        contentEl = document.getElementById(`tab-${tab}`);
    }

    if (contentEl) {
        contentEl.classList.add('active');
    } else {
        console.warn(`No content element found for tab: ${resolvedTab}`);
        return;
    }

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

    const route = routes.get(resolvedTab);
    if (route && route.module) {
        try {
            contentEl.innerHTML = `
                <div class="panel" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem;min-height:200px;">
                    <div style="font-size:2rem;margin-bottom:1rem;">⏳</div>
                    <h3 style="color:var(--text2);">Loading ${resolvedTab}...</h3>
                    <p class="text-muted" style="font-size:0.85rem;">Please wait</p>
                </div>
            `;

            const module = await route.module();
            moduleCache.set(resolvedTab, module);

            if (module && typeof module.render === 'function') {
                module.render(contentEl);
            } else if (module && typeof module.default?.render === 'function') {
                module.default.render(contentEl);
            } else if (module && typeof module.default === 'function') {
                module.default(contentEl);
            } else if (contentEl) {
                contentEl.innerHTML = `
                    <div class="panel">
                        <h3>${resolvedTab.charAt(0).toUpperCase() + resolvedTab.slice(1)}</h3>
                        <p class="text-muted">Module loaded but no render function found.</p>
                    </div>
                `;
            }

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
        contentEl.innerHTML = `
            <div class="panel">
                <h3>${resolvedTab.charAt(0).toUpperCase() + resolvedTab.slice(1)}</h3>
                <p class="text-muted">Module not configured for this route.</p>
            </div>
        `;
    }
}

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

export function initRouter() {
    if (isInitialized) return;
    isInitialized = true;

    console.log('🔀 Router initialized with redirects:', ROUTE_REDIRECTS);

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

    window.addEventListener('hashchange', () => {
        const tab = window.location.hash.slice(1) || 'home';
        if (tab !== currentTab) {
            navigate(tab);
        }
    });

    const initialTab = window.location.hash.slice(1) || 'home';
    const resolvedInitial = resolveRoute(initialTab);
    if (resolvedInitial !== initialTab) {
        window.history.replaceState(null, '', `#${resolvedInitial}`);
    }

    setTimeout(() => {
        navigate(initialTab);
    }, 50);
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