#!/usr/bin/env node
/**
 * One-shot repair for data/wiki.json.
 *
 * The file was assembled by scraping the LaTeX sources, and three kinds of
 * damage survived into the shipped data:
 *
 *  1. TeX escaping leaked into user-visible strings -- `\&` for an
 *     ampersand, ``quoted'' for quotation marks, `---` for an em dash. The
 *     wiki renders these literally.
 *  2. 52 entries had an entire card mashed into the `title` field, with
 *     backslashes where the line breaks used to be:
 *         "Broken Milestone 2 \ On the old Imperial Road \ The stone has
 *          been chiseled seven times... \ Mechanical hook"
 *     The title should be the name; everything after the first separator is
 *     description, and the trailing number is the card's draw number, which
 *     pairs with the entry's existing `suit`.
 *  3. 95 of the 101 patron entries have an empty body. 34 of those have a
 *     matching file in data/patrons/ with real lore that was never pulled
 *     across; the rest are name-only stubs and are now marked as such so
 *     the UI can present them honestly instead of rendering a blank card.
 *
 * Run with --write to apply; default is a dry run.
 *
 *   node js/tools/clean-wiki-data.js [--write]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WIKI = join(ROOT, 'data', 'wiki.json');
const PATRON_DIR = join(ROOT, 'data', 'patrons');

/** Undo the LaTeX escaping and typographic markup left by the scrape. */
export function deTex(value) {
    if (typeof value !== 'string') return value;
    return value
        .replace(/\\([&%$#_{}])/g, '$1')
        .replace(/\\ldots/g, '…')
        .replace(/``([^']*)''/g, '“$1”')
        .replace(/---/g, '—')
        .replace(/(\s)--(\s)/g, '$1–$2')
        .replace(/~/g, ' ')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

/**
 * Pull a trailing draw number off a card name ("Broken Milestone 2").
 * Returns [name, card|null].
 */
function splitCardNumber(title) {
    const m = /^(.*?)[\s]+(\d{1,2})$/.exec(title);
    if (!m) return [title, null];
    const n = Number(m[2]);
    // Card numbers in these decks run 1-13; anything larger is part of the
    // name (e.g. "Legion 100"), so leave it alone.
    if (n < 1 || n > 13) return [title, null];
    return [m[1].trim(), n];
}

function loadPatronFiles() {
    const bySlug = new Map();
    if (!existsSync(PATRON_DIR)) return bySlug;
    for (const file of readdirSync(PATRON_DIR)) {
        if (!file.endsWith('.json') || file === 'manifest.json') continue;
        try {
            const data = JSON.parse(readFileSync(join(PATRON_DIR, file), 'utf8'));
            bySlug.set(file.replace(/\.json$/, ''), data);
        } catch { /* skip unreadable patron file */ }
    }
    return bySlug;
}

/**
 * Bodies carry their own backslash-separated sections, each a
 * "Label: text" pair from a column of the source table ("Price of aid:",
 * "Debt they owe:"). Give each one its own paragraph with the label in
 * bold, so the rendered entry reads as a short structured card instead of
 * one run-on line with stray backslashes in it.
 */
function normalizeBody(body) {
    if (!body || !body.includes('\\')) return body;
    return body
        .split(/\s*\\\s*/)
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
            const m = /^([A-Z][^:]{2,38}):\s*(.+)$/s.exec(part);
            return m ? `**${m[1].trim()}:** ${m[2].trim()}` : part;
        })
        .join('\n\n');
}

const PLACEHOLDER_BODY = /Details not yet extracted from source\.?/i;

export function cleanEntry(entry, patronFiles, stats) {
    const out = { ...entry };

    out.title = deTex(out.title);
    out.body = deTex(out.body || '');
    if (Array.isArray(out.tags)) out.tags = out.tags.map(deTex).filter(Boolean);
    if (out.region) out.region = deTex(out.region);

    // --- 2. Un-mash the scraped card titles -------------------------------
    if (out.title.includes('\\')) {
        const parts = out.title.split(/\s*\\\s*/).map(p => p.trim()).filter(Boolean);
        const [name, card] = splitCardNumber(parts[0] || out.title);
        out.title = name;
        if (card != null) out.card = card;

        // The final fragment is a column heading from the source table --
        // "Mechanical hook" for locations and complications, "Debt they owe"
        // for people, and so on -- and it introduces the text already
        // sitting in `body`. Promote it to a label on the body rather than
        // leaving it stranded at the end of the description.
        const rest = parts.slice(1);
        let label = 'Mechanical hook';
        if (rest.length > 1 && rest[rest.length - 1].length < 40 && !/[.!?]$/.test(rest[rest.length - 1])) {
            label = rest.pop().replace(/:$/, '');
        }
        if (rest.length) {
            out.subtitle = rest[0];
            const detail = rest.slice(1).join(' ');
            const hook = out.body;
            out.body = [detail, hook && `**${label}:** ${hook}`].filter(Boolean).join('\n\n');
        }
        stats.unmashed++;
    } else {
        // --- Titles that carry their own subtitle after an em dash --------
        const dash = out.title.indexOf('—');
        if (dash > 0 && out.title.length - dash > 4) {
            const head = out.title.slice(0, dash).trim();
            const tail = out.title.slice(dash + 1).trim();
            if (head && tail) {
                out.title = head;
                out.subtitle = out.subtitle || tail;
                stats.subtitled++;
            }
        }
        const [name, card] = splitCardNumber(out.title);
        if (card != null) { out.title = name; out.card = card; }
    }

    // --- 3. Patrons: backfill from the real patron files -------------------
    if (out.patron_data) {
        if (PLACEHOLDER_BODY.test(out.body)) out.body = '';
        const file = patronFiles.get(out.patron_data.slug);
        if (file) {
            out.subtitle = out.subtitle || deTex(file.subtitle || '');
            if (!out.body.trim() && file.lore?.description) {
                out.body = deTex(file.lore.description);
                stats.patronsBackfilled++;
            }
            if (Array.isArray(file.tags)) {
                out.tags = [...new Set([...(out.tags || []), ...file.tags])];
            }
            out.patron_data = { ...out.patron_data, hasPage: true };
        }
        if (!out.body.trim() && out.patron_data.domain && out.patron_data.domain !== 'Unknown') {
            out.body = `A patron of ${deTex(out.patron_data.domain)}.`;
        }
    }

    if (!out.body.trim()) {
        // Marked rather than deleted: these are real entries in the setting
        // whose text has not been written yet, and the UI can say so.
        out.stub = true;
        stats.stubs++;
        delete out.body;
    }

    if (out.subtitle) out.subtitle = deTex(out.subtitle);
    if (out.body) out.body = normalizeBody(out.body);
    return out;
}

/** Merge entries that collapse onto the same title once de-escaped. */
function mergeDuplicates(entries, stats) {
    const byKey = new Map();
    for (const e of entries) {
        const key = `${e.category}|${(e.title || '').toLowerCase()}`;
        const existing = byKey.get(key);
        if (!existing) { byKey.set(key, e); continue; }
        // Keep whichever carries more information; fold the other's fields in.
        const score = (x) => (x.body ? x.body.length : 0) + (x.subtitle ? 50 : 0) + (x.tags || []).length;
        const [keep, drop] = score(e) >= score(existing) ? [e, existing] : [existing, e];
        keep.tags = [...new Set([...(keep.tags || []), ...(drop.tags || [])])];
        if (!keep.subtitle && drop.subtitle) keep.subtitle = drop.subtitle;
        if (!keep.body && drop.body) { keep.body = drop.body; delete keep.stub; }
        if (drop.patron_data && keep.patron_data) {
            keep.patron_data = { ...drop.patron_data, ...keep.patron_data };
        }
        byKey.set(key, keep);
        stats.merged++;
    }
    return [...byKey.values()];
}

export function cleanWiki(raw, patronFiles) {
    const stats = { unmashed: 0, subtitled: 0, patronsBackfilled: 0, stubs: 0, merged: 0 };
    const entries = (Array.isArray(raw) ? raw : raw?.data || []).map(e => cleanEntry(e, patronFiles, stats));
    return { entries: mergeDuplicates(entries, stats), stats };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    const write = process.argv.includes('--write');
    const raw = JSON.parse(readFileSync(WIKI, 'utf8'));
    const { entries, stats } = cleanWiki(raw, loadPatronFiles());

    console.log(`${write ? 'WROTE' : 'DRY RUN'} — ${Array.isArray(raw) ? raw.length : '?'} in, ${entries.length} out`);
    console.log(stats);
    const fields = (e) => [e.title, e.subtitle, e.body, ...(e.tags || [])].filter(t => typeof t === 'string');
    const stillBad = entries.filter(e => fields(e).some(t => /\\|``|''|---/.test(t)));
    console.log('entries still carrying scrape artifacts:', stillBad.length);
    if (stillBad.length) console.log(stillBad.slice(0, 3).map(e => e.title));

    if (write) {
        writeFileSync(WIKI, JSON.stringify(entries, null, 2) + '\n', 'utf8');
    } else {
        console.log('\nsample:', JSON.stringify(entries.find(e => e.card), null, 1));
    }
}
