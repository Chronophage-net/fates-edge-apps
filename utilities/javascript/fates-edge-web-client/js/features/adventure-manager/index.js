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
 *
 * ── Fixes in this pass ───────────────────────────────────────────────
 * 1. Toolbar buttons (Load/Create/Crown Gen/Refresh) went dead after the
 *    first re-render: every code path that called renderView() to go
 *    back to the list (Crown Spread success, Refresh, back-from-detail,
 *    after creating an adventure, etc.) rebuilt the DOM but never
 *    re-attached listeners to the new button nodes — only the very
 *    first render() did. renderView() now attaches the right listeners
 *    itself for whichever mode it just rendered, so every transition
 *    back to the list (or into create mode) works every time.
 * 2. loadAdventureManifest()/loadAdventureFromFile() existed and worked,
 *    but nothing in the UI ever called them — "Load from File" only
 *    opened a local file picker, so the documented "/data/adventures/
 *    *.json" library was unreachable. Added a "📚 Browse Library"
 *    button that lists the manifest and loads a chosen entry.
 * 3. Added an isDestroyed guard (matching the pattern used in the VTT
 *    modules) so an in-flight async action (library browse, Crown
 *    Spread generation, file import) can't repaint a container after
 *    the user has navigated away from this tab.
 *
 * Data Structure:
 * {
 *   id: string,
 *   title: string,
 *   description: string,
 *   tier: 'I'|'II'|'III'|'IV'|'V',
 *   author: string,
 *   acts: [{
 *     id: string,
 *     title: string,
 *     description: string,
 *     scenes: [{
 *       id: string,
 *       title: string,
 *       description: string,
 *       timers: [{ name, segments, current }],
 *       encounters: [{ name, dv, position, outcomes }],
 *       completed: boolean
 *     }]
 *   }],
 *   npcs: [{ id, name, role, motivation, stats }],
 *   locations: [{ id, name, description, tags }],
 *   factions: [{ id, name, goals, relationship }],
 *   campaignTimers: [{ name, segments, current, description }],
 *   notes: string,
 *   currentAct: number,
 *   currentScene: number,
 *   startedAt: string,
 *   completedAt: string|null,
 *   status: 'planned'|'active'|'completed'|'archived'
 * }
 */

import { getState, saveState, getSessionLog } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml, generateId, safeParseInt } from '../../core/utils.js';
import { logToSession, addVTTEvent } from '../gm-tools/index.js'; // 👈 NEW: unified session log
import { isConnectedToServer, sendEvent } from '../../core/websocket.js'; // 👈 NEW: live scene status broadcast
import { vttStore } from '../../core/vtt-store.js'; // 👈 NEW: read the live VTT's chat feed for Crown Spread import

// ============================================================
// CONSTANTS
// ============================================================

// 👇 FIXED: was './data/adventures/' (relative to the current route).
// Sibling modules (e.g. bestiary.js's "/data/bestiary.json" check)
// use a root-absolute path, so this now matches that convention —
// a relative path can resolve unpredictably depending on how/where
// the SPA's index.html is served, especially after moving this
// feature into its own folder.
const ADVENTURES_DATA_PATH = '/data/adventures/';
const STORAGE_KEY = 'fates-edge-adventures';

// ============================================================
// STATE
// ============================================================

let container = null;
let adventures = [];
let activeAdventureId = null;
let adventureViewMode = 'list'; // 'list' | 'detail' | 'create'
let isDestroyed = false; // 👈 NEW: guards async callbacks from repainting after teardown

// ============================================================
// 👇 NEW: GM SESSION LOG + LIVE SCENE STATUS BROADCAST
// ============================================================

/**
 * Writes a line into the shared GM session log / VTT event stream —
 * the same one Encounters already uses on create/delete — so adventure
 * milestones (started, scene/act/adventure completed) show up in one
 * unified timeline instead of living only inside this tab.
 * Silently no-ops if GM Tools isn't loaded, matching the try/catch
 * pattern encounters/index.js already uses for the same calls.
 */
function logAdventureEvent(message, logType = 'info', vttEventType = 'adventure_event', vttEventData = {}) {
    try {
        logToSession(message, logType);
        addVTTEvent(vttEventType, vttEventData);
    } catch (e) { /* ignore — GM Tools not available */ }
}

/**
 * Pushes a lightweight, player-safe "where are we" pill over the
 * WebSocket — adventure title, act, and scene — mirroring combat.js's
 * broadcastCombatStatus(). No stats, no GM notes, just enough for
 * connected players to see "Act 2 — The Ambush" without GM access.
 * Pass `null` to clear the pill (e.g. on reset or when leaving a scene).
 */
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

// ============================================================
// DATA LOADING
// ============================================================

function loadAdventuresFromState() {
    const state = getState();
    if (state.adventures) {
        adventures = state.adventures;
        return adventures;
    }
    adventures = [];
    return adventures;
}

function saveAdventuresToState() {
    const state = getState();
    state.adventures = adventures;
    saveState();
}

async function loadAdventureFromFile(adventureId) {
    // Try exact slug first, then fallback to common spelling corrections
    const candidates = [
        `${ADVENTURES_DATA_PATH}${adventureId}.json`,
        `.${ADVENTURES_DATA_PATH}${adventureId}.json`,
    ];

    // If the slug looks like a misspelling of "lantern", try the corrected version
    if (adventureId === 'latern_at_dusk') {
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

            // Check if response is empty
            const text = await response.text();
            if (!text || text.trim() === '') {
                lastError = new Error(`Empty file at ${url}`);
                continue;
            }

            // Try to parse JSON
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                lastError = new Error(`Invalid JSON at ${url}: ${parseErr.message}`);
                continue;
            }

            // Ensure it has an id
            if (!data.id) data.id = adventureId;

            // Add it to state if not already present
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
    // 👇 FIXED (again): your tools/generate-manifests.js writes a *plain
    // array* of slugs — ["blood_and_silk_saga"] — not {adventures: [...]}.
    // The previous version only checked manifest.adventures, so even a
    // successful fetch of your real manifest.json would've silently come
    // back empty. Also trying both an absolute and a relative candidate
    // path now, in case this server/build doesn't expose "/data" at the
    // domain root — and logging the actual HTTP status or error for each
    // attempt, so if it's still unreachable the console tells you exactly
    // why instead of just "no").
    const candidates = [
        `${ADVENTURES_DATA_PATH}manifest.json`,   // e.g. /data/adventures/manifest.json
        `.${ADVENTURES_DATA_PATH}manifest.json`,  // e.g. ./data/adventures/manifest.json
    ];

    for (const url of candidates) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`[Adventures] Manifest fetch failed: ${url} → HTTP ${response.status}`);
                continue;
            }
            const manifest = await response.json();
            if (Array.isArray(manifest)) return manifest;                 // your actual format
            if (Array.isArray(manifest?.adventures)) return manifest.adventures; // also accepted
            console.warn(`[Adventures] ${url} loaded but had an unexpected shape:`, manifest);
            return [];
        } catch (e) {
            console.warn(`[Adventures] Manifest fetch errored: ${url} →`, e);
        }
    }

    return null;
}

// 👇 NEW: this is the piece that was missing — a UI entry point for the
// manifest + per-file loader above. Prompt-based to match the rest of
// this codebase's lightweight modal-free flows (see combat.js's
// addCombatant/addPlayer for the same pattern).
async function browseAdventureLibrary() {
    const ids = await loadAdventureManifest();
    if (isDestroyed) return;
    if (ids === null) {
        showToast(
            `Couldn't reach manifest.json under /data/adventures/ (tried both an absolute and relative path — check the browser console for the exact HTTP status/error on each). Confirm the dev/prod server actually serves that folder.`,
            'error'
        );
        return;
    }
    if (ids.length === 0) {
        showToast(`${ADVENTURES_DATA_PATH}manifest.json was found, but its "adventures" list is empty.`, 'warning');
        return;
    }

    // Build list with indices
    const listText = ids.map((id, i) => `${i + 1}. ${id}`).join('\n');
    const choice = prompt(`📚 Adventure Library — enter a number to load:\n${listText}`);
    if (!choice) return;

    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= ids.length) {
        showToast('Invalid selection.', 'error');
        return;
    }

    const selectedId = ids[idx];
    const data = await loadAdventureFromFile(selectedId);
    if (isDestroyed) return;

    if (data) {
        showToast(`📚 Loaded "${data.title}" from the library.`, 'success');
        renderView();
    } else {
        showToast(`Failed to load "${selectedId}" — the JSON file may be missing, empty, or malformed. Check ${ADVENTURES_DATA_PATH}${selectedId}.json.`, 'error');
    }
}

function getAdventure(id) {
    return adventures.find(a => a.id === id);
}

function getActiveAdventure() {
    if (!activeAdventureId) return null;
    return getAdventure(activeAdventureId);
}

// ============================================================
// ADVENTURE CRUD
// ============================================================

function createAdventure(data) {
    const adventure = {
        id: data.id || generateId('adv_'),
        title: data.title || 'Untitled Adventure',
        description: data.description || '',
        tier: data.tier || 'I',
        author: data.author || 'GM',
        acts: data.acts || [],
        npcs: data.npcs || [],
        locations: data.locations || [],
        factions: data.factions || [],
        campaignTimers: data.campaignTimers || [],
        notes: data.notes || '',
        currentAct: data.currentAct || 0,
        currentScene: data.currentScene || 0,
        startedAt: data.startedAt || null,
        completedAt: data.completedAt || null,
        status: data.status || 'planned',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    adventures.push(adventure);
    saveAdventuresToState();
    return adventure;
}

function updateAdventure(id, updates) {
    const idx = adventures.findIndex(a => a.id === id);
    if (idx === -1) return null;
    adventures[idx] = { ...adventures[idx], ...updates, updatedAt: new Date().toISOString() };
    saveAdventuresToState();
    return adventures[idx];
}

function deleteAdventure(id) {
    const idx = adventures.findIndex(a => a.id === id);
    if (idx === -1) return false;
    adventures.splice(idx, 1);
    if (activeAdventureId === id) activeAdventureId = null;
    saveAdventuresToState();
    return true;
}

function duplicateAdventure(id) {
    const original = getAdventure(id);
    if (!original) return null;
    const copy = JSON.parse(JSON.stringify(original));
    copy.id = generateId('adv_');
    copy.title = `${original.title} (Copy)`;
    copy.status = 'planned';
    copy.startedAt = null;
    copy.completedAt = null;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = new Date().toISOString();
    adventures.push(copy);
    saveAdventuresToState();
    return copy;
}

// ============================================================
// ADVENTURE PROGRESSION
// ============================================================

function startAdventure(id) {
    const adventure = getAdventure(id);
    if (!adventure) return null;
    adventure.status = 'active';
    adventure.startedAt = new Date().toISOString();
    adventure.currentAct = 0;
    adventure.currentScene = 0;
    // Reset all scene completed flags
    adventure.acts.forEach(act => {
        act.scenes.forEach(scene => scene.completed = false);
    });
    // Reset timers
    adventure.campaignTimers.forEach(t => t.current = 0);
    saveAdventuresToState();
    activeAdventureId = id;

    // 👇 NEW: unified log + live scene pill for players
    logAdventureEvent(`🎭 Adventure started: ${adventure.title}`, 'warning', 'adventure_started', {
        id: adventure.id, title: adventure.title, tier: adventure.tier
    });
    broadcastSceneStatus(adventure);

    return adventure;
}

function completeScene(adventureId, actIndex, sceneIndex) {
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
    
    // Advance to next scene
    const nextScene = sceneIndex + 1;
    if (nextScene < act.scenes.length) {
        adventure.currentScene = nextScene;
    } else {
        // Move to next act
        const nextAct = actIndex + 1;
        if (nextAct < adventure.acts.length) {
            adventure.currentAct = nextAct;
            adventure.currentScene = 0;
            logAdventureEvent(`📖 Act completed: "${act.title}" (${adventure.title})`, 'warning', 'act_completed', {
                adventureId: adventure.id, actIndex, actTitle: act.title
            });
        } else {
            // All acts complete
            adventure.status = 'completed';
            adventure.completedAt = new Date().toISOString();
            logAdventureEvent(`🏁 Adventure completed: ${adventure.title}`, 'warning', 'adventure_completed', {
                adventureId: adventure.id, title: adventure.title
            });
        }
    }
    saveAdventuresToState();
    broadcastSceneStatus(adventure); // 👈 NEW: keep the players' pill in sync with wherever we landed
    return adventure;
}

function advanceTimer(adventureId, timerIndex, amount = 1) {
    const adventure = getAdventure(adventureId);
    if (!adventure) return null;
    const timer = adventure.campaignTimers[timerIndex];
    if (!timer) return null;
    const wasComplete = timer.current >= timer.segments;
    timer.current = Math.min(timer.current + amount, timer.segments);
    saveAdventuresToState();
    if (timer.current >= timer.segments && !wasComplete) {
        showToast(`⏱️ Adventure Timer "${timer.name}" completed!`, 'warning');
        logAdventureEvent(`⏱️ Adventure Timer "${timer.name}" completed (${adventure.title})`, 'warning', 'adventure_timer_completed', {
            adventureId: adventure.id, timerName: timer.name
        });
    }
    return adventure;
}

function resetAdventure(id) {
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
    logAdventureEvent(`🔄 Adventure reset: ${adventure.title}`, 'info', 'adventure_reset', { id: adventure.id, title: adventure.title });
    broadcastSceneStatus(null); // 👈 NEW: clear the players' pill — nothing active anymore
    return adventure;
}

// ============================================================
// 👇 NEW: SCENE ↔ ENCOUNTER / COMBAT TRACKER BRIDGE
// ============================================================

/**
 * Turns a scene's planned `encounters` stubs ({name, dv, position,
 * outcomes}) into a real Encounter in state.encounters, then opens the
 * Combat Tracker on it — the same Tracker that now has Position
 * tracking, Range, and per-adversary Moves. The created encounter's id
 * is stashed on the scene (`scene.encounterId`) so re-clicking later
 * reopens the *same* fight instead of creating duplicates.
 *
 * If the scene has no planned encounters, this still creates an empty
 * Encounter titled after the scene — useful for an improvised fight —
 * so the button is always available on the current scene, not just
 * ones the GM pre-stocked with stat blocks.
 */
async function startSceneEncounter(adventureId, actIndex, sceneIndex) {
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

    if (!encounter) {
        const adversaries = (scene.encounters || []).map(enc => ({
            name: enc.name || 'Adversary',
            body: [
                enc.dv !== undefined && enc.dv !== null ? `DV ${enc.dv}` : '',
                enc.position ? `Position: ${enc.position}` : '',
                enc.outcomes ? `Outcomes: ${enc.outcomes}` : ''
            ].filter(Boolean).join(' · ')
        }));

        encounter = {
            id: generateId('enc_'),
            title: `${scene.title} (${adventure.title})`,
            body: scene.description || '',
            difficulty: 2,
            location: '',
            status: 'active',
            adversaries,
            created: Date.now()
        };
        state.encounters.push(encounter);
        saveState();

        scene.encounterId = encounter.id;
        saveAdventuresToState();

        logAdventureEvent(`⚔️ Encounter "${encounter.title}" started from scene "${scene.title}"`, 'warning', 'encounter_created', {
            name: encounter.title, id: encounter.id, status: encounter.status, fromAdventure: adventure.id
        });
    }

    try {
        const combat = await import('../encounters/combat.js');
        combat.openTracker(encounter.id);
    } catch (e) {
        console.warn('[Adventures] Failed to open Combat Tracker:', e);
        showToast('Combat Tracker not available.', 'error');
    }
}



function exportAdventure(id) {
    const adventure = getAdventure(id);
    if (!adventure) return null;
    const data = JSON.stringify(adventure, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${adventure.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`📤 Exported "${adventure.title}"`, 'success');
}

async function importAdventureFromFile() {
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
                if (!data.title) {
                    showToast('Invalid adventure format: missing "title".', 'error');
                    resolve(null);
                    return;
                }
                const existing = adventures.find(a => a.id === data.id);
                if (existing) {
                    if (!confirm(`Adventure "${data.title}" already exists. Overwrite?`)) {
                        resolve(null);
                        return;
                    }
                    Object.assign(existing, data);
                } else {
                    adventures.push(data);
                }
                saveAdventuresToState();
                showToast(`📥 Imported "${data.title}"`, 'success');
                resolve(data);
            } catch (err) {
                showToast('Failed to import adventure: ' + err.message, 'error');
                resolve(null);
            }
        };
        input.click();
    });
}

// ============================================================
// 👇 REPLACED: CROWN SPREAD IMPORT
// ============================================================
// The old version called Decks' quickCrownSpread() directly — but that
// draw needs a region selected in the Decks tab first, and gave zero
// visual feedback about what was actually drawn before launching
// straight into blind prompt() dialogs. Instead, this pulls a *recent*
// Crown Spread the GM already drew and saw — either the live VTT's own
// chat feed (if that tab has been open this session) or the shared GM
// session log — and lets you pick one to import as an adventure seed.

/**
 * Recent Crown Spread results, newest first, from two places:
 *  - "the current active one in the VTT": the live table's own chat
 *    feed (vttStore), which is what a Crown Spread draw actually posts
 *    to in real time. Only present if the VTT tab has been opened this
 *    session, but when it has, this is the most immediate source.
 *  - "the logs": the persisted GM session log, in case the spread was
 *    drawn in an earlier session, or the Decks tab logs it directly.
 */
function getRecentCrownSpreads(limit = 10) {
    const results = [];

    const liveMessages = vttStore?.state?.chatMessages || [];
    liveMessages
        .filter(m => (m.sender || '').toLowerCase() === 'deck' && /crown spread/i.test(m.text || ''))
        .reverse()
        .forEach(m => results.push({ source: 'VTT', time: m.time || '', text: m.text }));

    const sessionLog = getSessionLog();
    sessionLog
        .filter(entry => /crown spread/i.test(entry.message || ''))
        .reverse()
        .forEach(entry => results.push({ source: 'Log', time: entry.time || '', text: entry.message }));

    return results.slice(0, limit);
}

async function importCrownSpreadAsAdventure() {
    const spreads = getRecentCrownSpreads();
    if (spreads.length === 0) {
        showToast(
            'No recent Crown Spread found. Draw one from Decks (select a region there first) or from the VTT, then come back here to import it.',
            'warning'
        );
        return null;
    }

    const listText = spreads
        .map((s, i) => `${i + 1}. [${s.source}${s.time ? ' · ' + s.time : ''}] ${s.text.replace(/^👑\s*/, '')}`)
        .join('\n\n');
    const choice = prompt(`👑 Recent Crown Spreads — enter a number to import as an adventure:\n\n${listText}`);
    if (!choice) return null;
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= spreads.length) {
        showToast('Invalid selection.', 'error');
        return null;
    }

    const synthesis = spreads[idx].text.replace(/^👑\s*Crown Spread:\s*/i, '').trim();
    const title = prompt('Adventure title:', 'Crown Spread Adventure') || 'Crown Spread Adventure';
    const tier = prompt('Tier (I-V):', 'I') || 'I';

    const adventure = createAdventure({
        title,
        description: synthesis || 'An adventure born from a Crown Spread reading.',
        tier,
        author: 'Crown Spread Import',
        acts: [{
            id: generateId('act_'),
            title: 'The Reading Unfolds',
            description: synthesis,
            scenes: [{
                id: generateId('scene_'),
                title: 'Opening Scene',
                description: synthesis,
                timers: [{ name: 'Adventure Clock', segments: 6, current: 0 }],
                encounters: [],
                completed: false
            }]
        }],
        campaignTimers: [
            { name: 'Adventure Clock', segments: 8, current: 0, description: 'Overall adventure pace' }
        ],
        status: 'planned'
    });

    showToast(`👑 Imported Crown Spread as "${adventure.title}"`, 'success');
    return adventure;
}

// ============================================================
// RENDER
// ============================================================

function render(el) {
    container = el;
    isDestroyed = false; // 👈 NEW
    loadAdventuresFromState();
    renderView();
}

// 👇 FIXED: renderView() now attaches the listeners appropriate to
// whichever mode it just rendered. Previously only the very first
// render() call attached the list toolbar's listeners — every later
// call to renderView() (Crown Spread success, Refresh, "back to list",
// after saving a new adventure, etc.) rebuilt fresh DOM nodes for
// "Load from File" / "New Adventure" / "Import Crown Spread" / "Refresh"
// but never re-attached click handlers to them, so the toolbar went
// dead after the very first use of any of those flows. Centralizing
// the attach call here means every transition works, every time.
function renderView() {
    if (!container || isDestroyed) return;
    
    if (adventureViewMode === 'detail' && activeAdventureId) {
        container.innerHTML = renderAdventureDetail(activeAdventureId);
        // Detail view uses inline onclick="window.xxx(...)" exclusively
        // (see renderAdventureDetail), so it needs no attach step here —
        // those handlers keep working across re-renders on their own.
    } else if (adventureViewMode === 'create') {
        container.innerHTML = renderCreateAdventure();
        attachCreateEvents();
    } else {
        container.innerHTML = renderAdventureList();
        attachEvents();
    }
}

function renderAdventureList() {
    const hasAdventures = adventures.length > 0;
    
    return `
        <div class="adventures-modern-layout flex flex-col gap-2">
            <header class="adventures-header">
                <h1 class="page-title">🎭 Adventures</h1>
                <p class="page-sub">Load, track, and manage your Fate's Edge adventures.</p>
            </header>
            
            <div class="flex gap-1 flex-center flex-wrap" style="border-bottom:1px solid var(--border);padding-bottom:0.5rem;">
                <button class="btn btn-sm btn-gold" id="adv-browse-library-btn">📚 Browse Library</button>
                <button class="btn btn-sm btn-secondary" id="adv-load-file-btn">📂 Load from File</button>
                <button class="btn btn-sm btn-primary" id="adv-create-btn">✨ New Adventure</button>
                <button class="btn btn-sm btn-secondary" id="adv-crown-gen-btn">👑 Import Crown Spread</button>
                <button class="btn btn-sm btn-secondary" id="adv-refresh-btn">🔄 Refresh</button>
            </div>
            
            <div class="panel" style="min-height:300px;">
                ${hasAdventures ? `
                    <div class="flex flex-col gap-1">
                        ${adventures.map(a => renderAdventureCard(a)).join('')}
                    </div>
                ` : `
                    <div class="text-center" style="padding:2rem 0;">
                        <div style="font-size:3rem;">🎭</div>
                        <p class="text-muted">No adventures loaded yet.</p>
                        <p class="text-sm text-muted">Click "Browse Library" to pick one from /data/adventures/, "Load from File" to import your own, or create a new one.</p>
                        <div class="flex gap-1 flex-center mt-1">
                            <button class="btn btn-sm btn-gold" id="adv-load-file-btn">📂 Load from File</button>
                            <button class="btn btn-sm btn-secondary" id="adv-crown-gen-btn">👑 Import Crown Spread</button>
                        </div>
                    </div>
                `}
            </div>
            
            <div class="panel" style="background:var(--bg2);border-left:4px solid var(--gold);font-size:0.75rem;color:var(--text3);">
                <strong>💡 Adventure Format:</strong> Adventures are stored in <code>/data/adventures/</code> as JSON files.
                Each adventure contains acts, scenes, timers, NPCs, locations, and factions.
                Crown Spread generation creates a structured adventure from a card draw.
            </div>
        </div>
    `;
}

function renderAdventureCard(adventure) {
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
                    <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();window.adventureDelete('${adventure.id}')" style="color:var(--red);">✕</button>
                </div>
            </div>
            ${adventure.description ? `<div style="font-size:0.75rem;color:var(--text2);margin-top:0.1rem;">${escHtml(adventure.description)}</div>` : ''}
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

function renderAdventureDetail(adventureId) {
    const adventure = getAdventure(adventureId);
    if (!adventure) {
        return `<div class="panel"><p class="text-muted">Adventure not found.</p><button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button></div>`;
    }
    
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
    
    // Build timers HTML
    const timersHtml = adventure.campaignTimers?.map((t, idx) => `
        <div class="flex gap-1 flex-center" style="margin:0.1rem 0;">
            <span class="flex-1 text-sm">${escHtml(t.name)}</span>
            <span style="font-size:0.65rem;color:var(--text2);">${t.description || ''}</span>
            <div style="flex:1;background:var(--bg3);border-radius:var(--radius);height:6px;overflow:hidden;max-width:120px;">
                <div style="width:${(t.current / t.segments) * 100}%;height:100%;background:${(t.current / t.segments) > 0.8 ? 'var(--red)' : 'var(--gold)'};"></div>
            </div>
            <span class="text-xs text-muted">${t.current}/${t.segments}</span>
            <button class="btn btn-xs btn-primary" onclick="window.adventureAdvanceTimer('${adventure.id}', ${idx})">+1</button>
        </div>
    `).join('') || '<span class="text-muted text-sm">No campaign timers.</span>';
    
    // Build acts HTML
    const actsHtml = adventure.acts?.map((act, actIdx) => `
        <div class="panel" style="background:var(--bg3);border-left:3px solid var(--gold);padding:0.3rem 0.5rem;margin:0.2rem 0;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                <span style="font-weight:600;font-size:0.85rem;">${escHtml(act.title)}</span>
                <span style="font-size:0.65rem;color:var(--text3);">${act.scenes?.length || 0} scenes</span>
            </div>
            ${act.description ? `<div style="font-size:0.7rem;color:var(--text2);">${escHtml(act.description)}</div>` : ''}
            <div style="margin-top:0.2rem;display:flex;flex-direction:column;gap:0.1rem;padding-left:0.3rem;">
                ${act.scenes?.map((scene, sceneIdx) => {
                    const isCurrent = actIdx === adventure.currentAct && sceneIdx === adventure.currentScene;
                    const isCompleted = scene.completed;
                    return `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.2rem;border-radius:4px;${isCurrent ? 'background:var(--bg4);border-left:3px solid var(--gold);' : ''}${isCompleted ? 'opacity:0.6;' : ''}">
                            <div style="display:flex;align-items:center;gap:0.3rem;">
                                <span style="font-size:0.8rem;">${isCompleted ? '✅' : isCurrent ? '▶️' : '⏹️'}</span>
                                <span style="font-size:0.75rem;${isCurrent ? 'font-weight:600;color:var(--gold);' : ''}">${escHtml(scene.title)}</span>
                            </div>
                            <div style="display:flex;gap:0.2rem;align-items:center;">
                                ${scene.timers?.map(t => `
                                    <span style="font-size:0.55rem;color:var(--text3);">${escHtml(t.name)} ${t.current}/${t.segments}</span>
                                `).join('') || ''}
                                ${isCurrent ? `<button class="btn btn-xs btn-danger" onclick="window.adventureStartEncounter('${adventure.id}', ${actIdx}, ${sceneIdx})" title="${scene.encounterId ? 'Reopen the Combat Tracker for this scene' : 'Create an Encounter from this scene and open the Combat Tracker'}">⚔️ ${scene.encounterId ? 'Resume' : 'Start'} Encounter</button>` : ''}
                                ${!isCompleted && isCurrent ? `<button class="btn btn-xs btn-primary" onclick="window.adventureCompleteScene('${adventure.id}', ${actIdx}, ${sceneIdx})">✓ Complete</button>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('') || '<span class="text-muted text-sm">No acts defined.</span>';
    
    // Build NPCs HTML
    const npcsHtml = adventure.npcs?.map(npc => `
        <div class="panel" style="background:var(--bg3);padding:0.2rem 0.4rem;margin:0.1rem 0;border-left:2px solid var(--gold);">
            <span style="font-weight:600;font-size:0.8rem;">${escHtml(npc.name)}</span>
            ${npc.role ? `<span style="font-size:0.65rem;color:var(--text3);"> — ${escHtml(npc.role)}</span>` : ''}
            ${npc.motivation ? `<div style="font-size:0.65rem;color:var(--text2);">🎯 ${escHtml(npc.motivation)}</div>` : ''}
        </div>
    `).join('') || '<span class="text-muted text-sm">No NPCs.</span>';
    
    // Build Locations HTML
    const locationsHtml = adventure.locations?.map(loc => `
        <div class="panel" style="background:var(--bg3);padding:0.2rem 0.4rem;margin:0.1rem 0;border-left:2px solid var(--blue);">
            <span style="font-weight:600;font-size:0.8rem;">📍 ${escHtml(loc.name)}</span>
            ${loc.description ? `<div style="font-size:0.65rem;color:var(--text2);">${escHtml(loc.description)}</div>` : ''}
        </div>
    `).join('') || '<span class="text-muted text-sm">No locations.</span>';
    
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
                    ${!isActive && adventure.status !== 'completed' ? `<button class="btn btn-sm btn-gold" onclick="window.adventureStart('${adventure.id}')">▶️ Start</button>` : ''}
                    ${isActive ? `<button class="btn btn-sm btn-secondary" onclick="window.adventureReset('${adventure.id}')">🔄 Reset</button>` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="window.adventureExport('${adventure.id}')">📤 Export</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.adventureDuplicate('${adventure.id}')">📋 Duplicate</button>
                    <button class="btn btn-sm btn-danger" onclick="window.adventureDelete('${adventure.id}')">🗑️ Delete</button>
                </div>
            </div>
            
            ${adventure.description ? `<div style="font-size:0.85rem;color:var(--text2);padding:0.2rem 0;">${escHtml(adventure.description)}</div>` : ''}
            
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
                        <h4 style="margin:0;font-size:0.9rem;">📝 Notes</h4>
                        <textarea id="adv-notes" rows="3" style="width:100%;font-size:0.75rem;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;">${escHtml(adventure.notes || '')}</textarea>
                        <button class="btn btn-xs btn-primary mt-1" onclick="window.adventureSaveNotes('${adventure.id}')">💾 Save Notes</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCreateAdventure() {
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
            
            <div class="flex gap-1">
                <button class="btn btn-gold" id="adv-create-save-btn">💾 Create Adventure</button>
                <button class="btn btn-secondary" onclick="window.adventureBackToList()">Cancel</button>
            </div>
        </div>
    `;
}

// ============================================================
// EVENT ATTACHMENT
// ============================================================

function attachEvents() {
    // 👇 NEW: Browse Library (wires up the previously-dead manifest loader)
    const browseBtn = document.getElementById('adv-browse-library-btn');
    if (browseBtn) {
        browseBtn.addEventListener('click', browseAdventureLibrary);
    }

    // List view buttons
    const loadBtn = document.getElementById('adv-load-file-btn');
    if (loadBtn) {
        loadBtn.addEventListener('click', async () => {
            await importAdventureFromFile();
            if (isDestroyed) return;
            renderView();
        });
    }
    
    const createBtn = document.getElementById('adv-create-btn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            adventureViewMode = 'create';
            renderView(); // renderView() attaches create-mode listeners itself now
        });
    }
    
    const crownBtn = document.getElementById('adv-crown-gen-btn');
    if (crownBtn) {
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
    // Add Act
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
            
            // Add scene button for this act
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
                    <input type="number" class="adv-scene-timer-segments" placeholder="Timer segments" value="6" style="width:60px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                    <button class="btn btn-xs btn-danger adv-remove-scene-btn">✕</button>
                `;
                scenesContainer.appendChild(sceneDiv);
                // Remove scene button
                sceneDiv.querySelector('.adv-remove-scene-btn').addEventListener('click', () => {
                    sceneDiv.remove();
                });
            });
            
            // Remove act button
            div.querySelector('.adv-remove-act-btn').addEventListener('click', () => {
                div.remove();
            });
        });
    }
    
    // Add NPC
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
    
    // Add Location
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
    
    // Add Timer
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
    
    // Save adventure
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
            
            // Gather acts
            const acts = [];
            document.querySelectorAll('.adv-act-row').forEach(actRow => {
                const titleInput = actRow.querySelector('.adv-act-title');
                const descInput = actRow.querySelector('.adv-act-desc');
                const scenes = [];
                actRow.querySelectorAll('.adv-scene-row').forEach(sceneRow => {
                    const sceneTitle = sceneRow.querySelector('.adv-scene-title')?.value.trim() || 'Untitled Scene';
                    const sceneDesc = sceneRow.querySelector('.adv-scene-desc')?.value.trim() || '';
                    const timerSegs = safeParseInt(sceneRow.querySelector('.adv-scene-timer-segments')?.value, 6);
                    scenes.push({
                        id: generateId('scene_'),
                        title: sceneTitle,
                        description: sceneDesc,
                        timers: [{ name: `${sceneTitle} Timer`, segments: timerSegs, current: 0 }],
                        encounters: [],
                        completed: false
                    });
                });
                if (scenes.length > 0) {
                    acts.push({
                        id: generateId('act_'),
                        title: titleInput?.value.trim() || 'Untitled Act',
                        description: descInput?.value.trim() || '',
                        scenes
                    });
                }
            });
            
            // Gather NPCs
            const npcs = [];
            document.querySelectorAll('.adv-npc-row').forEach(row => {
                const name = row.querySelector('.adv-npc-name')?.value.trim();
                if (name) {
                    npcs.push({
                        id: generateId('npc_'),
                        name,
                        role: row.querySelector('.adv-npc-role')?.value.trim() || '',
                        motivation: row.querySelector('.adv-npc-motivation')?.value.trim() || ''
                    });
                }
            });
            
            // Gather Locations
            const locations = [];
            document.querySelectorAll('.adv-location-row').forEach(row => {
                const name = row.querySelector('.adv-location-name')?.value.trim();
                if (name) {
                    locations.push({
                        id: generateId('loc_'),
                        name,
                        description: row.querySelector('.adv-location-desc')?.value.trim() || ''
                    });
                }
            });
            
            // Gather Timers
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
            
            if (acts.length === 0) {
                showToast('Please add at least one act with scenes.', 'error');
                return;
            }
            
            const adventure = createAdventure({
                title,
                description,
                tier,
                author: 'GM',
                acts,
                npcs,
                locations,
                factions: [],
                campaignTimers,
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
// WINDOW EXPOSURES
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

window.adventureAdvanceTimer = function(id, idx) {
    const result = advanceTimer(id, idx);
    if (result) {
        renderView();
    }
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
    const notes = document.getElementById('adv-notes')?.value;
    if (notes !== undefined) {
        updateAdventure(id, { notes });
        showToast('💾 Notes saved', 'success');
    }
};

// ============================================================
// LIFECYCLE
// ============================================================

function onActivate() {
    isDestroyed = false; // 👈 NEW
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
    isDestroyed = true; // 👈 NEW: stop any in-flight async callback from repainting
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
    resetAdventure,
    exportAdventure,
    importAdventureFromFile,
    importCrownSpreadAsAdventure,
    startSceneEncounter
};

export default {
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
    resetAdventure,
    exportAdventure,
    importAdventureFromFile,
    importCrownSpreadAsAdventure,
    startSceneEncounter
};
