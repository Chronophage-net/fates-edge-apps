/**
 * Timers - Track scene pressure and faction clocks
 * FIXED: Modal is always rebuilt from scratch before editing.
 * FIXED: Explicit fallbacks for missing elements.
 * FIXED: Debug logging to help trace issues.
 */

import { getState, addTimer, deleteTimer, updateTimer, saveState } from '../../core/state.js';
import { createTimerWidget } from '../../components/TimerWidget.js';
import { escHtml, safeParseInt, generateId } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

let container = null;
let editingTimerId = null;

// ─── Modal CSS (fallback) ─────────────────────────────────────────────

function injectModalStyles() {
    if (document.getElementById('timer-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'timer-modal-styles';
    style.textContent = `
        #timerModal {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 10000;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
        }
        #timerModal.open {
            display: flex;
        }
        #timerModal .modal-overlay {
            position: absolute;
            inset: 0;
            cursor: pointer;
        }
        #timerModal .modal-content {
            position: relative;
            background: var(--bg, #1e1e2e);
            color: var(--text, #e0e0e0);
            border-radius: 12px;
            max-width: 500px;
            width: 92%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 1.5rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.7);
            border: 1px solid var(--border, #333);
        }
        #timerModal .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        #timerModal .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
            margin-top: 1rem;
            padding-top: 0.8rem;
            border-top: 1px solid var(--border, #444);
        }
        .form-row {
            display: flex;
            gap: 0.8rem;
            flex-wrap: wrap;
        }
        .form-row .field {
            flex: 1;
            min-width: 120px;
        }
        .form-row .field.small {
            flex: 0 0 100px;
        }
        .form-row label {
            display: block;
            font-weight: 600;
            font-size: 0.9rem;
            margin-bottom: 0.2rem;
        }
        .form-row input {
            width: 100%;
            padding: 0.4rem;
            background: var(--bg2, #2a2a2a);
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            color: var(--text, #e0e0e0);
            font-size: 0.9rem;
        }
    `;
    document.head.appendChild(style);
}

// ─── Modal creation ────────────────────────────────────────────────────

function getModalTemplate() {
    return `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="timer-modal-title">Timer</h3>
                <button id="timerModalClose" style="font-size:1.8rem;line-height:1;padding:0 0.3rem;background:none;border:none;color:var(--text2);cursor:pointer;">&times;</button>
            </div>
            <div id="timer-editor-content" class="modal-body"></div>
            <div class="modal-footer"></div>
        </div>
    `;
}

function ensureModal() {
    // Remove any existing modal to avoid stale references
    const oldModal = document.getElementById('timerModal');
    if (oldModal) {
        oldModal.remove();
    }

    injectModalStyles();

    const modal = document.createElement('div');
    modal.id = 'timerModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.display = 'none';
    modal.innerHTML = getModalTemplate();

    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });

    return modal;
}

// ─── Modal helpers ─────────────────────────────────────────────────────

function openModal() {
    const modal = document.getElementById('timerModal');
    if (!modal) {
        console.error('[Timers] Modal not found when trying to open');
        return;
    }
    modal.classList.add('open');
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('timerModal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
    }
    editingTimerId = null;
}

// ─── Render ────────────────────────────────────────────────────────────

export function render(el) {
    container = el;
    container.innerHTML = `
        <div class="flex-between" style="flex-wrap:wrap;gap:0.5rem;">
            <div>
                <h1 class="page-title">⏱️ Timers</h1>
                <p class="page-sub">Track scene pressure and faction clocks.</p>
            </div>
            <button class="btn btn-gold" id="add-timer-btn">+ New Timer</button>
        </div>
        <div class="panel" id="timer-list-container">
            <div id="timer-list"></div>
        </div>
    `;

    renderTimers();
    attachEvents();
}

function renderTimers() {
    const el = container.querySelector('#timer-list');
    if (!el) return;
    const state = getState();
    const timers = state.timers || [];

    if (timers.length === 0) {
        el.innerHTML = `
            <div class="empty-state" style="text-align:center;padding:2rem;color:var(--text3);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">⏱️</div>
                <div>No timers created.</div>
                <div style="font-size:0.8rem;margin-top:0.3rem;">Click "New Timer" to start tracking scene pressure.</div>
            </div>
        `;
        return;
    }

    // Ensure each timer has an id (migrate old data)
    let needsSave = false;
    timers.forEach(t => {
        if (!t.id) {
            t.id = generateId('timer_');
            needsSave = true;
        }
    });
    if (needsSave) saveState();

    el.innerHTML = '';
    timers.forEach(timer => {
        const widget = createTimerWidget(timer, {
            onTick: () => tickTimer(timer.id),
            onReset: () => resetTimer(timer.id),
            onDelete: () => deleteTimerHandler(timer.id),
            onEdit: () => openTimerEditor(timer.id)
        }, false);
        el.appendChild(widget);
    });
}

// ─── Timer actions ────────────────────────────────────────────────────

function tickTimer(id) {
    const state = getState();
    const timer = state.timers.find(t => t.id === id);
    if (!timer) return;
    timer.current = Math.min(timer.current + 1, timer.segments);
    saveState();
    renderTimers();
    if (timer.current >= timer.segments) {
        showToast(`⏱️ Timer "${timer.name}" completed!`, 'warning');
    }
}

function resetTimer(id) {
    const state = getState();
    const timer = state.timers.find(t => t.id === id);
    if (!timer) return;
    timer.current = 0;
    saveState();
    renderTimers();
    showToast(`Timer "${timer.name}" reset.`, 'info');
}

function deleteTimerHandler(id) {
    if (!confirm('Delete this timer?')) return;
    deleteTimer(id);
    renderTimers();
    showToast('Timer deleted.', 'success');
}

// ─── Editor ────────────────────────────────────────────────────────────

export function openTimerEditor(timerId = null) {
    console.log('[Timers] openTimerEditor called with id:', timerId);

    try {
        // 1. Ensure modal exists (this removes any old one and creates a fresh one)
        const modal = ensureModal();
        console.log('[Timers] Modal created:', modal);

        // 2. Get references to the editable parts
        const title = document.getElementById('timer-modal-title');
        const content = document.getElementById('timer-editor-content');
        const footer = modal.querySelector('.modal-footer');

        console.log('[Timers] Elements:', { title, content, footer });

        if (!title || !content || !footer) {
            console.error('[Timers] Missing modal elements – aborting');
            showToast('Could not open timer editor – missing modal parts.', 'error');
            return;
        }

        // 3. Set editing state
        editingTimerId = timerId;
        const isEdit = !!timerId;
        const state = getState();
        const timer = isEdit ? state.timers.find(t => t.id === timerId) : null;

        // 4. Populate the modal
        title.textContent = isEdit ? 'Edit Timer' : 'New Timer';

        content.innerHTML = `
            <div class="form-row">
                <div class="field">
                    <label>Name</label>
                    <input id="te-name" value="${escHtml(timer?.name || '')}" placeholder="Timer name" />
                </div>
                <div class="field small">
                    <label>Segments</label>
                    <input type="number" id="te-segments" value="${timer?.segments || 4}" min="1" max="24" />
                </div>
            </div>
            ${isEdit ? `<div style="font-size:0.85rem;color:var(--text3);margin-top:0.5rem;">Current: ${timer?.current || 0}/${timer?.segments || 4}</div>` : ''}
        `;

        footer.innerHTML = `
            <button class="btn btn-gold" id="te-save-btn">${isEdit ? '💾 Update' : '➕ Create'}</button>
            <button class="btn" id="te-cancel-btn">Cancel</button>
        `;

        // 5. Open the modal
        openModal();

        // 6. Focus the name input
        const nameInput = document.getElementById('te-name');
        if (nameInput) setTimeout(() => nameInput.focus(), 50);

        // 7. Attach event listeners to the buttons (with safe cloning to avoid duplicates)
        const saveBtn = document.getElementById('te-save-btn');
        const cancelBtn = document.getElementById('te-cancel-btn');
        const closeBtn = document.getElementById('timerModalClose');

        if (saveBtn) {
            const newSave = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSave, saveBtn);
            newSave.addEventListener('click', onSave);
        }
        if (cancelBtn) {
            const newCancel = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
            newCancel.addEventListener('click', closeModal);
        }
        if (closeBtn) {
            const newClose = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newClose, closeBtn);
            newClose.addEventListener('click', closeModal);
        }

        console.log('[Timers] Editor opened successfully');
    } catch (err) {
        console.error('[Timers] openTimerEditor error:', err);
        showToast('Failed to open timer editor.', 'error');
    }
}

function onSave() {
    try {
        const nameInput = document.getElementById('te-name');
        const segmentsInput = document.getElementById('te-segments');
        const name = nameInput?.value.trim() || 'Unnamed';
        const segments = Math.max(1, safeParseInt(segmentsInput?.value, 4));

        const state = getState();
        const timers = state.timers || [];

        if (editingTimerId) {
            const timer = timers.find(t => t.id === editingTimerId);
            if (timer) {
                timer.name = name;
                timer.segments = segments;
                if (timer.current > segments) timer.current = segments;
                saveState();
                showToast(`Timer "${name}" updated.`, 'success');
            } else {
                showToast('Timer not found.', 'error');
                return;
            }
        } else {
            addTimer({
                id: generateId('timer_'),
                name,
                segments,
                current: 0
            });
            showToast(`Timer "${name}" created.`, 'success');
        }

        closeModal();
        renderTimers();
    } catch (err) {
        console.error('[Timers] Save error:', err);
        showToast('Error saving timer.', 'error');
    }
}

// ─── Event listeners ──────────────────────────────────────────────────

let _newTimerListener = null;
let _editListener = null;

export function attachEvents() {
    if (!container) return;

    // Remove previous listener if any
    if (_newTimerListener) {
        container.removeEventListener('click', _newTimerListener);
        _newTimerListener = null;
    }

    // Direct click listener on the button using delegation (safe)
    _newTimerListener = (e) => {
        const btn = e.target.closest('#add-timer-btn');
        if (btn) {
            e.preventDefault();
            console.log('[Timers] New Timer button clicked');
            openTimerEditor();
        }
    };
    container.addEventListener('click', _newTimerListener);

    // Listen for custom "timer-edit" events from TimerWidget
    if (_editListener) {
        document.removeEventListener('timer-edit', _editListener);
        _editListener = null;
    }
    _editListener = (e) => {
        if (e.detail && e.detail.id) {
            openTimerEditor(e.detail.id);
        }
    };
    document.addEventListener('timer-edit', _editListener);
}

// ─── Lifecycle ─────────────────────────────────────────────────────────

export function onActivate() {
    renderTimers();
}

export function onDeactivate() {}

export function refresh() {
    if (container) render(container);
}

export function destroy() {
    if (container && _newTimerListener) {
        container.removeEventListener('click', _newTimerListener);
        _newTimerListener = null;
    }
    if (_editListener) {
        document.removeEventListener('timer-edit', _editListener);
        _editListener = null;
    }
    container = null;
}

// ─── Exports ──────────────────────────────────────────────────────────

export default {
    render,
    onActivate,
    onDeactivate,
    refresh,
    destroy,
    attachEvents,
    openTimerEditor,
};