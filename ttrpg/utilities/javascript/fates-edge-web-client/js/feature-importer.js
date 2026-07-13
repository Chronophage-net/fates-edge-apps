// ttrpg/utilities/javascript/client/js/feature-importer.js

import { getFeatureFlags, isFeatureEnabled } from './feature-flags.js';
import { documentLoader } from './document-loader.js';

/**
 * Feature Importer - Dynamically imports modules based on feature flags
 * Supports loading of feature packs (regions, decks, patrons) from external sources
 */
class FeatureImporter {
  constructor() {
    this.loadedModules = new Map();
    this.loadingModules = new Set();
    this.moduleCache = new Map();
    this.packCache = new Map();
    this.loadedPacks = new Set();
    this.importPaths = {
      core: '/js/modules/',
      features: '/js/features/',
      packs: '/packs/',
      regions: '/regions/',
      patrons: '/patrons/',
    };
  }

  /**
   * Initialize features based on flags
   */
  async initializeFeatures() {
    const flags = getFeatureFlags();
    console.log('🚀 Initializing features:', flags);
    
    // Load core modules always
    await this.loadCoreModules();
    
    // Load advanced features conditionally
    await this.loadAdvancedModules();
    
    // Load decks module
    if (isFeatureEnabled('decks')) {
      await this.loadFeatureModule('decks');
    }
    
    // Load region data if decks is enabled
    if (isFeatureEnabled('decks')) {
      await this.loadRegionData();
    }
    
    // Load experimental features if enabled
    if (flags.SHOW_EXPERIMENTAL) {
      await this.loadExperimentalModules();
    }
    
    // Load documents if needed
    if (flags.USE_DOCS || flags.USE_SRD) {
      await documentLoader.loadDocuments();
    }
    
    console.log('✅ Features initialized');
  }

  /**
   * Load core modules
   */
  async loadCoreModules() {
    const coreModules = [
      'characters',
      'timers', 
      'wiki',
      'encounters',
      'npcs',
      'chat',
      'rolls',
    ];
    
    for (const module of coreModules) {
      if (isFeatureEnabled(module)) {
        await this.loadModule(`../modules/${module}.js`);
      }
    }
  }

  /**
   * Load advanced modules
   */
  async loadAdvancedModules() {
    const advancedModules = [
      'search',
      'sync',
      'presence',
      'vtt',
      'dashboard',
      'builder',
    ];
    
    for (const module of advancedModules) {
      if (isFeatureEnabled(module)) {
        await this.loadModule(`../modules/${module}.js`);
      }
    }
  }

  /**
   * Load a feature module (from features directory)
   */
  async loadFeatureModule(moduleName) {
    try {
      // Check if already loaded
      if (this.moduleCache.has(`feature:${moduleName}`)) {
        return this.moduleCache.get(`feature:${moduleName}`);
      }
      
      const module = await import(`../features/${moduleName}/index.js`);
      this.moduleCache.set(`feature:${moduleName}`, module);
      console.log(`✅ Loaded feature module: ${moduleName}`);
      return module;
    } catch (e) {
      console.warn(`⚠️ Failed to load feature module: ${moduleName}`, e);
      return null;
    }
  }

  /**
   * Load region data from packs
   */
  async loadRegionData() {
    try {
      // Check if region data is already loaded
      if (this.loadedPacks.has('regions')) {
        return this.packCache.get('regions');
      }
      
      // Load region manifest
      const response = await fetch('/regions/manifest.json');
      if (!response.ok) {
        console.warn('⚠️ No region manifest found');
        return null;
      }
      
      const manifest = await response.json();
      
      // Load each region's data
      const regions = [];
      for (const entry of manifest) {
        const regionName = typeof entry === 'string' ? entry : entry.name;
        const slug = typeof entry === 'string' ? entry.toLowerCase().replace(/ /g, '_') : entry.slug;
        
        try {
          const regionData = await this.loadRegionPack(slug);
          if (regionData) {
            regions.push(regionData);
          }
        } catch (e) {
          console.warn(`⚠️ Failed to load region: ${regionName}`, e);
        }
      }
      
      this.packCache.set('regions', regions);
      this.loadedPacks.add('regions');
      console.log(`✅ Loaded ${regions.length} regions`);
      return regions;
      
    } catch (e) {
      console.warn('⚠️ Failed to load region data:', e);
      return null;
    }
  }

  /**
   * Load a single region pack
   */
  async loadRegionPack(slug) {
    try {
      const response = await fetch(`/regions/${slug}.json`);
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    } catch (e) {
      console.warn(`⚠️ Failed to load region pack: ${slug}`, e);
      return null;
    }
  }

  /**
   * Load an external pack (region, deck, or patron)
   * @param {string} packType - 'regions', 'decks', or 'patrons'
   * @param {string} packName - Name of the pack to load
   * @param {string} source - URL or path to load from
   */
  async loadExternalPack(packType, packName, source = null) {
    const packKey = `${packType}:${packName}`;
    
    // Check if already loaded
    if (this.packCache.has(packKey)) {
      return this.packCache.get(packKey);
    }
    
    // Check if already loading
    if (this.loadingModules.has(packKey)) {
      return new Promise((resolve) => {
        const checkLoaded = setInterval(() => {
          if (!this.loadingModules.has(packKey)) {
            clearInterval(checkLoaded);
            resolve(this.packCache.get(packKey));
          }
        }, 100);
      });
    }
    
    this.loadingModules.add(packKey);
    
    try {
      let data = null;
      
      if (source) {
        // Load from custom source
        data = await this.loadFromSource(source);
      } else {
        // Load from default location
        data = await this.loadFromDefaultLocation(packType, packName);
      }
      
      if (data) {
        this.packCache.set(packKey, data);
        this.loadedPacks.add(packKey);
        console.log(`✅ Loaded ${packType} pack: ${packName}`);
        return data;
      } else {
        console.warn(`⚠️ Failed to load ${packType} pack: ${packName}`);
        return null;
      }
      
    } catch (e) {
      console.error(`❌ Error loading pack ${packName}:`, e);
      return null;
    } finally {
      this.loadingModules.delete(packKey);
    }
  }

  /**
   * Load from a custom source (URL or file path)
   */
  async loadFromSource(source) {
    try {
      // Check if it's a URL or local path
      if (source.startsWith('http://') || source.startsWith('https://')) {
        const response = await fetch(source);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } else {
        // Local path
        const response = await fetch(source);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      }
    } catch (e) {
      console.warn(`⚠️ Failed to load from source: ${source}`, e);
      return null;
    }
  }

  /**
   * Load from default location based on pack type
   */
  async loadFromDefaultLocation(packType, packName) {
    const path = this.importPaths[packType] || '/packs/';
    const filename = packName.toLowerCase().replace(/ /g, '_');
    const response = await fetch(`${path}${filename}.json`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Load multiple packs at once
   */
  async loadPacks(packs) {
    const results = [];
    for (const pack of packs) {
      const result = await this.loadExternalPack(pack.type, pack.name, pack.source);
      results.push(result);
    }
    return results;
  }

  /**
   * Register a custom pack source
   */
  registerPackSource(packType, sourcePath) {
    this.importPaths[packType] = sourcePath;
    console.log(`📦 Registered pack source: ${packType} -> ${sourcePath}`);
  }

  /**
   * Load a single module
   */
  async loadModule(modulePath) {
    // Check cache
    if (this.moduleCache.has(modulePath)) {
      return this.moduleCache.get(modulePath);
    }
    
    // Prevent duplicate loading
    if (this.loadingModules.has(modulePath)) {
      return new Promise((resolve) => {
        const checkLoaded = setInterval(() => {
          if (!this.loadingModules.has(modulePath)) {
            clearInterval(checkLoaded);
            resolve(this.moduleCache.get(modulePath));
          }
        }, 100);
      });
    }
    
    this.loadingModules.add(modulePath);
    
    try {
      // Dynamic import
      const module = await import(modulePath);
      
      // Cache the module
      this.moduleCache.set(modulePath, module);
      console.log(`✅ Loaded module: ${modulePath}`);
      
      return module;
      
    } catch (e) {
      console.warn(`⚠️ Failed to load module: ${modulePath}`, e);
      return null;
    } finally {
      this.loadingModules.delete(modulePath);
    }
  }

  /**
   * Get a loaded module
   */
  getModule(moduleName) {
    const modulePath = `../modules/${moduleName}.js`;
    return this.moduleCache.get(modulePath) || null;
  }

  /**
   * Get a loaded feature module
   */
  getFeatureModule(moduleName) {
    return this.moduleCache.get(`feature:${moduleName}`) || null;
  }

  /**
   * Get a loaded pack
   */
  getPack(packType, packName) {
    const packKey = `${packType}:${packName}`;
    return this.packCache.get(packKey) || null;
  }

  /**
   * Get all loaded packs of a specific type
   */
  getPacks(packType) {
    const results = [];
    for (const [key, value] of this.packCache) {
      if (key.startsWith(`${packType}:`)) {
        results.push({ key, data: value });
      }
    }
    return results;
  }

  /**
   * Check if module is loaded
   */
  isModuleLoaded(moduleName) {
    const modulePath = `../modules/${moduleName}.js`;
    return this.moduleCache.has(modulePath);
  }

  /**
   * Check if feature module is loaded
   */
  isFeatureLoaded(moduleName) {
    return this.moduleCache.has(`feature:${moduleName}`);
  }

  /**
   * Check if pack is loaded
   */
  isPackLoaded(packType, packName) {
    const packKey = `${packType}:${packName}`;
    return this.packCache.has(packKey);
  }

  /**
   * Experimental modules
   */
  async loadExperimentalModules() {
    if (!isFeatureEnabled('experimental')) {
      return;
    }
    
    console.log('🧪 Loading experimental features');
    
    try {
      // Example experimental features
      // await this.loadModule('../experimental/ai-assistant.js');
      // await this.loadModule('../experimental/voice-chat.js');
    } catch (e) {
      console.warn('Failed to load experimental modules:', e);
    }
  }

  /**
   * Clear cache for a specific module or pack
   */
  clearCache(key) {
    if (this.moduleCache.has(key)) {
      this.moduleCache.delete(key);
      console.log(`🧹 Cleared cache: ${key}`);
    }
    if (this.packCache.has(key)) {
      this.packCache.delete(key);
      this.loadedPacks.delete(key);
      console.log(`🧹 Cleared pack cache: ${key}`);
    }
  }

  /**
   * Clear all caches
   */
  clearAllCache() {
    this.moduleCache.clear();
    this.packCache.clear();
    this.loadedPacks.clear();
    console.log('🧹 Cleared all caches');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      modules: this.moduleCache.size,
      packs: this.packCache.size,
      loading: this.loadingModules.size,
      loadedPacks: Array.from(this.loadedPacks),
      moduleNames: Array.from(this.moduleCache.keys()),
      packNames: Array.from(this.packCache.keys()),
    };
  }
}

// Singleton instance
export const featureImporter = new FeatureImporter();

// Helper function to check if packs are available
export async function checkPacksAvailable() {
  try {
    const response = await fetch('/packs/manifest.json');
    if (!response.ok) return false;
    const manifest = await response.json();
    return manifest.packs && manifest.packs.length > 0;
  } catch {
    return false;
  }
}

// Helper function to list available packs
export async function listAvailablePacks() {
  try {
    const response = await fetch('/packs/manifest.json');
    if (!response.ok) return [];
    const manifest = await response.json();
    return manifest.packs || [];
  } catch {
    return [];
  }
}

export default featureImporter;