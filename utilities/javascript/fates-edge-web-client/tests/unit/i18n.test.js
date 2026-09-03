/**
 * i18n runtime tests.
 *
 * The point of most of these is not "does translation work" but "does the
 * app survive translation not working" — a missing key, an unknown locale, a
 * catalogue that fails to load and a DOM node whose key has no translation
 * must all leave the user looking at the English that was there before.
 */

import { describe, it, assert, assertEqual, assertTrue } from '../runner.js';
import {
    initI18n,
    t,
    tn,
    setLocale,
    getLocale,
    getLocalePreference,
    getLocales,
    getCoverage,
    registerLocale,
    loadLocale,
    applyTranslations,
    hasKey,
    isRTL,
    formatNumber,
    __resetI18nForTests,
} from '../../js/core/i18n.js';

// ---------------------------------------------------------------
// A DOM stand-in with just enough surface for applyTranslations().
// tests/support/dom-shim.js's document.querySelectorAll() always returns
// [], so a fake root is the only way to exercise the DOM path headlessly.
// ---------------------------------------------------------------
function fakeElement({ text = '', html = '', attrs = {} } = {}) {
    return {
        textContent: text,
        innerHTML: html,
        _attrs: { ...attrs },
        getAttribute(name) {
            return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null;
        },
        setAttribute(name, value) { this._attrs[name] = String(value); },
    };
}

function fakeRoot(elements) {
    return {
        querySelectorAll(selector) {
            const attr = selector.replace(/^\[|\]$/g, '');
            return elements.filter(el => el.getAttribute(attr) !== null);
        },
    };
}

async function freshEnglish() {
    __resetI18nForTests();
    try { localStorage.removeItem('fates-edge-locale'); } catch { /* no storage */ }
    await initI18n();
}

describe('i18n: lookup and fallback', () => {
    it('boots into English and resolves real keys', async () => {
        await freshEnglish();
        assertEqual(getLocale(), 'en');
        assertEqual(t('nav.home.label'), 'Home');
        assertEqual(t('common.close'), 'Close');
    });

    it('returns the supplied English fallback for a key no catalogue has', async () => {
        await freshEnglish();
        assertEqual(t('nothing.here.at.all', null, 'Original text'), 'Original text');
    });

    it('returns the key itself, not undefined or an empty string, when there is no fallback', async () => {
        await freshEnglish();
        assertEqual(t('nothing.here.at.all'), 'nothing.here.at.all');
    });

    it('never throws, whatever it is handed', async () => {
        await freshEnglish();
        assertEqual(typeof t(undefined), 'string');
        assertEqual(typeof t(null, null, 'fallback'), 'string');
        assertEqual(typeof t(''), 'string');
    });

    it('hasKey() distinguishes known from unknown keys', async () => {
        await freshEnglish();
        assertTrue(hasKey('nav.dice.label'));
        assertEqual(hasKey('nav.dice.nonexistent'), false);
    });
});

describe('i18n: interpolation and plurals', () => {
    it('substitutes {{placeholders}}', async () => {
        await freshEnglish();
        assertEqual(
            t('settings.language.changed', { language: 'Français' }),
            'Interface language set to Français.'
        );
    });

    it('leaves an unmatched placeholder visible rather than blanking it', async () => {
        await freshEnglish();
        assertEqual(t('settings.language.changed', { wrongName: 'x' }), 'Interface language set to {{language}}.');
    });

    it('picks the plural category and injects count', async () => {
        await freshEnglish();
        assertEqual(tn('plurals.characterCount', 1), '1 character');
        assertEqual(tn('plurals.characterCount', 4), '4 characters');
    });
});

describe('i18n: switching locales', () => {
    it('falls back to English for keys a locale has not translated', async () => {
        await freshEnglish();
        registerLocale(
            { code: 'zz', name: 'Test', nativeName: 'Test', dir: 'ltr' },
            { nav: { home: { label: 'Accueil' } } }
        );
        await setLocale('zz', { persist: false });

        assertEqual(getLocale(), 'zz');
        assertEqual(t('nav.home.label'), 'Accueil');   // translated
        assertEqual(t('common.close'), 'Close');       // not translated -> English

        await setLocale('en', { persist: false });
        assertEqual(t('nav.home.label'), 'Home');
    });

    it('falls back from a regional tag to its base language', async () => {
        await freshEnglish();
        registerLocale({ code: 'zz', name: 'Base', nativeName: 'Base' }, { common: { close: 'Fermer' } });
        registerLocale({ code: 'zz-ZZ', name: 'Regional', nativeName: 'Regional' }, { common: { save: 'Enregistrer' } });
        await setLocale('zz-ZZ', { persist: false });

        assertEqual(t('common.save'), 'Enregistrer'); // from the regional catalogue
        assertEqual(t('common.close'), 'Fermer');     // from the base language
        assertEqual(t('nav.home.label'), 'Home');     // from English
    });

    it('refuses an unknown locale and stays where it was', async () => {
        await freshEnglish();
        await setLocale('definitely-not-a-language', { persist: false });
        assertEqual(getLocale(), 'en');
        assertEqual(t('common.close'), 'Close');
    });

    it('reports honest coverage for a partial translation', async () => {
        await freshEnglish();
        registerLocale({ code: 'zz', name: 'Test', nativeName: 'Test' }, { nav: { home: { label: 'Accueil' } } });
        assertEqual(getCoverage('en'), 1);
        const partial = getCoverage('zz');
        assertTrue(partial > 0 && partial < 0.1, `expected a small coverage ratio, got ${partial}`);
    });

    it('marks RTL locales as RTL and everything else as LTR', async () => {
        await freshEnglish();
        registerLocale({ code: 'zr', name: 'RTL Test', nativeName: 'RTL Test', dir: 'rtl' }, { common: { close: 'X' } });
        await setLocale('zr', { persist: false });
        assertTrue(isRTL());
        await setLocale('en', { persist: false });
        assertEqual(isRTL(), false);
    });
});

describe('i18n: shipped catalogues', () => {
    it('lists English first and can load every registered catalogue', async () => {
        await freshEnglish();
        const locales = getLocales();
        assertTrue(locales.length >= 1);
        assertEqual(locales[0].code, 'en');
        for (const locale of locales) {
            assertTrue(await loadLocale(locale.code), `catalogue for ${locale.code} failed to load`);
        }
    });

    it('the pseudolocale covers every English key, so it can expose untranslated UI', async () => {
        await freshEnglish();
        const loaded = await loadLocale('en-x-pseudo');
        assertTrue(loaded, 'pseudolocale did not load');
        assertEqual(getCoverage('en-x-pseudo'), 1);
    });

    it('the pseudolocale leaves placeholders intact', async () => {
        await freshEnglish();
        await setLocale('en-x-pseudo', { persist: false });
        const rendered = t('settings.language.changed', { language: 'Test' });
        assertTrue(rendered.includes('Test'), `placeholder was not substituted: ${rendered}`);
        assertEqual(rendered.includes('{{'), false);
        await setLocale('en', { persist: false });
    });
});

describe('i18n: DOM application', () => {
    it('translates text nodes and remembers the original English', async () => {
        await freshEnglish();
        registerLocale({ code: 'zz', name: 'Test', nativeName: 'Test' }, { nav: { home: { label: 'Accueil' } } });

        const el = fakeElement({ text: 'Home', attrs: { 'data-i18n': 'nav.home.label' } });
        const root = fakeRoot([el]);

        await setLocale('zz', { persist: false });
        applyTranslations(root);
        assertEqual(el.textContent, 'Accueil');
        assertEqual(el.getAttribute('data-i18n-src'), 'Home');

        await setLocale('en', { persist: false });
        applyTranslations(root);
        assertEqual(el.textContent, 'Home');
    });

    it('leaves an element alone when nothing in the chain knows its key', async () => {
        await freshEnglish();
        const el = fakeElement({ text: 'Untouched English', attrs: { 'data-i18n': 'no.such.key' } });
        applyTranslations(fakeRoot([el]));
        assertEqual(el.textContent, 'Untouched English');
    });

    it('translates attributes listed in data-i18n-attr', async () => {
        await freshEnglish();
        registerLocale({ code: 'zz', name: 'Test', nativeName: 'Test' }, { nav: { dice: { title: 'Lanceur de dés' } } });

        const el = fakeElement({
            attrs: { 'data-i18n-attr': 'title:nav.dice.title;aria-label:nav.dice.title', title: 'Dice Roller', 'aria-label': 'Dice Roller' },
        });
        await setLocale('zz', { persist: false });
        applyTranslations(fakeRoot([el]));
        assertEqual(el.getAttribute('title'), 'Lanceur de dés');
        assertEqual(el.getAttribute('aria-label'), 'Lanceur de dés');

        await setLocale('en', { persist: false });
        applyTranslations(fakeRoot([el]));
        assertEqual(el.getAttribute('title'), 'Dice Roller');
    });

    it('survives a root that is not a DOM node at all', async () => {
        await freshEnglish();
        assertEqual(applyTranslations({}), 0);
        assertEqual(applyTranslations(null) >= 0, true);
    });
});

describe('i18n: Intl helpers', () => {
    it('formats numbers for the active locale and degrades gracefully', async () => {
        await freshEnglish();
        assertEqual(formatNumber(1234.5), new Intl.NumberFormat('en').format(1234.5));
        assertEqual(typeof formatNumber(undefined), 'string');
    });
});

describe('i18n: preference persistence', () => {
    it("stores an explicit choice and treats 'auto' as no stored key", async () => {
        await freshEnglish();
        registerLocale({ code: 'zz', name: 'Test', nativeName: 'Test' }, { common: { close: 'Fermer' } });

        await setLocale('zz');
        assertEqual(getLocalePreference(), 'zz');
        assertEqual(localStorage.getItem('fates-edge-locale') !== null, true);

        await setLocale('auto');
        assertEqual(getLocalePreference(), 'auto');
        assertEqual(localStorage.getItem('fates-edge-locale'), null);
    });
});

// ---------------------------------------------------------------
// Markup <-> catalogue consistency.
//
// index.html carries the English inline AND a key; these two can drift
// apart in a later edit (someone rewords a button and forgets the
// catalogue, or renames a key and forgets the markup). Either drift is
// silent at runtime — the fallback machinery hides it — so it is checked
// here instead.
// ---------------------------------------------------------------

describe('i18n: index.html annotations match the English catalogue', () => {
    const readShell = async () => {
        const { readFileSync } = await import('node:fs');
        const { fileURLToPath } = await import('node:url');
        const path = await import('node:path');
        const here = path.dirname(fileURLToPath(import.meta.url));
        return readFileSync(path.resolve(here, '..', '..', 'index.html'), 'utf8');
    };

    it('every data-i18n key exists in en.json', async () => {
        await freshEnglish();
        const html = await readShell();
        const missing = [];
        for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) {
            if (!hasKey(m[1], 'en')) missing.push(m[1]);
        }
        assertEqual(missing.length, 0, `keys used in index.html but absent from en.json: ${missing.join(', ')}`);
    });

    it('every data-i18n-attr key exists in en.json', async () => {
        await freshEnglish();
        const html = await readShell();
        const missing = [];
        for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
            for (const pair of m[1].split(';')) {
                const key = pair.slice(pair.indexOf(':') + 1).trim();
                if (key && !hasKey(key, 'en')) missing.push(key);
            }
        }
        assertEqual(missing.length, 0, `attribute keys used in index.html but absent from en.json: ${missing.join(', ')}`);
    });

    it('the English in the markup still matches the catalogue text', async () => {
        await freshEnglish();
        const html = await readShell();
        const drift = [];
        // Only simple, single-line "<tag ... data-i18n="k">text</tag>" cases;
        // anything with nested markup is covered by the key-existence tests
        // above rather than by string comparison.
        for (const m of html.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]+)</g)) {
            const [, key, markupText] = m;
            const catalogText = t(key);
            const normalise = (s) => s.replace(/\s+/g, ' ').trim();
            // Entities in the markup (&#10022;) are decoded by the browser
            // but not by this regex, so compare only when neither side has one.
            if (markupText.includes('&')) continue;
            if (normalise(markupText) !== normalise(catalogText)) {
                drift.push(`${key}: markup "${normalise(markupText)}" vs catalogue "${normalise(catalogText)}"`);
            }
        }
        assertEqual(drift.length, 0, `index.html and en.json have drifted apart:\n  ${drift.join('\n  ')}`);
    });
});
