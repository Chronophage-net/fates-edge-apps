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
import { openKonrehModal } from './kon-reh.js';

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

// Default layer stack for every sheet, bottom to top. `isGM` layers are
// hidden whenever "Player View" is toggled on. `id` values for these five
// are fixed so tokens/drawings/etc. created before this feature existed can
// be assigned a sensible default layer during migration.
const DEFAULT_LAYER_DEFS = [
    { id: 'background', name: 'Background',      isGM: false },
    { id: 'drawing',     name: 'Drawing',         isGM: false },
    { id: 'tokens',      name: 'Tokens & Grid',   isGM: false },
    { id: 'notes',       name: 'Notes',           isGM: false },
    { id: 'gm',          name: 'GM Layer',        isGM: true  },
];

const MAX_UNDO_HISTORY = 50;

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

// `state.sheets` is the source of truth; `state.drawings` / `.notes` /
// `.images` / `.gridCombat` / `.settings` / `.layers` are convenience
// references that always point at the ACTIVE sheet's data (kept in sync
// via `syncActiveSheetRefs()`), so all the existing logic in this file that
// reads/writes those fields keeps working completely unchanged.
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

// Per-sheet undo/redo history, keyed by sheet id. Kept out of `state` (and
// therefore never persisted) since undo history shouldn't survive a reload.
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

// Dragging for notes/images (new) — separate from token dragging above.
let isDraggingObject = false;
let draggedObject = null;
let draggedObjectType = null; // 'note' | 'image'

let konrehGame = null;
let konrehActive = false;

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

function createDefaultGridCombat() {
    return {
        enabled: false,
        gridType: 'square',
        cellSize: 40,
        showCoordinates: true,
        showZones: false,
        tokens: []
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

// Fills in anything missing on a sheet loaded from storage (old saves, or a
// partially-formed sheet) so nothing crashes and nothing silently vanishes.
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

    // Backfill layerId on anything created before layers existed, so old
    // content stays visible under the new default layers.
    for (const d of sheet.drawings) if (!d.layerId) d.layerId = 'drawing';
    for (const n of sheet.notes) if (!n.layerId) n.layerId = 'notes';
    for (const im of sheet.images) if (!im.layerId) im.layerId = 'background';
    for (const t of sheet.gridCombat.tokens) if (!t.layerId) t.layerId = 'tokens';

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

// Point the convenience top-level refs at the active sheet's own data.
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
    saveWhiteboardData(); // flush edits on the sheet we're leaving
    if (konrehActive) toggleKonreh(); // don't carry a live Kon'reh session across sheets
    state.activeSheetId = sheetId;
    syncActiveSheetRefs();
    initCanvas();
    restoreDrawings();
    renderOverlay();
    renderSheetTabs();
    renderLayersPanel();
    updateStats();
    saveWhiteboardData();
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
            if (e.target.closest('button')) return; // let the ✏️/⧉/✕ buttons handle themselves
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
    const ordered = [...layersInDrawOrder()].reverse(); // show topmost layer first, like most layer UIs

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
        // Legacy flat format from before Sheets/Layers existed.
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
        // Write the migrated shape back to local storage right away, so a
        // user who only ever VIEWS the whiteboard (never draws anything)
        // still ends up on the new format rather than re-migrating forever
        // from stale flat data. Deliberately skips broadcastWhiteboardUpdate
        // — this is a local one-time format upgrade, not a user edit, and
        // shouldn't compete with a concurrent peer's state on load.
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
        // Propagate the convenience refs back in case any call site reassigned
        // them (e.g. `state.notes = state.notes.filter(...)`) rather than
        // mutating in place.
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
    // Legacy mirror: anything reading the old flat shape directly still
    // sees sensible (active-sheet) data.
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

    // Accepts either the new multi-sheet shape or the legacy flat shape
    // (from a peer that hasn't updated yet), and applies it consistently.
    function applyIncomingWhiteboard(incoming) {
        if (!incoming) return;
        if (Array.isArray(incoming.sheets) && incoming.sheets.length > 0) {
            state.sheets = incoming.sheets.map(normalizeSheet);
            state.activeSheetId = (incoming.activeSheetId && state.sheets.some(s => s.id === incoming.activeSheetId))
                ? incoming.activeSheetId
                : state.sheets[0].id;
            syncActiveSheetRefs();
        } else {
            // Legacy flat update — apply it to the currently active sheet.
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
                // New shape (source of truth going forward):
                sheets: state.sheets,
                activeSheetId: state.activeSheetId,
                // Legacy flat mirror (active sheet), for any peer still on
                // the previous version:
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
        addTokenBtn.style.display = gridCombatActive && !konrehActive ? 'inline-block' : 'none';
    }
    
    if (!gridCombatActive && konrehActive) {
        toggleKonreh(); // Turn off Kon'reh if grid combat is disabled
    }
    
    showToast(gridCombatActive ? '⚔️ Grid Combat Mode enabled' : 'Grid Combat disabled', gridCombatActive ? 'success' : 'info');
    restoreDrawings();
    renderGridCombat();
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
    
    if (gc.showCoordinates && !konrehActive) drawCoordinates(cellSize, gc.gridType); // Hide standard coords in Kon'reh to avoid clutter
    if (gc.showZones) drawZonesOfControl(cellSize, gc.gridType);
    
    if (!tokensLayer || isLayerVisibleNow(tokensLayer)) {
        ctx.save();
        ctx.globalAlpha = tokensLayer ? tokensLayer.opacity : 1;
        drawTokens(cellSize, gc.gridType);
        ctx.restore();
    }
    
    if (konrehActive) drawKonrehBoardOverlay(cellSize);
}

function drawKonrehBoardOverlay(cellSize) {
    if (!ctx) return;
    ctx.save();
    
    // Highlight the 8x8 board bounds
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, cellSize * 8, cellSize * 8);
    
    // Highlight Apexes and Sanctums
    const drawApexMarker = (x, y, label, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x * cellSize + cellSize/2, y * cellSize + cellSize/2);
    };
    
    drawApexMarker(0, 0, 'H1', '#4a90d9'); // P1 Home
    drawApexMarker(7, 7, 'H2', '#d94a4a'); // P2 Home
    drawApexMarker(0, 7, 'S', '#d4af37');  // Sanctum
    drawApexMarker(7, 0, 'S', '#d4af37');  // Sanctum
    
    // Highlight the Cross (Central Four)
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
        layerId: 'tokens'
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
                layerId: 'tokens'
            });
        }
    }
    saveWhiteboardData();
    restoreDrawings();
    renderGridCombat();
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
            <div class="panel flex gap-1 flex-center" style="padding: 0.5rem; flex-wrap: wrap;">
                <div class="flex gap-1">
                    <button class="btn btn-sm ${currentTool === 'pen' ? 'btn-gold' : 'btn-secondary'}" data-tool="pen">✏️</button>
                    <button class="btn btn-sm ${currentTool === 'eraser' ? 'btn-gold' : 'btn-secondary'}" data-tool="eraser">🧹</button>
                    <button class="btn btn-sm ${currentTool === 'line' ? 'btn-gold' : 'btn-secondary'}" data-tool="line">📏</button>
                    <button class="btn btn-sm ${currentTool === 'rectangle' ? 'btn-gold' : 'btn-secondary'}" data-tool="rectangle">▭</button>
                    <button class="btn btn-sm ${currentTool === 'circle' ? 'btn-gold' : 'btn-secondary'}" data-tool="circle" title="Circle/Ellipse">◯</button>
                    <button class="btn btn-sm ${currentTool === 'arrow' ? 'btn-gold' : 'btn-secondary'}" data-tool="arrow" title="Arrow">➜</button>
                    <button class="btn btn-sm ${currentTool === 'ruler' ? 'btn-gold' : 'btn-secondary'}" data-tool="ruler" title="Measure">📐</button>
                    <button class="btn btn-sm ${currentTool === 'select' ? 'btn-gold' : 'btn-secondary'}" data-tool="select" title="Select / Drag">👆</button>
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
                    <label class="text-muted text-sm flex gap-1 flex-center">
                        <input type="checkbox" id="whiteboard-grid" ${state.settings.gridSnap ? 'checked' : ''} style="width:auto;"/> Snap
                    </label>
                    <button class="btn btn-sm ${gridCombatActive ? 'btn-danger' : 'btn-secondary'}" id="whiteboard-grid-combat">
                        ${gridCombatActive ? '⚔️ Combat ON' : '⚔️ Combat OFF'}
                    </button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-add-token" style="${gridCombatActive && !konrehActive ? '' : 'display:none;'}">🎯 Add Token</button>
                    <button class="btn btn-sm ${konrehActive ? 'btn-gold' : 'btn-secondary'}" id="whiteboard-konreh">🌀 Kon'reh</button>
                </div>
                <div class="flex gap-1 flex-center">
                    <button class="btn btn-sm btn-secondary" id="whiteboard-toggle-layers" title="Layers">🗂️ Layers</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-player-view" title="Preview as a player (hides GM layers)">👁️ Player View</button>
                </div>
            </div>

            <!-- Layers panel (collapsible) -->
            <div class="panel" id="whiteboard-layers-panel" style="display:none; padding:0.5rem;"></div>

            <!-- Sheet tabs -->
            <div id="whiteboard-sheet-tabs" style="display:flex; align-items:flex-end; padding-left:4px; margin-bottom:-1px; position:relative; z-index:2;"></div>

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
    renderSheetTabs();
    renderLayersPanel();
    
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
    } else {
        ctx.beginPath();
        ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
        for (let i = 1; i < drawing.points.length; i++) {
            ctx.lineTo(drawing.points[i].x, drawing.points[i].y);
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

function snapToGrid(x, y) {
    if (!state.settings.gridSnap && !konrehActive) return { x, y };
    const gridSize = konrehActive ? (state.gridCombat.cellSize || 64) : (state.settings.gridSize || 40);
    return { x: Math.round(x / gridSize) * gridSize, y: Math.round(y / gridSize) * gridSize };
}

const SHAPE_TOOLS = new Set(['line', 'rectangle', 'circle', 'arrow']);

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

    if (currentTool === 'select' && gridCombatActive) {
        const cellSize = state.gridCombat.cellSize || 40;
        const clickedToken = state.gridCombat.tokens.find(t => 
            Math.abs(t.x - pos.x) < cellSize && Math.abs(t.y - pos.y) < cellSize
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
    if (!isDrawing && !isDraggingToken) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    const pos = snapToGrid(x, y);

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
        
        const dx = rulerEnd.x - rulerStart.x;
        const dy = rulerEnd.y - rulerStart.y;
        const distPixels = Math.sqrt(dx*dx + dy*dy);
        const cellSize = state.gridCombat.cellSize || 40;
        const cells = Math.round(distPixels / cellSize);
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
            }
        }
        ctx.restore();
    }
}

function endDrawing(e) {
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
    
    if (SHAPE_TOOLS.has(currentTool)) {
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
                opacity: currentOpacity,
                tool: currentTool,
                layerId: activeLayerId,
                timestamp: Date.now()
            });
            saveWhiteboardData();
            restoreDrawings();
            updateStats();
            state._shapeStart = null;
        }
    }
}

function restoreDrawings() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.settings.showGrid !== false) drawGrid();

    for (const layer of layersInDrawOrder()) {
        if (!isLayerVisibleNow(layer)) continue;
        const drawingsOnLayer = state.drawings.filter(d => (d.layerId || 'drawing') === layer.id);
        for (const d of drawingsOnLayer) drawStroke(d);
    }

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
            renderOverlay();
        });
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

    // New: dragging for notes/images (tokens already have their own drag path).
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
    if (konrehActive) toggleKonreh();
    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    updateStats();
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
        setTimeout(() => { initCanvas(); restoreDrawings(); renderOverlay(); updateStats(); renderSheetTabs(); renderLayersPanel(); }, 100);
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
    renderSheetTabs();
    renderLayersPanel();
}

export function destroy() {
    container = null;
    saveWhiteboardData();
    cleanupWebSocketListeners();
}

export default {
    render, destroy, onActivate, onDeactivate, refresh,
    loadWhiteboardData, saveWhiteboardData, forceSync,
    addWhiteboardNote, uploadWhiteboardImage, toggleGridCombat, addGridToken, clearGridTokens,
    addSheet, renameSheet, duplicateSheet, deleteSheet,
    undo, redo, togglePlayerView
};
