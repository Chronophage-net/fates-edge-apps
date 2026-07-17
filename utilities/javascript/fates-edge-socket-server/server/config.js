/**
 * Fate's Edge - Configuration Loader
 * Reads from environment variables and optional config.json.
 */

const fs = require('fs');
const path = require('path');

function loadConfig() {
    const config = {
        port: parseInt(process.env.PORT, 10) || 10000,
        host: process.env.HOST || '0.0.0.0',
        logLevel: process.env.LOG_LEVEL || 'INFO',
        corsOrigin: process.env.CORS_ORIGIN || '*',
        maxDeckHistory: parseInt(process.env.MAX_DECK_HISTORY, 10) || 100,
        healthEndpoint: process.env.HEALTH_ENDPOINT || '/api/health',
        statsInterval: parseInt(process.env.STATS_INTERVAL, 10) || 30000,
    };

    const configFilePath = process.env.CONFIG_FILE || path.join(__dirname, 'config.json');
    if (fs.existsSync(configFilePath)) {
        try {
            const fileConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
            for (const key in fileConfig) {
                if (!(key in process.env)) {
                    config[key] = fileConfig[key];
                }
            }
            console.log(`[CONFIG] Loaded configuration from ${configFilePath}`);
        } catch (err) {
            console.error(`[CONFIG] Failed to parse config file ${configFilePath}: ${err.message}`);
        }
    } else {
        console.log(`[CONFIG] No config file found at ${configFilePath}; using environment/defaults.`);
    }

    return config;
}

module.exports = { loadConfig };
