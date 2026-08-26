/**
 * Fate's Edge - Server-side Ad-Hoc Timer module.
 *
 * Deliberately SEPARATE from server/adventure.js and its scene/encounter
 * management. adventure.js owns pre-authored, adventure-module-scripted
 * timers (scene.timers[], module.campaignTimers[]) -- their existence,
 * segment counts, and descriptions come from the loaded adventure
 * module's authored content, and adventure.js only ever TICKS them
 * (POST /api/rooms/:code/adventure/timer). This module owns AD-HOC
 * timers instead: the kind a GM/AI improvises mid-session ("Guard
 * Patrol", "Village Unrest") that aren't part of any authored adventure.
 *
 * Ad-hoc timers live in their own room.data.timers bucket, completely
 * independent of room.data.adventure -- they exist and tick the same way
 * whether or not an adventure module is loaded, and adventure.js's
 * resetAdventure()/loadAdventureModule()/loadAdventureContent() never
 * touch them (nor does this file ever touch room.data.adventure). This
 * keeps "ad-hoc timer management" and "authored adventure management" as
 * two genuinely separate concerns rather than one bolted onto the other.
 *
 * Enforces a 3-active-timer cap (a GM's attention budget) with automatic
 * merge-on-overflow, and offers a deck-draw integration hook -- both
 * ported from the bot's former bot-local, invisible-to-other-clients
 * modules/timers.js, so that logic survives the move server-side instead
 * of being silently lost.
 */

const MAX_ACTIVE_TIMERS = 3;
const MAX_LOG_ENTRIES = 100;

/** Ensure room.data.timers exists, and return it. */
function ensureTimerState(room) {
    if (!room.data) room.data = {};
    if (!room.data.timers) {
        room.data.timers = { list: [], log: [], updatedAt: null };
    }
    return room.data.timers;
}

function appendLog(state, entry) {
    state.log.push({ timestamp: Date.now(), ...entry });
    if (state.log.length > MAX_LOG_ENTRIES) {
        state.log = state.log.slice(-MAX_LOG_ENTRIES);
    }
}

/** `ref` accepts either a name string or a numeric list index. */
function findTimer(state, ref) {
    if (typeof ref === 'number') return state.list[ref] || null;
    return state.list.find(t => t.name === ref) || null;
}

/**
 * Enforce the 3-active-timer rule: when a create pushes the list past
 * MAX_ACTIVE_TIMERS, keep the top 3 (longer/older = more established,
 * same tie-break as the bot's former local rule) and coalesce the
 * overflow into a single persistent "Merged: ..." timer that carries
 * their averaged progress forward, rather than silently dropping them.
 */
function enforceTimerCap(state) {
    if (state.list.length <= MAX_ACTIVE_TIMERS) return;

    state.list.sort((a, b) => {
        if (a.segments !== b.segments) return b.segments - a.segments;
        return a.createdAt - b.createdAt;
    });

    // Keep the top (MAX_ACTIVE_TIMERS - 1) and coalesce everything else
    // into one merged timer, so the list lands back AT (not over)
    // MAX_ACTIVE_TIMERS -- not (MAX_ACTIVE_TIMERS + 1) from appending a
    // merged timer on top of a full top-N slice.
    const kept = state.list.slice(0, MAX_ACTIVE_TIMERS - 1);
    const overflow = state.list.slice(MAX_ACTIVE_TIMERS - 1);

    const mergedName = 'Merged: ' + overflow.map(t => t.name).join(', ');
    const mergedSegments = Math.max(...kept.map(t => t.segments));
    const existingMerged = kept.find(t => t.name === mergedName);
    if (existingMerged) {
        existingMerged.current = Math.min(existingMerged.segments, existingMerged.current + 1);
    } else {
        const avgProgress = overflow.reduce((sum, t) => sum + (t.current / t.segments), 0) / overflow.length;
        kept.push({
            name: mergedName,
            segments: mergedSegments,
            current: Math.min(mergedSegments, Math.floor(avgProgress * mergedSegments)),
            description: 'Multiple ad-hoc threats coalesce into a single pressing timer.',
            createdAt: Date.now(),
            merged: true,
        });
    }

    state.list = kept;
    appendLog(state, { type: 'merged', message: `Merged overflow timers into "${mergedName}"` });
}

/**
 * Create (or re-arm, if a timer of the same name already exists) an
 * ad-hoc timer. Enforces the 3-active-timer cap on creation of a
 * genuinely new timer.
 */
function createTimer(room, { name, segments, description = '' } = {}) {
    if (!name) throw new Error('name is required');
    segments = Number(segments);
    if (!Number.isFinite(segments) || segments <= 0) throw new Error('segments must be a positive number');

    const state = ensureTimerState(room);
    const existing = findTimer(state, name);
    if (existing) {
        existing.segments = segments;
        existing.current = 0;
        existing.description = description || existing.description;
    } else {
        state.list.push({ name, segments, current: 0, description, createdAt: Date.now() });
        enforceTimerCap(state);
    }

    appendLog(state, { type: 'created', message: `Timer "${name}" created (${segments} segments)` });
    state.updatedAt = Date.now();
    room.lastActivity = Date.now();
    return getPublicState(room);
}

/**
 * Tick a timer by `amount` (default +1, can be negative), clamped to
 * [0, segments]. `ref` accepts a name string (the common case) or a
 * numeric list index; `name` is accepted as an alias for `ref`.
 */
function tickTimer(room, { ref, name, amount = 1 } = {}) {
    const timerRef = ref !== undefined ? ref : name;
    if (timerRef === undefined || timerRef === null || timerRef === '') {
        throw new Error('ref (or name) is required');
    }
    const state = ensureTimerState(room);
    const timer = findTimer(state, timerRef);
    if (!timer) throw new Error(`Timer "${timerRef}" not found`);

    timer.current = Math.max(0, Math.min(timer.segments, (timer.current || 0) + Number(amount)));
    const isFull = timer.current >= timer.segments;

    appendLog(state, { type: 'tick', message: `${timer.name}: ${timer.current}/${timer.segments}${isFull ? ' (FULL)' : ''}` });
    state.updatedAt = Date.now();
    room.lastActivity = Date.now();

    const result = getPublicState(room);
    result.tickedTimer = { ...timer, full: isFull };
    return result;
}

/** Remove a timer outright (no fill event) -- e.g. a GM abandoning a threat that no longer applies. */
function removeTimer(room, ref) {
    const state = ensureTimerState(room);
    const timer = findTimer(state, ref);
    if (!timer) throw new Error(`Timer "${ref}" not found`);

    state.list = state.list.filter(t => t !== timer);
    appendLog(state, { type: 'removed', message: `Timer "${timer.name}" removed` });
    state.updatedAt = Date.now();
    room.lastActivity = Date.now();
    return getPublicState(room);
}

/** Resolve a (typically filled) timer: remove it and hand back its data for narration -- mirrors the old bot-local resolveTimer(). */
function resolveTimer(room, ref) {
    const state = ensureTimerState(room);
    const timer = findTimer(state, ref);
    if (!timer) throw new Error(`Timer "${ref}" not found`);

    state.list = state.list.filter(t => t !== timer);
    appendLog(state, { type: 'resolved', message: `Timer "${timer.name}" resolved` });
    state.updatedAt = Date.now();
    room.lastActivity = Date.now();

    const result = getPublicState(room);
    result.resolvedTimer = timer;
    return result;
}

/** The full set of active ad-hoc timers plus a recent log slice -- safe to send on every broadcast. */
function getPublicState(room) {
    const state = ensureTimerState(room);
    return {
        timers: state.list.map(t => ({ ...t, full: t.current >= t.segments })),
        log: state.log.slice(-20),
        updatedAt: state.updatedAt,
    };
}

/**
 * Apply deck-draw consequences to ad-hoc timers: an Ace ticks one random
 * ad-hoc timer, a Crown Spread ticks all of them. Ported from the bot's
 * former local applyDeckDrawToTimers() for parity -- not yet wired into
 * any deck-draw route (it wasn't wired into any draw path bot-side
 * either), available for a caller that wants to opt in.
 */
function applyDeckDrawToTimers(room, drawResult) {
    const state = ensureTimerState(room);
    const ticked = [];
    if (state.list.length === 0) return ticked;

    const isAce = !!drawResult?.cards?.some(c => c.rank === 'A');
    const isCrown = drawResult?.type === 'crown';

    if (isCrown) {
        for (const timer of state.list) {
            timer.current = Math.min(timer.segments, timer.current + 1);
            ticked.push({ name: timer.name, current: timer.current, segments: timer.segments });
        }
    } else if (isAce) {
        const idx = Math.floor(Math.random() * state.list.length);
        const timer = state.list[idx];
        timer.current = Math.min(timer.segments, timer.current + 1);
        ticked.push({ name: timer.name, current: timer.current, segments: timer.segments });
    }

    if (ticked.length > 0) {
        appendLog(state, { type: 'deck-tick', message: `Deck draw ticked: ${ticked.map(t => t.name).join(', ')}` });
        state.updatedAt = Date.now();
        room.lastActivity = Date.now();
    }
    return ticked;
}

module.exports = {
    MAX_ACTIVE_TIMERS,
    ensureTimerState,
    createTimer,
    tickTimer,
    removeTimer,
    resolveTimer,
    getPublicState,
    applyDeckDrawToTimers,
};
