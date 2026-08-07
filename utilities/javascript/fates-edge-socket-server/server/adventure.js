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
 * v2 (this pass) -- DYNAMIC GROWTH SUPPORT:
 *   Adds four new live-state fields alongside status/currentAct/etc.:
 *     - dynamicGrowth: whether this adventure is allowed to generate new
 *       content as it's played (true only for Crown-Spread-built
 *       adventures, set at load time via loadAdventureContent's options;
 *       always false for file-based loadAdventureModule() adventures, so
 *       pre-written modules always just play through to their own
 *       authored ending unmodified).
 *     - sessionsPlayed / climaxAfterSessions: a simple counter + threshold
 *       (see markSessionEnd()) used by the bot-side director to decide
 *       when a dynamic-growth adventure should stop generating regular
 *       scenes and instead generate a climax/conclusion.
 *     - climaxTriggered: set once via markClimaxTriggered() so the
 *       climax-generation path only ever fires once per adventure.
 *   Also adds four new content-mutation functions -- appendScene(),
 *   appendAct(), addNpc(), addCreature() -- that let a caller (the bot's
 *   adventure-director.js, typically after an LLM call) grow the
 *   currently-loaded module's own content in place. Appending BEFORE
 *   calling the existing advanceScene() with no explicit target means
 *   the existing sequential-advance logic below needs NO changes at all
 *   to correctly land on newly-appended content -- it just sees a
 *   longer scenes[]/acts[] array than it did a moment ago.
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
 *             { name, dv, position, outcomes: { clean, partial, miss }, type? }
 *             // OR creature-reference form (creatureId -> bestiary):
 *             { creatureId, quantity, dv, position, outcomes: {...}, type? }
 *             // `type` is an OPTIONAL objective-type id used purely for
 *             // client-side terminology/framing (progress-clock labels,
 *             // icons, verbs) -- the server stores/passes it through
 *             // verbatim and never validates or requires it. Known ids
 *             // (full registry lives client-side in
 *             // fates-edge-web-client's js/core/objective-types.js):
 *             //   'combat' | 'obstruction' | 'skill_challenge' |
 *             //   'trap_ward' | 'lockpick' | 'heist' | 'social'
 *             // Missing `type` (all existing encounters/data) defaults to
 *             // 'combat' and behaves exactly as before.
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
 * INTEGRATION NOTE: this file lives at server/adventure.js and is wired
 * into api.js's REST routes (see the "Adventure Engine" section there).
 * State mutations are authoritative on the server (recomputed here, not
 * just relayed from whichever client/AI happened to compute a value
 * locally) and every connected client/AI agent stays in sync regardless
 * of who drove the change.
 *
 * "PUSH": distributing the adventure's *source content* to connected web
 * clients uses the EXISTING, unmodified module-push mechanism
 * (POST /api/modules/:id/push, or the 'module-push-request' socket
 * event) -- since an adventure module is just a normal module directory
 * (manifest.json + adventure.json), that endpoint already reads and
 * broadcasts adventure.json's raw content with zero changes needed here.
 * That push carries the STATIC file, not live progress; live state
 * (position, timer ticks, completed flags, dynamically-appended
 * scenes/acts/npcs) only travels through this file's own broadcasts,
 * which is why getPublicState() below always includes full inline scene/
 * encounter data -- a client needs no local copy of the adventure at all
 * to render the current moment from a broadcast alone.
 */

const path = require('path');
const fs = require('fs');
const { isSafeModuleId } = require('./security.js');

// ---- DATA DIRECTORY: adventures live under data/adventures/<id>.json ----
const ADVENTURES_DIR = path.resolve(process.cwd(), 'data', 'adventures');

const MAX_LOG_ENTRIES = 200;
const VALID_OUTCOMES = ['clean', 'partial', 'miss'];
const DEFAULT_CLIMAX_AFTER_SESSIONS = 4;

/** Ensure room.data.adventure exists, and return it. */
function ensureAdventureState(room) {
    if (!room.data) room.data = {};
    if (!room.data.adventure) {
        room.data.adventure = {
            module: null,          // deep-copied adventure content, mutated in place
            currentAct: 0,          // index into module.acts
            currentScene: 0,        // index into module.acts[currentAct].scenes
            activeEncounterRef: null,
            status: 'planned',      // planned | active | completed
            startedAt: null,
            completedAt: null,
            log: [],
            updatedAt: null,
            // NEW: dynamic growth tracking (see file header)
            dynamicGrowth: false,
            sessionsPlayed: 0,
            climaxAfterSessions: DEFAULT_CLIMAX_AFTER_SESSIONS,
            climaxTriggered: false,
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
    // `type` (objective-type id, see schema comment near the top of this
    // file) survives the spread below faithfully; default to 'combat' for
    // back-compat with encounters/data authored before `type` existed.
    const enriched = { ...encounter, type: encounter.type || 'combat' };
    if (enriched.creatureId) {
        const creature = (adventure.module.bestiary || []).find(b => b.id === enriched.creatureId);
        if (creature) enriched.creature = creature;
    }
    return enriched;
}

/**
 * Load an adventure module's content from data/adventures/<moduleId>.json
 * into the room, replacing any previously-loaded adventure.
 * Deep-clones the content so completed flags / timer ticks never
 * touch the file on disk, and always resets to a clean starting position
 * (act 0 / scene 0, every scene incomplete, every timer at 0) regardless
 * of whatever the source file's own currentAct/currentScene/timer values
 * are -- matches the client's own startAdventure() behavior exactly, so
 * loading the same file server-side and client-side never disagrees.
 *
 * NOTE: file-based modules ALWAYS get dynamicGrowth=false -- pre-written
 * adventures play through exactly what their author wrote, start to
 * finish, with no bot-generated additions. Only loadAdventureContent()
 * (AI-generated Crown Spread adventures) can opt into dynamic growth.
 */
function loadAdventureModule(room, moduleId) {
    if (!isSafeModuleId(moduleId)) {
        throw new Error('Invalid adventure id');
    }

    const filePath = path.join(ADVENTURES_DIR, `${moduleId}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Adventure "${moduleId}" not found (missing ${moduleId}.json)`);
    }

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const moduleCopy = JSON.parse(JSON.stringify(content)); // deep clone
    moduleCopy.id = moduleCopy.id || moduleId;

    // Reset all scene completed flags and timers
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
    // NEW: always reset growth tracking on a fresh load, and force
    // dynamicGrowth off for file-based modules (see docstring above).
    adventure.dynamicGrowth = false;
    adventure.sessionsPlayed = 0;
    adventure.climaxAfterSessions = DEFAULT_CLIMAX_AFTER_SESSIONS;
    adventure.climaxTriggered = false;
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
 *
 * NEW: `options.dynamicGrowth` (boolean) and `options.climaxAfterSessions`
 * (number) opt this adventure into the growth system -- see file header.
 * Both default to "off"/DEFAULT_CLIMAX_AFTER_SESSIONS if omitted, so
 * existing callers that don't pass them behave exactly as before.
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
    // NEW: growth tracking, opt-in via options
    adventure.dynamicGrowth = !!options.dynamicGrowth;
    adventure.sessionsPlayed = 0;
    adventure.climaxAfterSessions = options.climaxAfterSessions || DEFAULT_CLIMAX_AFTER_SESSIONS;
    adventure.climaxTriggered = false;
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
 *
 * UNCHANGED from the original version -- this function has NO knowledge
 * of dynamic growth at all, by design. The bot-side director is
 * responsible for calling appendScene()/appendAct() BEFORE calling this
 * with no explicit target whenever it wants to grow the story instead of
 * letting it complete; once appended, this function's existing
 * "does the next scene/act exist" checks naturally see the longer
 * array and advance into the new content with zero special-casing here.
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
 * NEW: Append a single new scene to an existing act (identified by
 * index). The scene is normalized to the standard shape (completed:
 * false, timers reset to 0, encounters as given) regardless of what
 * partial shape the caller provides -- callers are typically an LLM's
 * JSON output, which won't always include every field. Does NOT advance
 * into it; call advanceScene(room, {}) afterward (with no explicit
 * target) to move into the newly-appended scene via ordinary sequential
 * advance.
 */
function appendScene(room, actIndex, sceneContent) {
    const adventure = ensureAdventureState(room);
    if (!adventure.module) throw new Error('No adventure module is loaded in this room');
    if (typeof actIndex !== 'number') throw new Error('actIndex (number) is required');
    const act = adventure.module.acts[actIndex];
    if (!act) throw new Error(`Act index ${actIndex} does not exist`);
    if (!sceneContent || !sceneContent.title) throw new Error('sceneContent.title is required');

    const scene = {
        id: sceneContent.id || `scene-gen-${Date.now()}`,
        title: sceneContent.title,
        description: sceneContent.description || '',
        completed: false,
        timers: (sceneContent.timers || []).map(t => ({ ...t, current: 0 })),
        encounters: sceneContent.encounters || [],
    };
    if (!act.scenes) act.scenes = [];
    act.scenes.push(scene);

    appendLog(adventure, { type: 'scene-appended', message: `New scene appended to "${act.title}": ${scene.title}` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();
    return getPublicState(room);
}

/**
 * NEW: Append a whole new act (with its own scenes) to the currently
 * loaded module. Used for climax/conclusion generation -- see file
 * header. Same normalization behavior as appendScene() for each of the
 * act's scenes. Does NOT advance into it; call advanceScene(room, {})
 * afterward.
 */
function appendAct(room, actContent) {
    const adventure = ensureAdventureState(room);
    if (!adventure.module) throw new Error('No adventure module is loaded in this room');
    if (!actContent || !actContent.title) throw new Error('actContent.title is required');
    if (!Array.isArray(actContent.scenes) || actContent.scenes.length === 0) {
        throw new Error('actContent.scenes must be a non-empty array');
    }

    const act = {
        id: actContent.id || `act-gen-${Date.now()}`,
        title: actContent.title,
        description: actContent.description || '',
        scenes: actContent.scenes.map((s, i) => ({
            id: s.id || `scene-gen-${Date.now()}-${i}`,
            title: s.title,
            description: s.description || '',
            completed: false,
            timers: (s.timers || []).map(t => ({ ...t, current: 0 })),
            encounters: s.encounters || [],
        })),
    };
    if (!adventure.module.acts) adventure.module.acts = [];
    adventure.module.acts.push(act);

    appendLog(adventure, { type: 'act-appended', message: `New act appended: ${act.title}` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();
    return getPublicState(room);
}

/**
 * NEW: Register an ad-hoc NPC into the currently loaded module's own
 * npcs[] array, making it a "real", trackable NPC from this point
 * forward (matched by adventure-context.js's getActiveNpc() the same as
 * any pre-authored one) instead of disposable narration with no
 * mechanical backing.
 */
function addNpc(room, npcObj) {
    const adventure = ensureAdventureState(room);
    if (!adventure.module) throw new Error('No adventure module is loaded in this room');
    if (!npcObj || !npcObj.name) throw new Error('npc.name is required');

    if (!adventure.module.npcs) adventure.module.npcs = [];
    const npc = { id: npcObj.id || `npc-adhoc-${Date.now()}`, ...npcObj };
    adventure.module.npcs.push(npc);

    appendLog(adventure, { type: 'npc-added', message: `Ad-hoc NPC added: ${npc.name}` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();
    return getPublicState(room);
}

/**
 * NEW: Register an ad-hoc creature into the currently loaded module's
 * own bestiary[] array. Same purpose as addNpc() but for the bestiary
 * (used by getActiveCreature() and creature-reference encounters).
 */
function addCreature(room, creatureObj) {
    const adventure = ensureAdventureState(room);
    if (!adventure.module) throw new Error('No adventure module is loaded in this room');
    if (!creatureObj || !creatureObj.name) throw new Error('creature.name is required');

    if (!adventure.module.bestiary) adventure.module.bestiary = [];
    const creature = { id: creatureObj.id || `creature-adhoc-${Date.now()}`, ...creatureObj };
    adventure.module.bestiary.push(creature);

    appendLog(adventure, { type: 'creature-added', message: `Ad-hoc creature added: ${creature.name}` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();
    return getPublicState(room);
}

/**
 * NEW: Increment the session counter for the currently loaded adventure.
 * A "session" here is a human/GM concept (a real-world play session
 * ending) rather than something inferable from chat volume alone, so
 * this is deliberately a manual marker -- see !gm session end in
 * commands.js. Once sessionsPlayed reaches climaxAfterSessions, the
 * bot-side director (adventure-director.js) will generate a climax act
 * the next time a scene-complete would otherwise exhaust content.
 */
function markSessionEnd(room) {
    const adventure = ensureAdventureState(room);
    if (!adventure.module) throw new Error('No adventure module is loaded in this room');
    adventure.sessionsPlayed = (adventure.sessionsPlayed || 0) + 1;
    appendLog(adventure, { type: 'session', message: `Session ${adventure.sessionsPlayed} ended` });
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();
    return getPublicState(room);
}

/**
 * NEW: Mark that the climax act has been generated/appended for this
 * adventure, so the growth logic only ever does that once per
 * adventure -- the NEXT time content is exhausted, the adventure is
 * allowed to actually complete instead of generating another climax.
 */
function markClimaxTriggered(room) {
    const adventure = ensureAdventureState(room);
    adventure.climaxTriggered = true;
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
        // Objective-type id (see schema comment above); defaults to
        // 'combat' when absent so pre-existing ad-hoc callers are unaffected.
        const objectiveType = adHocEncounter.type || 'combat';
        adventure.activeEncounterRef = { source: 'adhoc', data: { ...adHocEncounter, type: objectiveType } };
        appendLog(adventure, { type: 'encounter-start', message: `Encounter started (ad-hoc): ${adHocEncounter.name || adHocEncounter.creatureId || ref}`, encounterType: objectiveType });
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
    // Objective-type id read from the scene's encounter data; defaults to
    // 'combat' when the source data has no `type` field (back-compat).
    const objectiveType = found.encounter.type || 'combat';
    appendLog(adventure, { type: 'encounter-start', message: `Encounter started: ${name}`, encounterType: objectiveType });
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
    // Objective-type id, defaulting to 'combat' for back-compat (see schema
    // comment near the top of this file).
    const objectiveType = encounter.type || 'combat';

    appendLog(adventure, {
        type: 'encounter-resolve',
        message: `Encounter resolved: ${name} (${outcome})`,
        result: resultText,
        notes,
        encounterType: objectiveType,
    });
    adventure.activeEncounterRef = null;
    adventure.updatedAt = Date.now();
    room.lastActivity = Date.now();

    const state = getPublicState(room);
    state.lastResolution = { encounter: name, outcome, result: resultText, notes, type: objectiveType };
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
 *
 * NEW: also resets sessionsPlayed and climaxTriggered back to their
 * starting values, since a reset restarts the whole clock -- but
 * deliberately leaves dynamicGrowth and climaxAfterSessions untouched,
 * since those are structural properties of the adventure itself, not
 * progress state.
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
    adventure.sessionsPlayed = 0;
    adventure.climaxTriggered = false;
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
 *
 * NEW: also includes dynamicGrowth/sessionsPlayed/climaxAfterSessions/
 * climaxTriggered so the bot-side director can make growth decisions
 * from this same GET /adventure call, with no additional round-trip.
 */
function getPublicState(room) {
    const adventure = ensureAdventureState(room);
    if (!adventure.module) {
        return {
            moduleId: null,
            status: adventure.status,
            log: adventure.log.slice(-20),
            updatedAt: adventure.updatedAt,
            dynamicGrowth: adventure.dynamicGrowth,
            sessionsPlayed: adventure.sessionsPlayed,
            climaxAfterSessions: adventure.climaxAfterSessions,
            climaxTriggered: adventure.climaxTriggered,
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
        description: adventure.module.description || '', // NEW: needed for !gm adventure preview
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
        // NEW
        dynamicGrowth: adventure.dynamicGrowth,
        sessionsPlayed: adventure.sessionsPlayed,
        climaxAfterSessions: adventure.climaxAfterSessions,
        climaxTriggered: adventure.climaxTriggered,
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
    appendScene,
    appendAct,
    addNpc,
    addCreature,
    markSessionEnd,
    markClimaxTriggered,
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
