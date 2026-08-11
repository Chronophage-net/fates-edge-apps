#!/usr/bin/env node
/**
 * Copies the built web client (fates-edge-web-client/dist) into this
 * package's renderer/ folder, so the Electron app has an actual UI to
 * load. Runs before dev/start/build (see package.json's pre* scripts).
 *
 * This didn't exist before: the desktop client's electron-builder `files`
 * list only ever shipped electron.js/preload.js/package.json, and
 * electron.js had no BrowserWindow/loadFile call in the first place. So
 * even with a working main process, the packaged app opened nothing --
 * there was no renderer content anywhere in the build. This script (and
 * the renderer/ dir it produces) is what fixes that.
 */

const fs = require('fs');
const path = require('path');

const WEB_CLIENT_DIST = path.join(__dirname, '..', '..', 'fates-edge-web-client', 'dist');
const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
const BRIDGE_SRC = path.join(__dirname, 'electron-bridge.js');

function log(message, type = 'info') {
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
    console.log(`${icons[type] || '📌'} ${message}`);
}

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
            copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

function main() {
    if (!fs.existsSync(WEB_CLIENT_DIST) || !fs.existsSync(path.join(WEB_CLIENT_DIST, 'index.html'))) {
        log(`Web client build not found at ${WEB_CLIENT_DIST}`, 'error');
        log('Run "npm run build" in ../fates-edge-web-client first (this produces dist/index.html).', 'error');
        process.exit(1);
    }

    if (fs.existsSync(RENDERER_DIR)) {
        fs.rmSync(RENDERER_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(RENDERER_DIR, { recursive: true });

    log(`Copying ${WEB_CLIENT_DIST} -> ${RENDERER_DIR} ...`);
    copyRecursive(WEB_CLIENT_DIST, RENDERER_DIR);

    // Inject the desktop-only integration bridge as a plain <script> tag
    // in the copied index.html. This file only exists in the packaged
    // renderer/ copy, not in the shared web-client source, so the
    // browser-facing deployment of fates-edge-web-client is untouched.
    if (fs.existsSync(BRIDGE_SRC)) {
        fs.copyFileSync(BRIDGE_SRC, path.join(RENDERER_DIR, 'electron-bridge.js'));
        const indexPath = path.join(RENDERER_DIR, 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        if (!html.includes('electron-bridge.js')) {
            html = html.replace('</body>', '    <script src="electron-bridge.js"></script>\n  </body>');
            fs.writeFileSync(indexPath, html);
        }
        log('Injected electron-bridge.js into renderer/index.html', 'success');
    } else {
        log(`No electron-bridge.js found at ${BRIDGE_SRC}, skipping injection`, 'warn');
    }

    log('Renderer ready.', 'success');
}

main();
