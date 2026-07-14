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
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';

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
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    loadWhiteboardData();

    container.innerHTML = `
        <div class="whiteboard-modern-layout">
            <!-- Header -->
            <header class="whiteboard-header">
                <h1 class="whiteboard-title">✏️ Campaign Whiteboard</h1>
                <p class="whiteboard-subtitle">Draw, note, and plan your campaign visually.</p>
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
                <button class="btn btn-sm btn-primary" onclick="window.addWhiteboardNote()">📝 Add Note</button>
                <button class="btn btn-sm btn-secondary" onclick="window.uploadWhiteboardImage()">🖼️ Upload Image</button>
                <button class="btn btn-sm btn-secondary" onclick="window.clearWhiteboardCanvas()">🧹 Clear Drawing</button>
                <span class="text-muted" style="font-size:0.8rem;">${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images</span>
            </div>
        </div>
    `;

    initCanvas();
    renderOverlay();
    attachEvents();
    restoreDrawings();
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
                <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();window.editWhiteboardNote(${idx})">✏️</button>
                <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();window.deleteWhiteboardNote(${idx})">✕</button>
            </div>
        </div>
    `).join('');

    // Images
    let imagesHtml = state.images.map((img, idx) => `
        <div class="whiteboard-image-overlay" style="position:absolute;left:${img.x}px;top:${img.y}px;cursor:pointer;z-index:5;border:2px solid var(--border);border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
            <img src="${img.data}" style="max-width:200px;max-height:200px;border-radius:4px;" />
            <div class="image-actions" style="position:absolute;top:-8px;right:-8px;">
                <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();window.deleteWhiteboardImage(${idx})">✕</button>
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
            id: 'draw-' + Date.now(),
            points: [{ x: pos.x, y: pos.y }],
            color: currentTool === 'eraser' ? '#1a1a2e' : currentColor,
            size: currentTool === 'eraser' ? currentSize * 3 : currentSize,
            tool: currentTool
        };
        state.drawings.push(drawing);
        drawStroke(drawing);
        saveWhiteboardData();
    } else if (currentTool === 'line' || currentTool === 'rectangle') {
        // Start shape - store start point
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
        // Preview shape - redraw
        restoreDrawings();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        
        const start = state._shapeStart;
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

function endDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    
    // Finalize shape
    if (currentTool === 'line' || currentTool === 'rectangle') {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left;
        const y = (e.clientY || e.changedTouches?.[0]?.clientY || 0) - rect.top;
        const pos = snapToGrid(x, y);
        const start = state._shapeStart;
        
        if (start) {
            const drawing = {
                id: 'draw-' + Date.now(),
                points: [
                    { x: start.x, y: start.y },
                    { x: pos.x, y: pos.y }
                ],
                color: currentColor,
                size: currentSize,
                tool: currentTool,
                shape: currentTool
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
    
    // Clear and redraw
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

window.addWhiteboardNote = function() {
    const content = prompt('Enter note content:');
    if (!content) return;
    
    // Position in center-ish of canvas
    const container = document.getElementById('whiteboard-canvas-container');
    const rect = container.getBoundingClientRect();
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#dda0dd', '#f9ca24'];
    
    state.notes.push({
        id: 'note-' + Date.now(),
        content,
        x: rect.width / 2 - 50 + Math.random() * 40,
        y: rect.height / 2 - 25 + Math.random() * 40,
        color: colors[Math.floor(Math.random() * colors.length)]
    });
    saveWhiteboardData();
    renderOverlay();
    showToast('📝 Note added', 'success');
};

window.editWhiteboardNote = function(index) {
    const note = state.notes[index];
    if (!note) return;
    const content = prompt('Edit note:', note.content);
    if (content === null) return;
    note.content = content;
    saveWhiteboardData();
    renderOverlay();
    showToast('✏️ Note updated', 'success');
};

window.deleteWhiteboardNote = function(index) {
    if (!confirm('Delete this note?')) return;
    state.notes.splice(index, 1);
    saveWhiteboardData();
    renderOverlay();
    showToast('🗑️ Note deleted', 'info');
};

// ============================================================
// IMAGE FUNCTIONS
// ============================================================

window.uploadWhiteboardImage = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const container = document.getElementById('whiteboard-canvas-container');
            const rect = container.getBoundingClientRect();
            
            state.images.push({
                id: 'img-' + Date.now(),
                data: event.target.result,
                x: rect.width / 2 - 100 + Math.random() * 40,
                y: rect.height / 2 - 100 + Math.random() * 40
            });
            saveWhiteboardData();
            renderOverlay();
            showToast('🖼️ Image uploaded', 'success');
        };
        reader.readAsDataURL(file);
    };
    input.click();
};

window.deleteWhiteboardImage = function(index) {
    if (!confirm('Delete this image?')) return;
    state.images.splice(index, 1);
    saveWhiteboardData();
    renderOverlay();
    showToast('🗑️ Image removed', 'info');
};

window.clearWhiteboardCanvas = function() {
    if (!confirm('Clear all drawings? (Notes and images will remain)')) return;
    state.drawings = [];
    saveWhiteboardData();
    restoreDrawings();
    showToast('🧹 Drawings cleared', 'info');
};

// ============================================================
// EXPORT
// ============================================================

function exportWhiteboard() {
    if (!canvas) return;
    
    // Create a temporary canvas with the overlay included
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw the main canvas
    tempCtx.drawImage(canvas, 0, 0);
    
    // Draw overlay elements (notes)
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
            tempCtx.fillText(note.querySelector('.note-content')?.textContent || '', x + 8, y + 20);
        });
        
        // Draw images
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

// ============================================================
// WINDOW EXPOSURES
// ============================================================

window.exportWhiteboard = exportWhiteboard;

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
            canvas.style.cursor = currentTool === 'pen' ? 'crosshair' : 
                                   currentTool === 'eraser' ? 'cell' :
                                   currentTool === 'select' ? 'grab' : 'crosshair';
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

    // Clear button
    document.getElementById('whiteboard-clear')?.addEventListener('click', () => {
        if (!confirm('Clear ALL whiteboard content?')) return;
        state.drawings = [];
        state.notes = [];
        state.images = [];
        saveWhiteboardData();
        restoreDrawings();
        renderOverlay();
        showToast('🧹 Whiteboard cleared', 'info');
    });

    // Export button
    document.getElementById('whiteboard-export')?.addEventListener('click', exportWhiteboard);

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
    if (container) {
        // Re-init canvas if needed
        setTimeout(() => {
            initCanvas();
            restoreDrawings();
            renderOverlay();
        }, 100);
    }
}

export function onDeactivate() {
    console.log('[Whiteboard] Deactivated');
    saveWhiteboardData();
}

export function refresh() {
    loadWhiteboardData();
    initCanvas();
    restoreDrawings();
    renderOverlay();
}

export function destroy() {
    container = null;
    saveWhiteboardData();
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
    saveWhiteboardData
};
