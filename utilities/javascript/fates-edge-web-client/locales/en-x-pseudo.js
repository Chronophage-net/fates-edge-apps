// locales/en-x-pseudo.js
/**
 * Pseudolocale — English, mechanically deformed.
 *
 * "Sèttîngš" instead of "Settings", padded ~30% longer and wrapped in
 * brackets. Switching to it answers three questions that are otherwise only
 * answered after a translator has been paid:
 *
 *   1. Which strings are still hardcoded?  Anything that stays plain
 *      English on screen never went through `t()`.
 *   2. Which layouts break when words get longer?  German and Finnish run
 *      30-50% longer than English; the padding here simulates that.
 *   3. Which strings got concatenated?  A `[…]` opening without a closing
 *      one means a sentence was assembled from fragments, which no
 *      translator can reorder.
 *
 * It is generated from en.json at import time rather than checked in, so it
 * can never drift out of date with the source catalogue.
 */

import en from './en.json' with { type: 'json' };

const ACCENTS = {
    a: 'á', b: 'b', c: 'ç', d: 'd', e: 'è', f: 'f', g: 'ĝ', h: 'ĥ', i: 'î',
    j: 'ĵ', k: 'k', l: 'ł', m: 'm', n: 'ñ', o: 'ô', p: 'p', q: 'q', r: 'ř',
    s: 'š', t: 'ţ', u: 'û', v: 'v', w: 'ŵ', x: 'x', y: 'ý', z: 'ž',
    A: 'Á', B: 'B', C: 'Ç', D: 'D', E: 'È', F: 'F', G: 'Ĝ', H: 'Ĥ', I: 'Î',
    J: 'Ĵ', K: 'K', L: 'Ł', M: 'M', N: 'Ñ', O: 'Ô', P: 'P', Q: 'Q', R: 'Ř',
    S: 'Š', T: 'Ţ', U: 'Û', V: 'V', W: 'Ŵ', X: 'X', Y: 'Ý', Z: 'Ž',
};

const PADDING = '·';

/**
 * Accents the letters, keeps `{{placeholders}}` and any HTML tags intact
 * (mangling those would break interpolation and markup rather than test
 * them), then pads to ~130% of the original length.
 */
function pseudo(text) {
    if (typeof text !== 'string' || !text) return text;

    // Split on placeholders and tags so they pass through untouched.
    const parts = text.split(/(\{\{\s*\w+\s*\}\}|<[^>]+>|&[a-zA-Z#0-9]+;)/g);
    const accented = parts
        .map((part, i) => (i % 2 === 1 ? part : part.replace(/[a-zA-Z]/g, ch => ACCENTS[ch] || ch)))
        .join('');

    const letters = (text.match(/[a-zA-Z]/g) || []).length;
    if (!letters) return accented;
    const pad = PADDING.repeat(Math.max(1, Math.ceil(letters * 0.3)));
    return `[${accented} ${pad}]`;
}

function walk(node) {
    if (typeof node === 'string') return pseudo(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
        const out = {};
        for (const [key, value] of Object.entries(node)) {
            // Metadata is configuration, not copy — leave it readable.
            out[key] = key.startsWith('$') ? value : walk(value);
        }
        return out;
    }
    return node;
}

const catalog = walk(en);
catalog.$meta = { code: 'en-x-pseudo', name: 'Pseudo (translation test)', nativeName: 'Pseudolocale', dir: 'ltr' };

export default catalog;
