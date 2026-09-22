/**
 * Leaf · Migration 003 — 5-6a：补 lib_files + 扩 wall_files
 *
 * 新增：
 * - lib_files(id, file_path UNIQUE, file_name, added_at, deleted_at)
 *   用途：LocalFileLibraryStore + MusicDataStore 共享的「路径 K-V」表
 *
 * 扩展（wall_files）：
 * - thumb TEXT, description TEXT, author TEXT, author_url TEXT, src_json TEXT
 *   用途：补齐 WallpaperDataStore 接口用到的列
 *
 * 幂等：所有 ADD COLUMN 走 PRAGMA table_info 检查
 */

import type { Migration } from '.'

export const m003_lib_files_and_wall_meta: Migration = {
  version: 3,
  name: 'lib_files_table_and_wall_files_meta',
  up(db) {
    // 1) 新建 lib_files
    db.exec(`
      CREATE TABLE IF NOT EXISTS lib_files (
        id         TEXT PRIMARY KEY,
        file_path  TEXT    NOT NULL,
        file_name  TEXT    NOT NULL,
        added_at   INTEGER NOT NULL,
        deleted_at INTEGER
      )
    `)
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_lib_files_path_active
         ON lib_files(file_path) WHERE deleted_at IS NULL`
    )
    db.exec(`CREATE INDEX IF NOT EXISTS idx_lib_files_added_desc ON lib_files(added_at DESC)`)

    // 2) 扩 wall_files（按 PRAGMA 检查幂等）
    const wallCols = db.prepare(`PRAGMA table_info(wall_files)`).all() as Array<{
      name: string
    }>
    const wallColNames = new Set(wallCols.map((c) => c.name))
    const alters: Array<string> = []
    if (!wallColNames.has('thumb')) alters.push(`ALTER TABLE wall_files ADD COLUMN thumb TEXT`)
    if (!wallColNames.has('description'))
      alters.push(`ALTER TABLE wall_files ADD COLUMN description TEXT`)
    if (!wallColNames.has('author')) alters.push(`ALTER TABLE wall_files ADD COLUMN author TEXT`)
    if (!wallColNames.has('author_url'))
      alters.push(`ALTER TABLE wall_files ADD COLUMN author_url TEXT`)
    if (!wallColNames.has('src_json'))
      alters.push(`ALTER TABLE wall_files ADD COLUMN src_json TEXT`)
    for (const sql of alters) db.exec(sql)
  }
}
