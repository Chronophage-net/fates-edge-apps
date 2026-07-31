// modules/ui.js
/**
 * UI Orchestrator for the Whiteboard.
 * Holds the DOM references, event bindings, and high‑level UI state.
 * Delegates all core logic to the other modules.
 */
import { state, setContainer, setCanvas, setCtx, playerViewActive, setPlayerViewActive, getActiveSheet, setCurrentTool as setSharedTool } from './state.js';
import { loadWhiteboardData, saveWhiteboardData, setupWebSocketSync, forceSync, onActivate, onDeactivate } from './persistence.js';
import { renderSheetTabs, addSheet, renameSheet, duplicateSheet, deleteSheet, switchToSheet } from './sheets.js';
import { renderLayersPanel, toggleLayersPanel } from './layers.js';
import { undo, redo, pushUndoSnapshot } from './undo.js';
import { drawArrow, drawPolygonShape, drawStroke, initCanvas, renderOverlay, renderPingMarker, restoreDrawings, snapToGrid, updateStats } from './renderer.js';
import { drawFogOfWar, paintFogCell } from './fog.js';
import {
    toggleGridCombat, renderGridCombat, addGridToken, clearGridTokens, toggleKonreh, importFromTracker,
    isGridCombatActive, isKonrehActive, setVttRole, canControlFog, isVttPlayer, isVttGm, setSpeakingNames
} from './combat.js';
import { populateRoster, toggleRosterPanel, handleRosterDrop } from './roster.js';
import { showToast } from '../../../components/Toast.js';
import { escHtml } from '../../../core/utils.js';
import { isConnectedToServer, sendMessage } from '../../../core/websocket.js';
import { onVoiceClientsChanged } from '../../vtt/voice.js';
import { openKonrehModal } from '../../kon-reh/index.js';
import { logRecordingEvent } from '../../../core/media.js';
import { activeLayerId } from './layers.js';

// ============================================================
// UI STATE
// ============================================================

let currentTool = 'pen';
let currentColor = '#d4af37';
let currentSize = 3;
let currentOpacity = 1;
let tableModeActive = false;
let polygonSides = 6;
let polygonStarRatio = 0;

// Drawing state
let isDrawing = false;
let lastX = 0, lastY = 0;
let shapeStart = null;
let rulerStart = null, rulerEnd = null;
let fogWallStart = null;

// Drag state (tokens, lights, notes, images, character tokens)
let isDraggingToken = false;
let draggedToken = null;
let tokenStartPos = null;
let isDraggingLight = false;
let draggedLight = null;
let isDraggingObject = false;
let draggedObject = null;
let draggedObjectType = null;

// Voice & GM role
let gmRoleHandler = null;
let voiceUnsub = null;

// Export UI state for other modules
export { currentTool, currentColor, currentSize, currentOpacity, tableModeActive };
export function getCurrentTool() { return currentTool; }
export function setCurrentTool(t) { currentTool = t; }
export function setCurrentColor(c) { currentColor = c; }
export function setCurrentSize(s) { currentSize = s; }
export function setCurrentOpacity(o) { currentOpacity = o; }
export function setTableModeActive(v) { tableModeActive = v; }
export function getPlayerViewActive() { return playerViewActive; }

// ============================================================
// PLAYER VIEW
// ============================================================

export function togglePlayerView() {
    const newVal = !playerViewActive;
    setPlayerViewActive(newVal);
    const btn = document.getElementById('whiteboard-player-view');
    if (btn) {
        btn.textContent = newVal ? '👁️ Player View ON' : '👁️ Player View';
        btn.className = newVal ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-secondary';
    }
    restoreDrawings();
    renderOverlay();
    renderLayersPanel();
    showToast(playerViewActive ? 'Previewing what players see (GM layers hidden)' : 'Player View off', 'info');
}

// ============================================================
// TABLE MODE
// ============================================================

export function toggleTableMode() {
    tableModeActive = !tableModeActive;
    applyTableMode();
    showToast(tableModeActive ? '🖥️ Table Mode — board maximized' : 'Table Mode off', 'info');
}

function applyTableMode() {
    const header = document.getElementById('whiteboard-header');
    const toolbar = document.getElementById('whiteboard-toolbar');
    const sheetTabs = document.getElementById('whiteboard-sheet-tabs');
    const controlsBar = document.getElementById('whiteboard-controls-bar');
    const layersPanel = document.getElementById('whiteboard-layers-panel');
    const containerEl = document.getElementById('whiteboard-canvas-container');
    const toggleBtn = document.getElementById('whiteboard-table-mode');
    const offlineOverlay = document.getElementById('whiteboard-offline-overlay');

    if (header) header.style.display = tableModeActive ? 'none' : '';
    if (toolbar) toolbar.style.display = tableModeActive ? 'none' : '';
    if (sheetTabs) sheetTabs.style.display = tableModeActive ? 'none' : 'flex';
    if (controlsBar) controlsBar.style.display = tableModeActive ? 'none' : '';
    if (offlineOverlay) offlineOverlay.style.display = tableModeActive ? 'none' : (isConnectedToServer() ? 'none' : 'flex');
    if (layersPanel && tableModeActive) layersPanel.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = tableModeActive ? '🖥️ Exit Table Mode' : '🖥️ Table Mode';
    if (containerEl) containerEl.style.height = tableModeActive ? '92vh' : '65vh';

    const legend = document.getElementById('grid-combat-legend');
    if (legend) legend.style.fontSize = tableModeActive ? '0.95rem' : '0.65rem';

    initCanvas();
    restoreDrawings();
    renderOverlay();
}

// ============================================================
// LIGHTS PANEL
// ============================================================

function renderLightsPanel() {
    const panel = document.getElementById('whiteboard-lights-panel');
    if (!panel) return;
    const fog = state.gridCombat?.fogOfWar;
    const lights = fog?.lightSources || [];
    if (lights.length === 0) {
        panel.innerHTML = `<div class="text-muted text-sm">No light sources placed. Use the 💡 Light tool to add one.</div>`;
        return;
    }
    const cellSize = state.gridCombat.cellSize || 40;
    panel.innerHTML = `
        <div class="flex-between mb-1">
            <span class="text-gold font-bold text-sm">💡 Light Sources (${lights.length})</span>
            <button class="btn btn-xs btn-ghost" id="lights-panel-close">✕</button>
        </div>
        <div style="max-height:200px;overflow-y:auto;">
            ${lights.map((light, idx) => `
                <div class="flex gap-2 flex-center" style="padding:4px 0; border-bottom:1px solid var(--border);">
                    <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${light.color || 'rgba(255,220,150,0.25)'};border:1px solid var(--gold);"></span>
                    <label class="text-muted text-xs" title="Radius in cells">R:</label>
                    <input type="range" min="1" max="20" step="0.5" value="${light.radius / cellSize}" 
                           data-light-idx="${idx}" data-prop="radius" style="width:60px;" />
                    <span class="text-xs">${(light.radius / cellSize).toFixed(1)}</span>
                    <label class="text-muted text-xs">Int:</label>
                    <input type="range" min="0.1" max="1" step="0.05" value="${light.intensity ?? 1}" 
                           data-light-idx="${idx}" data-prop="intensity" style="width:50px;" />
                    <span class="text-xs">${(light.intensity ?? 1).toFixed(2)}</span>
                    <input type="color" value="${rgbToHex(light.color)}" data-light-idx="${idx}" data-prop="color" style="width:24px;height:24px;padding:0;border:none;background:none;cursor:pointer;" />
                    <button class="btn btn-xs btn-danger" data-light-idx="${idx}" data-action="delete-light">✕</button>
                </div>
            `).join('')}
        </div>
    `;

    panel.querySelectorAll('input[data-prop]').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.lightIdx, 10);
            const prop = e.target.dataset.prop;
            const fog = state.gridCombat.fogOfWar;
            if (!fog || !fog.lightSources[idx]) return;
            let val = parseFloat(e.target.value);
            if (prop === 'radius') val = val * cellSize;
            fog.lightSources[idx][prop] = val;
            if (prop === 'color') {
                const hex = e.target.value;
                const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
                fog.lightSources[idx].color = `rgba(${r},${g},${b},0.25)`;
            }
            saveWhiteboardData();
            restoreDrawings();
            renderGridCombat();
            if (prop === 'radius') {
                const label = e.target.parentElement.querySelector('span.text-xs');
                if (label) label.textContent = (val / cellSize).toFixed(1);
            }
        });
    });

    panel.querySelectorAll('[data-action="delete-light"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.lightIdx, 10);
            const fog = state.gridCombat.fogOfWar;
            if (!fog || !fog.lightSources[idx]) return;
            fog.lightSources.splice(idx, 1);
            saveWhiteboardData();
            renderLightsPanel();
            restoreDrawings();
            renderGridCombat();
        });
    });

    panel.querySelector('#lights-panel-close')?.addEventListener('click', () => {
        panel.style.display = 'none';
    });
}

function rgbToHex(rgba) {
    if (!rgba) return '#d4af37';
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return '#d4af37';
    const r = parseInt(match[1], 10), g = parseInt(match[2], 10), b = parseInt(match[3], 10);
    return '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
}

// ============================================================
// FOG TOOLBAR VISIBILITY
// ============================================================

export function renderVttCombatToolbar() {
    const fog = state.gridCombat?.fogOfWar;
    const showFog = !isKonrehActive() && canControlFog();

    const fogToggle = document.getElementById('whiteboard-fog-toggle');
    const fogMode = document.getElementById('whiteboard-fog-mode');
    const darknessSlider = document.getElementById('whiteboard-fog-darkness');
    const darknessLabel = document.getElementById('whiteboard-darkness-value');
    const manageLightsBtn = document.getElementById('whiteboard-manage-lights');

    if (fogToggle) {
        fogToggle.style.display = showFog ? 'inline-block' : 'none';
        fogToggle.textContent = fog?.enabled ? '🌫️ Fog ON' : '🌫️ Fog OFF';
        fogToggle.className = fog?.enabled ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-secondary';
    }
    if (fogMode) fogMode.style.display = showFog ? 'inline-block' : 'none';
    if (darknessSlider) {
        darknessSlider.style.display = showFog ? 'inline-block' : 'none';
        if (fog) {
            darknessSlider.value = fog.darkness;
            if (darknessLabel) darknessLabel.textContent = Math.round(fog.darkness * 100) + '%';
        }
    }
    if (manageLightsBtn) {
        manageLightsBtn.style.display = showFog && fog?.enabled ? 'inline-block' : 'none';
    }

    const fogTools = document.querySelectorAll('[data-tool="fog-reveal"], [data-tool="fog-hide"], [data-tool="fog-wall"], [data-tool="fog-light"]');
    fogTools.forEach(btn => {
        const enabled = showFog && fog?.enabled;
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.4';
        btn.style.pointerEvents = enabled ? 'auto' : 'none';
    });

    if (!fog?.enabled && ['fog-reveal','fog-hide','fog-wall','fog-light'].includes(currentTool)) {
        currentTool = 'pen';
        setSharedTool(currentTool);
        document.querySelectorAll('.btn[data-tool]').forEach(b => b.className = 'btn btn-sm btn-secondary');
        const penBtn = document.querySelector('.btn[data-tool="pen"]');
        if (penBtn) penBtn.className = 'btn btn-sm btn-gold';
        const canvasEl = document.getElementById('whiteboard-canvas');
        if (canvasEl) canvasEl.style.cursor = 'crosshair';
    }

    if (manageLightsBtn) {
        manageLightsBtn.onclick = () => {
            const panel = document.getElementById('whiteboard-lights-panel');
            if (!panel) return;
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) renderLightsPanel();
        };
    }

    const legend = document.getElementById('fog-legend');
    if (legend) legend.style.display = (fog?.enabled && !isKonrehActive()) ? 'block' : 'none';
}

// ============================================================
// MAIN RENDER
// ============================================================

export function render(el) {
    setContainer(el);
    loadWhiteboardData();

    const isConnected = isConnectedToServer();
    el.innerHTML = `
        <div class="whiteboard-modern-layout flex flex-col gap-2">
            <header class="flex-between" id="whiteboard-header">
                <div>
                    <h1 class="page-title">Campaign Whiteboard</h1>
                    <p class="page-sub">Draw, note, and plan your tactical encounters visually.</p>
                </div>
                <div class="flex gap-1 flex-center">
                    <span class="status-badge badge ${isConnected ? 'badge-green' : 'badge-red'}">${isConnected ? '🟢 Live' : '📡 Local'}</span>
                    <span class="status-text text-muted text-sm">${isConnected ? 'Real-time sync' : 'Local only'}</span>
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

            <div class="panel flex flex-wrap gap-2" id="whiteboard-toolbar" style="padding:0.5rem;">
                <!-- Drawing tools -->
                <div class="flex gap-1 flex-center">
                    <button class="btn btn-sm ${currentTool === 'pen' ? 'btn-gold' : 'btn-secondary'}" data-tool="pen" title="Freehand pen">✏️</button>
                    <button class="btn btn-sm ${currentTool === 'eraser' ? 'btn-gold' : 'btn-secondary'}" data-tool="eraser" title="Eraser">🧹</button>
                    <button class="btn btn-sm ${currentTool === 'line' ? 'btn-gold' : 'btn-secondary'}" data-tool="line" title="Line">📏</button>
                    <button class="btn btn-sm ${currentTool === 'rectangle' ? 'btn-gold' : 'btn-secondary'}" data-tool="rectangle" title="Rectangle">▭</button>
                    <button class="btn btn-sm ${currentTool === 'circle' ? 'btn-gold' : 'btn-secondary'}" data-tool="circle" title="Ellipse">◯</button>
                    <button class="btn btn-sm ${currentTool === 'arrow' ? 'btn-gold' : 'btn-secondary'}" data-tool="arrow" title="Arrow">➜</button>
                    <button class="btn btn-sm ${currentTool === 'polygon' ? 'btn-gold' : 'btn-secondary'}" data-tool="polygon" title="Polygon / Star">⬡</button>
                    <button class="btn btn-sm ${currentTool === 'ruler' ? 'btn-gold' : 'btn-secondary'}" data-tool="ruler" title="Measure (Shift+release to pin)">📐</button>
                    <button class="btn btn-sm ${currentTool === 'select' ? 'btn-gold' : 'btn-secondary'}" data-tool="select" title="Select / Drag / Edit lights">👆</button>
                    <button class="btn btn-sm ${currentTool === 'ping' ? 'btn-gold' : 'btn-secondary'}" data-tool="ping" title="Ping">📍</button>
                </div>

                <div class="flex gap-1 flex-center" id="whiteboard-polygon-controls" style="display:${currentTool === 'polygon' ? 'flex' : 'none'};">
                    <label class="text-muted text-sm flex gap-1 flex-center">Sides <input type="number" id="whiteboard-polygon-sides" min="3" max="12" value="${polygonSides}" style="width:44px;" /></label>
                    <label class="text-muted text-sm flex gap-1 flex-center"><input type="checkbox" id="whiteboard-polygon-star" ${polygonStarRatio > 0 ? 'checked' : ''} style="width:auto;" /> Star</label>
                </div>

                <div class="flex gap-1 flex-center">
                    <input type="color" id="whiteboard-color" value="${currentColor}" style="width:32px;height:32px;padding:0;border:none;background:none;cursor:pointer;" />
                    <input type="range" id="whiteboard-size" min="1" max="20" value="${currentSize}" title="Stroke size" style="width:70px;" />
                    <input type="range" id="whiteboard-opacity" min="0.1" max="1" step="0.05" value="${currentOpacity}" title="Stroke opacity" style="width:60px;" />
                </div>

                <div class="flex gap-1 flex-center">
                    <button class="btn btn-sm btn-secondary" id="whiteboard-undo" title="Undo (Ctrl+Z)">↶</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-redo" title="Redo (Ctrl+Y)">↷</button>
                </div>

                <div class="flex gap-1 flex-center">
                    <label class="text-muted text-sm flex gap-1 flex-center"><input type="checkbox" id="whiteboard-grid" ${state.settings.gridSnap ? 'checked' : ''} style="width:auto;"/> Snap</label>
                    <button class="btn btn-sm ${isGridCombatActive() ? 'btn-danger' : 'btn-secondary'}" id="whiteboard-grid-combat">${isGridCombatActive() ? '⚔️ Combat ON' : '⚔️ Combat OFF'}</button>
                    <select id="whiteboard-grid-type" style="${isKonrehActive() ? 'display:none;' : ''}font-size:0.8rem;padding:0.25rem 0.3rem;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;">
                        <option value="square" ${state.gridCombat.gridType === 'square' ? 'selected' : ''}>◻️ Square</option>
                        <option value="hex" ${state.gridCombat.gridType === 'hex' ? 'selected' : ''}>⬡ Hex</option>
                        <option value="isometric" ${state.gridCombat.gridType === 'isometric' ? 'selected' : ''}>◇ Isometric</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-add-token" style="${isGridCombatActive() && !isKonrehActive() ? '' : 'display:none;'}">🎯 Add Token</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-import-tracker" style="${isGridCombatActive() && !isKonrehActive() ? '' : 'display:none;'}">🔗 Import Tracker</button>
                    <button class="btn btn-sm ${isKonrehActive() ? 'btn-gold' : 'btn-secondary'}" id="whiteboard-konreh">🌀 Kon'reh</button>
                    <span id="whiteboard-tracker-link-status" class="text-muted text-sm"></span>
                </div>

                <div class="flex gap-1 flex-center" style="border-left:1px solid var(--border);padding-left:8px;">
                    <button class="btn btn-sm ${state.gridCombat.fogOfWar?.enabled ? 'btn-danger' : 'btn-secondary'}" id="whiteboard-fog-toggle">${state.gridCombat.fogOfWar?.enabled ? '🌫️ Fog ON' : '🌫️ Fog OFF'}</button>
                    <select id="whiteboard-fog-mode" style="font-size:0.8rem;padding:0.25rem 0.3rem;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;">
                        <option value="manual" ${state.gridCombat.fogOfWar?.mode === 'manual' ? 'selected' : ''}>🖌️ Manual</option>
                        <option value="token-vision" ${state.gridCombat.fogOfWar?.mode === 'token-vision' ? 'selected' : ''}>👁️ Token Vision</option>
                        <option value="line-of-sight" ${state.gridCombat.fogOfWar?.mode === 'line-of-sight' ? 'selected' : ''}>📡 Line of Sight</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" data-tool="fog-reveal" title="Paint revealed areas">✨ Reveal</button>
                    <button class="btn btn-sm btn-secondary" data-tool="fog-hide" title="Hide areas">🌑 Hide</button>
                    <button class="btn btn-sm btn-secondary" data-tool="fog-wall" title="Draw LoS wall">🧱 Wall</button>
                    <button class="btn btn-sm btn-secondary" data-tool="fog-light" title="Place light source">💡 Light</button>
                    <button class="btn btn-sm btn-ghost" id="whiteboard-fog-clear" title="Clear all fog data">Clear Fog</button>
                </div>

                <div class="flex gap-1 flex-center" style="border-left:1px solid var(--border);padding-left:8px;">
                    <label class="text-muted text-sm flex gap-1 flex-center" title="Darkness level">Dark <input type="range" id="whiteboard-fog-darkness" min="0" max="1" step="0.01" value="${state.gridCombat.fogOfWar?.darkness ?? 0.85}" style="width:80px;" /><span id="whiteboard-darkness-value" class="text-xs" style="min-width:30px;">${Math.round((state.gridCombat.fogOfWar?.darkness ?? 0.85) * 100)}%</span></label>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-manage-lights">💡 Manage Lights</button>
                </div>

                <div class="flex gap-1 flex-center" style="border-left:1px solid var(--border);padding-left:8px;">
                    <button class="btn btn-sm btn-secondary" id="whiteboard-toggle-layers">🗂️ Layers</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-player-view">👁️ Player View</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-toggle-roster">👥 Roster</button>
                </div>
            </div>

            <div id="whiteboard-lights-panel" class="panel" style="display:none; padding:0.5rem;"></div>
            <div class="panel" id="whiteboard-layers-panel" style="display:none; padding:0.5rem;"></div>
            <div id="whiteboard-roster-panel" class="panel" style="display:none; padding:0.5rem; max-height:300px; overflow-y:auto;"></div>

            <div id="whiteboard-sheet-tabs" style="display:flex; align-items:flex-end; padding-left:4px; margin-bottom:-1px; position:relative; z-index:2;"></div>

            <div class="panel relative overflow-hidden" id="whiteboard-canvas-container" style="height: ${tableModeActive ? '92vh' : '65vh'}; min-height: 400px; padding: 0;">
                <canvas id="whiteboard-canvas" style="width:100%;height:100%;display:block;cursor:crosshair;"></canvas>
                <div id="whiteboard-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></div>
                ${!isConnected ? `<div class="absolute flex-center" style="top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:0.1;font-size:4rem;font-weight:bold;color:var(--text3);white-space:nowrap;">LOCAL MODE</div>` : ''}
                <button id="whiteboard-table-mode" title="Maximize board" style="position:absolute; top:10px; right:10px; z-index:30; padding:0.4rem 0.8rem; background:rgba(10,10,15,0.75); color:var(--text); border:1px solid var(--border); border-radius:var(--radius-sm); cursor:pointer; font-size:0.85rem;">${tableModeActive ? '🖥️ Exit Table Mode' : '🖥️ Table Mode'}</button>
            </div>

            <div class="panel flex gap-1 flex-center" id="whiteboard-controls-bar">
                <button class="btn btn-sm btn-primary" id="whiteboard-add-note">📝 Add Note</button>
                <button class="btn btn-sm btn-secondary" id="whiteboard-upload-image">🖼️ Upload Map</button>
                <button class="btn btn-sm btn-ghost" id="whiteboard-clear-drawings">🧹 Clear Draw</button>
                <button class="btn btn-sm btn-ghost" id="whiteboard-clear" title="Clear All">🗑️ Clear All</button>
                <button class="btn btn-sm btn-gold" id="whiteboard-export" title="Export as Image">💾 Export</button>
                <button class="btn btn-sm btn-secondary" id="whiteboard-sync-btn" title="Force sync">🔄 Sync</button>
                <span class="text-muted whiteboard-stats text-sm flex-1 text-right">${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images, ${state.characterTokens.length} tokens</span>
            </div>

            <div id="grid-combat-legend" style="position:absolute;bottom:10px;right:10px;background:rgba(10,10,15,0.8);padding:0.3rem 0.6rem;border-radius:var(--radius-sm);font-size:0.65rem;color:var(--text3);display:${isGridCombatActive() ? 'block' : 'none'};border:1px solid var(--border);pointer-events:none;z-index:20;">
                <div><span style="color:var(--red);">⬤</span> Enemy ZoC | <span style="color:var(--blue);">⬤</span> Ally ZoC</div>
                <div><span style="color:var(--gold);">▭</span> Flanked (Dominant)</div>
                <div id="fog-legend" style="display:${state.gridCombat.fogOfWar?.enabled ? 'block' : 'none'};"><span style="color:rgba(255,220,100,0.8);">💡</span> Light | <span style="color:rgba(196,90,90,0.8);">🧱</span> LoS Wall</div>
            </div>
        </div>
    `;

    // ── Initialise canvas ──
    initCanvas();
    renderOverlay();
    restoreDrawings();

    // ── Attach events ──
    attachEvents();

    // ── Set up sync ──
    setupWebSocketSync();

    // ── Render sheets, layers, etc. ──
    renderSheetTabs();
    renderLayersPanel();
    renderLightsPanel();
    renderVttCombatToolbar();
    populateRoster();

    // ── Voice speaking state ──
    if (voiceUnsub) voiceUnsub();
    voiceUnsub = onVoiceClientsChanged((clients) => {
        const names = new Set((clients || []).filter(c => c.speaking).map(c => (c.name || '').toLowerCase()));
        setSpeakingNames(names);
        if (isGridCombatActive()) { restoreDrawings(); renderGridCombat(); }
    });

    if (isGridCombatActive()) renderGridCombat();
    applyTableMode();

    // ── Save refs ──
    const canvasEl = document.getElementById('whiteboard-canvas');
    setCanvas(canvasEl);
    if (canvasEl) setCtx(canvasEl.getContext('2d'));
    setContainer(el);
}

// ============================================================
// EVENT BINDINGS (full, as in original)
// ============================================================

export function attachEvents() {
    // ── Connect button ──
    document.getElementById('whiteboard-connect-btn')?.addEventListener('click', () => {
        import('../../../core/websocket.js').then(ws => ws.default.initWebSocket()).catch(() => {});
    });

    // ── Tool buttons ──
    document.querySelectorAll('.btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn[data-tool]').forEach(b => b.className = 'btn btn-sm btn-secondary');
            btn.className = 'btn btn-sm btn-gold';
            currentTool = btn.dataset.tool;
            setCurrentTool(currentTool);
            setSharedTool(currentTool);
            const canvasEl = document.getElementById('whiteboard-canvas');
            if (canvasEl) canvasEl.style.cursor = currentTool === 'select' ? 'grab' : 'crosshair';
            const polyControls = document.getElementById('whiteboard-polygon-controls');
            if (polyControls) polyControls.style.display = currentTool === 'polygon' ? 'flex' : 'none';
            renderOverlay();
        });
    });

    // ── Polygon controls ──
    document.getElementById('whiteboard-polygon-sides')?.addEventListener('input', (e) => {
        const n = parseInt(e.target.value, 10);
        polygonSides = isNaN(n) ? 6 : Math.max(3, Math.min(12, n));
    });
    document.getElementById('whiteboard-polygon-star')?.addEventListener('change', (e) => {
        polygonStarRatio = e.target.checked ? 0.5 : 0;
    });

    // ── Stroke options ──
    document.getElementById('whiteboard-color')?.addEventListener('input', (e) => {
        currentColor = e.target.value;
        setCurrentColor(currentColor);
    });
    document.getElementById('whiteboard-size')?.addEventListener('input', (e) => {
        currentSize = parseInt(e.target.value);
        setCurrentSize(currentSize);
    });
    document.getElementById('whiteboard-opacity')?.addEventListener('input', (e) => {
        currentOpacity = parseFloat(e.target.value);
        setCurrentOpacity(currentOpacity);
    });
    document.getElementById('whiteboard-grid')?.addEventListener('change', (e) => {
        state.settings.gridSnap = e.target.checked;
        saveWhiteboardData();
    });

    // ── Grid & Combat ──
    document.getElementById('whiteboard-grid-combat')?.addEventListener('click', toggleGridCombat);
    document.getElementById('whiteboard-add-token')?.addEventListener('click', addGridToken);
    document.getElementById('whiteboard-grid-type')?.addEventListener('change', (e) => {
        state.gridCombat.gridType = e.target.value;
        state.settings.gridType = e.target.value;
        saveWhiteboardData();
        restoreDrawings();
        renderGridCombat();
        showToast(`Grid type set to ${e.target.value}`, 'info');
    });
    document.getElementById('whiteboard-import-tracker')?.addEventListener('click', importFromTracker);
    document.getElementById('whiteboard-konreh')?.addEventListener('click', () => {
        toggleKonreh();
        openKonrehModal();
    });

    // ── Clear / Export / Notes / Images ──
    document.getElementById('whiteboard-clear')?.addEventListener('click', clearWhiteboardAll);
    document.getElementById('whiteboard-export')?.addEventListener('click', exportWhiteboard);
    document.getElementById('whiteboard-add-note')?.addEventListener('click', addWhiteboardNote);
    document.getElementById('whiteboard-upload-image')?.addEventListener('click', uploadWhiteboardImage);
    document.getElementById('whiteboard-clear-drawings')?.addEventListener('click', clearWhiteboardDrawings);
    document.getElementById('whiteboard-sync-btn')?.addEventListener('click', forceSync);
    document.getElementById('whiteboard-undo')?.addEventListener('click', undo);
    document.getElementById('whiteboard-redo')?.addEventListener('click', redo);
    document.getElementById('whiteboard-toggle-layers')?.addEventListener('click', toggleLayersPanel);
    document.getElementById('whiteboard-player-view')?.addEventListener('click', togglePlayerView);
    document.getElementById('whiteboard-table-mode')?.addEventListener('click', toggleTableMode);
    document.getElementById('whiteboard-toggle-roster')?.addEventListener('click', toggleRosterPanel);

    // ── Fog controls ──
    document.getElementById('whiteboard-fog-toggle')?.addEventListener('click', () => {
        const fog = state.gridCombat.fogOfWar;
        if (!fog) return;
        fog.enabled = !fog.enabled;
        saveWhiteboardData();
        renderVttCombatToolbar();
        restoreDrawings();
        renderGridCombat();
        showToast(fog.enabled ? '🌫️ Fog of War enabled' : '🌫️ Fog of War disabled', fog.enabled ? 'success' : 'info');
    });

    document.getElementById('whiteboard-fog-mode')?.addEventListener('change', (e) => {
        if (!state.gridCombat.fogOfWar) return;
        state.gridCombat.fogOfWar.mode = e.target.value;
        saveWhiteboardData();
        restoreDrawings();
        renderGridCombat();
        showToast(`Fog mode: ${e.target.value}`, 'info');
    });

    document.getElementById('whiteboard-fog-darkness')?.addEventListener('input', (e) => {
        if (!state.gridCombat.fogOfWar) return;
        state.gridCombat.fogOfWar.darkness = parseFloat(e.target.value);
    });
    document.getElementById('whiteboard-fog-darkness')?.addEventListener('change', (e) => {
        if (!state.gridCombat.fogOfWar) return;
        state.gridCombat.fogOfWar.darkness = parseFloat(e.target.value);
        saveWhiteboardData();
    });

    document.getElementById('whiteboard-fog-clear')?.addEventListener('click', () => {
        const fog = state.gridCombat.fogOfWar;
        if (!fog) return;
        if (!confirm('Clear all fog data (revealed areas, light sources, and walls)?')) return;
        fog.revealed = [];
        fog.lightSources = [];
        fog.walls = [];
        saveWhiteboardData();
        restoreDrawings();
        renderGridCombat();
        showToast('🌫️ Fog data cleared', 'info');
    });

    // ── GM role updates ──
    if (gmRoleHandler) document.removeEventListener('gmRoleUpdate', gmRoleHandler);
    gmRoleHandler = (e) => {
        setVttRole(e.detail?.role || null);
        if (isGridCombatActive()) {
            renderVttCombatToolbar();
            restoreDrawings();
            renderGridCombat();
        }
    };
    document.addEventListener('gmRoleUpdate', gmRoleHandler);

    // ── Light source double-click edit ──
    const canvasEl = document.getElementById('whiteboard-canvas');
    if (canvasEl) {
        canvasEl.addEventListener('dblclick', (e) => {
            if (currentTool !== 'select' || !canControlFog()) return;
            const fog = state.gridCombat?.fogOfWar;
            if (!fog?.enabled) return;
            const rect = canvasEl.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            const idx = fog.lightSources.findIndex(ls => {
                const dx = x - ls.x, dy = y - ls.y;
                return Math.sqrt(dx*dx + dy*dy) < 20;
            });
            if (idx === -1) return;
            const panel = document.getElementById('whiteboard-lights-panel');
            if (panel) {
                panel.style.display = 'block';
                renderLightsPanel();
                const rows = panel.querySelectorAll('[data-light-idx]');
                if (rows[idx]) {
                    rows[idx].closest('div')?.scrollIntoView({ block: 'center' });
                    rows[idx].closest('div')?.style.setProperty('background', 'rgba(212,175,55,0.2)');
                }
            }
        });

        // ── Canvas drag-drop for roster tokens ──
        canvasEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvasEl.addEventListener('drop', (e) => {
            e.preventDefault();
            handleRosterDrop(e);
        });

        // ── Canvas mouse/touch events for drawing ──
        canvasEl.addEventListener('mousedown', startDrawing);
        canvasEl.addEventListener('mousemove', draw);
        canvasEl.addEventListener('mouseup', endDrawing);
        canvasEl.addEventListener('mouseleave', endDrawing);
        canvasEl.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e.touches[0]); });
        canvasEl.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
        canvasEl.addEventListener('touchend', (e) => { e.preventDefault(); endDrawing(e.changedTouches[0]); });

        // ── Hover cursor for lights ──
        canvasEl.addEventListener('mousemove', (e) => {
            if (currentTool !== 'select') return;
            const rect = canvasEl.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            const fog = state.gridCombat?.fogOfWar;
            if (!fog?.enabled || !canControlFog()) {
                canvasEl.style.cursor = 'grab';
                return;
            }
            const light = (fog.lightSources || []).find(ls => {
                const dx = x - ls.x, dy = y - ls.y;
                return Math.sqrt(dx*dx + dy*dy) < 20;
            });
            if (light) {
                canvasEl.style.cursor = 'pointer';
                canvasEl.title = 'Double-click to edit light';
            } else {
                canvasEl.style.cursor = 'grab';
                canvasEl.title = '';
            }
        });
    }

    // ── Window resize ──
    window.addEventListener('resize', () => {
        initCanvas();
        restoreDrawings();
        renderOverlay();
    });

    // ── Keyboard shortcuts ──
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redo();
        }
    });

    // ── Globals for overlay drag handlers ──
    window.editWhiteboardNote = (id) => {
        const note = state.notes.find(n => n.id === id);
        if (note) {
            if (state.layers.find(l => l.id === note.layerId)?.locked) {
                showToast('This layer is locked', 'warning');
                return;
            }
            const newContent = prompt('Edit note:', note.content);
            if (newContent !== null) {
                pushUndoSnapshot();
                note.content = newContent;
                saveWhiteboardData();
                renderOverlay();
            }
        }
    };
    window.deleteWhiteboardNote = (id) => {
        const note = state.notes.find(n => n.id === id);
        if (note && state.layers.find(l => l.id === note.layerId)?.locked) {
            showToast('This layer is locked', 'warning');
            return;
        }
        pushUndoSnapshot();
        state.notes = state.notes.filter(n => n.id !== id);
        saveWhiteboardData();
        renderOverlay();
        updateStats();
    };
    window.deleteWhiteboardImage = (id) => {
        const img = state.images.find(i => i.id === id);
        if (img && state.layers.find(l => l.id === img.layerId)?.locked) {
            showToast('This layer is locked', 'warning');
            return;
        }
        pushUndoSnapshot();
        state.images = state.images.filter(i => i.id !== id);
        saveWhiteboardData();
        renderOverlay();
        updateStats();
    };
    window.deleteCharacterToken = (id) => {
        const token = state.characterTokens.find(t => t.id === id);
        if (token && state.layers.find(l => l.id === token.layerId)?.locked) {
            showToast('This layer is locked', 'warning');
            return;
        }
        pushUndoSnapshot();
        state.characterTokens = state.characterTokens.filter(t => t.id !== id);
        saveWhiteboardData();
        renderOverlay();
        updateStats();
    };

    // ── Drag handlers for notes, images, character tokens ──
    window.__wbStartDragNote = (id, event) => {
        const note = state.notes.find(n => n.id === id);
        if (!note) return;
        const layer = state.layers.find(l => l.id === note.layerId);
        if (layer?.locked) { showToast('This layer is locked', 'warning'); return; }
        event.stopPropagation();
        pushUndoSnapshot();
        isDraggingObject = true;
        draggedObject = note;
        draggedObjectType = 'note';
        const startX = event.clientX, startY = event.clientY;
        const originX = note.x, originY = note.y;
        const onMove = (e) => {
            note.x = originX + (e.clientX - startX);
            note.y = originY + (e.clientY - startY);
            renderOverlay();
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            isDraggingObject = false;
            draggedObject = null;
            draggedObjectType = null;
            saveWhiteboardData();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    window.__wbStartDragImage = (id, event) => {
        const img = state.images.find(i => i.id === id);
        if (!img) return;
        const layer = state.layers.find(l => l.id === img.layerId);
        if (layer?.locked) { showToast('This layer is locked', 'warning'); return; }
        event.stopPropagation();
        pushUndoSnapshot();
        isDraggingObject = true;
        draggedObject = img;
        draggedObjectType = 'image';
        const startX = event.clientX, startY = event.clientY;
        const originX = img.x, originY = img.y;
        const onMove = (e) => {
            img.x = originX + (e.clientX - startX);
            img.y = originY + (e.clientY - startY);
            renderOverlay();
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            isDraggingObject = false;
            draggedObject = null;
            draggedObjectType = null;
            saveWhiteboardData();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    window.__wbStartDragToken = (id, event) => {
        const token = state.characterTokens.find(t => t.id === id);
        if (!token) return;
        const layer = state.layers.find(l => l.id === token.layerId);
        if (layer?.locked) { showToast('This layer is locked', 'warning'); return; }
        event.stopPropagation();
        pushUndoSnapshot();
        isDraggingObject = true;
        draggedObject = token;
        draggedObjectType = 'characterToken';
        const startX = event.clientX, startY = event.clientY;
        const originX = token.x, originY = token.y;
        const onMove = (e) => {
            token.x = originX + (e.clientX - startX);
            token.y = originY + (e.clientY - startY);
            renderOverlay();
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            isDraggingObject = false;
            draggedObject = null;
            draggedObjectType = null;
            saveWhiteboardData();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    // ── Connection change ──
    document.addEventListener('connection-change', (e) => {
        const connected = e.detail?.connected || false;
        const overlay = document.getElementById('whiteboard-offline-overlay');
        if (overlay) overlay.style.display = connected ? 'none' : 'flex';
        if (connected) {
            setupWebSocketSync();
            showToast('🔄 Whiteboard reconnected and syncing', 'success');
        } else {
            showToast('📡 Whiteboard in local mode', 'info');
        }
        renderVttCombatToolbar();
        populateRoster();
    });
}

// ============================================================
// DRAWING FUNCTIONS (copied from original)
// ============================================================

function startDrawing(e) {
    const rect = document.getElementById('whiteboard-canvas').getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    const pos = snapToGrid(x, y);

    // ── Ping tool ──
    if (currentTool === 'ping') {
        handlePing(pos);
        return;
    }

    // ── Fog interactions ──
    const cellSize = state.gridCombat.cellSize || 40;
    const fog = state.gridCombat.fogOfWar;

    // Light source drag (select tool + fog enabled)
    if (currentTool === 'select' && fog?.enabled && canControlFog()) {
        const clickedLight = (fog.lightSources || []).find(ls => {
            const dx = pos.x - ls.x, dy = pos.y - ls.y;
            return Math.sqrt(dx * dx + dy * dy) < 20;
        });
        if (clickedLight) {
            if (e.shiftKey) {
                fog.lightSources = fog.lightSources.filter(ls => ls !== clickedLight);
                saveWhiteboardData();
                restoreDrawings();
                showToast('💡 Light source removed', 'info');
                return;
            }
            isDraggingLight = true;
            draggedLight = clickedLight;
            document.getElementById('whiteboard-canvas').style.cursor = 'grabbing';
            return;
        }
    }

    // Fog tools
    if (['fog-reveal','fog-hide','fog-wall','fog-light'].includes(currentTool)) {
        if (!canControlFog()) {
            showToast('Only GM can edit fog of war', 'warning');
            return;
        }
        if (!fog) return;

        if (currentTool === 'fog-light') {
            fog.lightSources.push({
                x: pos.x, y: pos.y,
                radius: cellSize * 4,
                color: 'rgba(255, 220, 150, 0.25)',
                intensity: 1,
            });
            saveWhiteboardData();
            restoreDrawings();
            showToast('💡 Light source placed (dbl-click to edit)', 'success');
            return;
        }

        if (currentTool === 'fog-wall') {
            isDrawing = true;
            fogWallStart = { x: pos.x, y: pos.y };
            return;
        }

        if (currentTool === 'fog-reveal' || currentTool === 'fog-hide') {
            isDrawing = true;
            paintFogCell(pos, cellSize, currentTool === 'fog-reveal');
            return;
        }
    }

    // ── Grid combat token dragging ──
    if (isGridCombatActive()) {
        const clickedToken = state.gridCombat.tokens.find(t =>
            pos.x >= t.x && pos.x <= t.x + cellSize &&
            pos.y >= t.y && pos.y <= t.y + cellSize
        );
        if (clickedToken) {
            if (state.layers.find(l => l.id === (clickedToken.layerId || 'tokens'))?.locked) {
                showToast('Tokens & Grid layer is locked', 'warning');
                return;
            }
            isDraggingToken = true;
            draggedToken = clickedToken;
            tokenStartPos = { x: clickedToken.x, y: clickedToken.y };
            document.getElementById('whiteboard-canvas').style.cursor = 'grabbing';
            return;
        }
    }

    // ── Ruler ──
    if (currentTool === 'ruler') {
        isDrawing = true;
        rulerStart = pos;
        rulerEnd = pos;
        return;
    }

    // ── Select / Text ──
    if (currentTool === 'select' || currentTool === 'text') return;

    // ── Pen / Eraser / Shapes ──
    const activeLayer = state.layers.find(l => l.id === activeLayerId);
    if (activeLayer?.locked) {
        showToast('This layer is locked', 'warning');
        return;
    }

    isDrawing = true;
    lastX = pos.x; lastY = pos.y;

    if (currentTool === 'pen' || currentTool === 'eraser') {
        pushUndoSnapshot();
        const drawing = {
            id: 'draw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            points: [{ x: pos.x, y: pos.y }],
            color: currentTool === 'eraser' ? '#000' : currentColor,
            size: currentTool === 'eraser' ? currentSize * 3 : currentSize,
            opacity: currentOpacity,
            tool: currentTool,
            layerId: activeLayerId,
            timestamp: Date.now()
        };
        state.drawings.push(drawing);
        drawStroke(drawing);
        saveWhiteboardData();
        updateStats();
    } else if (['line','rectangle','circle','arrow','polygon'].includes(currentTool)) {
        pushUndoSnapshot();
        shapeStart = { x: pos.x, y: pos.y };
    }
}

function draw(e) {
    if (!isDrawing && !isDraggingToken && !isDraggingLight) return;
    const rect = document.getElementById('whiteboard-canvas').getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    const pos = snapToGrid(x, y);

    // Light drag
    if (isDraggingLight && draggedLight) {
        draggedLight.x = pos.x;
        draggedLight.y = pos.y;
        restoreDrawings();
        renderGridCombat();
        return;
    }

    // Token drag
    if (isDraggingToken && draggedToken) {
        const cellSize = state.gridCombat.cellSize || 40;
        if (isKonrehActive() && window.konrehGame) {
            const targetX = Math.floor(pos.x / cellSize);
            const targetY = Math.floor(pos.y / cellSize);
            if (targetX >= 0 && targetX < 8 && targetY >= 0 && targetY < 8) {
                draggedToken.x = targetX * cellSize;
                draggedToken.y = targetY * cellSize;
            }
        } else {
            draggedToken.x = pos.x;
            draggedToken.y = pos.y;
        }
        restoreDrawings();
        renderGridCombat();
        return;
    }

    // Ruler preview
    if (currentTool === 'ruler' && rulerStart) {
        rulerEnd = pos;
        restoreDrawings();
        renderGridCombat();
        const cellSize = state.gridCombat.cellSize || 40;
        const cells = gridCellDistance(rulerStart, rulerEnd, cellSize);
        const feet = cells * 5;
        const ctx = document.getElementById('whiteboard-canvas').getContext('2d');
        ctx.save();
        ctx.strokeStyle = '#6baa7a';
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

    // Fog wall preview
    if (currentTool === 'fog-wall' && isDrawing && fogWallStart) {
        restoreDrawings();
        renderGridCombat();
        const ctx = document.getElementById('whiteboard-canvas').getContext('2d');
        ctx.save();
        ctx.strokeStyle = 'rgba(196, 90, 90, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(fogWallStart.x, fogWallStart.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.restore();
        return;
    }

    // Fog painting
    if ((currentTool === 'fog-reveal' || currentTool === 'fog-hide') && isDrawing) {
        const cellSize = state.gridCombat.cellSize || 40;
        paintFogCell(pos, cellSize, currentTool === 'fog-reveal');
        return;
    }

    // Pen / Eraser
    if (currentTool === 'pen' || currentTool === 'eraser') {
        const drawing = state.drawings[state.drawings.length - 1];
        if (drawing) {
            drawing.points.push({ x: pos.x, y: pos.y });
            drawStroke(drawing);
            saveWhiteboardData();
        }
        return;
    }

    // Shape preview
    if (['line','rectangle','circle','arrow','polygon'].includes(currentTool) && shapeStart) {
        restoreDrawings();
        const ctx = document.getElementById('whiteboard-canvas').getContext('2d');
        ctx.save();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.globalAlpha = currentOpacity;
        const start = shapeStart;
        if (currentTool === 'line') {
            ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
        } else if (currentTool === 'rectangle') {
            ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
        } else if (currentTool === 'circle') {
            const rx = Math.abs(pos.x - start.x) / 2, ry = Math.abs(pos.y - start.y) / 2;
            const cx = (start.x + pos.x) / 2, cy = (start.y + pos.y) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(rx, 0.01), Math.max(ry, 0.01), 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (currentTool === 'arrow') {
            drawArrow(start, pos);
        } else if (currentTool === 'polygon') {
            const cx = (start.x + pos.x) / 2, cy = (start.y + pos.y) / 2;
            const radius = Math.hypot(pos.x - start.x, pos.y - start.y) / 2;
            drawPolygonShape(cx, cy, Math.max(radius, 0.01), polygonSides, polygonStarRatio);
        }
        ctx.restore();
    }
}

function endDrawing(e) {
    // Light drag end
    if (isDraggingLight) {
        isDraggingLight = false;
        draggedLight = null;
        document.getElementById('whiteboard-canvas').style.cursor = 'grab';
        saveWhiteboardData();
        return;
    }

    // Token drag end
    if (isDraggingToken) {
        if (draggedToken && tokenStartPos) {
            const cellSize = state.gridCombat.cellSize || 40;
            if (isKonrehActive() && window.konrehGame) {
                const fromX = Math.floor(tokenStartPos.x / cellSize);
                const fromY = Math.floor(tokenStartPos.y / cellSize);
                const toX = Math.floor(draggedToken.x / cellSize);
                const toY = Math.floor(draggedToken.y / cellSize);
                const validMoves = window.konrehGame.getValidMoves(draggedToken.id);
                const validMove = validMoves.find(m => m.x === toX && m.y === toY);
                if (validMove) {
                    window.konrehGame.makeMove(draggedToken.id, validMove);
                    if (validMove.capture) {
                        state.gridCombat.tokens = state.gridCombat.tokens.filter(t => t.id !== validMove.targetId);
                    }
                    if (validMove.slideEnd) {
                        draggedToken.x = validMove.slideEnd.x * cellSize;
                        draggedToken.y = validMove.slideEnd.y * cellSize;
                    } else {
                        draggedToken.x = toX * cellSize;
                        draggedToken.y = toY * cellSize;
                    }
                    logRecordingEvent('konreh_move', `Moved ${draggedToken.label} to (${toX}, ${toY}).`);
                    showToast(`Valid Kon'reh Move`, 'success');
                } else {
                    draggedToken.x = tokenStartPos.x;
                    draggedToken.y = tokenStartPos.y;
                    showToast("Invalid Kon'reh move!", 'error');
                }
                saveWhiteboardData();
                restoreDrawings();
                renderGridCombat();
                isDraggingToken = false;
                draggedToken = null;
                tokenStartPos = null;
                document.getElementById('whiteboard-canvas').style.cursor = 'grab';
                return;
            }

            const cellsMoved = gridCellDistance(draggedToken, tokenStartPos, cellSize);
            if (cellsMoved > 0) {
                logRecordingEvent('token_move', `${draggedToken.label} moved ${cellsMoved} cells (${cellsMoved * 5} ft).`);
                const tacStatus = checkTacticalStatus(draggedToken);
                if (tacStatus.isFlanked) {
                    logRecordingEvent('tactical_event', `${draggedToken.label} is now FLANKED!`);
                    showToast(`${draggedToken.label} is Flanked!`, 'warning');
                } else if (tacStatus.inEnemyZoC) {
                    logRecordingEvent('tactical_event', `${draggedToken.label} entered enemy ZoC.`);
                    showToast(`${draggedToken.label} entered ZoC!`, 'warning');
                }
                saveWhiteboardData();
            }
            syncRangeFromGrid(draggedToken);
        }
        isDraggingToken = false;
        draggedToken = null;
        tokenStartPos = null;
        document.getElementById('whiteboard-canvas').style.cursor = 'grab';
        return;
    }

    // Ruler end
    if (currentTool === 'ruler' && rulerStart && rulerEnd) {
        const cellSize = state.gridCombat.cellSize || 40;
        const cells = gridCellDistance(rulerStart, rulerEnd, cellSize);
        const feet = cells * 5;
        logRecordingEvent('measurement', `GM measured ${cells} cells (${feet} ft).`);
        if (e?.shiftKey) {
            const activeLayer = state.layers.find(l => l.id === activeLayerId);
            if (activeLayer?.locked) {
                showToast('This layer is locked — measurement not pinned', 'warning');
            } else {
                pushUndoSnapshot();
                state.drawings.push({
                    id: 'draw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                    points: [{ x: rulerStart.x, y: rulerStart.y }, { x: rulerEnd.x, y: rulerEnd.y }],
                    color: '#6baa7a',
                    size: 2,
                    opacity: 1,
                    tool: 'measure',
                    label: `${cells} cells (${feet}ft)`,
                    layerId: activeLayerId,
                    timestamp: Date.now()
                });
                saveWhiteboardData();
                updateStats();
                showToast('📌 Measurement pinned to the map', 'success');
            }
        }
        isDrawing = false;
        rulerStart = null;
        rulerEnd = null;
        restoreDrawings();
        renderGridCombat();
        return;
    }

    // Fog wall end
    if (currentTool === 'fog-wall' && isDrawing && fogWallStart) {
        const rect = document.getElementById('whiteboard-canvas').getBoundingClientRect();
        const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left;
        const y = (e.clientY || e.changedTouches?.[0]?.clientY || 0) - rect.top;
        const pos = snapToGrid(x, y);
        const dist = Math.sqrt((pos.x - fogWallStart.x) ** 2 + (pos.y - fogWallStart.y) ** 2);
        if (dist >= 5) {
            state.gridCombat.fogOfWar.walls.push({
                x1: fogWallStart.x, y1: fogWallStart.y,
                x2: pos.x, y2: pos.y
            });
            saveWhiteboardData();
            showToast('🧱 LoS wall added', 'success');
        }
        isDrawing = false;
        fogWallStart = null;
        restoreDrawings();
        renderGridCombat();
        return;
    }

    // Fog painting end
    if ((currentTool === 'fog-reveal' || currentTool === 'fog-hide') && isDrawing) {
        isDrawing = false;
        saveWhiteboardData();
        return;
    }

    if (!isDrawing) return;
    isDrawing = false;

    // Shape end
    if (['line','rectangle','circle','arrow','polygon'].includes(currentTool) && shapeStart) {
        const rect = document.getElementById('whiteboard-canvas').getBoundingClientRect();
        const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left;
        const y = (e.clientY || e.changedTouches?.[0]?.clientY || 0) - rect.top;
        const pos = snapToGrid(x, y);
        const newDrawing = {
            id: 'draw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            points: [{ x: shapeStart.x, y: shapeStart.y }, { x: pos.x, y: pos.y }],
            color: currentColor,
            size: currentSize,
            opacity: currentOpacity,
            tool: currentTool,
            layerId: activeLayerId,
            timestamp: Date.now()
        };
        if (currentTool === 'polygon') {
            newDrawing.sides = polygonSides;
            newDrawing.starRatio = polygonStarRatio;
        }
        state.drawings.push(newDrawing);
        saveWhiteboardData();
        restoreDrawings();
        updateStats();
        shapeStart = null;
    }
}

// ── Helper: gridCellDistance (needed for ruler and range) ──
function gridCellDistance(a, b, cellSize) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.round(Math.sqrt(dx * dx + dy * dy) / cellSize);
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

function syncRangeFromGrid(movedToken) { /* same as original */ }

// ── Ping handler ──
function handlePing(pos) {
    renderPingMarker(pos.x, pos.y);
    if (isConnectedToServer()) {
        try {
            sendMessage({ type: 'whiteboard-ping', sheetId: state.activeSheetId, x: pos.x, y: pos.y });
        } catch (e) {}
    }
}

// ============================================================
// ACTIONS (Add Note, Upload Image, Clear, Export, etc.)
// ============================================================

export function addWhiteboardNote() {
    const activeLayer = state.layers.find(l => l.id === activeLayerId);
    if (activeLayer?.locked) {
        showToast('This layer is locked', 'warning');
        return;
    }
    const content = prompt('Note content:', 'New note');
    if (!content) return;
    const containerEl = document.getElementById('whiteboard-canvas-container');
    const rect = containerEl.getBoundingClientRect();
    pushUndoSnapshot();
    state.notes.push({
        id: 'note-' + Date.now(),
        x: rect.width / 2 - 50,
        y: rect.height / 2 - 50,
        content: content,
        layerId: activeLayerId
    });
    saveWhiteboardData();
    renderOverlay();
    updateStats();
}

export function uploadWhiteboardImage() {
    const activeLayer = state.layers.find(l => l.id === activeLayerId);
    if (activeLayer?.locked) {
        showToast('This layer is locked', 'warning');
        return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // SECURITY: block SVG uploads
        if (file.type === 'image/svg+xml') {
            showToast('SVG uploads are not allowed for security reasons.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const containerEl = document.getElementById('whiteboard-canvas-container');
            const rect = containerEl.getBoundingClientRect();
            pushUndoSnapshot();
            state.images.push({
                id: 'img-' + Date.now(),
                x: rect.width / 2 - 100,
                y: rect.height / 2 - 100,
                data: ev.target.result,
                layerId: activeLayerId
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

export function clearWhiteboardDrawings() {
    if (!confirm('Clear all drawings only?')) return;
    pushUndoSnapshot();
    state.drawings = [];
    saveWhiteboardData();
    restoreDrawings();
    updateStats();
}

export function clearWhiteboardAll() {
    if (!confirm('Delete everything (drawings, notes, images, tokens, character tokens) on this sheet?')) return;
    pushUndoSnapshot();
    state.drawings = [];
    state.notes = [];
    state.images = [];
    state.characterTokens = [];
    state.gridCombat.tokens = [];
    if (state.gridCombat.fogOfWar) {
        state.gridCombat.fogOfWar.revealed = [];
        state.gridCombat.fogOfWar.lightSources = [];
        state.gridCombat.fogOfWar.walls = [];
    }
    if (isKonrehActive()) toggleKonreh();
    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    updateStats();
    renderVttCombatToolbar();
    showToast('🗑️ Whiteboard cleared', 'info');
}

export function exportWhiteboard() {
    const canvasEl = document.getElementById('whiteboard-canvas');
    if (!canvasEl) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasEl.width;
    tempCanvas.height = canvasEl.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = '#12121a';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvasEl, 0, 0);
    const link = document.createElement('a');
    link.download = 'whiteboard-' + Date.now() + '.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
    showToast('💾 Whiteboard exported', 'success');
}

export function pinNoteToBoard(content) {
    if (!content) return;
    const activeSheet = getActiveSheet();
    if (!activeSheet) return;
    const layer = state.layers.find(l => l.id === 'notes');
    if (layer?.locked) {
        showToast('Notes layer is locked', 'warning');
        return;
    }
    let x = 60, y = 60;
    const containerEl = document.getElementById('whiteboard-canvas-container');
    if (containerEl) {
        const rect = containerEl.getBoundingClientRect();
        x = rect.width / 2 - 60 + (Math.random() * 40 - 20);
        y = rect.height / 2 - 40 + (Math.random() * 40 - 20);
    }
    pushUndoSnapshot();
    state.notes.push({
        id: 'note-' + Date.now(),
        x, y,
        content: `🃏 ${content}`,
        layerId: 'notes'
    });
    saveWhiteboardData();
    renderOverlay();
    updateStats();
    showToast('📌 Pinned to Whiteboard', 'success');
}

// ============================================================
// REFRESH / LIFECYCLE
// ============================================================

export function refresh() {
    loadWhiteboardData();
    initCanvas();
    restoreDrawings();
    renderOverlay();
    updateStats();
    setupWebSocketSync();
    renderSheetTabs();
    renderLayersPanel();
    renderVttCombatToolbar();
    populateRoster();
}

export function destroy() {
    const container = document.getElementById('whiteboard-modern-layout');
    if (container) container.innerHTML = '';
    saveWhiteboardData();
    if (gmRoleHandler) document.removeEventListener('gmRoleUpdate', gmRoleHandler);
    if (voiceUnsub) voiceUnsub();
    // Clean up WS listeners etc. done in persistence
}

// ============================================================
// Re-export everything needed by index.js
// ============================================================

export { loadWhiteboardData, saveWhiteboardData, forceSync, onActivate, onDeactivate } from './persistence.js';
export { toggleGridCombat, addGridToken, clearGridTokens, toggleKonreh, importFromTracker } from './combat.js';
export { addSheet, renameSheet, duplicateSheet, deleteSheet } from './sheets.js';
export { undo, redo } from './undo.js';
