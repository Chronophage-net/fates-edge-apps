/** Configuration: environment > config.json > defaults, validated before listening. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function integer(value, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
    if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value))) {
        throw new Error(`${name} must be a whole number between ${min} and ${max}`);
    }
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${name} must be between ${min} and ${max}`);
    return n;
}

function loadConfig({ env = process.env, logger = console } = {}) {
    const file = env.CONFIG_FILE || path.join(__dirname, 'config.json');
    let saved = {};
    if (fs.existsSync(file)) {
        try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); }
        catch { throw new Error('Configuration file is not valid JSON'); }
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Configuration file must contain an object');
    } else if (env.CONFIG_FILE) {
        throw new Error('Configured CONFIG_FILE does not exist');
    }
    const config = {};
    const read = (key, variable, fallback) => {
        const value = env[variable] !== undefined ? env[variable] : Object.hasOwn(saved, key) ? saved[key] : fallback;
        config[key] = value;
        return value;
    };
    const number = (key, variable, fallback, min = 0, max) => {
        config[key] = integer(read(key, variable, fallback), variable, min, max);
    };
    number('port', 'PORT', 10000, 0, 65535);
    number('maxDeckHistory', 'MAX_DECK_HISTORY', 100);
    number('maxChatHistory', 'MAX_CHAT_HISTORY', 50);
    number('statsInterval', 'STATS_INTERVAL', 30000, 1, 2147483647);
    number('apiRateLimitWindowMs', 'API_RATE_LIMIT_WINDOW_MS', 60000, 1, 2147483647);
    number('apiRateLimitMax', 'API_RATE_LIMIT_MAX', 300);
    number('wsMessageRateWindowMs', 'WS_MESSAGE_RATE_WINDOW_MS', 10000, 1, 2147483647);
    number('wsMessageRateMax', 'WS_MESSAGE_RATE_MAX', 120);
    number('maxClientsPerRoom', 'MAX_CLIENTS_PER_ROOM', 0);
    number('wsMaxPayloadBytes', 'WS_MAX_PAYLOAD_BYTES', 8 * 1024 * 1024, 1024, 100 * 1024 * 1024);
    number('handshakeTimeoutMs', 'HANDSHAKE_TIMEOUT_MS', 10000, 100, 120000);
    number('turnCredentialTtl', 'TURN_CREDENTIAL_TTL', 86400, 1, 604800);

    for (const [key, variable, fallback] of [
        ['host', 'HOST', '0.0.0.0'], ['logLevel', 'LOG_LEVEL', 'INFO'],
        ['healthEndpoint', 'HEALTH_ENDPOINT', '/api/health'], ['apiKey', 'API_KEY', null],
        ['freesoundApiKey', 'FREESOUND_API_KEY', null], ['redisUrl', 'REDIS_URL', null],
        ['turnSecret', 'TURN_SECRET', null], ['turnRealm', 'TURN_REALM', 'fates-edge'],
    ]) {
        const value = read(key, variable, fallback);
        if (value !== null && typeof value !== 'string') throw new Error(`${variable} must be a string`);
    }
    if (!config.host || !/^\/(?:[A-Za-z0-9_/-]*)$/.test(config.healthEndpoint)) throw new Error('HOST and HEALTH_ENDPOINT must be valid');
    config.logLevel = config.logLevel.toUpperCase();
    if (!['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(config.logLevel)) throw new Error('Invalid LOG_LEVEL');

    const origins = read('corsOrigin', 'CORS_ORIGIN', '*');
    if (origins !== '*') {
        const values = Array.isArray(origins) ? origins : typeof origins === 'string' ? origins.split(',') : [];
        if (!values.length) throw new Error('CORS_ORIGIN must be * or a list of HTTP(S) origins');
        config.corsOrigin = values.map(value => {
            try {
                const url = new URL(value.trim());
                if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
                return url.origin;
            } catch { throw new Error('CORS_ORIGIN must contain only HTTP(S) origins'); }
        });
    }
    const proxy = read('trustProxy', 'TRUST_PROXY', false);
    if (proxy === false || proxy === 'false' || proxy === '') config.trustProxy = false;
    else if (/^\d+$/.test(String(proxy))) config.trustProxy = integer(proxy, 'TRUST_PROXY', 0, 32);
    else if (typeof proxy === 'string' && proxy !== 'true') config.trustProxy = proxy.split(',').map(v => v.trim());
    else throw new Error('TRUST_PROXY must be false, a hop count, or trusted IP/CIDR addresses');

    const workers = read('clusterWorkers', 'CLUSTER_WORKERS', 0);
    config.clusterWorkers = String(workers).toLowerCase() === 'auto' ? require('node:os').cpus().length : integer(workers, 'CLUSTER_WORKERS', 0, 1024);
    const urls = read('turnUrls', 'TURN_URLS', []);
    config.turnUrls = Array.isArray(urls) ? urls : typeof urls === 'string' ? urls.split(',').map(v => v.trim()).filter(Boolean) : null;
    if (!config.turnUrls || config.turnUrls.some(url => typeof url !== 'string' || !/^turns?:\S+$/.test(url))) throw new Error('TURN_URLS must contain TURN URLs');

    if (!config.apiKey) {
        config.apiKey = crypto.randomBytes(24).toString('hex');
        logger.log(`No API_KEY configured. Temporary admin key: ${config.apiKey}`);
        logger.log('Set API_KEY to keep the same key across restarts.');
    }
    return config;
}
module.exports = { loadConfig };
