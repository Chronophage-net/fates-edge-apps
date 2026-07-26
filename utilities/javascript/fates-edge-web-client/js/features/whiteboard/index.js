// features/whiteboard/index.js
/**
 * Whiteboard - Campaign Whiteboard with drawing, notes, and image support
 *
 * Features:
 * - Freehand drawing with color/size/opacity controls, plus line, rectangle,
 *   circle/ellipse, arrow, ruler, and text-note tools
 * - Layers: Background, Drawing, Tokens & Grid, Notes, and a GM-only layer,
 *   each independently show/hide-able, lockable, and opacity-controllable,
 *   plus a "Player View" preview that hides GM layers
 * - Sheets: multiple independent pages/maps with their own drawings, notes,
 *   images, grid/combat state, and layers, switchable via tabs
 * - Undo/redo (per sheet) for drawings, notes, and images
 * - Draggable notes and images (not just tokens) via the Select tool
 * - Image upload for maps/reference
 * - Grid snap option with multiple grid types (square, hex, isometric)
 * - WebSocket sync for real-time collaboration (accepts both the legacy
 *   flat payload shape and the new multi-sheet shape, for compatibility
 *   with any peer still on the previous version)
 * - Grid combat mode with tactical overlays (ZoC, Flanking, Drag & Drop)
 * - Fog of War: manual reveal/hide, token vision, line-of-sight raycasting,
 *   dynamic light sources with adjustable color/radius, darkness slider,
 *   and LoS walls — gated so GMs control fog and players see only what's
 *   revealed (active when connected to VTT without the GM role)
 * - Kon'reh Board Game integration
 * - Records movements to media manifest for VOD creators
 *
 * COMPATIBILITY NOTES
 * --------------------
 * - All previously exported functions keep the same names and signatures.
 * - Old saved data (flat `drawings`/`notes`/`images`/`settings`/`gridCombat`
 *   at the top level of `whiteboard`) is automatically migrated into a
 *   single "Sheet 1" the first time this loads — nothing is lost.
 * - `saveWhiteboardData()` continues to also mirror the *active* sheet's
 *   flat fields onto `whiteboard.drawings` / `.notes` / etc., in case any
 *   other module reads those directly instead of `whiteboard.sheets`.
 * - The WebSocket payload includes both the legacy flat mirror and the new
 *   `sheets` structure; incoming messages are accepted in either shape.
 * - Fog of War data lives inside `gridCombat.fogOfWar` and syncs via the
 *   existing WebSocket pipeline — no new event types needed.
 * - `normalizeSheet()` backfills `fogOfWar` and `token.vision` on old saves.
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml } from '../../core/utils.js';
import { logRecordingEvent } from '../../core/media.js';
import {
    isConnectedToServer,
    onWSEvent,
    offWSEvent,
    sendMessage as sendWSMessage,
    getConnectionMode
} from '../../core/websocket.js';
import { openKonrehModal } from '../kon-reh/index.js';
import { getLiveCombatants, isTrackerOpen, setTrackerRangeByName } from '../encounters/combat.js';
// 👇 NEW: path assumed as features/vtt/voice.js, same depth as the combat.js import above — flag if that's wrong.
import { onVoiceClientsChanged } from '../vtt/voice.js';

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

const DEFAULT_LAYER_DEFS = [
    { id: 'background', name: 'Background',      isGM: false },
    { id: 'drawing',     name: 'Drawing',         isGM: false },
    { id: 'tokens',      name: 'Tokens & Grid',   isGM: false },
    { id: 'notes',       name: 'Notes',           isGM: false },
    { id: 'gm',          name: 'GM Layer',        isGM: true  },
];

const MAX_UNDO_HISTORY = 50;

// ── NEW: Fog tool identifiers (used in the toolbar's data-tool buttons) ──
const FOG_TOOLS = new Set(['fog-reveal', 'fog-hide', 'fog-wall', 'fog-light']);

// 👇 NEW: 'polygon' added — ported from the object-model rewrite (regular
// polygon / star tool). Shares the generic two-point drag lifecycle that
// line/rectangle/circle/arrow already use in startDrawing/draw/endDrawing.
const SHAPE_TOOLS = new Set(['line', 'rectangle', 'circle', 'arrow', 'polygon']);

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
let currentOpacity = 1;
let lastX = 0;
let lastY = 0;

// ── NEW: Polygon/star tool config (ported from the object-model rewrite) ──
let polygonSides = 6;
let polygonStarRatio = 0; // 0 = regular polygon, >0 = star (inner vertices pulled in by this ratio)

// ── NEW: Table Mode — a local, per-client display preference (like
// playerViewActive) that maximizes the canvas and hides editing chrome for
// a shared big-screen/tablet display at the table. Never saved/synced.
let tableModeActive = false;

let state = {
    sheets: [],
    activeSheetId: null,
    drawings: [],
    notes: [],
    images: [],
    gridCombat: null,
    settings: null,
    layers: null,
};

let activeLayerId = 'drawing';
let playerViewActive = false;

const undoHistory = new Map();

let activeNoteId = null;
let selectedImage = null;
let wsListeners = new Map();
let isSyncing = false;
let isOfflineMode = false;
let gridCombatActive = false;

let isDraggingToken = false;
let draggedToken = null;
let tokenStartPos = null;
let rulerStart = null;
let rulerEnd = null;

let isDraggingObject = false;
let draggedObject = null;
let draggedObjectType = null;

let konrehGame = null;
let konrehActive = false;

// ── NEW: VTT role tracking for fog gating ──
// Set by listening for the `gmRoleUpdate` custom event dispatched by
// vtt-connected.js.  Values: 'gm' | 'player' | null (not connected).
let vttRole = null;

// ── NEW: Fog interaction state ──
let fogWallStart = null;       // {x,y} when drawing a LoS wall segment
let isDraggingLight = false;   // dragging a light source with the Select tool
let draggedLight = null;       // reference to the light source being dragged
let gmRoleHandler = null;      // stored for cleanup in destroy()

// ── NEW: Voice speaking-glow on tokens ──
let voiceUnsub = null;              // unsubscribe fn from onVoiceClientsChanged
let speakingNames = new Set();      // lowercased names of currently-speaking voice clients

// ============================================================
// SHEETS
// ============================================================

function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultLayers() {
    return DEFAULT_LAYER_DEFS.map((def, i) => ({
        id: def.id,
        name: def.name,
        order: i,
        visible: true,
        locked: false,
        opacity: 1,
        isGM: def.isGM,
    }));
}

// ── NEW: Default fog-of-war configuration ──
function createDefaultFogOfWar() {
    return {
        enabled: false,        // master toggle
        mode: 'manual',        // 'manual' | 'token-vision' | 'line-of-sight'
        revealed: [],          // array of {x, y, w, h} cell rects
        darkness: 0.85,        // 0 = fully lit, 1 = pitch black
        lightSources: [],      // array of {x, y, radius, color, intensity}
        walls: [],             // array of {x1, y1, x2, y2} for LoS blocking
    };
}

function createDefaultGridCombat() {
    return {
        enabled: false,
        gridType: 'square',
        cellSize: 40,
        showCoordinates: true,
        showZones: false,
        tokens: [],
        linkedEncounterId: null,
        fogOfWar: createDefaultFogOfWar(), // ── NEW ──
    };
}

function createDefaultSettings() {
    return {
        gridSnap: false,
        gridSize: 40,
        backgroundColor: 'var(--bg2)',
        gridType: 'square',
        showGrid: true
    };
}

function createDefaultSheet(name) {
    return {
        id: makeId('sheet'),
        name: name || 'Sheet 1',
        drawings: [],
        notes: [],
        images: [],
        gridCombat: createDefaultGridCombat(),
        settings: createDefaultSettings(),
        layers: createDefaultLayers(),
    };
}

function normalizeSheet(raw) {
    const sheet = {
        id: raw.id || makeId('sheet'),
        name: raw.name || 'Sheet',
        drawings: Array.isArray(raw.drawings) ? raw.drawings : [],
        notes: Array.isArray(raw.notes) ? raw.notes : [],
        images: Array.isArray(raw.images) ? raw.images : [],
        gridCombat: { ...createDefaultGridCombat(), ...(raw.gridCombat || {}) },
        settings: { ...createDefaultSettings(), ...(raw.settings || {}) },
        layers: (Array.isArray(raw.layers) && raw.layers.length > 0) ? raw.layers : createDefaultLayers(),
    };
    if (!Array.isArray(sheet.gridCombat.tokens)) sheet.gridCombat.tokens = [];

    // ── NEW: Backfill fogOfWar (old saves predate this field) ──
    if (!sheet.gridCombat.fogOfWar) {
        sheet.gridCombat.fogOfWar = createDefaultFogOfWar();
    } else {
        // Merge partial fog data with defaults so missing sub-fields are filled
        sheet.gridCombat.fogOfWar = {
            ...createDefaultFogOfWar(),
            ...sheet.gridCombat.fogOfWar
        };
    }

    // Backfill layerId on anything created before layers existed
    for (const d of sheet.drawings) if (!d.layerId) d.layerId = 'drawing';
    for (const n of sheet.notes) if (!n.layerId) n.layerId = 'notes';
    for (const im of sheet.images) if (!im.layerId) im.layerId = 'background';
    for (const t of sheet.gridCombat.tokens) {
        if (!t.layerId) t.layerId = 'tokens';
        // ── NEW: Backfill vision on old tokens ──
        if (t.vision === undefined) t.vision = 0;
    }

    return sheet;
}

function getActiveSheet() {
    let sheet = state.sheets.find(s => s.id === state.activeSheetId);
    if (!sheet) {
        sheet = state.sheets[0];
        state.activeSheetId = sheet ? sheet.id : null;
    }
    return sheet;
}

function syncActiveSheetRefs() {
    const sheet = getActiveSheet();
    if (!sheet) return;
    state.drawings = sheet.drawings;
    state.notes = sheet.notes;
    state.images = sheet.images;
    state.gridCombat = sheet.gridCombat;
    state.settings = sheet.settings;
    state.layers = sheet.layers;
    gridCombatActive = !!sheet.gridCombat.enabled;
    if (!state.layers.some(l => l.id === activeLayerId)) {
        activeLayerId = state.layers[0]?.id || 'drawing';
    }
}

function getUndoHistory(sheetId) {
    if (!undoHistory.has(sheetId)) undoHistory.set(sheetId, { undo: [], redo: [] });
    return undoHistory.get(sheetId);
}

function switchToSheet(sheetId) {
    if (sheetId === state.activeSheetId) return;
    if (!state.sheets.some(s => s.id === sheetId)) return;
    saveWhiteboardData();
    if (konrehActive) toggleKonreh();
    state.activeSheetId = sheetId;
    syncActiveSheetRefs();
    initCanvas();
    restoreDrawings();
    renderOverlay();
    renderSheetTabs();
    renderLayersPanel();
    updateStats();
    renderVttCombatToolbar(); // ── NEW: update fog controls for this sheet ──
    saveWhiteboardData();

    const panel = document.getElementById('whiteboard-lights-panel');
    if (panel) panel.style.display = 'none';
}

export function addSheet() {
    const name = prompt('New sheet name:', `Sheet ${state.sheets.length + 1}`);
    if (!name) return;
    saveWhiteboardData();
    const sheet = createDefaultSheet(name);
    state.sheets.push(sheet);
    switchToSheet(sheet.id);
    showToast(`📄 Sheet "${name}" created`, 'success');
}

export function renameSheet(sheetId) {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const name = prompt('Rename sheet:', sheet.name);
    if (!name) return;
    sheet.name = name;
    saveWhiteboardData();
    renderSheetTabs();
}

export function duplicateSheet(sheetId) {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const copy = JSON.parse(JSON.stringify(sheet));
    copy.id = makeId('sheet');
    copy.name = `${sheet.name} (copy)`;
    const idx = state.sheets.findIndex(s => s.id === sheetId);
    state.sheets.splice(idx + 1, 0, copy);
    saveWhiteboardData();
    switchToSheet(copy.id);
    showToast(`📄 Duplicated "${sheet.name}"`, 'success');
}

export function deleteSheet(sheetId) {
    if (state.sheets.length <= 1) {
        showToast('Cannot delete the only sheet', 'error');
        return;
    }
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    if (!confirm(`Delete sheet "${sheet.name}" and everything on it?`)) return;

    const idx = state.sheets.findIndex(s => s.id === sheetId);
    state.sheets.splice(idx, 1);
    undoHistory.delete(sheetId);

    if (state.activeSheetId === sheetId) {
        const next = state.sheets[Math.max(0, idx - 1)];
        state.activeSheetId = next.id;
        syncActiveSheetRefs();
        initCanvas();
        restoreDrawings();
        renderOverlay();
        renderLayersPanel();
        updateStats();
        renderVttCombatToolbar(); // ── NEW ──
    }
    saveWhiteboardData();
    renderSheetTabs();
    showToast('🗑️ Sheet deleted', 'info');
}

function renderSheetTabs() {
    const bar = document.getElementById('whiteboard-sheet-tabs');
    if (!bar) return;
    bar.innerHTML = state.sheets.map(s => `
        <span class="wb-sheet-tab ${s.id === state.activeSheetId ? 'active' : ''}" data-sheet-id="${s.id}"
              style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px 6px 0 0;
                     cursor:pointer;font-size:0.78rem;margin-right:2px;
                     background:${s.id === state.activeSheetId ? 'var(--panel-2, #24242e)' : 'transparent'};
                     border:1px solid var(--border); border-bottom:${s.id === state.activeSheetId ? 'none' : '1px solid var(--border)'};
                     color:${s.id === state.activeSheetId ? 'var(--gold)' : 'var(--text3)'};">
            <span class="wb-sheet-tab-name">${escHtml(s.name)}</span>
            <button class="wb-sheet-rename" data-sheet-id="${s.id}" title="Rename" style="background:none;border:none;color:inherit;cursor:pointer;font-size:0.7rem;">✏️</button>
            <button class="wb-sheet-dup" data-sheet-id="${s.id}" title="Duplicate" style="background:none;border:none;color:inherit;cursor:pointer;font-size:0.7rem;">⧉</button>
            <button class="wb-sheet-del" data-sheet-id="${s.id}" title="Delete" style="background:none;border:none;color:inherit;cursor:pointer;font-size:0.7rem;">✕</button>
        </span>
    `).join('') + `
        <button id="whiteboard-add-sheet" title="Add sheet"
                style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:6px 6px 0 0;
                       cursor:pointer;font-size:0.85rem;background:transparent;border:1px dashed var(--border);color:var(--text3);">➕</button>
    `;

    bar.querySelectorAll('.wb-sheet-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            switchToSheet(tab.dataset.sheetId);
        });
    });
    bar.querySelectorAll('.wb-sheet-rename').forEach(b => b.addEventListener('click', () => renameSheet(b.dataset.sheetId)));
    bar.querySelectorAll('.wb-sheet-dup').forEach(b => b.addEventListener('click', () => duplicateSheet(b.dataset.sheetId)));
    bar.querySelectorAll('.wb-sheet-del').forEach(b => b.addEventListener('click', () => deleteSheet(b.dataset.sheetId)));
    document.getElementById('whiteboard-add-sheet')?.addEventListener('click', addSheet);
}

// ============================================================
// LAYERS
// ============================================================

function getLayer(layerId) {
    return state.layers.find(l => l.id === layerId);
}

function isLayerLocked(layerId) {
    const l = getLayer(layerId);
    return !!(l && l.locked);
}

function isLayerVisibleNow(layer) {
    if (!layer.visible) return false;
    if (playerViewActive && layer.isGM) return false;
    return true;
}

function layersInDrawOrder() {
    return [...state.layers].sort((a, b) => a.order - b.order);
}

export function togglePlayerView() {
    playerViewActive = !playerViewActive;
    const btn = document.getElementById('whiteboard-player-view');
    if (btn) {
        btn.textContent = playerViewActive ? '👁️ Player View ON' : '👁️ Player View';
        btn.className = playerViewActive ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-secondary';
    }
    restoreDrawings();
    renderOverlay();
    renderLayersPanel();
    showToast(playerViewActive ? 'Previewing what players see (GM layers hidden)' : 'Player View off', 'info');
}

// ============================================================
// TABLE MODE (NEW) — maximized display for a shared big screen / tablet
// ============================================================

/**
 * Applies (or re-applies) the current tableModeActive state to the DOM:
 * hides the header/toolbar/sheet-tabs/controls-bar and expands the canvas
 * to fill most of the viewport. This is the single source of truth for
 * table-mode visibility, called both right after render() (so a remount
 * reflects whatever tableModeActive already was) and from the toggle
 * button itself.
 *
 * Deliberately orthogonal to Player View — combine both if you want a
 * shared display that also hides GM secrets; Table Mode alone just makes
 * your own view bigger and less cluttered (e.g. a GM using a large tablet).
 */
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

    // Resize the actual canvas surface to match the new container size.
    initCanvas();
    restoreDrawings();
    renderOverlay();
}

export function toggleTableMode() {
    tableModeActive = !tableModeActive;
    applyTableMode();
    showToast(tableModeActive ? '🖥️ Table Mode — board maximized' : 'Table Mode off', 'info');
}

function addLayer() {
    const name = prompt('New layer name:', `Layer ${state.layers.length + 1}`);
    if (!name) return;
    const isGM = confirm('Should this be a GM-only layer (hidden in Player View)?');
    const layer = {
        id: makeId('layer'),
        name,
        order: state.layers.length,
        visible: true,
        locked: false,
        opacity: 1,
        isGM,
    };
    state.layers.push(layer);
    activeLayerId = layer.id;
    saveWhiteboardData();
    renderLayersPanel();
    showToast(`🗂️ Layer "${name}" added`, 'success');
}

function deleteLayer(layerId) {
    if (DEFAULT_LAYER_DEFS.some(d => d.id === layerId)) {
        showToast('Cannot delete a default layer', 'error');
        return;
    }
    const layer = getLayer(layerId);
    if (!layer) return;
    const hasContent = state.drawings.some(d => d.layerId === layerId) ||
        state.notes.some(n => n.layerId === layerId) ||
        state.images.some(im => im.layerId === layerId);
    if (hasContent && !confirm(`Layer "${layer.name}" has content on it. Delete the layer and everything on it?`)) return;

    state.drawings = state.drawings.filter(d => d.layerId !== layerId);
    state.notes = state.notes.filter(n => n.layerId !== layerId);
    state.images = state.images.filter(im => im.layerId !== layerId);
    state.layers = state.layers.filter(l => l.id !== layerId);
    if (activeLayerId === layerId) activeLayerId = state.layers[0]?.id || 'drawing';

    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    renderLayersPanel();
    updateStats();
}

function moveLayer(layerId, direction) {
    const ordered = layersInDrawOrder();
    const idx = ordered.findIndex(l => l.id === layerId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx], b = ordered[swapIdx];
    const tmp = a.order; a.order = b.order; b.order = tmp;
    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    renderLayersPanel();
}

function renderLayersPanel() {
    const panel = document.getElementById('whiteboard-layers-panel');
    if (!panel) return;
    const ordered = [...layersInDrawOrder()].reverse();

    panel.innerHTML = `
        <div class="flex-between mb-1">
            <span class="text-gold font-bold text-sm">🗂️ Layers</span>
            <button class="btn btn-xs btn-secondary" id="whiteboard-add-layer">➕ Add Layer</button>
        </div>
        ${ordered.map((l, i) => `
            <div class="flex gap-1 flex-center" data-layer-row="${l.id}"
                 style="padding:3px 4px; border-radius:4px; background:${l.id === activeLayerId ? 'rgba(212,175,55,0.12)' : 'transparent'};">
                <button class="wb-layer-active" data-layer-id="${l.id}" title="Set as active layer"
                        style="background:none;border:none;cursor:pointer;color:${l.id === activeLayerId ? 'var(--gold)' : 'var(--text3)'};">
                    ${l.id === activeLayerId ? '●' : '○'}
                </button>
                <button class="wb-layer-vis" data-layer-id="${l.id}" title="Show/hide"
                        style="background:none;border:none;cursor:pointer;">${l.visible ? '👁️' : '🚫'}</button>
                <button class="wb-layer-lock" data-layer-id="${l.id}" title="Lock/unlock"
                        style="background:none;border:none;cursor:pointer;">${l.locked ? '🔒' : '🔓'}</button>
                <span class="wb-layer-name text-sm" data-layer-id="${l.id}" style="flex:1;cursor:pointer;${l.isGM ? 'font-style:italic;color:#c47a7a;' : ''}"
                      title="${l.isGM ? 'GM-only layer' : ''}">${escHtml(l.name)}${l.isGM ? ' 🛡️' : ''}</span>
                <input type="range" class="wb-layer-opacity" data-layer-id="${l.id}" min="0" max="1" step="0.05" value="${l.opacity}"
                       style="width:56px;" title="Layer opacity" />
                <button class="wb-layer-up" data-layer-id="${l.id}" title="Move up" style="background:none;border:none;cursor:pointer;" ${i === 0 ? 'disabled' : ''}>⬆️</button>
                <button class="wb-layer-down" data-layer-id="${l.id}" title="Move down" style="background:none;border:none;cursor:pointer;" ${i === ordered.length - 1 ? 'disabled' : ''}>⬇️</button>
                ${DEFAULT_LAYER_DEFS.some(d => d.id === l.id) ? '' : `<button class="wb-layer-del" data-layer-id="${l.id}" title="Delete layer" style="background:none;border:none;cursor:pointer;color:var(--red,#c45a5a);">✕</button>`}
            </div>
        `).join('')}
    `;

    panel.querySelector('#whiteboard-add-layer')?.addEventListener('click', addLayer);
    panel.querySelectorAll('.wb-layer-active').forEach(b => b.addEventListener('click', () => {
        activeLayerId = b.dataset.layerId;
        renderLayersPanel();
    }));
    panel.querySelectorAll('.wb-layer-name').forEach(el => el.addEventListener('dblclick', () => {
        const layer = getLayer(el.dataset.layerId);
        if (!layer) return;
        const name = prompt('Rename layer:', layer.name);
        if (!name) return;
        layer.name = name;
        saveWhiteboardData();
        renderLayersPanel();
    }));
    panel.querySelectorAll('.wb-layer-vis').forEach(b => b.addEventListener('click', () => {
        const layer = getLayer(b.dataset.layerId);
        if (!layer) return;
        layer.visible = !layer.visible;
        saveWhiteboardData();
        restoreDrawings();
        renderOverlay();
        renderLayersPanel();
    }));
    panel.querySelectorAll('.wb-layer-lock').forEach(b => b.addEventListener('click', () => {
        const layer = getLayer(b.dataset.layerId);
        if (!layer) return;
        layer.locked = !layer.locked;
        saveWhiteboardData();
        renderLayersPanel();
    }));
    panel.querySelectorAll('.wb-layer-opacity').forEach(inp => inp.addEventListener('input', () => {
        const layer = getLayer(inp.dataset.layerId);
        if (!layer) return;
        layer.opacity = parseFloat(inp.value);
        saveWhiteboardData();
        restoreDrawings();
        renderOverlay();
    }));
    panel.querySelectorAll('.wb-layer-up').forEach(b => b.addEventListener('click', () => moveLayer(b.dataset.layerId, 1)));
    panel.querySelectorAll('.wb-layer-down').forEach(b => b.addEventListener('click', () => moveLayer(b.dataset.layerId, -1)));
    panel.querySelectorAll('.wb-layer-del').forEach(b => b.addEventListener('click', () => deleteLayer(b.dataset.layerId)));
}

function toggleLayersPanel() {
    const panel = document.getElementById('whiteboard-layers-panel');
    if (!panel) return;
    const showing = panel.style.display !== 'none';
    panel.style.display = showing ? 'none' : 'block';
    if (!showing) renderLayersPanel();
}

// ============================================================
// UNDO / REDO
// ============================================================

function snapshotForUndo() {
    return {
        drawings: JSON.parse(JSON.stringify(state.drawings)),
        notes: JSON.parse(JSON.stringify(state.notes)),
        images: JSON.parse(JSON.stringify(state.images)),
    };
}

function pushUndoSnapshot() {
    const h = getUndoHistory(state.activeSheetId);
    h.undo.push(snapshotForUndo());
    if (h.undo.length > MAX_UNDO_HISTORY) h.undo.shift();
    h.redo = [];
}

export function undo() {
    const h = getUndoHistory(state.activeSheetId);
    if (h.undo.length === 0) { showToast('Nothing to undo', 'info'); return; }
    h.redo.push(snapshotForUndo());
    const prev = h.undo.pop();
    state.drawings = prev.drawings;
    state.notes = prev.notes;
    state.images = prev.images;
    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    updateStats();
}

export function redo() {
    const h = getUndoHistory(state.activeSheetId);
    if (h.redo.length === 0) { showToast('Nothing to redo', 'info'); return; }
    h.undo.push(snapshotForUndo());
    const next = h.redo.pop();
    state.drawings = next.drawings;
    state.notes = next.notes;
    state.images = next.images;
    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    updateStats();
}

// ============================================================
// LOAD/SAVE
// ============================================================

function loadWhiteboardData() {
    const saved = getState();
    const wb = saved.whiteboard;
    let migrationOccurred = false;

    if (wb && Array.isArray(wb.sheets) && wb.sheets.length > 0) {
        state.sheets = wb.sheets.map(normalizeSheet);
        state.activeSheetId = (wb.activeSheetId && state.sheets.some(s => s.id === wb.activeSheetId))
            ? wb.activeSheetId
            : state.sheets[0].id;
    } else if (wb && (wb.drawings || wb.notes || wb.images || wb.settings || wb.gridCombat)) {
        const migrated = normalizeSheet({
            name: 'Sheet 1',
            drawings: wb.drawings || [],
            notes: wb.notes || [],
            images: wb.images || [],
            gridCombat: wb.gridCombat || null,
            settings: wb.settings || null,
        });
        state.sheets = [migrated];
        state.activeSheetId = migrated.id;
        migrationOccurred = true;
    } else {
        const fresh = createDefaultSheet('Sheet 1');
        state.sheets = [fresh];
        state.activeSheetId = fresh.id;
    }

    syncActiveSheetRefs();

    if (migrationOccurred) {
        const s = getState();
        if (!s.whiteboard) s.whiteboard = {};
        s.whiteboard.sheets = state.sheets;
        s.whiteboard.activeSheetId = state.activeSheetId;
        const sheet = getActiveSheet();
        if (sheet) {
            s.whiteboard.drawings = sheet.drawings;
            s.whiteboard.notes = sheet.notes;
            s.whiteboard.images = sheet.images;
            s.whiteboard.settings = sheet.settings;
            s.whiteboard.gridCombat = sheet.gridCombat;
        }
        saveState();
    }
}

function saveWhiteboardData() {
    const sheet = getActiveSheet();
    if (sheet) {
        sheet.drawings = state.drawings;
        sheet.notes = state.notes;
        sheet.images = state.images;
        sheet.gridCombat = state.gridCombat;
        sheet.settings = state.settings;
        sheet.layers = state.layers;
    }

    const saved = getState();
    if (!saved.whiteboard) saved.whiteboard = {};
    saved.whiteboard.sheets = state.sheets;
    saved.whiteboard.activeSheetId = state.activeSheetId;
    if (sheet) {
        saved.whiteboard.drawings = sheet.drawings;
        saved.whiteboard.notes = sheet.notes;
        saved.whiteboard.images = sheet.images;
        saved.whiteboard.settings = sheet.settings;
        saved.whiteboard.gridCombat = sheet.gridCombat;
    }
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

    function applyIncomingWhiteboard(incoming) {
        if (!incoming) return;
        if (Array.isArray(incoming.sheets) && incoming.sheets.length > 0) {
            state.sheets = incoming.sheets.map(normalizeSheet);
            state.activeSheetId = (incoming.activeSheetId && state.sheets.some(s => s.id === incoming.activeSheetId))
                ? incoming.activeSheetId
                : state.sheets[0].id;
            syncActiveSheetRefs();
        } else {
            if (incoming.drawings) state.drawings = incoming.drawings;
            if (incoming.notes) state.notes = incoming.notes;
            if (incoming.images) state.images = incoming.images;
            if (incoming.settings) state.settings = { ...state.settings, ...incoming.settings };
            if (incoming.gridCombat) state.gridCombat = { ...state.gridCombat, ...incoming.gridCombat };
        }
    }

    const updateHandler = (data) => {
        if (isSyncing || !data || !data.whiteboard) return;
        applyIncomingWhiteboard(data.whiteboard);
        saveWhiteboardData();
        refreshUI();
    };

    onWSEvent('whiteboard-update', updateHandler);
    wsListeners.set('whiteboard-update', updateHandler);

    const roomStateHandler = (data) => {
        if (data && data.whiteboard) {
            isSyncing = true;
            applyIncomingWhiteboard(data.whiteboard);
            saveWhiteboardData();
            refreshUI();
            isSyncing = false;
        }
    };

    onWSEvent('room-state', roomStateHandler);
    wsListeners.set('room-state', roomStateHandler);

    const syncStateHandler = (data) => {
        if (isSyncing || !data || !data.state) return;
        applyIncomingWhiteboard(data.state);
        saveWhiteboardData();
        refreshUI();
    };

    onWSEvent('sync-state', syncStateHandler);
    wsListeners.set('sync-state', syncStateHandler);

    // ── NEW: Incoming pings from other clients (own ping is drawn locally
    // in handlePing() already, so this only needs to cover everyone else) ──
    const pingHandler = (data) => {
        if (!data || data.sheetId !== state.activeSheetId) return;
        renderPingMarker(data.x, data.y);
    };
    onWSEvent('whiteboard-ping', pingHandler);
    wsListeners.set('whiteboard-ping', pingHandler);
}

function cleanupWebSocketListeners() {
    for (const [event, handler] of wsListeners) {
        try { offWSEvent(event, handler); } catch (e) {}
    }
    wsListeners.clear();
}

function broadcastWhiteboardUpdate() {
    if (isSyncing || isOfflineMode || !isConnectedToServer()) return;
    const sheet = getActiveSheet();
    try {
        sendMessage({
            type: 'whiteboard-update',
            whiteboard: {
                sheets: state.sheets,
                activeSheetId: state.activeSheetId,
                drawings: sheet ? sheet.drawings : [],
                notes: sheet ? sheet.notes : [],
                images: sheet ? sheet.images : [],
                settings: sheet ? sheet.settings : state.settings,
                gridCombat: sheet ? sheet.gridCombat : state.gridCombat
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
    sendMessage({ type: 'sync-request', target: 'whiteboard' });
    showToast('Whiteboard sync requested', 'success');
}

function refreshUI() {
    if (container) {
        renderSheetTabs();
        renderLayersPanel();
        initCanvas();
        restoreDrawings();
        renderOverlay();
        updateStats();
        renderVttCombatToolbar(); // ── NEW ──
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
// VTT ROLE GATING (NEW)
// ============================================================

/**
 * Returns true when the client is connected to a VTT server and the
 * user does NOT have the GM role — i.e. the "player" perspective.
 * Fog of War is rendered at full darkness for this user.
 *
 * 👇 FIX: originally `vttRole === 'player'` — strictly required an
 * explicit 'player' role. In the brief window after connecting but
 * before the first `gmRoleUpdate`/presence event arrives, `vttRole` is
 * still `null`, so a real PLAYER would have gotten the GM's DIM PREVIEW
 * (35% darkness) instead of full darkness during that window — a real
 * fog-of-war leak, however brief. Treating "connected, role not yet
 * known" as a player is the safe default: worst case a GM's fog
 * controls are briefly unavailable until their role is confirmed
 * (recoverable, not a leak), rather than a player briefly seeing what
 * should be hidden.
 */
function isVttPlayer() {
    return isConnectedToServer() && vttRole !== 'gm';
}

/**
 * Returns true when the client is connected to a VTT server and the
 * user HAS the GM role.
 */
function isVttGm() {
    return isConnectedToServer() && vttRole === 'gm';
}

/**
 * Returns true when the user should be allowed to EDIT fog data
 * (toggle, paint reveals, add lights, draw walls, etc.).
 *
 *   Connected + GM      → can control fog
 *   Connected + Player   → cannot control fog (sees it only)
 *   Not connected (local)→ can control fog (single-user mode)
 */
function canControlFog() {
    return !isConnectedToServer() || isVttGm();
}

// ============================================================
// TRACKER INTEGRATION
// ============================================================

function gridCellDistance(a, b, cellSize) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.round(Math.sqrt(dx * dx + dy * dy) / cellSize);
}

function cellDistanceToRangeBand(cells) {
    if (cells <= 1) return 'close';
    if (cells <= 6) return 'near';
    if (cells <= 12) return 'far';
    return 'absent';
}

function syncRangeFromGrid(movedToken) {
    if (!movedToken || !movedToken.combatantName) return;
    const cellSize = state.gridCombat.cellSize || 40;
    const others = (state.gridCombat.tokens || []).filter(t =>
        t.id !== movedToken.id && t.combatantName && t.faction !== movedToken.faction
    );
    if (others.length === 0) return;
    let synced = 0;
    others.forEach(other => {
        const cells = gridCellDistance(movedToken, other, cellSize);
        const band = cellDistanceToRangeBand(cells);
        if (setTrackerRangeByName(movedToken.combatantName, other.combatantName, band)) synced++;
    });
    if (synced > 0) updateTrackerLinkStatusUI();
}

function importFromTracker() {
    if (!gridCombatActive) {
        showToast('Enable Grid Combat mode first.', 'warning');
        return;
    }
    if (konrehActive) {
        showToast("Disable Kon'reh mode to import Tracker combatants.", 'error');
        return;
    }
    if (isLayerLocked('tokens')) {
        showToast('Tokens & Grid layer is locked', 'warning');
        return;
    }

    const encounters = (getState().encounters || []);
    if (encounters.length === 0) {
        showToast('No encounters found — create one in Encounters first.', 'warning');
        return;
    }

    const options = encounters.map((e, i) =>
        `${i + 1}. ${e.title}${isTrackerOpen(e.id) ? ' (tracker open)' : ''}`
    ).join('\n');
    const choice = prompt(`Import combatants from which encounter?\n${options}\n\nEnter number:`);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= encounters.length) {
        showToast('Invalid selection', 'error');
        return;
    }
    const encounter = encounters[idx];

    let source;
    if (isTrackerOpen(encounter.id)) {
        source = getLiveCombatants().map(c => ({ name: c.name, type: c.type }));
    } else {
        source = (encounter.adversaries || []).map(a => ({ name: a.name, type: 'adversary' }));
        if (source.length === 0) {
            showToast("That encounter has no adversaries, and its Tracker isn't open.", 'warning');
            return;
        }
        showToast("Tracker isn't open for this encounter — importing adversaries only (no players).", 'info');
    }

    const cellSize = state.gridCombat.cellSize || 40;
    const existingNames = new Set(state.gridCombat.tokens.map(t => (t.combatantName || '').toLowerCase()));
    let added = 0;
    source.forEach((c, i) => {
        if (!c.name || existingNames.has(c.name.toLowerCase())) return;
        const col = i % 6, row = Math.floor(i / 6);
        state.gridCombat.tokens.push({
            id: 'token-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            label: c.name,
            faction: c.type === 'player' ? 'ally' : 'enemy',
            body: 3,
            x: col * cellSize,
            y: row * cellSize + cellSize * 2,
            color: c.type === 'player' ? '#5a8ab5' : '#c45a5a',
            harm: 0,
            fatigue: 0,
            tags: [],
            layerId: 'tokens',
            combatantName: c.name,
            combatantType: c.type,
            vision: c.type === 'player' ? 3 : 0 // ── NEW: players see by default ──
        });
        added++;
    });

    if (added === 0) {
        showToast('All combatants from that encounter are already on the board.', 'info');
        return;
    }

    state.gridCombat.linkedEncounterId = encounter.id;
    saveWhiteboardData();
    restoreDrawings();
    renderGridCombat();
    updateTrackerLinkStatusUI();
    showToast(`🔗 Imported ${added} combatant${added === 1 ? '' : 's'} from "${encounter.title}"`, 'success');
}

function updateTrackerLinkStatusUI() {
    const el = document.getElementById('whiteboard-tracker-link-status');
    if (!el) return;
    const encId = state.gridCombat?.linkedEncounterId;
    if (!encId) { el.textContent = ''; return; }
    const enc = (getState().encounters || []).find(e => String(e.id) === String(encId));
    el.textContent = enc ? `🔗 Linked: ${enc.title}` : '';
}

// ============================================================
// FOG OF WAR — RAYCASTING & LINE OF SIGHT (NEW)
// ============================================================

/**
 * Ray-segment intersection test.
 *
 * Ray:   P = (rx, ry) + t * (rdx, rdy),  t >= 0
 * Segment: Q = (x1, y1) + s * (x2-x1, y2-y1),  0 <= s <= 1
 *
 * Returns the distance `t` along the ray at the intersection point,
 * or `null` if there is no intersection.
 */
function raySegmentIntersect(rx, ry, rdx, rdy, x1, y1, x2, y2) {
    const sdx = x2 - x1;
    const sdy = y2 - y1;
    const denom = rdx * sdy - rdy * sdx;
    if (Math.abs(denom) < 1e-9) return null; // parallel — no intersection

    const t = ((x1 - rx) * sdy - (y1 - ry) * sdx) / denom;
    const s = ((x1 - rx) * rdy - (y1 - ry) * rdx) / denom;

    if (t < 0 || s < 0 || s > 1) return null;
    return t; // distance from ray origin to hit point
}

/**
 * Casts `numRays` rays from (cx, cy) outward, stopping each at the
 * nearest wall intersection (or `maxRange` if unobstructed).  Returns
 * an array of {x, y} hit points forming a visibility polygon.
 */
function computeLineOfSight(cx, cy, maxRange, walls) {
    const numRays = 72;
    const points = [];

    for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        let hitDist = maxRange;
        for (const wall of walls) {
            const dist = raySegmentIntersect(
                cx, cy, dx, dy,
                wall.x1, wall.y1, wall.x2, wall.y2
            );
            if (dist !== null && dist < hitDist) {
                hitDist = dist;
            }
        }

        points.push({
            x: cx + dx * hitDist,
            y: cy + dy * hitDist,
        });
    }
    return points;
}

// ============================================================
// FOG OF WAR — RENDERING (NEW)
// ============================================================

/**
 * Draws the fog-of-war overlay on the canvas.  This is called at the
 * end of `renderGridCombat()` so it paints on top of everything else
 * (grid, tokens, drawings, zones of control).
 *
 * Rendering logic:
 *
 *   Player perspective (VTT-connected non-GM, or GM in Player View):
 *     - Full darkness overlay at `fog.darkness` opacity
 *     - "destination-out" cuts holes for revealed rects, light sources,
 *       and (if mode is token-vision/line-of-sight) allied token vision
 *     - "screen" composite adds warm/colored light tints additively
 *
 *   GM perspective (VTT-connected GM, or local mode):
 *     - Lighter dim overlay (35% of darkness) so the GM can still see
 *       the full map but knows where fog is applied
 *     - Same hole-cutting so revealed/lit areas are clearly visible
 *     - Wall segments and light-source markers drawn as reference
 */
function drawFogOfWar(cellSize) {
    if (!ctx) return;
    const fog = state.gridCombat.fogOfWar;
    if (!fog || !fog.enabled) return;

    // Determine perspective: players see full fog; GMs (and local users)
    // see a dimmed preview unless Player View is toggled on.
    const isPlayerPerspective = isVttPlayer() || (playerViewActive && canControlFog());

    // ── STEP 1: Draw the fog overlay ──
    ctx.save();

    if (isPlayerPerspective) {
        ctx.fillStyle = `rgba(5, 5, 12, ${fog.darkness})`;
    } else {
        // GM preview: lighter so the map is still visible underneath
        ctx.fillStyle = `rgba(5, 5, 12, ${fog.darkness * 0.35})`;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cut holes for everything that reveals the map
    ctx.globalCompositeOperation = 'destination-out';

    // Manually revealed cell rects
    for (const r of (fog.revealed || [])) {
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    // Light source radii with soft falloff
    for (const light of (fog.lightSources || [])) {
        const grad = ctx.createRadialGradient(
            light.x, light.y, 0,
            light.x, light.y, Math.max(light.radius, 1)
        );
        const alpha = light.intensity ?? 1;
        grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
        grad.addColorStop(0.6, `rgba(0,0,0,${alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(light.x, light.y, Math.max(light.radius, 1), 0, Math.PI * 2);
        ctx.fill();
    }

    // Token vision / line-of-sight reveals
    if (fog.mode === 'token-vision' || fog.mode === 'line-of-sight') {
        const tokens = state.gridCombat.tokens || [];
        for (const t of tokens) {
            // Only allied/player tokens emit vision
            if (t.faction !== 'ally' && t.faction !== 'player') continue;
            const visionCells = t.vision > 0 ? t.vision : 3; // default 3 cells
            const visionRadius = cellSize * visionCells;
            const cx = t.x + cellSize / 2;
            const cy = t.y + cellSize / 2;

            if (fog.mode === 'line-of-sight' && (fog.walls || []).length > 0) {
                // Raycast against walls to build a visibility polygon
                const poly = computeLineOfSight(cx, cy, visionRadius, fog.walls || []);
                if (poly.length > 0) {
                    // Fill the polygon to cut through the fog
                    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, visionRadius);
                    grad.addColorStop(0, 'rgba(0,0,0,0.9)');
                    grad.addColorStop(0.8, 'rgba(0,0,0,0.4)');
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.moveTo(poly[0].x, poly[0].y);
                    for (let i = 1; i < poly.length; i++) {
                        ctx.lineTo(poly[i].x, poly[i].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            } else {
                // Simple radial vision (no walls or mode is token-vision)
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, visionRadius);
                grad.addColorStop(0, 'rgba(0,0,0,0.9)');
                grad.addColorStop(0.8, 'rgba(0,0,0,0.4)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, visionRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    ctx.restore();

    // ── STEP 2: Additive light tint (warm glow on lit areas) ──
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const light of (fog.lightSources || [])) {
        const grad = ctx.createRadialGradient(
            light.x, light.y, 0,
            light.x, light.y, Math.max(light.radius, 1)
        );
        grad.addColorStop(0, light.color || 'rgba(255, 220, 150, 0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(light.x, light.y, Math.max(light.radius, 1), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // ── STEP 3: GM-only reference markers (walls, light positions) ──
    if (canControlFog() && !isPlayerPerspective) {
        // Draw LoS wall segments
        ctx.save();
        ctx.strokeStyle = 'rgba(196, 90, 90, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        for (const wall of (fog.walls || [])) {
            ctx.beginPath();
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();

        // Draw light source markers (dot + radius circle)
        ctx.save();
        for (const light of (fog.lightSources || [])) {
            // Faint radius circle
            ctx.beginPath();
            ctx.arc(light.x, light.y, Math.max(light.radius, 1), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 220, 100, 0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Bright center dot
            ctx.beginPath();
            ctx.arc(light.x, light.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    } else if (isPlayerPerspective) {
        // For players: small dim dots at light sources
        ctx.save();
        for (const light of (fog.lightSources || [])) {
            ctx.beginPath();
            ctx.arc(light.x, light.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 220, 100, 0.4)';
            ctx.fill();
        }
        ctx.restore();
    }
}

/**
 * Paints (reveals or hides) a single grid cell in the fog data.
 * Called continuously during drag with the fog-reveal / fog-hide tools.
 * Does NOT save/broadcast — the caller does that on mouseup.
 */
function paintFogCell(pos, cellSize, reveal) {
    const fog = state.gridCombat.fogOfWar;
    if (!fog) return;
    const cx = Math.floor(pos.x / cellSize) * cellSize;
    const cy = Math.floor(pos.y / cellSize) * cellSize;

    if (reveal) {
        const exists = (fog.revealed || []).some(r =>
            r.x === cx && r.y === cy && r.w === cellSize && r.h === cellSize
        );
        if (!exists) {
            fog.revealed.push({ x: cx, y: cy, w: cellSize, h: cellSize });
        }
    } else {
        fog.revealed = (fog.revealed || []).filter(r =>
            !(r.x === cx && r.y === cy)
        );
    }
    // Re-render without saving (save happens on mouseup)
    restoreDrawings();
    renderGridCombat();
}

// ============================================================
// PING / POINTER TOOL (NEW)
// ============================================================

/**
 * Renders a single expanding-ring ping marker at (x, y) inside the
 * overlay div and removes it after ~1.5s. Deliberately NOT part of
 * `state` — pings are ephemeral pointer gestures, not board content, so
 * they don't touch saveWhiteboardData()/undo history and don't persist
 * across reloads or sync to newly-joining clients.
 */
function renderPingMarker(x, y) {
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

/**
 * Handles a click with the Ping tool active: shows the marker locally
 * and broadcasts it so every other connected client sees it on the same
 * sheet. Available to everyone — unlike fog tools, pinging isn't a
 * GM-only action, it's how a player points at something during a call.
 */
function handlePing(pos) {
    renderPingMarker(pos.x, pos.y);
    if (isConnectedToServer()) {
        try {
            sendMessage({
                type: 'whiteboard-ping',
                sheetId: state.activeSheetId,
                x: pos.x,
                y: pos.y
            });
        } catch (e) { /* ignore */ }
    }
}

// ============================================================
// VTT COMBAT TOOLBAR VISIBILITY (NEW)
// ============================================================

/**
 * Shows or hides the fog controls based on:
 *   - Not in Kon'reh mode (Kon'reh has its own board)
 *   - User is GM or in local mode (players can't control fog)
 *   - Fog is enabled (for the sub-controls)
 *
 * 👇 FIX: this used to also require `gridCombatActive` — meaning Fog of War
 * (and its light sources, darkness slider, walls, everything) only ever
 * appeared while "⚔️ Combat ON" was toggled. Fog is a property of the map
 * itself, not of being in combat — a GM should be able to slowly reveal a
 * dungeon or dim a room with no initiative tracker running at all. Grid
 * Combat is now only required for the token-vision/line-of-sight *modes*
 * (which need positioned tokens), not for fog/lighting generally.
 */
function renderVttCombatToolbar() {
    const fog = state.gridCombat?.fogOfWar;
    const showFog = !konrehActive && canControlFog();

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

    // Show/hide fog tool buttons (reveal, hide, wall, light) – they are always in the toolbar,
    // but we can disable them instead of hiding, to keep layout stable.
    const fogTools = document.querySelectorAll('[data-tool="fog-reveal"], [data-tool="fog-hide"], [data-tool="fog-wall"], [data-tool="fog-light"]');
    fogTools.forEach(btn => {
        const enabled = showFog && fog?.enabled;
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.4';
        btn.style.pointerEvents = enabled ? 'auto' : 'none';
    });

    // Reset tool if fog disabled while fog tool active
    if (!fog?.enabled && FOG_TOOLS.has(currentTool)) {
        currentTool = 'pen';
        document.querySelectorAll('.btn[data-tool]').forEach(b => b.className = 'btn btn-sm btn-secondary');
        const penBtn = document.querySelector('.btn[data-tool="pen"]');
        if (penBtn) penBtn.className = 'btn btn-sm btn-gold';
        if (canvas) canvas.style.cursor = 'crosshair';
    }

    // Manage Lights panel toggle
    if (manageLightsBtn) {
        manageLightsBtn.onclick = () => {
            const panel = document.getElementById('whiteboard-lights-panel');
            if (!panel) return;
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) renderLightsPanel();
        };
    }

    // Fog legend
    const legend = document.getElementById('fog-legend');
    if (legend) legend.style.display = (fog?.enabled && !konrehActive) ? 'block' : 'none';
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
    const importTrackerBtn = document.getElementById('whiteboard-import-tracker');

    if (btn) {
        btn.textContent = gridCombatActive ? '⚔️ Combat ON' : '⚔️ Combat OFF';
        btn.className = gridCombatActive ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-secondary';
    }
    if (addTokenBtn) {
        addTokenBtn.style.display = gridCombatActive && !konrehActive ? 'inline-block' : 'none';
    }
    if (importTrackerBtn) {
        importTrackerBtn.style.display = gridCombatActive && !konrehActive ? 'inline-block' : 'none';
    }

    if (!gridCombatActive && konrehActive) {
        toggleKonreh();
    }

    showToast(gridCombatActive ? '⚔️ Grid Combat Mode enabled' : 'Grid Combat disabled', gridCombatActive ? 'success' : 'info');
    restoreDrawings();
    renderGridCombat();
    renderVttCombatToolbar(); // ── NEW ──
}

function renderGridCombat() {
    if (!ctx || !gridCombatActive) return;

    const gc = state.gridCombat;
    const cellSize = gc.cellSize || 40;
    const tokensLayer = getLayer('tokens');

    ctx.save();
    ctx.globalAlpha = 0.3;

    if (gc.gridType === 'hex') drawHexGrid(cellSize);
    else if (gc.gridType === 'isometric') drawIsometricGrid(cellSize);
    else drawSquareGrid(cellSize);

    ctx.restore();

    if (gc.showCoordinates && !konrehActive) drawCoordinates(cellSize, gc.gridType);
    if (gc.showZones) drawZonesOfControl(cellSize, gc.gridType);

    if (!tokensLayer || isLayerVisibleNow(tokensLayer)) {
        ctx.save();
        ctx.globalAlpha = tokensLayer ? tokensLayer.opacity : 1;
        drawTokens(cellSize, gc.gridType);
        ctx.restore();
    }

    if (konrehActive) drawKonrehBoardOverlay(cellSize);

    // ── NEW: Fog of War overlay (drawn last, on top of everything) ──
    if (!konrehActive) drawFogOfWar(cellSize);
}

function drawKonrehBoardOverlay(cellSize) {
    if (!ctx) return;
    ctx.save();

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, cellSize * 8, cellSize * 8);

    const drawApexMarker = (x, y, label, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x * cellSize + cellSize/2, y * cellSize + cellSize/2);
    };

    drawApexMarker(0, 0, 'H1', '#4a90d9');
    drawApexMarker(7, 7, 'H2', '#d94a4a');
    drawApexMarker(0, 7, 'S', '#d4af37');
    drawApexMarker(7, 0, 'S', '#d4af37');

    ctx.strokeStyle = 'rgba(107, 170, 122, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(3 * cellSize, 3 * cellSize, cellSize * 2, cellSize * 2);

    ctx.restore();
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

        if (tacStatus.isFlanked && !konrehActive) {
            ctx.strokeStyle = '#e8c84a';
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(token.x - 3, token.y - 3, cellSize + 6, cellSize + 6);
            ctx.setLineDash([]);
        }

        // ── NEW: Speaking-glow ring — matched by combatantName (falls back to
        // label) against the voice module's currently-speaking clients, so a
        // player's token lights up on the board while their mic is hot.
        const tokenName = (token.combatantName || token.label || '').toLowerCase();
        if (tokenName && speakingNames.has(tokenName)) {
            ctx.save();
            ctx.strokeStyle = '#6baa7a';
            ctx.shadowColor = '#6baa7a';
            ctx.shadowBlur = 14;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(token.x + cellSize/2, token.y + cellSize/2, cellSize * 0.52, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = token.color || '#d4af37';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.arc(token.x + cellSize/2, token.y + cellSize/2, cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.font = tableModeActive ? 'bold 16px sans-serif' : 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.label?.substring(0, 3) || '?', token.x + cellSize/2, token.y + cellSize/2);

        if (token.harm > 0) {
            ctx.fillStyle = '#d97a7a';
            ctx.font = tableModeActive ? '12px sans-serif' : '9px sans-serif';
            ctx.fillText(`❤${token.harm}`, token.x + cellSize/2, token.y + cellSize + 8);
        }

        // ── NEW: Vision radius indicator (faint circle for tokens with vision) ──
        if (token.vision > 0 && !konrehActive) {
            const fog = state.gridCombat.fogOfWar;
            if (fog?.enabled && (fog.mode === 'token-vision' || fog.mode === 'line-of-sight')) {
                ctx.strokeStyle = 'rgba(107, 170, 122, 0.2)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(
                    token.x + cellSize/2, token.y + cellSize/2,
                    cellSize * token.vision, 0, Math.PI * 2
                );
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        ctx.restore();
    }
}

function addGridToken() {
    if (!gridCombatActive || konrehActive) {
        showToast('Disable Kon\'reh mode to add custom tokens', 'error');
        return;
    }
    if (isLayerLocked('tokens')) {
        showToast('Tokens & Grid layer is locked', 'warning');
        return;
    }

    const name = prompt('Token label:', 'Guard');
    if (!name) return;
    const faction = prompt('Faction (ally or enemy):', 'enemy')?.toLowerCase() || 'enemy';
    const bodyStr = prompt('Body Attribute (for movement):', '3');
    const body = parseInt(bodyStr) || 3;
    // ── NEW: Vision radius prompt ──
    const visionStr = prompt('Vision radius in cells (0 = no vision, 3 = default for allies):',
        faction === 'ally' ? '3' : '0');
    const vision = parseInt(visionStr) || 0;

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
        tags: [],
        layerId: 'tokens',
        vision: vision // ── NEW ──
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
// KON'REH INTEGRATION
// ============================================================

function toggleKonreh() {
    if (!gridCombatActive) {
        toggleGridCombat();
    }

    if (konrehActive) {
        konrehActive = false;
        konrehGame = null;
        showToast("Kon'reh mode disabled", 'info');
        const btn = document.getElementById('whiteboard-konreh');
        if (btn) btn.className = 'btn btn-sm btn-secondary';
        const addTokenBtn = document.getElementById('whiteboard-add-token');
        if (addTokenBtn) addTokenBtn.style.display = 'inline-block';
        const importTrackerBtn = document.getElementById('whiteboard-import-tracker');
        if (importTrackerBtn) importTrackerBtn.style.display = 'inline-block';
        const gridTypeSel = document.getElementById('whiteboard-grid-type');
        if (gridTypeSel) gridTypeSel.style.display = '';
        renderVttCombatToolbar(); // ── NEW ──
        return;
    }

    konrehGame = new KonrehGame();
    konrehActive = true;
    state.gridCombat.cellSize = 64;
    state.gridCombat.gridType = 'square';

    const btn = document.getElementById('whiteboard-konreh');
    if (btn) btn.className = 'btn btn-sm btn-gold';

    const addTokenBtn = document.getElementById('whiteboard-add-token');
    if (addTokenBtn) addTokenBtn.style.display = 'none';
    const importTrackerBtn = document.getElementById('whiteboard-import-tracker');
    if (importTrackerBtn) importTrackerBtn.style.display = 'none';
    const gridTypeSel = document.getElementById('whiteboard-grid-type');
    if (gridTypeSel) gridTypeSel.style.display = 'none';

    state.gridCombat.tokens = [];
    const cellSize = state.gridCombat.cellSize;
    for (const id in konrehGame.pieces) {
        const p = konrehGame.pieces[id];
        if (p.isAlive) {
            let color = '#d4af37';
            if (p.type === 'blue') color = p.player === 1 ? '#4a90d9' : '#d94a4a';
            if (p.type === 'red') color = '#d94a4a';
            if (p.type === 'orange') color = '#d9a54a';
            if (p.type === 'green') color = '#4ad97a';

            state.gridCombat.tokens.push({
                id: p.id,
                label: p.type.charAt(0).toUpperCase(),
                faction: p.player === 1 ? 'ally' : 'enemy',
                x: p.x * cellSize,
                y: p.y * cellSize,
                color: color,
                harm: 0,
                fatigue: 0,
                tags: [],
                layerId: 'tokens',
                vision: 0
            });
        }
    }
    saveWhiteboardData();
    restoreDrawings();
    renderGridCombat();
    renderVttCombatToolbar(); // ── NEW ──
    showToast("🌀 Kon'reh Mode enabled! Drag pieces to play.", 'success');
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    loadWhiteboardData();

    const isConnected = isConnectedToServer();
    isOfflineMode = !isConnected;

    container.innerHTML = `
        <div class="whiteboard-modern-layout flex flex-col gap-2">
            <!-- HEADER (unchanged) -->
            <header class="flex-between" id="whiteboard-header">
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

            <!-- OFFLINE OVERLAY (unchanged) -->
            <div id="whiteboard-offline-overlay" class="panel flex gap-2 flex-center" style="display:${isConnected ? 'none' : 'flex'}; border: 1px solid var(--orange);">
                <span style="font-size: 1.5rem;">📡</span>
                <div class="flex-1">
                    <div class="text-gold font-bold">Local Mode</div>
                    <div class="text-muted text-sm">Whiteboard is saved locally. Connect to server for real-time collaboration.</div>
                </div>
                <button class="btn btn-sm btn-primary" id="whiteboard-connect-btn">🔗 Connect</button>
            </div>

            <!-- TOOLBAR – REORGANISED -->
            <div class="panel flex flex-wrap gap-2" id="whiteboard-toolbar" style="padding: 0.5rem;">

                <!-- Drawing Tools group -->
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

                <!-- Polygon controls (shown only when polygon tool active) -->
                <div class="flex gap-1 flex-center" id="whiteboard-polygon-controls" style="display:${currentTool === 'polygon' ? 'flex' : 'none'};">
                    <label class="text-muted text-sm flex gap-1 flex-center">
                        Sides <input type="number" id="whiteboard-polygon-sides" min="3" max="12" value="${polygonSides}" style="width:44px;" />
                    </label>
                    <label class="text-muted text-sm flex gap-1 flex-center">
                        <input type="checkbox" id="whiteboard-polygon-star" ${polygonStarRatio > 0 ? 'checked' : ''} style="width:auto;" /> Star
                    </label>
                </div>

                <!-- Stroke options -->
                <div class="flex gap-1 flex-center">
                    <input type="color" id="whiteboard-color" value="${currentColor}" style="width:32px;height:32px;padding:0;border:none;background:none;cursor:pointer;" />
                    <input type="range" id="whiteboard-size" min="1" max="20" value="${currentSize}" title="Stroke size" style="width:70px;" />
                    <input type="range" id="whiteboard-opacity" min="0.1" max="1" step="0.05" value="${currentOpacity}" title="Stroke opacity" style="width:60px;" />
                </div>

                <!-- Undo/Redo -->
                <div class="flex gap-1 flex-center">
                    <button class="btn btn-sm btn-secondary" id="whiteboard-undo" title="Undo (Ctrl+Z)">↶</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-redo" title="Redo (Ctrl+Y)">↷</button>
                </div>

                <!-- Grid & Combat group -->
                <div class="flex gap-1 flex-center">
                    <label class="text-muted text-sm flex gap-1 flex-center">
                        <input type="checkbox" id="whiteboard-grid" ${state.settings.gridSnap ? 'checked' : ''} style="width:auto;"/> Snap
                    </label>
                    <button class="btn btn-sm ${gridCombatActive ? 'btn-danger' : 'btn-secondary'}" id="whiteboard-grid-combat">
                        ${gridCombatActive ? '⚔️ Combat ON' : '⚔️ Combat OFF'}
                    </button>
                    <select id="whiteboard-grid-type" title="Grid type" style="${konrehActive ? 'display:none;' : ''}font-size:0.8rem;padding:0.25rem 0.3rem;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;">
                        <option value="square" ${state.gridCombat.gridType === 'square' ? 'selected' : ''}>◻️ Square</option>
                        <option value="hex" ${state.gridCombat.gridType === 'hex' ? 'selected' : ''}>⬡ Hex</option>
                        <option value="isometric" ${state.gridCombat.gridType === 'isometric' ? 'selected' : ''}>◇ Isometric</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-add-token" style="${gridCombatActive && !konrehActive ? '' : 'display:none;'}">🎯 Add Token</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-import-tracker" style="${gridCombatActive && !konrehActive ? '' : 'display:none;'}">🔗 Import Tracker</button>
                    <button class="btn btn-sm ${konrehActive ? 'btn-gold' : 'btn-secondary'}" id="whiteboard-konreh">🌀 Kon'reh</button>
                    <span id="whiteboard-tracker-link-status" class="text-muted text-sm"></span>
                </div>

                <!-- Fog & Vision group (always visible, but disabled if not GM/local) -->
                <div class="flex gap-1 flex-center" style="border-left:1px solid var(--border);padding-left:8px;">
                    <button class="btn btn-sm ${state.gridCombat.fogOfWar?.enabled ? 'btn-danger' : 'btn-secondary'}" id="whiteboard-fog-toggle" title="Toggle Fog of War">
                        ${state.gridCombat.fogOfWar?.enabled ? '🌫️ Fog ON' : '🌫️ Fog OFF'}
                    </button>
                    <select id="whiteboard-fog-mode" title="Fog mode" style="font-size:0.8rem;padding:0.25rem 0.3rem;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;">
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

                <!-- Darkness slider & Light manager -->
                <div class="flex gap-1 flex-center" style="border-left:1px solid var(--border);padding-left:8px;">
                    <label class="text-muted text-sm flex gap-1 flex-center" title="Darkness level (0=lit, 1=pitch black)">
                        Dark <input type="range" id="whiteboard-fog-darkness" min="0" max="1" step="0.01" value="${state.gridCombat.fogOfWar?.darkness ?? 0.85}" style="width:80px;" />
                        <span id="whiteboard-darkness-value" class="text-xs" style="min-width:30px;">${Math.round((state.gridCombat.fogOfWar?.darkness ?? 0.85) * 100)}%</span>
                    </label>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-manage-lights" title="Manage light sources">💡 Manage Lights</button>
                </div>

                <!-- Layers & Player View -->
                <div class="flex gap-1 flex-center" style="border-left:1px solid var(--border);padding-left:8px;">
                    <button class="btn btn-sm btn-secondary" id="whiteboard-toggle-layers" title="Layers">🗂️ Layers</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-player-view" title="Preview as player">👁️ Player View</button>
                </div>
            </div>

            <!-- LIGHT SOURCES PANEL (new, collapsible) -->
            <div id="whiteboard-lights-panel" class="panel" style="display:none; padding:0.5rem;"></div>

            <!-- Layers panel (unchanged) -->
            <div class="panel" id="whiteboard-layers-panel" style="display:none; padding:0.5rem;"></div>

            <!-- Sheet tabs (unchanged) -->
            <div id="whiteboard-sheet-tabs" style="display:flex; align-items:flex-end; padding-left:4px; margin-bottom:-1px; position:relative; z-index:2;"></div>

            <!-- Canvas Container (unchanged) -->
            <div class="panel relative overflow-hidden" id="whiteboard-canvas-container" style="height: ${tableModeActive ? '92vh' : '65vh'}; min-height: 400px; padding: 0;">
                <canvas id="whiteboard-canvas" style="width:100%;height:100%;display:block;cursor:crosshair;"></canvas>
                <div id="whiteboard-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></div>
                ${!isConnected ? `<div class="absolute flex-center" style="top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:0.1;font-size:4rem;font-weight:bold;color:var(--text3);white-space:nowrap;">LOCAL MODE</div>` : ''}
                <button id="whiteboard-table-mode" title="Maximize board" style="position:absolute; top:10px; right:10px; z-index:30; padding:0.4rem 0.8rem; background:rgba(10,10,15,0.75); color:var(--text); border:1px solid var(--border); border-radius:var(--radius-sm); cursor:pointer; font-size:0.85rem;">
                    ${tableModeActive ? '🖥️ Exit Table Mode' : '🖥️ Table Mode'}
                </button>
            </div>

            <!-- Controls bar (unchanged) -->
            <div class="panel flex gap-1 flex-center" id="whiteboard-controls-bar">
                <button class="btn btn-sm btn-primary" id="whiteboard-add-note">📝 Add Note</button>
                <button class="btn btn-sm btn-secondary" id="whiteboard-upload-image">🖼️ Upload Map</button>
                <button class="btn btn-sm btn-ghost" id="whiteboard-clear-drawings">🧹 Clear Draw</button>
                <button class="btn btn-sm btn-ghost" id="whiteboard-clear" title="Clear All">🗑️ Clear All</button>
                <button class="btn btn-sm btn-gold" id="whiteboard-export" title="Export as Image">💾 Export</button>
                <button class="btn btn-sm btn-secondary" id="whiteboard-sync-btn" title="Force sync">🔄 Sync</button>
                <span class="text-muted whiteboard-stats text-sm flex-1 text-right">${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images</span>
            </div>

            <!-- Grid Combat Legend (unchanged) -->
            <div id="grid-combat-legend" style="position:absolute;bottom:10px;right:10px;background:rgba(10,10,15,0.8);padding:0.3rem 0.6rem;border-radius:var(--radius-sm);font-size:0.65rem;color:var(--text3);display:${gridCombatActive ? 'block' : 'none'};border:1px solid var(--border);pointer-events:none;z-index:20;">
                <div><span style="color:var(--red);">⬤</span> Enemy ZoC | <span style="color:var(--blue);">⬤</span> Ally ZoC</div>
                <div><span style="color:var(--gold);">▭</span> Flanked (Dominant)</div>
                <div id="fog-legend" style="display:${state.gridCombat.fogOfWar?.enabled ? 'block' : 'none'};"><span style="color:rgba(255,220,100,0.8);">💡</span> Light | <span style="color:rgba(196,90,90,0.8);">🧱</span> LoS Wall</div>
            </div>
        </div>
    `;

    // --- Initialise canvas, attach events, etc. (unchanged) ---
    initCanvas();
    renderOverlay();
    attachEvents();
    restoreDrawings();
    setupWebSocketSync();
    updateConnectionStatusUI(isConnected);
    renderSheetTabs();
    renderLayersPanel();
    renderLightsPanel();      // NEW: populate light panel
    renderVttCombatToolbar(); // updated to show/hide based on role
    if (voiceUnsub) voiceUnsub();
    voiceUnsub = onVoiceClientsChanged((clients) => {
        speakingNames = new Set((clients || []).filter(c => c.speaking).map(c => (c.name || '').toLowerCase()));
        if (gridCombatActive) { restoreDrawings(); renderGridCombat(); }
    });
    if (gridCombatActive) renderGridCombat();
    applyTableMode();
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
        // 👇 NEW: Polygon/star tool, ported from the object-model rewrite.
        const [a, b] = drawing.points;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const radius = Math.hypot(b.x - a.x, b.y - a.y) / 2;
        drawPolygonShape(cx, cy, Math.max(radius, 0.01), drawing.sides || 6, drawing.starRatio || 0);
    } else if (drawing.tool === 'measure' && drawing.points.length >= 2) {
        // 👇 NEW: Persistent pinned measurement (Shift+release on the Ruler
        // tool), ported from the object-model rewrite's measurement tool —
        // unlike the transient ruler preview, this sticks to the map as a
        // real annotation (undo-able, saved, synced like any other drawing).
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
        // 👇 NEW: Catmull-rom-style bezier smoothing for freehand pen/eraser
        // strokes, ported from the object-model rewrite, in place of the
        // old straight lineTo-per-point segments — visibly smoother ink,
        // especially with fast mouse movement and sparse sampling.
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

function drawArrow(start, end) {
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

// 👇 NEW: Regular polygon / star path helper, ported from the object-model
// rewrite. Shared by the live drag-preview (in draw()) and the persisted
// render above, so both draw the exact same shape math.
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

function drawPolygonShape(cx, cy, radius, sides, starRatio, rotation = 0) {
    if (!ctx) return;
    const points = computePolygonPoints(cx, cy, radius, sides, starRatio, rotation);
    if (points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.stroke();
}

function snapToGrid(x, y) {
    if (!state.settings.gridSnap && !konrehActive) return { x, y };
    const gridSize = konrehActive ? (state.gridCombat.cellSize || 64) : (state.settings.gridSize || 40);
    return { x: Math.round(x / gridSize) * gridSize, y: Math.round(y / gridSize) * gridSize };
}

// ============================================================
// LIGHT SOURCES PANEL
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

    // --- Attach events for the panel controls ---
    panel.querySelectorAll('input[data-prop]').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.lightIdx, 10);
            const prop = e.target.dataset.prop;
            const fog = state.gridCombat.fogOfWar;
            if (!fog || !fog.lightSources[idx]) return;
            let val = parseFloat(e.target.value);
            if (prop === 'radius') val = val * cellSize;
            fog.lightSources[idx][prop] = val;
            // If color, convert hex to rgba if needed – we store as rgba string
            if (prop === 'color') {
                const hex = e.target.value;
                const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
                fog.lightSources[idx].color = `rgba(${r},${g},${b},0.25)`;
            }
            saveWhiteboardData();
            restoreDrawings();
            renderGridCombat();
            // Update the label next to the slider (radius)
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

// Helper: convert rgba string to hex for color picker (simple approximation)
function rgbToHex(rgba) {
    if (!rgba) return '#d4af37';
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return '#d4af37';
    const r = parseInt(match[1], 10), g = parseInt(match[2], 10), b = parseInt(match[3], 10);
    return '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
}

// ============================================================
// OVERLAY RENDERING
// ============================================================

function renderOverlay() {
    const overlay = document.getElementById('whiteboard-overlay');
    if (!overlay) return;
    const canDrag = currentTool === 'select';

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

    // ── NEW: Ping tool — works on any sheet, not just Grid Combat, and is
    // available to everyone (no GM gating). Single click, no drag state.
    if (currentTool === 'ping') {
        handlePing(pos);
        return;
    }

    // ── Fog of War interactions — 👇 FIX: these used to be nested inside
    // `if (gridCombatActive)`, so light dragging and all four fog tools
    // silently did nothing unless Combat Mode was ON. Fog now works on any
    // sheet; only token dragging (below) stays combat-specific, since
    // tokens are a combat/grid concept. ──
    {
        const cellSize = state.gridCombat.cellSize || 40;
        const fog = state.gridCombat.fogOfWar;

        // Light source hit-test (select tool + fog enabled + GM/local)
        if (currentTool === 'select' && fog?.enabled && canControlFog()) {
            const clickedLight = (fog.lightSources || []).find(ls => {
                const dx = pos.x - ls.x, dy = pos.y - ls.y;
                return Math.sqrt(dx * dx + dy * dy) < 20;
            });
            if (clickedLight) {
                // Shift+click deletes the light source
                if (e.shiftKey) {
                    fog.lightSources = fog.lightSources.filter(ls => ls !== clickedLight);
                    saveWhiteboardData();
                    restoreDrawings();
                    showToast('💡 Light source removed', 'info');
                    return;
                }
                // Otherwise start dragging
                isDraggingLight = true;
                draggedLight = clickedLight;
                canvas.style.cursor = 'grabbing';
                return;
            }
        }

        // Fog tools (fog-reveal, fog-hide, fog-wall, fog-light)
        if (FOG_TOOLS.has(currentTool)) {
            if (!canControlFog()) {
                showToast('Only GM can edit fog of war', 'warning');
                return;
            }
            if (!fog) return;

            if (currentTool === 'fog-light') {
                // Place a new light source at the click position
                fog.lightSources.push({
                    x: pos.x,
                    y: pos.y,
                    radius: cellSize * 4,
                    color: 'rgba(255, 220, 150, 0.25)',
                    intensity: 1,
                });
                saveWhiteboardData();
                restoreDrawings();
                showToast('💡 Light source placed (dbl-click to edit, Shift+click to delete)', 'success');
                return;
            }

            if (currentTool === 'fog-wall') {
                // Start a wall segment (two-point line, like the line tool)
                isDrawing = true;
                fogWallStart = { x: pos.x, y: pos.y };
                return;
            }

            if (currentTool === 'fog-reveal' || currentTool === 'fog-hide') {
                // Start painting cells (like the pen tool but on fog data)
                isDrawing = true;
                paintFogCell(pos, cellSize, currentTool === 'fog-reveal');
                return;
            }
        }
    }

    // ── Grid combat token dragging (still requires Combat Mode ON) ──
    if (gridCombatActive) {
        const cellSize = state.gridCombat.cellSize || 40;
        const clickedToken = state.gridCombat.tokens.find(t =>
            pos.x >= t.x && pos.x <= t.x + cellSize &&
            pos.y >= t.y && pos.y <= t.y + cellSize
        );
        if (clickedToken) {
            if (isLayerLocked(clickedToken.layerId || 'tokens')) {
                showToast('Tokens & Grid layer is locked', 'warning');
                return;
            }
            isDraggingToken = true;
            draggedToken = clickedToken;
            tokenStartPos = { x: clickedToken.x, y: clickedToken.y };
            canvas.style.cursor = 'grabbing';
            return;
        }
    }

    if (currentTool === 'ruler') {
        isDrawing = true;
        rulerStart = pos;
        rulerEnd = pos;
        return;
    }

    if (currentTool === 'select' || currentTool === 'text') return;

    if (isLayerLocked(activeLayerId)) {
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
    } else if (SHAPE_TOOLS.has(currentTool)) {
        pushUndoSnapshot();
        state._shapeStart = { x: pos.x, y: pos.y };
    }
}

function draw(e) {
    if (!isDrawing && !isDraggingToken && !isDraggingLight) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    const pos = snapToGrid(x, y);

    // ── NEW: Light source dragging ──
    if (isDraggingLight && draggedLight) {
        draggedLight.x = pos.x;
        draggedLight.y = pos.y;
        restoreDrawings();
        renderGridCombat();
        return;
    }

    if (isDraggingToken && draggedToken) {
        const cellSize = state.gridCombat.cellSize || 40;
        if (konrehActive && konrehGame) {
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

    if (currentTool === 'ruler' && rulerStart) {
        rulerEnd = pos;
        restoreDrawings();
        renderGridCombat();

        const cellSize = state.gridCombat.cellSize || 40;
        const cells = gridCellDistance(rulerStart, rulerEnd, cellSize);
        const feet = cells * 5;

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

    // ── NEW: Fog wall preview (while dragging) ──
    if (currentTool === 'fog-wall' && isDrawing && fogWallStart) {
        restoreDrawings();
        renderGridCombat();
        // Draw wall preview line
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

    // ── NEW: Fog reveal/hide continuous painting ──
    if ((currentTool === 'fog-reveal' || currentTool === 'fog-hide') && isDrawing) {
        const cellSize = state.gridCombat.cellSize || 40;
        paintFogCell(pos, cellSize, currentTool === 'fog-reveal');
        return;
    }

    if (currentTool === 'pen' || currentTool === 'eraser') {
        const drawing = state.drawings[state.drawings.length - 1];
        if (drawing) {
            drawing.points.push({ x: pos.x, y: pos.y });
            drawStroke(drawing);
            saveWhiteboardData();
        }
    } else if (SHAPE_TOOLS.has(currentTool) && currentTool !== 'ruler') {
        restoreDrawings();
        ctx.save();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.globalAlpha = currentOpacity;
        const start = state._shapeStart;
        if (start) {
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
                // 👇 NEW: live polygon/star preview while dragging
                const cx = (start.x + pos.x) / 2, cy = (start.y + pos.y) / 2;
                const radius = Math.hypot(pos.x - start.x, pos.y - start.y) / 2;
                drawPolygonShape(cx, cy, Math.max(radius, 0.01), polygonSides, polygonStarRatio);
            }
        }
        ctx.restore();
    }
}

function endDrawing(e) {
    // ── NEW: Finalize light source dragging ──
    if (isDraggingLight) {
        isDraggingLight = false;
        draggedLight = null;
        canvas.style.cursor = 'grab';
        saveWhiteboardData();
        return;
    }

    if (isDraggingToken) {
        if (draggedToken && tokenStartPos) {
            const cellSize = state.gridCombat.cellSize || 40;

            if (konrehActive && konrehGame) {
                const fromX = Math.floor(tokenStartPos.x / cellSize);
                const fromY = Math.floor(tokenStartPos.y / cellSize);
                const toX = Math.floor(draggedToken.x / cellSize);
                const toY = Math.floor(draggedToken.y / cellSize);

                const validMoves = konrehGame.getValidMoves(draggedToken.id);
                const validMove = validMoves.find(m => m.x === toX && m.y === toY);

                if (validMove) {
                    konrehGame.makeMove(draggedToken.id, validMove);

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
                canvas.style.cursor = 'grab';
                return;
            }

            const cellsMoved = gridCellDistance(draggedToken, tokenStartPos, cellSize);

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
            syncRangeFromGrid(draggedToken);
        }
        isDraggingToken = false;
        draggedToken = null;
        tokenStartPos = null;
        canvas.style.cursor = 'grab';
        return;
    }

    if (currentTool === 'ruler' && rulerStart && rulerEnd) {
        const cellSize = state.gridCombat.cellSize || 40;
        const cells = gridCellDistance(rulerStart, rulerEnd, cellSize);
        const feet = cells * 5;
        logRecordingEvent('measurement', `GM measured ${cells} cells (${feet} ft).`);

        // 👇 NEW: Shift+release pins the measurement to the map permanently
        // (a dashed line + distance label saved as a real drawing), ported
        // from the object-model rewrite's measurement tool. Without Shift,
        // behavior is unchanged — the ruler stays a transient, non-persisted
        // readout, same as it's always been.
        if (e?.shiftKey) {
            if (isLayerLocked(activeLayerId)) {
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

    // ── NEW: Finalize fog wall placement ──
    if (currentTool === 'fog-wall' && isDrawing && fogWallStart) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left;
        const y = (e.clientY || e.changedTouches?.[0]?.clientY || 0) - rect.top;
        const pos = snapToGrid(x, y);

        const dist = Math.sqrt(
            (pos.x - fogWallStart.x) ** 2 + (pos.y - fogWallStart.y) ** 2
        );
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

    // ── NEW: Finalize fog reveal/hide painting (save once on mouseup) ──
    if ((currentTool === 'fog-reveal' || currentTool === 'fog-hide') && isDrawing) {
        isDrawing = false;
        saveWhiteboardData();
        return;
    }

    if (!isDrawing) return;
    isDrawing = false;

    if (SHAPE_TOOLS.has(currentTool)) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left;
        const y = (e.clientY || e.changedTouches?.[0]?.clientY || 0) - rect.top;
        const pos = snapToGrid(x, y);
        const start = state._shapeStart;
        if (start) {
            const newDrawing = {
                id: 'draw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                points: [{ x: start.x, y: start.y }, { x: pos.x, y: pos.y }],
                color: currentColor,
                size: currentSize,
                opacity: currentOpacity,
                tool: currentTool,
                layerId: activeLayerId,
                timestamp: Date.now()
            };
            // 👇 NEW: polygon/star tool needs its side-count and star ratio
            // saved on the drawing itself so it renders the same shape again
            // on reload/sync, not just during the live preview.
            if (currentTool === 'polygon') {
                newDrawing.sides = polygonSides;
                newDrawing.starRatio = polygonStarRatio;
            }
            state.drawings.push(newDrawing);
            saveWhiteboardData();
            restoreDrawings();
            updateStats();
            state._shapeStart = null;
        }
    }
}

function restoreDrawings() {
    if (!ctx) return;
    updateTrackerLinkStatusUI();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.settings.showGrid !== false && !gridCombatActive) drawGrid();

    for (const layer of layersInDrawOrder()) {
        if (!isLayerVisibleNow(layer)) continue;
        const drawingsOnLayer = state.drawings.filter(d => (d.layerId || 'drawing') === layer.id);
        for (const d of drawingsOnLayer) drawStroke(d);
    }

    if (gridCombatActive) {
        renderGridCombat(); // already draws fog internally, on top of tokens/grid
    } else if (!konrehActive) {
        // 👇 FIX: fog is independent of Grid Combat mode now — draw it here
        // too, so painting reveals / placing lights / dimming a room works
        // on any sheet, combat or not. (Kon'reh keeps its own board, no fog.)
        drawFogOfWar(state.gridCombat.cellSize || 40);
    }
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
            // 👇 NEW: show the Sides/Star controls only while the Polygon tool is active
            const polyControls = document.getElementById('whiteboard-polygon-controls');
            if (polyControls) polyControls.style.display = currentTool === 'polygon' ? 'flex' : 'none';
            renderOverlay();
        });
    });

    // 👇 NEW: Polygon/star tool controls
    document.getElementById('whiteboard-polygon-sides')?.addEventListener('input', (e) => {
        const n = parseInt(e.target.value, 10);
        polygonSides = isNaN(n) ? 6 : Math.max(3, Math.min(12, n));
    });
    document.getElementById('whiteboard-polygon-star')?.addEventListener('change', (e) => {
        polygonStarRatio = e.target.checked ? 0.5 : 0;
    });

    document.getElementById('whiteboard-color')?.addEventListener('input', (e) => currentColor = e.target.value);
    document.getElementById('whiteboard-size')?.addEventListener('input', (e) => currentSize = parseInt(e.target.value));
    document.getElementById('whiteboard-opacity')?.addEventListener('input', (e) => currentOpacity = parseFloat(e.target.value));
    document.getElementById('whiteboard-grid')?.addEventListener('change', (e) => {
        state.settings.gridSnap = e.target.checked;
        saveWhiteboardData();
    });

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
    document.getElementById('whiteboard-konreh')?.addEventListener('click', toggleKonreh);
    document.getElementById('whiteboard-konreh')?.addEventListener('click', () => {
        openKonrehModal();
    });
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

    // ── NEW: Fog of War event listeners ──
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
        // Don't save on every slider tick — save on change
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

    // ── NEW: Listen for VTT GM role updates (for fog gating) ──
    // FIX: remove any previously-registered listener before adding a new
    // one. If attachEvents() is ever invoked twice for the same mount
    // without an intervening destroy()/onDeactivate() (e.g. some future
    // caller re-runs render() without a full teardown), the old code left
    // the previous document-level listener attached forever, since
    // `gmRoleHandler` only remembers the newest handler and destroy() can
    // only remove what it currently points to. Removing first makes this
    // idempotent regardless of how many times attachEvents() runs.
    if (gmRoleHandler) {
        document.removeEventListener('gmRoleUpdate', gmRoleHandler);
    }
    gmRoleHandler = (e) => {
        vttRole = e.detail?.role || null;
        if (gridCombatActive) {
            renderVttCombatToolbar();
            restoreDrawings();
            renderGridCombat();
        }
    };
    document.addEventListener('gmRoleUpdate', gmRoleHandler);

    // ── NEW: Double-click on light source to edit properties ──
    if (canvas) {
        // Inside attachEvents(), after the canvas events:

        canvas.addEventListener('dblclick', (e) => {
            if (!gridCombatActive || currentTool !== 'select') return;
            if (!canControlFog()) return;
            const fog = state.gridCombat.fogOfWar;
            if (!fog?.enabled) return;

            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX || 0) - rect.left;
            const y = (e.clientY || 0) - rect.top;

            const clickedLight = (fog.lightSources || []).find(ls => {
                const dx = x - ls.x, dy = y - ls.y;
                return Math.sqrt(dx * dx + dy * dy) < 20;
            });
            if (!clickedLight) return;

            const cellSize = state.gridCombat.cellSize || 40;
            const radiusStr = prompt('Light radius (in cells):', String(Math.round(clickedLight.radius / cellSize)));
            if (radiusStr !== null) {
                const cells = parseInt(radiusStr);
                if (!isNaN(cells) && cells > 0) clickedLight.radius = cells * cellSize;
            }

            const colorOptions = [
                'rgba(255, 220, 150, 0.25)',  // Warm (torch)
                'rgba(150, 200, 255, 0.25)',  // Cool (magic)
                'rgba(150, 255, 150, 0.25)',  // Green (witchlight)
                'rgba(255, 100, 100, 0.25)',  // Red (alarm)
                'rgba(255, 255, 255, 0.20)',  // White (daylight)
            ];
            const colorChoice = prompt(
                'Light color:\n1. Warm (torch)\n2. Cool (magic)\n3. Green (witchlight)\n4. Red (alarm)\n5. White (daylight)\n\nEnter 1-5:',
                '1'
            );
            if (colorChoice) {
                const idx = Math.max(0, Math.min(4, parseInt(colorChoice) - 1));
                if (!isNaN(idx)) clickedLight.color = colorOptions[idx];
            }

            const intensityStr = prompt('Intensity (0.1 to 1.0):', String(clickedLight.intensity ?? 1));
            if (intensityStr !== null) {
                const val = parseFloat(intensityStr);
                if (!isNaN(val)) clickedLight.intensity = Math.max(0.1, Math.min(1, val));
            }

            saveWhiteboardData();
            restoreDrawings();
            renderGridCombat();
        
        });
        // Inside attachEvents(), after the canvas events:
        canvas.addEventListener('mousemove', (e) => {
            if (currentTool !== 'select') return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            const fog = state.gridCombat?.fogOfWar;
            if (!fog?.enabled || !canControlFog()) {
                canvas.style.cursor = 'grab';
                return;
            }
            const light = (fog.lightSources || []).find(ls => {
                const dx = x - ls.x, dy = y - ls.y;
                return Math.sqrt(dx*dx + dy*dy) < 20;
            });
            if (light) {
                canvas.style.cursor = 'pointer';
                canvas.title = 'Double-click to edit light';
            } else {
                canvas.style.cursor = 'grab';
                canvas.title = '';
            }
        });
        canvas.addEventListener('dblclick', (e) => {
    if (currentTool !== 'select' || !canControlFog()) return;
    const fog = state.gridCombat?.fogOfWar;
    if (!fog?.enabled) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const idx = fog.lightSources.findIndex(ls => {
        const dx = x - ls.x, dy = y - ls.y;
        return Math.sqrt(dx*dx + dy*dy) < 20;
    });
    if (idx === -1) return;
    // Open the panel and highlight the row
    const panel = document.getElementById('whiteboard-lights-panel');
    if (panel) {
        panel.style.display = 'block';
        renderLightsPanel();
        // Highlight the row
        const rows = panel.querySelectorAll('[data-light-idx]');
        if (rows[idx]) {
            rows[idx].closest('div')?.scrollIntoView({ block: 'center' });
            rows[idx].closest('div')?.style.setProperty('background', 'rgba(212,175,55,0.2)');
        }
    }
});
    }

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

    window.addEventListener('keydown', (e) => {
        if (!container) return;
        const key = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    });

    window.editWhiteboardNote = (id) => {
        const note = state.notes.find(n => n.id === id);
        if (note) {
            if (isLayerLocked(note.layerId)) { showToast('This layer is locked', 'warning'); return; }
            const newContent = prompt('Edit note:', note.content);
            if (newContent !== null) {
                pushUndoSnapshot();
                note.content = newContent;
                saveWhiteboardData(); renderOverlay();
            }
        }
    };
    window.deleteWhiteboardNote = (id) => {
        const note = state.notes.find(n => n.id === id);
        if (note && isLayerLocked(note.layerId)) { showToast('This layer is locked', 'warning'); return; }
        pushUndoSnapshot();
        state.notes = state.notes.filter(n => n.id !== id);
        saveWhiteboardData(); renderOverlay(); updateStats();
    };
    window.deleteWhiteboardImage = (id) => {
        const img = state.images.find(i => i.id === id);
        if (img && isLayerLocked(img.layerId)) { showToast('This layer is locked', 'warning'); return; }
        pushUndoSnapshot();
        state.images = state.images.filter(i => i.id !== id);
        saveWhiteboardData(); renderOverlay(); updateStats();
    };

    window.__wbStartDragNote = (id, event) => {
        if (currentTool !== 'select') return;
        const note = state.notes.find(n => n.id === id);
        if (!note) return;
        if (isLayerLocked(note.layerId)) { showToast('This layer is locked', 'warning'); return; }
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
            isDraggingObject = false; draggedObject = null; draggedObjectType = null;
            saveWhiteboardData();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    window.__wbStartDragImage = (id, event) => {
        if (currentTool !== 'select') return;
        const img = state.images.find(i => i.id === id);
        if (!img) return;
        if (isLayerLocked(img.layerId)) { showToast('This layer is locked', 'warning'); return; }
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
            isDraggingObject = false; draggedObject = null; draggedObjectType = null;
            saveWhiteboardData();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

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
        renderVttCombatToolbar(); // ── NEW: update fog controls on connection change ──
    });
}

// ============================================================
// ACTIONS
// ============================================================

export function addWhiteboardNote() {
    if (isLayerLocked(activeLayerId)) { showToast('This layer is locked', 'warning'); return; }
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

/**
 * Pins arbitrary text (e.g. a deck/Crown Spread draw from VTT chat) onto
 * the active sheet's Notes layer. Callable even if the Whiteboard module
 * has never been mounted this session — it defensively loads from saved
 * state first, same source of truth `render()` itself reads from — and
 * re-renders in place if the whiteboard happens to be visible right now.
 */
export function pinNoteToBoard(content) {
    if (!content) return;
    if (!state.sheets || state.sheets.length === 0) {
        loadWhiteboardData();
    }
    if (isLayerLocked('notes')) {
        showToast('Notes layer is locked on the active sheet', 'warning');
        return;
    }

    let x = 60, y = 60;
    const containerEl = document.getElementById('whiteboard-canvas-container');
    if (containerEl) {
        const rect = containerEl.getBoundingClientRect();
        x = rect.width / 2 - 60 + (Math.random() * 40 - 20);
        y = rect.height / 2 - 40 + (Math.random() * 40 - 20);
    } else {
        // Not mounted — jitter slightly so repeated pins don't stack exactly.
        x += Math.random() * 30;
        y += Math.random() * 30;
    }

    state.notes.push({
        id: 'note-' + Date.now(),
        x, y,
        content: `🃏 ${content}`,
        layerId: 'notes'
    });
    saveWhiteboardData();
    if (container) {
        renderOverlay();
        updateStats();
    }
    showToast('📌 Pinned to Whiteboard', 'success');
}

export function uploadWhiteboardImage() {
    if (isLayerLocked(activeLayerId)) { showToast('This layer is locked', 'warning'); return; }
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
    if (!confirm('Delete everything (drawings, notes, images, tokens) on this sheet?')) return;
    pushUndoSnapshot();
    state.drawings = [];
    state.notes = [];
    state.images = [];
    state.gridCombat.tokens = [];
    // ── NEW: Clear fog data too ──
    if (state.gridCombat.fogOfWar) {
        state.gridCombat.fogOfWar.revealed = [];
        state.gridCombat.fogOfWar.lightSources = [];
        state.gridCombat.fogOfWar.walls = [];
    }
    if (konrehActive) toggleKonreh();
    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    updateStats();
    renderVttCombatToolbar(); // ── NEW ──
    showToast('🗑️ Whiteboard cleared', 'info');
}

export function exportWhiteboard() {
    if (!canvas) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = '#12121a';
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
        setTimeout(() => {
            initCanvas(); restoreDrawings(); renderOverlay(); updateStats();
            renderSheetTabs(); renderLayersPanel(); renderVttCombatToolbar();
        }, 100);
    }
}

export function onDeactivate() {
    saveWhiteboardData();
    cleanupWebSocketListeners();
    // ── NEW: Remove gmRoleUpdate listener ──
    if (gmRoleHandler) {
        document.removeEventListener('gmRoleUpdate', gmRoleHandler);
        gmRoleHandler = null;
    }
    // ── NEW: Unsubscribe from voice speaking-state updates ──
    if (voiceUnsub) {
        voiceUnsub();
        voiceUnsub = null;
    }
}

export function refresh() {
    loadWhiteboardData();
    initCanvas();
    restoreDrawings();
    renderOverlay();
    updateStats();
    setupWebSocketSync();
    renderSheetTabs();
    renderLayersPanel();
    renderVttCombatToolbar(); // ── NEW ──
}

export function destroy() {
    container = null;
    saveWhiteboardData();
    cleanupWebSocketListeners();
    // ── NEW: Remove gmRoleUpdate listener ──
    if (gmRoleHandler) {
        document.removeEventListener('gmRoleUpdate', gmRoleHandler);
        gmRoleHandler = null;
    }
    // ── NEW: Unsubscribe from voice speaking-state updates ──
    if (voiceUnsub) {
        voiceUnsub();
        voiceUnsub = null;
    }
}

export default {
    render, destroy, onActivate, onDeactivate, refresh,
    loadWhiteboardData, saveWhiteboardData, forceSync,
    addWhiteboardNote, uploadWhiteboardImage, toggleGridCombat, addGridToken, clearGridTokens,
    addSheet, renameSheet, duplicateSheet, deleteSheet,
    undo, redo, togglePlayerView, pinNoteToBoard, toggleTableMode
};
