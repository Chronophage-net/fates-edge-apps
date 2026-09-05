// locales/index.js
/**
 * The list of interface languages the toolkit ships with.
 *
 * ADDING A LANGUAGE IS TWO EDITS:
 *   1. Copy `en.json` to `<code>.json` and translate the values (see
 *      TRANSLATION.md — the `$meta` block and the key names stay in English,
 *      only the values change).
 *   2. Add one entry to LOCALES below and one line to LOADERS.
 *
 * WHY THE LOADERS ARE WRITTEN OUT ONE BY ONE, rather than a single
 * `import(`./${code}.json`)`: a bundler can only split out and hash a
 * dynamic import whose specifier it can see statically. A template literal
 * would either force every catalogue into the main bundle or, with Vite's
 * glob helpers, tie this file to Vite and break `npm test`, which runs the
 * same modules under plain Node. An explicit map works identically in both
 * and costs one line per language.
 *
 * English is NOT in LOADERS: core/i18n.js imports `en.json` statically so
 * that the fallback catalogue is always present, with no await, from the
 * first `t()` call during boot.
 */

/**
 * @typedef {object} LocaleDescriptor
 * @property {string} code        BCP-47 tag, e.g. 'en', 'fr', 'pt-BR'
 * @property {string} name        Name in English (used for sorting)
 * @property {string} nativeName  Name as speakers of it write it
 * @property {'ltr'|'rtl'} dir    Writing direction
 * @property {boolean} [dev]      Development aid, hidden from the normal picker
 */

/** @type {LocaleDescriptor[]} */
export const LOCALES = [
    { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },

    { code: 'en-US', name: 'English (United States)', nativeName: 'English (United States)', dir: 'ltr' },
    { code: 'en-GB', name: 'English (United Kingdom)', nativeName: 'English (United Kingdom)', dir: 'ltr' },

    { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },

    // Machine-generated accented/padded renderings of English. They are not
    // languages: the LTR version exposes missing translations and cramped
    // controls; the RTL version exercises the same catalogue with the page's
    // writing direction reversed. Hidden from the normal Settings picker.
    { code: 'en-x-pseudo', name: 'Pseudo (translation test)', nativeName: 'Pseudolocale', dir: 'ltr', dev: true },
    { code: 'en-x-pseudo-rtl', name: 'Pseudo RTL (layout test)', nativeName: 'RTL Pseudolocale', dir: 'rtl', dev: true },
];

/**
 * code -> () => Promise<catalogue module>
 * @type {Record<string, () => Promise<any>>}
 */
export const LOADERS = {
    'es': () => import('./es.json', { with: { type: 'json' } }),
    'en-US': () => import('./en-US.json', { with: { type: 'json' } }),
    'en-GB': () => import('./en-GB.json', { with: { type: 'json' } }),
    'en-x-pseudo': () => import('./en-x-pseudo.js'),
    'en-x-pseudo-rtl': () => import('./en-x-pseudo-rtl.js'),
};

export default { LOCALES, LOADERS };
