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
