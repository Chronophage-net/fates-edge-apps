const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Regression coverage for the module system fixes:
 *
 * 1. api.js and socketio-handlers.js resolved the installable-modules
 *    directory as `path.join(__dirname, 'modules')`. __dirname there is
 *    server/, so that pointed at server/modules/ -- which has never
 *    existed. The real directory (what the Dockerfile COPYs, what
 *    generate-manifest.js targets, and where the shipped
 *    modules/example-module/ actually lives) is <repo-root>/modules/, one
 *    level up. Every module install/list/push/cleanup route was affected.
 *
 * 2. ws-handlers.js (the plain-WebSocket transport, the client's default)
 *    never handled 'module-push-request'/'module-cleanup-request'/
 *    'module-list' at all -- only the Socket.io transport did. Since
 *    plain WebSocket is the default transport, every module push/cleanup/
 *    list request from the web client silently timed out.
 *
 * 3. generate-manifest.js required './module-manifest-utils.js', but that
 *    file lives at ./server/module-manifest-utils.js -- the CLI tool
 *    crashed with MODULE_NOT_FOUND on every invocation.
 */
describe('Module system path fixes (regression)', () => {
    const apiSrc = fs.readFileSync(path.join(__dirname, '../server/api.js'), 'utf8');
    const ioSrc = fs.readFileSync(path.join(__dirname, '../server/socketio-handlers.js'), 'utf8');
    const wsSrc = fs.readFileSync(path.join(__dirname, '../server/ws-handlers.js'), 'utf8');
    const generateManifestSrc = fs.readFileSync(path.join(__dirname, '../generate-manifest.js'), 'utf8');

    // Only matches an actual assignment/call site (`= path.join(__dirname,
    // 'modules'`), not this file's own explanatory comments quoting the old
    // buggy code as a backtick-quoted example (no `=` immediately before it
    // there).
    const STALE_PATH_PATTERN = /=\s*path\.join\(__dirname,\s*'modules'/;
    const FIXED_PATH_PATTERN = /path\.join\(__dirname,\s*'\.\.',\s*'modules'/g;

    test('api.js resolves the modules directory one level above server/, not server/modules/', () => {
        assert.doesNotMatch(apiSrc, STALE_PATH_PATTERN);
        const matches = apiSrc.match(FIXED_PATH_PATTERN) || [];
        assert.ok(matches.length >= 3, `expected at least 3 fixed module path references in api.js, found ${matches.length}`);
    });

    test('socketio-handlers.js resolves the modules directory the same corrected way', () => {
        assert.doesNotMatch(ioSrc, STALE_PATH_PATTERN);
        const matches = ioSrc.match(FIXED_PATH_PATTERN) || [];
        assert.ok(matches.length >= 2, `expected at least 2 fixed module path references in socketio-handlers.js, found ${matches.length}`);
    });

    test('generate-manifest.js requires module-manifest-utils.js from server/, not the repo root', () => {
        assert.match(generateManifestSrc, /require\(['"]\.\/server\/module-manifest-utils\.js['"]\)/);
    });

    test('ws-handlers.js (plain WebSocket, the default transport) now handles module-push-request', () => {
        assert.match(wsSrc, /case 'module-push-request':/);
        assert.match(wsSrc, /room\.broadcastToRoom\(roomKey, 'module-push'/);
    });

    test('ws-handlers.js handles module-cleanup-request', () => {
        assert.match(wsSrc, /case 'module-cleanup-request':/);
        assert.match(wsSrc, /room\.broadcastToRoom\(roomKey, 'module-cleanup'/);
    });

    test('ws-handlers.js handles module-list', () => {
        assert.match(wsSrc, /case 'module-list':/);
    });

    test("ws-handlers.js's module handlers each echo requestId so the client's pendingCallbacks correlation resolves", () => {
        for (const caseLabel of ['module-push-request', 'module-cleanup-request', 'module-list']) {
            const re = new RegExp(`case '${caseLabel}':[\\s\\S]{0,3000}?\\n\\s*break;`);
            const match = wsSrc.match(re);
            assert.ok(match, `expected to find a case '${caseLabel}': block`);
            assert.match(match[0], /requestId:\s*data\.requestId/, `case '${caseLabel}' should echo requestId`);
        }
    });

    test('ws-handlers.js resolves MODULES_DIR the same corrected way as the other two transports', () => {
        assert.match(wsSrc, /const MODULES_DIR = path\.join\(__dirname, '\.\.', 'modules'\);/);
    });
});

describe('Shipped example module (regression)', () => {
    const moduleDir = path.join(__dirname, '../modules/example-module');

    test('has manifest.json and adventure.json (the filenames every loader actually looks for)', () => {
        assert.ok(fs.existsSync(path.join(moduleDir, 'manifest.json')), 'manifest.json should exist');
        assert.ok(fs.existsSync(path.join(moduleDir, 'adventure.json')), 'adventure.json should exist');
    });

    test('adventure.json is valid, has a title and at least one act', () => {
        const content = JSON.parse(fs.readFileSync(path.join(moduleDir, 'adventure.json'), 'utf8'));
        assert.ok(content.title);
        assert.ok(Array.isArray(content.acts) && content.acts.length > 0);
    });

    test('manifest.json is valid and has the fields api.js/ws-handlers.js/socketio-handlers.js read', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(moduleDir, 'manifest.json'), 'utf8'));
        assert.ok(manifest.name);
        assert.ok(manifest.version);
    });
});
