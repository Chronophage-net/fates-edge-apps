const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const morgan = require('morgan');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const Redis = require('ioredis');
const Agenda = require('agenda');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const { createClient } = require('redis');
const { promisify } = require('util');
const multer = require('multer');

// ===== Configuration =====
const ENABLE_UPLOAD = process.env.ENABLE_UPLOAD === 'true';
const MAX_CONCURRENT_CONVERSIONS = 2;
const UPLOAD_FILE_SIZE_LIMIT = 20 * 1024 * 1024; // 20 MB
const API_KEY = process.env.API_KEY || crypto.randomBytes(16).toString('hex');
const AUTO_CREATE_ROOMS = process.env.AUTO_CREATE_ROOMS === 'true';
const ENABLE_RATE_LIMITING = process.env.ENABLE_RATE_LIMITING !== 'false';
const ENABLE_LOGGING = process.env.ENABLE_LOGGING !== 'false';
const ENABLE_CACHING = process.env.ENABLE_CACHING === 'true';
const ENABLE_SESSIONS = process.env.ENABLE_SESSIONS === 'true';
const ENABLE_EMAIL = process.env.ENABLE_EMAIL === 'true';
const ENABLE_SCHEDULING = process.env.ENABLE_SCHEDULING === 'true';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 100;
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5;

// Advanced configurations
const ENABLE_WEBSOCKET_COMPRESSION = process.env.ENABLE_WEBSOCKET_COMPRESSION === 'true';
const ENABLE_WEBSOCKET_HEARTBEAT = process.env.ENABLE_WEBSOCKET_HEARTBEAT !== 'false';
const WEBSOCKET_PING_INTERVAL = parseInt(process.env.WEBSOCKET_PING_INTERVAL) || 25000;
const WEBSOCKET_PING_TIMEOUT = parseInt(process.env.WEBSOCKET_PING_TIMEOUT) || 60000;

const API_KEYS = new Map(); // key -> { name, permissions, createdAt, expiresAt, createdBy }

// Seed default API key if not provided
if (!process.env.API_KEY) {
    console.log(`🔑 Default API Key: ${API_KEY}`);
    console.log(`   Use this key for REST API calls (set API_KEY env var to change)`);
}
API_KEYS.set(API_KEY, {
    name: 'Default',
    permissions: ['*'],
    createdAt: Date.now(),
    createdBy: 'system'
});

// ===== Logging Setup =====
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'fates-edge' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// ===== App Setup =====
const app = express();
const server = http.createServer(app);

// Session store
let sessionStore;
if (ENABLE_SESSIONS) {
    sessionStore = new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
    });
}

// Redis client for caching
let redisClient;
if (ENABLE_CACHING) {
    redisClient = new Redis(REDIS_URL);
    redisClient.on('error', (err) => logger.error('Redis error:', err));
}

// ===== Middleware Setup =====
app.use(compression());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session middleware
if (ENABLE_SESSIONS) {
    app.use(session({
        store: sessionStore,
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { 
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }));
}

// ===== Rate Limiting & Throttling =====
if (ENABLE_RATE_LIMITING) {
    const apiLimiter = rateLimit({
        windowMs: RATE_LIMIT_WINDOW,
        max: RATE_LIMIT_MAX,
        message: { 
            error: 'Too many requests', 
            retryAfter: RATE_LIMIT_WINDOW / 1000 
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        handler: (req, res, next, options) => {
            logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
            res.status(options.statusCode).send(options.message);
        }
    });

    const authLimiter = rateLimit({
        windowMs: RATE_LIMIT_WINDOW,
        max: AUTH_RATE_LIMIT_MAX,
        message: { 
            error: 'Too many authentication attempts', 
            retryAfter: RATE_LIMIT_WINDOW / 1000 
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        keyGenerator: (req) => req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });

    const speedLimiter = slowDown({
        windowMs: 15 * 60 * 1000, // 15 minutes
        delayAfter: 100, // allow 100 requests per window, then start slowing down
        delayMs: 500 // add 500ms of delay to every request above delayAfter
    });

    app.use('/api/', apiLimiter);
    app.use('/api/(rooms|keys)', authLimiter);
    app.use('/api/', speedLimiter);
}

// ===== Security Headers =====
const helmet = require('helmet');
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// ===== API Key Middleware =====
function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) {
        return res.status(401).json({ 
            error: 'API key required', 
            hint: 'Provide X-API-Key header or ?apiKey= query param',
            docs: '/api/docs'
        });
    }
    
    const keyData = API_KEYS.get(apiKey);
    if (!keyData) {
        logger.warn(`Failed API authentication attempt from ${req.ip}`);
        return res.status(403).json({ error: 'Invalid API key' });
    }
    
    // Check key expiration
    if (keyData.expiresAt && Date.now() > keyData.expiresAt) {
        return res.status(403).json({ error: 'API key expired' });
    }
    
    req.apiKey = apiKey;
    req.apiKeyData = keyData;
    next();
}

// ===== JWT Authentication Middleware =====
function authenticateJWT(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ===== Caching Middleware =====
function cacheMiddleware(duration) {
    return async (req, res, next) => {
        if (!ENABLE_CACHING || !redisClient) return next();
        
        const key = `cache:${req.originalUrl}`;
        try {
            const cached = await redisClient.get(key);
            if (cached) {
                res.set('X-Cache', 'HIT');
                return res.json(JSON.parse(cached));
            }
            
            res.sendResponse = res.json;
            res.json = (body) => {
                res.set('X-Cache', 'MISS');
                redisClient.setex(key, duration, JSON.stringify(body));
                res.sendResponse(body);
            };
            next();
        } catch (err) {
            logger.error('Cache error:', err);
            next();
        }
    };
}

// ===== In-Memory State =====
const rooms = new Map();
const users = new Map(); // userId -> userData
const sessions = new Map(); // sessionId -> sessionData
const DATA_FILE = './server-data.json';
const blockedWords = (process.env.BLOCKED_WORDS || '').split(',').filter(w => w.trim());

// Load data on startup
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            Object.entries(data.rooms || {}).forEach(([code, roomData]) => {
                if (!rooms.has(code)) {
                    rooms.set(code, {
                        ...roomData,
                        clients: new Set(),
                        voice: new Set()
                    });
                }
            });
            console.log('✅ Data loaded from disk');
        }
    } catch (err) {
        console.warn('Could not load data:', err.message);
    }
}

// Save data periodically
function saveData() {
    const data = {
        rooms: Object.fromEntries(
            Array.from(rooms.entries()).map(([code, room]) => [
                code,
                {
                    data: room.data,
                    chatHistory: room.chatHistory?.slice(-100) || [],
                    createdAt: room.createdAt,
                    lastActivity: room.lastActivity,
                    name: room.name,
                    maxClients: room.maxClients,
                    owner: room.owner,
                    password: room.password
                }
            ])
        )
    };
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.warn('Could not save data:', err.message);
    }
}

setInterval(saveData, 60000);
process.on('SIGTERM', () => { saveData(); process.exit(0); });
process.on('SIGINT', () => { saveData(); process.exit(0); });
loadData();

// ===== Helper Functions =====
function generateRoomCode(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getRoom(code) {
    const room = rooms.get(code.toUpperCase());
    if (!room) throw new Error('Room not found');
    return room;
}

function broadcastToRoom(roomCode, event, data) {
    io.to(roomCode.toUpperCase()).emit(event, data);
}

function getRoomClients(code) {
    const room = rooms.get(code.toUpperCase());
    if (!room) return [];
    return Array.from(room.clients).map(id => {
        const socket = io.sockets.sockets.get(id);
        return {
            id,
            name: socket?.clientData?.name || 'Player',
            data: socket?.clientData || {},
            lastSeen: socket?.lastPing || Date.now()
        };
    });
}

function filterChatMessage(text) {
    if (!text || typeof text !== 'string') return '';
    
    // Basic profanity filter
    const lowerText = text.toLowerCase();
    for (const word of blockedWords) {
        if (word && lowerText.includes(word.toLowerCase())) {
            return '[Message blocked]';
        }
    }
    
    // Length limit
    if (text.length > 2000) {
        return text.substring(0, 2000) + '...';
    }
    
    return text;
}

// Character validation
function validateCharacter(character) {
    const required = ['name'];
    for (const field of required) {
        if (character[field] === undefined || character[field] === null) {
            throw new Error(`Character missing required field: ${field}`);
        }
    }
    
    // Validate numeric fields
    const numericFields = ['harm', 'fatigue', 'boons'];
    for (const field of numericFields) {
        if (character[field] !== undefined && typeof character[field] !== 'number') {
            throw new Error(`Character ${field} must be a number`);
        }
        if (character[field] < 0) {
            throw new Error(`Character ${field} must be non-negative`);
        }
    }
    
    return true;
}

// Timer validation
function validateTimer(timer) {
    if (!timer.name) {
        throw new Error('Timer must have a name');
    }
    if (timer.segments === undefined || typeof timer.segments !== 'number' || timer.segments <= 0) {
        throw new Error('Timer segments must be a positive number');
    }
    if (timer.current !== undefined && (typeof timer.current !== 'number' || timer.current < 0)) {
        throw new Error('Timer current must be a non-negative number');
    }
    return true;
}

// Dice expression parser
function parseDiceExpression(expr) {
    const patterns = [
        // Standard: 2d6+3, 1d20, etc.
        /^(\d*)d(\d+)([+-]\d+)?$/i,
        // Fate/Fudge: 4dF, 2dF+1
        /^(\d*)dF([+-]\d+)?$/i,
        // Percentile: d100, 2d100
        /^(\d*)d100([+-]\d+)?$/i
    ];
    
    for (const pattern of patterns) {
        const match = expr.match(pattern);
        if (match) {
            return {
                count: parseInt(match[1]) || 1,
                sides: match[2].toLowerCase() === 'f' ? 'F' : parseInt(match[2]),
                modifier: parseInt(match[3]) || 0,
                type: pattern.source.includes('dF') ? 'fate' : 
                      pattern.source.includes('d100') ? 'percentile' : 'standard'
            };
        }
    }
    
    throw new Error('Invalid dice expression. Examples: 2d6+3, 1d20, 4dF');
}

function rollDice(parsed) {
    const rolls = [];
    let total = 0;
    
    for (let i = 0; i < parsed.count; i++) {
        let roll;
        switch (parsed.type) {
            case 'fate':
                roll = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
                break;
            case 'percentile':
                roll = Math.floor(Math.random() * 100) + 1;
                break;
            default:
                roll = Math.floor(Math.random() * parsed.sides) + 1;
        }
        rolls.push(roll);
        total += roll;
    }
    
    total += parsed.modifier;
    
    return {
        rolls,
        total,
        modifier: parsed.modifier,
        type: parsed.type
    };
}

// ===== Room Templates =====
const ROOM_TEMPLATES = {
    'fate-edge': {
        name: 'Fate\'s Edge Session',
        data: {
            vtt: {
                characters: [],
                timers: [
                    { name: 'Scene Timer', segments: 6, current: 0 },
                    { name: 'Reinforcements', segments: 4, current: 0 }
                ],
                scene: 'Starting Scene'
            }
        }
    },
    'dnd': {
        name: 'D&D Session',
        data: {
            vtt: {
                characters: [],
                timers: [
                    { name: 'Combat Round', segments: 10, current: 0 }
                ],
                scene: 'Dungeon'
            }
        }
    },
    'generic': {
        name: 'Generic RPG Session',
        data: {
            vtt: {
                characters: [],
                timers: [],
                scene: 'Session Start'
            }
        }
    }
};

// =============================================================
//  REST API ENDPOINTS
// =============================================================

// --- API Documentation ---
app.get('/api/docs', (req, res) => {
    res.json({
        name: 'Fate\'s Edge VTT API',
        version: '1.2.0',
        authentication: {
            method: 'X-API-Key header or ?apiKey query param',
            defaultKey: API_KEY,
            rateLimiting: ENABLE_RATE_LIMITING ? `Enabled (${RATE_LIMIT_MAX}/15min)` : 'Disabled'
        },
        endpoints: {
            rooms: {
                list: 'GET /api/rooms',
                create: 'POST /api/rooms',
                createTemplate: 'POST /api/rooms/template/:template',
                get: 'GET /api/rooms/:code',
                delete: 'DELETE /api/rooms/:code',
                clients: 'GET /api/rooms/:code/clients',
                sync: 'PUT /api/rooms/:code/state'
            },
            chat: {
                send: 'POST /api/rooms/:code/chat',
                history: 'GET /api/rooms/:code/chat',
                clear: 'DELETE /api/rooms/:code/chat'
            },
            dice: {
                roll: 'POST /api/rooms/:code/roll',
                rollResults: 'GET /api/rooms/:code/rolls'
            },
            vtt: {
                syncState: 'PUT /api/rooms/:code/vtt/state',
                getState: 'GET /api/rooms/:code/vtt/state',
                updateCharacters: 'PUT /api/rooms/:code/vtt/characters',
                getCharacters: 'GET /api/rooms/:code/vtt/characters',
                updateTimers: 'PUT /api/rooms/:code/vtt/timers',
                getTimers: 'GET /api/rooms/:code/vtt/timers'
            },
            conversion: {
                status: 'GET /api/convert/status',
                upload: 'POST /api/convert/pdf'
            },
            system: {
                health: 'GET /health',
                stats: 'GET /api/stats',
                analytics: 'GET /api/analytics',
                status: 'GET /api/status'
            },
            keys: {
                list: 'GET /api/keys',
                create: 'POST /api/keys',
                delete: 'DELETE /api/keys/:key'
            },
            users: {
                register: 'POST /api/users/register',
                login: 'POST /api/users/login',
                profile: 'GET /api/users/profile',
                update: 'PUT /api/users/profile'
            },
            sessions: {
                list: 'GET /api/sessions',
                create: 'POST /api/sessions',
                join: 'POST /api/sessions/:id/join',
                leave: 'POST /api/sessions/:id/leave'
            }
        },
        examples: {
            roll_dice: 'POST /api/rooms/ABC123/roll -d \'{"roll": "3d6+2", "reason": "Attack"}\'',
            send_chat: 'POST /api/rooms/ABC123/chat -d \'{"message": "Hello everyone!", "sender": "GM"}\'',
            sync_state: 'PUT /api/rooms/ABC123/state -d \'{"scene": "The Dark Tower"}\'',
            create_room: 'POST /api/rooms -H "X-API-Key: YOUR_KEY" -d \'{"name": "My Campaign", "maxClients": 8}\''
        },
        cli: {
            info: 'This API is designed for CLI clients',
            authentication: 'Use X-API-Key header with your API key',
            json_format: 'All endpoints return JSON',
            websocket: 'Use WebSocket for real-time features'
        }
    });
});

// --- User Management ---
app.post('/api/users/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password required' });
        }
        
        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        // Check if user exists
        if (users.has(username)) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        // Create user
        const userId = uuidv4();
        const userData = {
            id: userId,
            username,
            email,
            password: hashedPassword,
            createdAt: Date.now(),
            lastLogin: null,
            sessions: []
        };
        
        users.set(username, userData);
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: userData.id, username: userData.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                createdAt: userData.createdAt
            }
        });
    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/users/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        const userData = users.get(username);
        if (!userData) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, userData.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update last login
        userData.lastLogin = Date.now();
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: userData.id, username: userData.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                lastLogin: userData.lastLogin
            }
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/users/profile', authenticateJWT, (req, res) => {
    const userData = users.get(req.user.username);
    if (!userData) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
        id: userData.id,
        username: userData.username,
        email: userData.email,
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin,
        sessions: userData.sessions
    });
});

app.put('/api/users/profile', authenticateJWT, async (req, res) => {
    try {
        const userData = users.get(req.user.username);
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const { email, password } = req.body;
        
        if (email && validator.isEmail(email)) {
            userData.email = email;
        }
        
        if (password && password.length >= 8) {
            userData.password = await bcrypt.hash(password, SALT_ROUNDS);
        }
        
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                createdAt: userData.createdAt
            }
        });
    } catch (error) {
        logger.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Session Management ---
app.get('/api/sessions', authenticateJWT, (req, res) => {
    const userSessions = Array.from(sessions.values())
        .filter(session => session.ownerId === req.user.userId);
    
    res.json({
        sessions: userSessions,
        count: userSessions.length
    });
});

app.post('/api/sessions', authenticateJWT, (req, res) => {
    try {
        const { name, description, maxPlayers, gameSystem } = req.body;
        const sessionId = uuidv4();
        
        const sessionData = {
            id: sessionId,
            name: name || 'New Session',
            description: description || '',
            gameSystem: gameSystem || 'generic',
            ownerId: req.user.userId,
            ownerName: req.user.username,
            createdAt: Date.now(),
            startedAt: null,
            endedAt: null,
            maxPlayers: maxPlayers || 6,
            players: [],
            observers: [],
            status: 'created', // created, started, paused, ended
            settings: {
                allowObservers: true,
                requirePassword: false,
                password: null
            }
        };
        
        sessions.set(sessionId, sessionData);
        
        // Add to user's sessions
        const userData = users.get(req.user.username);
        if (userData) {
            userData.sessions.push(sessionId);
        }
        
        res.status(201).json({
            message: 'Session created successfully',
            session: sessionData
        });
    } catch (error) {
        logger.error('Session creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/sessions/:id/join', authenticateJWT, (req, res) => {
    try {
        const sessionId = req.params.id;
        const sessionData = sessions.get(sessionId);
        
        if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        if (sessionData.status === 'ended') {
            return res.status(400).json({ error: 'Session has ended' });
        }
        
        // Check if already joined
        const isPlayer = sessionData.players.some(p => p.id === req.user.userId);
        const isObserver = sessionData.observers.some(o => o.id === req.user.userId);
        
        if (isPlayer || isObserver) {
            return res.status(400).json({ error: 'Already joined this session' });
        }
        
        // Add as player or observer
        const participant = {
            id: req.user.userId,
            username: req.user.username,
            joinedAt: Date.now(),
            role: 'player'
        };
        
        if (sessionData.players.length < sessionData.maxPlayers) {
            sessionData.players.push(participant);
        } else if (sessionData.settings.allowObservers) {
            participant.role = 'observer';
            sessionData.observers.push(participant);
        } else {
            return res.status(400).json({ error: 'Session is full' });
        }
        
        res.json({
            message: 'Joined session successfully',
            session: sessionData,
            role: participant.role
        });
    } catch (error) {
        logger.error('Session join error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/sessions/:id/leave', authenticateJWT, (req, res) => {
    try {
        const sessionId = req.params.id;
        const sessionData = sessions.get(sessionId);
        
        if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Remove from players
        sessionData.players = sessionData.players.filter(p => p.id !== req.user.userId);
        
        // Remove from observers
        sessionData.observers = sessionData.observers.filter(o => o.id !== req.user.userId);
        
        res.json({
            message: 'Left session successfully',
            session: sessionData
        });
    } catch (error) {
        logger.error('Session leave error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Room Management ---
app.post('/api/rooms', authenticate, (req, res) => {
    const { password, maxClients, name, template } = req.body;
    const code = generateRoomCode();
    
    let initialData = req.body.initialData || {};
    
    // Apply template if specified
    if (template && ROOM_TEMPLATES[template]) {
        initialData = { ...ROOM_TEMPLATES[template].data, ...initialData };
    }
    
    const roomData = {
        data: initialData,
        clients: new Set(),
        voice: new Set(),
        chatHistory: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        name: name || `Room ${code}`,
        maxClients: maxClients || 20,
        password: password ? crypto.createHash('sha256').update(password).digest('hex') : null,
        owner: req.apiKeyData.name,
        settings: {
            allowVoice: true,
            allowDiceRolls: true,
            allowChat: true,
            maxMessageLength: 2000,
            autoDeleteAfter: 3600000 // 1 hour
        }
    };
    
    rooms.set(code, roomData);
    
    res.status(201).json({ 
        code, 
        name: roomData.name,
        message: 'Room created successfully',
        apiKey: req.apiKey,
        websocketUrl: `ws://${req.get('host') || 'localhost:3000'}`,
        template: template || 'none',
        settings: roomData.settings
    });
});

app.post('/api/rooms/template/:template', authenticate, (req, res) => {
    const templateName = req.params.template;
    const template = ROOM_TEMPLATES[templateName];
    
    if (!template) {
        return res.status(404).json({ error: 'Template not found', available: Object.keys(ROOM_TEMPLATES) });
    }
    
    const { password, maxClients, name } = req.body;
    const code = generateRoomCode();
    
    const roomData = {
        ...template,
        clients: new Set(),
        voice: new Set(),
        chatHistory: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        name: name || template.name,
        maxClients: maxClients || 20,
        password: password ? crypto.createHash('sha256').update(password).digest('hex') : null,
        owner: req.apiKeyData.name,
        settings: {
            allowVoice: true,
            allowDiceRolls: true,
            allowChat: true,
            maxMessageLength: 2000,
            autoDeleteAfter: 3600000
        }
    };
    
    rooms.set(code, roomData);
    
    res.status(201).json({ 
        code, 
        name: roomData.name,
        template: templateName,
        message: 'Template room created successfully',
        settings: roomData.settings
    });
});

app.get('/api/rooms/:code', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        res.json({
            code: req.params.code.toUpperCase(),
            name: room.name,
            data: room.data,
            clientCount: room.clients.size,
            voiceCount: room.voice.size,
            chatCount: room.chatHistory?.length || 0,
            createdAt: room.createdAt,
            lastActivity: room.lastActivity,
            maxClients: room.maxClients,
            owner: room.owner,
            hasPassword: !!room.password,
            settings: room.settings
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.delete('/api/rooms/:code', authenticate, (req, res) => {
    try {
        const code = req.params.code.toUpperCase();
        const room = getRoom(code);
        
        // Check permissions
        if (req.apiKey !== API_KEY && room.owner !== req.apiKeyData.name) {
            return res.status(403).json({ error: 'Only room owner or admin can delete room' });
        }
        
        // Notify connected clients
        broadcastToRoom(code, 'room-closed', { 
            reason: 'Room deleted by API',
            deletedBy: req.apiKeyData.name 
        });
        rooms.delete(code);
        res.json({ success: true, message: `Room ${code} deleted` });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.get('/api/rooms', authenticate, cacheMiddleware(30), (req, res) => {
    const roomList = Array.from(rooms.keys()).map(code => {
        const room = rooms.get(code);
        return {
            code,
            name: room.name,
            clients: room.clients.size,
            voice: room.voice.size,
            chatCount: room.chatHistory?.length || 0,
            createdAt: room.createdAt,
            lastActivity: room.lastActivity,
            owner: room.owner,
            hasPassword: !!room.password,
            settings: room.settings
        };
    });
    
    // Sort by last activity (newest first)
    roomList.sort((a, b) => b.lastActivity - a.lastActivity);
    
    res.json({
        rooms: roomList,
        total: roomList.length,
        active: roomList.filter(r => r.clients > 0).length,
        apiKey: req.apiKey
    });
});

app.get('/api/rooms/:code/clients', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const clients = getRoomClients(req.params.code);
        res.json({
            code: req.params.code.toUpperCase(),
            name: room.name,
            clients,
            clientCount: room.clients.size,
            voiceCount: room.voice.size,
            connected: room.clients.size > 0
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// --- State Management ---
app.get('/api/rooms/:code/state', authenticate, cacheMiddleware(10), (req, res) => {
    try {
        const room = getRoom(req.params.code);
        res.json({
            code: req.params.code.toUpperCase(),
            name: room.name,
            state: room.data,
            updated: room.lastActivity
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.put('/api/rooms/:code/state', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const newState = req.body;
        room.data = { ...room.data, ...newState };
        room.lastActivity = Date.now();
        
        // Broadcast to all clients in the room
        broadcastToRoom(req.params.code, 'state-updated', {
            source: 'api',
            state: room.data,
            timestamp: Date.now(),
            updatedBy: req.apiKeyData.name
        });
        
        res.json({ 
            success: true, 
            code: req.params.code.toUpperCase(),
            state: room.data,
            broadcast: room.clients.size
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// --- VTT Specific State ---
app.get('/api/rooms/:code/vtt/state', authenticate, cacheMiddleware(10), (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const vttState = room.data?.vtt || {};
        res.json({
            code: req.params.code.toUpperCase(),
            name: room.name,
            vtt: vttState,
            characters: vttState.characters || [],
            timers: vttState.timers || [],
            scene: vttState.scene || null
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.put('/api/rooms/:code/vtt/state', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        if (!room.data) room.data = {};
        if (!room.data.vtt) room.data.vtt = {};
        
        room.data.vtt = { ...room.data.vtt, ...req.body };
        room.lastActivity = Date.now();
        
        broadcastToRoom(req.params.code, 'vtt-state-updated', {
            source: 'api',
            vtt: room.data.vtt,
            timestamp: Date.now(),
            updatedBy: req.apiKeyData.name
        });
        
        res.json({ 
            success: true, 
            code: req.params.code.toUpperCase(),
            vtt: room.data.vtt
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// --- Characters ---
app.get('/api/rooms/:code/vtt/characters', authenticate, cacheMiddleware(30), (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const characters = room.data?.vtt?.characters || [];
        res.json({
            code: req.params.code.toUpperCase(),
            name: room.name,
            characters,
            count: characters.length
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.put('/api/rooms/:code/vtt/characters', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        if (!room.data) room.data = {};
        if (!room.data.vtt) room.data.vtt = {};
        
        const characters = req.body;
        if (!Array.isArray(characters)) {
            return res.status(400).json({ error: 'characters must be an array' });
        }
        
        // Validate all characters
        for (const char of characters) {
            validateCharacter(char);
        }
        
        room.data.vtt.characters = characters;
        room.lastActivity = Date.now();
        
        broadcastToRoom(req.params.code, 'vtt-characters-updated', {
            source: 'api',
            characters,
            timestamp: Date.now(),
            updatedBy: req.apiKeyData.name
        });
        
        res.json({ 
            success: true, 
            code: req.params.code.toUpperCase(),
            characters,
            count: characters.length
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Timers ---
app.get('/api/rooms/:code/vtt/timers', authenticate, cacheMiddleware(30), (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const timers = room.data?.vtt?.timers || [];
        res.json({
            code: req.params.code.toUpperCase(),
            name: room.name,
            timers,
            count: timers.length
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.put('/api/rooms/:code/vtt/timers', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        if (!room.data) room.data = {};
        if (!room.data.vtt) room.data.vtt = {};
        
        const timers = req.body;
        if (!Array.isArray(timers)) {
            return res.status(400).json({ error: 'timers must be an array' });
        }
        
        // Validate timers
        for (const timer of timers) {
            validateTimer(timer);
        }
        
        room.data.vtt.timers = timers;
        room.lastActivity = Date.now();
        
        broadcastToRoom(req.params.code, 'vtt-timers-updated', {
            source: 'api',
            timers,
            timestamp: Date.now(),
            updatedBy: req.apiKeyData.name
        });
        
        res.json({ 
            success: true, 
            code: req.params.code.toUpperCase(),
            timers,
            count: timers.length
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Chat ---
app.get('/api/rooms/:code/chat', authenticate, cacheMiddleware(10), (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const limit = parseInt(req.query.limit) || 100;
        const history = room.chatHistory?.slice(-limit) || [];
        res.json({
            code: req.params.code.toUpperCase(),
            name: room.name,
            messages: history,
            count: history.length,
            total: room.chatHistory?.length || 0
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.post('/api/rooms/:code/chat', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const { message, sender, metadata } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        }
        
        // Check room settings
        if (!room.settings.allowChat) {
            return res.status(400).json({ error: 'Chat is disabled in this room' });
        }
        
        const filteredMessage = filterChatMessage(message);
        if (filteredMessage !== message) {
            return res.status(400).json({ error: 'Message contains blocked content' });
        }
        
        const chatMessage = {
            text: filteredMessage,
            sender: sender || req.apiKeyData.name,
            timestamp: Date.now(),
            source: 'api',
            metadata: metadata || {},
            id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        if (!room.chatHistory) room.chatHistory = [];
        room.chatHistory.push(chatMessage);
        if (room.chatHistory.length > 500) room.chatHistory.shift();
        room.lastActivity = Date.now();
        
        broadcastToRoom(req.params.code, 'chat-message', chatMessage);
        
        res.json({ 
            success: true, 
            code: req.params.code.toUpperCase(),
            message: chatMessage,
            deliveredTo: room.clients.size
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.delete('/api/rooms/:code/chat', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        
        // Check permissions
        if (req.apiKey !== API_KEY && room.owner !== req.apiKeyData.name) {
            return res.status(403).json({ error: 'Only room owner or admin can clear chat' });
        }
        
        room.chatHistory = [];
        room.lastActivity = Date.now();
        
        broadcastToRoom(req.params.code, 'chat-cleared', {
            source: 'api',
            clearedBy: req.apiKeyData.name,
            timestamp: Date.now()
        });
        
        res.json({ 
            success: true, 
            code: req.params.code.toUpperCase(),
            message: 'Chat cleared'
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// --- Dice ---
app.post('/api/rooms/:code/roll', authenticate, (req, res) => {
    try {
        const room = getRoom(req.params.code);
        const { dice, roll, reason, metadata } = req.body;
        
        // Check room settings
        if (!room.settings.allowDiceRolls) {
            return res.status(400).json({ error: 'Dice rolling is disabled in this room' });
        }
        
        // Support both 'roll' and 'dice' fields
        const rollExpr = roll || dice;
        if (!rollExpr) {
            return res.status(400).json({ error: 'roll or dice expression is required (e.g., "3d6+2")' });
        }
        
        try {
            const parsed = parseDiceExpression(rollExpr);
            const result = rollDice(parsed);
            
            const rollResult = {
                expr: rollExpr,
                result: result.total,
                total: result.total,
                rolls: result.rolls,
                modifier: result.modifier,
                type: result.type,
                reason: reason || 'Dice roll via API',
                sender: req.apiKeyData.name,
                timestamp: Date.now(),
                source: 'api',
                metadata: metadata || {},
                id: `roll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            
            room.lastActivity = Date.now();
            broadcastToRoom(req.params.code, 'roll-result', rollResult);
            
            res.json({
                success: true,
                code: req.params.code.toUpperCase(),
                ...rollResult,
                deliveredTo: room.clients.size
            });
        } catch (parseError) {
            return res.status(400).json({ error: parseError.message });
        }
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// --- Stats & Analytics ---
app.get('/api/stats', authenticate, (req, res) => {
    const totalClients = io.sockets.sockets.size;
    const totalRooms = rooms.size;
    let totalClientsInRooms = 0;
    let totalMessages = 0;
    
    for (const [code, room] of rooms) {
        totalClientsInRooms += room.clients.size;
        totalMessages += room.chatHistory?.length || 0;
    }
    
    res.json({
        server: {
            uptime: process.uptime(),
            timestamp: Date.now(),
            version: '1.2.0'
        },
        websocket: {
            connections: totalClients,
            rooms: totalRooms,
            clientsInRooms: totalClientsInRooms
        },
        rooms: Array.from(rooms.keys()).map(code => ({
            code,
            name: rooms.get(code).name,
            clients: rooms.get(code).clients.size,
            messages: rooms.get(code).chatHistory?.length || 0,
            voice: rooms.get(code).voice.size,
            created: rooms.get(code).createdAt,
            active: rooms.get(code).clients.size > 0
        })),
        api: {
            key: req.apiKey,
            keyName: req.apiKeyData.name,
            permissions: req.apiKeyData.permissions
        },
        conversion: conversionEnabled ? 'enabled' : 'disabled',
        users: {
            total: users.size,
            sessions: sessions.size
        }
    });
});

app.get('/api/analytics', authenticate, (req, res) => {
    if (req.apiKey !== API_KEY) {
        return res.status(403).json({ error: 'Analytics access forbidden' });
    }
    
    const analytics = {
        rooms: {
            total: rooms.size,
            active: Array.from(rooms.values()).filter(r => r.clients.size > 0).length,
            withVoice: Array.from(rooms.values()).filter(r => r.voice.size > 0).length,
            templates: Object.keys(ROOM_TEMPLATES)
        },
        messages: {
            total: Array.from(rooms.values()).reduce((sum, r) => sum + (r.chatHistory?.length || 0), 0),
            last24h: Array.from(rooms.values()).reduce((sum, r) => {
                const recent = r.chatHistory?.filter(msg => 
                    Date.now() - msg.timestamp < 24 * 60 * 60 * 1000
                ).length || 0;
                return sum + recent;
            }, 0)
        },
        connections: {
            total: io.sockets.sockets.size,
            rooms: Array.from(rooms.entries()).map(([code, room]) => ({
                code,
                name: room.name,
                clients: room.clients.size,
                voice: room.voice.size
            }))
        },
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: Date.now(),
            rateLimiting: ENABLE_RATE_LIMITING,
            autoCreateRooms: AUTO_CREATE_ROOMS,
            caching: ENABLE_CACHING,
            sessions: ENABLE_SESSIONS
        },
        users: {
            total: users.size,
            activeSessions: sessions.size,
            recentLogins: Array.from(users.values())
                .filter(u => u.lastLogin && Date.now() - u.lastLogin < 24 * 60 * 60 * 1000)
                .length
        }
    };
    
    res.json(analytics);
});

// --- API Key Management ---
app.post('/api/keys', authenticate, (req, res) => {
    // Only default key can create new keys
    if (req.apiKey !== API_KEY) {
        return res.status(403).json({ error: 'Only the master key can create new keys' });
    }
    
    const { name, permissions, expiresHours } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'name is required' });
    }
    
    const newKey = crypto.randomBytes(16).toString('hex');
    const keyData = {
        name: name || 'Unnamed',
        permissions: permissions || ['*'],
        createdAt: Date.now(),
        createdBy: req.apiKeyData.name
    };
    
    // Optional expiration
    if (expiresHours) {
        keyData.expiresAt = Date.now() + (expiresHours * 60 * 60 * 1000);
    }
    
    API_KEYS.set(newKey, keyData);
    
    res.status(201).json({
        key: newKey,
        name: name,
        permissions: permissions || ['*'],
        expiresAt: keyData.expiresAt,
        createdBy: req.apiKeyData.name,
        message: 'API key created successfully'
    });
});

app.delete('/api/keys/:key', authenticate, (req, res) => {
    // Only default key can delete keys
    if (req.apiKey !== API_KEY) {
        return res.status(403).json({ error: 'Only the master key can delete keys' });
    }
    
    const keyToDelete = req.params.key;
    if (keyToDelete === API_KEY) {
        return res.status(400).json({ error: 'Cannot delete the master key' });
    }
    
    if (API_KEYS.has(keyToDelete)) {
        API_KEYS.delete(keyToDelete);
        res.json({ success: true, message: 'API key deleted' });
    } else {
        res.status(404).json({ error: 'API key not found' });
    }
});

app.get('/api/keys', authenticate, (req, res) => {
    // Only default key can list keys
    if (req.apiKey !== API_KEY) {
        return res.status(403).json({ error: 'Only the master key can list keys' });
    }
    
    const keys = Array.from(API_KEYS.entries()).map(([key, data]) => ({
        key: key === API_KEY ? `${key.substring(0, 8)}... (MASTER)` : `${key.substring(0, 8)}...`,
        fullKey: key === API_KEY ? null : key, // Don't expose full key in list
        name: data.name,
        permissions: data.permissions,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        createdBy: data.createdBy
    }));
    
    res.json({ keys, count: keys.length });
});

// =============================================================
//  OPTIONAL PDF CONVERSION ENDPOINT
// =============================================================
let conversionEnabled = false;
let converterCommand = null;

// Detect available converter on startup
function detectConverter() {
    if (!ENABLE_UPLOAD) return;
    const checks = [
        { name: 'pdf2htmlEX', cmd: 'pdf2htmlEX' },
        { name: 'pdftohtml', cmd: 'pdftohtml' }
    ];
    for (const { name, cmd } of checks) {
        try {
            const result = require('child_process').execSync(`which ${cmd}`, { encoding: 'utf8' });
            if (result) {
                converterCommand = cmd;
                conversionEnabled = true;
                console.log(`✅ PDF converter detected: ${cmd}`);
                return;
            }
        } catch (e) { /* not found */ }
    }
    console.warn('⚠️ No PDF converter found. Upload endpoint disabled.');
}
detectConverter();

// Concurrency limiter (CPU-conservative)
let activeConversions = 0;
const conversionQueue = [];

function processQueue() {
    if (activeConversions >= MAX_CONCURRENT_CONVERSIONS || conversionQueue.length === 0) return;
    const { resolve, reject, inputPath, outputPath, options } = conversionQueue.shift();
    activeConversions++;
    runConversion(inputPath, outputPath, options)
        .then(resolve)
        .catch(reject)
        .finally(() => {
            activeConversions--;
            processQueue();
        });
}

function runConversion(inputPath, outputPath, options) {
    return new Promise((resolve, reject) => {
        let cmd;
        if (converterCommand === 'pdf2htmlEX') {
            cmd = `pdf2htmlEX --embed css --embed font --embed image "${inputPath}" "${outputPath}"`;
        } else if (converterCommand === 'pdftohtml') {
            cmd = `pdftohtml -s -i -noframes "${inputPath}" "${outputPath}"`;
        } else {
            return reject(new Error('No converter available'));
        }
        const child = exec(cmd, { timeout: 60000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(`Conversion failed: ${stderr || error.message}`));
            }
            resolve();
        });
    });
}

if (ENABLE_UPLOAD && conversionEnabled) {
    const multer = require('multer');
    const upload = multer({
        dest: '/tmp/uploads/',
        limits: { fileSize: UPLOAD_FILE_SIZE_LIMIT },
        fileFilter: (req, file, cb) => {
            if (file.mimetype === 'application/pdf') cb(null, true);
            else cb(new Error('Only PDF files are allowed'));
        }
    });

    app.get('/api/convert/status', (req, res) => {
        res.json({
            enabled: conversionEnabled,
            maxFileSize: UPLOAD_FILE_SIZE_LIMIT,
            converter: converterCommand,
            queueLength: conversionQueue.length,
            activeConversions: activeConversions
        });
    });

    app.post('/api/convert/pdf', authenticate, upload.single('pdf'), (req, res) => {
        if (!conversionEnabled) {
            return res.status(501).json({ error: 'Conversion not available on this server' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const inputPath = req.file.path;
        const outputPath = inputPath + '.html';

        return new Promise((resolve, reject) => {
            conversionQueue.push({
                resolve: (result) => resolve(result),
                reject: (err) => reject(err),
                inputPath,
                outputPath,
                options: {}
            });
            processQueue();
        })
        .then(() => {
            const htmlContent = fs.readFileSync(outputPath, 'utf8');
            fs.unlink(inputPath, () => {});
            fs.unlink(outputPath, () => {});
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(htmlContent);
        })
        .catch(err => {
            fs.unlink(inputPath, () => {});
            fs.unlink(outputPath, () => {});
            res.status(500).json({ error: err.message });
        });
    });
} else {
    app.get('/api/convert/status', (req, res) => {
        res.json({ enabled: false });
    });
    app.post('/api/convert/pdf', authenticate, (req, res) => {
        res.status(501).json({ error: 'PDF conversion not enabled on this server' });
    });
}

// ===== WebSocket Handlers =====
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    },
    maxHttpBufferSize: 1e8,
    pingTimeout: WEBSOCKET_PING_TIMEOUT,
    pingInterval: WEBSOCKET_PING_INTERVAL,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    ...(ENABLE_WEBSOCKET_COMPRESSION ? { 
        compression: true 
    } : {})
});

io.use((socket, next) => {
    const apiKey = socket.handshake.auth.token || socket.handshake.headers['x-api-key'];
    if (!apiKey) {
        return next(new Error('Authentication error: API key required'));
    }
    
    const keyData = API_KEYS.get(apiKey);
    if (!keyData) {
        return next(new Error('Authentication error: Invalid API key'));
    }
    
    if (keyData.expiresAt && Date.now() > keyData.expiresAt) {
        return next(new Error('Authentication error: API key expired'));
    }
    
    socket.apiKey = apiKey;
    socket.apiKeyData = keyData;
    next();
});

io.on('connection', (socket) => {
    logger.info('Client connected:', socket.id);
    socket.clientData = {};
    socket.lastPing = Date.now();
    socket.authenticated = true;

    // Ping/Pong for connection health
    if (ENABLE_WEBSOCKET_HEARTBEAT) {
        const pingInterval = setInterval(() => {
            if (Date.now() - socket.lastPing > WEBSOCKET_PING_TIMEOUT) { // 60 second timeout
                logger.info('Client ping timeout:', socket.id);
                socket.disconnect();
                return;
            }
            socket.emit('ping');
        }, WEBSOCKET_PING_INTERVAL);

        socket.on('pong', () => {
            socket.lastPing = Date.now();
        });

        socket.on('disconnect', () => {
            clearInterval(pingInterval);
        });
    }

    socket.on('join-room', (roomCode, clientData, password) => {
        if (!socket.authenticated) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        const code = roomCode.toUpperCase();
        let room = rooms.get(code);
        
        if (!room) {
            // Auto-create room if enabled
            if (AUTO_CREATE_ROOMS) {
                room = {
                    data: {},
                    clients: new Set(),
                    voice: new Set(),
                    chatHistory: [],
                    createdAt: Date.now(),
                    lastActivity: Date.now(),
                    name: `Room ${code}`,
                    maxClients: 20,
                    owner: socket.apiKeyData.name,
                    settings: {
                        allowVoice: true,
                        allowDiceRolls: true,
                        allowChat: true,
                        maxMessageLength: 2000,
                        autoDeleteAfter: 3600000
                    }
                };
                rooms.set(code, room);
                logger.info(`Auto-created room: ${code}`);
            } else {
                socket.emit('error', { message: 'Room not found' });
                return;
            }
        }
        
        // Check password if required
        if (room.password) {
            if (!password) {
                socket.emit('error', { message: 'Room requires password' });
                return;
            }
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            if (hashedPassword !== room.password) {
                socket.emit('error', { message: 'Invalid password' });
                return;
            }
        }
        
        // Check client limit
        if (room.maxClients && room.clients.size >= room.maxClients) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }
        
        // Leave current room if any
        if (socket.room) {
            socket.leave(socket.room);
            const oldRoom = rooms.get(socket.room);
            if (oldRoom) {
                oldRoom.clients.delete(socket.id);
                oldRoom.voice.delete(socket.id);
                io.to(socket.room).emit('client-left', {
                    id: socket.id,
                    name: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                });
            }
        }
        
        // Join new room
        socket.join(code);
        socket.room = code;
        socket.clientData = clientData || { name: socket.apiKeyData.name || 'Player' };
        room.clients.add(socket.id);
        room.lastActivity = Date.now();

        socket.emit('room-state', {
            data: room.data,
            clients: getRoomClients(code),
            chatHistory: room.chatHistory?.slice(-50) || [],
            name: room.name,
            createdAt: room.createdAt,
            hasPassword: !!room.password,
            settings: room.settings
        });
        
        socket.to(code).emit('client-joined', {
            id: socket.id,
            data: socket.clientData,
            timestamp: Date.now()
        });
        
        logger.info(`Client ${socket.id} (${socket.clientData.name}) joined room ${code}`);
    });

    socket.on('get-clients', (roomCode, callback) => {
        if (!socket.authenticated) return;
        const code = roomCode || socket.room;
        if (!code) { callback([]); return; }
        const room = rooms.get(code);
        if (!room) { callback([]); return; }
        const clients = getRoomClients(code);
        callback(clients);
    });

    socket.on('sync-state', (state) => {
        if (!socket.authenticated || !socket.room) return;
        const room = rooms.get(socket.room);
        if (!room) return;
        room.data = { ...room.data, ...state };
        room.lastActivity = Date.now();
        io.to(socket.room).emit('state-updated', {
            clientId: socket.id,
            clientName: socket.clientData?.name || 'Player',
            state: room.data
        });
    });

    socket.on('event', (event) => {
        if (!socket.authenticated || !socket.room) return;
        const room = rooms.get(socket.room);
        if (!room) return;
        io.to(socket.room).emit('event', {
            clientId: socket.id,
            clientName: socket.clientData?.name || 'Player',
            event
        });
        room.lastActivity = Date.now();
    });

    socket.on('chat-message', (message) => {
        if (!socket.authenticated || !socket.room) return;
        
        try {
            const room = rooms.get(socket.room);
            if (!room) return;
            
            // Check room settings
            if (!room.settings.allowChat) {
                socket.emit('error', { message: 'Chat is disabled in this room' });
                return;
            }
            
            const filteredMessage = filterChatMessage(message.text);
            if (filteredMessage !== message.text) {
                socket.emit('error', { message: 'Message contains blocked content' });
                return;
            }
            
            const chatMessage = {
                text: filteredMessage,
                sender: socket.clientData?.name || socket.apiKeyData.name || 'Player',
                timestamp: Date.now(),
                clientId: socket.id,
                id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            
            if (!room.chatHistory) room.chatHistory = [];
            room.chatHistory.push(chatMessage);
            if (room.chatHistory.length > 200) room.chatHistory.shift();
            room.lastActivity = Date.now();
            io.to(socket.room).emit('chat-message', chatMessage);
        } catch (error) {
            logger.error('Error handling chat message:', error);
        }
    });

    socket.on('roll-dice', (rollData) => {
        if (!socket.authenticated || !socket.room) return;
        
        try {
            const room = rooms.get(socket.room);
            if (!room) return;
            
            // Check room settings
            if (!room.settings.allowDiceRolls) {
                socket.emit('error', { message: 'Dice rolling is disabled in this room' });
                return;
            }
            
            const rollExpr = rollData.roll || rollData.dice;
            if (!rollExpr) {
                socket.emit('error', { message: 'Roll expression required' });
                return;
            }
            
            const parsed = parseDiceExpression(rollExpr);
            const result = rollDice(parsed);
            
            const rollResult = {
                expr: rollExpr,
                result: result.total,
                total: result.total,
                rolls: result.rolls,
                modifier: result.modifier,
                type: result.type,
                reason: rollData.reason || 'Dice roll',
                sender: socket.clientData?.name || socket.apiKeyData.name || 'Player',
                timestamp: Date.now(),
                clientId: socket.id,
                id: `roll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            
            io.to(socket.room).emit('roll-result', rollResult);
            room.lastActivity = Date.now();
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('voice-offer', (data) => {
        if (!socket.authenticated || !socket.room) return;
        const room = rooms.get(socket.room);
        if (!room) return;
        
        // Check room settings
        if (!room.settings.allowVoice) {
            socket.emit('error', { message: 'Voice chat is disabled in this room' });
            return;
        }
        
        socket.to(socket.room).emit('voice-offer', { from: socket.id, ...data });
        room.lastActivity = Date.now();
    });

    socket.on('voice-answer', (data) => {
        if (!socket.authenticated || !socket.room) return;
        const room = rooms.get(socket.room);
        if (!room) return;
        socket.to(socket.room).emit('voice-answer', { from: socket.id, ...data });
        room.lastActivity = Date.now();
    });

    socket.on('voice-ice-candidate', (data) => {
        if (!socket.authenticated || !socket.room) return;
        const room = rooms.get(socket.room);
        if (!room) return;
        socket.to(socket.room).emit('voice-ice-candidate', { from: socket.id, ...data });
        room.lastActivity = Date.now();
    });

    socket.on('voice-toggle', (enabled) => {
        if (!socket.authenticated || !socket.room) return;
        const room = rooms.get(socket.room);
        if (!room) return;
        
        // Check room settings
        if (!room.settings.allowVoice) {
            socket.emit('error', { message: 'Voice chat is disabled in this room' });
            return;
        }
        
        if (enabled) {
            room.voice.add(socket.id);
        } else {
            room.voice.delete(socket.id);
        }
        room.lastActivity = Date.now();
        io.to(socket.room).emit('voice-status', {
            clientId: socket.id,
            clientName: socket.clientData?.name || 'Player',
            enabled
        });
    });

    socket.on('disconnect', () => {
        if (socket.room) {
            const room = rooms.get(socket.room);
            if (room) {
                room.clients.delete(socket.id);
                room.voice.delete(socket.id);
                io.to(socket.room).emit('client-left', {
                    id: socket.id,
                    name: socket.clientData?.name || 'Player',
                    timestamp: Date.now()
                });
                logger.info(`Client ${socket.id} left room ${socket.room}`);
            }
        }
        logger.info('Client disconnected:', socket.id);
    });
});

// Cleanup empty rooms
setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
        const autoDeleteAfter = room.settings?.autoDeleteAfter || 3600000; // Default 1 hour
        if (room.clients.size === 0 && (now - room.lastActivity) > autoDeleteAfter) {
            rooms.delete(code);
            logger.info(`Cleaned up empty/inactive room: ${code}`);
        }
    }
}, 300000); // 5 minutes

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        rooms: rooms.size,
        connections: io.sockets.sockets.size,
        timestamp: Date.now(),
        conversion: conversionEnabled ? 'enabled' : 'disabled',
        api: {
            keys: API_KEYS.size,
            defaultKey: API_KEY ? `${API_KEY.substring(0, 8)}...` : 'none'
        },
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid,
            nodeVersion: process.version
        },
        features: {
            caching: ENABLE_CACHING,
            sessions: ENABLE_SESSIONS,
            rateLimiting: ENABLE_RATE_LIMITING,
            websocketCompression: ENABLE_WEBSOCKET_COMPRESSION
        }
    });
});

// CLI-friendly status endpoint
app.get('/api/status', (req, res) => {
    const status = {
        server: {
            status: 'running',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            version: '1.2.0'
        },
        rooms: {
            total: rooms.size,
            active: Array.from(rooms.values()).filter(r => r.clients.size > 0).length
        },
        connections: {
            websocket: io.sockets.sockets.size,
            rooms: Array.from(rooms.entries()).map(([code, room]) => ({
                code,
                clients: room.clients.size,
                name: room.name
            }))
        },
        features: {
            conversion: conversionEnabled,
            rateLimiting: ENABLE_RATE_LIMITING,
            autoCreateRooms: AUTO_CREATE_ROOMS,
            caching: ENABLE_CACHING,
            sessions: ENABLE_SESSIONS
        },
        users: {
            total: users.size,
            sessions: sessions.size
        }
    };
    
    res.json(status);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Fate's Edge Server running on http://localhost:${PORT}`);
    console.log(`📊 Rooms: ${rooms.size}`);
    console.log(`🔑 Default API Key: ${API_KEY.substring(0, 8)}...`);
    console.log(`🔁 Conversion: ${conversionEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🛡️  Rate Limiting: ${ENABLE_RATE_LIMITING ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🚪 Auto Create Rooms: ${AUTO_CREATE_ROOMS ? 'ENABLED' : 'DISABLED'}`);
    console.log(`キャッシング Caching: ${ENABLE_CACHING ? 'ENABLED' : 'DISABLED'}`);
    console.log(`👥 Sessions: ${ENABLE_SESSIONS ? 'ENABLED' : 'DISABLED'}`);
    console.log(`\n📖 API Docs: http://localhost:${PORT}/api/docs`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`📊 CLI Status: http://localhost:${PORT}/api/status`);
});