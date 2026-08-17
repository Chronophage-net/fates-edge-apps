# Use modern Node
FROM node:24-alpine AS builder

# Build argument: enable upload features
ARG ENABLE_UPLOAD=false

WORKDIR /app

# ---------------------------------------------------------------
# Install Node dependencies
# ---------------------------------------------------------------
COPY package*.json ./
# --only=production is deprecated/removed in newer npm; --omit=dev is the
# supported equivalent (was causing npm to print its help text and exit
# non-zero on node:24-alpine's bundled npm).
RUN npm ci --omit=dev

# Optional upload tools
RUN if [ "$ENABLE_UPLOAD" = "true" ]; then \
        apk add --no-cache \
            pdf2htmlEX \
            poppler-utils \
            && npm install multer --save-optional; \
    fi

# ---------------------------------------------------------------
# Copy server files
# ---------------------------------------------------------------
COPY server/ ./server/
# FIX: Copy the main server file to the root as server.js
COPY server-start.js ./server.js

# ---------------------------------------------------------------
# Copy data directory
# ---------------------------------------------------------------
#COPY data/ ./data/

# ---------------------------------------------------------------
# Python CLI Tool
# ---------------------------------------------------------------
RUN apk add --no-cache python3 py3-pip python3-dev

COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

COPY fates-edge-cli.py /usr/local/bin/fates-edge-cli
RUN chmod +x /usr/local/bin/fates-edge-cli

# ---------------------------------------------------------------
# Modules
# ---------------------------------------------------------------
COPY modules/ ./modules/

# Ensure directories exist
RUN mkdir -p /app/logs /app/modules /data

# ---------------------------------------------------------------
# Health Check (FIX: use /healthz)
# ---------------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${PORT:-3000}/healthz', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# ---------------------------------------------------------------
# Expose Ports
# ---------------------------------------------------------------
EXPOSE 3000

# ---------------------------------------------------------------
# Volumes
# ---------------------------------------------------------------
VOLUME ["/app/data", "/app/logs", "/app/modules"]

# ---------------------------------------------------------------
# Environment Variables
# ---------------------------------------------------------------
ENV PORT=3000
ENV ENABLE_UPLOAD=${ENABLE_UPLOAD}
ENV AUTO_CREATE_ROOMS=false
ENV ENABLE_RATE_LIMITING=true
ENV ENABLE_CACHING=false
ENV ENABLE_SESSIONS=true
ENV NODE_ENV=production
ENV FATES_EDGE_SERVER_URL=http://localhost:3000

# ---------------------------------------------------------------
# Entry Point & Command
#
# FIX: this used to be `ENTRYPOINT ["fates-edge-cli"]` / `CMD ["server",
# "start"]`. cmd_server_start() in fates-edge-cli.py launches `node
# server.js` as a detached subprocess.Popen(), sleeps 2 seconds to
# confirm it came up, prints a success message, and returns -- at which
# point the Python process (PID 1 in the container) exits. Docker tears
# down a container's whole process tree the moment PID 1 exits, so the
# real server process was being killed ~2 seconds after every
# `docker run`/`docker compose up`, regardless of -d/restart policy.
# The container LOOKED like it started fine (the CLI's own success
# message printed to the logs) right before dying.
#
# Fixed by making the actual long-running server process (`node
# server.js`, the same thing `npm start` runs outside Docker) the
# container's PID 1 directly -- which is also just the correct pattern
# for a Docker container generally: one foreground process, not a
# wrapper script that daemonizes and exits.
#
# `fates-edge-cli` is still installed in the image for interactive admin
# use -- e.g. `docker exec -it <container> fates-edge-cli rooms list` --
# it's just no longer what keeps the container alive.
# ---------------------------------------------------------------
ENTRYPOINT ["node", "server.js"]
