import { describe, it, assert, assertEqual, assertTrue } from '../runner.js';
import { registerTheme, getThemes, getTheme, HIGH_CONTRAST_VARIABLES } from '../../js/core/theme-manager.js';

// NOTE: deliberately does NOT call initTheme() or setTheme() — both end up
// touching document.documentElement.dataset, which tests/support/dom-shim.js
// doesn't provide (documented there as intentionally minimal, not jsdom).
// registerTheme() alone is DOM-free as long as the theme being registered
// isn't the currently-resolved one (true here — currentPreference starts
// null on a fresh module import), so that's what these tests exercise
// instead of the full apply path.

function relativeLuminance(hex) {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hexA, hexB) {
    const [la, lb] = [relativeLuminance(hexA), relativeLuminance(hexB)];
    const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
    return (lighter + 0.05) / (darker + 0.05);
}

describe('theme-manager: high-contrast palette', () => {
    it('HIGH_CONTRAST_VARIABLES is exported and defines every base-palette custom property', () => {
        const requiredKeys = [
            '--bg', '--bg2', '--bg3', '--bg4', '--text', '--text2', '--text3',
            '--text-inverse', '--gold', '--gold-light', '--gold-dark',
            '--red', '--red-light', '--green', '--green-light',
            '--blue', '--blue-light', '--purple', '--purple-light',
            '--orange', '--orange-light', '--border', '--border-light', '--border-strong'
        ];
        for (const key of requiredKeys) {
            assertTrue(
                Object.prototype.hasOwnProperty.call(HIGH_CONTRAST_VARIABLES, key),
                `HIGH_CONTRAST_VARIABLES is missing ${key} — a high-contrast theme that silently falls back to the dark theme's value for an unlisted variable defeats the point`
            );
        }
    });

    it('every solid-color text/accent value reaches at least WCAG AA (4.5:1) against pure black --bg', () => {
        const bg = HIGH_CONTRAST_VARIABLES['--bg'];
        // Excludes the other background-tier variables (they're meant to be
        // *seen against*, not read as text on top of --bg) and --text-inverse
        // (deliberately dark — it's meant to sit on light/accent
        // backgrounds like --gold, not on --bg itself).
        const backgroundRoleKeys = new Set(['--bg', '--bg2', '--bg3', '--bg4', '--text-inverse']);
        const solidColorKeys = Object.keys(HIGH_CONTRAST_VARIABLES).filter(
            k => HIGH_CONTRAST_VARIABLES[k].startsWith('#') && !backgroundRoleKeys.has(k)
        );
        const offenders = [];
        for (const key of solidColorKeys) {
            const ratio = contrastRatio(HIGH_CONTRAST_VARIABLES[key], bg);
            if (ratio < 4.5) offenders.push(`${key}: ${HIGH_CONTRAST_VARIABLES[key]} → ${ratio.toFixed(2)}:1`);
        }
        assert(offenders.length === 0, `Below AA (4.5:1) against --bg:\n  ${offenders.join('\n  ')}`);
    });

    it('--text, --text2, and every semantic accent reach WCAG AAA (7:1) against --bg — the whole point of this theme', () => {
        const bg = HIGH_CONTRAST_VARIABLES['--bg'];
        const aaaKeys = [
            '--text', '--text2', '--gold', '--gold-light', '--gold-dark',
            '--red', '--red-light', '--green', '--green-light',
            '--blue', '--blue-light', '--purple', '--purple-light',
            '--orange', '--orange-light'
        ];
        const offenders = [];
        for (const key of aaaKeys) {
            const ratio = contrastRatio(HIGH_CONTRAST_VARIABLES[key], bg);
            if (ratio < 7) offenders.push(`${key}: ${HIGH_CONTRAST_VARIABLES[key]} → ${ratio.toFixed(2)}:1`);
        }
        assert(offenders.length === 0, `Below AAA (7:1) against --bg:\n  ${offenders.join('\n  ')}`);
    });

    it('--border-strong is pure white on pure black (21:1) for the highest-emphasis borders', () => {
        const ratio = contrastRatio(HIGH_CONTRAST_VARIABLES['--border-strong'], HIGH_CONTRAST_VARIABLES['--bg']);
        assertTrue(ratio > 20.9, `Expected --border-strong ≈ 21:1 against --bg, got ${ratio.toFixed(2)}:1`);
    });

    it('registering the high-contrast theme (as initTheme() does) makes it discoverable via getThemes()/getTheme()', () => {
        registerTheme({
            id: 'high-contrast',
            label: 'High Contrast',
            icon: '◐',
            isDark: true,
            variables: HIGH_CONTRAST_VARIABLES
        });

        const listed = getThemes().find(t => t.id === 'high-contrast');
        assertTrue(!!listed, 'high-contrast theme not found in getThemes() after registerTheme()');
        assertEqual(listed.label, 'High Contrast');
        assertEqual(listed.isDark, true);

        const full = getTheme('high-contrast');
        assertTrue(!!full, 'getTheme("high-contrast") returned nothing after registration');
        assertEqual(full.variables, HIGH_CONTRAST_VARIABLES);
    });
});
