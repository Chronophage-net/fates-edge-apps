/**
 * Database storage module for Fate's Edge campaigns.
 * Supports SQLite (default), PostgreSQL, or MySQL.
 *
 * Environment variables:
 *   DATABASE_TYPE      - 'sqlite' (default), 'postgres', or 'mysql'
 *   DATABASE_URL       - For SQLite: file path (default: './campaigns.db')
 *                        For PostgreSQL/MySQL: connection string
 *   DATABASE_MAX_CAMPAIGNS - number of campaigns to keep per room (default: 2)
 *   DATABASE_SSL       - 'true' to enable SSL (PostgreSQL/MySQL)
 */

const fs = require('fs');
const path = require('path');

// Determine database type from environment
const dbType = (process.env.DATABASE_TYPE || 'sqlite').toLowerCase();
const dbUrl = process.env.DATABASE_URL || (dbType === 'sqlite' ? './campaigns.db' : null);
const maxCampaigns = parseInt(process.env.DATABASE_MAX_CAMPAIGNS) || 2;
const useSSL = process.env.DATABASE_SSL === 'true';

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
            // Consolidate
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

    // Test and create table
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
            // Consolidate
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

    // Test and create table
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
    closeDatabase,
    init, // for manual initialization if needed
};
