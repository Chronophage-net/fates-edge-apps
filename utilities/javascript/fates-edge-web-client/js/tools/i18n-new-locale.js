#!/usr/bin/env node
/**
 * Scaffolds a new translation.
 *
 *   npm run i18n:new -- fr "French" "Français"
 *   npm run i18n:new -- ar "Arabic" "العربية" --rtl
 *
 * Writes locales/<code>.json with the full key structure of en.json and the
 * English text left in place as the starting point — a translator then
 * overwrites values, and `npm run i18n:report` shows what is still
 * untouched. Never overwrites an existing file.
 *
 * It deliberately does NOT edit locales/index.js: registering the language
 * is a one-line, reviewable change that should be made by a human who can
 * see it in the diff. The exact line to add is printed at the end.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCALES_DIR = path.join(ROOT, 'locales');

const args = process.argv.slice(2).filter(a => a !== '--rtl');
const rtl = process.argv.includes('--rtl');
const [code, name, nativeName] = args;

if (!code) {
    console.error('Usage: npm run i18n:new -- <code> "<English name>" "<Native name>" [--rtl]');
    console.error('Example: npm run i18n:new -- fr "French" "Français"');
    process.exit(1);
}

const target = path.join(LOCALES_DIR, `${code}.json`);
if (fs.existsSync(target)) {
    console.error(`locales/${code}.json already exists — refusing to overwrite it.`);
    process.exit(1);
}

const source = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
source.$meta = {
    code,
    name: name || code,
    nativeName: nativeName || name || code,
    dir: rtl ? 'rtl' : 'ltr',
    note: 'Translate the VALUES only. Leave key names, {{placeholders}} and any HTML tags exactly as they are.',
};

fs.writeFileSync(target, JSON.stringify(source, null, 2) + '\n', 'utf8');

console.log(`✅ Created locales/${code}.json (a copy of English — translate the values).`);
console.log('\nNow add these two lines to locales/index.js:\n');
console.log(`   LOCALES:  { code: '${code}', name: '${name || code}', nativeName: '${nativeName || name || code}', dir: '${rtl ? 'rtl' : 'ltr'}' },`);
console.log(`   LOADERS:  '${code}': () => import('./${code}.json', { with: { type: 'json' } }),\n`);
console.log('Then run `npm run i18n:report` to track what is left.');
