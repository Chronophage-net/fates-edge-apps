/**
 * Timers feature - Track scene pressure and faction clocks
 * ✅ Auto‑creates modal if missing
 * ✅ Robust ID generation
 * ✅ Proper event cleanup
 * ✅ Better UI with inline editing
 * ✅ Fixed: “New Timer” button now uses event delegation
 */

import { getState, addTimer, deleteTimer, updateTimer, saveState } from '../../core/state.js';
import { createTimerWidget } from '../../components/TimerWidget.js';
import { escHtml, safeParseInt, generateId } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

let container = null;
let isInitialized = false;

// ============================================================
// MODAL CREATION (if missing)
// ============================================================

function ensureModal() {
    let modal = document.getElementById('timerModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'timerModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content" style="max-width:500px;">
            <div class="modal-header">
                <h3 id="timer-modal-title">Timer</h3>
                <button id="timerModalClose" class="btn btn-ghost" style="font-size:1.8rem;line-height:1;">&times;</button>
            </div>
            <div id="timer-editor-content" class="modal-body"></div>
            <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('open');
            modal.style.display = 'none';
        }
    });

    return modal;
}

// ============================================================
// RENDER
// ============================================================

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
    attachEvents();   // now delegates clicks instead of direct binding
    isInitialized = true;
}

// ============================================================
// RENDER TIMERS
// ============================================================

function renderTimers() {
    const el = container.querySelector('#timer-list');   // 🔁 use container, not document
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

// ============================================================
// TIMER ACTIONS
// ============================================================

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

// ============================================================
// TIMER EDITOR (New & Edit)
// ============================================================

let editingTimerId = null;

export function openTimerEditor(timerId = null) {
    const modal = ensureModal();
    const title = document.getElementById('timer-modal-title');
    const content = document.getElementById('timer-editor-content');
    const footer = modal.querySelector('.modal-footer');

    if (!content || !footer) return;

    editingTimerId = timerId;
    const isEdit = !!timerId;
    const state = getState();
    const timer = isEdit ? state.timers.find(t => t.id === timerId) : null;

    title.textContent = isEdit ? 'Edit Timer' : 'New Timer';

    content.innerHTML = `
        <div class="form-row">
            <div class="field"><label>Name</label>
                <input id="te-name" value="${escHtml(timer?.name || '')}" placeholder="Timer name" />
            </div>
            <div class="field small"><label>Segments</label>
                <input type="number" id="te-segments" value="${timer?.segments || 4}" min="1" max="24" />
            </div>
        </div>
        ${isEdit ? `<div style="font-size:0.85rem;color:var(--text3);">Current: ${timer?.current || 0}/${timer?.segments || 4}</div>` : ''}
    `;

    footer.innerHTML = `
        <button class="btn btn-gold" id="te-save-btn">${isEdit ? '💾 Update' : '➕ Create'}</button>
        <button class="btn" id="te-cancel-btn">Cancel</button>
    `;

    modal.classList.add('open');
    modal.style.display = 'flex';

    // Focus name input
    const nameInput = document.getElementById('te-name');
    if (nameInput) setTimeout(() => nameInput.focus(), 50);

    // Save handler
    document.getElementById('te-save-btn')?.addEventListener('click', () => {
        const name = document.getElementById('te-name')?.value.trim() || 'Unnamed';
        const segments = Math.max(1, safeParseInt(document.getElementById('te-segments')?.value, 4));

        if (isEdit && timer) {
            timer.name = name;
            timer.segments = segments;
            if (timer.current > segments) timer.current = segments; // clamp
            saveState();
            showToast(`Timer "${name}" updated.`, 'success');
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
    });

    // Cancel handler
    document.getElementById('te-cancel-btn')?.addEventListener('click', closeModal);

    // Close button
    document.getElementById('timerModalClose')?.addEventListener('click', closeModal);
}

function closeModal() {
    const modal = document.getElementById('timerModal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
    }
    editingTimerId = null;
}

// ============================================================
// EVENT LISTENERS – now uses robust delegation
// ============================================================

let _delegatedClickListener = null;
let _editEventListener = null;

export function attachEvents() {
    if (!container) return;

    // Remove previous delegated listener (if any) to avoid duplicates
    if (_delegatedClickListener) {
        container.removeEventListener('click', _delegatedClickListener);
    }

    // Delegate click: if the target (or a parent) has id="add-timer-btn", open the editor
    _delegatedClickListener = (e) => {
        // Find the closest ancestor (or the target itself) with the id
        const btn = e.target.closest('#add-timer-btn');
        if (btn) {
            e.preventDefault();
            openTimerEditor();
        }
    };
    container.addEventListener('click', _delegatedClickListener);

    // Custom event for editing (still on document, since TimerWidget dispatches it)
    if (_editEventListener) {
        document.removeEventListener('timer-edit', _editEventListener);
    }
    _editEventListener = (e) => {
        if (e.detail && e.detail.id) {
            openTimerEditor(e.detail.id);
        }
    };
    document.addEventListener('timer-edit', _editEventListener);
}

// ============================================================
// LIFECYCLE
// ============================================================

export function onActivate() {
    renderTimers();
}

export function onDeactivate() {
    // Nothing to clean
}

export function refresh() {
    if (container) render(container);
}

export function destroy() {
    if (container && _delegatedClickListener) {
        container.removeEventListener('click', _delegatedClickListener);
    }
    if (_editEventListener) {
        document.removeEventListener('timer-edit', _editEventListener);
    }
    _delegatedClickListener = null;
    _editEventListener = null;
    container = null;
    isInitialized = false;
}

// ============================================================
// EXPORTS
// ============================================================

export default {
    render,
    onActivate,
    onDeactivate,
    refresh,
    destroy,
    attachEvents,
    openTimerEditor
};