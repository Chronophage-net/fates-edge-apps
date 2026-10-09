const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
// Exercise the exact dependency resolved by Express, including nested installs.
const expressRequire = createRequire(require.resolve('express'));
const proxyaddr = expressRequire('proxy-addr');

for (const subnet of ['::ffff:10.0.0.0/8', '::/1']) {
    test(`IPv4 clients cannot spoof forwarded addresses through ${subnet}`, () => {
        const trust = proxyaddr.compile(subnet);
        const req = { socket: { remoteAddress: '203.0.113.10' }, headers: { 'x-forwarded-for': '10.1.2.3' } };
        assert.equal(trust('203.0.113.10'), false);
        assert.equal(proxyaddr(req, trust), '203.0.113.10');
    });
}

test('correct IPv4 and mapped IPv6 trust subnets still accept only their proxies', () => {
    for (const subnet of ['10.0.0.0/8', '::ffff:10.0.0.0/104']) {
        const trust = proxyaddr.compile(subnet);
        assert.equal(trust('10.2.3.4'), true);
        assert.equal(trust('203.0.113.10'), false);
        const req = { socket: { remoteAddress: '10.2.3.4' }, headers: { 'x-forwarded-for': '203.0.113.10' } };
        assert.equal(proxyaddr(req, trust), '203.0.113.10');
    }
});
