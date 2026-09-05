# Scaling: Multi-Core (cluster) and Multi-Machine (Redis)

> **Status: both implemented, both opt-in, both off by default.** A single instance / single process (the only thing most self-hosted tables ever need) requires nothing from this document — no Redis, no `CLUSTER_WORKERS`, no extra configuration. This only matters once you're trying to use more than one CPU core (see "Multi-core scaling" below) or run more than one server process behind a load balancer (see "Horizontal scaling" further down).

The cluster manager proposed in the docs repository adds a third, deliberately separate model for
managed rooms: every socket server registers a stable, opaque `server_id`, and every room placement
names that server plus a monotonically increasing `placement_version`. Its connect response returns
the selected server ID and endpoint. A direct client reconnects to that endpoint; a shared load
balancer uses the manager's signed affinity cookie (or trusted-client affinity headers) to keep the
room on the selected server. The room token and socket handshake repeat both values so routing can
never substitute for authorization. See `fates-edge-docs/SAAS_MANAGER.md` at the workspace root for
the source-of-truth design.

That proposed room-placement model does not silently change the Redis mode documented below.
Today's Redis implementation lets any replica serve a room and relays broadcasts between replicas;
a managed deployment will instead give one server the authoritative placement and fence the old
placement before moving it. Local and unmanaged deployments keep the existing behavior.

---

## Do you actually need either of these?

Almost certainly not. One instance of this server comfortably handles many simultaneous rooms — it's event-driven, non-blocking, and each room's live state is a few KB in memory. Reach for this document only if you're specifically trying to use more than one CPU core on one machine, or run **multiple server processes** (e.g. for zero-downtime deploys with more than one replica, or genuinely high concurrent load across many rooms). If you're running one process, stop reading here — you already have everything you need.

---

## Multi-core scaling (single machine)

Node.js is single-threaded by default — one process uses one CPU core, no matter how many the machine has. `CLUSTER_WORKERS` is a simpler alternative to the Redis-based horizontal scaling described below, for the specific case of "I have a beefy single machine and want to use more of it," with no external dependency (no Redis, no separate database migration) required.

### What's actually implemented

`server/cluster.js`, wired in from `server/index.js` right at the top (the cluster PRIMARY branch entirely bypasses building the Express app/room state/Socket.IO handlers — only workers do that) and again right after the Socket.IO server is created in each worker:

1. **Sticky routing** — via the official [`@socket.io/sticky`](https://www.npmjs.com/package/@socket.io/sticky). The primary process binds the real port and, for each incoming connection, routes it to a worker based on the Engine.IO session id (`least-connection` balancing for a session's first request, then pinned to that same worker for the rest of its life). This isn't optional polish: Socket.IO's HTTP long-polling transport makes multiple sequential requests per logical connection, and without sticky routing those requests could scatter across different workers and break the connection outright.
2. **Socket.IO clients** — via the official [`@socket.io/cluster-adapter`](https://www.npmjs.com/package/@socket.io/cluster-adapter), the same role `@socket.io/redis-adapter` plays for multi-machine scaling below, but relaying over cluster IPC instead of Redis. Skipped in favor of the Redis adapter when `REDIS_URL` is *also* set (Redis already covers every configured instance, cluster workers included).
3. **Plain-`ws` clients** — `server/cluster.js` runs its own minimal relay over cluster IPC (the primary process as a broadcast hub), mirroring `scaling.js`'s Redis pub/sub relay exactly in shape. Same Redis-takes-priority rule as above.

Workers never bind the real port directly — `@socket.io/sticky`'s `setupWorker()` injects primary-routed connections straight into each worker's own (unbound) `http.Server` 'connection' event. **This was verified with a real two-worker smoke test during development** (two separate Socket.IO clients, confirmed landing on different worker PIDs via `least-connection` balancing, and a broadcast from one worker's client successfully reaching the other's) — not just pattern-matched from the packages' documentation.

### Configuration

| Variable | Description | Default |
|---|---|---|
| `CLUSTER_WORKERS` | Integer > 1, or `auto` for one worker per CPU core. `0`/unset = single process (default). | `0` |

### Dependencies

`@socket.io/sticky` and `@socket.io/cluster-adapter` are listed in `package.json`'s `optionalDependencies`, same install-automatically pattern as `ioredis`/`@socket.io/redis-adapter` below. If `CLUSTER_WORKERS` is set but those packages aren't resolvable, the server logs a clear error and falls back to a single process rather than crashing.

### What this does *not* do

- **Does not share room state across workers**, for the same reason Redis scaling doesn't (see below) — each worker holds its own in-memory copy; clients see a consistent view because every state-changing broadcast carries the resulting full state, not because the underlying room objects are synced.
- **Does not survive a worker crash for that worker's own connected clients** — the primary respawns the worker (`cluster.on('exit', ...)` → `cluster.fork()`) and new connections route around it, but whatever that worker was holding in memory for already-connected clients is gone, same as a single-process restart. Durable data (`server/storage.js`) is unaffected.
- **Is not a substitute for `REDIS_URL`** if you actually need multiple *machines* — `CLUSTER_WORKERS` only forks processes on the machine it's running on. The two are complementary and can be combined (more cores per machine, more machines) — when both are set, Redis takes priority for both the Socket.IO adapter and the plain-ws relay (it's a superset), and `CLUSTER_WORKERS` still does its own job of forking workers + sticky routing on top.

### A note on SQLite under cluster

The default storage backend (`server/storage.js`, SQLite) is a single file. Multiple worker processes on one machine reading/writing the same file works via OS-level locking, but a deployment expecting heavy concurrent write volume across many workers should use PostgreSQL/MySQL instead (`DATABASE_TYPE`/`DATABASE_URL`, see `INSTALL.md`) — the same recommendation this document already makes for multi-machine deployments below.

### Tests

`tests/cluster.test.js` covers the config-gating logic (`shouldUseCluster()`) and the graceful-fallback path (dependencies unavailable). Like the Redis path below, there's no automated multi-process integration test in the unit test suite — verifying real cross-worker delivery requires actually forking processes, which is closer to a deployment smoke test than a unit test (see the "verified with a real two-worker smoke test" note above for how this was actually confirmed to work, once, during development — re-verify after any Node.js major-version upgrade, since this relies on `cluster` module internals that have changed across versions before).

---

## Horizontal scaling (multiple machines, Redis)

### What's actually implemented

`server/scaling.js`, wired in from `server/index.js` right after the Socket.IO server is created:

1. **Socket.IO clients** — via the official [`@socket.io/redis-adapter`](https://www.npmjs.com/package/@socket.io/redis-adapter). Once attached (`io.adapter(...)`), the existing `io.to(roomCode).emit(...)` call in `room.js`'s `broadcastToRoom()` transparently reaches Socket.IO clients connected to *any* instance — the adapter publishes the emit over Redis, and every instance's Socket.IO server re-emits to its own locally-joined sockets. No handler code had to change for this path.
2. **Plain-`ws` clients** — not covered by the Socket.IO adapter, since they never join a Socket.IO room. `scaling.js` runs its own minimal pub/sub relay on a dedicated Redis channel: `broadcastToRoom()` delivers to its own instance's local plain-ws clients as before, then (only when Redis is configured) publishes the same event once more; every instance subscribes and delivers to whichever local plain-ws clients it's holding for that room, skipping its own publish so nothing gets delivered twice.

Neither path makes Redis the source of truth for anything. Room state (characters, chat history, decks, timers) still lives in memory per-instance exactly as it does today, and durable persistence still goes through `server/storage.js` (SQLite/PostgreSQL/MySQL) — Redis here is purely a broadcast bus between instances.

### What's required to actually run more than one instance

Redis alone is not sufficient — a client's WebSocket connection is a stateful, long-lived TCP connection to *one specific instance*. This module relays broadcast traffic between instances; it does not migrate a connection or share in-memory room membership.

1. **Sticky sessions at the load balancer.** Every client must be pinned to the same backend instance for the life of its connection — e.g. nginx `ip_hash`, HAProxy's `balance source`, or a cookie-based sticky policy on a cloud load balancer. Without this, a client's reconnect could land on a different instance than their in-flight session expects.
2. **A shared database**, not per-instance SQLite files. If you're running multiple instances, point `DATABASE_TYPE`/`DATABASE_URL` at a real PostgreSQL or MySQL server both instances can reach — SQLite is a single local file and won't be shared correctly across processes/hosts. See `INSTALL.md`.
3. **A reachable Redis instance** both server processes can connect to (see below).

### Configuration

| Variable | Description | Default |
|---|---|---|
| `REDIS_URL` | Redis connection string, e.g. `redis://redis:6379`. Unset = scaling disabled entirely (default). | unset |

That's the only new variable. Nothing else changes about how the server is configured or deployed for the single-instance case.

### Local / docker-compose

`docker-compose.yml` includes an optional `redis` service behind the `scaling` profile — it does not start with a plain `docker compose up`:

```bash
docker compose --profile scaling up -d
# then set REDIS_URL=redis://redis:6379 in .env and restart the server service
```

This is provided for convenience when testing the scaling path locally. It does **not** set up a load balancer or multiple `server` replicas for you — that part is deployment-specific (e.g. `docker compose up -d --scale server=3` plus your own reverse proxy with sticky sessions, or a Kubernetes Deployment + Service + Ingress with session affinity).

### Dependencies

`ioredis` and `@socket.io/redis-adapter` are listed in `package.json`'s `optionalDependencies`, so they install automatically with a normal `npm install`/`npm ci` (including the Docker image build) — no separate install step. If `REDIS_URL` is set but those packages somehow aren't resolvable (e.g. an environment that explicitly strips optional deps), the server logs a clear error explaining why and falls back to single-instance behavior rather than crashing.

### What this does *not* do

- **Does not shard rooms across instances.** Every instance can still serve any room; the relay just makes sure clients on different instances see the same traffic for a room they're both in.
- **Does not provide Redis high availability itself.** If you need that, run Redis Sentinel/Cluster and point `REDIS_URL` at it the same way you would for any other Redis-backed service — nothing here is specific to a single-node Redis.
- **Does not cache API responses or campaign data.** There is no `ENABLE_CACHING`-style feature in this codebase; earlier drafts of `DESIGN.md` described one, and it never got built. Redis's only job here is broadcast relay.

### Tests

`tests/scaling.test.js` covers the no-op path (no `REDIS_URL`) and the graceful-fallback path (`REDIS_URL` set but the optional packages unavailable). There's no automated multi-instance/multi-Redis integration test in this repo yet — verifying real cross-instance delivery requires an actual Redis instance and two running server processes, which is closer to a deployment smoke test than a unit test. If you stand up a scaling deployment, a quick manual check is: connect a plain-ws client to instance A and a Socket.IO client to instance B, join the same room on both, and confirm a chat message from one reaches the other.
