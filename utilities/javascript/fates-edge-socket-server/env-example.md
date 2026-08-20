# ─── Server Configuration ──────────────────────────────────────
NODE_ENV=development
PORT=10000
WS_PORT=10000                      # WebSocket runs on same port by default

# ─── API Security ──────────────────────────────────────────────
API_KEY=your-secret-key-here        # Required for API authentication

# ─── Deck & History ────────────────────────────────────────────
MAX_DECK_HISTORY=100                # Number of deck draws to keep in history
MAX_CHAT_HISTORY=50                 # Rolling chat window sent to newly-joined clients (0 disables)

# ─── Room Settings ─────────────────────────────────────────────
ROOM_PASSWORD=                      # Optional: password for room creation (leave blank for no password)

# ─── Health Check ──────────────────────────────────────────────
HEALTH_ENDPOINT=/healthz           # Endpoint for health checks

# ─── Optional: Allowed API Keys (if you want to validate keys) ─
ALLOWED_API_KEYS=ThisIsATerribleAPIKeyDontUseItAtAll

# ─── Debugging ──────────────────────────────────────────────────
DEBUG=room,api                     # Comma-separated debug namespaces (optional)

# ─── TURN / Voice Chat NAT Traversal ────────────────────────────
# Optional. Without these, voice chat falls back to STUN-only, which
# fails for players behind symmetric NAT / restrictive firewalls.
# Point at a coturn instance (see docker-compose.yml) configured with
# the SAME secret via `use-auth-secret` + `static-auth-secret`.
TURN_SECRET=                       # Shared secret with coturn's static-auth-secret. Leave blank to disable TURN.
TURN_REALM=fates-edge
TURN_URLS=turn:your-domain:3478,turns:your-domain:5349   # Comma-separated
TURN_CREDENTIAL_TTL=86400          # Seconds each minted credential is valid for (default 24h)

# ─── Rate Limiting ───────────────────────────────────────────────
# General per-IP cap on the REST API (stacks with the tighter, route-
# specific limiters already on /api/auth/login and /api/auth/register).
# Set API_RATE_LIMIT_MAX=0 to disable.
API_RATE_LIMIT_WINDOW_MS=60000      # 1 minute
API_RATE_LIMIT_MAX=300
# Per-CONNECTION cap on inbound WebSocket messages/events, across both
# transports (plain-ws and Socket.IO). Set WS_MESSAGE_RATE_MAX=0 to
# disable.
WS_MESSAGE_RATE_WINDOW_MS=10000     # 10 seconds
WS_MESSAGE_RATE_MAX=120

# ─── Per-Room Client Cap ─────────────────────────────────────────
# 0 (default) = unlimited. Rejects new joins once a room already holds
# this many clients.
MAX_CLIENTS_PER_ROOM=0

# ─── Multi-Core Scaling (single machine) ─────────────────────────
# 0/unset (default) = single process, unchanged behavior. Set to an
# integer > 1 to fork that many worker processes sharing one port, or
# "auto" to use one worker per CPU core. Requires the optional
# @socket.io/sticky and @socket.io/cluster-adapter packages (ship in
# package.json's optionalDependencies). See SCALING.md's "Multi-core
# scaling (single machine)" section -- a DIFFERENT axis of scaling than
# REDIS_URL below (more CPU cores on one machine, vs. more machines);
# the two can be combined.
CLUSTER_WORKERS=0

# ─── Horizontal Scaling (multiple machines) ──────────────────────
# Unset (default) = single instance, no external dependency. See
# SCALING.md for what's required to actually run more than one instance
# (sticky sessions at the load balancer, a shared database).
REDIS_URL=
