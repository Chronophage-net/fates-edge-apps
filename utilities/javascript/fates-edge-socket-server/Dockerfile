# Multi-stage build for optional PDF conversion tools
FROM node:20-alpine AS builder

# Build argument: set to 'true' to include PDF conversion tools
ARG ENABLE_UPLOAD=false

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# If upload is enabled, install system packages and optional Node dependencies
RUN if [ "$ENABLE_UPLOAD" = "true" ]; then \
        apk add --no-cache \
            pdf2htmlEX \
            poppler-utils \
            && npm install multer --save-optional; \
    fi

# Copy the server code
COPY server.js ./
COPY server-start.js ./

# ============================================================
# CLI Tool Layer
# ============================================================

# Install Python for CLI tool
RUN apk add --no-cache python3 py3-pip python3-dev

# Copy CLI requirements and install Python dependencies
COPY requirements-cli.txt ./
RUN pip3 install --no-cache-dir -r requirements-cli.txt

# Copy CLI tool and make it executable
COPY fates-edge-cli.py /usr/local/bin/fates-edge-cli
RUN chmod +x /usr/local/bin/fates-edge-cli

# Copy module directory if exists
COPY modules/ ./modules/

# Create directories for data, logs, and modules
RUN mkdir -p /app/data /app/logs /app/modules

# ============================================================
# Health Check
# ============================================================

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# ============================================================
# Expose Ports
# ============================================================

# WebSocket/HTTP server port
EXPOSE 3000

# ============================================================
# Volumes
# ============================================================

VOLUME ["/app/data", "/app/logs", "/app/modules"]

# ============================================================
# Environment Variables
# ============================================================

# Server configuration
ENV PORT=3000
ENV ENABLE_UPLOAD=${ENABLE_UPLOAD}
ENV AUTO_CREATE_ROOMS=false
ENV ENABLE_RATE_LIMITING=true
ENV ENABLE_CACHING=false
ENV ENABLE_SESSIONS=true
ENV NODE_ENV=production

# CLI configuration
ENV FATES_EDGE_SERVER_URL=http://localhost:3000

# ============================================================
# Entry Point & Command
# ============================================================

# Entry point provides CLI access
ENTRYPOINT ["/usr/local/bin/fates-edge-cli"]

# Default command: start the server
CMD ["server", "start"]
