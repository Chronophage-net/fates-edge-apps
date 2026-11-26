#!/usr/bin/env node
// `npm start` -- run the toolkit locally: the socket server, the web
// client's dev server and (when set up) the AI GM bot, with their output
// labelled in one terminal. Ctrl+C stops them all.
//
// Options:
//   --no-bot      do not start the AI GM bot
//   --no-client   do not start the web client
//   --show-key    print the admin API key in the summary
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SERVER_DIR, CLIENT_DIR, BOT_DIR, CLIENT_DEV_PORT, BOT_STATUS_PORT,
  bold, dim, green, yellow, cyan, fail, warn, info,
  nodeVersionOk, MIN_NODE, depsInstalled, botPresent, readEnv, isPlaceholder, portOpen, serverHealth, serverSettings, color,
} from './lib/toolkit.mjs';

const flags = new Set(process.argv.slice(2).map(a => a.replace(/^--/, '')));
const children = new Map();
let stopping = false;

function preflight() {
  const problems = [];
  if (!nodeVersionOk()) problems.push(`Node.js ${MIN_NODE.join('.')} or newer is required (this is ${process.versions.node}).`);
  if (!depsInstalled(SERVER_DIR)) problems.push('The socket server is not installed.');
  if (!flags.has('no-client') && !depsInstalled(CLIENT_DIR)) problems.push('The web client is not installed.');
  if (!existsSync(join(SERVER_DIR, '.env'))) problems.push('The socket server has no .env.');
  if (problems.length) {
    problems.forEach(fail);
    info(`Run ${bold('npm run setup')} first, then ${bold('npm start')} again.`);
    process.exit(1);
  }
}

const LABEL_WIDTH = 7;
function run(name, paint, command, args, options) {
  const child = spawn(command, args, { ...options, env: { ...process.env, ...(color ? { FORCE_COLOR: '1' } : {}), ...options.env }, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const prefix = paint(name.padEnd(LABEL_WIDTH)) + dim('│ ');
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = '';
    stream.on('data', chunk => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) process.stdout.write(prefix + line + '\n');
    });
  }
  child.on('exit', (code, signal) => {
    children.delete(name);
    if (stopping) return;
    const how = signal ? `was stopped (${signal})` : `exited with code ${code}`;
    if (name === 'server') {
      fail(`The socket server ${how}; stopping everything. Its last lines are above.`);
      shutdown(1);
    } else {
      warn(`${name} ${how}. The rest keeps running; see its lines above. (Ctrl+C to stop.)`);
    }
  });
  children.set(name, child);
  return child;
}

async function waitFor(check, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await check()) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  if (children.size) console.log(dim('\nStopping…'));
  for (const child of children.values()) child.kill('SIGINT');
  const force = setTimeout(() => { for (const child of children.values()) child.kill('SIGKILL'); process.exit(code); }, 8000);
  const check = setInterval(() => { if (!children.size) { clearInterval(check); clearTimeout(force); process.exit(code); } }, 100);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

preflight();
const settings = serverSettings();
const { port } = settings;

// The server: reuse one already running on the port, refuse anything else there.
if (await portOpen(port)) {
  if (await serverHealth(port)) {
    warn(`A Fate’s Edge server is already running on port ${port}; using it.`);
  } else {
    fail(`Port ${port} is in use by another program. Stop it, or set PORT in ${join(SERVER_DIR, '.env')}.`);
    process.exit(1);
  }
} else {
  run('server', cyan, process.execPath, ['server-start.js'], { cwd: SERVER_DIR, env: {} });
  if (!await waitFor(() => serverHealth(port), 30000)) {
    fail(`The socket server did not answer on port ${port} within 30 seconds.`);
    shutdown(1);
    await new Promise(() => {});
  }
}

if (!flags.has('no-client')) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run('client', green, npm, ['run', 'dev', '--', '--strictPort'], {
    cwd: CLIENT_DIR,
    env: { VITE_SELF_HOSTED_SERVER_PORT: String(port) },
  });
}

let botStarted = false;
if (!flags.has('no-bot') && botPresent()) {
  const bot = readEnv(join(BOT_DIR, '.env'));
  const provider = (bot.values.AI_PROVIDER || 'ollama').toLowerCase();
  const keyName = { openai: 'OPENAI_API_KEY', deepseek: 'DEEPSEEK_API_KEY' }[provider];
  if (!bot.exists) warn(`AI GM bot: not configured yet. Run ${bold('npm run setup')} to configure it.`);
  else if (keyName && isPlaceholder(bot.values[keyName])) warn(`AI GM bot: skipped. Add ${keyName} to ${join(BOT_DIR, '.env')} to start it.`);
  else if (bot.values.API_KEY !== settings.apiKey && /localhost|127\.0\.0\.1/.test(bot.values.WS_URL || 'localhost')) warn(`AI GM bot: skipped. Its API_KEY does not match the server's; run ${bold('npm run setup')} to fix it.`);
  else if (!depsInstalled(BOT_DIR)) warn(`AI GM bot: skipped. It is not installed; run ${bold('npm run setup')}.`);
  else { run('ai-gm', yellow, process.execPath, ['ai-gm-bot.js'], { cwd: BOT_DIR, env: {} }); botStarted = true; }
}

if (!flags.has('no-client')) await waitFor(() => portOpen(CLIENT_DEV_PORT), 30000);

const line = '─'.repeat(64);
console.log(`\n${line}`);
console.log(bold('Fate’s Edge is running'));
if (!flags.has('no-client')) console.log(`  Play:            ${bold(`http://localhost:${CLIENT_DEV_PORT}`)}`);
console.log(`  Server console:  http://localhost:${port}/console   ${dim(flags.has('show-key') ? `key ${settings.apiKey}` : `key: API_KEY in ${join(SERVER_DIR, '.env')} (or --show-key)`)}`);
if (botStarted) console.log(`  AI GM status:    http://localhost:${BOT_STATUS_PORT}   ${dim(`room ${readEnv(join(BOT_DIR, '.env')).values.ROOM || 'AC12'}`)}`);
console.log(`  Stop:            Ctrl+C`);
console.log(`${line}\n`);
