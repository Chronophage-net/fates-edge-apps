// Shared helpers for `npm run setup`, `npm start` and `npm run doctor`.
// Node built-ins only, so they run before anything is installed.
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import net from 'node:net';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SERVER_DIR = join(ROOT, 'utilities/javascript/fates-edge-socket-server');
export const CLIENT_DIR = join(ROOT, 'utilities/javascript/fates-edge-web-client');
// The AI GM bot lives in its own repository, cloned next to this one.
export const BOT_DIR = resolve(ROOT, '..', 'fates-edge-ai-gm-bot');
export const BOT_REPO = 'https://github.com/Chronophage-net/fates-edge-ai-gm-bot';
export const MIN_NODE = [22, 12];
export const CLIENT_DEV_PORT = 5173;
export const BOT_STATUS_PORT = 4141;

export const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = code => text => (color ? `\x1b[${code}m${text}\x1b[0m` : String(text));
export const bold = paint('1'), dim = paint('2'), green = paint('32'), yellow = paint('33'), red = paint('31'), cyan = paint('36');
export const ok = text => console.log(`${green('✔')} ${text}`);
export const warn = text => console.log(`${yellow('!')} ${text}`);
export const fail = text => console.log(`${red('✖')} ${text}`);
export const info = text => console.log(`${cyan('›')} ${text}`);

export function nodeVersionOk(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  return major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
}

export const secret = (bytes = 24) => randomBytes(bytes).toString('hex');

// Values that mean "never set": blank, or an example placeholder.
const PLACEHOLDER = /^(|change-me.*|your-.*|<.*>|ThisIsATerribleAPIKey.*|sk-x+|replace.*)$/i;
export const isPlaceholder = value => value == null || PLACEHOLDER.test(String(value).trim());

/** Read a .env file into { values, lines } (missing file: empty). */
export function readEnv(path) {
  const values = {};
  if (!existsSync(path)) return { values, lines: [], exists: false };
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].replace(/\s+#.*$/, '').trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    values[m[1]] = value;
  }
  return { values, lines, exists: true };
}

/**
 * Set keys in a .env file, keeping its comments and order: existing keys
 * are rewritten in place, new keys are appended. Creates the file from
 * `template` (path) if it does not exist yet.
 */
export function writeEnv(path, updates, template = null) {
  let lines = existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/)
    : template && existsSync(template) ? readFileSync(template, 'utf8').split(/\r?\n/) : [];
  const pending = { ...updates };
  lines = lines.map(line => {
    const m = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m && m[2] in pending) { const value = pending[m[2]]; delete pending[m[2]]; return `${m[1]}${m[2]}=${value}`; }
    return line;
  });
  const extra = Object.entries(pending);
  if (extra.length) {
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.push(...(lines.length ? [''] : []), ...extra.map(([k, v]) => `${k}=${v}`));
  }
  writeFileSync(path, lines.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
}

/** True when node_modules is present and not older than the lockfile. */
export function depsInstalled(dir) {
  const marker = join(dir, 'node_modules', '.package-lock.json');
  if (!existsSync(marker)) return false;
  const lock = join(dir, 'package-lock.json');
  return !existsSync(lock) || statSync(marker).mtimeMs >= statSync(lock).mtimeMs - 1000;
}

/** Resolve when something accepts connections on host:port. */
export function portOpen(port, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise(resolve => {
    const socket = net.connect({ port, host });
    const done = result => { socket.destroy(); resolve(result); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** The Fate's Edge server's public health JSON at that port, or null. */
export async function serverHealth(port, host = '127.0.0.1') {
  try {
    const res = await fetch(`http://${host}:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    const data = await res.json();
    return data && data.status === 'ok' ? data : null;
  } catch { return null; }
}

/** What the server's .env says about port and admin key. */
export function serverSettings() {
  const { values, exists } = readEnv(join(SERVER_DIR, '.env'));
  return { exists, values, port: Number(values.PORT || 10000), apiKey: values.API_KEY || '' };
}

export function botPresent() {
  return existsSync(join(BOT_DIR, 'ai-gm-bot.js'));
}
