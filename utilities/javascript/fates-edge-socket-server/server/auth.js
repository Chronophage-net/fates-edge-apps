/**
 * Fate's Edge - Optional User Authentication
 *
 * This is intentionally separate from api.js's `authenticate` middleware
 * (a single static x-api-key shared by admin/bot tooling). This module is
 * for actual per-player accounts: hashed passwords, JWTs, and an
 * "optional" verification helper that NEVER throws -- account-based auth
 * layers on top of the existing anonymous room-code+password flow, it
 * doesn't replace it. A client with no account and no token still joins
 * exactly as it always has.
 *
 * Environment variables:
 *   AUTH_JWT_SECRET  - signing secret for player JWTs. If unset, a random
 *                       secret is generated at startup (logged as a
 *                       warning) -- fine for local/dev use, but tokens
 *                       won't survive a restart and won't work across a
 *                       multi-instance deployment. Set this explicitly in
 *                       production.
 *   AUTH_TOKEN_TTL   - JWT lifetime, e.g. "30d" (default) or "12h".
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 10;

let jwtSecret = process.env.AUTH_JWT_SECRET;
if (!jwtSecret) {
    jwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn(
        '⚠️  AUTH_JWT_SECRET is not set -- generated a random secret for this ' +
        'process. Player sessions will NOT survive a server restart and will ' +
        'be inconsistent across multiple server instances. Set AUTH_JWT_SECRET ' +
        'in your environment for real deployments.'
    );
}
const tokenTtl = process.env.AUTH_TOKEN_TTL || '30d';

// ─── Passwords ────────────────────────────────────────────────────────
async function hashPassword(plain) {
    return bcrypt.hash(String(plain), BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
    if (!hash) return false;
    try {
        return await bcrypt.compare(String(plain), hash);
    } catch (e) {
        return false;
    }
}

// ─── JWTs ─────────────────────────────────────────────────────────────
function signToken(payload) {
    // payload: { userId, username }
    return jwt.sign(payload, jwtSecret, { expiresIn: tokenTtl });
}

/** Throws on invalid/expired token. Use verifyTokenOptional() when the
 *  caller should just treat a bad token as "anonymous" instead of erroring. */
function verifyToken(token) {
    return jwt.verify(token, jwtSecret);
}

/**
 * Never throws. Returns the decoded { userId, username } payload for a
 * valid token, or null for a missing/invalid/expired one. This is the
 * one socket handlers should use -- a bad token should degrade to
 * "anonymous", not disconnect the client.
 */
function verifyTokenOptional(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const decoded = jwt.verify(token, jwtSecret);
        if (!decoded || !decoded.userId) return null;
        return { userId: decoded.userId, username: decoded.username };
    } catch (e) {
        return null;
    }
}

/** Express middleware: requires a valid `Authorization: Bearer <token>` header. */
function requireAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header (expected: Bearer <token>)' });
    }
    const decoded = verifyTokenOptional(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
}

// ─── Basic input validation ────────────────────────────────────────────
const USERNAME_RE = /^[A-Za-z0-9_-]{3,32}$/;

function isValidUsername(username) {
    return typeof username === 'string' && USERNAME_RE.test(username);
}

function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 8 && password.length <= 256;
}

// ─── v4.8: room roles ───────────────────────────────────────────────
// gm/co-gm/assistant-gm/player/spectator. 'member' is intentionally NOT in
// this set -- it was room_memberships.role's old default before this enum
// existed, and storage.js's init() back-fills any lingering 'member' rows
// to 'player' on startup, so callers should never see or accept it again.
//
// 'assistant-gm' (v4.12) is included here for the same reason 'co-gm' is:
// a persisted grant (see room.js's handleRoleChangeRequest() persist
// path) needs to be re-claimable directly at handshake on reconnect, not
// just assignable via the in-room role_change_request promote flow.
const VALID_ROLES = new Set(['gm', 'co-gm', 'assistant-gm', 'player', 'spectator']);

function isValidRole(role) {
    return typeof role === 'string' && VALID_ROLES.has(role);
}

module.exports = {
    hashPassword,
    verifyPassword,
    signToken,
    verifyToken,
    verifyTokenOptional,
    requireAuth,
    isValidUsername,
    isValidPassword,
    VALID_ROLES,
    isValidRole,
};
