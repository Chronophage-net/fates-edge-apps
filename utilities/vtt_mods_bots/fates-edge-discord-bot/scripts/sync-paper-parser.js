// Keep the standalone Docker build's parser identical to the web client's source.
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '../../../javascript/fates-edge-web-client/js/core/paper-import.js');
const target = path.resolve(__dirname, '../vendor/paper-import.mjs');
if (process.argv.includes('--check')) {
    if (!fs.readFileSync(source).equals(fs.readFileSync(target))) throw new Error('Paper parser differs: run npm run sync:paper-parser');
} else fs.copyFileSync(source, target);
