// ttrpg/utilities/javascript/fates-edge-web-client/vite.config.js

import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        rollupOptions: {
            // Exclude test files from the build
            output: {
                // This ensures tests aren't included
                entryFileNames: 'assets/[name].[hash].js',
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]'
            }
        }
    },
    // Don't process test files
    optimizeDeps: {
        exclude: ['**/tests/**/*']
    }
});
