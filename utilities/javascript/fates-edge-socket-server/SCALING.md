# Horizontal Scaling (Redis)

> **Status: implemented, opt-in, off by default.** A single instance (the only thing most self-hosted tables ever need) requires nothing from this document — no Redis, no extra configuration. This only matters once you're running more than one server process behind a load balancer.

---

## Do you actually need this?

Almost certainly not. One instance of this server comfortably handles many simultaneous rooms — it's event-driven, non-blocking, and each room's live state is a few KB in memory. Reach for this document only if you're specifically trying to run **multiple server processes** (e.g. for zero-downtime deploys with more than one replica, or genuinely high concurrent load across many rooms). If you're running one process, stop reading here — you already have everything you need.

---

## What's actually implemented

`server/scaling.js`, wired in from `server/index.js` right after the Socket.IO server is created:

1. **Socket.IO clients** — via the official [`@socket.io/redis-adapter`](https://www.npmjs.com/package/@socket.io/redis-adapter). Once attached (`io.adapter(...)`), the existing `io.to(roomCode).emit(...)` call in `room.js`'s `broadcastToRoom()` transparently reaches Socket.IO clients connected to *any* instance — the adapter publishes the emit over Redis, and every instance's Socket.IO server re-emits to its own locally-joined sockets. No handler code had to change for this path.
2. **Plain-`ws` clients** — not covered by the Socket.IO adapter, since they never join a Socket.IO room. `scaling.js` runs its own minimal pub/sub relay on a dedicated Redis channel: `broadcastToRoom()` delivers to its own instance's local plain-ws clients as before, then (only when Redis is configured) publishes the same event once more; every instance subscribes and delivers to whichever local plain-ws clients it's holding for that room, skipping its own publish so nothing gets delivered twice.

Neither path makes Redis the source of truth for anything. Room state (characters, chat history, decks, timers) still lives in memory per-instance exactly as it does today, and durable persistence still goes through `server/storage.js` (SQLite/PostgreSQL/MySQL) — Redis here is purely a broadcast bus between instances.

## What's required to actually run more than one instance

Redis alone is not sufficient — a client's WebSocket connection is a stateful, long-lived TCP connection to *one specific instance*. This module relays broadcast traffic between instances; it does not migrate a connection or share in-memory room membership.

1. **Sticky sessions at the load balancer.** Every client must be pinned to the same backend instance for the life of its connection — e.g. nginx `ip_hash`, HAProxy's `balance source`, or a cookie-based sticky policy on a cloud load balancer. Without this, a client's reconnect could land on a different instance than their in-flight session expects.
2. **A shared database**, not per-instance SQLite files. If you're running multiple instances, point `DATABASE_TYPE`/`DATABASE_URL` at a real PostgreSQL or MySQL server both instances can reach — SQLite is a single local file and won't be shared correctly across processes/hosts. See `INSTALL.md`.
3. **A reachable Redis instance** both server processes can connect to (see below).

## Configuration

| Variable | Description | Default |
|---|---|---|
| `REDIS_URL` | Redis connection string, e.g. `redis://redis:6379`. Unset = scaling disabled entirely (default). | unset |

That's the only new variable. Nothing else changes about how the server is configured or deployed for the single-instance case.

## Local / docker-compose

`docker-compose.yml` includes an optional `redis` service behind the `scaling` profile — it does not start with a plain `docker compose up`:

```bash
docker compose --profile scaling up -d
# then set REDIS_URL=redis://redis:6379 in .env and restart the server service
```

This is provided for convenience when testing the scaling path locally. It does **not** set up a load balancer or multiple `server` replicas for you — that part is deployment-specific (e.g. `docker compose up -d --scale server=3` plus your own reverse proxy with sticky sessions, or a Kubernetes Deployment + Service + Ingress with session affinity).

## Dependencies

`ioredis` and `@socket.io/redis-adapter` are listed in `package.json`'s `optionalDependencies`, so they install automatically with a normal `npm install`/`npm ci` (including the Docker image build) — no separate install step. If `REDIS_URL` is set but those packages somehow aren't resolvable (e.g. an environment that explicitly strips optional deps), the server logs a clear error explaining why and falls back to single-instance behavior rather than crashing.

## What this does *not* do

- **Does not shard rooms across instances.** Every instance can still serve any room; the relay just makes sure clients on different instances see the same traffic for a room they're both in.
- **Does not provide Redis high availability itself.** If you need that, run Redis Sentinel/Cluster and point `REDIS_URL` at it the same way you would for any other Redis-backed service — nothing here is specific to a single-node Redis.
- **Does not cache API responses or campaign data.** There is no `ENABLE_CACHING`-style feature in this codebase; earlier drafts of `DESIGN.md` described one, and it never got built. Redis's only job here is broadcast relay.

## Tests

`tests/scaling.test.js` covers the no-op path (no `REDIS_URL`) and the graceful-fallback path (`REDIS_URL` set but the optional packages unavailable). There's no automated multi-instance/multi-Redis integration test in this repo yet — verifying real cross-instance delivery requires an actual Redis instance and two running server processes, which is closer to a deployment smoke test than a unit test. If you stand up a scaling deployment, a quick manual check is: connect a plain-ws client to instance A and a Socket.IO client to instance B, join the same room on both, and confirm a chat message from one reaches the other.
