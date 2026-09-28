#!/usr/bin/env node
/**
 * Fate's Edge - Modular WebSocket Server
 * Supports Socket.io, plain WebSocket, GM election, ban/kick,
 * full character sync, and campaign storage.
 */

try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const http = require('http');
const { createTransports, closeTransports } = require('./transports');
const { version } = require('../package.json');
const cors = require('cors');

const config = require('./config.js').loadConfig();
config.manager = require('./manager.js').fromEnvironment();
const logger = require('./logger.js').createLogger(config.logLevel);
const room = require('./room.js');
room.configureDirectory(process.env.ROOM_DIRECTORY_FILE || require('path').join(__dirname, 'campaigns', 'room-directory.json'));
const api = require('./api.js');
const wsHandlers = require('./ws-handlers.js');
const ioHandlers = require('./socketio-handlers.js');
const scaling = require('./scaling.js');
const clusterMod = require('./cluster.js');

// ---------- Optional Node `cluster`-based multi-core scaling ----------
// No-op unless CLUSTER_WORKERS is set; see server/cluster.js and
// SCALING.md's "Multi-core scaling (single machine)" section. When
// active, the PRIMARY process's entire job is routing (sticky sessions +
// forking/respawning workers) -- it never builds the Express app,
// Socket.IO server, or plain-ws server below at all; only the workers do.
// A bare `return` here is safe -- CommonJS modules are wrapped in a
// function, so a top-level return just stops this module's execution
// without touching whatever `require('./index.js')` from server-start.js
// does with the (empty, in this branch) module.exports.
if (clusterMod.shouldUseCluster(config) && require('cluster').isPrimary) {
    const startedAsPrimary = clusterMod.runPrimary(config, logger);
    if (startedAsPrimary) {
        module.exports = {};
        return;
    }
    // else: optional clustering dependencies weren't installed (already
    // logged by runPrimary) -- fall through and run as an ordinary
    // single process below instead of leaving the deployment dark.
}

// ---------- Express ----------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
});
app.use(cors({ origin: config.corsOrigin }));

// Increase payload limit for campaign state and character updates (can be large)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount API routes (health, rooms, deck, modules, characters, campaigns)
if (config.manager) {
    app.use(config.manager.httpGate);
    config.manager.refresh().catch(() => console.warn('Manager unavailable; managed joins remain closed.'));
}
app.use(api.createApiRouter(config));

// Root route – simple status (optional)
app.get('/', (req, res) => {
    res.json({
        name: "Fate's Edge WebSocket Server",
        version,
        status: "running",
        rooms: room.rooms.size,
        timestamp: Date.now()
    });
});

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    logger.warn('HTTP request failed', { status, type: error.type || 'internal' });
    res.status(status).json({ error: status === 413 ? 'Request body is too large.' : status === 400 ? 'Invalid JSON request body.' : 'The request could not be completed.' });
});

// ---------- HTTP server ----------
const server = http.createServer(app);

// Both protocols share a port without competing upgrade listeners.
const { io, wss } = createTransports(server, config);
room.setIo(io);                // enable room.broadcastToRoom for Socket.io
ioHandlers.setupSocketIO(io, config);

// ---------- Optional Node `cluster` worker wiring ----------
// No-op unless this process is actually a cluster worker (see above --
// only true when CLUSTER_WORKERS was set and the optional dependencies
// resolved). Must run BEFORE scaling.initScaling() below so that when
// BOTH REDIS_URL and CLUSTER_WORKERS are configured, Redis's adapter
// (attached next) is the one that ends up wired to `io` -- it's a
// superset of the cluster adapter's job (works across every configured
// instance, not just this machine's workers).
clusterMod.attachWorkerAdapter(io, config, logger);

// ---------- Optional Redis-backed horizontal scaling ----------
// No-op unless REDIS_URL is set; see server/scaling.js and SCALING.md.
const scalingApi = scaling.initScaling(io, config, logger, room.deliverToLocalWsClients);
// Redis, if configured, takes priority for the plain-ws relay too (see
// cluster.js's initClusterWsRelay doc) -- it already covers every
// worker on this machine, so there's nothing left for the cluster IPC
// relay to do.
const effectiveScalingApi = scalingApi.enabled
    ? scalingApi
    : clusterMod.initClusterWsRelay(config, logger, room.deliverToLocalWsClients);
room.setScaling(effectiveScalingApi);

wsHandlers.setupWSS(wss, config);

// Prevent the WebSocket server from crashing on underlying HTTP errors
wss.on('error', (err) => {
    logger.error('WebSocket server error', { error: err.message });
});

// ---------- Graceful shutdown ----------
let shuttingDown = false;
function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`🛑 Received ${signal}. Shutting down...`);
    console.log(`\n🛑 Shutting down Fate's Edge server...`);

    if (effectiveScalingApi && effectiveScalingApi.close) effectiveScalingApi.close();
    if (config.manager) config.manager.close();

    Promise.resolve().then(async () => {
        await closeTransports(server, io, wss);
        await require('./storage').closeDatabase();
        logger.info('Graceful shutdown complete.');
        process.exit(0);
    }).catch(error => {
        logger.error('Shutdown failed', { error: error.message });
        process.exit(1);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ---------- Start server with port retry ----------
// NEW: a cluster WORKER must never call server.listen() -- it never binds
// the real port at all. @socket.io/sticky's setupWorker() (already wired
// above via clusterMod.attachWorkerAdapter) injects connections routed
// from the primary directly into `server`'s 'connection' event instead;
// an actual listen() here would just fight the primary for the same port
// (confirmed with a real two-worker smoke test during development -- see
// SCALING.md). require('cluster').isWorker is automatically true in a
// forked worker process with zero extra wiring needed.
const isClusterWorker = require('cluster').isWorker;

const MAX_PORT_RETRIES = 5;
let currentPort = config.port;

function startServer(port, retriesLeft) {
    server.once('error', (err) => {
        server.off('listening', onListening);
        if (err.code === 'EADDRINUSE') {
            if (retriesLeft > 0) {
                logger.warn(`Port ${port} is in use. Trying next port (${port + 1})...`);
                currentPort = port + 1;
                server.close();  // close the server to free the port
                startServer(currentPort, retriesLeft - 1);
            } else {
                logger.error(`Port ${port} is in use and no retries left. Exiting.`);
                console.error(`❌ Could not start server on any port after ${MAX_PORT_RETRIES} attempts.`);
                process.exit(1);
            }
        } else {
            logger.error('Server error', { error: err.message });
            process.exit(1);
        }
    });

    function onListening() {
        port = server.address().port;
        console.log('='.repeat(70));
        console.log(`🎯 Fate's Edge WebSocket Server v${version}`);
        console.log('='.repeat(70));
        console.log(`🚀 Server running on ${config.host}:${port}`);
        console.log(`📊 Health: http://localhost:${port}${config.healthEndpoint}`);
        console.log(`📚 API Docs: http://localhost:${port}/api/data/docs`);
        console.log(`🔌 WebSocket (plain): ws://localhost:${port}?room=ROOM_CODE`);
        console.log(`   (also supports /campaign/ROOM_CODE path)`);
        console.log(`🔌 WebSocket (Socket.io): http://localhost:${port}`);
        console.log(`📋 Rooms: ${room.rooms.size}`);
        console.log(`📊 Log Level: ${config.logLevel}`);
        console.log('='.repeat(70));
        console.log('✅ Server ready for connections\n');
    }
    server.listen(port, config.host, onListening);
}

if (isClusterWorker) {
    logger.info('🧵 Cluster worker ready -- routed via primary, not listening directly', { pid: process.pid });
    console.log(`🧵 Cluster worker ${process.pid} ready (routed via primary process, port ${config.port})`);
} else {
    startServer(currentPort, MAX_PORT_RETRIES);
}

// ---------- Stats logging ----------
setInterval(() => {
    const total = (ioHandlers.socketStats.socketIOConnections || 0) + (wsHandlers.socketStats.wsConnections || 0);
    if (total > 0 || room.rooms.size > 0) {
        logger.info('📊 Server stats', {
            rooms: room.rooms.size,
            socketIO: ioHandlers.socketStats.socketIOConnections || 0,
            plainWS: wsHandlers.socketStats.wsConnections || 0,
            totalClients: total,
            uptime: Math.floor(process.uptime()) + 's'
        });
    }
}, config.statsInterval);

module.exports = { app, server, io, wss };
