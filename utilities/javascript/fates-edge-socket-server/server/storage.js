/**
 * Database storage module for Fate's Edge campaigns.
 * Supports SQLite (default), PostgreSQL, or MySQL.
 *
 * Environment variables:
 *   DATABASE_TYPE      - 'sqlite' (default), 'postgres', or 'mysql'
 *   DATABASE_URL       - For SQLite: file path (default: './campaigns.db')
 *                        For PostgreSQL/MySQL: connection string
 *   DATABASE_MAX_CAMPAIGNS - number of MANUAL-SHARE campaigns to keep per
 *                        room (default: 2). Does NOT affect auto-save --
 *                        see below.
 *   DATABASE_SSL       - 'true' to enable SSL (PostgreSQL/MySQL)
 *
 * v2 (this pass) -- ADDED: a completely separate `autosaves` table/
 * function pair (saveAutoSave/loadAutoSave), one row per room, with NO
 * retention pruning at all (nothing to prune -- it's always exactly one
 * row per room, upserted in place).
 *
 * WHY: server/api.js's automatic restart-survival persistence (driving
 * world-manager.js's CampaignManager.save()/load()) used to reuse THIS
 * module's existing saveCampaign/loadCampaign with a fixed
 * campaignCode of 'autosave' -- i.e. sharing the SAME `campaigns` table
 * as the manual !gm upload / !gm load <code> snapshot-sharing feature.
 * That table's consolidation logic keeps only the last
 * DATABASE_MAX_CAMPAIGNS (default 2) rows per room BY updated_at.
 * Auto-save fires after nearly every single bot command, so its row is
 * almost always the most recently updated one for that room -- leaving
 * only ONE remaining retention slot for manual uploads. A player who
 * runs !gm upload to get a shareable code, then keeps playing (which
 * re-triggers auto-save), could have that code silently pruned before
 * they ever hand it to anyone. Auto-save and manual-share snapshots
 * have fundamentally different retention needs (constant single-row
 * upsert vs. "keep my last couple of deliberate exports"), so they now
 * live in entirely separate tables and never compete for the same
 * retention budget.
 *
 * v3 -- ADDED optional account support: `users`, `rooms` (hashed room
 * password, persisted across restarts -- previously room.password lived
 * only in memory, plaintext, and nothing ever actually set it), and
 * `room_memberships` (a persistent user<->room link with role/banned
 * flags, so a returning known member can skip re-entering the room
 * password and a ban survives across reconnects/new socket ids instead
 * of resetting whenever the in-memory Set is rebuilt). Also added
 * `characters`, a per-user character library capped at MAX_CHARACTERS_
 * PER_USER -- storage-layer prep for account-owned characters; nothing
 * in room.js/the live room-sync path reads from this table yet (that's
 * a separate, larger bridging change), but the persistence + limit
 * enforcement is real and usable via the new /api/account/characters
 * routes today.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_CHARACTERS_PER_USER = 5;

// Determine database type from environment
const dbType = (process.env.DATABASE_TYPE || 'sqlite').toLowerCase();
const dbUrl = process.env.DATABASE_URL || (dbType === 'sqlite' ? './campaigns.db' : null);
const maxCampaigns = parseInt(process.env.DATABASE_MAX_CAMPAIGNS) || 2;
const useSSL = process.env.DATABASE_SSL === 'true';

// NEW: fail fast with a clear message instead of a confusing raw
// driver-level connection error if postgres/mysql is selected without a
// connection string.
if (dbType !== 'sqlite' && !dbUrl) {
    throw new Error(
        `DATABASE_URL is required when DATABASE_TYPE=${dbType}. ` +
        `Set it to a ${dbType} connection string.`
    );
}

let driver = null;
let isReady = false;

// ─── Helper to wrap callbacks (SQLite only) ──────────────────────
function promisify(fn) {
    return (...args) => new Promise((resolve, reject) => {
        fn(...args, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

// ─── SQLite driver ──────────────────────────────────────────────────
async function initSqlite() {
    let sqlite3;
    try {
        sqlite3 = require('sqlite3').verbose();
    } catch (e) {
        throw new Error('SQLite module not installed. Please run: npm install sqlite3');
    }

    const dbFile = dbUrl || './campaigns.db';
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const _db = new sqlite3.Database(dbFile);
    const run = promisify(_db.run.bind(_db));
    const get = promisify(_db.get.bind(_db));
    const all = promisify(_db.all.bind(_db));

    await run(`
        CREATE TABLE IF NOT EXISTS campaigns (
            room_code TEXT,
            campaign_code TEXT,
            data TEXT,
            created_at INTEGER,
            updated_at INTEGER,
            PRIMARY KEY (room_code, campaign_code)
        )
    `);

    // NEW: dedicated auto-save table, one row per room, no campaign_code
    // at all -- see file header for why this needs to be separate from
    // `campaigns` above.
    await run(`
        CREATE TABLE IF NOT EXISTS autosaves (
            room_code TEXT PRIMARY KEY,
            data TEXT,
            updated_at INTEGER
        )
    `);

    // v3: accounts + persistent membership/password + character library
    await run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at INTEGER,
            updated_at INTEGER
        )
    `);
    await run(`
        CREATE TABLE IF NOT EXISTS rooms (
            room_code TEXT PRIMARY KEY,
            password_hash TEXT,
            created_at INTEGER,
            updated_at INTEGER
        )
    `);
    await run(`
        CREATE TABLE IF NOT EXISTS room_memberships (
            room_code TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            banned INTEGER DEFAULT 0,
            joined_at INTEGER,
            last_seen_at INTEGER,
            PRIMARY KEY (room_code, user_id)
        )
    `);
    await run(`
        CREATE TABLE IF NOT EXISTS characters (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            data TEXT,
            created_at INTEGER,
            updated_at INTEGER
        )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_characters_user ON characters (user_id)`);

    // v4.8: roles + character registration.
    // `room_memberships.role` predates the gm/co-gm/player/spectator enum
    // and defaulted to 'member', a value that was never actually a real
    // role -- back-fill it to 'player' so every existing row lands in the
    // new enum instead of silently falling into neither bucket.
    await run(`UPDATE room_memberships SET role = 'player' WHERE role = 'member' OR role IS NULL`);

    // One claimed character per (room, user) -- the bridge between the
    // account-owned character LIBRARY (`characters` above) and a room's
    // live character roster (room.characters in room.js).
    await run(`
        CREATE TABLE IF NOT EXISTS room_character_claims (
            room_code TEXT NOT NULL,
            user_id TEXT NOT NULL,
            character_id TEXT NOT NULL,
            claimed_at INTEGER,
            PRIMARY KEY (room_code, user_id)
        )
    `);

    return {
        async save(roomCode, campaignCode, data) {
            const now = Date.now();
            const json = JSON.stringify(data);
            // Upsert
            await run(
                `INSERT OR REPLACE INTO campaigns (room_code, campaign_code, data, created_at, updated_at)
                 VALUES (?, ?, ?, COALESCE((SELECT created_at FROM campaigns WHERE room_code = ? AND campaign_code = ?), ?), ?)`,
                [roomCode, campaignCode, json, roomCode, campaignCode, now, now]
            );
            // Consolidate (manual-share snapshots only -- autosaves never
            // touch this table at all, so this budget is no longer
            // silently eaten by background saves).
            await run(`
                DELETE FROM campaigns
                WHERE room_code = ?
                  AND campaign_code NOT IN (
                      SELECT campaign_code
                      FROM campaigns
                      WHERE room_code = ?
                      ORDER BY updated_at DESC
                      LIMIT ?
                  )
            `, [roomCode, roomCode, maxCampaigns]);
        },

        async load(roomCode, campaignCode) {
            const row = await get(
                'SELECT data FROM campaigns WHERE room_code = ? AND campaign_code = ?',
                [roomCode, campaignCode]
            );
            if (!row) throw new Error('Campaign not found');
            return JSON.parse(row.data);
        },

        // NEW: dedicated auto-save read/write -- single row per room,
        // plain upsert, nothing to prune.
        async saveAutoSave(roomCode, data) {
            const now = Date.now();
            const json = JSON.stringify(data);
            await run(
                `INSERT OR REPLACE INTO autosaves (room_code, data, updated_at) VALUES (?, ?, ?)`,
                [roomCode, json, now]
            );
        },

        async loadAutoSave(roomCode) {
            const row = await get(
                'SELECT data FROM autosaves WHERE room_code = ?',
                [roomCode]
            );
            if (!row) throw new Error('No auto-saved campaign found');
            return JSON.parse(row.data);
        },

        // ─── Users ────────────────────────────────────────────────
        async createUser(username, passwordHash) {
            const id = crypto.randomUUID();
            const now = Date.now();
            try {
                await run(
                    'INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                    [id, username, passwordHash, now, now]
                );
            } catch (e) {
                if (String(e.message).includes('UNIQUE')) throw new Error('Username already taken');
                throw e;
            }
            return { id, username };
        },

        async getUserByUsername(username) {
            return (await get('SELECT * FROM users WHERE username = ?', [username])) || null;
        },

        async getUserById(id) {
            return (await get('SELECT * FROM users WHERE id = ?', [id])) || null;
        },

        // ─── Room password (persistent, hashed) ─────────────────────
        async setRoomPasswordHash(roomCode, passwordHash) {
            const now = Date.now();
            await run(
                `INSERT INTO rooms (room_code, password_hash, created_at, updated_at)
                 VALUES (?, ?, COALESCE((SELECT created_at FROM rooms WHERE room_code = ?), ?), ?)
                 ON CONFLICT(room_code) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
                [roomCode, passwordHash, roomCode, now, now]
            );
        },

        async getRoomPasswordHash(roomCode) {
            const row = await get('SELECT password_hash FROM rooms WHERE room_code = ?', [roomCode]);
            return row ? row.password_hash : null;
        },

        // ─── Room memberships ────────────────────────────────────────
        async upsertMembership(roomCode, userId, { role } = {}) {
            const now = Date.now();
            const existing = await get(
                'SELECT * FROM room_memberships WHERE room_code = ? AND user_id = ?',
                [roomCode, userId]
            );
            if (existing) {
                await run(
                    'UPDATE room_memberships SET last_seen_at = ?, role = COALESCE(?, role) WHERE room_code = ? AND user_id = ?',
                    [now, role || null, roomCode, userId]
                );
            } else {
                await run(
                    'INSERT INTO room_memberships (room_code, user_id, role, banned, joined_at, last_seen_at) VALUES (?, ?, ?, 0, ?, ?)',
                    [roomCode, userId, role || 'member', now, now]
                );
            }
            return await get('SELECT * FROM room_memberships WHERE room_code = ? AND user_id = ?', [roomCode, userId]);
        },

        async getMembership(roomCode, userId) {
            return (await get('SELECT * FROM room_memberships WHERE room_code = ? AND user_id = ?', [roomCode, userId])) || null;
        },

        async isMemberBanned(roomCode, userId) {
            const row = await get('SELECT banned FROM room_memberships WHERE room_code = ? AND user_id = ?', [roomCode, userId]);
            return !!(row && row.banned);
        },

        async setMemberBanned(roomCode, userId, banned) {
            await this.upsertMembership(roomCode, userId, {});
            await run('UPDATE room_memberships SET banned = ? WHERE room_code = ? AND user_id = ?', [banned ? 1 : 0, roomCode, userId]);
        },

        async setMemberRole(roomCode, userId, role) {
            await this.upsertMembership(roomCode, userId, { role });
        },

        // ─── Character library (per-user, capped) ────────────────────
        async listCharacters(userId) {
            const rows = await all('SELECT * FROM characters WHERE user_id = ? ORDER BY created_at ASC', [userId]);
            return rows.map(r => ({ id: r.id, userId: r.user_id, name: r.name, data: JSON.parse(r.data || '{}'), createdAt: r.created_at, updatedAt: r.updated_at }));
        },

        async getCharacterById(userId, characterId) {
            const row = await get('SELECT * FROM characters WHERE id = ? AND user_id = ?', [characterId, userId]);
            if (!row) return null;
            return { id: row.id, userId: row.user_id, name: row.name, data: JSON.parse(row.data || '{}'), createdAt: row.created_at, updatedAt: row.updated_at };
        },

        async countCharacters(userId) {
            const row = await get('SELECT COUNT(*) as c FROM characters WHERE user_id = ?', [userId]);
            return row ? row.c : 0;
        },

        async createCharacter(userId, name, data) {
            const count = await this.countCharacters(userId);
            if (count >= MAX_CHARACTERS_PER_USER) {
                const err = new Error(`Character limit reached (max ${MAX_CHARACTERS_PER_USER} per account)`);
                err.code = 'CHARACTER_LIMIT';
                throw err;
            }
            const id = crypto.randomUUID();
            const now = Date.now();
            await run(
                'INSERT INTO characters (id, user_id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                [id, userId, name, JSON.stringify(data || {}), now, now]
            );
            return this.getCharacterById(userId, id);
        },

        async updateCharacterById(userId, characterId, updates) {
            const existing = await this.getCharacterById(userId, characterId);
            if (!existing) return null;
            const merged = { ...existing.data, ...(updates.data || {}) };
            const name = updates.name || existing.name;
            const now = Date.now();
            await run(
                'UPDATE characters SET name = ?, data = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [name, JSON.stringify(merged), now, characterId, userId]
            );
            return this.getCharacterById(userId, characterId);
        },

        async deleteCharacter(userId, characterId) {
            const result = await run('DELETE FROM characters WHERE id = ? AND user_id = ?', [characterId, userId]);
            return true; // sqlite3's run() doesn't reliably expose affected rows via promisify; existence was already checked by callers via getCharacterById
        },

        // ─── Character claims (room live roster <-> account library) ──
        async setCharacterClaim(roomCode, userId, characterId) {
            const now = Date.now();
            await run(
                `INSERT OR REPLACE INTO room_character_claims (room_code, user_id, character_id, claimed_at)
                 VALUES (?, ?, ?, ?)`,
                [roomCode, userId, characterId, now]
            );
            return { roomCode, userId, characterId, claimedAt: now };
        },

        async getCharacterClaim(roomCode, userId) {
            return (await get('SELECT * FROM room_character_claims WHERE room_code = ? AND user_id = ?', [roomCode, userId])) || null;
        },

        async deleteCharacterClaim(roomCode, userId) {
            await run('DELETE FROM room_character_claims WHERE room_code = ? AND user_id = ?', [roomCode, userId]);
            return true;
        },

        async getClaimsForRoom(roomCode) {
            const rows = await all('SELECT * FROM room_character_claims WHERE room_code = ?', [roomCode]);
            return rows.map(r => ({ roomCode: r.room_code, userId: r.user_id, characterId: r.character_id, claimedAt: r.claimed_at }));
        },

        close() {
            return new Promise((resolve, reject) => {
                _db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    };
}

// ─── PostgreSQL driver ──────────────────────────────────────────────
async function initPostgres() {
    let pg;
    try {
        pg = require('pg');
    } catch (e) {
        throw new Error('PostgreSQL module not installed. Please run: npm install pg');
    }

    const pool = new pg.Pool({
        connectionString: dbUrl,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
    });

    // Test and create tables
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS campaigns (
                room_code TEXT,
                campaign_code TEXT,
                data JSONB,
                created_at BIGINT,
                updated_at BIGINT,
                PRIMARY KEY (room_code, campaign_code)
            )
        `);
        // NEW: dedicated auto-save table -- see file header.
        await client.query(`
            CREATE TABLE IF NOT EXISTS autosaves (
                room_code TEXT PRIMARY KEY,
                data JSONB,
                updated_at BIGINT
            )
        `);
        // v3: accounts + persistent membership/password + character library
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at BIGINT,
                updated_at BIGINT
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                room_code TEXT PRIMARY KEY,
                password_hash TEXT,
                created_at BIGINT,
                updated_at BIGINT
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS room_memberships (
                room_code TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT DEFAULT 'member',
                banned BOOLEAN DEFAULT FALSE,
                joined_at BIGINT,
                last_seen_at BIGINT,
                PRIMARY KEY (room_code, user_id)
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                data JSONB,
                created_at BIGINT,
                updated_at BIGINT
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_characters_user ON characters (user_id)`);

        // v4.8: roles + character registration -- see SQLite driver comment.
        await client.query(`UPDATE room_memberships SET role = 'player' WHERE role = 'member' OR role IS NULL`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS room_character_claims (
                room_code TEXT NOT NULL,
                user_id TEXT NOT NULL,
                character_id TEXT NOT NULL,
                claimed_at BIGINT,
                PRIMARY KEY (room_code, user_id)
            )
        `);
    } finally {
        client.release();
    }

    return {
        async save(roomCode, campaignCode, data) {
            const now = Date.now();
            await pool.query(
                `INSERT INTO campaigns (room_code, campaign_code, data, created_at, updated_at)
                 VALUES ($1, $2, $3, COALESCE((SELECT created_at FROM campaigns WHERE room_code = $1 AND campaign_code = $2), $4), $5)
                 ON CONFLICT (room_code, campaign_code) DO UPDATE SET
                     data = EXCLUDED.data,
                     updated_at = EXCLUDED.updated_at`,
                [roomCode, campaignCode, data, now, now]
            );
            // Consolidate (manual-share snapshots only -- see SQLite comment above).
            await pool.query(
                `DELETE FROM campaigns
                 WHERE room_code = $1
                   AND campaign_code NOT IN (
                       SELECT campaign_code
                       FROM campaigns
                       WHERE room_code = $1
                       ORDER BY updated_at DESC
                       LIMIT $2
                   )`,
                [roomCode, maxCampaigns]
            );
        },

        async load(roomCode, campaignCode) {
            const res = await pool.query(
                'SELECT data FROM campaigns WHERE room_code = $1 AND campaign_code = $2',
                [roomCode, campaignCode]
            );
            if (res.rows.length === 0) throw new Error('Campaign not found');
            return res.rows[0].data;
        },

        // NEW: dedicated auto-save read/write.
        async saveAutoSave(roomCode, data) {
            const now = Date.now();
            await pool.query(
                `INSERT INTO autosaves (room_code, data, updated_at)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (room_code) DO UPDATE SET
                     data = EXCLUDED.data,
                     updated_at = EXCLUDED.updated_at`,
                [roomCode, data, now]
            );
        },

        async loadAutoSave(roomCode) {
            const res = await pool.query(
                'SELECT data FROM autosaves WHERE room_code = $1',
                [roomCode]
            );
            if (res.rows.length === 0) throw new Error('No auto-saved campaign found');
            return res.rows[0].data;
        },

        // ─── Users ────────────────────────────────────────────────
        async createUser(username, passwordHash) {
            const id = crypto.randomUUID();
            const now = Date.now();
            try {
                await pool.query(
                    'INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
                    [id, username, passwordHash, now, now]
                );
            } catch (e) {
                if (e.code === '23505') throw new Error('Username already taken');
                throw e;
            }
            return { id, username };
        },

        async getUserByUsername(username) {
            const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            return res.rows[0] || null;
        },

        async getUserById(id) {
            const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
            return res.rows[0] || null;
        },

        // ─── Room password (persistent, hashed) ─────────────────────
        async setRoomPasswordHash(roomCode, passwordHash) {
            const now = Date.now();
            await pool.query(
                `INSERT INTO rooms (room_code, password_hash, created_at, updated_at)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (room_code) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at`,
                [roomCode, passwordHash, now, now]
            );
        },

        async getRoomPasswordHash(roomCode) {
            const res = await pool.query('SELECT password_hash FROM rooms WHERE room_code = $1', [roomCode]);
            return res.rows[0] ? res.rows[0].password_hash : null;
        },

        // ─── Room memberships ────────────────────────────────────────
        async upsertMembership(roomCode, userId, { role } = {}) {
            const now = Date.now();
            await pool.query(
                `INSERT INTO room_memberships (room_code, user_id, role, banned, joined_at, last_seen_at)
                 VALUES ($1, $2, $3, FALSE, $4, $4)
                 ON CONFLICT (room_code, user_id) DO UPDATE SET
                     last_seen_at = $4,
                     role = COALESCE($3, room_memberships.role)`,
                [roomCode, userId, role || 'member', now]
            );
            const res = await pool.query('SELECT * FROM room_memberships WHERE room_code = $1 AND user_id = $2', [roomCode, userId]);
            return res.rows[0];
        },

        async getMembership(roomCode, userId) {
            const res = await pool.query('SELECT * FROM room_memberships WHERE room_code = $1 AND user_id = $2', [roomCode, userId]);
            return res.rows[0] || null;
        },

        async isMemberBanned(roomCode, userId) {
            const res = await pool.query('SELECT banned FROM room_memberships WHERE room_code = $1 AND user_id = $2', [roomCode, userId]);
            return !!(res.rows[0] && res.rows[0].banned);
        },

        async setMemberBanned(roomCode, userId, banned) {
            await this.upsertMembership(roomCode, userId, {});
            await pool.query('UPDATE room_memberships SET banned = $1 WHERE room_code = $2 AND user_id = $3', [!!banned, roomCode, userId]);
        },

        async setMemberRole(roomCode, userId, role) {
            await this.upsertMembership(roomCode, userId, { role });
        },

        // ─── Character library (per-user, capped) ────────────────────
        async listCharacters(userId) {
            const res = await pool.query('SELECT * FROM characters WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
            return res.rows.map(r => ({ id: r.id, userId: r.user_id, name: r.name, data: r.data, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at) }));
        },

        async getCharacterById(userId, characterId) {
            const res = await pool.query('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [characterId, userId]);
            const row = res.rows[0];
            if (!row) return null;
            return { id: row.id, userId: row.user_id, name: row.name, data: row.data, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) };
        },

        async countCharacters(userId) {
            const res = await pool.query('SELECT COUNT(*)::int as c FROM characters WHERE user_id = $1', [userId]);
            return res.rows[0] ? res.rows[0].c : 0;
        },

        async createCharacter(userId, name, data) {
            const count = await this.countCharacters(userId);
            if (count >= MAX_CHARACTERS_PER_USER) {
                const err = new Error(`Character limit reached (max ${MAX_CHARACTERS_PER_USER} per account)`);
                err.code = 'CHARACTER_LIMIT';
                throw err;
            }
            const id = crypto.randomUUID();
            const now = Date.now();
            await pool.query(
                'INSERT INTO characters (id, user_id, name, data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
                [id, userId, name, JSON.stringify(data || {}), now, now]
            );
            return this.getCharacterById(userId, id);
        },

        async updateCharacterById(userId, characterId, updates) {
            const existing = await this.getCharacterById(userId, characterId);
            if (!existing) return null;
            const merged = { ...existing.data, ...(updates.data || {}) };
            const name = updates.name || existing.name;
            const now = Date.now();
            await pool.query(
                'UPDATE characters SET name = $1, data = $2, updated_at = $3 WHERE id = $4 AND user_id = $5',
                [name, JSON.stringify(merged), now, characterId, userId]
            );
            return this.getCharacterById(userId, characterId);
        },

        async deleteCharacter(userId, characterId) {
            const res = await pool.query('DELETE FROM characters WHERE id = $1 AND user_id = $2', [characterId, userId]);
            return res.rowCount > 0;
        },

        // ─── Character claims (room live roster <-> account library) ──
        async setCharacterClaim(roomCode, userId, characterId) {
            const now = Date.now();
            await pool.query(
                `INSERT INTO room_character_claims (room_code, user_id, character_id, claimed_at)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (room_code, user_id) DO UPDATE SET
                     character_id = EXCLUDED.character_id,
                     claimed_at = EXCLUDED.claimed_at`,
                [roomCode, userId, characterId, now]
            );
            return { roomCode, userId, characterId, claimedAt: now };
        },

        async getCharacterClaim(roomCode, userId) {
            const res = await pool.query('SELECT * FROM room_character_claims WHERE room_code = $1 AND user_id = $2', [roomCode, userId]);
            return res.rows[0] || null;
        },

        async deleteCharacterClaim(roomCode, userId) {
            await pool.query('DELETE FROM room_character_claims WHERE room_code = $1 AND user_id = $2', [roomCode, userId]);
            return true;
        },

        async getClaimsForRoom(roomCode) {
            const res = await pool.query('SELECT * FROM room_character_claims WHERE room_code = $1', [roomCode]);
            return res.rows.map(r => ({ roomCode: r.room_code, userId: r.user_id, characterId: r.character_id, claimedAt: Number(r.claimed_at) }));
        },

        close() {
            return pool.end();
        }
    };
}

// ─── MySQL driver ──────────────────────────────────────────────────
async function initMysql() {
    let mysql;
    try {
        mysql = require('mysql2/promise');
    } catch (e) {
        throw new Error('MySQL module not installed. Please run: npm install mysql2');
    }

    const pool = mysql.createPool({
        uri: dbUrl,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
        waitForConnections: true,
        connectionLimit: 10,
    });

    // Test and create tables
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS campaigns (
                room_code VARCHAR(64),
                campaign_code VARCHAR(64),
                data JSON,
                created_at BIGINT,
                updated_at BIGINT,
                PRIMARY KEY (room_code, campaign_code)
            )
        `);
        // NEW: dedicated auto-save table -- see file header.
        await conn.query(`
            CREATE TABLE IF NOT EXISTS autosaves (
                room_code VARCHAR(64) PRIMARY KEY,
                data JSON,
                updated_at BIGINT
            )
        `);
        // v3: accounts + persistent membership/password + character library
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(32) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at BIGINT,
                updated_at BIGINT
            )
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                room_code VARCHAR(64) PRIMARY KEY,
                password_hash VARCHAR(255),
                created_at BIGINT,
                updated_at BIGINT
            )
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS room_memberships (
                room_code VARCHAR(64) NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                role VARCHAR(32) DEFAULT 'member',
                banned TINYINT(1) DEFAULT 0,
                joined_at BIGINT,
                last_seen_at BIGINT,
                PRIMARY KEY (room_code, user_id)
            )
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS characters (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                name VARCHAR(255) NOT NULL,
                data JSON,
                created_at BIGINT,
                updated_at BIGINT,
                INDEX idx_characters_user (user_id)
            )
        `);

        // v4.8: roles + character registration -- see SQLite driver comment.
        await conn.query(`UPDATE room_memberships SET role = 'player' WHERE role = 'member' OR role IS NULL`);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS room_character_claims (
                room_code VARCHAR(64) NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                character_id VARCHAR(36) NOT NULL,
                claimed_at BIGINT,
                PRIMARY KEY (room_code, user_id)
            )
        `);
    } finally {
        conn.release();
    }

    return {
        async save(roomCode, campaignCode, data) {
            const now = Date.now();
            const json = JSON.stringify(data);
            await pool.query(
                `INSERT INTO campaigns (room_code, campaign_code, data, created_at, updated_at)
                 VALUES (?, ?, ?, COALESCE((SELECT created_at FROM campaigns WHERE room_code = ? AND campaign_code = ?), ?), ?)
                 ON DUPLICATE KEY UPDATE
                     data = VALUES(data),
                     updated_at = VALUES(updated_at)`,
                [roomCode, campaignCode, json, roomCode, campaignCode, now, now]
            );
            // Consolidate: keep only the latest maxCampaigns per room
            // (manual-share snapshots only -- see SQLite comment above).
            // Use a subquery to avoid DELETE with LIMIT in a subquery (works in MySQL)
            await pool.query(
                `DELETE FROM campaigns
                 WHERE room_code = ?
                   AND campaign_code NOT IN (
                       SELECT campaign_code FROM (
                           SELECT campaign_code
                           FROM campaigns
                           WHERE room_code = ?
                           ORDER BY updated_at DESC
                           LIMIT ?
                       ) AS keep
                   )`,
                [roomCode, roomCode, maxCampaigns]
            );
        },

        async load(roomCode, campaignCode) {
            const [rows] = await pool.query(
                'SELECT data FROM campaigns WHERE room_code = ? AND campaign_code = ?',
                [roomCode, campaignCode]
            );
            if (rows.length === 0) throw new Error('Campaign not found');
            const raw = rows[0].data;
            // mysql2 normally auto-parses a JSON-typed column back into an
            // object, but don't assume that -- handle either shape safely.
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        },

        // NEW: dedicated auto-save read/write.
        async saveAutoSave(roomCode, data) {
            const now = Date.now();
            const json = JSON.stringify(data);
            await pool.query(
                `INSERT INTO autosaves (room_code, data, updated_at)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                     data = VALUES(data),
                     updated_at = VALUES(updated_at)`,
                [roomCode, json, now]
            );
        },

        async loadAutoSave(roomCode) {
            const [rows] = await pool.query(
                'SELECT data FROM autosaves WHERE room_code = ?',
                [roomCode]
            );
            if (rows.length === 0) throw new Error('No auto-saved campaign found');
            const raw = rows[0].data;
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        },

        // ─── Users ────────────────────────────────────────────────
        async createUser(username, passwordHash) {
            const id = crypto.randomUUID();
            const now = Date.now();
            try {
                await pool.query(
                    'INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                    [id, username, passwordHash, now, now]
                );
            } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') throw new Error('Username already taken');
                throw e;
            }
            return { id, username };
        },

        async getUserByUsername(username) {
            const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
            return rows[0] || null;
        },

        async getUserById(id) {
            const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
            return rows[0] || null;
        },

        // ─── Room password (persistent, hashed) ─────────────────────
        async setRoomPasswordHash(roomCode, passwordHash) {
            const now = Date.now();
            await pool.query(
                `INSERT INTO rooms (room_code, password_hash, created_at, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), updated_at = VALUES(updated_at)`,
                [roomCode, passwordHash, now, now]
            );
        },

        async getRoomPasswordHash(roomCode) {
            const [rows] = await pool.query('SELECT password_hash FROM rooms WHERE room_code = ?', [roomCode]);
            return rows[0] ? rows[0].password_hash : null;
        },

        // ─── Room memberships ────────────────────────────────────────
        async upsertMembership(roomCode, userId, { role } = {}) {
            const now = Date.now();
            await pool.query(
                `INSERT INTO room_memberships (room_code, user_id, role, banned, joined_at, last_seen_at)
                 VALUES (?, ?, ?, 0, ?, ?)
                 ON DUPLICATE KEY UPDATE last_seen_at = VALUES(last_seen_at), role = COALESCE(?, role)`,
                [roomCode, userId, role || 'member', now, now, role || null]
            );
            const [rows] = await pool.query('SELECT * FROM room_memberships WHERE room_code = ? AND user_id = ?', [roomCode, userId]);
            return rows[0];
        },

        async getMembership(roomCode, userId) {
            const [rows] = await pool.query('SELECT * FROM room_memberships WHERE room_code = ? AND user_id = ?', [roomCode, userId]);
            return rows[0] || null;
        },

        async isMemberBanned(roomCode, userId) {
            const [rows] = await pool.query('SELECT banned FROM room_memberships WHERE room_code = ? AND user_id = ?', [roomCode, userId]);
            return !!(rows[0] && rows[0].banned);
        },

        async setMemberBanned(roomCode, userId, banned) {
            await this.upsertMembership(roomCode, userId, {});
            await pool.query('UPDATE room_memberships SET banned = ? WHERE room_code = ? AND user_id = ?', [banned ? 1 : 0, roomCode, userId]);
        },

        async setMemberRole(roomCode, userId, role) {
            await this.upsertMembership(roomCode, userId, { role });
        },

        // ─── Character library (per-user, capped) ────────────────────
        async listCharacters(userId) {
            const [rows] = await pool.query('SELECT * FROM characters WHERE user_id = ? ORDER BY created_at ASC', [userId]);
            return rows.map(r => ({ id: r.id, userId: r.user_id, name: r.name, data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at) }));
        },

        async getCharacterById(userId, characterId) {
            const [rows] = await pool.query('SELECT * FROM characters WHERE id = ? AND user_id = ?', [characterId, userId]);
            const row = rows[0];
            if (!row) return null;
            return { id: row.id, userId: row.user_id, name: row.name, data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) };
        },

        async countCharacters(userId) {
            const [rows] = await pool.query('SELECT COUNT(*) as c FROM characters WHERE user_id = ?', [userId]);
            return rows[0] ? rows[0].c : 0;
        },

        async createCharacter(userId, name, data) {
            const count = await this.countCharacters(userId);
            if (count >= MAX_CHARACTERS_PER_USER) {
                const err = new Error(`Character limit reached (max ${MAX_CHARACTERS_PER_USER} per account)`);
                err.code = 'CHARACTER_LIMIT';
                throw err;
            }
            const id = crypto.randomUUID();
            const now = Date.now();
            await pool.query(
                'INSERT INTO characters (id, user_id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                [id, userId, name, JSON.stringify(data || {}), now, now]
            );
            return this.getCharacterById(userId, id);
        },

        async updateCharacterById(userId, characterId, updates) {
            const existing = await this.getCharacterById(userId, characterId);
            if (!existing) return null;
            const merged = { ...existing.data, ...(updates.data || {}) };
            const name = updates.name || existing.name;
            const now = Date.now();
            await pool.query(
                'UPDATE characters SET name = ?, data = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [name, JSON.stringify(merged), now, characterId, userId]
            );
            return this.getCharacterById(userId, characterId);
        },

        async deleteCharacter(userId, characterId) {
            const [result] = await pool.query('DELETE FROM characters WHERE id = ? AND user_id = ?', [characterId, userId]);
            return result.affectedRows > 0;
        },

        // ─── Character claims (room live roster <-> account library) ──
        async setCharacterClaim(roomCode, userId, characterId) {
            const now = Date.now();
            await pool.query(
                `INSERT INTO room_character_claims (room_code, user_id, character_id, claimed_at)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE character_id = VALUES(character_id), claimed_at = VALUES(claimed_at)`,
                [roomCode, userId, characterId, now]
            );
            return { roomCode, userId, characterId, claimedAt: now };
        },

        async getCharacterClaim(roomCode, userId) {
            const [rows] = await pool.query('SELECT * FROM room_character_claims WHERE room_code = ? AND user_id = ?', [roomCode, userId]);
            return rows[0] || null;
        },

        async deleteCharacterClaim(roomCode, userId) {
            await pool.query('DELETE FROM room_character_claims WHERE room_code = ? AND user_id = ?', [roomCode, userId]);
            return true;
        },

        async getClaimsForRoom(roomCode) {
            const [rows] = await pool.query('SELECT * FROM room_character_claims WHERE room_code = ?', [roomCode]);
            return rows.map(r => ({ roomCode: r.room_code, userId: r.user_id, characterId: r.character_id, claimedAt: Number(r.claimed_at) }));
        },

        close() {
            return pool.end();
        }
    };
}

// ─── Initialisation ──────────────────────────────────────────────────
async function init() {
    if (driver) return driver;

    switch (dbType) {
        case 'postgres':
            driver = await initPostgres();
            break;
        case 'mysql':
            driver = await initMysql();
            break;
        case 'sqlite':
        default:
            driver = await initSqlite();
            break;
    }
    isReady = true;
    console.log(`🗄️ Database storage initialized (${dbType})`);
    return driver;
}

// ─── Exported storage interface ────────────────────────────────────
async function saveCampaign(roomCode, campaignCode, data) {
    const d = await init();
    await d.save(roomCode, campaignCode, data);
}

async function loadCampaign(roomCode, campaignCode) {
    const d = await init();
    return await d.load(roomCode, campaignCode);
}

// NEW: dedicated auto-save interface -- see file header for why this is
// separate from saveCampaign/loadCampaign above.
async function saveAutoSave(roomCode, data) {
    const d = await init();
    await d.saveAutoSave(roomCode, data);
}

async function loadAutoSave(roomCode) {
    const d = await init();
    return await d.loadAutoSave(roomCode);
}

async function closeDatabase() {
    if (driver) {
        await driver.close();
        driver = null;
        isReady = false;
        console.log('🗄️ Database connection closed.');
    }
}

// ─── v3: accounts + persistent membership/password + character library ──
async function createUser(username, passwordHash) {
    const d = await init();
    return d.createUser(username, passwordHash);
}

async function getUserByUsername(username) {
    const d = await init();
    return d.getUserByUsername(username);
}

async function getUserById(id) {
    const d = await init();
    return d.getUserById(id);
}

async function setRoomPasswordHash(roomCode, passwordHash) {
    const d = await init();
    return d.setRoomPasswordHash(roomCode, passwordHash);
}

async function getRoomPasswordHash(roomCode) {
    const d = await init();
    return d.getRoomPasswordHash(roomCode);
}

async function upsertMembership(roomCode, userId, opts) {
    const d = await init();
    return d.upsertMembership(roomCode, userId, opts);
}

async function getMembership(roomCode, userId) {
    const d = await init();
    return d.getMembership(roomCode, userId);
}

async function isMemberBanned(roomCode, userId) {
    const d = await init();
    return d.isMemberBanned(roomCode, userId);
}

async function setMemberBanned(roomCode, userId, banned) {
    const d = await init();
    return d.setMemberBanned(roomCode, userId, banned);
}

async function setMemberRole(roomCode, userId, role) {
    const d = await init();
    return d.setMemberRole(roomCode, userId, role);
}

async function listCharacters(userId) {
    const d = await init();
    return d.listCharacters(userId);
}

async function getCharacterById(userId, characterId) {
    const d = await init();
    return d.getCharacterById(userId, characterId);
}

async function createCharacter(userId, name, data) {
    const d = await init();
    return d.createCharacter(userId, name, data);
}

async function updateCharacterById(userId, characterId, updates) {
    const d = await init();
    return d.updateCharacterById(userId, characterId, updates);
}

async function deleteCharacter(userId, characterId) {
    const d = await init();
    return d.deleteCharacter(userId, characterId);
}

// ─── v4.8: character claims (room live roster <-> account library) ──
async function setCharacterClaim(roomCode, userId, characterId) {
    const d = await init();
    return d.setCharacterClaim(roomCode, userId, characterId);
}

async function getCharacterClaim(roomCode, userId) {
    const d = await init();
    return d.getCharacterClaim(roomCode, userId);
}

async function deleteCharacterClaim(roomCode, userId) {
    const d = await init();
    return d.deleteCharacterClaim(roomCode, userId);
}

async function getClaimsForRoom(roomCode) {
    const d = await init();
    return d.getClaimsForRoom(roomCode);
}

module.exports = {
    saveCampaign,
    loadCampaign,
    saveAutoSave,
    loadAutoSave,
    closeDatabase,
    init, // for manual initialization if needed
    // accounts / membership / room password
    createUser,
    getUserByUsername,
    getUserById,
    setRoomPasswordHash,
    getRoomPasswordHash,
    upsertMembership,
    getMembership,
    isMemberBanned,
    setMemberBanned,
    setMemberRole,
    // character library
    MAX_CHARACTERS_PER_USER,
    listCharacters,
    getCharacterById,
    createCharacter,
    updateCharacterById,
    deleteCharacter,
    // v4.8: character claims
    setCharacterClaim,
    getCharacterClaim,
    deleteCharacterClaim,
    getClaimsForRoom,
};
