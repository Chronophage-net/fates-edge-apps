#!/usr/bin/env node
/**
 * Extract first-party UI into the English catalogue.
 *
 * This is intentionally conservative. It annotates short, static text in
 * control-like HTML elements and wraps strings passed to known user-facing
 * message APIs. It does not touch data files, rules prose, fetched content,
 * or arbitrary string literals merely because they happen to be English.
 *
 *   node js/tools/i18n-extract-features.js          # preview
 *   node js/tools/i18n-extract-features.js --write  # update source + en.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { simple as walk } from 'acorn-walk';
import MagicString from 'magic-string';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FEATURE_ROOT = path.join(ROOT, 'js', 'features');
const CATALOG_PATH = path.join(ROOT, 'locales', 'en.json');
const WRITE = process.argv.includes('--write');
const ONLY = process.argv.find(arg => arg.startsWith('--only='))?.slice('--only='.length) || null;
const MESSAGE_CALLEES = new Set(['showToast', '_showToast', 'confirm', 'prompt', 'alert', 'announce']);
const TRANSLATED_ATTRIBUTES = new Set(['title', 'placeholder', 'aria-label']);
const ALWAYS_TEXT_TAGS = new Set(['button', 'label', 'option', 'h1', 'h2', 'h3', 'h4', 'legend', 'summary', 'th', 'caption']);
const UI_CLASS_RE = /(?:^|[-_\s])(label|title|subtitle|hint|status|badge|empty-state|page-sub|text-muted|btn)(?:$|[-_\s])/i;

function walkFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkFiles(full, out);
        else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

function namespaceFor(file) {
    const relative = path.relative(path.join(ROOT, 'js'), file).replace(/\.js$/, '').split(path.sep);
    if (relative[0] === 'features') relative.shift();
    if (relative.at(-1) === 'index') relative.pop();
    return relative.join('.') || 'feature';
}

function sourceFiles() {
    const files = walkFiles(FEATURE_ROOT);
    const shared = [
        'js/app.js',
        'js/feature-flags.js',
        'js/router.js',
        'js/module-loader.js',
        ...walkFiles(path.join(ROOT, 'js', 'components')).map(file => path.relative(ROOT, file)),
        'js/core/local-lock.js',
        'js/core/media.js',
        'js/core/pack-manager.js',
        'js/core/password.js',
        'js/core/product-tour.js',
        'js/core/sync/index.js',
        'js/core/websocket.js'
    ];
    for (const relative of shared) {
        const file = path.isAbsolute(relative) ? relative : path.join(ROOT, relative);
        if (fs.existsSync(file)) files.push(file);
    }
    return [...new Set(files)].sort();
}

function wordsForKey(text) {
    const words = text
        .replace(/&[a-zA-Z#0-9]+;/g, ' ')
        .replace(/\{\{\s*\w+\s*\}\}/g, ' value ')
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 7);
    if (!words.length) return 'message';
    return words[0].toLowerCase() + words.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join('');
}

function shortHash(text) {
    let hash = 5381;
    for (const ch of text) hash = ((hash << 5) ^ hash ^ ch.charCodeAt(0)) >>> 0;
    return hash.toString(36).slice(0, 5);
}

function normalizeText(text) {
    return text
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

function shouldExtractText(tag, attrs, text) {
    if (!/[A-Za-z]{2}/.test(text) || text.length > 140) return false;
    if (ALWAYS_TEXT_TAGS.has(tag)) return true;
    const classMatch = attrs.match(/class=(['"])(.*?)\1/i);
    return !!(classMatch && UI_CLASS_RE.test(classMatch[2]));
}

function calleeName(callee) {
    if (callee?.type === 'Identifier') return callee.name;
    if (callee?.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier') {
        return callee.property.name;
    }
    return null;
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
catalog.feature ||= {};
const catalogValues = new Map(Object.entries(catalog.feature).map(([key, value]) => [value, key]));

function keyFor(namespace, english) {
    const scopedValue = `${namespace}\u0000${english}`;
    if (catalogValues.has(scopedValue)) return `feature.${catalogValues.get(scopedValue)}`;

    const base = `${namespace}.${wordsForKey(english)}`;
    let localKey = base;
    if (catalog.feature[localKey] && catalog.feature[localKey] !== english) {
        localKey = `${base}_${shortHash(english)}`;
    }
    catalog.feature[localKey] = english;
    catalogValues.set(scopedValue, localKey);
    return `feature.${localKey}`;
}

// Seed a namespace-aware reverse map for idempotent runs. Values alone are
// not unique ("Save" appears in many features), hence the namespaced key.
for (const [localKey, value] of Object.entries(catalog.feature)) {
    const namespace = localKey.split('.').slice(0, -1).join('.');
    catalogValues.set(`${namespace}\u0000${value}`, localKey);
}

function addAttributeSpec(openingTag, attribute, key) {
    const existing = openingTag.match(/\sdata-i18n-attr=(['"])(.*?)\1/i);
    if (existing) {
        const addition = `${attribute}:${key}`;
        if (existing[2].split(';').includes(addition)) return openingTag;
        return openingTag.replace(existing[0], ` data-i18n-attr=${existing[1]}${existing[2]};${addition}${existing[1]}`);
    }
    return openingTag.replace(/>$/, ` data-i18n-attr="${attribute}:${key}">`);
}

function annotateOpeningTags(segment, namespace) {
    return segment.replace(/<[A-Za-z][^<>]*>/g, openingTag => {
        if (openingTag.startsWith('</') || openingTag.startsWith('<!--')) return openingTag;
        let next = openingTag;
        for (const attribute of TRANSLATED_ATTRIBUTES) {
            const re = new RegExp(`\\s${attribute}=(['"])([^'"$<{]{2,})\\1`, 'i');
            const match = next.match(re);
            if (!match || !/[A-Za-z]{2}/.test(match[2])) continue;
            next = addAttributeSpec(next, attribute, keyFor(namespace, normalizeText(match[2])));
        }
        return next;
    });
}

function annotateTextElements(segment, namespace) {
    return segment.replace(/<([A-Za-z][\w-]*)([^<>]*?)>([^<>{}\n]*[A-Za-z][^<>{}\n]*)<\/\1>/g,
        (whole, rawTag, attrs, rawText) => {
            if (/\bdata-i18n(?:-html)?=/.test(attrs)) return whole;
            const tag = rawTag.toLowerCase();
            const english = normalizeText(rawText);
            if (!shouldExtractText(tag, attrs, english)) return whole;
            const leading = rawText.match(/^\s*/)?.[0] || '';
            const trailing = rawText.match(/\s*$/)?.[0] || '';
            return `<${rawTag}${attrs} data-i18n="${keyFor(namespace, english)}">${leading}${english}${trailing}</${rawTag}>`;
        });
}

function annotateHtml(segment, namespace) {
    return annotateTextElements(annotateOpeningTags(segment, namespace), namespace);
}

function messagePattern(node) {
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return { english: node.value, params: null };
    }
    if (node.type === 'TemplateLiteral') {
        let english = '';
        for (let i = 0; i < node.quasis.length; i++) {
            english += node.quasis[i].value.cooked ?? node.quasis[i].value.raw;
            if (i < node.expressions.length) english += `{{value${i}}}`;
        }
        return { english, params: node.expressions };
    }
    if (node.type !== 'BinaryExpression' || node.operator !== '+') return null;

    // Older UI code often assembled a message with `"Prefix: " + value`.
    // Flatten only string concatenation trees; opaque expressions become
    // whole placeholders so translators can move them without inheriting
    // English punctuation or word fragments.
    let english = '';
    const params = [];
    const append = part => {
        if (part.type === 'Literal' && typeof part.value === 'string') {
            english += part.value;
        } else if (part.type === 'TemplateLiteral') {
            for (let i = 0; i < part.quasis.length; i++) {
                english += part.quasis[i].value.cooked ?? part.quasis[i].value.raw;
                if (i < part.expressions.length) {
                    english += `{{value${params.length}}}`;
                    params.push(part.expressions[i]);
                }
            }
        } else if (part.type === 'BinaryExpression' && part.operator === '+') {
            append(part.left);
            append(part.right);
        } else {
            english += `{{value${params.length}}}`;
            params.push(part);
        }
    };
    append(node);
    return { english, params };
}

function looksLikeStylesheet(text) {
    return /\{[\s\S]*:[^}]+;/.test(text)
        && /^\s*(?:\/\*|@(?:keyframes|media)|[#.])/.test(text);
}

function translatedExpression(source, node, namespace) {
    const message = messagePattern(node);
    if (!message || !/[A-Za-z]{2}/.test(message.english)) return null;
    const key = keyFor(namespace, normalizeText(message.english));
    const fallback = JSON.stringify(message.english);
    if (!message.params?.length) return `i18nText(${JSON.stringify(key)}, null, ${fallback})`;
    const params = message.params
        .map((expression, i) => `value${i}: ${source.slice(expression.start, expression.end)}`)
        .join(', ');
    return `i18nText(${JSON.stringify(key)}, { ${params} }, ${fallback})`;
}

let changedFiles = 0;
let annotationCount = 0;
let messageCount = 0;

for (const file of sourceFiles()) {
    if (ONLY && !path.relative(ROOT, file).includes(ONLY)) continue;
    // These are authored rules/content or non-visual engines, not interface.
    if (/(?:^|\/)(?:data|state|constants|engine|region-parser|character-pdf)\.js$/.test(file)) continue;

    const source = fs.readFileSync(file, 'utf8');
    let ast;
    try {
        ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch (error) {
        console.warn(`Skipping ${path.relative(ROOT, file)}: ${error.message}`);
        continue;
    }

    const namespace = namespaceFor(file);
    const edits = new MagicString(source);
    let fileAnnotations = 0;
    let fileMessages = 0;

    walk(ast, {
        TemplateLiteral(node) {
            for (const quasi of node.quasis) {
                const raw = source.slice(quasi.start, quasi.end);
                if (!raw.includes('<')) continue;
                const annotated = annotateHtml(raw, namespace);
                if (annotated !== raw) {
                    edits.overwrite(quasi.start, quasi.end, annotated);
                    fileAnnotations += (annotated.match(/data-i18n(?:-attr)?=/g) || []).length
                        - (raw.match(/data-i18n(?:-attr)?=/g) || []).length;
                }
            }
        },
        CallExpression(node) {
            if (!MESSAGE_CALLEES.has(calleeName(node.callee)) || !node.arguments[0]) return;
            const replacement = translatedExpression(source, node.arguments[0], namespace);
            if (!replacement) return;
            edits.overwrite(node.arguments[0].start, node.arguments[0].end, replacement);
            fileMessages++;
        },
        AssignmentExpression(node) {
            if (node.left?.type !== 'MemberExpression' || node.left.computed) return;
            const property = node.left.property?.name;
            if (!['textContent', 'innerText'].includes(property)) return;
            const message = messagePattern(node.right);
            if (message && (message.english.length > 500 || looksLikeStylesheet(message.english))) return;
            const replacement = translatedExpression(source, node.right, namespace);
            if (!replacement) return;
            edits.overwrite(node.right.start, node.right.end, replacement);
            fileMessages++;
        }
    });

    if (!fileAnnotations && !fileMessages) continue;
    if (fileMessages) {
        const importLine = "import { t as i18nText } from '@core/i18n.js';\n";
        if (!source.includes("t as i18nText") && !source.includes('i18nText }')) {
            const firstImport = ast.body.find(node => node.type === 'ImportDeclaration');
            edits.appendLeft(firstImport?.start ?? 0, importLine);
        }
    }

    const output = edits.toString();
    changedFiles++;
    annotationCount += fileAnnotations;
    messageCount += fileMessages;
    console.log(`${WRITE ? 'updated' : 'would update'} ${path.relative(ROOT, file)} (${fileAnnotations} annotations, ${fileMessages} messages)`);
    if (WRITE) fs.writeFileSync(file, output);
}

if (WRITE) {
    const ordered = Object.fromEntries(Object.entries(catalog.feature).sort(([a], [b]) => a.localeCompare(b)));
    catalog.feature = ordered;
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
}

console.log(`\n${WRITE ? 'Updated' : 'Would update'} ${changedFiles} files: ${annotationCount} annotations, ${messageCount} messages.`);
console.log(`${WRITE ? 'English catalogue now has' : 'Would produce'} ${Object.keys(catalog.feature).length} extracted feature strings.`);
