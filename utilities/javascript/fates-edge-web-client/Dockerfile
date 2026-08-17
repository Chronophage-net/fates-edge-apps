# ---------------------------------------------------------------
# Fate's Edge Web Client — production image
#
# FIX: this file previously contained a copy-pasted GitHub Actions
# workflow YAML instead of Dockerfile syntax (likely an accidental
# paste from an earlier editing session), which broke every docker
# build referencing it (docker-compose.yml, the Makefile, and the
# monorepo's docker-publish.yml workflow). Replaced with a real
# multi-stage build: compile the Vite SPA, then serve the static
# output with nginx using the existing nginx.conf.
# ---------------------------------------------------------------

# ---------------------------------------------------------------
# Stage 1: Build the SPA
# ---------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Optional build-time overrides for the WebSocket/server defaults baked
# into the compiled SPA (see js/features/settings/index.js) -- unset by
# default, which preserves the normal production build pointed at the
# hosted server. docker-compose.full.yml's demo build sets these to point
# a locally-built image at its own local server instead.
ARG VITE_WS_URL=""
ARG VITE_WS_ROOM=""
ARG VITE_SERVER_URL=""
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_WS_ROOM=${VITE_WS_ROOM}
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------
# Stage 2: Serve with nginx
# ---------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
