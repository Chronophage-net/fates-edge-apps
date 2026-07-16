// features/whiteboard/index.js
/**
 * Whiteboard - Campaign Whiteboard with drawing, notes, and image support
 * 
 * Features:
 * - Freehand drawing with color/size controls
 * - Text notes with positioning
 * - Image upload for maps/reference
 * - Grid snap option with multiple grid types (square, hex, isometric)
 * - Simple drawing tools (pen, eraser, line, rectangle, ruler, text)
 * - WebSocket sync for real-time collaboration
 * - Grid combat mode with tactical overlays (ZoC, Flanking, Drag & Drop)
 * - Records movements to media manifest for VOD creators
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';
import { logRecordingEvent } from '../../core/media.js'; // New: For recording transcripts
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
    SQUARE: 'rgba(212, 175, 55, 0.08)',
    HEX: 'rgba(212, 175, 55, 0.08)',
    ISOMETRIC: 'rgba(212, 175, 55, 0.08)'
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
        cellSize: 40,
        showCoordinates: true,
        showZones: false,
        tokens: []
    },
    settings: {
        gridSnap: false,
        gridSize: 40,
        backgroundColor: 'var(--bg2)',
        gridType: 'square',
        showGrid: true
    }
};
let activeNoteId = null;
let selectedImage = null;
let wsListeners = new Map();
let isSyncing = false;
let isOfflineMode = false;
let gridCombatActive = false;

// New state for tactical interactions
let isDraggingToken = false;
let draggedToken = null;
let tokenStartPos = null;
let rulerStart = null;
let rulerEnd = null;

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
        isOfflineMode = true;
        updateConnectionStatusUI(false);
        return;
    }
    
    isOfflineMode = false;
    updateConnectionStatusUI(true);
    
    const updateHandler = (data) => {
        if (isSyncing || !data || !data.whiteboard) return;
        
        const incoming = data.whiteboard;
        if (incoming.drawings) state.drawings = incoming.drawings;
        if (incoming.notes) state.notes = incoming.notes;
        if (incoming.images) state.images = incoming.images;
        if (incoming.settings) state.settings = { ...state.settings, ...incoming.settings };
        if (incoming.gridCombat) state.gridCombat = { ...state.gridCombat, ...incoming.gridCombat };
        
        saveWhiteboardData();
        refreshUI();
    };
    
    onWSEvent('whiteboard-update', updateHandler);
    wsListeners.set('whiteboard-update', updateHandler);
    
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
        }
    };
    
    onWSEvent('room-state', roomStateHandler);
    wsListeners.set('room-state', roomStateHandler);

    const syncStateHandler = (data) => {
        if (isSyncing || !data || !data.state) return;
        const incoming = data.state;
        if (incoming.drawings) state.drawings = incoming.drawings;
        if (incoming.notes) state.notes = incoming.notes;
        if (incoming.images) state.images = incoming.images;
        if (incoming.settings) state.settings = { ...state.settings, ...incoming.settings };
        if (incoming.gridCombat) state.gridCombat = { ...state.gridCombat, ...incoming.gridCombat };
        
        saveWhiteboardData();
        refreshUI();
    };
    
    onWSEvent('sync-state', syncStateHandler);
    wsListeners.set('sync-state', syncStateHandler);
}

function cleanupWebSocketListeners() {
    for (const [event, handler] of wsListeners) {
        try { offWSEvent(event, handler); } catch (e) {}
    }
    wsListeners.clear();
}

function broadcastWhiteboardUpdate() {
    if (isSyncing || isOfflineMode || !isConnectedToServer()) return;
    try {
        sendWSMessage({
            type: 'whiteboard-update',
            whiteboard: {
                drawings: state.drawings,
                notes: state.notes,
                images: state.images,
                settings: state.settings,
                gridCombat: state.gridCombat
            },
            timestamp: Date.now()
        });
    } catch (e) {}
}

function forceSync() {
    if (isOfflineMode || !isConnectedToServer()) {
        showToast('Cannot sync – you are offline', 'warning');
        return;
    }
    broadcastWhiteboardUpdate();
    sendWSMessage({ type: 'sync-request', target: 'whiteboard' });
    showToast('Whiteboard sync requested', 'success');
}

function refreshUI() {
    if (container) {
        restoreDrawings();
        renderOverlay();
        updateStats();
        if (gridCombatActive) renderGridCombat();
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
        statusText.textContent = connected ? 'Real-time sync enabled' : 'Local Mode - No sync';
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
    const addTokenBtn = document.getElementById('whiteboard-add-token');
    
    if (btn) {
        btn.textContent = gridCombatActive ? '⚔️ Combat ON' : '⚔️ Combat OFF';
        btn.className = gridCombatActive ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-secondary';
    }
    if (addTokenBtn) {
        addTokenBtn.style.display = gridCombatActive ? 'inline-block' : 'none';
    }
    
    showToast(gridCombatActive ? '⚔️ Grid Combat Mode enabled' : 'Grid Combat disabled', gridCombatActive ? 'success' : 'info');
    restoreDrawings();
    renderGridCombat();
}

function renderGridCombat() {
    if (!ctx || !gridCombatActive) return;
    
    const gc = state.gridCombat;
    const cellSize = gc.cellSize || 40;
    
    ctx.save();
    ctx.globalAlpha = 0.3;
    
    if (gc.gridType === 'hex') drawHexGrid(cellSize);
    else if (gc.gridType === 'isometric') drawIsometricGrid(cellSize);
    else drawSquareGrid(cellSize);
    
    ctx.restore();
    
    if (gc.showCoordinates) drawCoordinates(cellSize, gc.gridType);
    if (gc.showZones) drawZonesOfControl(cellSize, gc.gridType);
    
    drawTokens(cellSize, gc.gridType);
}

function drawSquareGrid(cellSize) {
    if (!ctx) return;
    ctx.strokeStyle = GRID_COLORS.SQUARE;
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += cellSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += cellSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
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
                if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
            }
            ctx.closePath(); ctx.stroke();
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
            ctx.closePath(); ctx.stroke();
        }
    }
}

function drawCoordinates(cellSize, gridType) {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let col = 0;
    for (let x = cellSize/2; x < canvas.width; x += cellSize) {
        let row = 0;
        for (let y = cellSize/2; y < canvas.height; y += cellSize) {
            ctx.fillText(`${String.fromCharCode(65 + col)}${row + 1}`, x, y);
            row++;
        }
        col++;
    }
    ctx.restore();
}

function checkTacticalStatus(token) {
    const cellSize = state.gridCombat.cellSize || 40;
    const enemies = state.gridCombat.tokens.filter(t => t.faction !== token.faction && t.id !== token.id);
    
    const oppositePositions = [
        { dx: -cellSize, dy: 0, oppDx: cellSize, oppDy: 0 },
        { dx: 0, dy: -cellSize, oppDx: 0, oppDy: cellSize }
    ];
    
    let isFlanked = false;
    for (const pos of oppositePositions) {
        const e1 = enemies.find(e => Math.abs(e.x - (token.x + pos.dx)) < 5 && Math.abs(e.y - (token.y + pos.dy)) < 5);
        const e2 = enemies.find(e => Math.abs(e.x - (token.x + pos.oppDx)) < 5 && Math.abs(e.y - (token.y + pos.oppDy)) < 5);
        if (e1 && e2) { isFlanked = true; break; }
    }
    
    const inEnemyZoC = enemies.some(e => {
        const dx = Math.abs(e.x - token.x);
        const dy = Math.abs(e.y - token.y);
        return (dx <= cellSize && dy <= cellSize);
    });
    
    return { isFlanked, inEnemyZoC };
}

function drawZonesOfControl(cellSize, gridType) {
    if (!ctx) return;
    const tokens = state.gridCombat.tokens || [];
    for (const token of tokens) {
        ctx.save();
        ctx.strokeStyle = token.faction === 'enemy' ? 'rgba(196, 90, 90, 0.4)' : 'rgba(90, 138, 181, 0.4)';
        ctx.fillStyle = token.faction === 'enemy' ? 'rgba(196, 90, 90, 0.05)' : 'rgba(90, 138, 181, 0.05)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(token.x + cellSize/2, token.y + cellSize/2, cellSize * 1.5, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }
}

function drawTokens(cellSize, gridType) {
    if (!ctx) return;
    const tokens = state.gridCombat.tokens || [];
    for (const token of tokens) {
        const tacStatus = checkTacticalStatus(token);
        ctx.save();
        
        if (tacStatus.isFlanked) {
            ctx.strokeStyle = '#e8c84a'; // Gold for flanked
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(token.x - 3, token.y - 3, cellSize + 6, cellSize + 6);
            ctx.setLineDash([]);
        }
        
        ctx.fillStyle = token.color || '#d4af37';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
        ctx.arc(token.x + cellSize/2, token.y + cellSize/2, cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.label?.substring(0, 3) || '?', token.x + cellSize/2, token.y + cellSize/2);
        
        if (token.harm > 0) {
            ctx.fillStyle = '#d97a7a';
            ctx.font = '9px sans-serif';
            ctx.fillText(`❤${token.harm}`, token.x + cellSize/2, token.y + cellSize + 8);
        }
        ctx.restore();
    }
}

function addGridToken() {
    if (!gridCombatActive) {
        showToast('Enable Grid Combat mode first', 'error');
        return;
    }
    
    const name = prompt('Token label:', 'Guard');
    if (!name) return;
    const faction = prompt('Faction (ally or enemy):', 'enemy')?.toLowerCase() || 'enemy';
    const bodyStr = prompt('Body Attribute (for movement):', '3');
    const body = parseInt(bodyStr) || 3;
    
    const containerEl = document.getElementById('whiteboard-canvas-container');
    const rect = containerEl.getBoundingClientRect();
    const cellSize = state.gridCombat.cellSize || 40;
    
    const x = Math.floor((rect.width / 2 - cellSize/2) / cellSize) * cellSize;
    const y = Math.floor((rect.height / 2 - cellSize/2) / cellSize) * cellSize;
    
    const colors = faction === 'ally' ? ['#5a8ab5', '#6baa7a', '#7aa8d0'] : ['#c45a5a', '#d48a5a', '#d97a7a'];
    
    if (!state.gridCombat.tokens) state.gridCombat.tokens = [];
    state.gridCombat.tokens.push({
        id: 'token-' + Date.now(),
        label: name,
        faction: faction,
        body: body,
        x: x,
        y: y,
        color: colors[state.gridCombat.tokens.length % colors.length],
        harm: 0,
        fatigue: 0,
        tags: []
    });
    
    saveWhiteboardData();
    renderGridCombat();
    logRecordingEvent('token_add', `${name} (${faction}) added to the board.`);
    showToast(`⚔️ Token "${name}" added`, 'success');
}

function clearGridTokens() {
    if (!gridCombatActive) return;
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
        <div class="whiteboard-modern-layout flex flex-col gap-2">
            <header class="flex-between">
                <div>
                    <h1 class="page-title">Campaign Whiteboard</h1>
                    <p class="page-sub">Draw, note, and plan your tactical encounters visually.</p>
                </div>
                <div class="flex gap-1 flex-center">
                    <span class="status-badge badge ${isConnected ? 'badge-green' : 'badge-red'}">
                        ${isConnected ? '🟢 Live' : '📡 Local'}
                    </span>
                    <span class="status-text text-muted text-sm">
                        ${isConnected ? 'Real-time sync' : 'Local only'}
                    </span>
                </div>
            </header>

            <div id="whiteboard-offline-overlay" class="panel flex gap-2 flex-center" style="display:${isConnected ? 'none' : 'flex'}; border: 1px solid var(--orange);">
                <span style="font-size: 1.5rem;">📡</span>
                <div class="flex-1">
                    <div class="text-gold font-bold">Local Mode</div>
                    <div class="text-muted text-sm">Whiteboard is saved locally. Connect to server for real-time collaboration.</div>
                </div>
                <button class="btn btn-sm btn-primary" id="whiteboard-connect-btn">🔗 Connect</button>
            </div>

            <!-- Toolbar -->
            <div class="panel flex gap-1 flex-center" style="padding: 0.5rem;">
                <div class="flex gap-1">
                    <button class="btn btn-sm ${currentTool === 'pen' ? 'btn-gold' : 'btn-secondary'}" data-tool="pen">✏️</button>
                    <button class="btn btn-sm ${currentTool === 'eraser' ? 'btn-gold' : 'btn-secondary'}" data-tool="eraser">🧹</button>
                    <button class="btn btn-sm ${currentTool === 'line' ? 'btn-gold' : 'btn-secondary'}" data-tool="line">📏</button>
                    <button class="btn btn-sm ${currentTool === 'rectangle' ? 'btn-gold' : 'btn-secondary'}" data-tool="rectangle">▭</button>
                    <button class="btn btn-sm ${currentTool === 'ruler' ? 'btn-gold' : 'btn-secondary'}" data-tool="ruler" title="Measure">📐</button>
                    <button class="btn btn-sm ${currentTool === 'select' ? 'btn-gold' : 'btn-secondary'}" data-tool="select" title="Drag Tokens">👆</button>
                </div>
                <div class="flex gap-1 flex-center">
                    <input type="color" id="whiteboard-color" value="${currentColor}" style="width:32px;height:32px;padding:0;border:none;background:none;cursor:pointer;" />
                    <input type="range" id="whiteboard-size" min="1" max="20" value="${currentSize}" style="width:80px;" />
                </div>
                <div class="flex gap-1 flex-center">
                    <label class="text-muted text-sm flex gap-1 flex-center">
                        <input type="checkbox" id="whiteboard-grid" ${state.settings.gridSnap ? 'checked' : ''} style="width:auto;"/> Snap
                    </label>
                    <button class="btn btn-sm ${gridCombatActive ? 'btn-danger' : 'btn-secondary'}" id="whiteboard-grid-combat">
                        ${gridCombatActive ? '⚔️ Combat ON' : '⚔️ Combat OFF'}
                    </button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-add-token" style="${gridCombatActive ? '' : 'display:none;'}">🎯 Add Token</button>
                </div>
            </div>

            <!-- Canvas Container -->
            <div class="panel relative overflow-hidden" id="whiteboard-canvas-container" style="height: 65vh; min-height: 400px; padding: 0;">
                <canvas id="whiteboard-canvas" style="width:100%;height:100%;display:block;cursor:crosshair;"></canvas>
                <div id="whiteboard-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></div>
                ${!isConnected ? `
                    <div class="absolute flex-center" style="top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:0.1;font-size:4rem;font-weight:bold;color:var(--text3);white-space:nowrap;">
                        LOCAL MODE
                    </div>
                ` : ''}
            </div>

            <!-- Controls -->
            <div class="panel flex gap-1 flex-center">
                <button class="btn btn-sm btn-primary" id="whiteboard-add-note">📝 Add Note</button>
                <button class="btn btn-sm btn-secondary" id="whiteboard-upload-image">🖼️ Upload Map</button>
                <button class="btn btn-sm btn-ghost" id="whiteboard-clear-drawings">🧹 Clear Draw</button>
                <button class="btn btn-sm btn-ghost" id="whiteboard-clear" title="Clear All">🗑️ Clear All</button>
                <button class="btn btn-sm btn-gold" id="whiteboard-export" title="Export as Image">💾 Export</button>
                <button class="btn btn-sm btn-secondary" id="whiteboard-sync-btn" title="Force sync">🔄 Sync</button>
                <span class="text-muted whiteboard-stats text-sm flex-1 text-right">${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images</span>
            </div>
            <!-- Grid Combat Legend -->
            <div id="grid-combat-legend" style="position:absolute;bottom:10px;right:10px;background:rgba(10,10,15,0.8);padding:0.3rem 0.6rem;border-radius:var(--radius-sm);font-size:0.65rem;color:var(--text3);display:${gridCombatActive ? 'block' : 'none'};border:1px solid var(--border);pointer-events:none;z-index:20;">
                <div><span style="color:var(--red);">⬤</span> Enemy ZoC | <span style="color:var(--blue);">⬤</span> Ally ZoC</div>
                <div><span style="color:var(--gold);">▭</span> Flanked (Dominant)</div>
            </div>

        </div>
    `;

    initCanvas();
    renderOverlay();
    attachEvents();
    restoreDrawings();
    setupWebSocketSync();
    updateConnectionStatusUI(isConnected);
    
    if (gridCombatActive) renderGridCombat();
}

// ============================================================
// CANVAS INITIALIZATION
// ============================================================

function initCanvas() {
    canvas = document.getElementById('whiteboard-canvas');
    if (!canvas) return;
    const containerEl = document.getElementById('whiteboard-canvas-container');
    const rect = containerEl.getBoundingClientRect();
    canvas.width = rect.width || 800;
    canvas.height = rect.height || 600;
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    restoreDrawings();
}

function drawGrid() {
    if (!ctx) return;
    const gridSize = state.settings.gridSize || 40;
    const gridType = state.settings.gridType || 'square';
    if (gridType === 'hex') drawHexGrid(gridSize * 1.5);
    else if (gridType === 'isometric') drawIsometricGrid(gridSize);
    else {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
    }
}

function drawStroke(drawing) {
    if (!ctx || !drawing.points || drawing.points.length < 1) return;
    ctx.save();
    ctx.strokeStyle = drawing.color || '#d4af37';
    ctx.lineWidth = drawing.size || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (drawing.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
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
    const gridSize = state.settings.gridSize || 40;
    return { x: Math.round(x / gridSize) * gridSize, y: Math.round(y / gridSize) * gridSize };
}

// ============================================================
// OVERLAY RENDERING
// ============================================================

function renderOverlay() {
    const overlay = document.getElementById('whiteboard-overlay');
    if (!overlay) return;
    let notesHtml = state.notes.map(note => `
        <div class="glass" style="position:absolute;left:${note.x}px;top:${note.y}px;padding:0.4rem 0.6rem;border-radius:var(--radius-sm);min-width:80px;max-width:180px;cursor:pointer;z-index:10;color:var(--text);font-size:0.8rem;pointer-events:auto;border:1px solid var(--gold);">
            <div>${escHtml(note.content)}</div>
            <div class="flex gap-1 mt-1">
                <button class="btn btn-xs btn-ghost" onclick="window.editWhiteboardNote('${note.id}')">✏️</button>
                <button class="btn btn-xs btn-danger" onclick="window.deleteWhiteboardNote('${note.id}')">✕</button>
            </div>
        </div>
    `).join('');

    let imagesHtml = state.images.map(img => `
        <div style="position:absolute;left:${img.x}px;top:${img.y}px;cursor:pointer;z-index:5;pointer-events:auto;">
            <img src="${img.data}" style="max-width:250px;max-height:250px;border-radius:4px;display:block;border:1px solid var(--border);" />
            <button class="btn btn-xs btn-danger absolute" style="top:-8px;right:-8px;" onclick="window.deleteWhiteboardImage('${img.id}')">✕</button>
        </div>
    `).join('');

    overlay.innerHTML = notesHtml + imagesHtml;
}

// ============================================================
// DRAWING FUNCTIONS
// ============================================================

function startDrawing(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    const pos = snapToGrid(x, y);

    // Token Dragging
    if (currentTool === 'select' && gridCombatActive) {
        const cellSize = state.gridCombat.cellSize || 40;
        const clickedToken = state.gridCombat.tokens.find(t => 
            Math.abs(t.x - pos.x) < cellSize && Math.abs(t.y - pos.y) < cellSize
        );
        if (clickedToken) {
            isDraggingToken = true;
            draggedToken = clickedToken;
            tokenStartPos = { x: clickedToken.x, y: clickedToken.y };
            canvas.style.cursor = 'grabbing';
            return;
        }
    }

    // Ruler Tool
    if (currentTool === 'ruler') {
        isDrawing = true;
        rulerStart = pos;
        rulerEnd = pos;
        return;
    }

    if (currentTool === 'select' || currentTool === 'text') return;
    isDrawing = true;
    lastX = pos.x; lastY = pos.y;
    
    if (currentTool === 'pen' || currentTool === 'eraser') {
        const drawing = {
            id: 'draw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            points: [{ x: pos.x, y: pos.y }],
            color: currentTool === 'eraser' ? '#000' : currentColor,
            size: currentTool === 'eraser' ? currentSize * 3 : currentSize,
            tool: currentTool,
            timestamp: Date.now()
        };
        state.drawings.push(drawing);
        drawStroke(drawing);
        saveWhiteboardData();
    } else if (currentTool === 'line' || currentTool === 'rectangle') {
        state._shapeStart = { x: pos.x, y: pos.y };
    }
}

function draw(e) {
    if (!isDrawing && !isDraggingToken) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    const pos = snapToGrid(x, y);

    // Token Dragging
    if (isDraggingToken && draggedToken) {
        draggedToken.x = pos.x;
        draggedToken.y = pos.y;
        restoreDrawings();
        renderGridCombat();
        return;
    }

    // Ruler Drawing
    if (currentTool === 'ruler' && rulerStart) {
        rulerEnd = pos;
        restoreDrawings();
        renderGridCombat();
        
        const dx = rulerEnd.x - rulerStart.x;
        const dy = rulerEnd.y - rulerStart.y;
        const distPixels = Math.sqrt(dx*dx + dy*dy);
        const cellSize = state.gridCombat.cellSize || 40;
        const cells = Math.round(distPixels / cellSize);
        const feet = cells * 5;
        
        ctx.save();
        ctx.strokeStyle = '#6baa7a'; // Green
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(rulerStart.x, rulerStart.y);
        ctx.lineTo(rulerEnd.x, rulerEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(10,10,15,0.9)';
        ctx.fillRect(rulerEnd.x + 10, rulerEnd.y - 20, 80, 22);
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${cells} cells (${feet}ft)`, rulerEnd.x + 15, rulerEnd.y - 5);
        ctx.restore();
        return;
    }
    
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
                ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
            } else {
                ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
            }
        }
        ctx.restore();
    }
}

function endDrawing(e) {
    // Handle Token Drop
    if (isDraggingToken) {
        if (draggedToken && tokenStartPos) {
            const cellSize = state.gridCombat.cellSize || 40;
            const dx = draggedToken.x - tokenStartPos.x;
            const dy = draggedToken.y - tokenStartPos.y;
            const cellsMoved = Math.round(Math.sqrt(dx*dx + dy*dy) / cellSize);
            
            if (cellsMoved > 0) {
                logRecordingEvent('token_move', `${draggedToken.label} moved ${cellsMoved} cells (${cellsMoved * 5} ft).`);
                const tacStatus = checkTacticalStatus(draggedToken);
                if (tacStatus.isFlanked) {
                    logRecordingEvent('tactical_event', `${draggedToken.label} is now FLANKED! (Attacker gains Dominant).`);
                    showToast(`${draggedToken.label} is Flanked!`, 'warning');
                } else if (tacStatus.inEnemyZoC) {
                    logRecordingEvent('tactical_event', `${draggedToken.label} entered enemy ZoC (Controlled).`);
                    showToast(`${draggedToken.label} entered ZoC!`, 'warning');
                }
                saveWhiteboardData();
            }
        }
        isDraggingToken = false;
        draggedToken = null;
        tokenStartPos = null;
        canvas.style.cursor = 'grab';
        return;
    }

    // Handle Ruler End
    if (currentTool === 'ruler' && rulerStart && rulerEnd) {
        const dx = rulerEnd.x - rulerStart.x;
        const dy = rulerEnd.y - rulerStart.y;
        const cellSize = state.gridCombat.cellSize || 40;
        const cells = Math.round(Math.sqrt(dx*dx + dy*dy) / cellSize);
        logRecordingEvent('measurement', `GM measured ${cells} cells (${cells * 5} ft).`);
        isDrawing = false;
        rulerStart = null;
        rulerEnd = null;
        restoreDrawings();
        renderGridCombat();
        return;
    }

    if (!isDrawing) return;
    isDrawing = false;
    
    if (currentTool === 'line' || currentTool === 'rectangle') {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left;
        const y = (e.clientY || e.changedTouches?.[0]?.clientY || 0) - rect.top;
        const pos = snapToGrid(x, y);
        const start = state._shapeStart;
        if (start) {
            state.drawings.push({
                id: 'draw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                points: [{ x: start.x, y: start.y }, { x: pos.x, y: pos.y }],
                color: currentColor,
                size: currentSize,
                tool: currentTool,
                timestamp: Date.now()
            });
            saveWhiteboardData();
            restoreDrawings();
            state._shapeStart = null;
        }
    }
}

function restoreDrawings() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.settings.showGrid !== false) drawGrid();
    state.drawings.forEach(drawStroke);
    if (gridCombatActive) renderGridCombat();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    document.getElementById('whiteboard-connect-btn')?.addEventListener('click', () => {
        import('../../core/websocket.js').then(ws => ws.default.initWebSocket()).catch(() => {});
    });

    document.querySelectorAll('.btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn[data-tool]').forEach(b => b.className = 'btn btn-sm btn-secondary');
            btn.className = 'btn btn-sm btn-gold';
            currentTool = btn.dataset.tool;
            if (canvas) {
                canvas.style.cursor = currentTool === 'select' ? 'grab' : 'crosshair';
            }
        });
    });

    document.getElementById('whiteboard-color')?.addEventListener('input', (e) => currentColor = e.target.value);
    document.getElementById('whiteboard-size')?.addEventListener('input', (e) => currentSize = parseInt(e.target.value));
    document.getElementById('whiteboard-grid')?.addEventListener('change', (e) => {
        state.settings.gridSnap = e.target.checked;
        saveWhiteboardData();
    });
    
    document.getElementById('whiteboard-grid-combat')?.addEventListener('click', toggleGridCombat);
    document.getElementById('whiteboard-add-token')?.addEventListener('click', addGridToken);
    document.getElementById('whiteboard-clear')?.addEventListener('click', clearWhiteboardAll);
    document.getElementById('whiteboard-export')?.addEventListener('click', exportWhiteboard);
    document.getElementById('whiteboard-add-note')?.addEventListener('click', addWhiteboardNote);
    document.getElementById('whiteboard-upload-image')?.addEventListener('click', uploadWhiteboardImage);
    document.getElementById('whiteboard-clear-drawings')?.addEventListener('click', clearWhiteboardDrawings);
    document.getElementById('whiteboard-sync-btn')?.addEventListener('click', forceSync);

    if (canvas) {
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDrawing);
        canvas.addEventListener('mouseleave', endDrawing);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e.touches[0]); });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
        canvas.addEventListener('touchend', (e) => { e.preventDefault(); endDrawing(e.changedTouches[0]); });
    }

    window.addEventListener('resize', () => { initCanvas(); restoreDrawings(); renderOverlay(); });

    window.editWhiteboardNote = (id) => {
        const note = state.notes.find(n => n.id === id);
        if (note) {
            const newContent = prompt('Edit note:', note.content);
            if (newContent !== null) { note.content = newContent; saveWhiteboardData(); renderOverlay(); }
        }
    };
    window.deleteWhiteboardNote = (id) => {
        state.notes = state.notes.filter(n => n.id !== id);
        saveWhiteboardData(); renderOverlay();
    };
    window.deleteWhiteboardImage = (id) => {
        state.images = state.images.filter(i => i.id !== id);
        saveWhiteboardData(); renderOverlay();
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
    };
    
}

// ============================================================
// ACTIONS
// ============================================================

export function addWhiteboardNote() {
    const content = prompt('Note content:', 'New note');
    if (!content) return;
    const containerEl = document.getElementById('whiteboard-canvas-container');
    const rect = containerEl.getBoundingClientRect();
    state.notes.push({
        id: 'note-' + Date.now(),
        x: rect.width / 2 - 50,
        y: rect.height / 2 - 50,
        content: content
    });
    saveWhiteboardData();
    renderOverlay();
}

export function uploadWhiteboardImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const containerEl = document.getElementById('whiteboard-canvas-container');
            const rect = containerEl.getBoundingClientRect();
            state.images.push({
                id: 'img-' + Date.now(),
                x: rect.width / 2 - 100,
                y: rect.height / 2 - 100,
                data: ev.target.result
            });
            saveWhiteboardData();
            renderOverlay();
            showToast('🖼️ Image uploaded', 'success');
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

export function clearWhiteboardDrawings() {
    if (!confirm('Clear all drawings only?')) return;
    state.drawings = [];
    saveWhiteboardData();
    restoreDrawings();
    updateStats();
}

export function clearWhiteboardAll() {
    if (!confirm('Delete everything (drawings, notes, images, tokens)?')) return;
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
    // Create a temporary canvas to draw background + tokens cleanly for export
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = '#12121a'; // bg2
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = 'whiteboard-' + Date.now() + '.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
    showToast('💾 Whiteboard exported', 'success');
}

// ============================================================
// LIFECYCLE
// ============================================================

export function onActivate() {
    loadWhiteboardData();
    setupWebSocketSync();
    if (container) {
        setTimeout(() => { initCanvas(); restoreDrawings(); renderOverlay(); updateStats(); }, 100);
    }
}

export function onDeactivate() {
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
}

export function destroy() {
    container = null;
    saveWhiteboardData();
    cleanupWebSocketListeners();
}

export default {
    render, destroy, onActivate, onDeactivate, refresh,
    loadWhiteboardData, saveWhiteboardData, forceSync,
    addWhiteboardNote, uploadWhiteboardImage, toggleGridCombat, addGridToken, clearGridTokens
};
