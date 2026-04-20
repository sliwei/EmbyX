# 性能优先 · 本地媒体库版 EmbyX — 开发规格

本文档约束「Docker 部署在飞牛 NAS、浏览器访问、多目录嵌套、仅 MP4」方案的产品行为、性能目标与实现要点。实现时以**性能与可扩展性为第一优先级**。

---

## 1. 目标与原则

| 原则 | 说明 |
|------|------|
| 永不全量加载 | 列表、目录、封面均分页/按需；禁止一次向浏览器返回万级记录。 |
| 索引与扫盘分离 | 元数据来自 **SQLite 索引**；扫盘仅后台增量同步，不阻塞请求路径。 |
| 播放路径短 | 视频流走 **HTTP Range**；列表接口只返回当前页必需字段。 |
| 封面与时长后置 | 封面批量生成走 **队列 + 磁盘缓存**；时长可异步写入库，不在启动时全量 ffprobe。 |

---

## 2. 功能需求（验收口径）

### 2.1 多文件夹与嵌套

- 配置支持多个「媒体根」（例如环境变量或首次配置：`MEDIA_ROOTS=/media/a,/media/b`）。
- **递归**收录所有子目录下的 **`.mp4` 文件**（大小写按约定统一为小写匹配或双写）。
- 逻辑「库」可与物理根一一对应，或「一根多库」由配置拆分（实现阶段二选一写死一种即可）。

### 2.2 仅收录 MP4

- 索引阶段 **仅扩展名为 `.mp4`** 的文件入库；其它格式忽略。
- MIME/魔数校验可作为可选加固（防止误命名），默认以扩展名+存在性为准以保扫盘速度。

### 2.3 播放进度

- 以「**用户维度**」或「**设备/浏览器本地**」区分需产品定案：  
  - **网页版推荐**：进度存 **服务端**（轻量会话或简单 token），表结构 `file_id / position_ms / updated_at`，合并规则为「取最新写入」。  
  - 若单机单用户：**可简化**为同表不区分用户。  
- 再次打开同一条：若 `position_ms < duration_ms - 结束阈值（如 5s）` 则 **从 position 继续**；否则从 0 或标记已完播（与 2.4 联动）。

### 2.4 刷视频优先未播放

- **定义「已播放」**：进度越过起始阈值（如 >3s）或到达结束阈值视为已播。  
- **推荐实现（万级规模）**：  
  - 在库中维护 `play_state`：`unplayed` / `partial` / `completed`（或仅用 `last_position` + `duration` 推导）。  
  - **抽签下一条**时：优先在 `unplayed` 集合中随机或按序取 **一页候选**（如先查 500 条 id），再在其中随机一条，避免全表 `ORDER BY RANDOM()`。  
  - 若未播放耗尽，再回退到「可重复刷」策略（同上，但放宽 `completed`）。

### 2.5 缓存所有视频封面

- **含义**：对每个已索引的 mp4，在磁盘上生成并保存 **固定规格** 的封面图（如宽 480 WebP/JPEG），URL 稳定可缓存。  
- **性能要求**：  
  - 后台 **队列** 生成，**并发上限**（如 2～4 路 ffmpeg）可配置，避免占满 NAS CPU。  
  - 前端只请求封面 URL；**缺失时**返回占位图或 202 异步，由前端重试，不阻塞列表 API。  
- **存储**：例如 `CACHE_DIR/covers/{file_id}.webp`，与数据库 `cover_path` 或「存在即有效」约定一致。

### 2.6 前端播放模式

- **复用当前项目 `zh/index.html` 的交互**：全屏竖滑、手势/键盘、底部导航、清屏等 **UI/交互不退化**；数据来源由 Emby API **替换为自建 REST/WebSocket（首版 REST 即可）**。

### 2.7 后端技术选型（性能优先）

在 **Node.js** 与 **Python** 中选其一：

| 候选 | 适用点 |
|------|--------|
| **Node.js + Fastify** | 高并发短连接、流式 `Range` 转发/直读、`better-sqlite3` 同步查询极快；与前端同栈易维护。 |
| **Python + FastAPI + Uvicorn** | 生态对子进程调用 ffmpeg 成熟；异步路径清晰。 |

**建议默认：Node.js + Fastify + better-sqlite3**（I/O 与并发模型更贴视频服务；SQLite 同步读写在单进程内延迟低）。若团队强 Python，则 **FastAPI**，流式响应用 `FileResponse`/手动 `iterate` Range。

**不推荐**：扫描与 HTTP 共进程时阻塞事件循环——扫盘索引进 **独立 worker 进程** 或通过 **队列** 与 API 进程隔离。

### 2.8 访问方式

- 首版 **仅 HTTPS/HTTP 网页**（同源或反代统一域名）。  
- PWA / Service Worker 可与现有 `sw.js` 对齐，需注意 **API 与静态资源缓存策略分离**。

### 2.9 Docker 部署（飞牛）

- 单镜像或多阶段构建：**前端静态资源 + 后端二进制/Node 运行时**。  
- **卷挂载**：媒体目录只读 `:/media:ro`；**缓存与数据库**挂载到持久卷（如 `:/data`）。  
- 环境变量：`MEDIA_ROOTS`、`CACHE_DIR`、`DB_PATH`、`FFMPEG_CONCURRENCY`、`SCAN_INTERVAL` 等。

---

## 3. 性能指标（建议写入 CI/压测备忘）

- 列表接口：单请求 **p95 < 200ms**（本地索引、无冷扫盘）。  
- 封面：命中磁盘缓存时 **p95 < 50ms**（小图 + Nginx/内置 sendfile）。  
- 并发：不少于 **N 路并发 Range**（N 由 NAS 实测，文档留空填实测值）。  
- 索引：全量首次扫描允许较慢；**增量扫描**单次周期内不影响 API **SLA**。

---

## 4. 数据模型（SQLite 示意）

```text
files(
  id,              -- uuid 或路径 hash，稳定即可
  library_id,      -- 对应某个 MEDIA_ROOT
  rel_path,        -- 相对该根的相对路径，唯一约束 (library_id, rel_path)
  size_bytes,
  mtime_ms,
  duration_ms,     -- 可空，异步补全
  cover_ready,     -- 0/1
  indexed_at
)

playback(
  file_id PK,
  position_ms,
  duration_ms,     -- 快照，便于_completed 判断
  updated_at,
  user_key          -- 可选：匿名 cookie / 固定 token
)

-- 可选：扫盘游标或变更日志
scan_state(library_id, last_full_scan_at, ...)
```

索引：`files(library_id, mtime_ms)`、`playback(updated_at)`；随机未播查询见 2.4 策略。

---

## 5. 模块划分

| 模块 | 职责 |
|------|------|
| Scanner | 递归枚举 mp4、mtime/size 变更 → upsert `files` |
| Cover Worker | 消费队列，`ffmpeg` 抽帧 → 写缓存目录 → `cover_ready=1` |
| Metadata Worker | 可选：异步补 `duration_ms` |
| API | 分页列表、下一刷、进度上报、Range 流媒体、封面静态路径 |
| Frontend | 现有 EmbyX UI，替换数据源与 URL 拼装 |

---

## 6. API 草案（REST）

以下为逻辑划分，路径可微调：

- `GET /api/libraries` — 媒体根列表  
- `GET /api/items?library=&cursor=&limit=` — 分页（游标避免大 offset）  
- `GET /api/feed/next?library=` — 「下一条」优先未播放（服务端实现 2.4）  
- `POST /api/playback` — body: `{ file_id, position_ms, duration_ms }`  
- `GET /media/:id/stream` — **Range** 输出 mp4  
- `GET /covers/:id.webp` — 封面（长期缓存响应头）

鉴权：首版可 **内网无鉴权** 或 **单共享密钥 Header**，飞牛反代再加一层。

---

## 7. 前端改造要点（相对当前仓库）

- 抽象 **MediaProvider**：原 Emby `fetch` 全部收口到可实现「自建后端」的适配层。  
- `getVideoSrc` / 列表分页 / 收藏（若保留）改为本地或服务端状态。  
- 配置页：服务器地址指向 **自建 API 根**；移除 Emby 专用字段。

---

## 8. Docker 要点

```yaml
# 示意（非最终 compose）
services:
  app:
    image: embyx-local:latest
    volumes:
      - /飞牛路径/视频1:/media/v1:ro
      - /飞牛路径/视频2:/media/v2:ro
      - ./data:/data   # sqlite + cover cache
    environment:
      MEDIA_ROOTS: "/media/v1,/media/v2"
      DB_PATH: "/data/app.db"
      CACHE_DIR: "/data/cache"
    ports:
      - "8090:8090"
```

---

## 9. 里程碑建议

1. **M1**：SQLite + 仅 MP4 递归索引 + Range 播放 + 分页列表（无封面）。  
2. **M2**：进度读写 + feed 未播放优先 + 占位封面。  
3. **M3**：封面队列全量缓存 + Nginx/缓存头优化。  
4. **M4**：对接现有 `zh/index.html` 交互 + Docker 飞牛实测压测。

---

## 10. 风险与规避

| 风险 | 规避 |
|------|------|
| 万级文件扫盘拖慢 NAS | 增量扫描 + 低峰定时；限制 ffmpeg 并发 |
| 随机 SQL 慢 | 分层抽样，禁止全表随机排序 |
| 浏览器解码能力 | 仅 mp4 仍可能有编码差异；文档保留「可选转码阶段二」占位 |

---

*文档版本：与性能优先讨论稿对齐；实现以本仓库后续 PR 为准。*
