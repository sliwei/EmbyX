# EmbyX 本地媒体模式：Node + Fastify + 静态 zh/
#
# 若 docker.io / Docker Desktop 镜像代理（如 dockerproxy.net）返回 500，构建时换拉取源，例如：
#   docker build --build-arg BASE_IMAGE=docker.m.daocloud.io/library/node:20-bookworm-slim ...
# 海外直连 Docker Hub 可保持默认 node:20-bookworm-slim。
ARG BASE_IMAGE=node:20-bookworm-slim
FROM ${BASE_IMAGE}

# 默认使用阿里云 Debian 源，避免国内访问 deb.debian.org 超时（终端日志中的 apt 失败）。
# 海外构建可：docker build --build-arg APT_MIRROR_DEBIAN=http://deb.debian.org/debian --build-arg APT_MIRROR_SECURITY=http://security.debian.org/debian-security .
ARG APT_MIRROR_DEBIAN=http://mirrors.aliyun.com/debian
ARG APT_MIRROR_SECURITY=http://mirrors.aliyun.com/debian-security

RUN set -eux; \
  printf '%s\n' 'Acquire::Retries "5";' 'Acquire::http::Timeout "120";' > /etc/apt/apt.conf.d/80-acquire; \
  if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
    sed -i "s|http://deb.debian.org/debian|${APT_MIRROR_DEBIAN}|g" /etc/apt/sources.list.d/debian.sources; \
    sed -i "s|https://deb.debian.org/debian|${APT_MIRROR_DEBIAN}|g" /etc/apt/sources.list.d/debian.sources; \
    sed -i "s|http://security.debian.org/debian-security|${APT_MIRROR_SECURITY}|g" /etc/apt/sources.list.d/debian.sources; \
    sed -i "s|https://security.debian.org/debian-security|${APT_MIRROR_SECURITY}|g" /etc/apt/sources.list.d/debian.sources; \
  fi; \
  if [ -f /etc/apt/sources.list ]; then \
    sed -i "s|http://deb.debian.org/debian|${APT_MIRROR_DEBIAN}|g" /etc/apt/sources.list; \
    sed -i "s|http://security.debian.org/debian-security|${APT_MIRROR_SECURITY}|g" /etc/apt/sources.list; \
  fi; \
  apt-get update; \
  apt-get install -y --no-install-recommends ffmpeg python3 make g++ ca-certificates; \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package.json ./
RUN npm install --omit=dev

COPY server/ ./
COPY zh/ ./zh-public/

ENV NODE_ENV=production
ENV PORT=8090
ENV MEDIA_ROOTS=/media
ENV DB_PATH=/data/app.db
ENV CACHE_DIR=/data/cache
ENV FFMPEG_CONCURRENCY=3
ENV SCAN_INTERVAL_MS=600000

EXPOSE 8090

CMD ["node", "index.js"]
