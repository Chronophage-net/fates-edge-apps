// ttrpg/utilities/javascript/fates-edge-web-client/vite.config.js

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Base URL - change if deploying to a subpath
    base: '/',
    
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            // Exclude test files from the build
            input: {
                main: resolve(__dirname, 'index.html'),
            },
            output: {
                // This ensures tests aren't included
                entryFileNames: 'assets/[name].[hash].js',
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]',
                // Exclude test files
                manualChunks: undefined
            },
            // Exclude test files from the build
            external: []
        },
        // Copy static assets
        assetsDir: 'assets',
        copyPublicDir: true,
        // Minify for production
        minify: 'esbuild',
        // Generate sourcemaps for debugging (optional)
        sourcemap: false
    },
    
    // Don't process test files
    optimizeDeps: {
        exclude: ['**/tests/**/*']
    },
    
    // Server config for development
    server: {
        port: 5173,
        open: true,
        // Handle SPA routing
        historyApiFallback: true
    },
    
    // Preview config for production preview
    preview: {
        port: 4173,
        open: true
    },
    
    // Resolve aliases for cleaner imports
    resolve: {
        alias: {
            '@': resolve(__dirname, './'),
            '@core': resolve(__dirname, './js/core'),
            '@components': resolve(__dirname, './js/components'),
            '@features': resolve(__dirname, './js/features'),
            '@data': resolve(__dirname, './data')
        }
    }
});
