// js/module-loader.js - Robust module loader

import { setHtml, createElement } from './core/utils.js';

class ModuleLoader {
    constructor() {
        this.modules = new Map();
        this.loading = new Map();
        this.container = document.getElementById('app-content');
        this.currentModule = null;

        this.modulePaths = {
            // Core modules
            'sync': './core/sync/index.js',
            'presence': './core/presence/index.js',
            
            // Feature modules
            'characters': './features/characters/index.js',
            'dashboard': './features/dashboard/index.js',
            'decks': './features/decks/index.js',
            'dice': './features/dice/index.js',
            'docs': './features/docs/index.js',
            'encounters': './features/encounters/index.js',
            'factions': './features/factions/index.js',
            'home': './features/home/index.js',
            'kanban': './features/kanban/index.js',
            'patrons': './features/patrons/index.js',
            'scene-tools': './features/dashboard/scene-tools.js', // NEW
            'search': './features/search/index.js',
            'settings': './features/settings/index.js',
            'timers': './features/timers/index.js',
            'travel-planner': './features/travel-planner/index.js', // NEW - was missing
            'vtt': './features/vtt/index.js',
            'whiteboard': './features/whiteboard/index.js',
            'wiki': './features/wiki/index.js',
        };
    }

    /**
     * Load a module by name
     */
    async loadModule(moduleName) {
        // Check if already loaded
        if (this.modules.has(moduleName)) {
            console.log(`📦 Module "${moduleName}" already loaded`);
            return this.modules.get(moduleName);
        }

        // Check if currently loading
        if (this.loading.has(moduleName)) {
            console.log(`⏳ Module "${moduleName}" is loading...`);
            return this.loading.get(moduleName);
        }

        // Start loading
        const loadPromise = this._doLoadModule(moduleName);
        this.loading.set(moduleName, loadPromise);

        try {
            const module = await loadPromise;
            this.modules.set(moduleName, module);
            console.log(`✅ Module "${moduleName}" loaded successfully`);
            return module;
        } catch (error) {
            console.error(`❌ Failed to load module "${moduleName}":`, error);
            throw error;
        } finally {
            this.loading.delete(moduleName);
        }
    }

    /**
     * Actually load the module
     */
    async _doLoadModule(moduleName) {
        const path = this.modulePaths[moduleName];
        if (!path) {
            throw new Error(`Unknown module: ${moduleName}`);
        }

        console.log(`🔍 Loading module "${moduleName}" from "${path}"`);

        // Dynamic import
        const module = await import(path);
        
        // Check if module has a render function
        if (typeof module.render !== 'function') {
            console.warn(`⚠️ Module "${moduleName}" has no render function`);
            console.log('Available exports:', Object.keys(module));
            
            // Try to find an alternative entry point
            if (typeof module.init === 'function') {
                console.log(`🔄 Using init() as fallback for "${moduleName}"`);
                module.render = module.init;
            } else if (module.default && typeof module.default.render === 'function') {
                console.log(`🔄 Using default.render() as fallback for "${moduleName}"`);
                module.render = module.default.render;
            } else if (typeof module.load === 'function') {
                console.log(`🔄 Using load() as fallback for "${moduleName}"`);
                module.render = module.load;
            } else if (typeof module.default === 'function') {
                console.log(`🔄 Using default() as fallback for "${moduleName}"`);
                module.render = module.default;
            } else {
                // Create a placeholder render function using utils
                module.render = (el) => {
                    setHtml(el, `
                        <h2>${moduleName}</h2>
                        <p>Module loaded but no render function found.</p>
                    `);
                    console.log(`📦 Module "${moduleName}" loaded as placeholder`);
                };
            }
        }

        // Ensure module has refresh and lifecycle methods
        module._moduleName = moduleName;
        module._lastRender = 0;
        module._refreshInterval = 30000; // 30 seconds default
        
        // Add default refresh method if not provided
        if (typeof module.refresh !== 'function') {
            module.refresh = async function() {
                console.log(`🔄 Refreshing module "${moduleName}"`);
                if (this.onActivate) {
                    await this.onActivate();
                }
                if (this.render && this._container) {
                    const container = this._container;
                    const scrollPos = container.scrollTop;
                    await this.render(container);
                    if (scrollPos > 0) {
                        container.scrollTop = scrollPos;
                    }
                }
            };
        }
        
        // Add default onActivate if not provided
        if (typeof module.onActivate !== 'function') {
            module.onActivate = async function() {
                console.log(`👋 Module "${moduleName}" activated`);
                if (this.refresh && typeof this.refresh === 'function') {
                    await this.refresh();
                }
            };
        }
        
        // Add default onDeactivate if not provided
        if (typeof module.onDeactivate !== 'function') {
            module.onDeactivate = function() {
                console.log(`👋 Module "${moduleName}" deactivated`);
            };
        }

        return module;
    }

    /**
     * Render a module into the container with lifecycle management
     */
    async renderModule(moduleName, targetElement = null) {
        const container = targetElement || this.container;
        if (!container) {
            console.error('No container element found');
            return;
        }

        try {
            // Deactivate current module if it exists and is different
            if (this.currentModule && this.currentModule !== moduleName) {
                const currentMod = this.modules.get(this.currentModule);
                if (currentMod && typeof currentMod.onDeactivate === 'function') {
                    await currentMod.onDeactivate();
                }
            }

            // Load the module
            const module = await this.loadModule(moduleName);
            
            // Store container reference
            module._container = container;
            
            // Clear container
            setHtml(container, '');
            
            // Render module
            if (typeof module.render === 'function') {
                await module.render(container);
                module._lastRender = Date.now();
            } else {
                setHtml(container, `
                    <h2>${moduleName}</h2>
                    <p>Module has no render function.</p>
                `);
            }
            
            // Activate the module
            if (typeof module.onActivate === 'function') {
                await module.onActivate();
            }
            
            // Update current module
            this.currentModule = moduleName;
            
            return module;
        } catch (error) {
            console.error(`Failed to render module "${moduleName}":`, error);
            setHtml(container, `
                <div class="error" style="padding:2rem;text-align:center;background:var(--bg2);border-radius:var(--radius);border-left:4px solid var(--danger);">
                    <h2 style="color:var(--danger);margin-bottom:0.5rem;">Error loading module</h2>
                    <p style="color:var(--text2);">${error.message}</p>
                    <p style="color:var(--text3);font-size:0.85rem;margin-top:0.5rem;">Module: ${moduleName}</p>
                    <button class="btn btn-primary" onclick="window.moduleLoader?.retryModule('${moduleName}')" style="margin-top:1rem;">
                        🔄 Retry
                    </button>
                </div>
            `);
        }
    }

    /**
     * Retry loading a failed module
     */
    async retryModule(moduleName) {
        this.unloadModule(moduleName);
        return this.renderModule(moduleName);
    }

    /**
     * Refresh the current module
     */
    async refreshCurrentModule() {
        if (!this.currentModule) {
            console.warn('No module currently loaded to refresh');
            return;
        }
        
        const module = this.modules.get(this.currentModule);
        if (!module) {
            console.warn(`Module "${this.currentModule}" not found`);
            return;
        }
        
        console.log(`🔄 Refreshing current module: "${this.currentModule}"`);
        
        if (typeof module.refresh === 'function') {
            await module.refresh();
        } else if (typeof module.onActivate === 'function') {
            await module.onActivate();
        } else if (typeof module.render === 'function' && module._container) {
            await module.render(module._container);
        }
        
        module._lastRender = Date.now();
    }

    /**
     * Refresh a specific module by name
     */
    async refreshModule(moduleName) {
        const module = this.modules.get(moduleName);
        if (!module) {
            console.warn(`Module "${moduleName}" not found`);
            return;
        }
        
        console.log(`🔄 Refreshing module: "${moduleName}"`);
        
        if (typeof module.refresh === 'function') {
            await module.refresh();
        } else if (typeof module.onActivate === 'function') {
            await module.onActivate();
        } else if (typeof module.render === 'function' && module._container) {
            await module.render(module._container);
        }
        
        module._lastRender = Date.now();
    }

    /**
     * Unload a module
     */
    unloadModule(moduleName) {
        const module = this.modules.get(moduleName);
        if (module) {
            if (typeof module.onDeactivate === 'function') {
                module.onDeactivate();
            }
            if (typeof module.destroy === 'function') {
                module.destroy();
            }
            delete module._container;
        }
        this.modules.delete(moduleName);
        if (this.currentModule === moduleName) {
            this.currentModule = null;
        }
        console.log(`🗑️ Module "${moduleName}" unloaded`);
    }

    /**
     * Get loaded module
     */
    getModule(moduleName) {
        return this.modules.get(moduleName);
    }

    /**
     * Check if module is loaded
     */
    isLoaded(moduleName) {
        return this.modules.has(moduleName);
    }

    /**
     * Get current module name
     */
    getCurrentModule() {
        return this.currentModule;
    }

    /**
     * Get list of all available modules
     */
    getAvailableModules() {
        return Object.keys(this.modulePaths);
    }

    /**
     * Check if a module needs refresh (based on TTL)
     */
    needsRefresh(moduleName, ttl = 30000) {
        const module = this.modules.get(moduleName);
        if (!module) return false;
        const now = Date.now();
        const lastRender = module._lastRender || 0;
        return (now - lastRender) > ttl;
    }

    /**
     * Preload a module without rendering
     */
    async preloadModule(moduleName) {
        if (this.isLoaded(moduleName)) {
            return this.getModule(moduleName);
        }
        console.log(`📦 Preloading module "${moduleName}"`);
        return this.loadModule(moduleName);
    }

    /**
     * Preload multiple modules
     */
    async preloadModules(moduleNames) {
        const promises = moduleNames.map(name => this.preloadModule(name));
        return Promise.allSettled(promises);
    }

    /**
     * Clear all loaded modules
     */
    clearAll() {
        for (const [name, module] of this.modules) {
            if (typeof module.destroy === 'function') {
                module.destroy();
            }
        }
        this.modules.clear();
        this.currentModule = null;
        console.log('🧹 All modules cleared');
    }

    /**
     * Get module statistics
     */
    getStats() {
        return {
            loadedModules: this.modules.size,
            loadingModules: this.loading.size,
            currentModule: this.currentModule,
            moduleNames: Array.from(this.modules.keys()),
            availableModules: this.getAvailableModules()
        };
    }
}

// Create and export singleton - ONLY ONE DEFAULT EXPORT
export const moduleLoader = new ModuleLoader();

// Add global helper for retry
if (typeof window !== 'undefined') {
    window.moduleLoader = moduleLoader;
}

// Single default export
export default moduleLoader;