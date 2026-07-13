// ttrpg/utilities/javascript/client/js/document-loader.js

import { getFeatureFlags, isFeatureEnabled, shouldBuildDocs } from './feature-flags.js';

/**
 * Document Loader - Dynamically loads documents based on availability
 * Supports loading from multiple sources including packs
 */
class DocumentLoader {
  constructor() {
    this.documents = [];
    this.isLoaded = false;
    this.loading = false;
    this.manifest = null;
    this.searchIndex = null;
    this.packManifests = new Map();
    this.loadedPacks = new Set();
    this.documentCache = new Map();
  }

  /**
   * Load documents based on current context
   */
  async loadDocuments(options = {}) {
    if (this.isLoaded && !options.force) {
      return this.documents;
    }

    if (this.loading) {
      return new Promise((resolve) => {
        const checkLoaded = setInterval(() => {
          if (!this.loading) {
            clearInterval(checkLoaded);
            resolve(this.documents);
          }
        }, 100);
      });
    }

    this.loading = true;
    
    try {
      // Determine what to load
      const flags = getFeatureFlags();
      const shouldLoadDocs = options.force || flags.USE_DOCS || flags.USE_SRD || shouldBuildDocs();
      
      if (shouldLoadDocs) {
        // Load from multiple sources
        await this.loadFromManifest('/manifest-full.json');
        await this.loadFromManifest('/manifest-core.json');
        
        // Try to load pack manifests
        await this.loadPackManifests();
        
        // Load search index
        await this.loadSearchIndex();
        
        // Load document files if not already loaded
        if (this.documents.length === 0) {
          await this.loadDocumentFiles();
        }
      } else {
        console.log('📄 Docs loading disabled by feature flags');
        this.loadMinimalDocs();
      }
      
      this.isLoaded = true;
      return this.documents;
      
    } catch (e) {
      console.warn('Failed to load documents:', e);
      // Fall back to minimal docs
      this.loadMinimalDocs();
      return this.documents;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load from a manifest file
   */
  async loadFromManifest(manifestPath) {
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) {
        console.warn(`⚠️ ${manifestPath} not found`);
        return;
      }
      
      const data = await response.json();
      const manifest = data.documents || data;
      
      if (!Array.isArray(manifest) || manifest.length === 0) {
        console.warn(`⚠️ No documents in ${manifestPath}`);
        return;
      }
      
      console.log(`📄 Loaded manifest from ${manifestPath} with ${manifest.length} entries`);
      
      // Process manifest entries
      for (const entry of manifest) {
        // Skip if already loaded
        if (this.documentCache.has(entry.path || entry.file)) {
          continue;
        }
        
        // Normalize entry
        const doc = this.normalizeDocumentEntry(entry);
        this.documents.push(doc);
        this.documentCache.set(doc.path || doc.file, doc);
      }
      
      // Store manifest reference
      if (!this.manifest) {
        this.manifest = manifest;
      } else {
        this.manifest = [...this.manifest, ...manifest];
      }
      
      console.log(`📚 Total documents: ${this.documents.length}`);
      
    } catch (e) {
      console.warn(`⚠️ Failed to load ${manifestPath}:`, e);
    }
  }

  /**
   * Load pack manifests from packs directory
   */
  async loadPackManifests() {
    try {
      // Check for packs manifest
      const response = await fetch('/packs/manifest.json');
      if (!response.ok) {
        console.log('📦 No pack manifest found');
        return;
      }
      
      const packManifest = await response.json();
      const packs = packManifest.packs || [];
      
      console.log(`📦 Found ${packs.length} pack(s)`);
      
      for (const pack of packs) {
        await this.loadPack(pack);
      }
      
    } catch (e) {
      console.warn('⚠️ Failed to load pack manifests:', e);
    }
  }

  /**
   * Load a specific pack
   */
  async loadPack(pack) {
    const packKey = pack.id || pack.name;
    
    if (this.loadedPacks.has(packKey)) {
      return this.packManifests.get(packKey);
    }
    
    try {
      const packPath = pack.manifest || `/packs/${packKey}/manifest.json`;
      const response = await fetch(packPath);
      
      if (!response.ok) {
        console.warn(`⚠️ Pack manifest not found: ${packPath}`);
        return null;
      }
      
      const manifest = await response.json();
      const documents = manifest.documents || [];
      
      console.log(`📦 Loading pack "${pack.name}" with ${documents.length} document(s)`);
      
      // Process pack documents
      for (const entry of documents) {
        // Add pack context
        const doc = this.normalizeDocumentEntry({
          ...entry,
          pack: pack.name,
          packId: packKey,
          source: 'pack',
        });
        
        // Check if already loaded
        if (!this.documentCache.has(doc.path || doc.file)) {
          this.documents.push(doc);
          this.documentCache.set(doc.path || doc.file, doc);
        }
      }
      
      this.packManifests.set(packKey, manifest);
      this.loadedPacks.add(packKey);
      
      return manifest;
      
    } catch (e) {
      console.warn(`⚠️ Failed to load pack ${packKey}:`, e);
      return null;
    }
  }

  /**
   * Normalize a document entry
   */
  normalizeDocumentEntry(entry) {
    const path = entry.path || entry.file || '';
    const file = entry.file || path.split('/').pop() || '';
    const title = entry.title || file.replace(/\.html$/, '').replace(/_/g, ' ') || 'Untitled';
    const category = entry.category || 'other';
    
    return {
      ...entry,
      id: entry.id || file.replace(/\.html$/, ''),
      title: title,
      file: file,
      path: path || `/docs/${file}`,
      category: category,
      categoryLabel: entry.categoryLabel || this.getCategoryLabel(category),
      categoryClass: entry.categoryClass || category,
      core: entry.core || false,
      active: entry.active !== undefined ? entry.active : true,
      source: entry.source || 'manifest',
      loaded: false,
      content: entry.content || null,
    };
  }

  /**
   * Get category label
   */
  getCategoryLabel(category) {
    const labels = {
      'srd': 'System Reference Document',
      'core': 'Core Rules',
      'essentials': 'Essentials',
      'adventure': 'Adventures',
      'travel': 'Travel & Regions',
      'expansion': 'Expansions',
      'resource': 'Resources',
      'lore': 'Lore & History',
      'magic': 'Magic & Talents',
      'character': 'Character Options',
      'gm': 'GM Guide',
      'player': 'Player Guide',
      'bestiary': 'Bestiary',
      'region': 'Regions',
      'generator': 'Generators',
      'decks': 'Decks',
      'other': 'Other',
    };
    return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * Load search index
   */
  async loadSearchIndex() {
    try {
      const response = await fetch('/search-index.json');
      if (response.ok) {
        this.searchIndex = await response.json();
        console.log(`🔍 Loaded search index with ${this.searchIndex.length} entries`);
      } else {
        // Try alternative paths
        const altPaths = ['/data/search-index.json', '/docs/search-index.json'];
        for (const altPath of altPaths) {
          const altResponse = await fetch(altPath);
          if (altResponse.ok) {
            this.searchIndex = await altResponse.json();
            console.log(`🔍 Loaded search index from ${altPath} with ${this.searchIndex.length} entries`);
            break;
          }
        }
        
        if (!this.searchIndex) {
          console.warn('⚠️ search_index.json not found');
          this.searchIndex = [];
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to load search index:', e);
      this.searchIndex = [];
    }
  }

  /**
   * Load individual document files
   */
  async loadDocumentFiles() {
    if (!this.documents || this.documents.length === 0) {
      return;
    }

    // Only load documents that aren't already loaded
    const toLoad = this.documents.filter(doc => !doc.loaded && doc.active !== false);
    
    if (toLoad.length === 0) {
      console.log('📄 All documents already loaded');
      return;
    }

    console.log(`📄 Loading ${toLoad.length} document(s)...`);
    
    // Load in batches to avoid overwhelming the network
    const batchSize = 5;
    const batches = [];
    
    for (let i = 0; i < toLoad.length; i += batchSize) {
      batches.push(toLoad.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const loadPromises = batch.map(async (doc) => {
        try {
          const path = doc.path || `/docs/${doc.file}`;
          const response = await fetch(path);
          
          if (response.ok) {
            const content = await response.text();
            doc.content = content;
            doc.loaded = true;
            this.documentCache.set(doc.path || doc.file, doc);
            return doc;
          } else {
            console.warn(`⚠️ Failed to load ${path}: HTTP ${response.status}`);
            doc.loaded = false;
            return null;
          }
        } catch (e) {
          console.warn(`⚠️ Failed to load ${doc.file}:`, e);
          doc.loaded = false;
          return null;
        }
      });
      
      await Promise.allSettled(loadPromises);
    }
    
    const loadedCount = this.documents.filter(d => d.loaded).length;
    console.log(`📄 Loaded ${loadedCount} documents`);
  }

  /**
   * Load minimal docs for testing
   */
  loadMinimalDocs() {
    // Create minimal sample documents for testing
    this.documents = [
      {
        id: 'sample',
        file: 'sample.html',
        path: '/docs/sample.html',
        title: 'Sample Document',
        category: 'test',
        categoryLabel: 'Test Documents',
        content: '<p>This is a sample document for testing.</p>',
        loaded: true,
        source: 'minimal',
      }
    ];
    
    this.manifest = this.documents.map(doc => ({
      file: doc.file,
      title: doc.title,
      category: doc.category,
      categoryLabel: doc.categoryLabel,
    }));
    
    this.searchIndex = this.documents.map(doc => ({
      title: doc.title,
      content: doc.content.replace(/<[^>]+>/g, ' ').slice(0, 500),
      url: doc.path,
      type: 'sample',
    }));
    
    this.documentCache.set('sample.html', this.documents[0]);
    
    console.log('📄 Loaded minimal documents for testing');
  }

  /**
   * Get a specific document
   */
  getDocument(fileName) {
    // Try cache first
    if (this.documentCache.has(fileName)) {
      return this.documentCache.get(fileName);
    }
    
    // Search by file or path
    const doc = this.documents.find(d => 
      d.file === fileName || 
      d.path === fileName || 
      d.path?.endsWith(fileName) ||
      d.id === fileName
    );
    
    if (doc) {
      this.documentCache.set(fileName, doc);
    }
    
    return doc || null;
  }

  /**
   * Get documents by category
   */
  getDocumentsByCategory(category) {
    return this.documents.filter(d => d.category === category && d.active !== false);
  }

  /**
   * Get active documents
   */
  getActiveDocuments() {
    return this.documents.filter(d => d.active !== false);
  }

  /**
   * Get core documents
   */
  getCoreDocuments() {
    return this.documents.filter(d => d.core === true && d.active !== false);
  }

  /**
   * Get documents from a specific pack
   */
  getDocumentsFromPack(packId) {
    return this.documents.filter(d => d.packId === packId && d.active !== false);
  }

  /**
   * Search documents
   */
  search(query, options = {}) {
    if (!this.searchIndex || this.searchIndex.length === 0) {
      return [];
    }
    
    const results = [];
    const q = query.toLowerCase();
    const { limit = 20, categories = [] } = options;
    
    for (const item of this.searchIndex) {
      // Filter by category if specified
      if (categories.length > 0 && item.category && !categories.includes(item.category)) {
        continue;
      }
      
      const titleMatch = item.title?.toLowerCase().includes(q);
      const contentMatch = item.content?.toLowerCase().includes(q);
      const tagsMatch = item.tags?.some(tag => tag.toLowerCase().includes(q));
      
      if (titleMatch || contentMatch || tagsMatch) {
        results.push({
          ...item,
          score: this.calculateScore(item, q),
          matchedOn: {
            title: titleMatch,
            content: contentMatch,
            tags: tagsMatch,
          },
        });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Calculate relevance score
   */
  calculateScore(item, query) {
    let score = 0;
    const q = query.toLowerCase();
    const title = (item.title || '').toLowerCase();
    const content = (item.content || '').toLowerCase();
    const tags = (item.tags || []).map(t => t.toLowerCase());
    
    // Title matches are weighted highest
    if (title.includes(q)) {
      score += 0.8;
      if (title.startsWith(q)) {
        score += 0.2;
      }
      // Exact title match
      if (title === q) {
        score += 0.5;
      }
    }
    
    // Tag matches
    for (const tag of tags) {
      if (tag.includes(q)) {
        score += 0.4;
        if (tag === q) {
          score += 0.3;
        }
        break;
      }
    }
    
    // Content matches
    if (content.includes(q)) {
      score += 0.2;
      // More matches = higher score
      const matches = (content.match(new RegExp(q, 'g')) || []).length;
      score += Math.min(matches * 0.03, 0.2);
    }
    
    return Math.min(score, 1);
  }

  /**
   * Get manifest
   */
  getManifest() {
    return this.manifest || [];
  }

  /**
   * Get search index
   */
  getSearchIndex() {
    return this.searchIndex || [];
  }

  /**
   * Get loaded packs
   */
  getLoadedPacks() {
    return Array.from(this.loadedPacks);
  }

  /**
   * Get pack manifest
   */
  getPackManifest(packId) {
    return this.packManifests.get(packId) || null;
  }

  /**
   * Check if docs are available
   */
  isDocsAvailable() {
    return this.isLoaded && this.documents.length > 0;
  }

  /**
   * Get document count
   */
  getDocumentCount() {
    return this.documents.filter(d => d.active !== false).length;
  }

  /**
   * Get loaded document count
   */
  getLoadedDocumentCount() {
    return this.documents.filter(d => d.loaded).length;
  }

  /**
   * Clear cache
   */
  clearCache(keepMinimal = true) {
    this.documentCache.clear();
    this.packManifests.clear();
    this.loadedPacks.clear();
    
    if (keepMinimal) {
      // Keep minimal documents for testing
      const minimalDocs = this.documents.filter(d => d.source === 'minimal');
      this.documents = minimalDocs;
      minimalDocs.forEach(d => {
        this.documentCache.set(d.file, d);
      });
    } else {
      this.documents = [];
      this.manifest = null;
      this.searchIndex = null;
      this.isLoaded = false;
    }
    
    console.log('🧹 Document cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      totalDocuments: this.documents.length,
      loadedDocuments: this.getLoadedDocumentCount(),
      activeDocuments: this.getDocumentCount(),
      cachedDocuments: this.documentCache.size,
      loadedPacks: this.loadedPacks.size,
      hasManifest: !!this.manifest,
      hasSearchIndex: !!this.searchIndex,
      isLoaded: this.isLoaded,
    };
  }
}

// Singleton instance
export const documentLoader = new DocumentLoader();

// Helper to check if documents are available
export async function checkDocumentsAvailable() {
  try {
    const response = await fetch('/manifest-full.json');
    if (!response.ok) return false;
    const data = await response.json();
    const docs = data.documents || data;
    return Array.isArray(docs) && docs.length > 0;
  } catch {
    return false;
  }
}

// Helper to list available documents
export async function listAvailableDocuments() {
  try {
    const response = await fetch('/manifest-full.json');
    if (!response.ok) return [];
    const data = await response.json();
    const docs = data.documents || data;
    return Array.isArray(docs) ? docs : [];
  } catch {
    return [];
  }
}

export default documentLoader;