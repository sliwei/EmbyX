'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function openDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mount_path TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      library_id INTEGER NOT NULL,
      rel_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      mtime_ms INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      cover_ready INTEGER NOT NULL DEFAULT 0,
      indexed_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (library_id) REFERENCES libraries(id),
      UNIQUE (library_id, rel_path)
    );

    CREATE INDEX IF NOT EXISTS idx_files_lib_mtime ON files(library_id, mtime_ms DESC);
    CREATE INDEX IF NOT EXISTS idx_files_lib_id ON files(library_id, id);

    CREATE TABLE IF NOT EXISTS playback (
      file_id INTEGER PRIMARY KEY,
      position_ms INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (file_id) REFERENCES files(id)
    );

    CREATE INDEX IF NOT EXISTS idx_playback_updated ON playback(updated_at DESC);
  `);
  return db;
}

module.exports = { openDb };
