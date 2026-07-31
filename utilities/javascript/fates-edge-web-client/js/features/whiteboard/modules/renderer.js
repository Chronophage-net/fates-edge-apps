
// modules/renderer.js
import { state, canvas, ctx, getLayer, isLayerVisibleNow, layersInDrawOrder, playerViewActive, currentTool } from './state.js';
import { setCanvas, setCtx } from './state.js';
import { GRID_COLORS } from './constants.js';
import { escHtml } from '../../../core/utils.js';

// ── Exported UI update helpers ──
export function updateStats() {
    const stats = document.querySelector('.whiteboard-stats');
    if (stats) {
        stats.textContent = `${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images, ${state.characterTokens.length} tokens`;
    }
}

// ── Canvas Initialisation ──

export function initCanvas() {
    const canvasEl = document.getElementById('whiteboard-canvas');
    if (!canvasEl) return;
    const containerEl = document.getElementById('whiteboard-canvas-container');
    const rect = containerEl.getBoundingClientRect();
    canvasEl.width = rect.width || 800;
    canvasEl.height = rect.height || 600;
    setCanvas(canvasEl);
    const context = canvasEl.getContext('2d');
    setCtx(context);
    // Default stroke settings – will be overridden by each drawing operation
    context.strokeStyle = '#d4af37';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    restoreDrawings();
}


// ── Grid Drawing ──
export function drawGrid() {
    if (!ctx) return;
    const gridSize = state.settings.gridSize || 40;
    const gridType = state.settings.gridType || 'square';
    ctx.save();
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
    ctx.restore();
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

// ── Drawing Strokes ──
export function drawStroke(drawing) {
    if (!ctx || !drawing.points || drawing.points.length < 1) return;
    const layer = getLayer(drawing.layerId) || getLayer('drawing');
    ctx.save();
    ctx.globalAlpha = (layer ? layer.opacity : 1) * (typeof drawing.opacity === 'number' ? drawing.opacity : 1);
    ctx.strokeStyle = drawing.color || '#d4af37';
    ctx.lineWidth = drawing.size || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (drawing.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';

    if (drawing.tool === 'rectangle' && drawing.points.length >= 2) {
        const [a, b] = drawing.points;
        ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (drawing.tool === 'circle' && drawing.points.length >= 2) {
        const [a, b] = drawing.points;
        const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx, 0.01), Math.max(ry, 0.01), 0, 0, Math.PI * 2);
        ctx.stroke();
    } else if (drawing.tool === 'arrow' && drawing.points.length >= 2) {
        drawArrow(drawing.points[0], drawing.points[1]);
    } else if (drawing.tool === 'polygon' && drawing.points.length >= 2) {
        const [a, b] = drawing.points;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const radius = Math.hypot(b.x - a.x, b.y - a.y) / 2;
        drawPolygonShape(cx, cy, Math.max(radius, 0.01), drawing.sides || 6, drawing.starRatio || 0);
    } else if (drawing.tool === 'measure' && drawing.points.length >= 2) {
        const [a, b] = drawing.points;
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        if (drawing.label) {
            const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.font = '12px sans-serif';
            const textW = ctx.measureText(drawing.label).width;
            ctx.fillStyle = 'rgba(10,10,15,0.85)';
            ctx.fillRect(midX - textW / 2 - 5, midY - 9, textW + 10, 18);
            ctx.fillStyle = drawing.color || '#6baa7a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(drawing.label, midX, midY);
            ctx.restore();
        }
    } else {
        // Bezier smoothing
        const pts = drawing.points;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 2) {
            ctx.lineTo(pts[1].x, pts[1].y);
        } else {
            for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[i < 1 ? 0 : i - 1];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = pts[i + 2 > pts.length - 1 ? i + 1 : i + 2];
                const cp1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
                const cp2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
                ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
            }
        }
        ctx.stroke();
    }
    ctx.restore();
}

export function drawArrow(start, end) {
    if (!ctx) return;
    const headLength = Math.max(10, (ctx.lineWidth || 3) * 3);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}

export function drawPolygonShape(cx, cy, radius, sides, starRatio, rotation = 0) {
    if (!ctx) return;
    const points = computePolygonPoints(cx, cy, radius, sides, starRatio, rotation);
    if (points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.stroke();
}

function computePolygonPoints(cx, cy, radius, sides, starRatio, rotation = 0) {
    const n = Math.max(3, Math.round(sides || 6));
    const ratio = starRatio || 0;
    const points = [];
    for (let i = 0; i < n * (ratio > 0 ? 2 : 1); i++) {
        const step = ratio > 0 ? (Math.PI * 2) / (n * 2) : (Math.PI * 2) / n;
        const angle = i * step + rotation - Math.PI / 2;
        const r = ratio > 0 && i % 2 === 1 ? radius * ratio : radius;
        points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
    return points;
}

// ── Overlay Rendering (Notes, Images, Character Tokens) ──
export function renderOverlay() {
    const overlay = document.getElementById('whiteboard-overlay');
    if (!overlay) return;
    // Notes, images, and character tokens live in this overlay (a separate DOM
    // layer stacked on top of the canvas), so dragging them doesn't conflict
    // with canvas-drawing tools like pen/shapes/fog. They should be draggable
    // any time they're not on a locked layer — not only when "Select" is the
    // active tool, since requiring a tool switch just to move a token you
    // just placed is surprising and easy to miss.
    const canDrag = true;

    // Notes
    let notesHtml = state.notes.map(note => {
        const layer = getLayer(note.layerId) || getLayer('notes');
        if (layer && !isLayerVisibleNow(layer)) return '';
        const locked = layer && layer.locked;
        const opacity = layer ? layer.opacity : 1;
        return `
        <div class="glass" style="position:absolute;left:${note.x}px;top:${note.y}px;padding:0.4rem 0.6rem;border-radius:var(--radius-sm);min-width:80px;max-width:180px;cursor:${canDrag && !locked ? 'grab' : 'pointer'};z-index:10;color:var(--text);font-size:0.8rem;pointer-events:auto;border:1px solid var(--gold);opacity:${opacity};"
             ${canDrag && !locked ? `onmousedown="window.__wbStartDragNote('${note.id}', event)"` : ''}>
            <div>${escHtml(note.content)}</div>
            <div class="flex gap-1 mt-1">
                <button class="btn btn-xs btn-ghost" onclick="window.editWhiteboardNote('${note.id}')">✏️</button>
                <button class="btn btn-xs btn-danger" onclick="window.deleteWhiteboardNote('${note.id}')">✕</button>
            </div>
        </div>
    `;
    }).join('');

    // Images
    let imagesHtml = state.images.map(img => {
        const layer = getLayer(img.layerId) || getLayer('background');
        if (layer && !isLayerVisibleNow(layer)) return '';
        const locked = layer && layer.locked;
        const opacity = layer ? layer.opacity : 1;
        return `
        <div style="position:absolute;left:${img.x}px;top:${img.y}px;cursor:${canDrag && !locked ? 'grab' : 'pointer'};z-index:5;pointer-events:auto;opacity:${opacity};"
             ${canDrag && !locked ? `onmousedown="window.__wbStartDragImage('${img.id}', event)"` : ''}>
            <img src="${img.data}" style="max-width:250px;max-height:250px;border-radius:4px;display:block;border:1px solid var(--border);" draggable="false" />
            <button class="btn btn-xs btn-danger absolute" style="top:-8px;right:-8px;" onclick="window.deleteWhiteboardImage('${img.id}')">✕</button>
        </div>
    `;
    }).join('');

    // Character Tokens
    let tokensHtml = state.characterTokens.map(token => {
        const layer = getLayer(token.layerId) || getLayer('characters');
        if (layer && !isLayerVisibleNow(layer)) return '';
        const locked = layer && layer.locked;
        const opacity = layer ? layer.opacity : 1;
        return `
        <div style="position:absolute;left:${token.x}px;top:${token.y}px;cursor:${canDrag && !locked ? 'grab' : 'default'};z-index:15;pointer-events:auto;opacity:${opacity};display:flex;flex-direction:column;align-items:center;"
             ${canDrag && !locked ? `onmousedown="window.__wbStartDragToken('${token.id}', event)"` : ''}>
            <img src="${escHtml(token.imageData)}" style="width:48px;height:48px;border-radius:4px;border:2px solid var(--gold);object-fit:cover;" draggable="false" />
            <span style="font-size:0.7rem;color:var(--text);background:rgba(0,0,0,0.6);padding:0 4px;border-radius:2px;margin-top:2px;max-width:80px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${escHtml(token.name)}</span>
            <button class="btn btn-xs btn-danger" style="position:absolute;top:-8px;right:-8px;padding:0 4px;font-size:0.6rem;border-radius:50%;" onclick="window.deleteCharacterToken('${token.id}')">✕</button>
        </div>
    `;
    }).join('');

    overlay.innerHTML = notesHtml + imagesHtml + tokensHtml;
}

// ── Restore all drawings and grid ──
export function restoreDrawings() {
    if (!ctx) return;
    // updateTrackerLinkStatusUI is in combat.js
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.settings.showGrid !== false && !state.gridCombat.enabled) drawGrid();

    for (const layer of layersInDrawOrder()) {
        if (!isLayerVisibleNow(layer)) continue;
        const drawingsOnLayer = state.drawings.filter(d => (d.layerId || 'drawing') === layer.id);
        for (const d of drawingsOnLayer) drawStroke(d);
    }

    // If grid combat is active, render it (fog included)
    if (state.gridCombat.enabled) {
        // defer to combat.js
        import('./combat.js').then(module => module.renderGridCombat());
    } else if (!window.konrehActive) {
        // draw fog even if combat is off
        import('./fog.js').then(module => module.drawFogOfWar(state.gridCombat.cellSize || 40));
    }
}

// ── Ping Marker ──
export function renderPingMarker(x, y) {
    const overlay = document.getElementById('whiteboard-overlay');
    if (!overlay) return;
    const marker = document.createElement('div');
    marker.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:0; height:0; pointer-events:none; z-index:50;`;
    marker.innerHTML = `
        <div class="wb-ping-ring" style="position:absolute; left:-18px; top:-18px; width:36px; height:36px;
                    border:3px solid var(--gold); border-radius:50%; box-shadow:0 0 10px var(--gold);"></div>
        <div style="position:absolute; left:-4px; top:-4px; width:8px; height:8px;
                    background:var(--gold); border-radius:50%; box-shadow:0 0 8px var(--gold);"></div>
    `;
    overlay.appendChild(marker);
    const ring = marker.querySelector('.wb-ping-ring');
    if (ring && ring.animate) {
        ring.animate(
            [{ transform: 'scale(0.3)', opacity: 1 }, { transform: 'scale(2.4)', opacity: 0 }],
            { duration: 1400, easing: 'ease-out' }
        );
    }
    setTimeout(() => marker.remove(), 1500);
}

// ── UI tool state (single source of truth lives in state.js) ──
export function getCurrentTool() { return currentTool; }

// For snapToGrid (used by drawing functions, but we'll keep it in renderer)
export function snapToGrid(x, y) {
    if (!state.settings.gridSnap && !window.konrehActive) return { x, y };
    const gridSize = window.konrehActive ? (state.gridCombat.cellSize || 64) : (state.settings.gridSize || 40);
    return { x: Math.round(x / gridSize) * gridSize, y: Math.round(y / gridSize) * gridSize };
}
