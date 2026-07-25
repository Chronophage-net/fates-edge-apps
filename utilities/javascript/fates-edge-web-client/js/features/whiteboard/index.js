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
 * - WebSocket sync for real-time collaboration
 * - Grid combat mode with tactical overlays (ZoC, Flanking, Drag & Drop)
 * - Fog of War: manual reveal/hide, token vision, line-of-sight raycasting,
 *   dynamic light sources, darkness slider, LoS walls — GM-gated
 * - Token Enhancements: speaking glow (voice-integrated), custom avatar
 *   sprites, health bars, condition markers, size presets, name labels,
 *   sprite/iso render modes, double-click token editor
 * - Kon'reh Board Game integration
 * - Records movements to media manifest for VOD creators
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
import { getLiveCombatants, isTrackerOpen, setTrackerRangeByName } from '../encounters/combat.js';

// ============================================================
// CONSTANTS
// ============================================================

const GRID_TYPES = { SQUARE: 'square', HEX: 'hex', ISOMETRIC: 'isometric' };
const GRID_COLORS = {
    SQUARE: 'rgba(212, 175, 55, 0.08)',
    HEX: 'rgba(212, 175, 55, 0.08)',
    ISOMETRIC: 'rgba(212, 175, 55, 0.08)'
};
const DEFAULT_LAYER_DEFS = [
    { id: 'background', name: 'Background',    isGM: false },
    { id: 'drawing',     name: 'Drawing',       isGM: false },
    { id: 'tokens',      name: 'Tokens & Grid', isGM: false },
    { id: 'notes',       name: 'Notes',         isGM: false },
    { id: 'gm',          name: 'GM Layer',      isGM: true  },
];
const MAX_UNDO_HISTORY = 50;
const FOG_TOOLS = new Set(['fog-reveal', 'fog-hide', 'fog-wall', 'fog-light']);
const SHAPE_TOOLS = new Set(['line', 'rectangle', 'circle', 'arrow']);

// ✨ NEW: Token size presets — radius is a fraction of cellSize
const TOKEN_SIZES = {
    small:  { radius: 0.25, label: '🐭 Small' },
    medium: { radius: 0.40, label: '🧑 Medium' },
    large:  { radius: 0.55, label: '🧌 Large' },
    huge:   { radius: 0.70, label: '🐉 Huge' },
};

// ✨ NEW: Condition marker icons (emoji-based for zero-asset rendering)
const CONDITION_ICONS = {
    prone: '📴', poisoned: '🤢', bleeding: '🩸', stunned: '💫',
    frightened: '😨', restrained: '🔗', invisible: '👻', blessed: '✨',
    burning: '🔥', frozen: '🧊', marked: '🎯', shielded: '🛡️',
};

// ============================================================
// STATE
// ============================================================

let container = null, canvas = null, ctx = null;
let isDrawing = false, currentTool = 'pen';
let currentColor = '#d4af37', currentSize = 3, currentOpacity = 1;
let lastX = 0, lastY = 0;

let state = {
    sheets: [], activeSheetId: null,
    drawings: [], notes: [], images: [],
    gridCombat: null, settings: null, layers: null,
};

let activeLayerId = 'drawing';
let playerViewActive = false;
const undoHistory = new Map();
let activeNoteId = null, selectedImage = null;
let wsListeners = new Map();
let isSyncing = false, isOfflineMode = false, gridCombatActive = false;
let isDraggingToken = false, draggedToken = null, tokenStartPos = null;
let rulerStart = null, rulerEnd = null;
let isDraggingObject = false, draggedObject = null, draggedObjectType = null;
let konrehGame = null, konrehActive = false;

// Fog state (existing)
let vttRole = null;
let fogWallStart = null;
let isDraggingLight = false, draggedLight = null;
let gmRoleHandler = null;

// ✨ NEW: Voice integration — tracks which client names are currently speaking
let voiceUnsubscribe = null;
let speakingClients = new Set(); // lowercased names of actively-speaking voice clients

// ✨ NEW: Avatar image cache — maps data-URL/URL → HTMLImageElement
let avatarCache = new Map();

// ✨ NEW: Animation loop for pulsing speaking-glow (only runs while someone is speaking)
let animationFrameId = null;
let lastAnimFrame = 0;

// ✨ NEW: Token edit panel state
let editingToken = null;

// ============================================================
// SHEETS
// ============================================================

function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultLayers() {
    return DEFAULT_LAYER_DEFS.map((def, i) => ({
        id: def.id, name: def.name, order: i,
        visible: true, locked: false, opacity: 1, isGM: def.isGM,
    }));
}

function createDefaultFogOfWar() {
    return {
        enabled: false, mode: 'manual', revealed: [],
        darkness: 0.85, lightSources: [], walls: [],
    };
}

function createDefaultGridCombat() {
    return {
        enabled: false, gridType: 'square', cellSize: 40,
        showCoordinates: true, showZones: false,
        tokens: [], linkedEncounterId: null,
        fogOfWar: createDefaultFogOfWar(),
        tokenMode: 'circle',  // ✨ NEW: 'circle' | 'sprite' | 'iso'
        showNames: false,     // ✨ NEW: show full token name labels
    };
}

function createDefaultSettings() {
    return {
        gridSnap: false, gridSize: 40,
        backgroundColor: 'var(--bg2)', gridType: 'square', showGrid: true
    };
}

function createDefaultSheet(name) {
    return {
        id: makeId('sheet'), name: name || 'Sheet 1',
        drawings: [], notes: [], images: [],
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
    if (!sheet.gridCombat.fogOfWar) sheet.gridCombat.fogOfWar = createDefaultFogOfWar();
    else sheet.gridCombat.fogOfWar = { ...createDefaultFogOfWar(), ...sheet.gridCombat.fogOfWar };

    for (const d of sheet.drawings) if (!d.layerId) d.layerId = 'drawing';
    for (const n of sheet.notes) if (!n.layerId) n.layerId = 'notes';
    for (const im of sheet.images) if (!im.layerId) im.layerId = 'background';
    for (const t of sheet.gridCombat.tokens) {
        if (!t.layerId) t.layerId = 'tokens';
        if (t.vision === undefined) t.vision = 0;
        // ✨ NEW: backfill enhanced token fields on old saves
        if (t.size === undefined) t.size = 'medium';
        if (!t.conditions) t.conditions = [];
        if (t.maxHarm === undefined) t.maxHarm = 0;
        if (t.avatar === undefined) t.avatar = null;
    }
    return sheet;
}

function getActiveSheet() {
    let sheet = state.sheets.find(s => s.id === state.activeSheetId);
    if (!sheet) { sheet = state.sheets[0]; state.activeSheetId = sheet ? sheet.id : null; }
    return sheet;
}

function syncActiveSheetRefs() {
    const sheet = getActiveSheet();
    if (!sheet) return;
    state.drawings = sheet.drawings; state.notes = sheet.notes;
    state.images = sheet.images; state.gridCombat = sheet.gridCombat;
    state.settings = sheet.settings; state.layers = sheet.layers;
    gridCombatActive = !!sheet.gridCombat.enabled;
    if (!state.layers.some(l => l.id === activeLayerId))
        activeLayerId = state.layers[0]?.id || 'drawing';
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
    closeTokenEditPanel(); // ✨ NEW
    stopAnimationLoop();   // ✨ NEW
    state.activeSheetId = sheetId;
    syncActiveSheetRefs();
    initCanvas(); restoreDrawings(); renderOverlay();
    renderSheetTabs(); renderLayersPanel(); updateStats();
    renderVttCombatToolbar();
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
    sheet.name = name; saveWhiteboardData(); renderSheetTabs();
}

export function duplicateSheet(sheetId) {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const copy = JSON.parse(JSON.stringify(sheet));
    copy.id = makeId('sheet'); copy.name = `${sheet.name} (copy)`;
    const idx = state.sheets.findIndex(s => s.id === sheetId);
    state.sheets.splice(idx + 1, 0, copy);
    saveWhiteboardData(); switchToSheet(copy.id);
    showToast(`📄 Duplicated "${sheet.name}"`, 'success');
}

export function deleteSheet(sheetId) {
    if (state.sheets.length <= 1) { showToast('Cannot delete the only sheet', 'error'); return; }
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
        initCanvas(); restoreDrawings(); renderOverlay();
        renderLayersPanel(); updateStats(); renderVttCombatToolbar();
    }
    saveWhiteboardData(); renderSheetTabs();
    showToast('🗑️ Sheet deleted', 'info');
}

function renderSheetTabs() {
    const bar = document.getElementById('whiteboard-sheet-tabs');
    if (!bar) return;
    bar.innerHTML = state.sheets.map(s => `
        <span class="wb-sheet-tab ${s.id === state.activeSheetId ? 'active' : ''}" data-sheet-id="${s.id}"
              style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px 6px 0 0;cursor:pointer;font-size:0.78rem;margin-right:2px;
                     background:${s.id === state.activeSheetId ? 'var(--panel-2, #24242e)' : 'transparent'};
                     border:1px solid var(--border); border-bottom:${s.id === state.activeSheetId ? 'none' : '1px solid var(--border)'};
                     color:${s.id === state.activeSheetId ? 'var(--gold)' : 'var(--text3)'};">
            <span class="wb-sheet-tab-name">${escHtml(s.name)}</span>
            <button class="wb-sheet-rename" data-sheet-id="${s.id}" title="Rename" style="background:none;border:none;color:inherit;cursor:pointer;font-size:0.7rem;">✏️</button>
            <button class="wb-sheet-dup" data-sheet-id="${s.id}" title="Duplicate" style="background:none;border:none;color:inherit;cursor:pointer;font-size:0.7rem;">⧉</button>
            <button class="wb-sheet-del" data-sheet-id="${s.id}" title="Delete" style="background:none;border:none;color:inherit;cursor:pointer;font-size:0.7rem;">✕</button>
        </span>
    `).join('') + `
        <button id="whiteboard-add-sheet" title="Add sheet" style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:6px 6px 0 0;cursor:pointer;font-size:0.85rem;background:transparent;border:1px dashed var(--border);color:var(--text3);">➕</button>
    `;
    bar.querySelectorAll('.wb-sheet-tab').forEach(tab => {
        tab.addEventListener('click', (e) => { if (e.target.closest('button')) return; switchToSheet(tab.dataset.sheetId); });
    });
    bar.querySelectorAll('.wb-sheet-rename').forEach(b => b.addEventListener('click', () => renameSheet(b.dataset.sheetId)));
    bar.querySelectorAll('.wb-sheet-dup').forEach(b => b.addEventListener('click', () => duplicateSheet(b.dataset.sheetId)));
    bar.querySelectorAll('.wb-sheet-del').forEach(b => b.addEventListener('click', () => deleteSheet(b.dataset.sheetId)));
    document.getElementById('whiteboard-add-sheet')?.addEventListener('click', addSheet);
}

// ============================================================
// LAYERS (unchanged from previous version)
// ============================================================

function getLayer(layerId) { return state.layers.find(l => l.id === layerId); }
function isLayerLocked(layerId) { const l = getLayer(layerId); return !!(l && l.locked); }
function isLayerVisibleNow(layer) { if (!layer.visible) return false; if (playerViewActive && layer.isGM) return false; return true; }
function layersInDrawOrder() { return [...state.layers].sort((a, b) => a.order - b.order); }

export function togglePlayerView() {
    playerViewActive = !playerViewActive;
    const btn = document.getElementById('whiteboard-player-view');
    if (btn) { btn.textContent = playerViewActive ? '👁️ Player View ON' : '👁️ Player View'; btn.className = playerViewActive ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-secondary'; }
    restoreDrawings(); renderOverlay(); renderLayersPanel();
    showToast(playerViewActive ? 'Previewing what players see (GM layers hidden)' : 'Player View off', 'info');
}

function addLayer() {
    const name = prompt('New layer name:', `Layer ${state.layers.length + 1}`);
    if (!name) return;
    const isGM = confirm('Should this be a GM-only layer (hidden in Player View)?');
    state.layers.push({ id: makeId('layer'), name, order: state.layers.length, visible: true, locked: false, opacity: 1, isGM });
    activeLayerId = state.layers[state.layers.length - 1].id;
    saveWhiteboardData(); renderLayersPanel();
    showToast(`🗂️ Layer "${name}" added`, 'success');
}

function deleteLayer(layerId) {
    if (DEFAULT_LAYER_DEFS.some(d => d.id === layerId)) { showToast('Cannot delete a default layer', 'error'); return; }
    const layer = getLayer(layerId); if (!layer) return;
    const hasContent = state.drawings.some(d => d.layerId === layerId) || state.notes.some(n => n.layerId === layerId) || state.images.some(im => im.layerId === layerId);
    if (hasContent && !confirm(`Layer "${layer.name}" has content. Delete layer and everything on it?`)) return;
    state.drawings = state.drawings.filter(d => d.layerId !== layerId);
    state.notes = state.notes.filter(n => n.layerId !== layerId);
    state.images = state.images.filter(im => im.layerId !== layerId);
    state.layers = state.layers.filter(l => l.id !== layerId);
    if (activeLayerId === layerId) activeLayerId = state.layers[0]?.id || 'drawing';
    saveWhiteboardData(); restoreDrawings(); renderOverlay(); renderLayersPanel(); updateStats();
}

function moveLayer(layerId, direction) {
    const ordered = layersInDrawOrder();
    const idx = ordered.findIndex(l => l.id === layerId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx], b = ordered[swapIdx];
    const tmp = a.order; a.order = b.order; b.order = tmp;
    saveWhiteboardData(); restoreDrawings(); renderOverlay(); renderLayersPanel();
}

function renderLayersPanel() {
    const panel = document.getElementById('whiteboard-layers-panel');
    if (!panel) return;
    const ordered = [...layersInDrawOrder()].reverse();
    panel.innerHTML = `
        <div class="flex-between mb-1"><span class="text-gold font-bold text-sm">🗂️ Layers</span>
        <button class="btn btn-xs btn-secondary" id="whiteboard-add-layer">➕ Add Layer</button></div>
        ${ordered.map((l, i) => `
            <div class="flex gap-1 flex-center" data-layer-row="${l.id}" style="padding:3px 4px;border-radius:4px;background:${l.id === activeLayerId ? 'rgba(212,175,55,0.12)' : 'transparent'};">
                <button class="wb-layer-active" data-layer-id="${l.id}" title="Set active" style="background:none;border:none;cursor:pointer;color:${l.id === activeLayerId ? 'var(--gold)' : 'var(--text3)'};">${l.id === activeLayerId ? '●' : '○'}</button>
                <button class="wb-layer-vis" data-layer-id="${l.id}" style="background:none;border:none;cursor:pointer;">${l.visible ? '👁️' : '🚫'}</button>
                <button class="wb-layer-lock" data-layer-id="${l.id}" style="background:none;border:none;cursor:pointer;">${l.locked ? '🔒' : '🔓'}</button>
                <span class="wb-layer-name text-sm" data-layer-id="${l.id}" style="flex:1;cursor:pointer;${l.isGM ? 'font-style:italic;color:#c47a7a;' : ''}">${escHtml(l.name)}${l.isGM ? ' 🛡️' : ''}</span>
                <input type="range" class="wb-layer-opacity" data-layer-id="${l.id}" min="0" max="1" step="0.05" value="${l.opacity}" style="width:56px;" />
                <button class="wb-layer-up" data-layer-id="${l.id}" style="background:none;border:none;cursor:pointer;" ${i === 0 ? 'disabled' : ''}>⬆️</button>
                <button class="wb-layer-down" data-layer-id="${l.id}" style="background:none;border:none;cursor:pointer;" ${i === ordered.length - 1 ? 'disabled' : ''}>⬇️</button>
                ${DEFAULT_LAYER_DEFS.some(d => d.id === l.id) ? '' : `<button class="wb-layer-del" data-layer-id="${l.id}" style="background:none;border:none;cursor:pointer;color:var(--red,#c45a5a);">✕</button>`}
            </div>`).join('')}`;
    panel.querySelector('#whiteboard-add-layer')?.addEventListener('click', addLayer);
    panel.querySelectorAll('.wb-layer-active').forEach(b => b.addEventListener('click', () => { activeLayerId = b.dataset.layerId; renderLayersPanel(); }));
    panel.querySelectorAll('.wb-layer-name').forEach(el => el.addEventListener('dblclick', () => { const layer = getLayer(el.dataset.layerId); if (!layer) return; const name = prompt('Rename layer:', layer.name); if (name) { layer.name = name; saveWhiteboardData(); renderLayersPanel(); } }));
    panel.querySelectorAll('.wb-layer-vis').forEach(b => b.addEventListener('click', () => { const layer = getLayer(b.dataset.layerId); if (layer) { layer.visible = !layer.visible; saveWhiteboardData(); restoreDrawings(); renderOverlay(); renderLayersPanel(); } }));
    panel.querySelectorAll('.wb-layer-lock').forEach(b => b.addEventListener('click', () => { const layer = getLayer(b.dataset.layerId); if (layer) { layer.locked = !layer.locked; saveWhiteboardData(); renderLayersPanel(); } }));
    panel.querySelectorAll('.wb-layer-opacity').forEach(inp => inp.addEventListener('input', () => { const layer = getLayer(inp.dataset.layerId); if (layer) { layer.opacity = parseFloat(inp.value); saveWhiteboardData(); restoreDrawings(); renderOverlay(); } }));
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
// UNDO / REDO (unchanged)
// ============================================================

function snapshotForUndo() {
    return { drawings: JSON.parse(JSON.stringify(state.drawings)), notes: JSON.parse(JSON.stringify(state.notes)), images: JSON.parse(JSON.stringify(state.images)) };
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
    state.drawings = prev.drawings; state.notes = prev.notes; state.images = prev.images;
    saveWhiteboardData(); restoreDrawings(); renderOverlay(); updateStats();
}
export function redo() {
    const h = getUndoHistory(state.activeSheetId);
    if (h.redo.length === 0) { showToast('Nothing to redo', 'info'); return; }
    h.undo.push(snapshotForUndo());
    const next = h.redo.pop();
    state.drawings = next.drawings; state.notes = next.notes; state.images = next.images;
    saveWhiteboardData(); restoreDrawings(); renderOverlay(); updateStats();
}

// ============================================================
// LOAD/SAVE (unchanged from previous version)
// ============================================================

function loadWhiteboardData() {
    const saved = getState(); const wb = saved.whiteboard; let migrationOccurred = false;
    if (wb && Array.isArray(wb.sheets) && wb.sheets.length > 0) {
        state.sheets = wb.sheets.map(normalizeSheet);
        state.activeSheetId = (wb.activeSheetId && state.sheets.some(s => s.id === wb.activeSheetId)) ? wb.activeSheetId : state.sheets[0].id;
    } else if (wb && (wb.drawings || wb.notes || wb.images || wb.settings || wb.gridCombat)) {
        const migrated = normalizeSheet({ name: 'Sheet 1', drawings: wb.drawings || [], notes: wb.notes || [], images: wb.images || [], gridCombat: wb.gridCombat || null, settings: wb.settings || null });
        state.sheets = [migrated]; state.activeSheetId = migrated.id; migrationOccurred = true;
    } else {
        const fresh = createDefaultSheet('Sheet 1'); state.sheets = [fresh]; state.activeSheetId = fresh.id;
    }
    syncActiveSheetRefs();
    if (migrationOccurred) {
        const s = getState(); if (!s.whiteboard) s.whiteboard = {};
        s.whiteboard.sheets = state.sheets; s.whiteboard.activeSheetId = state.activeSheetId;
        const sheet = getActiveSheet();
        if (sheet) { s.whiteboard.drawings = sheet.drawings; s.whiteboard.notes = sheet.notes; s.whiteboard.images = sheet.images; s.whiteboard.settings = sheet.settings; s.whiteboard.gridCombat = sheet.gridCombat; }
        saveState();
    }
}

function saveWhiteboardData() {
    const sheet = getActiveSheet();
    if (sheet) { sheet.drawings = state.drawings; sheet.notes = state.notes; sheet.images = state.images; sheet.gridCombat = state.gridCombat; sheet.settings = state.settings; sheet.layers = state.layers; }
    const saved = getState(); if (!saved.whiteboard) saved.whiteboard = {};
    saved.whiteboard.sheets = state.sheets; saved.whiteboard.activeSheetId = state.activeSheetId;
    if (sheet) { saved.whiteboard.drawings = sheet.drawings; saved.whiteboard.notes = sheet.notes; saved.whiteboard.images = sheet.images; saved.whiteboard.settings = sheet.settings; saved.whiteboard.gridCombat = sheet.gridCombat; }
    saveState();
    if (!isOfflineMode) broadcastWhiteboardUpdate();
}

// ============================================================
// WEBSOCKET SYNC (unchanged from previous version)
// ============================================================

function setupWebSocketSync() {
    cleanupWebSocketListeners();
    if (!isConnectedToServer()) { isOfflineMode = true; updateConnectionStatusUI(false); return; }
    isOfflineMode = false; updateConnectionStatusUI(true);
    function applyIncomingWhiteboard(incoming) {
        if (!incoming) return;
        if (Array.isArray(incoming.sheets) && incoming.sheets.length > 0) {
            state.sheets = incoming.sheets.map(normalizeSheet);
            state.activeSheetId = (incoming.activeSheetId && state.sheets.some(s => s.id === incoming.activeSheetId)) ? incoming.activeSheetId : state.sheets[0].id;
            syncActiveSheetRefs();
        } else {
            if (incoming.drawings) state.drawings = incoming.drawings;
            if (incoming.notes) state.notes = incoming.notes;
            if (incoming.images) state.images = incoming.images;
            if (incoming.settings) state.settings = { ...state.settings, ...incoming.settings };
            if (incoming.gridCombat) state.gridCombat = { ...state.gridCombat, ...incoming.gridCombat };
        }
    }
    const updateHandler = (data) => { if (isSyncing || !data || !data.whiteboard) return; applyIncomingWhiteboard(data.whiteboard); saveWhiteboardData(); refreshUI(); };
    onWSEvent('whiteboard-update', updateHandler); wsListeners.set('whiteboard-update', updateHandler);
    const roomStateHandler = (data) => { if (data && data.whiteboard) { isSyncing = true; applyIncomingWhiteboard(data.whiteboard); saveWhiteboardData(); refreshUI(); isSyncing = false; } };
    onWSEvent('room-state', roomStateHandler); wsListeners.set('room-state', roomStateHandler);
    const syncStateHandler = (data) => { if (isSyncing || !data || !data.state) return; applyIncomingWhiteboard(data.state); saveWhiteboardData(); refreshUI(); };
    onWSEvent('sync-state', syncStateHandler); wsListeners.set('sync-state', syncStateHandler);
}
function cleanupWebSocketListeners() { for (const [event, handler] of wsListeners) { try { offWSEvent(event, handler); } catch (e) {} } wsListeners.clear(); }
function broadcastWhiteboardUpdate() {
    if (isSyncing || isOfflineMode || !isConnectedToServer()) return;
    const sheet = getActiveSheet();
    try { sendMessage({ type: 'whiteboard-update', whiteboard: { sheets: state.sheets, activeSheetId: state.activeSheetId, drawings: sheet ? sheet.drawings : [], notes: sheet ? sheet.notes : [], images: sheet ? sheet.images : [], settings: sheet ? sheet.settings : state.settings, gridCombat: sheet ? sheet.gridCombat : state.gridCombat }, timestamp: Date.now() }); } catch (e) {}
}
function forceSync() {
    if (isOfflineMode || !isConnectedToServer()) { showToast('Cannot sync – you are offline', 'warning'); return; }
    broadcastWhiteboardUpdate(); sendMessage({ type: 'sync-request', target: 'whiteboard' });
    showToast('Whiteboard sync requested', 'success');
}
function refreshUI() {
    if (container) { renderSheetTabs(); renderLayersPanel(); initCanvas(); restoreDrawings(); renderOverlay(); updateStats(); renderVttCombatToolbar(); if (gridCombatActive) renderGridCombat(); }
}
function updateStats() { const stats = document.querySelector('.whiteboard-stats'); if (stats) stats.textContent = `${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images`; }
function updateConnectionStatusUI(connected) {
    const statusBadge = document.querySelector('.status-badge'); const statusText = document.querySelector('.status-text'); const overlay = document.getElementById('whiteboard-offline-overlay');
    if (statusBadge) { statusBadge.textContent = connected ? '🟢 Live' : '📡 Local'; statusBadge.className = `status-badge ${connected ? 'connected' : 'local'}`; }
    if (statusText) statusText.textContent = connected ? 'Real-time sync enabled' : 'Local Mode - No sync';
    if (overlay) overlay.style.display = connected ? 'none' : 'flex';
}

// ============================================================
// VTT ROLE GATING (unchanged from previous version)
// ============================================================

function isVttPlayer() { return isConnectedToServer() && vttRole !== 'gm'; }
function isVttGm() { return isConnectedToServer() && vttRole === 'gm'; }
function canControlFog() { return !isConnectedToServer() || isVttGm(); }

// ============================================================
// ✨ NEW: VOICE INTEGRATION — Speaking Glow
// ============================================================

/**
 * Subscribes to the voice module's `onVoiceClientsChanged` callback
 * (exported from features/vtt/voice.js).  When a client starts or
 * stops speaking, we update `speakingClients` (a Set of lowercased
 * names) and start/stop the animation loop that re-renders the canvas
 * to pulse the glowing aura on matching tokens.
 *
 * Matching: token.combatantName or token.label is compared
 * case-insensitively against the voice client's `name` field.
 */
async function setupVoiceIntegration() {
    try {
        const voice = await import('../vtt/voice.js');
        if (voice.onVoiceClientsChanged) {
            voiceUnsubscribe = voice.onVoiceClientsChanged((clients) => {
                speakingClients.clear();
                for (const c of clients) {
                    if (c.speaking && c.name) {
                        speakingClients.add(c.name.toLowerCase());
                    }
                }
                if (speakingClients.size > 0 && gridCombatActive) {
                    startAnimationLoop();
                } else {
                    stopAnimationLoop();
                    if (gridCombatActive) restoreDrawings();
                }
            });
        }
    } catch (e) {
        console.warn('[Whiteboard] Voice integration not available:', e.message);
    }
}

function cleanupVoiceIntegration() {
    if (voiceUnsubscribe) { voiceUnsubscribe(); voiceUnsubscribe = null; }
    stopAnimationLoop();
    speakingClients.clear();
}

/** Returns true if any voice client matching this token's name is speaking. */
function isTokenSpeaking(token) {
    if (speakingClients.size === 0) return false;
    const name = (token.combatantName || token.label || '').toLowerCase();
    return name.length > 0 && speakingClients.has(name);
}

/**
 * Lightweight animation loop — only runs while at least one voice
 * client is speaking AND combat mode is active.  Throttled to ~20fps
 * (50ms intervals) which is plenty for a smooth pulse.
 */
function startAnimationLoop() {
    if (animationFrameId) return;
    function loop(time) {
        if (!gridCombatActive || speakingClients.size === 0) {
            animationFrameId = null;
            // Final render to clear the glow
            restoreDrawings();
            return;
        }
        if (time - lastAnimFrame > 50) {
            lastAnimFrame = time;
            restoreDrawings();
        }
        animationFrameId = requestAnimationFrame(loop);
    }
    animationFrameId = requestAnimationFrame(loop);
}

function stopAnimationLoop() {
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
}

// ============================================================
// ✨ NEW: AVATAR IMAGE CACHE
// ============================================================

/**
 * Returns a cached HTMLImageElement for the given URL, or loads it
 * asynchronously and triggers a re-render once ready.
 */
function getAvatarImage(url) {
    if (!url) return null;
    if (avatarCache.has(url)) return avatarCache.get(url);
    const img = new Image();
    img.onload = () => { if (gridCombatActive) restoreDrawings(); };
    img.onerror = () => { console.warn('[Whiteboard] Avatar failed to load:', url.substring(0, 50)); };
    img.src = url;
    avatarCache.set(url, img);
    return img;
}

// ============================================================
// ✨ NEW: ANIMATION LOOP HELPERS
// ============================================================



// ============================================================
// TRACKER INTEGRATION (unchanged from previous version)
// ============================================================

function gridCellDistance(a, b, cellSize) { const dx = a.x - b.x, dy = a.y - b.y; return Math.round(Math.sqrt(dx * dx + dy * dy) / cellSize); }
function cellDistanceToRangeBand(cells) { if (cells <= 1) return 'close'; if (cells <= 6) return 'near'; if (cells <= 12) return 'far'; return 'absent'; }
function syncRangeFromGrid(movedToken) {
    if (!movedToken || !movedToken.combatantName) return;
    const cellSize = state.gridCombat.cellSize || 40;
    const others = (state.gridCombat.tokens || []).filter(t => t.id !== movedToken.id && t.combatantName && t.faction !== movedToken.faction);
    if (others.length === 0) return;
    let synced = 0;
    others.forEach(other => { const cells = gridCellDistance(movedToken, other, cellSize); const band = cellDistanceToRangeBand(cells); if (setTrackerRangeByName(movedToken.combatantName, other.combatantName, band)) synced++; });
    if (synced > 0) updateTrackerLinkStatusUI();
}

function importFromTracker() {
    if (!gridCombatActive) { showToast('Enable Grid Combat mode first.', 'warning'); return; }
    if (konrehActive) { showToast("Disable Kon'reh mode to import Tracker combatants.", 'error'); return; }
    if (isLayerLocked('tokens')) { showToast('Tokens & Grid layer is locked', 'warning'); return; }
    const encounters = (getState().encounters || []);
    if (encounters.length === 0) { showToast('No encounters found — create one in Encounters first.', 'warning'); return; }
    const options = encounters.map((e, i) => `${i + 1}. ${e.title}${isTrackerOpen(e.id) ? ' (tracker open)' : ''}`).join('\n');
    const choice = prompt(`Import combatants from which encounter?\n${options}\n\nEnter number:`);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= encounters.length) { showToast('Invalid selection', 'error'); return; }
    const encounter = encounters[idx];
    let source;
    if (isTrackerOpen(encounter.id)) { source = getLiveCombatants().map(c => ({ name: c.name, type: c.type })); }
    else {
        source = (encounter.adversaries || []).map(a => ({ name: a.name, type: 'adversary' }));
        if (source.length === 0) { showToast("That encounter has no adversaries, and its Tracker isn't open.", 'warning'); return; }
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
            label: c.name, faction: c.type === 'player' ? 'ally' : 'enemy', body: 3,
            x: col * cellSize, y: row * cellSize + cellSize * 2,
            color: c.type === 'player' ? '#5a8ab5' : '#c45a5a',
            harm: 0, fatigue: 0, tags: [], layerId: 'tokens',
            combatantName: c.name, combatantType: c.type,
            vision: c.type === 'player' ? 3 : 0,
            // ✨ NEW: enhanced token fields
            size: 'medium', maxHarm: c.type === 'player' ? 6 : 0,
            conditions: [], avatar: null,
        });
        added++;
    });
    if (added === 0) { showToast('All combatants from that encounter are already on the board.', 'info'); return; }
    state.gridCombat.linkedEncounterId = encounter.id;
    saveWhiteboardData(); restoreDrawings(); renderGridCombat(); updateTrackerLinkStatusUI();
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
// FOG OF WAR — RAYCASTING (unchanged from previous version)
// ============================================================

function raySegmentIntersect(rx, ry, rdx, rdy, x1, y1, x2, y2) {
    const sdx = x2 - x1, sdy = y2 - y1;
    const denom = rdx * sdy - rdy * sdx;
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((x1 - rx) * sdy - (y1 - ry) * sdx) / denom;
    const s = ((x1 - rx) * rdy - (y1 - ry) * rdx) / denom;
    if (t < 0 || s < 0 || s > 1) return null;
    return t;
}

function computeLineOfSight(cx, cy, maxRange, walls) {
    const numRays = 72; const points = [];
    for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        let hitDist = maxRange;
        for (const wall of walls) {
            const dist = raySegmentIntersect(cx, cy, dx, dy, wall.x1, wall.y1, wall.x2, wall.y2);
            if (dist !== null && dist < hitDist) hitDist = dist;
        }
        points.push({ x: cx + dx * hitDist, y: cy + dy * hitDist });
    }
    return points;
}

// ============================================================
// FOG OF WAR — RENDERING (unchanged from previous version)
// ============================================================

function drawFogOfWar(cellSize) {
    if (!ctx) return;
    const fog = state.gridCombat.fogOfWar;
    if (!fog || !fog.enabled) return;
    const isPlayerPerspective = isVttPlayer() || (playerViewActive && canControlFog());

    ctx.save();
    ctx.fillStyle = isPlayerPerspective ? `rgba(5, 5, 12, ${fog.darkness})` : `rgba(5, 5, 12, ${fog.darkness * 0.35})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    for (const r of (fog.revealed || [])) { ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    for (const light of (fog.lightSources || [])) {
        const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, Math.max(light.radius, 1));
        const alpha = light.intensity ?? 1;
        grad.addColorStop(0, `rgba(0,0,0,${alpha})`); grad.addColorStop(0.6, `rgba(0,0,0,${alpha * 0.5})`); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(light.x, light.y, Math.max(light.radius, 1), 0, Math.PI * 2); ctx.fill();
    }
    if (fog.mode === 'token-vision' || fog.mode === 'line-of-sight') {
        const tokens = state.gridCombat.tokens || [];
        for (const t of tokens) {
            if (t.faction !== 'ally' && t.faction !== 'player') continue;
            const visionCells = t.vision > 0 ? t.vision : 3;
            const visionRadius = cellSize * visionCells;
            const cx = t.x + cellSize / 2, cy = t.y + cellSize / 2;
            if (fog.mode === 'line-of-sight' && (fog.walls || []).length > 0) {
                const poly = computeLineOfSight(cx, cy, visionRadius, fog.walls || []);
                if (poly.length > 0) {
                    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, visionRadius);
                    grad.addColorStop(0, 'rgba(0,0,0,0.9)'); grad.addColorStop(0.8, 'rgba(0,0,0,0.4)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y);
                    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
                    ctx.closePath(); ctx.fill();
                }
            } else {
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, visionRadius);
                grad.addColorStop(0, 'rgba(0,0,0,0.9)'); grad.addColorStop(0.8, 'rgba(0,0,0,0.4)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, visionRadius, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
    ctx.restore();

    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const light of (fog.lightSources || [])) {
        const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, Math.max(light.radius, 1));
        grad.addColorStop(0, light.color || 'rgba(255, 220, 150, 0.25)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(light.x, light.y, Math.max(light.radius, 1), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (canControlFog() && !isPlayerPerspective) {
        ctx.save(); ctx.strokeStyle = 'rgba(196, 90, 90, 0.8)'; ctx.lineWidth = 2; ctx.setLineDash([8, 4]);
        for (const wall of (fog.walls || [])) { ctx.beginPath(); ctx.moveTo(wall.x1, wall.y1); ctx.lineTo(wall.x2, wall.y2); ctx.stroke(); }
        ctx.setLineDash([]); ctx.restore();
        ctx.save();
        for (const light of (fog.lightSources || [])) {
            ctx.beginPath(); ctx.arc(light.x, light.y, Math.max(light.radius, 1), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 220, 100, 0.15)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(light.x, light.y, 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 220, 100, 0.9)'; ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.restore();
    }
}

function paintFogCell(pos, cellSize, reveal) {
    const fog = state.gridCombat.fogOfWar; if (!fog) return;
    const cx = Math.floor(pos.x / cellSize) * cellSize, cy = Math.floor(pos.y / cellSize) * cellSize;
    if (reveal) {
        const exists = (fog.revealed || []).some(r => r.x === cx && r.y === cy && r.w === cellSize && r.h === cellSize);
        if (!exists) fog.revealed.push({ x: cx, y: cy, w: cellSize, h: cellSize });
    } else { fog.revealed = (fog.revealed || []).filter(r => !(r.x === cx && r.y === cy)); }
    restoreDrawings(); renderGridCombat();
}

function renderVttCombatToolbar() {
    const fog = state.gridCombat?.fogOfWar;
    const showFog = gridCombatActive && !konrehActive && canControlFog();
    const fogToggle = document.getElementById('whiteboard-fog-toggle');
    const fogControls = document.getElementById('whiteboard-fog-controls');
    const fogLegend = document.getElementById('fog-legend');
    if (fogToggle) { fogToggle.style.display = showFog ? 'inline-block' : 'none'; if (fog?.enabled) { fogToggle.textContent = '🌫️ Fog ON'; fogToggle.className = 'btn btn-sm btn-danger'; } else { fogToggle.textContent = '🌫️ Fog OFF'; fogToggle.className = 'btn btn-sm btn-secondary'; } }
    if (fogControls) fogControls.style.display = (showFog && fog?.enabled) ? 'flex' : 'none';
    if (fogLegend) fogLegend.style.display = (gridCombatActive && fog?.enabled) ? 'block' : 'none';
    if (!fog?.enabled && FOG_TOOLS.has(currentTool)) {
        currentTool = 'pen';
        document.querySelectorAll('.btn[data-tool]').forEach(b => b.className = 'btn btn-sm btn-secondary');
        const penBtn = document.querySelector('.btn[data-tool="pen"]'); if (penBtn) penBtn.className = 'btn btn-sm btn-gold';
        if (canvas) canvas.style.cursor = 'crosshair';
    }
}

// ============================================================
// ✨ NEW: ENHANCED TOKEN RENDERING
// ============================================================

/**
 * Draws a single token with all visual enhancements:
 *   1. Speaking glow (pulsing blue aura when the player is talking via voice)
 *   2. Flanked indicator (dashed gold rectangle)
 *   3. Token body (colored circle, avatar-clipped circle, or square sprite)
 *   4. Name label (if showNames is enabled)
 *   5. Health bar (if maxHarm > 0) or harm number
 *   6. Condition markers (emoji icons around the token)
 *   7. Vision radius indicator (if fog vision mode is active)
 */
function drawTokenEnhanced(token, cellSize) {
    if (!ctx) return;
    const sizeMult = TOKEN_SIZES[token.size]?.radius || 0.4;
    const radius = cellSize * sizeMult;
    const cx = token.x + cellSize / 2;
    const cy = token.y + cellSize / 2;
    const speaking = isTokenSpeaking(token);
    const time = Date.now();

    // ── 1. Speaking glow (pulsing blue aura) ──
    if (speaking) {
        const pulse = 0.5 + 0.5 * Math.sin(time / 200);
        const glowRadius = radius + 8 + pulse * 6;
        const glowGrad = ctx.createRadialGradient(cx, cy, radius, cx, cy, glowRadius);
        glowGrad.addColorStop(0, `rgba(107, 170, 255, ${0.3 + pulse * 0.3})`);
        glowGrad.addColorStop(1, 'rgba(107, 170, 255, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── 2. Flanked indicator ──
    const tacStatus = checkTacticalStatus(token);
    if (tacStatus.isFlanked && !konrehActive) {
        ctx.save();
        ctx.strokeStyle = '#e8c84a'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
        ctx.strokeRect(token.x - 3, token.y - 3, cellSize + 6, cellSize + 6);
        ctx.setLineDash([]); ctx.restore();
    }

    // ── 3. Token body ──
    const tokenMode = state.gridCombat.tokenMode || 'circle';
    const avatarImg = token.avatar ? getAvatarImage(token.avatar) : null;
    const hasAvatar = avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0;

    ctx.save();
    if (tokenMode === 'sprite' && hasAvatar) {
        // Sprite mode: draw image as a square sprite (not clipped to circle)
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
        const s = radius * 2;
        ctx.drawImage(avatarImg, cx - s/2, cy - s/2, s, s);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = token.color || '#d4af37'; ctx.lineWidth = 2;
        ctx.strokeRect(cx - s/2, cy - s/2, s, s);
    } else if (hasAvatar) {
        // Circle mode with avatar: clip image to circle
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        ctx.drawImage(avatarImg, cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.strokeStyle = token.color || '#d4af37'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    } else {
        // No avatar: colored circle with short label
        ctx.fillStyle = token.color || '#d4af37';
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.max(10, radius * 0.5)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(token.label?.substring(0, 3) || '?', cx, cy);
    }
    ctx.restore();

    // ── 4. Name label ──
    if (state.gridCombat.showNames && !konrehActive) {
        ctx.save();
        const labelText = token.label || '';
        ctx.font = '10px sans-serif';
        const tw = ctx.measureText(labelText).width;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cx - tw/2 - 3, cy + radius + 2, tw + 6, 13);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(labelText, cx, cy + radius + 4);
        ctx.restore();
    }

    // ── 5. Health bar or harm number ──
    if (token.maxHarm > 0 && !konrehActive) {
        drawHealthBar(token, cx, cy, radius);
    } else if (token.harm > 0 && !konrehActive) {
        ctx.save();
        ctx.fillStyle = '#d97a7a'; ctx.font = '9px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`❤${token.harm}`, cx, cy + radius + 2);
        ctx.restore();
    }

    // ── 6. Condition markers ──
    if (token.conditions && token.conditions.length > 0 && !konrehActive) {
        drawConditions(token, cx, cy, radius);
    }

    // ── 7. Vision radius indicator ──
    if (token.vision > 0 && !konrehActive) {
        const fog = state.gridCombat.fogOfWar;
        if (fog?.enabled && (fog.mode === 'token-vision' || fog.mode === 'line-of-sight')) {
            ctx.save();
            ctx.strokeStyle = 'rgba(107, 170, 122, 0.2)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.arc(cx, cy, cellSize * token.vision, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]); ctx.restore();
        }
    }
}

function drawHealthBar(token, cx, cy, radius) {
    if (!ctx) return;
    const barW = radius * 2, barH = 4, barY = cy + radius + 2;
    const ratio = Math.max(0, 1 - (token.harm / token.maxHarm));
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - barW/2, barY, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? '#6baa7a' : ratio > 0.25 ? '#d4af37' : '#c45a5a';
    ctx.fillRect(cx - barW/2, barY, barW * ratio, barH);
}

function drawConditions(token, cx, cy, radius) {
    if (!ctx) return;
    const conds = token.conditions || [];
    const maxIcons = 4;
    const shown = conds.slice(0, maxIcons);
    shown.forEach((cond, i) => {
        const angle = (i / maxIcons) * Math.PI * 2 - Math.PI / 2;
        const ir = radius + 8;
        const ix = cx + Math.cos(angle) * ir, iy = cy + Math.sin(angle) * ir;
        ctx.fillStyle = 'rgba(10, 10, 15, 0.8)';
        ctx.beginPath(); ctx.arc(ix, iy, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(CONDITION_ICONS[cond.toLowerCase()] || '❓', ix, iy);
    });
    if (conds.length > maxIcons) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+${conds.length - maxIcons}`, cx, cy + radius + 14);
    }
}

// ============================================================
// ✨ NEW: TOKEN EDIT PANEL
// ============================================================

/**
 * Opens a floating edit panel next to the double-clicked token.
 * The panel is appended to the canvas container (not the overlay)
 * so it survives `renderOverlay()` calls.
 */
function renderTokenEditPanel(token, cellSize) {
    closeTokenEditPanel();
    editingToken = token;
    const canvasContainer = document.getElementById('whiteboard-canvas-container');
    if (!canvasContainer) return;

    const panelX = Math.min(token.x + cellSize + 4, (canvasContainer.clientWidth || 800) - 230);
    const panelY = Math.max(4, token.y - 40);

    const panel = document.createElement('div');
    panel.id = 'token-edit-panel';
    panel.style.cssText = `
        position:absolute; left:${panelX}px; top:${panelY}px; z-index:30; pointer-events:auto;
        background:var(--bg2, #1a1a24); border:1px solid var(--gold, #d4af37);
        border-radius:8px; padding:0.6rem; min-width:210px; max-width:240px;
        box-shadow:0 4px 16px rgba(0,0,0,0.6); font-size:0.8rem; color:var(--text);
    `;
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
            <span style="font-weight:bold;color:var(--gold,#d4af37);">⚔️ Token Properties</span>
            <button id="tep-close" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:1rem;">✕</button>
        </div>
        <div style="margin-bottom:0.3rem;">
            <label style="display:block;font-size:0.7rem;color:var(--text3);margin-bottom:1px;">Label</label>
            <input id="tep-label" type="text" value="${escHtml(token.label || '')}"
                   style="width:100%;padding:0.2rem 0.4rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:0.8rem;box-sizing:border-box;" />
        </div>
        <div style="display:flex;gap:0.4rem;margin-bottom:0.3rem;">
            <div style="flex:1;">
                <label style="display:block;font-size:0.7rem;color:var(--text3);margin-bottom:1px;">Harm</label>
                <input id="tep-harm" type="number" value="${token.harm || 0}" min="0"
                       style="width:100%;padding:0.2rem 0.4rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:0.8rem;box-sizing:border-box;" />
            </div>
            <div style="flex:1;">
                <label style="display:block;font-size:0.7rem;color:var(--text3);margin-bottom:1px;">Max Harm</label>
                <input id="tep-maxharm" type="number" value="${token.maxHarm || 0}" min="0"
                       style="width:100%;padding:0.2rem 0.4rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:0.8rem;box-sizing:border-box;" />
            </div>
        </div>
        <div style="display:flex;gap:0.4rem;margin-bottom:0.3rem;">
            <div style="flex:1;">
                <label style="display:block;font-size:0.7rem;color:var(--text3);margin-bottom:1px;">Size</label>
                <select id="tep-size" style="width:100%;padding:0.2rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:0.8rem;box-sizing:border-box;">
                    <option value="small" ${token.size === 'small' ? 'selected' : ''}>🐭 Small</option>
                    <option value="medium" ${token.size === 'medium' || !token.size ? 'selected' : ''}>🧑 Medium</option>
                    <option value="large" ${token.size === 'large' ? 'selected' : ''}>🧌 Large</option>
                    <option value="huge" ${token.size === 'huge' ? 'selected' : ''}>🐉 Huge</option>
                </select>
            </div>
            <div style="flex:1;">
                <label style="display:block;font-size:0.7rem;color:var(--text3);margin-bottom:1px;">Vision</label>
                <input id="tep-vision" type="number" value="${token.vision || 0}" min="0"
                       style="width:100%;padding:0.2rem 0.4rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:0.8rem;box-sizing:border-box;" />
            </div>
        </div>
        <div style="margin-bottom:0.3rem;">
            <label style="display:block;font-size:0.7rem;color:var(--text3);margin-bottom:1px;">Conditions (comma-sep: prone,poisoned...)</label>
            <input id="tep-conditions" type="text" value="${escHtml((token.conditions || []).join(','))}" placeholder="prone,poisoned"
                   style="width:100%;padding:0.2rem 0.4rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:0.8rem;box-sizing:border-box;" />
        </div>
        ${token.avatar ? `<div style="margin-bottom:0.3rem;text-align:center;">
            <img src="${token.avatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid ${token.color || 'var(--gold)'};object-fit:cover;" />
        </div>` : ''}
        <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
            <button id="tep-avatar" class="btn btn-xs btn-secondary" style="font-size:0.75rem;">🖼️ Avatar</button>
            <button id="tep-save" class="btn btn-xs btn-gold" style="font-size:0.75rem;">💾 Save</button>
            <button id="tep-delete" class="btn btn-xs btn-danger" style="font-size:0.75rem;">🗑️ Delete</button>
        </div>
    `;
    canvasContainer.appendChild(panel);

    // Wire up panel buttons
    document.getElementById('tep-close')?.addEventListener('click', closeTokenEditPanel);
    document.getElementById('tep-save')?.addEventListener('click', () => {
        if (!editingToken) return;
        editingToken.label = document.getElementById('tep-label')?.value || editingToken.label;
        editingToken.harm = parseInt(document.getElementById('tep-harm')?.value) || 0;
        editingToken.maxHarm = parseInt(document.getElementById('tep-maxharm')?.value) || 0;
        editingToken.size = document.getElementById('tep-size')?.value || 'medium';
        editingToken.vision = parseInt(document.getElementById('tep-vision')?.value) || 0;
        const condStr = document.getElementById('tep-conditions')?.value || '';
        editingToken.conditions = condStr.split(',').map(c => c.trim().toLowerCase()).filter(c => c);
        saveWhiteboardData();
        restoreDrawings(); renderGridCombat();
        closeTokenEditPanel();
        showToast('Token updated', 'success');
    });
    document.getElementById('tep-avatar')?.addEventListener('click', () => {
        if (!editingToken) return;
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                editingToken.avatar = ev.target.result;
                const img = new Image(); img.src = ev.target.result; avatarCache.set(ev.target.result, img);
                saveWhiteboardData(); restoreDrawings(); renderGridCombat();
                renderTokenEditPanel(editingToken, state.gridCombat.cellSize || 40); // refresh panel to show avatar
                showToast('🖼️ Avatar uploaded', 'success');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });
    document.getElementById('tep-delete')?.addEventListener('click', () => {
        if (!editingToken) return;
        if (!confirm('Delete this token?')) return;
        state.gridCombat.tokens = state.gridCombat.tokens.filter(t => t.id !== editingToken.id);
        saveWhiteboardData(); restoreDrawings(); renderGridCombat();
        closeTokenEditPanel();
        showToast('Token deleted', 'info');
    });
}

function closeTokenEditPanel() {
    const panel = document.getElementById('token-edit-panel');
    if (panel) panel.remove();
    editingToken = null;
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
    if (btn) { btn.textContent = gridCombatActive ? '⚔️ Combat ON' : '⚔️ Combat OFF'; btn.className = gridCombatActive ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-secondary'; }
    if (addTokenBtn) addTokenBtn.style.display = gridCombatActive && !konrehActive ? 'inline-block' : 'none';
    if (importTrackerBtn) importTrackerBtn.style.display = gridCombatActive && !konrehActive ? 'inline-block' : 'none';
    if (!gridCombatActive && konrehActive) toggleKonreh();
    if (!gridCombatActive) { closeTokenEditPanel(); stopAnimationLoop(); } // ✨ NEW
    showToast(gridCombatActive ? '⚔️ Grid Combat Mode enabled' : 'Grid Combat disabled', gridCombatActive ? 'success' : 'info');
    restoreDrawings(); renderGridCombat(); renderVttCombatToolbar();
}

function renderGridCombat() {
    if (!ctx || !gridCombatActive) return;
    const gc = state.gridCombat; const cellSize = gc.cellSize || 40;
    const tokensLayer = getLayer('tokens');
    ctx.save(); ctx.globalAlpha = 0.3;
    if (gc.gridType === 'hex') drawHexGrid(cellSize);
    else if (gc.gridType === 'isometric') drawIsometricGrid(cellSize);
    else drawSquareGrid(cellSize);
    ctx.restore();
    if (gc.showCoordinates && !konrehActive) drawCoordinates(cellSize, gc.gridType);
    if (gc.showZones) drawZonesOfControl(cellSize, gc.gridType);
    if (!tokensLayer || isLayerVisibleNow(tokensLayer)) {
        ctx.save(); ctx.globalAlpha = tokensLayer ? tokensLayer.opacity : 1;
        drawTokens(cellSize, gc.gridType); ctx.restore();
    }
    if (konrehActive) drawKonrehBoardOverlay(cellSize);
    if (!konrehActive) drawFogOfWar(cellSize);
}

function drawKonrehBoardOverlay(cellSize) {
    if (!ctx) return; ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.8)'; ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, cellSize * 8, cellSize * 8);
    const mk = (x, y, label, color) => { ctx.fillStyle = color; ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x * cellSize + cellSize/2, y * cellSize + cellSize/2); };
    mk(0, 0, 'H1', '#4a90d9'); mk(7, 7, 'H2', '#d94a4a'); mk(0, 7, 'S', '#d4af37'); mk(7, 0, 'S', '#d4af37');
    ctx.strokeStyle = 'rgba(107, 170, 122, 0.8)'; ctx.lineWidth = 2;
    ctx.strokeRect(3 * cellSize, 3 * cellSize, cellSize * 2, cellSize * 2);
    ctx.restore();
}

function drawSquareGrid(cellSize) {
    if (!ctx) return; ctx.strokeStyle = GRID_COLORS.SQUARE; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += cellSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += cellSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
}
function drawHexGrid(cellSize) {
    if (!ctx) return; ctx.strokeStyle = GRID_COLORS.HEX; ctx.lineWidth = 1;
    const hh = cellSize * Math.sqrt(3), hw = cellSize * 2;
    for (let row = 0; row < canvas.height / hh + 2; row++) for (let col = 0; col < canvas.width / hw + 2; col++) {
        const x = col * hw + (row % 2) * cellSize, y = row * hh * 0.75;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); const hx = x + cellSize * Math.cos(a), hy = y + cellSize * Math.sin(a); if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy); }
        ctx.closePath(); ctx.stroke();
    }
}
function drawIsometricGrid(cellSize) {
    if (!ctx) return; ctx.strokeStyle = GRID_COLORS.ISOMETRIC; ctx.lineWidth = 1;
    const iw = cellSize * 2, ih = cellSize;
    for (let row = 0; row < canvas.height / ih + 2; row++) for (let col = 0; col < canvas.width / iw + 2; col++) {
        const x = col * iw + (row % 2) * cellSize, y = row * ih;
        ctx.beginPath(); ctx.moveTo(x, y + ih/2); ctx.lineTo(x + cellSize, y); ctx.lineTo(x + iw, y + ih/2); ctx.lineTo(x + cellSize, y + ih); ctx.closePath(); ctx.stroke();
    }
}
function drawCoordinates(cellSize, gridType) {
    if (!ctx) return; ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let col = 0;
    for (let x = cellSize/2; x < canvas.width; x += cellSize) { let row = 0; for (let y = cellSize/2; y < canvas.height; y += cellSize) { ctx.fillText(`${String.fromCharCode(65 + col)}${row + 1}`, x, y); row++; } col++; }
    ctx.restore();
}
function checkTacticalStatus(token) {
    const cellSize = state.gridCombat.cellSize || 40;
    const enemies = state.gridCombat.tokens.filter(t => t.faction !== token.faction && t.id !== token.id);
    const opp = [{ dx: -cellSize, dy: 0, ox: cellSize, oy: 0 }, { dx: 0, dy: -cellSize, ox: 0, oy: cellSize }];
    let isFlanked = false;
    for (const p of opp) { const e1 = enemies.find(e => Math.abs(e.x - (token.x + p.dx)) < 5 && Math.abs(e.y - (token.y + p.dy)) < 5); const e2 = enemies.find(e => Math.abs(e.x - (token.x + p.ox)) < 5 && Math.abs(e.y - (token.y + p.oy)) < 5); if (e1 && e2) { isFlanked = true; break; } }
    const inEnemyZoC = enemies.some(e => { const dx = Math.abs(e.x - token.x), dy = Math.abs(e.y - token.y); return (dx <= cellSize && dy <= cellSize); });
    return { isFlanked, inEnemyZoC };
}
function drawZonesOfControl(cellSize, gridType) {
    if (!ctx) return;
    for (const token of (state.gridCombat.tokens || [])) {
        ctx.save();
        ctx.strokeStyle = token.faction === 'enemy' ? 'rgba(196, 90, 90, 0.4)' : 'rgba(90, 138, 181, 0.4)';
        ctx.fillStyle = token.faction === 'enemy' ? 'rgba(196, 90, 90, 0.05)' : 'rgba(90, 138, 181, 0.05)';
        ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(token.x + cellSize/2, token.y + cellSize/2, cellSize * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
    }
}

// ✨ NEW: drawTokens now delegates to drawTokenEnhanced for each token
function drawTokens(cellSize, gridType) {
    if (!ctx) return;
    for (const token of (state.gridCombat.tokens || [])) {
        drawTokenEnhanced(token, cellSize);
    }
}

function addGridToken() {
    if (!gridCombatActive || konrehActive) { showToast('Disable Kon\'reh mode to add custom tokens', 'error'); return; }
    if (isLayerLocked('tokens')) { showToast('Tokens & Grid layer is locked', 'warning'); return; }
    const name = prompt('Token label:', 'Guard'); if (!name) return;
    const faction = prompt('Faction (ally or enemy):', 'enemy')?.toLowerCase() || 'enemy';
    const body = parseInt(prompt('Body Attribute (for movement):', '3')) || 3;
    const vision = parseInt(prompt('Vision radius in cells (0 = no vision, 3 = default for allies):', faction === 'ally' ? '3' : '0')) || 0;
    // ✨ NEW: Size and maxHarm prompts
    const sizeInput = prompt('Size (small/medium/large/huge):', 'medium')?.toLowerCase() || 'medium';
    const size = ['small', 'medium', 'large', 'huge'].includes(sizeInput) ? sizeInput : 'medium';
    const maxHarm = parseInt(prompt('Max Harm (0 = no health bar):', '0')) || 0;

    const containerEl = document.getElementById('whiteboard-canvas-container');
    const rect = containerEl.getBoundingClientRect();
    const cellSize = state.gridCombat.cellSize || 40;
    const x = Math.floor((rect.width / 2 - cellSize/2) / cellSize) * cellSize;
    const y = Math.floor((rect.height / 2 - cellSize/2) / cellSize) * cellSize;
    const colors = faction === 'ally' ? ['#5a8ab5', '#6baa7a', '#7aa8d0'] : ['#c45a5a', '#d48a5a', '#d97a7a'];
    if (!state.gridCombat.tokens) state.gridCombat.tokens = [];
    state.gridCombat.tokens.push({
        id: 'token-' + Date.now(), label: name, faction, body, x, y,
        color: colors[state.gridCombat.tokens.length % colors.length],
        harm: 0, fatigue: 0, tags: [], layerId: 'tokens',
        vision,
        // ✨ NEW: enhanced fields
        size, maxHarm, conditions: [], avatar: null,
    });
    saveWhiteboardData(); renderGridCombat();
    logRecordingEvent('token_add', `${name} (${faction}) added to the board.`);
    showToast(`⚔️ Token "${name}" added`, 'success');
}

function clearGridTokens() {
    if (!gridCombatActive) return;
    if (!confirm('Remove all tokens?')) return;
    state.gridCombat.tokens = [];
    closeTokenEditPanel(); // ✨ NEW
    saveWhiteboardData(); renderGridCombat();
    showToast('🗑️ All tokens removed', 'info');
}

// ============================================================
// KON'REH INTEGRATION (unchanged from previous version)
// ============================================================

function toggleKonreh() {
    if (!gridCombatActive) toggleGridCombat();
    if (konrehActive) {
        konrehActive = false; konrehGame = null;
        showToast("Kon'reh mode disabled", 'info');
        const btn = document.getElementById('whiteboard-konreh'); if (btn) btn.className = 'btn btn-sm btn-secondary';
        const addTokenBtn = document.getElementById('whiteboard-add-token'); if (addTokenBtn) addTokenBtn.style.display = 'inline-block';
        const importTrackerBtn = document.getElementById('whiteboard-import-tracker'); if (importTrackerBtn) importTrackerBtn.style.display = 'inline-block';
        const gridTypeSel = document.getElementById('whiteboard-grid-type'); if (gridTypeSel) gridTypeSel.style.display = '';
        renderVttCombatToolbar(); return;
    }
    konrehGame = new KonrehGame(); konrehActive = true;
    state.gridCombat.cellSize = 64; state.gridCombat.gridType = 'square';
    const btn = document.getElementById('whiteboard-konreh'); if (btn) btn.className = 'btn btn-sm btn-gold';
    const addTokenBtn = document.getElementById('whiteboard-add-token'); if (addTokenBtn) addTokenBtn.style.display = 'none';
    const importTrackerBtn = document.getElementById('whiteboard-import-tracker'); if (importTrackerBtn) importTrackerBtn.style.display = 'none';
    const gridTypeSel = document.getElementById('whiteboard-grid-type'); if (gridTypeSel) gridTypeSel.style.display = 'none';
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
            state.gridCombat.tokens.push({ id: p.id, label: p.type.charAt(0).toUpperCase(), faction: p.player === 1 ? 'ally' : 'enemy', x: p.x * cellSize, y: p.y * cellSize, color, harm: 0, fatigue: 0, tags: [], layerId: 'tokens', vision: 0, size: 'medium', maxHarm: 0, conditions: [], avatar: null });
        }
    }
    saveWhiteboardData(); restoreDrawings(); renderGridCombat(); renderVttCombatToolbar();
    showToast("🌀 Kon'reh Mode enabled! Drag pieces to play.", 'success');
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el; loadWhiteboardData();
    const isConnected = isConnectedToServer(); isOfflineMode = !isConnected;
    container.innerHTML = `
        <div class="whiteboard-modern-layout flex flex-col gap-2">
            <header class="flex-between">
                <div><h1 class="page-title">Campaign Whiteboard</h1><p class="page-sub">Draw, note, and plan your tactical encounters visually.</p></div>
                <div class="flex gap-1 flex-center">
                    <span class="status-badge badge ${isConnected ? 'badge-green' : 'badge-red'}">${isConnected ? '🟢 Live' : '📡 Local'}</span>
                    <span class="status-text text-muted text-sm">${isConnected ? 'Real-time sync' : 'Local only'}</span>
                </div>
            </header>
            <div id="whiteboard-offline-overlay" class="panel flex gap-2 flex-center" style="display:${isConnected ? 'none' : 'flex'}; border: 1px solid var(--orange);">
                <span style="font-size: 1.5rem;">📡</span>
                <div class="flex-1"><div class="text-gold font-bold">Local Mode</div><div class="text-muted text-sm">Whiteboard is saved locally. Connect to server for real-time collaboration.</div></div>
                <button class="btn btn-sm btn-primary" id="whiteboard-connect-btn">🔗 Connect</button>
            </div>
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
                    <label class="text-muted text-sm flex gap-1 flex-center"><input type="checkbox" id="whiteboard-grid" ${state.settings.gridSnap ? 'checked' : ''} style="width:auto;"/> Snap</label>
                    <button class="btn btn-sm ${gridCombatActive ? 'btn-danger' : 'btn-secondary'}" id="whiteboard-grid-combat">${gridCombatActive ? '⚔️ Combat ON' : '⚔️ Combat OFF'}</button>
                    <select id="whiteboard-grid-type" title="Grid type" style="${konrehActive ? 'display:none;' : ''}font-size:0.8rem;padding:0.25rem 0.3rem;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;">
                        <option value="square" ${state.gridCombat.gridType === 'square' ? 'selected' : ''}>◻️ Square</option>
                        <option value="hex" ${state.gridCombat.gridType === 'hex' ? 'selected' : ''}>⬡ Hex</option>
                        <option value="isometric" ${state.gridCombat.gridType === 'isometric' ? 'selected' : ''}>◇ Isometric</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-add-token" style="${gridCombatActive && !konrehActive ? '' : 'display:none;'}">🎯 Add Token</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-import-tracker" title="Import from Encounter Tracker" style="${gridCombatActive && !konrehActive ? '' : 'display:none;'}">🔗 Import Tracker</button>
                    <!-- ✨ NEW: Token render mode selector -->
                    <select id="whiteboard-token-mode" title="Token rendering mode" style="${gridCombatActive && !konrehActive ? '' : 'display:none;'}font-size:0.8rem;padding:0.25rem 0.3rem;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;">
                        <option value="circle" ${state.gridCombat.tokenMode === 'circle' ? 'selected' : ''}>⭕ Circle</option>
                        <option value="sprite" ${state.gridCombat.tokenMode === 'sprite' ? 'selected' : ''}>🖼️ Sprite</option>
                        <option value="iso" disabled>📐 Iso (Soon)</option>
                    </select>
                    <!-- ✨ NEW: Show name labels toggle -->
                    <label class="text-muted text-sm flex gap-1 flex-center" title="Show full token names">
                        <input type="checkbox" id="whiteboard-show-names" ${state.gridCombat.showNames ? 'checked' : ''} style="width:auto;"/> Names
                    </label>
                    <button class="btn btn-sm ${konrehActive ? 'btn-gold' : 'btn-secondary'}" id="whiteboard-konreh">🌀 Kon'reh</button>
                    <span id="whiteboard-tracker-link-status" class="text-muted text-sm"></span>
                </div>
                <div class="flex gap-1 flex-center">
                    <button class="btn btn-sm btn-secondary" id="whiteboard-toggle-layers" title="Layers">🗂️ Layers</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-player-view" title="Preview as a player">👁️ Player View</button>
                </div>
                <button class="btn btn-sm btn-secondary" id="whiteboard-fog-toggle" style="display:none;" title="Toggle Fog of War">🌫️ Fog OFF</button>
                <div class="flex gap-1 flex-center" id="whiteboard-fog-controls" style="display:none; flex-wrap:wrap;">
                    <select id="whiteboard-fog-mode" title="Fog mode" style="font-size:0.8rem;padding:0.25rem 0.3rem;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;">
                        <option value="manual">🖌️ Manual</option>
                        <option value="token-vision">👁️ Token Vision</option>
                        <option value="line-of-sight">📡 Line of Sight</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" data-tool="fog-reveal" title="Paint revealed areas">✨ Reveal</button>
                    <button class="btn btn-sm btn-secondary" data-tool="fog-hide" title="Hide areas">🌑 Hide</button>
                    <button class="btn btn-sm btn-secondary" data-tool="fog-wall" title="Draw LoS wall">🧱 Wall</button>
                    <button class="btn btn-sm btn-secondary" data-tool="fog-light" title="Place light source">💡 Light</button>
                    <button class="btn btn-sm btn-ghost" id="whiteboard-fog-clear" title="Clear all fog data">Clear Fog</button>
                    <label class="text-muted text-sm flex gap-1 flex-center" title="Darkness level">Dark <input type="range" id="whiteboard-fog-darkness" min="0" max="1" step="0.05" value="${state.gridCombat.fogOfWar?.darkness ?? 0.85}" style="width:50px;"/></label>
                </div>
            </div>
            <div class="panel" id="whiteboard-layers-panel" style="display:none; padding:0.5rem;"></div>
            <div id="whiteboard-sheet-tabs" style="display:flex; align-items:flex-end; padding-left:4px; margin-bottom:-1px; position:relative; z-index:2;"></div>
            <div class="panel relative overflow-hidden" id="whiteboard-canvas-container" style="height: 65vh; min-height: 400px; padding: 0;">
                <canvas id="whiteboard-canvas" style="width:100%;height:100%;display:block;cursor:crosshair;"></canvas>
                <div id="whiteboard-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></div>
                ${!isConnected ? `<div class="absolute flex-center" style="top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:0.1;font-size:4rem;font-weight:bold;color:var(--text3);white-space:nowrap;">LOCAL MODE</div>` : ''}
            </div>
            <div class="panel flex gap-1 flex-center">
                <button class="btn btn-sm btn-primary" id="whiteboard-add-note">📝 Add Note</button>
                <button class="btn btn-sm btn-secondary" id="whiteboard-upload-image">🖼️ Upload Map</button>
                <button class="btn btn-sm btn-ghost" id="whiteboard-clear-drawings">🧹 Clear Draw</button>
                <button class="btn btn-sm btn-ghost" id="whiteboard-clear" title="Clear All">🗑️ Clear All</button>
                <button class="btn btn-sm btn-gold" id="whiteboard-export" title="Export as Image">💾 Export</button>
                <button class="btn btn-sm btn-secondary" id="whiteboard-sync-btn" title="Force sync">🔄 Sync</button>
                <span class="text-muted whiteboard-stats text-sm flex-1 text-right">${state.drawings.length} drawings, ${state.notes.length} notes, ${state.images.length} images</span>
            </div>
            <div id="grid-combat-legend" style="position:absolute;bottom:10px;right:10px;background:rgba(10,10,15,0.8);padding:0.3rem 0.6rem;border-radius:var(--radius-sm);font-size:0.65rem;color:var(--text3);display:${gridCombatActive ? 'block' : 'none'};border:1px solid var(--border);pointer-events:none;z-index:20;">
                <div><span style="color:var(--red);">⬤</span> Enemy ZoC | <span style="color:var(--blue);">⬤</span> Ally ZoC</div>
                <div><span style="color:var(--gold);">▭</span> Flanked (Dominant)</div>
                <div id="fog-legend" style="display:none;"><span style="color:rgba(255,220,100,0.8);">💡</span> Light | <span style="color:rgba(196,90,90,0.8);">🧱</span> LoS Wall</div>
                <div><span style="color:rgba(107,170,255,0.8);">🔵</span> Speaking | <span style="color:#6baa7a;">━</span> Health</div>
            </div>
        </div>`;
    initCanvas(); renderOverlay(); attachEvents(); restoreDrawings();
    setupWebSocketSync(); updateConnectionStatusUI(isConnected);
    renderSheetTabs(); renderLayersPanel(); renderVttCombatToolbar();
    if (gridCombatActive) renderGridCombat();
}

// ============================================================
// CANVAS INIT (unchanged)
// ============================================================

function initCanvas() {
    canvas = document.getElementById('whiteboard-canvas'); if (!canvas) return;
    const containerEl = document.getElementById('whiteboard-canvas-container');
    const rect = containerEl.getBoundingClientRect();
    canvas.width = rect.width || 800; canvas.height = rect.height || 600;
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = currentColor; ctx.lineWidth = currentSize; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    restoreDrawings();
}
function drawGrid() {
    if (!ctx) return; const gs = state.settings.gridSize || 40; const gt = state.settings.gridType || 'square';
    if (gt === 'hex') drawHexGrid(gs * 1.5); else if (gt === 'isometric') drawIsometricGrid(gs);
    else { ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; for (let x = 0; x < canvas.width; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); } for (let y = 0; y < canvas.height; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); } }
}
function drawStroke(drawing) {
    if (!ctx || !drawing.points || drawing.points.length < 1) return;
    const layer = getLayer(drawing.layerId) || getLayer('drawing');
    ctx.save();
    ctx.globalAlpha = (layer ? layer.opacity : 1) * (typeof drawing.opacity === 'number' ? drawing.opacity : 1);
    ctx.strokeStyle = drawing.color || '#d4af37'; ctx.lineWidth = drawing.size || 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (drawing.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    if (drawing.tool === 'rectangle' && drawing.points.length >= 2) { const [a, b] = drawing.points; ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); }
    else if (drawing.tool === 'circle' && drawing.points.length >= 2) { const [a, b] = drawing.points; const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2; const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 0.01), Math.max(ry, 0.01), 0, 0, Math.PI * 2); ctx.stroke(); }
    else if (drawing.tool === 'arrow' && drawing.points.length >= 2) { drawArrow(drawing.points[0], drawing.points[1]); }
    else { ctx.beginPath(); ctx.moveTo(drawing.points[0].x, drawing.points[0].y); for (let i = 1; i < drawing.points.length; i++) ctx.lineTo(drawing.points[i].x, drawing.points[i].y); ctx.stroke(); }
    ctx.restore();
}
function drawArrow(start, end) {
    if (!ctx) return; const hl = Math.max(10, (ctx.lineWidth || 3) * 3); const a = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - hl * Math.cos(a - Math.PI/6), end.y - hl * Math.sin(a - Math.PI/6)); ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - hl * Math.cos(a + Math.PI/6), end.y - hl * Math.sin(a + Math.PI/6)); ctx.stroke();
}
function snapToGrid(x, y) { if (!state.settings.gridSnap && !konrehActive) return { x, y }; const gs = konrehActive ? (state.gridCombat.cellSize || 64) : (state.settings.gridSize || 40); return { x: Math.round(x / gs) * gs, y: Math.round(y / gs) * gs }; }

// ============================================================
// OVERLAY RENDERING (unchanged)
// ============================================================

function renderOverlay() {
    const overlay = document.getElementById('whiteboard-overlay'); if (!overlay) return;
    const canDrag = currentTool === 'select';
    let notesHtml = state.notes.map(note => {
        const layer = getLayer(note.layerId) || getLayer('notes'); if (layer && !isLayerVisibleNow(layer)) return '';
        const locked = layer && layer.locked; const opacity = layer ? layer.opacity : 1;
        return `<div class="glass" style="position:absolute;left:${note.x}px;top:${note.y}px;padding:0.4rem 0.6rem;border-radius:var(--radius-sm);min-width:80px;max-width:180px;cursor:${canDrag && !locked ? 'grab' : 'pointer'};z-index:10;color:var(--text);font-size:0.8rem;pointer-events:auto;border:1px solid var(--gold);opacity:${opacity};" ${canDrag && !locked ? `onmousedown="window.__wbStartDragNote('${note.id}', event)"` : ''}><div>${escHtml(note.content)}</div><div class="flex gap-1 mt-1"><button class="btn btn-xs btn-ghost" onclick="window.editWhiteboardNote('${note.id}')">✏️</button><button class="btn btn-xs btn-danger" onclick="window.deleteWhiteboardNote('${note.id}')">✕</button></div></div>`;
    }).join('');
    let imagesHtml = state.images.map(img => {
        const layer = getLayer(img.layerId) || getLayer('background'); if (layer && !isLayerVisibleNow(layer)) return '';
        const locked = layer && layer.locked; const opacity = layer ? layer.opacity : 1;
        return `<div style="position:absolute;left:${img.x}px;top:${img.y}px;cursor:${canDrag && !locked ? 'grab' : 'pointer'};z-index:5;pointer-events:auto;opacity:${opacity};" ${canDrag && !locked ? `onmousedown="window.__wbStartDragImage('${img.id}', event)"` : ''}><img src="${img.data}" style="max-width:250px;max-height:250px;border-radius:4px;display:block;border:1px solid var(--border);" draggable="false" /><button class="btn btn-xs btn-danger absolute" style="top:-8px;right:-8px;" onclick="window.deleteWhiteboardImage('${img.id}')">✕</button></div>`;
    }).join('');
    overlay.innerHTML = notesHtml + imagesHtml;
}

// ============================================================
// DRAWING FUNCTIONS (fog/light/token interactions)
// ============================================================

function startDrawing(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    const pos = snapToGrid(x, y);
    if (gridCombatActive) {
        const cellSize = state.gridCombat.cellSize || 40;
        const fog = state.gridCombat.fogOfWar;
        if (currentTool === 'select' && fog?.enabled && canControlFog()) {
            const clickedLight = (fog.lightSources || []).find(ls => { const dx = pos.x - ls.x, dy = pos.y - ls.y; return Math.sqrt(dx*dx + dy*dy) < 20; });
            if (clickedLight) {
                if (e.shiftKey) { fog.lightSources = fog.lightSources.filter(ls => ls !== clickedLight); saveWhiteboardData(); restoreDrawings(); renderGridCombat(); showToast('💡 Light source removed', 'info'); return; }
                isDraggingLight = true; draggedLight = clickedLight; canvas.style.cursor = 'grabbing'; return;
            }
        }
        if (FOG_TOOLS.has(currentTool)) {
            if (!canControlFog()) { showToast('Only GM can edit fog of war', 'warning'); return; }
            if (!fog) return;
            if (currentTool === 'fog-light') { fog.lightSources.push({ x: pos.x, y: pos.y, radius: cellSize * 4, color: 'rgba(255, 220, 150, 0.25)', intensity: 1 }); saveWhiteboardData(); restoreDrawings(); renderGridCombat(); showToast('💡 Light source placed (dbl-click to edit, Shift+click to delete)', 'success'); return; }
            if (currentTool === 'fog-wall') { isDrawing = true; fogWallStart = { x: pos.x, y: pos.y }; return; }
            if (currentTool === 'fog-reveal' || currentTool === 'fog-hide') { isDrawing = true; paintFogCell(pos, cellSize, currentTool === 'fog-reveal'); return; }
        }
        const clickedToken = state.gridCombat.tokens.find(t => pos.x >= t.x && pos.x <= t.x + cellSize && pos.y >= t.y && pos.y <= t.y + cellSize);
        if (clickedToken) {
            if (isLayerLocked(clickedToken.layerId || 'tokens')) { showToast('Tokens & Grid layer is locked', 'warning'); return; }
            isDraggingToken = true; draggedToken = clickedToken; tokenStartPos = { x: clickedToken.x, y: clickedToken.y }; canvas.style.cursor = 'grabbing'; return;
        }
    }
    if (currentTool === 'ruler') { isDrawing = true; rulerStart = pos; rulerEnd = pos; return; }
    if (currentTool === 'select' || currentTool === 'text') return;
    if (isLayerLocked(activeLayerId)) { showToast('This layer is locked', 'warning'); return; }
    isDrawing = true; lastX = pos.x; lastY = pos.y;
    if (currentTool === 'pen' || currentTool === 'eraser') {
        pushUndoSnapshot();
        const drawing = { id: 'draw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6), points: [{ x: pos.x, y: pos.y }], color: currentTool === 'eraser' ? '#000' : currentColor, size: currentTool === 'eraser' ? currentSize * 3 : currentSize, opacity: currentOpacity, tool: currentTool, layerId: activeLayerId, timestamp: Date.now() };
        state.drawings.push(drawing); drawStroke(drawing); saveWhiteboardData(); updateStats();
    } else if (SHAPE_TOOLS.has(currentTool)) { pushUndoSnapshot(); state._shapeStart = { x: pos.x, y: pos.y }; }
}

function draw(e) {
    if (!isDrawing && !isDraggingToken && !isDraggingLight) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    const pos = snapToGrid(x, y);
    if (isDraggingLight && draggedLight) { draggedLight.x = pos.x; draggedLight.y = pos.y; restoreDrawings(); renderGridCombat(); return; }
    if (isDraggingToken && draggedToken) {
        const cellSize = state.gridCombat.cellSize || 40;
        if (konrehActive && konrehGame) { const tx = Math.floor(pos.x / cellSize), ty = Math.floor(pos.y / cellSize); if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) { draggedToken.x = tx * cellSize; draggedToken.y = ty * cellSize; } }
        else { draggedToken.x = pos.x; draggedToken.y = pos.y; }
        restoreDrawings(); renderGridCombat(); return;
    }
    if (currentTool === 'ruler' && rulerStart) {
        rulerEnd = pos; restoreDrawings(); renderGridCombat();
        const cellSize = state.gridCombat.cellSize || 40; const cells = gridCellDistance(rulerStart, rulerEnd, cellSize); const feet = cells * 5;
        ctx.save(); ctx.strokeStyle = '#6baa7a'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(rulerStart.x, rulerStart.y); ctx.lineTo(rulerEnd.x, rulerEnd.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(10,10,15,0.9)'; ctx.fillRect(rulerEnd.x + 10, rulerEnd.y - 20, 80, 22); ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${cells} cells (${feet}ft)`, rulerEnd.x + 15, rulerEnd.y - 5); ctx.restore(); return;
    }
    if (currentTool === 'fog-wall' && isDrawing && fogWallStart) {
        restoreDrawings(); renderGridCombat();
        ctx.save(); ctx.strokeStyle = 'rgba(196, 90, 90, 0.8)'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(fogWallStart.x, fogWallStart.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); ctx.restore(); return;
    }
    if ((currentTool === 'fog-reveal' || currentTool === 'fog-hide') && isDrawing) { const cellSize = state.gridCombat.cellSize || 40; paintFogCell(pos, cellSize, currentTool === 'fog-reveal'); return; }
    if (currentTool === 'pen' || currentTool === 'eraser') { const drawing = state.drawings[state.drawings.length - 1]; if (drawing) { drawing.points.push({ x: pos.x, y: pos.y }); drawStroke(drawing); saveWhiteboardData(); } }
    else if (SHAPE_TOOLS.has(currentTool) && currentTool !== 'ruler') {
        restoreDrawings(); ctx.save(); ctx.strokeStyle = currentColor; ctx.lineWidth = currentSize; ctx.globalAlpha = currentOpacity;
        const start = state._shapeStart;
        if (start) { if (currentTool === 'line') { ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); } else if (currentTool === 'rectangle') { ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y); } else if (currentTool === 'circle') { const rx = Math.abs(pos.x - start.x)/2, ry = Math.abs(pos.y - start.y)/2; const cx = (start.x+pos.x)/2, cy = (start.y+pos.y)/2; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx,0.01), Math.max(ry,0.01), 0, 0, Math.PI*2); ctx.stroke(); } else if (currentTool === 'arrow') { drawArrow(start, pos); } }
        ctx.restore();
    }
}

function endDrawing(e) {
    if (isDraggingLight) { isDraggingLight = false; draggedLight = null; canvas.style.cursor = 'grab'; saveWhiteboardData(); return; }
    if (isDraggingToken) {
        if (draggedToken && tokenStartPos) {
            const cellSize = state.gridCombat.cellSize || 40;
            if (konrehActive && konrehGame) {
                const fromX = Math.floor(tokenStartPos.x/cellSize), fromY = Math.floor(tokenStartPos.y/cellSize), toX = Math.floor(draggedToken.x/cellSize), toY = Math.floor(draggedToken.y/cellSize);
                const validMoves = konrehGame.getValidMoves(draggedToken.id); const validMove = validMoves.find(m => m.x === toX && m.y === toY);
                if (validMove) { konrehGame.makeMove(draggedToken.id, validMove); if (validMove.capture) state.gridCombat.tokens = state.gridCombat.tokens.filter(t => t.id !== validMove.targetId); if (validMove.slideEnd) { draggedToken.x = validMove.slideEnd.x * cellSize; draggedToken.y = validMove.slideEnd.y * cellSize; } else { draggedToken.x = toX * cellSize; draggedToken.y = toY * cellSize; } logRecordingEvent('konreh_move', `Moved ${draggedToken.label} to (${toX}, ${toY}).`); showToast(`Valid Kon'reh Move`, 'success'); }
                else { draggedToken.x = tokenStartPos.x; draggedToken.y = tokenStartPos.y; showToast("Invalid Kon'reh move!", 'error'); }
                saveWhiteboardData(); restoreDrawings(); renderGridCombat();
                isDraggingToken = false; draggedToken = null; tokenStartPos = null; canvas.style.cursor = 'grab'; return;
            }
            const cellsMoved = gridCellDistance(draggedToken, tokenStartPos, cellSize);
            if (cellsMoved > 0) { logRecordingEvent('token_move', `${draggedToken.label} moved ${cellsMoved} cells (${cellsMoved * 5} ft).`); const tacStatus = checkTacticalStatus(draggedToken); if (tacStatus.isFlanked) { logRecordingEvent('tactical_event', `${draggedToken.label} is now FLANKED!`); showToast(`${draggedToken.label} is Flanked!`, 'warning'); } else if (tacStatus.inEnemyZoC) { logRecordingEvent('tactical_event', `${draggedToken.label} entered enemy ZoC.`); showToast(`${draggedToken.label} entered ZoC!`, 'warning'); } saveWhiteboardData(); }
            syncRangeFromGrid(draggedToken);
        }
        isDraggingToken = false; draggedToken = null; tokenStartPos = null; canvas.style.cursor = 'grab'; return;
    }
    if (currentTool === 'ruler' && rulerStart && rulerEnd) { const cellSize = state.gridCombat.cellSize || 40; const cells = gridCellDistance(rulerStart, rulerEnd, cellSize); logRecordingEvent('measurement', `GM measured ${cells} cells (${cells * 5} ft).`); isDrawing = false; rulerStart = null; rulerEnd = null; restoreDrawings(); renderGridCombat(); return; }
    if (currentTool === 'fog-wall' && isDrawing && fogWallStart) {
        const rect = canvas.getBoundingClientRect(); const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left; const y = (e.clientY || e.changedTouches?.[0]?.clientY || 0) - rect.top; const pos = snapToGrid(x, y);
        const dist = Math.sqrt((pos.x - fogWallStart.x)**2 + (pos.y - fogWallStart.y)**2);
        if (dist >= 5) { state.gridCombat.fogOfWar.walls.push({ x1: fogWallStart.x, y1: fogWallStart.y, x2: pos.x, y2: pos.y }); saveWhiteboardData(); showToast('🧱 LoS wall added', 'success'); }
        isDrawing = false; fogWallStart = null; restoreDrawings(); renderGridCombat(); return;
    }
    if ((currentTool === 'fog-reveal' || currentTool === 'fog-hide') && isDrawing) { isDrawing = false; saveWhiteboardData(); return; }
    if (!isDrawing) return; isDrawing = false;
    if (SHAPE_TOOLS.has(currentTool)) {
        const rect = canvas.getBoundingClientRect(); const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left; const y = (e.clientY || e.changedTouches?.[0]?.clientY || 0) - rect.top; const pos = snapToGrid(x, y); const start = state._shapeStart;
        if (start) { state.drawings.push({ id: 'draw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6), points: [{ x: start.x, y: start.y }, { x: pos.x, y: pos.y }], color: currentColor, size: currentSize, opacity: currentOpacity, tool: currentTool, layerId: activeLayerId, timestamp: Date.now() }); saveWhiteboardData(); restoreDrawings(); updateStats(); state._shapeStart = null; }
    }
}

function restoreDrawings() {
    if (!ctx) return;
    updateTrackerLinkStatusUI();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.settings.showGrid !== false && !gridCombatActive) drawGrid();
    for (const layer of layersInDrawOrder()) { if (!isLayerVisibleNow(layer)) continue; const onLayer = state.drawings.filter(d => (d.layerId || 'drawing') === layer.id); for (const d of onLayer) drawStroke(d); }
    if (gridCombatActive) renderGridCombat();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    document.getElementById('whiteboard-connect-btn')?.addEventListener('click', () => { import('../../core/websocket.js').then(ws => ws.default.initWebSocket()).catch(() => {}); });

    document.querySelectorAll('.btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn[data-tool]').forEach(b => b.className = 'btn btn-sm btn-secondary');
            btn.className = 'btn btn-sm btn-gold'; currentTool = btn.dataset.tool;
            if (canvas) canvas.style.cursor = currentTool === 'select' ? 'grab' : 'crosshair';
            renderOverlay();
        });
    });

    document.getElementById('whiteboard-color')?.addEventListener('input', (e) => currentColor = e.target.value);
    document.getElementById('whiteboard-size')?.addEventListener('input', (e) => currentSize = parseInt(e.target.value));
    document.getElementById('whiteboard-opacity')?.addEventListener('input', (e) => currentOpacity = parseFloat(e.target.value));
    document.getElementById('whiteboard-grid')?.addEventListener('change', (e) => { state.settings.gridSnap = e.target.checked; saveWhiteboardData(); });
    document.getElementById('whiteboard-grid-combat')?.addEventListener('click', toggleGridCombat);
    document.getElementById('whiteboard-add-token')?.addEventListener('click', addGridToken);
    document.getElementById('whiteboard-grid-type')?.addEventListener('change', (e) => { state.gridCombat.gridType = e.target.value; state.settings.gridType = e.target.value; saveWhiteboardData(); restoreDrawings(); renderGridCombat(); showToast(`Grid type: ${e.target.value}`, 'info'); });
    document.getElementById('whiteboard-import-tracker')?.addEventListener('click', importFromTracker);
    document.getElementById('whiteboard-konreh')?.addEventListener('click', toggleKonreh);
    document.getElementById('whiteboard-konreh')?.addEventListener('click', () => { openKonrehModal(); });
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

    // ✨ NEW: Token render mode selector
    document.getElementById('whiteboard-token-mode')?.addEventListener('change', (e) => {
        if (e.target.value === 'iso') { showToast('📐 Isometric sprites coming soon!', 'info'); e.target.value = state.gridCombat.tokenMode || 'circle'; return; }
        state.gridCombat.tokenMode = e.target.value; saveWhiteboardData(); restoreDrawings(); renderGridCombat();
    });

    // ✨ NEW: Show name labels toggle
    document.getElementById('whiteboard-show-names')?.addEventListener('change', (e) => {
        state.gridCombat.showNames = e.target.checked; saveWhiteboardData(); restoreDrawings(); renderGridCombat();
    });

    // Fog event listeners (from previous version)
    document.getElementById('whiteboard-fog-toggle')?.addEventListener('click', () => { const fog = state.gridCombat.fogOfWar; if (!fog) return; fog.enabled = !fog.enabled; saveWhiteboardData(); renderVttCombatToolbar(); restoreDrawings(); renderGridCombat(); showToast(fog.enabled ? '🌫️ Fog of War enabled' : '🌫️ Fog of War disabled', fog.enabled ? 'success' : 'info'); });
    document.getElementById('whiteboard-fog-mode')?.addEventListener('change', (e) => { if (!state.gridCombat.fogOfWar) return; state.gridCombat.fogOfWar.mode = e.target.value; saveWhiteboardData(); restoreDrawings(); renderGridCombat(); showToast(`Fog mode: ${e.target.value}`, 'info'); });
    document.getElementById('whiteboard-fog-darkness')?.addEventListener('input', (e) => { if (!state.gridCombat.fogOfWar) return; state.gridCombat.fogOfWar.darkness = parseFloat(e.target.value); });
    document.getElementById('whiteboard-fog-darkness')?.addEventListener('change', (e) => { if (!state.gridCombat.fogOfWar) return; state.gridCombat.fogOfWar.darkness = parseFloat(e.target.value); saveWhiteboardData(); });
    document.getElementById('whiteboard-fog-clear')?.addEventListener('click', () => { const fog = state.gridCombat.fogOfWar; if (!fog) return; if (!confirm('Clear all fog data?')) return; fog.revealed = []; fog.lightSources = []; fog.walls = []; saveWhiteboardData(); restoreDrawings(); renderGridCombat(); showToast('🌫️ Fog data cleared', 'info'); });

    // GM role listener (from previous version)
    if (gmRoleHandler) document.removeEventListener('gmRoleUpdate', gmRoleHandler);
    gmRoleHandler = (e) => { vttRole = e.detail?.role || null; if (gridCombatActive) { renderVttCombatToolbar(); restoreDrawings(); renderGridCombat(); } };
    document.addEventListener('gmRoleUpdate', gmRoleHandler);

    // ✨ NEW: Double-click handler — unified light source AND token editing
    if (canvas) {
        canvas.addEventListener('dblclick', (e) => {
            if (!gridCombatActive || currentTool !== 'select') return;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX || 0) - rect.left;
            const y = (e.clientY || 0) - rect.top;
            const cellSize = state.gridCombat.cellSize || 40;

            // 1. Light source edit (if fog enabled and can control)
            const fog = state.gridCombat.fogOfWar;
            if (fog?.enabled && canControlFog()) {
                const clickedLight = (fog.lightSources || []).find(ls => { const dx = x - ls.x, dy = y - ls.y; return Math.sqrt(dx*dx + dy*dy) < 20; });
                if (clickedLight) {
                    const radiusStr = prompt('Light radius (in cells):', String(Math.round(clickedLight.radius / cellSize)));
                    if (radiusStr !== null) { const cells = parseInt(radiusStr); if (!isNaN(cells) && cells > 0) clickedLight.radius = cells * cellSize; }
                    const colorOptions = ['rgba(255, 220, 150, 0.25)', 'rgba(150, 200, 255, 0.25)', 'rgba(150, 255, 150, 0.25)', 'rgba(255, 100, 100, 0.25)', 'rgba(255, 255, 255, 0.20)'];
                    const colorChoice = prompt('Light color:\n1. Warm (torch)\n2. Cool (magic)\n3. Green (witchlight)\n4. Red (alarm)\n5. White (daylight)\n\nEnter 1-5:', '1');
                    if (colorChoice) { const idx = Math.max(0, Math.min(4, parseInt(colorChoice) - 1)); if (!isNaN(idx)) clickedLight.color = colorOptions[idx]; }
                    const intensityStr = prompt('Intensity (0.1 to 1.0):', String(clickedLight.intensity ?? 1));
                    if (intensityStr !== null) { const val = parseFloat(intensityStr); if (!isNaN(val)) clickedLight.intensity = Math.max(0.1, Math.min(1, val)); }
                    saveWhiteboardData(); restoreDrawings(); renderGridCombat();
                    return;
                }
            }

            // ✨ NEW: 2. Token edit panel
            const clickedToken = (state.gridCombat.tokens || []).find(t =>
                x >= t.x && x <= t.x + cellSize && y >= t.y && y <= t.y + cellSize);
            if (clickedToken) {
                if (isLayerLocked(clickedToken.layerId || 'tokens')) { showToast('Tokens & Grid layer is locked', 'warning'); return; }
                renderTokenEditPanel(clickedToken, cellSize);
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

    window.editWhiteboardNote = (id) => { const note = state.notes.find(n => n.id === id); if (note) { if (isLayerLocked(note.layerId)) { showToast('This layer is locked', 'warning'); return; } const newContent = prompt('Edit note:', note.content); if (newContent !== null) { pushUndoSnapshot(); note.content = newContent; saveWhiteboardData(); renderOverlay(); } } };
    window.deleteWhiteboardNote = (id) => { const note = state.notes.find(n => n.id === id); if (note && isLayerLocked(note.layerId)) { showToast('This layer is locked', 'warning'); return; } pushUndoSnapshot(); state.notes = state.notes.filter(n => n.id !== id); saveWhiteboardData(); renderOverlay(); updateStats(); };
    window.deleteWhiteboardImage = (id) => { const img = state.images.find(i => i.id === id); if (img && isLayerLocked(img.layerId)) { showToast('This layer is locked', 'warning'); return; } pushUndoSnapshot(); state.images = state.images.filter(i => i.id !== id); saveWhiteboardData(); renderOverlay(); updateStats(); };
    window.__wbStartDragNote = (id, event) => {
        if (currentTool !== 'select') return; const note = state.notes.find(n => n.id === id); if (!note) return;
        if (isLayerLocked(note.layerId)) { showToast('This layer is locked', 'warning'); return; }
        event.stopPropagation(); pushUndoSnapshot(); isDraggingObject = true; draggedObject = note; draggedObjectType = 'note';
        const sx = event.clientX, sy = event.clientY, ox = note.x, oy = note.y;
        const onMove = (e) => { note.x = ox + (e.clientX - sx); note.y = oy + (e.clientY - sy); renderOverlay(); };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); isDraggingObject = false; draggedObject = null; draggedObjectType = null; saveWhiteboardData(); };
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    };
    window.__wbStartDragImage = (id, event) => {
        if (currentTool !== 'select') return; const img = state.images.find(i => i.id === id); if (!img) return;
        if (isLayerLocked(img.layerId)) { showToast('This layer is locked', 'warning'); return; }
        event.stopPropagation(); pushUndoSnapshot(); isDraggingObject = true; draggedObject = img; draggedObjectType = 'image';
        const sx = event.clientX, sy = event.clientY, ox = img.x, oy = img.y;
        const onMove = (e) => { img.x = ox + (e.clientX - sx); img.y = oy + (e.clientY - sy); renderOverlay(); };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); isDraggingObject = false; draggedObject = null; draggedObjectType = null; saveWhiteboardData(); };
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    };

    document.addEventListener('connection-change', (e) => {
        const connected = e.detail?.connected || false; isOfflineMode = !connected; updateConnectionStatusUI(connected);
        if (connected) { setupWebSocketSync(); showToast('🔄 Whiteboard reconnected and syncing', 'success'); } else { showToast('📡 Whiteboard in local mode', 'info'); }
        renderVttCombatToolbar();
    });

    // ✨ NEW: Setup voice integration for speaking glow
    setupVoiceIntegration();
}

// ============================================================
// ACTIONS (unchanged + token panel cleanup)
// ============================================================

export function addWhiteboardNote() {
    if (isLayerLocked(activeLayerId)) { showToast('This layer is locked', 'warning'); return; }
    const content = prompt('Note content:', 'New note'); if (!content) return;
    const containerEl = document.getElementById('whiteboard-canvas-container'); const rect = containerEl.getBoundingClientRect();
    pushUndoSnapshot(); state.notes.push({ id: 'note-' + Date.now(), x: rect.width/2 - 50, y: rect.height/2 - 50, content, layerId: activeLayerId });
    saveWhiteboardData(); renderOverlay(); updateStats();
}
export function uploadWhiteboardImage() {
    if (isLayerLocked(activeLayerId)) { showToast('This layer is locked', 'warning'); return; }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { const containerEl = document.getElementById('whiteboard-canvas-container'); const rect = containerEl.getBoundingClientRect(); pushUndoSnapshot(); state.images.push({ id: 'img-' + Date.now(), x: rect.width/2 - 100, y: rect.height/2 - 100, data: ev.target.result, layerId: activeLayerId }); saveWhiteboardData(); renderOverlay(); updateStats(); showToast('🖼️ Image uploaded', 'success'); }; reader.readAsDataURL(file); };
    input.click();
}
export function clearWhiteboardDrawings() { if (!confirm('Clear all drawings only?')) return; pushUndoSnapshot(); state.drawings = []; saveWhiteboardData(); restoreDrawings(); updateStats(); }
export function clearWhiteboardAll() {
    if (!confirm('Delete everything (drawings, notes, images, tokens) on this sheet?')) return;
    pushUndoSnapshot(); state.drawings = []; state.notes = []; state.images = []; state.gridCombat.tokens = [];
    closeTokenEditPanel(); // ✨ NEW
    if (state.gridCombat.fogOfWar) { state.gridCombat.fogOfWar.revealed = []; state.gridCombat.fogOfWar.lightSources = []; state.gridCombat.fogOfWar.walls = []; }
    if (konrehActive) toggleKonreh();
    saveWhiteboardData(); restoreDrawings(); renderOverlay(); updateStats(); renderVttCombatToolbar();
    showToast('🗑️ Whiteboard cleared', 'info');
}
export function exportWhiteboard() {
    if (!canvas) return; const tc = document.createElement('canvas'); tc.width = canvas.width; tc.height = canvas.height;
    const tctx = tc.getContext('2d'); tctx.fillStyle = '#12121a'; tctx.fillRect(0, 0, tc.width, tc.height); tctx.drawImage(canvas, 0, 0);
    const link = document.createElement('a'); link.download = 'whiteboard-' + Date.now() + '.png'; link.href = tc.toDataURL('image/png'); link.click();
    showToast('💾 Whiteboard exported', 'success');
}

// ============================================================
// LIFECYCLE
// ============================================================

export function onActivate() {
    loadWhiteboardData(); setupWebSocketSync();
    if (container) { setTimeout(() => { initCanvas(); restoreDrawings(); renderOverlay(); updateStats(); renderSheetTabs(); renderLayersPanel(); renderVttCombatToolbar(); }, 100); }
    // ✨ NEW: re-establish voice integration
    setupVoiceIntegration();
}
export function onDeactivate() {
    saveWhiteboardData(); cleanupWebSocketListeners(); cleanupVoiceIntegration(); // ✨ NEW
    if (gmRoleHandler) { document.removeEventListener('gmRoleUpdate', gmRoleHandler); gmRoleHandler = null; }
    closeTokenEditPanel(); // ✨ NEW
}
export function refresh() {
    loadWhiteboardData(); initCanvas(); restoreDrawings(); renderOverlay(); updateStats();
    setupWebSocketSync(); renderSheetTabs(); renderLayersPanel(); renderVttCombatToolbar();
}
export function destroy() {
    container = null; saveWhiteboardData(); cleanupWebSocketListeners(); cleanupVoiceIntegration(); // ✨ NEW
    if (gmRoleHandler) { document.removeEventListener('gmRoleUpdate', gmRoleHandler); gmRoleHandler = null; }
    closeTokenEditPanel(); stopAnimationLoop(); // ✨ NEW
}

export default {
    render, destroy, onActivate, onDeactivate, refresh,
    loadWhiteboardData, saveWhiteboardData, forceSync,
    addWhiteboardNote, uploadWhiteboardImage, toggleGridCombat, addGridToken, clearGridTokens,
    addSheet, renameSheet, duplicateSheet, deleteSheet,
    undo, redo, togglePlayerView
};