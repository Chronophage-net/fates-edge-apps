/**
 * Dashboard feature module
 */

import { getState, getCharacter } from '../../core/state.js';
import { escHtml } from '../../core/utils.js';

let container = null;

/**
 * Render the dashboard tab
 */
export function render(el) {
    container = el;
    container.innerHTML = `
        <h1 class="page-title">📊 Dashboard</h1>
        <p class="page-sub">Quick overview of your campaign state.</p>
        <div class="grid-2">
            <div class="panel"><h3>📋 Characters</h3><div id="dash-chars"><span class="text-muted">Loading…</span></div></div>
            <div class="panel"><h3>⏱️ Active Timers</h3><div id="dash-timers"><span class="text-muted">None running.</span></div></div>
        </div>
        <div class="panel">
            <h3 class="flex-between"><span>🎲 Scene Tools</span></h3>
            <div class="flex">
                <button class="btn btn-sm" id="scene-end-btn">🌅 Scene End (trim Boons)</button>
                <button class="btn btn-sm btn-primary" id="open-vtt-btn">💬 Open VTT</button>
                <button class="btn btn-sm btn-danger" id="reset-timers-btn">↺ Reset All Timers</button>
                <button class="btn btn-sm btn-gold" id="new-session-btn">📦 New Session</button>
            </div>
            <p class="text-muted small mt-1">Scene End resets all characters' Boons to 2. New Session archives current roll/chat history.</p>
        </div>
    `;
    
    update();
}

/**
 * Update dashboard data
 */
export function update() {
    const state = getState();
    const dc = document.getElementById('dash-chars');
    const dt = document.getElementById('dash-timers');
    
    if (dc) {
        if (state.characters.length === 0) {
            dc.innerHTML = '<span class="text-muted">No characters yet.</span>';
        } else {
            dc.innerHTML = state.characters.map(c => `
                <div style="display:flex;justify-content:space-between;padding:0.2rem 0;border-bottom:1px solid var(--border);">
                    <span>${escHtml(c.name || 'Unnamed')}${c.vtt ? ' <span style="color:var(--gold);font-size:0.7rem;">VTT</span>' : ''}</span>
                    <span class="text-muted">${escHtml(c.heritage || '')} · Tier ${c.tier || 'I'} · ❤️${c.harm || 0} ⚡${c.fatigue || 0} 🎲${c.boons || 0}</span>
                </div>
            `).join('');
        }
    }
    
    if (dt) {
        const active = state.timers.filter(t => t.current < t.segments);
        if (active.length === 0) {
            dt.innerHTML = '<span class="text-muted">No active timers.</span>';
        } else {
            dt.innerHTML = active.map(t => `
                <div style="display:flex;justify-content:space-between;padding:0.2rem 0;border-bottom:1px solid var(--border);">
                    <span>${escHtml(t.name)}</span>
                    <span class="text-muted">${t.current}/${t.segments}</span>
                </div>
            `).join('');
        }
    }
}

/**
 * Attach event listeners
 */
export function attachEvents() {
    document.getElementById('scene-end-btn')?.addEventListener('click', () => {
        import('./scene-tools.js').then(module => {
            module.sceneEndTrimBoons();
            update();
        });
    });
    
    document.getElementById('open-vtt-btn')?.addEventListener('click', () => {
        document.querySelector('.sidebar-nav button[data-tab="vtt"]')?.click();
    });
    
    document.getElementById('reset-timers-btn')?.addEventListener('click', () => {
        import('./scene-tools.js').then(module => {
            module.resetAllTimers();
            update();
        });
    });
    
    document.getElementById('new-session-btn')?.addEventListener('click', () => {
        import('./scene-tools.js').then(module => {
            module.newSession();
            update();
        });
    });
}
