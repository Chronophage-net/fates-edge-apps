/**
 * Fate's Edge - Express API Routes
 * v8 – Full character storage (room.characters) + WebSocket parity
 * v9 – Adventure Engine routes wired in (see server/adventure.js)
 * v10 – /api/modules now includes standalone adventure JSONs from data/adventures/
 * v11 – FIXED: /api/modules legacy-module scan referenced an undefined
 *       `content` variable (only ever defined in the second, unrelated
 *       loop below) inside a try/catch that silently swallowed the
 *       resulting ReferenceError. Every module directory under
 *       server/modules/ therefore threw and was dropped from the list
 *       on every single call, with zero visible error -- only
 *       standalone data/adventures/*.json files ever made it into
 *       /api/modules. Changed `content.tier` to `manifest.tier`, which
 *       is what's actually in scope at that point. See the CHANGED
 *       comment at the call site below.
 */

const express = require('express');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const crypto = require('crypto');
const room = require('./room.js');
const deck = require('./deck.js');
const { safeAssign, buildSafeDict, isSafeModuleId, isSafeCampaignCode, clampCount, UNSAFE_KEYS, createRateLimiter, MAX_NAME_LENGTH } = require('./security.js');
const adventure = require('./adventure.js');
const { deriveManifestFromContent } = require('./module-manifest-utils.js');
const auth = require('./auth.js');
const turn = require('./turn.js');

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
        },
        // NEW: dedicated auto-save read/write, in a SEPARATE directory
        // from the manual-share campaigns above. Same fix as storage.js's
        // dedicated `autosaves` table -- if this reused saveCampaign's
        // directory/pruning (MAX_CAMPAIGNS=2, keyed by mtime), constant
        // auto-save churn would crowd out and silently delete a player's
        // manually-uploaded !gm upload snapshot before they got to use
        // it. One file per room, always overwritten in place, nothing to
        // prune.
        async saveAutoSave(roomCode, data) {
            const autosaveDir = path.join(__dirname, 'campaigns', 'autosave');
            await fsPromises.mkdir(autosaveDir, { recursive: true });
            const filePath = path.join(autosaveDir, `${roomCode}.json`);
            await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
        },
        async loadAutoSave(roomCode) {
            const filePath = path.join(__dirname, 'campaigns', 'autosave', `${roomCode}.json`);
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

    // ─── TURN credentials ─────────────────────────────────────────────
    // Deliberately NOT behind `authenticate` (the admin API key). Any
    // player's browser needs this to establish voice chat, same trust
    // boundary as being able to join a room/WS connection at all -- the
    // credential itself is short-lived (see turn.js) specifically so it's
    // safe to hand out without an admin key.
    router.get('/api/turn-credentials', (req, res) => {
        const label = typeof req.query.clientId === 'string' ? req.query.clientId : 'anon';
        const result = turn.mintCredentials(config, label);
        if (!result) {
            return res.status(404).json({ error: 'No TURN server configured on this deployment.' });
        }
        res.json(result);
    });

    // ─── Room list ──────────────────────────────────────────────────
    router.get('/api/rooms', authenticate, (req, res) => {
        const roomStats = Array.from(room.rooms.keys()).map(code => room.getRoomStats(code)).filter(Boolean);
        res.json({ rooms: roomStats, count: roomStats.length, timestamp: Date.now() });
    });

    // ─── Optional account auth ──────────────────────────────────────
    // NEW: layered on top of the existing anonymous room-code+password
    // flow, not a replacement for it. A client that never calls any of
    // these routes keeps working exactly as it always has (see
    // join-room handling in socketio-handlers.js / ws-handlers.js).
    //
    // Only available when the real DB-backed storage module loaded (the
    // file-system fallback above doesn't implement accounts -- reusing
    // that fallback for password hashes/PII didn't seem worth building
    // out, since it exists purely as a last resort for saveCampaign/
    // loadCampaign). hasAccountSupport() gates all account routes so
    // they fail with a clear 503 instead of a confusing TypeError if
    // that fallback is ever active.
    function hasAccountSupport() {
        return typeof storage.createUser === 'function';
    }
    function requireAccountSupport(req, res, next) {
        if (!hasAccountSupport()) {
            return res.status(503).json({ error: 'Account features require the database storage module (server/storage.js), which failed to load. Check server logs.' });
        }
        next();
    }

    // NEW: /api/auth/login and /api/auth/register are the only routes in
    // this file that are reachable WITHOUT the admin x-api-key -- by
    // design, anyone should be able to create an account or log in. That
    // also means they were previously wide open to unlimited password
    // guessing (login) or account-creation spam (register), with nothing
    // slowing an attacker down beyond bcrypt's own per-attempt cost. Cap
    // both to a modest per-IP rate so credential stuffing / brute force
    // is impractical without blocking legitimate users who mistype a
    // password a few times.
    const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Please wait a few minutes and try again.' });
    const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many accounts created from this address. Please try again later.' });

    router.post('/api/auth/register', registerLimiter, requireAccountSupport, async (req, res) => {
        try {
            const { username, password } = req.body || {};
            if (!auth.isValidUsername(username)) {
                return res.status(400).json({ error: 'username must be 3-32 characters: letters, numbers, underscore, dash' });
            }
            if (!auth.isValidPassword(password)) {
                return res.status(400).json({ error: 'password must be 8-256 characters' });
            }
            const existing = await storage.getUserByUsername(username);
            if (existing) {
                return res.status(409).json({ error: 'Username already taken' });
            }
            const passwordHash = await auth.hashPassword(password);
            const user = await storage.createUser(username, passwordHash);
            const token = auth.signToken({ userId: user.id, username: user.username });
            res.status(201).json({ success: true, token, user: { id: user.id, username: user.username } });
        } catch (err) {
            res.status(err.message === 'Username already taken' ? 409 : 500).json({ error: err.message });
        }
    });

    router.post('/api/auth/login', loginLimiter, requireAccountSupport, async (req, res) => {
        try {
            const { username, password } = req.body || {};
            if (!username || !password) {
                return res.status(400).json({ error: 'username and password are required' });
            }
            const user = await storage.getUserByUsername(username);
            // Always run the compare (even against a dummy hash) so a
            // nonexistent username doesn't respond measurably faster than
            // a wrong password -- avoids a trivial username-enumeration
            // timing side-channel.
            const passwordHash = user ? user.password_hash : '$2a$10$invalidsaltinvalidsaltinvalidsalthashvalue0000000000000';
            const ok = await auth.verifyPassword(password, passwordHash);
            if (!user || !ok) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }
            const token = auth.signToken({ userId: user.id, username: user.username });
            res.json({ success: true, token, user: { id: user.id, username: user.username } });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/api/auth/me', requireAccountSupport, auth.requireAuth, async (req, res) => {
        try {
            const user = await storage.getUserById(req.user.userId);
            if (!user) return res.status(404).json({ error: 'User not found' });
            res.json({ id: user.id, username: user.username });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─── Room password (persistent, hashed) ────────────────────────
    // NEW: previously room.js exported setRoomPassword() but NOTHING
    // ever called it -- there was no route or socket event that could
    // actually put a password on a room, so the password-gated join
    // check in socketio-handlers.js/ws-handlers.js was permanently dead
    // code. This is the admin/API path (gated by the existing static
    // x-api-key, same as the other /api/rooms/:code/* admin routes);
    // GMs can also set it live from the client via the `set_room_password`
    // socket event (see socketio-handlers.js / ws-handlers.js).
    router.post('/api/rooms/:code/password', authenticate, async (req, res) => {
        try {
            const roomCode = req.params.code.toUpperCase();
            const r = room.getRoom(roomCode); // verify room exists
            const { password } = req.body || {};
            const hash = password ? await auth.hashPassword(String(password)) : null;
            room.setRoomPassword(r, hash); // in-memory (now stores a hash, not plaintext), checked at join time
            if (hasAccountSupport()) {
                await storage.setRoomPasswordHash(roomCode, hash); // survives restarts
            }
            res.json({ success: true, code: roomCode, passwordSet: !!hash });
        } catch (err) {
            res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
        }
    });

    // ─── Account character library (prep for account-owned characters) ──
    // NEW: a per-user character library, capped at storage.MAX_CHARACTERS_
    // PER_USER (5). This is intentionally separate from room.js's
    // room.characters (the live, in-session character state synced to
    // everyone at the table) -- nothing here is wired into a room's live
    // state yet. That bridge (attaching one of your saved characters to a
    // room's live roster on join) is a larger, separate change; this is
    // the account-side storage + CRUD it would build on.
    router.get('/api/account/characters', requireAccountSupport, auth.requireAuth, async (req, res) => {
        try {
            const characters = await storage.listCharacters(req.user.userId);
            res.json({ characters, count: characters.length, limit: storage.MAX_CHARACTERS_PER_USER });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/account/characters', requireAccountSupport, auth.requireAuth, async (req, res) => {
        try {
            const { name, data } = req.body || {};
            if (!name || typeof name !== 'string' || UNSAFE_KEYS.has(name) || name.length > MAX_NAME_LENGTH) {
                return res.status(400).json({ error: `A valid character name (max ${MAX_NAME_LENGTH} characters) is required` });
            }
            const character = await storage.createCharacter(req.user.userId, name, data || {});
            res.status(201).json({ success: true, character });
        } catch (err) {
            if (err.code === 'CHARACTER_LIMIT') return res.status(409).json({ error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/api/account/characters/:id', requireAccountSupport, auth.requireAuth, async (req, res) => {
        try {
            const character = await storage.updateCharacterById(req.user.userId, req.params.id, req.body || {});
            if (!character) return res.status(404).json({ error: 'Character not found' });
            res.json({ success: true, character });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/api/account/characters/:id', requireAccountSupport, auth.requireAuth, async (req, res) => {
        try {
            const deleted = await storage.deleteCharacter(req.user.userId, req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Character not found' });
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
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
                ? deck.synthesiseCrownSpread(drawn.slice(0, 4), drawn[4], regionData, region)
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
            const result = deck.synthesiseCrownSpread(mainCards, wildcard, regionData, region);

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

    // ─── Ban/unban by persistent account (userId), not live client id ──
    // NEW: the routes above ban whoever currently holds a given
    // socket/ws id, which resets the moment that id disconnects. These
    // target a userId directly (from a membership row, or from the AI
    // GM bot's own knowledge of who's misbehaving), so it works even
    // against someone who isn't connected right now, and survives their
    // next reconnect under a fresh id. Requires account support.
    router.post('/api/rooms/:code/members/:userId/ban', authenticate, requireAccountSupport, async (req, res) => {
        try {
            if (!room.validateRoomCode(req.params.code)) {
                return res.status(400).json({ error: 'Invalid room code format' });
            }
            const roomKey = req.params.code.toUpperCase();
            await room.setMemberBannedByUserId(roomKey, req.params.userId, true);
            res.json({ success: true, message: `User ${req.params.userId} banned from room ${roomKey}.` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/members/:userId/unban', authenticate, requireAccountSupport, async (req, res) => {
        try {
            if (!room.validateRoomCode(req.params.code)) {
                return res.status(400).json({ error: 'Invalid room code format' });
            }
            const roomKey = req.params.code.toUpperCase();
            await room.setMemberBannedByUserId(roomKey, req.params.userId, false);
            res.json({ success: true, message: `User ${req.params.userId} unbanned from room ${roomKey}.` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─── Modules ──────────────────────────────────────────────────────
    // NEW: also mounted at /api/rooms/:code/modules (see listModulesHandler
    // below) -- the module catalog itself isn't room-scoped, but the AI GM
    // bot's apiRequest() helper always builds URLs as
    // `${API_BASE}/rooms/${ROOM_CODE}/${...}`, so `apiRequest('GET',
    // ['modules'])` was hitting a path that never existed server-side and
    // 404ing every time (`!gm modules`/module-browsing commands). Both
    // routes now serve the identical handler/response.
    function listModulesHandler(req, res) {
        const modules = [];
        // 1. Scan <repo-root>/modules/ (installable module folders).
        // FIX: this was `path.join(__dirname, 'modules')` -- __dirname
        // here is server/, so that resolved to server/modules/, which
        // has never existed. The real directory (what the Dockerfile
        // COPYs, what generate-manifest.js targets, and where the
        // shipped example-module/ actually lives) is one level up. Every
        // module install/list/push/cleanup route below had this same bug.
        const modulesPath = path.join(__dirname, '..', 'modules');
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
                                route: manifest.route || null,
                                // FIXED: was `content.tier || content.tierRange || '?'`.
                                // `content` doesn't exist in this scope (it's only
                                // defined in the standalone-adventure-JSON loop
                                // below) -- that ReferenceError was thrown on every
                                // iteration and silently swallowed by the catch
                                // block below, so no module directory ever made it
                                // into this list. `manifest` is what's actually in
                                // scope here and is what tier data should come from.
                                tier: manifest.tier || manifest.tierRange || '?'
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
    }
    router.get('/api/modules', authenticate, listModulesHandler);
    router.get('/api/rooms/:code/modules', authenticate, listModulesHandler);

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

            const moduleDir = path.join(__dirname, '..', 'modules', id);
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
            const modulesPath = path.join(__dirname, '..', 'modules', moduleId);
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
    // `dynamicGrowth` (bool) and `climaxAfterSessions` (number) opt this
    // adventure into the growth system -- see server/adventure.js.
    router.post('/api/rooms/:code/adventure/load-custom', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { content, id, dynamicGrowth, climaxAfterSessions } = req.body;
            if (!content || typeof content !== 'object') return res.status(400).json({ error: 'content object is required' });
            const state = adventure.loadAdventureContent(r, content, { id, dynamicGrowth, climaxAfterSessions });
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'adventure-loaded', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // NEW: append a single scene to an existing act -- used by the
    // bot-side dynamic-growth logic to extend a Crown-Spread-built
    // adventure as it's played, BEFORE calling /adventure/scene (with no
    // body) to advance into it via ordinary sequential advance.
    router.post('/api/rooms/:code/adventure/scene/append', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { actIndex, scene } = req.body;
            if (typeof actIndex !== 'number' || !scene) {
                return res.status(400).json({ error: 'actIndex (number) and scene object are required' });
            }
            const state = adventure.appendScene(r, actIndex, scene);
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'scene-appended', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // NEW: append a whole new act (e.g. a generated climax/conclusion).
    router.post('/api/rooms/:code/adventure/act/append', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { act } = req.body;
            if (!act) return res.status(400).json({ error: 'act object is required' });
            const state = adventure.appendAct(r, act);
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'act-appended', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // NEW: register an ad-hoc NPC into the currently loaded adventure's
    // own npcs[] -- used by the [NPC CREATE ...] tag so an improvised
    // character the AI invents mid-narration becomes a real, trackable
    // NPC instead of disposable prose.
    router.post('/api/rooms/:code/adventure/npc', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { npc } = req.body;
            if (!npc) return res.status(400).json({ error: 'npc object is required' });
            const state = adventure.addNpc(r, npc);
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'npc-added', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // NEW: same as above, for the bestiary.
    router.post('/api/rooms/:code/adventure/creature', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { creature } = req.body;
            if (!creature) return res.status(400).json({ error: 'creature object is required' });
            const state = adventure.addCreature(r, creature);
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'creature-added', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // NEW: mark a real-world play session as ended -- increments the
    // sessionsPlayed counter the bot-side director checks against
    // climaxAfterSessions to decide when to generate a climax.
    router.post('/api/rooms/:code/adventure/session/end', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const state = adventure.markSessionEnd(r);
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'session-ended', { source: 'api', ...state });
            res.json({ success: true, code: roomCode, ...state });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // NEW: mark that the climax act has already been generated for this
    // adventure, so growth logic doesn't generate a second one.
    router.post('/api/rooms/:code/adventure/climax-triggered', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const state = adventure.markClimaxTriggered(r);
            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'adventure-climax-triggered', { source: 'api', ...state });
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
    // position, outcomes, type? }), for an improvised fight (or any other
    // objective) with no pre-written encounter. `type` is an OPTIONAL
    // objective-type id passed through verbatim (see adventure.js's schema
    // comment for the full id list); defaults to 'combat' when absent.
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
    // FIXED: this whole section used to reimplement character storage
    // inline (its own `ensureCharacters(r)` + direct `chars[name]`
    // access) as a SEPARATE, case-sensitive code path from room.js's own
    // getCharacter()/updateCharacter() helpers -- which room.js exported
    // but nothing ever actually called. Two independent implementations
    // of the same storage, neither normalizing case, is exactly how
    // "Khor" and "khor" could silently become two different server-side
    // characters. Now uses room.js's helpers directly (which normalize
    // to lowercase internally -- see room.js's normalizeCharKey()),
    // removing the duplication and the case bug in the same change.

    // ─── Get current whiteboard state ─────────────────────────────
    // NEW: previously the only way to read whiteboard state was the
    // initial handshake/sync-request payload over the socket connection;
    // there was no REST route at all, so any caller doing an on-demand
    // GET (the AI GM bot's `!gm whiteboard` command calls exactly this)
    // always failed with "route doesn't exist server-side". `room.js`
    // already tracks whiteboard state per-room (see createDefaultWhiteboard()
    // / handleWhiteboardUpdate() in ws-handlers.js) -- this just exposes it.
    router.get('/api/rooms/:code/whiteboard', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            // CHANGED: return the whiteboard fields directly on the response
            // body (not nested under a `whiteboard` key) -- the AI GM bot's
            // `!gm whiteboard`/`!gm grid` commands read `data.drawings`,
            // `data.notes`, `data.images`, `data.gridCombat` straight off
            // whatever apiRequest() resolves to, matching the shape the
            // socket-pushed `sync-state`/`room-state` payloads already use
            // (`state: roomState.whiteboard`). A `{ whiteboard: {...} }`
            // wrapper would have silently made every one of those fields
            // read as undefined.
            res.json({ ...(r.whiteboard || {}) });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    // ─── Grid Combat: token sync for the AI GM ─────────────────────
    // NEW: gives the AI GM a way to actually WRITE to the whiteboard,
    // not just read it. Previously the only whiteboard mutation path was
    // the `whiteboard-update` socket event that the human whiteboard UI
    // sends wholesale (the entire whiteboard object, freeform); a bot
    // driving a text conversation has no canvas of its own to compute a
    // full replacement object from. These routes instead expose small,
    // targeted, authenticated REST operations on just `gridCombat.tokens`
    // -- the piece of whiteboard state that maps directly onto things the
    // AI GM already tracks in prose (an NPC/creature entering a scene, an
    // encounter's participants, who's still standing). Every mutation
    // updates `room.whiteboard` (the same object the socket handlers
    // read/write) and re-broadcasts a `whiteboard-update` event with the
    // exact payload shape `handleWhiteboardUpdate()` in ws-handlers.js
    // already uses, so connected human clients (Socket.IO or plain-WS)
    // see the token appear/move/disappear live, same as if a human had
    // dragged it.
    //
    // Tokens are addressed by grid CELL (col/row), not raw canvas pixels
    // -- the bot has no idea how large anyone's canvas is, but it knows
    // "this creature is now 2 cells away". `x`/`y` (pixel) are derived
    // from `col`/`row` * the room's current `gridCombat.cellSize` (or the
    // default 40) at write time, matching exactly how the whiteboard's own
    // addGridToken() computes token position.
    function tokenCellToPixel(gc, col, row) {
        const cellSize = gc.cellSize || 40;
        return { x: Math.round(col * cellSize), y: Math.round(row * cellSize) };
    }

    router.post('/api/rooms/:code/whiteboard/tokens', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { token } = req.body || {};
            if (!token || typeof token !== 'object') {
                return res.status(400).json({ error: 'token object is required' });
            }
            if (!r.whiteboard) r.whiteboard = { drawings: [], notes: [], images: [], gridCombat: { enabled: false, gridType: 'square', cellSize: 40, tokens: [] } };
            const gc = r.whiteboard.gridCombat = r.whiteboard.gridCombat || { enabled: false, gridType: 'square', cellSize: 40, tokens: [] };
            gc.tokens = gc.tokens || [];

            const col = Number.isFinite(token.col) ? token.col : 0;
            const row = Number.isFinite(token.row) ? token.row : 0;
            const { x, y } = tokenCellToPixel(gc, col, row);

            let saved;
            const existingIdx = token.id ? gc.tokens.findIndex(t => t.id === token.id) : -1;
            if (existingIdx >= 0) {
                saved = gc.tokens[existingIdx] = {
                    ...gc.tokens[existingIdx],
                    ...token,
                    x, y
                };
            } else {
                saved = {
                    id: token.id || `token-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    label: token.label || token.name || 'Token',
                    faction: token.faction || 'enemy',
                    body: Number.isFinite(token.body) ? token.body : 3,
                    x, y,
                    color: token.color || (token.faction === 'ally' ? '#5a8ab5' : '#c45a5a'),
                    harm: token.harm || 0,
                    fatigue: token.fatigue || 0,
                    tags: token.tags || [],
                    layerId: 'tokens',
                    vision: Number.isFinite(token.vision) ? token.vision : 0
                };
                gc.tokens.push(saved);
            }
            // Placing a token implies the fight is now visible on the board.
            gc.enabled = true;
            r.whiteboard.lastActivity = Date.now();

            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'whiteboard-update', {
                whiteboard: r.whiteboard,
                timestamp: Date.now(),
                source: 'api'
            });
            res.json({ success: true, token: saved, gridCombat: gc });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.post('/api/rooms/:code/whiteboard/tokens/:id/move', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const gc = r.whiteboard?.gridCombat;
            if (!gc || !Array.isArray(gc.tokens)) {
                return res.status(404).json({ error: 'No grid combat tokens in this room' });
            }
            const tokenObj = gc.tokens.find(t => t.id === req.params.id);
            if (!tokenObj) return res.status(404).json({ error: `No token with id "${req.params.id}"` });

            const { col, row } = req.body || {};
            if (!Number.isFinite(col) || !Number.isFinite(row)) {
                return res.status(400).json({ error: 'col and row (numbers) are required' });
            }
            const { x, y } = tokenCellToPixel(gc, col, row);
            tokenObj.x = x;
            tokenObj.y = y;
            r.whiteboard.lastActivity = Date.now();

            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'whiteboard-update', {
                whiteboard: r.whiteboard,
                timestamp: Date.now(),
                source: 'api'
            });
            res.json({ success: true, token: tokenObj });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.delete('/api/rooms/:code/whiteboard/tokens/:id', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const gc = r.whiteboard?.gridCombat;
            if (!gc || !Array.isArray(gc.tokens)) {
                return res.status(404).json({ error: 'No grid combat tokens in this room' });
            }
            const before = gc.tokens.length;
            gc.tokens = gc.tokens.filter(t => t.id !== req.params.id);
            if (gc.tokens.length === before) {
                return res.status(404).json({ error: `No token with id "${req.params.id}"` });
            }
            r.whiteboard.lastActivity = Date.now();

            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'whiteboard-update', {
                whiteboard: r.whiteboard,
                timestamp: Date.now(),
                source: 'api'
            });
            res.json({ success: true, removed: req.params.id, remaining: gc.tokens.length });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // Toggle/configure grid combat mode itself (e.g. the AI GM enabling it
    // the moment an encounter starts, even before any tokens exist yet).
    router.post('/api/rooms/:code/whiteboard/grid-combat', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            if (!r.whiteboard) r.whiteboard = { drawings: [], notes: [], images: [], gridCombat: { enabled: false, gridType: 'square', cellSize: 40, tokens: [] } };
            const gc = r.whiteboard.gridCombat = r.whiteboard.gridCombat || { enabled: false, gridType: 'square', cellSize: 40, tokens: [] };

            const { enabled, gridType, cellSize } = req.body || {};
            if (typeof enabled === 'boolean') gc.enabled = enabled;
            if (gridType) gc.gridType = gridType;
            if (Number.isFinite(cellSize) && cellSize > 0) gc.cellSize = cellSize;
            r.whiteboard.lastActivity = Date.now();

            const roomCode = req.params.code.toUpperCase();
            room.broadcastToRoom(roomCode, 'whiteboard-update', {
                whiteboard: r.whiteboard,
                timestamp: Date.now(),
                source: 'api'
            });
            res.json({ success: true, gridCombat: gc });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // ─── Get all characters in a room ────────────────────────────
    router.get('/api/rooms/:code/characters', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const result = room.getCharacters(r);
            res.json({ characters: result, count: result.length });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    // ─── Get a single character ──────────────────────────────────
    router.get('/api/rooms/:code/characters/:name', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const name = req.params.name;
            if (!name || UNSAFE_KEYS.has(name)) {
                return res.status(404).json({ error: 'Character not found' });
            }
            const char = room.getCharacter(r, name);
            if (!char) {
                return res.status(404).json({ error: 'Character not found' });
            }
            res.json(char);
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    // ─── Bulk update characters (full objects) ──────────────────
    router.post('/api/rooms/:code/characters/update', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { updates } = req.body;
            if (!updates || typeof updates !== 'object') {
                return res.status(400).json({ error: 'Missing updates object' });
            }

            const results = {};
            for (const [name, data] of Object.entries(updates)) {
                if (!name || UNSAFE_KEYS.has(name)) continue;
                // Preserve the display-case name the caller sent, in case
                // `data` didn't already include its own `.name` field.
                const merged = room.updateCharacter(r, name, { name, ...data });
                if (merged) results[name] = merged;
            }

            r.lastActivity = Date.now();

            // Broadcast the update to all WebSocket clients in the room
            const charArray = room.getCharacters(r);
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
                const name = req.params.name;
                if (!name || UNSAFE_KEYS.has(name) || name.length > MAX_NAME_LENGTH) {
                    return res.status(400).json({ error: 'Invalid character name' });
                }
                const existing = room.getCharacter(r, name);
                const delta = typeof req.body.delta === 'number' ? req.body.delta : 0;
                const current = (existing && existing[field]) || 0;
                const newValue = Math.max(0, current + delta);
                room.updateCharacter(r, name, { [field]: newValue });
                r.lastActivity = Date.now();

                // Broadcast the individual update
                room.broadcastToRoom(r.code, 'character-update', {
                    name,
                    field,
                    value: newValue
                });

                res.json({ success: true, name, field, value: newValue });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
    });

    // ─── One-time cleanup: merge case-fragmented character records ──
    // NEW: for rooms that already have duplicate records from before
    // case-normalization existed (e.g. both "Khor" and "khor" as
    // separate keys). See room.js's mergeDuplicateCharacters() for the
    // merge heuristic and its limitations.
    router.post('/api/rooms/:code/characters/cleanup', authenticate, (req, res) => {
        try {
            const r = room.getRoom(req.params.code);
            const { merged, removedKeys } = room.mergeDuplicateCharacters(r);
            if (merged > 0) {
                room.broadcastToRoom(r.code, 'state-updated', {
                    characters: room.getCharacters(r),
                    timestamp: Date.now()
                });
            }
            res.json({ success: true, merged, removedKeys });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
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

    // ─── Campaign auto-save (deterministic per-room slot) ────────────
    // NEW: unlike the random-code routes below (POST /campaigns,
    // GET /campaigns/:campaignCode -- kept unchanged, for the explicit
    // manual share flow via !gm upload / !gm load <code>), these use a
    // FIXED key equal to the room code itself, so the bot's automatic
    // restart-survival persistence (CampaignManager.save()/load() in
    // world-manager.js) never needs to track a separately-generated
    // random code via a local pointer file that might not survive a
    // restart. Declared BEFORE the `:campaignCode` param routes below so
    // Express's declaration-order route matching doesn't ambiguously
    // swallow a literal request to `.../campaigns/auto-save`.
    //
    // FIXED: these used to call storage.saveCampaign/loadCampaign with a
    // magic campaignCode of 'autosave' -- reusing the SAME table/pruning
    // logic as manual !gm upload snapshots. Since auto-save fires after
    // nearly every command, its row was almost always the most recently
    // updated one for a room, leaving only one slot for manual uploads
    // under the default retention of 2 -- silently pruning a player's
    // shared snapshot code before they could use it. Now calls dedicated
    // saveAutoSave/loadAutoSave functions (both storage.js and the
    // file-based fallback above implement these completely separately
    // from the manual-share retention logic).
    router.post('/api/rooms/:code/campaigns/auto-save', authenticate, async (req, res) => {
        try {
            const roomCode = req.params.code.toUpperCase();
            room.getRoom(roomCode); // verify room exists
            await storage.saveAutoSave(roomCode, req.body);
            res.json({ success: true, room: roomCode, message: 'Campaign auto-saved' });
        } catch (err) {
            res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
        }
    });

    router.get('/api/rooms/:code/campaigns/auto-save', authenticate, async (req, res) => {
        try {
            const roomCode = req.params.code.toUpperCase();
            room.getRoom(roomCode); // verify room exists
            const data = await storage.loadAutoSave(roomCode);
            res.json(data);
        } catch (err) {
            if (err.code === 'ENOENT' || err.message.includes('not found')) {
                return res.status(404).json({ error: 'No auto-saved campaign found' });
            }
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
                turn: { get: 'GET /api/turn-credentials?clientId=X - Mint short-lived TURN credentials (no API key required; 404 if TURN_SECRET is not configured)' },
                rooms: { get: 'GET /api/rooms - List all rooms with stats' },
                clients: {
                    list: 'GET /api/rooms/:code/clients - List clients in room',
                    kick: 'POST /api/rooms/:code/clients/:clientId/kick - Kick a client',
                    ban: 'POST /api/rooms/:code/clients/:clientId/ban - Ban a client (ephemeral, by live socket/ws id)',
                    unban: 'POST /api/rooms/:code/clients/:clientId/unban - Unban a client (ephemeral)',
                    banMember: 'POST /api/rooms/:code/members/:userId/ban - Ban an account by userId (persistent, survives reconnects; requires account support)',
                    unbanMember: 'POST /api/rooms/:code/members/:userId/unban - Unban an account by userId (requires account support)'
                },
                auth: {
                    register: 'POST /api/auth/register - Create an account ({ username, password }); returns a JWT (requires account support)',
                    login: 'POST /api/auth/login - Log in ({ username, password }); returns a JWT (requires account support)',
                    me: 'GET /api/auth/me - Get the current account for a Bearer token (requires account support)',
                    note: 'Accounts are OPTIONAL. Clients that never call these routes join rooms exactly as before -- anonymous, with the room password (if any) required on every join. An authenticated client that has joined a password-protected room once can rejoin without re-entering the password, and a ban tied to their account survives reconnects. Pass the JWT as { authToken } in the join-room / handshake payload.'
                },
                roomPassword: {
                    set: 'POST /api/rooms/:code/password - Set/change/clear a room password ({ password } or {} to clear); also settable live by a GM via the set_room_password socket event',
                },
                accountCharacters: {
                    list: 'GET /api/account/characters - List the current account\'s saved characters (max 5; requires Bearer token + account support)',
                    create: 'POST /api/account/characters - Save a new character ({ name, data }); 409 once 5 are already saved',
                    update: 'PUT /api/account/characters/:id - Update a saved character ({ name?, data? })',
                    remove: 'DELETE /api/account/characters/:id - Delete a saved character',
                    note: 'This is an account-owned character LIBRARY, separate from a room\'s live character roster (GET /api/rooms/:code/characters below). There is no bridge yet between the two -- attaching a saved character to a room\'s live state on join is a planned follow-up, not implemented here.'
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
                    list: 'GET /api/modules (also aliased at GET /api/rooms/:code/modules) - List available modules',
                    install: 'POST /api/modules - Permanently install an adventure module ({ id, content, manifest?, overwrite? }); manifest is derived from content if omitted',
                    push: 'POST /api/modules/:id/push - Push module to clients',
                    cleanup: 'POST /api/modules/:id/cleanup - Clean up module from clients'
                },
                adventure: {
                    get: 'GET /api/rooms/:code/adventure - Get current adventure state (module, act, scene, active encounter, campaign timers, recent log, growth tracking)',
                    reference: 'GET /api/rooms/:code/adventure/reference - Get bestiary/npcs/locations/factions/notes for the loaded adventure',
                    load: 'POST /api/rooms/:code/adventure/load - Load an adventure module ({ moduleId }); modules need "type": "adventure" in manifest.json plus an adventure.json',
                    loadCustom: 'POST /api/rooms/:code/adventure/load-custom - Load an in-memory adventure with no file on disk ({ content, id?, dynamicGrowth?, climaxAfterSessions? }) -- for AI-GM-generated adventures',
                    reset: 'POST /api/rooms/:code/adventure/reset - Reset the loaded adventure back to planned (position, completed flags, timers, session/climax tracking)',
                    scene: 'POST /api/rooms/:code/adventure/scene - Advance the adventure ({ actIndex?, sceneIndex? } both optional; omit both to advance sequentially)',
                    sceneAppend: 'POST /api/rooms/:code/adventure/scene/append - Append a new scene to an existing act ({ actIndex, scene }) -- call /adventure/scene afterward to advance into it',
                    actAppend: 'POST /api/rooms/:code/adventure/act/append - Append a whole new act ({ act: { title, description?, scenes: [...] } })',
                    npcAdd: 'POST /api/rooms/:code/adventure/npc - Register an ad-hoc NPC into the loaded adventure ({ npc: { name, role?, motivation? } })',
                    creatureAdd: 'POST /api/rooms/:code/adventure/creature - Register an ad-hoc creature into the bestiary ({ creature: { name, ... } })',
                    sessionEnd: 'POST /api/rooms/:code/adventure/session/end - Mark a real-world play session as ended (increments sessionsPlayed)',
                    climaxTriggered: 'POST /api/rooms/:code/adventure/climax-triggered - Mark that the climax act has already been generated for this adventure',
                    encounterStart: "POST /api/rooms/:code/adventure/encounter/start - Start an encounter ({ ref } by index or name/creatureId in the current scene, OR { encounter } as a full ad-hoc object for an improvised fight/objective; optional encounter.type sets its objective-type id, e.g. 'combat'|'lockpick'|'heist'|'social', default 'combat')",
                    encounterResolve: 'POST /api/rooms/:code/adventure/encounter/resolve - Resolve the active encounter ({ outcome: "clean"|"partial"|"miss", notes? })',
                    timer: 'POST /api/rooms/:code/adventure/timer - Tick a timer ({ scope: "scene"|"campaign", ref (index or name), amount? } amount defaults to +1, can be negative)',
                    log: 'POST /api/rooms/:code/adventure/log - Append a free-form narrative beat to the adventure log ({ text, author? })'
                },
                whiteboard: {
                    get: 'GET /api/rooms/:code/whiteboard - Get current whiteboard state (drawings, notes, images, gridCombat, ... returned directly, not wrapped)',
                    gridCombat: 'POST /api/rooms/:code/whiteboard/grid-combat - Enable/configure grid combat ({ enabled?, gridType?, cellSize? })',
                    tokenPlace: 'POST /api/rooms/:code/whiteboard/tokens - Place or update a token ({ token: { id?, label, faction, col, row, color?, harm?, fatigue?, tags?, vision?, body? } }); col/row are grid cells, not pixels; auto-enables grid combat',
                    tokenMove: 'POST /api/rooms/:code/whiteboard/tokens/:id/move - Move an existing token ({ col, row })',
                    tokenRemove: 'DELETE /api/rooms/:code/whiteboard/tokens/:id - Remove a token'
                },
                characters: {
                    get: 'GET /api/rooms/:code/characters/:name - Get full character object',
                    list: 'GET /api/rooms/:code/characters - List all full character objects in a room',
                    update: 'POST /api/rooms/:code/characters/update - Bulk update full character objects',
                    export: 'GET /api/characters/export - Export all characters across all rooms',
                    cleanup: 'POST /api/rooms/:code/characters/cleanup - One-time merge of case-fragmented duplicate character records (e.g. "Khor"/"khor") left over from before case-normalization',
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
