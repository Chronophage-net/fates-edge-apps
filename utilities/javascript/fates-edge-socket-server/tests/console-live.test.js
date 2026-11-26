/**
 * Live: the web console page is served locked down, and its log feed
 * needs the admin key.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, connect } = require('./support/live-server');

test('web console is locked down and its log feed requires the admin key', { timeout: 20000 }, async t => {
    // The console shows what the server logs; joins are INFO.
    const server = await startTestServer({ LOG_LEVEL: 'INFO' });
    t.after(() => server.close());

    const page = await fetch(`${server.base}/console`);
    assert.equal(page.status, 200);
    const csp = page.headers.get('content-security-policy');
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
    assert.ok(nonce, 'scripts need a nonce');
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    const html = await page.text();
    assert.ok(html.includes(`<script nonce="${nonce}">`));
    assert.ok(!/ style="/.test(html), 'inline style attributes would be blocked by the CSP');
    assert.doesNotThrow(() => new Function(html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1]), 'console script parses');

    const client = await connect(server, { path: '/?room=LOGS' });
    await client.join('LOGS', { clientName: 'Wren' });

    assert.equal((await fetch(`${server.base}/api/admin/log`)).status, 401);
    const res = await fetch(`${server.base}/api/admin/log?since=0`, { headers: { 'x-api-key': 'isolated-test-admin-key' } });
    assert.equal(res.status, 200);
    const { entries } = await res.json();
    const joined = entries.find(e => e.msg.includes('Client joined'));
    assert.ok(joined, 'join is in the console log');
    assert.equal(joined.fields.room, 'LOGS', 'rooms are shown by code');
    const later = await (await fetch(`${server.base}/api/admin/log?since=${joined.id}`, { headers: { 'x-api-key': 'isolated-test-admin-key' } })).json();
    assert.ok(later.entries.every(e => e.id > joined.id), 'since= returns only newer entries');
});
