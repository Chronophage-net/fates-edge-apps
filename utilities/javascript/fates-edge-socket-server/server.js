#!/usr/bin/env node
/**
 * Fate's Edge - WebSocket Server
 * Supports both Socket.io and plain WebSocket connections
 * Includes unified presence tracking, GM role conflict resolution, and GM election polling.
 * 
 * Configuration: environment variables (with .env support) and optional config file (config.json).
 * Graceful shutdown on SIGTERM/SIGINT; port conflict handling with retry.
 */

// Load .env if present (optional dependency)
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not installed – ignore, we'll use system environment variables
}

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION LOADING
// ============================================================

/**
 * Load configuration from environment variables and an optional config file.
 * Priority: environment variables override config file values.
 */
function loadConfig() {
    const config = {
        port: parseInt(process.env.PORT, 10) || 10000,
        host: process.env.HOST || '0.0.0.0',
        logLevel: process.env.LOG_LEVEL || 'INFO',
        corsOrigin: process.env.CORS_ORIGIN || '*',
        // Additional configurable options
        maxDeckHistory: parseInt(process.env.MAX_DECK_HISTORY, 10) || 100,
        healthEndpoint: process.env.HEALTH_ENDPOINT || '/api/health',
        statsInterval: parseInt(process.env.STATS_INTERVAL, 10) || 30000,
    };

    // Try to load a config file (config.json) from the same directory
    const configFilePath = process.env.CONFIG_FILE || path.join(__dirname, 'config.json');
    if (fs.existsSync(configFilePath)) {
        try {
            const fileConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
            // Merge file config (env vars take precedence)
            for (const key in fileConfig) {
                if (!(key in process.env)) {
                    config[key] = fileConfig[key];
                }
            }
            console.log(`[CONFIG] Loaded configuration from ${configFilePath}`);
        } catch (err) {
            console.error(`[CONFIG] Failed to parse config file ${configFilePath}: ${err.message}`);
        }
    } else {
        console.log(`[CONFIG] No config file found at ${configFilePath}; using environment/defaults.`);
    }

    return config;
}

const config = loadConfig();

// ============================================================
// EXPRESS APP SETUP
// ============================================================

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// ============================================================
// LOGGING UTILITY
// ============================================================

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

function log(level, message, data = null) {
    const levelNum = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    const currentLevel = LOG_LEVELS[config.logLevel] || LOG_LEVELS.INFO;
    
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

// ============================================================
// STATE
// ============================================================

const rooms = new Map();
const regionDataCache = new Map();
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
        totalClients: room.clients.size,
        deckRemaining: room.deck?.length || 0,
        historyCount: room.deckHistory?.length || 0,
        lastActivity: room.lastActivity,
        created: room.created
    };
}

// Check if a GM already exists in the room
function getExistingGm(room) {
    for (const [id, client] of room.clients.entries()) {
        if (client.role === 'gm') return client;
    }
    return null;
}

// Get unified list of clients for presence broadcasting
function getClientsList(room) {
    return Array.from(room.clients.values()).map(c => ({
        id: c.id,
        name: c.name,
        role: c.role,
        email: c.email || ''
    }));
}

// ============================================================
// GM ELECTION & ROLE MANAGEMENT
// ============================================================

function handleGmRequest(room, requesterId) {
    const requester = room.clients.get(requesterId);
    if (!requester) return;

    const currentGm = getExistingGm(room);
    if (!currentGm) {
        // No GM, promote immediately
        requester.role = 'gm';
        room.clients.set(requesterId, requester);
        
        const clientsList = getClientsList(room);
        broadcastToRoom(room.code, 'presence', { clients: clientsList });
        broadcastToRoom(room.code, 'server_announcement', {
            message: `👑 ${requester.name} has taken on the role of Game Master.`,
            timestamp: Date.now()
        });
        
        // Notify the requester directly of their new role
        if (requester.type === 'socket.io' && requester.socket) {
            requester.socket.emit('gm_role_update', { role: 'gm' });
        } else if (requester.type === 'ws' && requester.ws && requester.ws.readyState === WebSocket.OPEN) {
            requester.ws.send(JSON.stringify({ type: 'gm_role_update', role: 'gm' }));
        }
    } else {
        // GM exists, request a vote
        broadcastToRoom(room.code, 'gm_vote_request', {
            requesterId: requesterId,
            requesterName: requester.name,
            currentGmId: currentGm.id,
            currentGmName: currentGm.name,
            timestamp: Date.now()
        });
        
        // Notify the requester that they must wait
        const waitMsg = `A GM is already present. A vote request has been sent to ${currentGm.name}.`;
        if (requester.type === 'socket.io' && requester.socket) {
            requester.socket.emit('server_announcement', { message: waitMsg, timestamp: Date.now() });
        } else if (requester.type === 'ws' && requester.ws) {
            requester.ws.send(JSON.stringify({ type: 'server_announcement', message: waitMsg, timestamp: Date.now() }));
        }
    }
}

function handleGmApproval(room, approverId, targetId) {
    const approver = room.clients.get(approverId);
    const target = room.clients.get(targetId);
    
    if (!approver || !target) return;
    if (approver.role !== 'gm') return; // Only current GM can approve
    
    // Swap roles
    approver.role = 'player';
    target.role = 'gm';
    
    room.clients.set(approverId, approver);
    room.clients.set(targetId, target);
    
    const clientsList = getClientsList(room);
    broadcastToRoom(room.code, 'presence', { clients: clientsList });
    broadcastToRoom(room.code, 'server_announcement', {
        message: `👑 ${approver.name} has stepped down. ${target.name} is now the Game Master.`,
        timestamp: Date.now()
    });
    
    // Notify individuals of their new roles
    if (approver.type === 'socket.io' && approver.socket) {
        approver.socket.emit('gm_role_update', { role: 'player' });
    } else if (approver.type === 'ws' && approver.ws) {
        approver.ws.send(JSON.stringify({ type: 'gm_role_update', role: 'player' }));
    }
    
    if (target.type === 'socket.io' && target.socket) {
        target.socket.emit('gm_role_update', { role: 'gm' });
    } else if (target.type === 'ws' && target.ws) {
        target.ws.send(JSON.stringify({ type: 'gm_role_update', role: 'gm' }));
    }
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
    
    // Add two jokers
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

    // Shuffle
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
    const room = rooms.get(roomKey);
    if (!room) return;
    
    // Broadcast to Socket.io clients
    if (io) {
        io.to(roomKey).emit(event, data);
        logDebug('Broadcast to Socket.io clients', { room: roomKey, event, clients: io.sockets.adapter.rooms.get(roomKey)?.size || 0 });
    }
    
    // Broadcast to plain WebSocket clients stored in room.clients
    if (room.clients.size > 0) {
        const message = JSON.stringify({ type: event, ...data });
        let sentCount = 0;
        for (const [id, client] of room.clients.entries()) {
            if (client.type === 'ws' && client.ws && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
                sentCount++;
            }
        }
        if (sentCount > 0) {
            logDebug('Broadcast to plain WebSocket clients', { room: roomKey, event, clients: sentCount });
        }
    }
}

// ============================================================
// [WHITEBOARD] Helper to create default whiteboard state
// ============================================================
function createDefaultWhiteboard() {
    return {
        drawings: [],
        notes: [],
        images: [],
        settings: {
            gridSnap: false,
            gridSize: 20,
            backgroundColor: '#ffffff',
            gridType: 'square',
            showGrid: true
        },
        gridCombat: {
            enabled: false,
            gridType: 'square',
            cellSize: 40,
            showCoordinates: false,
            showZones: false,
            tokens: []
        }
    };
}

// ============================================================
// API ROUTES
// ============================================================

// Health check with detailed stats
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

app.get('/api/healthz', (req, res) => {
    res.status(200).send('OK');
});

app.get(config.healthEndpoint, (req, res) => {
    const roomStats = Array.from(rooms.keys()).map(code => getRoomStats(code)).filter(Boolean);
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        stats: {
            ...socketStats,
            totalRooms: rooms.size,
            totalConnections: socketStats.socketIOConnections + socketStats.wsConnections,
            rooms: roomStats
        }
    });
});

// Get room stats
app.get('/api/rooms', authenticate, (req, res) => {
    const roomStats = Array.from(rooms.keys()).map(code => getRoomStats(code)).filter(Boolean);
    res.json({
        rooms: roomStats,
        count: roomStats.length,
        timestamp: Date.now()
    });
});

// Get deck state
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

// Shuffle deck
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

// Draw from deck
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

            if (room.deckHistory.length > config.maxDeckHistory) {
                room.deckHistory = room.deckHistory.slice(-config.maxDeckHistory);
            }

            room.lastActivity = Date.now();

            const roomCode = req.params.code.toUpperCase();
            broadcastToRoom(roomCode, 'deck-drawn', result);

            logInfo('Cards drawn via API', { room: roomCode, count, region });
            res.json({
                success: true,
                code: roomCode,
                ...result,
                deliveredTo: room.clients.size
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
                deliveredTo: room.clients.size
            });
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// Crown spread
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

// Get deck history
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

// Clear deck history
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

// Get available modules
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

// Push module to clients
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
                clients: room.clients.size,
                message: `Module ${manifest.name} pushed to room ${roomKey}`
            });
        } else {
            let totalClients = 0;
            for (const [code, room] of rooms) {
                const clientCount = room.clients.size;
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

// Clean up module from clients
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
                const clientCount = room.clients.size;
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

// API Documentation
app.get('/api/data/docs', (req, res) => {
    res.json({
        title: "Fate's Edge API Documentation",
        version: "1.0.0",
        description: "API for managing deck draws and module distribution in Fate's Edge",
        endpoints: {
            health: {
                get: `GET ${config.healthEndpoint} - Server health check with stats`
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
            'join-room': 'Join a room: { roomCode, playerName, playerRole } (Socket.io only)',
            'handshake': 'Join a room: { campaignCode, clientName, role } (Plain WS only)',
            'request_gm': 'Request to become the GM',
            'approve_gm': 'Approve a GM request (current GM only): { targetId }',
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
            'socket.io': `ws://localhost:${config.port} (use Socket.io client)`,
            'plain-websocket': `ws://localhost:${config.port}?room=ROOM_CODE or ws://localhost:${config.port}/campaign/ROOM_CODE (use standard WebSocket)`
        }
    });
});

// ============================================================
// CREATE SERVER
// ============================================================

const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
    cors: {
        origin: config.corsOrigin,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Make io available globally for API routes
global.io = io;

// ============================================================
// PLAIN WEBSOCKET SERVER
// ============================================================

const wss = new WebSocket.Server({ 
    server,
    path: '/' // Handle plain WebSocket connections on the same path
});

logInfo('WebSocket server initialized', { 
    socketIO: true, 
    plainWS: true,
    path: '/'
});

// ============================================================
// PLAIN WEBSOCKET HANDLERS
// ============================================================

wss.on('connection', (ws, req) => {
    // Parse room from URL (supports both ?room=CODE and /campaign/CODE)
    const url = new URL(req.url, `http://${req.headers.host}`);
    let room = url.searchParams.get('room');
    if (!room) {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2 && pathParts[0] === 'campaign') {
            room = pathParts[1];
        }
    }
    
    const roomKey = (room || 'default').toUpperCase();
    
    // Parse client info
    const clientId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    logInfo('🔌 Plain WebSocket client connected', { 
        clientId, 
        room: roomKey,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
    });
    
    // Get or create room state
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
            created: Date.now(),
            whiteboard: createDefaultWhiteboard()
        };
        rooms.set(roomKey, roomState);
        logInfo('📋 Room created', { room: roomKey });
    }
    
    // Store client in unified room.clients map
    ws.clientId = clientId;
    ws.room = roomKey;
    ws.clientData = { id: clientId, name: 'Player', role: 'player', email: '', type: 'ws', ws: ws };
    roomState.clients.set(clientId, ws.clientData);
    
    socketStats.wsConnections++;
    socketStats.totalConnections++;
    
    // Send welcome message
    const welcomeMessage = {
        type: 'connected',
        clientId: clientId,
        room: roomKey,
        timestamp: Date.now(),
        message: 'Connected to Fate\'s Edge WebSocket server',
        protocols: ['socket.io', 'plain-websocket'],
        serverVersion: '1.0.0'
    };
    
    ws.send(JSON.stringify(welcomeMessage));
    logDebug('Welcome message sent', { clientId, room: roomKey });
    
    // Send current room state (including whiteboard)
    ws.send(JSON.stringify({
        type: 'room-state',
        room: roomKey,
        deckRemaining: roomState.deck?.length || 0,
        historyCount: roomState.deckHistory?.length || 0,
        whiteboard: roomState.whiteboard,
        timestamp: Date.now()
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const messageType = data.type || 'unknown';
            logDebug('📨 Plain WS message received', { 
                clientId, 
                room: roomKey, 
                type: messageType,
                data: data
            });
            
            const currentRoom = rooms.get(roomKey);
            if (!currentRoom) return;
            
            // Handle different message types
            switch(messageType) {
                case 'ping':
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: Date.now()
                    }));
                    break;
                    
                case 'handshake':
                    handlePlainWSHandshake(ws, currentRoom, data);
                    break;

                case 'request_gm':
                    handleGmRequest(currentRoom, clientId);
                    break;

                case 'approve_gm':
                    handleGmApproval(currentRoom, clientId, data.targetId);
                    break;
                    
                case 'deck-draw':
                    handlePlainWSDeckDraw(ws, currentRoom, data);
                    break;
                    
                case 'deck-shuffle':
                    handlePlainWSDeckShuffle(ws, currentRoom);
                    break;
                    
                case 'crown-spread':
                    handlePlainWSCrownSpread(ws, currentRoom, data);
                    break;
                    
                case 'deck-history':
                    handlePlainWSDeckHistory(ws, currentRoom);
                    break;
                    
                case 'deck-history-clear':
                    handlePlainWSDeckHistoryClear(ws, currentRoom);
                    break;

                case 'whiteboard-update':
                    handlePlainWSWhiteboardUpdate(ws, currentRoom, data);
                    break;

                case 'sync-request':
                    handlePlainWSSyncRequest(ws, currentRoom, data);
                    break;

                case 'sync-state':
                    // Client is pushing a full sync state – treat as update
                    handlePlainWSWhiteboardUpdate(ws, currentRoom, data);
                    break;

                case 'media_recording':
                case 'voice-offer':
                case 'voice-answer':
                case 'voice-ice-candidate':
                case 'voice-status':
                case 'chat-message':
                case 'roll-dice':
                case 'roll-result':
                case 'event':
                case 'operation':
                case 'operation_ack':
                case 'presence':
                    // Broadcast directly to the room so all clients get it
                    broadcastToRoom(roomKey, messageType, data);
                    break;
                    
                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: `Unknown message type: ${messageType}`,
                        supportedTypes: ['ping', 'handshake', 'request_gm', 'approve_gm', 'deck-draw', 'deck-shuffle', 'crown-spread', 'deck-history', 'deck-history-clear', 'whiteboard-update', 'sync-request', 'sync-state', 'media_recording', 'voice-offer', 'voice-answer', 'voice-ice-candidate', 'voice-status', 'chat-message', 'roll-dice', 'roll-result', 'event']
                    }));
            }
        } catch (error) {
            logError('Error parsing plain WS message', { 
                clientId, 
                error: error.message,
                rawMessage: message.toString().substring(0, 100)
            });
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format: ' + error.message
            }));
        }
    });

    ws.on('close', () => {
        logInfo('🔌 Plain WebSocket client disconnected', { 
            clientId, 
            room: roomKey,
            remaining: rooms.get(roomKey)?.clients.size || 0
        });
        
        const room = rooms.get(roomKey);
        if (room) {
            const wasGm = room.clients.get(clientId)?.role === 'gm';
            room.clients.delete(clientId);
            
            const clientsList = getClientsList(room);
            broadcastToRoom(roomKey, 'presence', { clients: clientsList });
            broadcastToRoom(roomKey, 'player-left', {
                clientId: clientId,
                clientName: ws.clientData?.name || 'Player',
                clients: clientsList
            });

            if (wasGm) {
                broadcastToRoom(roomKey, 'server_announcement', {
                    message: `The Game Master has disconnected.`,
                    timestamp: Date.now()
                });
            }
            
            if (room.clients.size === 0) {
                rooms.delete(roomKey);
                logInfo('🗑️ Room deleted (empty)', { room: roomKey });
            }
        }
        socketStats.wsConnections--;
    });
    
    ws.on('error', (error) => {
        logError('Plain WS error', { clientId, room: roomKey, error: error.message });
    });
});

// ============================================================
// PLAIN WEBSOCKET HANDLER FUNCTIONS
// ============================================================

function handlePlainWSHandshake(ws, room, data) {
    let assignedRole = data.role || 'player';
    const existingGm = getExistingGm(room);
    
    if (assignedRole === 'gm' && existingGm) {
        assignedRole = 'player';
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'A GM is already hosting this room. You have joined as a Player.',
            code: 'GM_CONFLICT'
        }));
    }

    ws.clientData.name = data.clientName || 'Player';
    ws.clientData.role = assignedRole;
    ws.clientData.email = data.clientEmail || '';
    room.clients.set(ws.clientId, ws.clientData);

    const clientsList = getClientsList(room);
    
    ws.send(JSON.stringify({
        type: 'handshake_ack',
        success: true,
        clientId: ws.clientId,
        clientRole: assignedRole,
        versionVector: {},
        activeClients: clientsList
    }));

    broadcastToRoom(room.code, 'presence', { clients: clientsList });
    broadcastToRoom(room.code, 'player-joined', {
        clientId: ws.clientId,
        clientName: ws.clientData.name,
        role: ws.clientData.role,
        clients: clientsList
    });
    
    logInfo('👤 Player joined via plain WS Handshake', { 
        room: room.code, 
        name: ws.clientData.name,
        role: ws.clientData.role
    });
}

async function handlePlainWSDeckDraw(ws, room, data) {
    try {
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
        
        if (room.deckHistory.length > config.maxDeckHistory) {
            room.deckHistory = room.deckHistory.slice(-config.maxDeckHistory);
        }
        
        room.lastActivity = Date.now();
        
        broadcastToRoom(room.code, 'deck-drawn', result);
        
        ws.send(JSON.stringify({
            type: 'deck-drawn-success',
            ...result
        }));
        
        logInfo('Cards drawn via plain WS', { room: room.code, count, region });
        
    } catch (error) {
        logError('Error in plain WS deck draw', { room: room.code, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to draw cards: ' + error.message
        }));
    }
}

function handlePlainWSDeckShuffle(ws, room) {
    try {
        room.deck = buildDeck();
        room.deckOffset = Math.floor(Math.random() * 1000);
        room.lastActivity = Date.now();
        
        broadcastToRoom(room.code, 'deck-shuffled', {
            remaining: room.deck.length,
            timestamp: Date.now()
        });
        
        ws.send(JSON.stringify({
            type: 'deck-shuffled-success',
            remaining: room.deck.length,
            timestamp: Date.now()
        }));
        
        logInfo('Deck shuffled via plain WS', { room: room.code });
        
    } catch (error) {
        logError('Error in plain WS deck shuffle', { room: room.code, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to shuffle deck: ' + error.message
        }));
    }
}

async function handlePlainWSCrownSpread(ws, room, data) {
    try {
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
        
        broadcastToRoom(room.code, 'crown-spread', response);
        
        ws.send(JSON.stringify({
            type: 'crown-spread-success',
            ...response
        }));
        
        logInfo('Crown spread via plain WS', { room: room.code });
        
    } catch (error) {
        logError('Error in plain WS crown spread', { room: room.code, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process crown spread: ' + error.message
        }));
    }
}

function handlePlainWSDeckHistory(ws, room) {
    try {
        const history = (room.deckHistory || []).slice(-50);
        ws.send(JSON.stringify({
            type: 'deck-history',
            history: history,
            count: history.length,
            total: room.deckHistory?.length || 0
        }));
        
    } catch (error) {
        logError('Error in plain WS deck history', { room: room.code, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to get deck history: ' + error.message
        }));
    }
}

function handlePlainWSDeckHistoryClear(ws, room) {
    try {
        room.deckHistory = [];
        room.lastActivity = Date.now();
        
        broadcastToRoom(room.code, 'deck-history-cleared', {
            timestamp: Date.now()
        });
        
        ws.send(JSON.stringify({
            type: 'deck-history-cleared-success',
            timestamp: Date.now()
        }));
        
        logInfo('Deck history cleared via plain WS', { room: room.code });
        
    } catch (error) {
        logError('Error in plain WS deck history clear', { room: room.code, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to clear deck history: ' + error.message
        }));
    }
}

function handlePlainWSWhiteboardUpdate(ws, room, data) {
    try {
        let newWhiteboard;
        if (data.whiteboard) {
            newWhiteboard = data.whiteboard;
        } else if (data.state) {
            newWhiteboard = data.state;
        } else {
            newWhiteboard = data;
        }

        room.whiteboard = {
            drawings: newWhiteboard.drawings || [],
            notes: newWhiteboard.notes || [],
            images: newWhiteboard.images || [],
            settings: { ...room.whiteboard.settings, ...(newWhiteboard.settings || {}) },
            gridCombat: { ...room.whiteboard.gridCombat, ...(newWhiteboard.gridCombat || {}) }
        };

        room.lastActivity = Date.now();

        broadcastToRoom(room.code, 'whiteboard-update', {
            whiteboard: room.whiteboard,
            timestamp: Date.now(),
            source: 'plain-ws',
            clientId: ws.clientId
        });

        logDebug('Whiteboard updated via plain WS', { room: room.code, clientId: ws.clientId });

    } catch (error) {
        logError('Error in plain WS whiteboard update', { room: room.code, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to update whiteboard: ' + error.message
        }));
    }
}

function handlePlainWSSyncRequest(ws, room, data) {
    try {
        ws.send(JSON.stringify({
            type: 'sync-state',
            state: room.whiteboard,
            timestamp: Date.now()
        }));

        logDebug('Sync request responded via plain WS', { room: room.code, clientId: ws.clientId });

    } catch (error) {
        logError('Error in plain WS sync request', { room: room.code, error: error.message });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process sync request: ' + error.message
        }));
    }
}

// ============================================================
// SOCKET.IO HANDLERS
// ============================================================

io.on('connection', (socket) => {
    socketStats.socketIOConnections++;
    socketStats.totalConnections++;
    
    logInfo('🔌 Socket.io client connected', { 
        socketId: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
    });

    // Client data
    socket.clientData = {
        id: socket.id,
        name: 'Player',
        role: 'player',
        email: '',
        type: 'socket.io',
        socket: socket
    };

    // ============================================================
    // ROOM MANAGEMENT
    // ============================================================

    socket.on('join-room', (data) => {
        const { roomCode, playerName, playerRole = 'player', playerEmail = '' } = data;

        if (!roomCode || !validateRoomCode(roomCode)) {
            logWarn('Invalid room code', { socketId: socket.id, roomCode });
            socket.emit('error', { message: 'Invalid room code' });
            return;
        }

        const roomKey = roomCode.toUpperCase();

        // Leave previous room if any
        if (socket.room) {
            socket.leave(socket.room);
            const oldRoom = rooms.get(socket.room);
            if (oldRoom) {
                const wasGm = oldRoom.clients.get(socket.id)?.role === 'gm';
                oldRoom.clients.delete(socket.id);
                const oldClientsList = getClientsList(oldRoom);
                io.to(socket.room).emit('player-left', {
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    clients: oldClientsList
                });
                if (wasGm) {
                    broadcastToRoom(socket.room, 'server_announcement', {
                        message: `The Game Master has disconnected.`,
                        timestamp: Date.now()
                    });
                }
                logDebug('Player left room', { socketId: socket.id, room: socket.room, remaining: oldRoom.clients.size });
            }
        }

        // Join or create room
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
                created: Date.now(),
                whiteboard: createDefaultWhiteboard()
            };
            rooms.set(roomKey, room);
            logInfo('📋 Room created via Socket.io', { room: roomKey });
        }

        // --- CONFLICT RESOLUTION LOGIC ---
        let assignedRole = playerRole;
        const existingGm = getExistingGm(room);
        if (assignedRole === 'gm' && existingGm) {
            assignedRole = 'player';
            socket.emit('error', { 
                message: 'A GM is already hosting this room. You have joined as a Player.',
                code: 'GM_CONFLICT'
            });
        }
        // --- END CONFLICT RESOLUTION ---

        socket.join(roomKey);
        socket.room = roomKey;
        socket.clientData.name = playerName || 'Player';
        socket.clientData.role = assignedRole;
        socket.clientData.email = playerEmail;
        room.clients.set(socket.id, socket.clientData);
        room.lastActivity = Date.now();

        const clientsList = getClientsList(room);

        // Send room state to client (including whiteboard and role)
        const roomState = {
            room: roomKey,
            clients: clientsList,
            clientRole: assignedRole,
            deckRemaining: room.deck.length,
            deckHistory: room.deckHistory.slice(-20),
            totalClients: room.clients.size,
            whiteboard: room.whiteboard
        };
        
        socket.emit('room-joined', roomState);
        logInfo('👤 Player joined room via Socket.io', { 
            socketId: socket.id, 
            room: roomKey, 
            name: socket.clientData.name,
            role: socket.clientData.role,
            totalClients: roomState.totalClients
        });

        // Broadcast to room
        broadcastToRoom(roomKey, 'presence', { clients: clientsList });
        broadcastToRoom(roomKey, 'player-joined', {
            clientId: socket.id,
            clientName: socket.clientData.name,
            role: socket.clientData.role,
            clients: clientsList
        });
    });

    // ============================================================
    // GM ELECTION & ROLE MANAGEMENT
    // ============================================================

    socket.on('request_gm', () => {
        if (!socket.room) return;
        const room = rooms.get(socket.room);
        if (!room) return;
        handleGmRequest(room, socket.id);
    });

    socket.on('approve_gm', (data) => {
        if (!socket.room) return;
        const room = rooms.get(socket.room);
        if (!room) return;
        const targetId = data?.targetId;
        if (!targetId) return;
        handleGmApproval(room, socket.id, targetId);
    });

    // ============================================================
    // DECK OPERATIONS
    // ============================================================

    socket.on('deck-draw', async (data) => {
        if (!socket.room) {
            socket.emit('error', { message: 'Not in a room' });
            return;
        }

        try {
            const room = rooms.get(socket.room);
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
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

            if (room.deckHistory.length > config.maxDeckHistory) {
                room.deckHistory = room.deckHistory.slice(-config.maxDeckHistory);
            }

            room.lastActivity = Date.now();
            
            broadcastToRoom(socket.room, 'deck-drawn', result);
            
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
        }
    });

    socket.on('deck-shuffle', () => {
        if (!socket.room) {
            socket.emit('error', { message: 'Not in a room' });
            return;
        }

        const room = rooms.get(socket.room);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        room.deck = buildDeck();
        room.deckOffset = Math.floor(Math.random() * 1000);
        room.lastActivity = Date.now();

        broadcastToRoom(socket.room, 'deck-shuffled', {
            clientId: socket.id,
            clientName: socket.clientData?.name || 'Player',
            remaining: room.deck.length,
            timestamp: Date.now()
        });
        
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

    socket.on('deck-history-clear', () => {
        if (!socket.room) {
            socket.emit('error', { message: 'Not in a room' });
            return;
        }

        const room = rooms.get(socket.room);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        room.deckHistory = [];
        room.lastActivity = Date.now();

        broadcastToRoom(socket.room, 'deck-history-cleared', {
            clientId: socket.id,
            clientName: socket.clientData?.name || 'Player',
            timestamp: Date.now()
        });
        
        logInfo('Deck history cleared via Socket.io', { 
            room: socket.room,
            client: socket.clientData?.name
        });
    });

    socket.on('crown-spread', async (data) => {
        if (!socket.room) {
            socket.emit('error', { message: 'Not in a room' });
            return;
        }

        try {
            const room = rooms.get(socket.room);
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
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
    // [WHITEBOARD] Socket.io event handlers
    // ============================================================

    socket.on('whiteboard-update', (data) => {
        if (!socket.room) {
            socket.emit('error', { message: 'Not in a room' });
            return;
        }

        const room = rooms.get(socket.room);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        try {
            let newWhiteboard;
            if (data.whiteboard) {
                newWhiteboard = data.whiteboard;
            } else if (data.state) {
                newWhiteboard = data.state;
            } else {
                newWhiteboard = data;
            }

            room.whiteboard = {
                drawings: newWhiteboard.drawings || [],
                notes: newWhiteboard.notes || [],
                images: newWhiteboard.images || [],
                settings: { ...room.whiteboard.settings, ...(newWhiteboard.settings || {}) },
                gridCombat: { ...room.whiteboard.gridCombat, ...(newWhiteboard.gridCombat || {}) }
            };

            room.lastActivity = Date.now();

            broadcastToRoom(socket.room, 'whiteboard-update', {
                whiteboard: room.whiteboard,
                timestamp: Date.now(),
                source: 'socket.io',
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player'
            });

            logDebug('Whiteboard updated via Socket.io', { 
                room: socket.room, 
                client: socket.clientData?.name 
            });

        } catch (error) {
            logError('Error in Socket.io whiteboard update', { 
                room: socket.room, 
                error: error.message 
            });
            socket.emit('error', { message: 'Failed to update whiteboard: ' + error.message });
        }
    });

    socket.on('sync-request', (data) => {
        if (!socket.room) {
            socket.emit('error', { message: 'Not in a room' });
            return;
        }

        const room = rooms.get(socket.room);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        socket.emit('sync-state', {
            state: room.whiteboard,
            timestamp: Date.now()
        });

        logDebug('Sync request responded via Socket.io', { 
            room: socket.room, 
            client: socket.clientData?.name 
        });
    });

    socket.on('sync-state', (data) => {
        // Treat same as whiteboard-update
        socket.emit('whiteboard-update', data);
    });

    // ============================================================
    // [NEW] RELAY HANDLERS (Media, Voice, Chat, Rolls)
    // ============================================================
    const relayEvents = [
        'media_recording', 
        'voice-offer', 
        'voice-answer', 
        'voice-ice-candidate', 
        'voice-status', 
        'chat-message', 
        'roll-dice', 
        'roll-result', 
        'event',
        'operation',
        'operation_ack',
        'presence'
    ];
    
    relayEvents.forEach(eventName => {
        socket.on(eventName, (data) => {
            if (!socket.room) {
                socket.emit('error', { message: 'Not in a room' });
                return;
            }
            
            broadcastToRoom(socket.room, eventName, {
                ...data,
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player'
            });
        });
    });

    // ============================================================
    // DISCONNECT
    // ============================================================

    socket.on('disconnect', () => {
        socketStats.socketIOConnections--;
        
        if (socket.room) {
            const room = rooms.get(socket.room);
            if (room) {
                const wasGm = room.clients.get(socket.id)?.role === 'gm';
                room.clients.delete(socket.id);
                
                const clientsList = getClientsList(room);
                broadcastToRoom(socket.room, 'presence', { clients: clientsList });
                broadcastToRoom(socket.room, 'player-left', {
                    clientId: socket.id,
                    clientName: socket.clientData?.name || 'Player',
                    clients: clientsList
                });

                if (wasGm) {
                    broadcastToRoom(socket.room, 'server_announcement', {
                        message: `The Game Master has disconnected.`,
                        timestamp: Date.now()
                    });
                }
                
                const remainingClients = room.clients.size;
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

// ============================================================
// GRACEFUL SHUTDOWN HANDLING
// ============================================================

let shuttingDown = false;

function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    
    logInfo(`🛑 Received ${signal}. Shutting down gracefully...`);
    console.log(`\n🛑 Shutting down Fate's Edge server...`);
    
    // Close the HTTP server first, which will stop accepting new connections
    server.close((err) => {
        if (err) {
            logError('Error closing HTTP server', { error: err.message });
            process.exit(1);
        }
        logInfo('HTTP server closed.');
        
        // Close Socket.io server
        io.close(() => {
            logInfo('Socket.io server closed.');
            
            // Close plain WebSocket server
            wss.close(() => {
                logInfo('WebSocket server closed.');
                logInfo('✅ Graceful shutdown complete.');
                process.exit(0);
            });
        });
    });
    
    // Force shutdown after 10 seconds if not completed
    setTimeout(() => {
        logError('Forced shutdown after timeout.');
        process.exit(1);
    }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================
// START SERVER WITH PORT CONFLICT RETRY
// ============================================================

const MAX_PORT_RETRIES = 5;
let currentPort = config.port;

function startServer(port, retriesLeft) {
    server.listen(port, config.host, () => {
        console.log('\n' + '='.repeat(70));
        console.log(`🎯 Fate's Edge WebSocket Server v1.0.0`);
        console.log('='.repeat(70));
        console.log(`🚀 Server running on ${config.host}:${port}`);
        console.log(`📊 Health: http://localhost:${port}${config.healthEndpoint}`);
        console.log(`📚 API Docs: http://localhost:${port}/api/data/docs`);
        console.log(`🔌 WebSocket (plain): ws://localhost:${port}?room=ROOM_CODE or /campaign/ROOM_CODE`);
        console.log(`🔌 WebSocket (Socket.io): http://localhost:${port}`);
        console.log(`📋 Rooms: ${rooms.size}`);
        console.log(`📊 Log Level: ${config.logLevel}`);
        console.log('='.repeat(70));
        console.log('✅ Server ready for connections\n');
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            if (retriesLeft > 0) {
                logWarn(`Port ${port} is in use. Trying next port (${port + 1})...`);
                currentPort = port + 1;
                server.close(); // Close the server (it wasn't listening anyway, but just in case)
                startServer(currentPort, retriesLeft - 1);
            } else {
                logError(`Port ${port} is in use and no retries left. Exiting.`);
                console.error(`❌ Could not start server on any port after ${MAX_PORT_RETRIES} attempts.`);
                process.exit(1);
            }
        } else {
            logError('Server error', { error: err.message });
            process.exit(1);
        }
    });
}

startServer(currentPort, MAX_PORT_RETRIES);

// ============================================================
// STATS LOGGING
// ============================================================

setInterval(() => {
    const totalClients = socketStats.socketIOConnections + socketStats.wsConnections;
    if (totalClients > 0 || rooms.size > 0) {
        logInfo('📊 Server stats', {
            rooms: rooms.size,
            socketIO: socketStats.socketIOConnections,
            plainWS: socketStats.wsConnections,
            totalClients: totalClients,
            uptime: Math.floor((Date.now() - socketStats.startTime) / 1000) + 's'
        });
    }
}, config.statsInterval);

// ============================================================
// EXPORTS
// ============================================================

module.exports = { app, server, io, wss };