/**
 * Fate's Edge - Logging Utility
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

function createLogger(levelName = 'INFO') {
    const currentLevel = LOG_LEVELS[levelName] || LOG_LEVELS.INFO;

    function log(level, message, data = null) {
        const levelNum = LOG_LEVELS[level] || LOG_LEVELS.INFO;
        if (levelNum < currentLevel) return;

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}]`;

        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    return {
        debug: (msg, data) => log('DEBUG', msg, data),
        info: (msg, data) => log('INFO', msg, data),
        warn: (msg, data) => log('WARN', msg, data),
        error: (msg, data) => log('ERROR', msg, data),
    };
}

module.exports = { createLogger };
