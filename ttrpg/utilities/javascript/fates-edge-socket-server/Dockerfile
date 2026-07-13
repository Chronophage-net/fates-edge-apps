# Multi-stage build for optional PDF conversion tools
FROM node:18-alpine AS builder

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

# Create a directory for persistent data (rooms, etc.)
RUN mkdir -p /app/data

# Expose the server port
EXPOSE 3000

# Use a volume for data persistence (room state, chat history)
VOLUME ["/app/data"]

# Set the environment variable to enable upload at runtime
# (can be overridden with -e ENABLE_UPLOAD=true)
ENV ENABLE_UPLOAD=${ENABLE_UPLOAD}

# Start the server
CMD ["node", "server.js"]