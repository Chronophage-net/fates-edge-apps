// js/features/whiteboard/index.js
/**
 * Public API for the Whiteboard feature.
 * All internal logic is split into modules under ./modules/
 */
import { render as renderUI, destroy as destroyUI, refresh as refreshUI } from './modules/ui.js';
import { onActivate, onDeactivate } from './modules/persistence.js';
import {
    loadWhiteboardData,
    saveWhiteboardData,
    forceSync,
    addWhiteboardNote,
    uploadWhiteboardImage,
    toggleGridCombat,
    addGridToken,
    clearGridTokens,
    addSheet,
    renameSheet,
    duplicateSheet,
    deleteSheet,
    undo,
    redo,
    togglePlayerView,
    pinNoteToBoard,
    toggleTableMode
} from './modules/ui.js'; // ui re-exports these actions

// Re-export everything the old index.js used to export
export {
    renderUI as render,
    destroyUI as destroy,
    onActivate,
    onDeactivate,
    refreshUI as refresh,
    loadWhiteboardData,
    saveWhiteboardData,
    forceSync,
    addWhiteboardNote,
    uploadWhiteboardImage,
    toggleGridCombat,
    addGridToken,
    clearGridTokens,
    addSheet,
    renameSheet,
    duplicateSheet,
    deleteSheet,
    undo,
    redo,
    togglePlayerView,
    pinNoteToBoard,
    toggleTableMode
};

export default {
    render: renderUI,
    destroy: destroyUI,
    onActivate,
    onDeactivate,
    refresh: refreshUI,
    loadWhiteboardData,
    saveWhiteboardData,
    forceSync,
    addWhiteboardNote,
    uploadWhiteboardImage,
    toggleGridCombat,
    addGridToken,
    clearGridTokens,
    addSheet,
    renameSheet,
    duplicateSheet,
    deleteSheet,
    undo,
    redo,
    togglePlayerView,
    pinNoteToBoard,
    toggleTableMode
};
