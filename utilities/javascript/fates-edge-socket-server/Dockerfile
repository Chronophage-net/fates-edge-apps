# Use modern Node
FROM node:24-alpine AS builder

# Build argument: enable upload features
ARG ENABLE_UPLOAD=false

WORKDIR /app

# ---------------------------------------------------------------
# Install Node dependencies
# ---------------------------------------------------------------
COPY package*.json ./
RUN npm ci --only=production

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
COPY data/ ./data/

# ---------------------------------------------------------------
# Python CLI Tool
# ---------------------------------------------------------------
RUN apk add --no-cache python3 py3-pip python3-dev

COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

COPY fates-edge-cli.py /usr/local/bin/fates-edge-cli
RUN chmod +x /usr/local/bin/fates-edge-cli

# ---------------------------------------------------------------
# Modules
# ---------------------------------------------------------------
COPY modules/ ./modules/

# Ensure directories exist
RUN mkdir -p /app/logs /app/modules

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
# ---------------------------------------------------------------
ENTRYPOINT ["/usr/local/bin/fates-edge-cli"]
CMD ["server", "start"]