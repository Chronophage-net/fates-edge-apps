/**
 * The room's live adventure — the one held by the socket server.
 *
 * When a room server has an adventure loaded (the AI GM loads one with
 * `!gm adventure`, or any GM loads one through the API), that adventure
 * is the table's truth: the AI GM narrates from it, ticks its timers and
 * grows new scenes into it. The browser's own adventure library is a
 * local notebook that the server never sees, so while a live adventure
 * exists the Adventure Manager shows the server's instead and sends GM
 * actions to the server rather than changing local copies.
 *
 * Everything here uses the server's public view (getPublicState): GM-only
 * knowledge is never included, so the same view is safe for every role.
 * Every adventure broadcast from the server carries that full view, so
 * each one simply replaces what is shown.
 */

import { escHtml } from '@core/utils.js';
import { onWSEvent, requestAdventureState, sendMessage, isConnectedToServer } from '@core/websocket.js';

// Server broadcasts that carry the full public adventure state.
const STATE_EVENTS = [
    'adventure-state', 'adventure-loaded', 'adventure-reset',
    'scene-changed', 'scene-appended', 'act-appended',
    'encounter-started', 'encounter-resolved', 'timer-ticked', 'adventure-log',
    'adventure-knowledge-revealed', 'adventure-knowledge-hidden',
    'npc-added', 'creature-added', 'session-ended',
    'adventure-climax-triggered', 'adventure-climax-forced',
];

let live = null;
let wired = false;
const subscribers = new Set();

function notify() {
    subscribers.forEach(fn => { try { fn(live); } catch (e) { console.error('[LiveAdventure] subscriber failed:', e); } });
}

/**
 * Take a server payload as the live adventure. Payloads without a
 * `moduleId` key are not adventure state and are ignored; a null
 * `moduleId` means the server has no adventure, which hands the screen
 * back to the local library.
 */
export function applyLiveState(payload) {
    if (!payload || typeof payload !== 'object' || !('moduleId' in payload)) return false;
    const next = payload.moduleId ? payload : null;
    const changed = next !== live;
    live = next;
    if (changed) notify();
    return true;
}

export function getLiveAdventure() { return live; }
export function isLiveAdventure() { return !!live && isConnectedToServer(); }

/** Re-render on every change. Returns an unsubscribe function. */
export function onLiveAdventureChange(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

/** Ask the server for its adventure (on join, on opening the screen). */
export function refreshLiveAdventure() {
    if (!isConnectedToServer()) { applyLiveState({ moduleId: null }); return false; }
    return requestAdventureState();
}

/** Listen once for the server's adventure broadcasts. */
export function wireLiveAdventure() {
    if (wired) return;
    wired = true;
    for (const event of STATE_EVENTS) {
        onWSEvent(event, payload => { if (!applyLiveState(payload)) refreshLiveAdventure(); });
    }
    // A fresh room connection: find out whether an adventure is running.
    onWSEvent('room-state', () => refreshLiveAdventure());
    onWSEvent('room-joined', () => refreshLiveAdventure());
    onWSEvent('disconnected', () => applyLiveState({ moduleId: null }));
}

// GM actions, sent to the server's adventure engine. The server checks
// the role (GM or Co-GM) and broadcasts the new state to everyone.
export const liveCommands = {
    advanceScene: () => sendMessage({ type: 'adventure-scene' }),
    tickTimer: (scope, ref, amount = 1) => sendMessage({ type: 'adventure-timer', scope, ref, amount }),
    startEncounter: ref => sendMessage({ type: 'adventure-encounter-start', ref }),
    resolveEncounter: (outcome, notes = '') => sendMessage({ type: 'adventure-encounter-resolve', outcome, notes }),
    reveal: id => sendMessage({ type: 'adventure-knowledge-reveal', id }),
    hide: id => sendMessage({ type: 'adventure-knowledge-hide', id }),
};

function clock(timer, scope, ref, canRun) {
    const segments = Math.max(1, Number(timer.segments) || 1);
    const current = Math.min(segments, Number(timer.current) || 0);
    const controls = canRun
        ? `<button class="btn btn-sm" data-live-tick="${scope}" data-live-ref="${ref}" data-live-amount="-1" aria-label="Untick ${escHtml(timer.name)}">−</button>`
          + `<button class="btn btn-sm" data-live-tick="${scope}" data-live-ref="${ref}" data-live-amount="1" aria-label="Tick ${escHtml(timer.name)}">+</button>`
        : '';
    return `<div class="adv-live-clock"><div><strong>${escHtml(timer.name || 'Timer')}</strong> <span>${current} / ${segments}${current >= segments ? ' · full' : ''}</span></div>`
        + `<progress max="${segments}" value="${current}" aria-label="${escHtml(timer.name || 'Timer')}"></progress>${controls}</div>`;
}

/**
 * The live adventure view. `renderDescription` is the Adventure Manager's
 * own description renderer (Crown Spread readings, emphasis).
 */
export function renderLiveAdventure({ canRun, renderDescription = t => `<p>${escHtml(t)}</p>` }) {
    const a = live;
    if (!a) return '';
    const scene = a.currentScene;
    const encounter = a.activeEncounter;
    const toc = (a.tableOfContents || []).map((act, ai) => `<li><strong>${escHtml(act.title || `Act ${ai + 1}`)}</strong><ol>${
        (act.scenes || []).map((s, si) => {
            const here = ai === a.currentActIndex && si === a.currentSceneIndex;
            return `<li class="${here ? 'adv-live-here' : ''}">${s.completed ? '✓ ' : ''}${escHtml(s.title || `Scene ${si + 1}`)}${here ? ' — <em>now</em>' : ''}</li>`;
        }).join('')}</ol></li>`).join('');
    const sceneTimers = (scene?.timers || []).map((t, i) => clock(t, 'scene', i, canRun)).join('');
    const campaignTimers = (a.campaignTimers || []).map((t, i) => clock(t, 'campaign', i, canRun)).join('');
    const encounters = (scene?.encounters || []).map((e, i) => `<li><strong>${escHtml(e.name || `Encounter ${i + 1}`)}</strong>`
        + `${e.dv ? ` · DV ${escHtml(String(e.dv))}` : ''}${e.position ? ` · ${escHtml(e.position)}` : ''}`
        + `${canRun && !encounter ? ` <button class="btn btn-sm" data-live-encounter="${i}">Start</button>` : ''}</li>`).join('');
    const knowledge = (a.knowledge || []).filter(k => k.revealed || k.text || canRun).map(k => `<li>${k.revealed ? '🔓' : '🔒'} <strong>${escHtml(k.subject || k.id)}</strong>`
        + `${k.text ? ` — ${escHtml(k.text)}` : ''}`
        + `${canRun ? ` <button class="btn btn-sm" data-live-${k.revealed ? 'hide' : 'reveal'}="${escHtml(k.id)}">${k.revealed ? 'Hide' : 'Reveal'}</button>` : ''}</li>`).join('');
    const log = (a.log || []).slice(-10).reverse().map(entry => `<li><span class="adv-muted">${escHtml(entry.author || '')}</span> ${escHtml(entry.message || '')}</li>`).join('');
    const status = a.status === 'completed' ? 'ADVENTURE COMPLETE' : 'AT THE TABLE NOW';

    return `<div class="adv-workspace adv-session adv-live">
        <div class="adv-live-banner" role="status"><strong>Room adventure.</strong> This adventure is running on the room server${a.dynamicGrowth ? ' and the AI GM is growing it as you play' : ''}. It takes the place of your local library until it ends${canRun ? '; your actions here go to the server' : ''}.</div>
        <header class="adv-hero"><div><p class="adv-eyebrow">${escHtml(a.status || 'active')} · TIER ${escHtml(String(a.tierRange || a.tier || 'I'))}</p><h1>${escHtml(a.title || 'Untitled adventure')}</h1>${a.description ? `<p>${escHtml(String(a.description).slice(0, 280))}</p>` : ''}</div>${canRun ? '' : '<span class="adv-badge">Read-only</span>'}</header>
        <div class="adv-run-grid"><div>
            <section class="adv-current"><p class="adv-eyebrow">${status}</p><h2>${escHtml(scene?.title || 'Between scenes')}</h2><p class="adv-muted">${escHtml(a.currentAct?.title || '')}</p>
                ${scene?.description ? renderDescription(scene.description) : ''}
                ${canRun && a.status !== 'completed' ? '<div class="adv-toolbar"><button class="btn btn-gold" data-live-advance>Next scene →</button></div>' : ''}
            </section>
            ${encounter ? `<section class="adv-panel"><h2>Encounter: ${escHtml(encounter.name || 'In progress')}</h2><p class="adv-muted">${encounter.dv ? `DV ${escHtml(String(encounter.dv))}` : ''}${encounter.position ? ` · ${escHtml(encounter.position)}` : ''}</p>
                ${canRun ? '<div class="adv-toolbar"><button class="btn" data-live-resolve="clean">Clean</button><button class="btn" data-live-resolve="partial">Partial</button><button class="btn" data-live-resolve="miss">Miss</button></div>' : ''}</section>` : ''}
            ${encounters ? `<section class="adv-panel"><h2>Encounters in this scene</h2><ul>${encounters}</ul></section>` : ''}
            <section class="adv-outline"><h2>Scene outline</h2><ol>${toc || '<li>No scenes yet.</li>'}</ol></section>
        </div><aside>
            ${sceneTimers ? `<section class="adv-panel"><h2>Scene clocks</h2>${sceneTimers}</section>` : ''}
            ${campaignTimers ? `<section class="adv-panel"><h2>Campaign clocks</h2>${campaignTimers}</section>` : ''}
            ${knowledge ? `<section class="adv-panel"><h2>What the table knows</h2><ul>${knowledge}</ul></section>` : ''}
            ${log ? `<details class="adv-panel" open><summary>Recent events</summary><ul>${log}</ul></details>` : ''}
        </aside></div>
    </div>`;
}

/** Wire the live view's buttons to the server commands. */
export function attachLiveAdventureEvents(root) {
    root.querySelector('[data-live-advance]')?.addEventListener('click', () => liveCommands.advanceScene());
    root.querySelectorAll('[data-live-tick]').forEach(b => b.addEventListener('click', () =>
        liveCommands.tickTimer(b.dataset.liveTick, Number(b.dataset.liveRef), Number(b.dataset.liveAmount))));
    root.querySelectorAll('[data-live-encounter]').forEach(b => b.addEventListener('click', () => liveCommands.startEncounter(Number(b.dataset.liveEncounter))));
    root.querySelectorAll('[data-live-resolve]').forEach(b => b.addEventListener('click', () => liveCommands.resolveEncounter(b.dataset.liveResolve)));
    root.querySelectorAll('[data-live-reveal]').forEach(b => b.addEventListener('click', () => liveCommands.reveal(b.dataset.liveReveal)));
    root.querySelectorAll('[data-live-hide]').forEach(b => b.addEventListener('click', () => liveCommands.hide(b.dataset.liveHide)));
}
