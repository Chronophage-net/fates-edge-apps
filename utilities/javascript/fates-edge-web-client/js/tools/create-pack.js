// tools/create-pack.js
/**
 * Pack Builder - Creates .pack.zip files for distribution
 * 
 * Usage: node create-pack.js --name "My Pack" --version 1.0.0 --manifest pack.json
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { program } = require('commander');

program
    .option('-n, --name <name>', 'Pack name')
    .option('-v, --version <version>', 'Pack version', '1.0.0')
    .option('-m, --manifest <path>', 'Path to manifest file', 'pack.json')
    .option('-o, --output <path>', 'Output directory', './build')
    .parse(process.argv);

const options = program.opts();

async function buildPack() {
    const manifestPath = path.resolve(options.manifest);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, `${manifest.name.toLowerCase().replace(/\s+/g, '-')}.pack.zip`);
    
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
        console.log(`✅ Pack created: ${outputPath} (${archive.pointer()} bytes)`);
    });
    
    archive.pipe(output);
    
    // Add manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: 'pack.json' });
    
    // Add modules
    if (manifest.modules) {
        for (const mod of manifest.modules) {
            const sourcePath = path.resolve(mod.source || `./src/${mod.path}`);
            if (fs.existsSync(sourcePath)) {
                archive.file(sourcePath, { name: mod.path });
                console.log(`📦 Added module: ${mod.path}`);
            } else {
                console.warn(`⚠️ Module not found: ${sourcePath}`);
            }
        }
    }
    
    // Add documents
    if (manifest.documents) {
        for (const doc of manifest.documents) {
            const sourcePath = path.resolve(doc.source || `./data/docs/${doc.path}`);
            if (fs.existsSync(sourcePath)) {
                archive.file(sourcePath, { name: doc.path });
                console.log(`📄 Added document: ${doc.path}`);
            } else {
                console.warn(`⚠️ Document not found: ${sourcePath}`);
            }
        }
    }
    
    // Add data files
    if (manifest.data) {
        for (const category of ['patrons', 'factions', 'regions']) {
            if (manifest.data[category]) {
                for (const dataPath of manifest.data[category]) {
                    const sourcePath = path.resolve(dataPath);
                    if (fs.existsSync(sourcePath)) {
                        archive.file(sourcePath, { name: dataPath });
                        console.log(`📊 Added ${category} data: ${dataPath}`);
                    } else {
                        console.warn(`⚠️ Data file not found: ${sourcePath}`);
                    }
                }
            }
        }
    }
    
    archive.finalize();
}

buildPack().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});