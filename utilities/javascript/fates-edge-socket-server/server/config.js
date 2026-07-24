/**
 * Fate's Edge - Configuration Loader
 * Reads from environment variables and optional config.json.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadConfig() {
    const config = {
        port: parseInt(process.env.PORT, 10) || 10000,
        host: process.env.HOST || '0.0.0.0',
        logLevel: process.env.LOG_LEVEL || 'INFO',
        corsOrigin: process.env.CORS_ORIGIN || '*',
        maxDeckHistory: parseInt(process.env.MAX_DECK_HISTORY, 10) || 100,
        healthEndpoint: process.env.HEALTH_ENDPOINT || '/api/health',
        statsInterval: parseInt(process.env.STATS_INTERVAL, 10) || 30000,
        apiKey: process.env.API_KEY || null,
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

    // The admin API (kick/ban, module push, character/campaign read-write)
    // MUST be protected by a real secret. Previously the "API key" check
    // only verified that *some* header was present -- any value at all
    // was accepted, which is equivalent to no authentication. If no key
    // is configured, generate one and print it loudly ONCE at startup
    // (same pattern Jupyter/similar admin tools use) rather than silently
    // running wide open.
    if (!config.apiKey) {
        config.apiKey = crypto.randomBytes(24).toString('hex');
        console.log('='.repeat(70));
        console.log('⚠️  No API_KEY configured -- generated a random one for this run:');
        console.log(`    ${config.apiKey}`);
        console.log('    Set the API_KEY environment variable to persist this across restarts.');
        console.log('='.repeat(70));
    }

    return config;
}

module.exports = { loadConfig };
