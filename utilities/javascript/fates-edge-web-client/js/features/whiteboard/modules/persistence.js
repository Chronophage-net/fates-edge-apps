// modules/persistence.js
import { getState, saveState as saveGlobalState } from '@core/state.js';
import { showToast } from '@components/Toast.js';
import { isConnectedToServer, onWSEvent, offWSEvent, sendMessage } from '@core/websocket.js';
import { state, syncActiveSheetRefs, getActiveSheet, setContainer } from './state.js';
import { normalizeSheet, createDefaultSheet } from './sheets.js';
import { refresh, renderVttCombatToolbar } from './ui.js';
import { isVttGm, setVttRole, isGridCombatActive, renderGridCombat } from './combat.js';
import { restoreDrawings } from './renderer.js';

let wsListeners = new Map();
let isSyncing = false;
let isOfflineMode = false;

// --- SECURITY: Validate incoming whiteboard payload ---
function isValidDrawing(d) {
    return d && typeof d.id === 'string' && Array.isArray(d.points) && typeof d.color === 'string';
}
function isValidNote(n) {
    return n && typeof n.id === 'string' && typeof n.content === 'string' && typeof n.x === 'number' && typeof n.y === 'number';
}
function isValidImage(i) {
    return i && typeof i.id === 'string' && typeof i.data === 'string' && i.data.length < 10_000_000; // 10MB limit
}
function isValidCharacterToken(t) {
    return t && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.imageData === 'string' && t.imageData.length < 2_000_000; // 2MB limit
}

function sanitizeIncomingWhiteboard(incoming) {
    if (!incoming || typeof incoming !== 'object') return null;
    const sanitized = {};
    if (Array.isArray(incoming.sheets)) {
        sanitized.sheets = incoming.sheets.map(s => {
            // Only take what we need, discard extra props
            return {
                id: typeof s.id === 'string' ? s.id : 'sheet-' + Date.now(),
                name: typeof s.name === 'string' ? s.name.substring(0, 100) : 'Sheet',
                drawings: Array.isArray(s.drawings) ? s.drawings.filter(isValidDrawing) : [],
                notes: Array.isArray(s.notes) ? s.notes.filter(isValidNote) : [],
                images: Array.isArray(s.images) ? s.images.filter(isValidImage) : [],
                characterTokens: Array.isArray(s.characterTokens) ? s.characterTokens.filter(isValidCharacterToken) : [],
                gridCombat: s.gridCombat || {},
                settings: s.settings || {},
                layers: Array.isArray(s.layers) ? s.layers : [],
            };
        });
    }
    if (Array.isArray(incoming.drawings)) sanitized.drawings = incoming.drawings.filter(isValidDrawing);
    if (Array.isArray(incoming.notes)) sanitized.notes = incoming.notes.filter(isValidNote);
    if (Array.isArray(incoming.images)) sanitized.images = incoming.images.filter(isValidImage);
    if (Array.isArray(incoming.characterTokens)) sanitized.characterTokens = incoming.characterTokens.filter(isValidCharacterToken);
    if (incoming.settings && typeof incoming.settings === 'object') sanitized.settings = incoming.settings;
    if (incoming.gridCombat && typeof incoming.gridCombat === 'object') sanitized.gridCombat = incoming.gridCombat;
    return sanitized;
}

function applyIncomingWhiteboard(incoming) {
    const sanitized = sanitizeIncomingWhiteboard(incoming);
    if (!sanitized) return;
    if (Array.isArray(sanitized.sheets) && sanitized.sheets.length > 0) {
        state.sheets = sanitized.sheets.map(normalizeSheet);
        state.activeSheetId = (sanitized.activeSheetId && state.sheets.some(s => s.id === sanitized.activeSheetId))
            ? sanitized.activeSheetId
            : state.sheets[0].id;
        syncActiveSheetRefs();
    } else {
        if (sanitized.drawings) state.drawings = sanitized.drawings;
        if (sanitized.notes) state.notes = sanitized.notes;
        if (sanitized.images) state.images = sanitized.images;
        if (sanitized.characterTokens) state.characterTokens = sanitized.characterTokens;
        if (sanitized.settings) state.settings = { ...state.settings, ...sanitized.settings };
        if (sanitized.gridCombat) state.gridCombat = { ...state.gridCombat, ...sanitized.gridCombat };
    }
}

// --- Load / Save ---
export function loadWhiteboardData() {
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
            characterTokens: wb.characterTokens || [],
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
    if (migrationOccurred) saveWhiteboardData();
}

export function saveWhiteboardData() {
    const sheet = getActiveSheet();
    if (sheet) {
        sheet.drawings = state.drawings;
        sheet.notes = state.notes;
        sheet.images = state.images;
        sheet.characterTokens = state.characterTokens;
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
        saved.whiteboard.characterTokens = sheet.characterTokens;
        saved.whiteboard.settings = sheet.settings;
        saved.whiteboard.gridCombat = sheet.gridCombat;
    }
    saveGlobalState();
    if (!isOfflineMode) broadcastWhiteboardUpdate();
}

// --- WebSocket ---
export function setupWebSocketSync() {
    cleanupWebSocketListeners();
    const connected = isConnectedToServer();
    if (!connected) { isOfflineMode = true; updateConnectionStatusUI(false); return; }
    isOfflineMode = false;
    updateConnectionStatusUI(true);

    const updateHandler = (data) => {
        if (isSyncing || !data || !data.whiteboard) return;
        applyIncomingWhiteboard(data.whiteboard);
        saveWhiteboardData();
        refresh();
    };
    onWSEvent('whiteboard-update', updateHandler);
    wsListeners.set('whiteboard-update', updateHandler);

    const roomStateHandler = (data) => {
        if (data && data.whiteboard) {
            isSyncing = true;
            applyIncomingWhiteboard(data.whiteboard);
            saveWhiteboardData();
            refresh();
            isSyncing = false;
        }
    };
    onWSEvent('room-state', roomStateHandler);
    wsListeners.set('room-state', roomStateHandler);

    const syncStateHandler = (data) => {
        if (isSyncing || !data || !data.state) return;
        applyIncomingWhiteboard(data.state);
        saveWhiteboardData();
        refresh();
    };
    onWSEvent('sync-state', syncStateHandler);
    wsListeners.set('sync-state', syncStateHandler);

    // Ping handler
    const pingHandler = (data) => {
        if (!data || data.sheetId !== state.activeSheetId) return;
        renderPingMarker(data.x, data.y);
    };
    onWSEvent('whiteboard-ping', pingHandler);
    wsListeners.set('whiteboard-ping', pingHandler);

    // GM role corrections from the server (e.g. it enforces a single GM per
    // room and reassigns someone). This is the real event — see combat.js
    // for why the whiteboard previously never learned the role at all.
    const gmRoleHandler = (data) => {
        setVttRole(data?.role || null);
        if (isGridCombatActive()) {
            renderVttCombatToolbar();
            restoreDrawings();
            renderGridCombat();
        }
    };
    onWSEvent('gm_role_update', gmRoleHandler);
    wsListeners.set('gm_role_update', gmRoleHandler);
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
                characterTokens: sheet ? sheet.characterTokens : [],
                settings: sheet ? sheet.settings : state.settings,
                gridCombat: sheet ? sheet.gridCombat : state.gridCombat
            },
            timestamp: Date.now()
        });
    } catch (e) {}
}

export function forceSync() {
    if (isOfflineMode || !isConnectedToServer()) {
        showToast('Cannot sync – you are offline', 'warning');
        return;
    }
    broadcastWhiteboardUpdate();
    sendMessage({ type: 'sync-request', target: 'whiteboard' });
    showToast('Whiteboard sync requested', 'success');
}

// Placeholder for updateConnectionStatusUI - will be imported from ui later
function updateConnectionStatusUI(connected) {
    // Implemented in ui.js
}

// Ping marker (needs ref to overlay, we'll move to renderer)
function renderPingMarker(x, y) {
    // Implementation moved to renderer.js
}

export function onActivate() { loadWhiteboardData(); setupWebSocketSync(); }
export function onDeactivate() { saveWhiteboardData(); cleanupWebSocketListeners(); }
