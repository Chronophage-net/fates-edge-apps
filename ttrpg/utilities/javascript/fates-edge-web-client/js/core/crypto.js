/**
 * Fate's Edge Toolkit - Crypto Module
 * v3.0 - Cryptographic utilities
 */

// ============================================================
// HASHING
// ============================================================

/**
 * Hash a string using SHA-256
 * @param {string} input - The string to hash
 * @returns {Promise<string>} - The hex-encoded hash
 */
export async function hashPassword(input) {
    if (!input) {
        throw new Error('Input is required for hashing');
    }
    
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.error('Hash operation failed:', e);
        throw new Error('Failed to hash input');
    }
}

/**
 * Verify a password against a hash
 * @param {string} password - The plain text password
 * @param {string} hash - The hash to compare against
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
    if (!password || !hash) {
        return false;
    }
    
    try {
        const hashed = await hashPassword(password);
        return hashed === hash;
    } catch (e) {
        console.error('Password verification failed:', e);
        return false;
    }
}

// ============================================================
// RANDOM GENERATION
// ============================================================

/**
 * Generate a secure random string
 * @param {number} length - The length of the string
 * @returns {string} - Random alphanumeric string
 */
export function generateRandomString(length = 16) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => 
        byte.toString(16).padStart(2, '0')
    ).join('').slice(0, length);
}

/**
 * Generate a random password
 * @param {number} length - The length of the password
 * @returns {string} - Random password with special characters
 */
export function generateRandomPassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars[array[i] % chars.length];
    }
    return password;
}

/**
 * Generate a random ID
 * @param {number} length - The length of the ID
 * @returns {string} - Random alphanumeric ID
 */
export function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    let id = '';
    for (let i = 0; i < length; i++) {
        id += chars[array[i] % chars.length];
    }
    return id;
}

// ============================================================
// ENCRYPTION / DECRYPTION (Simple XOR for basic data protection)
// ============================================================

/**
 * Simple XOR encryption (for basic obfuscation, not strong encryption)
 * @param {string} text - The text to encrypt
 * @param {string} key - The encryption key
 * @returns {string} - Encrypted text
 */
export function xorEncrypt(text, key) {
    if (!text || !key) return text;
    
    try {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(
                text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return btoa(result); // Base64 encode for safe storage
    } catch (e) {
        console.error('Encryption failed:', e);
        return text;
    }
}

/**
 * Simple XOR decryption
 * @param {string} encrypted - The encrypted text
 * @param {string} key - The decryption key
 * @returns {string} - Decrypted text
 */
export function xorDecrypt(encrypted, key) {
    if (!encrypted || !key) return encrypted;
    
    try {
        const text = atob(encrypted);
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(
                text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return result;
    } catch (e) {
        console.error('Decryption failed:', e);
        return encrypted;
    }
}

// ============================================================
// COMPARE CONSTANT TIME
// ============================================================

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean}
 */
export function constantTimeCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
    hashPassword,
    verifyPassword,
    generateRandomString,
    generateRandomPassword,
    generateId,
    xorEncrypt,
    xorDecrypt,
    constantTimeCompare,
};