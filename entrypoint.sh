#!/bin/sh
set -e

# 默认参数
APP_PORT=${APP_PORT:-8090}

echo "Current Configuration:"
echo " - Port:     $APP_PORT"

# 动态修改 Nginx 监听端口
sed -i "s/listen 80;/listen ${APP_PORT};/g" /etc/nginx/conf.d/default.conf

# 清理 web 根目录
rm -rf /usr/share/nginx/html/*

# 部署中文版（已无英文镜像资源）
echo "Deploying Chinese version..."
cp -rf /app/dist/zh/* /usr/share/nginx/html/

# 启动 nginx
exec nginx -g "daemon off;"
