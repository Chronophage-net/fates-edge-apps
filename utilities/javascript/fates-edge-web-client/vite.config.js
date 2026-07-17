// ttrpg/utilities/javascript/fates-edge-web-client/vite.config.js

import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
    base: '/',
    server: {
        port: 5173,
        open: true,
        // ❌ REMOVE invalid option – Vite already handles SPA fallback
        // historyApiFallback: true,

        // Allow serving files from the project root
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

    // 🆕 ADD custom middleware to serve /data/docs before the SPA fallback
    configureServer(server) {
        // Intercept requests to /data/docs and serve the actual file
        server.middlewares.use('/data/docs', (req, res, next) => {
            // Remove query string if present
            const urlPath = req.url.split('?')[0];
            // Build the absolute path to the requested file
            const filePath = resolve(__dirname, 'data', 'docs', urlPath);

            // If the file exists, send it with the correct content type
            if (fs.existsSync(filePath)) {
                const ext = filePath.split('.').pop().toLowerCase();
                const mimeTypes = {
                    html: 'text/html',
                    css: 'text/css',
                    js: 'application/javascript',
                    json: 'application/json',
                };
                res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                res.end(fs.readFileSync(filePath, 'utf-8'));
                return;
            }
            // File not found → let Vite continue (will fallback to index.html for SPA)
            next();
        });

        // Log data paths on startup (unchanged, except fix the incorrect paths)
        server.httpServer?.once('listening', () => {
            console.log('\n📂 Dev server started. Checking data paths...');
            const dataPath = resolve(__dirname, 'data');
            // ✅ FIX: correct paths (removed double data/)
            const regionsPath = resolve(__dirname, 'data', 'regions');
            const patronsPath = resolve(__dirname, 'data', 'patrons');
            const docsPath = resolve(__dirname, 'data', 'docs');

            if (fs.existsSync(dataPath)) {
                console.log(`  ✅ ${dataPath}`);
                if (fs.existsSync(regionsPath)) {
                    const files = fs.readdirSync(regionsPath).filter(f => f.endsWith('.json'));
                    console.log(`    📁 regions (${files.length} files)`);
                }
                if (fs.existsSync(patronsPath)) {
                    const files = fs.readdirSync(patronsPath).filter(f => f.endsWith('.json'));
                    console.log(`    📁 patrons (${files.length} files)`);
                }
                if (fs.existsSync(docsPath)) {
                    const files = fs.readdirSync(docsPath).filter(f => f.endsWith('.html'));
                    console.log(`    📁 docs (${files.length} files)`);
                }
            } else {
                console.warn(`  ⚠️ data/ directory not found at ${dataPath}`);
                console.warn('    Some features may not load correctly.');
            }
            console.log('✅ Dev server ready.\n');
        });
    },
});