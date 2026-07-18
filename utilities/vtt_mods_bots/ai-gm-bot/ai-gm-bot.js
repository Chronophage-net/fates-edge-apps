#!/usr/bin/env node
/**
 * AI GM Bot – Fate’s Edge (WS client)
 *
 * Connects to a Fate’s Edge WebSocket server, claims the GM role,
 * watches player activity and returns AI‑generated GM narration.
 *
 * Features:
 *   • Auto‑configuration via configure‑bot.js when .env is missing/incomplete.
 *   • Driver selection (Ollama/OpenAI/DeepSeek) via AI_PROVIDER env var.
 *   • WS reconnection with exponential back‑off.
 *   • Full console logging (info/debug/warn/error).
 *   • GM election handling (request_gm / approve_gm).
 *   • Simple conversation history per room (last N messages) for context.
 *   • Graceful shutdown (SIGINT) and unhandled‑exception safety.
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const WebSocket = require('ws');

// -------------------------------------------------------------------
// 0️⃣  Bootstrap – load .env or run the configurator if needed
// -------------------------------------------------------------------
const envPath   = path.resolve(process.cwd(), '.env');
const requiredEnvByProvider = {
  ollama:   ['OLLAMA_BASE_URL', 'OLLAMA_MODEL'],
  openai:   ['OPENAI_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY']
};

function envIsReady() {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }

  const provider = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
  const required = requiredEnvByProvider[provider];
  if (!required) {
    console.error(`❌ Unknown AI provider "${provider}". Supported: ${Object.keys(requiredEnvByProvider).join(', ')}`);
    return false;
  }
  for (const v of required) {
    const val = process.env[v];
    if (!val || val.trim() === '') {
      console.warn(`⚠️  Missing or empty env var: ${v}`);
      return false;
    }
  }
  return true;
}

if (!envIsReady()) {
  console.warn('\n⚠️  .env missing or incomplete – launching configuration helper…\n');
  const result = spawnSync('node', ['./configure-bot.js'], {
    stdio: 'inherit',
    shell: true
  });
  if (result.error) {
    console.error('❌ Failed to launch configure-bot.js:', result.error);
    process.exit(1);
  }
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log('✅ .env (re)loaded after configuration.');
  } else {
    console.error('❌ Configuration did not produce a .env file. Exiting.');
    process.exit(1);
  }
}

// -------------------------------------------------------------------
// 1️⃣  Core imports
// -------------------------------------------------------------------
const AIDriver = require('./drivers/ai-driver');

const drivers = {
  ollama:   require('./drivers/ollama-driver'),
  openai:   require('./drivers/openai-driver'),
  deepseek: require('./drivers/deepseek-driver')
};

// -------------------------------------------------------------------
// 2️⃣  Choose & instantiate the driver
// -------------------------------------------------------------------
const provider = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
const DriverClass = drivers[provider];

if (!DriverClass) {
  console.error(`❌ Unsupported AI provider "${provider}". Choose one of: ${Object.keys(drivers).join(', ')}`);
  process.exit(1);
}

// Driver‑specific options
let driver;
try {
  if (provider === 'ollama') {
    driver = new DriverClass({
      baseUrl:      process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model:        process.env.OLLAMA_MODEL   || 'mistral',
      apiKey:       process.env.OLLAMA_API_KEY  || null,
      timeout:      Number(process.env.OLLAMA_TIMEOUT || 15000),
      temperature:  Number(process.env.OLLAMA_TEMPERATURE || 0.7),
      topP:         Number(process.env.OLLAMA_TOP_P || 0.9)
    });
  } else if (provider === 'openai') {
    driver = new DriverClass({
      apiKey:      process.env.OPENAI_API_KEY,
      model:       process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: Number(process.env.OPENAI_TEMPERATURE || 0.7),
      maxTokens:   Number(process.env.OPENAI_MAX_TOKENS || 512)
    });
  } else if (provider === 'deepseek') {
    driver = new DriverClass({
      apiKey:      process.env.DEEPSEEK_API_KEY,
      model:       process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: Number(process.env.DEEPSEEK_TEMPERATURE || 0.8),
      maxTokens:   Number(process.env.DEEPSEEK_MAX_TOKENS || 400)
    });
  }
} catch (e) {
  console.error(`❌ Failed to instantiate ${provider} driver:`, e);
  process.exit(1);
}

// -------------------------------------------------------------------
// 2️⃣½  Get driver metadata for logging (must happen **before** we log)
// -------------------------------------------------------------------
const DriverMeta = DriverClass.meta || {
  name: provider,
  description: 'No description provided'
};
console.info(`🤖 Using ${DriverMeta.name} driver (${provider})`);

// -------------------------------------------------------------------
// 3️⃣  WS client configuration
// -------------------------------------------------------------------
const WS_URL = process.env.FATE_WS_URL || 'ws://localhost:10000';
const ROOM_CODE = process.env.FATE_ROOM_CODE || 'ABC123'; // change via .env if needed
const BOT_NAME  = process.env.BOT_NAME || 'FateAI‑GM';
const MAX_HISTORY = Number(process.env.MAX_HISTORY || 20); // how many past msgs to keep

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // ms
let isGM = false; // updated via server events
let conversation = []; // array of {role, content} for LLM prompt

// -------------------------------------------------------------------
// 4️⃣  Helper: build LLM prompt from conversation + system prompt
// -------------------------------------------------------------------
function buildPrompt() {
  const system = process.env.SYSTEM_PROMPT ||
    'You are the Game Master for a Fate’s Edge session. Provide vivid, concise narration that respects the fiction, uses Story Beats when appropriate, and keeps the story moving.';
  const hist = conversation.slice(-MAX_HISTORY).map(m => `${m.role}: ${m.content}`).join('\n');
  return `${system}\n\n${hist}\n\nGM:`;
}

// -------------------------------------------------------------------
// 5️⃣  Helper: send a chat message as the bot (GM)
// -------------------------------------------------------------------
function sendGMChat(text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('⚠️  WS not open – cannot send GM chat');
    return;
  }
  const payload = {
    type: 'chat-message',
    text,
    sender: BOT_NAME,
    // optional: you could also add a timestamp
  };
  ws.send(JSON.stringify(payload));
  console.info(`💬 GM chat sent (${text.length} chars)`);
}

// -------------------------------------------------------------------
// 6️⃣  WS connection logic
// -------------------------------------------------------------------
function connectWS() {
  console.info(`🔌 Connecting to Fate’s Edge WS at ${WS_URL}?room=${ROOM_CODE}`);
  ws = new WebSocket(`${WS_URL}?room=${ROOM_CODE}`);

  ws.on('open', () => {
    console.log('🟢 WS connection opened');
    reconnectAttempts = 0; // reset back‑off on success
    // Perform initial handshake claiming GM role
    const handshake = {
      type: 'handshake',
      campaignCode: ROOM_CODE,
      clientName: BOT_NAME,
      role: 'gm', // we ask to be GM right away
      clientEmail: process.env.BOT_EMAIL || ''
    };
    ws.send(JSON.stringify(handshake));
    console.info(`🤝 Handshake sent – requesting GM role for ${BOT_NAME}`);
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      console.warn('⚠️  Received non‑JSON WS message:', data.toString());
      return;
    }

    console.debug(`📥 WS event "${msg.type}" from ${msg.sender || 'unknown'}:`, msg);

    // -----------------------------------------------------------------
    // 6.1 Handshake acknowledgement
    // -----------------------------------------------------------------
    if (msg.type === 'handshake_ack') {
      if (msg.success) {
        isGM = msg.clientRole === 'gm' || msg.role === 'gm';
        console.info(`✅ Handshake success – clientId=${msg.clientId}, role=${msg.clientRole || msg.role}`);
        if (!isGM) {
          console.info('⚠️  Server did not grant GM role – will request via election');
          // Ask the current GM for permission
          ws.send(JSON.stringify({ type: 'request_gm' }));
        }
      } else {
        console.error('❌ Handshake failed:', msg);
      }
      return;
    }

    // -----------------------------------------------------------------
    // 6.2 GM election messages
    // -----------------------------------------------------------------
    if (msg.type === 'gm_vote_request') {
      // Current GM asks us to approve a requester – we are the GM, so approve
      if (isGM) {
        console.info(`🗳️  GM vote request for ${msg.requesterName} (${msg.requesterId}) – approving`);
        ws.send(JSON.stringify({
          type: 'approve_gm',
          targetId: msg.requesterId
        }));
      } else {
        // We are not GM – just ignore (the real GM will handle)
      }
      return;
    }

    if (msg.type === 'gm_role_update') {
      const newRole = msg.role;
      console.info(`🔁 Role update: ${isGM ? 'GM' : 'player'} → ${newRole}`);
      isGM = (newRole === 'gm');
      return;
    }

    // -----------------------------------------------------------------
    // 6.3 Presence / client list (useful for debugging)
    // -----------------------------------------------------------------
    if (msg.type === 'presence') {
      console.debug(`👥 Presence update – ${msg.clients?.length || 0} clients`);
      return;
    }

    // -----------------------------------------------------------------
    // 6.4 Player‑originated events that trigger a GM response
    // -----------------------------------------------------------------
    const isPlayerMsg = msg.sender && msg.sender !== BOT_NAME;
    const triggersGM = ['chat-message', 'roll-dice', 'deck-drawn'].includes(msg.type);

    if (isPlayerMsg && triggersGM) {
      // Add the player's message to conversation history
      conversation.push({
        role: msg.sender,
        content: msg.type === 'chat-message' ? msg.text :
                 msg.type === 'roll-dice'   ? `rolled ${msg.expr} = ${msg.total}` :
                 msg.type === 'deck-drawn'  ? `drew ${msg.cards.length} card(s)` :
                 JSON.stringify(msg)
      });

      // Keep history bounded
      if (conversation.length > MAX_HISTORY * 2) conversation.splice(0, conversation.length - MAX_HISTORY);

      // Build prompt and query LLM
      (async () => {
        try {
          const prompt = buildPrompt();
          console.debug(`🧠 LLM prompt (${prompt.length} chars)`);
          const reply = await driver.generateResponse({ systemPrompt: process.env.SYSTEM_PROMPT, messages: conversation.slice(-MAX_HISTORY) });
          // Trim any leading/trailing whitespace and ensure we don't echo the prompt
          const cleanReply = reply.trim();
          if (cleanReply) {
            sendGMChat(cleanReply);
            // Also add the GM's own response to history so the LLM sees it
            conversation.push({ role: BOT_NAME, content: cleanReply });
          }
        } catch (err) {
          console.error(`❌ LLM generation failed:`, err.message);
          sendGMChat('*The world hesitates… the dice hang in the air. Something interferes with the weave of fate. Please try again.*');
        }
      })();
      return;
    }

    // -----------------------------------------------------------------
    // 6.5 Other server‑to‑client broadcasts (just log)
    // -----------------------------------------------------------------
    // You can handle additional event types here if you want the bot to react
    // (e.g., whiteboard updates, module pushes, etc.).
  });

  ws.on('close', (code, reason) => {
    console.info(`🔚 WS connection closed (code ${code}) – ${reason}`);
    isGM = false;
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error(`🔴 WS error:`, err);
    // The WS client will close on error; reconnect logic lives in 'close' handler.
  });
}

// -------------------------------------------------------------------
// 7️⃣  Reconnection with exponential back‑off
// -------------------------------------------------------------------
function scheduleReconnect() {
  const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
  console.info(`⏳ Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts + 1})`);
  setTimeout(() => {
    reconnectAttempts++;
    connectWS();
  }, delay);
}

// -------------------------------------------------------------------
// 8️⃣  Start the bot
// -------------------------------------------------------------------
console.log('\n🚀 AI GM Bot (WS client) starting…');
console.log(`   Node version   : ${process.version}`);
console.log(`   WS URL         : ${WS_URL}`);
console.log(`   Room code      : ${ROOM_CODE}`);
console.log(`   Bot name       : ${BOT_NAME}`);
console.log(`   AI provider    : ${provider} (${DriverMeta.name})`);
console.log(`   Model          : ${driver.model || '(model info not exposed)'}`);
console.log(`   Timeout (ms)   : ${driver.timeout || 'N/A'}`);
console.log(`   Temperature    : ${driver.temperature || 'N/A'}`);
console.log(`   Top‑p          : ${driver.topP || 'N/A'}\n`);

connectWS();

// -------------------------------------------------------------------
// 9️⃣  Graceful shutdown
// -------------------------------------------------------------------
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT – shutting down gracefully…');
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close(1000, 'Shutdown requested');
  }
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

