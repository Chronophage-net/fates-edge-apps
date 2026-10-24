const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { gzipSync, deflateSync } = require('node:zlib');
const { setTimeout: delay } = require('node:timers/promises');
const { startTestServer } = require('./support/live-server');

function postCompressed(server, type, encoding, body) {
    return new Promise((resolve, reject) => {
        const request = http.request({
            host: '127.0.0.1', port: server.port, method: 'POST',
            path: '/body-parser-security-check', agent: false,
            headers: {
                'Content-Type': type,
                'Content-Encoding': encoding,
                'Content-Length': body.length,
            },
        }, response => {
            response.resume();
            response.on('error', reject);
            response.on('end', () => resolve(response.statusCode));
        });
        request.on('error', reject);
        request.setTimeout(3000, () => request.destroy(new Error('Compressed request timed out')));
        request.end(body);
    });
}

for (const [type, text] of [
    ['application/json', '{"message":"parser probe"}'],
    ['application/x-www-form-urlencoded', 'message=parser%20probe'],
]) {
    test(`${type}: compressed bodies with trailing bytes cannot terminate the server`, { timeout: 15000 }, async t => {
        const server = await startTestServer();
        t.after(() => server.close());

        for (const [encoding, compress] of [['gzip', gzipSync], ['deflate', deflateSync]]) {
            const compressed = compress(Buffer.from(text));
            // The unknown route returns 404 only after the global parser succeeds.
            assert.equal(await postCompressed(server, type, encoding, compressed), 404);

            // GHSA-27r3-jxmh-p828: the decoder can finish before the HTTP body.
            // Enough trailing data crosses stream chunks and used to emit an
            // uncaught error after the response, terminating the server without authentication.
            const trailing = Buffer.concat([compressed, Buffer.from([0]), Buffer.alloc(100 * 1024, 0x58)]);
            assert.equal(await postCompressed(server, type, encoding, trailing), 404);
            await delay(200);

            const health = await fetch(`${server.base}/healthz`, { signal: AbortSignal.timeout(3000) });
            assert.equal(health.status, 200, `${encoding} request must leave the server running`);
            assert.equal(await health.text(), 'OK');
        }
    });
}
