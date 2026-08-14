/**
 * Fate's Edge - Optional Node `cluster`-based multi-core scaling
 *
 * By default this server is a single Node.js process (see index.js) --
 * fine for most self-hosted tables, and the ONLY thing REDIS_URL-based
 * scaling (server/scaling.js) adds on top of that is running MORE THAN
 * ONE MACHINE behind a load balancer. Neither of those helps if you just
 * want to use more than one CPU core on a SINGLE machine -- that's what
 * this module is for. It does nothing at all unless CLUSTER_WORKERS is
 * set to an integer > 1 (or "auto"); the server behaves exactly as
 * before if it's absent. See SCALING.md's "Multi-core scaling (single
 * machine)" section for the full picture, including how this combines
 * with REDIS_URL.
 *
 * Uses two small, official Socket.IO-maintained packages (both listed in
 * package.json's optionalDependencies, same pattern as ioredis/
 * @socket.io/redis-adapter):
 *   - `@socket.io/sticky` -- routes each client's requests to the SAME
 *     worker for the life of its session (based on the Engine.IO `sid`
 *     query parameter). This is not optional polish -- Socket.IO's HTTP
 *     long-polling transport makes multiple sequential HTTP requests per
 *     logical connection, and the in-memory session object those
 *     requests need lives in exactly one worker's memory. Without sticky
 *     routing, plain `cluster` round-robin would scatter a single
 *     client's own requests across different workers and break the
 *     connection outright.
 *   - `@socket.io/cluster-adapter` -- the Socket.IO equivalent of
 *     scaling.js's Redis adapter, but relaying broadcasts between
 *     worker PROCESSES on this one machine via cluster IPC instead of
 *     Redis pub/sub. Skipped in favor of the Redis adapter when
 *     REDIS_URL is also set (Redis is a superset -- it already relays
 *     across every configured instance, cluster workers included).
 *
 * Plain-`ws` clients need their own relay for the same reason they do in
 * scaling.js (they're not part of Socket.IO's room/adapter system) --
 * see initClusterWsRelay() below, which mirrors scaling.js's pub/sub
 * relay shape exactly but uses cluster IPC (primary process as the
 * broadcast hub) instead of Redis. Same skip-if-Redis-is-configured rule
 * applies.
 *
 * What this does NOT do (same caveats as scaling.js, worth repeating
 * here since they apply per-worker just as much as per-instance):
 *   - Does not share room state (characters, decks, timers) across
 *     workers -- each worker holds its own in-memory copy, same as any
 *     other instance would. Clients see a consistent view because every
 *     state MUTATION is broadcast (and relayed) with the resulting full
 *     state, not because the underlying room objects are kept in sync.
 *   - A worker crash loses whatever it was holding in memory for its
 *     currently-connected clients, same as a single-process restart
 *     would; the primary just respawns the worker and new connections
 *     route around it. Durable data is unaffected (server/storage.js).
 *   - SQLite (the default storage backend) is a single file -- multiple
 *     worker processes on this one machine CAN share it (better-sqlite3/
 *     sqlite3 handle OS-level file locking), but a deployment expecting
 *     heavy concurrent write volume across many workers should use
 *     PostgreSQL/MySQL instead (see INSTALL.md), same recommendation
 *     SCALING.md already makes for multi-instance deployments.
 */

const cluster = require('cluster');
const http = require('http');

/** True if CLUSTER_WORKERS resolved to an integer > 1 (see config.js). */
function shouldUseCluster(config) {
    return Number(config.clusterWorkers) > 1;
}

/**
 * Runs this process as the cluster PRIMARY: sets up sticky routing, forks
 * `config.clusterWorkers` workers, respawns any that die, and (unless
 * Redis is already configured) relays plain-ws broadcasts between
 * workers over cluster IPC. The primary's own httpServer is bare --
 * no Express app, no room state, no Socket.IO handlers -- its only job
 * is routing raw connections to workers.
 *
 * Call ONLY when `shouldUseCluster(config) && cluster.isPrimary`.
 *
 * @returns {boolean} true if this process is now running as the cluster
 *   primary (the caller should stop here and not build the rest of the
 *   server). false if the optional dependencies weren't available --
 *   already logged; the caller should fall back to running as an
 *   ordinary single process instead of leaving the deployment dark.
 */
function runPrimary(config, logger) {
    let setupMaster, setupPrimary;
    try {
        ({ setupMaster } = require('@socket.io/sticky'));
        ({ setupPrimary } = require('@socket.io/cluster-adapter'));
    } catch (e) {
        logger.error(
            'CLUSTER_WORKERS is set but the optional clustering dependencies ' +
            '(@socket.io/sticky, @socket.io/cluster-adapter) are not installed -- ' +
            'they ship in package.json\'s optionalDependencies and install ' +
            'automatically via `npm install`/`npm ci` (including the Docker image ' +
            'build) unless your environment explicitly skips optional deps. ' +
            'Falling back to a single process.',
            { error: e.message }
        );
        return false;
    }

    const httpServer = http.createServer();
    setupMaster(httpServer, { loadBalancingMethod: 'least-connection' });
    setupPrimary();
    cluster.setupPrimary({ serialization: 'advanced' });

    const workerCount = config.clusterWorkers;

    for (let i = 0; i < workerCount; i++) cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
        logger.warn('🧵 Cluster worker exited, restarting it', {
            workerId: worker.id, pid: worker.process.pid, code, signal
        });
        cluster.fork();
    });

    // ─── Plain-ws cross-worker relay hub ───────────────────────────
    // See module doc above. Skipped entirely when Redis is configured --
    // scaling.js's Redis relay already covers every worker on this
    // machine (it doesn't care whether "another instance" is a cluster
    // worker or a separate machine).
    if (!config.redisUrl) {
        cluster.on('message', (sourceWorker, message) => {
            if (!message || message.type !== 'fe:ws-relay') return;
            for (const id in cluster.workers) {
                if (String(id) === String(sourceWorker.id)) continue;
                cluster.workers[id].send(message);
            }
        });
    }

    httpServer.on('error', (err) => {
        logger.error('Cluster primary failed to bind port', { error: err.message, port: config.port });
        console.error(`❌ Cluster primary could not bind ${config.host}:${config.port}: ${err.message}`);
        process.exit(1);
    });

    httpServer.listen(config.port, config.host, () => {
        logger.info('🧵 Cluster primary listening', { host: config.host, port: config.port, workers: workerCount });
        console.log('='.repeat(70));
        console.log(`🎯 Fate's Edge WebSocket Server -- Cluster Primary (pid ${process.pid})`);
        console.log('='.repeat(70));
        console.log(`🚀 Listening on ${config.host}:${config.port}, routing to ${workerCount} worker(s)`);
        console.log(`📊 Health: http://localhost:${config.port}${config.healthEndpoint}`);
        console.log('='.repeat(70));
        console.log('✅ Cluster ready for connections\n');
    });

    let shuttingDown = false;
    function gracefulShutdown(signal) {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info(`🛑 Cluster primary received ${signal}. Shutting down workers...`);
        console.log(`\n🛑 Shutting down Fate's Edge cluster primary...`);
        for (const id in cluster.workers) {
            try { cluster.workers[id].kill(signal); } catch (e) { /* already gone */ }
        }
        httpServer.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10000).unref();
    }
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return true;
}

/**
 * Runs INSIDE a worker process. Wires this worker's Socket.IO server up
 * to receive connections routed from the primary (always required once
 * clustering is active at all) and, unless Redis is already providing a
 * cross-instance adapter, attaches the cluster IPC adapter so
 * `io.to(room).emit(...)` reaches Socket.IO clients on every worker, not
 * just this one.
 *
 * No-op (returns false) if this process isn't actually a cluster worker
 * (i.e. clustering is off) -- safe to call unconditionally from index.js.
 */
function attachWorkerAdapter(io, config, logger) {
    if (!cluster.isWorker) return false;

    let createAdapter, setupWorker;
    try {
        ({ createAdapter } = require('@socket.io/cluster-adapter'));
        ({ setupWorker } = require('@socket.io/sticky'));
    } catch (e) {
        logger.error(
            'Running as a cluster worker but the optional clustering dependencies ' +
            'are not installed -- see runPrimary()\'s identical note. This worker ' +
            'will not receive connections routed from the primary correctly.',
            { error: e.message }
        );
        return false;
    }

    // Redis's adapter (if configured) is attached separately by
    // scaling.js's initScaling() and takes priority -- it works across
    // every configured instance, not just this machine's workers.
    if (!config.redisUrl) {
        io.adapter(createAdapter());
    }
    setupWorker(io);
    logger.info('🧵 Cluster worker attached to primary', { pid: process.pid });
    return true;
}

/**
 * Plain-ws cross-worker broadcast relay, mirroring scaling.js's Redis
 * pub/sub relay shape exactly (`{ enabled, publish, close }`) so
 * room.setScaling() accepts either interchangeably. Uses the cluster
 * primary as a broadcast hub over IPC instead of Redis.
 *
 * Returns `{ enabled: false }` (a safe no-op) if clustering isn't active,
 * or if Redis is configured (scaling.js's relay already covers this --
 * see module doc above, no need to double-relay).
 *
 * @param {(roomCode: string, event: string, payload: object, senderId: string|null) => void} deliverLocal
 */
function initClusterWsRelay(config, logger, deliverLocal) {
    if (config.redisUrl) return { enabled: false };
    if (!cluster.isWorker) return { enabled: false };

    const instanceId = `${process.pid}`;

    process.on('message', (message) => {
        if (!message || message.type !== 'fe:ws-relay') return;
        if (message.origin === instanceId) return; // our own publish, already delivered locally
        deliverLocal(message.roomCode, message.event, message.payload, message.senderId);
    });

    logger.info('🔗 Cluster IPC scaling enabled — multi-worker plain-ws broadcast relay active', { instanceId });

    return {
        enabled: true,
        publish(roomCode, event, payload, senderId) {
            if (process.send) {
                process.send({ type: 'fe:ws-relay', origin: instanceId, roomCode, event, payload, senderId });
            }
        },
        close() { /* nothing to close -- the IPC channel tears down with the process itself */ },
    };
}

module.exports = { shouldUseCluster, runPrimary, attachWorkerAdapter, initClusterWsRelay };
