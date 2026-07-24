/**
 * Fate's Edge - Security / Input Validation Utilities
 *
 * Centralizes the input-sanitization rules that were previously missing
 * (or inconsistently applied) across api.js, room.js, socketio-handlers.js,
 * and ws-handlers.js:
 *
 *   - safeAssign(): merges client-supplied key/value pairs into a stored
 *     object WITHOUT allowing __proto__ / constructor / prototype keys
 *     to alter the object's prototype chain (a classic "prototype
 *     pollution via merge" gadget).
 *   - safeDictSet(): same idea, but for building "name -> record" lookup
 *     dictionaries out of client-supplied names (e.g. character names),
 *     where the *key itself* (not just a nested field) is attacker
 *     controlled.
 *   - isSafeModuleId() / isSafeCampaignCode() / sanitizeRegionName():
 *     allow-list validators for values that get interpolated into
 *     filesystem paths, to prevent path traversal (`../../etc/passwd`
 *     style payloads).
 */

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Merge `data`'s own enumerable keys into `target`, skipping any key that
 * could be used to reach/alter a prototype (__proto__, constructor,
 * prototype) and skipping `name` (identity fields shouldn't be
 * overwritten by a bulk merge). Returns `target` for convenience.
 */
function safeAssign(target, data, { skipKeys = ['name'] } = {}) {
    if (!data || typeof data !== 'object') return target;
    for (const [key, value] of Object.entries(data)) {
        if (UNSAFE_KEYS.has(key)) continue;
        if (skipKeys.includes(key)) continue;
        target[key] = value;
    }
    return target;
}

/**
 * Set `dict[key] = value` guarding against a client-controlled `key` of
 * "__proto__" (which, on a normal {} object, would silently reassign the
 * dictionary's OWN prototype rather than adding an entry). Safe to call
 * on both plain {} objects and Object.create(null) dictionaries.
 */
function safeDictSet(dict, key, value) {
    if (typeof key !== 'string' || UNSAFE_KEYS.has(key)) return false;
    dict[key] = value;
    return true;
}

/** Build a "name -> record" dictionary from a client-supplied array, safely. */
function buildSafeDict(items, keyFn) {
    const dict = Object.create(null);
    for (const item of items) {
        const key = keyFn(item);
        if (key) safeDictSet(dict, key, item);
    }
    return dict;
}

// Module IDs / campaign codes are always server-generated or directory
// names on our own filesystem -- lock them down to a conservative
// alphanumeric-plus-dash charset so they can never escape their
// intended directory via `../` sequences.
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function isSafeModuleId(id) {
    return typeof id === 'string' && SAFE_ID_RE.test(id);
}

function isSafeCampaignCode(code) {
    return typeof code === 'string' && SAFE_ID_RE.test(code);
}

/**
 * Region names are used to build a filesystem path in deck.js. Returns a
 * sanitized name safe to use in a path, or null if the input can't be
 * made safe (callers should fall back to a default region in that case).
 */
function sanitizeRegionName(region) {
    if (typeof region !== 'string') return null;
    const trimmed = region.trim();
    if (!SAFE_ID_RE.test(trimmed)) return null;
    return trimmed;
}

/** Clamp a client-supplied "how many cards" value to a sane, bounded integer. */
function clampCount(count, { min = 1, max = 10, fallback = 1 } = {}) {
    const n = parseInt(count, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

module.exports = {
    UNSAFE_KEYS,
    safeAssign,
    safeDictSet,
    buildSafeDict,
    isSafeModuleId,
    isSafeCampaignCode,
    sanitizeRegionName,
    clampCount,
};
