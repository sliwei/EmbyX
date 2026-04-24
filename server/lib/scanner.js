'use strict';

const fs = require('fs');
const path = require('path');

function listMp4Recursive(rootAbs, onFile, maxFiles = Infinity) {
  let count = 0;
  const stack = [{ dir: rootAbs, rel: '' }];

  while (stack.length && count < maxFiles) {
    const { dir, rel } = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (count >= maxFiles) break;
      const name = ent.name;
      if (name.startsWith('.')) continue;
      const full = path.join(dir, name);
      const relJoin = rel ? path.join(rel, name) : name;
      if (ent.isDirectory()) {
        stack.push({ dir: full, rel: relJoin });
      } else if (ent.isFile() && name.toLowerCase().endsWith('.mp4')) {
        let st;
        try {
          st = fs.statSync(full);
        } catch {
          continue;
        }
        onFile(relJoin.replace(/\\/g, '/'), st.size, Math.floor(st.mtimeMs));
        count++;
      }
    }
  }
}

function syncLibrary(db, libraryId, mountPath) {
  const upsert = db.prepare(`
    INSERT INTO files (library_id, rel_path, size_bytes, mtime_ms, indexed_at)
    VALUES (@library_id, @rel_path, @size_bytes, @mtime_ms, @indexed_at)
    ON CONFLICT(library_id, rel_path) DO UPDATE SET
      size_bytes = excluded.size_bytes,
      mtime_ms = excluded.mtime_ms,
      indexed_at = excluded.indexed_at,
      cover_ready = CASE
        WHEN files.size_bytes != excluded.size_bytes OR files.mtime_ms != excluded.mtime_ms THEN 0
        ELSE files.cover_ready
      END
  `);

  const existing = db.prepare(`
    SELECT id, rel_path, size_bytes, mtime_ms FROM files WHERE library_id = ?
  `).all(libraryId);
  const seen = new Map(existing.map((r) => [r.rel_path, r]));

  const insertMany = db.transaction(() => {
    listMp4Recursive(mountPath, (relPath, size, mtimeMs) => {
      const prev = seen.get(relPath);
      upsert.run({
        library_id: libraryId,
        rel_path: relPath,
        size_bytes: size,
        mtime_ms: mtimeMs,
        indexed_at: Date.now(),
      });
      seen.delete(relPath);
    });
  });
  insertMany();

  const delRemoved = db.prepare(`DELETE FROM files WHERE library_id = ? AND id = ?`);
  const delPlayback = db.prepare(`DELETE FROM playback WHERE file_id = ?`);
  for (const row of seen.values()) {
    delPlayback.run(row.id);
    delRemoved.run(libraryId, row.id);
  }
}

function syncLibrariesFromEnv(db, mediaRoots) {
  const insertLib = db.prepare(`
    INSERT INTO libraries (mount_path, display_name, sort_order)
    VALUES (?, ?, ?)
    ON CONFLICT(mount_path) DO UPDATE SET display_name = excluded.display_name
  `);

  mediaRoots.forEach((root, i) => {
    const name = path.basename(root) || root;
    insertLib.run(root, name, i);
  });

  const rows = db.prepare(`SELECT id, mount_path FROM libraries ORDER BY sort_order, id`).all();
  return rows.filter((r) => fs.existsSync(r.mount_path));
}

module.exports = {
  syncLibrariesFromEnv,
  syncLibrary,
};
