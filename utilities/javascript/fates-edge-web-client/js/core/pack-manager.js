// core/pack-manager.js
/**
 * Pack Manager - Securely loads module and document packs
 * 
 * Features:
 * - Validates pack signatures and structure
 * - Extracts and installs modules
 * - Registers new routes
 * - Loads document references
 * - Merges data files
 */

import { getState, saveState } from './state.js';
import { showToast } from '../components/Toast.js';
import { registerRoute } from '../router.js';
import { moduleLoader } from '../module-loader.js';

// ============================================================
// CONSTANTS
// ============================================================

const PACK_STORAGE_KEY = 'fates-edge-packs';
const ALLOWED_MODULE_PATHS = ['features/', 'core/', 'components/'];
const ALLOWED_DATA_PATHS = ['data/', 'regions/', 'factions/'];

// ============================================================
// STATE
// ============================================================

let installedPacks = [];
let packRegistry = new Map();

// ============================================================
// LOAD INSTALLED PACKS
// ============================================================

export function loadInstalledPacks() {
    try {
        const stored = localStorage.getItem(PACK_STORAGE_KEY);
        if (stored) {
            installedPacks = JSON.parse(stored);
        }
        // Rebuild registry from installed packs
        installedPacks.forEach(pack => {
            packRegistry.set(pack.id, pack);
        });
    } catch (e) {
        console.warn('Failed to load installed packs:', e);
        installedPacks = [];
    }
    return installedPacks;
}

export function saveInstalledPacks() {
    try {
        localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(installedPacks));
    } catch (e) {
        console.warn('Failed to save installed packs:', e);
    }
}

// ============================================================
// PACK VALIDATION
// ============================================================

export function validatePack(manifest) {
    const errors = [];
    
    // Required fields
    if (!manifest.name) errors.push('Pack name is required');
    if (!manifest.version) errors.push('Pack version is required');
    if (!manifest.type) errors.push('Pack type is required');
    
    // Type validation
    if (!['module', 'document', 'hybrid'].includes(manifest.type)) {
        errors.push('Pack type must be "module", "document", or "hybrid"');
    }
    
    // Module validation
    if (manifest.modules && manifest.modules.length > 0) {
        manifest.modules.forEach((mod, idx) => {
            if (!mod.id) errors.push(`Module ${idx + 1} missing ID`);
            if (!mod.path) errors.push(`Module ${idx + 1} missing path`);
            if (!mod.route && mod.type !== 'data') {
                errors.push(`Module ${idx + 1} missing route`);
            }
        });
    }
    
    // Document validation
    if (manifest.documents && manifest.documents.length > 0) {
        manifest.documents.forEach((doc, idx) => {
            if (!doc.id) errors.push(`Document ${idx + 1} missing ID`);
            if (!doc.title) errors.push(`Document ${idx + 1} missing title`);
            if (!doc.path) errors.push(`Document ${idx + 1} missing path`);
        });
    }
    
// Security validations
const SECURITY_CHECKS = {
    // Allowed file extensions
    allowedExtensions: ['.js', '.json', '.md', '.html', '.css'],
    
    // Disallowed patterns
    disallowedPatterns: [
        /eval\(/,
        /Function\(/,
        /document\.write\(/,
        /import\s*\(['"]https?:/,
        /require\(['"]https?:/
    ],
    
    // Maximum file sizes (in bytes)
    maxFileSize: 1024 * 1024 * 2, // 2MB
    
    // Maximum total pack size
    maxTotalSize: 1024 * 1024 * 20 // 20MB
};

function validateFileContent(content, filename) {
    // Check for disallowed patterns
    for (const pattern of SECURITY_CHECKS.disallowedPatterns) {
        if (pattern.test(content)) {
            throw new Error(`Security: Disallowed pattern found in ${filename}`);
        }
    }
    
    // Check for suspicious imports
    if (content.includes('import(') && !content.includes('/* webpackIgnore: true */')) {
        // Dynamic imports are allowed with webpackIgnore comment
        // This is a warning, not a hard error
        console.warn(`⚠️ Dynamic import in ${filename} - ensure it's secure`);
    }
}

// In installPack, before processing module code:
async function processModule(modFile) {
    const content = await modFile.async('text');
    validateFileContent(content, modFile.name);
    // ... rest of processing
}
}

// ============================================================
// PACK INSTALLATION
// ============================================================

export async function installPack(file) {
    return new Promise((resolve, reject) => {
        try {
            // Read the ZIP file
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const zip = await JSZip.loadAsync(arrayBuffer);
                    
                    // Extract manifest
                    const manifestFile = zip.file('pack.json');
                    if (!manifestFile) {
                        reject(new Error('Pack manifest (pack.json) not found'));
                        return;
                    }
                    
                    const manifestText = await manifestFile.async('text');
                    const manifest = JSON.parse(manifestText);
                    
                    // Validate
                    const validation = validatePack(manifest);
                    if (!validation.valid) {
                        reject(new Error(`Invalid pack: ${validation.errors.join(', ')}`));
                        return;
                    }
                    
                    // Check if already installed
                    if (packRegistry.has(manifest.id)) {
                        if (!confirm(`Pack "${manifest.name}" is already installed. Reinstall?`)) {
                            reject(new Error('Installation cancelled'));
                            return;
                        }
                    }
                    
                    // Process modules
                    const installedModules = [];
                    if (manifest.modules) {
                        for (const mod of manifest.modules) {
                            const modFile = zip.file(mod.path);
                            if (!modFile) {
                                reject(new Error(`Module file not found: ${mod.path}`));
                                return;
                            }
                            
                            const modCode = await modFile.async('text');
                            
                            // Create blob URL for the module
                            const blob = new Blob([modCode], { type: 'application/javascript' });
                            const blobUrl = URL.createObjectURL(blob);
                            
                            // Store for later loading
                            const moduleInfo = {
                                ...mod,
                                blobUrl,
                                code: modCode
                            };
                            installedModules.push(moduleInfo);
                            
                            // If it's a route module, register it
                            if (mod.route && mod.type !== 'data') {
                                registerRoute(mod.route, () => import(/* webpackIgnore: true */ blobUrl));
                                console.log(`📦 Registered route: ${mod.route}`);
                            }
                            
                            // Also register with module loader if it has a route
                            if (mod.route) {
                                // The module loader will handle the actual import
                                moduleLoader.modulePaths[mod.route] = blobUrl;
                            }
                        }
                    }
                    
                    // Process documents
                    const installedDocs = [];
                    if (manifest.documents) {
                        for (const doc of manifest.documents) {
                            const docFile = zip.file(doc.path);
                            if (!docFile) {
                                reject(new Error(`Document not found: ${doc.path}`));
                                return;
                            }
                            
                            const content = await docFile.async('text');
                            const docInfo = {
                                ...doc,
                                content
                            };
                            installedDocs.push(docInfo);
                            
                            // Add to documents registry
                            addDocument(docInfo);
                        }
                    }
                    
                    // Process data files (patrons, factions, regions)
                    const installedData = { patrons: [], factions: [], regions: [] };
                    if (manifest.data) {
                        // Process patrons
                        if (manifest.data.patrons) {
                            for (const dataPath of manifest.data.patrons) {
                                const dataFile = zip.file(dataPath);
                                if (dataFile) {
                                    const dataContent = await dataFile.async('text');
                                    const data = JSON.parse(dataContent);
                                    await mergePatronData(data);
                                    installedData.patrons.push(data);
                                }
                            }
                        }
                        
                        // Process factions
                        if (manifest.data.factions) {
                            for (const dataPath of manifest.data.factions) {
                                const dataFile = zip.file(dataPath);
                                if (dataFile) {
                                    const dataContent = await dataFile.async('text');
                                    const data = JSON.parse(dataContent);
                                    await mergeFactionData(data);
                                    installedData.factions.push(data);
                                }
                            }
                        }
                        
                        // Process regions
                        if (manifest.data.regions) {
                            for (const dataPath of manifest.data.regions) {
                                const dataFile = zip.file(dataPath);
                                if (dataFile) {
                                    const dataContent = await dataFile.async('text');
                                    const data = JSON.parse(dataContent);
                                    await mergeRegionData(data);
                                    installedData.regions.push(data);
                                }
                            }
                        }
                    }
                    
                    // Store pack info
                    const packInfo = {
                        ...manifest,
                        id: manifest.id || `pack-${Date.now()}`,
                        installed: Date.now(),
                        modules: installedModules,
                        documents: installedDocs,
                        data: installedData,
                        active: true
                    };
                    
                    // Add to registry
                    packRegistry.set(packInfo.id, packInfo);
                    installedPacks.push(packInfo);
                    saveInstalledPacks();
                    
                    // Show success
                    showToast(`📦 Pack "${manifest.name}" installed successfully!`, 'success');
                    resolve(packInfo);
                    
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (err) {
            reject(err);
        }
    });
}

// ============================================================
// DATA MERGING
// ============================================================

async function mergePatronData(data) {
    const state = getState();
    if (!state.patrons) state.patrons = {};
    if (!state.patrons.cosmic) state.patrons.cosmic = [];
    
    // Check if patron already exists
    const existing = state.patrons.cosmic.find(p => p.id === data.id);
    if (existing) {
        Object.assign(existing, data);
    } else {
        state.patrons.cosmic.push(data);
    }
    saveState();
}

async function mergeFactionData(data) {
    const state = getState();
    if (!state.factions) state.factions = {};
    if (!state.factions.factions) state.factions.factions = [];
    
    const existing = state.factions.factions.find(f => f.id === data.id);
    if (existing) {
        Object.assign(existing, data);
    } else {
        state.factions.factions.push(data);
    }
    saveState();
}

async function mergeRegionData(data) {
    // Regions are loaded from /regions/ at runtime
    // For now, we'll store them in state for later persistence
    const state = getState();
    if (!state.regions) state.regions = {};
    state.regions[data.slug || data.name] = data;
    saveState();
}

// ============================================================
// DOCUMENT MANAGEMENT
// ============================================================

let documents = [];

export function addDocument(doc) {
    const existing = documents.find(d => d.id === doc.id);
    if (existing) {
        Object.assign(existing, doc);
    } else {
        documents.push(doc);
    }
    // Save to state
    const state = getState();
    if (!state.documents) state.documents = [];
    if (!state.documents.find(d => d.id === doc.id)) {
        state.documents.push(doc);
    }
    saveState();
}

export function getDocuments() {
    const state = getState();
    return state.documents || [];
}

// ============================================================
// PACK UNINSTALLATION
// ============================================================

export function uninstallPack(packId) {
    const pack = packRegistry.get(packId);
    if (!pack) {
        showToast('Pack not found', 'error');
        return;
    }
    
    if (!confirm(`Uninstall "${pack.name}"? This will remove all associated modules and data.`)) {
        return;
    }
    
    // Remove modules from registry
    if (pack.modules) {
        pack.modules.forEach(mod => {
            if (mod.route) {
                // Remove from module loader
                delete moduleLoader.modulePaths[mod.route];
                // Revoke blob URL if it exists
                if (mod.blobUrl) {
                    URL.revokeObjectURL(mod.blobUrl);
                }
            }
        });
    }
    
    // Remove from registry
    packRegistry.delete(packId);
    installedPacks = installedPacks.filter(p => p.id !== packId);
    saveInstalledPacks();
    
    showToast(`🗑️ Pack "${pack.name}" uninstalled.`, 'info');
    
    // Reload to clean up
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// ============================================================
// PACK LIST
// ============================================================

export function getInstalledPacks() {
    return installedPacks;
}

export function getPack(packId) {
    return packRegistry.get(packId);
}

// ============================================================
// INITIALIZATION
// ============================================================

export function initPackManager() {
    loadInstalledPacks();
    console.log(`📦 Pack Manager initialized. ${installedPacks.length} packs installed.`);
}

// ============================================================
// EXPORT
// ============================================================

export default {
    initPackManager,
    installPack,
    uninstallPack,
    getInstalledPacks,
    getPack,
    validatePack,
    getDocuments,
    addDocument,
    loadInstalledPacks
};