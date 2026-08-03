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
 */

const fs = require('fs');
const path = require('path');

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

module.exports = {
    saveCampaign,
    loadCampaign,
    saveAutoSave,
    loadAutoSave,
    closeDatabase,
    init, // for manual initialization if needed
};
