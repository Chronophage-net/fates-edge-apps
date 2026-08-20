/**
 * Configuration Loader
 * Loads and validates environment variables
 */

const logger = require('./logger');

function loadConfig() {
    const config = {
        discord: {
            token: process.env.DISCORD_TOKEN,
            clientId: process.env.DISCORD_CLIENT_ID,
            guildId: process.env.DISCORD_GUILD_ID
        },
        vtt: {
            serverUrl: process.env.VTT_SERVER_URL || 'ws://localhost:10000',
            apiKey: process.env.VTT_API_KEY,
            roomCode: process.env.VTT_ROOM_CODE || '',
            logChannel: process.env.VTT_LOG_CHANNEL || ''  // <-- ADDED
        },
        bot: {
            prefix: process.env.PREFIX || '!',
            activityType: process.env.ACTIVITY_TYPE || 'PLAYING',
            activityName: process.env.ACTIVITY_NAME || 'Fate\'s Edge VTT',
            logLevel: process.env.LOG_LEVEL || 'info'
        },
        webhook: {
            port: parseInt(process.env.WEBHOOK_PORT) || 3001,
            // No hardcoded fallback -- this repo (and any fallback string
            // baked into it) is public, so a silent default here would be
            // a known secret. See index.js's startWebhookServer(), which
            // refuses to start rather than falling back too.
            secret: process.env.WEBHOOK_SECRET || null
        },
        // NEW: optional AI GM voice narration playback (see
        // utils/tts-voice.js and the AI GM Bot's TTS_ENABLED/TTS_URL).
        // Off unless BOTH are set -- a bare DISCORD_TTS_ENABLED with no
        // channel configured (or vice versa) is treated as "not
        // configured", not a half-broken feature.
        voice: {
            enabled: process.env.DISCORD_TTS_ENABLED === 'true',
            channelId: process.env.DISCORD_TTS_VOICE_CHANNEL_ID || ''
        }
    };

    // Validate required config
    const errors = [];

    if (!config.discord.token) {
        errors.push('DISCORD_TOKEN is required');
    }

    if (!config.discord.clientId) {
        errors.push('DISCORD_CLIENT_ID is required');
    }

    if (!config.vtt.serverUrl) {
        errors.push('VTT_SERVER_URL is required');
    }

    if (!config.vtt.roomCode) {
        logger.warn('⚠️ VTT_ROOM_CODE not set - will need to specify room in commands');
    }

    if (config.voice.enabled && !config.voice.channelId) {
        logger.warn('⚠️ DISCORD_TTS_ENABLED is true but DISCORD_TTS_VOICE_CHANNEL_ID is not set - AI GM voice narration will not play');
    }
    if (config.voice.channelId && !config.voice.enabled) {
        logger.warn('⚠️ DISCORD_TTS_VOICE_CHANNEL_ID is set but DISCORD_TTS_ENABLED is not "true" - AI GM voice narration stays off');
    }
    if (config.voice.enabled && !config.discord.guildId) {
        logger.warn('⚠️ DISCORD_TTS_ENABLED is true but DISCORD_GUILD_ID is not set - AI GM voice narration needs a guild to join a voice channel in');
    }

    if (errors.length > 0) {
        logger.error('❌ Configuration errors:');
        errors.forEach(err => logger.error(`  - ${err}`));
        process.exit(1);
    }

    logger.info('✅ Configuration loaded successfully');
    return config;
}

module.exports = loadConfig();