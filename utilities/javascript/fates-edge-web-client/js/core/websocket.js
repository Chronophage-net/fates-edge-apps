/**
 * WebSocket Client Module
 * Handles real-time communication with the server
 * Supports both Socket.io and plain WebSocket modes with SSL compatibility
 * 
 * Server supports:
 * - Socket.io (primary, with callbacks)
 * - Plain WebSocket (fallback, with message types)
 * - Deck operations (draw, shuffle, crown spread)
 * - Module management (push, cleanup, list)
 * - Voice chat support
 * - State sync
 * - Room management
 * - Media recording broadcasts
 * - Whiteboard sync (whiteboard-update, sync-request)
 */

import { getState, importData, saveState, updateState } from './state.js';
import { showToast } from '../components/Toast.js';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    get DEFAULT_WS_URL() {
        const isSecure = window.location.protocol === 'https:';
        return isSecure 
            ? 'wss://fates-edge-ws.onrender.com'
            : 'ws://localhost:10000';
    },
    get DEFAULT_SOCKET_URL() {
        const isSecure = window.location.protocol === 'https:';
        return isSecure
            ? 'https://fates-edge-ws.onrender.com'
            : 'http://localhost:10000';
    },
    DEFAULT_ROOM: 'vtt-room',
    MAX_RECONNECT: 5,
    RECONNECT_INTERVAL: 3000,
    CONNECTION_TIMEOUT: 10000
};

// ============================================================
// STATE
// ============================================================

let socket = null;          // Socket.io instance
let ws = null;              // Plain WebSocket instance
let roomCode = null;
let isConnected = false;
let reconnectAttempts = 0;
let socketId = null;
let connectionMode = 'websocket'; // 'socketio' or 'websocket'
let reconnectTimer = null;
let wsStatus = 'disconnected';
let connectionPromise = null;
let pendingCallbacks = new Map(); // For request/response patterns

// Event callbacks
const eventHandlers = {
    // Core events
    'state-updated': [],
    'chat-message': [],
    'roll-result': [],
    'event': [],
    'connected': [],
    'disconnected': [],
    'error': [],
    
    // Room events
    'room-joined': [],
    'room-state': [],
    'player-joined': [],
    'player-left': [],
    'room-closed': [],
    
    // Deck events
    'deck-drawn': [],
    'deck-shuffled': [],
    'crown-spread': [],
    'deck-history': [],
    'deck-history-cleared': [],
    
    // Module events
    'module-push': [],
    'module-cleanup': [],
    
    // Voice events
    'voice-offer': [],
    'voice-answer': [],
    'voice-ice-candidate': [],
    'voice-status': [],

    // Media events
    'media_recording': [],

    // GM and VTT events
    'module-list': [],
    'region-updated': [],
    'presence': [],
    'gm_vote_request': [],
    'gm_role_update': [],
    'server_announcement': [],

    // Whiteboard sync events
    'whiteboard-update': [],
    'sync-request': []
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get WebSocket configuration from settings
 */
function getWSConfig() {
    const state = getState();
    const settings = state.settings || {};
    
    const isSecure = window.location.protocol === 'https:';
    const defaultUrl = isSecure 
        ? 'wss://fates-edge-ws.onrender.com'
        : 'ws://localhost:10000';
    
    return {
        url: settings.wsUrl || localStorage.getItem('fates-edge-ws-url') || defaultUrl,
        room: settings.wsRoom || localStorage.getItem('fates-edge-ws-room') || CONFIG.DEFAULT_ROOM,
        reconnect: settings.wsReconnect !== false && localStorage.getItem('fates-edge-ws-reconnect') !== 'false',
        reconnectInterval: settings.wsReconnectInterval || parseInt(localStorage.getItem('fates-edge-ws-interval') || String(CONFIG.RECONNECT_INTERVAL), 10),
        enabled: settings.wsEnabled !== false && localStorage.getItem('fates-edge-ws-enabled') !== 'false',
        mode: settings.wsMode || localStorage.getItem('fates-edge-ws-mode') || 'websocket'
    };
}

/**
 * Generate unique request ID for callbacks
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Normalize WebSocket URL
 */
function normalizeWSURL(url, room) {
    let normalized = url.trim();
    const isSecure = window.location.protocol === 'https:';
    
    if (!normalized.startsWith('ws://') && !normalized.startsWith('wss://')) {
        normalized = (isSecure ? 'wss://' : 'ws://') + normalized;
    }
    
    normalized = normalized.replace(/\/+$/, '');
    
    if (room) {
        const separator = normalized.includes('?') ? '&' : '?';
        normalized += `${separator}room=${room}`;
    }
    
    return normalized;
}

/**
 * Normalize Socket.io URL
 */
function normalizeSocketURL(url) {
    let normalized = url.trim();
    const isSecure = window.location.protocol === 'https:';
    
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = (isSecure ? 'https://' : 'http://') + normalized;
    }
    
    normalized = normalized.replace(/\/+$/, '');
    return normalized;
}

// ============================================================
// STATE (add these near the top)
// ============================================================

let currentServerUrl = null;   // e.g., "ws://foobar:12345" or "https://..."
let cachedApiBase = null;      // computed HTTP API base URL

// Helper to get API port override (from config, env, or localStorage)
function getApiPortOverride() {
    // Try environment variable, then localStorage, then fallback to null
    const port = import.meta.env?.VITE_API_PORT || localStorage.getItem('fates-edge-api-port');
    return port ? parseInt(port, 10) : null;
}

// ============================================================
// PLAIN WEBSOCKET MODE
// ============================================================

/**
 * Connect to WebSocket server (plain WebSocket mode)
 */
export function connectWebSocket(room = null, url = null) {
    const config = getWSConfig();
    
    // Close existing connection
    if (ws) {
        ws.close();
        ws = null;
    }
    clearTimeout(reconnectTimer);
    
    const roomName = room || config.room;
    const wsUrl = url || config.url;
    const fullUrl = normalizeWSURL(wsUrl, roomName);
    
    try {
        ws = new WebSocket(fullUrl);
        wsStatus = 'connecting';
        connectionMode = 'websocket';
        
        const timeoutId = setTimeout(() => {
            if (ws && ws.readyState !== WebSocket.OPEN) {
                ws.close();
                wsStatus = 'timeout';
                triggerEvent('error', { message: 'Connection timeout' });
                showToast('WebSocket connection timeout', 'error');
            }
        }, CONFIG.CONNECTION_TIMEOUT);
        
        ws.onopen = () => {
            clearTimeout(timeoutId);
            console.log('🔗 WebSocket connected to:', fullUrl);
            reconnectAttempts = 0;
            wsStatus = 'connected';
            isConnected = true;
            roomCode = roomName;
            currentServerUrl = ws.url;          // Store the full WebSocket URL
            cachedApiBase = null;

            socketId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            
            const state = getState();
            state.wsStatus = 'connected';
            state.wsRoom = roomName;
            state.wsSocketId = socketId;
            updateState(state);
            
            let pingInterval = null;

            // Start keep‑alive pings
            if (pingInterval) clearInterval(pingInterval);
            pingInterval = setInterval(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                }
            }, 30000); // 30 seconds

            // Also reset any reconnect timer
            clearTimeout(reconnectTimer);
            reconnectAttempts = 0;
            
            triggerEvent('connected', { 
                socketId, 
                room: roomName,
                mode: 'websocket',
                url: fullUrl
            });
            
            showToast('Connected to server', 'success');
        };
        
        ws.onclose = (event) => {
            clearInterval(pingInterval);
            clearTimeout(timeoutId);
            console.log('🔌 WebSocket disconnected:', event.code, event.reason);
            wsStatus = 'disconnected';
            isConnected = false;
            
            const state = getState();
            state.wsStatus = 'disconnected';
            updateState(state);
            
            triggerEvent('disconnected', { 
                code: event.code, 
                reason: event.reason 
            });
            
            if (config.reconnect && reconnectAttempts < CONFIG.MAX_RECONNECT) {
                reconnectAttempts++;
                const delay = config.reconnectInterval * reconnectAttempts;
                console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${CONFIG.MAX_RECONNECT})...`);
                
                reconnectTimer = setTimeout(() => {
                    connectWebSocket(roomName, wsUrl);
                }, delay);
            } else if (reconnectAttempts >= CONFIG.MAX_RECONNECT) {
                console.log('❌ Max reconnect attempts reached');
                wsStatus = 'failed';
                triggerEvent('error', { message: 'Max reconnect attempts reached' });
                showToast('WebSocket reconnection failed', 'error');
            }
        };
        
        ws.onerror = (error) => {
            clearTimeout(timeoutId);
            console.error('WebSocket error:', error);
            wsStatus = 'error';
            triggerEvent('error', { error });
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };
        
        return ws;
    } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        wsStatus = 'error';
        triggerEvent('error', { error });
        return null;
    }
}

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(data) {
    const type = data.type || 'unknown';
    
    // Check for pending callbacks
    if (data.requestId && pendingCallbacks.has(data.requestId)) {
        const callback = pendingCallbacks.get(data.requestId);
        pendingCallbacks.delete(data.requestId);
        callback(data);
        return;
    }
    
    // Dispatch based on message type
    switch(type) {
        case 'connected':
            triggerEvent('connected', data);
            break;
            
        case 'room-state':
        case 'room-joined':
            triggerEvent(type, data);
            if (data.deckRemaining !== undefined) {
                const state = getState();
                state.deckRemaining = data.deckRemaining;
                updateState(state);
            }
            break;
            
        case 'deck-drawn':
            triggerEvent('deck-drawn', data);
            if (data.remaining !== undefined) {
                const state = getState();
                state.deckRemaining = data.remaining;
                updateState(state);
            }
            break;
            
        case 'deck-shuffled':
            triggerEvent('deck-shuffled', data);
            if (data.remaining !== undefined) {
                const state = getState();
                state.deckRemaining = data.remaining;
                updateState(state);
            }
            break;
            
        case 'crown-spread':
            triggerEvent('crown-spread', data);
            if (data.remaining !== undefined) {
                const state = getState();
                state.deckRemaining = data.remaining;
                updateState(state);
            }
            break;
            
        case 'deck-history':
            triggerEvent('deck-history', data);
            break;
            
        case 'deck-history-cleared':
            triggerEvent('deck-history-cleared', data);
            break;
            
        case 'module-push':
            triggerEvent('module-push', data);
            showToast(`Module ${data.module?.manifest?.name || 'unknown'} loaded`, 'success');
            break;
            
        case 'module-cleanup':
            triggerEvent('module-cleanup', data);
            showToast(`Module ${data.moduleId || 'unknown'} unloaded`, 'info');
            break;
            
        case 'player-joined':
            triggerEvent('player-joined', data);
            if (data.clientName) {
                showToast(`Player ${data.clientName} joined`, 'success');
            }
            break;
            
        case 'player-left':
            triggerEvent('player-left', data);
            if (data.clientName) {
                showToast(`Player ${data.clientName} left`, 'info');
            }
            break;
            
        case 'chat-message':
            triggerEvent('chat-message', data);
            break;
            
        case 'roll-result':
            triggerEvent('roll-result', data);
            break;
            
        case 'state-updated':
            triggerEvent('state-updated', data);
            if (data.state) {
                importData(data.state);
            }
            break;
            
        case 'event':
            triggerEvent('event', data);
            break;

        case 'media_recording':
            triggerEvent('media_recording', data);
            break;

        // ============================================================
        // GM and VTT events
        // ============================================================
        case 'module-list':
            triggerEvent('module-list', data);
            break;

        case 'region-updated':
            triggerEvent('region-updated', data);
            break;

        case 'presence':
            triggerEvent('presence', data);
            break;

        case 'gm_vote_request':
            triggerEvent('gm_vote_request', data);
            break;

        case 'gm_role_update':
            triggerEvent('gm_role_update', data);
            break;

        case 'server_announcement':
            triggerEvent('server_announcement', data);
            if (data.message) {
                showToast(data.message, 'info');
            }
            break;

        // ============================================================
        // WHITEBOARD SYNC EVENTS
        // ============================================================
        case 'whiteboard-update':
            triggerEvent('whiteboard-update', data);
            break;

        case 'sync-request':
            triggerEvent('sync-request', data);
            break;
            
        case 'error':
            triggerEvent('error', data);
            if (data.message) {
                showToast(data.message, 'error');
            }
            break;
            
        case 'pong':
            // Keep-alive response
            break;
            
        default:
            // For any unhandled event, dispatch a custom event and also trigger the generic 'event'
            const customEvent = new CustomEvent('ws-message', { detail: data });
            document.dispatchEvent(customEvent);
            triggerEvent('event', data);
            // Optional debug: console.debug('Unhandled WebSocket event type:', type);
    }
}

/**
 * Send a message via WebSocket with optional callback
 */
export function sendWSMessage(data, callback = null) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not connected');
        if (callback) callback({ error: 'Not connected' });
        return false;
    }
    
    try {
        // Add request ID if callback provided
        if (callback) {
            const requestId = generateRequestId();
            data.requestId = requestId;
            pendingCallbacks.set(requestId, callback);
            
            // Clean up if no response after timeout
            setTimeout(() => {
                if (pendingCallbacks.has(requestId)) {
                    pendingCallbacks.delete(requestId);
                    callback({ error: 'Request timeout' });
                }
            }, 10000);
        }
        
        const message = JSON.stringify(data);
        ws.send(message);
        return true;
    } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        if (callback) callback({ error: error.message });
        return false;
    }
}

/**
 * Disconnect WebSocket
 */
export function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
    clearTimeout(reconnectTimer);
    reconnectAttempts = 0;
    wsStatus = 'disconnected';
    isConnected = false;
    socketId = null;
    roomCode = null;
    
    const state = getState();
    state.wsStatus = 'disconnected';
    updateState(state);
    
    triggerEvent('disconnected', { reason: 'manual' });
}

/**
 * Check if WebSocket is connected
 */
export function isWSConnected() {
    return isConnected && ws && ws.readyState === WebSocket.OPEN;
}

/**
 * Get WebSocket connection status
 */
export function getWSStatus() {
    return wsStatus;
}

/**
 * Test WebSocket connection
 */
export async function testWSConnection(url, room = null) {
    return new Promise((resolve) => {
        const testUrl = normalizeWSURL(url, room);
        const testWs = new WebSocket(testUrl);
        const timeout = setTimeout(() => {
            testWs.close();
            resolve({ 
                success: false, 
                error: 'Connection timeout',
                url: testUrl
            });
        }, 5000);
        
        testWs.onopen = () => {
            clearTimeout(timeout);
            testWs.close();
            resolve({ 
                success: true, 
                url: testUrl,
                protocol: testWs.protocol || 'ws'
            });
        };
        
        testWs.onerror = (error) => {
            clearTimeout(timeout);
            resolve({ 
                success: false, 
                error: error.message || 'Connection failed',
                url: testUrl
            });
        };
    });
}

// ============================================================
// SOCKET.IO MODE
// ============================================================

/**
 * Initialize Socket.io connection
 */
export function initSocketIO(serverUrl = null, options = {}) {
    return new Promise((resolve, reject) => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        clearTimeout(reconnectTimer);
        
        const config = getWSConfig();
        const url = serverUrl || config.url || CONFIG.DEFAULT_SOCKET_URL;
        const normalizedUrl = normalizeSocketURL(url);
        
        try {
            const importSocketIO = async () => {
                try {
                    const ioModule = await import('https://cdn.socket.io/4.7.2/socket.io.esm.min.js');
                    return ioModule.io || ioModule.default || ioModule;
                } catch (e) {
                    return new Promise((resolveScript) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
                        script.onload = () => {
                            resolveScript(window.io || window.socketIO || window.io);
                        };
                        script.onerror = () => {
                            reject(new Error('Failed to load Socket.io client library'));
                        };
                        document.head.appendChild(script);
                    });
                }
            };
            
            importSocketIO().then((io) => {
                const socketOptions = {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: CONFIG.MAX_RECONNECT,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    timeout: CONFIG.CONNECTION_TIMEOUT,
                    ...options
                };
                
                socket = io(normalizedUrl, socketOptions);
                connectionMode = 'socketio';
                
                socket.on('connect', () => {
                    console.log('🔗 Socket.io connected to:', normalizedUrl);
                    isConnected = true;
                    socketId = socket.id;
                    reconnectAttempts = 0;
                    wsStatus = 'connected';
                    currentServerUrl = socket.io.uri;   // e.g., "https://foobar:12345" (Socket.io uses http(s))
                    cachedApiBase = null;

                    const state = getState();
                    state.wsStatus = 'connected';
                    state.wsSocketId = socketId;
                    updateState(state);
                    
                    triggerEvent('connected', { 
                        socketId, 
                        mode: 'socketio',
                        url: normalizedUrl
                    });
                    
                    showToast('Connected to server', 'success');
                    
                    if (roomCode) {
                        joinRoom(roomCode);
                    }
                    
                    resolve(socket);
                });
                
                socket.on('connect_error', (error) => {
                    console.warn('Socket.io connection error:', error);
                    reconnectAttempts++;
                    
                    if (reconnectAttempts >= CONFIG.MAX_RECONNECT) {
                        wsStatus = 'failed';
                        triggerEvent('error', { 
                            message: 'Failed to connect to server', 
                            error 
                        });
                        showToast('Failed to connect to server', 'error');
                        reject(error);
                    }
                });
                
                socket.on('disconnect', (reason) => {
                    console.log('🔌 Socket.io disconnected:', reason);
                    isConnected = false;
                    socketId = null;
                    wsStatus = 'disconnected';
                    
                    const state = getState();
                    state.wsStatus = 'disconnected';
                    updateState(state);
                    
                    triggerEvent('disconnected', { reason });
                    
                    if (reason !== 'io client disconnect') {
                        showToast('Disconnected from server', 'warning');
                    }
                });
                
                socket.on('error', (error) => {
                    console.error('Socket.io error:', error);
                    triggerEvent('error', { error });
                    showToast(error.message || 'Server error', 'error');
                });
                
                setupSocketIOListeners();
                
            }).catch(err => {
                reject(new Error('Failed to load Socket.io: ' + err.message));
            });
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Set up Socket.io event listeners
 */
function setupSocketIOListeners() {
    if (!socket) return;
    
    // Room events
    socket.on('room-joined', (data) => {
        roomCode = data.room;
        triggerEvent('room-joined', data);
        if (data.deckRemaining !== undefined) {
            const state = getState();
            state.deckRemaining = data.deckRemaining;
            updateState(state);
        }
    });
    
    socket.on('room-state', (data) => {
        if (data && data.data) {
            importData(data.data);
            showToast('Campaign state loaded from server', 'success');
        }
        triggerEvent('room-state', data);
    });
    
    socket.on('state-updated', (data) => {
        if (data.clientId !== socket.id && data.state) {
            importData(data.state);
        }
        triggerEvent('state-updated', data);
    });
    
    // Player events
    socket.on('player-joined', (data) => {
        triggerEvent('player-joined', data);
        if (data.clientName) {
            showToast(`Player ${data.clientName} joined`, 'success');
        }
    });
    
    socket.on('player-left', (data) => {
        triggerEvent('player-left', data);
        if (data.clientName) {
            showToast(`Player ${data.clientName} left`, 'info');
        }
    });
    
    // Deck events
    socket.on('deck-drawn', (data) => {
        triggerEvent('deck-drawn', data);
        if (data.remaining !== undefined) {
            const state = getState();
            state.deckRemaining = data.remaining;
            updateState(state);
        }
    });
    
    socket.on('deck-shuffled', (data) => {
        triggerEvent('deck-shuffled', data);
        if (data.remaining !== undefined) {
            const state = getState();
            state.deckRemaining = data.remaining;
            updateState(state);
        }
    });
    
    socket.on('crown-spread', (data) => {
        triggerEvent('crown-spread', data);
        if (data.remaining !== undefined) {
            const state = getState();
            state.deckRemaining = data.remaining;
            updateState(state);
        }
    });
    
    socket.on('deck-history', (data) => {
        triggerEvent('deck-history', data);
    });
    
    socket.on('deck-history-cleared', (data) => {
        triggerEvent('deck-history-cleared', data);
    });
    
    // Module events
    socket.on('module-push', (data) => {
        triggerEvent('module-push', data);
        showToast(`Module ${data.module?.manifest?.name || 'unknown'} loaded`, 'success');
    });
    
    socket.on('module-cleanup', (data) => {
        triggerEvent('module-cleanup', data);
        showToast(`Module ${data.moduleId || 'unknown'} unloaded`, 'info');
    });
    
    // Chat and rolls
    socket.on('chat-message', (data) => {
        triggerEvent('chat-message', data);
    });
    
    socket.on('roll-result', (data) => {
        triggerEvent('roll-result', data);
    });
    
    // Voice events
    socket.on('voice-offer', (data) => {
        triggerEvent('voice-offer', data);
    });
    
    socket.on('voice-answer', (data) => {
        triggerEvent('voice-answer', data);
    });
    
    socket.on('voice-ice-candidate', (data) => {
        triggerEvent('voice-ice-candidate', data);
    });
    
    socket.on('voice-status', (data) => {
        triggerEvent('voice-status', data);
    });

    // Media events
    socket.on('media_recording', (data) => {
        triggerEvent('media_recording', data);
    });

    // ============================================================
    // GM and VTT events (Socket.io)
    // ============================================================
    socket.on('module-list', (data) => {
        triggerEvent('module-list', data);
    });

    socket.on('region-updated', (data) => {
        triggerEvent('region-updated', data);
    });

    socket.on('presence', (data) => {
        triggerEvent('presence', data);
    });

    socket.on('gm_vote_request', (data) => {
        triggerEvent('gm_vote_request', data);
    });

    socket.on('gm_role_update', (data) => {
        triggerEvent('gm_role_update', data);
    });

    socket.on('server_announcement', (data) => {
        triggerEvent('server_announcement', data);
        if (data.message) {
            showToast(data.message, 'info');
        }
    });

    // ============================================================
    // WHITEBOARD SYNC EVENTS (Socket.io)
    // ============================================================
    socket.on('whiteboard-update', (data) => {
        triggerEvent('whiteboard-update', data);
    });

    socket.on('sync-request', (data) => {
        triggerEvent('sync-request', data);
    });
    
    // Other events
    socket.on('event', (data) => {
        triggerEvent('event', data);
    });
    
    socket.on('room-closed', () => {
        triggerEvent('room-closed');
        showToast('Room closed by host', 'warning');
        isConnected = false;
        socketId = null;
        roomCode = null;
    });
}

/**
 * Join a room (Socket.io)
 */
export function joinRoom(code, clientData = {}) {
    return new Promise((resolve, reject) => {
        if (!socket || !socket.connected) {
            reject(new Error('Not connected'));
            return;
        }
        
        roomCode = code.toUpperCase();
        
        const timeout = setTimeout(() => {
            reject(new Error('Join room timeout'));
        }, CONFIG.CONNECTION_TIMEOUT);
        
        socket.emit('join-room', { 
            roomCode, 
            playerName: clientData.name || 'Player' 
        }, (response) => {
            clearTimeout(timeout);
            if (response && response.error) {
                reject(new Error(response.error));
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * Leave current room (Socket.io)
 */
export function leaveRoom() {
    if (socket && socket.connected && roomCode) {
        socket.emit('leave-room', roomCode);
        roomCode = null;
    }
}

// ============================================================
// SHARED FUNCTIONS
// ============================================================

/**
 * Register event handler
 */
export function onEvent(event, callback) {
    if (eventHandlers[event]) {
        eventHandlers[event].push(callback);
    } else {
        console.warn('Unknown event type:', event);
    }
}

/**
 * Alias for onEvent
 */
export function onWSEvent(event, callback) {
    return onEvent(event, callback);
}

/**
 * Remove event handler
 */
export function offEvent(event, callback) {
    if (eventHandlers[event]) {
        const index = eventHandlers[event].indexOf(callback);
        if (index !== -1) {
            eventHandlers[event].splice(index, 1);
        }
    }
}

/**
 * Alias for offEvent
 */
export function offWSEvent(event, callback) {
    return offEvent(event, callback);
}

/**
 * Trigger event
 */
function triggerEvent(event, data) {
    if (eventHandlers[event]) {
        eventHandlers[event].forEach(cb => {
            try {
                cb(data);
            } catch (err) {
                console.error('Event handler error:', err);
            }
        });
    }
}

/**
 * Check if connected to server
 */
export function isConnectedToServer() {
    if (connectionMode === 'socketio') {
        return isConnected && socket?.connected;
    }
    return isWSConnected();
}

/**
 * Get current room code
 */
export function getRoomCode() {
    return roomCode;
}

/**
 * Get socket ID
 */
export function getSocketId() {
    return socketId;
}

/**
 * Get connection mode
 */
export function getConnectionMode() {
    return connectionMode;
}

/**
 * Get connected clients in room
 */
export function getConnectedClients() {
    return new Promise((resolve) => {
        if (connectionMode === 'socketio') {
            if (!socket || !socket.connected || !roomCode) {
                resolve([]);
                return;
            }
            socket.emit('get-clients', (clients) => {
                resolve(clients || []);
            });
            setTimeout(() => resolve([]), 2000);
        } else {
            // Plain WebSocket - send request
            sendWSMessage({ type: 'get-clients', room: roomCode }, (response) => {
                resolve(response.clients || []);
            });
            setTimeout(() => resolve([]), 2000);
        }
    });
}

/**
 * Send a message (shared)
 */
export function sendMessage(data) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected) {
            console.warn('Cannot send message: not connected to server');
            return false;
        }
        socket.emit('message', data);
        return true;
    } else {
        return sendWSMessage(data);
    }
}

/**
 * Sync state to server (shared)
 */
export function syncState(state) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected || !roomCode) {
            console.warn('Cannot sync: not connected to server');
            return false;
        }
        socket.emit('sync-state', state);
        return true;
    } else {
        return sendWSMessage({ 
            type: 'sync-state', 
            state, 
            socketId, 
            room: roomCode 
        });
    }
}

/**
 * Send chat message (shared)
 */
export function sendChatMessage(message) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected || !roomCode) {
            console.warn('Cannot send chat: not connected to server');
            return false;
        }
        socket.emit('chat-message', { message, room: roomCode });
        return true;
    } else {
        return sendWSMessage({ 
            type: 'chat-message', 
            message, 
            socketId, 
            room: roomCode 
        });
    }
}

/**
 * Send dice roll (shared)
 */
export function sendRoll(rollData) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected || !roomCode) {
            console.warn('Cannot send roll: not connected to server');
            return false;
        }
        socket.emit('roll-dice', { ...rollData, room: roomCode });
        return true;
    } else {
        return sendWSMessage({ 
            type: 'roll-result', 
            ...rollData, 
            socketId, 
            room: roomCode 
        });
    }
}

/**
 * Send custom event (shared)
 */
export function sendEvent(eventData) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected || !roomCode) {
            console.warn('Cannot send event: not connected to server');
            return false;
        }
        socket.emit('event', { ...eventData, room: roomCode });
        return true;
    } else {
        return sendWSMessage({ 
            type: 'event', 
            ...eventData, 
            socketId, 
            room: roomCode 
        });
    }
}

/**
 * Send media broadcast (shared)
 */
export function sendMediaBroadcast(data) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected || !roomCode) {
            return false;
        }
        socket.emit('media_recording', { ...data, room: roomCode });
        return true;
    } else {
        return sendWSMessage({ 
            type: 'media_recording', 
            ...data, 
            socketId, 
            room: roomCode 
        });
    }
}

/**
 * Returns the HTTP API base URL (e.g., "http://foobar:1000/api")
 * derived from the WebSocket/Socket.io connection URL.
 * Falls back to an empty string (relative path) if not connected.
 */
export function getApiBaseUrl() {
    if (cachedApiBase !== null) return cachedApiBase;

    if (!currentServerUrl) {
        // Not connected – fallback to relative path
        cachedApiBase = '';
        return cachedApiBase;
    }

    try {
        const url = new URL(currentServerUrl);
        
        // Convert ws(s) → http(s)
        url.protocol = url.protocol.replace('ws', 'http');
        
        // Override port if configured
        const apiPort = getApiPortOverride();
        if (apiPort !== null) {
            url.port = String(apiPort);
        }
        
        // Append '/api' (or adjust if your API uses a different path)
        url.pathname = '/api';
        
        cachedApiBase = url.toString().replace(/\/$/, '');
        return cachedApiBase;
    } catch (e) {
        console.warn('[WebSocket] Failed to derive API base URL:', e);
        cachedApiBase = '';
        return cachedApiBase;
    }
}

// ============================================================
// DECK OPERATIONS
// ============================================================

/**
 * Draw cards from deck
 */
export function drawCards(count = 1, region = 'Acasia') {
    return new Promise((resolve) => {
        const data = { count, region };
        
        if (connectionMode === 'socketio') {
            if (!socket || !socket.connected || !roomCode) {
                resolve({ error: 'Not connected' });
                return;
            }
            socket.emit('deck-draw', data, (response) => {
                resolve(response);
            });
            setTimeout(() => resolve({ error: 'Timeout' }), 10000);
        } else {
            sendWSMessage({ 
                type: 'deck-draw', 
                ...data, 
                socketId, 
                room: roomCode 
            }, (response) => {
                resolve(response);
            });
        }
    });
}

/**
 * Shuffle deck
 */
export function shuffleDeck() {
    return new Promise((resolve) => {
        if (connectionMode === 'socketio') {
            if (!socket || !socket.connected || !roomCode) {
                resolve({ error: 'Not connected' });
                return;
            }
            socket.emit('deck-shuffle', (response) => {
                resolve(response);
            });
            setTimeout(() => resolve({ error: 'Timeout' }), 10000);
        } else {
            sendWSMessage({ 
                type: 'deck-shuffle', 
                socketId, 
                room: roomCode 
            }, (response) => {
                resolve(response);
            });
        }
    });
}

/**
 * Draw crown spread
 */
export function drawCrownSpread(region = 'Acasia') {
    return new Promise((resolve) => {
        const data = { region };
        
        if (connectionMode === 'socketio') {
            if (!socket || !socket.connected || !roomCode) {
                resolve({ error: 'Not connected' });
                return;
            }
            socket.emit('crown-spread', data, (response) => {
                resolve(response);
            });
            setTimeout(() => resolve({ error: 'Timeout' }), 10000);
        } else {
            sendWSMessage({ 
                type: 'crown-spread', 
                ...data, 
                socketId, 
                room: roomCode 
            }, (response) => {
                resolve(response);
            });
        }
    });
}

/**
 * Get deck history
 */
export function getDeckHistory() {
    return new Promise((resolve) => {
        if (connectionMode === 'socketio') {
            if (!socket || !socket.connected || !roomCode) {
                resolve({ error: 'Not connected' });
                return;
            }
            socket.emit('deck-history', (response) => {
                resolve(response);
            });
            setTimeout(() => resolve({ error: 'Timeout' }), 5000);
        } else {
            sendWSMessage({ 
                type: 'deck-history', 
                socketId, 
                room: roomCode 
            }, (response) => {
                resolve(response);
            });
        }
    });
}

/**
 * Clear deck history
 */
export function clearDeckHistory() {
    return new Promise((resolve) => {
        if (connectionMode === 'socketio') {
            if (!socket || !socket.connected || !roomCode) {
                resolve({ error: 'Not connected' });
                return;
            }
            socket.emit('deck-history-clear', (response) => {
                resolve(response);
            });
            setTimeout(() => resolve({ error: 'Timeout' }), 5000);
        } else {
            sendWSMessage({ 
                type: 'deck-history-clear', 
                socketId, 
                room: roomCode 
            }, (response) => {
                resolve(response);
            });
        }
    });
}

// ============================================================
// MODULE OPERATIONS
// ============================================================

/**
 * Request module push
 */
export function requestModulePush(moduleId) {
    return new Promise((resolve) => {
        const data = { moduleId };
        
        if (connectionMode === 'socketio') {
            if (!socket || !socket.connected) {
                resolve({ error: 'Not connected' });
                return;
            }
            socket.emit('module-push-request', data, (response) => {
                resolve(response);
            });
            setTimeout(() => resolve({ error: 'Timeout' }), 10000);
        } else {
            sendWSMessage({ 
                type: 'module-push-request', 
                ...data, 
                socketId, 
                room: roomCode 
            }, (response) => {
                resolve(response);
            });
        }
    });
}

/**
 * Request module cleanup
 */
export function requestModuleCleanup(moduleId) {
    return new Promise((resolve) => {
        const data = { moduleId };
        
        if (connectionMode === 'socketio') {
            if (!socket || !socket.connected) {
                resolve({ error: 'Not connected' });
                return;
            }
            socket.emit('module-cleanup-request', data, (response) => {
                resolve(response);
            });
            setTimeout(() => resolve({ error: 'Timeout' }), 5000);
        } else {
            sendWSMessage({ 
                type: 'module-cleanup-request', 
                ...data, 
                socketId, 
                room: roomCode 
            }, (response) => {
                resolve(response);
            });
        }
    });
}

/**
 * List available modules
 */
export function listModules() {
    return new Promise((resolve) => {
        if (connectionMode === 'socketio') {
            if (!socket || !socket.connected) {
                resolve({ error: 'Not connected' });
                return;
            }
            socket.emit('module-list', (response) => {
                resolve(response);
            });
            setTimeout(() => resolve({ error: 'Timeout' }), 5000);
        } else {
            sendWSMessage({ 
                type: 'module-list', 
                socketId, 
                room: roomCode 
            }, (response) => {
                resolve(response);
            });
        }
    });
}

// ============================================================
// VOICE OPERATIONS
// ============================================================

/**
 * Send voice offer
 */
export function sendVoiceOffer(data) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected) return false;
        socket.emit('voice-offer', data);
        return true;
    } else {
        return sendWSMessage({ type: 'voice-offer', ...data, socketId, room: roomCode });
    }
}

/**
 * Send voice answer
 */
export function sendVoiceAnswer(data) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected) return false;
        socket.emit('voice-answer', data);
        return true;
    } else {
        return sendWSMessage({ type: 'voice-answer', ...data, socketId, room: roomCode });
    }
}

/**
 * Send ICE candidate
 */
export function sendVoiceICECandidate(data) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected) return false;
        socket.emit('voice-ice-candidate', data);
        return true;
    } else {
        return sendWSMessage({ type: 'voice-ice-candidate', ...data, socketId, room: roomCode });
    }
}

/**
 * Send voice status
 */
export function sendVoiceStatus(data) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected) return false;
        socket.emit('voice-status', data);
        return true;
    } else {
        return sendWSMessage({ type: 'voice-status', ...data, socketId, room: roomCode });
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize WebSocket with settings (auto-detect mode)
 */
export function initWebSocket(options = {}) {
    const config = getWSConfig();
    
    if (!config.enabled) {
        console.log('🔇 WebSocket disabled in settings');
        wsStatus = 'disabled';
        return null;
    }
    
    const mode = options.mode || config.mode || 'websocket';
    
    if (mode === 'socketio') {
        return initSocketIO(config.url, options).catch(err => {
            console.error('Socket.io init failed, falling back to WebSocket:', err);
            return connectWebSocket(config.room, config.url);
        });
    } else {
        return connectWebSocket(config.room, config.url);
    }
}

// ============================================================
// AUTO-CONNECT ON PAGE LOAD
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const config = getWSConfig();
    if (config.enabled && config.mode !== 'socketio') {
        setTimeout(() => {
            initWebSocket();
        }, 1000);
    }
});

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
    // Plain WebSocket
    connectWebSocket,
    disconnectWebSocket,
    isWSConnected,
    getWSStatus,
    testWSConnection,
    sendWSMessage,
    
    // Socket.io
    initSocketIO,
    joinRoom,
    leaveRoom,
    
    // Shared
    initWebSocket,
    onEvent,
    onWSEvent,
    offEvent,
    offWSEvent,
    isConnectedToServer,
    getRoomCode,
    getSocketId,
    getConnectionMode,
    sendMessage,
    syncState,
    sendChatMessage,
    sendRoll,
    sendEvent,
    getConnectedClients,
    getApiBaseUrl,
    sendMediaBroadcast,
    
    // Deck operations (now return Promises)
    drawCards,
    shuffleDeck,
    drawCrownSpread,
    getDeckHistory,
    clearDeckHistory,
    
    // Module operations (now return Promises)
    requestModulePush,
    requestModuleCleanup,
    listModules,
    
    // Voice operations
    sendVoiceOffer,
    sendVoiceAnswer,
    sendVoiceICECandidate,
    sendVoiceStatus
};