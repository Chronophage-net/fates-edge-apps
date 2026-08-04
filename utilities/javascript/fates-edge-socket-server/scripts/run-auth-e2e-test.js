#!/usr/bin/env node
/**
 * Boots the server against a scratch SQLite DB, runs test-auth-e2e.js
 * against it, then tears the server down -- so `npm run test:auth` is a
 * single command instead of a manual "start server in one terminal, run
 * the script in another" dance.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = process.env.TEST_PORT || 10123;
const dbPath = path.join(os.tmpdir(), `fates-edge-auth-test-${Date.now()}.db`);

const env = {
    ...process.env,
    PORT: String(PORT),
    DATABASE_TYPE: 'sqlite',
    DATABASE_URL: dbPath,
    AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET || 'test-secret-for-local-run',
    API_KEY: process.env.API_KEY || 'test-admin-key',
};

async function waitForHealth(url, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(url);
            if (res.ok) return true;
        } catch (e) { /* not up yet */ }
        await new Promise(r => setTimeout(r, 300));
    }
    return false;
}

async function main() {
    const server = spawn(process.execPath, [path.join(__dirname, '..', 'server-start.js')], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let serverOutput = '';
    server.stdout.on('data', d => { serverOutput += d; });
    server.stderr.on('data', d => { serverOutput += d; });

    const up = await waitForHealth(`http://localhost:${PORT}/healthz`);
    if (!up) {
        console.error('Server did not become healthy in time. Output so far:\n' + serverOutput);
        server.kill('SIGTERM');
        process.exit(1);
    }

    const test = spawn(process.execPath, [path.join(__dirname, '..', 'test-auth-e2e.js')], {
        env: { ...env, TEST_BASE_URL: `http://localhost:${PORT}` },
        stdio: 'inherit',
    });

    test.on('close', (code) => {
        server.kill('SIGTERM');
        try { fs.unlinkSync(dbPath); } catch (e) { /* scratch file, fine either way */ }
        process.exit(code);
    });
}

main().catch(e => { console.error(e); process.exit(1); });
