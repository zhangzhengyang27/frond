import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 026: 录制标记添加 color 字段
 *
 * 标记可配色（MarkerService 默认 '#ff4444'，编辑时可改）。NULL 表示未配色，
 * 界面按默认色渲染 —— 因此不加 NOT NULL、也不回填历史行。
 *
 * 幂等：先查 PRAGMA table_info，已有该列则跳过（兼容已执行过部分迁移的情况）。
 */
export const m026_rec_marker_color: Migration = {
  version: 26,
  name: 'rec_marker_color',
  up(db: Database.Database) {
    db.transaction(() => {
      const columns = db.prepare('PRAGMA table_info(rec_markers)').all() as Array<{ name: string }>
      const hasColor = columns.some((c) => c.name === 'color')
      if (!hasColor) {
        db.exec(`ALTER TABLE rec_markers ADD COLUMN color TEXT`)
      }
    })()
  }
}
