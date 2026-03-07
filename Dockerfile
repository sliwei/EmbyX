# Dockerfile for EmbyX
FROM nginx:alpine

# 设置工作目录存放原始语言包
WORKDIR /app

# 复制中英文版本到镜像内部存放
COPY zh/ /app/dist/zh/
COPY en/ /app/dist/en/

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制并设置启动脚本
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 预设默认语言和端口环境变量
ENV APP_LANG=en
ENV APP_PORT=8090

# EXPOSE 在 host 模式下仅作声明
EXPOSE 8090

# 使用自定义脚本启动
ENTRYPOINT ["/entrypoint.sh"]
