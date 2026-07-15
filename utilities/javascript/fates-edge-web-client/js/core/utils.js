// core/utils.js
/**
 * Core Utility Functions
 * Single source of truth for shared utilities
 */

// ============================================================
// STRING UTILITIES
// ============================================================

/**
 * Generate a unique ID
 * @param {number} length - Length of the ID (default: 8)
 * @returns {string} Unique ID
 */
export function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Check if a string is a valid URL
 * @param {string} str - String to check
 * @returns {boolean} True if valid URL
 */
export function isAbsoluteUrl(str) {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Normalize a URL
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
export function normalizeUrl(url) {
    if (!url) return '';
    if (isAbsoluteUrl(url)) return url;
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return url;
    return '/' + url;
}

/**
 * Get URL parameters as an object
 * @param {string} url - URL to parse
 * @returns {URLSearchParams} URL parameters
 */
export function getUrlParams(url) {
    try {
        const urlObj = new URL(url, window.location.origin);
        return urlObj.searchParams;
    } catch {
        return new URLSearchParams();
    }
}

/**
 * Get a specific URL parameter
 * @param {string} url - URL to parse
 * @param {string} key - Parameter name
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Parameter value or default
 */
export function getUrlParam(url, key, defaultValue = null) {
    const params = getUrlParams(url);
    return params.get(key) || defaultValue;
}

/**
 * Build a URL with query parameters
 * @param {string} base - Base URL
 * @param {Object} params - Query parameters
 * @returns {string} URL with query string
 */
export function buildUrlWithParams(base, params = {}) {
    const url = new URL(base, window.location.origin);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, value);
        }
    }
    return url.toString();
}

/**
 * Get base URL from state or location
 * @param {Object} state - State object
 * @param {string} defaultValue - Default value
 * @returns {string} Base URL
 */
export function getBaseUrl(state = {}, defaultValue = '') {
    return state.baseUrl || 
           localStorage.getItem('fatesEdgeBaseUrl') || 
           window.location.origin || 
           defaultValue;
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert to title case
 * @param {string} str - String to convert
 * @returns {string} Title case string
 */
export function toTitleCase(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Create a slug from a string
 * @param {string} str - String to slugify
 * @returns {string} Slug
 */
export function slugify(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Convert camelCase to kebab-case
 * @param {string} str - CamelCase string
 * @returns {string} Kebab-case string
 */
export function camelToKebab(str) {
    if (!str) return '';
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 * @param {string} str - Kebab-case string
 * @returns {string} CamelCase string
 */
export function kebabToCamel(str) {
    if (!str) return '';
    return str
        .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

/**
 * Pluralize a word
 * @param {string} word - Word to pluralize
 * @param {number} count - Count (plural if !== 1)
 * @returns {string} Pluralized word
 */
export function pluralize(word, count) {
    if (count === 1) return word;
    // Simple pluralization - add 's'
    return word + 's';
}

/**
 * Pad a number with leading zeros
 * @param {number} num - Number to pad
 * @param {number} length - Desired length
 * @returns {string} Padded number
 */
export function padNumber(num, length = 2) {
    return String(num).padStart(length, '0');
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Truncate a string to max length with suffix
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to append (default: '...')
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength = 100, suffix = '...') {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - suffix.length) + suffix;
}

// ============================================================
// NUMBER UTILITIES
// ============================================================

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random float
 */
export function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Format a number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Safe parseInt with default
 * @param {*} value - Value to parse
 * @param {number} defaultValue - Default if invalid
 * @returns {number} Parsed integer
 */
export function safeParseInt(value, defaultValue = 0) {
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safe parseFloat with default
 * @param {*} value - Value to parse
 * @param {number} defaultValue - Default if invalid
 * @returns {number} Parsed float
 */
export function safeParseFloat(value, defaultValue = 0) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safe JSON parse with default
 * @param {string} value - JSON string to parse
 * @param {*} defaultValue - Default if invalid
 * @returns {*} Parsed JSON
 */
export function safeParseJSON(value, defaultValue = null) {
    try {
        return JSON.parse(value);
    } catch {
        return defaultValue;
    }
}

/**
 * Check if a value is a valid number
 * @param {*} value - Value to check
 * @returns {boolean} True if valid number
 */
export function isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if a value is a valid integer
 * @param {*} value - Value to check
 * @returns {boolean} True if valid integer
 */
export function isValidInteger(value) {
    return isValidNumber(value) && Number.isInteger(value);
}

/**
 * Get the type of a value
 * @param {*} value - Value to check
 * @returns {string} Type string
 */
export function getType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

// ============================================================
// ARRAY UTILITIES
// ============================================================

/**
 * Shuffle an array (Fisher-Yates)
 * @param {Array} arr - Array to shuffle
 * @returns {Array} Shuffled array
 */
export function shuffleArray(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Group array items by a key
 * @param {Array} arr - Array to group
 * @param {string|Function} key - Key to group by
 * @returns {Object} Grouped items
 */
export function groupBy(arr, key) {
    return arr.reduce((result, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!result[groupKey]) result[groupKey] = [];
        result[groupKey].push(item);
        return result;
    }, {});
}

/**
 * Get unique values from an array
 * @param {Array} arr - Array to filter
 * @returns {Array} Unique values
 */
export function unique(arr) {
    return [...new Set(arr)];
}

/**
 * Sum an array of numbers
 * @param {Array} arr - Array of numbers
 * @returns {number} Sum
 */
export function sum(arr) {
    return arr.reduce((total, val) => total + val, 0);
}

/**
 * Average an array of numbers
 * @param {Array} arr - Array of numbers
 * @returns {number} Average
 */
export function average(arr) {
    if (!arr || arr.length === 0) return 0;
    return sum(arr) / arr.length;
}

/**
 * Sort an array by a key
 * @param {Array} arr - Array to sort
 * @param {string|Function} key - Key to sort by
 * @param {boolean} ascending - Sort ascending (default: true)
 * @returns {Array} Sorted array
 */
export function sortBy(arr, key, ascending = true) {
    const result = [...arr];
    const getValue = typeof key === 'function' ? key : item => item[key];
    return result.sort((a, b) => {
        const aVal = getValue(a);
        const bVal = getValue(b);
        if (aVal < bVal) return ascending ? -1 : 1;
        if (aVal > bVal) return ascending ? 1 : -1;
        return 0;
    });
}

// ============================================================
// OBJECT UTILITIES
// ============================================================

/**
 * Get a nested value from an object using dot notation
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot notation path (e.g., 'user.name')
 * @param {*} defaultValue - Default if not found
 * @returns {*} Nested value
 */
export function getNested(obj, path, defaultValue = undefined) {
    if (!obj || !path) return defaultValue;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current === undefined || current === null || typeof current !== 'object') {
            return defaultValue;
        }
        current = current[key];
        if (current === undefined) return defaultValue;
    }
    return current;
}

/**
 * Set a nested value in an object using dot notation
 * @param {Object} obj - Object to modify
 * @param {string} path - Dot notation path
 * @param {*} value - Value to set
 * @returns {Object} Modified object
 */
export function setNested(obj, path, value) {
    if (!obj || !path) return obj;
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
    return obj;
}

/**
 * Pick properties from an object
 * @param {Object} obj - Source object
 * @param {string[]} keys - Keys to pick
 * @returns {Object} Object with picked properties
 */
export function pick(obj, keys) {
    return keys.reduce((result, key) => {
        if (obj !== undefined && obj !== null && key in obj) {
            result[key] = obj[key];
        }
        return result;
    }, {});
}

/**
 * Omit properties from an object
 * @param {Object} obj - Source object
 * @param {string[]} keys - Keys to omit
 * @returns {Object} Object without omitted properties
 */
export function omit(obj, keys) {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result;
}

/**
 * Check if an object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} True if empty
 */
export function isEmpty(obj) {
    if (!obj) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
}

// ============================================================
// DATE UTILITIES
// ============================================================

/**
 * Get time ago string (e.g., "2 hours ago")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Time ago string
 */
export function timeAgo(date) {
    const now = Date.now();
    const past = new Date(date).getTime();
    if (isNaN(past)) return 'Invalid date';
    
    const diff = Math.floor((now - past) / 1000); // seconds
    if (diff < 60) return diff + 's';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd';
    if (diff < 2592000) return Math.floor(diff / 604800) + 'w';
    return Math.floor(diff / 2592000) + 'mo';
}

/**
 * Format duration in milliseconds
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
    if (!ms || ms < 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// ============================================================
// DOM UTILITIES
// ============================================================

/**
 * Create an element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes to set
 * @param {Array} children - Child elements or text
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className' || key === 'class') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('data-') || key.startsWith('data')) {
            const dataKey = key.replace('data-', '');
            el.dataset[dataKey] = value;
        } else if (key === 'innerHTML') {
            el.innerHTML = value;
        } else if (key === 'textContent') {
            el.textContent = value;
        } else {
            el.setAttribute(key, value);
        }
    }
    for (const child of children) {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    }
    return el;
}

/**
 * Set HTML content of an element
 * @param {HTMLElement} el - Target element
 * @param {string} html - HTML string
 * @returns {HTMLElement} The element
 */
export function setHtml(el, html) {
    if (el) el.innerHTML = html;
    return el;
}

/**
 * Convert HTML string to DOM element
 * @param {string} html - HTML string
 * @returns {HTMLElement} DOM element
 */
export function htmlToElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
}

/**
 * Convert HTML string to document fragment
 * @param {string} html - HTML string
 * @returns {DocumentFragment} Document fragment
 */
export function htmlToFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content;
}

// ============================================================
// STORAGE UTILITIES
// ============================================================

/**
 * Get storage item with JSON parsing
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value
 * @returns {*} Parsed value
 */
export function getStorage(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    } catch (e) {
        console.warn(`Error reading from localStorage: ${key}`, e);
        return defaultValue;
    }
}

/**
 * Set storage item with JSON stringification
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 */
export function setStorage(key, value) {
    try {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, stringValue);
    } catch (e) {
        console.warn(`Error writing to localStorage: ${key}`, e);
    }
}

/**
 * Remove storage item
 * @param {string} key - Storage key
 */
export function removeStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.warn(`Error removing from localStorage: ${key}`, e);
    }
}

// ============================================================
// FUNCTION UTILITIES
// ============================================================

/**
 * Throttle a function
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Throttle delay in ms
 * @returns {Function} Throttled function
 */
export function throttle(fn, delay = 250) {
    let lastCall = 0;
    let timeoutId = null;
    
    return function throttled(...args) {
        const now = Date.now();
        const remaining = delay - (now - lastCall);
        
        if (remaining <= 0) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastCall = now;
            return fn.apply(this, args);
        }
        
        if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                timeoutId = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}

// ============================================================
// DICE UTILITIES (re-exported from dice.js to avoid duplicates)
// ============================================================

// Re-export dice functions from dice.js to maintain single source of truth
// These are imported from core/dice.js and re-exported here for convenience

export { 
    rollDice,
    rollPool,
    performDicePoolRoll,
    performRoll,
    getOutcomeLabel,
    getOutcomeClass,
    getOutcomeColor,
    visualizeDice,
    diceToHtml
} from './dice.js';

// ============================================================
// MAIN EXPORT (for convenience)
// ============================================================

// Export all utilities as a single object
const Utils = {
    // String
    generateId,
    isAbsoluteUrl,
    normalizeUrl,
    getUrlParams,
    getUrlParam,
    buildUrlWithParams,
    getBaseUrl,
    capitalize,
    toTitleCase,
    slugify,
    camelToKebab,
    kebabToCamel,
    pluralize,
    padNumber,
    truncate,
    escHtml,
    
    // Number
    randomInt,
    randomFloat,
    formatNumber,
    safeParseInt,
    safeParseFloat,
    safeParseJSON,
    isValidNumber,
    isValidInteger,
    getType,
    
    // Array
    shuffleArray,
    groupBy,
    unique,
    sum,
    average,
    sortBy,
    
    // Object
    getNested,
    setNested,
    pick,
    omit,
    isEmpty,
    
    // Date
    timeAgo,
    formatDuration,
    
    // DOM
    createElement,
    setHtml,
    htmlToElement,
    htmlToFragment,
    
    // Storage
    getStorage,
    setStorage,
    removeStorage,
    
    // Function
    throttle,
};

export default Utils;