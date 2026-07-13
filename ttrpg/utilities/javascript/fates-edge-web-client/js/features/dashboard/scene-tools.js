/**
 * Scene tools module
 */

import { getState, addArchive, clearRollHistory, clearChatHistory, saveState } from '../../core/state.js';
import { clamp } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

/**
 * Scene end: trim all characters' Boons to 2
 */
export function sceneEndTrimBoons() {
    const state = getState();
    let trimmed = 0;
    state.characters.forEach(c => {
        const before = c.boons || 0;
        c.boons = clamp(c.boons || 0, 0, 2);
        if (before > c.boons) trimmed += (before - c.boons);
    });
    saveState();
    if (trimmed > 0) {
        showToast(`Scene end: trimmed ${trimmed} excess Boons.`, 'success');
    } else {
        showToast('Scene end: all Boons already at 2 or below.', 'info');
    }
}

/**
 * Reset all timers to zero
 */
export function resetAllTimers() {
    if (!confirm('Reset every timer to zero segments?')) return;
    const state = getState();
    state.timers.forEach(t => t.current = 0);
    saveState();
    showToast('All timers reset.', 'success');
}

/**
 * Create a new session archive
 */
export function newSession() {
    const state = getState();
    if (state.rollHistory.length === 0 && state.chatHistory.length === 0) {
        showToast('No data to archive.', 'info');
        return;
    }
    
    const label = prompt('Session label:', `Session ${getState().sessionId || 1}`) || `Session ${getState().sessionId || 1}`;
    
    const archive = {
        id: Date.now(),
        timestamp: Date.now(),
        rollHistory: [...state.rollHistory],
        chatHistory: [...state.chatHistory],
        label: label
    };
    
    addArchive(archive);
    clearRollHistory();
    clearChatHistory();
    showToast('New session started; previous archived.', 'success');
}
