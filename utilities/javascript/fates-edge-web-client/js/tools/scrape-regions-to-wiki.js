#!/usr/bin/env node
/**
 * Scrape region JSON files and update data/wiki.json with region entries.
 *
 * Usage:
 *   node scripts/scrape-regions-to-wiki.js
 *
 * Reads:
 *   - data/regions/*.json  (all region files)
 *   - data/wiki.json       (existing wiki — entries with category "regions",
 *                            "people", "factions", "locations", "mechanics",
 *                            "lore" that have region tags are replaced)
 *
 * Writes:
 *   - data/wiki.json       (updated with new/refreshed region entries)
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Helpers ────────────────────────────────────────────────────────

function loadJson(path) {
    return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveJson(path, data) {
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Strip HTML tags and LaTeX-like markup from the description field
 * to produce readable plain text for wiki entries.
 */
function stripMarkup(html) {
    let text = html;

    // Remove HTML wrapper tags
    text = text.replace(/<div[^>]*>/g, '');
    text = text.replace(/<\/div>/g, '\n');
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/g, '$1\n');
    text = text.replace(/<hr[^>]*>/g, '\n');

    // Extract paragraph texts
    const paragraphs = [];
    const pRegex = /<p class="region-text">(.*?)<\/p>/gs;
    let m;
    while ((m = pRegex.exec(text)) !== null) {
        paragraphs.push(m[1].trim());
    }
    if (paragraphs.length === 0) {
        text = text.replace(/<[^>]+>/g, '\n');
        paragraphs.push(...text.split('\n').map(l => l.trim()).filter(Boolean));
    }

    // Join and clean
    let plain = paragraphs.join('\n');

    // Remove LaTeX-like markers
    plain = plain.replace(/\[colback=[^,\]]+,colframe=[^,\]]+,title=\{([^,]+),breakable\]/g, '$1\n');
    plain = plain.replace(/\*{/g, '');
    plain = plain.replace(/\\(?!-)/g, '');
    plain = plain.replace(/``([^']*?)''/g, '"$1"');
    plain = plain.replace(/---/g, '\u2014');
    plain = plain.replace(/--/g, '\u2013');
    plain = plain.replace(/tabular\{[^}]*\}/g, '');
    plain = plain.replace(/longtable\{[^}]*\}/g, '');
    plain = plain.replace(/\btabular\b/g, '');
    plain = plain.replace(/\blongtable\b/g, '');
    plain = plain.replace(/\bitemize\b/g, '');
    plain = plain.replace(/\benumerate\b/g, '');
    plain = plain.replace(/\bdescription\b(?:\[[^\]]*\])?/g, '');
    plain = plain.replace(/\bquote\b/g, '');

    // Clean up
    plain = plain.replace(/&/g, ' | ');
    plain = plain.replace(/\s+/g, ' ');
    plain = plain.trim();

    return plain;
}

/**
 * Extract a field from plain text by looking for a label pattern.
 */
function extractField(text, label) {
    const patterns = [
        new RegExp(`${label}:\\s*(.+?)(?=\\s+(?:Genre|Starting|What you|The one|Regional|The Curse|Curse Stirrs|Prominent|Names|The Ninth|Entanglements|Quick Reference|Core Conflict|Current Hook|The One Thing|The Ninth Taboo|The Price|Faction|Key Demograph|$))`, 'i'),
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1].trim();
    }
    return null;
}

/**
 * Extract NPCs from the description by finding the longtable rows.
 */
function extractNpcs(description, regionSlug) {
    const npcs = [];
    const pRegex = /<p class="region-text">(.*?)<\/p>/gs;
    let m;
    let inNpcTable = false;
    let headerSeen = false;

    while ((m = pRegex.exec(description)) !== null) {
        const line = m[1].trim();

        // Detect NPC table start (longtable with Name column)
        if (line.match(/^(?:longtable|tabular)\{/)) {
            inNpcTable = true;
            headerSeen = false;
            continue;
        }
        if (line === 'longtable' || line === 'tabular') {
            inNpcTable = false;
            continue;
        }

        if (inNpcTable) {
            if (!headerSeen) {
                // Skip header row (contains "Name", "Role/Title", etc.)
                if (/Name/i.test(line) && /Role|Title/i.test(line)) {
                    headerSeen = true;
                    continue;
                }
            }

            // Parse NPC row: Name & Role & Motivation & Quirk
            const cells = line.split('&').map(c => c.trim());
            if (cells.length >= 3 && cells[0].length > 0) {
                const name = cells[0].replace(/``([^']*?)''/g, '"$1"').replace(/---/g, '\u2014').replace(/--/g, '\u2013');
                const role = (cells[1] || '').replace(/``([^']*?)''/g, '"$1"').replace(/---/g, '\u2014').replace(/--/g, '\u2013');
                const motivation = (cells[2] || '').replace(/``([^']*?)''/g, '"$1"').replace(/---/g, '\u2014').replace(/--/g, '\u2013');
                const quirk = (cells[3] || '').replace(/``([^']*?)''/g, '"$1"').replace(/---/g, '\u2014').replace(/--/g, '\u2013');

                npcs.push({
                    name: name.replace(/["""]/g, '').trim(),
                    role: role.replace(/["""]/g, '').trim(),
                    motivation: motivation.replace(/["""]/g, '').trim(),
                    quirk: quirk.replace(/["""]/g, '').trim(),
                });
            }
        }
    }

    return npcs;
}

/**
 * Extract factions from the description by finding tabular rows.
 */
function extractFactions(description) {
    const factions = [];
    const pRegex = /<p class="region-text">(.*?)<\/p>/gs;
    let m;
    let inFactionTable = false;
    let headerSeen = false;

    while ((m = pRegex.exec(description)) !== null) {
        const line = m[1].trim();

        if (line.match(/^(?:tabular|longtable)\{/)) {
            // Check if this is a faction table (has "Faction" and "Goal" in header)
            inFactionTable = true;
            headerSeen = false;
            continue;
        }
        if (line === 'tabular' || line === 'longtable') {
            inFactionTable = false;
            continue;
        }

        if (inFactionTable) {
            if (!headerSeen) {
                if (/Faction/i.test(line) && /Goal/i.test(line)) {
                    headerSeen = true;
                    continue;
                }
                // Also skip if it looks like column headers
                if (/Method/i.test(line) || /Why players/i.test(line)) {
                    headerSeen = true;
                    continue;
                }
            }

            const cells = line.split('&').map(c => c.trim());
            if (cells.length >= 3 && cells[0].length > 0 && !cells[0].match(/^tabular|^longtable/)) {
                factions.push({
                    name: cells[0].replace(/``([^']*?)''/g, '"$1"').replace(/---/g, '\u2014').replace(/--/g, '\u2013').trim(),
                    goal: (cells[1] || '').replace(/``([^']*?)''/g, '"$1"').replace(/---/g, '\u2014').replace(/--/g, '\u2013').trim(),
                    method: (cells[2] || '').replace(/``([^']*?)''/g, '"$1"').replace(/---/g, '\u2014').replace(/--/g, '\u2013').trim(),
                    playerInterest: (cells[3] || '').replace(/``([^']*?)''/g, '"$1"').replace(/---/g, '\u2014').replace(/--/g, '\u2013').trim(),
                });
            }
        }
    }

    return factions;
}

/**
 * Extract quotes from the description.
 */
function extractQuotes(description) {
    const quotes = [];
    const pRegex = /<p class="region-text">(.*?)<\/p>/gs;
    let m;

    while ((m = pRegex.exec(description)) !== null) {
        const line = m[1].trim();
        const quoteMatch = line.match(/^quote\s+([^:]+):\s*"([\s\S]*?)"\s+quote$/);
        if (quoteMatch) {
            quotes.push({
                speaker: quoteMatch[1].trim(),
                text: quoteMatch[2].trim(),
            });
        }
    }
    return quotes;
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
    const regionsDir = join(ROOT, 'data', 'regions');
    const wikiPath = join(ROOT, 'data', 'wiki.json');

    // Load existing wiki
    let wiki = [];
    try {
        wiki = loadJson(wikiPath);
        console.log(`Loaded ${wiki.length} existing wiki entries`);
    } catch (e) {
        console.warn('No existing wiki.json found, starting fresh');
    }

    // Find max existing ID
    let maxId = wiki.reduce((max, e) => Math.max(max, e.id || 0), 0);

    // Collect region tags to identify auto-generated entries for removal
    const regionSlugs = new Set();

    // Read all region files
    const files = readdirSync(regionsDir).filter(f => f.endsWith('.json') && f !== 'manifest.json');
    console.log(`Found ${files.length} region files`);

    // Parse each region and generate wiki entries
    const newEntries = [];

    for (const file of files) {
        const filePath = join(regionsDir, file);
        let region;
        try {
            region = loadJson(filePath);
        } catch (e) {
            console.warn(`Failed to parse ${file}: ${e.message}`);
            continue;
        }

        const slug = region.slug || file.replace(/\.json$/, '');
        const name = region.name || slug.charAt(0).toUpperCase() + slug.slice(1);
        regionSlugs.add(slug);

        console.log(`  Processing region: ${name} (${slug})`);

        const plainDesc = stripMarkup(region.description || '');

        // Extract key fields
        const demographic = extractField(plainDesc, 'Key Demographics?') || extractField(plainDesc, 'Key Demographic');
        const tagline = extractField(plainDesc, 'Tagline') || extractField(plainDesc, 'Quick Reference Tagline');
        const genre = extractField(plainDesc, 'Genre / Mood') || extractField(plainDesc, 'Genre/Mood');
        const startingLocation = extractField(plainDesc, 'Starting Location');
        const coreConflict = extractField(plainDesc, 'Core Conflict');
        const currentHook = extractField(plainDesc, 'Current Hook');
        const theOneThing = extractField(plainDesc, 'The One Thing Only This Region Does');

        // Build region overview body
        let body = `${name} is a region in the world of Fate's Edge.`;
        if (demographic) body += ` Key Demographic: ${demographic}.`;
        if (tagline) body += ` Tagline: "${tagline}"`;
        if (coreConflict) body += ` Core Conflict: ${coreConflict}`;
        if (theOneThing) body += ` Signature Feature: ${theOneThing}`;
        if (genre) body += ` Genre/Mood: ${genre}`;

        // Region overview entry
        newEntries.push({
            id: ++maxId,
            title: `${name}${region.metadata?.source_file ? '' : ''}`,
            category: 'regions',
            body,
            tags: ['region', slug, name.toLowerCase().replace(/\s+/g, '-')],
        });

        // NPC entries
        const npcs = extractNpcs(region.description || '', slug);
        for (const npc of npcs) {
            if (!npc.name || npc.name.length < 2) continue;
            let npcBody = `${npc.name}`;
            if (npc.role) npcBody += ` is ${npc.role}.`;
            if (npc.motivation) npcBody += ` Motivation: ${npc.motivation}`;
            if (npc.quirk) npcBody += ` Rumored Quirk: ${npc.quirk}`;

            newEntries.push({
                id: ++maxId,
                title: npc.name,
                category: 'people',
                body: npcBody,
                tags: [slug, 'npc', npc.role?.toLowerCase().replace(/[^a-z\s]/g, '').trim()].filter(Boolean),
            });
        }

        // Faction entries
        const factions = extractFactions(region.description || '');
        for (const faction of factions) {
            if (!faction.name || faction.name.length < 2) continue;
            let factionBody = `${faction.name}`;
            if (faction.goal) factionBody += ` — Goal: ${faction.goal}.`;
            if (faction.method) factionBody += ` Method: ${faction.method}.`;
            if (faction.playerInterest) factionBody += ` Why players care: ${faction.playerInterest}`;

            newEntries.push({
                id: ++maxId,
                title: faction.name,
                category: 'factions',
                body: factionBody,
                tags: [slug, 'faction'],
            });
        }

        // Quotes as lore entries
        const quotes = extractQuotes(region.description || '');
        for (const q of quotes) {
            newEntries.push({
                id: ++maxId,
                title: `${q.speaker} (${name})`,
                category: 'lore',
                body: `"${q.text}" — ${q.speaker}, ${name}`,
                tags: [slug, 'quote', 'voice'],
            });
        }

        // Starting location entry
        if (startingLocation && startingLocation.length > 20) {
            newEntries.push({
                id: ++maxId,
                title: `Starting Location (${name})`,
                category: 'locations',
                body: startingLocation,
                tags: [slug, 'starting location'],
            });
        }

        // Curse/Mechanics entries — look for timer patterns
        const curseMatch = plainDesc.match(/(Curse of [A-Z][a-z]+|Curse Awakening)\s*\[(\d+)\]/);
        if (curseMatch) {
            const curseName = curseMatch[1];
            const timerSize = curseMatch[2];
            const curseDesc = extractField(plainDesc, curseName) ||
                `A campaign timer of size [${timerSize}]. Advances on broken promises, unpaid tolls, and ignored omens.`;

            newEntries.push({
                id: ++maxId,
                title: `${curseName} (${name})`,
                category: 'mechanics',
                body: curseDesc,
                tags: [slug, 'curse', 'timer', 'mechanics'],
            });
        }

        // Ninth Taboo entry (if present)
        const ninthMatch = plainDesc.match(/(?:Ninth Taboo|ninth toll|ninth cup|ninth citation)[^.]*\./gi);
        if (ninthMatch && ninthMatch.length > 0) {
            newEntries.push({
                id: ++maxId,
                title: `The Ninth Taboo (${name})`,
                category: 'lore',
                body: ninthMatch.join(' '),
                tags: [slug, 'ninth', 'taboo', 'hollow'],
            });
        }

        // Tags from region JSON
        if (region.tags) {
            // Add a lore entry for the region's tag list
            const regionTags = region.tags.filter(t =>
                !['region', slug].includes(t.toLowerCase())
            );
            if (regionTags.length > 0) {
                // Already covered by individual entries, skip
            }
        }
    }

    // Remove old auto-generated entries that have region slugs as tags
    // Keep entries that are NOT region-generated (i.e., don't have any region slug as a tag)
    const regionSlugArray = [...regionSlugs];
    const kept = wiki.filter(entry => {
        if (!entry.tags) return true;
        // Keep if none of its tags match a region slug
        return !entry.tags.some(t => regionSlugArray.includes(t.toLowerCase()));
    });

    // Also keep entries in categories that aren't region-related
    const nonRegionCategories = ['assets', 'combat', 'equipment', 'rules', 'patrons', 'talents'];
    const manual = wiki.filter(entry =>
        nonRegionCategories.includes(entry.category) ||
        (!entry.tags || !entry.tags.some(t => regionSlugArray.includes(t.toLowerCase())))
    );

    // Deduplicate: use the "kept" + manual approach
    const finalKept = wiki.filter(entry => {
        // Always keep non-region categories
        if (nonRegionCategories.includes(entry.category)) return true;
        // Keep entries without region tags
        if (!entry.tags) return true;
        return !entry.tags.some(t => regionSlugArray.includes(t.toLowerCase()));
    });

    // Merge: kept entries + new entries
    const merged = [...finalKept, ...newEntries];

    // Re-number IDs to be sequential (optional — keeps existing IDs for non-region entries)
    // Actually, let's keep existing IDs for kept entries and use new IDs for new entries

    // Sort by ID
    merged.sort((a, b) => (a.id || 0) - (b.id || 0));

    // Save
    saveJson(wikiPath, merged);
    console.log(`\nWiki updated: ${merged.length} entries (${finalKept.length} kept, ${newEntries.length} new from regions)`);
    console.log(`Written to: ${wikiPath}`);
}

main();
