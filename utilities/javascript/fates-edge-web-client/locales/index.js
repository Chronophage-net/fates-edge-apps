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

    // A machine-generated accented/padded rendering of English. It is not a
    // language: it exists so that translation problems can be found before
    // any translator is paid. Every string that shows up unaccented is a
    // string still hardcoded somewhere, and every clipped button is a layout
    // that will break in German. Hidden from the normal Settings picker —
    // see settings/index.js's shouldShowDevLocales().
    { code: 'en-x-pseudo', name: 'Pseudo (translation test)', nativeName: 'Pseudolocale', dir: 'ltr', dev: true },
];

/**
 * code -> () => Promise<catalogue module>
 * @type {Record<string, () => Promise<any>>}
 */
export const LOADERS = {
    'en-x-pseudo': () => import('./en-x-pseudo.js'),
};

export default { LOCALES, LOADERS };
