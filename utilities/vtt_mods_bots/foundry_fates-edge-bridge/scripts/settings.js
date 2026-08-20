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
        hint: 'WebSocket server URL (e.g., ws://localhost:10000 or wss://your-server.com)',
        scope: 'world',
        config: true,
        type: String,
        default: 'ws://localhost:10000',
        onChange: () => {
            Hooks.call('fates-edge-bridge-settings-changed');
        }
    });
    
    game.settings.register('fates-edge-bridge', 'roomCode', {
        name: 'Room Code',
        hint: 'The room code to join (e.g., AC12)',
        scope: 'world',
        config: true,
        type: String,
        default: '',
        onChange: () => {
            Hooks.call('fates-edge-bridge-settings-changed');
        }
    });
    
    // NOTE: bridge.js's connect() has always read a 'password' setting
    // here (for the room's join password), but it was never registered
    // -- game.settings.get() would throw on a room that actually has one
    // set. Registering it now, since the server-side room password is a
    // real persistent feature (server/room.js) worth this bridge
    // actually supporting rather than silently erroring.
    game.settings.register('fates-edge-bridge', 'password', {
        name: 'Room Password',
        hint: "The room's join password, if the GM has set one (only needed for this account's first join -- see Account Token below to skip re-entering it after that)",
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
    
    // NEW: optional per-user JWT from the server's optional accounts
    // feature (server/auth.js). Get one via the web client's Account
    // panel, or the terminal/python client's login command, then paste
    // it here. Distinct from the static apiKey above -- the two auth
    // models don't overlap server-side. Leave blank for the exact same
    // anonymous-join behavior as before this setting existed.
    game.settings.register('fates-edge-bridge', 'authToken', {
        name: 'Account Token',
        hint: 'Optional per-account login token. Lets a GM skip re-entering a room password on later joins, and makes bans against this account persist across reconnects.',
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
    // AI GM Voice Narration (optional -- see the AI GM Bot's
    // TTS_ENABLED/TTS_URL and modules/tts-client.js). Off by default:
    // this is a genuinely interruptive, audible change (unlike the sync
    // toggles above, which are silent data plumbing), and a table
    // shouldn't suddenly start hearing the GM's replies spoken aloud
    // the first time someone enables TTS server-side without every
    // player having separately opted in here. Client-scoped so each
    // Foundry user's preference is their own, not something the world's
    // GM sets for everyone -- same reasoning as the web client's
    // per-browser narration toggle (js/features/vtt/tts-narration.js).
    // ============================================================

    game.settings.register('fates-edge-bridge', 'narrationEnabled', {
        name: 'AI GM Voice Narration',
        hint: "Play the AI GM's chat replies aloud, when the bot has voice narration configured (TTS_ENABLED on the bot). Off by default -- opt in per-user.",
        scope: 'client',
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register('fates-edge-bridge', 'narrationVolume', {
        name: 'AI GM Narration Volume',
        hint: 'Playback volume for AI GM voice narration (0 = silent, 1 = full).',
        scope: 'client',
        config: true,
        type: Number,
        default: 0.8,
        range: {
            min: 0,
            max: 1,
            step: 0.1
        }
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