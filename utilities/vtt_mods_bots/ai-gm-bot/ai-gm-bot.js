#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');

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
    const commentIdx = val.indexOf('#');
    if (commentIdx !== -1) {
      val = val.slice(0, commentIdx).trim();
    }
    const cleanVal =
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
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
  const result = spawnSync('node', ['./configure-bot.js'], {
    stdio: 'inherit',
    shell: true,
  });
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
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || '20', 10);
const SUMMARISE_EVERY = parseInt(process.env.SUMMARISE_EVERY || '10', 10);

// Server API base URL
const CAMPAIGN_API_URL = process.env.CAMPAIGN_API_URL || 'http://localhost:10000/api';

// -------------------------------------------------------------------
// 4. Load rulebook & build system prompt
// -------------------------------------------------------------------
const rulePath = path.resolve(process.cwd(), 'rules.txt');
let rulebook = '';
try {
  if (fs.existsSync(rulePath)) {
    rulebook = fs.readFileSync(rulePath, 'utf-8').trim();
    console.log('📖 Loaded rulebook (rules.txt).');
  }
} catch (e) {}

const BASE_SYSTEM_PROMPT = (rulebook ? rulebook + '\n\n' : '') + (process.env.SYSTEM_PROMPT ||
  'You are the Game Master for a Fate\'s Edge session. Provide vivid, concise narration. Use game mechanics appropriately.') +
  '\n\nYou have a pool of Story Beats (SB). When you want to introduce a complication, write [SPEND SB N] to spend N beats. The bot will deduct them and you can narrate the complication. You may also create timers with [TIMER "name" segments], draw from the Deck of Consequences with [DRAW count region], or perform a Crown Spread with [CROWN region].';

// -------------------------------------------------------------------
// 5. Campaign state management
// -------------------------------------------------------------------
const CAMPAIGNS_DIR = path.resolve(process.cwd(), 'campaigns');
if (!fs.existsSync(CAMPAIGNS_DIR)) fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true });
const getCampaignFilePath = (roomCode) => path.join(CAMPAIGNS_DIR, `${roomCode.toUpperCase()}.json`);

let campaignState = {
  facts: {},
  summary: '',
  conversation: [],
  messagesSinceLastSummary: 0,
  characters: {},
  sb: 0        // Story Beat pool
};

function loadCampaignState(roomCode) {
  const filePath = getCampaignFilePath(roomCode);
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data;
    }
  } catch (e) {
    console.error(`❌ Failed to load campaign state for ${roomCode}:`, e.message);
  }
  return null;
}

function saveCampaignState(roomCode) {
  if (!campaignState) return;
  const filePath = getCampaignFilePath(roomCode);
  try {
    fs.writeFileSync(filePath, JSON.stringify(campaignState, null, 2));
  } catch (e) {
    console.error(`❌ Failed to save campaign state for ${roomCode}:`, e.message);
  }
}

// -------------------------------------------------------------------
// 6. Character state cache
// -------------------------------------------------------------------
let characterState = {};

function getChar(name) {
  const key = name.toLowerCase();
  if (!characterState[key]) {
    characterState[key] = { harm: 0, fatigue: 0, obligation: 0, boons: 0 };
  }
  return characterState[key];
}

function persistChar(name) {
  const key = name.toLowerCase();
  campaignState.characters = campaignState.characters || {};
  campaignState.characters[key] = characterState[key];
  saveCampaignState(ROOM_CODE);
}

// -------------------------------------------------------------------
// 7. HTTP helper for server API
// -------------------------------------------------------------------
function apiRequest(method, pathSegments, body = null) {
  const url = `${CAMPAIGN_API_URL}/rooms/${ROOM_CODE}/${pathSegments.join('/')}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': process.env.API_KEY || ''
  };
  const bodyStr = body ? JSON.stringify(body) : undefined;
  if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers
    };

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error(`API error ${res.statusCode}: ${json.error || data}`));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// -------------------------------------------------------------------
// 8. Shared state
// -------------------------------------------------------------------
let ws = null;
let connected = false;
let myRole = 'player';
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

// -------------------------------------------------------------------
// 9. Facts management
// -------------------------------------------------------------------
function factsToText() {
  const entries = Object.entries(campaignState.facts || {});
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `- ${k}: ${v}`).join('\n');
}

function updateFact(key, value) {
  campaignState.facts[key] = value;
  saveCampaignState(ROOM_CODE);
  console.log(`📌 Fact updated: ${key} = ${value}`);
}

// -------------------------------------------------------------------
// 10. Pre‑load world knowledge from static files
// -------------------------------------------------------------------
async function loadWorldFacts() {
  const apiBase = CAMPAIGN_API_URL.replace(/\/api$/, '');  // e.g. http://localhost:10000
  try {
    // Wiki
    const wikiRes = await fetch(`${apiBase}/data/wiki.json`);
    if (wikiRes.ok) {
      const wiki = await wikiRes.json();
      if (Array.isArray(wiki)) {
        wiki.forEach(entry => updateFact(`wiki_${entry.id || entry.title}`, entry.title + ': ' + (entry.content || '').slice(0, 200)));
      }
    }
  } catch (e) { /* ignore */ }

  try {
    // Regions
    const regionsDir = path.resolve(process.cwd(), '..', '..', '..', 'data', 'regions');  // adjust path as needed
    if (fs.existsSync(regionsDir)) {
      const files = fs.readdirSync(regionsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(regionsDir, file), 'utf-8'));
        const name = data.name || path.basename(file, '.json');
        updateFact(`region_${name.toLowerCase()}`, data.description || '');
      }
    }
  } catch (e) { /* ignore */ }

  try {
    // Patrons
    const patronsManifest = await fetch(`${apiBase}/data/patrons/manifest.json`);
    if (patronsManifest.ok) {
      const manifest = await patronsManifest.json();
      if (Array.isArray(manifest)) {
        for (const patronFile of manifest) {
          const patronData = await fetch(`${apiBase}/data/patrons/${patronFile}`).then(r => r.json());
          updateFact(`patron_${patronData.name}`, `${patronData.domain || ''}: ${patronData.description || ''}`);
        }
      }
    }
  } catch (e) { /* ignore */ }

  console.log('🌍 Pre‑loaded world facts.');
}

// -------------------------------------------------------------------
// 11. Summarisation
// -------------------------------------------------------------------
async function summariseStory() {
  if (!driver) return;
  const existing = campaignState.summary ? `Previous summary:\n${campaignState.summary}\n\n` : '';
  const recent = (campaignState.conversation || []).slice(-SUMMARISE_EVERY).map(m => `${m.role}: ${m.content}`).join('\n');
  const prompt = existing + recent + '\n\nWrite a concise campaign summary (max 200 words) including key characters, locations, and unresolved plot threads.';
  try {
    const fresh = await driver.generateResponse({
      systemPrompt: 'You are a summariser. Output only the summary text.',
      messages: [{ role: 'user', content: prompt }]
    });
    campaignState.summary = fresh.trim();
    saveCampaignState(ROOM_CODE);
    console.log('📄 New campaign summary generated.');
  } catch (e) {
    console.error('Summarisation failed:', e.message);
  }
}

// -------------------------------------------------------------------
// 12. WebSocket helpers
// -------------------------------------------------------------------
function sendWS(type, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data }));
    console.log(`⬆️  Sent: ${type}`);
  }
}

function sendChat(text) {
  sendWS('chat-message', { text, sender: BOT_NAME, timestamp: Date.now() });
}

// -------------------------------------------------------------------
// 13. Connection
// -------------------------------------------------------------------
function connect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  console.log(`🔌 Connecting to ${WS_URL}?room=${ROOM_CODE}`);
  ws = new WebSocket(`${WS_URL}?room=${ROOM_CODE}`);

  ws.on('open', () => {
    connected = true;
    reconnectAttempts = 0;
    console.log('🟢 WebSocket connected');
    ws.send(JSON.stringify({ type: 'handshake', campaignCode: ROOM_CODE, clientName: BOT_NAME, role: 'gm', password: '', clientEmail: '' }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`⬇️  ${msg.type}`, JSON.stringify(msg).slice(0, 120));
      handleMessage(msg);
    } catch (e) { console.warn('⚠️  Non‑JSON message:', data.toString()); }
  });

  ws.on('close', (code) => { connected = false; console.log(`🔌 Disconnected (code ${code})`); scheduleReconnect(); });
  ws.on('error', (err) => console.error('🔴 WebSocket error:', err.message));
}

function scheduleReconnect() {
  const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
  console.log(`⏳ Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);
  reconnectTimer = setTimeout(() => { reconnectAttempts++; connect(); }, delay);
}

// -------------------------------------------------------------------
// 14. Message handler
// -------------------------------------------------------------------
function handleMessage(msg) {
  if (msg.type === 'state-updated') return;

  if (msg.type === 'handshake_ack') {
    myRole = msg.clientRole || msg.role || 'player';
    console.log(`🤝 Handshake OK. Role: ${myRole}`);
    if (myRole !== 'gm') { console.log('📢 I am not the GM – will request GM role.'); sendWS('request_gm'); }
    else { console.log('👑 I am the Game Master!'); sendChat('*The AI Game Master has joined.*'); }
    return;
  }

  if (msg.type === 'gm_vote_request') {
    if (myRole === 'gm') { console.log(`🗳️  Approving GM request from ${msg.requesterName}`); sendWS('approve_gm', { targetId: msg.requesterId }); }
    return;
  }

  if (msg.type === 'gm_role_update') {
    myRole = msg.role; console.log(`🔁 Role changed: ${myRole} → ${myRole}`); if (myRole === 'gm') sendChat('*I am now the Game Master.*');
    return;
  }

  if (msg.type === 'presence') { console.debug(`👥 ${msg.clients?.length || 0} clients in room`); return; }

  // Extract text
  let text = '', sender = 'Unknown';
  if (msg.type === 'chat-message' && msg.message) { text = msg.message.text || ''; sender = msg.message.sender || 'Unknown'; }
  else if (msg.type === 'chat_message' && msg.value) { text = msg.value.text || ''; sender = msg.value.sender || 'Unknown'; }
  else if (msg.type === 'chat-message') { text = msg.text || ''; sender = msg.sender || 'Unknown'; }
  if (!text && !sender) return;

  console.log(`💬 [${sender}] ${text}`);

  if (sender === BOT_NAME) return; // prevent self-loop

  // --- Handle roll results: automatically add SB ---
  if (msg.type === 'roll-result') {
    const sbGain = msg.storyBeats || 0;
    if (sbGain > 0) {
      campaignState.sb = (campaignState.sb || 0) + sbGain;
      console.log(`📈 +${sbGain} Story Beats (total: ${campaignState.sb})`);
    }
    const rollText = `${sender} rolled ${msg.expr || 'dice'} = ${msg.total}`;
    campaignState.conversation.push({ role: 'user', content: rollText });
    if (campaignState.conversation.length > MAX_HISTORY * 2) campaignState.conversation.splice(0, campaignState.conversation.length - MAX_HISTORY);
    saveCampaignState(ROOM_CODE);
    // Continue to narration
  }

  // --- Bot commands ---
  if (text.startsWith('!gm')) { handleBotCommand(sender, text); return; }

  // --- AI narration (only if GM) ---
  if (myRole !== 'gm') return;

  campaignState.conversation = campaignState.conversation || [];
  campaignState.conversation.push({ role: 'user', content: `${sender}: ${text}` });
  if (campaignState.conversation.length > MAX_HISTORY * 2) campaignState.conversation.splice(0, campaignState.conversation.length - MAX_HISTORY);
  campaignState.messagesSinceLastSummary = (campaignState.messagesSinceLastSummary || 0) + 1;

  if (campaignState.messagesSinceLastSummary >= SUMMARISE_EVERY && campaignState.conversation.length >= SUMMARISE_EVERY) {
    summariseStory().catch(() => {});
    campaignState.messagesSinceLastSummary = 0;
  }

  (async () => {
    try {
      let fullSystemPrompt = BASE_SYSTEM_PROMPT;
      if (campaignState.summary) fullSystemPrompt += '\n\nCampaign Summary:\n' + campaignState.summary;
      const factsText = factsToText();
      if (factsText) fullSystemPrompt += '\n\nCurrent World Facts:\n' + factsText;
      fullSystemPrompt += `\n\nStory Beats available: ${campaignState.sb || 0}.`;

      const reply = await driver.generateResponse({
        systemPrompt: fullSystemPrompt,
        messages: campaignState.conversation.slice(-MAX_HISTORY)
      });

      let clean = processSpecialCommands(reply.trim());

      if (clean) {
        sendChat(clean);
        campaignState.conversation.push({ role: 'assistant', content: clean });
        if (campaignState.conversation.length > MAX_HISTORY * 2) campaignState.conversation.splice(0, campaignState.conversation.length - MAX_HISTORY);
        saveCampaignState(ROOM_CODE);
      }
    } catch (err) {
      console.error('❌ LLM error:', err.message);
      sendChat('*The story pauses. (AI error)*');
    }
  })();
}

// -------------------------------------------------------------------
// 15. Special command processor (extracted from AI output)
// -------------------------------------------------------------------
function processSpecialCommands(text) {
  let output = text;

  // SPEND SB
  const sbRegex = /\[SPEND SB (\d+)\]/gi;
  let match;
  while ((match = sbRegex.exec(text)) !== null) {
    const cost = parseInt(match[1]);
    if (campaignState.sb >= cost) {
      campaignState.sb -= cost;
      console.log(`💸 Spent ${cost} SB. Remaining: ${campaignState.sb}`);
      output = output.replace(match[0], `*(Spent ${cost} Story Beat${cost > 1 ? 's' : ''})*`);
    } else {
      output = output.replace(match[0], '*(Not enough SB)*');
    }
  }

  // TIMER
  const timerRegex = /\[TIMER "([^"]+)" (\d+)\]/gi;
  while ((match = timerRegex.exec(text)) !== null) {
    const name = match[1];
    const segments = parseInt(match[2]);
    sendWS('event', { type: 'add-timer', name, segments });
    sendChat(`Timer created: ${name} (${segments} segments)`);
    output = output.replace(match[0], `*(Timer started: ${name})*`);
  }

  // DECK DRAW
  const drawRegex = /\[DRAW (\d+) (\w+)\]/gi;
  while ((match = drawRegex.exec(text)) !== null) {
    const count = parseInt(match[1]);
    const region = match[2];
    sendWS('deck-draw', { count, region });
    output = output.replace(match[0], `*(Drawing ${count} cards from ${region}…)*`);
  }

  // CROWN SPREAD
  const crownRegex = /\[CROWN (\w+)\]/gi;
  while ((match = crownRegex.exec(text)) !== null) {
    const region = match[1];
    sendWS('crown-spread', { region });
    output = output.replace(match[0], `*(Performing Crown Spread for ${region}…)*`);
  }

  // FACT updates
  const factRegex = /\[FACT (.+?) (.+?)\]/gi;
  while ((match = factRegex.exec(text)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    updateFact(key, value);
    output = output.replace(match[0], '');
  }

  return output;
}

// -------------------------------------------------------------------
// 16. Bot command handler (tool mode + resource management + campaign sharing)
// -------------------------------------------------------------------
async function uploadCampaign() {
  try {
    const data = await apiRequest('POST', ['campaigns'], campaignState);
    sendChat(`Campaign uploaded! Share code: ${data.code}`);
  } catch (e) { sendChat(`Upload failed: ${e.message}`); }
}

async function loadCampaign(code) {
  try {
    const data = await apiRequest('GET', ['campaigns', code]);
    campaignState.facts = { ...campaignState.facts, ...data.facts };
    campaignState.summary = data.summary || campaignState.summary;
    campaignState.conversation = [...campaignState.conversation, ...(data.conversation || [])].slice(-MAX_HISTORY * 2);
    if (data.characters) {
      campaignState.characters = { ...campaignState.characters, ...data.characters };
      for (const [k, v] of Object.entries(data.characters)) characterState[k] = { ...v };
    }
    saveCampaignState(ROOM_CODE);
    sendChat(`Campaign ${code} loaded!`);
  } catch (e) { sendChat(`Load failed: ${e.message}`); }
}

function handleBotCommand(sender, text) {
  const parts = text.split(/\s+/);
  const cmd = parts[1]?.toLowerCase();

  if (cmd === 'help') {
    sendChat('Available commands: !gm help, !gm status, !gm dice XdY, !gm fact key value, !gm harm/fatigue/obligation/boon/clear <name> <amount>, !gm upload, !gm load <code>, !gm sb');
    return;
  }

  if (cmd === 'sb') {
    sendChat(`Current Story Beat pool: ${campaignState.sb || 0}`);
    return;
  }

  if (cmd === 'status') {
    if (parts[2]) {
      const name = parts.slice(2).join(' ');
      const c = getChar(name);
      sendChat(`${name} → Harm: ${c.harm}, Fatigue: ${c.fatigue}, Obligation: ${c.obligation}, Boons: ${c.boons}`);
    } else {
      sendChat(`I am ${myRole === 'gm' ? 'the Game Master' : 'a helper bot (GM is someone else)'}.`);
    }
    return;
  }

  if (cmd === 'dice' && parts[2]) {
    const formula = parts[2];
    const match = formula.match(/^(\d+)d(\d+)$/i);
    if (match) {
      const count = parseInt(match[1]), sides = parseInt(match[2]);
      const rolls = []; let total = 0;
      for (let i = 0; i < count; i++) { const r = Math.floor(Math.random() * sides) + 1; rolls.push(r); total += r; }
      sendChat(`${sender} requested a roll: ${formula} → [${rolls.join(', ')}] = ${total}`);
    } else sendChat('Usage: !gm dice 2d6');
    return;
  }

  if (cmd === 'fact' && parts[2] && parts[3]) {
    updateFact(parts[2], parts.slice(3).join(' '));
    sendChat(`Fact updated: ${parts[2]} = ${parts.slice(3).join(' ')}`);
    return;
  }

  if (cmd === 'upload') { uploadCampaign(); return; }
  if (cmd === 'load' && parts[2]) { loadCampaign(parts[2]); return; }

  // Resource commands (GM only)
  if (myRole !== 'gm') { sendChat('Only the Game Master can run resource commands.'); return; }

  const targetName = parts[2];
  if (!targetName) { sendChat('Usage: !gm <harm|fatigue|obligation|boon|clear> <name> [value]'); return; }

  const amount = parts[3] ? parseInt(parts[3], 10) : 1;
  if (isNaN(amount)) { sendChat('Amount must be a number.'); return; }

  const applyDelta = async (field, delta) => {
    try {
      await apiRequest('POST', ['characters', encodeURIComponent(targetName), field], { delta });
      const c = getChar(targetName);
      c[field] = Math.max(0, c[field] + delta);
      persistChar(targetName);
      sendChat(`${targetName}'s ${field} changed by ${delta >= 0 ? '+' : ''}${delta} → now ${c[field]}`);
    } catch (e) { sendChat(`*Failed to update ${targetName}'s ${field} (see console)*`); }
  };

  switch (cmd) {
    case 'harm': applyDelta('harm', amount); break;
    case 'fatigue': applyDelta('fatigue', amount); break;
    case 'obligation': applyDelta('obligation', amount); break;
    case 'boon': applyDelta('boons', amount); break;
    case 'clear':
      const field = parts[3]?.toLowerCase();
      if (!['harm', 'fatigue', 'obligation', 'boons'].includes(field)) { sendChat('Valid fields: harm, fatigue, obligation, boons.'); return; }
      const clearAmt = parts[4] ? parseInt(parts[4], 10) : Infinity;
      applyDelta(field, -Math.min(clearAmt, getChar(targetName)[field]));
      break;
    default: sendChat('Unknown command. Try !gm help');
  }
}

// -------------------------------------------------------------------
// 17. Startup
// -------------------------------------------------------------------
(async function main() {
  console.log('🚀 AI GM Bot starting…');
  console.log(`   WS: ${WS_URL}   Room: ${ROOM_CODE}   Name: ${BOT_NAME}`);

  // Load campaign state
  const saved = loadCampaignState(ROOM_CODE);
  if (saved) {
    campaignState = saved;
    if (campaignState.characters) {
      for (const [k, v] of Object.entries(campaignState.characters)) characterState[k] = { ...v };
    }
    console.log('📂 Loaded campaign state.');
  } else {
    campaignState = { facts: {}, summary: '', conversation: [], messagesSinceLastSummary: 0, characters: {}, sb: 0 };
    saveCampaignState(ROOM_CODE);
  }

  // Pre‑load world facts (regions, patrons, wiki)
  await loadWorldFacts();

  if (driver && typeof driver.initialize === 'function') {
    try { await driver.initialize(); } catch (e) { console.error('Driver init failed:', e.message); }
  }

  connect();
})();

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down…');
  if (campaignState) saveCampaignState(ROOM_CODE);
  if (ws && ws.readyState === WebSocket.OPEN) ws.close(1000, 'Shutdown');
  process.exit(0);
});