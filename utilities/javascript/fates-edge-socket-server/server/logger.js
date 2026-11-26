/**
 * Fate's Edge - Logging Utility
 *
 * One line per event, readable in a terminal and parseable by machines:
 *
 *   16:56:33.248 INFO  🔌 Client joined  room=ABCD name=Wren role=player via=ws
 *
 * - In a terminal (TTY) the level is coloured and the time is local
 *   HH:MM:SS.mmm; otherwise (Docker, systemd, a file) the time is ISO-8601.
 * - LOG_FORMAT=json prints one JSON object per line for log collectors.
 * - Details are key=value pairs on the same line instead of a multi-line
 *   object dump. Errors show their message; their stack at DEBUG.
 * - A `room` value that is an internal room id is shown as the room's
 *   code once a resolver is registered (setRoomLabeler), so the console
 *   says room=ABCD rather than a UUID.
 */

const util = require('util');

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const COLORS = { DEBUG: '\x1b[90m', INFO: '\x1b[36m', WARN: '\x1b[33m', ERROR: '\x1b[31m' };
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let roomLabeler = null;

// Recent entries for the web console (GET /api/admin/log). Shared by
// every logger instance in the process; details are stored as display
// strings so nothing live (sockets, errors with stacks) is retained.
const RING_SIZE = Math.max(50, parseInt(process.env.LOG_RING_SIZE || '500', 10) || 500);
const ring = [];
let seq = 0;

function remember(level, message, fields) {
    const entry = { id: ++seq, time: Date.now(), level: level.toLowerCase(), msg: message };
    if (fields) {
        entry.fields = {};
        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) entry.fields[key] = formatValue(value, 'INFO');
        }
    }
    ring.push(entry);
    if (ring.length > RING_SIZE) ring.shift();
}

/** Entries after `sinceId` (all retained entries when 0), oldest first. */
function recentLogs(sinceId = 0, limit = 200) {
    const after = ring.filter(e => e.id > sinceId);
    return after.slice(-limit);
}

/** Register a function mapping a room id to its human-readable code. */
function setRoomLabeler(fn) {
    roomLabeler = typeof fn === 'function' ? fn : null;
}

function roomLabel(value) {
    if (!roomLabeler || typeof value !== 'string') return value;
    try { return roomLabeler(value) || value; } catch { return value; }
}

function useColor() {
    if (process.env.NO_COLOR) return false;
    if (process.env.FORCE_COLOR) return true;
    return !!process.stdout.isTTY;
}

function formatValue(value, level) {
    if (value instanceof Error) {
        return level === 'DEBUG' && value.stack ? value.stack : value.message;
    }
    if (value === null || value === undefined) return String(value);
    if (typeof value === 'string') return /[\s="]/.test(value) || value === '' ? JSON.stringify(value) : value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return util.inspect(value, { breakLength: Infinity, depth: 3, compact: true });
}

function normalize(data) {
    if (data === null || data === undefined) return null;
    if (data instanceof Error) return { error: data };
    if (typeof data !== 'object') return { detail: data };
    const out = { ...data };
    if ('room' in out) out.room = roomLabel(out.room);
    return out;
}

function createLogger(levelName = 'INFO') {
    const currentLevel = LOG_LEVELS[String(levelName).toUpperCase()] ?? LOG_LEVELS.INFO;
    const json = String(process.env.LOG_FORMAT || '').toLowerCase() === 'json';

    function log(level, message, data = null) {
        const levelNum = LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
        if (levelNum < currentLevel) return;
        const fields = normalize(data);
        const now = new Date();
        remember(level, message, fields);

        if (json) {
            const entry = { time: now.toISOString(), level: level.toLowerCase(), msg: message };
            for (const [key, value] of Object.entries(fields || {})) {
                entry[key] = value instanceof Error ? { message: value.message, ...(levelNum <= LOG_LEVELS.DEBUG ? { stack: value.stack } : {}) } : value;
            }
            const line = JSON.stringify(entry);
            (levelNum >= LOG_LEVELS.WARN ? console.error : console.log)(line);
            return;
        }

        const color = useColor();
        const time = color ? now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0') : now.toISOString();
        const tag = level.padEnd(5);
        const details = fields
            ? '  ' + Object.entries(fields).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${formatValue(v, level)}`).join(' ')
            : '';
        const line = color
            ? `${DIM}${time}${RESET} ${COLORS[level]}${tag}${RESET} ${message}${details ? DIM + details + RESET : ''}`
            : `${time} ${tag} ${message}${details}`;
        (levelNum >= LOG_LEVELS.WARN ? console.error : console.log)(line);
    }

    return {
        debug: (msg, data) => log('DEBUG', msg, data),
        info: (msg, data) => log('INFO', msg, data),
        warn: (msg, data) => log('WARN', msg, data),
        error: (msg, data) => log('ERROR', msg, data),
    };
}

module.exports = { createLogger, setRoomLabeler, recentLogs };
