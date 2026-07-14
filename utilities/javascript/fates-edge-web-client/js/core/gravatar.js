/**
 * Gravatar utility for user avatars
 * Supports fallback, size, rating, and default image options
 */

/**
 * Generate a Gravatar URL from an email address
 * @param {string} email - The user's email address
 * @param {Object} options - Configuration options
 * @param {number} options.size - Image size in pixels (1-2048, default 80)
 * @param {string} options.rating - Rating level: 'g', 'pg', 'r', 'x' (default 'g')
 * @param {string} options.default - Fallback image: '404', 'mp', 'identicon', 'monsterid', 'wavatar', 'retro', 'robohash', 'blank'
 * @param {boolean} options.forceDefault - Force default image even if Gravatar exists
 * @returns {string} The Gravatar URL
 */
export function getGravatarUrl(email, options = {}) {
    if (!email) {
        return getFallbackAvatar(options.size || 80);
    }

    const trimmedEmail = email.trim().toLowerCase();
    const hash = md5(trimmedEmail);

    const size = options.size || 80;
    const rating = options.rating || 'g';
    const defaultImage = options.default || 'identicon';
    const forceDefault = options.forceDefault || false;

    let url = `https://www.gravatar.com/avatar/${hash}`;
    const params = new URLSearchParams();

    params.set('s', size);
    params.set('r', rating);
    params.set('d', defaultImage);
    if (forceDefault) {
        params.set('f', 'y');
    }

    return `${url}?${params.toString()}`;
}

/**
 * Generate a fallback avatar based on name
 * @param {string} name - The user's name
 * @param {number} size - Image size
 * @returns {string} SVG data URL for fallback avatar
 */
export function getFallbackAvatar(name, size = 80) {
    // If no name, use a generic avatar
    if (!name) {
        return getGenericAvatar(size);
    }

    // Generate color from name
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#73C6B6'
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    const backgroundColor = colors[colorIndex];

    // Get initials
    const parts = name.trim().split(/\s+/);
    const initials = parts
        .filter(p => p.length > 0)
        .map(p => p[0].toUpperCase())
        .slice(0, 2)
        .join('');

    const fontSize = initials.length === 1 ? size * 0.5 : size * 0.4;

    return `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <rect width="${size}" height="${size}" fill="${backgroundColor}" rx="${size * 0.15}" />
            <text x="50%" y="50%" dy="0.1em" text-anchor="middle"
                  font-family="Arial, sans-serif" font-weight="bold"
                  font-size="${fontSize}" fill="white">
                ${initials}
            </text>
        </svg>
    `)}`;
}

/**
 * Get a generic avatar
 * @param {number} size - Image size
 * @returns {string} SVG data URL for generic avatar
 */
function getGenericAvatar(size = 80) {
    return `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <rect width="${size}" height="${size}" fill="#6C5CE7" rx="${size * 0.15}" />
            <circle cx="${size * 0.5}" cy="${size * 0.35}" r="${size * 0.15}" fill="white" opacity="0.8" />
            <circle cx="${size * 0.35}" cy="${size * 0.35}" r="${size * 0.04}" fill="#6C5CE7" />
            <circle cx="${size * 0.65}" cy="${size * 0.35}" r="${size * 0.04}" fill="#6C5CE7" />
            <path d="M${size * 0.3} ${size * 0.6} Q${size * 0.5} ${size * 0.8} ${size * 0.7} ${size * 0.6}"
                  stroke="white" stroke-width="${size * 0.04}" fill="none" opacity="0.8" />
        </svg>
    `)}`;
}

/**
 * MD5 hash function (pure JavaScript implementation)
 * @param {string} string - The string to hash
 * @returns {string} MD5 hash
 */
function md5(string) {
    // MD5 implementation
    function rotateLeft(value, shift) {
        return (value << shift) | (value >>> (32 - shift));
    }

    function addUnsigned(x, y) {
        const lsw = (x & 0xFFFF) + (y & 0xFFFF);
        const msw = (x >>> 16) + (y >>> 16) + (lsw >>> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }

    function md5F(x, y, z) { return (x & y) | (~x & z); }
    function md5G(x, y, z) { return (x & z) | (y & ~z); }
    function md5H(x, y, z) { return x ^ y ^ z; }
    function md5I(x, y, z) { return y ^ (x | ~z); }

    function md5FF(a, b, c, d, k, s, i) {
        a = addUnsigned(a, addUnsigned(addUnsigned(md5F(b, c, d), k), i));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function md5GG(a, b, c, d, k, s, i) {
        a = addUnsigned(a, addUnsigned(addUnsigned(md5G(b, c, d), k), i));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function md5HH(a, b, c, d, k, s, i) {
        a = addUnsigned(a, addUnsigned(addUnsigned(md5H(b, c, d), k), i));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function md5II(a, b, c, d, k, s, i) {
        a = addUnsigned(a, addUnsigned(addUnsigned(md5I(b, c, d), k), i));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function convertToWordArray(string) {
        const length = string.length;
        const wordArray = [];
        let index = 0;
        for (let i = 0; i < length; i += 4) {
            wordArray[index++] = (
                string.charCodeAt(i) |
                ((i + 1 < length) ? string.charCodeAt(i + 1) << 8 : 0) |
                ((i + 2 < length) ? string.charCodeAt(i + 2) << 16 : 0) |
                ((i + 3 < length) ? string.charCodeAt(i + 3) << 24 : 0)
            );
        }
        return wordArray;
    }

    function wordToHex(value) {
        let hex = '';
        for (let i = 0; i < 4; i++) {
            const byte = (value >>> (i * 8)) & 0xFF;
            hex += ('0' + byte.toString(16)).slice(-2);
        }
        return hex;
    }

    const x = convertToWordArray(string);
    const length = string.length * 8;

    x[length >>> 5] |= 0x80 << (length % 32);
    x[((length + 64) >>> 9) << 4] = length;

    let a = 0x67452301;
    let b = 0xEFCDAB89;
    let c = 0x98BADCFE;
    let d = 0x10325476;

    for (let i = 0; i < x.length; i += 16) {
        const AA = a;
        const BB = b;
        const CC = c;
        const DD = d;

        a = md5FF(a, b, c, d, x[i + 0], 7, 0xD76AA478);
        d = md5FF(d, a, b, c, x[i + 1], 12, 0xE8C7B756);
        c = md5FF(c, d, a, b, x[i + 2], 17, 0x242070DB);
        b = md5FF(b, c, d, a, x[i + 3], 22, 0xC1BDCEEE);
        a = md5FF(a, b, c, d, x[i + 4], 7, 0xF57C0FAF);
        d = md5FF(d, a, b, c, x[i + 5], 12, 0x4787C62A);
        c = md5FF(c, d, a, b, x[i + 6], 17, 0xA8304613);
        b = md5FF(b, c, d, a, x[i + 7], 22, 0xFD469501);
        a = md5FF(a, b, c, d, x[i + 8], 7, 0x698098D8);
        d = md5FF(d, a, b, c, x[i + 9], 12, 0x8B44F7AF);
        c = md5FF(c, d, a, b, x[i + 10], 17, 0xFFFF5BB1);
        b = md5FF(b, c, d, a, x[i + 11], 22, 0x895CD7BE);
        a = md5FF(a, b, c, d, x[i + 12], 7, 0x6B901122);
        d = md5FF(d, a, b, c, x[i + 13], 12, 0xFD987193);
        c = md5FF(c, d, a, b, x[i + 14], 17, 0xA679438E);
        b = md5FF(b, c, d, a, x[i + 15], 22, 0x49B40821);

        a = md5GG(a, b, c, d, x[i + 1], 5, 0xF61E2562);
        d = md5GG(d, a, b, c, x[i + 6], 9, 0xC040B340);
        c = md5GG(c, d, a, b, x[i + 11], 14, 0x265E5A51);
        b = md5GG(b, c, d, a, x[i + 0], 20, 0xE9B6C7AA);
        a = md5GG(a, b, c, d, x[i + 5], 5, 0xD62F105D);
        d = md5GG(d, a, b, c, x[i + 10], 9, 0x02441453);
        c = md5GG(c, d, a, b, x[i + 15], 14, 0xD8A1E681);
        b = md5GG(b, c, d, a, x[i + 4], 20, 0xE7D3FBC8);
        a = md5GG(a, b, c, d, x[i + 9], 5, 0x21E1CDE6);
        d = md5GG(d, a, b, c, x[i + 14], 9, 0xC33707D6);
        c = md5GG(c, d, a, b, x[i + 3], 14, 0xF4D50D87);
        b = md5GG(b, c, d, a, x[i + 8], 20, 0x455A14ED);
        a = md5GG(a, b, c, d, x[i + 13], 5, 0xA9E3E905);
        d = md5GG(d, a, b, c, x[i + 2], 9, 0xFCEFA3F8);
        c = md5GG(c, d, a, b, x[i + 7], 14, 0x676F02D9);
        b = md5GG(b, c, d, a, x[i + 12], 20, 0x8D2A4C8A);

        a = md5HH(a, b, c, d, x[i + 5], 4, 0xFFFA3942);
        d = md5HH(d, a, b, c, x[i + 8], 11, 0x8771F681);
        c = md5HH(c, d, a, b, x[i + 11], 16, 0x6D9D6122);
        b = md5HH(b, c, d, a, x[i + 14], 23, 0xFDE5380C);
        a = md5HH(a, b, c, d, x[i + 1], 4, 0xA4BEEA44);
        d = md5HH(d, a, b, c, x[i + 4], 11, 0x4BDECFA9);
        c = md5HH(c, d, a, b, x[i + 7], 16, 0xF6BB4B60);
        b = md5HH(b, c, d, a, x[i + 10], 23, 0xBEBFBC70);
        a = md5HH(a, b, c, d, x[i + 13], 4, 0x289B7EC6);
        d = md5HH(d, a, b, c, x[i + 0], 11, 0xEAA127FA);
        c = md5HH(c, d, a, b, x[i + 3], 16, 0xD4EF3085);
        b = md5HH(b, c, d, a, x[i + 6], 23, 0x04881D05);
        a = md5HH(a, b, c, d, x[i + 9], 4, 0xD9D4D039);
        d = md5HH(d, a, b, c, x[i + 12], 11, 0xE6DB99E5);
        c = md5HH(c, d, a, b, x[i + 15], 16, 0x1FA27CF8);
        b = md5HH(b, c, d, a, x[i + 2], 23, 0xC4AC5665);

        a = md5II(a, b, c, d, x[i + 0], 6, 0xF4292244);
        d = md5II(d, a, b, c, x[i + 7], 10, 0x432AFF97);
        c = md5II(c, d, a, b, x[i + 14], 15, 0xAB9423A7);
        b = md5II(b, c, d, a, x[i + 5], 21, 0xFC93A039);
        a = md5II(a, b, c, d, x[i + 12], 6, 0x655B59C3);
        d = md5II(d, a, b, c, x[i + 3], 10, 0x8F0CCC92);
        c = md5II(c, d, a, b, x[i + 10], 15, 0xFFEFF47D);
        b = md5II(b, c, d, a, x[i + 1], 21, 0x85845DD1);
        a = md5II(a, b, c, d, x[i + 8], 6, 0x6FA87E4F);
        d = md5II(d, a, b, c, x[i + 15], 10, 0xFE2CE6E0);
        c = md5II(c, d, a, b, x[i + 6], 15, 0xA3014314);
        b = md5II(b, c, d, a, x[i + 13], 21, 0x4E0811A1);
        a = md5II(a, b, c, d, x[i + 4], 6, 0xF7537E82);
        d = md5II(d, a, b, c, x[i + 11], 10, 0xBD3AF235);
        c = md5II(c, d, a, b, x[i + 2], 15, 0x2AD7D2BB);
        b = md5II(b, c, d, a, x[i + 9], 21, 0xEB86D391);

        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
    }

    return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
}

/**
 * Check if a Gravatar exists for an email
 * @param {string} email - The email address to check
 * @param {number} size - Image size
 * @returns {Promise<boolean>} True if Gravatar exists
 */
export function gravatarExists(email) {
    return new Promise((resolve) => {
        if (!email) {
            resolve(false);
            return;
        }

        const url = getGravatarUrl(email, { size: 1, default: '404' });
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

/**
 * Get a Gravatar URL with all options
 * @param {string} email - User's email
 * @param {string} name - User's name (for fallback)
 * @param {number} size - Image size
 * @returns {string} Gravatar URL or fallback
 */
export function getUserAvatar(email, name = '', size = 80) {
    if (email) {
        return getGravatarUrl(email, { size, default: 'mp' });
    }
    return getFallbackAvatar(name || 'User', size);
}
