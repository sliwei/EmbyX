'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

let ffmpegMissingLogged = false;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (c) => { err += c.toString(); });
    // 未安装 ffmpeg 时 spawn 会异步抛出 ENOENT；若无 listener 会导致进程崩溃
    p.on('error', (e) => {
      if (e.code === 'ENOENT' && !ffmpegMissingLogged) {
        ffmpegMissingLogged = true;
        console.warn('[embyx-local] 未检测到 ffmpeg，封面将使用占位图。本地可执行: brew install ffmpeg');
      }
      reject(e);
    });
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-400) || `ffmpeg exit ${code}`));
    });
  });
}

/** 输出 JPEG：不依赖 libwebp（Homebrew 部分 ffmpeg 构建未带 --enable-libwebp） */
async function generateCover(absVideoPath, outPath, width = 480) {
  ensureDir(path.dirname(outPath));
  await runFfmpeg([
    '-nostdin',
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', '00:00:01',
    '-i', absVideoPath,
    '-frames:v', '1',
    '-vf', `scale=${width}:-2`,
    '-q:v', '4',
    '-y',
    outPath,
  ]);
}

module.exports = { generateCover, ensureDir };
