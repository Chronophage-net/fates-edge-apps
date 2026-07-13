/**
 * Fate's Edge Bridge - Settings Registration
 */

export const FatesEdgeSettings = {
    register() {
        game.settings.register('fates-edge-bridge', 'serverUrl', {
            name: 'Server URL',
            hint: 'The URL of the Fate\'s Edge WebSocket server (e.g., ws://localhost:3000)',
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
            hint: 'The room code to connect to (e.g., ABC123)',
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
            hint: 'Your display name in the VTT (default: Foundry username)',
            scope: 'world',
            config: true,
            type: String,
            default: '',
            onChange: () => {
                Hooks.call('fates-edge-bridge-settings-changed');
            }
        });
        
        game.settings.register('fates-edge-bridge', 'autoConnect', {
            name: 'Auto-Connect',
            hint: 'Automatically connect to the server when Foundry loads',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true,
            onChange: () => {
                Hooks.call('fates-edge-bridge-settings-changed');
            }
        });
        
        game.settings.register('fates-edge-bridge', 'syncChat', {
            name: 'Sync Foundry Chat',
            hint: 'Send Foundry chat messages to the VTT',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });
        
        game.settings.register('fates-edge-bridge', 'syncRolls', {
            name: 'Sync Foundry Rolls',
            hint: 'Send Foundry dice rolls to the VTT',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });
        
        game.settings.register('fates-edge-bridge', 'syncActors', {
            name: 'Sync Actors to VTT',
            hint: 'Sync selected Foundry actors to the VTT as characters',
            scope: 'world',
            config: true,
            type: Boolean,
            default: false
        });
    }
};
