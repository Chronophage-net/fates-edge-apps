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
    transports: ['websocket', 'polling']
});
room.setIo(io);                // enable room.broadcastToRoom for Socket.io
ioHandlers.setupSocketIO(io);

// ---------- Plain WebSocket ----------
const wss = new WebSocket.Server({ server, path: '/' });
wsHandlers.setupWSS(wss);

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

startServer(currentPort, MAX_PORT_RETRIES);

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