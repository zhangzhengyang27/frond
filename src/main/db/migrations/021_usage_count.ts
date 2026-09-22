import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 021: 搜索排序自学习升级 — 最近使用 → 频次 × 新近
 *
 * usage_records 加 use_count 列：recordUse 递增，排序自学习的 boost
 * 从「最近排名加权」升级为「频次 × 新近」混合（对标 Raycast 的排序模型）。
 */
export const m021_usage_count: Migration = {
  version: 21,
  name: 'usage_use_count',
  up(db: Database.Database) {
    const cols = db.prepare(`PRAGMA table_info(usage_records)`).all() as Array<{ name: string }>
    if (!cols.some((c) => c.name === 'use_count')) {
      db.exec(`ALTER TABLE usage_records ADD COLUMN use_count INTEGER NOT NULL DEFAULT 1`)
    }
  }
}
