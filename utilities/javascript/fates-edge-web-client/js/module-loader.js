// js/module-loader.js - Robust module loader (integrated with router)

import { setHtml } from './core/utils.js';

class ModuleLoader {
    constructor() {
        this.modules = new Map();           // loaded modules
        this.loading = new Map();           // in-progress loads
        this.importFns = new Map();         // route name -> import function
        this.container = document.getElementById('app-content');
        this.currentModule = null;
    }

    /**
     * Register a route with its import function
     */
    registerRoute(name, importFn) {
        if (typeof importFn !== 'function') {
            throw new Error(`Import function for route "${name}" must be a function`);
        }
        this.importFns.set(name, importFn);
        console.log(`📌 ModuleLoader: registered route "${name}"`);
    }

    /**
     * Load a module by name (returns the module object)
     */
    async loadModule(moduleName) {
        // Check cache
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
     * Internal load: gets import function, calls it, and normalises the module
     */
    async _doLoadModule(moduleName) {
        const importFn = this.importFns.get(moduleName);
        if (!importFn) {
            throw new Error(`No import function registered for module "${moduleName}"`);
        }

        console.log(`🔍 Loading module "${moduleName}" via dynamic import`);

        // Dynamic import
        let module = await importFn();

        // Normalise: if module has a default export that is an object with render, use that
        if (module && typeof module.default === 'object' && module.default !== null) {
            // If default has render, treat it as the main module
            if (typeof module.default.render === 'function') {
                module = module.default;
            } else {
                // Merge default with named exports (fallback)
                module = { ...module.default, ...module };
            }
        }

        // Ensure module has a render function
        if (typeof module.render !== 'function') {
            console.warn(`⚠️ Module "${moduleName}" has no render function. Available exports:`, Object.keys(module));

            // Try alternative entry points
            if (typeof module.init === 'function') {
                console.log(`🔄 Using init() as fallback for "${moduleName}"`);
                module.render = module.init;
            } else if (module.default && typeof module.default.render === 'function') {
                module.render = module.default.render;
            } else if (typeof module.load === 'function') {
                module.render = module.load;
            } else if (typeof module === 'function') {
                module.render = module;
            } else {
                // Create a placeholder render
                module.render = (el) => {
                    setHtml(el, `
                        <div class="panel">
                            <h3>📄 ${moduleName}</h3>
                            <p class="text-muted">Module loaded but no render function found.</p>
                            <p class="text-muted small" style="font-size:0.8rem;color:var(--text3);">Please check exports.</p>
                        </div>
                    `);
                };
            }
        }

        // Add default lifecycle methods if missing
        module._moduleName = moduleName;
        module._lastRender = 0;
        module._refreshInterval = 30000; // 30s

        if (typeof module.refresh !== 'function') {
            module.refresh = async function() {
                console.log(`🔄 Refreshing module "${moduleName}"`);
                if (this.onActivate) await this.onActivate();
                if (this.render && this._container) {
                    const container = this._container;
                    const scrollPos = container.scrollTop;
                    await this.render(container);
                    if (scrollPos > 0) container.scrollTop = scrollPos;
                }
            };
        }

        if (typeof module.onActivate !== 'function') {
            module.onActivate = async function() {
                console.log(`👋 Module "${moduleName}" activated`);
                if (this.refresh) await this.refresh();
            };
        }

        if (typeof module.onDeactivate !== 'function') {
            module.onDeactivate = function() {
                console.log(`👋 Module "${moduleName}" deactivated`);
            };
        }

        return module;
    }

    /**
     * Render a module into a container (handles deactivation/activation)
     */
    async renderModule(moduleName, targetElement = null) {
        const container = targetElement || this.container;
        if (!container) {
            console.error('No container element found for rendering');
            return;
        }

        try {
            // Deactivate current module if different
            if (this.currentModule && this.currentModule !== moduleName) {
                const currentMod = this.modules.get(this.currentModule);
                if (currentMod && typeof currentMod.onDeactivate === 'function') {
                    await currentMod.onDeactivate();
                }
            }

            // Load (or retrieve) the module
            const module = await this.loadModule(moduleName);

            // Store container reference
            module._container = container;

            // Clear container and render
            setHtml(container, '');
            if (typeof module.render === 'function') {
                await module.render(container);
                module._lastRender = Date.now();
            } else {
                setHtml(container, `
                    <div class="panel">
                        <h3>⚠️ Error</h3>
                        <p class="text-muted">Module "${moduleName}" has no render function.</p>
                    </div>
                `);
            }

            // Activate the new module
            if (typeof module.onActivate === 'function') {
                await module.onActivate();
            }

            this.currentModule = moduleName;
            return module;
        } catch (error) {
            console.error(`Failed to render module "${moduleName}":`, error);
            setHtml(container, `
                <div class="panel" style="border-left:4px solid var(--danger);">
                    <h3 style="color:var(--danger);">❌ Error loading module</h3>
                    <p class="text-muted">${error.message || 'Unknown error'}</p>
                    <pre style="font-size:0.7rem;background:var(--bg3);padding:0.5rem;overflow:auto;max-height:150px;">${error.stack || ''}</pre>
                    <button class="btn btn-primary mt-1" onclick="window.moduleLoader?.retryModule('${moduleName}')">
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
     * Unload a module (cleanup)
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
     * Preload a module without rendering
     */
    async preloadModule(moduleName) {
        if (this.isLoaded(moduleName)) return this.getModule(moduleName);
        console.log(`📦 Preloading module "${moduleName}"`);
        return this.loadModule(moduleName);
    }

    /**
     * Preload multiple modules
     */
    async preloadModules(moduleNames) {
        return Promise.allSettled(moduleNames.map(name => this.preloadModule(name)));
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
     * Clear all loaded modules
     */
    clearAll() {
        for (const [name, module] of this.modules) {
            if (typeof module.destroy === 'function') module.destroy();
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
            registeredRoutes: Array.from(this.importFns.keys()),
        };
    }
}

// Create and export singleton
export const moduleLoader = new ModuleLoader();

// Global helper for retry
if (typeof window !== 'undefined') {
    window.moduleLoader = moduleLoader;
}

export default moduleLoader;