#!/usr/bin/env bash
# Mac ARM → 构建 linux/amd64（飞牛 x86 NAS）并推送到阿里云镜像仓库。
# 用法：先在 Docker Desktop 启动 Docker，并已 docker login registry.cn-shenzhen.aliyuncs.com
set -euo pipefail

REGISTRY="${ALIYUN_REGISTRY:-registry.cn-shenzhen.aliyuncs.com/sliwei/embyx-local}"
TAG="${1:-latest}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Docker Hub 经 dockerproxy 等代理若 500，用 DaoCloud 拉 library 镜像（与官方 node 同步）
BASE_IMAGE="${DOCKER_BASE_IMAGE:-docker.m.daocloud.io/library/node:20-bookworm-slim}"

echo "Building & pushing ${REGISTRY}:${TAG} (platform linux/amd64, BASE_IMAGE=${BASE_IMAGE}) ..."
docker buildx build \
  --platform linux/amd64 \
  --build-arg "BASE_IMAGE=${BASE_IMAGE}" \
  -t "${REGISTRY}:${TAG}" \
  --push \
  "${ROOT}"

echo "Done: ${REGISTRY}:${TAG}"
