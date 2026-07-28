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
 */

import { getState, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml, safeParseInt } from '../../core/utils.js';
import { logToSession, addVTTEvent } from '../gm-tools/index.js';
import { isConnectedToServer, sendEvent } from '../../core/websocket.js';

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

// ============================================================
// RICH TEXT RENDERING (plain text → nice HTML, composed from sub-parts)
// ============================================================
// Adventure/act descriptions are stored as plain text — sometimes with
// a handful of inline <em> tags baked in from region card flavor (Crown
// Spread synthesis text is the main source of these). Storing pre-built
// HTML in the adventure JSON is a maintenance nightmare, and running
// everything through escHtml() mangles those inline tags into visible
// "&lt;em&gt;". This renders the *plain text* nicely and builds the
// actual HTML structure (headers, chips, paragraphs) here, at display
// time, from known sub-components — not from markup baked into the data.

const RICH_TEXT_ALLOWED_TAGS = ['em', 'strong', 'i', 'b'];

// Escapes everything EXCEPT the small whitelist of inline tags already
// used in region/card flavor text, so a stray "<script>" still gets
// neutered but an authored "<em>...</em>" renders as emphasis instead
// of literal "&lt;em&gt;" text.
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

// "[Label: detail text]" → a small styled callout chip, instead of
// showing up as literal square brackets in a wall of text.
function renderBracketAnnotations(html) {
    return html.replace(/\[([A-Za-z][A-Za-z ]{0,20}):\s*([^\]]+)\]/g, (match, label, detail) => `
        <span style="display:inline-block;margin:0.15rem 0.2rem 0.15rem 0;padding:0.1rem 0.5rem;background:var(--bg4);border-radius:10px;border-left:3px solid var(--gold);font-size:0.8rem;">
            <strong style="color:var(--gold);">${label}:</strong> ${detail}
        </span>
    `);
}

// "**bold**" (used by Ace Effect text) → real <strong>.
function renderMarkdownBold(html) {
    return html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// Crown Spread synthesis text (from decks/index.js) is always built
// from these position/wildcard/timer/ace-effect emoji markers.
const POSITION_MARKERS = ['🌱', '🏔️', '👑', '🤝', '🌟', '⏱️', '♠️'];

function looksLikeCrownSpreadText(text) {
    return POSITION_MARKERS.filter(m => text.includes(m)).length >= 3;
}

// Splits Crown Spread synthesis text into one styled block per
// position/wildcard/timer/ace-effect segment, with [Bracket] annotations
// as chips and **bold** as real emphasis.
function renderCrownSpreadHtml(text) {
    const splitPattern = /(?=(?:🌱|🏔️|👑|🤝|🌟|⏱️|♠️))/g;
    const rawSegments = text.split(splitPattern).map(s => s.trim()).filter(Boolean);

    const blocks = rawSegments.map(seg => {
        const marker = POSITION_MARKERS.find(m => seg.startsWith(m));
        const rest = marker ? seg.slice(marker.length).trim() : seg;
        const colonIdx = rest.indexOf(':');
        // Only treat a colon within the first ~25 chars as a "Label:" —
        // further out, it's just punctuation inside the body text.
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

/**
 * Turns raw description text into safe, nicely structured HTML.
 * Crown Spread synthesis text gets the full position-by-position
 * treatment above; anything else just gets paragraph breaks plus the
 * same [Bracket]/**bold** treatment, so a long block of plain text
 * reads comfortably instead of as one dense run-on paragraph. Inline
 * <em>/<strong> already present in the source text survive intact.
 */
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

// Clean, short, tag-free preview for compact contexts (the adventure
// list card) — strips tags/brackets/markdown/emoji markers rather than
// showing a giant escaped wall of Crown Spread text in a summary line.
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

// 👇 ROOT CAUSE FOUND: core/utils.js's generateId() takes a LENGTH
// (a number), not a prefix. Every call in this file was doing
// generateId('adv_') / generateId('scene_') / etc, expecting it to
// return "adv_xxxxx" — but passing a string where a number is expected
// coerces to NaN, and String.prototype.substr(start, NaN) returns an
// empty string. So every id in every adventure/act/scene/npc/location
// created here was silently "" — which is why a freshly created
// adventure would show up in the list (it's still a real object in the
// array) but could never be opened: activeAdventureId = "" is falsy,
// so the `adventureViewMode === 'detail' && activeAdventureId` check in
// renderView() always failed and silently fell back to the list view,
// on every click, forever, surviving refreshes because the data really
// was saved — just permanently unopenable. This is a self-contained
// replacement that doesn't depend on generateId's actual behavior at
// all, so it can't silently break the same way again.
function makeId(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Fixes up any adventure (freshly loaded from storage, imported from a
// file, or pulled from the library) that has empty/missing ids on
// itself or any of its acts/scenes/npcs/locations — whether from this
// exact bug in an earlier version, or from hand-edited/external JSON.
// Returns true if anything was actually repaired, so callers can decide
// whether to re-save.
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
    return repaired;
}

// ============================================================
// DATA LOADING
// ============================================================

function loadAdventuresFromState() {
    const state = getState();
    if (state.adventures) {
        adventures = state.adventures;
        // Self-heal any adventure saved before makeId() existed — these
        // are the ones stuck with empty ids (see the note above
        // repairAdventureIds) and were previously unopenable no matter
        // how many times you clicked or refreshed.
        let anyRepaired = false;
        adventures.forEach(a => {
            if (repairAdventureIds(a)) anyRepaired = true;
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
        // Validate serializability *before* handing off to the shared
        // saveState() (whose own try/catch only logs a console.warn —
        // easy to miss, and exactly the kind of "silent failure" that
        // makes a newly created adventure vanish on the next reload
        // without any visible sign anything went wrong).
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

            // Same normalization createAdventure() applies — a manifest
            // JSON with e.g. non-array acts would otherwise load "fine"
            // here and then throw the moment the list/detail view tried
            // to render it.
            if (!Array.isArray(data.acts)) data.acts = [];
            data.acts = data.acts.map(act => ({ ...act, scenes: Array.isArray(act.scenes) ? act.scenes : [] }));
            if (!Array.isArray(data.npcs)) data.npcs = [];
            if (!Array.isArray(data.locations)) data.locations = [];
            if (!Array.isArray(data.campaignTimers)) data.campaignTimers = [];
            repairAdventureIds(data); // fixes files exported before makeId() existed (empty ids throughout)

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

    // ─── Create the modal ──────────────────────────────────────────
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: var(--bg1);
        padding: 1.5rem;
        border-radius: var(--radius);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        border: 1px solid var(--border);
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
            <button class="btn btn-sm btn-secondary" id="adv-library-cancel">Cancel</button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // ─── Inject styles ──────────────────────────────────────────────
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

    // ─── Event listeners ──────────────────────────────────────────
    const cancelBtn = content.querySelector('#adv-library-cancel');
    cancelBtn.addEventListener('click', () => modal.remove());

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    const items = content.querySelectorAll('.adv-library-item');
    items.forEach(item => {
        item.addEventListener('click', async function() {
            const slug = this.dataset.slug;
            // Disable further clicks while loading
            this.style.opacity = '0.5';
            this.style.cursor = 'wait';
            this.innerHTML = `<span>${escHtml(slug)}</span><span style="font-size:0.6rem;color:var(--gold);">⏳ Loading…</span>`;

            const data = await loadAdventureFromFile(slug);
            if (isDestroyed) {
                modal.remove();
                return;
            }

            modal.remove();

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
    if (!activeAdventureId) return null;
    return getAdventure(activeAdventureId);
}

// ============================================================
// ADVENTURE CRUD
// ============================================================

function createAdventure(data) {
    // Defensively normalize acts/scenes — a non-array here (from hand-edited
    // or externally-generated JSON) would otherwise throw deep inside the
    // render code (act.scenes?.map(...) only guards against undefined, not
    // against a wrong-typed truthy value), taking down the whole list.
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
        notes: data.notes || '',
        currentAct: data.currentAct || 0,
        currentScene: data.currentScene || 0,
        startedAt: data.startedAt || null,
        completedAt: data.completedAt || null,
        status: data.status || 'planned',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Final safety net regardless of what the caller passed in — this
    // is the exact bug that made every Crown Spread import unopenable.
    repairAdventureIds(adventure);

    // Surface a bad object immediately — silently pushing something that
    // can't round-trip through JSON is exactly how an adventure ends up
    // "there" in memory but gone after a refresh with no visible error.
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
    copy.id = makeId('adv_');
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
    adventure.acts.forEach(act => {
        act.scenes.forEach(scene => scene.completed = false);
    });
    adventure.campaignTimers.forEach(t => t.current = 0);
    saveAdventuresToState();
    activeAdventureId = id;

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
    broadcastSceneStatus(null);
    return adventure;
}

// ============================================================
// SCENE ↔ ENCOUNTER BRIDGE
// ============================================================

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
            id: makeId('enc_'),
            title: `${scene.title} (${adventure.title})`,
            body: scene.description || '',
            difficulty: 2,
            location: '',
            status: 'active',
            adversaries,
            created: Date.now(),
            // 👇 NEW: origin tags — lets other views (e.g. GM Tools'
            // Active Encounters list) show which adventure/scene this
            // came from without having to cross-reference by title.
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
    }

    try {
        const combat = await import('../encounters/combat.js');
        combat.openTracker(encounter.id);
    } catch (e) {
        console.warn('[Adventures] Failed to open Combat Tracker:', e);
        showToast('Combat Tracker not available.', 'error');
    }
}

// Matches the slug convention your own tools/generate-manifests.js
// produces (lowercase, underscores) — so an exported file can be
// dropped straight into /data/adventures/ and referenced by a manifest
// entry without renaming anything.
function slugify(text) {
    const slug = String(text || 'adventure')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
    return slug || 'adventure';
}

function exportAdventure(id) {
    const adventure = getAdventure(id);
    if (!adventure) return null;
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

                // Same normalization createAdventure() applies — this path
                // used to push the raw parsed JSON straight in, bypassing
                // those guards entirely, so a file with e.g. acts as a
                // non-array would render fine here but throw deep inside
                // the list/detail views the moment it tried to display.
                if (!Array.isArray(data.acts)) data.acts = [];
                data.acts = data.acts.map(act => ({ ...act, scenes: Array.isArray(act.scenes) ? act.scenes : [] }));
                if (!Array.isArray(data.npcs)) data.npcs = [];
                if (!Array.isArray(data.locations)) data.locations = [];
                if (!Array.isArray(data.campaignTimers)) data.campaignTimers = [];
                repairAdventureIds(data); // fixes files exported before makeId() existed (empty ids throughout)

                try {
                    JSON.parse(JSON.stringify(data));
                } catch (e) {
                    showToast(`This file's data can't be used (${e.message}).`, 'error');
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
                const saved = saveAdventuresToState();
                if (saved) {
                    showToast(`📥 Imported "${data.title}"`, 'success');
                } // saveAdventuresToState() already showed its own error toast otherwise
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
// CROWN SPREAD → ADVENTURE TEMPLATE (parse + build)
// ============================================================
// Crown Spread synthesis text has a fixed, deterministic structure:
// Decks always draws Hearts→Spades→Clubs→Diamonds (drawOneOfEachSuit)
// and always assigns them Root→Crest→Crown→Left-Hand (CROWN_POSITIONS),
// in that order. So the suit archetypes are pinned to positions too:
// Root is always the Hearts/Actor card, Crest always Spades/Location,
// Crown always Clubs/Complication, Left Hand always Diamonds/Reward.
// That reliability is what makes turning the reading into a proper
// adventure skeleton possible instead of just archiving the text.

const CROWN_TEMPLATE_MARKERS = [
    { marker: '🌱', label: 'Root', role: 'npc' },
    { marker: '🏔️', label: 'Crest', role: 'location' },
    { marker: '👑', label: 'Crown', role: 'complication' },
    { marker: '🤝', label: 'Left Hand', role: 'reward' },
];
const CROWN_ALL_MARKERS = ['🌱', '🏔️', '👑', '🤝', '🌟', '⏱️', '♠️'];

// "{Rank} of {Suit} ({Archetype} – {Tier}): {Card Title}: {flavor...}
// (N segments if highest)." — pulls the card's own title (distinct from
// its flavor paragraph) and its suggested timer size straight out of
// that one string, without needing to reach into Decks' internals.
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

/**
 * Parses a Crown Spread synthesis string (the exact text Decks builds
 * in synthesiseCrownSpread(), whether it came from a fresh draw or
 * Decks' own history) into: one entry per Root/Crest/Crown/Left-Hand
 * position, the Wildcard twist, any Ace Effect, and the suggested
 * Adventure Clock timer (segments + which card triggered it).
 */
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

/**
 * Builds a full adventure skeleton from a parsed Crown Spread: one
 * scene per position, an NPC pulled from Root (always Hearts/Actor),
 * a Location pulled from Crest (always Spades/Location), the Wildcard
 * twist folded into the Crown scene (the confrontation is where a
 * twist lands hardest), an Adventure Clock timer sized from the
 * highest non-wildcard card, and any Ace Effect tucked into GM-facing
 * notes as a diagetic aside rather than dropped into scene text.
 */
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
        notes: notesParts.join('\n\n'),
        status: 'planned'
    };
}

// ============================================================
// CROWN SPREAD IMPORT
// ============================================================
// Reads Decks' own local deckHistory (via its getDeckHistory() export)
// for the most recent real Crown Spread draw. If none exists yet, draws
// one live via Decks' own quickCrownSpread(), reusing whatever region
// Decks already has selected, or prompting for one from its actual
// discovered region list if not (and saying so plainly if Decks hasn't
// been opened yet this session, since region discovery only happens
// when that tab renders).
//
// The reading then gets parsed into a real adventure skeleton (see
// above) rather than archived as one flat description — so there's
// something to actually run, not just a name and a wall of text. Since
// this is a static-served app with no write endpoint for adventure
// data, "saved to /data/adventures" is approximated as closely as a
// browser can: it's persisted into app state (survives reloads) and
// auto-exported as a ready-to-drop JSON file for that folder.

async function importCrownSpreadAsAdventure() {
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

    // 1) Prefer a Crown Spread Decks already drew and displayed this session.
    try {
        const history = decks.getDeckHistory ? decks.getDeckHistory() : [];
        const recent = [...history].reverse().find(e => e.type === 'Crown Spread');
        if (recent) {
            cardNames = recent.cards;
            synthesis = recent.synthesis;
        }
    } catch (e) { /* ignore */ }

    // 2) Nothing drawn yet — draw one now via the real quickCrownSpread(),
    // picking a region first if Decks doesn't already have one selected.
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
        if (!drawResult) return null; // quickCrownSpread already toasts its own error (e.g. bad region)
        cardNames = drawResult.cardNames;
        synthesis = drawResult.result.synthesis;
    }

    return createAdventureFromCrownSpreadReading({ synthesis, cardNames, region });
}

/**
 * Builds + saves + opens an adventure from an *already-drawn* Crown
 * Spread reading — the shared tail end of importCrownSpreadAsAdventure
 * above, pulled out so other features (e.g. GM Tools, which draws its
 * own Crown Spreads on the Consequences tab) can turn a reading they
 * already have into an adventure without re-drawing, re-checking
 * history, or duplicating the parsing/template logic.
 */
function createAdventureFromCrownSpreadReading({ synthesis, cardNames, region, title, tier } = {}) {
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
            // Parsing found no recognizable positions (unexpected synthesis
            // shape) — fall back to archiving the reading as a single scene
            // rather than losing it.
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
                    completed: false
                }]
            }],
            campaignTimers: [{ name: 'Adventure Clock', segments: 8, current: 0, description: 'Overall adventure pace' }],
            status: 'planned'
        };

    const adventure = createAdventure(templateData);
    if (!adventure) return null; // createAdventure already toasted the specific error

    // Best available equivalent of "save to /data/adventures" from a
    // static-served client — auto-download a ready-to-drop JSON file.
    exportAdventure(adventure.id);

    // Open it for editing immediately, so there's more than a name and
    // truncated description to work from.
    activeAdventureId = adventure.id;
    adventureViewMode = 'detail';
    renderView();

    showToast(`👑 Built "${adventure.title}" from the Crown Spread and opened it for editing.`, 'success');
    return adventure;
}

// ============================================================
// RENDER
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
                        ${adventures.map(a => renderAdventureCardSafe(a)).join('')}
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

// A single malformed adventure (bad JSON round-trip, unexpected shape
// from a hand-edited or externally-generated file) previously took
// down the ENTIRE list — .map() over all adventures throws on the
// first bad one, so renderAdventureList() itself throws and the whole
// tab goes blank. This isolates the failure to just that one card.
function renderAdventureCardSafe(adventure) {
    try {
        return renderAdventureCard(adventure);
    } catch (e) {
        console.error('[Adventures] Failed to render adventure card:', adventure?.id, e);
        return `
            <div class="panel" style="padding:0.6rem 0.8rem;border-left:4px solid var(--red);">
                <div style="font-weight:600;color:var(--red);">⚠️ "${escHtml(adventure?.title || adventure?.id || 'Unknown adventure')}" failed to render</div>
                <div style="font-size:0.75rem;color:var(--text3);margin:0.2rem 0;">${escHtml(e.message)} — see browser console for details.</div>
                <div style="display:flex;gap:0.3rem;">
                    <button class="btn btn-xs btn-secondary" onclick="window.adventureExport('${adventure?.id}')">📤 Export raw data</button>
                    <button class="btn btn-xs btn-danger" onclick="window.adventureDelete('${adventure?.id}')">🗑️ Remove</button>
                </div>
            </div>
        `;
    }
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

    const actsHtml = adventure.acts?.map((act, actIdx) => `
        <div class="panel" style="background:var(--bg3);border-left:3px solid var(--gold);padding:0.3rem 0.5rem;margin:0.2rem 0;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                <span style="font-weight:600;font-size:0.85rem;">${escHtml(act.title)}</span>
                <span style="font-size:0.65rem;color:var(--text3);">${act.scenes?.length || 0} scenes</span>
            </div>
            ${act.description ? `<div style="font-size:0.7rem;">${renderDescriptionHtml(act.description)}</div>` : ''}
            <div style="margin-top:0.2rem;display:flex;flex-direction:column;gap:0.1rem;padding-left:0.3rem;">
                ${act.scenes?.map((scene, sceneIdx) => {
                    const isCurrent = actIdx === adventure.currentAct && sceneIdx === adventure.currentScene;
                    const isCompleted = scene.completed;
                    const descId = `scene-desc-${adventure.id}-${actIdx}-${sceneIdx}`;
                    return `
                        <div style="display:flex;flex-direction:column;padding:0.1rem 0.2rem;border-radius:4px;${isCurrent ? 'background:var(--bg4);border-left:3px solid var(--gold);' : ''}${isCompleted ? 'opacity:0.6;' : ''}">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <div style="display:flex;align-items:center;gap:0.3rem;">
                                    <span style="font-size:0.8rem;">${isCompleted ? '✅' : isCurrent ? '▶️' : '⏹️'}</span>
                                    <span style="font-size:0.75rem;${isCurrent ? 'font-weight:600;color:var(--gold);' : ''}">${escHtml(scene.title)}</span>
                                    ${scene.description ? `<button class="btn btn-xs btn-ghost" onclick="window.adventureToggleSceneDesc('${descId}')" title="Show/hide scene description" style="padding:0 0.3rem;font-size:0.7rem;">📖</button>` : ''}
                                </div>
                                <div style="display:flex;gap:0.2rem;align-items:center;">
                                    ${scene.timers?.map(t => `
                                        <span style="font-size:0.55rem;color:var(--text3);">${escHtml(t.name)} ${t.current}/${t.segments}</span>
                                    `).join('') || ''}
                                    ${isCurrent ? `<button class="btn btn-xs btn-danger" onclick="window.adventureStartEncounter('${adventure.id}', ${actIdx}, ${sceneIdx})" title="${scene.encounterId ? 'Reopen the Combat Tracker for this scene' : 'Create an Encounter from this scene and open the Combat Tracker'}">⚔️ ${scene.encounterId ? 'Resume' : 'Start'} Encounter</button>` : ''}
                                    ${!isCompleted && isCurrent ? `<button class="btn btn-xs btn-primary" onclick="window.adventureCompleteScene('${adventure.id}', ${actIdx}, ${sceneIdx})">✓ Complete</button>` : ''}
                                </div>
                            </div>
                            ${scene.description ? `<div id="${descId}" style="display:none;margin:0.2rem 0 0.3rem 1.3rem;font-size:0.75rem;">${renderDescriptionHtml(scene.description)}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('') || '<span class="text-muted text-sm">No acts defined.</span>';

    const npcsHtml = adventure.npcs?.map(npc => `
        <div class="panel" style="background:var(--bg3);padding:0.2rem 0.4rem;margin:0.1rem 0;border-left:2px solid var(--gold);">
            <span style="font-weight:600;font-size:0.8rem;">${escHtml(npc.name)}</span>
            ${npc.role ? `<span style="font-size:0.65rem;color:var(--text3);"> — ${escHtml(npc.role)}</span>` : ''}
            ${npc.motivation ? `<div style="font-size:0.65rem;color:var(--text2);">🎯 ${escHtml(npc.motivation)}</div>` : ''}
        </div>
    `).join('') || '<span class="text-muted text-sm">No NPCs.</span>';

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
                        <h4 style="margin:0;font-size:0.9rem;">📝 Notes</h4>
                        <textarea id="adv-notes" rows="3" style="width:100%;font-size:0.75rem;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;">${escHtml(adventure.notes || '')}</textarea>
                        <button class="btn btn-xs btn-primary mt-1" onclick="window.adventureSaveNotes('${adventure.id}')">💾 Save Notes</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// A malformed adventure previously blanked this whole view with an
// uncaught exception and no indication why. This isolates the failure
// and gives the GM a way to inspect (export) or remove the bad entry
// instead of being stuck.
function renderAdventureDetail(adventureId) {
    const adventure = getAdventure(adventureId);
    if (!adventure) {
        return `<div class="panel"><p class="text-muted">Adventure not found.</p><button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button></div>`;
    }
    try {
        return buildAdventureDetailHtml(adventure);
    } catch (e) {
        console.error('[Adventures] Failed to render adventure detail:', adventureId, e);
        return `
            <div class="panel">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                    <button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button>
                </div>
                <p style="color:var(--red);font-weight:600;">⚠️ This adventure failed to render: ${escHtml(e.message)}</p>
                <p class="text-muted" style="font-size:0.75rem;">Check the browser console for the full error. The underlying data is still there — Export to inspect the raw JSON, or Delete to remove it.</p>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-sm btn-secondary" onclick="window.adventureExport('${adventureId}')">📤 Export</button>
                    <button class="btn btn-sm btn-danger" onclick="window.adventureDelete('${adventureId}')">🗑️ Delete</button>
                </div>
            </div>
        `;
    }
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
    const browseBtn = document.getElementById('adv-browse-library-btn');
    if (browseBtn) {
        browseBtn.addEventListener('click', browseAdventureLibrary);
    }

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
            renderView();
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
                    <input type="number" class="adv-scene-timer-segments" placeholder="Timer segments" value="6" style="width:60px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                    <button class="btn btn-xs btn-danger adv-remove-scene-btn">✕</button>
                `;
                scenesContainer.appendChild(sceneDiv);
                sceneDiv.querySelector('.adv-remove-scene-btn').addEventListener('click', () => {
                    sceneDiv.remove();
                });
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
                    scenes.push({
                        id: makeId('scene_'),
                        title: sceneTitle,
                        description: sceneDesc,
                        timers: [{ name: `${sceneTitle} Timer`, segments: timerSegs, current: 0 }],
                        encounters: [],
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

window.adventureToggleSceneDesc = function(descId) {
    const el = document.getElementById(descId);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
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
    resetAdventure,
    exportAdventure,
    importAdventureFromFile,
    importCrownSpreadAsAdventure,
    createAdventureFromCrownSpreadReading,
    startSceneEncounter
};