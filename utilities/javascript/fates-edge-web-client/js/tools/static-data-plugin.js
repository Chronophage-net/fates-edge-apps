import { readFile, realpath, stat, cp, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, relative, isAbsolute, extname } from 'node:path';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
    '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.webp': 'image/webp', '.ico': 'image/x-icon',
};

function isWithin(root, file) {
    const path = relative(root, file);
    return path !== '..' && !path.startsWith('../') && !path.startsWith('..\\') && !isAbsolute(path);
}

// Mounted before Vite's SPA fallback: missing documents must really be 404s.
export function createStaticDataMiddleware(root) {
    return async (req, res) => {
        const fail = (status, message) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(req.method === 'HEAD' ? undefined : message);
        };
        if (!['GET', 'HEAD'].includes(req.method)) {
            res.setHeader('Allow', 'GET, HEAD');
            return fail(405, 'Method not allowed');
        }
        let pathname;
        try { pathname = decodeURIComponent((req.url || '/').split('?')[0]); }
        catch { return fail(400, 'Invalid path'); }
        if (pathname.includes('\0') || pathname.includes('\\')) return fail(400, 'Invalid path');
        const file = resolve(root, pathname.replace(/^\/+/, ''));
        if (!isWithin(resolve(root), file)) return fail(403, 'Forbidden');
        try {
            const [realRoot, realFile] = await Promise.all([realpath(root), realpath(file)]);
            if (!isWithin(realRoot, realFile)) return fail(403, 'Forbidden');
            if (!(await stat(realFile)).isFile()) return fail(404, 'File not found');
            const body = await readFile(realFile);
            res.setHeader('Content-Type', MIME_TYPES[extname(realFile).toLowerCase()] || 'application/octet-stream');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Content-Length', body.length);
            res.end(req.method === 'HEAD' ? undefined : body);
        } catch (error) {
            fail(['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code) ? 404 : 500, 'File unavailable');
        }
    };
}

export function staticDataPlugin(projectRoot) {
    let outputDir;
    return {
        name: 'fates-edge-static-data',
        configResolved(config) {
            if (config.command === 'build') outputDir = resolve(config.root, config.build.outDir);
        },
        async closeBundle() {
            if (!outputDir) return;
            // Only copy public runtime content, never configuration or source secrets.
            await cp(resolve(projectRoot, 'data'), resolve(outputDir, 'data'), { recursive: true });
            await cp(resolve(projectRoot, 'docs'), resolve(outputDir, 'docs'), { recursive: true });
            let seed;
            try { seed = JSON.parse(await readFile(resolve(outputDir, 'data/seed.json'), 'utf8')).seed; }
            catch (error) { if (error.code !== 'ENOENT') throw error; }
            if (typeof seed !== 'string' || !seed) seed = randomBytes(32).toString('hex');
            const seedJSON = JSON.stringify({seed});
            await mkdir(resolve(outputDir, '.seed'), {recursive: true});
            await writeFile(resolve(outputDir, '.seed/random-seed.json'), seedJSON);
            await writeFile(resolve(outputDir, 'data/seed.json'), seedJSON);
            await writeFile(resolve(outputDir, 'seed.js'), `window.__RANDOM_SEED ||= ${JSON.stringify(seed)};\n`);
        },
        configureServer(server) {
            for (const folder of ['docs', 'adventures']) {
                server.middlewares.use(`/data/${folder}`, createStaticDataMiddleware(resolve(projectRoot, 'data', folder)));
            }
        },
    };
}
