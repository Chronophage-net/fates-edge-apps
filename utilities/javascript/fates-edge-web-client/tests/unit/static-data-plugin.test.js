import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, assertEqual, assert } from '../runner.js';
import { createStaticDataMiddleware, staticDataPlugin } from '../../js/tools/static-data-plugin.js';

async function withFiles(test) {
    const root = await mkdtemp(join(tmpdir(), 'fe-static-'));
    try {
        const docs = join(root, 'docs');
        await mkdir(docs);
        await writeFile(join(root, 'secret.txt'), 'private');
        await writeFile(join(docs, 'a file.pdf'), Buffer.from([0, 255, 128, 10]));
        await symlink(join(root, 'secret.txt'), join(docs, 'outside.txt'));
        const middleware = createStaticDataMiddleware(docs);
        const request = async (url, method = 'GET') => {
            const response = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
            await middleware({ url, method }, response);
            return response;
        };
        await test(request);
    } finally { await rm(root, { recursive: true, force: true }); }
}

describe('Development document server', () => {
    it('registers both document mounts as a Vite plugin', () => {
        const mounts = [];
        staticDataPlugin('/project').configureServer({ middlewares: { use(path) { mounts.push(path); } } });
        assertEqual(mounts.join(','), '/data/docs,/data/adventures');
    });
    it('preserves binary bytes, decodes spaces, and supports HEAD', () => withFiles(async request => {
        const result = await request('/a%20file.pdf?v=1');
        assertEqual(result.statusCode, 200);
        assert(result.body.equals(Buffer.from([0, 255, 128, 10])));
        assertEqual(result.headers['Content-Type'], 'application/pdf');
        assertEqual(result.headers['X-Content-Type-Options'], 'nosniff');
        const head = await request('/a%20file.pdf', 'HEAD');
        assertEqual(head.statusCode, 200);
        assertEqual(head.headers['Content-Length'], 4);
        assertEqual(head.body, undefined);
    }));
    it('rejects traversal, symlink escapes, invalid paths and writes', () => withFiles(async request => {
        for (const url of ['/../secret.txt', '/%2e%2e%2fsecret.txt', '/outside.txt']) {
            assertEqual((await request(url)).statusCode, 403, url);
        }
        for (const url of ['/%ZZ', '/%00', '/..%5csecret.txt']) {
            assertEqual((await request(url)).statusCode, 400, url);
        }
        assertEqual((await request('/a%20file.pdf', 'POST')).statusCode, 405);
        assertEqual((await request('/missing.html')).statusCode, 404);
        assertEqual((await request('/')).statusCode, 404);
    }));
});
