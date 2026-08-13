/**
 * Adventures Module – Campaign Management for Fate's Edge
 *
 * Features:
 * - Load adventures from /data/adventures/*.json
 * - Track adventure state (current scene, act, progress)
 * - Adventure timers integrated with GM Tools
 * - Custom adventure creation via Crown Spread + timers
 * - Scene-by-scene progress tracking
 * - NPC, Location, and Faction management per adventure
 * - Export/Import adventure data
 * - Modal-based adventure library browser (replaces clunky prompt)
 *
 * NEW: Adventure-specific bestiary – each adventure can have its own
 * creatures/NPCs/bosses that can be used as adversaries in scenes.
 * Scenes' encounter entries can reference bestiary creatures by ID,
 * or define inline adversaries.
 *
 * ────────────────────────────────────────────────────────────────────────
 * NEW (this pass) — server sync for timers, and a real gap fixed:
 *
 * 1. Scene-local timers (scene.timers[]) were displayed and could be
 *    AUTHORED when creating an adventure, but nothing anywhere could
 *    actually tick one during play — only campaign timers had that.
 *    Added advanceSceneTimer() + window.adventureAdvanceSceneTimer(),
 *    mirroring advanceTimer()'s campaign-timer version exactly.
 *
 * 2. Neither advanceTimer() nor the new advanceSceneTimer() broadcast
 *    anything over the wire before now (only scene/act position did, via
 *    the existing broadcastSceneStatus()). Added broadcastTimerTick(),
 *    which sends the same 'adventure-timer' shape server/adventure.js's
 *    tickTimer() expects — so a client-driven tick and a server/API/AI-
 *    driven tick land on the same state whenever both sides have the
 *    same adventure loaded, no translation needed.
 *
 * 3. startSceneEncounter() now also sends a lightweight 'adventure-log'
 *    beat when connected, so other clients/an AI see that an encounter
 *    began and who's in it. This deliberately does NOT call the server's
 *    'adventure-encounter-start' command: that command models ONE
 *    encounter at a time, while this function can merge SEVERAL
 *    scene.encounters[] entries into one combined Combat Tracker session.
 *    Forcing them to match would either lose the multi-adversary merging
 *    here or require the server model to change shape — worth a
 *    deliberate choice rather than picked silently. The log beat is a
 *    safe, information-only middle ground until that's decided.
 *
 * 4. Timer triggers: data-driven actions on timer completion.
 *    - notify: show toast and log
 *    - completeScene: mark a scene (by index within current act) completed
 *    - advanceScene: move currentScene to a given index
 *    - setEncounterPosition: change an encounter's position field
 *    Extensible; see executeTimerTriggers().
 *
 * 5. Global timer sync: when an adventure starts, campaign timers are
 *    mirrored into state.timers (with timerIds stored on the adventure)
 *    so the GM Tools' auto-tick feature can tick them. Timers are kept
 *    in sync on advanceTimer/reset.
 *
 * ────────────────────────────────────────────────────────────────────────
 * v3 – Role-based gating: non‑GM players can view adventures but cannot
 *      create, edit, delete, import/export, start/reset, or control
 *      timers/encounters/scenes.
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml, safeParseInt } from '../../core/utils.js';
import { logToSession, addVTTEvent } from '../gm-tools/index.js';
import { isConnectedToServer, sendEvent, onWSEvent } from '../../core/websocket.js';
import { loadBestiaryData, getCreatureDescription } from '../encounters/bestiary.js';
import { OBJECTIVE_TYPES, DEFAULT_OBJECTIVE_TYPE, getObjectiveType } from '../../core/objective-types.js';
// ─── Role check ──────────────────────────────────────────────
import { getMyStoredRole, isGmLikeRole } from '../../core/feature-toggles.js';
import { openInlineScreen, closeInlineScreen, inlineScreenShell } from '../../components/InlineScreen.js';

// ============================================================
// CONSTANTS
// ============================================================

const ADVENTURES_DATA_PATH = '/data/adventures/';
const STORAGE_KEY = 'fates-edge-adventures';

// ============================================================
// STATE
// ============================================================

let container = null;
let adventures = [];
let activeAdventureId = null;
let adventureViewMode = 'list'; // 'list' | 'detail' | 'create'
let isDestroyed = false;

// ─── Helper to check if current user is GM ──────────────────────────

function isGM() {
    if (!isConnectedToServer()) return true; // solo/local – allow all
    return isGmLikeRole(getMyStoredRole());
}

// ============================================================
// GM SESSION LOG + LIVE SCENE STATUS BROADCAST
// ============================================================

function logAdventureEvent(message, logType = 'info', vttEventType = 'adventure_event', vttEventData = {}) {
    try {
        logToSession(message, logType);
        addVTTEvent(vttEventType, vttEventData);
    } catch (e) { /* ignore — GM Tools not available */ }
}

function broadcastSceneStatus(adventure) {
    if (!isConnectedToServer()) return;
    if (!adventure) {
        try { sendEvent({ type: 'scene-status-update', scene: null }); } catch (e) { /* ignore */ }
        return;
    }
    const act = adventure.acts?.[adventure.currentAct] || null;
    const scene = act?.scenes?.[adventure.currentScene] || null;
    try {
        sendEvent({
            type: 'scene-status-update',
            scene: {
                adventureId: adventure.id,
                adventureTitle: adventure.title,
                actTitle: act ? act.title : null,
                sceneTitle: scene ? scene.title : null,
                status: adventure.status
            }
        });
    } catch (e) { /* ignore */ }
}

function broadcastTimerTick(timerName, scope, ref, amount) {
    if (!isConnectedToServer()) return;
    try {
        sendEvent({ type: 'adventure-timer', scope, ref, name: timerName, amount });
    } catch (e) { /* ignore */ }
}

// ============================================================
// TIMER SYNC LOOP — apply the server's canonical result
// ============================================================
//
// broadcastTimerTick() above only *notifies* the server; it doesn't wait
// for or apply a reply. The server (server/adventure.js tickTimer(), via
// the 'adventure-timer' WS handler in ws-handlers.js/socketio-handlers.js)
// recomputes the tick on its own authoritative copy and broadcasts the
// result back to EVERY client in the room — including whoever sent the
// original tick — as a 'timer-ticked' message. Until now nothing on the
// client listened for that reply, so:
//   - other clients never saw the GM's timer ticks reflected locally
//   - the sending client relied entirely on its own optimistic update,
//     which could silently drift from the server's copy (e.g. two GMs/
//     an AI agent ticking the same timer around the same time)
// This closes the loop: every client (sender included) reconciles its
// local timer state to the server's answer.
function applyRemoteTimerTick(payload) {
    const ticked = payload && payload.tickedTimer;
    if (!ticked || !ticked.name) return;

    const adventure = getActiveAdventure();
    if (!adventure) return;

    const scope = ticked.scope === 'campaign' ? 'campaign' : 'scene';
    let timer = null;

    if (scope === 'campaign') {
        timer = (adventure.campaignTimers || []).find(t => t.name === ticked.name);
    } else {
        const act = adventure.acts?.[adventure.currentAct];
        const scene = act?.scenes?.[adventure.currentScene];
        timer = (scene?.timers || []).find(t => t.name === ticked.name);
    }
    if (!timer) return; // Not an adventure we have loaded locally — nothing to reconcile.

    const previous = timer.current || 0;
    const next = Math.max(0, Math.min(ticked.segments ?? timer.segments, ticked.current));
    if (next === previous) {
        // Either the echo of our own already-applied optimistic tick, or
        // a no-op tick (e.g. already at 0/max) — nothing new to show.
        return;
    }
    timer.current = next;
    saveAdventuresToState();

    // Keep the GM Tools global timer mirror (state.timers, via
    // adventure.timerIds — see advanceTimer()) in sync for campaign
    // timers, same as a locally-driven tick would.
    if (scope === 'campaign') {
        const timerIndex = (adventure.campaignTimers || []).indexOf(timer);
        const globalId = adventure.timerIds?.[timerIndex];
        if (globalId) {
            const state = getState();
            const globalTimer = state.timers.find(t => t.id === globalId);
            if (globalTimer) {
                globalTimer.current = next;
                saveState();
            }
        }
    }

    if (ticked.full && previous < timer.segments) {
        showToast(`⏱️ ${scope === 'campaign' ? 'Adventure' : 'Scene'} Timer "${timer.name}" completed!`, 'warning');
        logAdventureEvent(`⏱️ ${scope === 'campaign' ? 'Adventure' : 'Scene'} Timer "${timer.name}" completed (${adventure.title})`, 'warning', 'adventure_timer_completed', {
            adventureId: adventure.id, timerName: timer.name
        });
    }

    renderView();
}

// Registered once at module load (this module is a singleton ES import,
// not re-instantiated per activation) so remote timer ticks are applied
// even when the Adventures panel isn't the currently active/visible
// feature — the underlying adventure data still needs to stay correct.
onWSEvent('timer-ticked', applyRemoteTimerTick);

// ============================================================
// TIMER TRIGGER EXECUTION (NEW)
// ============================================================

function executeTimerTriggers(adventure, timer, scope, ref) {
    if (!timer.triggers || !Array.isArray(timer.triggers)) return;
    const triggers = timer.triggers;
    const actIdx = ref.actIndex !== undefined ? ref.actIndex : null;
    const sceneIdx = ref.sceneIndex !== undefined ? ref.sceneIndex : null;
    const timerIdx = ref.timerIndex;

    triggers.forEach(trigger => {
        const { type } = trigger;
        switch (type) {
            case 'notify': {
                const msg = trigger.message || `Timer "${timer.name}" completed.`;
                showToast(msg, 'warning');
                logAdventureEvent(`⏱️ ${msg}`, 'warning', 'timer_trigger_notify', {
                    timerName: timer.name,
                    adventureId: adventure.id,
                    scope
                });
                break;
            }
            case 'completeScene': {
                const sceneIndex = trigger.sceneIndex;
                if (sceneIndex === undefined || sceneIndex === null) {
                    console.warn('[Adventures] completeScene trigger missing sceneIndex');
                    return;
                }
                const act = adventure.acts?.[adventure.currentAct];
                if (!act) return;
                const scene = act.scenes?.[sceneIndex];
                if (!scene) return;
                if (!scene.completed) {
                    scene.completed = true;
                    logAdventureEvent(`📜 Scene "${scene.title}" auto‑completed by timer "${timer.name}"`, 'info', 'scene_auto_completed', {
                        adventureId: adventure.id,
                        sceneIndex,
                        sceneTitle: scene.title
                    });
                }
                saveAdventuresToState();
                break;
            }
            case 'advanceScene': {
                const newSceneIdx = trigger.sceneIndex;
                if (newSceneIdx === undefined || newSceneIdx === null) {
                    console.warn('[Adventures] advanceScene trigger missing sceneIndex');
                    return;
                }
                const act = adventure.acts?.[adventure.currentAct];
                if (!act) return;
                if (newSceneIdx < act.scenes.length) {
                    adventure.currentScene = newSceneIdx;
                    logAdventureEvent(`⏩ Advanced to scene "${act.scenes[newSceneIdx].title}" by timer "${timer.name}"`, 'info', 'scene_advanced', {
                        adventureId: adventure.id,
                        sceneIndex: newSceneIdx
                    });
                    broadcastSceneStatus(adventure);
                    saveAdventuresToState();
                } else {
                    console.warn('[Adventures] advanceScene target index out of range');
                }
                break;
            }
            case 'setEncounterPosition': {
                const sceneIndex = trigger.sceneIndex;
                const encIdx = trigger.encounterIndex;
                const newPos = trigger.position;
                if (sceneIndex === undefined || encIdx === undefined || !newPos) {
                    console.warn('[Adventures] setEncounterPosition missing required params');
                    return;
                }
                const act = adventure.acts?.[adventure.currentAct];
                if (!act) return;
                const scene = act.scenes?.[sceneIndex];
                if (!scene) return;
                const encounter = scene.encounters?.[encIdx];
                if (!encounter) return;
                encounter.position = newPos;
                logAdventureEvent(`⚔️ Encounter "${encounter.name}" position set to ${newPos} by timer "${timer.name}"`, 'info', 'encounter_position_changed', {
                    adventureId: adventure.id,
                    sceneIndex,
                    encounterIndex: encIdx,
                    position: newPos
                });
                saveAdventuresToState();
                break;
            }
            default:
                console.warn(`[Adventures] Unknown timer trigger type: ${type}`);
        }
    });
}

// ============================================================
// RICH TEXT RENDERING (plain text → nice HTML)
// ============================================================

const RICH_TEXT_ALLOWED_TAGS = ['em', 'strong', 'i', 'b'];

function escapeTextKeepingAllowedTags(text) {
    const stashed = [];
    const tagPattern = new RegExp(`</?(?:${RICH_TEXT_ALLOWED_TAGS.join('|')})>`, 'gi');
    const withPlaceholders = String(text).replace(tagPattern, (match) => {
        stashed.push(match);
        return `\u0000${stashed.length - 1}\u0000`;
    });
    let escaped = escHtml(withPlaceholders);
    escaped = escaped.replace(/\u0000(\d+)\u0000/g, (_, i) => stashed[Number(i)]);
    return escaped;
}

function renderBracketAnnotations(html) {
    return html.replace(/\[([A-Za-z][A-Za-z ]{0,20}):\s*([^\]]+)\]/g, (match, label, detail) => `
        <span style="display:inline-block;margin:0.15rem 0.2rem 0.15rem 0;padding:0.1rem 0.5rem;background:var(--bg4);border-radius:10px;border-left:3px solid var(--gold);font-size:0.8rem;">
            <strong style="color:var(--gold);">${label}:</strong> ${detail}
        </span>
    `);
}

function renderMarkdownBold(html) {
    return html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

const POSITION_MARKERS = ['🌱', '🏔️', '👑', '🤝', '🌟', '⏱️', '♠️'];

function looksLikeCrownSpreadText(text) {
    return POSITION_MARKERS.filter(m => text.includes(m)).length >= 3;
}

function renderCrownSpreadHtml(text) {
    const splitPattern = /(?=(?:🌱|🏔️|👑|🤝|🌟|⏱️|♠️))/g;
    const rawSegments = text.split(splitPattern).map(s => s.trim()).filter(Boolean);

    const blocks = rawSegments.map(seg => {
        const marker = POSITION_MARKERS.find(m => seg.startsWith(m));
        const rest = marker ? seg.slice(marker.length).trim() : seg;
        const colonIdx = rest.indexOf(':');
        let label = '';
        let body = rest;
        if (colonIdx > -1 && colonIdx <= 25) {
            label = rest.slice(0, colonIdx).replace(/\*\*/g, '').trim();
            body = rest.slice(colonIdx + 1).replace(/^\*\*\s*/, '').trim();
        }

        const withChips = renderBracketAnnotations(renderMarkdownBold(escapeTextKeepingAllowedTags(body)));
        const isHighlight = marker === '🌟' || marker === '⏱️' || marker === '♠️';

        return `
            <div style="
                padding:0.5rem 0.7rem;margin:0.3rem 0;border-radius:8px;
                background:${isHighlight ? 'var(--bg4)' : 'var(--bg3)'};
                border-left:3px solid ${isHighlight ? 'var(--gold)' : 'var(--border)'};
            ">
                ${label ? `<div style="font-weight:600;color:var(--gold);margin-bottom:0.2rem;">${marker || ''} ${escHtml(label)}</div>` : ''}
                <div style="font-size:0.9rem;line-height:1.5;color:var(--text2);">${withChips}</div>
            </div>
        `;
    });

    return `<div class="crown-spread-reading">${blocks.join('')}</div>`;
}

function renderDescriptionHtml(text) {
    if (!text) return '';
    if (looksLikeCrownSpreadText(text)) {
        return renderCrownSpreadHtml(text);
    }
    const withChips = renderBracketAnnotations(renderMarkdownBold(escapeTextKeepingAllowedTags(text)));
    const paragraphs = withChips.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length <= 1) {
        return `<p style="margin:0.3rem 0;line-height:1.5;">${withChips}</p>`;
    }
    return paragraphs.map(p => `<p style="margin:0.3rem 0;line-height:1.5;">${p}</p>`).join('');
}

function plainTextPreview(text, maxLen = 160) {
    if (!text) return '';
    let plain = String(text)
        .replace(/<\/?[^>]+>/g, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\*\*/g, '')
        .replace(/[🌱🏔️👑🤝🌟⏱️♠️]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (plain.length > maxLen) plain = plain.slice(0, maxLen).trim() + '…';
    return plain;
}

function makeId(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function repairAdventureIds(adventure) {
    let repaired = false;
    if (!adventure.id) { adventure.id = makeId('adv_'); repaired = true; }
    (adventure.acts || []).forEach(act => {
        if (!act.id) { act.id = makeId('act_'); repaired = true; }
        (act.scenes || []).forEach(scene => {
            if (!scene.id) { scene.id = makeId('scene_'); repaired = true; }
        });
    });
    (adventure.npcs || []).forEach(npc => {
        if (!npc.id) { npc.id = makeId('npc_'); repaired = true; }
    });
    (adventure.locations || []).forEach(loc => {
        if (!loc.id) { loc.id = makeId('loc_'); repaired = true; }
    });
    (adventure.bestiary || []).forEach(creature => {
        if (!creature.id) { creature.id = makeId('creature_'); repaired = true; }
    });
    if (!adventure.timerIds) { adventure.timerIds = []; repaired = true; }
    return repaired;
}

// ============================================================
// DATA LOADING
// ============================================================

function loadAdventuresFromState() {
    const state = getState();
    if (state.adventures) {
        adventures = state.adventures;
        let anyRepaired = false;
        adventures.forEach(a => {
            if (repairAdventureIds(a)) anyRepaired = true;
            if (!Array.isArray(a.bestiary)) a.bestiary = [];
        });
        if (anyRepaired) {
            console.warn('[Adventures] Repaired empty ids on one or more previously-saved adventures.');
            saveAdventuresToState();
        }
        return adventures;
    }
    adventures = [];
    return adventures;
}

function saveAdventuresToState() {
    try {
        JSON.stringify(adventures);
        const state = getState();
        state.adventures = adventures;
        saveState();
        return true;
    } catch (e) {
        console.error('[Adventures] Failed to save adventures to storage:', e);
        showToast(`⚠️ Couldn't save adventures (${e.message}). Check the console — changes will NOT survive a refresh.`, 'error');
        return false;
    }
}

async function loadAdventureFromFile(adventureId) {
    const candidates = [
        `${ADVENTURES_DATA_PATH}${adventureId}.json`,
        `.${ADVENTURES_DATA_PATH}${adventureId}.json`,
    ];

    if (adventureId === 'lantern_at_dusk') {
        candidates.push(`${ADVENTURES_DATA_PATH}lantern_at_dusk.json`);
        candidates.push(`.${ADVENTURES_DATA_PATH}lantern_at_dusk.json`);
    }

    let lastError = null;
    for (const url of candidates) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                lastError = new Error(`HTTP ${response.status} at ${url}`);
                continue;
            }

            const text = await response.text();
            if (!text || text.trim() === '') {
                lastError = new Error(`Empty file at ${url}`);
                continue;
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                lastError = new Error(`Invalid JSON at ${url}: ${parseErr.message}`);
                continue;
            }

            if (!data.id) data.id = adventureId;

            if (!Array.isArray(data.acts)) data.acts = [];
            data.acts = data.acts.map(act => ({ ...act, scenes: Array.isArray(act.scenes) ? act.scenes : [] }));
            if (!Array.isArray(data.npcs)) data.npcs = [];
            if (!Array.isArray(data.locations)) data.locations = [];
            if (!Array.isArray(data.campaignTimers)) data.campaignTimers = [];
            if (!Array.isArray(data.bestiary)) data.bestiary = [];
            if (!data.timerIds) data.timerIds = [];
            repairAdventureIds(data);

            const existing = adventures.find(a => a.id === data.id);
            if (existing) {
                Object.assign(existing, data);
            } else {
                adventures.push(data);
            }
            saveAdventuresToState();
            return data;
        } catch (e) {
            lastError = e;
        }
    }

    console.warn(`[Adventures] Failed to load ${adventureId}:`, lastError);
    return null;
}

async function loadAdventureManifest() {
    const candidates = [
        `${ADVENTURES_DATA_PATH}manifest.json`,
        `.${ADVENTURES_DATA_PATH}manifest.json`,
    ];

    for (const url of candidates) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`[Adventures] Manifest fetch failed: ${url} → HTTP ${response.status}`);
                continue;
            }
            const manifest = await response.json();
            if (Array.isArray(manifest)) return manifest;
            if (Array.isArray(manifest?.adventures)) return manifest.adventures;
            console.warn(`[Adventures] ${url} loaded but had unexpected shape:`, manifest);
            return [];
        } catch (e) {
            console.warn(`[Adventures] Manifest fetch errored: ${url} →`, e);
        }
    }

    return null;
}

// ─── MODAL-BASED ADVENTURE LIBRARY BROWSER ──────────────────────

async function browseAdventureLibrary() {
    if (!isGM()) {
        showToast('Only the GM can browse the adventure library.', 'error');
        return;
    }

    const ids = await loadAdventureManifest();
    if (isDestroyed) return;

    if (ids === null) {
        showToast(
            `Couldn't reach manifest.json under ${ADVENTURES_DATA_PATH} (tried both absolute and relative paths). Check the server serves that folder.`,
            'error'
        );
        return;
    }

    if (ids.length === 0) {
        showToast(`${ADVENTURES_DATA_PATH}manifest.json was found, but the adventure list is empty.`, 'warning');
        return;
    }

    // Inline editor screen — not a pop-up. Takes over the page in place of
    // whatever's currently shown.
    const modal = document.createElement('div');
    modal.className = 'editor-screen-host';
    modal.style.cssText = `
        display: flex; align-items: center; justify-content: center;
        padding: 1rem 0; animation: fadeIn 0.2s ease;
    `;

    const content = document.createElement('div');
    content.className = 'editor-screen';
    content.style.cssText = `
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
    `;

    content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">
            <h3 style="margin:0;color:var(--gold);">📚 Adventure Library</h3>
            <span style="font-size:0.8rem;color:var(--text3);">${ids.length} available</span>
        </div>
        <p style="margin:0 0 0.8rem 0;font-size:0.85rem;color:var(--text2);">
            Click an adventure to load it into your library.
        </p>
        <div style="flex:1;overflow-y:auto;padding-right:0.3rem;">
            ${ids.map(id => `
                <div class="adv-library-item" data-slug="${escHtml(id)}" style="
                    padding:0.4rem 0.6rem;
                    margin:0.15rem 0;
                    background:var(--bg3);
                    border-radius:var(--radius);
                    cursor:pointer;
                    transition:all 0.15s;
                    border-left:3px solid transparent;
                    font-size:0.9rem;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                ">
                    <span>${escHtml(id)}</span>
                    <span style="font-size:0.6rem;color:var(--text3);">📄 JSON</span>
                </div>
            `).join('')}
        </div>
        <div style="margin-top:0.8rem;display:flex;justify-content:flex-end;">
            <button class="btn btn-sm btn-secondary" id="adv-library-cancel">← Back</button>
        </div>
    `;

    modal.appendChild(content);
    const hostContainer = document.getElementById('app-content') || document.body;
    const advLibraryHiddenSiblings = Array.from(hostContainer.children);
    advLibraryHiddenSiblings.forEach(ch => { ch.style.display = 'none'; });
    hostContainer.appendChild(modal);
    window.scrollTo({ top: 0 });

    const closeAdvLibrary = () => {
        modal.remove();
        advLibraryHiddenSiblings.forEach(ch => { ch.style.display = ''; });
    };

    if (!document.getElementById('adv-library-styles')) {
        const style = document.createElement('style');
        style.id = 'adv-library-styles';
        style.textContent = `
            .adv-library-item:hover {
                background: var(--bg4);
                border-left-color: var(--gold);
                transform: translateX(2px);
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    const cancelBtn = content.querySelector('#adv-library-cancel');
    cancelBtn.addEventListener('click', closeAdvLibrary);

    const items = content.querySelectorAll('.adv-library-item');
    items.forEach(item => {
        item.addEventListener('click', async function() {
            const slug = this.dataset.slug;
            this.style.opacity = '0.5';
            this.style.cursor = 'wait';
            this.innerHTML = `<span>${escHtml(slug)}</span><span style="font-size:0.6rem;color:var(--gold);">⏳ Loading…</span>`;

            const data = await loadAdventureFromFile(slug);
            if (isDestroyed) {
                closeAdvLibrary();
                return;
            }

            closeAdvLibrary();

            if (data) {
                showToast(`📚 Loaded "${data.title}" from the library.`, 'success');
                renderView();
            } else {
                showToast(`Failed to load "${slug}" — check ${ADVENTURES_DATA_PATH}${slug}.json exists and is valid JSON.`, 'error');
            }
        });
    });
}

function getAdventure(id) {
    return adventures.find(a => a.id === id);
}

function getActiveAdventure() {
    if (adventures.length === 0) loadAdventuresFromState();
    if (!activeAdventureId) return null;
    return getAdventure(activeAdventureId);
}

// ============================================================
// ADVENTURE CRUD (all guarded by isGM())
// ============================================================

function createAdventure(data) {
    if (!isGM()) {
        showToast('Only the GM can create adventures.', 'error');
        return null;
    }
    const acts = Array.isArray(data.acts) ? data.acts.map(act => ({
        ...act,
        scenes: Array.isArray(act.scenes) ? act.scenes : []
    })) : [];

    const adventure = {
        id: data.id || makeId('adv_'),
        title: data.title || 'Untitled Adventure',
        description: data.description || '',
        tier: data.tier || 'I',
        tierRange: data.tierRange || data.tier || 'I',
        author: data.author || 'GM',
        acts,
        npcs: Array.isArray(data.npcs) ? data.npcs : [],
        locations: Array.isArray(data.locations) ? data.locations : [],
        factions: Array.isArray(data.factions) ? data.factions : [],
        campaignTimers: Array.isArray(data.campaignTimers) ? data.campaignTimers : [],
        bestiary: Array.isArray(data.bestiary) ? data.bestiary : [],
        timerIds: [],
        notes: data.notes || '',
        currentAct: data.currentAct || 0,
        currentScene: data.currentScene || 0,
        startedAt: data.startedAt || null,
        completedAt: data.completedAt || null,
        status: data.status || 'planned',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    repairAdventureIds(adventure);

    try {
        JSON.parse(JSON.stringify(adventure));
    } catch (e) {
        console.error('[Adventures] createAdventure produced non-serializable data:', e, adventure);
        showToast(`⚠️ Adventure data couldn't be created (${e.message}). Check the console — nothing was saved.`, 'error');
        return null;
    }

    adventures.push(adventure);
    saveAdventuresToState();
    return adventure;
}

function updateAdventure(id, updates) {
    if (!isGM()) {
        showToast('Only the GM can update adventures.', 'error');
        return null;
    }
    const idx = adventures.findIndex(a => a.id === id);
    if (idx === -1) return null;
    adventures[idx] = { ...adventures[idx], ...updates, updatedAt: new Date().toISOString() };
    saveAdventuresToState();
    return adventures[idx];
}

function deleteAdventure(id) {
    if (!isGM()) return false;
    const idx = adventures.findIndex(a => a.id === id);
    if (idx === -1) return false;
    adventures.splice(idx, 1);
    if (activeAdventureId === id) activeAdventureId = null;
    saveAdventuresToState();
    return true;
}

function duplicateAdventure(id) {
    if (!isGM()) {
        showToast('Only the GM can duplicate adventures.', 'error');
        return null;
    }
    const original = getAdventure(id);
    if (!original) return null;
    const copy = JSON.parse(JSON.stringify(original));
    copy.id = makeId('adv_');
    copy.title = `${original.title} (Copy)`;
    copy.status = 'planned';
    copy.startedAt = null;
    copy.completedAt = null;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = new Date().toISOString();
    copy.timerIds = [];
    adventures.push(copy);
    saveAdventuresToState();
    return copy;
}

// ============================================================
// ADVENTURE PROGRESSION & TIMER INTEGRATION (all guarded)
// ============================================================

function startAdventure(id) {
    if (!isGM()) {
        showToast('Only the GM can start an adventure.', 'error');
        return null;
    }
    const adventure = getAdventure(id);
    if (!adventure) return null;
    adventure.status = 'active';
    adventure.startedAt = new Date().toISOString();
    adventure.currentAct = 0;
    adventure.currentScene = 0;
    adventure.acts.forEach(act => {
        act.scenes.forEach(scene => scene.completed = false);
    });
    adventure.campaignTimers.forEach(t => t.current = 0);
    saveAdventuresToState();

    const state = getState();
    if (!state.timers) state.timers = [];
    const newTimerIds = [];
    adventure.campaignTimers.forEach((timer, idx) => {
        const existingGlobalId = adventure.timerIds?.[idx];
        if (existingGlobalId) {
            const globalTimer = state.timers.find(gt => gt.id === existingGlobalId);
            if (globalTimer) {
                globalTimer.current = timer.current;
                globalTimer.segments = timer.segments;
                globalTimer.name = timer.name;
                globalTimer.description = timer.description || '';
                newTimerIds.push(existingGlobalId);
            } else {
                const newId = makeId('timer_');
                state.timers.push({
                    id: newId,
                    name: timer.name,
                    segments: timer.segments,
                    current: timer.current,
                    description: timer.description || '',
                    adventureId: adventure.id,
                    timerIndex: idx
                });
                newTimerIds.push(newId);
            }
        } else {
            const newId = makeId('timer_');
            state.timers.push({
                id: newId,
                name: timer.name,
                segments: timer.segments,
                current: timer.current,
                description: timer.description || '',
                adventureId: adventure.id,
                timerIndex: idx
            });
            newTimerIds.push(newId);
        }
    });
    adventure.timerIds = newTimerIds;
    saveState();

    activeAdventureId = id;

    logAdventureEvent(`🎭 Adventure started: ${adventure.title}`, 'warning', 'adventure_started', {
        id: adventure.id, title: adventure.title, tier: adventure.tier
    });
    broadcastSceneStatus(adventure);

    return adventure;
}

function completeScene(adventureId, actIndex, sceneIndex) {
    if (!isGM()) {
        showToast('Only the GM can complete scenes.', 'error');
        return null;
    }
    if (adventures.length === 0) loadAdventuresFromState();
    const adventure = getAdventure(adventureId);
    if (!adventure) return null;
    const act = adventure.acts[actIndex];
    if (!act) return null;
    const scene = act.scenes[sceneIndex];
    if (!scene) return null;
    scene.completed = true;

    logAdventureEvent(`📜 Scene completed: "${scene.title}" (${adventure.title})`, 'info', 'scene_completed', {
        adventureId: adventure.id, actIndex, sceneIndex, sceneTitle: scene.title
    });

    const nextScene = sceneIndex + 1;
    if (nextScene < act.scenes.length) {
        adventure.currentScene = nextScene;
    } else {
        const nextAct = actIndex + 1;
        if (nextAct < adventure.acts.length) {
            adventure.currentAct = nextAct;
            adventure.currentScene = 0;
            logAdventureEvent(`📖 Act completed: "${act.title}" (${adventure.title})`, 'warning', 'act_completed', {
                adventureId: adventure.id, actIndex, actTitle: act.title
            });
        } else {
            adventure.status = 'completed';
            adventure.completedAt = new Date().toISOString();
            logAdventureEvent(`🏁 Adventure completed: ${adventure.title}`, 'warning', 'adventure_completed', {
                adventureId: adventure.id, title: adventure.title
            });
        }
    }
    saveAdventuresToState();
    broadcastSceneStatus(adventure);
    return adventure;
}

function advanceTimer(adventureId, timerIndex, amount = 1) {
    if (!isGM()) {
        showToast('Only the GM can advance adventure timers.', 'error');
        return null;
    }
    const adventure = getAdventure(adventureId);
    if (!adventure) return null;
    const timer = adventure.campaignTimers[timerIndex];
    if (!timer) return null;
    const wasComplete = timer.current >= timer.segments;
    timer.current = Math.min(timer.current + amount, timer.segments);
    saveAdventuresToState();

    const globalId = adventure.timerIds?.[timerIndex];
    if (globalId) {
        const state = getState();
        const globalTimer = state.timers.find(t => t.id === globalId);
        if (globalTimer) {
            globalTimer.current = timer.current;
            saveState();
        }
    }

    if (timer.current >= timer.segments && !wasComplete) {
        showToast(`⏱️ Adventure Timer "${timer.name}" completed!`, 'warning');
        logAdventureEvent(`⏱️ Adventure Timer "${timer.name}" completed (${adventure.title})`, 'warning', 'adventure_timer_completed', {
            adventureId: adventure.id, timerName: timer.name
        });
        executeTimerTriggers(adventure, timer, 'campaign', { timerIndex });
        saveAdventuresToState();
    }

    broadcastTimerTick(timer.name, 'campaign', timerIndex, amount);
    return adventure;
}

function advanceSceneTimer(adventureId, actIndex, sceneIndex, timerIndex, amount = 1) {
    if (!isGM()) {
        showToast('Only the GM can advance scene timers.', 'error');
        return null;
    }
    const adventure = getAdventure(adventureId);
    if (!adventure) return null;
    const scene = adventure.acts?.[actIndex]?.scenes?.[sceneIndex];
    if (!scene || !Array.isArray(scene.timers)) return null;
    const timer = scene.timers[timerIndex];
    if (!timer) return null;
    const wasComplete = timer.current >= timer.segments;
    timer.current = Math.max(0, Math.min(timer.current + amount, timer.segments));
    saveAdventuresToState();
    if (timer.current >= timer.segments && !wasComplete) {
        showToast(`⏱️ Scene Timer "${timer.name}" completed!`, 'warning');
        logAdventureEvent(`⏱️ Scene Timer "${timer.name}" completed (${adventure.title} — ${scene.title})`, 'warning', 'adventure_scene_timer_completed', {
            adventureId: adventure.id, actIndex, sceneIndex, timerName: timer.name
        });
        executeTimerTriggers(adventure, timer, 'scene', { actIndex, sceneIndex, timerIndex });
        saveAdventuresToState();
    }
    broadcastTimerTick(timer.name, 'scene', timerIndex, amount);
    return adventure;
}

function resetAdventure(id) {
    if (!isGM()) {
        showToast('Only the GM can reset an adventure.', 'error');
        return null;
    }
    const adventure = getAdventure(id);
    if (!adventure) return null;
    adventure.status = 'planned';
    adventure.startedAt = null;
    adventure.completedAt = null;
    adventure.currentAct = 0;
    adventure.currentScene = 0;
    adventure.acts.forEach(act => {
        act.scenes.forEach(scene => scene.completed = false);
    });
    adventure.campaignTimers.forEach(t => t.current = 0);
    saveAdventuresToState();

    const state = getState();
    if (state.timers && adventure.timerIds) {
        adventure.timerIds.forEach(id => {
            const gt = state.timers.find(t => t.id === id);
            if (gt) gt.current = 0;
        });
        saveState();
    }

    logAdventureEvent(`🔄 Adventure reset: ${adventure.title}`, 'info', 'adventure_reset', { id: adventure.id, title: adventure.title });
    broadcastSceneStatus(null);
    return adventure;
}

// ============================================================
// HELPER: RESOLVE CREATURE FROM ADVENTURE BESTIARY OR GLOBAL
// ============================================================

async function resolveCreatureFromAdventure(adventure, ref) {
    if (!adventure) return null;
    if (!adventure.bestiary) adventure.bestiary = [];

    let creature = adventure.bestiary.find(c => c.id === ref);
    if (creature) return creature;

    creature = adventure.bestiary.find(c => (c.name || '').toLowerCase() === ref.toLowerCase());
    if (creature) return creature;

    try {
        const globalBestiary = await loadBestiaryData();
        if (Array.isArray(globalBestiary)) {
            let global = globalBestiary.find(c => c.id === ref);
            if (!global) global = globalBestiary.find(c => (c.name || '').toLowerCase() === ref.toLowerCase());
            if (global) return { ...global };
        }
    } catch (e) {
        console.warn('[Adventures] Could not load global bestiary for fallback:', e);
    }

    return null;
}

// ============================================================
// SCENE ↔ ENCOUNTER BRIDGE (UPDATED, guarded)
// ============================================================

async function startSceneEncounter(adventureId, actIndex, sceneIndex) {
    if (!isGM()) {
        showToast('Only the GM can start scene encounters.', 'error');
        return;
    }
    const adventure = getAdventure(adventureId);
    if (!adventure) {
        showToast('Adventure not found.', 'error');
        return;
    }
    const act = adventure.acts?.[actIndex];
    const scene = act?.scenes?.[sceneIndex];
    if (!scene) {
        showToast('Scene not found.', 'error');
        return;
    }

    const state = getState();
    if (!state.encounters) state.encounters = [];

    let encounter = scene.encounterId
        ? state.encounters.find(e => String(e.id) === String(scene.encounterId))
        : null;

    const adversaryPromises = (scene.encounters || []).map(async (entry) => {
        if (entry.creatureId) {
            const creature = await resolveCreatureFromAdventure(adventure, entry.creatureId);
            if (creature) {
                const stats = creature.stats || {};
                if (!stats.hp && creature.tl) stats.hp = creature.tl * 10 + 10;
                if (!stats.hp) stats.hp = 20;
                return {
                    name: creature.name || 'Adversary',
                    body: getCreatureDescription(creature) || '',
                    tier: creature.tl || 2,
                    tl: creature.tl,
                    class: creature.class || '',
                    category: creature.category || '',
                    stats: stats,
                    sb_spends: creature.sb_spends || [],
                    _sceneDv: entry.dv,
                    _scenePosition: entry.position,
                    _sceneOutcomes: entry.outcomes
                };
            } else {
                showToast(`⚠️ Creature "${entry.creatureId}" not found in adventure bestiary or global.`, 'warning');
                return null;
            }
        } else {
            return {
                name: entry.name || 'Adversary',
                body: entry.body || '',
                tier: entry.tl || entry.dv || 2,
                tl: entry.tl,
                class: entry.class || '',
                category: entry.category || '',
                stats: entry.stats || { hp: (entry.tl || 2) * 10 + 10 },
                sb_spends: entry.sb_spends || [],
                _sceneDv: entry.dv,
                _scenePosition: entry.position,
                _sceneOutcomes: entry.outcomes
            };
        }
    });

    const adversaryResults = await Promise.all(adversaryPromises);
    const adversaries = adversaryResults.filter(a => a !== null);

    if (!encounter) {
        encounter = {
            id: makeId('enc_'),
            title: `${scene.title} (${adventure.title})`,
            body: scene.description || '',
            difficulty: 2,
            location: '',
            status: 'active',
            type: scene.type || DEFAULT_OBJECTIVE_TYPE,
            customLabel: scene.customLabel || '',
            customTickLabel: scene.customTickLabel || '',
            adversaries,
            created: Date.now(),
            fromAdventureId: adventure.id,
            fromAdventureTitle: adventure.title,
            fromSceneTitle: scene.title
        };
        state.encounters.push(encounter);
        saveState();

        scene.encounterId = encounter.id;
        saveAdventuresToState();

        logAdventureEvent(`⚔️ Encounter "${encounter.title}" started from scene "${scene.title}"`, 'warning', 'encounter_created', {
            name: encounter.title, id: encounter.id, status: encounter.status, fromAdventure: adventure.id
        });
    } else {
        encounter.adversaries = adversaries;
        saveState();
    }

    if (isConnectedToServer()) {
        try {
            sendEvent({
                type: 'adventure-log',
                text: `⚔️ Encounter started: ${scene.title} (${adventure.title}) — ${adversaries.map(a => a.name).join(', ') || 'no adversaries'}`,
                author: 'GM'
            });
        } catch (e) { /* ignore */ }
    }

    try {
        const combat = await import('../encounters/combat.js');
        combat.openTracker(encounter.id);
    } catch (e) {
        console.warn('[Adventures] Failed to open Combat Tracker:', e);
        showToast('Combat Tracker not available.', 'error');
    }
}

function slugify(text) {
    const slug = String(text || 'adventure')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
    return slug || 'adventure';
}

function exportAdventure(id) {
    if (!isGM()) {
        showToast('Only the GM can export adventures.', 'error');
        return;
    }
    const adventure = getAdventure(id);
    if (!adventure) return;
    const data = JSON.stringify(adventure, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(adventure.title)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`📤 Exported "${adventure.title}"`, 'success');
}

/**
 * Normalize + merge an adventure content object into the local adventure
 * library and persist it. Shared by importAdventureFromFile() (manual
 * "Load from File") and installAdventureContent() (automated installs,
 * e.g. a GM/bot pushing a module over the wire — see
 * js/features/vtt/vtt-connected.js's 'module-push' handler).
 *
 * Re-syncs with persisted state first, so this is safe to call even if
 * this module was loaded a while ago in a tab that isn't the active one
 * (avoids clobbering changes made elsewhere with a stale in-memory copy).
 *
 * @param {object} data - adventure content (same shape as a
 *   data/adventures/*.json file: at minimum { title, acts: [...] }).
 * @param {{ confirmOverwrite?: boolean, silent?: boolean, sourceLabel?: string }} [options]
 * @returns {object} the normalized, installed adventure object.
 * @throws if `data` is missing a `title`.
 */
function installAdventureContent(data, options = {}) {
    const { confirmOverwrite = false, silent = false, sourceLabel = 'Imported' } = options;

    if (!data || typeof data !== 'object' || !data.title) {
        throw new Error('Invalid adventure format: missing "title".');
    }

    if (!Array.isArray(data.acts)) data.acts = [];
    data.acts = data.acts.map(act => ({ ...act, scenes: Array.isArray(act.scenes) ? act.scenes : [] }));
    if (!Array.isArray(data.npcs)) data.npcs = [];
    if (!Array.isArray(data.locations)) data.locations = [];
    if (!Array.isArray(data.campaignTimers)) data.campaignTimers = [];
    if (!Array.isArray(data.bestiary)) data.bestiary = [];
    if (!data.timerIds) data.timerIds = [];
    repairAdventureIds(data);

    // Round-trip through JSON to catch anything non-serializable before it
    // ever reaches persisted state.
    JSON.parse(JSON.stringify(data));

    loadAdventuresFromState();

    const existing = adventures.find(a => a.id === data.id);
    if (existing) {
        if (confirmOverwrite && !confirm(`Adventure "${data.title}" already exists. Overwrite?`)) {
            return null;
        }
        Object.assign(existing, data);
    } else {
        adventures.push(data);
    }

    const saved = saveAdventuresToState();
    if (saved && !silent) {
        showToast(`📥 ${sourceLabel}: "${data.title}"`, 'success');
    }
    return data;
}

/**
 * Remove a previously-installed adventure by id (e.g. in response to a
 * 'module-cleanup' broadcast). Silent no-op if it isn't present — cleanup
 * requests can arrive for a module this client never actually installed.
 */
function removeInstalledAdventure(id) {
    loadAdventuresFromState();
    const before = adventures.length;
    adventures = adventures.filter(a => a.id !== id);
    if (adventures.length !== before) {
        saveAdventuresToState();
        return true;
    }
    return false;
}

async function importAdventureFromFile() {
    if (!isGM()) {
        showToast('Only the GM can import adventures.', 'error');
        return null;
    }
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) { resolve(null); return; }
            try {
                const text = await file.text();
                if (!text || text.trim() === '') {
                    showToast('File is empty.', 'error');
                    resolve(null);
                    return;
                }
                let data;
                try {
                    data = JSON.parse(text);
                } catch (parseErr) {
                    showToast(`Invalid JSON: ${parseErr.message}`, 'error');
                    resolve(null);
                    return;
                }

                let installed;
                try {
                    installed = installAdventureContent(data, { confirmOverwrite: true, sourceLabel: 'Imported' });
                } catch (validationErr) {
                    showToast(validationErr.message, 'error');
                    resolve(null);
                    return;
                }
                resolve(installed);
            } catch (err) {
                showToast('Failed to import adventure: ' + err.message, 'error');
                resolve(null);
            }
        };
        input.click();
    });
}

// ============================================================
// CROWN SPREAD → ADVENTURE TEMPLATE (guarded)
// ============================================================

const CROWN_TEMPLATE_MARKERS = [
    { marker: '🌱', label: 'Root', role: 'npc' },
    { marker: '🏔️', label: 'Crest', role: 'location' },
    { marker: '👑', label: 'Crown', role: 'complication' },
    { marker: '🤝', label: 'Left Hand', role: 'reward' },
];
const CROWN_ALL_MARKERS = ['🌱', '🏔️', '👑', '🤝', '🌟', '⏱️', '♠️'];

function parseCrownCardSegment(body) {
    const segmentsMatch = body.match(/\((\d+)\s*segments if highest\)/i);
    const tierSegments = segmentsMatch ? parseInt(segmentsMatch[1], 10) : null;

    const cardLabelMatch = body.match(/^([A-Za-z0-9]+ of [A-Za-z]+)/);
    const cardLabel = cardLabelMatch ? cardLabelMatch[1] : null;

    const afterTierPrefix = body.replace(/^[^:]*:\s*/, '');
    const titleMatch = afterTierPrefix.match(/^([^:]{2,60}):\s*([\s\S]*)$/);
    const title = titleMatch ? titleMatch[1].trim() : null;
    let flavor = titleMatch ? titleMatch[2] : afterTierPrefix;
    flavor = flavor.replace(/\(\d+\s*segments if highest\)\.?\s*$/i, '').trim();

    return { cardLabel, title, flavor, tierSegments };
}

function parseCrownSpreadSynthesis(text) {
    const splitPattern = /(?=(?:🌱|🏔️|👑|🤝|🌟|⏱️|♠️))/g;
    const rawSegments = String(text || '').split(splitPattern).map(s => s.trim()).filter(Boolean);

    const positions = [];
    let wildcardText = null;
    let aceEffectText = null;
    let timerSegments = null;
    let timerCardLabel = null;

    for (const seg of rawSegments) {
        const marker = CROWN_ALL_MARKERS.find(m => seg.startsWith(m));
        const rest = marker ? seg.slice(marker.length).trim() : seg;
        const templateEntry = CROWN_TEMPLATE_MARKERS.find(t => t.marker === marker);

        if (templateEntry) {
            const colonIdx = rest.indexOf(':');
            const body = colonIdx > -1 && colonIdx <= 20 ? rest.slice(colonIdx + 1).trim() : rest;
            positions.push({ ...templateEntry, ...parseCrownCardSegment(body) });
        } else if (marker === '🌟') {
            wildcardText = rest.replace(/^Wildcard:\s*/i, '').trim();
        } else if (marker === '⏱️') {
            const segMatch = rest.match(/suggests a timer of (\d+) segments/i);
            const cardMatch = rest.match(/highest card \(([^)]+)\)/i);
            if (segMatch) timerSegments = parseInt(segMatch[1], 10);
            if (cardMatch) timerCardLabel = cardMatch[1];
        } else if (marker === '♠️') {
            aceEffectText = rest.replace(/^\*\*Ace Effect:\*\*\s*/i, '').trim();
        }
    }

    return { positions, wildcardText, aceEffectText, timerSegments, timerCardLabel };
}

function buildAdventureFromCrownSpread({ parsed, title, tier, region, cardNames }) {
    const findByRole = (role) => parsed.positions.find(p => p.role === role);
    const root = findByRole('npc');
    const crest = findByRole('location');
    const crown = findByRole('complication');
    const leftHand = findByRole('reward');

    const makeScene = (label, pos, fallbackTitle, extraDescription) => ({
        id: makeId('scene_'),
        title: `${label}: ${pos?.title || pos?.cardLabel || fallbackTitle}`,
        description: [pos?.flavor, extraDescription].filter(Boolean).join('\n\nWildcard Twist: '),
        timers: [{ name: `${pos?.cardLabel || label} Timer`, segments: pos?.tierSegments || 4, current: 0 }],
        encounters: [],
        type: DEFAULT_OBJECTIVE_TYPE,
        completed: false
    });

    const scenes = [];
    if (root) scenes.push(makeScene('Root', root, 'The Actor'));
    if (crest) scenes.push(makeScene('Crest', crest, 'The Location'));
    if (crown) scenes.push(makeScene('Crown', crown, 'The Confrontation', parsed.wildcardText));
    if (leftHand) scenes.push(makeScene('Left Hand', leftHand, 'The Anchor'));

    const npcs = root ? [{
        id: makeId('npc_'),
        name: root.title || root.cardLabel || 'The Actor',
        role: 'Root — Actor (Crown Spread)',
        motivation: root.flavor || ''
    }] : [];

    const locations = crest ? [{
        id: makeId('loc_'),
        name: crest.title || crest.cardLabel || 'The Location',
        description: crest.flavor || ''
    }] : [];

    const campaignTimers = parsed.timerSegments ? [{
        name: `Adventure Clock (${parsed.timerCardLabel || 'highest card'})`,
        segments: parsed.timerSegments,
        current: 0,
        description: 'Derived from the highest non-wildcard card in the reading — the pressure driving this adventure.'
    }] : [];

    const notesParts = [`Crown Spread reading — Region: ${region || 'Unknown'}. Cards: ${cardNames || 'Unknown'}.`];
    if (parsed.aceEffectText) notesParts.push(`Ace Effect (GM aside): ${parsed.aceEffectText}`);

    return {
        title,
        description: `A Tier ${tier} adventure drawn from a Crown Spread reading in ${region || 'an unknown region'}.`,
        tier,
        tierRange: tier,
        author: 'Crown Spread Import',
        acts: [{
            id: makeId('act_'),
            title: 'The Reading Unfolds',
            description: 'Structured from a Crown Spread: Root sets the actor, Crest sets the place, Crown is the confrontation, Left Hand is what anchors the party through it.',
            scenes
        }],
        npcs,
        locations,
        campaignTimers,
        bestiary: [],
        notes: notesParts.join('\n\n'),
        status: 'planned'
    };
}

async function importCrownSpreadAsAdventure() {
    if (!isGM()) {
        showToast('Only the GM can import Crown Spread as adventure.', 'error');
        return null;
    }
    let decks;
    try {
        decks = await import('../decks/index.js');
    } catch (e) {
        showToast('Decks module not available.', 'error');
        return null;
    }
    if (isDestroyed) return null;

    let cardNames = null;
    let synthesis = null;
    let region = decks.getSelectedRegion ? decks.getSelectedRegion() : null;

    try {
        const history = decks.getDeckHistory ? decks.getDeckHistory() : [];
        const recent = [...history].reverse().find(e => e.type === 'Crown Spread');
        if (recent) {
            cardNames = recent.cards;
            synthesis = recent.synthesis;
        }
    } catch (e) { /* ignore */ }

    if (!synthesis) {
        if (!region) {
            const regions = decks.getRegionNames ? decks.getRegionNames() : [];
            if (regions.length === 0) {
                showToast('No regions available yet — open the Decks tab once so it can discover region files, then come back here.', 'warning');
                return null;
            }
            const listText = regions.map((r, i) => `${i + 1}. ${r}`).join('\n');
            const choice = prompt(`No Crown Spread found yet, and no region selected in Decks.\nPick a region to draw one now:\n${listText}`);
            if (!choice) return null;
            const idx = parseInt(choice, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= regions.length) {
                showToast('Invalid selection.', 'error');
                return null;
            }
            region = regions[idx];
        }

        const drawResult = await decks.quickCrownSpread(region);
        if (isDestroyed) return null;
        if (!drawResult) return null;
        cardNames = drawResult.cardNames;
        synthesis = drawResult.result.synthesis;
    }

    return createAdventureFromCrownSpreadReading({ synthesis, cardNames, region });
}

function createAdventureFromCrownSpreadReading({ synthesis, cardNames, region, title, tier } = {}) {
    if (!isGM()) {
        showToast('Only the GM can create adventures from Crown Spread.', 'error');
        return null;
    }
    if (!synthesis) {
        showToast('No Crown Spread reading to build from.', 'error');
        return null;
    }

    const finalTitle = title || prompt('Adventure title:', 'Crown Spread Adventure') || 'Crown Spread Adventure';
    const finalTier = tier || prompt('Tier (I-V):', 'I') || 'I';

    const parsed = parseCrownSpreadSynthesis(synthesis);
    const templateData = parsed.positions.length > 0
        ? buildAdventureFromCrownSpread({ parsed, title: finalTitle, tier: finalTier, region, cardNames })
        : {
            title: finalTitle,
            description: region ? `${synthesis}\n\n(Cards: ${cardNames} — Region: ${region})` : synthesis,
            tier: finalTier,
            tierRange: finalTier,
            author: 'Crown Spread Import',
            acts: [{
                id: makeId('act_'),
                title: 'The Reading Unfolds',
                description: synthesis,
                scenes: [{
                    id: makeId('scene_'),
                    title: 'Opening Scene',
                    description: synthesis,
                    timers: [{ name: 'Adventure Clock', segments: 6, current: 0 }],
                    encounters: [],
                    type: DEFAULT_OBJECTIVE_TYPE,
                    completed: false
                }]
            }],
            campaignTimers: [{ name: 'Adventure Clock', segments: 8, current: 0, description: 'Overall adventure pace' }],
            bestiary: [],
            status: 'planned'
        };

    const adventure = createAdventure(templateData);
    if (!adventure) return null;

    exportAdventure(adventure.id);

    activeAdventureId = adventure.id;
    adventureViewMode = 'detail';
    renderView();

    showToast(`👑 Built "${adventure.title}" from the Crown Spread and opened it for editing.`, 'success');
    return adventure;
}

// ============================================================
// RENDER (with role‑based gating)
// ============================================================

function render(el) {
    container = el;
    isDestroyed = false;
    loadAdventuresFromState();
    renderView();
}

function renderView() {
    if (!container || isDestroyed) return;

    if (adventureViewMode === 'detail' && activeAdventureId) {
        container.innerHTML = renderAdventureDetail(activeAdventureId);
    } else if (adventureViewMode === 'create') {
        if (!isGM()) {
            showToast('Only the GM can create adventures.', 'error');
            adventureViewMode = 'list';
            renderView();
            return;
        }
        container.innerHTML = renderCreateAdventure();
        attachCreateEvents();
    } else {
        container.innerHTML = renderAdventureList();
        attachEvents();
    }
}

function renderAdventureList() {
    const hasAdventures = adventures.length > 0;
    const canEdit = isGM();

    return `
        <div class="adventures-modern-layout flex flex-col gap-2">
            <header class="adventures-header">
                <h1 class="page-title">🎭 Adventures</h1>
                <p class="page-sub">Load, track, and manage your Fate's Edge adventures.</p>
            </header>

            <div class="flex gap-1 flex-center flex-wrap" style="border-bottom:1px solid var(--border);padding-bottom:0.5rem;">
                ${canEdit ? `
                    <button class="btn btn-sm btn-gold" id="adv-browse-library-btn">📚 Browse Library</button>
                    <button class="btn btn-sm btn-secondary" id="adv-load-file-btn">📂 Load from File</button>
                    <button class="btn btn-sm btn-primary" id="adv-create-btn">✨ New Adventure</button>
                    <button class="btn btn-sm btn-secondary" id="adv-crown-gen-btn">👑 Import Crown Spread</button>
                ` : `
                    <span style="font-size:0.75rem;color:var(--text3);">🔒 Read‑only – only the GM can manage adventures.</span>
                `}
                <button class="btn btn-sm btn-secondary" id="adv-refresh-btn">🔄 Refresh</button>
            </div>

            <div class="panel" style="min-height:300px;">
                ${hasAdventures ? `
                    <div class="flex flex-col gap-1">
                        ${adventures.map(a => renderAdventureCardSafe(a, canEdit)).join('')}
                    </div>
                ` : `
                    <div class="text-center" style="padding:2rem 0;">
                        <div style="font-size:3rem;">🎭</div>
                        <p class="text-muted">No adventures loaded yet.</p>
                        ${canEdit ? `
                            <p class="text-sm text-muted">Click "Browse Library" to pick one from /data/adventures/, "Load from File" to import your own, or create a new one.</p>
                            <div class="flex gap-1 flex-center mt-1">
                                <button class="btn btn-sm btn-gold" id="adv-load-file-btn">📂 Load from File</button>
                                <button class="btn btn-sm btn-secondary" id="adv-crown-gen-btn">👑 Import Crown Spread</button>
                            </div>
                        ` : `
                            <p class="text-sm text-muted">No adventures available. Only the GM can add them.</p>
                        `}
                    </div>
                `}
            </div>

            <div class="panel" style="background:var(--bg2);border-left:4px solid var(--gold);font-size:0.75rem;color:var(--text3);">
                <strong>💡 Adventure Format:</strong> Adventures are stored in <code>/data/adventures/</code> as JSON files.
                Each adventure contains acts, scenes, timers, NPCs, locations, and a bestiary (creatures for encounters).
                Crown Spread generation creates a structured adventure from a card draw.
            </div>
        </div>
    `;
}

function renderAdventureCardSafe(adventure, canEdit) {
    try {
        return renderAdventureCard(adventure, canEdit);
    } catch (e) {
        console.error('[Adventures] Failed to render adventure card:', adventure?.id, e);
        const deleteBtn = canEdit ? `<button class="btn btn-xs btn-danger" onclick="window.adventureDelete('${adventure?.id}')">🗑️ Remove</button>` : '';
        return `
            <div class="panel" style="padding:0.6rem 0.8rem;border-left:4px solid var(--red);">
                <div style="font-weight:600;color:var(--red);">⚠️ "${escHtml(adventure?.title || adventure?.id || 'Unknown adventure')}" failed to render</div>
                <div style="font-size:0.75rem;color:var(--text3);margin:0.2rem 0;">${escHtml(e.message)} — see browser console for details.</div>
                <div style="display:flex;gap:0.3rem;">
                    ${canEdit ? `<button class="btn btn-xs btn-secondary" onclick="window.adventureExport('${adventure?.id}')">📤 Export raw data</button>` : ''}
                    ${deleteBtn}
                </div>
            </div>
        `;
    }
}

function renderAdventureCard(adventure, canEdit) {
    const statusColors = {
        'planned': 'var(--text3)',
        'active': 'var(--gold)',
        'completed': 'var(--green)',
        'archived': 'var(--text2)'
    };
    const statusLabels = {
        'planned': '📋 Planned',
        'active': '🔄 Active',
        'completed': '✅ Completed',
        'archived': '📦 Archived'
    };
    const tierColors = {
        'I': '#8bc34a',
        'II': '#4caf50',
        'III': '#ff9800',
        'IV': '#e91e63',
        'V': '#9c27b0'
    };

    const actCount = adventure.acts?.length || 0;
    const sceneCount = adventure.acts?.reduce((acc, act) => acc + (act.scenes?.length || 0), 0) || 0;
    const completedScenes = adventure.acts?.reduce((acc, act) => acc + (act.scenes?.filter(s => s.completed).length || 0), 0) || 0;
    const progress = sceneCount > 0 ? Math.round((completedScenes / sceneCount) * 100) : 0;

    const deleteBtn = canEdit ? `<button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();window.adventureDelete('${adventure.id}')" style="color:var(--red);">✕</button>` : '';

    return `
        <div class="panel" style="padding:0.6rem 0.8rem;border-left:4px solid ${statusColors[adventure.status] || 'var(--border)'};cursor:pointer;" data-adv-id="${adventure.id}" onclick="window.adventureOpenDetail('${adventure.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:0.95rem;">${escHtml(adventure.title)}</span>
                    <span style="font-size:0.65rem;padding:0.05rem 0.4rem;border-radius:8px;background:${tierColors[adventure.tier] || 'var(--text3)'}33;border:1px solid ${tierColors[adventure.tier] || 'var(--text3)'};color:${tierColors[adventure.tier] || 'var(--text3)'};">Tier ${adventure.tier}</span>
                    <span style="font-size:0.6rem;padding:0.05rem 0.4rem;border-radius:8px;background:${statusColors[adventure.status]}33;border:1px solid ${statusColors[adventure.status]};color:${statusColors[adventure.status]};">${statusLabels[adventure.status]}</span>
                </div>
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    <span style="font-size:0.65rem;color:var(--text3);">${actCount} acts · ${sceneCount} scenes</span>
                    <span style="font-size:0.65rem;color:var(--text3);">${progress}% done</span>
                    ${deleteBtn}
                </div>
            </div>
            ${adventure.description ? `<div style="font-size:0.75rem;color:var(--text2);margin-top:0.1rem;">${escHtml(plainTextPreview(adventure.description))}</div>` : ''}
            <div style="display:flex;gap:0.2rem;flex-wrap:wrap;margin-top:0.2rem;">
                ${adventure.acts?.slice(0, 3).map(act => `
                    <span style="font-size:0.55rem;padding:0.05rem 0.3rem;border-radius:6px;background:var(--bg3);color:var(--text3);">${escHtml(act.title)}</span>
                `).join('')}
                ${(adventure.acts?.length || 0) > 3 ? `<span style="font-size:0.55rem;padding:0.05rem 0.3rem;border-radius:6px;background:var(--bg3);color:var(--text3);">+${adventure.acts.length - 3} more</span>` : ''}
            </div>
            <div style="margin-top:0.2rem;display:flex;gap:0.2rem;font-size:0.6rem;color:var(--text3);">
                ${adventure.startedAt ? `<span>📅 Started: ${new Date(adventure.startedAt).toLocaleDateString()}</span>` : ''}
                ${adventure.completedAt ? `<span>✅ Completed: ${new Date(adventure.completedAt).toLocaleDateString()}</span>` : ''}
                <span>👤 ${escHtml(adventure.author || 'Unknown')}</span>
            </div>
        </div>
    `;
}

function buildAdventureDetailHtml(adventure) {
    const canEdit = isGM();
    const statusColors = {
        'planned': 'var(--text3)',
        'active': 'var(--gold)',
        'completed': 'var(--green)',
        'archived': 'var(--text2)'
    };
    const statusLabels = {
        'planned': '📋 Planned',
        'active': '🔄 Active',
        'completed': '✅ Completed',
        'archived': '📦 Archived'
    };
    const tierColors = {
        'I': '#8bc34a',
        'II': '#4caf50',
        'III': '#ff9800',
        'IV': '#e91e63',
        'V': '#9c27b0'
    };

    const actCount = adventure.acts?.length || 0;
    const sceneCount = adventure.acts?.reduce((acc, act) => acc + (act.scenes?.length || 0), 0) || 0;
    const completedScenes = adventure.acts?.reduce((acc, act) => acc + (act.scenes?.filter(s => s.completed).length || 0), 0) || 0;
    const progress = sceneCount > 0 ? Math.round((completedScenes / sceneCount) * 100) : 0;
    const isActive = adventure.status === 'active';

    // ─── Timers ────────────────────────────────────────────────────
    const timersHtml = adventure.campaignTimers?.map((t, idx) => `
        <div class="flex gap-1 flex-center" style="margin:0.1rem 0;">
            <span class="flex-1 text-sm">${escHtml(t.name)}</span>
            <span style="font-size:0.65rem;color:var(--text2);">${t.description || ''}</span>
            <div style="flex:1;background:var(--bg3);border-radius:var(--radius);height:6px;overflow:hidden;max-width:120px;">
                <div style="width:${(t.current / t.segments) * 100}%;height:100%;background:${(t.current / t.segments) > 0.8 ? 'var(--red)' : 'var(--gold)'};"></div>
            </div>
            <span class="text-xs text-muted">${t.current}/${t.segments}</span>
            ${canEdit ? `<button class="btn btn-xs btn-primary" onclick="window.adventureAdvanceTimer('${adventure.id}', ${idx})">+1</button>` : ''}
        </div>
    `).join('') || '<span class="text-muted text-sm">No campaign timers.</span>';

    // ─── Acts & Scenes ────────────────────────────────────────────
    const actsHtml = adventure.acts?.map((act, actIdx) => {
        const scenesHtml = act.scenes?.map((scene, sceneIdx) => {
            const isCurrent = actIdx === adventure.currentAct && sceneIdx === adventure.currentScene;
            const isCompleted = scene.completed;
            const descId = `scene-desc-${adventure.id}-${actIdx}-${sceneIdx}`;

            // Scene timer controls – only if current and editable
            const timerControls = scene.timers?.map((t, timerIdx) => `
                <span style="font-size:0.55rem;color:var(--text3);display:inline-flex;align-items:center;gap:0.15rem;">
                    ${escHtml(t.name)} ${t.current}/${t.segments}
                    ${isCurrent && canEdit ? `<button class="btn btn-xs btn-ghost" style="padding:0 0.2rem;font-size:0.55rem;" onclick="window.adventureAdvanceSceneTimer('${adventure.id}', ${actIdx}, ${sceneIdx}, ${timerIdx})" title="Tick +1">+1</button>` : ''}
                </span>
            `).join('') || '';

            const startEncBtn = isCurrent && canEdit
                ? `<button class="btn btn-xs btn-danger" onclick="window.adventureStartEncounter('${adventure.id}', ${actIdx}, ${sceneIdx})" title="${scene.encounterId ? 'Reopen the Combat Tracker for this scene' : 'Create an Encounter from this scene and open the Combat Tracker'}">⚔️ ${scene.encounterId ? 'Resume' : 'Start'} Encounter</button>`
                : '';

            const completeBtn = !isCompleted && isCurrent && canEdit
                ? `<button class="btn btn-xs btn-primary" onclick="window.adventureCompleteScene('${adventure.id}', ${actIdx}, ${sceneIdx})">✓ Complete</button>`
                : '';

            return `
                <div style="display:flex;flex-direction:column;padding:0.1rem 0.2rem;border-radius:4px;${isCurrent ? 'background:var(--bg4);border-left:3px solid var(--gold);' : ''}${isCompleted ? 'opacity:0.6;' : ''}">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="display:flex;align-items:center;gap:0.3rem;">
                            <span style="font-size:0.8rem;">${isCompleted ? '✅' : isCurrent ? '▶️' : '⏹️'}</span>
                            <span style="font-size:0.75rem;${isCurrent ? 'font-weight:600;color:var(--gold);' : ''}">${escHtml(scene.title)}</span>
                            <span style="font-size:0.65rem;color:var(--text3);" title="${escHtml(getObjectiveType(scene.type).description)}">${getObjectiveType(scene.type).icon} ${escHtml(getObjectiveType(scene.type).label)}</span>
                            ${scene.description ? `<button class="btn btn-xs btn-ghost" onclick="window.adventureToggleSceneDesc('${descId}')" title="Show/hide scene description" style="padding:0 0.3rem;font-size:0.7rem;">📖</button>` : ''}
                        </div>
                        <div style="display:flex;gap:0.2rem;align-items:center;">
                            ${timerControls}
                            ${startEncBtn}
                            ${completeBtn}
                        </div>
                    </div>
                    ${scene.description ? `<div id="${descId}" style="display:none;margin:0.2rem 0 0.3rem 1.3rem;font-size:0.75rem;">${renderDescriptionHtml(scene.description)}</div>` : ''}
                </div>
            `;
        }).join('') || '<span class="text-muted text-sm">No scenes.</span>';

        return `
            <div class="panel" style="background:var(--bg3);border-left:3px solid var(--gold);padding:0.3rem 0.5rem;margin:0.2rem 0;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:0.85rem;">${escHtml(act.title)}</span>
                    <span style="font-size:0.65rem;color:var(--text3);">${act.scenes?.length || 0} scenes</span>
                </div>
                ${act.description ? `<div style="font-size:0.7rem;">${renderDescriptionHtml(act.description)}</div>` : ''}
                <div style="margin-top:0.2rem;display:flex;flex-direction:column;gap:0.1rem;padding-left:0.3rem;">
                    ${scenesHtml}
                </div>
            </div>
        `;
    }).join('') || '<span class="text-muted text-sm">No acts defined.</span>';

    // ─── NPCs ─────────────────────────────────────────────────────
    const npcsHtml = adventure.npcs?.map(npc => `
        <div class="panel" style="background:var(--bg3);padding:0.2rem 0.4rem;margin:0.1rem 0;border-left:2px solid var(--gold);">
            <span style="font-weight:600;font-size:0.8rem;">${escHtml(npc.name)}</span>
            ${npc.role ? `<span style="font-size:0.65rem;color:var(--text3);"> — ${escHtml(npc.role)}</span>` : ''}
            ${npc.motivation ? `<div style="font-size:0.65rem;color:var(--text2);">🎯 ${escHtml(npc.motivation)}</div>` : ''}
        </div>
    `).join('') || '<span class="text-muted text-sm">No NPCs.</span>';

    // ─── Locations ────────────────────────────────────────────────
    const locationsHtml = adventure.locations?.map(loc => `
        <div class="panel" style="background:var(--bg3);padding:0.2rem 0.4rem;margin:0.1rem 0;border-left:2px solid var(--blue);">
            <span style="font-weight:600;font-size:0.8rem;">📍 ${escHtml(loc.name)}</span>
            ${loc.description ? `<div style="font-size:0.65rem;color:var(--text2);">${escHtml(loc.description)}</div>` : ''}
        </div>
    `).join('') || '<span class="text-muted text-sm">No locations.</span>';

    // ─── Bestiary ─────────────────────────────────────────────────
    const bestiaryHtml = (adventure.bestiary || []).map(creature => `
        <div class="panel" style="background:var(--bg3);padding:0.2rem 0.4rem;margin:0.1rem 0;border-left:2px solid var(--red);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
            <div>
                <span style="font-weight:600;font-size:0.8rem;">${escHtml(creature.name)}</span>
                ${creature.tl ? `<span style="font-size:0.6rem;color:var(--red);">TL${creature.tl}</span>` : ''}
                ${creature.class ? `<span style="font-size:0.6rem;color:var(--accent);">${escHtml(creature.class)}</span>` : ''}
                ${creature.category ? `<span style="font-size:0.6rem;color:var(--text3);">${escHtml(creature.category)}</span>` : ''}
                ${creature.description ? `<div style="font-size:0.65rem;color:var(--text2);">${escHtml(creature.description.slice(0,60))}${creature.description.length>60?'…':''}</div>` : ''}
            </div>
            ${canEdit ? `<button class="btn btn-xs btn-danger" onclick="window.adventureRemoveBestiaryCreature('${adventure.id}','${creature.id}')">✕</button>` : ''}
        </div>
    `).join('') || '<span class="text-muted text-sm">No creatures in adventure bestiary. Add some to use in encounters.</span>';

    // ─── GM Hints ─────────────────────────────────────────────────
    // GM-only tonal/pacing guidance authored alongside the adventure.
    // Not every adventure has it (older/simpler ones don't), and it's
    // deliberately hidden from players — same gate as the edit tools.
    const gmHints = adventure._gmhints;
    const gmHintsPreview = gmHints?.tone
        ? `${gmHints.tone.slice(0, 140)}${gmHints.tone.length > 140 ? '…' : ''}`
        : '';
    const gmHintsHtml = (canEdit && gmHints) ? `
        <div class="panel" style="border-left:2px solid var(--accent);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h4 style="margin:0;font-size:0.9rem;">🧭 GM Hints</h4>
                <button class="btn btn-xs btn-secondary" onclick="window.adventureOpenGmHints('${adventure.id}')">Expand ↗</button>
            </div>
            ${gmHintsPreview ? `<div style="font-size:0.7rem;color:var(--text2);margin-top:0.2rem;">${escHtml(gmHintsPreview)}</div>` : `<div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">Pacing notes available — click Expand to view.</div>`}
        </div>
    ` : '';

    // ─── Notes ────────────────────────────────────────────────────
    const notesEditor = canEdit
        ? `<textarea id="adv-notes" rows="3" style="width:100%;font-size:0.75rem;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;">${escHtml(adventure.notes || '')}</textarea>
           <button class="btn btn-xs btn-primary mt-1" onclick="window.adventureSaveNotes('${adventure.id}')">💾 Save Notes</button>`
        : `<div style="font-size:0.75rem;color:var(--text2);white-space:pre-wrap;">${escHtml(adventure.notes || '')}</div>`;

    // ─── Action buttons ───────────────────────────────────────────
    const actionButtons = canEdit ? `
        ${!isActive && adventure.status !== 'completed' ? `<button class="btn btn-sm btn-gold" onclick="window.adventureStart('${adventure.id}')">▶️ Start</button>` : ''}
        ${isActive ? `<button class="btn btn-sm btn-secondary" onclick="window.adventureReset('${adventure.id}')">🔄 Reset</button>` : ''}
        <button class="btn btn-sm btn-secondary" onclick="window.adventureExport('${adventure.id}')">📤 Export</button>
        <button class="btn btn-sm btn-secondary" onclick="window.adventureDuplicate('${adventure.id}')">📋 Duplicate</button>
        <button class="btn btn-sm btn-danger" onclick="window.adventureDelete('${adventure.id}')">🗑️ Delete</button>
    ` : `
        <span style="font-size:0.75rem;color:var(--text3);">🔒 Read‑only – only the GM can manage this adventure.</span>
    `;

    return `
        <div class="adventure-detail flex flex-col gap-2">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button>
                    <span style="font-weight:600;font-size:1.1rem;color:var(--gold);">${escHtml(adventure.title)}</span>
                    <span style="font-size:0.65rem;padding:0.05rem 0.4rem;border-radius:8px;background:${tierColors[adventure.tier] || 'var(--text3)'}33;border:1px solid ${tierColors[adventure.tier] || 'var(--text3)'};color:${tierColors[adventure.tier] || 'var(--text3)'};">Tier ${adventure.tier}</span>
                    <span style="font-size:0.6rem;padding:0.05rem 0.4rem;border-radius:8px;background:${statusColors[adventure.status]}33;border:1px solid ${statusColors[adventure.status]};color:${statusColors[adventure.status]};">${statusLabels[adventure.status]}</span>
                </div>
                <div style="display:flex;gap:0.2rem;flex-wrap:wrap;">
                    ${actionButtons}
                </div>
            </div>

            ${adventure.description ? `<div style="font-size:0.85rem;padding:0.2rem 0;">${renderDescriptionHtml(adventure.description)}</div>` : ''}

            <div style="display:grid;grid-template-columns:2fr 1fr;gap:0.5rem;">
                <div class="flex flex-col gap-1">
                    <div class="panel">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                            <h4 style="margin:0;font-size:0.9rem;">📜 Progress</h4>
                            <span style="font-size:0.75rem;color:var(--text3);">${completedScenes}/${sceneCount} scenes · ${progress}%</span>
                        </div>
                        <div style="width:100%;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-top:0.2rem;">
                            <div style="width:${progress}%;height:100%;background:${progress > 80 ? 'var(--green)' : progress > 50 ? 'var(--gold)' : 'var(--blue)'};border-radius:4px;"></div>
                        </div>
                    </div>

                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">⏱️ Campaign Timers</h4>
                        ${timersHtml}
                    </div>

                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">📖 Acts & Scenes</h4>
                        ${actsHtml}
                    </div>
                </div>

                <div class="flex flex-col gap-1">
                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">👤 NPCs</h4>
                        <div style="max-height:200px;overflow-y:auto;">${npcsHtml}</div>
                    </div>

                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">📍 Locations</h4>
                        <div style="max-height:150px;overflow-y:auto;">${locationsHtml}</div>
                    </div>

                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">🐉 Bestiary (Adventure Creatures)</h4>
                        <div style="max-height:200px;overflow-y:auto;margin-bottom:0.3rem;">${bestiaryHtml}</div>
                        ${canEdit ? `<button class="btn btn-xs btn-secondary" onclick="window.adventureAddBestiaryCreature('${adventure.id}')">+ Add Creature</button>` : ''}
                    </div>

                    ${gmHintsHtml}

                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">📝 Notes</h4>
                        ${notesEditor}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderAdventureDetail(adventureId) {
    const adventure = getAdventure(adventureId);
    if (!adventure) {
        return `<div class="panel"><p class="text-muted">Adventure not found.</p><button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button></div>`;
    }
    try {
        return buildAdventureDetailHtml(adventure);
    } catch (e) {
        console.error('[Adventures] Failed to render adventure detail:', adventureId, e);
        const canEdit = isGM();
        return `
            <div class="panel">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                    <button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button>
                </div>
                <p style="color:var(--red);font-weight:600;">⚠️ This adventure failed to render: ${escHtml(e.message)}</p>
                <p class="text-muted" style="font-size:0.75rem;">Check the browser console for the full error. The underlying data is still there — Export to inspect the raw JSON, or Delete to remove it.</p>
                <div style="display:flex;gap:0.5rem;">
                    ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="window.adventureExport('${adventureId}')">📤 Export</button>` : ''}
                    ${canEdit ? `<button class="btn btn-sm btn-danger" onclick="window.adventureDelete('${adventureId}')">🗑️ Delete</button>` : ''}
                </div>
            </div>
        `;
    }
}

function renderCreateAdventure() {
    // This is only called when isGM() returns true (see renderView guard)
    return `
        <div class="adventure-create flex flex-col gap-2">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <h2 style="margin:0;font-size:1.1rem;color:var(--gold);">✨ Create New Adventure</h2>
                <button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button>
            </div>

            <div class="panel">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div>
                        <label style="font-size:0.75rem;font-weight:600;">Title *</label>
                        <input id="adv-create-title" placeholder="Adventure title" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;" />
                    </div>
                    <div>
                        <label style="font-size:0.75rem;font-weight:600;">Tier</label>
                        <select id="adv-create-tier" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;">
                            <option value="I">I — Novice</option>
                            <option value="II">II — Seasoned</option>
                            <option value="III" selected>III — Veteran</option>
                            <option value="IV">IV — Paragon</option>
                            <option value="V">V — Mythic</option>
                        </select>
                    </div>
                </div>
                <div style="margin-top:0.3rem;">
                    <label style="font-size:0.75rem;font-weight:600;">Description</label>
                    <textarea id="adv-create-description" rows="2" placeholder="Adventure description" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;"></textarea>
                </div>
            </div>

            <div class="panel">
                <h4 style="margin:0;font-size:0.85rem;">📖 Acts & Scenes</h4>
                <p style="font-size:0.7rem;color:var(--text3);">Each act contains scenes. Add acts and scenes to structure your adventure.</p>
                <div id="adv-create-acts-container"></div>
                <button class="btn btn-sm btn-secondary mt-1" id="adv-add-act-btn">+ Add Act</button>
            </div>

            <div class="panel">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div>
                        <h4 style="margin:0;font-size:0.85rem;">👤 NPCs</h4>
                        <div id="adv-create-npcs-container"></div>
                        <button class="btn btn-xs btn-secondary mt-1" id="adv-add-npc-btn">+ Add NPC</button>
                    </div>
                    <div>
                        <h4 style="margin:0;font-size:0.85rem;">📍 Locations</h4>
                        <div id="adv-create-locations-container"></div>
                        <button class="btn btn-xs btn-secondary mt-1" id="adv-add-location-btn">+ Add Location</button>
                    </div>
                </div>
            </div>

            <div class="panel">
                <h4 style="margin:0;font-size:0.85rem;">⏱️ Campaign Timers</h4>
                <div id="adv-create-timers-container"></div>
                <button class="btn btn-xs btn-secondary mt-1" id="adv-add-timer-btn">+ Add Timer</button>
            </div>

            <div class="panel">
                <h4 style="margin:0;font-size:0.85rem;">🐉 Bestiary (optional)</h4>
                <p style="font-size:0.7rem;color:var(--text3);">Creatures you can reference in scene encounters.</p>
                <div id="adv-create-bestiary-container"></div>
                <button class="btn btn-xs btn-secondary mt-1" id="adv-add-bestiary-btn">+ Add Creature</button>
            </div>

            <div class="flex gap-1">
                <button class="btn btn-gold" id="adv-create-save-btn">💾 Create Adventure</button>
                <button class="btn btn-secondary" onclick="window.adventureBackToList()">Cancel</button>
            </div>
        </div>
    `;
}

// ============================================================
// EVENT ATTACHMENT (only for GM actions; refresh still works for everyone)
// ============================================================

function attachEvents() {
    const canEdit = isGM();
    const browseBtn = document.getElementById('adv-browse-library-btn');
    if (browseBtn && canEdit) {
        browseBtn.addEventListener('click', browseAdventureLibrary);
    }

    const loadBtn = document.getElementById('adv-load-file-btn');
    if (loadBtn && canEdit) {
        loadBtn.addEventListener('click', async () => {
            await importAdventureFromFile();
            if (isDestroyed) return;
            renderView();
        });
    }

    const createBtn = document.getElementById('adv-create-btn');
    if (createBtn && canEdit) {
        createBtn.addEventListener('click', () => {
            adventureViewMode = 'create';
            renderView();
        });
    }

    const crownBtn = document.getElementById('adv-crown-gen-btn');
    if (crownBtn && canEdit) {
        crownBtn.addEventListener('click', async () => {
            const result = await importCrownSpreadAsAdventure();
            if (isDestroyed) return;
            if (result) {
                renderView();
            }
        });
    }

    const refreshBtn = document.getElementById('adv-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAdventuresFromState();
            renderView();
            showToast('🔄 Adventures refreshed', 'info');
        });
    }
}

function attachCreateEvents() {
    // All these buttons are only present when canEdit is true, so no extra guards needed
    const addActBtn = document.getElementById('adv-add-act-btn');
    if (addActBtn) {
        addActBtn.addEventListener('click', () => {
            const container = document.getElementById('adv-create-acts-container');
            if (!container) return;
            const idx = container.children.length;
            const div = document.createElement('div');
            div.className = 'adv-act-row';
            div.style.cssText = 'background:var(--bg3);padding:0.3rem;border-radius:var(--radius);margin:0.2rem 0;border-left:2px solid var(--gold);';
            div.innerHTML = `
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <input type="text" class="adv-act-title" placeholder="Act title" style="flex:2;min-width:120px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.2rem 0.3rem;font-size:0.8rem;" />
                    <input type="text" class="adv-act-desc" placeholder="Act description" style="flex:3;min-width:120px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.2rem 0.3rem;font-size:0.8rem;" />
                    <button class="btn btn-xs btn-danger adv-remove-act-btn">✕</button>
                </div>
                <div class="adv-scenes-container" style="margin-top:0.2rem;padding-left:0.5rem;"></div>
                <button class="btn btn-xs btn-secondary adv-add-scene-btn" style="margin-top:0.1rem;">+ Scene</button>
            `;
            container.appendChild(div);

            div.querySelector('.adv-add-scene-btn').addEventListener('click', () => {
                const scenesContainer = div.querySelector('.adv-scenes-container');
                const sceneIdx = scenesContainer.children.length;
                const sceneDiv = document.createElement('div');
                sceneDiv.className = 'adv-scene-row';
                sceneDiv.style.cssText = 'display:flex;gap:0.2rem;margin:0.1rem 0;align-items:center;flex-wrap:wrap;';
                sceneDiv.innerHTML = `
                    <span style="font-size:0.6rem;color:var(--text3);width:20px;">${sceneIdx + 1}.</span>
                    <input type="text" class="adv-scene-title" placeholder="Scene title" style="flex:2;min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                    <input type="text" class="adv-scene-desc" placeholder="Scene description" style="flex:3;min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                    <select class="adv-scene-objective-type" title="Objective type — what kind of clock this scene's encounter uses" style="min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;">
                        ${Object.entries(OBJECTIVE_TYPES).map(([id, t]) => `<option value="${id}" ${id === DEFAULT_OBJECTIVE_TYPE ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
                    </select>
                    <input type="text" class="adv-scene-custom-label" placeholder="Timer Label" style="display:none;min-width:90px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                    <input type="text" class="adv-scene-custom-tick-label" placeholder="Tick Label" style="display:none;min-width:90px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                    <input type="number" class="adv-scene-timer-segments" placeholder="Timer segments" value="6" style="width:60px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                    <button class="btn btn-xs btn-danger adv-remove-scene-btn">✕</button>
                `;
                scenesContainer.appendChild(sceneDiv);
                sceneDiv.querySelector('.adv-remove-scene-btn').addEventListener('click', () => {
                    sceneDiv.remove();
                });
                const sceneTypeSelect = sceneDiv.querySelector('.adv-scene-objective-type');
                const sceneCustomLabel = sceneDiv.querySelector('.adv-scene-custom-label');
                const sceneCustomTickLabel = sceneDiv.querySelector('.adv-scene-custom-tick-label');
                const updateSceneCustomFields = () => {
                    const show = sceneTypeSelect.value === 'custom' ? 'inline-block' : 'none';
                    sceneCustomLabel.style.display = show;
                    sceneCustomTickLabel.style.display = show;
                };
                sceneTypeSelect.addEventListener('change', updateSceneCustomFields);
                updateSceneCustomFields();
            });

            div.querySelector('.adv-remove-act-btn').addEventListener('click', () => {
                div.remove();
            });
        });
    }

    const addNpcBtn = document.getElementById('adv-add-npc-btn');
    if (addNpcBtn) {
        addNpcBtn.addEventListener('click', () => {
            const container = document.getElementById('adv-create-npcs-container');
            if (!container) return;
            const div = document.createElement('div');
            div.className = 'adv-npc-row';
            div.style.cssText = 'display:flex;gap:0.2rem;margin:0.1rem 0;align-items:center;flex-wrap:wrap;';
            div.innerHTML = `
                <input type="text" class="adv-npc-name" placeholder="Name" style="flex:1;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <input type="text" class="adv-npc-role" placeholder="Role" style="flex:1;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <input type="text" class="adv-npc-motivation" placeholder="Motivation" style="flex:1.5;min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <button class="btn btn-xs btn-danger adv-remove-npc-btn">✕</button>
            `;
            container.appendChild(div);
            div.querySelector('.adv-remove-npc-btn').addEventListener('click', () => {
                div.remove();
            });
        });
    }

    const addLocBtn = document.getElementById('adv-add-location-btn');
    if (addLocBtn) {
        addLocBtn.addEventListener('click', () => {
            const container = document.getElementById('adv-create-locations-container');
            if (!container) return;
            const div = document.createElement('div');
            div.className = 'adv-location-row';
            div.style.cssText = 'display:flex;gap:0.2rem;margin:0.1rem 0;align-items:center;flex-wrap:wrap;';
            div.innerHTML = `
                <input type="text" class="adv-location-name" placeholder="Name" style="flex:1;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <input type="text" class="adv-location-desc" placeholder="Description" style="flex:2;min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <button class="btn btn-xs btn-danger adv-remove-location-btn">✕</button>
            `;
            container.appendChild(div);
            div.querySelector('.adv-remove-location-btn').addEventListener('click', () => {
                div.remove();
            });
        });
    }

    const addTimerBtn = document.getElementById('adv-add-timer-btn');
    if (addTimerBtn) {
        addTimerBtn.addEventListener('click', () => {
            const container = document.getElementById('adv-create-timers-container');
            if (!container) return;
            const div = document.createElement('div');
            div.className = 'adv-timer-row';
            div.style.cssText = 'display:flex;gap:0.2rem;margin:0.1rem 0;align-items:center;flex-wrap:wrap;';
            div.innerHTML = `
                <input type="text" class="adv-timer-name" placeholder="Timer name" style="flex:1;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <input type="number" class="adv-timer-segments" placeholder="Segments" value="6" style="width:60px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                <input type="text" class="adv-timer-desc" placeholder="Description" style="flex:1.5;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                <button class="btn btn-xs btn-danger adv-remove-timer-btn">✕</button>
            `;
            container.appendChild(div);
            div.querySelector('.adv-remove-timer-btn').addEventListener('click', () => {
                div.remove();
            });
        });
    }

    const addBestiaryBtn = document.getElementById('adv-add-bestiary-btn');
    if (addBestiaryBtn) {
        addBestiaryBtn.addEventListener('click', () => {
            const container = document.getElementById('adv-create-bestiary-container');
            if (!container) return;
            const div = document.createElement('div');
            div.className = 'adv-bestiary-row';
            div.style.cssText = 'display:flex;gap:0.2rem;margin:0.1rem 0;align-items:center;flex-wrap:wrap;';
            div.innerHTML = `
                <input type="text" class="adv-bestiary-name" placeholder="Name" style="flex:1;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <input type="text" class="adv-bestiary-tl" placeholder="TL" value="2" style="width:40px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                <input type="text" class="adv-bestiary-class" placeholder="Class" style="width:40px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                <input type="text" class="adv-bestiary-desc" placeholder="Description" style="flex:1.5;min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                <button class="btn btn-xs btn-danger adv-remove-bestiary-btn">✕</button>
            `;
            container.appendChild(div);
            div.querySelector('.adv-remove-bestiary-btn').addEventListener('click', () => {
                div.remove();
            });
        });
    }

    const saveBtn = document.getElementById('adv-create-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const title = document.getElementById('adv-create-title')?.value.trim();
            if (!title) {
                showToast('Please enter a title.', 'error');
                return;
            }
            const tier = document.getElementById('adv-create-tier')?.value || 'III';
            const description = document.getElementById('adv-create-description')?.value.trim() || '';

            const acts = [];
            document.querySelectorAll('.adv-act-row').forEach(actRow => {
                const titleInput = actRow.querySelector('.adv-act-title');
                const descInput = actRow.querySelector('.adv-act-desc');
                const scenes = [];
                actRow.querySelectorAll('.adv-scene-row').forEach(sceneRow => {
                    const sceneTitle = sceneRow.querySelector('.adv-scene-title')?.value.trim() || 'Untitled Scene';
                    const sceneDesc = sceneRow.querySelector('.adv-scene-desc')?.value.trim() || '';
                    const timerSegs = safeParseInt(sceneRow.querySelector('.adv-scene-timer-segments')?.value, 6);
                    const sceneObjectiveType = sceneRow.querySelector('.adv-scene-objective-type')?.value || DEFAULT_OBJECTIVE_TYPE;
                    const sceneCustomLabel = sceneRow.querySelector('.adv-scene-custom-label')?.value.trim() || '';
                    const sceneCustomTickLabel = sceneRow.querySelector('.adv-scene-custom-tick-label')?.value.trim() || '';
                    scenes.push({
                        id: makeId('scene_'),
                        title: sceneTitle,
                        description: sceneDesc,
                        timers: [{ name: `${sceneTitle} Timer`, segments: timerSegs, current: 0 }],
                        encounters: [],
                        type: sceneObjectiveType,
                        customLabel: sceneCustomLabel,
                        customTickLabel: sceneCustomTickLabel,
                        completed: false
                    });
                });
                if (scenes.length > 0) {
                    acts.push({
                        id: makeId('act_'),
                        title: titleInput?.value.trim() || 'Untitled Act',
                        description: descInput?.value.trim() || '',
                        scenes
                    });
                }
            });

            const npcs = [];
            document.querySelectorAll('.adv-npc-row').forEach(row => {
                const name = row.querySelector('.adv-npc-name')?.value.trim();
                if (name) {
                    npcs.push({
                        id: makeId('npc_'),
                        name,
                        role: row.querySelector('.adv-npc-role')?.value.trim() || '',
                        motivation: row.querySelector('.adv-npc-motivation')?.value.trim() || ''
                    });
                }
            });

            const locations = [];
            document.querySelectorAll('.adv-location-row').forEach(row => {
                const name = row.querySelector('.adv-location-name')?.value.trim();
                if (name) {
                    locations.push({
                        id: makeId('loc_'),
                        name,
                        description: row.querySelector('.adv-location-desc')?.value.trim() || ''
                    });
                }
            });

            const campaignTimers = [];
            document.querySelectorAll('.adv-timer-row').forEach(row => {
                const name = row.querySelector('.adv-timer-name')?.value.trim();
                if (name) {
                    campaignTimers.push({
                        name,
                        segments: safeParseInt(row.querySelector('.adv-timer-segments')?.value, 6),
                        current: 0,
                        description: row.querySelector('.adv-timer-desc')?.value.trim() || ''
                    });
                }
            });

            const bestiary = [];
            document.querySelectorAll('.adv-bestiary-row').forEach(row => {
                const name = row.querySelector('.adv-bestiary-name')?.value.trim();
                if (name) {
                    bestiary.push({
                        id: makeId('creature_'),
                        name,
                        tl: safeParseInt(row.querySelector('.adv-bestiary-tl')?.value, 2),
                        class: row.querySelector('.adv-bestiary-class')?.value.trim() || '',
                        description: row.querySelector('.adv-bestiary-desc')?.value.trim() || ''
                    });
                }
            });

            if (acts.length === 0) {
                showToast('Please add at least one act with scenes.', 'error');
                return;
            }

            const adventure = createAdventure({
                title,
                description,
                tier,
                tierRange: tier,
                author: 'GM',
                acts,
                npcs,
                locations,
                factions: [],
                campaignTimers,
                bestiary,
                notes: '',
                status: 'planned'
            });

            showToast(`✨ Created "${adventure.title}"`, 'success');
            adventureViewMode = 'list';
            renderView();
        });
    }
}

// ============================================================
// WINDOW EXPOSURES (all functions now check isGM() internally)
// ============================================================

window.adventureBackToList = function() {
    adventureViewMode = 'list';
    renderView();
};

window.adventureOpenDetail = function(id) {
    activeAdventureId = id;
    adventureViewMode = 'detail';
    renderView();
};

window.adventureDelete = function(id) {
    if (!isGM()) {
        showToast('Only the GM can delete adventures.', 'error');
        return;
    }
    const adventure = getAdventure(id);
    if (!adventure) return;
    if (!confirm(`Delete "${adventure.title}"?`)) return;
    deleteAdventure(id);
    renderView();
    showToast(`🗑️ Deleted "${adventure.title}"`, 'info');
};

window.adventureStart = function(id) {
    const result = startAdventure(id);
    if (result) {
        renderView();
        showToast(`▶️ Started "${result.title}"`, 'success');
    }
};

window.adventureReset = function(id) {
    if (!isGM()) {
        showToast('Only the GM can reset adventures.', 'error');
        return;
    }
    if (!confirm(`Reset "${getAdventure(id)?.title}" to planned?`)) return;
    const result = resetAdventure(id);
    if (result) {
        renderView();
        showToast(`🔄 Reset "${result.title}"`, 'info');
    }
};

window.adventureCompleteScene = function(id, actIdx, sceneIdx) {
    const result = completeScene(id, actIdx, sceneIdx);
    if (result) {
        renderView();
        showToast('✅ Scene completed!', 'success');
    }
};

window.adventureStartEncounter = function(id, actIdx, sceneIdx) {
    startSceneEncounter(id, actIdx, sceneIdx);
};

window.adventureToggleSceneDesc = function(descId) {
    const el = document.getElementById(descId);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.adventureOpenGmHints = function(id) {
    const adventure = getAdventure(id);
    const hints = adventure?._gmhints;
    if (!hints) return;

    const pacingHtml = hints.pacing && typeof hints.pacing === 'object'
        ? Object.entries(hints.pacing).map(([act, text]) => `
            <div style="margin:0.5rem 0;">
                <div style="font-weight:600;font-size:0.8rem;color:var(--gold);text-transform:capitalize;">${escHtml(act.replace(/_/g, ' '))}</div>
                <div style="font-size:0.8rem;color:var(--text2);white-space:pre-wrap;">${escHtml(text)}</div>
            </div>
        `).join('')
        : '';

    const body = `
        ${hints.tone ? `
            <div class="panel" style="margin-bottom:0.5rem;">
                <h4 style="margin:0 0 0.2rem;font-size:0.85rem;">🎭 Tone</h4>
                <div style="font-size:0.85rem;color:var(--text);white-space:pre-wrap;">${escHtml(hints.tone)}</div>
            </div>
        ` : ''}
        ${pacingHtml ? `
            <div class="panel">
                <h4 style="margin:0 0 0.2rem;font-size:0.85rem;">⏳ Pacing</h4>
                ${pacingHtml}
            </div>
        ` : ''}
        ${!hints.tone && !pacingHtml ? `<p class="text-muted">No GM hints recorded for this adventure.</p>` : ''}
    `;

    const panel = openInlineScreen('adv-gmhints-screen');
    panel.innerHTML = inlineScreenShell('adv-gmhints-screen', `🧭 GM Hints — ${escHtml(adventure.title)}`, body, { maxWidth: '640px' });
    document.getElementById('adv-gmhints-screen-back')?.addEventListener('click', () => {
        closeInlineScreen('adv-gmhints-screen');
    });
};

window.adventureAdvanceTimer = function(id, idx) {
    const result = advanceTimer(id, idx);
    if (result) {
        renderView();
    }
};

window.adventureAdvanceSceneTimer = function(id, actIdx, sceneIdx, timerIdx, amount = 1) {
    const result = advanceSceneTimer(id, actIdx, sceneIdx, timerIdx, amount);
    if (result) renderView();
};

window.adventureExport = function(id) {
    exportAdventure(id);
};

window.adventureDuplicate = function(id) {
    const copy = duplicateAdventure(id);
    if (copy) {
        renderView();
        showToast(`📋 Duplicated "${copy.title}"`, 'success');
    }
};

window.adventureSaveNotes = function(id) {
    if (!isGM()) {
        showToast('Only the GM can save notes.', 'error');
        return;
    }
    const notes = document.getElementById('adv-notes')?.value;
    if (notes !== undefined) {
        updateAdventure(id, { notes });
        showToast('💾 Notes saved', 'success');
    }
};

window.adventureAddBestiaryCreature = function(adventureId) {
    if (!isGM()) {
        showToast('Only the GM can add creatures.', 'error');
        return;
    }
    const adventure = getAdventure(adventureId);
    if (!adventure) {
        showToast('Adventure not found.', 'error');
        return;
    }
    const name = prompt('Creature name:');
    if (!name) return;
    const tl = parseInt(prompt('TL (1-10):', '2'), 10) || 2;
    const cls = prompt('Class (I-X):', 'I') || 'I';
    const desc = prompt('Brief description:', '') || '';
    const creature = {
        id: makeId('creature_'),
        name,
        tl,
        class: cls,
        description: desc,
        stats: { hp: tl * 10 + 10 },
        sb_spends: []
    };
    if (!adventure.bestiary) adventure.bestiary = [];
    adventure.bestiary.push(creature);
    saveAdventuresToState();
    renderView();
    showToast(`🐉 Added "${name}" to bestiary.`, 'success');
};

window.adventureRemoveBestiaryCreature = function(adventureId, creatureId) {
    if (!isGM()) {
        showToast('Only the GM can remove creatures.', 'error');
        return;
    }
    const adventure = getAdventure(adventureId);
    if (!adventure) return;
    if (!adventure.bestiary) return;
    const idx = adventure.bestiary.findIndex(c => c.id === creatureId);
    if (idx === -1) return;
    if (!confirm(`Remove "${adventure.bestiary[idx].name}" from bestiary?`)) return;
    adventure.bestiary.splice(idx, 1);
    saveAdventuresToState();
    renderView();
    showToast('Creature removed.', 'info');
};

// ============================================================
// LIFECYCLE
// ============================================================

function onActivate() {
    isDestroyed = false;
    loadAdventuresFromState();
    if (container) render(container);
}

function onDeactivate() {
    saveAdventuresToState();
}

function refresh() {
    loadAdventuresFromState();
    renderView();
}

function destroy() {
    isDestroyed = true;
    container = null;
    saveAdventuresToState();
}

// ============================================================
// EXPORTS
// ============================================================

export {
    render,
    destroy,
    onActivate,
    onDeactivate,
    refresh,
    loadAdventuresFromState,
    saveAdventuresToState,
    loadAdventureFromFile,
    loadAdventureManifest,
    browseAdventureLibrary,
    getAdventure,
    getActiveAdventure,
    createAdventure,
    updateAdventure,
    deleteAdventure,
    duplicateAdventure,
    startAdventure,
    completeScene,
    advanceTimer,
    advanceSceneTimer,
    resetAdventure,
    exportAdventure,
    importAdventureFromFile,
    importCrownSpreadAsAdventure,
    createAdventureFromCrownSpreadReading,
    startSceneEncounter,
    installAdventureContent,
    removeInstalledAdventure
};