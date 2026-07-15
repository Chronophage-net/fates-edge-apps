/**
 * Router Module
 * Handles navigation and module routing for the application
 */

import { moduleLoader } from './module-loader.js';
import { setHtml, getState } from './core/utils.js';
import { showToast } from './components/Toast.js';

// ============================================================
// State
// ============================================================

let currentRoute = '';
let routeHistory = [];
const routeListeners = new Set();

// ============================================================
// Route Configuration
// ============================================================

const ROUTES = {
    'home': { title: 'Home', module: 'home' },
    'dashboard': { title: 'Dashboard', module: 'dashboard' },
    'characters': { title: 'Characters', module: 'characters' },
    'dice': { title: 'Dice Roller', module: 'dice' },
    'timers': { title: 'Timers', module: 'timers' },
    'encounters': { title: 'Encounters', module: 'encounters' },
    'factions': { title: 'Factions', module: 'factions' },
    'vtt': { title: 'Virtual Tabletop', module: 'vtt' },
    'scene-tools': { title: 'Scene Tools', module: 'scene-tools' },
    'docs': { title: 'Documentation', module: 'docs' },
    'search': { title: 'Search', module: 'search' },
    'wiki': { title: 'Wiki', module: 'wiki' },
    'decks': { title: 'Decks', module: 'decks' },
    'patrons': { title: 'Patrons', module: 'patrons' },
    'settings': { title: 'Settings', module: 'settings' },
    'kanban': { title: 'Kanban', module: 'kanban' },
    'whiteboard': { title: 'Whiteboard', module: 'whiteboard' },
    'travel-planner': { title: 'Travel Planner', module: 'travel-planner' }
};

// ============================================================
// Route Redirects
// ============================================================

const ROUTE_REDIRECTS = {
    'consequences': 'decks',
    'regional': 'decks',
    'roller': 'dice'
};

// ============================================================
// Router Functions
// ============================================================

/**
 * Initialize the router
 */
export function initRouter() {
    console.log('🔀 Initializing router...');
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
        const hash = window.location.hash.slice(1) || 'home';
        navigate(hash, false);
    });
    
    // Handle initial route
    const initialRoute = window.location.hash.slice(1) || 'home';
    navigate(initialRoute, false);
    
    // Set up navigation event listeners
    setupNavigationListeners();
}

/**
 * Navigate to a route
 */
export function navigate(route, pushState = true) {
    // Handle redirects
    if (ROUTE_REDIRECTS[route]) {
        const newRoute = ROUTE_REDIRECTS[route];
        console.log(`↪️ Redirecting "${route}" → "${newRoute}"`);
        route = newRoute;
    }
    
    // Validate route
    if (!ROUTES[route]) {
        console.warn(`⚠️ Unknown route: ${route}, redirecting to home`);
        route = 'home';
    }
    
    const routeConfig = ROUTES[route];
    
    // Update browser history
    if (pushState) {
        const url = route === 'home' ? '#' : `#${route}`;
        history.pushState({ route }, routeConfig.title, url);
    }
    
    // Update current route
    const previousRoute = currentRoute;
    currentRoute = route;
    
    // Update route history
    routeHistory.push(route);
    if (routeHistory.length > 50) {
        routeHistory.shift();
    }
    
    // Update UI
    updateActiveNav(route);
    updatePageTitle(routeConfig.title);
    
    // Load and render module
    renderRoute(route, routeConfig);
    
    // Notify listeners
    notifyRouteListeners(route, previousRoute);
    
    console.log(`🧭 Navigated to: ${route}`);
}

/**
 * Render the route module
 */
async function renderRoute(route, routeConfig) {
    const container = document.querySelector('.main') || document.getElementById('app-content');
    if (!container) {
        console.error('❌ No container found for route rendering');
        return;
    }
    
    try {
        // Show loading state
        setHtml(container, `
            <div style="display:flex;justify-content:center;align-items:center;height:200px;">
                <div>🌀 Loading ${routeConfig.title}...</div>
            </div>
        `);
        
        // Load and render module
        await moduleLoader.renderModule(routeConfig.module, container);
        
        // Show success message
        console.log(`✅ Route "${route}" rendered successfully`);
        
    } catch (error) {
        console.error(`❌ Failed to render route "${route}":`, error);
        setHtml(container, `
            <div class="error-container" style="padding:2rem;text-align:center;">
                <h2>❌ Route Error</h2>
                <p>Failed to load ${routeConfig.title}</p>
                <p style="color:var(--text2);font-size:0.9rem;">${error.message}</p>
                <button class="btn btn-primary" onclick="window.router?.retryRoute('${route}')" style="margin-top:1rem;">
                    🔄 Retry
                </button>
            </div>
        `);
        showToast(`Failed to load ${routeConfig.title}`, 'error');
    }
}

/**
 * Update active navigation state
 */
function updateActiveNav(route) {
    // Update sidebar navigation
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === route) {
            item.classList.add('active');
        }
    });
    
    // Update tab content visibility
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => {
        tab.classList.remove('active');
        if (tab.id === `tab-${route}`) {
            tab.classList.add('active');
        }
    });
}

/**
 * Update page title
 */
function updatePageTitle(title) {
    document.title = `${title} — Fate's Edge Toolkit`;
}

/**
 * Set up navigation event listeners
 */
function setupNavigationListeners() {
    // Handle sidebar navigation clicks
    const navButtons = document.querySelectorAll('.sidebar-nav .nav-item[data-tab]');
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const route = button.dataset.tab;
            if (route) {
                navigate(route);
            }
        });
    });
    
    // Handle hash changes for direct navigation
    window.addEventListener('hashchange', () => {
        const route = window.location.hash.slice(1) || 'home';
        navigate(route, false);
    });
}

/**
 * Register a route listener
 */
export function onRouteChange(callback) {
    if (typeof callback === 'function') {
        routeListeners.add(callback);
        return () => routeListeners.delete(callback);
    }
}

/**
 * Notify route listeners
 */
function notifyRouteListeners(newRoute, oldRoute) {
    routeListeners.forEach(callback => {
        try {
            callback(newRoute, oldRoute);
        } catch (error) {
            console.error('Route listener error:', error);
        }
    });
}

/**
 * Get current route
 */
export function getCurrentRoute() {
    return currentRoute;
}

/**
 * Get route history
 */
export function getRouteHistory() {
    return [...routeHistory];
}

/**
 * Get available routes
 */
export function getAvailableRoutes() {
    return Object.keys(ROUTES);
}

/**
 * Register a new route
 */
export function registerRoute(routeName, routeConfig) {
    if (routeName && routeConfig && routeConfig.module) {
        ROUTES[routeName] = routeConfig;
        console.log(`✅ Registered route: ${routeName}`);
    }
}

/**
 * Retry loading current route
 */
export async function retryRoute(route = currentRoute) {
    if (route) {
        console.log(`🔄 Retrying route: ${route}`);
        moduleLoader.unloadModule(ROUTES[route]?.module);
        navigate(route, false);
    }
}

/**
 * Go back in history
 */
export function goBack() {
    if (routeHistory.length > 1) {
        routeHistory.pop(); // Remove current
        const previousRoute = routeHistory[routeHistory.length - 1];
        navigate(previousRoute);
    } else {
        navigate('home');
    }
}

/**
 * Refresh current route
 */
export async function refreshCurrentRoute() {
    if (currentRoute) {
        await moduleLoader.refreshModule(ROUTES[currentRoute].module);
        console.log(`🔄 Refreshed route: ${currentRoute}`);
    }
}

// ============================================================
// Global Access
// ============================================================

// Make router available globally for debugging
if (typeof window !== 'undefined') {
    window.router = {
        navigate,
        getCurrentRoute,
        getRouteHistory,
        getAvailableRoutes,
        registerRoute,
        retryRoute,
        goBack,
        refreshCurrentRoute
    };
}

// ============================================================
// Export
// ============================================================

export default {
    init: initRouter,
    navigate,
    getCurrentRoute,
    getRouteHistory,
    getAvailableRoutes,
    registerRoute,
    retryRoute,
    goBack,
    refreshCurrentRoute
};
