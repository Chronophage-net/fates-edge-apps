# ---------------------------------------------------------------
# Fate's Edge Discord Bot — production image
#
# Outbound Discord gateway connection + outbound WebSocket client to
# the socket server, plus an optional local Express webhook listener
# (WEBHOOK_PORT). No required inbound port.
# ---------------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

# Only meaningful if WEBHOOK_PORT is set/used; harmless otherwise.
EXPOSE 3001

CMD ["node", "index.js"]
