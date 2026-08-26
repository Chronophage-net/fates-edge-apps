/**
 * Fate's Edge - Configuration Loader
 * Reads from environment variables and optional config.json.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadConfig() {
    const config = {
        port: parseInt(process.env.PORT, 10) || 10000,
        host: process.env.HOST || '0.0.0.0',
        logLevel: process.env.LOG_LEVEL || 'INFO',
        corsOrigin: process.env.CORS_ORIGIN || '*',
        maxDeckHistory: parseInt(process.env.MAX_DECK_HISTORY, 10) || 100,
        // ─── Rolling chat history (per room, in-memory) ─────────────
        // Newly-joined clients get the last N chat messages in their
        // room-joined/room-state payload (see room.js's recordChatMessage()
        // and its call sites in socketio-handlers.js/ws-handlers.js), so a
        // client that connects mid-conversation isn't staring at a blank
        // pane. Purely in-memory, same lifetime as the room itself --
        // cleared when the room empties out and is recreated (see room.js's
        // createRoom()), same as deckHistory. Set to 0 to disable entirely
        // (no history stored, no history sent on join -- behaves exactly
        // like before this feature existed).
        maxChatHistory: parseInt(process.env.MAX_CHAT_HISTORY, 10) || 50,
        healthEndpoint: process.env.HEALTH_ENDPOINT || '/api/health',
        statsInterval: parseInt(process.env.STATS_INTERVAL, 10) || 30000,
        apiKey: process.env.API_KEY || null,

        // ─── Sound search (soundboard "Search Sounds" feature) ───────
        // Server-side only -- never sent to the browser. Register a free
        // key at https://freesound.org/apiv2/apply/. When unset, the
        // /api/soundboard/search and /api/soundboard/download routes
        // respond 503 rather than throwing, so a deployment that hasn't
        // set this up just has that one feature disabled.
        freesoundApiKey: process.env.FREESOUND_API_KEY || null,

        // ─── General API rate limiting ──────────────────────────────
        // Separate from (and stacked on top of) the tighter, route-specific
        // limiters already applied to /api/auth/login and /api/auth/register
        // (see api.js). This one is a broad, generous per-IP cap applied to
        // the REST API as a whole -- meant to blunt scripted abuse/scraping,
        // not to constrain normal interactive use (a GM's client alone can
        // easily fire a dozen requests in a burst while loading a room).
        // Set API_RATE_LIMIT_MAX=0 to disable it entirely.
        apiRateLimitWindowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000,
        apiRateLimitMax: process.env.API_RATE_LIMIT_MAX !== undefined
            ? parseInt(process.env.API_RATE_LIMIT_MAX, 10)
            : 300,

        // ─── WebSocket message rate limiting ────────────────────────
        // Per-CONNECTION (not per-IP) cap on inbound messages/events across
        // both transports (plain-ws and Socket.IO) -- see security.js's
        // createConnectionMessageLimiter(). Guards against a single
        // connection flooding the server (deck draws, chat, whiteboard
        // updates, etc.) after it's already past the HTTP-level limiter
        // above, which only covers the initial handshake request.
        // Set WS_MESSAGE_RATE_MAX=0 to disable it entirely.
        wsMessageRateWindowMs: parseInt(process.env.WS_MESSAGE_RATE_WINDOW_MS, 10) || 10 * 1000,
        wsMessageRateMax: process.env.WS_MESSAGE_RATE_MAX !== undefined
            ? parseInt(process.env.WS_MESSAGE_RATE_MAX, 10)
            : 120,

        // ─── Per-room client cap ─────────────────────────────────────
        // 0 (default) = unlimited, unchanged behavior. A very large public
        // room is a niche case, but an unbounded one is also an easy denial-
        // of-service vector (one room accepting connections forever, each
        // one cheap individually but unbounded in aggregate). Applies at
        // join time on both transports; existing clients already in a room
        // are never evicted if this is lowered at runtime.
        maxClientsPerRoom: parseInt(process.env.MAX_CLIENTS_PER_ROOM, 10) || 0,

        // ─── Optional Node `cluster`-based multi-core scaling ────────
        // Unset/1 by default -- this server runs as a single process, same
        // as always. Set CLUSTER_WORKERS to an integer > 1 (or "auto" to
        // use one worker per CPU core) to fork multiple worker processes
        // sharing one listening port, using @socket.io/sticky for session-
        // affine routing and @socket.io/cluster-adapter for cross-worker
        // Socket.IO broadcast. See server/cluster.js and SCALING.md's
        // "Multi-core scaling (single machine)" section -- this is a
        // DIFFERENT axis of scaling than REDIS_URL above (more CPU cores on
        // ONE machine, vs. more machines); the two can be combined.
        clusterWorkers: (() => {
            const raw = (process.env.CLUSTER_WORKERS || '').trim();
            if (!raw) return 0;
            if (raw.toLowerCase() === 'auto') return require('os').cpus().length;
            const n = parseInt(raw, 10);
            return Number.isFinite(n) && n > 0 ? n : 0;
        })(),

        // ─── Optional Redis-backed horizontal scaling ──────────────
        // Unset by default -- this server runs as a single in-memory
        // instance with no external dependency. Set REDIS_URL to run
        // more than one instance behind a load balancer with sticky
        // sessions; see server/scaling.js and SCALING.md.
        redisUrl: process.env.REDIS_URL || null,

        // ─── TURN (coturn) credential minting ──────────────────────
        // Shared with the coturn `static-auth-secret` setting (see
        // docker-compose.yml). When set, /api/turn-credentials and the
        // 'turn-credentials-request' WS message mint short-lived
        // time-limited credentials per the coturn REST API convention
        // (username = "<expiry>:<label>", credential =
        // base64(HMAC-SHA1(secret, username))) instead of shipping a
        // long-lived static password to every browser client.
        turnSecret: process.env.TURN_SECRET || null,
        turnRealm: process.env.TURN_REALM || 'fates-edge',
        // Comma-separated list, e.g. "turn:turn.example.com:3478,turns:turn.example.com:5349"
        turnUrls: (process.env.TURN_URLS || '').split(',').map(s => s.trim()).filter(Boolean),
        turnCredentialTtl: parseInt(process.env.TURN_CREDENTIAL_TTL, 10) || 86400, // 24h
    };

    const configFilePath = process.env.CONFIG_FILE || path.join(__dirname, 'config.json');
    if (fs.existsSync(configFilePath)) {
        try {
            const fileConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
            for (const key in fileConfig) {
                if (!(key in process.env)) {
                    config[key] = fileConfig[key];
                }
            }
            console.log(`[CONFIG] Loaded configuration from ${configFilePath}`);
        } catch (err) {
            console.error(`[CONFIG] Failed to parse config file ${configFilePath}: ${err.message}`);
        }
    } else {
        console.log(`[CONFIG] No config file found at ${configFilePath}; using environment/defaults.`);
    }

    // The admin API (kick/ban, module push, character/campaign read-write)
    // MUST be protected by a real secret. Previously the "API key" check
    // only verified that *some* header was present -- any value at all
    // was accepted, which is equivalent to no authentication. If no key
    // is configured, generate one and print it loudly ONCE at startup
    // (same pattern Jupyter/similar admin tools use) rather than silently
    // running wide open.
    if (!config.apiKey) {
        config.apiKey = crypto.randomBytes(24).toString('hex');
        console.log('='.repeat(70));
        console.log('⚠️  No API_KEY configured -- generated a random one for this run:');
        console.log(`    ${config.apiKey}`);
        console.log('    Set the API_KEY environment variable to persist this across restarts.');
        console.log('='.repeat(70));
    }

    return config;
}

module.exports = { loadConfig };
