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
