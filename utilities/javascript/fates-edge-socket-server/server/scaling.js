/**
 * Fate's Edge - Optional Redis-backed horizontal scaling
 *
 * By default this server is a single Node.js process holding all room
 * state in memory (see room.js) -- fine for one instance behind one
 * port. This module is the OPTIONAL opt-in path to run more than one
 * instance behind a load balancer, sharing broadcast traffic across
 * instances via Redis pub/sub. It does nothing at all unless REDIS_URL
 * is set; the server behaves exactly as before if it's absent.
 *
 * What Redis is (and isn't) used for here:
 *   - Cross-instance BROADCAST relay only. Redis is not the source of
 *     truth for room state -- that's still in-memory per instance
 *     (ephemeral) plus server/storage.js (durable, SQLite/Postgres/
 *     MySQL). A client's actual room membership and character data are
 *     never stored in Redis.
 *   - Two separate relay paths, because this server exposes two
 *     transports:
 *       1. Socket.IO clients -- handled by the official
 *          `@socket.io/redis-adapter`. Once wired via `io.adapter(...)`,
 *          `io.to(roomCode).emit(...)` (see room.js's broadcastToRoom)
 *          transparently reaches Socket.IO clients connected to ANY
 *          instance, because the adapter publishes the emit over Redis
 *          and every instance's Socket.IO server re-emits it to its own
 *          locally-joined sockets. No changes needed elsewhere for this
 *          path -- it "just works" once the adapter is attached.
 *       2. Plain-`ws` clients -- NOT part of Socket.IO's room system, so
 *          the adapter above doesn't cover them. This module runs its
 *          own lightweight pub/sub relay (`RELAY_CHANNEL`) for that
 *          transport: broadcastToRoom() publishes an event once after
 *          delivering to its own local plain-ws clients, tagged with
 *          this instance's id; every instance (including the sender)
 *          subscribes, and ignores messages tagged with its own id, so
 *          each instance delivers exactly once to whichever local
 *          plain-ws clients it happens to be holding for that room.
 *
 * Sticky sessions required: a load balancer in front of multiple
 * instances MUST pin each client's WebSocket connection to the same
 * backend instance for the life of that connection (e.g. nginx
 * `ip_hash`, or a cookie-based sticky policy). This module does not
 * migrate an in-flight connection between instances -- it only relays
 * broadcast traffic so clients on *different* instances still see each
 * other's messages.
 *
 * Requires the optional `ioredis` and `@socket.io/redis-adapter`
 * packages (see package.json's optionalDependencies) -- neither is a
 * hard dependency of this server.
 */

const crypto = require('crypto');

const RELAY_CHANNEL = 'fates-edge:ws-relay';
const instanceId = crypto.randomBytes(8).toString('hex');

let enabled = false;
let pubClient = null;
let subClient = null;
let deliverLocalFn = null; // set via init(), calls back into room.js

/**
 * @param {import('socket.io').Server} io
 * @param {{ redisUrl?: string }} config
 * @param {{ info: Function, warn: Function, error: Function }} logger
 * @param {(roomCode: string, event: string, payload: object, senderId: string|null) => void} deliverLocal
 *        Callback into room.js that delivers ONLY to this instance's
 *        local plain-ws clients (must NOT re-touch Socket.IO -- that
 *        side is already handled by the redis-adapter).
 * @returns {{ enabled: boolean, publish?: Function, close?: Function }}
 */
function initScaling(io, config, logger, deliverLocal) {
    if (!config.redisUrl) {
        return { enabled: false };
    }

    let Redis, createAdapter;
    try {
        Redis = require('ioredis');
        ({ createAdapter } = require('@socket.io/redis-adapter'));
    } catch (e) {
        logger.error(
            'REDIS_URL is set but the optional scaling dependencies (ioredis, ' +
            '@socket.io/redis-adapter) are not installed -- they ship in ' +
            'package.json\'s optionalDependencies and install automatically via ' +
            '`npm install`/`npm ci` (including the Docker image build) unless your ' +
            'environment explicitly skips optional deps (e.g. `npm ci --omit=optional` ' +
            'or a restricted registry mirror). Falling back to single-instance behavior.',
            { error: e.message }
        );
        return { enabled: false };
    }

    pubClient = new Redis(config.redisUrl);
    subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.error('Redis pub client error', { error: err.message }));
    subClient.on('error', (err) => logger.error('Redis sub client error', { error: err.message }));

    // Socket.IO cross-instance broadcast -- see module doc above.
    io.adapter(createAdapter(pubClient, subClient));

    // Plain-ws cross-instance relay -- our own minimal pub/sub, since
    // plain-ws clients aren't part of Socket.IO's room/adapter system.
    const relaySub = pubClient.duplicate();
    relaySub.on('error', (err) => logger.error('Redis relay-sub client error', { error: err.message }));
    relaySub.subscribe(RELAY_CHANNEL).catch((err) => {
        logger.error('Failed to subscribe to ws relay channel', { error: err.message });
    });
    relaySub.on('message', (_channel, raw) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.origin === instanceId) return; // it's our own publish; already delivered locally
            deliverLocalFn(msg.roomCode, msg.event, msg.payload, msg.senderId);
        } catch (e) {
            logger.warn('Malformed ws relay message, ignoring', { error: e.message });
        }
    });

    deliverLocalFn = deliverLocal;
    enabled = true;
    logger.info('🔗 Redis scaling enabled — multi-instance broadcast relay active', { instanceId });

    return {
        enabled: true,
        publish(roomCode, event, payload, senderId) {
            pubClient.publish(RELAY_CHANNEL, JSON.stringify({
                origin: instanceId, roomCode, event, payload, senderId,
            })).catch((err) => logger.error('Failed to publish ws relay message', { error: err.message }));
        },
        close() {
            try { pubClient && pubClient.disconnect(); } catch (e) { /* ignore */ }
            try { subClient && subClient.disconnect(); } catch (e) { /* ignore */ }
            try { relaySub && relaySub.disconnect(); } catch (e) { /* ignore */ }
        },
    };
}

function isEnabled() { return enabled; }

module.exports = { initScaling, isEnabled, RELAY_CHANNEL };
