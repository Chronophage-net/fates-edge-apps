// modules/layers.js
import { state, getLayer, isLayerVisibleNow, layersInDrawOrder } from './state.js';
import { saveWhiteboardData } from './persistence.js';
import { restoreDrawings, renderOverlay, updateStats } from './renderer.js';
import { showToast } from '../../../components/Toast.js';
import { escHtml } from '../../../core/utils.js';
import { DEFAULT_LAYER_DEFS } from './constants.js';

export let activeLayerId = 'drawing';

export function getActiveLayerId() { return activeLayerId; }
export function setActiveLayerId(id) { activeLayerId = id; }

export function renderLayersPanel() {
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
                       style="width:56px;" title="Layer opacity" aria-label="Opacity for layer ${escHtml(l.name)}" />
                <span class="wb-layer-opacity-value text-xs" data-layer-id="${l.id}" style="min-width:28px;">${Math.round(l.opacity * 100)}%</span>
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
        const valueLabel = panel.querySelector(`.wb-layer-opacity-value[data-layer-id="${inp.dataset.layerId}"]`);
        if (valueLabel) valueLabel.textContent = `${Math.round(layer.opacity * 100)}%`;
        saveWhiteboardData();
        restoreDrawings();
        renderOverlay();
    }));
    panel.querySelectorAll('.wb-layer-up').forEach(b => b.addEventListener('click', () => moveLayer(b.dataset.layerId, 1)));
    panel.querySelectorAll('.wb-layer-down').forEach(b => b.addEventListener('click', () => moveLayer(b.dataset.layerId, -1)));
    panel.querySelectorAll('.wb-layer-del').forEach(b => b.addEventListener('click', () => deleteLayer(b.dataset.layerId)));
}

export function toggleLayersPanel() {
    const panel = document.getElementById('whiteboard-layers-panel');
    if (!panel) return;
    const showing = panel.style.display !== 'none';
    panel.style.display = showing ? 'none' : 'block';
    if (!showing) renderLayersPanel();
}

function addLayer() {
    const name = prompt('New layer name:', `Layer ${state.layers.length + 1}`);
    if (!name) return;
    const isGM = confirm('Should this be a GM-only layer (hidden in Player View)?');
    const layer = {
        id: 'layer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
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
        state.images.some(im => im.layerId === layerId) ||
        state.characterTokens.some(ct => ct.layerId === layerId);
    if (hasContent && !confirm(`Layer "${layer.name}" has content on it. Delete the layer and everything on it?`)) return;

    state.drawings = state.drawings.filter(d => d.layerId !== layerId);
    state.notes = state.notes.filter(n => n.layerId !== layerId);
    state.images = state.images.filter(im => im.layerId !== layerId);
    state.characterTokens = state.characterTokens.filter(ct => ct.layerId !== layerId);
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
