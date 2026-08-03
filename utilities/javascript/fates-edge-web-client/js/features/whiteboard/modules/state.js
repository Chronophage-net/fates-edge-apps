// modules/state.js
import { DEFAULT_LAYER_DEFS } from './constants.js';

// --- Core State ---
export const state = {
    sheets: [],
    activeSheetId: null,
    drawings: [],
    notes: [],
    images: [],
    characterTokens: [],
    gridCombat: null,
    settings: null,
    layers: null,
};

// --- Runtime Refs ---
export let canvas = null;
export let ctx = null;
export let container = null;
export let playerViewActive = false;

// Single source of truth for the active tool. Both ui.js (event handling) and
// renderer.js (deciding whether overlay items like notes/images/character
// tokens should be draggable) need to agree on this, so it lives here instead
// of being duplicated separately in each module.
export let currentTool = 'pen';

// Same reasoning applies to Table Mode: combat.js needs to know whether it's
// active (to render bigger, more legible token labels on a shared tabletop
// display), but ui.js owns the toggle button. Sharing it here avoids a stale
// hardcoded copy living in combat.js.
export let tableModeActive = false;

export function setCanvas(c) { canvas = c; }
export function setCtx(c) { ctx = c; }
export function setContainer(c) { container = c; }
export function setPlayerViewActive(val) { playerViewActive = val; }
export function setCurrentTool(t) { currentTool = t; }
export function setTableModeActive(v) { tableModeActive = v; }

export function getActiveSheet() {
    let sheet = state.sheets.find(s => s.id === state.activeSheetId);
    if (!sheet) {
        sheet = state.sheets[0];
        state.activeSheetId = sheet ? sheet.id : null;
    }
    return sheet;
}

export function syncActiveSheetRefs() {
    const sheet = getActiveSheet();
    if (!sheet) return;
    state.drawings = sheet.drawings;
    state.notes = sheet.notes;
    state.images = sheet.images;
    state.characterTokens = sheet.characterTokens;
    state.gridCombat = sheet.gridCombat;
    state.settings = sheet.settings;
    state.layers = sheet.layers;
}

export function getLayer(layerId) {
    return state.layers.find(l => l.id === layerId);
}

export function isLayerLocked(layerId) {
    const l = getLayer(layerId);
    return !!(l && l.locked);
}

export function isLayerVisibleNow(layer) {
    if (!layer.visible) return false;
    if (playerViewActive && layer.isGM) return false;
    return true;
}

export function layersInDrawOrder() {
    return [...state.layers].sort((a, b) => a.order - b.order);
}
