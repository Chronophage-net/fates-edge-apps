/**
 * Core Utility Functions
 * Shared utilities used across the application
 */

// ============================================================
// URL UTILITIES
// ============================================================

export function buildDocumentUrl(path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    if (!path.startsWith('/')) {
        return path;
    }
    const cleanPath = path.slice(1);
    const baseUrl = getBaseUrl();
    return baseUrl + cleanPath;
}

export function getBaseUrl() {
    const pathname = window.location.pathname;
    
    if (pathname.includes('/kon-reh/')) {
        return '/kon-reh/';
    }
    if (pathname.includes('/fates-edge-toolkit/')) {
        return '/fates-edge-toolkit/';
    }
    
    const match = pathname.match(/^\/([^/]+)\//);
    if (match) {
        return '/' + match[1] + '/';
    }
    
    return '/';
}

export function isAbsoluteUrl(url) {
    return url.startsWith('http://') || 
           url.startsWith('https://') || 
           url.startsWith('//');
}

export function normalizeUrl(url) {
    if (isAbsoluteUrl(url)) {
        return url;
    }
    return buildDocumentUrl(url);
}

export function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

export function getUrlParam(key, defaultValue = null) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key) || defaultValue;
}

export function buildUrlWithParams(base, params = {}) {
    const url = new URL(base, window.location.origin);
    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined) {
            url.searchParams.set(key, value);
        }
    }
    return url.toString();
}

// ============================================================
// NUMBER UTILITIES
// ============================================================

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

export function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function padNumber(num, length = 2) {
    return num.toString().padStart(length, '0');
}

export function rollDice(count, sides) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(randomInt(1, sides));
    }
    return {
        results,
        total: results.reduce((a, b) => a + b, 0),
        success: results.filter(r => r >= Math.ceil(sides * 0.6)).length
    };
}

export function performRoll(expression) {
    const match = expression.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!match) {
        throw new Error('Invalid dice expression');
    }
    
    const count = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    const modifier = parseInt(match[3]) || 0;
    
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(randomInt(1, sides));
    }
    const total = results.reduce((a, b) => a + b, 0) + modifier;
    const successCount = results.filter(r => r >= Math.ceil(sides * 0.6)).length;
    
    return {
        expression,
        results,
        modifier,
        total,
        successCount,
        count,
        sides
    };
}

// ============================================================
// HTML UTILITIES
// ============================================================

export function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
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

export function setHtml(el, html) {
    if (el) {
        el.innerHTML = html;
    }
}

export function htmlToElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

export function htmlToFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content;
}

// ============================================================
// STRING UTILITIES
// ============================================================

export function truncate(str, maxLength = 100, suffix = '…') {
    if (!str || str.length <= maxLength) return str;
    return str.slice(0, maxLength) + suffix;
}

export function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function toTitleCase(str) {
    if (!str) return str;
    return str.replace(/\w\S*/g, word => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}

export function slugify(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function camelToKebab(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function pluralize(word, count = 1) {
    if (count === 1) return word;
    return word + 's';
}

// ============================================================
// ARRAY UTILITIES
// ============================================================

export function chunkArray(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}

export function shuffleArray(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function groupBy(arr, key) {
    return arr.reduce((result, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
}

export function unique(arr) {
    return [...new Set(arr)];
}

export function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
}

export function average(arr) {
    if (!arr.length) return 0;
    return sum(arr) / arr.length;
}

export function sortBy(arr, key, ascending = true) {
    const sorted = [...arr];
    sorted.sort((a, b) => {
        const aVal = typeof key === 'function' ? key(a) : a[key];
        const bVal = typeof key === 'function' ? key(b) : b[key];
        if (aVal < bVal) return ascending ? -1 : 1;
        if (aVal > bVal) return ascending ? 1 : -1;
        return 0;
    });
    return sorted;
}

// ============================================================
// OBJECT UTILITIES
// ============================================================

export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }
    return obj;
}

export function getNested(obj, path, defaultValue = null) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) {
            return defaultValue;
        }
        current = current[part];
    }
    return current !== undefined ? current : defaultValue;
}

export function setNested(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined || current[part] === null) {
            current[part] = {};
        }
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
    return obj;
}

export function pick(obj, keys) {
    const result = {};
    for (const key of keys) {
        if (obj.hasOwnProperty(key)) {
            result[key] = obj[key];
        }
    }
    return result;
}

export function omit(obj, keys) {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result;
}

export function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

// ============================================================
// DATE UTILITIES
// ============================================================

export function formatDate(date, format = 'short') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    const formats = {
        short: d.toLocaleDateString(),
        medium: d.toLocaleDateString(undefined, { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        }),
        long: d.toLocaleDateString(undefined, { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }),
        full: d.toLocaleDateString(undefined, { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        }),
        iso: d.toISOString().split('T')[0],
        time: d.toLocaleTimeString(),
        datetime: d.toLocaleString()
    };
    
    return formats[format] || formats.short;
}

export function timeAgo(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    const now = new Date();
    const diff = now - d;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return minutes + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days < 30) return days + 'd ago';
    if (months < 12) return months + 'mo ago';
    return years + 'y ago';
}

export function formatDuration(ms) {
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
// STORAGE UTILITIES
// ============================================================

export function getStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item);
    } catch (e) {
        console.warn('Failed to get storage item:', e);
        return defaultValue;
    }
}

export function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn('Failed to set storage item:', e);
        return false;
    }
}

export function removeStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.warn('Failed to remove storage item:', e);
        return false;
    }
}

// ============================================================
// ADDITIONAL UTILITIES (MISSING FROM SCAN)
// ============================================================

export function debounce(fn, delay = 300) {
    let timeoutId = null;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };
}

export function throttle(fn, limit = 300) {
    let inThrottle = false;
    return function(...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

export function safeParseInt(value, defaultValue = 0) {
    if (value === null || value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

export function safeParseFloat(value, defaultValue = 0) {
    if (value === null || value === undefined) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

export function safeParseJSON(value, defaultValue = null) {
    if (!value) return defaultValue;
    try {
        return JSON.parse(value);
    } catch (e) {
        console.warn('Failed to parse JSON:', e);
        return defaultValue;
    }
}

export function isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export function isValidInteger(value) {
    return isValidNumber(value) && Number.isInteger(value);
}

export function getType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
}

export function generateId(prefix = 'id_') {
    return prefix + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
    // URL utilities
    buildDocumentUrl,
    getBaseUrl,
    isAbsoluteUrl,
    normalizeUrl,
    getUrlParams,
    getUrlParam,
    buildUrlWithParams,
    
    // Number utilities
    clamp,
    randomInt,
    randomFloat,
    formatNumber,
    padNumber,
    rollDice,
    performRoll,
    
    // HTML utilities
    escHtml,
    createElement,
    setHtml,
    htmlToElement,
    htmlToFragment,
    
    // String utilities
    truncate,
    capitalize,
    toTitleCase,
    slugify,
    camelToKebab,
    kebabToCamel,
    pluralize,
    
    // Array utilities
    chunkArray,
    shuffleArray,
    groupBy,
    unique,
    sum,
    average,
    sortBy,
    
    // Object utilities
    deepClone,
    getNested,
    setNested,
    pick,
    omit,
    isEmpty,
    
    // Date utilities
    formatDate,
    timeAgo,
    formatDuration,
    
    // Storage utilities
    getStorage,
    setStorage,
    removeStorage,
    
    // Additional utilities
    debounce,
    throttle,
    safeParseInt,
    safeParseFloat,
    safeParseJSON,
    isValidNumber,
    isValidInteger,
    getType,
    generateId,
    
};
