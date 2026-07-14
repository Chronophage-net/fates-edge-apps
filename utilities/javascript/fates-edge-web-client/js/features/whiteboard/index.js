// features/whiteboard/index.js
/**
 * Whiteboard - Campaign Whiteboard with drawing, notes, and image support
 * 
 * Features:
 * - Freehand drawing with color/size controls
 * - Text notes with positioning
 * - Image upload for maps/reference
 * - Grid snap option
 * - Simple drawing tools (pen, eraser, line, rectangle, text)
 * - WebSocket sync for real-time collaboration
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';
import { 
    isConnectedToServer, 
    onEvent, 
    offEvent, 
    sendMessage as sendWSMessage 
} from '../../core/websocket.js';

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
    settings: {
        gridSnap: false,
        gridSize: 20,
        backgroundColor: '#1a1a2e'
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
    }
}

function saveWhiteboardData() {
    const saved = getState();
    if (!saved.whiteboard) saved.whiteboard = {};
    saved.whiteboard.drawings = state.drawings;
    saved.whiteboard.notes = state.notes;
    saved.whiteboard.images = state.images;
    saved.whiteboard.settings = state.settings;
    saveState();
    // Broadcast to other clients
    broadcastWhiteboardUpdate();
}

// ============================================================
// WEBSOCKET SYNC
// ============================================================

function setupWebSocketSync() {
    cleanupWebSocketListeners();
    
    if (!isConnectedToServer()) {
        console.log('[Whiteboard] Not connected to server, local mode only');
        return;
    }
    
    // Listen for whiteboard updates from other clients
    const updateHandler = (data) => {
        if (isSyncing) return;
        if (!data || !data.whiteboard) return;
        
        console.log('[Whiteboard] Received update from server');
        
        // Merge incoming data
        const incoming = data.whiteboard;
        if (incoming.drawings) {
            // Check if we have more drawings than the incoming
            // If we have local changes that haven't been synced, merge them
            if (state.drawings.length > incoming.drawings.length) {
                // We have local drawings, keep them and add incoming
                const existingIds = new Set(state.drawings.map(d => d.id));
                const newDrawings = incoming.drawings.filter(d => !existingIds.has(d.id));
                state.drawings = [...state.drawings, ...newDrawings];
            } else if (incoming.drawings.length > state.drawings.length) {
                // Incoming has more drawings, take them
                state.drawings = incoming.drawings;
            } else {
                // Same length, merge any new ones
                const existingIds = new Set(state.drawings.map(d => d.id));
                const newDrawings = incoming.drawings.filter(d => !existingIds.has(d.id));
                if (newDrawings.length > 0) {
                    state.drawings = [...state.drawings, ...newDrawings];
                }
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
        
        // Save and refresh UI
        saveWhiteboardData();
        refreshUI();
        showToast('🔄 Whiteboard synced', 'info');
    };
    
    onEvent('whiteboard-update', updateHandler);
    wsListeners.set('whiteboard-update', updateHandler);
    
    // Also listen for initial room state
    const roomStateHandler = (data) => {
        if (data && data.whiteboard) {
            isSyncing = true;
            state.drawings = data.whiteboard.drawings || [];
            state.notes = data.whiteboard.notes || [];
            state.images = data.whiteboard.images || [];
            state.settings = data.whiteboard.settings || state.settings;
            saveWhiteboardData();
            refreshUI();
            isSyncing = false;
            console.log('[Whiteboard] Initial state loaded from server');
        }
    };
    
    onEvent('room-state', roomStateHandler);
    wsListeners.set('room-state', roomStateHandler);
    
    console.log('[Whiteboard] WebSocket sync enabled');
}

function cleanupWebSocketListeners() {
    for (const [event, handler] of wsListeners) {
        try {
            offEvent(event, handler);
        } catch (e) {
            console.debug('[Whiteboard] Error removing listener:', e);
        }
    }
    wsListeners.clear();
}

function broadcastWhiteboardUpdate() {
    if (isSyncing) return;
    if (!isConnectedToServer()) return;
    
    try {
        const data = {
            whiteboard: {
                drawings: state.drawings,
                notes: state.notes,
                images: state.images,
                settings: state.settings
            },
            timestamp: Date.now()
        };
        sendWSMessage('whiteboard-update', data);
    } catch (e) {
        console.warn('[Whiteboard] Failed to broadcast update:', e);
    }
}

function refreshUI() {
    if (container) {
        restoreDrawings();
        renderOverlay();
        updateStats();
    }
}

function updateStats() {
    const stats = document.querySelector('.whiteboard-stats');
    if (stats) {
        stats.textContent = `${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images`;
    }
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    loadWhiteboardData();

    const isConnected = isConnectedToServer();

    container.innerHTML = `
        <div class="whiteboard-modern-layout">
            <!-- Header -->
            <header class="whiteboard-header">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <div>
                        <h1 class="whiteboard-title">✏️ Campaign Whiteboard</h1>
                        <p class="whiteboard-subtitle">Draw, note, and plan your campaign visually.</p>
                    </div>
                    <div style="display:flex;gap:0.5rem;align-items:center;">
                        <span class="status-badge ${isConnected ? 'connected' : 'local'}" style="font-size:0.7rem;">
                            ${isConnected ? '🟢 Live' : '📡 Local'}
                        </span>
                        <span class="whiteboard-stats" style="font-size:0.75rem;color:var(--text3);">
                            ${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images
                        </span>
                    </div>
                </div>
            </header>

            <!-- Toolbar -->
            <div class="whiteboard-toolbar">
                <div class="tool-group">
                    <button class="tool-btn active" data-tool="pen" title="Pen">✏️</button>
                    <button class="tool-btn" data-tool="eraser" title="Eraser">🧹</button>
                    <button class="tool-btn" data-tool="line" title="Line">📏</button>
                    <button class="tool-btn" data-tool="rectangle" title="Rectangle">▭</button>
                    <button class="tool-btn" data-tool="text" title="Text">📝</button>
                    <button class="tool-btn" data-tool="select" title="Select/Move">👆</button>
                </div>
                <div class="tool-group">
                    <input type="color" id="whiteboard-color" value="${currentColor}" />
                    <input type="range" id="whiteboard-size" min="1" max="20" value="${currentSize}" />
                    <span id="size-label">${currentSize}px</span>
                </div>
                <div class="tool-group">
                    <label class="inline-check">
                        <input type="checkbox" id="whiteboard-grid" ${state.settings.gridSnap ? 'checked' : ''} />
                        Grid Snap
                    </label>
                    <button class="tool-btn" id="whiteboard-clear" title="Clear All">🗑️</button>
                    <button class="tool-btn" id="whiteboard-export" title="Export as Image">💾</button>
                </div>
            </div>

            <!-- Canvas Container -->
            <div class="whiteboard-canvas-container" id="whiteboard-canvas-container">
                <canvas id="whiteboard-canvas"></canvas>
                <!-- Overlay for notes and images -->
                <div id="whiteboard-overlay"></div>
            </div>

            <!-- Controls -->
            <div class="whiteboard-controls">
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
}

// ============================================================
// CANVAS INITIALIZATION
// ============================================================

function initCanvas() {
    canvas = document.getElementById('whiteboard-canvas');
    if (!canvas) return;
    
    const container = document.getElementById('whiteboard-canvas-container');
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width - 4;
    canvas.height = rect.height - 4;
    
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Set background
    ctx.fillStyle = state.settings.backgroundColor || '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawGrid();
    
    // Redraw existing drawings
    state.drawings.forEach(drawing => {
        drawStroke(drawing);
    });
}

function drawGrid() {
    if (!ctx || !state.settings.gridSnap) return;
    
    const gridSize = state.settings.gridSize || 20;
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

function drawStroke(drawing) {
    if (!ctx || !drawing.points || drawing.points.length < 2) return;
    
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
    let notesHtml = state.notes.map((note, idx) => `
        <div class="whiteboard-note-overlay" style="position:absolute;left:${note.x}px;top:${note.y}px;background:${note.color || '#ffd700'};padding:0.5rem;border-radius:8px;min-width:100px;max-width:200px;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;z-index:10;color:#1a141a;font-size:0.85rem;">
            <div class="note-content">${escHtml(note.content)}</div>
            <div class="note-actions" style="display:flex;gap:0.2rem;margin-top:0.3rem;">
                <button class="btn btn-xs btn-ghost" onclick="window.editWhiteboardNote('${note.id}')">✏️</button>
                <button class="btn btn-xs btn-danger" onclick="window.deleteWhiteboardNote('${note.id}')">✕</button>
            </div>
        </div>
    `).join('');

    // Images
    let imagesHtml = state.images.map((img, idx) => `
        <div class="whiteboard-image-overlay" style="position:absolute;left:${img.x}px;top:${img.y}px;cursor:pointer;z-index:5;border:2px solid var(--border);border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
            <img src="${img.data}" style="max-width:200px;max-height:200px;border-radius:4px;" />
            <div class="image-actions" style="position:absolute;top:-8px;right:-8px;">
                <button class="btn btn-xs btn-danger" onclick="window.deleteWhiteboardImage('${img.id}')">✕</button>
            </div>
        </div>
    `).join('');

    overlay.innerHTML = notesHtml + imagesHtml;
}

// ============================================================
// DRAWING FUNCTIONS
// ============================================================

function startDrawing(e) {
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
    drawGrid();
    
    state.drawings.forEach(drawing => {
        drawStroke(drawing);
    });
}

// ============================================================
// NOTE FUNCTIONS
// ============================================================

function addWhiteboardNote() {
    const content = prompt('Enter note content:');
    if (!content) return;
    
    const containerEl = document.getElementById('whiteboard-canvas-container');
    const rect = containerEl.getBoundingClientRect();
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#dda0dd', '#f9ca24'];
    
    state.notes.push({
        id: 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        content,
        x: rect.width / 2 - 50 + (Math.random() - 0.5) * 100,
        y: rect.height / 2 - 25 + (Math.random() - 0.5) * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        timestamp: Date.now()
    });
    saveWhiteboardData();
    renderOverlay();
    updateStats();
    showToast('📝 Note added', 'success');
}

function editWhiteboardNote(noteId) {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;
    const content = prompt('Edit note:', note.content);
    if (content === null) return;
    note.content = content;
    saveWhiteboardData();
    renderOverlay();
    showToast('✏️ Note updated', 'success');
}

function deleteWhiteboardNote(noteId) {
    if (!confirm('Delete this note?')) return;
    state.notes = state.notes.filter(n => n.id !== noteId);
    saveWhiteboardData();
    renderOverlay();
    updateStats();
    showToast('🗑️ Note deleted', 'info');
}

// ============================================================
// IMAGE FUNCTIONS
// ============================================================

function uploadWhiteboardImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const containerEl = document.getElementById('whiteboard-canvas-container');
            const rect = containerEl.getBoundingClientRect();
            
            state.images.push({
                id: 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                data: event.target.result,
                x: rect.width / 2 - 100 + (Math.random() - 0.5) * 80,
                y: rect.height / 2 - 100 + (Math.random() - 0.5) * 80,
                timestamp: Date.now()
            });
            saveWhiteboardData();
            renderOverlay();
            updateStats();
            showToast('🖼️ Image uploaded', 'success');
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function deleteWhiteboardImage(imgId) {
    if (!confirm('Delete this image?')) return;
    state.images = state.images.filter(i => i.id !== imgId);
    saveWhiteboardData();
    renderOverlay();
    updateStats();
    showToast('🗑️ Image removed', 'info');
}

function clearWhiteboardDrawings() {
    if (!confirm('Clear all drawings? (Notes and images will remain)')) return;
    state.drawings = [];
    saveWhiteboardData();
    restoreDrawings();
    updateStats();
    showToast('🧹 Drawings cleared', 'info');
}

function clearWhiteboardAll() {
    if (!confirm('Clear ALL whiteboard content?')) return;
    state.drawings = [];
    state.notes = [];
    state.images = [];
    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    updateStats();
    showToast('🧹 Whiteboard cleared', 'info');
}

// ============================================================
// EXPORT
// ============================================================

function exportWhiteboard() {
    if (!canvas) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(canvas, 0, 0);
    
    const overlay = document.getElementById('whiteboard-overlay');
    if (overlay) {
        const notes = overlay.querySelectorAll('.whiteboard-note-overlay');
        notes.forEach(note => {
            const rect = note.getBoundingClientRect();
            const containerRect = overlay.getBoundingClientRect();
            const x = rect.left - containerRect.left;
            const y = rect.top - containerRect.top;
            
            tempCtx.fillStyle = note.style.backgroundColor || '#ffd700';
            tempCtx.fillRect(x, y, rect.width, rect.height);
            tempCtx.fillStyle = '#1a141a';
            tempCtx.font = '14px sans-serif';
            const content = note.querySelector('.note-content')?.textContent || '';
            tempCtx.fillText(content, x + 8, y + 20);
        });
        
        const images = overlay.querySelectorAll('.whiteboard-image-overlay img');
        images.forEach(img => {
            const rect = img.getBoundingClientRect();
            const containerRect = overlay.getBoundingClientRect();
            const x = rect.left - containerRect.left;
            const y = rect.top - containerRect.top;
            tempCtx.drawImage(img, x, y, rect.width, rect.height);
        });
    }
    
    const link = document.createElement('a');
    link.download = `whiteboard-${new Date().toISOString().slice(0,10)}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
    showToast('💾 Whiteboard exported!', 'success');
}

function forceSync() {
    if (!isConnectedToServer()) {
        showToast('Not connected to server', 'error');
        return;
    }
    broadcastWhiteboardUpdate();
    showToast('🔄 Sync requested', 'info');
}

// ============================================================
// WINDOW EXPOSURES
// ============================================================

window.addWhiteboardNote = addWhiteboardNote;
window.editWhiteboardNote = editWhiteboardNote;
window.deleteWhiteboardNote = deleteWhiteboardNote;
window.uploadWhiteboardImage = uploadWhiteboardImage;
window.deleteWhiteboardImage = deleteWhiteboardImage;
window.clearWhiteboardDrawings = clearWhiteboardDrawings;
window.clearWhiteboardAll = clearWhiteboardAll;
window.exportWhiteboard = exportWhiteboard;
window.forceWhiteboardSync = forceSync;

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
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

    // Sync button
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
}

export function destroy() {
    container = null;
    saveWhiteboardData();
    cleanupWebSocketListeners();
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
    uploadWhiteboardImage
};