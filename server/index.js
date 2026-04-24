'use strict';

const fs = require('fs');
const path = require('path');
const fastify = require('fastify');
const cors = require('@fastify/cors');
const fastifyStatic = require('@fastify/static');

const { openDb } = require('./lib/db');

/** 简易并发队列（替代 p-queue，避免 CJS/ESM 互操作导致 “not a constructor”） */
function createConcurrencyQueue(concurrency) {
  const c = Math.max(1, concurrency);
  let active = 0;
  const q = [];
  const pump = () => {
    while (active < c && q.length > 0) {
      const job = q.shift();
      active++;
      Promise.resolve()
        .then(job.run)
        .then(job.resolve, job.reject)
        .finally(() => {
          active--;
          pump();
        });
    }
  };
  return {
    add(fn) {
      return new Promise((resolve, reject) => {
        q.push({ run: fn, resolve, reject });
        pump();
      });
    },
  };
}
const { syncLibrariesFromEnv, syncLibrary } = require('./lib/scanner');
const { generateCover, ensureDir } = require('./lib/covers');

const PORT = parseInt(process.env.PORT || '8090', 10);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db');
const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, 'data', 'cache');
const MEDIA_ROOTS = (process.env.MEDIA_ROOTS || '/media')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const FFMPEG_CONCURRENCY = Math.max(1, parseInt(process.env.FFMPEG_CONCURRENCY || '3', 10));
const SCAN_INTERVAL_MS = Math.max(10000, parseInt(process.env.SCAN_INTERVAL_MS || String(10 * 60 * 1000), 10));
/** 后台封面：定时扫描未生成项并入队（不依赖浏览器访问封面 URL） */
const COVER_POLL_MS = Math.max(3000, parseInt(process.env.COVER_POLL_MS || '5000', 10));
const COVER_BATCH = Math.max(1, parseInt(process.env.COVER_BATCH || '80', 10));
const API_KEY = process.env.API_KEY || '';
const ALLOW_DELETE = process.env.ALLOW_DELETE !== '0';

const PLAY_END_GAP_MS = 5000;

const db = openDb(DB_PATH);
ensureDir(CACHE_DIR);

function authHook(req, reply, done) {
  if (!API_KEY) return done();
  const k = req.headers['x-api-key'];
  if (k !== API_KEY) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}

function titleFromRel(relPath) {
  const base = path.basename(relPath);
  return base.replace(/\.mp4$/i, '');
}

function rowToDto(row, playback) {
  const durationMs = row.duration_ms || playback?.duration_ms || 0;
  let positionMs = playback?.position_ms ?? 0;
  if (durationMs > 0 && positionMs >= Math.max(0, durationMs - PLAY_END_GAP_MS)) {
    positionMs = 0;
  }
  return {
    id: row.id,
    library_id: row.library_id,
    name: titleFromRel(row.rel_path),
    rel_path: row.rel_path,
    duration_ms: durationMs,
    mtime_ms: row.mtime_ms,
    size_bytes: row.size_bytes,
    cover_ready: row.cover_ready === 1,
    /** 抽帧失败已放弃，不再后台重试；文件替换后扫描会重置 */
    cover_failed: row.cover_ready === 2,
    position_ms: positionMs,
  };
}

const coverQueue = createConcurrencyQueue(FFMPEG_CONCURRENCY);

/** 避免同一文件被多轮调度重复入队 */
const coverInflight = new Set();

/** spawn ffmpeg 缺失时 ENOENT，避免对每个文件都打一条 warn */
function isMissingFfmpegError(e) {
  return e && e.code === 'ENOENT' && String(e.message || '').includes('ffmpeg');
}

/**
 * 将一批「尚未生成封面」的文件放入后台 ffmpeg 队列；由定时器 + 每次扫盘后调用，直到全部就绪。
 */
function scheduleCoverWork() {
  const rows = db.prepare(`
    SELECT f.id, f.rel_path, l.mount_path FROM files f
    JOIN libraries l ON l.id = f.library_id
    WHERE f.cover_ready = 0
    ORDER BY f.id ASC
    LIMIT ?
  `).all(COVER_BATCH);

  for (const row of rows) {
    if (coverInflight.has(row.id)) continue;
    coverInflight.add(row.id);
    coverQueue
      .add(async () => {
        const abs = path.join(row.mount_path, row.rel_path);
        try {
          if (!fs.existsSync(abs)) return;
          const out = path.join(CACHE_DIR, 'covers', `${row.id}.jpg`);
          await generateCover(abs, out);
          db.prepare(`UPDATE files SET cover_ready = 1 WHERE id = ?`).run(row.id);
        } catch (e) {
          if (isMissingFfmpegError(e)) return;
          db.prepare(`UPDATE files SET cover_ready = 2 WHERE id = ?`).run(row.id);
          console.warn('cover skipped', row.id, String(e.message || '').slice(-280));
        } finally {
          coverInflight.delete(row.id);
        }
      })
      .catch(() => {
        coverInflight.delete(row.id);
      });
  }
}

setInterval(scheduleCoverWork, COVER_POLL_MS);

function runFullScan() {
  const libs = db.prepare(`SELECT id, mount_path FROM libraries`).all();
  for (const lib of libs) {
    if (!fs.existsSync(lib.mount_path)) continue;
    try {
      syncLibrary(db, lib.id, lib.mount_path);
    } catch (e) {
      console.error('scan failed', lib.mount_path, e);
    }
  }
  scheduleCoverWork();
}

function bootstrapLibraries() {
  const valid = syncLibrariesFromEnv(db, MEDIA_ROOTS);
  if (valid.length === 0) {
    console.warn('[embyx-local] MEDIA_ROOTS 无有效路径，请挂载卷并设置 MEDIA_ROOTS');
  }
  runFullScan();
}

bootstrapLibraries();
setInterval(runFullScan, SCAN_INTERVAL_MS);

async function buildServer() {
  const app = fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.addHook('onRequest', (req, reply, done) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/media') || req.url.startsWith('/covers')) {
      return authHook(req, reply, done);
    }
    done();
  });

  app.get('/api/health', async () => ({
    ok: true,
    media_roots: MEDIA_ROOTS,
    db: DB_PATH,
  }));

  app.get('/api/libraries', async () => {
    const rows = db.prepare(`SELECT id, display_name AS name, mount_path FROM libraries ORDER BY sort_order, id`).all();
    return { libraries: rows.map((r) => ({ id: String(r.id), name: r.name, mount_path: r.mount_path })) };
  });

  app.get('/api/items', async (req) => {
    const libraryId = req.query.library_id ? parseInt(String(req.query.library_id), 10) : null;
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '99'), 10) || 99));
    const afterId = req.query.after_id ? parseInt(String(req.query.after_id), 10) : null;
    const randomMode = req.query.random === '1' || req.query.random === 'true';
    const idsParam = req.query.ids ? String(req.query.ids) : '';

    const pbJoin = `
      LEFT JOIN playback p ON p.file_id = f.id
    `;

    if (idsParam) {
      const ids = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
      if (!ids.length) return { items: [], next_after_id: null, total: 0 };
      const placeholders = ids.map(() => '?').join(',');
      const orderKey = ',' + ids.join(',') + ',';
      const rows = db.prepare(`
        SELECT f.* FROM files f ${pbJoin}
        WHERE f.id IN (${placeholders})
        ORDER BY instr(?, ',' || f.id || ',')
      `).all(...ids, orderKey);
      const playbackMap = loadPlaybackForRows(rows);
      const items = rows.map((r) => rowToDto(r, playbackMap.get(r.id)));
      return { items, next_after_id: null, total: items.length };
    }

    let rows;
    let total;

    const notCompletedClause = `
      NOT (
        COALESCE(p.duration_ms, f.duration_ms, 0) > 0
        AND COALESCE(p.position_ms, 0) >= COALESCE(p.duration_ms, f.duration_ms, 0) - ${PLAY_END_GAP_MS}
      )
    `;

    if (randomMode && libraryId) {
      total = db.prepare(`SELECT COUNT(*) AS c FROM files WHERE library_id = ?`).get(libraryId).c;
      const candidates = db.prepare(`
        SELECT f.id FROM files f
        LEFT JOIN playback p ON p.file_id = f.id
        WHERE f.library_id = ?
        AND (${notCompletedClause})
        ORDER BY f.id DESC
        LIMIT 500
      `).all(libraryId).map((r) => r.id);

      let pool = candidates;
      if (pool.length < Math.min(limit, total) && total > 0) {
        pool = db.prepare(`SELECT id FROM files WHERE library_id = ? ORDER BY RANDOM() LIMIT 500`).all(libraryId).map((r) => r.id);
      }
      const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, limit);
      if (!shuffled.length) {
        return { items: [], next_after_id: null, total };
      }
      const placeholders = shuffled.map(() => '?').join(',');
      rows = db.prepare(`
        SELECT f.* FROM files f ${pbJoin}
        WHERE f.id IN (${placeholders})
      `).all(...shuffled);
      const orderMap = new Map(shuffled.map((id, i) => [id, i]));
      rows.sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id));
    } else if (randomMode && !libraryId) {
      total = db.prepare(`SELECT COUNT(*) AS c FROM files`).get().c;
      const candidates = db.prepare(`
        SELECT f.id FROM files f
        LEFT JOIN playback p ON p.file_id = f.id
        WHERE (${notCompletedClause})
        ORDER BY f.id DESC
        LIMIT 500
      `).all().map((r) => r.id);

      let pool = candidates;
      if (pool.length < Math.min(limit, total) && total > 0) {
        pool = db.prepare(`SELECT id FROM files ORDER BY RANDOM() LIMIT 500`).all().map((r) => r.id);
      }
      const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, limit);
      if (!shuffled.length) {
        return { items: [], next_after_id: null, total };
      }
      const placeholders = shuffled.map(() => '?').join(',');
      rows = db.prepare(`
        SELECT f.* FROM files f ${pbJoin}
        WHERE f.id IN (${placeholders})
      `).all(...shuffled);
      const orderMap = new Map(shuffled.map((id, i) => [id, i]));
      rows.sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id));
    } else if (libraryId) {
      total = db.prepare(`SELECT COUNT(*) AS c FROM files WHERE library_id = ?`).get(libraryId).c;
      if (afterId) {
        rows = db.prepare(`
          SELECT f.* FROM files f ${pbJoin}
          WHERE f.library_id = ? AND f.id > ?
          ORDER BY f.id ASC
          LIMIT ?
        `).all(libraryId, afterId, limit);
      } else {
        rows = db.prepare(`
          SELECT f.* FROM files f ${pbJoin}
          WHERE f.library_id = ?
          ORDER BY f.id ASC
          LIMIT ?
        `).all(libraryId, limit);
      }
    } else {
      total = db.prepare(`SELECT COUNT(*) AS c FROM files`).get().c;
      const q = afterId
        ? db.prepare(`
            SELECT f.* FROM files f ${pbJoin}
            WHERE f.id > ?
            ORDER BY f.id ASC
            LIMIT ?
          `)
        : db.prepare(`
            SELECT f.* FROM files f ${pbJoin}
            ORDER BY f.id ASC
            LIMIT ?
          `);
      rows = afterId ? q.all(afterId, limit) : q.all(limit);
    }

    const playbackMap = loadPlaybackForRows(rows);
    const items = rows.map((r) => rowToDto(r, playbackMap.get(r.id)));
    const nextAfter = rows.length ? rows[rows.length - 1].id : null;
    return { items, next_after_id: nextAfter, total };
  });

  function loadPlaybackForRows(rows) {
    const map = new Map();
    if (!rows.length) return map;
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const pb = db.prepare(`SELECT * FROM playback WHERE file_id IN (${placeholders})`).all(...ids);
    for (const p of pb) map.set(p.file_id, p);
    return map;
  }

  app.get('/api/feed/next', async (req, reply) => {
    const libraryId = req.query.library_id ? parseInt(String(req.query.library_id), 10) : null;
    if (!libraryId) return reply.code(400).send({ error: 'library_id required' });

    const nc = `
      NOT (
        COALESCE(p.duration_ms, f.duration_ms, 0) > 0
        AND COALESCE(p.position_ms, 0) >= COALESCE(p.duration_ms, f.duration_ms, 0) - ${PLAY_END_GAP_MS}
      )
    `;

    let candidates = db.prepare(`
      SELECT f.id FROM files f
      LEFT JOIN playback p ON p.file_id = f.id
      WHERE f.library_id = ?
      AND (${nc})
      ORDER BY f.id DESC
      LIMIT 500
    `).all(libraryId).map((r) => r.id);

    if (!candidates.length) {
      candidates = db.prepare(`
        SELECT id FROM files WHERE library_id = ? ORDER BY RANDOM() LIMIT 500
      `).all(libraryId).map((r) => r.id);
    }
    if (!candidates.length) return { item: null };

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const row = db.prepare(`SELECT f.* FROM files f WHERE f.id = ?`).get(pick);
    const pb = db.prepare(`SELECT * FROM playback WHERE file_id = ?`).get(pick);
    return { item: rowToDto(row, pb) };
  });

  app.get('/api/items/:id/detail', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const row = db.prepare(`
      SELECT f.*, l.mount_path FROM files f
      JOIN libraries l ON l.id = f.library_id WHERE f.id = ?
    `).get(id);
    if (!row) return reply.code(404).send({ error: 'Not found' });
    const abs = path.join(row.mount_path, row.rel_path);
    let codec = '';
    try {
      const { execFileSync } = require('child_process');
      const out = execFileSync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name,width,height,avg_frame_rate',
        '-of', 'csv=p=0',
        abs,
      ], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
      codec = out.trim();
    } catch {
      codec = '';
    }
    return {
      id: row.id,
      container: 'mp4',
      size_bytes: row.size_bytes,
      codec_hint: codec,
      duration_ms: row.duration_ms || 0,
      rel_path: row.rel_path,
    };
  });

  app.post('/api/playback', async (req, reply) => {
    const body = req.body || {};
    const fileId = parseInt(body.file_id, 10);
    const positionMs = Math.max(0, parseInt(body.position_ms, 10) || 0);
    const durationMs = parseInt(body.duration_ms, 10);
    if (!fileId) return reply.code(400).send({ error: 'file_id required' });

    const exists = db.prepare(`SELECT id FROM files WHERE id = ?`).get(fileId);
    if (!exists) return reply.code(404).send({ error: 'file not found' });

    db.prepare(`
      INSERT INTO playback (file_id, position_ms, duration_ms, updated_at)
      VALUES (@file_id, @position_ms, @duration_ms, @updated_at)
      ON CONFLICT(file_id) DO UPDATE SET
        position_ms = excluded.position_ms,
        duration_ms = COALESCE(excluded.duration_ms, playback.duration_ms),
        updated_at = excluded.updated_at
    `).run({
      file_id: fileId,
      position_ms: positionMs,
      duration_ms: Number.isFinite(durationMs) ? durationMs : null,
      updated_at: Date.now(),
    });

    return { ok: true };
  });

  app.delete('/api/items/:id', async (req, reply) => {
    if (!ALLOW_DELETE) return reply.code(403).send({ error: 'delete disabled' });
    const id = parseInt(req.params.id, 10);
    const row = db.prepare(`
      SELECT f.*, l.mount_path FROM files f
      JOIN libraries l ON l.id = f.library_id WHERE f.id = ?
    `).get(id);
    if (!row) return reply.code(404).send({ error: 'Not found' });
    const abs = path.join(row.mount_path, row.rel_path);
    try {
      fs.unlinkSync(abs);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    db.prepare(`DELETE FROM playback WHERE file_id = ?`).run(id);
    db.prepare(`DELETE FROM files WHERE id = ?`).run(id);
    for (const ext of ['jpg', 'webp']) {
      const cover = path.join(CACHE_DIR, 'covers', `${id}.${ext}`);
      if (fs.existsSync(cover)) fs.unlinkSync(cover);
    }
    return { ok: true };
  });

  app.get('/media/:id/stream', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const row = db.prepare(`
      SELECT f.id, f.rel_path, l.mount_path FROM files f
      JOIN libraries l ON l.id = f.library_id WHERE f.id = ?
    `).get(id);
    if (!row) return reply.code(404).send('Not found');
    const abs = path.join(row.mount_path, row.rel_path);
    if (!fs.existsSync(abs)) return reply.code(404).send('Missing file');

    const stat = fs.statSync(abs);
    const size = stat.size;
    const range = req.headers.range;
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Content-Type', 'video/mp4');

    if (!range) {
      reply.header('Content-Length', size);
      return reply.send(fs.createReadStream(abs));
    }

    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) return reply.code(416).send();
    let start = m[1] !== '' ? parseInt(m[1], 10) : 0;
    let end = m[2] !== '' ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start >= size) {
      return reply.code(416).header('Content-Range', `bytes */${size}`).send();
    }
    end = Math.min(end, size - 1);
    const chunk = end - start + 1;
    reply.code(206);
    reply.header('Content-Range', `bytes ${start}-${end}/${size}`);
    reply.header('Content-Length', chunk);
    return reply.send(fs.createReadStream(abs, { start, end }));
  });

  const sendCoverOrPlaceholder = (reply, id) => {
    const jpg = path.join(CACHE_DIR, 'covers', `${id}.jpg`);
    if (fs.existsSync(jpg)) {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.type('image/jpeg');
      return reply.send(fs.createReadStream(jpg));
    }
    const legacyWebp = path.join(CACHE_DIR, 'covers', `${id}.webp`);
    if (fs.existsSync(legacyWebp)) {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.type('image/webp');
      return reply.send(fs.createReadStream(legacyWebp));
    }
    const roots = [path.join(__dirname, 'web-public', 'poster.webp')];
    for (const placeholder of roots) {
      if (fs.existsSync(placeholder)) {
        reply.type('image/webp');
        return reply.send(fs.createReadStream(placeholder));
      }
    }
    return reply.code(404).send('No cover');
  };

  app.get('/covers/:id.jpg', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    return sendCoverOrPlaceholder(reply, id);
  });

  /** 兼容旧链接；新封面均为磁盘上的 .jpg */
  app.get('/covers/:id.webp', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    return sendCoverOrPlaceholder(reply, id);
  });

  /**
   * SERVE_STATIC=0：仅 API。否则尝试 WEB_STATIC_DIR / web-public / 开发目录 web/dist。
   */
  const serveStatic =
    process.env.SERVE_STATIC !== '0' && String(process.env.SERVE_STATIC).toLowerCase() !== 'false';

  if (!serveStatic) {
    app.log.info('SERVE_STATIC 已关闭，仅提供 API（前端单独部署）');
  } else {
    const staticCandidates = [
      process.env.WEB_STATIC_DIR,
      path.join(__dirname, 'web-public'),
      path.join(__dirname, '..', 'web', 'dist'),
    ].filter(Boolean);

    const staticRoot = staticCandidates.find((p) => fs.existsSync(p));
    const isWebBundle =
      staticRoot &&
      (staticRoot === process.env.WEB_STATIC_DIR ||
        staticRoot.endsWith(`${path.sep}web-public`) ||
        staticRoot.endsWith(`${path.sep}dist`));

    if (staticRoot) {
      await app.register(fastifyStatic, {
        root: staticRoot,
        prefix: '/',
        decorateReply: false,
      });
      app.log.info({ staticRoot, bundle: isWebBundle ? 'web' : 'custom' }, 'static root');
      if (!isWebBundle) {
        app.log.warn('静态根目录不是标准 web 产物，请确认 WEB_STATIC_DIR 指向含 index.html 的目录');
      }
      const indexHtml = path.join(staticRoot, 'index.html');
      if (fs.existsSync(indexHtml)) {
        const looksLikeStaticAsset = /\.(js|mjs|cjs|css|map|json|ico|png|jpe?g|gif|webp|svg|avif|woff2?|ttf|eot|txt|xml|webmanifest)$/i;
        app.setNotFoundHandler((request, reply) => {
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            reply.code(404);
            return reply.send({ error: 'Not Found' });
          }
          const p = String(request.url || '').split('?')[0] || '/';
          if (p.startsWith('/api/') || p.startsWith('/media/') || p.startsWith('/covers/')) {
            reply.code(404);
            return reply.send({ error: 'Not Found' });
          }
          if (looksLikeStaticAsset.test(p)) {
            reply.code(404);
            return reply.send('Not Found');
          }
          reply.type('text/html; charset=utf-8');
          return reply.send(fs.createReadStream(indexHtml));
        });
      }
    } else {
      app.log.warn(
        'SERVE_STATIC 已开启但未找到静态目录（web/dist 等）。请 build 前端或设置 WEB_STATIC_DIR；当前仅 API 可用'
      );
    }
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[embyx-local] listening on ${PORT}`);
}

buildServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
