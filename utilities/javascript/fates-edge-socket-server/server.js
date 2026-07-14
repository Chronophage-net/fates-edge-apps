// Fate's Edge - WebSocket Server

const fs = require('fs');
const path = require('path');

// Add near the top of the file after the other constants
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

// Add deck state to room data structure
// Modify the room creation to include deck state
const DECK_STORAGE_KEY = 'fates-edge-decks';

// Add after the rooms Map declaration
const regionDataCache = new Map();

// Utility functions
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

function broadcastToRoom(roomCode, event, data) {
    const room = rooms.get(roomCode.toUpperCase());
    if (room) {
        // Assuming you're using socket.io
        io.to(roomCode.toUpperCase()).emit(event, data);
    }
}

function authenticate(req, res, next) {
    // Implement your authentication logic here
    // This is a placeholder - you'll need to implement based on your auth system
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    
    // Validate API key (implement your own validation logic)
    // req.apiKeyData = validateApiKey(apiKey);
    req.apiKeyData = { name: 'System' }; // Placeholder
    next();
}

// Deck management functions
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
        return entries.map((e, i) => `${i+1}. ${e}`).join('\n\n');
    }
}

// Add region data loading function
async function loadRegionData(regionName) {
    if (regionDataCache.has(regionName)) {
        return regionDataCache.get(regionName);
    }
    
    try {
        // Try to load from file system first
        const regionPath = path.join(__dirname, 'data', 'regions', `${regionName.toLowerCase()}.json`);
        if (fs.existsSync(regionPath)) {
            const data = JSON.parse(fs.readFileSync(regionPath, 'utf-8'));
            regionDataCache.set(regionName, data);
            return data;
        }
        
        // Try misc/regions/ as fallback
        const miscPath = path.join(__dirname, 'misc', 'regions', `${regionName.toLowerCase()}.json`);
        if (fs.existsSync(miscPath)) {
            const data = JSON.parse(fs.readFileSync(miscPath, 'utf-8'));
            regionDataCache.set(regionName, data);
            return data;
        }
        
        // Return default data
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
    } catch (e) {
        console.warn(`Could not load region data for ${regionName}:`, e.message);
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
// DECK API ENDPOINTS
// ============================================================

// Get deck state for a room
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
        
        broadcastToRoom(req.params.code, 'deck-shuffled', {
            source: 'api',
            remaining: room.deck.length,
            timestamp: Date.now()
        });
        
        res.json({
            success: true,
            code: req.params.code.toUpperCase(),
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
        
        // Load region data
        loadRegionData(region).then(regionData => {
            const isCrown = count === 5;
            let synthesis;
            
            if (isCrown) {
                // Crown spread
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
            
            // Keep history manageable
            if (room.deckHistory.length > 100) {
                room.deckHistory = room.deckHistory.slice(-100);
            }
            
            room.lastActivity = Date.now();
            
            // Broadcast to room
            broadcastToRoom(req.params.code, 'deck-drawn', result);
            
            res.json({
                success: true,
                code: req.params.code.toUpperCase(),
                ...result,
                deliveredTo: room.clients.size
            });
        }).catch(err => {
            // Fallback if region data fails
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
            broadcastToRoom(req.params.code, 'deck-drawn', result);
            
            res.json({
                success: true,
                code: req.params.code.toUpperCase(),
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
            
            broadcastToRoom(req.params.code, 'crown-spread', response);
            res.json(response);
        }).catch(err => {
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
        
        broadcastToRoom(req.params.code, 'deck-history-cleared', {
            source: 'api',
            timestamp: Date.now()
        });
        
        res.json({
            success: true,
            code: req.params.code.toUpperCase(),
            message: 'Deck history cleared'
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// ============================================================
// MODULE PUSH/DOWN ENDPOINTS
// ============================================================

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
                        // Skip invalid manifests
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
        const { roomCode, targetClients } = req.body;
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
        
        // Read module files
        const files = fs.readdirSync(modulesPath);
        for (const file of files) {
            if (file !== 'manifest.json') {
                const filePath = path.join(modulesPath, file);
                if (fs.statSync(filePath).isFile()) {
                    moduleData.files[file] = fs.readFileSync(filePath, 'utf-8');
                }
            }
        }
        
        // If roomCode is specified, broadcast to that room
        if (roomCode) {
            const room = getRoom(roomCode);
            broadcastToRoom(roomCode, 'module-push', {
                source: 'api',
                module: moduleData,
                timestamp: Date.now(),
                pushedBy: req.apiKeyData.name
            });
            res.json({
                success: true,
                module: moduleId,
                room: roomCode,
                clients: room.clients.size,
                message: `Module ${manifest.name} pushed to room ${roomCode}`
            });
        } else {
            // Push to all rooms
            let totalClients = 0;
            for (const [code, room] of rooms) {
                if (room.clients.size > 0) {
                    broadcastToRoom(code, 'module-push', {
                        source: 'api',
                        module: moduleData,
                        timestamp: Date.now(),
                        pushedBy: req.apiKeyData.name
                    });
                    totalClients += room.clients.size;
                }
            }
            res.json({
                success: true,
                module: moduleId,
                rooms: rooms.size,
                clients: totalClients,
                message: `Module ${manifest.name} pushed to all rooms`
            });
        }
    } catch (err) {
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
            broadcastToRoom(roomCode, 'module-cleanup', {
                source: 'api',
                moduleId: moduleId,
                timestamp: Date.now(),
                cleanedBy: req.apiKeyData.name
            });
            res.json({
                success: true,
                module: moduleId,
                room: roomCode,
                message: `Module ${moduleId} cleanup requested for room ${roomCode}`
            });
        } else {
            // Cleanup from all rooms
            let totalClients = 0;
            for (const [code, room] of rooms) {
                if (room.clients.size > 0) {
                    broadcastToRoom(code, 'module-cleanup', {
                        source: 'api',
                        moduleId: moduleId,
                        timestamp: Date.now(),
                        cleanedBy: req.apiKeyData.name
                    });
                    totalClients += room.clients.size;
                }
            }
            res.json({
                success: true,
                module: moduleId,
                rooms: rooms.size,
                clients: totalClients,
                message: `Module ${moduleId} cleanup requested for all rooms`
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// Crown Spread Helper
// ============================================================

const CROWN_POSITIONS = [
    { key: 'root', label: 'Root', icon: '🌱' },
    { key: 'crest', label: 'Crest', icon: '🏔️' },
    { key: 'crown', label: 'Crown', icon: '👑' },
    { key: 'left', label: 'Left Hand', icon: '🤝' }
];

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
                const rankA = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'].indexOf(a.card.rank);
                const rankB = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'].indexOf(b.card.rank);
                return rankA > rankB ? a : b;
            }).card.rankName} of ${positionCards.reduce((a, b) => {
                const rankA = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'].indexOf(a.card.rank);
                const rankB = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'].indexOf(b.card.rank);
                return rankA > rankB ? a : b;
            }).card.suitName}`
        }
    };
}

// ============================================================
// UPDATE WEB SOCKET HANDLERS
// ============================================================

// Add to the WebSocket handlers in the io.on('connection') block:

socket.on('deck-draw', async (data) => {
    if (!socket.authenticated || !socket.room) return;
    
    try {
        const room = rooms.get(socket.room);
        if (!room) return;
        
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
        
        try {
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
            io.to(socket.room).emit('deck-drawn', result);
            
        } catch (regionError) {
            // Fallback if region data fails
            const fallbackResult = {
                cards: drawn,
                synthesis: drawn.map(c => `A complication arises.`).join('\n\n'),
                type: String(count),
                region: region,
                remaining: room.deck.length,
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                timestamp: Date.now()
            };
            
            room.deckHistory = room.deckHistory || [];
            room.deckHistory.push({
                cards: drawn.map(c => c.isJoker ? `🃏${c.rank}` : `${c.rankName} of ${c.suitName}`).join(' | '),
                synthesis: fallbackResult.synthesis,
                type: `${count} Draw${count > 1 ? 's' : ''}`,
                clientId: socket.id,
                clientName: socket.clientData?.name || 'Player',
                timestamp: Date.now()
            });
            
            room.lastActivity = Date.now();
            io.to(socket.room).emit('deck-drawn', fallbackResult);
        }
        
    } catch (error) {
        socket.emit('error', { message: error.message });
    }
});

socket.on('deck-shuffle', () => {
    if (!socket.authenticated || !socket.room) return;
    
    const room = rooms.get(socket.room);
    if (!room) return;
    
    room.deck = buildDeck();
    room.deckOffset = Math.floor(Math.random() * 1000);
    room.lastActivity = Date.now();
    
    io.to(socket.room).emit('deck-shuffled', {
        clientId: socket.id,
        clientName: socket.clientData?.name || 'Player',
        remaining: room.deck.length,
        timestamp: Date.now()
    });
});

socket.on('deck-history', (callback) => {
    if (!socket.authenticated || !socket.room) return;
    
    const room = rooms.get(socket.room);
    if (!room) return;
    
    const history = (room.deckHistory || []).slice(-50);
    if (typeof callback === 'function') {
        callback({
            history: history,
            count: history.length
        });
    }
});

socket.on('module-push-request', (data, callback) => {
    if (!socket.authenticated) return;
    
    const { moduleId } = data;
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
        
        if (typeof callback === 'function') {
            callback({ success: true, module: moduleData });
        }
    } catch (error) {
        if (typeof callback === 'function') {
            callback({ error: error.message });
        }
    }
});

socket.on('module-cleanup-request', (data, callback) => {
    if (!socket.authenticated) return;
    
    const { moduleId } = data;
    
    // Send cleanup signal to all clients in the room
    if (socket.room) {
        io.to(socket.room).emit('module-cleanup', {
            moduleId: moduleId,
            source: socket.id,
            clientName: socket.clientData?.name || 'Player',
            timestamp: Date.now()
        });
    }
    
    if (typeof callback === 'function') {
        callback({ success: true, moduleId: moduleId });
    }
});

// Add missing Crown Spread WebSocket handler
socket.on('crown-spread', async (data) => {
    if (!socket.authenticated || !socket.room) return;
    
    try {
        const room = rooms.get(socket.room);
        if (!room) return;
        
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
        
        try {
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
            
            io.to(socket.room).emit('crown-spread', response);
        } catch (error) {
            socket.emit('error', { message: 'Failed to process crown spread: ' + error.message });
        }
        
    } catch (error) {
        socket.emit('error', { message: error.message });
    }
});

// Add missing deck history clear WebSocket handler
socket.on('deck-history-clear', () => {
    if (!socket.authenticated || !socket.room) return;
    
    const room = rooms.get(socket.room);
    if (!room) return;
    
    room.deckHistory = [];
    room.lastActivity = Date.now();
    
    io.to(socket.room).emit('deck-history-cleared', {
        clientId: socket.id,
        clientName: socket.clientData?.name || 'Player',
        timestamp: Date.now()
    });
});

// Add missing module list WebSocket handler
socket.on('module-list', (callback) => {
    if (!socket.authenticated) return;
    
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
                        // Skip invalid manifests
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
// UPDATE API DOCS
// ============================================================

// Add missing constants for API documentation
const API_DOCS = {
    title: "Fate's Edge API Documentation",
    version: "1.0.0",
    description: "API for managing deck draws and module distribution in Fate's Edge",
    endpoints: {
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
        deck_draw: 'deck-draw - Send { count: 1, region: "Acasia" }',
        deck_shuffle: 'deck-shuffle - Send { }',
        crown_spread: 'crown-spread - Send { region: "Acasia" }',
        deck_history: 'deck-history - Send { }',
        deck_history_clear: 'deck-history-clear - Send { }',
        module_push_request: 'module-push-request - Send { moduleId: "my-module" }',
        module_cleanup_request: 'module-cleanup-request - Send { moduleId: "my-module" }',
        module_list: 'module-list - Send { }'
    }
};

// Add deck endpoints to API docs
app.get('/api/docs', (req, res) => {
    res.json(API_DOCS);
});

// Add health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        rooms: rooms.size
    });
});