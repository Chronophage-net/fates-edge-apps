/** Regression checks for the extracted first-party interface catalogue. */

import { describe, it, assertEqual } from '../runner.js';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { simple as walk } from 'acorn-walk';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const catalog = JSON.parse(readFileSync(path.join(ROOT, 'locales', 'en.json'), 'utf8'));

function flatten(value, prefix = '', out = {}) {
    for (const [key, child] of Object.entries(value || {})) {
        if (key.startsWith('$')) continue;
        const full = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, full, out);
        else out[full] = child;
    }
    return out;
}

function jsFiles(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) jsFiles(file, out);
        else if (entry.name.endsWith('.js')) out.push(file);
    }
    return out;
}

const english = flatten(catalog);

describe('i18n: extracted interface catalogue', () => {
    it('contains every literal key used by JavaScript translation calls and annotations', () => {
        const missing = [];
        const translationCallees = new Set(['t', 'tn', 'translate', 'i18nText', 'i18nPlural']);

        for (const file of jsFiles(path.join(ROOT, 'js'))) {
            if (file.includes(`${path.sep}tools${path.sep}`)) continue;
            const relative = path.relative(ROOT, file);
            const source = readFileSync(file, 'utf8');
            const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });

            walk(ast, {
                CallExpression(node) {
                    if (node.callee?.type !== 'Identifier' || !translationCallees.has(node.callee.name)) return;
                    const key = node.arguments[0];
                    if (key?.type !== 'Literal' || typeof key.value !== 'string') return;
                    const plural = node.callee.name === 'tn' || node.callee.name === 'i18nPlural';
                    if (!(key.value in english) && !(plural && `${key.value}.other` in english)) {
                        missing.push(`${relative}: ${key.value}`);
                    }
                }
            });

            for (const match of source.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) {
                if (!(match[1] in english)) missing.push(`${relative}: ${match[1]}`);
            }
            for (const match of source.matchAll(/data-i18n-attr="([^"]+)"/g)) {
                for (const pair of match[1].split(';')) {
                    const key = pair.slice(pair.indexOf(':') + 1).trim();
                    if (key && !(key in english)) missing.push(`${relative}: ${key}`);
                }
            }
        }

        assertEqual(missing.length, 0, `translation keys missing from en.json:\n  ${missing.join('\n  ')}`);
    });

    it('does not contain stylesheet blocks mistaken for interface copy', () => {
        const bad = Object.entries(english).filter(([, value]) =>
            typeof value === 'string'
            && /\{[\s\S]*:[^}]+;/.test(value)
            && /^\s*(?:\/\*|@(?:keyframes|media)|[#.])/.test(value)
        );
        assertEqual(bad.length, 0, `stylesheet values in catalogue: ${bad.map(([key]) => key).join(', ')}`);
    });

    it('does not assemble English word endings with placeholders', () => {
        const bad = Object.entries(english).filter(([, value]) =>
            typeof value === 'string'
            && /[A-Za-z]\{\{\w+\}\}|\{\{\w+\}\}[A-Za-z]/.test(value)
        );
        assertEqual(bad.length, 0, `word-fragment placeholders: ${bad.map(([key]) => key).join(', ')}`);
    });
});
