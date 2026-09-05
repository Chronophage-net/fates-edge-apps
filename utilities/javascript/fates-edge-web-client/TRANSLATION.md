# Translating the Fate's Edge Web Client

The interface can be shown in any language. This document is for two
audiences: **translators**, who only need the first section, and
**developers**, who need the rest when they add or change UI strings.

Nothing here is required to run the app. If no translation exists for a
string, the English that was always there is shown instead — there is no
state in which a missing translation blanks out the interface.

---

## Shipped English locales

Settings → Language offers English, English (United States) (`en-US`), and
English (United Kingdom) (`en-GB`). Browser detection selects the regional
locale when it matches. The regional catalogues cover every interface key,
including American/British spellings such as armor/armour and color/colour.
Date and number helpers use the selected regional locale. Authored game data
remains in its original language.

Keep both regional JSON catalogues aligned when changing `en.json`. Most
values intentionally match the source; identical-English counts in the
coverage report do not indicate unfinished regional translations.

## Spanish and contribution guide

Spanish (`es`, **Español**) is available in Settings → Language. The initial
catalogue is machine-assisted with targeted terminology corrections; complete
key coverage does not mean every screen has received editorial review. Spanish
document editions are listed separately under **Docs → Español**.

Start with the [translator contribution guide](https://dev.fates-edge.com/translations),
or read [the Spanish instructions](TRANSLATIONS.es.md) and
[Spanish glossary](locales/GLOSARIO.es.md). The guide includes language priorities,
review tasks, and ways to contribute without using Git.

## For translators

1. Ask a maintainer to run:

   ```bash
   npm run i18n:new -- fr "French" "Français"
   ```

   That creates `locales/fr.json`: the complete list of interface strings,
   with the English still in place as a starting point.

   For an Arabic, Hebrew, Persian, Urdu, or other right-to-left locale, add
   `--rtl`:

   ```bash
   npm run i18n:new -- ar "Arabic" "العربية" --rtl
   ```

2. Translate the **values**. Leave everything else exactly as it is:

   ```jsonc
   {
     "nav": {
       "home":  { "label": "Accueil", "title": "Accueil" },
       "dice":  { "label": "Dés",     "title": "Lanceur de dés" }
     },
     "settings": {
       "language": {
         // {{language}} is filled in at runtime — keep it, and put it
         // wherever the sentence needs it in your language.
         "changed": "Langue de l'interface : {{language}}."
       }
     }
   }
   ```

   - **Key names** (`nav.home.label`) are identifiers, not text. Never
     translate or reorder them.
   - **`{{placeholders}}`** are values the app substitutes. Keep the spelling
     exactly; move them freely within the sentence.
   - **HTML tags** (`<kbd>`, `<strong>`) must survive intact.
   - **Emoji** at the start of a heading are part of the design — keep them.
   - You may delete any key you have not translated yet. A missing key falls
     back to English; a key translated as an empty string does too.

3. Check your progress at any time:

   ```bash
   npm run i18n:report
   ```

   It lists what is missing, what is still byte-identical to the English
   (i.e. not yet touched), and what refers to strings that no longer exist.

4. Look at your translation in the running app: **Settings → Language**.

### Things worth knowing

- **Only the interface is translated.** Adventures, wiki entries, patrons,
  the SRD and everything else under `data/` is authored game content and
  stays in the language it was written in.
- **Length matters.** Sidebar labels and buttons are laid out for English.
  If your translation is much longer, say so — widening a control is a
  small CSS change, but nobody will know it is needed unless you mention it.
- **Right-to-left languages** set `dir="rtl"` on the document. The interface
  uses logical spacing, borders, alignment, and edge positioning; directional
  keyboard navigation follows the active writing direction. Whiteboard and
  printable-sheet coordinates remain physical on purpose so an existing map
  or page does not move when the interface language changes.

---

## For developers

### The shape of it

| File | Role |
| --- | --- |
| `js/core/i18n.js` | The runtime: `t()`, `setLocale()`, `applyTranslations()`. No dependencies. |
| `locales/en.json` | The source catalogue. Every other locale is a translation of this file. |
| `locales/index.js` | The list of shipped languages and how to load each one. |
| `locales/en-x-pseudo.js` | A generated pseudolocale used to find untranslated UI and cramped layouts. |
| `locales/en-x-pseudo-rtl.js` | The same complete test catalogue with RTL layout enabled. |
| `js/tools/i18n-extract-features.js` | Conservative extractor for first-party UI (`npm run i18n:extract`). |
| `js/tools/i18n-report.js` | Coverage report (`npm run i18n:report`). |
| `js/tools/i18n-new-locale.js` | Scaffolds a new language (`npm run i18n:new`). |

`initI18n()` runs at the top of `js/app.js`'s `init()`, before anything is
rendered. English is imported statically, so `t()` is synchronous and
correct from the first call — there is no "flash of untranslated keys".

### Translating static markup (`index.html`)

Annotate the element and leave the English inline as the fallback:

```html
<span class="nav-label" data-i18n="nav.home.label">Home</span>
<button data-i18n-attr="title:nav.dice.title;aria-label:nav.dice.title" title="Dice Roller">…</button>
<div data-i18n-html="xcard.shortcutHint">Press <kbd>Ctrl+Shift+X</kbd> to close</div>
```

- `data-i18n` replaces `textContent`.
- `data-i18n-html` replaces `innerHTML` (only for strings that genuinely
  contain markup).
- `data-i18n-attr` takes `attribute:key` pairs separated by `;`.

The first pass records the original English in `data-i18n-src`, so switching
back to English restores exactly what was authored. An element whose key
resolves to nothing is left completely untouched.

Feature renders use the same annotations. The module loader translates each
new screen after render, and a small observer handles explicitly annotated
elements inserted later by timers, socket events, and editor validation. The
observer never guesses at unannotated content, so character names and loaded
game prose are not mistaken for interface copy.

A unit test (`tests/unit/i18n.test.js`) fails the build if a `data-i18n` key
is missing from `en.json`, or if the inline English and the catalogue text
have drifted apart.

### Translating strings in feature modules

```js
import { t, tn } from '@core/i18n.js';

// The third argument is the English that used to be hardcoded here.
// Pass it, and a missing key is invisible to the user.
el.textContent = t('characters.empty', null, 'No characters yet.');

showToast(t('settings.language.changed', { language: name },
           `Interface language set to ${name}.`), 'success');

// Plurals go through Intl.PluralRules, not `n === 1`.
label.textContent = tn('plurals.characterCount', characters.length);
```

Numbers, dates and lists are locale-specific too — use `formatNumber`,
`formatDate`, `formatList` and `formatRelativeTime` from the same module
rather than `toLocaleString()` with no locale argument.

**Never build a sentence by concatenation.** `'Deleted ' + n + ' items'`
cannot be reordered by a translator; `t('x.deleted', { count: n })` can.

When the language changes, `js/app.js`'s `setupI18nRefresh()` re-translates
the shell and calls the router's `refreshCurrentTab()`, so feature modules
are simply re-rendered. Modules do not need their own listener.

### Finding what is left

The first-party interface has been extracted. New UI should be added through
the same boundary. The extractor is deliberately conservative: it handles
short control text, translated attributes, notifications, confirmations,
prompts, announcements, and direct text updates. It does not extract arbitrary
English literals or authored game content.

Preview what the extractor would change:

```bash
npm run i18n:extract
```

Review that list, then apply it and review the resulting English catalogue:

```bash
npm run i18n:extract -- --write
```

Do not broaden the extractor over `data/`, rule tables, adventures, patron or
region prose, or printable source material. Those are authored works, not UI.
Their surrounding buttons, errors, and status messages still belong in the
interface catalogue.

```bash
npm run i18n:report
```

reports both translation coverage and extraction coverage. `--strict` also
fails when a UI module has no translation hook, a known message boundary still
receives raw English, or the shell has unannotated visible copy:

```bash
npm run i18n:report -- --strict
```

For a visual answer, enable the translation-test locales in Settings →
Language. **Pseudo (translation test)** exposes untranslated strings and
cramped controls; **Pseudo RTL (layout test)** adds mirrored layout and
directional navigation. Anything that goes through `t()` becomes
`[Ŝèttîngš ··]`; plain English has not been extracted yet. The padding also
shows which layouts break when words get ~30% longer.

### Adding a language in code

1. `npm run i18n:new -- <code> "<English name>" "<Native name>"` (add
   `--rtl` for a right-to-left language).
2. Add one entry to `LOCALES` and one line to `LOADERS` in
   `locales/index.js`. The loaders are written out individually on purpose —
   see the comment in that file.

That is the whole registration path. A module pack can also ship a language
at runtime via `registerLocale()`, the same way it can ship a theme.
