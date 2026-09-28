import { defineConfig } from 'vite';
import { resolve } from 'path';
import { staticDataPlugin } from './js/tools/static-data-plugin.js';

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
                main: resolve(import.meta.dirname, 'index.html'),
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
            '@': resolve(import.meta.dirname, './'),
            '@js': resolve(import.meta.dirname, './js'),
            '@core': resolve(import.meta.dirname, './js/core'),
            '@components': resolve(import.meta.dirname, './js/components'),
            '@features': resolve(import.meta.dirname, './js/features'),
            '@tools': resolve(import.meta.dirname, './js/tools'),
            '@data': resolve(import.meta.dirname, './data'),
        },
    },
    optimizeDeps: {
        exclude: ['**/tests/**/*'],
    },

    plugins: [staticDataPlugin(import.meta.dirname)],
});
