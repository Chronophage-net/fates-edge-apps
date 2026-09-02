import { describe, it, assert } from '../runner.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_CLIENT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(WEB_CLIENT_ROOT, 'js', p), 'utf8');

const DECKS = read('features/decks/index.js');
const GM_TOOLS = read('features/gm-tools/index.js');

/**
 * GM Tools has no region of its own — it reads the one the Deck of
 * Consequences owns. That coupling was real but only half-wired, and the
 * half that was missing failed silently:
 *
 *   - Region discovery ran only inside decks' render(), so a GM who went
 *     straight to GM Tools saw an empty region list and got
 *     "No region data loaded." on every quick-draw.
 *   - setSelectedRegion() loaded the new region's DATA only when decks'
 *     own <select> was in the document. Changing region from GM Tools
 *     moved the name and left regionData behind, so cards were read
 *     against the previous region's meanings.
 *   - decks' render() forced regionNames[0] every time, throwing away a
 *     region chosen anywhere else (including in decks itself, before
 *     navigating away and back).
 *
 * These are source guards rather than behavioural tests: the region path
 * is fetch- and DOM-bound in ways the harness's shim doesn't reach. They
 * assert the shape of the fix, which is what regressed.
 */
describe('GM Tools shares the Decks region', () => {

    it('decks exports a discovery entry point that does not need its own render()', () => {
        assert(/export function ensureRegionsReady\(/.test(DECKS),
            'decks/index.js must export ensureRegionsReady()');
        assert(/regionNames = await initializeRegions\(REGION_DIR\)/.test(DECKS),
            'ensureRegionsReady() must be the thing that performs discovery');
    });

    it('decks render() no longer performs discovery on its own', () => {
        // If render() calls initializeRegions directly again, the two
        // paths can diverge; everything must funnel through the memoized
        // entry point.
        const renderBody = DECKS.slice(DECKS.indexOf('export async function render(el)'));
        assert(/regionNames = await ensureRegionsReady\(\)/.test(renderBody),
            'render() must go through ensureRegionsReady()');
    });

    it('decks render() preserves a region chosen elsewhere', () => {
        assert(!/select\.value = regionNames\[0\];\s*\n\s*await handleRegionChange\(\);\s*\n\s*selectedRegion = regionNames\[0\];/.test(DECKS),
            'render() must not force regionNames[0] and discard the current selection');
        assert(/selectedRegion && regionNames\.includes\(selectedRegion\)/.test(DECKS),
            'render() must reflect the region already in effect when there is one');
    });

    it('setSelectedRegion loads region data with no DOM present', () => {
        const fn = DECKS.slice(DECKS.indexOf('export async function setSelectedRegion'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert(/await applyRegion\(regionName\)/.test(body),
            'setSelectedRegion must apply the region (fetch data + notify) unconditionally');
        // The bug: the data load sat behind `if (select) { ... }`.
        const guarded = /if \(select\) \{[\s\S]*?applyRegion/.test(body);
        assert(!guarded,
            'the region data load must not be conditional on decks being rendered');
    });

    it('quick draws from GM Tools can discover regions themselves', () => {
        for (const fn of ['quickDraw', 'quickCrownSpread']) {
            const src = DECKS.slice(DECKS.indexOf(`export async function ${fn}(`));
            const body = src.slice(0, src.indexOf('\n}'));
            assert(/await ensureRegionsReady\(\)/.test(body),
                `${fn}() must ensure regions are loaded — GM Tools calls it without rendering Decks`);
        }
    });

    it('GM Tools has a region selector of its own, on every tab', () => {
        assert(/id="gm-region-select"/.test(GM_TOOLS),
            'GM Tools must render its own region <select>');
        // It belongs in the header, which every tab renders under — not
        // only on Consequences, since Quick Generate (Scene) uses the
        // region too and used to just assert "uses current region".
        const headerStart = GM_TOOLS.indexOf('<header class="gm-tools-header">');
        assert(headerStart !== -1, 'GM Tools must still render a header');
        const header = GM_TOOLS.slice(headerStart, GM_TOOLS.indexOf('</header>', headerStart));
        assert(/id="gm-region-select"/.test(header),
            'the region selector must live in the GM Tools header, not on one tab');
        // As rendered markup, not as prose: the phrase survives in the
        // comment that explains why it was removed.
        assert(!/>Uses current region's deck</.test(GM_TOOLS),
            'the dead "uses current region" label should be gone now there is a visible control');
    });

    it('GM Tools drives the shared state rather than keeping a copy', () => {
        assert(/ensureRegionsReady/.test(GM_TOOLS),
            'GM Tools must call decks\' discovery entry point');
        assert(/setSelectedRegion\(/.test(GM_TOOLS),
            'GM Tools must change region through decks, not a local variable');
        assert(!/let\s+selectedRegion\s*=/.test(GM_TOOLS),
            'GM Tools must not hold its own region state');
    });

    it('the region subscription is de-duplicated', () => {
        // attachConsequencesEvents() runs on every render of that tab —
        // three call sites, one on a setTimeout. Without de-duplication
        // the subscriber list grew for as long as a GM switched tabs.
        const reg = DECKS.slice(DECKS.indexOf('export function registerRegionChange'));
        const body = reg.slice(0, reg.indexOf('\n}'));
        assert(/regionChangeCallbacks\.includes\(callback\)/.test(body),
            'registerRegionChange must refuse a callback it already holds');
        assert(/function syncRegionSelects\(/.test(GM_TOOLS),
            'GM Tools must subscribe with a stable module-level function so de-duplication can recognise it');
    });
});

describe('GM Tools does not accumulate listeners', () => {
    // Same failure family as the crafting panel freeze: attachEvents()
    // runs again after every tab switch, and anything it binds to an
    // element that survives that re-render doubles each time.

    it('tab buttons are bound once per element', () => {
        assert(/dataset\.gmTabBound/.test(GM_TOOLS),
            '.gm-tab click binding must be guarded per element');
    });

    it('document-level listeners are bound once per module', () => {
        assert(/documentLevelEventsBound/.test(GM_TOOLS),
            'the document keydown/click listeners must be bound once, not per attachEvents() call');
        const idx = GM_TOOLS.indexOf('if (!documentLevelEventsBound)');
        assert(idx !== -1, 'the guard must actually wrap the document listeners');
        const guarded = GM_TOOLS.slice(idx, idx + 900);
        assert(/document\.addEventListener\('keydown'/.test(guarded) &&
               /document\.addEventListener\('click'/.test(guarded),
            'both document-level listeners must sit inside the guard');
    });
});
