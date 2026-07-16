/**
 * Fate's Edge Bridge - Settings Configuration
 * Updated with GM Election/Promotion settings
 */

export const registerSettings = function() {
    // ============================================================
    // Connection Settings
    // ============================================================
    
    game.settings.register('fates-edge-bridge', 'serverUrl', {
        name: 'Server URL',
        hint: 'WebSocket server URL (e.g., ws://localhost:3000 or wss://your-server.com)',
        scope: 'world',
        config: true,
        type: String,
        default: 'ws://localhost:3000',
        onChange: () => {
            Hooks.call('fates-edge-bridge-settings-changed');
        }
    });
    
    game.settings.register('fates-edge-bridge', 'roomCode', {
        name: 'Room Code',
        hint: 'The room code to join (e.g., ABC123)',
        scope: 'world',
        config: true,
        type: String,
        default: '',
        onChange: () => {
            Hooks.call('fates-edge-bridge-settings-changed');
        }
    });
    
    game.settings.register('fates-edge-bridge', 'apiKey', {
        name: 'API Key',
        hint: 'API key for authentication (optional)',
        scope: 'world',
        config: true,
        type: String,
        default: '',
        onChange: () => {
            Hooks.call('fates-edge-bridge-settings-changed');
        }
    });
    
    game.settings.register('fates-edge-bridge', 'playerName', {
        name: 'Player Name',
        hint: 'Name to display in the VTT (leave empty to use Foundry user name)',
        scope: 'world',
        config: true,
        type: String,
        default: '',
        onChange: () => {
            Hooks.call('fates-edge-bridge-settings-changed');
        }
    });
    
    game.settings.register('fates-edge-bridge', 'defaultRegion', {
        name: 'Default Region',
        hint: 'Default region for deck draws',
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'Acasia': 'Acasia',
            'Aeler': 'Aeler',
            'Vhasia': 'Vhasia',
            'The Gray Expanse': 'The Gray Expanse'
        },
        default: 'Acasia',
        onChange: () => {
            Hooks.call('fates-edge-bridge-settings-changed');
            // Update region display
            const regionEl = document.getElementById('fates-edge-region');
            if (regionEl) {
                regionEl.textContent = `📍 ${game.settings.get('fates-edge-bridge', 'defaultRegion')}`;
            }
        }
    });
    
    // ============================================================
    // Auto-Connect
    // ============================================================
    
    game.settings.register('fates-edge-bridge', 'autoConnect', {
        name: 'Auto Connect',
        hint: 'Automatically connect to the VTT server on load',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        onChange: () => {
            Hooks.call('fates-edge-bridge-settings-changed');
        }
    });
    
    // ============================================================
    // Sync Options
    // ============================================================
    
    game.settings.register('fates-edge-bridge', 'syncChat', {
        name: 'Sync Chat',
        hint: 'Synchronize chat messages with the VTT',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    game.settings.register('fates-edge-bridge', 'syncRolls', {
        name: 'Sync Dice Rolls',
        hint: 'Synchronize dice rolls with the VTT',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    game.settings.register('fates-edge-bridge', 'syncCharacters', {
        name: 'Sync Characters',
        hint: 'Synchronize characters with the VTT',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    game.settings.register('fates-edge-bridge', 'syncTimers', {
        name: 'Sync Timers',
        hint: 'Synchronize timers with the VTT',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    game.settings.register('fates-edge-bridge', 'syncScenes', {
        name: 'Sync Scenes',
        hint: 'Synchronize scene changes with the VTT',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    game.settings.register('fates-edge-bridge', 'syncDeck', {
        name: 'Sync Deck',
        hint: 'Synchronize Deck of Consequences draws with the VTT',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    // ============================================================
    // GM Features
    // ============================================================
    
    game.settings.register('fates-edge-bridge', 'gmFeaturesEnabled', {
        name: 'Enable GM Management Features',
        hint: 'Enable Game Master election, promotion, and management UI',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        onChange: () => {
            // Refresh UI to show/hide GM button
            const gmBtn = document.getElementById('fates-edge-gm-btn');
            if (gmBtn) {
                gmBtn.style.display = game.settings.get('fates-edge-bridge', 'gmFeaturesEnabled') ? 'inline-block' : 'none';
            }
            // Also close GM dialog if disabled
            if (!game.settings.get('fates-edge-bridge', 'gmFeaturesEnabled')) {
                const dialog = document.querySelector('.fates-edge-gm-dialog');
                if (dialog) {
                    // Find the close button or trigger close
                    const closeBtn = dialog.closest('.dialog')?.querySelector('.dialog-close');
                    if (closeBtn) closeBtn.click();
                }
            }
        }
    });
    
    // ============================================================
    // Advanced Settings
    // ============================================================
    
    game.settings.register('fates-edge-bridge', 'reconnectAttempts', {
        name: 'Max Reconnect Attempts',
        hint: 'Maximum number of reconnection attempts',
        scope: 'world',
        config: true,
        type: Number,
        default: 10,
        range: {
            min: 1,
            max: 20,
            step: 1
        }
    });
    
    game.settings.register('fates-edge-bridge', 'heartbeatInterval', {
        name: 'Heartbeat Interval (ms)',
        hint: 'Interval between heartbeat pings (in milliseconds)',
        scope: 'world',
        config: true,
        type: Number,
        default: 30000,
        range: {
            min: 5000,
            max: 60000,
            step: 1000
        }
    });
    
    game.settings.register('fates-edge-bridge', 'debugMode', {
        name: 'Debug Mode',
        hint: 'Enable debug logging',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });
};