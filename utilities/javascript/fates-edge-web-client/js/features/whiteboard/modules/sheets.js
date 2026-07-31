// modules/sheets.js
import { showToast } from '../../../components/Toast.js';
import { escHtml } from '../../../core/utils.js';
import { state, syncActiveSheetRefs, getActiveSheet, getLayer } from './state.js';
import { saveWhiteboardData } from './persistence.js';
import { renderLayersPanel } from './layers.js';
import { renderVttCombatToolbar } from './ui.js';
import { populateRoster } from './roster.js'; // will be imported later
import { initCanvas, restoreDrawings, renderOverlay, updateStats } from './renderer.js';
import { DEFAULT_LAYER_DEFS } from './constants.js';

function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function createDefaultLayers() {
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

export function createDefaultGridCombat() {
    return {
        enabled: false,
        gridType: 'square',
        cellSize: 40,
        showCoordinates: true,
        showZones: false,
        tokens: [],
        linkedEncounterId: null,
        fogOfWar: createDefaultFogOfWar(),
    };
}

function createDefaultFogOfWar() {
    return {
        enabled: false,
        mode: 'manual',
        revealed: [],
        darkness: 0.85,
        lightSources: [],
        walls: [],
    };
}

export function createDefaultSettings() {
    return {
        gridSnap: false,
        gridSize: 40,
        backgroundColor: 'var(--bg2)',
        gridType: 'square',
        showGrid: true
    };
}

export function createDefaultSheet(name) {
    return {
        id: makeId('sheet'),
        name: name || 'Sheet 1',
        drawings: [],
        notes: [],
        images: [],
        characterTokens: [],
        gridCombat: createDefaultGridCombat(),
        settings: createDefaultSettings(),
        layers: createDefaultLayers(),
    };
}

export function normalizeSheet(raw) {
    const sheet = {
        id: raw.id || makeId('sheet'),
        name: raw.name || 'Sheet',
        drawings: Array.isArray(raw.drawings) ? raw.drawings : [],
        notes: Array.isArray(raw.notes) ? raw.notes : [],
        images: Array.isArray(raw.images) ? raw.images : [],
        characterTokens: Array.isArray(raw.characterTokens) ? raw.characterTokens : [],
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
    }
    for (const ct of sheet.characterTokens) if (!ct.layerId) ct.layerId = 'characters';
    return sheet;
}

export function switchToSheet(sheetId) {
    if (sheetId === state.activeSheetId) return;
    if (!state.sheets.some(s => s.id === sheetId)) return;
    saveWhiteboardData();
    if (window.konrehActive) window.toggleKonreh?.();
    state.activeSheetId = sheetId;
    syncActiveSheetRefs();
    initCanvas();
    restoreDrawings();
    renderOverlay();
    renderSheetTabs();
    renderLayersPanel();
    updateStats();
    renderVttCombatToolbar();
    populateRoster();
    saveWhiteboardData();
    const panel = document.getElementById('whiteboard-lights-panel');
    if (panel) panel.style.display = 'none';
}

export function renderSheetTabs() {
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
    // undoHistory is managed in undo.js - we'll call a delete function from there.
    if (state.activeSheetId === sheetId) {
        const next = state.sheets[Math.max(0, idx - 1)];
        state.activeSheetId = next.id;
        syncActiveSheetRefs();
        initCanvas();
        restoreDrawings();
        renderOverlay();
        renderLayersPanel();
        updateStats();
        renderVttCombatToolbar();
        populateRoster();
    }
    saveWhiteboardData();
    renderSheetTabs();
    showToast('🗑️ Sheet deleted', 'info');
}
