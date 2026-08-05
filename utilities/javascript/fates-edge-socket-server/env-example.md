# ─── Server Configuration ──────────────────────────────────────
NODE_ENV=development
PORT=10000
WS_PORT=10000                      # WebSocket runs on same port by default

# ─── API Security ──────────────────────────────────────────────
API_KEY=your-secret-key-here        # Required for API authentication

# ─── Deck & History ────────────────────────────────────────────
MAX_DECK_HISTORY=100                # Number of deck draws to keep in history

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
