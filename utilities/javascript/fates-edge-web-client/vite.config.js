import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
    base: '/',
    server: {
        port: 5173,
        open: true,
        fs: {
            allow: ['.'],
        },
        watch: {
            usePolling: true,
            interval: 100,
        },
    },
    preview: {
        port: 4173,
        open: true,
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
            output: {
                entryFileNames: 'assets/[name].[hash].js',
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]',
            },
        },
        assetsDir: 'assets',
        copyPublicDir: true,
        minify: 'esbuild',
        sourcemap: false,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './'),
            '@core': resolve(__dirname, './js/core'),
            '@components': resolve(__dirname, './js/components'),
            '@features': resolve(__dirname, './js/features'),
            '@data': resolve(__dirname, './data'),
        },
    },
    optimizeDeps: {
        exclude: ['**/tests/**/*'],
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },

    configureServer(server) {
        // ─── FIX: Serve static files from data/docs/ ─────────────
        server.middlewares.use('/data/docs', (req, res, next) => {
            const urlPath = req.url.split('?')[0];
            // Remove leading slash from urlPath BEFORE resolving
            const cleanPath = urlPath.replace(/^\/+/, '');
            const filePath = resolve(__dirname, 'data', 'docs', cleanPath);
            
            if (fs.existsSync(filePath)) {
                const ext = filePath.split('.').pop().toLowerCase();
                const mimeTypes = {
                    html: 'text/html',
                    htm: 'text/html',
                    css: 'text/css',
                    js: 'application/javascript',
                    json: 'application/json',
                    pdf: 'application/pdf',
                    png: 'image/png',
                    jpg: 'image/jpeg',
                    jpeg: 'image/jpeg',
                    gif: 'image/gif',
                    svg: 'image/svg+xml',
                    webp: 'image/webp',
                    ico: 'image/x-icon',
                };
                res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-cache');
                res.end(fs.readFileSync(filePath, 'utf-8'));
                return;
            }
            // If file not found, return 404 instead of falling through to SPA
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('File not found');
        });

        // ─── NEW: Serve static files from data/adventures/ ────────
        server.middlewares.use('/data/adventures', (req, res, next) => {
            const urlPath = req.url.split('?')[0];
            const cleanPath = urlPath.replace(/^\/+/, '');
            const filePath = resolve(__dirname, 'data', 'adventures', cleanPath);
            
            if (fs.existsSync(filePath)) {
                const ext = filePath.split('.').pop().toLowerCase();
                const mimeTypes = {
                    html: 'text/html',
                    htm: 'text/html',
                    css: 'text/css',
                    js: 'application/javascript',
                    json: 'application/json',
                    pdf: 'application/pdf',
                    png: 'image/png',
                    jpg: 'image/jpeg',
                    jpeg: 'image/jpeg',
                    gif: 'image/gif',
                    svg: 'image/svg+xml',
                    webp: 'image/webp',
                    ico: 'image/x-icon',
                };
                res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-cache');
                res.end(fs.readFileSync(filePath, 'utf-8'));
                return;
            }
            // If file not found, return 404 instead of falling through to SPA
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('File not found');
        });

        server.httpServer?.once('listening', () => {
            console.log('\n📂 Dev server started. Checking data paths...');
            const dataPath = resolve(__dirname, 'data');
            const docsPath = resolve(__dirname, 'data', 'docs');
            
            if (fs.existsSync(dataPath)) {
                console.log(`  ✅ ${dataPath}`);
                if (fs.existsSync(docsPath)) {
                    const files = fs.readdirSync(docsPath).filter(f => f.endsWith('.html'));
                    console.log(`    📁 docs (${files.length} HTML files)`);
                }
            } else {
                console.warn(`  ⚠️ data/ directory not found at ${dataPath}`);
            }
            console.log('✅ Dev server ready.\n');
        });
    }
});