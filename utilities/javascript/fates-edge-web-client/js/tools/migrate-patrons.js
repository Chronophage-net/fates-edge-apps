#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATRONS_DIR = path.resolve(__dirname, '../../data/patrons');

// Read all JSON files
const files = fs.readdirSync(PATRONS_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');

let updatedCount = 0;

for (const file of files) {
    const filePath = path.join(PATRONS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const patron = JSON.parse(content);

    let modified = false;

    // 1. Ensure witchcraft section exists
    if (!patron.witchcraft) {
        patron.witchcraft = {
            name: `Witchcraft of ${patron.title || patron.id}`,
            description: `Hedge magic and threshold work associated with ${patron.title || patron.id}.`,
            color: '#8e44ad',
            lore: `The witches who follow ${patron.title || patron.id} work at the edges of their domain.`,
            signature_rite: patron.rites?.[0]?.name || 'Unknown',
            quote: patron.lore?.quote || 'The hedge remembers.',
            hedge_gifts: [
                {
                    name: 'Gift of the Threshold',
                    xp: 2,
                    description: `A small gift granted by ${patron.title || patron.id}.`
                }
            ]
        };
        modified = true;
    }

    // 2. Ensure monastic_tradition section exists (optional, only if we want to add)
    // We'll add only if there's a reasonable amount of lore to build from.
    // For safety, we only add if the patron has a domain_focus or playstyle_notes.
    if (!patron.monastic_tradition && patron.domain_focus && patron.domain_focus.length > 0) {
        const traditionName = `The Way of ${patron.title || patron.id}`;
        patron.monastic_tradition = {
            name: traditionName,
            description: `A monastic tradition that embodies the principles of ${patron.title || patron.id}.`,
            color: '#f39c12',
            quote: patron.lore?.quote || 'Stillness is the greatest disguise.',
            techniques: {
                basic: {
                    name: `${traditionName} Stance`,
                    xp: 6,
                    description: `You learn to move with the patience of ${patron.title || patron.id}.`,
                    prereq: 'Body 2+'
                },
                advanced: {
                    name: `${traditionName} Mastery`,
                    xp: 8,
                    description: `You embody the deeper teachings of ${patron.title || patron.id}.`,
                    prereq: 'Tier II, Spirit 3+'
                },
                master: {
                    name: `The ${traditionName} of Stillness`,
                    xp: 12,
                    description: `You become a living embodiment of ${patron.title || patron.id}'s principles.`,
                    prereq: 'Tier III'
                }
            },
            corruption: [
                { tier: 1, benefit: '+1 die to actions aligned with the tradition.', cost: 'Minor quirk.' },
                { tier: 2, benefit: 'Gain a second benefit.', cost: 'Increased burden.' },
                { tier: 3, benefit: 'A significant power.', cost: 'A notable cost.' },
                { tier: 4, benefit: 'A potent ability.', cost: 'A heavy price.' },
                { tier: 5, benefit: 'A major transformation.', cost: 'A lasting scar.' },
                { tier: '6+', benefit: 'The ultimate expression.', cost: 'The tradition claims you.' }
            ]
        };
        modified = true;
    }

    // 3. Ensure rites are objects, not strings (convert if needed)
    if (patron.rites && Array.isArray(patron.rites)) {
        let ritesModified = false;
        patron.rites = patron.rites.map(rite => {
            if (typeof rite === 'string') {
                ritesModified = true;
                return {
                    name: rite,
                    tier: 'Low',
                    xp: 4,
                    effect: 'A rite of the patron.',
                    tags: [],
                    cost: 'Mark +1 Obligation.',
                    requires: 'Familiar (Invoke: 1 Boon).',
                    invoke: '1 action.',
                    duration: 'Scene.'
                };
            }
            return rite;
        });
        if (ritesModified) modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(patron, null, 2), 'utf-8');
        updatedCount++;
        console.log(`✅ Updated ${file}`);
    }
}

console.log(`\n📊 Updated ${updatedCount} patron files.`);
