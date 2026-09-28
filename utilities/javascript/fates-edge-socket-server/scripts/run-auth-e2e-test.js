#!/usr/bin/env node
// Run authentication checks against an isolated database on an available port.
const { spawn } = require('node:child_process');
const path = require('node:path');
const { startTestServer } = require('../tests/support/live-server');

async function main() {
    const server = await startTestServer();
    try {
        process.exitCode = await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [path.join(__dirname, '../test-auth-e2e.js')], {
                env: { ...process.env, TEST_BASE_URL: server.base, API_KEY: 'isolated-test-admin-key' },
                stdio: 'inherit',
            });
            child.once('error', reject);
            child.once('exit', code => resolve(code ?? 1));
        });
    } finally { await server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
