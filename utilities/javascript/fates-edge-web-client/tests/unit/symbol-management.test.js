import { describe, it, assert, assertFalse } from '../runner.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Regression coverage for removing the "auto-symbol addition" feature from
// the Character Editor and Wizard. That feature silently force-injected
// whatever patron sat in the single top-level "Patron" dropdown into
// char.symbols/d.symbols the moment magicPath === 'invoker', even though
// Invokers canonically carry MULTIPLE Symbols added via the dedicated
// "Invoker Symbols" Add-Symbol UI (#ce-add-symbol-btn / #wz-add-symbol-btn).
//
// The editor/wizard DOM surface is too heavy to drive end-to-end under this
// project's lightweight headless DOM shim (querySelector/querySelectorAll
// are no-ops there — see tests/support/dom-shim.js), so this suite pins the
// fix at the source level: the auto-injection code paths must be gone, and
// the surviving symbol-collection code must read only from the
// purpose-built dynamic list / row markup.

const here = path.dirname(fileURLToPath(import.meta.url));
const editorSrc = readFileSync(path.join(here, '../../js/features/characters/editor.js'), 'utf8');
const wizardSrc = readFileSync(path.join(here, '../../js/features/characters/wizard.js'), 'utf8');

describe('editor.js: auto-symbol injection removed', () => {
    it('no longer defines or calls updateAutoSymbolRow', () => {
        assertFalse(editorSrc.includes('updateAutoSymbolRow'), 'updateAutoSymbolRow should be fully removed from editor.js');
    });

    it('no longer references the AUTO-SYMBOL feature in comments', () => {
        assertFalse(editorSrc.includes('AUTO-SYMBOL'), 'stale AUTO-SYMBOL comments should be removed from editor.js');
    });

    it('saveEditor reads symbols only from the dynamic row list, with no forced patron injection', () => {
        // The correct, surviving read path.
        assert(editorSrc.includes("readDynamicList('symbol')"), 'saveEditor should still read symbol rows via readDynamicList');
        // The removed bug: force-unshifting the top-level Patron field's value
        // into the symbol rows before persisting.
        assertFalse(
            editorSrc.includes("symbolRows.unshift({ patron: c.patron"),
            'saveEditor must not force-inject the top-level Patron field into c.symbols'
        );
    });

    it('the top-level Patron field carries a hint that it is not for Invokers', () => {
        assert(editorSrc.includes('ce-patron-hint'), 'expected a small inline hint near the Patron field for Invoker magicPath');
        assert(editorSrc.includes('Invokers use Symbols below'), 'expected hint text pointing users at the dedicated Symbol UI');
    });
});

describe('wizard.js: auto-symbol injection removed', () => {
    it('no longer defines or calls updateAutoSymbolWizard', () => {
        assertFalse(wizardSrc.includes('updateAutoSymbolWizard'), 'updateAutoSymbolWizard should be fully removed from wizard.js');
    });

    it('no longer references the AUTO-SYMBOL feature in comments', () => {
        assertFalse(wizardSrc.includes('AUTO-SYMBOL'), 'stale AUTO-SYMBOL comments should be removed from wizard.js');
    });

    it('collectTalentsAndLoadout no longer force-injects the top-level Patron into d.symbols', () => {
        assert(wizardSrc.includes('d.symbols = readSymbolListFromDOM();'), 'wizard should still collect symbols from the manual Add-Symbol rows');
        assertFalse(
            wizardSrc.includes('d.symbols.unshift(d.patron)'),
            'collectTalentsAndLoadout must not force-inject the top-level Patron field into d.symbols'
        );
        // The manual "Add Symbol" button handler legitimately still adds a
        // "Symbol of <Patron>" asset for rows the user explicitly added —
        // that's fine and expected. What must be gone is the auto-injection
        // path inside collectTalentsAndLoadout keyed off the top-level
        // #wz-magic-path/#wz-patron fields rather than an explicit user click.
        assertFalse(
            wizardSrc.includes('if (d.magicPath === \'invoker\' && d.patron)'),
            'collectTalentsAndLoadout must not branch on the top-level Patron field to auto-add a symbol/asset'
        );
    });

    it('readSymbolListFromDOM (the manual Add-Symbol reader) is preserved', () => {
        assert(wizardSrc.includes('function readSymbolListFromDOM()'), 'the manual symbol-row DOM reader must still exist — it backs the normal Add Symbol flow');
    });
});
