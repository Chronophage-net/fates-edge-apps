#!/usr/bin/env node
// `npm run doctor` -- check a local installation and say what to fix.
// Read-only: it never changes a file. Exit code 1 when something blocks
// play, 0 when only warnings (or nothing) remain.
import { join } from 'node:path';
import {
  SERVER_DIR, CLIENT_DIR, BOT_DIR, BOT_REPO, MIN_NODE, CLIENT_DEV_PORT,
  bold, ok, warn, fail, info, nodeVersionOk, depsInstalled, botPresent, readEnv, isPlaceholder, portOpen, serverHealth,
} from './lib/toolkit.mjs';

let blocking = 0;
const problem = (text, fix) => { blocking++; fail(text); if (fix) info(fix); };
const caution = (text, fix) => { warn(text); if (fix) info(fix); };

console.log(bold('\nFate’s Edge doctor\n'));

nodeVersionOk() ? ok(`Node.js ${process.versions.node}`)
  : problem(`Node.js ${process.versions.node} is too old; ${MIN_NODE.join('.')} or newer is required.`, 'Install the current LTS from https://nodejs.org/.');

for (const [name, dir] of [['Socket server', SERVER_DIR], ['Web client', CLIENT_DIR]]) {
  depsInstalled(dir) ? ok(`${name} installed`) : problem(`${name} is not installed (or its dependencies changed).`, 'Run `npm run setup`.');
}

// Server configuration
const serverEnvPath = join(SERVER_DIR, '.env');
const server = readEnv(serverEnvPath);
const port = Number(server.values.PORT || 10000);
if (!server.exists) {
  problem('The socket server has no .env.', 'Run `npm run setup` (or copy .env.example to .env and set API_KEY).');
} else {
  isPlaceholder(server.values.API_KEY)
    ? problem('API_KEY is blank or a placeholder: the AI GM bot and the console cannot sign in reliably.', 'Run `npm run setup` to generate one.')
    : ok('Server API_KEY set');
  isPlaceholder(server.values.AUTH_JWT_SECRET)
    ? caution('AUTH_JWT_SECRET is not set: player sign-ins end on every restart.', 'Run `npm run setup` to generate one.')
    : ok('Server AUTH_JWT_SECRET set');
  if (['/healthz', '/api/healthz'].includes(server.values.HEALTH_ENDPOINT)) {
    caution(`HEALTH_ENDPOINT=${server.values.HEALTH_ENDPOINT} hides the JSON health check behind the plain one.`, 'Remove HEALTH_ENDPOINT from .env (the default is /api/health).');
  }
  for (const stale of ['WS_PORT', 'ALLOWED_API_KEYS', 'ROOM_PASSWORD']) {
    if (stale in server.values) caution(`${stale} in the server .env is not a setting the server reads.`, 'Remove it; see .env.example for every real setting.');
  }
}

// Is it running?
const running = await serverHealth(port);
if (running) {
  ok(`Server running on port ${port} (${running.stats?.totalRooms ?? 0} rooms, ${running.stats?.totalClients ?? 0} connected)`);
  if (!isPlaceholder(server.values.API_KEY)) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/rooms`, { headers: { 'x-api-key': server.values.API_KEY }, signal: AbortSignal.timeout(2000) });
      res.ok ? ok('Server accepts the API_KEY in .env')
        : problem(`The running server rejects the API_KEY in .env (HTTP ${res.status}).`, 'Restart the server so it reads the current .env.');
    } catch { caution('Could not check the API key against the running server.'); }
  }
} else if (await portOpen(port)) {
  problem(`Port ${port} is used by another program, so the server cannot start there.`, `Stop that program, or set a different PORT in ${serverEnvPath}.`);
} else {
  info(`Server not running (port ${port} is free). Start it with \`npm start\`.`);
}
if (await portOpen(CLIENT_DEV_PORT) && !running) {
  caution(`Port ${CLIENT_DEV_PORT} (web client) is already in use.`, 'Another dev server may be running; `npm start` needs that port.');
}

// AI GM bot. Optional: its problems stop the bot, not play, so they are
// warnings and do not fail the check.
const botIssue = (text, fix) => caution(`${text} The AI GM bot will not start until this is fixed.`, fix);
if (!botPresent()) {
  info(`AI GM bot not installed next to this repository (optional): git clone ${BOT_REPO} ${BOT_DIR}`);
} else {
  const bot = readEnv(join(BOT_DIR, '.env'));
  if (!depsInstalled(BOT_DIR)) caution('AI GM bot dependencies are not installed.', 'Run `npm run setup`.');
  if (!bot.exists) {
    caution('AI GM bot has no .env.', 'Run `npm run setup`.');
  } else {
    const wsUrl = bot.values.WS_URL || 'ws://localhost:10000';
    const local = /^wss?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(wsUrl);
    if (local) {
      const botPort = Number(new URL(wsUrl).port || (wsUrl.startsWith('wss') ? 443 : 80));
      botPort === port ? ok(`AI GM bot points at this server (${wsUrl})`)
        : botIssue(`AI GM bot connects to port ${botPort}, but the server uses ${port}.`, `Set WS_URL=ws://localhost:${port} in ${join(BOT_DIR, '.env')}.`);
      bot.values.API_KEY === server.values.API_KEY ? ok('AI GM bot API_KEY matches the server')
        : botIssue('AI GM bot API_KEY does not match the server’s: it will be refused.', 'Run `npm run setup` to copy the server’s key to the bot.');
    } else {
      info(`AI GM bot connects to a remote server (${wsUrl}); its key is not checked here.`);
    }
    const provider = (bot.values.AI_PROVIDER || 'ollama').toLowerCase();
    if (provider === 'ollama') {
      const base = (bot.values.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
      const model = bot.values.OLLAMA_MODEL || 'gemma3:12b';
      try {
        const tags = await (await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000) })).json();
        const names = (tags.models || []).map(m => m.name);
        names.some(n => n === model || n === `${model}:latest`) ? ok(`Ollama is running and has ${model}`)
          : botIssue(`Ollama is running but does not have ${model}.`, `Run \`ollama pull ${model}\`, or set OLLAMA_MODEL to one of: ${names.join(', ') || '(none pulled)'}.`);
      } catch {
        botIssue(`Ollama is not reachable at ${base}.`, 'Install it from https://ollama.com and start it, or set AI_PROVIDER=openai or deepseek with a key.');
      }
    } else {
      const keyName = { openai: 'OPENAI_API_KEY', deepseek: 'DEEPSEEK_API_KEY' }[provider];
      if (!keyName) botIssue(`AI_PROVIDER=${provider} is not supported (use ollama, openai or deepseek).`);
      else isPlaceholder(bot.values[keyName]) ? botIssue(`${keyName} is missing from the AI GM bot’s .env.`, `Add your key to ${join(BOT_DIR, '.env')}.`)
        : ok(`AI GM bot uses ${provider} (key set)`);
    }
  }
}

console.log('');
if (blocking) { fail(`${blocking} problem${blocking === 1 ? '' : 's'} to fix.`); process.exit(1); }
ok('Ready to play. Start with `npm start`.\n');
