/**
 * Fate's Edge - Security / Input Validation Utilities
 *
 * Centralizes the input-sanitization rules that were previously missing
 * (or inconsistently applied) across api.js, room.js, socketio-handlers.js,
 * and ws-handlers.js:
 *
 *   - safeAssign(): merges client-supplied key/value pairs into a stored
 *     object WITHOUT allowing __proto__ / constructor / prototype keys
 *     to alter the object's prototype chain (a classic "prototype
 *     pollution via merge" gadget).
 *   - safeDictSet(): same idea, but for building "name -> record" lookup
 *     dictionaries out of client-supplied names (e.g. character names),
 *     where the *key itself* (not just a nested field) is attacker
 *     controlled.
 *   - isSafeModuleId() / isSafeCampaignCode() / sanitizeRegionName():
 *     allow-list validators for values that get interpolated into
 *     filesystem paths, to prevent path traversal (`../../etc/passwd`
 *     style payloads).
 */

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Merge `data`'s own enumerable keys into `target`, skipping any key that
 * could be used to reach/alter a prototype (__proto__, constructor,
 * prototype) and skipping `name` (identity fields shouldn't be
 * overwritten by a bulk merge). Returns `target` for convenience.
 */
function safeAssign(target, data, { skipKeys = ['name'] } = {}) {
    if (!data || typeof data !== 'object') return target;
    for (const [key, value] of Object.entries(data)) {
        if (UNSAFE_KEYS.has(key)) continue;
        if (skipKeys.includes(key)) continue;
        target[key] = value;
    }
    return target;
}

/**
 * Set `dict[key] = value` guarding against a client-controlled `key` of
 * "__proto__" (which, on a normal {} object, would silently reassign the
 * dictionary's OWN prototype rather than adding an entry). Safe to call
 * on both plain {} objects and Object.create(null) dictionaries.
 */
function safeDictSet(dict, key, value) {
    if (typeof key !== 'string' || UNSAFE_KEYS.has(key)) return false;
    dict[key] = value;
    return true;
}

/** Build a "name -> record" dictionary from a client-supplied array, safely. */
function buildSafeDict(items, keyFn) {
    const dict = Object.create(null);
    for (const item of items) {
        const key = keyFn(item);
        if (key) safeDictSet(dict, key, item);
    }
    return dict;
}

// Module IDs / campaign codes are always server-generated or directory
// names on our own filesystem -- lock them down to a conservative
// alphanumeric-plus-dash charset so they can never escape their
// intended directory via `../` sequences.
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function isSafeModuleId(id) {
    return typeof id === 'string' && SAFE_ID_RE.test(id);
}

function isSafeCampaignCode(code) {
    return typeof code === 'string' && SAFE_ID_RE.test(code);
}

/**
 * Region names are used to build a filesystem path in deck.js. Returns a
 * sanitized name safe to use in a path, or null if the input can't be
 * made safe (callers should fall back to a default region in that case).
 */
function sanitizeRegionName(region) {
    if (typeof region !== 'string') return null;
    const trimmed = region.trim();
    if (!SAFE_ID_RE.test(trimmed)) return null;
    return trimmed;
}

/** Clamp a client-supplied "how many cards" value to a sane, bounded integer. */
function clampCount(count, { min = 1, max = 10, fallback = 1 } = {}) {
    const n = parseInt(count, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

// ─── Free-text length limits ─────────────────────────────────────────
// Nothing previously capped how long a display name / character name /
// NPC name etc. a client could send -- an attacker (or just a fat-
// fingered client) could push an arbitrarily large string into room
// state that then gets stored, broadcast to everyone in the room on
// every update, and re-rendered client-side. Two tiers:
//   - NAME: short identity fields (player display name, character/NPC/
//     creature name, token label). Matches the existing account
//     username bound (isValidUsername allows up to 32) with a little
//     headroom for display names that aren't also login handles.
//   - TEXT: free-form prose (whiteboard notes, adventure log entries).
const MAX_NAME_LENGTH = 40;
const MAX_TEXT_LENGTH = 1000;

// A single connected client ("Remote enabled") may drive more than one
// game character at once -- e.g. a solo player running a full party, or
// a GM puppeting several NPCs. Capped at a full standard TTRPG party size
// so one client can't claim an unbounded slice of a room's roster.
const MAX_CONTROLLED_CHARACTERS = 6;

/**
 * Normalize a client's requested character-selection payload (which may
 * arrive as a single legacy `character` string or a new `characters`
 * array) into a deduped array of valid, length-checked name strings,
 * capped at MAX_CONTROLLED_CHARACTERS. Never throws.
 */
function sanitizeCharacterSelection(input) {
    const raw = Array.isArray(input) ? input : (input ? [input] : []);
    const seen = new Set();
    const out = [];
    for (const item of raw) {
        if (typeof item !== 'string') continue;
        const name = item.trim();
        if (!name || name.length > MAX_NAME_LENGTH) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(name);
        if (out.length >= MAX_CONTROLLED_CHARACTERS) break;
    }
    return out;
}

/** True if `str` is a string no longer than `max` characters. */
function isValidLength(str, max) {
    return typeof str === 'string' && str.length <= max;
}

/** Coerce to a string and truncate to `max` characters (never throws). */
function clampString(value, max, fallback = '') {
    if (typeof value !== 'string') return fallback;
    return value.slice(0, max);
}

/**
 * Minimal in-memory fixed-window rate limiter, keyed by IP (or any string
 * key the caller derives). No dependency on express-rate-limit -- this is
 * intentionally small since it only needs to guard a handful of sensitive
 * routes (login/register), not general API traffic.
 *
 * NOTE: per-process state -- resets on restart and isn't shared across
 * multiple server instances behind a load balancer. That's an acceptable
 * trade-off for slowing down credential-stuffing/brute-force attempts; it
 * is not a substitute for account lockout or a shared store (e.g. Redis)
 * in a real multi-instance deployment.
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 10, message = 'Too many requests, please try again later.' } = {}) {
    const hits = new Map(); // key -> { count, resetAt }

    // Periodically drop expired entries so this Map can't grow unbounded
    // under sustained traffic from many distinct IPs.
    const sweepInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, windowMs).unref();

    function middleware(req, res, next) {
        // req.ip (not a raw X-Forwarded-For header read) -- Express only
        // honors X-Forwarded-For when `app.set('trust proxy', ...)` is
        // configured for the deployment's actual proxy hop count. Reading
        // the header ourselves here would let a client trivially spoof a
        // fresh key on every request (X-Forwarded-For is attacker-supplied
        // unless a trusted proxy overwrites it) and bypass the limiter
        // entirely.
        const key = req.ip || 'unknown';
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
            res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
            return res.status(429).json({ error: message });
        }
        next();
    }
    middleware._hits = hits; // exposed for tests
    middleware._stop = () => clearInterval(sweepInterval);
    return middleware;
}

/**
 * Minimal per-CONNECTION fixed-window message-rate limiter, for the two
 * WebSocket transports (plain-ws and Socket.IO). Unlike createRateLimiter()
 * above (which is keyed by IP and shared across a whole route), this one
 * is keyed by nothing at all -- the caller supplies a small state object
 * scoped to a single live connection (e.g. `ws.clientData._rl` or a
 * per-socket object set in the 'connection' handler) and this just reads/
 * mutates it. That means there's no Map to grow unbounded or sweep: the
 * state object is naturally garbage-collected the moment the connection
 * closes, same lifetime as everything else already hung off that object.
 *
 * Guards against a single connection flooding the server with messages
 * (deck draws, chat, whiteboard updates, etc.) -- a different threat than
 * the HTTP API's per-IP limiter above, since a single already-connected
 * socket can fire many messages per second with no new TCP/HTTP request
 * for each one.
 */
function createConnectionMessageLimiter({ windowMs = 10 * 1000, max = 120 } = {}) {
    return function checkMessageRate(state) {
        if (!state) return true; // defensive -- caller forgot to pass state, don't break the connection over it
        const now = Date.now();
        if (!state.resetAt || state.resetAt <= now) {
            state.count = 0;
            state.resetAt = now + windowMs;
        }
        state.count += 1;
        return state.count <= max;
    };
}

// ─── v4.8: roles ────────────────────────────────────────────────────
// A room has exactly one 'gm' (unchanged invariant) plus zero or more
// 'co-gm's. Co-GM has every GM permission EXCEPT seat management: it
// cannot transfer/revoke the GM seat, promote/demote another Co-GM, or
// delete/reset the room. Those three stay gated on a strict `=== 'gm'`
// check at the call site (see room.js's handleGmApproval /
// handleRoleChangeRequest) -- everything else that used to check
// `role === 'gm'` should switch to isGmLike(role) below.
// 'assistant-gm' (v4.12) is deliberately NOT included here -- it's a
// role for the AI GM Bot's own client that grants no elevated server-side
// permissions at all (character-edit rights, GM-only data, etc. all stay
// gated the same as 'player'). Its actual effect is entirely on the bot's
// own in-process narration behavior; see fates-edge-ai-gm-bot's README.
const GM_LIKE_ROLES = new Set(['gm', 'co-gm']);

function isGmLike(role) {
    return GM_LIKE_ROLES.has(role);
}

/** Only the room's GM (not a Co-GM) may promote/demote Co-GMs, transfer
 *  the GM seat, or delete/reset the room. */
function canManageGmSeat(role) {
    return role === 'gm';
}

/** Spectators are read-only everywhere: no character control, no deck/
 *  adventure actions, no secret/GM-only data. */
function isSpectator(role) {
    return role === 'spectator';
}

// ─── Event permissions ──────────────────────────────────────────────
// Every socket event that exercises GM authority is named here, ONCE,
// and both transports gate on this table -- socketio-handlers.js from a
// socket.use() middleware, ws-handlers.js from a check before its
// switch. The alternative (a role check at the top of each handler) is
// how ~40 handlers ended up with none at all: the client hid the Decks
// and GM Tools tabs from non-GMs and everyone assumed that was the
// boundary. It was not. `fates-edge-my-role` is a localStorage string;
// hiding a tab hides a button, not an event. Anything a player could
// name, they could send.
//
// Two tiers, because there are three GM-side roles and only two of them
// hold seat-level authority:
//
//   STORY_AUTHORITY -- gm, co-gm, assistant-gm. Narrating the fiction:
//   drawing on the Deck of Consequences (an SB spend -- a player doing
//   this authors a complication against their own table), running the
//   soundboard, pushing TTS audio, posting assistant suggestions.
//   'assistant-gm' is included because the AI GM Bot holds exactly that
//   role and seeds its campaign with a Crown Spread; excluding it would
//   have broken the bot, not secured anything.
//
//   GM_GATED -- gm, co-gm only. Authority over the room's shared record:
//   loading/resetting an adventure, advancing scenes and encounters,
//   creating and ticking timers, revealing or hiding knowledge, choosing
//   the region, wiping deck history. The AI bot is a narrator, not a
//   keeper of the record, so it does not get these.
//
// Seat management (transfer/revoke GM, promote/demote a Co-GM, reset the
// room) stays on canManageGmSeat() at its own call sites and is NOT
// listed here.
//
// An event absent from both sets is deliberately open to any member:
// rolls, chat, character claims, voice signalling, whiteboard strokes,
// and every *-request / *-list read.

const STORY_AUTHORITY_EVENTS = new Set([
    'deck-draw',
    'deck-shuffle',
    'crown-spread',
    'soundboard-ambience',
    'tts-audio',
    'combat-status-update',
    'scene-status-update',
    'assistant-suggestion-created',
    'assistant-suggestion-resolved',
]);

const GM_GATED_EVENTS = new Set([
    'deck-history-clear',
    'set-region',
    'adventure-load',
    'adventure-reset',
    'adventure-scene',
    'adventure-encounter-start',
    'adventure-encounter-resolve',
    'adventure-timer',
    'adventure-log',
    'adventure-knowledge-reveal',
    'adventure-knowledge-hide',
    'adhoc-timer-create',
    'adhoc-timer-tick',
    'adhoc-timer-remove',
    'module-push',
    'module-push-request',
    'module-cleanup',
    'module-cleanup-request',
]);

const STORY_AUTHORITY_ROLES = new Set(['gm', 'co-gm', 'assistant-gm']);

/**
 * Permission check for one inbound event.
 *
 * @returns {null|{event:string, requires:string}} null when the role may
 *   send this event; otherwise a reason object the transport turns into
 *   its own flavour of error. Returning a value rather than throwing
 *   keeps this pure and testable without a socket.
 */
function checkEventPermission(event, role) {
    if (GM_GATED_EVENTS.has(event)) {
        return isGmLike(role) ? null : { event, requires: 'gm' };
    }
    if (STORY_AUTHORITY_EVENTS.has(event)) {
        return STORY_AUTHORITY_ROLES.has(role) ? null : { event, requires: 'story-authority' };
    }
    return null;
}

/** Human-readable refusal, shared by both transports so the wording
 *  can't drift between them. */
function permissionDeniedMessage(reason) {
    if (!reason) return '';
    return reason.requires === 'gm'
        ? `Only the GM or a Co-GM can do that (${reason.event}).`
        : `Only the GM, a Co-GM, or the Assistant GM can do that (${reason.event}).`;
}

module.exports = {
    UNSAFE_KEYS,
    safeAssign,
    safeDictSet,
    buildSafeDict,
    isSafeModuleId,
    isSafeCampaignCode,
    sanitizeRegionName,
    clampCount,
    createRateLimiter,
    createConnectionMessageLimiter,
    MAX_NAME_LENGTH,
    MAX_TEXT_LENGTH,
    isValidLength,
    clampString,
    MAX_CONTROLLED_CHARACTERS,
    GM_LIKE_ROLES,
    isGmLike,
    canManageGmSeat,
    isSpectator,
    STORY_AUTHORITY_EVENTS,
    GM_GATED_EVENTS,
    checkEventPermission,
    permissionDeniedMessage,
    sanitizeCharacterSelection,
};
