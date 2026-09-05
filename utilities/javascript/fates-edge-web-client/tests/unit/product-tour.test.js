import { describe, it, assertEqual, assertTrue } from '../runner.js';

const loadSource = async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    return readFileSync(path.resolve(here, '..', '..', 'js', 'core', 'product-tour.js'), 'utf8');
};

describe('Product tour: source guard', () => {
    it('keeps the tour to six purposeful stops', async () => {
        const source = await loadSource();
        const routes = [...source.matchAll(/route:\s*'([^']+)'/g)].map(match => match[1]);
        assertEqual(routes.join(','), 'home,characters,dice,encounters,spellcraft,docs');
    });

    it('supports leaving and keyboard navigation', async () => {
        const source = await loadSource();
        assertTrue(source.includes("event.key === 'Escape'"), 'Escape should close the tour');
        assertTrue(source.includes("document.documentElement?.dir === 'rtl'"), 'arrow navigation should follow writing direction');
        assertTrue(source.includes("rtl ? 'ArrowRight' : 'ArrowLeft'"), 'back should reverse in RTL');
        assertTrue(source.includes("rtl ? 'ArrowLeft' : 'ArrowRight'"), 'next should reverse in RTL');
        assertTrue(source.includes("data-tour-action=\"close\""), 'the UI should have an explicit exit');
    });

    it('does not claim modal semantics without trapping the whole application', async () => {
        const source = await loadSource();
        assertTrue(!source.includes("aria-modal"), 'a non-blocking coach panel must not claim aria-modal');
        assertTrue(source.includes("aria-live"), 'step changes should be announced');
    });
});
