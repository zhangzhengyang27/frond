/**
 * Leaf · Migration 002 — tag_tags 软删除 + partial unique 索引
 *
 * 背景：
 * - 001_init 的 tag_tags 表无 deleted_at；所有「删除」都是硬删
 * - 后续 TagRepository 实现软删除时发现 schema 漏字段
 * - UNIQUE(name) 没考虑软删除：软删后再同名建会冲突
 *
 * 改动：
 * 1. ALTER TABLE tag_tags ADD COLUMN deleted_at INTEGER（默认 NULL）
 * 2. DROP 旧 UNIQUE INDEX idx_tag_tags_unique_name
 * 3. CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL（部分唯一索引，只约束未删除）
 *
 * 幂等：ADD COLUMN 加 IF NOT EXISTS？不支持 SQLite —— 用 PRAGMA table_info 检查
 */

import type { Migration } from '.'

export const m002_tag_softdelete: Migration = {
  version: 2,
  name: 'tag_tags_softdelete_partial_unique',
  up(db) {
    // 1) 加 deleted_at 列（sqlite ALTER TABLE ADD COLUMN 无 IF NOT EXISTS，需先检查）
    const hasCol = db
      .prepare(`SELECT 1 FROM pragma_table_info('tag_tags') WHERE name = 'deleted_at'`)
      .get()
    if (!hasCol) {
      db.exec(`ALTER TABLE tag_tags ADD COLUMN deleted_at INTEGER`)
    }

    // 2) 重建唯一索引为部分索引（只约束未删除）
    db.exec(`DROP INDEX IF EXISTS idx_tag_tags_unique_name`)
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_tags_unique_name_active
         ON tag_tags(name) WHERE deleted_at IS NULL`
    )
  }
}
