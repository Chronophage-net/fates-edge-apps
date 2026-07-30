/**
 * Fate's Edge - Express API Routes
 * v8 – Full character storage (room.characters) + WebSocket parity
 * v9 – Adventure Engine routes wired in (see server/adventure.js)
 * v10 – /api/modules now includes standalone adventure JSONs from data/adventures/
 */

const express = require('express');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const crypto = require('crypto');
const room = require('./room.js');
const deck = require('./deck.js');
const { safeAssign, buildSafeDict, isSafeModuleId, isSafeCampaignCode, clampCount, UNSAFE_KEYS } = require('./security.js');
const adventure = require('./adventure.js');
const { deriveManifestFromContent } = require('./module-manifest-utils.js');

let config = {};

function timingSafeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) return res.status(401).json({ error: 'API key required' });
    if (!config.apiKey || !timingSafeEqual(apiKey, config.apiKey)) {
        return res.status(403).json({ error: 'Invalid API key' });
    }
    req.apiKeyData = { name: 'System' };
    next();
}

// ─── Pluggable storage ──────────────────────────────────────────────
let storage = null;
try {
    storage = require('./storage.js');
    console.log('📦 Using custom storage module for campaigns.');
} catch (e) {
    storage = {
        async saveCampaign(roomCode, campaignCode, data) {
            const campaignsDir = path.join(__dirname, 'campaigns');
            await fsPromises.mkdir(campaignsDir, { recursive: true });
            const fileName = `${roomCode}-${campaignCode}.json`;
            const filePath = path.join(campaignsDir, fileName);
            await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
            const files = await getCampaignFilesAsync(roomCode, campaignsDir);
            const MAX_CAMPAIGNS = 2;
            if (files.length > MAX_CAMPAIGNS) {
                const toDelete = files.slice(MAX_CAMPAIGNS);
                for (const file of toDelete) {
                    try { await fsPromises.unlink(file.path); } catch (e) { /* ignore */ }
                }
            }
            return campaignCode;
        },
        async loadCampaign(roomCode, campaignCode) {
            const campaignsDir = path.join(__dirname, 'campaigns');
            const fileName = `${roomCode}-${campaignCode}.json`;
            const filePath = path.join(campaignsDir, fileName);
            const data = await fsPromises.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        }
    };
    console.log('📁 Using file system storage for campaigns.');
}

async function getCampaignFilesAsync(roomCode, campaignsDir) {
    const files = await fsPromises.readdir(campaignsDir);
    const filtered = files.filter(f => f.startsWith(`${roomCode}-`) && f.endsWith('.json'));
    const stats = await Promise.all(filtered.map(async (f) => {
        const fullPath = path.join(campaignsDir, f);
        const stat = await fsPromises.stat(fullPath);
        return { name: f, path: fullPath, mtime: stat.mtime };
    }));
    return stats.sort((a, b) => b.mtime - a.mtime);
}

function createApiRouter(appConfig) {
    config = appConfig;
    const router = express.Router();

    // ─── Health ──────────────────────────────────────────────────────
    router.get('/healthz', (req, res) => res.status(200).send('OK'));
    router.get('/api/healthz', (req, res) => res.status(200).send('OK'));
    router.get(config.healthEndpoint, (req, res) => {
        const roomStats = Array.from(room.rooms.keys()).map(code => room.getRoomStats(code)).filter(Boolean);
        res.json({
            status: 'ok',
            timestamp: Date.now(),
            uptime: process.uptime(),
            stats: {
                totalRooms: room.rooms.size,
                rooms: roomStats
            }
        });
    });

    // ─── Room list ──────────────────────────────────────────────────
    router.get('/api/rooms', authenticate, (req, res) => {
        const roomStats = Array.from(room.rooms.keys()).map(code => room.getRoomStats(code)).filter(Boolean);
        res.json({ rooms: roomStats, count: roomStats.length, timestamp: Date.now() });
    });

    // ─── Deck endpoints (unchanged) ────────────────────────────────
    router.get('/api/rooms/:code/deck', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            if (!r.deck) {
                r.deck = deck.buildDeck();
                r.deckHistory = [];
                r.deckOffset = Math.floor(Math.random() * 1000);
            }
            res.json({
                code: req.params.code.toUpperCase(),
                name: r.name,
                deck: r.deck,
                deckHistory: r.deckHistory || [],
                remaining: r.deck.length,
                offset: r.deckOffset
            });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/deck/shuffle', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            r.deck = deck.buildDeck();
            r.deckOffset = Math.floor(Math.random() * 1000);
            r.lastActivity = Date.now();
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'deck-shuffled', {
                source: 'api',
                remaining: r.deck.length,
                timestamp: Date.now()
            });
            res.json({ success: true, code: roomCode, remaining: r.deck.length, message: 'Deck shuffled' });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/deck/draw', authenticate, async (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { region = 'Acasia' } = req.body;
            const count = clampCount(req.body.count);
            if (!r.deck || r.deck.length === 0) r.deck = deck.buildDeck();
            if (r.deck.length < count) r.deck = deck.buildDeck();

            const drawn = [];
            for (let i = 0; i < count; i++) {
                if (r.deck.length === 0) r.deck = deck.buildDeck();
                drawn.push(r.deck.pop());
            }

            const regionData = await deck.loadRegionData(region);
            const isCrown = count === 5;
            const synthesis = isCrown
                ? deck.synthesiseCrownSpread(drawn.slice(0, 4), drawn[4], regionData)
                : deck.synthesiseConsequence(drawn, regionData);

            const result = {
                cards: drawn,
                synthesis,
                type: isCrown ? 'crown' : String(count),
                region,
                remaining: r.deck.length,
                timestamp: Date.now()
            };

            r.deckHistory = r.deckHistory || [];
            r.deckHistory.push({
                cards: drawn.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                synthesis: typeof synthesis === 'string' ? synthesis : (synthesis?.synthesis || synthesis),
                type: isCrown ? 'Crown Spread' : `${count} Draw${count > 1 ? 's' : ''}`,
                timestamp: Date.now()
            });
            if (r.deckHistory.length > config.maxDeckHistory) r.deckHistory = r.deckHistory.slice(-config.maxDeckHistory);

            r.lastActivity = Date.now();
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'deck-drawn', result);
            res.json({ success: true, code: roomCode, ...result, deliveredTo: r.clients.size });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/deck/crown', authenticate, async (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { region = 'Acasia' } = req.body;
            if (!r.deck || r.deck.length < 5) r.deck = deck.buildDeck();

            const cards = [];
            for (let i = 0; i < 5; i++) {
                if (r.deck.length === 0) r.deck = deck.buildDeck();
                cards.push(r.deck.pop());
            }
            const mainCards = cards.slice(0, 4);
            const wildcard = cards[4];

            const regionData = await deck.loadRegionData(region);
            const result = deck.synthesiseCrownSpread(mainCards, wildcard, regionData);

            r.deckHistory = r.deckHistory || [];
            r.deckHistory.push({
                cards: cards.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                synthesis: result.synthesis,
                type: 'Crown Spread',
                timestamp: Date.now()
            });
            r.lastActivity = Date.now();

            const response = {
                success: true,
                code: req.params.code.toUpperCase(),
                cards, mainCards, wildcard,
                result, remaining: r.deck.length,
                timestamp: Date.now()
            };
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'crown-spread', response);
            res.json(response);
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.get('/api/rooms/:code/deck/history', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const limit = parseInt(req.query.limit) || 50;
            const history = (r.deckHistory || []).slice(-limit);
            res.json({
                code: req.params.code.toUpperCase(),
                name: r.name,
                history, count: history.length,
                total: r.deckHistory?.length || 0
            });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.delete('/api/rooms/:code/deck/history', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            r.deckHistory = [];
            r.lastActivity = Date.now();
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'deck-history-cleared', { source: 'api', timestamp: Date.now() });
            res.json({ success: true, code: roomCode, message: 'Deck history cleared' });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    // ─── Clients: list, kick, ban, unban ───────────────────────────
    router.get('/api/rooms/:code/clients', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const clients = room.getClientsList(r);
            res.json({ code: r.code, clients });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/clients/:clientId/kick', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const targetId = req.params.clientId;
            if (!r.clients.has(targetId)) {
                return res.status(404).json({ error: 'Client not found in room' });
            }
            const reason = req.body.reason || 'Kicked by API admin';
            const success = room.kickClient(r, targetId, reason);
            if (success) {
                room.broadcastToRoom(r.code, 'presence', { clients: room.getClientsList(r) });
                res.json({ success: true, message: `Client ${targetId} kicked.` });
            } else {
                res.status(500).json({ error: 'Failed to kick client' });
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/clients/:clientId/ban', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const targetId = req.params.clientId;
            const reason = req.body.reason || 'Banned by API admin';
            room.banClient(r, targetId, reason);
            room.broadcastToRoom(r.code, 'presence', { clients: room.getClientsList(r) });
            res.json({ success: true, message: `Client ${targetId} banned.` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/clients/:clientId/unban', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const targetId = req.params.clientId;
            const removed = room.unbanClient(r, targetId);
            res.json({ success: true, message: removed ? `Client ${targetId} unbanned.` : `Client ${targetId} was not banned.` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─── Modules ──────────────────────────────────────────────────────
    router.get('/api/modules', authenticate, (req, res) => {
        const modules = [];
        // 1. Scan server/modules/ (legacy module folders)
        const modulesPath = path.join(__dirname, 'modules');
        if (fs.existsSync(modulesPath)) {
            const items = fs.readdirSync(modulesPath);
            for (const item of items) {
                const itemPath = path.join(modulesPath, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    const manifestPath = path.join(itemPath, 'manifest.json');
                    if (fs.existsSync(manifestPath)) {
                        try {
                            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                            modules.push({
                                id: item,
                                name: manifest.name || item,
                                version: manifest.version || '1.0.0',
                                description: manifest.description || '',
                                author: manifest.author || '',
                                type: manifest.type || 'module',
                                icon: manifest.icon || '📦',
                                route: manifest.route || null
                            });
                        } catch (e) { /* ignore */ }
                    }
                }
            }
        }

        // 2. Scan data/adventures/ for standalone adventure JSON files
        const adventuresDir = path.resolve(process.cwd(), 'data', 'adventures');
        if (fs.existsSync(adventuresDir)) {
            const files = fs.readdirSync(adventuresDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const id = path.basename(file, '.json');
                    try {
                        const content = JSON.parse(fs.readFileSync(path.join(adventuresDir, file), 'utf-8'));
                        modules.push({
                            id: id,
                            name: content.title || id,
                            version: content.version || '1.0.0',
                            description: content.description || '',
                            author: content.author || '',
                            type: 'adventure',
                            icon: content.icon || '📖',
                            route: null
                        });
                    } catch (e) { /* skip invalid JSON */ }
                }
            }
        }

        res.json({ modules, count: modules.length, timestamp: Date.now() });
    });

    // Permanently install an adventure module: writes manifest.json +
    // adventure.json to server/modules/<id>/, so it shows up in the list
    // above and can be loaded by anyone (bot or human GM) from then on --
    // unlike POST /api/rooms/:code/adventure/load-custom, which only ever
    // exists in that one room's memory. `manifest` is optional; if
    // omitted, one is derived from content's own title/description/
    // author/tier (see module-manifest-utils.js -- the same derivation
    // the generate-manifest.js CLI script uses for files dropped in by
    // hand, so the two paths can't disagree).
    router.post('/api/modules', authenticate, async (req, res) => {
        try {
            const { id, content, manifest: manifestOverrides, overwrite } = req.body;

            if (!id || !isSafeModuleId(id)) {
                return res.status(400).json({ error: 'A valid id is required (letters, numbers, underscore, dash; 1-64 chars)' });
            }
            if (!content || typeof content !== 'object') {
                return res.status(400).json({ error: 'content (the adventure object) is required' });
            }
            if (!content.title) {
                return res.status(400).json({ error: 'content.title is required' });
            }
            if (!Array.isArray(content.acts) || content.acts.length === 0) {
                return res.status(400).json({ error: 'content.acts must be a non-empty array' });
            }

            const moduleDir = path.join(__dirname, 'modules', id);
            const manifestPath = path.join(moduleDir, 'manifest.json');
            const adventurePath = path.join(moduleDir, 'adventure.json');

            if (fs.existsSync(moduleDir) && !overwrite) {
                return res.status(409).json({ error: `Module "${id}" already exists. Pass { overwrite: true } to replace it.` });
            }

            const manifest = deriveManifestFromContent(content, manifestOverrides || {});

            await fsPromises.mkdir(moduleDir, { recursive: true });
            await fsPromises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
            await fsPromises.writeFile(adventurePath, JSON.stringify(content, null, 2));

            res.json({ success: true, id, manifest, message: `Module "${id}" installed permanently.` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/modules/:id/push', authenticate, (req, res) => {
        try {
            const moduleId = req.params.id;
            if (!isSafeModuleId(moduleId)) {
                return res.status(400).json({ error: 'Invalid module id' });
            }
            const { roomCode } = req.body;
            const modulesPath = path.join(__dirname, 'modules', moduleId);
            if (!fs.existsSync(modulesPath)) return res.status(404).json({ error: 'Module not found' });
            const manifestPath = path.join(modulesPath, 'manifest.json');
            if (!fs.existsSync(manifestPath)) return res.status(404).json({ error: 'Module manifest not found' });

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            const moduleData = { id: moduleId, manifest, files: {} };
            const files = fs.readdirSync(modulesPath);
            for (const file of files) {
                if (file !== 'manifest.json') {
                    const filePath = path.join(modulesPath, file);
                    if (fs.statSync(filePath).isFile()) {
                        moduleData.files[file] = fs.readFileSync(filePath, 'utf-8');
                    }
                }
            }

            if (roomCode) {
                const r = room.getRoom(roomCode);
                const roomKey = roomCode.toUpperCase();
                room.broadcastToRoom(roomKey, 'module-push', {
                    source: 'api',
                    module: moduleData,
                    timestamp: Date.now(),
                    pushedBy: req.apiKeyData.name
                });
                res.json({ success: true, module: moduleId, room: roomKey, clients: r.clients.size, message: `Module ${manifest.name} pushed to room ${roomKey}` });
            } else {
                let totalClients = 0;
                for (const [code, r] of room.rooms) {
                    const clientCount = r.clients.size;
                    if (clientCount > 0) {
                        room.broadcastToRoom(code, 'module-push', { source: 'api', module: moduleData, timestamp: Date.now(), pushedBy: req.apiKeyData.name });
                        totalClients += clientCount;
                    }
                }
                res.json({ success: true, module: moduleId, rooms: room.rooms.size, clients: totalClients, message: `Module ${manifest.name} pushed to all rooms` });
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/modules/:id/cleanup', authenticate, (req, res) => {
        try {
            const moduleId = req.params.id;
            if (!isSafeModuleId(moduleId)) {
                return res.status(400).json({ error: 'Invalid module id' });
            }
            const { roomCode } = req.body;

            if (roomCode) {
                const r = room.getRoom(roomCode);
                const roomKey = roomCode.toUpperCase();
                room.broadcastToRoom(roomKey, 'module-cleanup', { source: 'api', moduleId, timestamp: Date.now(), cleanedBy: req.apiKeyData.name });
                res.json({ success: true, module: moduleId, room: roomKey, message: `Module ${moduleId} cleanup requested for room ${roomKey}` });
            } else {
                let totalClients = 0;
                for (const [code, r] of room.rooms) {
                    const clientCount = r.clients.size;
                    if (clientCount > 0) {
                        room.broadcastToRoom(code, 'module-cleanup', { source: 'api', moduleId, timestamp: Date.now(), cleanedBy: req.apiKeyData.name });
                        totalClients += clientCount;
                    }
                }
                res.json({ success: true, module: moduleId, rooms: room.rooms.size, clients: totalClients, message: `Module ${moduleId} cleanup requested for all rooms` });
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─── Adventure Engine ───────────────────────────────────────────
    // See server/adventure.js for the underlying state machine. These
    // routes let a GM's own tooling -- or a fully automated/AI agent --
    // drive an entire adventure through plain authenticated REST calls.
    // They call the exact same functions the matching WS/Socket.io
    // commands do, so everyone in the room sees the same updates via
    // room.broadcastToRoom() regardless of which path drove the change.
    // "Pushing" an adventure's source content to human clients still
    // uses the /api/modules/:id/push route above, unchanged -- these
    // routes are for the LIVE, authoritative state instead.

    router.get('/api/rooms/:code/adventure', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            res.json(adventure.getPublicState(r));
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    router.get('/api/rooms/:code/adventure/reference', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            res.json(adventure.getReferenceData(r));
        } catch (err) {
            res.status(err.message.includes('No adventure') ? 400 : 404).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/adventure/load', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { moduleId } = req.body;
            if (!moduleId) return res.status(400).json({ error: 'moduleId is required' });
            const state = adventure.loadAdventureModule(r, moduleId);
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'adventure-loaded', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            const notFound = err.message.includes('not found') || err.message.includes("isn't an adventure");
            res.status(notFound ? 404 : 400).json({ error: err.message });
        }
    });

    // Load an adventure that only exists in memory (e.g. an AI GM's
    // Crown-Spread-generated adventure) -- no file on disk needed. `id`
    // is optional, mainly useful for the caller's own bookkeeping/logging.
    router.post('/api/rooms/:code/adventure/load-custom', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { content, id } = req.body;
            if (!content || typeof content !== 'object') return res.status(400).json({ error: 'content object is required' });
            const state = adventure.loadAdventureContent(r, content, { id });
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'adventure-loaded', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/adventure/reset', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const state = adventure.resetAdventure(r);
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'adventure-reset', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/adventure/scene', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { actIndex, sceneIndex } = req.body;
            const target = {};
            if (typeof actIndex === 'number') target.actIndex = actIndex;
            if (typeof sceneIndex === 'number') target.sceneIndex = sceneIndex;
            const state = adventure.advanceScene(r, target);
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'scene-changed', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // `ref` is looked up in the CURRENT scene by index (number) or by
    // name/creatureId (string). `encounter`, if given, is used directly
    // as a full ad-hoc encounter object instead ({ name/creatureId, dv,
    // position, outcomes }), for an improvised fight with no pre-written
    // encounter.
    router.post('/api/rooms/:code/adventure/encounter/start', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { ref, encounter } = req.body;
            if (ref === undefined && !encounter) return res.status(400).json({ error: 'ref or encounter is required' });
            const state = adventure.startEncounter(r, ref, encounter || null);
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'encounter-started', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/adventure/encounter/resolve', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { outcome, notes } = req.body;
            const state = adventure.resolveEncounter(r, { outcome, notes });
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'encounter-resolved', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // Tick a timer -- either the CURRENT SCENE's own timers (default) or
    // the module's campaignTimers[]. `ref` accepts a numeric index or a
    // name string; directly supports outcome text like "Tick Village
    // Safety +1" being turned into a real state change.
    router.post('/api/rooms/:code/adventure/timer', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { scope, ref, name, amount } = req.body;
            if (ref === undefined && !name) return res.status(400).json({ error: 'ref (or name) is required' });
            const state = adventure.tickTimer(r, { scope, ref, name, amount });
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'timer-ticked', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/adventure/log', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { text, author } = req.body;
            const state = adventure.logBeat(r, { text, author });
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'adventure-log', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // ─── FULL CHARACTER STORAGE ──────────────────────────────────────

    // Helper to ensure room.characters exists (object keyed by character name)
    function ensureCharacters(r) {
        if (!r.characters) r.characters = Object.create(null);
        return r.characters;
    }

    // ─── Get all characters in a room ────────────────────────────
    router.get('/api/rooms/:code/characters', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const chars = ensureCharacters(r);
            const result = Object.values(chars);
            res.json({ characters: result, count: result.length });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    // ─── Get a single character ──────────────────────────────────
    router.get('/api/rooms/:code/characters/:name', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const chars = ensureCharacters(r);
            const name = req.params.name;
            if (!name || UNSAFE_KEYS.has(name) || !chars[name]) {
                return res.status(404).json({ error: 'Character not found' });
            }
            res.json(chars[name]);
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    // ─── Bulk update characters (full objects) ──────────────────
    router.post('/api/rooms/:code/characters/update', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const chars = ensureCharacters(r);
            const { updates } = req.body;
            if (!updates || typeof updates !== 'object') {
                return res.status(400).json({ error: 'Missing updates object' });
            }

            const results = {};
            for (const [name, data] of Object.entries(updates)) {
                if (!name || UNSAFE_KEYS.has(name)) continue;
                if (!chars[name]) chars[name] = { name };
                // Deep merge all top-level fields, skipping __proto__/constructor/prototype
                safeAssign(chars[name], data);
                results[name] = chars[name];
            }

            r.lastActivity = Date.now();

            // Broadcast the update to all WebSocket clients in the room
            const charArray = Object.values(chars);
            room.broadcastToRoom(r.code, 'state-updated', {
                characters: charArray,
                timestamp: Date.now()
            });

            res.json({ success: true, results });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─── Legacy numeric field endpoints (backward‑compatible) ────
    // These read/write to the full character objects
    const CHAR_FIELDS = ['harm', 'fatigue', 'obligation', 'boons', 'leash', 'corruption'];

    CHAR_FIELDS.forEach(field => {
        router.post(`/api/rooms/:code/characters/:name/${field}`, authenticate, (req, res) => {
            try {
                const r = room.getRoom(req.params.code);
                const chars = ensureCharacters(r);
                const name = req.params.name;
                if (!name || UNSAFE_KEYS.has(name)) {
                    return res.status(400).json({ error: 'Invalid character name' });
                }
                if (!chars[name]) chars[name] = { name };
                const delta = typeof req.body.delta === 'number' ? req.body.delta : 0;
                const current = chars[name][field] || 0;
                chars[name][field] = Math.max(0, current + delta);
                r.lastActivity = Date.now();

                // Broadcast the individual update
                room.broadcastToRoom(r.code, 'character-update', {
                    name,
                    field,
                    value: chars[name][field]
                });

                res.json({ success: true, name, field, value: chars[name][field] });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
    });

    // ─── Character roster export (global) ──────────────────────────
    router.get('/api/characters/export', authenticate, (req, res) => {
        try {
            const result = {
                rooms: {},
                timestamp: Date.now()
            };
            for (const [code, r] of room.rooms) {
                const roomData = {
                    name: r.name || code,
                    characters: {}
                };
                if (r.characters) {
                    for (const [name, data] of Object.entries(r.characters)) {
                        roomData.characters[name] = data;
                    }
                }
                result.rooms[code] = roomData;
            }
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─── Campaign sharing ────────────────────────────────────────────
    router.post('/api/rooms/:code/campaigns', authenticate, async (req, res) => {
        try {
            const roomCode = req.params.code.toUpperCase();
            room.getRoom(roomCode); // verify room exists

            const random = Math.random().toString(36).substring(2, 8);
            const campaignCode = random;

            await storage.saveCampaign(roomCode, campaignCode, req.body);

            res.json({ success: true, code: campaignCode, room: roomCode, message: 'Campaign stored' });
        } catch (err) {
            res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
        }
    });

    router.get('/api/rooms/:code/campaigns/:campaignCode', authenticate, async (req, res) => {
        try {
            const roomCode = req.params.code.toUpperCase();
            room.getRoom(roomCode); // verify room exists
            const campaignCode = req.params.campaignCode;
            if (!isSafeCampaignCode(campaignCode)) {
                return res.status(400).json({ error: 'Invalid campaign code' });
            }

            const data = await storage.loadCampaign(roomCode, campaignCode);
            res.json(data);
        } catch (err) {
            if (err.code === 'ENOENT' || err.message.includes('not found')) {
                return res.status(404).json({ error: 'Campaign not found' });
            }
            res.status(500).json({ error: err.message });
        }
    });

    // ─── API Docs ──────────────────────────────────────────────────
    router.get('/api/data/docs', (req, res) => {
        res.json({
            title: "Fate's Edge API Documentation",
            version: "9.0.0",
            endpoints: {
                health: { get: `GET ${config.healthEndpoint} - Server health check with stats` },
                rooms: { get: 'GET /api/rooms - List all rooms with stats' },
                clients: {
                    list: 'GET /api/rooms/:code/clients - List clients in room',
                    kick: 'POST /api/rooms/:code/clients/:clientId/kick - Kick a client',
                    ban: 'POST /api/rooms/:code/clients/:clientId/ban - Ban a client',
                    unban: 'POST /api/rooms/:code/clients/:clientId/unban - Unban a client'
                },
                deck: {
                    get: 'GET /api/rooms/:code/deck - Get current deck state',
                    shuffle: 'POST /api/rooms/:code/deck/shuffle - Shuffle the deck',
                    draw: 'POST /api/rooms/:code/deck/draw - Draw cards from deck',
                    crown: 'POST /api/rooms/:code/deck/crown - Draw a Crown Spread (5 cards)',
                    history: 'GET /api/rooms/:code/deck/history - Get deck draw history',
                    clearHistory: 'DELETE /api/rooms/:code/deck/history - Clear deck history'
                },
                modules: {
                    list: 'GET /api/modules - List available modules',
                    install: 'POST /api/modules - Permanently install an adventure module ({ id, content, manifest?, overwrite? }); manifest is derived from content if omitted',
                    push: 'POST /api/modules/:id/push - Push module to clients',
                    cleanup: 'POST /api/modules/:id/cleanup - Clean up module from clients'
                },
                adventure: {
                    get: 'GET /api/rooms/:code/adventure - Get current adventure state (module, act, scene, active encounter, campaign timers, recent log)',
                    reference: 'GET /api/rooms/:code/adventure/reference - Get bestiary/npcs/locations/factions/notes for the loaded adventure',
                    load: 'POST /api/rooms/:code/adventure/load - Load an adventure module ({ moduleId }); modules need "type": "adventure" in manifest.json plus an adventure.json',
                    loadCustom: 'POST /api/rooms/:code/adventure/load-custom - Load an in-memory adventure with no file on disk ({ content, id? }) -- for AI-GM-generated adventures',
                    reset: 'POST /api/rooms/:code/adventure/reset - Reset the loaded adventure back to planned (position, completed flags, timers)',
                    scene: 'POST /api/rooms/:code/adventure/scene - Advance the adventure ({ actIndex?, sceneIndex? } both optional; omit both to advance sequentially)',
                    encounterStart: "POST /api/rooms/:code/adventure/encounter/start - Start an encounter ({ ref } by index or name/creatureId in the current scene, OR { encounter } as a full ad-hoc object for an improvised fight)",
                    encounterResolve: 'POST /api/rooms/:code/adventure/encounter/resolve - Resolve the active encounter ({ outcome: "clean"|"partial"|"miss", notes? })',
                    timer: 'POST /api/rooms/:code/adventure/timer - Tick a timer ({ scope: "scene"|"campaign", ref (index or name), amount? } amount defaults to +1, can be negative)',
                    log: 'POST /api/rooms/:code/adventure/log - Append a free-form narrative beat to the adventure log ({ text, author? })'
                },
                characters: {
                    get: 'GET /api/rooms/:code/characters/:name - Get full character object',
                    list: 'GET /api/rooms/:code/characters - List all full character objects in a room',
                    update: 'POST /api/rooms/:code/characters/update - Bulk update full character objects',
                    export: 'GET /api/characters/export - Export all characters across all rooms',
                    fields: {
                        harm: 'POST /api/rooms/:code/characters/:name/harm - Adjust harm',
                        fatigue: 'POST /api/rooms/:code/characters/:name/fatigue - Adjust fatigue',
                        obligation: 'POST /api/rooms/:code/characters/:name/obligation - Adjust obligation',
                        boons: 'POST /api/rooms/:code/characters/:name/boons - Adjust boons',
                        leash: 'POST /api/rooms/:code/characters/:name/leash - Adjust leash',
                        corruption: 'POST /api/rooms/:code/characters/:name/corruption - Adjust corruption'
                    }
                },
                campaigns: {
                    upload: 'POST /api/rooms/:code/campaigns - Store campaign state (returns a random code)',
                    download: 'GET /api/rooms/:code/campaigns/:campaignCode - Retrieve stored campaign using the returned code'
                }
            }
        });
    });

    return router;
}

module.exports = { createApiRouter };