// Console logging for the manager, in the same shape as the socket server
// and the AI GM: one line per event, `time LEVEL message key=value...`.
// Coloured on a terminal, ISO time elsewhere; LOG_FORMAT=json for
// collectors. MANAGER_LOG_LEVEL (or LOG_LEVEL): error, warn, info, debug.
import { inspect } from 'node:util';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };

export function createLogger({ level = process.env.MANAGER_LOG_LEVEL || process.env.LOG_LEVEL || 'info', format = process.env.LOG_FORMAT, stream = process.stdout } = {}) {
  const min = LEVELS[String(level).toLowerCase()] ?? LEVELS.info;
  const json = String(format || '').toLowerCase() === 'json';
  const color = !process.env.NO_COLOR && (!!process.env.FORCE_COLOR || !!stream.isTTY);
  const value = v => v instanceof Error ? v.message : typeof v === 'string' ? (/[\s="]/.test(v) || !v ? JSON.stringify(v) : v)
    : typeof v === 'number' || typeof v === 'boolean' || v == null ? String(v) : inspect(v, { breakLength: Infinity, compact: true, depth: 3 });
  function log(lvl, message, fields = {}) {
    if (LEVELS[lvl] < min) return;
    const now = new Date();
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (json) {
      stream.write(JSON.stringify({ time: now.toISOString(), level: lvl, msg: message, ...Object.fromEntries(entries.map(([k, v]) => [k, v instanceof Error ? v.message : v])) }) + '\n');
      return;
    }
    const time = color ? now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0') : now.toISOString();
    const details = entries.length ? '  ' + entries.map(([k, v]) => `${k}=${value(v)}`).join(' ') : '';
    stream.write(color
      ? `\x1b[2m${time}\x1b[0m ${COLORS[lvl]}${lvl.toUpperCase().padEnd(5)}\x1b[0m ${message}${details ? '\x1b[2m' + details + '\x1b[0m' : ''}\n`
      : `${time} ${lvl.toUpperCase().padEnd(5)} ${message}${details}\n`);
    if (lvl === 'debug' && fields.error?.stack) stream.write(fields.error.stack + '\n');
  }
  return { debug: (m, f) => log('debug', m, f), info: (m, f) => log('info', m, f), warn: (m, f) => log('warn', m, f), error: (m, f) => log('error', m, f) };
}

export const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };
