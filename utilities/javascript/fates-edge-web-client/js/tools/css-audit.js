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
    // Several modules ship their own stylesheet and inject it at runtime
    // (home's injectStyles(), crafting, encounters, settings, docs …). Those
    // rules are just as real as app.css's, so collect every <style> block and
    // every `const CSS = \`…\`` in the source too — otherwise a module that
    // styles itself reads as hundreds of undefined classes.
    let moduleCss = '';
    for (const file of walk(root)) {
        if (!file.endsWith('.js')) continue;
        const t = fs.readFileSync(file, 'utf8');
        for (const m of t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) moduleCss += '\n' + m[1];
        // …and the createElement('style') form, where the rules are a bare
        // template literal assigned to .textContent / .innerHTML.
        for (const m of t.matchAll(/\.(?:textContent|innerHTML)\s*=\s*`([\s\S]*?)`/g)) {
            if (/\{[^{}]*:[^{}]*;[\s\S]*?\}/.test(m[1]) && !m[1].includes('<')) moduleCss += '\n' + m[1];
        }
    }
    const allCss = css + '\n' + inline + '\n' + moduleCss;
    const bare = allCss.replace(/\/\*[\s\S]*?\*\//g, '');

    const definedClasses = new Set([...bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]));
    const definedVars = new Set([...allCss.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));

    const usedClasses = new Map();
    const usedVars = new Map();
    // A class carried by an element that also has a style="" attribute is
    // already painted at the usage site. Several modules (spellcraft most of
    // all) style themselves entirely inline and use class names only as JS
    // hooks, so "not in app.css" does not mean "renders unstyled" for them.
    // Track whether a class was EVER seen without inline styling; only those
    // are candidates for a missing rule.
    const bareUse = new Set();
    const note = (map, key, file) => {
        if (!map.has(key)) map.set(key, new Set());
        map.get(key).add(file);
    };

    for (const file of walk(root)) {
        const rel = path.relative(root, file);
        const t = fs.readFileSync(file, 'utf8');
        // Standalone HTML games own their styles; keep those definitions local
        // so they cannot accidentally hide a missing rule in another module.
        const ownCss = file.endsWith('.html')
            ? [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
            : '';
        const ownClasses = new Set([...ownCss.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]));
        const ownVars = new Set([...ownCss.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
        for (const m of t.matchAll(/class\s*=\s*(["'`])([\s\S]*?)\1/g)) {
            // look at the rest of the opening tag for a style attribute
            const tagEnd = t.indexOf('>', m.index + m[0].length);
            const rest = tagEnd === -1 ? '' : t.slice(m.index + m[0].length, tagEnd);
            const inlineStyled = /\bstyle\s*=/.test(rest);
            for (const c of m[2].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
                if (!/^-?[_a-zA-Z][\w-]*$/.test(c)) continue;
                if (ownClasses.has(c)) continue;
                note(usedClasses, c, rel);
                if (!inlineStyled) bareUse.add(c);
            }
        }
        for (const m of t.matchAll(/classList\.(?:add|toggle|remove)\(([^)]*)\)/g)) {
            for (const c of m[1].matchAll(/["']([\w-]+)["']/g)) {
                if (ownClasses.has(c[1])) continue;
                note(usedClasses, c[1], rel);
                bareUse.add(c[1]);
            }
        }
        for (const m of t.matchAll(/var\((--[\w-]+)/g)) {
            if (!ownVars.has(m[1])) note(usedVars, m[1], rel);
        }
    }
    for (const m of allCss.matchAll(/var\((--[\w-]+)/g)) note(usedVars, m[1], 'css/app.css');

    const allUndefined = [...usedClasses].filter(([c]) => !definedClasses.has(c));
    const undefinedVars = [...usedVars].filter(([v]) => !definedVars.has(v));
    const shape = ([c, f]) => ({ name: c, files: [...f] });
    return {
        undefinedVars: undefinedVars.map(([v, f]) => ({ name: v, files: [...f] })),
        // undefined AND used somewhere without inline styling — the real list
        undefinedClasses: allUndefined.filter(([c]) => bareUse.has(c)).map(shape),
        // undefined but always inline-styled — hooks, not missing rules
        inlineStyledOnly: allUndefined.filter(([c]) => !bareUse.has(c)).map(shape),
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const { undefinedVars, undefinedClasses, inlineStyledOnly } = auditCss();
    console.log(`undefined custom properties: ${undefinedVars.length}`);
    for (const v of undefinedVars) console.log(`  ${v.name}  ← ${v.files.slice(0, 3).join(', ')}`);

    const byModule = new Map();
    for (const c of undefinedClasses) {
        const f = c.files[0] || '';
        const key = f.startsWith('js/features/') ? f.split('/')[2] : f;
        if (!byModule.has(key)) byModule.set(key, []);
        byModule.get(key).push(c.name);
    }
    console.log(`\nundefined and NOT inline-styled (a rule is probably missing): ${undefinedClasses.length}`);
    for (const [mod, cs] of [...byModule].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`  ${String(cs.length).padStart(4)}  ${mod}`);
        if (process.argv.includes('--classes')) console.log(`        ${cs.join(', ')}`);
    }
    console.log(`\nundefined but always inline-styled (JS hooks, not missing rules): ${inlineStyledOnly.length}`);
}
