#!/usr/bin/env node
/**
 * i18n coverage + readiness report.
 *
 *   npm run i18n:report          human-readable report, always exits 0
 *   npm run i18n:report -- --strict   exits 1 if any shipped locale is
 *                                     incomplete (useful in CI once a
 *                                     language is meant to stay finished)
 *
 * It answers two different questions:
 *
 *   1. TRANSLATION COVERAGE — for every locale we ship, which keys from
 *      en.json are missing, which are present but still byte-identical to
 *      the English (i.e. copied and not yet translated), and which are
 *      stale keys that no longer exist in the source catalogue.
 *
 *   2. EXTRACTION COVERAGE — whether first-party interface surfaces use
 *      t()/tn()/data-i18n, and whether known message boundaries still pass
 *      raw English. Authored game data and printable source material are a
 *      deliberate boundary; their surrounding controls are still checked.
 *
 * Deliberately dependency-free and read-only: it never rewrites a
 * catalogue, because silently reformatting a translator's file is a good
 * way to lose their work in a merge.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCALES_DIR = path.join(ROOT, 'locales');
const STRICT = process.argv.includes('--strict');

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------

function flatten(obj, prefix = '', out = {}) {
    if (!obj || typeof obj !== 'object') return out;
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue;
        const p = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, p, out);
        else out[p] = Array.isArray(value) ? value.join('\n') : String(value);
    }
    return out;
}

const bar = (ratio, width = 24) => {
    const filled = Math.round(ratio * width);
    return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
};

async function loadCatalog(code) {
    const jsonPath = path.join(LOCALES_DIR, `${code}.json`);
    if (fs.existsSync(jsonPath)) return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const jsPath = path.join(LOCALES_DIR, `${code}.js`);
    if (fs.existsSync(jsPath)) {
        const mod = await import(pathToFileURL(jsPath).href);
        return mod.default ?? mod;
    }
    return null;
}

function walkFiles(dir, filter, out = []) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkFiles(full, filter, out);
        else if (filter(entry.name)) out.push(full);
    }
    return out;
}

// ------------------------------------------------------------
// 1. translation coverage
// ------------------------------------------------------------

async function translationCoverage() {
    const source = flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8')));
    const sourceKeys = Object.keys(source);
    const { LOCALES } = await import(pathToFileURL(path.join(LOCALES_DIR, 'index.js')).href);

    console.log('\n📚 Translation coverage');
    console.log(`   Source catalogue: locales/en.json — ${sourceKeys.length} keys\n`);

    let incomplete = 0;

    for (const locale of LOCALES) {
        if (locale.code === 'en') continue;
        const catalog = await loadCatalog(locale.code);
        if (!catalog) {
            console.log(`   ✗ ${locale.code.padEnd(14)} no catalogue file found in locales/`);
            incomplete++;
            continue;
        }
        const flat = flatten(catalog);
        const missing = sourceKeys.filter(k => !flat[k]);
        const identical = sourceKeys.filter(k => flat[k] && flat[k] === source[k]);
        const stale = Object.keys(flat).filter(k => !(k in source));
        const done = sourceKeys.length - missing.length;
        const ratio = sourceKeys.length ? done / sourceKeys.length : 1;

        const tag = locale.dev ? ' (dev aid)' : '';
        console.log(`   ${ratio === 1 ? '✓' : '·'} ${locale.code.padEnd(14)} ${bar(ratio)} ${String(Math.round(ratio * 100)).padStart(3)}%  ${locale.name}${tag}`);
        if (missing.length) console.log(`       ${missing.length} missing: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', …' : ''}`);
        if (identical.length && !locale.dev) console.log(`       ${identical.length} still identical to English: ${identical.slice(0, 4).join(', ')}${identical.length > 4 ? ', …' : ''}`);
        if (stale.length) console.log(`       ${stale.length} no longer in en.json: ${stale.slice(0, 4).join(', ')}${stale.length > 4 ? ', …' : ''}`);
        if (ratio < 1 && !locale.dev) incomplete++;
    }

    if (LOCALES.filter(l => l.code !== 'en').length === 0) {
        console.log('   (no other languages shipped yet — see TRANSLATION.md to add one)');
    }
    return incomplete;
}

// ------------------------------------------------------------
// 2. extraction coverage
// ------------------------------------------------------------

/** Text in index.html that a user can read but that carries no i18n hook. */
function scanShell() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    // Strip comments, <script>, <style> — none of that is user-facing copy.
    const body = html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '');

    const untranslated = [];
    const tagWithText = /<(\w+)([^>]*)>([^<>]{2,})</g;
    let m;
    while ((m = tagWithText.exec(body))) {
        const [, tag, attrs, text] = m;
        const trimmed = text.trim();
        if (!trimmed) continue;
        if (!/[A-Za-z]{2}/.test(trimmed)) continue;      // emoji/glyph-only nodes
        if (tag.toLowerCase() === 'kbd' || tag.toLowerCase() === 'title') continue;
        if (/data-i18n/.test(attrs)) continue;
        untranslated.push(trimmed.replace(/\s+/g, ' ').slice(0, 60));
    }
    return untranslated;
}

const NON_UI_FILES = /(?:^|\/)(?:tools|tests)(?:\/|$)|(?:^|\/)(?:data|state|constants|engine|region-parser)\.js$/;
const GENERIC_BOUNDARIES = new Set([
    'js/components/Toast.js',
    'js/components/Dice3D.js',
    'js/core/a11y-announce.js',
    'js/core/highlight-tags.js',
    'js/core/i18n.js',
    'js/core/theme-manager.js',
    'js/core/utils.js',
    'js/core/version.js'
]);

/**
 * Scan only modules that actually render UI or emit a user-facing message.
 * Generic sinks (Toast, announce, DOM utility helpers) are checked at their
 * callers, otherwise a translated value passed through a variable looks
 * indistinguishable from raw copy here.
 */
function scanInterface() {
    const files = walkFiles(path.join(ROOT, 'js'), n => n.endsWith('.js'));
    const candidates = [];
    const unhooked = [];
    const rawMessages = [];
    let annotations = 0;
    let calls = 0;

    for (const file of files) {
        const relative = path.relative(ROOT, file);
        if (NON_UI_FILES.test(relative) || GENERIC_BOUNDARIES.has(relative)) continue;
        const src = fs.readFileSync(file, 'utf8');
        const isCandidate = /(?:\.innerHTML\s*=|insertAdjacentHTML\s*\(|\bsetHtml\s*\(|\b(?:showToast|_showToast|confirm|prompt|alert|announce)\s*\(|\.textContent\s*=|\.innerText\s*=)/.test(src);
        if (!isCandidate) continue;
        candidates.push(relative);

        const fileAnnotations = (src.match(/data-i18n(?:-html|-attr)?=/g) || []).length;
        const fileCalls = (src.match(/\b(?:i18nText|i18nPlural|t|tn|translate)\(\s*['"`]/g) || []).length;
        annotations += fileAnnotations;
        calls += fileCalls;
        if (!fileAnnotations && !fileCalls) unhooked.push(relative);

        const rawPatterns = [
            /\b(?:showToast|_showToast|confirm|prompt|alert|announce)\s*\(\s*(['"`])([^\n]*?)\1/g,
            /\.(?:textContent|innerText)\s*=\s*(['"`])([^\n]*?)\1/g
        ];
        for (const pattern of rawPatterns) {
            let match;
            while ((match = pattern.exec(src))) {
                const value = match[2].replace(/\\['"`]/g, '').trim();
                if (!/[A-Za-z]{2}/.test(value)) continue;
                // CSS belongs to presentation, not the language catalogue.
                if (/\{[\s\S]*:[^}]+;/.test(value)) continue;
                const line = src.slice(0, match.index).split('\n').length;
                rawMessages.push({ file: relative, line, value: value.slice(0, 72) });
            }
        }
    }
    return { candidates, unhooked, rawMessages, annotations, calls };
}

// ------------------------------------------------------------

async function main() {
    console.log("Fate's Edge Web Client — i18n report");
    const incomplete = await translationCoverage();

    console.log('\n🧱 Interface extraction');
    const shell = scanShell();
    console.log(`   index.html: ${shell.length === 0 ? 'every visible string is annotated ✓' : `${shell.length} visible string(s) without data-i18n`}`);
    for (const text of shell.slice(0, 12)) console.log(`       "${text}"`);
    if (shell.length > 12) console.log(`       … and ${shell.length - 12} more`);

    const extraction = scanInterface();
    const hooked = extraction.candidates.length - extraction.unhooked.length;
    console.log(`   UI modules: ${hooked}/${extraction.candidates.length} use translation hooks`);
    console.log(`   Extracted hooks: ${extraction.annotations} markup annotations, ${extraction.calls} t()/tn() calls`);
    console.log(`   Raw message boundaries: ${extraction.rawMessages.length === 0 ? 'none ✓' : extraction.rawMessages.length}`);
    for (const item of extraction.rawMessages.slice(0, 12)) {
        console.log(`       ${item.file}:${item.line}  "${item.value}"`);
    }
    if (extraction.rawMessages.length > 12) console.log(`       … and ${extraction.rawMessages.length - 12} more`);
    if (extraction.unhooked.length) {
        console.log('   UI modules without an extraction hook:');
        for (const file of extraction.unhooked.slice(0, 12)) console.log(`       ${file}`);
    }

    console.log('\n   Use the LTR and RTL pseudolocales in Settings → Language to inspect');
    console.log('   extraction, text expansion, and mirrored layout. Anything still in');
    console.log('   plain English has not been through t() yet.\n');

    const extractionGaps = shell.length + extraction.unhooked.length + extraction.rawMessages.length;
    if (STRICT && (incomplete > 0 || extractionGaps > 0)) {
        console.error(`✗ strict check failed: ${incomplete} incomplete locale(s), ${extractionGaps} extraction gap(s).`);
        process.exitCode = 1;
    }
}

main().catch(e => {
    console.error('i18n report failed:', e);
    process.exitCode = 1;
});
