/**
 * WebSocket Client Module
 * Handles real-time communication with the server
 * Supports both Socket.io and plain WebSocket modes
 */

import { getState, importData, saveState, updateState } from './state.js';
import { showToast } from '../components/Toast.js';

let socket = null;
let roomCode = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;
let socketId = null;
let connectionMode = 'websocket'; // 'socketio' or 'websocket'

// Event callbacks
const eventHandlers = {
    'state-updated': [],
    'chat-message': [],
    'roll-result': [],
    'event': [],
    'voice-offer': [],
    'voice-answer': [],
    'voice-ice-candidate': [],
    'voice-status': [],
    'client-joined': [],
    'client-left': [],
    'room-closed': [],
    'room-state': [],
    'connected': [],
    'disconnected': [],
    'error': []
};

// ============================================================
// PLAIN WEBSOCKET MODE (for settings)
// ============================================================

let ws = null;
let wsReconnectTimer = null;
let wsReconnectAttempts = 0;
const MAX_WS_RECONNECT = 5;
let wsStatus = 'disconnected';

/**
 * Get WebSocket configuration from settings
 */
function getWSConfig() {
    const state = getState();
    const settings = state.settings || {};
    
    return {
        url: settings.wsUrl || localStorage.getItem('fates-edge-ws-url') || 'wss://fates-edge-ws.onrender.com',
        room: settings.wsRoom || localStorage.getItem('fates-edge-ws-room') || 'vtt-room',
        reconnect: settings.wsReconnect !== false && localStorage.getItem('fates-edge-ws-reconnect') !== 'false',
        reconnectInterval: settings.wsReconnectInterval || parseInt(localStorage.getItem('fates-edge-ws-interval') || '3000', 10),
        enabled: settings.wsEnabled !== false && localStorage.getItem('fates-edge-ws-enabled') !== 'false'
    };
}

/**
 * Connect to WebSocket server (plain WebSocket mode)
 */
export function connectWebSocket(room = null) {
    const config = getWSConfig();
    
    if (!config.enabled) {
        console.log('🔇 WebSocket disabled in settings');
        wsStatus = 'disabled';
        return null;
    }
    
    // Close existing connection
    if (ws) {
        ws.close();
        ws = null;
    }
    
    const roomName = room || config.room;
    const url = `${config.url}?room=${roomName}`;
    
    try {
        ws = new WebSocket(url);
        wsStatus = 'connecting';
        connectionMode = 'websocket';
        
        ws.onopen = () => {
            console.log('🔗 WebSocket connected to:', config.url);
            wsReconnectAttempts = 0;
            wsStatus = 'connected';
            isConnected = true;
            clearTimeout(wsReconnectTimer);
            
            // Generate socket ID
            socketId = 'ws_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            roomCode = roomName;
            
            // Update connection status in state
            const state = getState();
            state.wsStatus = 'connected';
            state.wsRoom = roomName;
            state.wsSocketId = socketId;
            updateState(state);
            
            triggerEvent('connected', { socketId, room: roomName });
        };
        
        ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            wsStatus = 'disconnected';
            isConnected = false;
            
            // Update connection status in state
            const state = getState();
            state.wsStatus = 'disconnected';
            updateState(state);
            
            triggerEvent('disconnected', {});
            
            if (config.reconnect && wsReconnectAttempts < MAX_WS_RECONNECT) {
                wsReconnectAttempts++;
                const delay = config.reconnectInterval * wsReconnectAttempts;
                console.log(`🔄 Reconnecting in ${delay}ms (attempt ${wsReconnectAttempts}/${MAX_WS_RECONNECT})...`);
                
                wsReconnectTimer = setTimeout(() => {
                    connectWebSocket(room);
                }, delay);
            } else if (wsReconnectAttempts >= MAX_WS_RECONNECT) {
                console.log('❌ Max reconnect attempts reached');
                wsStatus = 'failed';
                triggerEvent('error', { message: 'Max reconnect attempts reached' });
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            wsStatus = 'error';
            
            // Update connection status in state
            const state = getState();
            state.wsStatus = 'error';
            updateState(state);
            
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
        return null;
    }
}

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(data) {
    // Dispatch to appropriate handlers
    if (data.type === 'chat' || data.type === 'chat-message') {
        triggerEvent('chat-message', data);
    } else if (data.type === 'roll' || data.type === 'roll-result') {
        triggerEvent('roll-result', data);
    } else if (data.type === 'sync' || data.type === 'state-updated') {
        triggerEvent('state-updated', data);
        if (data.state) {
            importData(data.state);
        }
    } else if (data.type === 'presence') {
        triggerEvent('client-joined', data);
    } else if (data.type === 'event') {
        triggerEvent('event', data);
    } else {
        // Generic message
        const event = new CustomEvent('ws-message', { detail: data });
        document.dispatchEvent(event);
        triggerEvent('event', data);
    }
}

/**
 * Send a message via WebSocket
 */
export function sendWSMessage(data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not connected');
        return false;
    }
    
    try {
        ws.send(JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Failed to send WebSocket message:', error);
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
    clearTimeout(wsReconnectTimer);
    wsReconnectAttempts = 0;
    wsStatus = 'disconnected';
    isConnected = false;
    socketId = null;
    roomCode = null;
    
    const state = getState();
    state.wsStatus = 'disconnected';
    updateState(state);
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
export async function testWSConnection(url) {
    return new Promise((resolve) => {
        const testWs = new WebSocket(url);
        const timeout = setTimeout(() => {
            testWs.close();
            resolve({ success: false, error: 'Connection timeout' });
        }, 5000);
        
        testWs.onopen = () => {
            clearTimeout(timeout);
            testWs.close();
            resolve({ success: true });
        };
        
        testWs.onerror = (error) => {
            clearTimeout(timeout);
            resolve({ success: false, error: error.message || 'Connection failed' });
        };
    });
}

// ============================================================
// SOCKET.IO MODE (for campaign sync)
// ============================================================

/**
 * Initialize Socket.io connection
 */
export function initSocketIO(serverUrl, onConnected) {
    if (socket && socket.connected) {
        return Promise.resolve(socket);
    }
    
    return new Promise((resolve, reject) => {
        try {
            import('https://cdn.socket.io/4.7.2/socket.io.esm.min.js').then((ioModule) => {
                const io = ioModule.io || ioModule.default || ioModule;
                connectionMode = 'socketio';
                
                socket = io(serverUrl, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: MAX_RECONNECT,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000
                });
                
                socket.on('connect', () => {
                    console.log('Socket.io connected');
                    isConnected = true;
                    socketId = socket.id;
                    reconnectAttempts = 0;
                    wsStatus = 'connected';
                    triggerEvent('connected', socket);
                    if (onConnected) onConnected(socket);
                    resolve(socket);
                });
                
                socket.on('connect_error', (error) => {
                    console.warn('Socket.io connection error:', error);
                    reconnectAttempts++;
                    if (reconnectAttempts >= MAX_RECONNECT) {
                        showToast('Failed to connect to server. Retry later.', 'error');
                        reject(error);
                    }
                });
                
                socket.on('disconnect', (reason) => {
                    console.log('Socket.io disconnected:', reason);
                    isConnected = false;
                    socketId = null;
                    wsStatus = 'disconnected';
                    triggerEvent('disconnected', reason);
                    if (reason !== 'io client disconnect') {
                        showToast('Disconnected from server.', 'warning');
                    }
                });
                
                // Set up Socket.io event listeners
                setupSocketIOListeners();
            }).catch(err => {
                reject(new Error('Failed to load Socket.io client: ' + err.message));
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
    
    socket.on('room-state', (data) => {
        if (data && data.data) {
            importData(data.data);
            showToast('Campaign state loaded from server.', 'success');
        }
        if (data && data.clients) {
            triggerEvent('room-state', data);
        }
    });
    
    socket.on('state-updated', (data) => {
        if (data.clientId !== socket.id && data.state) {
            importData(data.state);
        }
        triggerEvent('state-updated', data);
    });
    
    socket.on('chat-message', (message) => {
        triggerEvent('chat-message', message);
    });
    
    socket.on('roll-result', (rollData) => {
        triggerEvent('roll-result', rollData);
    });
    
    socket.on('event', (data) => {
        triggerEvent('event', data);
    });
    
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
    
    socket.on('client-joined', (data) => {
        triggerEvent('client-joined', data);
        showToast(`Player ${data.data?.name || 'Unknown'} joined.`, 'success');
    });
    
    socket.on('client-left', (clientId) => {
        triggerEvent('client-left', clientId);
    });
    
    socket.on('room-closed', () => {
        triggerEvent('room-closed');
        showToast('Room closed by host.', 'warning');
        isConnected = false;
        socketId = null;
        roomCode = null;
    });
    
    socket.on('error', (error) => {
        showToast(error.message || 'Server error', 'error');
        triggerEvent('error', error);
    });
}

/**
 * Join a room (Socket.io)
 */
export function joinRoom(code, clientData) {
    return new Promise((resolve, reject) => {
        if (!socket || !socket.connected) {
            reject(new Error('Not connected'));
            return;
        }
        roomCode = code.toUpperCase();
        socket.emit('join-room', roomCode, clientData);
        
        const handler = (data) => {
            socket.off('room-state', handler);
            resolve(data);
        };
        socket.on('room-state', handler);
        
        setTimeout(() => {
            socket.off('room-state', handler);
            reject(new Error('Join timeout'));
        }, 10000);
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

/**
 * Sync state to server (Socket.io)
 */
export function syncState(state) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected || !roomCode) {
            console.warn('Cannot sync: not connected to server');
            return;
        }
        socket.emit('sync-state', state);
    } else {
        // Plain WebSocket mode
        sendWSMessage({ type: 'sync', state, socketId, room: roomCode });
    }
}

/**
 * Send chat message (Socket.io)
 */
export function sendChatMessage(message) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected || !roomCode) {
            console.warn('Cannot send chat: not connected to server');
            return;
        }
        socket.emit('chat-message', message);
    } else {
        sendWSMessage({ type: 'chat', ...message, socketId, room: roomCode });
    }
}

/**
 * Send dice roll (Socket.io)
 */
export function sendRoll(rollData) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected || !roomCode) {
            console.warn('Cannot send roll: not connected to server');
            return;
        }
        socket.emit('roll-dice', rollData);
    } else {
        sendWSMessage({ type: 'roll', ...rollData, socketId, room: roomCode });
    }
}

/**
 * Send custom event (Socket.io)
 */
export function sendEvent(eventData) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected || !roomCode) {
            console.warn('Cannot send event: not connected to server');
            return;
        }
        socket.emit('event', eventData);
    } else {
        sendWSMessage({ type: 'event', ...eventData, socketId, room: roomCode });
    }
}

/**
 * Send a message (alias for sendWSMessage / socket.emit)
 */
export function sendMessage(data) {
    if (connectionMode === 'socketio') {
        if (!socket || !socket.connected || !roomCode) {
            console.warn('Cannot send message: not connected to server');
            return false;
        }
        socket.emit('message', data);
        return true;
    } else {
        return sendWSMessage(data);
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
 * Get connected clients in room (Socket.io)
 */
export function getConnectedClients() {
    return new Promise((resolve) => {
        if (connectionMode === 'socketio') {
            if (!socket || !socket.connected || !roomCode) {
                resolve([]);
                return;
            }
            socket.emit('get-clients', roomCode, (clients) => {
                resolve(clients || []);
            });
            setTimeout(() => resolve([]), 2000);
        } else {
            // Plain WebSocket doesn't have this feature
            resolve([]);
        }
    });
}

/**
 * Initialize WebSocket with settings
 */
export function initWebSocket() {
    const config = getWSConfig();
    if (config.enabled) {
        return connectWebSocket(config.room);
    }
    return null;
}

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
    initWebSocket,
    
    // Socket.io
    initSocketIO,
    joinRoom,
    leaveRoom,
    syncState,
    sendChatMessage,
    sendRoll,
    sendEvent,
    getConnectedClients,
    
    // Shared
    onEvent,
    onWSEvent,
    offEvent,
    offWSEvent,
    isConnectedToServer,
    getRoomCode,
    getSocketId,
    getConnectionMode,
    triggerEvent,
    sendMessage
};