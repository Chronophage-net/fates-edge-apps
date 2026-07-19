/**
 * Fate's Edge - Express API Routes
 * v2 – added ban/kick/players endpoints for admin tools
 * v3 – added character‑state endpoints (harm, fatigue, obligation, boons)
 * v4 – added leash, corruption, character list, and bulk character state sync
 * v5 – added global character roster export
 * v6 – campaign filenames now prefixed with room code; automatic consolidation (keeps last 2 per room)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const room = require('./room.js');
const deck = require('./deck.js');

let config = {};

function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) return res.status(401).json({ error: 'API key required' });
    req.apiKeyData = { name: 'System' };
    next();
}

function createApiRouter(appConfig) {
    config = appConfig;
    const router = express.Router();

    // Health
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

    // Room list
    router.get('/api/rooms', authenticate, (req, res) => {
        const roomStats = Array.from(room.rooms.keys()).map(code => room.getRoomStats(code)).filter(Boolean);
        res.json({ rooms: roomStats, count: roomStats.length, timestamp: Date.now() });
    });

    // ── Deck endpoints (unchanged) ─────────────────────────────
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
            const { count = 1, region = 'Acasia' } = req.body;
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

    // ── Clients: list, kick, ban, unban ────────────────────────
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

    // ── Modules (unchanged) ─────────────────────────────────────
    router.get('/api/modules', authenticate, (req, res) => {
        const modules = [];
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
        res.json({ modules, count: modules.length, timestamp: Date.now() });
    });

    router.post('/api/modules/:id/push', authenticate, (req, res) => {
        try {
            const moduleId = req.params.id;
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

    // ── Character roster export (global) ──────────────────────────
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
                if (r.characterState) {
                    for (const [name, stats] of Object.entries(r.characterState)) {
                        const entry = { name };
                        CHAR_FIELDS.forEach(f => {
                            entry[f] = stats[f] ?? 0;
                        });
                        roomData.characters[name] = entry;
                    }
                }
                result.rooms[code] = roomData;
            }
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Character‑state endpoints ──────────────────────────────
    function ensureCharState(r) {
        if (!r.characterState) r.characterState = {};
    }

    const CHAR_FIELDS = ['harm', 'fatigue', 'obligation', 'boons', 'leash', 'corruption'];

    CHAR_FIELDS.forEach(field => {
        router.post(`/api/rooms/:code/characters/:name/${field}`, authenticate, (req, res) => {
            try {
                const r = room.getRoom(req.params.code);
                if (!r) return res.status(404).json({ error: 'Room not found' });
                ensureCharState(r);
                const name = req.params.name;
                if (!r.characterState[name]) {
                    r.characterState[name] = {};
                    CHAR_FIELDS.forEach(f => { r.characterState[name][f] = 0; });
                }
                const delta = typeof req.body.delta === 'number' ? req.body.delta : 0;
                const current = r.characterState[name][field] || 0;
                r.characterState[name][field] = Math.max(0, current + delta);
                r.lastActivity = Date.now();

                room.broadcastToRoom(r.code, 'character-update', {
                    name,
                    field,
                    value: r.characterState[name][field]
                });

                res.json({ success: true, name, field, value: r.characterState[name][field] });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
    });

    router.get('/api/rooms/:code/characters/:name', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            if (!r) return res.status(404).json({ error: 'Room not found' });
            const state = r.characterState ? r.characterState[req.params.name] : null;
            if (!state) return res.status(404).json({ error: 'Character not found' });
            const result = { name: req.params.name };
            CHAR_FIELDS.forEach(f => {
                result[f] = state[f] ?? 0;
            });
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/api/rooms/:code/characters', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            if (!r) return res.status(404).json({ error: 'Room not found' });
            ensureCharState(r);
            const result = {};
            for (const [name, stats] of Object.entries(r.characterState)) {
                const entry = { name };
                CHAR_FIELDS.forEach(f => {
                    entry[f] = stats[f] ?? 0;
                });
                result[name] = entry;
            }
            res.json({ characters: result, count: Object.keys(result).length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/characters/update', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            if (!r) return res.status(404).json({ error: 'Room not found' });
            ensureCharState(r);
            const { updates } = req.body;
            if (!updates || typeof updates !== 'object') {
                return res.status(400).json({ error: 'Missing updates object' });
            }
            const results = {};
            for (const [name, fields] of Object.entries(updates)) {
                if (!r.characterState[name]) {
                    r.characterState[name] = {};
                    CHAR_FIELDS.forEach(f => { r.characterState[name][f] = 0; });
                }
                const entry = r.characterState[name];
                for (const [field, value] of Object.entries(fields)) {
                    if (!CHAR_FIELDS.includes(field)) continue;
                    entry[field] = Math.max(0, value);
                }
                results[name] = entry;
            }
            r.lastActivity = Date.now();
            room.broadcastToRoom(r.code, 'character-update-bulk', { updates: results, timestamp: Date.now() });
            res.json({ success: true, results });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Campaign sharing ──────────────────────────────────────────
    const campaignsDir = path.join(__dirname, 'campaigns');
    if (!fs.existsSync(campaignsDir)) {
        fs.mkdirSync(campaignsDir, { recursive: true });
    }

    // Helper: get all campaign files for a given room code, sorted by mtime descending
    function getCampaignFiles(roomCode) {
        const files = fs.readdirSync(campaignsDir)
            .filter(f => f.startsWith(`${roomCode}-`) && f.endsWith('.json'))
            .map(f => ({
                name: f,
                path: path.join(campaignsDir, f),
                mtime: fs.statSync(path.join(campaignsDir, f)).mtime
            }));
        return files.sort((a, b) => b.mtime - a.mtime); // newest first
    }

    // POST – store a new campaign snapshot
    router.post('/api/rooms/:code/campaigns', authenticate, (req, res) => {
        try {
            const roomCode = req.params.code.toUpperCase();
            room.getRoom(roomCode); // verify room exists

            // Generate a random 6-character alphanumeric suffix
            const random = Math.random().toString(36).substring(2, 8);
            const campaignCode = random; // this is what we return to the client
            const fileName = `${roomCode}-${campaignCode}.json`;
            const filePath = path.join(campaignsDir, fileName);

            // Write the campaign data
            fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));

            // Consolidate: keep only the last 2 campaign files for this room
            const MAX_CAMPAIGNS = 2;
            const files = getCampaignFiles(roomCode);
            if (files.length > MAX_CAMPAIGNS) {
                // files are already sorted newest first, so delete all after the first MAX_CAMPAIGNS
                const toDelete = files.slice(MAX_CAMPAIGNS);
                for (const file of toDelete) {
                    try {
                        fs.unlinkSync(file.path);
                    } catch (e) {
                        // ignore deletion errors
                    }
                }
            }

            res.json({ success: true, code: campaignCode, room: roomCode, message: 'Campaign stored' });
        } catch (err) {
            res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
        }
    });

    // GET – retrieve a stored campaign by its random code (suffix)
    router.get('/api/rooms/:code/campaigns/:campaignCode', authenticate, (req, res) => {
        try {
            const roomCode = req.params.code.toUpperCase();
            room.getRoom(roomCode); // verify room exists
            const campaignCode = req.params.campaignCode;
            // Build filename: <roomCode>-<campaignCode>.json
            const fileName = `${roomCode}-${campaignCode}.json`;
            const filePath = path.join(campaignsDir, fileName);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Campaign not found' });
            }
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            res.json(data);
        } catch (err) {
            res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
        }
    });

    // ── API Docs (updated) ──────────────────────────────────────
    router.get('/api/data/docs', (req, res) => {
        res.json({
            title: "Fate's Edge API Documentation",
            version: "6.0.0",
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
                    push: 'POST /api/modules/:id/push - Push module to clients',
                    cleanup: 'POST /api/modules/:id/cleanup - Clean up module from clients'
                },
                characters: {
                    get: 'GET /api/rooms/:code/characters/:name - Get character stats',
                    list: 'GET /api/rooms/:code/characters - List all characters in a room',
                    update: 'POST /api/rooms/:code/characters/update - Bulk update multiple characters',
                    export: 'GET /api/characters/export - Export all character rosters across all rooms',
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