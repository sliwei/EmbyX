# 📱 EmbyX 竖屏播放器 `v1.1`

> 这是一个技术小白借助 Antigravity 和 Emby API 制作的 Web 应用，仿抖音风格浏览、管理 Emby 的短视频。

---

## ✨ 功能特色

- **流式播放**：抖音风格上下滑动，沉浸式全屏体验
- **格子视图**：封面墙浏览，支持分页与随机换一批
- **直接播放**（Direct Play）：安卓 AV1、8K 不转码
- **收藏管理**：一键收藏 / 取消，同步 Emby 数据库
- **键鼠适配**：完整键盘快捷键，电视/电脑浏览器友好
- **PWA 支持**：可安装为桌面/主屏幕应用
- **私有化部署**：数据本地存储，不上传云端

---

## 🔮 播放性能

| 设备 | HEVC 硬解 | AV1 硬解 |
|:---:|:---:|:---:|
| 苹果 | A9 (2015) / M1 | A17 Pro (2023) / M3 |
| 安卓 | 千元机 (2016) | 千元机 (2024) |
| PC | 6～8 代酷睿·核显 | 11 代酷睿·核显 |

---

## ⌨️ 快捷键指南

| 按键 | 功能 |
|:---:|---|
| `W / S / ↑ / ↓` | 上一个 / 下一个视频 |
| `A / D / ← / →` | 快退 / 快进 15 秒 |
| `Space / 单击 OK` | 暂停 / 播放 |
| `U / 双击 OK` | 收藏视频 |
| `J / 菜单键` | 比例切换 |
| `M` | 音量开关 |
| `I` | 个人中心 |
| `E` | 视图切换 |
| `R` | 顺序 / 随机 |
| `F` | 全屏切换 |
| `G` | 选择媒体源 |
| `V` | 流媒体详情 |

---

## 🧩 使用技巧

- **原生全屏**：iOS 系统限制，不支持全屏按钮
- **PWA 应用**：浏览器 📲 添加到主屏幕 / 作为应用安装
- **键鼠适配**：电脑、电视浏览器也能快乐摸鱼
- **媒体库建议**：单个媒体库建议不超过 **1000 个视频**，可建立多个媒体库分层管理

---

## 🛠️ 技术栈

| 层级 | 技术 |
|---|---|
| **结构** | HTML5 语义化标签 |
| **样式** | Tailwind CSS（CDN，JIT 按需） |
| **逻辑** | 原生 JavaScript（无框架） |
| **图标** | Lucide Icons（CDN） |
| **数据** | Emby REST API |
| **离线支持** | Service Worker（PWA） |
| **容器** | Nginx Alpine（Docker 部署时） |

---

## 📁 文件目录

```
embyx/
├── index.html        # 核心文件，包含所有逻辑与样式
├── poster.webp       # 自定义默认封面图（可替换）
├── manifest.json     # PWA 配置文件
├── sw.js             # Service Worker（离线缓存）
├── icon.png          # PWA 图标
├── Dockerfile        # Docker 镜像构建文件
└── docker-compose.yml  # 一键部署配置
```

---

## 🚀 部署方式

### 方式一：直接部署（推荐个人用户）

将以下文件放入任意 Web 服务器（Nginx、Apache、NAS 静态服务等）根目录：

```
index.html
poster.webp
manifest.json
sw.js
icon.png
```

> **尝鲜玩法**：手机可以直接双击 `index.html`（file:// 协议）本地使用，通过 HTTP 访问 Emby。

---

### 方式二：Docker 部署

#### 使用 Docker

```bash
# 拉取最新镜像
docker pull ghcr.io/juneix/embyx:latest

# 运行容器（映射到本机 8080 端口）
docker run -d \
  --name embyx \
  --network host \
  -e APP_LANG=zh \
  -e APP_PORT=8090 \
  --restart unless-stopped \
  ghcr.io/juneix/embyx:latest
```

访问 `http://your-server-ip:8080` 即可使用。

#### 使用 docker-compose（推荐）

```bash
# 下载 docker-compose.yml 后执行
docker compose up -d
```

或者直接复制到群晖、飞牛、Dockge 的 docker-compose 模板：
```bash
services:
  embyx:
    image: ghcr.io/juneix/embyx:latest
    container_name: embyx
    restart: unless-stopped
    network_mode: host
    environment:
      - APP_LANG=zh # zh (中文), en (英文)
      - APP_PORT=8090 # 在 host 模式下，直接定义访问端口
```
---

## 📝 开源协议

MIT License — 随意使用，欢迎 PR 和 Issue。

👨🏻‍💻 作者：[@谢週五](https://juneix.github.io)  
🛜 官网：[谢週五の藏经阁](https://5nav.eu.org)
