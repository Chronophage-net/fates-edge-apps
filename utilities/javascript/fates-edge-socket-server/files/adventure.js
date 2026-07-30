/**
 * Fate's Edge - Adventure Engine
 *
 * Pure state-mutation logic for running a structured adventure module
 * (acts -> scenes -> encounters) inside a room, mirroring deck.js's own
 * pattern: this file never touches transport (no Socket.io, no plain
 * WebSocket) -- api.js / ws-handlers.js / socketio-handlers.js each call
 * into these functions, then broadcast the result via
 * room.broadcastToRoom(), exactly like they already do for deck draws.
 *
 * Adventure state lives at room.data.adventure. room.data is already the
 * room's generic free-form data store (see room.js's createRoom(), which
 * currently only puts `region` there) -- this is deliberately NOT a new
 * top-level room field, so it rides along for free with anything that
 * already treats room.data as an opaque bag.
 *
 * ADVENTURE MODULE FORMAT: an adventure-capable module is a normal module
 * directory (server/modules/<id>/) with the usual manifest.json (set
 * "type": "adventure" in it so GET /api/modules can distinguish it from a
 * plain content-push module) PLUS a sibling adventure.json describing the
 * actual content:
 *
 *   {
 *     "title": "The Salt Road Incident",
 *     "acts": [
 *       {
 *         "id": "act-1",
 *         "title": "Act I: Arrival",
 *         "scenes": [
 *           {
 *             "id": "scene-1-1",
 *             "title": "The Broken Caravan",
 *             "readAloud": "...",
 *             "gmNotes": "...",
 *             "encounters": [
 *               { "id": "enc-bandits", "name": "Bandit Ambush",
 *                 "combatants": [ { "name": "Bandit Leader", "hp": 12 } ] }
 *             ],
 *             "nextSceneId": "scene-1-2"
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * See modules/example-adventure/ for a complete working example.
 *
 * WHY THIS SHAPE: it's intentionally driveable by a GM's own tooling OR a
 * fully automated/AI agent through plain authenticated REST calls (see
 * the /api/rooms/:code/adventure/* routes added to api.js) without
 * needing to understand Socket.io/plain-WebSocket transport at all --
 * the exact same functions back the matching WS commands, for the live
 * web client's own UI actions.
 */

const path = require('path');
const fs = require('fs');
const { isSafeModuleId } = require('./security.js');

const MODULES_DIR = path.join(__dirname, 'modules');
const MAX_LOG_ENTRIES = 200;

/** Ensure room.data.adventure exists, and return it. */
function ensureAdventureState(room) {
    if (!room.data) room.data = {};
    if (!room.data.adventure) {
        room.data.adventure = {
            moduleId: null,
            title: null,
            acts: [],
            currentActId: null,
            currentSceneId: null,
            activeEncounter: null, // { id, name, combatants, round, startedAt }
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

/** Find a scene by id across all acts. Returns { act, scene } or null. */
function findScene(adventure, sceneId) {
    if (!sceneId) return null;
    for (const act of adventure.acts) {
        const scene = (act.scenes || []).find(s => s.id === sceneId);
        if (scene) return { act, scene };
    }
    return null;
}

/** Find an encounter by id across all acts/scenes. Returns { act, scene, encounter } or null. */
function findEncounter(adventure, encounterId) {
    if (!encounterId) return null;
    for (const act of adventure.acts) {
        for (const scene of act.scenes || []) {
            const enc = (scene.encounters || []).find(e => e.id === encounterId);
            if (enc) return { act, scene, encounter: enc };
        }
    }
    return null;
}

/**
 * Load an adventure module's structured content (acts/scenes/encounters)
 * from modules/<id>/adventure.json into the room, replacing any
 * previously-loaded adventure. Throws if the module doesn't exist or
 * isn't an adventure module (no adventure.json alongside its manifest).
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

    const adventure = ensureAdventureState(room);
    adventure.moduleId = moduleId;
    adventure.title = content.title || manifest.name || moduleId;
    adventure.acts = Array.isArray(content.acts) ? content.acts : [];
    adventure.currentActId = adventure.acts[0]?.id || null;
    adventure.currentSceneId = adventure.acts[0]?.scenes?.[0]?.id || null;
    adventure.activeEncounter = null;
    adventure.log = [];
    appendLog(adventure, { type: 'loaded', message: `Loaded adventure "${adventure.title}"` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    return getPublicState(room);
}

/**
 * Advance to a specific scene (by id), or -- if sceneId is omitted/null --
 * the scene named by the CURRENT scene's own `nextSceneId` field. Clears
 * any active encounter (a new scene means the previous fight is over, one
 * way or another). Throws if there's no adventure loaded, no target scene
 * can be resolved, or the target scene id doesn't exist in this adventure.
 */
function advanceScene(room, sceneId = null) {
    const adventure = ensureAdventureState(room);
    if (!adventure.moduleId) throw new Error('No adventure module is loaded in this room');

    let targetId = sceneId;
    if (!targetId) {
        const current = findScene(adventure, adventure.currentSceneId);
        targetId = current?.scene?.nextSceneId || null;
    }
    if (!targetId) throw new Error('No target scene specified and no next scene is defined');

    const found = findScene(adventure, targetId);
    if (!found) throw new Error(`Scene "${targetId}" not found in the loaded adventure`);

    adventure.currentActId = found.act.id;
    adventure.currentSceneId = found.scene.id;
    adventure.activeEncounter = null;
    appendLog(adventure, { type: 'scene', message: `Scene changed: ${found.scene.title || found.scene.id}` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    return getPublicState(room);
}

/**
 * Start an encounter. `encounterId` is looked up across the loaded
 * adventure by default. `combatantsOverride`, if given, replaces the
 * encounter definition's own combatant list entirely -- this is what lets
 * a GM or an AI agent spin up a fully ad-hoc fight with no pre-written
 * encounter at all: pass any encounterId (even a made-up one) plus a full
 * combatants array, and the lookup is skipped.
 */
function startEncounter(room, encounterId, combatantsOverride = null) {
    if (!encounterId) throw new Error('encounterId is required');
    const adventure = ensureAdventureState(room);

    let name = encounterId;
    let combatants = combatantsOverride;

    if (!combatants) {
        if (!adventure.moduleId) throw new Error('No adventure module is loaded in this room (or pass combatants explicitly for an ad-hoc encounter)');
        const found = findEncounter(adventure, encounterId);
        if (!found) throw new Error(`Encounter "${encounterId}" not found in the loaded adventure`);
        name = found.encounter.name || encounterId;
        combatants = found.encounter.combatants || [];
    }

    adventure.activeEncounter = {
        id: encounterId,
        name,
        combatants,
        round: 1,
        startedAt: Date.now(),
    };
    appendLog(adventure, { type: 'encounter-start', message: `Encounter started: ${name}` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    return getPublicState(room);
}

/** Resolve (end) the currently active encounter, if any. Throws if none is active. */
function resolveEncounter(room, { outcome = 'resolved', notes = '' } = {}) {
    const adventure = ensureAdventureState(room);
    const encounter = adventure.activeEncounter;
    if (!encounter) throw new Error('No encounter is currently active in this room');

    appendLog(adventure, {
        type: 'encounter-resolve',
        message: `Encounter resolved: ${encounter.name} (${outcome})`,
        notes,
    });
    adventure.activeEncounter = null;
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    return getPublicState(room);
}

/**
 * Append a free-form narrative/GM beat to the adventure log -- for
 * anything that doesn't fit the scene/encounter structure (a GM aside, an
 * AI's narration of what just happened, a note tying a card-draw
 * consequence from the existing deck system back into the adventure's
 * story, etc.). Works even if no adventure module is loaded, so it can
 * double as a lightweight session log.
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
 * The subset of adventure state that's safe/useful to send to clients:
 * current position, active encounter, a recent slice of the log, and a
 * lightweight table-of-contents (not full scene bodies -- a scene's full
 * read-aloud text/GM notes are only included when it's the CURRENT scene,
 * via currentScene). This keeps every broadcast small regardless of how
 * long the adventure is.
 */
function getPublicState(room) {
    const adventure = ensureAdventureState(room);
    const current = findScene(adventure, adventure.currentSceneId);
    return {
        moduleId: adventure.moduleId,
        title: adventure.title,
        currentActId: adventure.currentActId,
        currentAct: current?.act ? { id: current.act.id, title: current.act.title } : null,
        currentScene: current?.scene || null,
        activeEncounter: adventure.activeEncounter,
        log: adventure.log.slice(-20),
        acts: adventure.acts.map(act => ({
            id: act.id,
            title: act.title,
            scenes: (act.scenes || []).map(s => ({ id: s.id, title: s.title })),
        })),
        updatedAt: adventure.updatedAt,
    };
}

module.exports = {
    ensureAdventureState,
    loadAdventureModule,
    advanceScene,
    startEncounter,
    resolveEncounter,
    logBeat,
    getPublicState,
    findScene,
    findEncounter,
};
