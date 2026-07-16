/**
 * Timers feature - Track scene pressure and faction clocks
 */

import { logToSession, addVTTEvent } from '../dashboard/scene-tools.js';
import { getState, addTimer, deleteTimer, updateTimer, saveState } from '../../core/state.js';
import { createTimerWidget } from '../../components/TimerWidget.js';
import { escHtml, safeParseInt } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

let container = null;

/**
 * Render the timers tab
 */
export function render(el) {
    container = el;
    container.innerHTML = `
        <div class="flex-between">
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
}

/**
 * Render timers
 */
function renderTimers() {
    const el = document.getElementById('timer-list');
    if (!el) return;
    const state = getState();
    if (state.timers.length === 0) {
        el.innerHTML = '<div class="empty-state">No timers created.</div>';
        return;
    }
    el.innerHTML = '';
    state.timers.forEach(timer => {
        const widget = createTimerWidget(timer, {
            onTick: () => tickTimer(timer.id),
            onReset: () => resetTimer(timer.id),
            onDelete: () => deleteTimerHandler(timer.id)
        }, false);
        el.appendChild(widget);
    });
}

/**
 * Tick a timer
 */
function tickTimer(id) {
    const timer = getState().timers.find(t => t.id === id);
    if (!timer) return;
    timer.current = Math.min(timer.current + 1, timer.segments);
    // Log timer tick
    try {
        logToSession(`⏱️ Timer ticked: ${timer.name} (${timer.current}/${timer.segments})`, 'info');
        addVTTEvent('timer_ticked', { name: timer.name, current: timer.current, segments: timer.segments });
    } catch (e) { /* ignore */ }
    saveState();
    renderTimers();
    if (timer.current >= timer.segments) {
        // Log timer completion
        try {
            logToSession(`⏱️ Timer completed: ${timer.name}`, 'warning');
            addVTTEvent('timer_complete', { name: timer.name, id: timer.id });
        } catch (e) { /* ignore */ }
        showToast(`Timer "${timer.name}" completed!`, 'warning');
        
    }
}

/**
 * Reset a timer
 */
function resetTimer(id) {
    const timer = getState().timers.find(t => t.id === id);
    if (!timer) return;
    timer.current = 0;
    saveState();
    renderTimers();
}

/**
 * Delete a timer
 */
function deleteTimerHandler(id) {
    if (!confirm('Delete timer?')) return;
    deleteTimer(id);
    renderTimers();
    showToast('Timer deleted.', 'success');
}

/**
 * Open timer editor
 */
function openTimerEditor() {
    const modal = document.getElementById('timerModal');
    document.getElementById('timer-modal-title').textContent = 'New Timer';
    document.getElementById('timer-editor-content').innerHTML = `
        <div class="form-row">
            <div class="field"><label>Name</label><input id="te-name" placeholder="Timer name" /></div>
            <div class="field small"><label>Segments</label><input type="number" id="te-segments" value="4" min="1" max="24" /></div>
        </div>
        <div class="flex mt-1">
            <button class="btn btn-gold" id="te-save-btn">💾 Create</button>
            <button class="btn" id="te-cancel-btn">Cancel</button>
        </div>
    `;
    modal.classList.add('open');
    
    document.getElementById('te-save-btn')?.addEventListener('click', saveTimerEditor);
    document.getElementById('te-cancel-btn')?.addEventListener('click', () => modal.classList.remove('open'));
    document.getElementById('timerModalClose')?.addEventListener('click', () => modal.classList.remove('open'));
}

/**
 * Save timer editor
 */
function saveTimerEditor() {
    const name = document.getElementById('te-name')?.value.trim() || 'Unnamed';
    const segments = Math.max(1, safeParseInt(document.getElementById('te-segments')?.value, 4));
    const state = getState();
    addTimer({
        id: state._nextId++,
        name,
        segments,
        current: 0
    });
    document.getElementById('timerModal').classList.remove('open');
    renderTimers();
    showToast('Timer created.', 'success');
}

/**
 * Attach event listeners
 */
export function attachEvents() {
    document.getElementById('add-timer-btn')?.addEventListener('click', openTimerEditor);
    document.getElementById('timerModalClose')?.addEventListener('click', () => {
        document.getElementById('timerModal').classList.remove('open');
    });
}
