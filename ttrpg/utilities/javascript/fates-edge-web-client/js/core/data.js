/**
 * Data management utilities for localStorage
 */

/**
 * Get data from localStorage
 * @param {string} key - The storage key
 * @param {*} defaultValue - Default value if not found
 * @returns {*} The stored data
 */
export function getData(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(`fates-edge-${key}`);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.warn(`Failed to get data for key: ${key}`, e);
        return defaultValue;
    }
}

/**
 * Save data to localStorage
 * @param {string} key - The storage key
 * @param {*} value - The data to store
 */
export function saveData(key, value) {
    try {
        localStorage.setItem(`fates-edge-${key}`, JSON.stringify(value));
    } catch (e) {
        console.warn(`Failed to save data for key: ${key}`, e);
    }
}

/**
 * Remove data from localStorage
 * @param {string} key - The storage key
 */
export function removeData(key) {
    try {
        localStorage.removeItem(`fates-edge-${key}`);
    } catch (e) {
        console.warn(`Failed to remove data for key: ${key}`, e);
    }
}

/**
 * Check if data exists in localStorage
 * @param {string} key - The storage key
 * @returns {boolean} True if data exists
 */
export function hasData(key) {
    return localStorage.getItem(`fates-edge-${key}`) !== null;
}
