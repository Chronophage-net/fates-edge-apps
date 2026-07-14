/**
 * Fate's Edge Bridge v1.2.0 - Main Entry Point
 * Supports Deck of Consequences, Crown Spread, Modules, and Regions
 */

import { FatesEdgeBridge } from './bridge.js';
import { registerSettings } from './settings.js';

// ============================================================
// Module Registration
// ============================================================

Hooks.once('init', () => {
    console.log('⚔️ Fate\'s Edge Bridge v1.2.0 initializing...');
    
    // Register settings
    registerSettings();
    
    // Register hooks
    FatesEdgeBridge.initialize();
    
    // Add status bar UI
    addStatusBarUI();
    
    console.log('⚔️ Fate\'s Edge Bridge v1.2.0 initialized');
});

Hooks.once('ready', () => {
    // Auto-connect if enabled
    if (game.settings.get('fates-edge-bridge', 'autoConnect')) {
        setTimeout(() => {
            FatesEdgeBridge.connect();
        }, 2000);
    }
});

// ============================================================
// Status Bar UI
// ============================================================

function addStatusBarUI() {
    const statusBar = document.getElementById('ui-left');
    if (!statusBar) return;
    
    const container = document.createElement('div');
    container.id = 'fates-edge-status-container';
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: 8px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
    `;
    
    container.innerHTML = `
        <span id="fates-edge-status" style="color: #747f8d;">⚪ Disconnected</span>
        <span id="fates-edge-deck" style="color: #d4af37;">🃏 54</span>
        <span id="fates-edge-voice" style="color: #747f8d;">🎤 Off</span>
        <span id="fates-edge-region" style="color: #8ac49a;">📍 ${game.settings.get('fates-edge-bridge', 'defaultRegion') || 'Acasia'}</span>
    `;
    
    container.addEventListener('click', () => {
        if (FatesEdgeBridge.connected) {
            FatesEdgeBridge.disconnect();
        } else {
            FatesEdgeBridge.connect();
        }
    });
    
    statusBar.prepend(container);
}

// ============================================================
// Helper Functions for Macros
// ============================================================

// Global access for macro use
window.FatesEdgeBridge = FatesEdgeBridge;

// Quick macro functions
window.drawCard = function(count = 1) {
    FatesEdgeBridge.sendDeckDraw(count);
};

window.crownSpread = function(region = null) {
    FatesEdgeBridge.sendCrownSpread(region);
};

window.shuffleDeck = function() {
    FatesEdgeBridge.sendDeckShuffle();
};

window.setRegion = function(region) {
    FatesEdgeBridge.defaultRegion = region;
    FatesEdgeBridge._sendRegionUpdate(region);
    ui.notifications.info(`📍 Region set to: ${region}`);
};

window.listModules = function() {
    FatesEdgeBridge.sendModuleList();
};

window.getDeckStatus = function() {
    return {
        remaining: FatesEdgeBridge.deckState.remaining,
        history: FatesEdgeBridge.deckState.history.length
    };
};

// ============================================================
// CSS for status bar
// ============================================================

const style = document.createElement('style');
style.textContent = `
    #fates-edge-status-container {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: 8px;
        padding: 4px 10px;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s ease;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    #fates-edge-status-container:hover {
        background: rgba(0, 0, 0, 0.8);
        border-color: rgba(212, 175, 55, 0.3);
    }
    
    #fates-edge-status {
        min-width: 90px;
    }
    
    #fates-edge-deck {
        min-width: 40px;
        font-weight: bold;
    }
    
    #fates-edge-voice {
        min-width: 50px;
    }
    
    #fates-edge-region {
        min-width: 70px;
    }
    
    .fates-edge-status-connected {
        color: #43b581 !important;
    }
    
    .fates-edge-status-disconnected {
        color: #f04747 !important;
    }
    
    .fates-edge-status-connecting {
        color: #faa61a !important;
    }
`;
document.head.appendChild(style);