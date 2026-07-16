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
            serverUrl: process.env.VTT_SERVER_URL || 'ws://localhost:3000',
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
            secret: process.env.WEBHOOK_SECRET || 'fates-edge-webhook'
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

    if (errors.length > 0) {
        logger.error('❌ Configuration errors:');
        errors.forEach(err => logger.error(`  - ${err}`));
        process.exit(1);
    }

    logger.info('✅ Configuration loaded successfully');
    return config;
}

module.exports = loadConfig();