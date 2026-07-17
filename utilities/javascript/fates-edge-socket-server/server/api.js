/**
 * Fate's Edge - Express API Routes
 * v2 – added ban/kick/players endpoints for admin tools
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
                ? deck.synthesiseCrownSpread(drawn.slice(0,4), drawn[4], regionData)
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
            const mainCards = cards.slice(0,4);
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

    // ── NEW: Room Players & Kick/Ban/Unban ─────────────────────
    // List clients in a room
    router.get('/api/rooms/:code/clients', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const clients = room.getClientsList(r); // already returns id, name, role, email
            res.json({ code: r.code, clients });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    // Kick a client
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

    // Ban a client
    router.post('/api/rooms/:code/clients/:clientId/ban', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const targetId = req.params.clientId;
            // Ban even if not currently in room (add to ban list)
            const reason = req.body.reason || 'Banned by API admin';
            room.banClient(r, targetId, reason); // banClient also kicks if present
            room.broadcastToRoom(r.code, 'presence', { clients: room.getClientsList(r) });
            res.json({ success: true, message: `Client ${targetId} banned.` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Unban a client
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

    // ── API Docs (updated) ──────────────────────────────────────
    router.get('/api/data/docs', (req, res) => {
        res.json({
            title: "Fate's Edge API Documentation",
            version: "2.0.0",
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
                }
            }
        });
    });

    return router;
}

module.exports = { createApiRouter };