/**
 * Fate's Edge - Adventure Engine
 *
 * Pure state-mutation logic for running a structured adventure module
 * inside a room, mirroring deck.js's own pattern: this file never touches
 * transport (no Socket.io, no plain WebSocket) -- api.js / ws-handlers.js
 * / socketio-handlers.js each call into these functions, then broadcast
 * the result via room.broadcastToRoom(), exactly like they already do
 * for deck draws.
 *
 * SCHEMA: matches the real, already-authored adventure content format
 * used by the client (features/adventure-manager/index.js), NOT an
 * earlier simplified server-invented one. Top level:
 *
 *   { id, title, description, tier, author, saga, sagaParts,
 *     bestiary: [ { id, name, tl, class, category, stats, sb_spends, lore/secret } ],
 *     acts: [ { id, title, description, scenes: [
 *         { id, title, description, completed,
 *           timers: [ { name, segments, current, description } ],
 *           encounters: [
 *             // abstract skill-challenge form:
 *             { name, dv, position, outcomes: { clean, partial, miss } }
 *             // OR creature-reference form (creatureId -> bestiary):
 *             { creatureId, quantity, dv, position, outcomes: {...} }
 *           ]
 *         }
 *     ] } ],
 *     npcs: [ { id, name, role, motivation, stats, secret? } ],
 *     locations: [ { id, name, description, tags } ],
 *     factions: [ { id, name, goals, relationship } ],
 *     campaignTimers: [ { name, segments, current, description } ],
 *     notes, currentAct, currentScene, startedAt, completedAt, status,
 *     createdAt, updatedAt }
 *
 * currentAct/currentScene in the SOURCE FILE are just the default
 * starting position (normally 0/0) -- once loaded into a room, this
 * engine tracks the LIVE position/timer-ticks/completed-flags on a deep
 * copy in room.data.adventure, and never mutates the file on disk.
 *
 * Adventure state lives at room.data.adventure. room.data is already the
 * room's generic free-form data store (see room.js's createRoom()).
 *
 * INTEGRATION NOTE (this pass): this file used to live at the wrong path
 * (files/adventure.js) and was never actually require()'d by api.js,
 * ws-handlers.js, or socketio-handlers.js -- it was dead code sitting
 * alongside two bare, logic-less passthrough case labels
 * ('adventure-timer' / 'adventure-log') in ws-handlers.js's switch. It's
 * now at server/adventure.js and wired into all three real-time/REST
 * entry points, so state mutations are authoritative on the server
 * (recomputed here, not just relayed from whichever client/AI happened
 * to compute a value locally) and every connected client/AI agent stays
 * in sync regardless of who drove the change.
 *
 * "PUSH": distributing the adventure's *source content* to connected web
 * clients uses the EXISTING, unmodified module-push mechanism
 * (POST /api/modules/:id/push, or the 'module-push-request' socket
 * event) -- since an adventure module is just a normal module directory
 * (manifest.json + adventure.json), that endpoint already reads and
 * broadcasts adventure.json's raw content with zero changes needed here.
 * That push carries the STATIC file, not live progress; live state
 * (position, timer ticks, completed flags) only travels through this
 * file's own broadcasts (scene-changed, encounter-started, etc.), which
 * is why getPublicState() below always includes full inline scene/
 * encounter data -- a client needs no local copy of the adventure at all
 * to render the current moment from a broadcast alone.
 */

const path = require('path');
const fs = require('fs');
const { isSafeModuleId } = require('./security.js');

const MODULES_DIR = path.join(__dirname, 'modules');
const MAX_LOG_ENTRIES = 200;
const VALID_OUTCOMES = ['clean', 'partial', 'miss'];

/** Ensure room.data.adventure exists, and return it. */
function ensureAdventureState(room) {
    if (!room.data) room.data = {};
    if (!room.data.adventure) {
        room.data.adventure = {
            module: null,          // deep-copied adventure content, mutated in place
            currentAct: 0,          // index into module.acts
            currentScene: 0,        // index into module.acts[currentAct].scenes
            // Active encounter is tracked by REFERENCE rather than a copy,
            // so ticking a scene timer etc. stays in sync with it:
            //   { source: 'scene', index: N }   -- scene.encounters[N]
            //   { source: 'adhoc', data: {...} } -- improvised, not in the module at all
            activeEncounterRef: null,
            status: 'planned',      // planned | active | completed
            startedAt: null,
            completedAt: null,
            log: [],
            updatedAt: null,
        };
    }
    return room.data.adventure;
}

function appendLog(adventure, entry) {
    adventure.log.push({ timestamp: Date.now(), ...entry });
    if (adventure.log.length > MAX_LOG_ENTRIES) {
        adventure.log = adventure.log.slice(-MAX_LOG_ENTRIES);
    }
}

function getCurrentAct(adventure) {
    return adventure.module?.acts?.[adventure.currentAct] || null;
}

function getCurrentScene(adventure) {
    return getCurrentAct(adventure)?.scenes?.[adventure.currentScene] || null;
}

/**
 * Resolve an encounter reference within a scene's encounters[] array.
 * Accepts a numeric index, or a string matched against the encounter's
 * own `name` or `creatureId` (encounters have no id field of their own in
 * the real schema -- they're identified by position or by these fields).
 * Returns { index, encounter } or null.
 */
function resolveEncounterRef(scene, ref) {
    const list = scene?.encounters || [];
    if (typeof ref === 'number') {
        return list[ref] ? { index: ref, encounter: list[ref] } : null;
    }
    if (typeof ref === 'string') {
        const idx = list.findIndex(e => e.name === ref || e.creatureId === ref);
        return idx >= 0 ? { index: idx, encounter: list[idx] } : null;
    }
    return null;
}

/** Join a creature-reference encounter against the module's bestiary, if applicable. */
function enrichEncounter(adventure, encounter) {
    if (!encounter) return null;
    const enriched = { ...encounter };
    if (enriched.creatureId) {
        const creature = (adventure.module.bestiary || []).find(b => b.id === enriched.creatureId);
        if (creature) enriched.creature = creature;
    }
    return enriched;
}

/**
 * Load an adventure module's content from modules/<id>/adventure.json
 * into the room, replacing any previously-loaded adventure. The
 * module's manifest.json (read separately by GET /api/modules) should
 * set "type": "adventure" to distinguish it from a plain content-push
 * module. Deep-clones the content so completed flags / timer ticks never
 * touch the file on disk, and always resets to a clean starting position
 * (act 0 / scene 0, every scene incomplete, every timer at 0) regardless
 * of whatever the source file's own currentAct/currentScene/timer values
 * are -- matches the client's own startAdventure() behavior exactly, so
 * loading the same file server-side and client-side never disagrees.
 */
function loadAdventureModule(room, moduleId) {
    if (!isSafeModuleId(moduleId)) {
        throw new Error('Invalid module id');
    }
    const moduleDir = path.join(MODULES_DIR, moduleId);
    const manifestPath = path.join(moduleDir, 'manifest.json');
    const adventurePath = path.join(moduleDir, 'adventure.json');

    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Module "${moduleId}" not found (missing manifest.json)`);
    }
    if (!fs.existsSync(adventurePath)) {
        throw new Error(`Module "${moduleId}" has no adventure.json -- it isn't an adventure module`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const content = JSON.parse(fs.readFileSync(adventurePath, 'utf-8'));
    const moduleCopy = JSON.parse(JSON.stringify(content)); // deep clone -- see note above
    moduleCopy.id = moduleCopy.id || moduleId;

    for (const act of moduleCopy.acts || []) {
        for (const scene of act.scenes || []) {
            scene.completed = false;
            for (const t of scene.timers || []) {
                t.current = 0;
            }
        }
    }
    for (const t of moduleCopy.campaignTimers || []) {
        t.current = 0;
    }

    const adventure = ensureAdventureState(room);
    adventure.module = moduleCopy;
    adventure.currentAct = 0;
    adventure.currentScene = 0;
    adventure.activeEncounterRef = null;
    adventure.status = 'active';
    adventure.startedAt = Date.now();
    adventure.completedAt = null;
    adventure.log = [];
    appendLog(adventure, { type: 'loaded', message: `Loaded adventure "${moduleCopy.title}"` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    return getPublicState(room);
}

/**
 * Load an adventure from a plain object (no file on disk). Used for
 * AI‑generated adventures (e.g. Crown Spread output) or any custom
 * content that shouldn't be saved as a permanent module. Deep‑clones
 * the content, resets all timers and scene completed flags, and
 * initialises the room's adventure state. `options.id` can be used
 * to set the module id (defaults to 'custom').
 */
function loadAdventureContent(room, content, options = {}) {
    if (!content || typeof content !== 'object') {
        throw new Error('content object is required');
    }
    if (!content.title) {
        throw new Error('content.title is required');
    }
    if (!Array.isArray(content.acts) || content.acts.length === 0) {
        throw new Error('content.acts must be a non-empty array');
    }

    const moduleCopy = JSON.parse(JSON.stringify(content)); // deep clone
    moduleCopy.id = options.id || moduleCopy.id || 'custom';

    // Reset every scene's completed flag and every timer (scene + campaign)
    for (const act of moduleCopy.acts || []) {
        for (const scene of act.scenes || []) {
            scene.completed = false;
            for (const t of scene.timers || []) {
                t.current = 0;
            }
        }
    }
    for (const t of moduleCopy.campaignTimers || []) {
        t.current = 0;
    }

    const adventure = ensureAdventureState(room);
    adventure.module = moduleCopy;
    adventure.currentAct = 0;
    adventure.currentScene = 0;
    adventure.activeEncounterRef = null;
    adventure.status = 'active';
    adventure.startedAt = Date.now();
    adventure.completedAt = null;
    adventure.log = [];
    appendLog(adventure, { type: 'loaded', message: `Loaded custom adventure "${moduleCopy.title}"` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    return getPublicState(room);
}
/**
 * Advance the adventure. With no target, moves sequentially: next scene
 * in the current act, or the next act's first scene, or marks the
 * adventure completed if this was the final scene of the final act.
 * Pass { actIndex, sceneIndex } to jump to a specific scene instead (e.g.
 * a GM/AI backtracking, or skipping ahead). The scene being LEFT is
 * marked completed either way.
 */
function advanceScene(room, target = {}) {
    const adventure = ensureAdventureState(room);
    if (!adventure.module) throw new Error('No adventure module is loaded in this room');

    const leavingScene = getCurrentScene(adventure);
    if (leavingScene) leavingScene.completed = true;

    const hasExplicitTarget = typeof target.actIndex === 'number' || typeof target.sceneIndex === 'number';

    if (hasExplicitTarget) {
        const actIdx = typeof target.actIndex === 'number' ? target.actIndex : adventure.currentAct;
        const sceneIdx = typeof target.sceneIndex === 'number' ? target.sceneIndex : 0;
        const act = adventure.module.acts[actIdx];
        if (!act) throw new Error(`Act index ${actIdx} does not exist`);
        if (!act.scenes?.[sceneIdx]) throw new Error(`Scene index ${sceneIdx} does not exist in act ${actIdx}`);
        adventure.currentAct = actIdx;
        adventure.currentScene = sceneIdx;
    } else {
        const act = adventure.module.acts[adventure.currentAct];
        if (adventure.currentScene + 1 < (act.scenes?.length || 0)) {
            adventure.currentScene += 1;
        } else if (adventure.currentAct + 1 < adventure.module.acts.length) {
            adventure.currentAct += 1;
            adventure.currentScene = 0;
        } else {
            adventure.status = 'completed';
            adventure.completedAt = Date.now();
            adventure.activeEncounterRef = null;
            appendLog(adventure, { type: 'completed', message: `Adventure "${adventure.module.title}" completed` });
            adventure.updatedAt = Date.now();
            room.lastActivity = Date.now();
            return getPublicState(room);
        }
    }

    adventure.activeEncounterRef = null;
    const newScene = getCurrentScene(adventure);
    appendLog(adventure, { type: 'scene', message: `Scene changed: ${newScene?.title || ''}` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    return getPublicState(room);
}

/**
 * Start an encounter. `ref` is looked up in the CURRENT scene's
 * encounters[] by index or by name/creatureId. `adHocEncounter`, if
 * given, is used directly instead of any lookup -- this is what lets a
 * GM or AI improvise a fight with no pre-written encounter at all: pass
 * any ref (even a made-up label) plus a full encounter object
 * ({ name, dv, position, outcomes } or { creatureId, quantity, dv,
 * position, outcomes }).
 */
function startEncounter(room, ref, adHocEncounter = null) {
    const adventure = ensureAdventureState(room);

    if (adHocEncounter) {
        adventure.activeEncounterRef = { source: 'adhoc', data: adHocEncounter };
        appendLog(adventure, { type: 'encounter-start', message: `Encounter started (ad-hoc): ${adHocEncounter.name || adHocEncounter.creatureId || ref}` });
        adventure.updatedAt = Date.now();
        room.lastActivity = Date.now();
        return getPublicState(room);
    }

    if (!adventure.module) throw new Error('No adventure module is loaded in this room (or pass an ad-hoc encounter object)');
    const scene = getCurrentScene(adventure);
    if (!scene) throw new Error('No current scene');

    const found = resolveEncounterRef(scene, ref);
    if (!found) throw new Error(`Encounter "${ref}" not found in the current scene`);

    adventure.activeEncounterRef = { source: 'scene', index: found.index };
    const name = found.encounter.name || found.encounter.creatureId || String(ref);
    appendLog(adventure, { type: 'encounter-start', message: `Encounter started: ${name}` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    return getPublicState(room);
}

/**
 * Resolve (end) the active encounter with one of the three outcome tiers
 * this system's rolls always produce -- 'clean' | 'partial' | 'miss' --
 * and returns the encounter's own scripted narrative text for that
 * outcome (if any) as `lastResolution.result`. Throws if no encounter is
 * active, or if outcome isn't one of the three valid tiers.
 */
function resolveEncounter(room, { outcome, notes = '' } = {}) {
    const adventure = ensureAdventureState(room);
    if (!adventure.activeEncounterRef) throw new Error('No encounter is currently active in this room');
    if (!VALID_OUTCOMES.includes(outcome)) {
        throw new Error(`outcome must be one of: ${VALID_OUTCOMES.join(', ')}`);
    }

    const encounter = adventure.activeEncounterRef.source === 'adhoc'
        ? adventure.activeEncounterRef.data
        : getCurrentScene(adventure)?.encounters?.[adventure.activeEncounterRef.index];
    if (!encounter) throw new Error('Active encounter reference is invalid');

    const resultText = encounter.outcomes?.[outcome] || '';
    const name = encounter.name || encounter.creatureId || 'Encounter';

    appendLog(adventure, {
        type: 'encounter-resolve',
        message: `Encounter resolved: ${name} (${outcome})`,
        result: resultText,
        notes,
    });
    adventure.activeEncounterRef = null;
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    const state = getPublicState(room);
    state.lastResolution = { encounter: name, outcome, result: resultText, notes };
    return state;
}

/**
 * Tick a timer by `amount` (default +1, can be negative), clamped to
 * [0, segments]. `scope` is 'scene' (the CURRENT scene's own timers --
 * the common case, since most outcome text reads like "Tick Village
 * Safety +1" while that scene is active) or 'campaign'
 * (module.campaignTimers, for the persistent campaign-wide
 * threats/countdowns).
 *
 * `ref` identifies WHICH timer, and accepts either a name string
 * (matches `.name`, most natural for an API/AI caller reading scripted
 * outcome text) or a numeric array index (matches the client's own
 * advanceTimer(id, timerIndex, amount)). `name` is accepted as an alias
 * for `ref` for callers that only have a name.
 */
function tickTimer(room, { scope = 'scene', ref, name, amount = 1 } = {}) {
    const timerRef = ref !== undefined ? ref : name;
    if (timerRef === undefined || timerRef === null || timerRef === '') {
        throw new Error('ref (or name) is required');
    }
    const adventure = ensureAdventureState(room);
    if (!adventure.module) throw new Error('No adventure module is loaded in this room');

    let timers;
    if (scope === 'campaign') {
        timers = adventure.module.campaignTimers || [];
    } else {
        const scene = getCurrentScene(adventure);
        if (!scene) throw new Error('No current scene');
        timers = scene.timers || [];
    }

    let timer;
    if (typeof timerRef === 'number') {
        timer = timers[timerRef];
        if (!timer) throw new Error(`Timer index ${timerRef} does not exist in ${scope} scope`);
    } else {
        timer = timers.find(t => t.name === timerRef);
        if (!timer) throw new Error(`Timer "${timerRef}" not found in ${scope} scope`);
    }

    timer.current = Math.max(0, Math.min(timer.segments, (timer.current || 0) + amount));
    const isFull = timer.current >= timer.segments;

    appendLog(adventure, {
        type: 'timer',
        message: `${timer.name}: ${timer.current}/${timer.segments}${isFull ? ' (FULL)' : ''}`,
    });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    const state = getPublicState(room);
    state.tickedTimer = { ...timer, scope, full: isFull };
    return state;
}

/**
 * Reset a loaded adventure back to 'planned' -- clears startedAt/
 * completedAt, position, every scene's completed flag, and every timer.
 * Matches the client's own resetAdventure() exactly. Does NOT unload the
 * module (call loadAdventureModule again to swap to a different one).
 */
function resetAdventure(room) {
    const adventure = ensureAdventureState(room);
    if (!adventure.module) throw new Error('No adventure module is loaded in this room');

    adventure.status = 'planned';
    adventure.startedAt = null;
    adventure.completedAt = null;
    adventure.currentAct = 0;
    adventure.currentScene = 0;
    adventure.activeEncounterRef = null;
    for (const act of adventure.module.acts || []) {
        for (const scene of act.scenes || []) {
            scene.completed = false;
        }
    }
    for (const t of adventure.module.campaignTimers || []) {
        t.current = 0;
    }
    appendLog(adventure, { type: 'reset', message: `Adventure "${adventure.module.title}" reset` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    return getPublicState(room);
}

/**
 * Append a free-form narrative/GM beat to the adventure log -- for
 * anything that doesn't fit the scene/encounter/timer structure (a GM
 * aside, an AI's narration of what just happened, a note tying a
 * card-draw consequence from the existing deck system back into the
 * adventure's story, etc.). Works even if no adventure module is loaded,
 * so it can double as a lightweight session log.
 */
function logBeat(room, { text, author = 'GM' } = {}) {
    if (!text) throw new Error('text is required');
    const adventure = ensureAdventureState(room);
    appendLog(adventure, { type: 'beat', message: text, author });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();
    return getPublicState(room);
}

/**
 * The subset of adventure state that's safe/useful to send on every
 * update: current position, active encounter (creature-enriched if
 * applicable), campaign timers, a recent slice of the log, and a
 * lightweight table-of-contents (titles + completed flags, NOT full
 * scene bodies for anything but the current scene). Large reference
 * material (bestiary/npcs/locations/factions/notes) is deliberately NOT
 * included here -- see getReferenceData() for that, fetched once rather
 * than resent on every tick/scene-change/encounter broadcast.
 */
function getPublicState(room) {
    const adventure = ensureAdventureState(room);
    if (!adventure.module) {
        return {
            moduleId: null,
            status: adventure.status,
            log: adventure.log.slice(-20),
            updatedAt: adventure.updatedAt,
        };
    }

    const act = getCurrentAct(adventure);
    const scene = getCurrentScene(adventure);

    let activeEncounter = null;
    if (adventure.activeEncounterRef) {
        if (adventure.activeEncounterRef.source === 'adhoc') {
            activeEncounter = enrichEncounter(adventure, adventure.activeEncounterRef.data);
        } else {
            const enc = scene?.encounters?.[adventure.activeEncounterRef.index];
            activeEncounter = enc ? { ...enrichEncounter(adventure, enc), index: adventure.activeEncounterRef.index } : null;
        }
    }

    return {
        moduleId: adventure.module.id,
        title: adventure.module.title,
        tier: adventure.module.tier,
        tierRange: adventure.module.tierRange || adventure.module.tier,
        status: adventure.status,
        currentActIndex: adventure.currentAct,
        currentSceneIndex: adventure.currentScene,
        currentAct: act ? { title: act.title, description: act.description } : null,
        currentScene: scene || null,
        activeEncounter,
        campaignTimers: adventure.module.campaignTimers || [],
        log: adventure.log.slice(-20),
        tableOfContents: (adventure.module.acts || []).map(a => ({
            title: a.title,
            scenes: (a.scenes || []).map(s => ({ title: s.title, completed: !!s.completed })),
        })),
        saga: adventure.module.saga ? { sagaParts: adventure.module.sagaParts || [] } : null,
        updatedAt: adventure.updatedAt,
    };
}

/**
 * Large, rarely-changing reference material for the currently loaded
 * adventure -- fetched once (e.g. when the GM/AI first opens the
 * adventure, or on demand) rather than included in every broadcast. This
 * is what lets the AI GM know about NPCs, locations, factions, and the
 * full bestiary to run the module intelligently.
 */
function getReferenceData(room) {
    const adventure = ensureAdventureState(room);
    if (!adventure.module) throw new Error('No adventure module is loaded in this room');
    return {
        moduleId: adventure.module.id,
        bestiary: adventure.module.bestiary || [],
        npcs: adventure.module.npcs || [],
        locations: adventure.module.locations || [],
        factions: adventure.module.factions || [],
        notes: adventure.module.notes || '',
    };
}

module.exports = {
    ensureAdventureState,
    loadAdventureModule,
    loadAdventureContent,
    advanceScene,
    startEncounter,
    resolveEncounter,
    tickTimer,
    resetAdventure,
    logBeat,
    getPublicState,
    getReferenceData,
    getCurrentAct,
    getCurrentScene,
    resolveEncounterRef,
};
