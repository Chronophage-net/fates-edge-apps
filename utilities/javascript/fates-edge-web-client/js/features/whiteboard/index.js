// features/whiteboard/index.js
/**
 * Whiteboard - Campaign Whiteboard with drawing, notes, and image support
 * 
 * Features:
 * - Freehand drawing with color/size controls
 * - Text notes with positioning
 * - Image upload for maps/reference
 * - Grid snap option with multiple grid types (square, hex, isometric)
 * - Simple drawing tools (pen, eraser, line, rectangle, text)
 * - WebSocket sync for real-time collaboration
 * - Grid combat mode with tactical overlays
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';
import { 
    isConnectedToServer, 
    onWSEvent, 
    offWSEvent, 
    sendMessage as sendWSMessage,
    getConnectionMode
} from '../../core/websocket.js';

// ============================================================
// CONSTANTS
// ============================================================

const GRID_TYPES = {
    SQUARE: 'square',
    HEX: 'hex',
    ISOMETRIC: 'isometric'
};

const GRID_COLORS = {
    SQUARE: 'rgba(255,255,255,0.08)',
    HEX: 'rgba(255,215,0,0.08)',
    ISOMETRIC: 'rgba(100,200,255,0.08)'
};

// ============================================================
// STATE
// ============================================================

let container = null;
let canvas = null;
let ctx = null;
let isDrawing = false;
let currentTool = 'pen';
let currentColor = '#d4af37';
let currentSize = 3;
let lastX = 0;
let lastY = 0;
let state = {
    drawings: [],
    notes: [],
    images: [],
    gridCombat: {
        enabled: false,
        gridType: 'square',
        cellSize: 30,
        showCoordinates: true,
        showZones: false,
        tokens: []
    },
    settings: {
        gridSnap: false,
        gridSize: 20,
        backgroundColor: '#1a1a2e',
        gridType: 'square',
        showGrid: true
    }
};
let activeNoteId = null;
let selectedImage = null;
let zoomLevel = 1;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let wsListeners = new Map();
let isSyncing = false;
let pendingSync = false;
let isOfflineMode = false;
let gridCombatActive = false;

// ============================================================
// LOAD/SAVE
// ============================================================

function loadWhiteboardData() {
    const saved = getState();
    if (saved.whiteboard) {
        state.drawings = saved.whiteboard.drawings || [];
        state.notes = saved.whiteboard.notes || [];
        state.images = saved.whiteboard.images || [];
        state.settings = saved.whiteboard.settings || state.settings;
        state.gridCombat = saved.whiteboard.gridCombat || state.gridCombat;
    }
}

function saveWhiteboardData() {
    const saved = getState();
    if (!saved.whiteboard) saved.whiteboard = {};
    saved.whiteboard.drawings = state.drawings;
    saved.whiteboard.notes = state.notes;
    saved.whiteboard.images = state.images;
    saved.whiteboard.settings = state.settings;
    saved.whiteboard.gridCombat = state.gridCombat;
    saveState();
    if (!isOfflineMode) {
        broadcastWhiteboardUpdate();
    }
}

// ============================================================
// WEBSOCKET SYNC
// ============================================================

function setupWebSocketSync() {
    cleanupWebSocketListeners();
    
    const connected = isConnectedToServer();
    
    if (!connected) {
        console.log('[Whiteboard] Not connected to server - OFFLINE MODE');
        isOfflineMode = true;
        updateConnectionStatusUI(false);
        return;
    }
    
    isOfflineMode = false;
    updateConnectionStatusUI(true);
    console.log('[Whiteboard] WebSocket sync enabled via', getConnectionMode ? getConnectionMode() : 'websocket');
    
    // Listen for whiteboard updates from other clients
    const updateHandler = (data) => {
        if (isSyncing) return;
        if (!data || !data.whiteboard) return;
        
        console.log('[Whiteboard] Received update from server');
        
        const incoming = data.whiteboard;
        if (incoming.drawings) {
            const existingIds = new Set(state.drawings.map(d => d.id));
            const newDrawings = incoming.drawings.filter(d => !existingIds.has(d.id));
            if (newDrawings.length > 0) {
                state.drawings = [...state.drawings, ...newDrawings];
            } else if (incoming.drawings.length > state.drawings.length) {
                state.drawings = incoming.drawings;
            }
        }
        
        if (incoming.notes) {
            const existingIds = new Set(state.notes.map(n => n.id));
            const newNotes = incoming.notes.filter(n => !existingIds.has(n.id));
            if (newNotes.length > 0) {
                state.notes = [...state.notes, ...newNotes];
            } else if (incoming.notes.length > state.notes.length) {
                state.notes = incoming.notes;
            }
        }
        
        if (incoming.images) {
            const existingIds = new Set(state.images.map(i => i.id));
            const newImages = incoming.images.filter(i => !existingIds.has(i.id));
            if (newImages.length > 0) {
                state.images = [...state.images, ...newImages];
            } else if (incoming.images.length > state.images.length) {
                state.images = incoming.images;
            }
        }
        
        if (incoming.settings) {
            state.settings = { ...state.settings, ...incoming.settings };
        }
        
        if (incoming.gridCombat) {
            state.gridCombat = { ...state.gridCombat, ...incoming.gridCombat };
        }
        
        saveWhiteboardData();
        refreshUI();
        showToast('🔄 Whiteboard synced', 'info');
    };
    
    onWSEvent('whiteboard-update', updateHandler);
    wsListeners.set('whiteboard-update', updateHandler);
    
    // Also listen for initial room state
    const roomStateHandler = (data) => {
        if (data && data.whiteboard) {
            isSyncing = true;
            state.drawings = data.whiteboard.drawings || [];
            state.notes = data.whiteboard.notes || [];
            state.images = data.whiteboard.images || [];
            state.settings = data.whiteboard.settings || state.settings;
            state.gridCombat = data.whiteboard.gridCombat || state.gridCombat;
            saveWhiteboardData();
            refreshUI();
            isSyncing = false;
            console.log('[Whiteboard] Initial state loaded from server');
        }
    };
    
    onWSEvent('room-state', roomStateHandler);
    wsListeners.set('room-state', roomStateHandler);

    // NEW: Handle full sync-state messages (e.g., from forceSync)
    const syncStateHandler = (data) => {
        if (isSyncing) return;
        if (!data || !data.state) return;
        
        console.log('[Whiteboard] Received full sync state');
        const incoming = data.state;
        if (incoming.drawings) state.drawings = incoming.drawings;
        if (incoming.notes) state.notes = incoming.notes;
        if (incoming.images) state.images = incoming.images;
        if (incoming.settings) state.settings = { ...state.settings, ...incoming.settings };
        if (incoming.gridCombat) state.gridCombat = { ...state.gridCombat, ...incoming.gridCombat };
        
        saveWhiteboardData();
        refreshUI();
        showToast('🔄 Whiteboard fully synced', 'success');
    };
    
    onWSEvent('sync-state', syncStateHandler);
    wsListeners.set('sync-state', syncStateHandler);
}

function cleanupWebSocketListeners() {
    for (const [event, handler] of wsListeners) {
        try {
            offWSEvent(event, handler);
        } catch (e) {
            console.debug('[Whiteboard] Error removing listener:', e);
        }
    }
    wsListeners.clear();
}

function broadcastWhiteboardUpdate() {
    if (isSyncing) return;
    if (isOfflineMode || !isConnectedToServer()) return;
    
    try {
        const data = {
            type: 'whiteboard-update',        // <-- fixed: include type inside object
            whiteboard: {
                drawings: state.drawings,
                notes: state.notes,
                images: state.images,
                settings: state.settings,
                gridCombat: state.gridCombat
            },
            timestamp: Date.now()
        };
        sendWSMessage(data);
    } catch (e) {
        console.warn('[Whiteboard] Failed to broadcast update:', e);
    }
}

/**
 * Force a full sync: broadcast current state and request a fresh sync from server.
 */
function forceSync() {
    if (isOfflineMode || !isConnectedToServer()) {
        showToast('📡 Cannot sync – you are offline', 'warning');
        return;
    }

    try {
        // Broadcast our current state to all clients
        const data = {
            type: 'whiteboard-update',
            whiteboard: {
                drawings: state.drawings,
                notes: state.notes,
                images: state.images,
                settings: state.settings,
                gridCombat: state.gridCombat
            },
            timestamp: Date.now()
        };
        sendWSMessage(data);
        
        // Also request a full sync from the server (if supported)
        sendWSMessage({ type: 'sync-request', target: 'whiteboard' });
        
        showToast('🔄 Whiteboard sync requested', 'success');
    } catch (e) {
        console.warn('[Whiteboard] Force sync failed:', e);
        showToast('❌ Sync failed', 'error');
    }
}

function refreshUI() {
    if (container) {
        restoreDrawings();
        renderOverlay();
        updateStats();
        if (gridCombatActive) {
            renderGridCombat();
        }
    }
}

function updateStats() {
    const stats = document.querySelector('.whiteboard-stats');
    if (stats) {
        stats.textContent = `${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images`;
    }
}

function updateConnectionStatusUI(connected) {
    const statusBadge = document.querySelector('.status-badge');
    const statusText = document.querySelector('.status-text');
    const overlay = document.getElementById('whiteboard-offline-overlay');
    
    if (statusBadge) {
        statusBadge.textContent = connected ? '🟢 Live' : '📡 Local';
        statusBadge.className = `status-badge ${connected ? 'connected' : 'local'}`;
    }
    
    if (statusText) {
        statusText.textContent = connected ? 'Connected - Real-time sync enabled' : 'Local Mode - No sync';
        statusText.style.color = connected ? 'var(--green)' : 'var(--orange)';
    }
    
    if (overlay) {
        overlay.style.display = connected ? 'none' : 'flex';
    }
}

// ============================================================
// GRID COMBAT FUNCTIONS
// ============================================================

function toggleGridCombat() {
    gridCombatActive = !gridCombatActive;
    state.gridCombat.enabled = gridCombatActive;
    saveWhiteboardData();
    
    const btn = document.getElementById('whiteboard-grid-combat');
    if (btn) {
        btn.textContent = gridCombatActive ? '⚔️ Combat ON' : '⚔️ Combat OFF';
        btn.className = gridCombatActive ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-secondary';
    }
    
    if (gridCombatActive) {
        showToast('⚔️ Grid Combat Mode enabled', 'success');
        renderGridCombat();
    } else {
        showToast('Grid Combat Mode disabled', 'info');
        restoreDrawings();
        renderOverlay();
    }
}

function renderGridCombat() {
    if (!ctx || !gridCombatActive) return;
    
    const gc = state.gridCombat;
    const cellSize = gc.cellSize || 30;
    const gridType = gc.gridType || 'square';
    
    // Draw combat grid overlay
    ctx.save();
    ctx.globalAlpha = 0.3;
    
    if (gridType === 'hex') {
        drawHexGrid(cellSize);
    } else if (gridType === 'isometric') {
        drawIsometricGrid(cellSize);
    } else {
        drawSquareGrid(cellSize);
    }
    
    ctx.restore();
    
    // Draw coordinates
    if (gc.showCoordinates) {
        drawCoordinates(cellSize, gridType);
    }
    
    // Draw Zones of Control if enabled
    if (gc.showZones) {
        drawZonesOfControl(cellSize, gridType);
    }
    
    // Draw tokens
    drawTokens(cellSize, gridType);
}

function drawSquareGrid(cellSize) {
    if (!ctx) return;
    ctx.strokeStyle = GRID_COLORS.SQUARE;
    ctx.lineWidth = 1;
    
    for (let x = 0; x < canvas.width; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawHexGrid(cellSize) {
    if (!ctx) return;
    ctx.strokeStyle = GRID_COLORS.HEX;
    ctx.lineWidth = 1;
    
    const hexHeight = cellSize * Math.sqrt(3);
    const hexWidth = cellSize * 2;
    
    for (let row = 0; row < canvas.height / hexHeight + 2; row++) {
        for (let col = 0; col < canvas.width / hexWidth + 2; col++) {
            const x = col * hexWidth + (row % 2) * cellSize;
            const y = row * hexHeight * 0.75;
            
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 180 * (60 * i - 30);
                const hx = x + cellSize * Math.cos(angle);
                const hy = y + cellSize * Math.sin(angle);
                if (i === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }
}

function drawIsometricGrid(cellSize) {
    if (!ctx) return;
    ctx.strokeStyle = GRID_COLORS.ISOMETRIC;
    ctx.lineWidth = 1;
    
    const isoWidth = cellSize * 2;
    const isoHeight = cellSize;
    
    for (let row = 0; row < canvas.height / isoHeight + 2; row++) {
        for (let col = 0; col < canvas.width / isoWidth + 2; col++) {
            const x = col * isoWidth + (row % 2) * cellSize;
            const y = row * isoHeight;
            
            ctx.beginPath();
            ctx.moveTo(x, y + isoHeight / 2);
            ctx.lineTo(x + cellSize, y);
            ctx.lineTo(x + isoWidth, y + isoHeight / 2);
            ctx.lineTo(x + cellSize, y + isoHeight);
            ctx.closePath();
            ctx.stroke();
        }
    }
}

function drawCoordinates(cellSize, gridType) {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const step = cellSize;
    let col = 0;
    for (let x = step/2; x < canvas.width; x += step) {
        let row = 0;
        for (let y = step/2; y < canvas.height; y += step) {
            const label = `${String.fromCharCode(65 + col)}${row + 1}`;
            ctx.fillText(label, x, y);
            row++;
        }
        col++;
    }
    ctx.restore();
}

function drawZonesOfControl(cellSize, gridType) {
    if (!ctx) return;
    // Draw ZoC around tokens
    const tokens = state.gridCombat.tokens || [];
    for (const token of tokens) {
        const x = token.x || 0;
        const y = token.y || 0;
        
        ctx.save();
        ctx.strokeStyle = 'rgba(255,100,100,0.3)';
        ctx.fillStyle = 'rgba(255,100,100,0.05)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        
        // Draw ZoC circle (1 cell radius)
        const radius = cellSize * 1.5;
        ctx.beginPath();
        ctx.arc(x + cellSize/2, y + cellSize/2, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

function drawTokens(cellSize, gridType) {
    if (!ctx) return;
    const tokens = state.gridCombat.tokens || [];
    for (const token of tokens) {
        const x = token.x || 0;
        const y = token.y || 0;
        
        ctx.save();
        
        // Token background
        const color = token.color || '#d4af37';
        ctx.fillStyle = color;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        
        // Draw token shape
        const size = cellSize * 0.8;
        if (token.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(x + cellSize/2, y + cellSize/2, size/2, 0, Math.PI * 2);
            ctx.fill();
        } else if (token.shape === 'diamond') {
            ctx.beginPath();
            ctx.moveTo(x + cellSize/2, y);
            ctx.lineTo(x + cellSize, y + cellSize/2);
            ctx.lineTo(x + cellSize/2, y + cellSize);
            ctx.lineTo(x, y + cellSize/2);
            ctx.closePath();
            ctx.fill();
        } else {
            // Square
            ctx.fillRect(x + (cellSize - size)/2, y + (cellSize - size)/2, size, size);
        }
        
        // Token label
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.label || '?', x + cellSize/2, y + cellSize/2);
        
        // Token health/status indicators
        if (token.harm !== undefined) {
            ctx.fillStyle = 'rgba(255,50,50,0.8)';
            ctx.font = '8px sans-serif';
            ctx.fillText(`❤️${token.harm}`, x + cellSize/2, y + cellSize + 10);
        }
        
        ctx.restore();
    }
}

function addGridToken() {
    if (!gridCombatActive) {
        showToast('Enable Grid Combat mode first', 'error');
        return;
    }
    
    const name = prompt('Token label:', 'Monster');
    if (!name) return;
    
    const containerEl = document.getElementById('whiteboard-canvas-container');
    const rect = containerEl.getBoundingClientRect();
    const cellSize = state.gridCombat.cellSize || 30;
    
    // Snap to grid
    const x = Math.floor((rect.width / 2 - 50) / cellSize) * cellSize;
    const y = Math.floor((rect.height / 2 - 50) / cellSize) * cellSize;
    
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    
    if (!state.gridCombat.tokens) state.gridCombat.tokens = [];
    state.gridCombat.tokens.push({
        id: 'token-' + Date.now(),
        label: name,
        x: x,
        y: y,
        color: colors[state.gridCombat.tokens.length % colors.length],
        shape: ['circle', 'square', 'diamond'][state.gridCombat.tokens.length % 3],
        harm: 0,
        fatigue: 0,
        tier: 1
    });
    
    saveWhiteboardData();
    renderGridCombat();
    showToast(`⚔️ Token "${name}" added`, 'success');
}

function clearGridTokens() {
    if (!gridCombatActive) {
        showToast('Enable Grid Combat mode first', 'error');
        return;
    }
    if (!confirm('Remove all tokens?')) return;
    state.gridCombat.tokens = [];
    saveWhiteboardData();
    renderGridCombat();
    showToast('🗑️ All tokens removed', 'info');
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    loadWhiteboardData();

    const isConnected = isConnectedToServer();
    isOfflineMode = !isConnected;
    gridCombatActive = state.gridCombat.enabled || false;

    container.innerHTML = `
        <div class="whiteboard-modern-layout">
            <!-- Header -->
            <header class="whiteboard-header">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <div>
                        <h1 class="whiteboard-title">✏️ Campaign Whiteboard</h1>
                        <p class="whiteboard-subtitle">Draw, note, and plan your campaign visually.</p>
                    </div>
                    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                        <span class="status-badge ${isConnected ? 'connected' : 'local'}" style="font-size:0.7rem;padding:0.2rem 0.6rem;border-radius:12px;background:${isConnected ? 'var(--green)' : 'var(--orange)'};color:white;">
                            ${isConnected ? '🟢 Live' : '📡 Local'}
                        </span>
                        <span class="status-text" style="font-size:0.75rem;color:${isConnected ? 'var(--green)' : 'var(--orange)'};">
                            ${isConnected ? 'Real-time sync' : 'Local only'}
                        </span>
                        <span class="whiteboard-stats" style="font-size:0.75rem;color:var(--text3);">
                            ${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images
                        </span>
                    </div>
                </div>
            </header>

            <!-- OFFLINE OVERLAY -->
            <div id="whiteboard-offline-overlay" style="display:${isConnected ? 'none' : 'flex'};position:relative;margin-bottom:0.5rem;padding:1rem;background:var(--bg3);border:2px solid var(--orange);border-radius:var(--radius);align-items:center;justify-content:center;gap:0.8rem;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span style="font-size:1.5rem;">📡</span>
                    <div>
                        <div style="font-weight:600;color:var(--orange);">Local Mode</div>
                        <div style="font-size:0.8rem;color:var(--text3);">Whiteboard is saved locally. Connect to server for real-time collaboration.</div>
                    </div>
                </div>
                <button class="btn btn-sm btn-primary" id="whiteboard-connect-btn" style="flex-shrink:0;">
                    🔗 Connect
                </button>
            </div>

            <!-- Toolbar -->
            <div class="whiteboard-toolbar" style="display:flex;flex-wrap:wrap;gap:0.4rem;padding:0.4rem;background:var(--bg3);border-radius:var(--radius);margin-bottom:0.5rem;align-items:center;">
                <div class="tool-group" style="display:flex;gap:0.2rem;flex-wrap:wrap;">
                    <button class="tool-btn active" data-tool="pen" title="Pen">✏️</button>
                    <button class="tool-btn" data-tool="eraser" title="Eraser">🧹</button>
                    <button class="tool-btn" data-tool="line" title="Line">📏</button>
                    <button class="tool-btn" data-tool="rectangle" title="Rectangle">▭</button>
                    <button class="tool-btn" data-tool="text" title="Text">📝</button>
                    <button class="tool-btn" data-tool="select" title="Select/Move">👆</button>
                </div>
                <div class="tool-group" style="display:flex;gap:0.3rem;align-items:center;flex-wrap:wrap;">
                    <input type="color" id="whiteboard-color" value="${currentColor}" style="width:30px;height:30px;padding:0;border:none;border-radius:4px;cursor:pointer;" />
                    <input type="range" id="whiteboard-size" min="1" max="20" value="${currentSize}" style="width:80px;" />
                    <span id="size-label" style="font-size:0.7rem;color:var(--text3);">${currentSize}px</span>
                </div>
                <div class="tool-group" style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <label class="inline-check" style="font-size:0.7rem;">
                        <input type="checkbox" id="whiteboard-grid" ${state.settings.gridSnap ? 'checked' : ''} />
                        Grid Snap
                    </label>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-grid-combat">${gridCombatActive ? '⚔️ Combat ON' : '⚔️ Combat OFF'}</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-add-token" style="${gridCombatActive ? '' : 'display:none;'}">🎯 Add Token</button>
                    <button class="btn btn-sm btn-ghost" id="whiteboard-clear" title="Clear All">🗑️</button>
                    <button class="btn btn-sm btn-ghost" id="whiteboard-export" title="Export as Image">💾</button>
                </div>
            </div>

            <!-- Canvas Container -->
            <div class="whiteboard-canvas-container" id="whiteboard-canvas-container" style="position:relative;width:100%;height:60vh;min-height:400px;background:var(--bg2);border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);">
                <canvas id="whiteboard-canvas" style="width:100%;height:100%;display:block;"></canvas>
                <!-- Overlay for notes and images -->
                <div id="whiteboard-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></div>
                ${!isConnected ? `
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:50;opacity:0.15;font-size:4rem;font-weight:bold;color:var(--text3);white-space:nowrap;user-select:none;">
                        📡 LOCAL MODE
                    </div>
                ` : ''}
                <!-- Grid Combat Legend -->
                <div id="grid-combat-legend" style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);padding:0.3rem 0.6rem;border-radius:4px;font-size:0.6rem;color:var(--text3);display:${gridCombatActive ? 'block' : 'none'};">
                    <div>ZoC: Red dashed</div>
                    <div>● Tokens: Click to select</div>
                </div>
            </div>

            <!-- Controls -->
            <div class="whiteboard-controls" style="display:flex;flex-wrap:wrap;gap:0.4rem;padding:0.4rem 0;align-items:center;">
                <button class="btn btn-sm btn-primary" id="whiteboard-add-note">📝 Add Note</button>
                <button class="btn btn-sm btn-secondary" id="whiteboard-upload-image">🖼️ Upload Image</button>
                <button class="btn btn-sm btn-secondary" id="whiteboard-clear-drawings">🧹 Clear Drawing</button>
                <button class="btn btn-sm btn-ghost" id="whiteboard-sync-btn" title="Force sync">🔄</button>
                <span class="text-muted whiteboard-stats" style="font-size:0.8rem;">${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images</span>
            </div>
        </div>
    `;

    initCanvas();
    renderOverlay();
    attachEvents();
    restoreDrawings();
    setupWebSocketSync();
    updateConnectionStatusUI(isConnected);
    
    if (gridCombatActive) {
        renderGridCombat();
    }
}

// ============================================================
// CANVAS INITIALIZATION
// ============================================================

function initCanvas() {
    canvas = document.getElementById('whiteboard-canvas');
    if (!canvas) return;
    
    const containerEl = document.getElementById('whiteboard-canvas-container');
    const rect = containerEl.getBoundingClientRect();
    
    // Set canvas size to match container
    canvas.width = rect.width || 800;
    canvas.height = rect.height || 600;
    
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Set background
    ctx.fillStyle = state.settings.backgroundColor || '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (state.settings.showGrid !== false) {
        drawGrid();
    }
    
    // Redraw existing drawings
    state.drawings.forEach(drawing => {
        drawStroke(drawing);
    });
}

function drawGrid() {
    if (!ctx) return;
    
    const gridSize = state.settings.gridSize || 20;
    const gridType = state.settings.gridType || 'square';
    
    if (gridType === 'hex') {
        drawHexGrid(gridSize * 1.5);
    } else if (gridType === 'isometric') {
        drawIsometricGrid(gridSize);
    } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
}

function drawStroke(drawing) {
    if (!ctx || !drawing.points || drawing.points.length < 2) return;
    
    ctx.save();
    ctx.strokeStyle = drawing.color || '#d4af37';
    ctx.lineWidth = drawing.size || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
    for (let i = 1; i < drawing.points.length; i++) {
        ctx.lineTo(drawing.points[i].x, drawing.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
}

function snapToGrid(x, y) {
    if (!state.settings.gridSnap) return { x, y };
    const gridSize = state.settings.gridSize || 20;
    return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize
    };
}

// ============================================================
// OVERLAY RENDERING
// ============================================================

function renderOverlay() {
    const overlay = document.getElementById('whiteboard-overlay');
    if (!overlay) return;

    // Notes
    let notesHtml = state.notes.map((note) => `
        <div class="whiteboard-note-overlay" style="position:absolute;left:${note.x}px;top:${note.y}px;background:${note.color || '#ffd700'};padding:0.4rem 0.6rem;border-radius:8px;min-width:80px;max-width:180px;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;z-index:10;color:#1a141a;font-size:0.8rem;pointer-events:auto;">
            <div class="note-content">${escHtml(note.content)}</div>
            <div class="note-actions" style="display:flex;gap:0.2rem;margin-top:0.2rem;">
                <button class="btn btn-xs btn-ghost" onclick="window.editWhiteboardNote('${note.id}')" style="font-size:0.6rem;padding:0.1rem 0.3rem;">✏️</button>
                <button class="btn btn-xs btn-danger" onclick="window.deleteWhiteboardNote('${note.id}')" style="font-size:0.6rem;padding:0.1rem 0.3rem;">✕</button>
            </div>
        </div>
    `).join('');

    // Images
    let imagesHtml = state.images.map((img) => `
        <div class="whiteboard-image-overlay" style="position:absolute;left:${img.x}px;top:${img.y}px;cursor:pointer;z-index:5;border:2px solid var(--border);border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:auto;">
            <img src="${img.data}" style="max-width:180px;max-height:180px;border-radius:4px;display:block;" />
            <div class="image-actions" style="position:absolute;top:-8px;right:-8px;">
                <button class="btn btn-xs btn-danger" onclick="window.deleteWhiteboardImage('${img.id}')" style="font-size:0.6rem;padding:0.1rem 0.3rem;">✕</button>
            </div>
        </div>
    `).join('');

    overlay.innerHTML = notesHtml + imagesHtml;
}

// ============================================================
// DRAWING FUNCTIONS
// ============================================================

function startDrawing(e) {
    if (isOfflineMode) {
        showToast('📡 Local mode - drawings saved locally', 'info');
    }
    if (currentTool === 'select' || currentTool === 'text') return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    
    isDrawing = true;
    const pos = snapToGrid(x, y);
    lastX = pos.x;
    lastY = pos.y;
    
    if (currentTool === 'pen' || currentTool === 'eraser') {
        const drawing = {
            id: 'draw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            points: [{ x: pos.x, y: pos.y }],
            color: currentTool === 'eraser' ? state.settings.backgroundColor || '#1a1a2e' : currentColor,
            size: currentTool === 'eraser' ? currentSize * 3 : currentSize,
            tool: currentTool,
            timestamp: Date.now()
        };
        state.drawings.push(drawing);
        drawStroke(drawing);
        saveWhiteboardData();
    } else if (currentTool === 'line' || currentTool === 'rectangle') {
        state._shapeStart = { x: pos.x, y: pos.y };
        state._shapeType = currentTool;
    }
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    const pos = snapToGrid(x, y);
    
    if (currentTool === 'pen' || currentTool === 'eraser') {
        const drawing = state.drawings[state.drawings.length - 1];
        if (drawing) {
            drawing.points.push({ x: pos.x, y: pos.y });
            drawStroke(drawing);
            saveWhiteboardData();
        }
    } else if (currentTool === 'line' || currentTool === 'rectangle') {
        restoreDrawings();
        ctx.save();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        
        const start = state._shapeStart;
        if (start) {
            if (currentTool === 'line') {
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            } else if (currentTool === 'rectangle') {
                ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
            }
        }
        ctx.restore();
    }
}

function endDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    
    if (currentTool === 'line' || currentTool === 'rectangle') {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left;
        const y = (e.clientY || e.changedTouches?.[0]?.clientY || 0) - rect.top;
        const pos = snapToGrid(x, y);
        const start = state._shapeStart;
        
        if (start) {
            const drawing = {
                id: 'draw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                points: [
                    { x: start.x, y: start.y },
                    { x: pos.x, y: pos.y }
                ],
                color: currentColor,
                size: currentSize,
                tool: currentTool,
                shape: currentTool,
                timestamp: Date.now()
            };
            state.drawings.push(drawing);
            saveWhiteboardData();
            restoreDrawings();
            state._shapeStart = null;
        }
    }
    
    lastX = 0;
    lastY = 0;
}

function restoreDrawings() {
    if (!ctx) return;
    
    ctx.fillStyle = state.settings.backgroundColor || '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (state.settings.showGrid !== false) {
        drawGrid();
    }
    
    state.drawings.forEach(drawing => {
        drawStroke(drawing);
    });
    
    if (gridCombatActive) {
        renderGridCombat();
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    // Connect button
    document.getElementById('whiteboard-connect-btn')?.addEventListener('click', connectWhiteboard);

    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isOfflineMode) {
                showToast('📡 Local mode - drawing saved locally', 'info');
            }
            document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
            if (canvas) {
                canvas.style.cursor = currentTool === 'pen' ? 'crosshair' : 
                                       currentTool === 'eraser' ? 'cell' :
                                       currentTool === 'select' ? 'grab' : 'crosshair';
            }
        });
    });

    // Color picker
    const colorInput = document.getElementById('whiteboard-color');
    if (colorInput) {
        colorInput.addEventListener('input', (e) => {
            currentColor = e.target.value;
        });
    }

    // Size slider
    const sizeInput = document.getElementById('whiteboard-size');
    if (sizeInput) {
        sizeInput.addEventListener('input', (e) => {
            currentSize = parseInt(e.target.value);
            document.getElementById('size-label').textContent = currentSize + 'px';
        });
    }

    // Grid toggle
    const gridToggle = document.getElementById('whiteboard-grid');
    if (gridToggle) {
        gridToggle.addEventListener('change', (e) => {
            state.settings.gridSnap = e.target.checked;
            saveWhiteboardData();
            restoreDrawings();
        });
    }

    // Grid Combat toggle
    document.getElementById('whiteboard-grid-combat')?.addEventListener('click', toggleGridCombat);
    
    // Add Token button
    document.getElementById('whiteboard-add-token')?.addEventListener('click', addGridToken);
    
    // Clear all button
    document.getElementById('whiteboard-clear')?.addEventListener('click', clearWhiteboardAll);

    // Export button
    document.getElementById('whiteboard-export')?.addEventListener('click', exportWhiteboard);

    // Add note button
    document.getElementById('whiteboard-add-note')?.addEventListener('click', addWhiteboardNote);

    // Upload image button
    document.getElementById('whiteboard-upload-image')?.addEventListener('click', uploadWhiteboardImage);

    // Clear drawings button
    document.getElementById('whiteboard-clear-drawings')?.addEventListener('click', clearWhiteboardDrawings);

    // Sync button – now calls forceSync
    document.getElementById('whiteboard-sync-btn')?.addEventListener('click', forceSync);

    // Canvas events
    if (canvas) {
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDrawing);
        canvas.addEventListener('mouseleave', endDrawing);
        
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            startDrawing(mouseEvent);
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            draw(mouseEvent);
        });
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            const mouseEvent = new MouseEvent('mouseup', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            endDrawing(mouseEvent);
        });
    }

    // Window resize
    window.addEventListener('resize', () => {
        initCanvas();
        restoreDrawings();
        renderOverlay();
        if (gridCombatActive) {
            renderGridCombat();
        }
    });

    // Listen for connection changes
    document.addEventListener('connection-change', (e) => {
        const connected = e.detail?.connected || false;
        isOfflineMode = !connected;
        updateConnectionStatusUI(connected);
        if (connected) {
            setupWebSocketSync();
            showToast('🔄 Whiteboard reconnected and syncing', 'success');
        } else {
            showToast('📡 Whiteboard in local mode', 'info');
        }
    });
}


// ============================================================
// LIFECYCLE METHODS
// ============================================================

export function onActivate() {
    console.log('[Whiteboard] Activated');
    loadWhiteboardData();
    setupWebSocketSync();
    if (container) {
        setTimeout(() => {
            initCanvas();
            restoreDrawings();
            renderOverlay();
            updateStats();
            updateConnectionStatusUI(!isOfflineMode);
            if (gridCombatActive) {
                renderGridCombat();
            }
        }, 100);
    }
}

export function onDeactivate() {
    console.log('[Whiteboard] Deactivated');
    saveWhiteboardData();
    cleanupWebSocketListeners();
}

export function refresh() {
    loadWhiteboardData();
    initCanvas();
    restoreDrawings();
    renderOverlay();
    updateStats();
    setupWebSocketSync();
    updateConnectionStatusUI(!isOfflineMode);
    if (gridCombatActive) {
        renderGridCombat();
    }
}

export function destroy() {
    container = null;
    saveWhiteboardData();
    cleanupWebSocketListeners();
}

// ============================================================
// WHITEBOARD ACTIONS (missing implementations)
// ============================================================

export function uploadWhiteboardImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            // Position image in the centre of the canvas
            const containerEl = document.getElementById('whiteboard-canvas-container');
            const rect = containerEl.getBoundingClientRect();
            const x = (rect.width - 200) / 2;
            const y = (rect.height - 200) / 2;
            state.images.push({
                id: 'img-' + Date.now(),
                x: Math.max(0, x),
                y: Math.max(0, y),
                data: dataUrl
            });
            saveWhiteboardData();
            renderOverlay();
            showToast('🖼️ Image uploaded', 'success');
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// Also implement other missing functions referenced in the code:
export function clearWhiteboardAll() {
    if (!confirm('Delete everything (drawings, notes, images)?')) return;
    state.drawings = [];
    state.notes = [];
    state.images = [];
    state.gridCombat.tokens = [];
    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    updateStats();
    showToast('🗑️ Whiteboard cleared', 'info');
}

export function exportWhiteboard() {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'whiteboard-' + Date.now() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('💾 Whiteboard exported', 'success');
}

// ============================================================
// WHITEBOARD ACTIONS
// ============================================================

export function uploadWhiteboardImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            // Position image in the centre of the canvas
            const containerEl = document.getElementById('whiteboard-canvas-container');
            const rect = containerEl.getBoundingClientRect();
            const x = (rect.width - 200) / 2;
            const y = (rect.height - 200) / 2;
            state.images.push({
                id: 'img-' + Date.now(),
                x: Math.max(0, x),
                y: Math.max(0, y),
                data: dataUrl
            });
            saveWhiteboardData();        // This triggers sync if online
            renderOverlay();
            showToast('🖼️ Image uploaded', 'success');
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

export function clearWhiteboardDrawings() {
    if (!confirm('Clear all drawings only (notes & images stay)?')) return;
    state.drawings = [];
    saveWhiteboardData();
    restoreDrawings();
    updateStats();
    showToast('🧹 Drawings cleared', 'info');
}
// ============================================================
// EXPORTS
// ============================================================

export default {
    render,
    destroy,
    onActivate,
    onDeactivate,
    refresh,
    loadWhiteboardData,
    saveWhiteboardData,
    forceSync,
    addWhiteboardNote,
    uploadWhiteboardImage,
    toggleGridCombat,
    addGridToken,
    clearGridTokens
};