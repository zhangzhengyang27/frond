/**
 * Leaf · Migration 007 — Usage 模块 schema（最近使用 + 收藏）
 *
 * 表设计：
 * - usage_records(module_id, used_at)
 *   - PRIMARY KEY (module_id) — upsert by module_id，最近时间覆盖
 *   - 无 deleted_at（用户不能「删除最近使用」记录，最多清空）
 * - usage_favorites(module_id, created_at)
 *   - PRIMARY KEY (module_id)
 *
 * Hub 拉取：
 * - 最近使用：按 used_at DESC 取前 6 个
 * - 收藏：按 created_at ASC 展示
 */

import type { Migration } from '.'

export const m007_usage_schema: Migration = {
  version: 7,
  name: 'usage_module_schema',
  up(db) {
    // 1) 最近使用
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage_records (
        module_id  TEXT    PRIMARY KEY,
        used_at    INTEGER NOT NULL
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_records_used_at ON usage_records(used_at DESC)`)

    // 2) 收藏
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage_favorites (
        module_id  TEXT    PRIMARY KEY,
        created_at INTEGER NOT NULL
      )
    `)
  }
}
