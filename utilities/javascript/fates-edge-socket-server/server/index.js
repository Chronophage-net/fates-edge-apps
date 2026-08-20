#!/usr/bin/env node
/**
 * Fate's Edge - Modular WebSocket Server
 * Supports Socket.io, plain WebSocket, GM election, ban/kick,
 * full character sync, and campaign storage.
 */

try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');

const config = require('./config.js').loadConfig();
const logger = require('./logger.js').createLogger(config.logLevel);
const room = require('./room.js');
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
app.use(cors({ origin: config.corsOrigin }));

// Increase payload limit for campaign state and character updates (can be large)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount API routes (health, rooms, deck, modules, characters, campaigns)
app.use(api.createApiRouter(config));

// Root route – simple status (optional)
app.get('/', (req, res) => {
    res.json({
        name: "Fate's Edge WebSocket Server",
        version: "1.0.0",
        status: "running",
        rooms: room.rooms.size,
        timestamp: Date.now()
    });
});

// ---------- HTTP server ----------
const server = http.createServer(app);

// ---------- Socket.io ----------
const io = socketIo(server, {
    cors: { origin: config.corsOrigin, methods: ["GET", "POST"], credentials: true },
    transports: ['websocket', 'polling'],
    // NEW: raised above Socket.IO's 1MB default -- see config.js's
    // wsMaxPayloadBytes note (added for the optional AI GM Bot voice
    // narration feature's base64-encoded 'tts-audio' events).
    maxHttpBufferSize: config.wsMaxPayloadBytes
});
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

// ---------- Plain WebSocket ----------
// NEW: maxPayload -- see config.js's wsMaxPayloadBytes note. The plain-ws
// transport has no default cap at all otherwise.
const wss = new WebSocket.Server({ server, path: '/', maxPayload: config.wsMaxPayloadBytes });
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

    server.close((err) => {
        if (err) {
            logger.error('Error closing HTTP server', { error: err.message });
            process.exit(1);
        }
        logger.info('HTTP server closed.');
        io.close(() => {
            logger.info('Socket.io server closed.');
            wss.close(() => {
                logger.info('WebSocket server closed.');
                logger.info('✅ Graceful shutdown complete.');
                process.exit(0);
            });
        });
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
    server.removeAllListeners('error');
    server.removeAllListeners('listening');

    server.on('error', (err) => {
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

    server.listen(port, config.host, () => {
        console.log('='.repeat(70));
        console.log(`🎯 Fate's Edge WebSocket Server v1.0.0`);
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
    });
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
