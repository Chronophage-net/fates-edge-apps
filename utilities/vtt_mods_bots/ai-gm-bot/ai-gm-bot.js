#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const WebSocket = require('ws');

// -------------------------------------------------------------------
// 0. Manual .env loader (no dotenv dependency)
// -------------------------------------------------------------------
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    // Remove inline comments (everything after # that is not inside quotes)
    const commentIdx = val.indexOf('#');
    if (commentIdx !== -1) {
        val = val.slice(0, commentIdx).trim();
    }
    const cleanVal = (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))
        ? val.slice(1, -1)
        : val;
    process.env[key] = cleanVal;
  }
}

const envPath = path.resolve(process.cwd(), '.env');
loadEnvFile(envPath);

// -------------------------------------------------------------------
// 1. Configuration validation
// -------------------------------------------------------------------
function envIsReady() {
  const provider = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
  const requiredVars = {
    ollama: ['OLLAMA_BASE_URL', 'OLLAMA_MODEL'],
    openai: ['OPENAI_API_KEY'],
    deepseek: ['DEEPSEEK_API_KEY']
  };
  const vars = requiredVars[provider];
  if (!vars) {
    console.error(`❌ Unknown AI provider "${provider}". Supported: ollama, openai, deepseek`);
    return false;
  }
  for (const v of vars) {
    if (!process.env[v]) {
      console.warn(`⚠️  Missing env var: ${v}`);
      return false;
    }
  }
  return true;
}

if (!envIsReady()) {
  console.warn('\n⚠️  .env missing or incomplete – launching configuration helper…\n');
  const result = spawnSync('node', ['./configure-bot.js'], { stdio: 'inherit', shell: true });
  if (result.error) {
    console.error('❌ Failed to launch configure-bot.js:', result.error);
    process.exit(1);
  }
  loadEnvFile(envPath);
  if (!envIsReady()) {
    console.error('❌ Configuration still incomplete. Exiting.');
    process.exit(1);
  }
}

// -------------------------------------------------------------------
// 2. Driver selection and instantiation
// -------------------------------------------------------------------
const AI_PROVIDER = (process.env.AI_PROVIDER || 'ollama').toLowerCase();

let driver;
try {
  if (AI_PROVIDER === 'ollama') {
    const OllamaDriver = require('./drivers/ollama-driver');
    driver = new OllamaDriver();
    console.log(`🤖 Loaded Ollama driver (model: ${process.env.OLLAMA_MODEL})`);
  } else if (AI_PROVIDER === 'openai') {
    const OpenAIDriver = require('./drivers/openai-driver');
    driver = new OpenAIDriver(process.env.OPENAI_API_KEY, process.env.AI_MODEL || 'gpt-4o-mini');
    console.log(`🤖 Loaded OpenAI driver (model: ${driver.model})`);
  } else if (AI_PROVIDER === 'deepseek') {
    const DeepSeekDriver = require('./drivers/deepseek-driver');
    driver = new DeepSeekDriver();
    console.log(`🤖 Loaded DeepSeek driver (model: ${process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'})`);
  } else {
    console.error(`❌ Unsupported AI provider: ${AI_PROVIDER}`);
    process.exit(1);
  }
} catch (e) {
  console.error(`❌ Failed to load driver: ${e.message}`);
  process.exit(1);
}

// -------------------------------------------------------------------
// 3. Configuration constants
// -------------------------------------------------------------------
const WS_URL = process.env.WS_URL || 'ws://localhost:10000';
const ROOM_CODE = process.env.ROOM || 'ABC123';
const BOT_NAME = process.env.BOT_NAME || 'AI_GM';
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
  'You are the Game Master for a Fate\'s Edge session. Provide vivid, concise narration.';
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || '20', 10);

// -------------------------------------------------------------------
// 4. State
// -------------------------------------------------------------------
let ws = null;
let connected = false;
let myRole = 'player';
let conversation = [];          // each item { role: 'user'|'assistant'|'system', content }
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

// -------------------------------------------------------------------
// 5. WebSocket helpers
// -------------------------------------------------------------------
function sendWS(type, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = { type, ...data };
    ws.send(JSON.stringify(payload));
    console.log(`⬆️  Sent: ${type}`);
  }
}

function sendChat(text) {
  sendWS('chat-message', { text, sender: BOT_NAME, timestamp: Date.now() });
}

// -------------------------------------------------------------------
// 6. Connection & reconnection
// -------------------------------------------------------------------
function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  console.log(`🔌 Connecting to ${WS_URL}?room=${ROOM_CODE}`);
  ws = new WebSocket(`${WS_URL}?room=${ROOM_CODE}`);

  ws.on('open', () => {
    connected = true;
    reconnectAttempts = 0;
    console.log('🟢 WebSocket connected');
    ws.send(JSON.stringify({
      type: 'handshake',
      campaignCode: ROOM_CODE,
      clientName: BOT_NAME,
      role: 'gm',
      password: '',
      clientEmail: ''
    }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // Log all incoming messages (truncated)
      console.log(`⬇️  ${msg.type}`, JSON.stringify(msg).slice(0, 120));
      handleMessage(msg);
    } catch (e) {
      console.warn('⚠️  Non‑JSON message:', data.toString());
    }
  });

  ws.on('close', (code) => {
    connected = false;
    console.log(`🔌 Disconnected (code ${code})`);
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('🔴 WebSocket error:', err.message);
  });
}

function scheduleReconnect() {
  const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
  console.log(`⏳ Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);
  reconnectTimer = setTimeout(() => {
    reconnectAttempts++;
    connect();
  }, delay);
}

// -------------------------------------------------------------------
// 7. Message handler – normalized parsing
// -------------------------------------------------------------------
function handleMessage(msg) {
  // Ignore state-sync messages
  if (msg.type === 'state-updated') return;

  // 7a. Handshake
  if (msg.type === 'handshake_ack') {
    myRole = msg.clientRole || msg.role || 'player';
    console.log(`🤝 Handshake OK. Role: ${myRole}`);
    if (myRole !== 'gm') {
      console.log('📢 I am not the GM – will request GM role.');
      sendWS('request_gm');
    } else {
      console.log('👑 I am the Game Master!');
      sendChat('*The AI Game Master has joined.*');
    }
    return;
  }

  // 7b. GM election
  if (msg.type === 'gm_vote_request') {
    if (myRole === 'gm') {
      console.log(`🗳️  Approving GM request from ${msg.requesterName}`);
      sendWS('approve_gm', { targetId: msg.requesterId });
    }
    return;
  }

  if (msg.type === 'gm_role_update') {
    const newRole = msg.role;
    console.log(`🔁 Role changed: ${myRole} → ${newRole}`);
    myRole = newRole;
    if (myRole === 'gm') sendChat('*I am now the Game Master.*');
    return;
  }

  // 7c. Presence
  if (msg.type === 'presence') {
    console.debug(`👥 ${msg.clients?.length || 0} clients in room`);
    return;
  }

  // 7d. Extract text & sender from various message formats
  let text = '';
  let sender = 'Unknown';

  // Web client format: { type: 'chat-message', message: { text, sender, ... }, socketId, room }
  if (msg.type === 'chat-message' && msg.message) {
    text = msg.message.text || '';
    sender = msg.message.sender || 'Unknown';
  }
  // Terminal client format: { type: 'chat_message', value: { text, sender, ... } }
  else if (msg.type === 'chat_message' && msg.value) {
    text = msg.value.text || '';
    sender = msg.value.sender || 'Unknown';
  }
  // Legacy direct format
  else if (msg.type === 'chat-message') {
    text = msg.text || '';
    sender = msg.sender || 'Unknown';
  }

  if (!text && !sender) return; // not a text message

  console.log(`💬 [${sender}] ${text}`);

  // 7e. Always handle !gm commands (tool mode)
  if (text.startsWith('!gm')) {
    handleBotCommand(sender, text);
    return;
  }

  // 7f. If we are GM, generate AI narration
  if (myRole === 'gm') {
    // Add user message to conversation with correct role
    conversation.push({ role: 'user', content: `${sender}: ${text}` });
    if (conversation.length > MAX_HISTORY) conversation.shift();

    (async () => {
      try {
        const reply = await driver.generateResponse({
          systemPrompt: SYSTEM_PROMPT,
          messages: conversation.slice(-MAX_HISTORY)
        });
        const clean = reply.trim();
        if (clean) {
          sendChat(clean);
          conversation.push({ role: 'assistant', content: clean });
          if (conversation.length > MAX_HISTORY) conversation.shift();
        }
      } catch (err) {
        console.error('❌ LLM error:', err.message);
        sendChat('*The story pauses. (AI error)*');
      }
    })();
  }

  // Optional: add roll results to conversation
  if (msg.type === 'roll-result' && myRole === 'gm') {
    const rollText = `${sender} rolled ${msg.expr || 'dice'} = ${msg.total}`;
    conversation.push({ role: 'user', content: rollText });
    if (conversation.length > MAX_HISTORY) conversation.shift();
  }
}

// -------------------------------------------------------------------
// 8. Bot command handler (tool mode)
// -------------------------------------------------------------------
function handleBotCommand(sender, text) {
  const parts = text.split(/\s+/);
  const cmd = parts[1]?.toLowerCase();
  if (cmd === 'help') {
    sendChat('Available commands: !gm help, !gm status, !gm dice XdY');
  } else if (cmd === 'status') {
    sendChat(`I am ${myRole === 'gm' ? 'the Game Master' : 'a helper bot (GM is someone else)'}.`);
  } else if (cmd === 'dice' && parts[2]) {
    const formula = parts[2];
    const match = formula.match(/^(\d+)d(\d+)$/i);
    if (match) {
      const count = parseInt(match[1]);
      const sides = parseInt(match[2]);
      const rolls = [];
      let total = 0;
      for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        rolls.push(r);
        total += r;
      }
      sendChat(`${sender} requested a roll: ${formula} → [${rolls.join(', ')}] = ${total}`);
    } else {
      sendChat('Usage: !gm dice 2d6');
    }
  } else {
    sendChat('Unknown command. Try !gm help');
  }
}

// -------------------------------------------------------------------
// 9. Startup
// -------------------------------------------------------------------
(async function main() {
  console.log('🚀 AI GM Bot starting…');
  console.log(`   WS: ${WS_URL}   Room: ${ROOM_CODE}   Name: ${BOT_NAME}`);

  // Initialize the AI driver (connection test, model pulling, etc.)
  if (driver && typeof driver.initialize === 'function') {
    try {
      await driver.initialize();
    } catch (e) {
      console.error('Driver initialization failed:', e.message);
      // Continue anyway – the driver may still work for individual calls
    }
  }

  connect();
})();

// -------------------------------------------------------------------
// 10. Graceful shutdown
// -------------------------------------------------------------------
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down…');
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close(1000, 'Shutdown');
  }
  process.exit(0);
});