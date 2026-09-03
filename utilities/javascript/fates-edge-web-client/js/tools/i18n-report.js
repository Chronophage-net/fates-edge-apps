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
 *   2. EXTRACTION COVERAGE — how much of the interface has been routed
 *      through t()/data-i18n at all. The app was written in English inline,
 *      so this number starts low and is meant to climb; it is reported
 *      rather than enforced so that adding a feature never fails the build
 *      for not being translated on day one.
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
        const [, , attrs, text] = m;
        const trimmed = text.trim();
        if (!trimmed) continue;
        if (!/[A-Za-z]{2}/.test(trimmed)) continue;      // emoji/glyph-only nodes
        if (/data-i18n/.test(attrs)) continue;
        untranslated.push(trimmed.replace(/\s+/g, ' ').slice(0, 60));
    }
    return untranslated;
}

/** Rough count of literal strings still rendered straight from feature code. */
function scanFeatures() {
    const files = walkFiles(path.join(ROOT, 'js'), n => n.endsWith('.js'));
    let usingT = 0;
    const worst = [];
    for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        const tCalls = (src.match(/\b(?:t|tn|translate)\(\s*['"`]/g) || []).length;
        // Sentence-ish literals: several words, at least one space, letters.
        const literals = (src.match(/['"`][A-Z][a-z]+(?:[^'"`\n]{4,80})['"`]/g) || []).length;
        if (tCalls) usingT++;
        if (literals > 20) worst.push([path.relative(ROOT, file), literals, tCalls]);
    }
    worst.sort((a, b) => b[1] - a[1]);
    return { files: files.length, usingT, worst: worst.slice(0, 10) };
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

    const feat = scanFeatures();
    console.log(`   js/: ${feat.usingT}/${feat.files} modules call t()`);
    if (feat.worst.length) {
        console.log('   Largest pockets of inline English (translate these next):');
        for (const [file, literals, tCalls] of feat.worst) {
            console.log(`       ${String(literals).padStart(4)} literals, ${tCalls} t() calls  ${file}`);
        }
    }

    console.log('\n   Switch to the "Pseudo (translation test)" locale in Settings → Language');
    console.log('   to see which of these are actually on screen. Anything still in plain');
    console.log('   English there has not been through t() yet.\n');

    if (STRICT && incomplete > 0) {
        console.error(`✗ ${incomplete} locale(s) incomplete (--strict).`);
        process.exitCode = 1;
    }
}

main().catch(e => {
    console.error('i18n report failed:', e);
    process.exitCode = 1;
});
