// ttrpg/utilities/javascript/fates-edge-web-client/vite.config.js

import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
    // Base URL - change if deploying to a subpath
    base: '/',
    
    // Development server configuration
    server: {
        port: 5173,
        open: true,
        // Handle SPA routing - all routes fallback to index.html
        historyApiFallback: true,
        // Allow serving files from the project root (for /data/, /regions/, etc.)
        fs: {
            // Allow serving files from one level up from the root (if needed)
            allow: ['.'],
        },
        // Watch for changes in data files
        watch: {
            usePolling: true,
            interval: 100,
        },
    },
    
    // Preview server for production build
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
            // Exclude test files from the build
            external: [],
        },
        // Copy static assets from the root (including data/ regions/ etc.)
        // We'll handle data copying via the build script or manual step
        assetsDir: 'assets',
        copyPublicDir: true,
        minify: 'esbuild',
        sourcemap: false,
        // Ensure that the data directories are included in the build
        // By default, Vite only copies the public directory.
        // Since we have data at root, we need to either:
        // 1. Move data to public/ (not ideal)
        // 2. Use a plugin to copy data/ to dist/
        // 3. In the workflow, copy data/ to dist/ after build (done)
        // For local dev, Vite serves from root, so data/ is accessible.
    },
    
    // Resolve aliases for cleaner imports
    resolve: {
        alias: {
            '@': resolve(__dirname, './'),
            '@core': resolve(__dirname, './js/core'),
            '@components': resolve(__dirname, './js/components'),
            '@features': resolve(__dirname, './js/features'),
            '@data': resolve(__dirname, './data'),
        },
    },
    
    // Optimize dependencies (exclude tests)
    optimizeDeps: {
        exclude: ['**/tests/**/*'],
    },
    
    // Define environment variables
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
    
    // Log the data directories on startup for debugging
    configureServer(server) {
        server.httpServer?.once('listening', () => {
            console.log('\n📂 Dev server started. Checking data paths...');
            const dataPath = resolve(__dirname, 'data');
            const regionsPath = resolve(__dirname, 'data/regions');
            const patronsPath = resolve(__dirname, 'data/patrons');
            const docsPath = resolve(__dirname, 'data/docs');
            
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