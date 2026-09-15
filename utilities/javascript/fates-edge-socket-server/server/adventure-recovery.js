'use strict';
// Private, versioned recovery contract. Never broadcast this payload.
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { isSafeModuleId } = require('./security');
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function full(room) {
    const state = room.data?.adventure;
    if (!state?.module) return null;
    const id = state.module.id;
    return clone({ ...state, snapshotVersion: 1, roomId: room.room_id, savedAt: Date.now(), moduleId: id,
        contentRef: state.contentRef || null,
        customAdventures: state.contentRef ? [room.data.customAdventures?.[state.contentRef]].filter(Boolean) : [],
        adhocTimers: room.data.timers || { list: [], log: [], updatedAt: null } });
}
function validateTimers(timers) {
    if (!Array.isArray(timers)) fail('Invalid timer list');
    for (const timer of timers) {
        if (!object(timer) || typeof timer.name !== 'string' || !Number.isInteger(timer.segments) || timer.segments < 1 ||
            !Number.isInteger(timer.current) || timer.current < 0 || timer.current > timer.segments) fail('Invalid timer state');
    }
}
function restore(room, snapshot, { force = false } = {}) {
    if (!object(snapshot) || !isSafeModuleId(snapshot.moduleId)) fail('Valid moduleId is required');
    if ((snapshot.snapshotVersion ?? 1) !== 1) fail('Unsupported snapshotVersion');
    if (!snapshot.roomId || snapshot.roomId !== room.room_id) fail('Snapshot belongs to a different room', 403);
    if (!Number.isFinite(snapshot.savedAt)) fail('Snapshot savedAt is required');
    const s = clone(snapshot);
    let base;
    let custom;
    if (s.contentRef || s.moduleId === 'custom' || s.moduleId.startsWith('custom_')) {
        custom = (s.customAdventures || []).find(entry => entry?.id === s.contentRef);
        if (!custom || custom.id !== s.moduleId || !object(custom.content)) fail('Custom adventure contentRef is missing', 404);
        base = custom.content;
    } else {
        const sourceId = s.moduleSourceId || s.moduleId;
        if (!isSafeModuleId(sourceId)) fail('Invalid module source id');
        const filename = path.resolve(process.cwd(), 'data', 'adventures', `${sourceId}.json`);
        if (!fs.existsSync(filename)) fail('Adventure module not found', 404);
        base = JSON.parse(fs.readFileSync(filename, 'utf8'));
    }
    if (!object(s.module) || s.module.id !== s.moduleId || !s.module.title || !Array.isArray(s.module.acts) || !s.module.acts.length) fail('Invalid adventure content');
    for (const act of s.module.acts) {
        if (!object(act) || !Array.isArray(act.scenes) || !act.scenes.length) fail('Each act needs scenes');
        for (const scene of act.scenes) {
            if (!object(scene)) fail('Invalid scene');
            validateTimers(scene.timers || []);
            if (scene.encounters !== undefined && !Array.isArray(scene.encounters)) fail('Invalid encounters');
        }
    }
    if (!Number.isInteger(s.currentAct) || s.currentAct < 0 || !s.module.acts[s.currentAct] ||
        !Number.isInteger(s.currentScene) || s.currentScene < 0 || !s.module.acts[s.currentAct].scenes[s.currentScene]) fail('Invalid adventure position');
    if (!['planned', 'active', 'completed'].includes(s.status)) fail('Invalid adventure status');
    for (const field of ['sessionsPlayed', 'climaxAfterSessions', 'climaxPadScenes', 'climaxScenesSinceTrigger']) {
        if (!Number.isInteger(s[field]) || s[field] < 0) fail(`Invalid ${field}`);
    }
    for (const field of ['dynamicGrowth', 'climaxTriggered', 'climaxForced']) if (typeof s[field] !== 'boolean') fail(`Invalid ${field}`);
    if (s.climaxTriggered && (!s.dynamicGrowth || s.module.acts.length <= (base.acts || []).length)) fail('Climax flag has no appended climax act');
    if (s.climaxForced && !s.climaxTriggered) fail('Forced climax has not been triggered');
    if (!Array.isArray(s.log)) fail('Invalid adventure log');
    validateTimers(s.module.campaignTimers || []);
    if (!Array.isArray(s.module.knowledge || []) || (s.module.knowledge || []).some(k => !object(k) || !k.id || typeof k.revealed !== 'boolean')) fail('Invalid knowledge state');
    if (!object(s.adhocTimers) || !Array.isArray(s.adhocTimers.log)) fail('Invalid ad-hoc timer state');
    validateTimers(s.adhocTimers.list);
    const ref = s.activeEncounterRef;
    if (ref !== null) {
        if (!object(ref)) fail('Invalid active encounter');
        if (ref.source === 'adhoc') { if (!object(ref.data)) fail('Invalid ad-hoc encounter'); }
        else if (ref.source !== 'scene' || !Number.isInteger(ref.index) || ref.index < 0 || !s.module.acts[s.currentAct].scenes[s.currentScene].encounters?.[ref.index]) fail('Invalid encounter reference');
    }
    const { snapshotVersion, roomId, savedAt, moduleId, customAdventures, adhocTimers, ...state } = s;
    const current = room.data?.adventure;
    // An exact replay is harmless; a different snapshot never replaces live play implicitly.
    if (current?.module && !force) {
        if (isDeepStrictEqual(current, state) && isDeepStrictEqual(room.data.timers || { list: [], log: [], updatedAt: null }, adhocTimers)) return { ok: true, unchanged: true, moduleId, title: state.module.title, status: state.status };
        fail('An adventure is already loaded; use recover --force to replace it', 409);
    }
    const registry = { ...(room.data?.customAdventures || {}) };
    if (custom) registry[custom.id] = custom;
    // Everything above is read-only. Publish the fully checked state in one swap.
    room.data = { ...room.data, adventure: state, timers: adhocTimers, customAdventures: registry };
    room.lastActivity = Date.now();
    return { ok: true, moduleId, title: state.module.title, status: state.status,
        warning: ref ? 'Encounter restored. Grid tokens must be replaced.' : null };
}
module.exports = { full, restore };
