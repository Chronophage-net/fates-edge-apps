// ttrpg/utilities/javascript/client/js/feature-flags.js

/**
 * Feature Flag System - Controls which features are available
 * 
 * Usage:
 * - Set FEATURE_FLAGS in localStorage to override defaults
 * - Touch a file to trigger specific modes
 * - Detect build environment
 */

// Default feature flags
const DEFAULT_FLAGS = {
  // Core features (always enabled)
  USE_CHARACTERS: true,
  USE_TIMERS: true,
  USE_WIKI: true,
  USE_ENCOUNTERS: true,
  USE_NPCS: true,
  USE_CHAT: true,
  USE_ROLLS: true,
  
  // Deck features (replaces consequences + regional)
  USE_DECKS: true,           // Unified decks module
  // Legacy flags (kept for backward compatibility)
  USE_CONSEQUENCES: false,   // Deprecated - use DECKS instead
  USE_REGIONAL: false,       // Deprecated - use DECKS instead
  
  // Advanced features (enabled in full build)
  USE_SEARCH: true,
  USE_DOCS: false,           // Disabled by default - only enabled in full build
  USE_SRD: false,            // Disabled by default
  USE_SYNC: true,
  USE_PRESENCE: true,
  USE_VTT: true,
  USE_DASHBOARD: true,
  USE_BUILDER: true,
  
  // Feature toggles
  SHOW_EXPERIMENTAL: false,
  SHOW_DEV_TOOLS: false,
  ENABLE_ANALYTICS: false,
  DEBUG_MODE: false,
};

// Feature categories
const FEATURE_CATEGORIES = {
  CORE: ['characters', 'timers', 'wiki', 'encounters', 'npcs', 'chat', 'rolls', 'decks', 'vtt'],
  ADVANCED: ['search', 'docs', 'srd', 'sync', 'presence', 'dashboard', 'builder'],
  DEPRECATED: ['consequences', 'regional'],
  EXPERIMENTAL: ['experimental', 'dev_tools', 'analytics'],
};

// Feature aliases - map old names to new names
const FEATURE_ALIASES = {
  'consequences': 'decks',
  'regional': 'decks',
  'roller': 'decks',  // Some might refer to the dice roller, but we'll map it to decks for safety
};

// Feature display names
const FEATURE_DISPLAY_NAMES = {
  characters: '👤 Characters',
  timers: '⏱️ Timers',
  wiki: '📖 Wiki',
  encounters: '⚔️ Encounters',
  npcs: '👥 NPCs',
  chat: '💬 Chat',
  rolls: '🎲 Rolls',
  decks: '🃏 Decks',
  search: '🔍 Search',
  docs: '📄 Docs',
  srd: '📜 SRD',
  sync: '🌐 Sync',
  presence: '👥 Presence',
  vtt: '🎮 VTT',
  dashboard: '📊 Dashboard',
  builder: '🛠️ Builder',
  consequences: '🃏 Consequences (deprecated)',
  regional: '🌍 Regional (deprecated)',
};

/**
 * Get current feature flags
 */
export function getFeatureFlags() {
  // Check for environment variable override
  const envFlags = getEnvironmentFlags();
  
  // Check for localStorage override
  const storageFlags = getStorageFlags();
  
  // Check for build-time flags
  const buildFlags = getBuildFlags();
  
  // Check for URL parameters
  const urlFlags = getUrlFlags();
  
  // Merge flags (later overrides earlier)
  const merged = {
    ...DEFAULT_FLAGS,
    ...buildFlags,
    ...storageFlags,
    ...urlFlags,
    ...envFlags,
  };
  
  // Apply feature aliases (if consequences or regional are enabled, enable decks)
  if (merged.USE_CONSEQUENCES || merged.USE_REGIONAL) {
    merged.USE_DECKS = true;
    console.warn('⚠️ Legacy flags USE_CONSEQUENCES/USE_REGIONAL detected. Using USE_DECKS instead.');
  }
  
  return merged;
}

/**
 * Get environment-based flags
 */
function getEnvironmentFlags() {
  const flags = {};
  
  // Check if running in GitHub Actions
  if (typeof process !== 'undefined' && process.env?.GITHUB_ACTIONS === 'true') {
    flags.USE_DOCS = true;
    flags.USE_SRD = true;
    flags.USE_DECKS = true;
    flags.DEBUG_MODE = false;
  }
  
  // Check if running in production
  if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
    flags.USE_DOCS = true;
    flags.USE_SRD = false; // Don't auto-enable SRD in production without flag
    flags.USE_DECKS = true;
    flags.USE_CONSEQUENCES = false;
    flags.USE_REGIONAL = false;
  }
  
  // Check for development server
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
    flags.DEBUG_MODE = true;
    flags.SHOW_DEV_TOOLS = true;
    flags.USE_DECKS = true;
  }
  
  return flags;
}

/**
 * Get localStorage flags
 */
function getStorageFlags() {
  try {
    const stored = localStorage.getItem('FEATURE_FLAGS');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Check for legacy flags and warn
      if (parsed.USE_CONSEQUENCES || parsed.USE_REGIONAL) {
        console.warn('⚠️ Legacy feature flags detected in localStorage. Consider migrating to USE_DECKS.');
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse FEATURE_FLAGS:', e);
  }
  return {};
}

/**
 * Get build-time flags from window
 */
function getBuildFlags() {
  return window.__FEATURE_FLAGS__ || {};
}

/**
 * Get URL parameter flags
 */
function getUrlFlags() {
  const flags = {};
  const params = new URLSearchParams(window.location.search);
  
  // Check for ?enable=feature1,feature2
  const enableParam = params.get('enable');
  if (enableParam) {
    const features = enableParam.split(',').map(f => f.trim().toUpperCase());
    features.forEach(f => {
      const key = `USE_${f}`;
      flags[key] = true;
    });
  }
  
  // Check for ?disable=feature1,feature2
  const disableParam = params.get('disable');
  if (disableParam) {
    const features = disableParam.split(',').map(f => f.trim().toUpperCase());
    features.forEach(f => {
      const key = `USE_${f}`;
      flags[key] = false;
    });
  }
  
  // Check for ?debug=true
  if (params.get('debug') === 'true') {
    flags.DEBUG_MODE = true;
    flags.SHOW_DEV_TOOLS = true;
  }
  
  return flags;
}

/**
 * Set a feature flag
 */
export function setFeatureFlag(key, value) {
  const current = getStorageFlags();
  current[key] = value;
  localStorage.setItem('FEATURE_FLAGS', JSON.stringify(current));
  
  // Handle aliases for legacy flags
  if (key === 'USE_CONSEQUENCES' || key === 'USE_REGIONAL') {
    console.warn('⚠️ Setting legacy flag. Consider using USE_DECKS instead.');
    // If enabling a legacy flag, also enable DECKS
    if (value) {
      current.USE_DECKS = true;
      localStorage.setItem('FEATURE_FLAGS', JSON.stringify(current));
      console.log('✅ Also enabled USE_DECKS for compatibility.');
    }
  }
  
  // Reload to apply changes
  if (confirm('Feature flag changed. Reload to apply?')) {
    window.location.reload();
  }
}

/**
 * Check if a feature is enabled
 * Supports both new and legacy feature names
 */
export function isFeatureEnabled(featureName) {
  const flags = getFeatureFlags();
  
  // Normalize feature name
  let normalized = featureName.toLowerCase().trim();
  
  // Check for aliases
  if (FEATURE_ALIASES[normalized]) {
    normalized = FEATURE_ALIASES[normalized];
  }
  
  const key = `USE_${normalized.toUpperCase()}`;
  
  // If the key exists, return its value
  if (key in flags) {
    return flags[key] === true;
  }
  
  // Check legacy keys
  if (normalized === 'decks') {
    return flags.USE_DECKS === true || 
           flags.USE_CONSEQUENCES === true || 
           flags.USE_REGIONAL === true;
  }
  
  return false;
}

/**
 * Get all enabled features (resolved with aliases)
 */
export function getEnabledFeatures() {
  const flags = getFeatureFlags();
  const enabled = [];
  
  for (const [key, value] of Object.entries(flags)) {
    if (value && key.startsWith('USE_')) {
      let featureName = key.replace('USE_', '').toLowerCase();
      
      // Resolve aliases
      for (const [alias, target] of Object.entries(FEATURE_ALIASES)) {
        if (featureName === alias) {
          featureName = target;
          break;
        }
      }
      
      // Avoid duplicates
      if (!enabled.includes(featureName)) {
        enabled.push(featureName);
      }
    }
  }
  
  // Ensure DECKS is included if any legacy flags are enabled
  if ((flags.USE_CONSEQUENCES || flags.USE_REGIONAL) && !enabled.includes('decks')) {
    enabled.push('decks');
  }
  
  return enabled;
}

/**
 * Get a human-readable display name for a feature
 */
export function getFeatureDisplayName(featureName) {
  const normalized = featureName.toLowerCase();
  // Check alias
  const resolved = FEATURE_ALIASES[normalized] || normalized;
  return FEATURE_DISPLAY_NAMES[resolved] || resolved.charAt(0).toUpperCase() + resolved.slice(1);
}

/**
 * Check if docs should be built
 */
export function shouldBuildDocs() {
  // Check for file flag
  try {
    const hasFlag = localStorage.getItem('BUILD_DOCS') === 'true';
    if (hasFlag) return true;
  } catch (e) {}
  
  // Check for environment
  if (typeof process !== 'undefined' && process.env?.BUILD_DOCS === 'true') return true;
  if (typeof process !== 'undefined' && process.env?.GITHUB_ACTIONS === 'true') return true;
  
  // Check for URL parameter
  const params = new URLSearchParams(window.location.search);
  if (params.get('buildDocs') === 'true') return true;
  
  return false;
}

/**
 * Get feature categories with their status
 */
export function getFeatureStatus() {
  const flags = getFeatureFlags();
  const status = {};
  
  for (const [category, features] of Object.entries(FEATURE_CATEGORIES)) {
    status[category] = features.map(feature => ({
      name: feature,
      displayName: getFeatureDisplayName(feature),
      enabled: isFeatureEnabled(feature),
      isDeprecated: FEATURE_CATEGORIES.DEPRECATED?.includes(feature) || false,
    }));
  }
  
  return status;
}

/**
 * Check if a feature is deprecated
 */
export function isFeatureDeprecated(featureName) {
  const normalized = featureName.toLowerCase();
  return FEATURE_CATEGORIES.DEPRECATED?.includes(normalized) || false;
}

/**
 * Get migration suggestion for a feature
 */
export function getFeatureMigration(featureName) {
  const normalized = featureName.toLowerCase();
  if (FEATURE_ALIASES[normalized]) {
    return {
      from: normalized,
      to: FEATURE_ALIASES[normalized],
      message: `'${normalized}' has been replaced by '${FEATURE_ALIASES[normalized]}'`,
    };
  }
  return null;
}

/**
 * Reset all feature flags to defaults
 */
export function resetFeatureFlags() {
  localStorage.removeItem('FEATURE_FLAGS');
  if (confirm('Feature flags reset to defaults. Reload to apply?')) {
    window.location.reload();
  }
}

// Export for use in other modules
export default {
  getFeatureFlags,
  setFeatureFlag,
  isFeatureEnabled,
  getEnabledFeatures,
  getFeatureDisplayName,
  shouldBuildDocs,
  getFeatureStatus,
  isFeatureDeprecated,
  getFeatureMigration,
  resetFeatureFlags,
  FEATURE_CATEGORIES,
  FEATURE_DISPLAY_NAMES,
};