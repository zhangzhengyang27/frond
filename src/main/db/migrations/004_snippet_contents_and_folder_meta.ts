/**
 * Frond · Migration 004 — Snippet 多内容子表 + Folder 业务列
 *
 * 5-6b 升级：
 * 1. 新建 snip_snippet_contents(snippet_id, label, value, language, position)
 *    用于替代旧 Snippet.contents[] 内嵌字段
 * 2. folder_folders 加列：
 *    - default_language TEXT (默认 'plaintext')
 *    - is_open INTEGER NOT NULL DEFAULT 0
 *    - order_index INTEGER NOT NULL DEFAULT 0
 *
 * 幂等：所有 ADD COLUMN 走 PRAGMA table_info 检查
 */

import type { Migration } from '.'

export const m004_snippet_contents_and_folder_meta: Migration = {
  version: 4,
  name: 'snippet_contents_subtable_and_folder_meta',
  up(db) {
    // 1) snippet contents 子表
    db.exec(`
      CREATE TABLE IF NOT EXISTS snip_snippet_contents (
        id          TEXT PRIMARY KEY,
        snippet_id  TEXT    NOT NULL,
        label       TEXT    NOT NULL,
        value       TEXT    NOT NULL,
        language    TEXT    NOT NULL DEFAULT 'plaintext',
        position    INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (snippet_id) REFERENCES snip_snippets(id) ON DELETE CASCADE
      )
    `)
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_snip_snippet_contents_snippet
         ON snip_snippet_contents(snippet_id, position)`
    )

    // 2) folder_folders 业务列（按 PRAGMA 检查幂等）
    const cols = db.prepare(`PRAGMA table_info(folder_folders)`).all() as Array<{
      name: string
    }>
    const names = new Set(cols.map((c) => c.name))
    const alters: string[] = []
    if (!names.has('default_language')) {
      alters.push(
        `ALTER TABLE folder_folders ADD COLUMN default_language TEXT NOT NULL DEFAULT 'plaintext'`
      )
    }
    if (!names.has('is_open')) {
      alters.push(`ALTER TABLE folder_folders ADD COLUMN is_open INTEGER NOT NULL DEFAULT 0`)
    }
    if (!names.has('order_index')) {
      alters.push(`ALTER TABLE folder_folders ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0`)
    }
    for (const sql of alters) db.exec(sql)
  }
}
