import { readFile, realpath, stat } from 'node:fs/promises';
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
    return {
        name: 'fates-edge-static-data',
        configureServer(server) {
            for (const folder of ['docs', 'adventures']) {
                server.middlewares.use(`/data/${folder}`, createStaticDataMiddleware(resolve(projectRoot, 'data', folder)));
            }
        },
    };
}
