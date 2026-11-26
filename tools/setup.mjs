#!/usr/bin/env node
// `npm run setup` -- one-time local installation, no Docker needed.
//
//   1. checks Node.js,
//   2. installs the socket server and web client (and the AI GM bot when
//      it is cloned next to this repository),
//   3. writes the server's .env with generated secrets, and the bot's
//      .env pointing at that server with the same admin key.
//
// Safe to run again: it never overwrites a setting you chose, only fills
// in missing or placeholder secrets and brings the bot's key in line with
// the server's.
//
// Options:
//   --provider=ollama|openai|deepseek   AI backend for the bot (default ollama)
//   --room=CODE                         room the bot joins (default AC12)
//   --no-bot                            skip the AI GM bot
//   --skip-install                      only write configuration
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  SERVER_DIR, CLIENT_DIR, BOT_DIR, BOT_REPO, MIN_NODE, CLIENT_DEV_PORT,
  bold, dim, ok, warn, fail, info, nodeVersionOk, secret, isPlaceholder, readEnv, writeEnv, depsInstalled, botPresent,
} from './lib/toolkit.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const provider = String(args.provider || 'ollama').toLowerCase();
const room = String(args.room || 'AC12').toUpperCase();
if (!['ollama', 'openai', 'deepseek'].includes(provider)) {
  fail(`Unknown provider "${provider}". Use ollama, openai or deepseek.`);
  process.exit(1);
}

console.log(bold('\nFate’s Edge setup\n'));

// 1. Node.js
if (!nodeVersionOk()) {
  fail(`Node.js ${MIN_NODE.join('.')} or newer is required; this is ${process.versions.node}.`);
  info('Install the current LTS from https://nodejs.org/ and run `npm run setup` again.');
  process.exit(1);
}
ok(`Node.js ${process.versions.node}`);

// 2. Dependencies
const useBot = !args['no-bot'] && botPresent();
const components = [['socket server', SERVER_DIR], ['web client', CLIENT_DIR], ...(useBot ? [['AI GM bot', BOT_DIR]] : [])];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
if (!args['skip-install']) {
  for (const [name, dir] of components) {
    if (depsInstalled(dir)) { ok(`${name}: dependencies up to date`); continue; }
    info(`${name}: installing dependencies (this can take a minute)…`);
    const result = spawnSync(npm, ['ci', '--no-audit', '--no-fund'], { cwd: dir, stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' });
    if (result.status !== 0) {
      fail(`${name}: npm ci failed (exit ${result.status}). Fix the error above, then run \`npm run setup\` again.`);
      process.exit(1);
    }
    ok(`${name}: dependencies installed`);
  }
}

// 3. Server configuration
const serverEnv = join(SERVER_DIR, '.env');
const before = readEnv(serverEnv);
const serverUpdates = {};
if (isPlaceholder(before.values.API_KEY)) serverUpdates.API_KEY = secret(24);
if (isPlaceholder(before.values.AUTH_JWT_SECRET)) serverUpdates.AUTH_JWT_SECRET = secret(32);
if (!before.exists) {
  // Local play: only the dev web client calls the REST API from a browser.
  serverUpdates.CORS_ORIGIN = `http://localhost:${CLIENT_DEV_PORT},http://127.0.0.1:${CLIENT_DEV_PORT}`;
}
if (!before.exists || Object.keys(serverUpdates).length) {
  writeEnv(serverEnv, serverUpdates, join(SERVER_DIR, '.env.example'));
  ok(`socket server: ${before.exists ? 'filled in ' + Object.keys(serverUpdates).join(', ') : 'wrote'} ${dim(serverEnv)}`);
} else {
  ok('socket server: .env already configured');
}
const server = readEnv(serverEnv).values;
const port = Number(server.PORT || 10000);

// 4. Bot configuration
if (useBot) {
  const botEnv = join(BOT_DIR, '.env');
  const bot = readEnv(botEnv);
  const updates = {};
  if (!bot.exists) {
    Object.assign(updates, {
      AI_PROVIDER: provider,
      WS_URL: `ws://localhost:${port}`,
      ROOM: room,
      BOT_NAME: 'AI_GM',
      MODE: 'gm',
      // Run without a terminal: never stop for interactive prompts.
      HEADLESS: 'true',
      ...(provider === 'openai' ? { OPENAI_API_KEY: '' } : {}),
      ...(provider === 'deepseek' ? { DEEPSEEK_API_KEY: '' } : {}),
    });
  }
  // The bot authenticates to the server with the server's admin key.
  const local = /^wss?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(bot.values.WS_URL || `ws://localhost:${port}`);
  if (local && bot.values.API_KEY !== server.API_KEY) updates.API_KEY = server.API_KEY;
  if (Object.keys(updates).length) {
    writeEnv(botEnv, updates);
    ok(`AI GM bot: ${bot.exists ? 'matched API_KEY to the server' : 'wrote'} ${dim(botEnv)}`);
  } else {
    ok('AI GM bot: .env already configured');
  }
  const chosen = (readEnv(botEnv).values.AI_PROVIDER || 'ollama').toLowerCase();
  const keyName = { openai: 'OPENAI_API_KEY', deepseek: 'DEEPSEEK_API_KEY' }[chosen];
  if (keyName && isPlaceholder(readEnv(botEnv).values[keyName])) {
    warn(`AI GM bot: add your ${keyName} to ${botEnv}`);
  } else if (chosen === 'ollama') {
    info('AI GM bot: uses Ollama at http://localhost:11434 (install from https://ollama.com, then `ollama pull gemma3:12b`, or gemma3:4b on a smaller machine).');
  }
} else if (!args['no-bot']) {
  info(`AI GM bot: not found next to this repository. To add it: ${bold(`git clone ${BOT_REPO} ${BOT_DIR}`)} and run setup again.`);
}

console.log(`\n${bold('Ready.')} Start everything with ${bold('npm start')} (Ctrl+C stops it).`);
console.log(`Check a setup any time with ${bold('npm run doctor')}.\n`);
