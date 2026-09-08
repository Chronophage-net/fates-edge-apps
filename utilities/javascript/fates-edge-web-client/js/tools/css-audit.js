#!/usr/bin/env node
/**
 * Report CSS the interface asks for but the stylesheet never defines.
 *
 * Written after the VTT turned out to have been shipping against a .vtt-*
 * stylesheet that was never authored: the markup referenced .vtt-card,
 * .vtt-section-grid and friends, none of them existed, and the tab rendered
 * as one unstyled column. The same sweep found nineteen custom properties
 * (--accent, --warn, --danger, --font, --panel …) referenced with no
 * fallback, which silently voided whole declarations across ten modules.
 *
 *   node js/tools/css-audit.js            # summary by module
 *   node js/tools/css-audit.js --classes  # every undefined class
 *
 * Undefined *custom properties* are a hard error and are covered by
 * tests/unit/css-tokens.test.js. Undefined *classes* are reported, not
 * enforced: plenty are legitimate JS selectors that were never meant to
 * carry style, so the list is a triage aid rather than a build gate.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// data/ holds published documents that ship their own <style> blocks and
// their own tokens; they render scoped inside .integrated-document and are
// not app chrome, so they are not audited against app.css.
const SKIP = new Set(['node_modules', 'dist', 'tests', '.git', 'data', 'docs', 'locales']);

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.js') || e.name.endsWith('.html')) out.push(p);
    }
    return out;
}

export function auditCss(root = ROOT) {
    const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    const allCss = css + '\n' + inline;
    const bare = allCss.replace(/\/\*[\s\S]*?\*\//g, '');

    const definedClasses = new Set([...bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]));
    const definedVars = new Set([...allCss.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));

    const usedClasses = new Map();
    const usedVars = new Map();
    const note = (map, key, file) => {
        if (!map.has(key)) map.set(key, new Set());
        map.get(key).add(file);
    };

    for (const file of walk(root)) {
        const rel = path.relative(root, file);
        const t = fs.readFileSync(file, 'utf8');
        for (const m of t.matchAll(/class\s*=\s*(["'`])([\s\S]*?)\1/g)) {
            for (const c of m[2].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
                if (/^-?[_a-zA-Z][\w-]*$/.test(c)) note(usedClasses, c, rel);
            }
        }
        for (const m of t.matchAll(/classList\.(?:add|toggle|remove)\(([^)]*)\)/g)) {
            for (const c of m[1].matchAll(/["']([\w-]+)["']/g)) note(usedClasses, c[1], rel);
        }
        for (const m of t.matchAll(/var\((--[\w-]+)/g)) note(usedVars, m[1], rel);
    }
    for (const m of allCss.matchAll(/var\((--[\w-]+)/g)) note(usedVars, m[1], 'css/app.css');

    const undefinedClasses = [...usedClasses].filter(([c]) => !definedClasses.has(c));
    const undefinedVars = [...usedVars].filter(([v]) => !definedVars.has(v));
    return {
        undefinedVars: undefinedVars.map(([v, f]) => ({ name: v, files: [...f] })),
        undefinedClasses: undefinedClasses.map(([c, f]) => ({ name: c, files: [...f] })),
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const { undefinedVars, undefinedClasses } = auditCss();
    console.log(`undefined custom properties: ${undefinedVars.length}`);
    for (const v of undefinedVars) console.log(`  ${v.name}  ← ${v.files.slice(0, 3).join(', ')}`);

    const byModule = new Map();
    for (const c of undefinedClasses) {
        const f = c.files[0] || '';
        const key = f.startsWith('js/features/') ? f.split('/')[2] : f;
        if (!byModule.has(key)) byModule.set(key, []);
        byModule.get(key).push(c.name);
    }
    console.log(`\nundefined classes: ${undefinedClasses.length}`);
    for (const [mod, cs] of [...byModule].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`  ${String(cs.length).padStart(4)}  ${mod}`);
        if (process.argv.includes('--classes')) console.log(`        ${cs.join(', ')}`);
    }
}
