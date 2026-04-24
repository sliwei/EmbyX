# Node API + Vite 产物 → web-public（GitHub Actions 等默认可直连官方源）
ARG BASE_IMAGE=node:20-bookworm-slim
FROM ${BASE_IMAGE} AS webbuilder
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM ${BASE_IMAGE}
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=webbuilder /web/dist ./web-public

ENV NODE_ENV=production \
  PORT=8090 \
  SERVE_STATIC=1 \
  MEDIA_ROOTS=/media \
  DB_PATH=/data/app.db \
  CACHE_DIR=/data/cache \
  FFMPEG_CONCURRENCY=3 \
  SCAN_INTERVAL_MS=600000

EXPOSE 8090
CMD ["node", "index.js"]
