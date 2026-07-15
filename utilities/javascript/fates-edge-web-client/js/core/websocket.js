#!/usr/bin/env node
/**
 * Fate's Edge - WebSocket Server
 * Supports both Socket.io and plain WebSocket connections
 * Includes built-in web interface
 */

const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ============================================================
// EXPRESS APP SETUP
// ============================================================

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// LOGGING UTILITY
// ============================================================

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

function log(level, message, data = null) {
    const levelNum = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    const currentLevel = LOG_LEVELS[LOG_LEVEL] || LOG_LEVELS.INFO;
    
    if (levelNum < currentLevel) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    
    if (data) {
        console.log(`${prefix} ${message}`, data);
    } else {
        console.log(`${prefix} ${message}`);
    }
}

function logInfo(message, data = null) { log('INFO', message, data); }
function logWarn(message, data = null) { log('WARN', message, data); }
function logError(message, data = null) { log('ERROR', message, data); }
function logDebug(message, data = null) { log('DEBUG', message, data); }

// ============================================================
// CONSTANTS
// ============================================================

const DECK_SUITS = ['hearts', 'spades', 'clubs', 'diamonds'];
const DECK_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS = { hearts: '♥', spades: '♠', clubs: '♣', diamonds: '♦' };
const SUIT_NAMES = { hearts: 'Hearts', spades: 'Spades', clubs: 'Clubs', diamonds: 'Diamonds' };
const RANK_NAMES = {
    'A': 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
    '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
    'J': 'Jack', 'Q': 'Queen', 'K': 'King'
};
const SUIT_COLORS = {
    hearts: '#e74c3c',
    spades: '#2c3e50',
    clubs: '#27ae60',
    diamonds: '#3498db',
    joker: '#d4af37'
};

const CROWN_POSITIONS = [
    { key: 'root', label: 'Root', icon: '🌱' },
    { key: 'crest', label: 'Crest', icon: '🏔️' },
    { key: 'crown', label: 'Crown', icon: '👑' },
    { key: 'left', label: 'Left Hand', icon: '🤝' }
];

const WEB_PORTS = [80, 443, 3000, 8080, 8443, 10000];

// ============================================================
// STATE
// ============================================================

const rooms = new Map();
const regionDataCache = new Map();
const wsClients = new Map();
const socketStats = {
    totalConnections: 0,
    socketIOConnections: 0,
    wsConnections: 0,
    startTime: Date.now()
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function validateRoomCode(code) {
    return typeof code === 'string' && code.length >= 4 && code.length <= 10 && /^[A-Z0-9]+$/.test(code);
}

function getRoom(code) {
    if (!validateRoomCode(code)) {
        throw new Error('Invalid room code format');
    }
    const room = rooms.get(code.toUpperCase());
    if (!room) {
        throw new Error(`Room ${code} not found`);
    }
    return room;
}

function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    req.apiKeyData = { name: 'System' };
    next();
}

function getRoomStats(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return null;
    return {
        code: room.code,
        name: room.name,
        clients: room.clients.size,
        wsClients: wsClients.has(roomCode) ? wsClients.get(roomCode).size : 0,
        totalClients: room.clients.size + (wsClients.has(roomCode) ? wsClients.get(roomCode).size : 0),
        deckRemaining: room.deck?.length || 0,
        historyCount: room.deckHistory?.length || 0,
        lastActivity: room.lastActivity,
        created: room.created
    };
}

// ============================================================
// DECK MANAGEMENT
// ============================================================

function buildDeck() {
    const deck = [];
    for (const suit of DECK_SUITS) {
        for (const rank of DECK_RANKS) {
            deck.push({
                suit,
                rank,
                symbol: SUIT_SYMBOLS[suit],
                suitName: SUIT_NAMES[suit],
                rankName: RANK_NAMES[rank] || rank,
                color: SUIT_COLORS[suit],
                isJoker: false
            });
        }
    }
    
    deck.push({
        suit: 'joker',
        rank: 'Red',
        symbol: '🃏',
        suitName: 'Joker',
        rankName: 'Red',
        color: SUIT_COLORS.joker,
        isJoker: true
    });
    deck.push({
        suit: 'joker',
        rank: 'Black',
        symbol: '🃏',
        suitName: 'Joker',
        rankName: 'Black',
        color: SUIT_COLORS.joker,
        isJoker: true
    });

    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    logDebug('Built new deck', { totalCards: deck.length });
    return deck;
}

function getCardMeaningFromRegion(suit, rank, regionData) {
    if (!regionData || !regionData[suit]) {
        return `A complication of ${suit} arises.`;
    }
    const arr = regionData[suit];
    if (!arr || arr.length === 0) {
        return `A complication of ${suit} arises.`;
    }
    const seed = suit + rank + Math.floor(Math.random() * 1000);
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const index = Math.abs(hash) % arr.length;
    return arr[index];
}

function getWildcardMeaning(card) {
    const twists = [
        "A sudden storm or environmental shift changes the scene.",
        "An unexpected ally appears with conflicting motives.",
        "A minor curse or blessing from a Patron alters the odds.",
        "A forgotten debt is called in at the worst moment.",
        "The ground beneath you gives way—literal or figurative.",
        "A piece of evidence surfaces that reframes everything.",
        "A rival's plan backfires, creating chaos for everyone.",
        "A moment of clarity reveals a hidden truth.",
    ];
    const seed = (card.suit || 'joker') + (card.rank || '') + Math.floor(Math.random() * 1000);
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    const idx = Math.abs(hash) % twists.length;
    const cardName = card.isJoker ? 'Joker' : `${card.rankName} of ${card.suitName}`;
    return `✨ Twist (${cardName}): ${twists[idx]}`;
}

function synthesiseConsequence(cards, regionData) {
    const entries = cards.map(c => {
        if (c.isJoker) {
            return getWildcardMeaning(c);
        }
        return getCardMeaningFromRegion(c.suit, c.rank, regionData);
    });
    if (entries.length === 1) {
        return entries[0];
    } else if (entries.length === 2) {
        return `${entries[0]}\n\nThen, ${entries[1]}`;
    } else {
        return entries.map((e, i) => `${i + 1}. ${e}`).join('\n\n');
    }
}

function synthesiseCrownSpread(mainCards, wildcard, regionData) {
    const positions = CROWN_POSITIONS;
    const positionCards = mainCards.map((card, i) => {
        const pos = positions[i];
        const meaning = card.isJoker ?
            "The unexpected. The impossible. A force that does not follow the rules." :
            getCardMeaningFromRegion(card.suit, card.rank, regionData);
        return {
            ...pos,
            card: card,
            meaning: meaning,
            isJoker: card.isJoker || false,
            rankName: card.isJoker ? 'Joker' : RANK_NAMES[card.rank],
            suitName: card.isJoker ? '' : SUIT_NAMES[card.suit],
            symbol: card.isJoker ? '🃏' : card.symbol,
            color: card.isJoker ? '#d4af37' : (card.color || '#2980b9')
        };
    });

    const wildcardMeaning = getWildcardMeaning(wildcard);

    let synthesis = "The Crown Spread reveals a story of tension and consequence.\n\n";
    synthesis += `🌱 Root: ${positionCards[0].meaning}\n\n`;
    synthesis += `🏔️ Crest: ${positionCards[1].meaning}\n\n`;
    synthesis += `👑 Crown: ${positionCards[2].meaning}\n\n`;
    synthesis += `🤝 Left Hand: ${positionCards[3].meaning}\n\n`;
    synthesis += `🌟 Wildcard: ${wildcardMeaning}`;

    return {
        synthesis,
        positions: positionCards,
        wildcard: wildcardMeaning,
        timer: {
            segments: 6,
            card: `${positionCards.reduce((a, b) => {
                const rankA = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].indexOf(a.card.rank);
                const rankB = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].indexOf(b.card.rank);
                return rankA > rankB ? a : b;
            }).card.rankName} of ${positionCards.reduce((a, b) => {
                const rankA = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].indexOf(a.card.rank);
                const rankB = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].indexOf(b.card.rank);
                return rankA > rankB ? a : b;
            }).card.suitName}`
        }
    };
}

async function loadRegionData(regionName) {
    if (regionDataCache.has(regionName)) {
        logDebug('Region data cache hit', { region: regionName });
        return regionDataCache.get(regionName);
    }

    try {
        const regionPath = path.join(__dirname, 'data', 'regions', `${regionName.toLowerCase()}.json`);
        if (fs.existsSync(regionPath)) {
            const data = JSON.parse(fs.readFileSync(regionPath, 'utf-8'));
            regionDataCache.set(regionName, data);
            logDebug('Loaded region data from file', { region: regionName, path: regionPath });
            return data;
        }

        const miscPath = path.join(__dirname, 'misc', 'regions', `${regionName.toLowerCase()}.json`);
        if (fs.existsSync(miscPath)) {
            const data = JSON.parse(fs.readFileSync(miscPath, 'utf-8'));
            regionDataCache.set(regionName, data);
            logDebug('Loaded region data from misc', { region: regionName, path: miscPath });
            return data;
        }

        const defaultData = {
            name: regionName,
            description: `${regionName} - A region of Fate's Edge.`,
            hearts: ["A matter of loyalty or love arises."],
            spades: ["A conflict or struggle emerges."],
            clubs: ["A physical challenge or obstacle appears."],
            diamonds: ["A resource, treasure, or opportunity is found."]
        };
        regionDataCache.set(regionName, defaultData);
        logInfo('Using default region data', { region: regionName });
        return defaultData;
    } catch (e) {
        logWarn('Could not load region data', { region: regionName, error: e.message });
        const defaultData = {
            name: regionName,
            description: `${regionName} - A region of Fate's Edge.`,
            hearts: ["A matter of loyalty or love arises."],
            spades: ["A conflict or struggle emerges."],
            clubs: ["A physical challenge or obstacle appears."],
            diamonds: ["A resource, treasure, or opportunity is found."]
        };
        regionDataCache.set(regionName, defaultData);
        return defaultData;
    }
}

// ============================================================
// BROADCAST HELPERS
// ============================================================

function broadcastToRoom(roomCode, event, data) {
    const roomKey = roomCode.toUpperCase();
    
    if (io) {
        io.to(roomKey).emit(event, data);
        logDebug('Broadcast to Socket.io clients', { room: roomKey, event, clients: io.sockets.adapter.rooms.get(roomKey)?.size || 0 });
    }
    
    if (wsClients.has(roomKey)) {
        const message = JSON.stringify({ type: event, ...data });
        let sentCount = 0;
        wsClients.get(roomKey).forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
                sentCount++;
            }
        });
        logDebug('Broadcast to plain WebSocket clients', { room: roomKey, event, clients: sentCount });
    }
}

// ============================================================
// WEB INTERFACE ROUTES
// ============================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// API ROUTES
// ============================================================

app.get('/api/health', (req, res) => {
    const roomStats = Array.from(rooms.keys()).map(code => getRoomStats(code)).filter(Boolean);
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        stats: {
            ...socketStats,
            totalRooms: rooms.size,
            totalConnections: socketStats.socketIOConnections + socketStats.wsConnections,
            rooms: roomStats,
            webPort: process.env.WEB_PORT || 'N/A'
        }
    });
});

app.get('/api/rooms', authenticate, (req, res) => {
    const roomStats = Array.from(rooms.keys()).map(code => getRoomStats(code)).filter(Boolean);
    res.json({
        rooms: roomStats,
        count: roomStats.length,
        timestamp: Date.now()
    });
});

app.get('/api/rooms/:code/deck', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        if (!room.deck) {
            room.deck = buildDeck();
            room.deckHistory = [];
            room.deckOffset = Math.floor(Math.random() * 1000);
        }
        res.json({
            code: req.params.code.toUpperCase(),
            name: room.name,
            deck: room.deck,
            deckHistory: room.deckHistory || [],
            remaining: room.deck.length,
            offset: room.deckOffset
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.post('/api/rooms/:code/deck/shuffle', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        room.deck = buildDeck();
        room.deckOffset = Math.floor(Math.random() * 1000);
        room.lastActivity = Date.now();

        const roomCode = req.params.code.toUpperCase();
        broadcastToRoom(roomCode, 'deck-shuffled', {
            source: 'api',
            remaining: room.deck.length,
            timestamp: Date.now()
        });

        logInfo('Deck shuffled via API', { room: roomCode });
        res.json({
            success: true,
            code: roomCode,
            remaining: room.deck.length,
            message: 'Deck shuffled'
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.post('/api/rooms/:code/deck/draw', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const { count = 1, region = 'Acasia' } = req.body;

        if (!room.deck || room.deck.length === 0) {
            room.deck = buildDeck();
        }

        if (room.deck.length < count) {
            room.deck = buildDeck();
        }

        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (room.deck.length === 0) {
                room.deck = buildDeck();
            }
            drawn.push(room.deck.pop());
        }

        loadRegionData(region).then(regionData => {
            const isCrown = count === 5;
            let synthesis;

            if (isCrown) {
                const mainCards = drawn.slice(0, 4);
                const wildcard = drawn[4];
                synthesis = synthesiseCrownSpread(mainCards, wildcard, regionData);
            } else {
                synthesis = synthesiseConsequence(drawn, regionData);
            }

            const result = {
                cards: drawn,
                synthesis: synthesis,
                type: isCrown ? 'crown' : String(count),
                region: region,
                remaining: room.deck.length,
                timestamp: Date.now()
            };

            room.deckHistory = room.deckHistory || [];
            room.deckHistory.push({
                cards: drawn.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                synthesis: typeof synthesis === 'string' ? synthesis : (synthesis?.synthesis || synthesis),
                type: isCrown ? 'Crown Spread' : `${count} Draw${count > 1 ? 's' : ''}`,
                timestamp: Date.now()
            });

            if (room.deckHistory.length > 100) {
                room.deckHistory = room.deckHistory.slice(-100);
            }

            room.lastActivity = Date.now();

            const roomCode = req.params.code.toUpperCase();
            broadcastToRoom(roomCode, 'deck-drawn', result);

            logInfo('Cards drawn via API', { room: roomCode, count, region });
            res.json({
                success: true,
                code: roomCode,
                ...result,
                deliveredTo: room.clients.size + (wsClients.has(roomCode) ? wsClients.get(roomCode).size : 0)
            });
        }).catch(err => {
            logError('Error processing draw via API', { error: err.message });
            const result = {
                cards: drawn,
                synthesis: drawn.map(c => `A complication arises.`).join('\n\n'),
                type: String(count),
                region: region,
                remaining: room.deck.length,
                timestamp: Date.now()
            };

            room.deckHistory = room.deckHistory || [];
            room.deckHistory.push({
                cards: drawn.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                synthesis: result.synthesis,
                type: `${count} Draw${count > 1 ? 's' : ''}`,
                timestamp: Date.now()
            });

            room.lastActivity = Date.now();

            const roomCode = req.params.code.toUpperCase();
            broadcastToRoom(roomCode, 'deck-drawn', result);

            res.json({
                success: true,
                code: roomCode,
                ...result,
                deliveredTo: room.clients.size + (wsClients.has(roomCode) ? wsClients.get(roomCode).size : 0)
            });
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.post('/api/rooms/:code/deck/crown', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const { region = 'Acasia' } = req.body;

        if (!room.deck || room.deck.length < 5) {
            room.deck = buildDeck();
        }

        const cards = [];
        for (let i = 0; i < 5; i++) {
            if (room.deck.length === 0) {
                room.deck = buildDeck();
            }
            cards.push(room.deck.pop());
        }

        const mainCards = cards.slice(0, 4);
        const wildcard = cards[4];

        loadRegionData(region).then(regionData => {
            const result = synthesiseCrownSpread(mainCards, wildcard, regionData);

            room.deckHistory = room.deckHistory || [];
            room.deckHistory.push({
                cards: cards.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                synthesis: result.synthesis,
                type: 'Crown Spread',
                timestamp: Date.now()
            });

            room.lastActivity = Date.now();

            const response = {
                success: true,
                code: req.params.code.toUpperCase(),
                cards: cards,
                mainCards: mainCards,
                wildcard: wildcard,
                result: result,
                remaining: room.deck.length,
                timestamp: Date.now()
            };

            const roomCode = req.params.code.toUpperCase();
            broadcastToRoom(roomCode, 'crown-spread', response);
            logInfo('Crown spread via API', { room: roomCode });
            res.json(response);
        }).catch(err => {
            logError('Error processing crown spread via API', { error: err.message });
            res.status(500).json({ error: 'Failed to process crown spread: ' + err.message });
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.get('/api/rooms/:code/deck/history', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const limit = parseInt(req.query.limit) || 50;
        const history = (room.deckHistory || []).slice(-limit);

        res.json({
            code: req.params.code.toUpperCase(),
            name: room.name,
            history: history,
            count: history.length,
            total: room.deckHistory?.length || 0
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.delete('/api/rooms/:code/deck/history', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        room.deckHistory = [];
        room.lastActivity = Date.now();

        const roomCode = req.params.code.toUpperCase();
        broadcastToRoom(roomCode, 'deck-history-cleared', {
            source: 'api',
            timestamp: Date.now()
        });

        logInfo('Deck history cleared via API', { room: roomCode });
        res.json({
            success: true,
            code: roomCode,
            message: 'Deck history cleared'
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.get('/api/modules', authenticate, (req, res) => {
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
                    } catch (e) {
                        logWarn('Invalid module manifest', { module: item, error: e.message });
                    }
                }
            }
        }
    }

    res.json({
        modules: modules,
        count: modules.length,
        timestamp: Date.now()
    });
});

app.post('/api/modules/:id/push', authenticate, (req, res) => {
    try {
        const moduleId = req.params.id;
        const { roomCode } = req.body;
        const modulesPath = path.join(__dirname, 'modules', moduleId);

        if (!fs.existsSync(modulesPath)) {
            return res.status(404).json({ error: 'Module not found' });
        }

        const manifestPath = path.join(modulesPath, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            return res.status(404).json({ error: 'Module manifest not found' });
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const moduleData = {
            id: moduleId,
            manifest: manifest,
            files: {}
        };

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
            const room = getRoom(roomCode);
            const roomKey = roomCode.toUpperCase();
            broadcastToRoom(roomKey, 'module-push', {
                source: 'api',
                module: moduleData,
                timestamp: Date.now(),
                pushedBy: req.apiKeyData.name
            });
            logInfo('Module pushed to room', { module: moduleId, room: roomKey });
            res.json({
                success: true,
                module: moduleId,
                room: roomKey,
                clients: room.clients.size + (wsClients.has(roomKey) ? wsClients.get(roomKey).size : 0),
                message: `Module ${manifest.name} pushed to room ${roomKey}`
            });
        } else {
            let totalClients = 0;
            for (const [code, room] of rooms) {
                const clientCount = room.clients.size + (wsClients.has(code) ? wsClients.get(code).size : 0);
                if (clientCount > 0) {
                    broadcastToRoom(code, 'module-push', {
                        source: 'api',
                        module: moduleData,
                        timestamp: Date.now(),
                        pushedBy: req.apiKeyData.name
                    });
                    totalClients += clientCount;
                }
            }
            logInfo('Module pushed to all rooms', { module: moduleId, rooms: rooms.size, clients: totalClients });
            res.json({
                success: true,
                module: moduleId,
                rooms: rooms.size,
                clients: totalClients,
                message: `Module ${manifest.name} pushed to all rooms`
            });
        }
    } catch (err) {
        logError('Error pushing module', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/modules/:id/cleanup', authenticate, (req, res) => {
    try {
        const moduleId = req.params.id;
        const { roomCode } = req.body;

        if (roomCode) {
            const room = getRoom(roomCode);
            const roomKey = roomCode.toUpperCase();
            broadcastToRoom(roomKey, 'module-cleanup', {
                source: 'api',
                moduleId: moduleId,
                timestamp: Date.now(),
                cleanedBy: req.apiKeyData.name
            });
            logInfo('Module cleanup requested for room', { module: moduleId, room: roomKey });
            res.json({
                success: true,
                module: moduleId,
                room: roomKey,
                message: `Module ${moduleId} cleanup requested for room ${roomKey}`
            });
        } else {
            let totalClients = 0;
            for (const [code, room] of rooms) {
                const clientCount = room.clients.size + (wsClients.has(code) ? wsClients.get(code).size : 0);
                if (clientCount > 0) {
                    broadcastToRoom(code, 'module-cleanup', {
                        source: 'api',
                        moduleId: moduleId,
                        timestamp: Date.now(),
                        cleanedBy: req.apiKeyData.name
                    });
                    totalClients += clientCount;
                }
            }
            logInfo('Module cleanup requested for all rooms', { module: moduleId, rooms: rooms.size });
            res.json({
                success: true,
                module: moduleId,
                rooms: rooms.size,
                clients: totalClients,
                message: `Module ${moduleId} cleanup requested for all rooms`
            });
        }
    } catch (err) {
        logError('Error cleaning up module', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/docs', (req, res) => {
    res.json({
        title: "Fate's Edge API Documentation",
        version: "1.0.0",
        description: "API for managing deck draws and module distribution in Fate's Edge",
        endpoints: {
            health: {
                get: 'GET /api/health - Server health check with stats'
            },
            rooms: {
                get: 'GET /api/rooms - List all rooms with stats'
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
        },
        websocket_events: {
            connection: 'Connect to Socket.io or plain WebSocket',
            'join-room': 'Join a room: { roomCode, playerName } (Socket.io only)',
            'deck-draw': 'Draw cards: { count: 1, region: "Acasia" }',
            'deck-shuffle': 'Shuffle the deck: {}',
            'crown-spread': 'Draw a Crown Spread: { region: "Acasia" }',
            'deck-history': 'Get deck history: {}',
            'deck-history-clear': 'Clear deck history: {}',
            'module-push-request': 'Request module push: { moduleId: "my-module" }',
            'module-cleanup-request': 'Request module cleanup: { moduleId: "my-module" }',
            'module-list': 'List available modules: {}'
        },
        connections: {
            'socket.io': 'Use Socket.io client with http://localhost:PORT',
            'plain-websocket': 'Use standard WebSocket with ws://localhost:PORT?room=ROOM_CODE'
        }
    });
});

// ============================================================
// CREATE SERVER
// ============================================================

let io = null;
let wss = null;
let webServer = null;

async function findAvailablePort(ports) {
    for (const port of ports) {
        try {
            await new Promise((resolve, reject) => {
                const testServer = require('net').createServer();
                testServer.once('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        resolve(false);
                    } else {
                        reject(err);
                    }
                });
                testServer.once('listening', () => {
                    testServer.close();
                    resolve(true);
                });
                testServer.listen(port, '0.0.0.0');
            });
            return port;
        } catch (err) {
            // Continue to next port
        }
    }
    return null;
}

async function startServers() {
    const webPorts = process.env.WEB_PORTS ? 
        process.env.WEB_PORTS.split(',').map(Number) : 
        [80, 443, 3000, 8080, 8443, 10000];
    
    const webPort = await findAvailablePort(webPorts);
    if (!webPort) {
        logError('No available web ports found', { ports: webPorts });
        process.exit(1);
    }
    
    process.env.WEB_PORT = webPort;
    
    const useSSL = webPort === 443 || process.env.USE_SSL === 'true';
    let sslOptions = null;
    
    if (useSSL) {
        try {
            const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'cert.pem');
            const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'key.pem');
            
            if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
                sslOptions = {
                    cert: fs.readFileSync(certPath),
                    key: fs.readFileSync(keyPath)
                };
                logInfo('SSL certificates loaded', { cert: certPath, key: keyPath });
            } else {
                logWarn('SSL certificates not found, using HTTP', { cert: certPath, key: keyPath });
            }
        } catch (err) {
            logWarn('Error loading SSL certificates', { error: err.message });
        }
    }
    
    try {
        if (sslOptions) {
            webServer = https.createServer(sslOptions, app);
        } else {
            webServer = http.createServer(app);
        }
        
        webServer.listen(webPort, '0.0.0.0', () => {
            const protocol = sslOptions ? 'https' : 'http';
            logInfo(`🌐 Web interface running on ${protocol}://localhost:${webPort}`);
            logInfo(`📊 API available at ${protocol}://localhost:${webPort}/api/health`);
            logInfo(`📚 API Docs at ${protocol}://localhost:${webPort}/api/docs`);
        });
    } catch (err) {
        logError('Failed to start web server', { error: err.message, port: webPort });
        process.exit(1);
    }
    
    io = socketIo(webServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            credentials: true
        },
        transports: ['websocket', 'polling']
    });
    global.io = io;
    
    wss = new WebSocket.Server({ 
        server: webServer,
        path: '/' 
    });
    
    logInfo('WebSocket servers initialized', { 
        socketIO: true, 
        plainWS: true,
        webPort: webPort
    });
    
    setupWebSocketHandlers();
    setupSocketIOHandlers();
    
    console.log('\n' + '='.repeat(70));
    console.log(`🎯 Fate's Edge WebSocket Server v1.0.0`);
    console.log('='.repeat(70));
    console.log(`🌐 Web Interface: http://localhost:${webPort}`);
    console.log(`📊 Health: http://localhost:${webPort}/api/health`);
    console.log(`📚 API Docs: http://localhost:${webPort}/api/docs`);
    console.log(`🔌 WebSocket: ws://localhost:${webPort}?room=ROOM_CODE`);
    console.log(`🔌 Socket.io: http://localhost:${webPort}`);
    console.log(`📋 Rooms: ${rooms.size}`);
    console.log(`📊 Log Level: ${LOG_LEVEL}`);
    console.log('='.repeat(70));
    console.log('✅ Server ready for connections\n');
    
    setInterval(() => {
        const totalClients = socketStats.socketIOConnections + socketStats.wsConnections;
        if (totalClients > 0 || rooms.size > 0) {
            logInfo('📊 Server stats', {
                rooms: rooms.size,
                socketIO: socketStats.socketIOConnections,
                plainWS: socketStats.wsConnections,
                totalClients: totalClients,
                uptime: Math.floor((Date.now() - socketStats.startTime) / 1000) + 's',
                webPort: webPort
            });
        }
    }, 30000);
}

// ============================================================
// WEBSOCKET HANDLERS
// ============================================================

function setupWebSocketHandlers() {
    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const room = url.searchParams.get('room') || 'default';
        const roomKey = room.toUpperCase();
        const clientId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        logInfo('🔌 Plain WebSocket client connected', { 
            clientId, 
            room: roomKey,
            ip: req.socket.remoteAddress
        });
        
        if (!wsClients.has(roomKey)) {
            wsClients.set(roomKey, new Set());
        }
        wsClients.get(roomKey).add(ws);
        ws.clientId = clientId;
        ws.room = roomKey;
        socketStats.wsConnections++;
        socketStats.totalConnections++;
        
        const welcomeMessage = {
            type: 'connected',
            clientId: clientId,
            room: roomKey,
            timestamp: Date.now(),
            message: 'Connected to Fate\'s Edge WebSocket server'
        };
        ws.send(JSON.stringify(welcomeMessage));
        
        let roomState = rooms.get(roomKey);
        if (!roomState) {
            roomState = {
                name: `Room ${roomKey}`,
                code: roomKey,
                clients: new Map(),
                deck: buildDeck(),
                deckHistory: [],
                deckOffset: Math.floor(Math.random() * 1000),
                lastActivity: Date.now(),
                created: Date.now()
            };
            rooms.set(roomKey, roomState);
            logInfo('📋 Room created', { room: roomKey });
        }
        
        ws.send(JSON.stringify({
            type: 'room-state',
            room: roomKey,
            deckRemaining: roomState.deck?.length || 0,
            historyCount: roomState.deckHistory?.length || 0,
            timestamp: Date.now()
        }));
        
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                handlePlainWSMessage(ws, roomKey, data);
            } catch (error) {
                logError('Error parsing plain WS message', { error: error.message });
            }
        });
        
        ws.on('close', () => {
            logInfo('🔌 Plain WebSocket client disconnected', { clientId, room: roomKey });
            if (wsClients.has(roomKey)) {
                wsClients.get(roomKey).delete(ws);
                if (wsClients.get(roomKey).size === 0) {
                    wsClients.delete(roomKey);
                }
            }
            socketStats.wsConnections--;
        });
        
        ws.on('error', (error) => {
            logError('Plain WS error', { clientId, room: roomKey, error: error.message });
        });
    });
}

function handlePlainWSMessage(ws, roomKey, data) {
    const type = data.type || 'unknown';
    logDebug('Plain WS message received', { room: roomKey, type });
    
    switch(type) {
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
        case 'deck-draw':
            handlePlainWSDeckDraw(ws, roomKey, data);
            break;
        case 'deck-shuffle':
            handlePlainWSDeckShuffle(ws, roomKey);
            break;
        case 'crown-spread':
            handlePlainWSCrownSpread(ws, roomKey, data);
            break;
        case 'deck-history':
            handlePlainWSDeckHistory(ws, roomKey);
            break;
        case 'deck-history-clear':
            handlePlainWSDeckHistoryClear(ws, roomKey);
            break;
        default:
            ws.send(JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${type}`
            }));
    }
}

// ============================================================
// PLAIN WEBSOCKET HANDLER FUNCTIONS
// ============================================================

async function handlePlainWSDeckDraw(ws, roomKey, data) {
    try {
        let room = rooms.get(roomKey);
        if (!room) {
            room = {
                name: `Room ${roomKey}`,
                code: roomKey,
                clients: new Map(),
                deck: buildDeck(),
                deckHistory: [],
                deckOffset: Math.floor(Math.random() * 1000),
                lastActivity: Date.now(),
                created: Date.now()
            };
            rooms.set(roomKey, room);
            logInfo('📋 Room created via plain WS', { room: roomKey });
        }
        
        const { count = 1, region = 'Acasia' } = data;
        
        if (!room.deck || room.deck.length === 0) {
            room.deck = buildDeck();
        }
        
        if (room.deck.length < count) {
            room.deck = buildDeck();
        }
        
        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (room.deck.length === 0) {
                room.deck = buildDeck();
            }
            drawn.push(room.deck.pop());
        }
        
        const regionData = await loadRegionData(region);
        const isCrown = count === 5;
        let synthesis;
        
        if (isCrown) {
            const mainCards = drawn.slice(0, 4);
            const wildcard = drawn[4];
            synthesis = synthesiseCrownSpread(mainCards, wildcard, regionData);
        } else {
            synthesis = synthesiseConsequence(drawn, regionData);
        }
        
        const result = {
            type: 'deck-drawn',
            cards: drawn,
            synthesis: synthesis,
            cardCount: count,
            region: region,
            remaining: room.deck.length,
            timestamp: Date.now()
        };
        
        room.deckHistory = room.deckHistory || [];
        room.deckHistory.push({
            cards: drawn.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
            synthesis: typeof synthesis === 'string' ? synthesis : (synthesis?.synthesis || synthesis),
            type: isCrown ? 'Crown Spread' : `${count} Draw${count > 1 ? 's' : ''}`,
            timestamp: Date.now()
        });
        
        if (room.deckHistory.length > 100) {
            room.deckHistory = room.deckHistory.slice(-100);
        }
        
        room.lastActivity = Date.now();
        
        broadcastToRoom(roomKey, 'deck-drawn', result);
        
        ws.send(JSON.stringify({
            type: 'deck-drawn-success',
            ...result
        }));
        
        logInfo('Cards drawn via plain WS', { room: roomKey, count, region });
        
    } catch (error) {
        logError('Error in plain WS deck draw', { room: roomKey, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to draw cards: ' + error.message
        }));
    }
}

function handlePlainWSDeckShuffle(ws, roomKey) {
    try {
        let room = rooms.get(roomKey);
        if (!room) {
            room = {
                name: `Room ${roomKey}`,
                code: roomKey,
                clients: new Map(),
                deck: buildDeck(),
                deckHistory: [],
                deckOffset: Math.floor(Math.random() * 1000),
                lastActivity: Date.now(),
                created: Date.now()
            };
            rooms.set(roomKey, room);
            logInfo('📋 Room created via plain WS', { room: roomKey });
        }
        
        room.deck = buildDeck();
        room.deckOffset = Math.floor(Math.random() * 1000);
        room.lastActivity = Date.now();
        
        broadcastToRoom(roomKey, 'deck-shuffled', {
            remaining: room.deck.length,
            timestamp: Date.now()
        });
        
        ws.send(JSON.stringify({
            type: 'deck-shuffled-success',
            remaining: room.deck.length,
            timestamp: Date.now()
        }));
        
        logInfo('Deck shuffled via plain WS', { room: roomKey });
        
    } catch (error) {
        logError('Error in plain WS deck shuffle', { room: roomKey, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to shuffle deck: ' + error.message
        }));
    }
}

async function handlePlainWSCrownSpread(ws, roomKey, data) {
    try {
        let room = rooms.get(roomKey);
        if (!room) {
            room = {
                name: `Room ${roomKey}`,
                code: roomKey,
                clients: new Map(),
                deck: buildDeck(),
                deckHistory: [],
                deckOffset: Math.floor(Math.random() * 1000),
                lastActivity: Date.now(),
                created: Date.now()
            };
            rooms.set(roomKey, room);
            logInfo('📋 Room created via plain WS', { room: roomKey });
        }
        
        const { region = 'Acasia' } = data;
        
        if (!room.deck || room.deck.length < 5) {
            room.deck = buildDeck();
        }
        
        const cards = [];
        for (let i = 0; i < 5; i++) {
            if (room.deck.length === 0) {
                room.deck = buildDeck();
            }
            cards.push(room.deck.pop());
        }
        
        const mainCards = cards.slice(0, 4);
        const wildcard = cards[4];
        
        const regionData = await loadRegionData(region);
        const result = synthesiseCrownSpread(mainCards, wildcard, regionData);
        
        room.deckHistory = room.deckHistory || [];
        room.deckHistory.push({
            cards: cards.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
            synthesis: result.synthesis,
            type: 'Crown Spread',
            timestamp: Date.now()
        });
        
        room.lastActivity = Date.now();
        
        const response = {
            type: 'crown-spread',
            cards: cards,
            mainCards: mainCards,
            wildcard: wildcard,
            result: result,
            remaining: room.deck.length,
            timestamp: Date.now()
        };
        
        broadcastToRoom(roomKey, 'crown-spread', response);
        
        ws.send(JSON.stringify({
            type: 'crown-spread-success',
            ...response
        }));
        
        logInfo('Crown spread via plain WS', { room: roomKey });
        
    } catch (error) {
        logError('Error in plain WS crown spread', { room: roomKey, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process crown spread: ' + error.message
        }));
    }
}

function handlePlainWSDeckHistory(ws, roomKey) {
    try {
        const room = rooms.get(roomKey);
        if (!room) {
            ws.send(JSON.stringify({
                type: 'deck-history',
                history: [],
                count: 0,
                total: 0
            }));
            return;
        }
        
        const history = (room.deckHistory || []).slice(-50);
        ws.send(JSON.stringify({
            type: 'deck-history',
            history: history,
            count: history.length,
            total: room.deckHistory?.length || 0
        }));
        
    } catch (error) {
        logError('Error in plain WS deck history', { room: roomKey, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to get deck history: ' + error.message
        }));
    }
}

function handlePlainWSDeckHistoryClear(ws, roomKey) {
    try {
        const room = rooms.get(roomKey);
        if (!room) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Room not found'
            }));
            return;
        }
        
        room.deckHistory = [];
        room.lastActivity = Date.now();
        
        broadcastToRoom(roomKey, 'deck-history-cleared', {
            timestamp: Date.now()
        });
        
        ws.send(JSON.stringify({
            type: 'deck-history-cleared-success',
            timestamp: Date.now()
        }));
        
        logInfo('Deck history cleared via plain WS', { room: roomKey });
        
    } catch (error) {
        logError('Error in plain WS deck history clear', { room: roomKey, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to clear deck history: ' + error.message
        }));
    }
}

// ============================================================
// SOCKET.IO HANDLERS (COMPLETE - SINGLE VERSION)
// ============================================================

function setupSocketIOHandlers() {
    io.on('connection', (socket) => {
        socketStats.socketIOConnections++;
        socketStats.totalConnections++;
        
        logInfo('🔌 Socket.io client connected', { 
            socketId: socket.id,
            ip: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent']
        });

        socket.clientData = {
            name: 'Player',
            room: null
        };

        // ============================================================
        // ROOM MANAGEMENT
        // ============================================================

        socket.on('join-room', (data, callback) => {
            const { roomCode, playerName } = data;

            if (!roomCode || !validateRoomCode(roomCode)) {
                logWarn('Invalid room code', { socketId: socket.id, roomCode });
                if (typeof callback === 'function') {
                    callback({ error: 'Invalid room code' });
                }
                socket.emit('error', { message: 'Invalid room code' });
                return;
            }

            const roomKey = roomCode.toUpperCase();

            if (socket.room) {
                socket.leave(socket.room);
                const oldRoom = rooms.get(socket.room);
                if (oldRoom) {
                    oldRoom.clients.delete(socket.id);
                    io.to(socket.room).emit('player-left', {
                        clientId: socket.id,
                        clientName: socket.clientData?.name || 'Player',
                        clients: Array.from(oldRoom.clients.entries()).map(([id, name]) => ({ id, name }))
                    });
                }
            }

            let room = rooms.get(roomKey);
            if (!room) {
                room = {
                    name: `Room ${roomKey}`,
                    code: roomKey,
                    clients: new Map(),
                    deck: buildDeck(),
                    deckHistory: [],
                    deckOffset: Math.floor(Math.random() * 1000),
                    lastActivity: Date.now(),
                    created: Date.now()
                };
                rooms.set(roomKey, room);
                logInfo('📋 Room created via Socket.io', { room: roomKey });
            }

            socket.join(roomKey);
            socket.room = roomKey;
            socket.clientData.name = playerName || 'Player';
            room.clients.set(socket.id, socket.clientData.name);
            room.lastActivity = Date.now();

            const roomState = {
                room: roomKey,
                clients: Array.from(room.clients.entries()).map(([id, name]) => ({ id, name })),
                deckRemaining: room.deck.length,
                deckHistory: room.deckHistory.slice(-20),
                totalClients: room.clients.size + (wsClients.has(roomKey) ? wsClients.get(roomKey).size : 0)
            };
            
            socket.emit('room-joined', roomState);
            
            if (typeof callback === 'function') {
                callback({ success: true, ...roomState });
            }
            
            logInfo('👤 Player joined room via Socket.io', { 
                socketId: socket.id, 
                room: roomKey, 
                name: socket.clientData.name,
                totalClients: roomState.totalClients
            });

            io.to(roomKey).emit('player-joined', {
                clientId: socket.id,
                clientName: socket.clientData.name,
                clients: Array.from(room.clients.entries()).map(([id, name]) => ({ id, name }))
            });
        });

        socket.on('leave-room', (data, callback) => {
            if (!socket.room) {
                if (typeof callback === 'function') {
                    callback({ error: 'Not in a room' });
                }
                return;
            }
            
            const roomKey = socket.room;
            const room = rooms.get(roomKey);
            
            if (room) {
                room.clients.delete(socket.id);
                socket.leave(roomKey);
                
                io.to(roomKey).emit('player-left', {
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    clients: Array.from(room.clients.entries()).map(([id, name]) => ({ id, name }))
                });
                
                const remainingClients = room.clients.size + (wsClients.has(roomKey) ? wsClients.get(roomKey).size : 0);
                if (remainingClients === 0) {
                    rooms.delete(roomKey);
                    logInfo('🗑️ Room deleted (empty)', { room: roomKey });
                }
                
                socket.room = null;
                logInfo('👤 Player left room via Socket.io', { 
                    socketId: socket.id, 
                    room: roomKey, 
                    name: socket.clientData?.name || 'Player'
                });
                
                if (typeof callback === 'function') {
                    callback({ success: true, room: roomKey });
                }
            }
        });

        // ============================================================
        // DECK OPERATIONS
        // ============================================================

        socket.on('deck-draw', async (data, callback) => {
            if (!socket.room) {
                socket.emit('error', { message: 'Not in a room' });
                if (typeof callback === 'function') {
                    callback({ error: 'Not in a room' });
                }
                return;
            }

            try {
                const room = rooms.get(socket.room);
                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    if (typeof callback === 'function') {
                        callback({ error: 'Room not found' });
                    }
                    return;
                }

                const { count = 1, region = 'Acasia' } = data || {};

                if (!room.deck || room.deck.length === 0) {
                    room.deck = buildDeck();
                }

                if (room.deck.length < count) {
                    room.deck = buildDeck();
                }

                const drawn = [];
                for (let i = 0; i < count; i++) {
                    if (room.deck.length === 0) {
                        room.deck = buildDeck();
                    }
                    drawn.push(room.deck.pop());
                }

                const regionData = await loadRegionData(region);
                const isCrown = count === 5;
                let synthesis;

                if (isCrown) {
                    const mainCards = drawn.slice(0, 4);
                    const wildcard = drawn[4];
                    synthesis = synthesiseCrownSpread(mainCards, wildcard, regionData);
                } else {
                    synthesis = synthesiseConsequence(drawn, regionData);
                }

                const result = {
                    cards: drawn,
                    synthesis: synthesis,
                    type: isCrown ? 'crown' : String(count),
                    region: region,
                    remaining: room.deck.length,
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                };

                room.deckHistory = room.deckHistory || [];
                room.deckHistory.push({
                    cards: drawn.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                    synthesis: typeof synthesis === 'string' ? synthesis : (synthesis?.synthesis || synthesis),
                    type: isCrown ? 'Crown Spread' : `${count} Draw${count > 1 ? 's' : ''}`,
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                });

                if (room.deckHistory.length > 100) {
                    room.deckHistory = room.deckHistory.slice(-100);
                }

                room.lastActivity = Date.now();
                
                broadcastToRoom(socket.room, 'deck-drawn', result);
                
                if (typeof callback === 'function') {
                    callback({ success: true, ...result });
                }
                
                logInfo('Cards drawn via Socket.io', { 
                    room: socket.room, 
                    count, 
                    region,
                    client: socket.clientData?.name
                });

            } catch (error) {
                logError('Error in Socket.io deck draw', { 
                    room: socket.room, 
                    error: error.message 
                });
                socket.emit('error', { message: error.message });
                if (typeof callback === 'function') {
                    callback({ error: error.message });
                }
            }
        });

        socket.on('deck-shuffle', (callback) => {
            if (!socket.room) {
                socket.emit('error', { message: 'Not in a room' });
                if (typeof callback === 'function') {
                    callback({ error: 'Not in a room' });
                }
                return;
            }

            const room = rooms.get(socket.room);
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                if (typeof callback === 'function') {
                    callback({ error: 'Room not found' });
                }
                return;
            }

            room.deck = buildDeck();
            room.deckOffset = Math.floor(Math.random() * 1000);
            room.lastActivity = Date.now();

            const result = {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                remaining: room.deck.length,
                timestamp: Date.now()
            };

            broadcastToRoom(socket.room, 'deck-shuffled', result);
            
            if (typeof callback === 'function') {
                callback({ success: true, ...result });
            }
            
            logInfo('Deck shuffled via Socket.io', { 
                room: socket.room,
                client: socket.clientData?.name
            });
        });

        socket.on('deck-history', (callback) => {
            if (!socket.room) {
                if (typeof callback === 'function') {
                    callback({ error: 'Not in a room' });
                }
                return;
            }

            const room = rooms.get(socket.room);
            if (!room) {
                if (typeof callback === 'function') {
                    callback({ error: 'Room not found' });
                }
                return;
            }

            const history = (room.deckHistory || []).slice(-50);
            if (typeof callback === 'function') {
                callback({
                    history: history,
                    count: history.length,
                    total: room.deckHistory?.length || 0
                });
            }
        });

        socket.on('deck-history-clear', (callback) => {
            if (!socket.room) {
                socket.emit('error', { message: 'Not in a room' });
                if (typeof callback === 'function') {
                    callback({ error: 'Not in a room' });
                }
                return;
            }

            const room = rooms.get(socket.room);
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                if (typeof callback === 'function') {
                    callback({ error: 'Room not found' });
                }
                return;
            }

            room.deckHistory = [];
            room.lastActivity = Date.now();

            const result = {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                timestamp: Date.now()
            };

            broadcastToRoom(socket.room, 'deck-history-cleared', result);
            
            if (typeof callback === 'function') {
                callback({ success: true, ...result });
            }
            
            logInfo('Deck history cleared via Socket.io', { 
                room: socket.room,
                client: socket.clientData?.name
            });
        });

        socket.on('crown-spread', async (data, callback) => {
            if (!socket.room) {
                socket.emit('error', { message: 'Not in a room' });
                if (typeof callback === 'function') {
                    callback({ error: 'Not in a room' });
                }
                return;
            }

            try {
                const room = rooms.get(socket.room);
                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    if (typeof callback === 'function') {
                        callback({ error: 'Room not found' });
                    }
                    return;
                }

                const { region = 'Acasia' } = data || {};

                if (!room.deck || room.deck.length < 5) {
                    room.deck = buildDeck();
                }

                const cards = [];
                for (let i = 0; i < 5; i++) {
                    if (room.deck.length === 0) {
                        room.deck = buildDeck();
                    }
                    cards.push(room.deck.pop());
                }

                const mainCards = cards.slice(0, 4);
                const wildcard = cards[4];

                const regionData = await loadRegionData(region);
                const result = synthesiseCrownSpread(mainCards, wildcard, regionData);

                room.deckHistory = room.deckHistory || [];
                room.deckHistory.push({
                    cards: cards.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                    synthesis: result.synthesis,
                    type: 'Crown Spread',
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                });

                room.lastActivity = Date.now();

                const response = {
                    success: true,
                    cards: cards,
                    mainCards: mainCards,
                    wildcard: wildcard,
                    result: result,
                    remaining: room.deck.length,
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                };

                broadcastToRoom(socket.room, 'crown-spread', response);
                
                if (typeof callback === 'function') {
                    callback(response);
                }
                
                logInfo('Crown spread via Socket.io', { 
                    room: socket.room,
                    client: socket.clientData?.name
                });

            } catch (error) {
                logError('Error in Socket.io crown spread', { 
                    room: socket.room, 
                    error: error.message 
                });
                socket.emit('error', { message: 'Failed to process crown spread: ' + error.message });
                if (typeof callback === 'function') {
                    callback({ error: error.message });
                }
            }
        });

        // ============================================================
        // MODULE MANAGEMENT
        // ============================================================

        socket.on('module-push-request', (data, callback) => {
            const { moduleId } = data || {};
            if (!moduleId) {
                if (typeof callback === 'function') {
                    callback({ error: 'Module ID required' });
                }
                return;
            }

            const modulesPath = path.join(__dirname, 'modules', moduleId);

            if (!fs.existsSync(modulesPath)) {
                if (typeof callback === 'function') {
                    callback({ error: 'Module not found' });
                }
                return;
            }

            const manifestPath = path.join(modulesPath, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                if (typeof callback === 'function') {
                    callback({ error: 'Module manifest not found' });
                }
                return;
            }

            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                const moduleData = {
                    id: moduleId,
                    manifest: manifest,
                    files: {}
                };

                const files = fs.readdirSync(modulesPath);
                for (const file of files) {
                    if (file !== 'manifest.json') {
                        const filePath = path.join(modulesPath, file);
                        if (fs.statSync(filePath).isFile()) {
                            moduleData.files[file] = fs.readFileSync(filePath, 'utf-8');
                        }
                    }
                }

                if (socket.room) {
                    broadcastToRoom(socket.room, 'module-push', {
                        source: socket.id,
                        clientName: socket.clientData?.name || 'Player',
                        module: moduleData,
                        timestamp: Date.now()
                    });
                }

                if (typeof callback === 'function') {
                    callback({ success: true, module: moduleData });
                }
                
                logInfo('Module push requested via Socket.io', { 
                    moduleId,
                    room: socket.room || 'none',
                    client: socket.clientData?.name
                });
            } catch (error) {
                logError('Error in module push request', { moduleId, error: error.message });
                if (typeof callback === 'function') {
                    callback({ error: error.message });
                }
            }
        });

        socket.on('module-cleanup-request', (data, callback) => {
            const { moduleId } = data || {};
            if (!moduleId) {
                if (typeof callback === 'function') {
                    callback({ error: 'Module ID required' });
                }
                return;
            }

            if (socket.room) {
                broadcastToRoom(socket.room, 'module-cleanup', {
                    moduleId: moduleId,
                    source: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                });
            }

            if (typeof callback === 'function') {
                callback({ success: true, moduleId: moduleId });
            }
            
            logInfo('Module cleanup requested via Socket.io', { 
                moduleId,
                room: socket.room || 'none',
                client: socket.clientData?.name
            });
        });

        socket.on('module-list', (callback) => {
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
                            } catch (e) {
                                logWarn('Invalid module manifest', { module: item, error: e.message });
                            }
                        }
                    }
                }
            }

            if (typeof callback === 'function') {
                callback({
                    modules: modules,
                    count: modules.length,
                    timestamp: Date.now()
                });
            }
        });

        // ============================================================
        // CHAT AND ROLLS
        // ============================================================

        socket.on('chat-message', (data, callback) => {
            if (!socket.room) {
                socket.emit('error', { message: 'Not in a room' });
                if (typeof callback === 'function') {
                    callback({ error: 'Not in a room' });
                }
                return;
            }

            const message = {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                message: data.message || data,
                timestamp: Date.now(),
                room: socket.room
            };

            broadcastToRoom(socket.room, 'chat-message', message);
            
            if (typeof callback === 'function') {
                callback({ success: true, ...message });
            }
        });

        socket.on('roll-dice', (data, callback) => {
            if (!socket.room) {
                socket.emit('error', { message: 'Not in a room' });
                if (typeof callback === 'function') {
                    callback({ error: 'Not in a room' });
                }
                return;
            }

            const rollResult = {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                ...data,
                timestamp: Date.now(),
                room: socket.room
            };

            broadcastToRoom(socket.room, 'roll-result', rollResult);
            
            if (typeof callback === 'function') {
                callback({ success: true, ...rollResult });
            }
        });

        // ============================================================
        // VOICE CHAT
        // ============================================================

        socket.on('voice-offer', (data) => {
            if (!socket.room) return;
            socket.to(socket.room).emit('voice-offer', {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                ...data
            });
        });

        socket.on('voice-answer', (data) => {
            if (!socket.room) return;
            socket.to(socket.room).emit('voice-answer', {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                ...data
            });
        });

        socket.on('voice-ice-candidate', (data) => {
            if (!socket.room) return;
            socket.to(socket.room).emit('voice-ice-candidate', {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                ...data
            });
        });

        socket.on('voice-status', (data) => {
            if (!socket.room) return;
            socket.to(socket.room).emit('voice-status', {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                ...data
            });
        });

        // ============================================================
        // SYNC AND STATE
        // ============================================================

        socket.on('sync-state', (data, callback) => {
            if (!socket.room) {
                if (typeof callback === 'function') {
                    callback({ error: 'Not in a room' });
                }
                return;
            }

            const stateData = {
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                state: data,
                timestamp: Date.now(),
                room: socket.room
            };

            const room = rooms.get(socket.room);
            if (room) {
                room.lastState = data;
                room.lastActivity = Date.now();
            }

            broadcastToRoom(socket.room, 'state-updated', stateData);
            
            if (typeof callback === 'function') {
                callback({ success: true, ...stateData });
            }
        });

        socket.on('get-clients', (callback) => {
            if (!socket.room) {
                if (typeof callback === 'function') {
                    callback([]);
                }
                return;
            }

            const room = rooms.get(socket.room);
            if (!room) {
                if (typeof callback === 'function') {
                    callback([]);
                }
                return;
            }

            const clients = Array.from(room.clients.entries()).map(([id, name]) => ({ id, name }));
            
            if (typeof callback === 'function') {
                callback(clients);
            }
        });

        // ============================================================
        // DISCONNECT
        // ============================================================

        socket.on('disconnect', () => {
            socketStats.socketIOConnections--;
            
            if (socket.room) {
                const room = rooms.get(socket.room);
                if (room) {
                    room.clients.delete(socket.id);
                    io.to(socket.room).emit('player-left', {
                        clientId: socket.id,
                        clientName: socket.clientData?.name || 'Player',
                        clients: Array.from(room.clients.entries()).map(([id, name]) => ({ id, name }))
                    });
                    
                    const remainingClients = room.clients.size + (wsClients.has(socket.room) ? wsClients.get(socket.room).size : 0);
                    logInfo('👤 Player left room via Socket.io', { 
                        room: socket.room, 
                        name: socket.clientData?.name || 'Player',
                        remaining: remainingClients
                    });

                    if (remainingClients === 0) {
                        rooms.delete(socket.room);
                        logInfo('🗑️ Room deleted (empty)', { room: socket.room });
                    }
                }
            }
            
            logInfo('🔌 Socket.io client disconnected', { 
                socketId: socket.id,
                connections: socketStats.socketIOConnections
            });
        });
    });
}

// ============================================================
// CREATE PUBLIC DIRECTORY AND WEB INTERFACE
// ============================================================

function createWebInterface() {
    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const indexPath = path.join(publicDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fate's Edge - Server Dashboard</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #e0e0e0;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        header {
            text-align: center;
            padding: 30px 0;
            border-bottom: 2px solid rgba(255,255,255,0.1);
            margin-bottom: 30px;
        }
        h1 {
            font-size: 2.5rem;
            background: linear-gradient(135deg, #e94560, #f5a623);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #888;
            font-size: 1.1rem;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .status-card {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            text-align: center;
        }
        .status-card .label {
            font-size: 0.85rem;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .status-card .value {
            font-size: 2rem;
            font-weight: bold;
            margin: 10px 0;
            background: linear-gradient(135deg, #e94560, #f5a623);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .status-card .value.online { color: #4ade80; -webkit-text-fill-color: #4ade80; }
        .status-card .value.offline { color: #f87171; -webkit-text-fill-color: #f87171; }
        .status-card .detail {
            font-size: 0.8rem;
            color: #666;
        }
        .logs-container {
            background: rgba(0,0,0,0.3);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.05);
            margin-top: 30px;
        }
        .logs-container h2 {
            margin-bottom: 15px;
            color: #888;
            font-size: 1.2rem;
        }
        #logs {
            font-family: 'Courier New', monospace;
            font-size: 0.85rem;
            max-height: 400px;
            overflow-y: auto;
            background: rgba(0,0,0,0.3);
            padding: 15px;
            border-radius: 8px;
            line-height: 1.6;
        }
        #logs .log-entry {
            padding: 2px 0;
            border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        #logs .log-entry .time {
            color: #666;
            margin-right: 10px;
        }
        #logs .log-entry .level-info { color: #60a5fa; }
        #logs .log-entry .level-warn { color: #fbbf24; }
        #logs .log-entry .level-error { color: #f87171; }
        .actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin: 20px 0;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #e94560, #f5a623);
            color: white;
            cursor: pointer;
            font-size: 1rem;
            transition: transform 0.2s, opacity 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
            opacity: 0.9;
        }
        .btn.secondary {
            background: rgba(255,255,255,0.1);
        }
        .btn.danger {
            background: #f87171;
        }
        .room-selector {
            display: flex;
            gap: 10px;
            align-items: center;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        .room-selector input {
            padding: 10px 15px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.05);
            color: white;
            font-size: 1rem;
            flex: 1;
            min-width: 200px;
        }
        .room-selector input:focus {
            outline: none;
            border-color: #e94560;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .pulse {
            animation: pulse 2s infinite;
        }
        .badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: bold;
        }
        .badge.online { background: #4ade80; color: #1a1a2e; }
        .badge.offline { background: #f87171; color: #1a1a2e; }
        .badge.connecting { background: #fbbf24; color: #1a1a2e; animation: pulse 1s infinite; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🎯 Fate's Edge</h1>
            <p class="subtitle">WebSocket Server Dashboard</p>
        </header>
        
        <div class="status-grid">
            <div class="status-card">
                <div class="label">Server Status</div>
                <div class="value" id="serverStatus">●</div>
                <div class="detail" id="serverStatusText">Connecting...</div>
            </div>
            <div class="status-card">
                <div class="label">Connected Clients</div>
                <div class="value" id="clientCount">0</div>
                <div class="detail">Total connections</div>
            </div>
            <div class="status-card">
                <div class="label">Active Rooms</div>
                <div class="value" id="roomCount">0</div>
                <div class="detail">Rooms with activity</div>
            </div>
            <div class="status-card">
                <div class="label">Uptime</div>
                <div class="value" id="uptime">0s</div>
                <div class="detail">Server running</div>
            </div>
        </div>
        
        <div class="room-selector">
            <input type="text" id="roomInput" placeholder="Enter room code..." value="vtt-room">
            <button class="btn" onclick="joinRoom()">Join Room</button>
            <button class="btn secondary" onclick="leaveRoom()">Leave Room</button>
        </div>
        
        <div class="actions">
            <button class="btn" onclick="drawCard()">🃏 Draw Card</button>
            <button class="btn secondary" onclick="shuffleDeck()">🔀 Shuffle Deck</button>
            <button class="btn secondary" onclick="drawCrown()">👑 Crown Spread</button>
            <button class="btn danger" onclick="clearHistory()">🗑️ Clear History</button>
        </div>
        
        <div class="logs-container">
            <h2>📋 Real-time Logs</h2>
            <div id="logs">
                <div class="log-entry"><span class="time">[System]</span> <span class="level-info">Server ready, waiting for connections...</span></div>
            </div>
        </div>
    </div>
    
    <script>
        let socket = null;
        let roomCode = 'vtt-room';
        let isConnected = false;
        
        function addLog(message, level = 'info') {
            const logs = document.getElementById('logs');
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            const time = new Date().toLocaleTimeString();
            entry.innerHTML = \`<span class="time">[\${time}]</span> <span class="level-\${level}">\${message}</span>\`;
            logs.appendChild(entry);
            logs.scrollTop = logs.scrollHeight;
            if (logs.children.length > 100) {
                logs.removeChild(logs.firstChild);
            }
        }
        
        function updateStatus(status, text) {
            const el = document.getElementById('serverStatus');
            const textEl = document.getElementById('serverStatusText');
            el.className = 'value ' + status;
            el.textContent = status === 'online' ? '✅' : status === 'offline' ? '❌' : '⏳';
            textEl.textContent = text;
        }
        
        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
            const host = window.location.hostname;
            const port = window.location.port;
            const url = \`\${protocol}://\${host}:\${port}\`;
            
            addLog('Connecting to server at ' + url, 'info');
            updateStatus('connecting', 'Connecting...');
            
            socket = io(url, {
                transports: ['websocket', 'polling'],
                reconnection: true
            });
            
            socket.on('connect', () => {
                isConnected = true;
                addLog('✅ Connected to server', 'info');
                updateStatus('online', 'Connected');
                fetchStats();
                
                setTimeout(() => {
                    const room = document.getElementById('roomInput').value || 'vtt-room';
                    joinRoom(room);
                }, 500);
            });
            
            socket.on('disconnect', () => {
                isConnected = false;
                addLog('🔌 Disconnected from server', 'warn');
                updateStatus('offline', 'Disconnected');
            });
            
            socket.on('connect_error', (error) => {
                addLog('❌ Connection error: ' + error.message, 'error');
                updateStatus('offline', 'Connection error');
            });
            
            socket.on('error', (data) => {
                addLog('❌ Server error: ' + (data.message || 'Unknown error'), 'error');
            });
            
            socket.on('room-joined', (data) => {
                roomCode = data.room;
                addLog(\`🏠 Joined room: \${data.room} (\${data.clients.length} clients)\`, 'info');
                document.getElementById('roomInput').value = data.room;
                fetchStats();
            });
            
            socket.on('player-joined', (data) => {
                addLog(\`👤 Player \${data.clientName} joined (\${data.clients.length} total)\`, 'info');
                fetchStats();
            });
            
            socket.on('player-left', (data) => {
                addLog(\`👤 Player \${data.clientName} left (\${data.clients.length} remaining)\`, 'info');
                fetchStats();
            });
            
            socket.on('deck-drawn', (data) => {
                const cardNames = data.cards.map(c => c.isJoker ? '🃏 Joker' : \`\${c.rankName} of \${c.suitName}\`).join(', ');
                addLog(\`🃏 Cards drawn: \${cardNames} (\${data.remaining} remaining)\`, 'info');
                fetchStats();
            });
            
            socket.on('deck-shuffled', (data) => {
                addLog(\`🔀 Deck shuffled (\${data.remaining} cards)\`, 'info');
                fetchStats();
            });
            
            socket.on('crown-spread', (data) => {
                addLog(\`👑 Crown spread drawn (\${data.remaining} remaining)\`, 'info');
                fetchStats();
            });
            
            socket.on('deck-history-cleared', () => {
                addLog('🗑️ Deck history cleared', 'warn');
            });
            
            socket.on('module-push', (data) => {
                addLog(\`📦 Module pushed: \${data.module?.manifest?.name || 'unknown'}\`, 'info');
            });
            
            socket.on('module-cleanup', (data) => {
                addLog(\`🧹 Module cleaned up: \${data.moduleId || 'unknown'}\`, 'info');
            });
        }
        
        function fetchStats() {
            fetch('/api/health')
                .then(res => res.json())
                .then(data => {
                    document.getElementById('clientCount').textContent = data.stats.totalConnections || 0;
                    document.getElementById('roomCount').textContent = data.stats.totalRooms || 0;
                    const uptime = Math.floor(data.uptime);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = uptime % 60;
                    document.getElementById('uptime').textContent = 
                        hours > 0 ? \`\${hours}h \${minutes}m\` :
                        minutes > 0 ? \`\${minutes}m \${seconds}s\` :
                        \`\${seconds}s\`;
                })
                .catch(err => {});
        }
        
        function joinRoom(room) {
            if (!socket || !isConnected) {
                addLog('⚠️ Not connected to server', 'warn');
                return;
            }
            const roomCode = room || document.getElementById('roomInput').value || 'vtt-room';
            socket.emit('join-room', { roomCode, playerName: 'Dashboard User' });
        }
        
        function leaveRoom() {
            if (!socket || !isConnected) {
                addLog('⚠️ Not connected to server', 'warn');
                return;
            }
            socket.emit('leave-room', roomCode);
            addLog('🚪 Left room: ' + roomCode, 'info');
        }
        
        function drawCard() {
            if (!socket || !isConnected) {
                addLog('⚠️ Not connected to server', 'warn');
                return;
            }
            if (!roomCode) {
                addLog('⚠️ Not in a room', 'warn');
                return;
            }
            socket.emit('deck-draw', { count: 1, region: 'Acasia' });
        }
        
        function shuffleDeck() {
            if (!socket || !isConnected) {
                addLog('⚠️ Not connected to server', 'warn');
                return;
            }
            if (!roomCode) {
                addLog('⚠️ Not in a room', 'warn');
                return;
            }
            socket.emit('deck-shuffle');
        }
        
        function drawCrown() {
            if (!socket || !isConnected) {
                addLog('⚠️ Not connected to server', 'warn');
                return;
            }
            if (!roomCode) {
                addLog('⚠️ Not in a room', 'warn');
                return;
            }
            socket.emit('crown-spread', { region: 'Acasia' });
        }
        
        function clearHistory() {
            if (!socket || !isConnected) {
                addLog('⚠️ Not connected to server', 'warn');
                return;
            }
            if (!roomCode) {
                addLog('⚠️ Not in a room', 'warn');
                return;
            }
            socket.emit('deck-history-clear');
        }
        
        document.addEventListener('DOMContentLoaded', () => {
            connect();
            setInterval(fetchStats, 5000);
        });
        
        document.getElementById('roomInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                joinRoom();
            }
        });
    </script>
</body>
</html>`;
        
        fs.writeFileSync(indexPath, html);
        logInfo('Created web interface', { path: indexPath });
    }
}

// ============================================================
// START SERVER
// ============================================================

createWebInterface();

startServers().catch(err => {
    logError('Failed to start server', { error: err.message });
    process.exit(1);
});

// ============================================================
// EXPORTS
// ============================================================

module.exports = { app, webServer, io, wss };