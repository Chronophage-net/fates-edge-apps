/**
 * Generate Random Seed for Deterministic Dice
 * 
 * This script generates a random seed for deterministic dice rolls
 * on static sites. The seed is saved to .seed/random-seed.json.
 * 
 * Usage (Node.js):
 *   node js/tools/generate-seed.js
 *   node js/tools/generate-seed.js --force
 *   node js/tools/generate-seed.js --seed=my-seed-value
 *   node js/tools/generate-seed.js --output=path/to/seed.json
 * 
 * The seed file should be copied to the output directory during build.
 * In a static site, the seed is embedded via a script tag or loaded
 * from a JSON file.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================
// Configuration
// ============================================================

const DEFAULT_OUTPUT_DIR = '.seed';
const DEFAULT_OUTPUT_FILE = 'random-seed.json';
const DETERMINISTIC_SEED_KEY = 'fates-edge-seed';

// Parse command line arguments
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const SEED_ARG = args.find(a => a.startsWith('--seed='));
const OUTPUT_ARG = args.find(a => a.startsWith('--output='));

let customSeed = null;
let outputPath = null;

if (SEED_ARG) {
    customSeed = SEED_ARG.substring('--seed='.length);
}

if (OUTPUT_ARG) {
    outputPath = OUTPUT_ARG.substring('--output='.length);
}

// ============================================================
// Paths
// ============================================================

// Find project root (where package.json is)
function findProjectRoot() {
    let dir = process.cwd();
    while (dir !== '/') {
        if (fs.existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const OUTPUT_DIR = outputPath ? path.dirname(outputPath) : path.join(PROJECT_ROOT, DEFAULT_OUTPUT_DIR);
const OUTPUT_FILE = outputPath ? path.basename(outputPath) : DEFAULT_OUTPUT_FILE;
const OUTPUT_FULL_PATH = outputPath || path.join(OUTPUT_DIR, OUTPUT_FILE);

// Also generate a JS file for direct embedding
const JS_OUTPUT_PATH = path.join(OUTPUT_DIR, 'seed.js');

// ============================================================
// Seed Generation
// ============================================================

function generateSeed() {
    if (customSeed) {
        return customSeed;
    }
    // Generate a cryptographically secure random seed
    const buffer = crypto.randomBytes(32);
    return buffer.toString('hex');
}

function generateSeedFile() {
    // Check if seed file exists and we're not forcing
    if (fs.existsSync(OUTPUT_FULL_PATH) && !FORCE) {
        try {
            const data = JSON.parse(fs.readFileSync(OUTPUT_FULL_PATH, 'utf-8'));
            console.log(`📁 Seed file already exists at ${OUTPUT_FULL_PATH}`);
            console.log(`   Current seed: ${data.seed}`);
            console.log(`   Generated: ${new Date(data.generated).toLocaleString()}`);
            console.log(`   Use --force to regenerate.`);
            return data;
        } catch (e) {
            console.warn('⚠️ Seed file exists but is invalid, regenerating...');
        }
    }

    // Generate new seed
    const seed = generateSeed();
    const seedData = {
        seed: seed,
        generated: Date.now(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        source: 'fates-edge-generator'
    };

    // Ensure directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write seed file
    fs.writeFileSync(OUTPUT_FULL_PATH, JSON.stringify(seedData, null, 2));
    console.log(`✅ Seed file generated: ${OUTPUT_FULL_PATH}`);
    console.log(`   Seed: ${seed}`);
    console.log(`   Generated: ${new Date(seedData.generated).toLocaleString()}`);

    // Also generate a JS file for embedding
    generateSeedJS(seed);

    return seedData;
}

function generateSeedJS(seed) {
    const jsContent = `// Auto-generated seed file - DO NOT EDIT MANUALLY
// Generated: ${new Date().toISOString()}
// Use this file to set the deterministic seed in the browser

(function() {
    // Set the seed for deterministic dice rolls
    if (typeof window !== 'undefined') {
        window.__RANDOM_SEED = '${seed}';
        console.log('🎲 Deterministic seed loaded:', '${seed.substring(0, 8)}...');
        
        // Also store in localStorage for persistence
        try {
            localStorage.setItem('${DETERMINISTIC_SEED_KEY}', '${seed}');
        } catch (e) {
            // localStorage not available
        }
    }
})();
`;

    const jsPath = path.join(OUTPUT_DIR, 'seed.js');
    fs.writeFileSync(jsPath, jsContent);
    console.log(`✅ JS seed file generated: ${jsPath}`);
}

// ============================================================
// Copy to target directory (for static site)
// ============================================================

function copyToTarget(targetDir) {
    if (!targetDir) return;
    
    const targetSeedDir = path.join(targetDir, '.seed');
    if (!fs.existsSync(targetSeedDir)) {
        fs.mkdirSync(targetSeedDir, { recursive: true });
    }
    
    // Copy JSON seed
    const targetJsonPath = path.join(targetSeedDir, 'random-seed.json');
    fs.copyFileSync(OUTPUT_FULL_PATH, targetJsonPath);
    console.log(`✅ Copied seed to ${targetJsonPath}`);
    
    // Copy JS seed
    const targetJsPath = path.join(targetDir, 'seed.js');
    fs.copyFileSync(path.join(OUTPUT_DIR, 'seed.js'), targetJsPath);
    console.log(`✅ Copied seed.js to ${targetJsPath}`);
}

// ============================================================
// Main
// ============================================================

function main() {
    console.log('🎲 Generating deterministic seed...');
    console.log(`   Project root: ${PROJECT_ROOT}`);
    console.log(`   Output: ${OUTPUT_FULL_PATH}`);
    
    const seedData = generateSeedFile();
    
    // Check if a target directory was specified
    const targetArg = args.find(a => a.startsWith('--target='));
    if (targetArg) {
        const targetDir = targetArg.substring('--target='.length);
        copyToTarget(targetDir);
    }
    
    console.log('✅ Done!');
    console.log('');
    console.log('📖 To use the seed in your static site:');
    console.log('   1. Include the generated seed.js in your HTML:');
    console.log('      <script src="seed.js"></script>');
    console.log('   2. Or load the seed from the JSON file:');
    console.log('      fetch(".seed/random-seed.json")');
    console.log('        .then(r => r.json())');
    console.log('        .then(data => window.__RANDOM_SEED = data.seed);');
    console.log('   3. The seed will be used automatically by the dice module.');
    
    return seedData;
}

// Run if called directly
if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('❌ Error generating seed:', err.message);
        process.exit(1);
    }
}

module.exports = {
    generateSeed,
    generateSeedFile,
    generateSeedJS,
    copyToTarget,
    OUTPUT_FULL_PATH,
    JS_OUTPUT_PATH,
    DETERMINISTIC_SEED_KEY
};
