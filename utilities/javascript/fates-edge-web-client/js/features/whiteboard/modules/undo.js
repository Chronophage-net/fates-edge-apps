// modules/undo.js
import { t as i18nText } from '@core/i18n.js';
import { state, getActiveSheet } from './state.js';
import { saveWhiteboardData } from './persistence.js';
import { restoreDrawings, renderOverlay, updateStats } from './renderer.js';
import { showToast } from '@components/Toast.js';

const MAX_UNDO_HISTORY = 50;
const undoHistory = new Map(); // key: sheetId, value: { undo: [], redo: [] }

function getUndoHistory(sheetId) {
    if (!undoHistory.has(sheetId)) undoHistory.set(sheetId, { undo: [], redo: [] });
    return undoHistory.get(sheetId);
}

function snapshotForUndo() {
    return {
        drawings: JSON.parse(JSON.stringify(state.drawings)),
        notes: JSON.parse(JSON.stringify(state.notes)),
        images: JSON.parse(JSON.stringify(state.images)),
        characterTokens: JSON.parse(JSON.stringify(state.characterTokens)),
    };
}

export function pushUndoSnapshot() {
    const h = getUndoHistory(state.activeSheetId);
    h.undo.push(snapshotForUndo());
    if (h.undo.length > MAX_UNDO_HISTORY) h.undo.shift();
    h.redo = [];
}

export function undo() {
    const h = getUndoHistory(state.activeSheetId);
    if (h.undo.length === 0) { showToast(i18nText("feature.whiteboard.modules.undo.nothingToUndo", null, "Nothing to undo"), 'info'); return; }
    h.redo.push(snapshotForUndo());
    const prev = h.undo.pop();
    state.drawings = prev.drawings;
    state.notes = prev.notes;
    state.images = prev.images;
    state.characterTokens = prev.characterTokens;
    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    updateStats();
}

export function redo() {
    const h = getUndoHistory(state.activeSheetId);
    if (h.redo.length === 0) { showToast(i18nText("feature.whiteboard.modules.undo.nothingToRedo", null, "Nothing to redo"), 'info'); return; }
    h.undo.push(snapshotForUndo());
    const next = h.redo.pop();
    state.drawings = next.drawings;
    state.notes = next.notes;
    state.images = next.images;
    state.characterTokens = next.characterTokens;
    saveWhiteboardData();
    restoreDrawings();
    renderOverlay();
    updateStats();
}

// Called when a sheet is deleted to clear its history
export function clearUndoHistoryForSheet(sheetId) {
    undoHistory.delete(sheetId);
}
