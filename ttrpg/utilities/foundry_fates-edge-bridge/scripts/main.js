\/**
 * Fate's Edge Bridge - Foundry VTT Module
 * Connects Foundry to the Fate's Edge WebSocket Server
 */

import { FatesEdgeBridge } from './bridge.js';
import { FatesEdgeSettings } from './settings.js';

Hooks.once('init', () => {
    console.log('⚔️ Fate\'s Edge Bridge initializing...');
    
    // Register settings
    FatesEdgeSettings.register();
    
    // Register the bridge
    FatesEdgeBridge.initialize();
});

Hooks.once('ready', () => {
    console.log('✅ Fate\'s Edge Bridge ready');
    
    // Auto-connect if enabled
    if (game.settings.get('fates-edge-bridge', 'autoConnect')) {
        FatesEdgeBridge.connect();
    }
});

// Clean up on shutdown
Hooks.on('close', () => {
    FatesEdgeBridge.disconnect();
});
