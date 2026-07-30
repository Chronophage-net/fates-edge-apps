#!/usr/bin/env node
/**
 * Fate's Edge - Generate a manifest.json for a hand-placed adventure module
 *
 * For adventure.json files dropped directly into server/modules/<id>/ by
 * hand (e.g. copied over via git/SCP) rather than installed through
 * POST /api/modules -- this derives the same manifest.json that endpoint
 * would generate, using the shared logic in module-manifest-utils.js, so
 * the two paths can never disagree about what a manifest should contain.
 *
 * Usage:
 *   node generate-manifest.js <moduleId>          One module
 *   node generate-manifest.js --all               Every module missing a manifest
 *   node generate-manifest.js <moduleId> --force   Overwrite an existing manifest.json
 *   node generate-manifest.js --all --force        Regenerate every manifest.json
 *
 * Run from server/ (or anywhere -- it resolves modules/ relative to this
 * script's own location, not the current working directory).
 */

const fs = require('fs');
const path = require('path');
const { deriveManifestFromContent } = require('./module-manifest-utils.js');

const MODULES_DIR = path.join(__dirname, 'modules');

function generateOne(moduleId, { force = false } = {}) {
    const moduleDir = path.join(MODULES_DIR, moduleId);
    const adventurePath = path.join(moduleDir, 'adventure.json');
    const manifestPath = path.join(moduleDir, 'manifest.json');

    if (!fs.existsSync(adventurePath)) {
        console.error(`❌ ${moduleId}: no adventure.json found at ${adventurePath}`);
        return false;
    }
    if (fs.existsSync(manifestPath) && !force) {
        console.log(`⏭️  ${moduleId}: manifest.json already exists (use --force to overwrite)`);
        return false;
    }

    let content;
    try {
        content = JSON.parse(fs.readFileSync(adventurePath, 'utf-8'));
    } catch (e) {
        console.error(`❌ ${moduleId}: invalid JSON in adventure.json (${e.message})`);
        return false;
    }

    if (!content.title) {
        console.warn(`⚠️  ${moduleId}: adventure.json has no "title" -- manifest will say "Untitled Adventure"`);
    }
    if (!Array.isArray(content.acts) || content.acts.length === 0) {
        console.warn(`⚠️  ${moduleId}: adventure.json has no acts -- this won't be loadable as-is, but the manifest will still be written`);
    }

    const manifest = deriveManifestFromContent(content);

    try {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    } catch (e) {
        console.error(`❌ ${moduleId}: failed to write manifest.json (${e.message})`);
        return false;
    }

    console.log(`✅ ${moduleId}: wrote manifest.json — "${manifest.name}" (Tier ${manifest.tierRange})`);
    return true;
}

function main() {
    const args = process.argv.slice(2);
    const force = args.includes('--force');
    const all = args.includes('--all');
    const moduleId = args.find(a => !a.startsWith('--'));

    if (!fs.existsSync(MODULES_DIR)) {
        console.error(`❌ Modules directory not found: ${MODULES_DIR}`);
        process.exit(1);
    }

    if (all) {
        const dirs = fs.readdirSync(MODULES_DIR).filter(d => {
            try { return fs.statSync(path.join(MODULES_DIR, d)).isDirectory(); }
            catch (e) { return false; }
        });
        if (dirs.length === 0) {
            console.log('No module directories found.');
            return;
        }
        let done = 0;
        for (const dir of dirs) {
            if (generateOne(dir, { force })) done++;
        }
        console.log(`\n${done}/${dirs.length} module(s) processed.`);
        return;
    }

    if (!moduleId) {
        console.error('Usage: node generate-manifest.js <moduleId> [--force]');
        console.error('       node generate-manifest.js --all [--force]');
        process.exit(1);
    }

    generateOne(moduleId, { force });
}

main();
