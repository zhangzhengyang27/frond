import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 025: 提醒事项添加 notified_at 字段
 *
 * 记录提醒最后一次发送通知的时间，用于应用重启后避免重复通知。
 * NULL 表示从未通知过。
 */
export const m025_reminders_notified: Migration = {
  version: 25,
  name: 'reminders_notified_at',
  up(db: Database.Database) {
    db.transaction(() => {
      // 检查列是否已存在（兼容已执行过部分迁移的情况）
      const columns = db.prepare('PRAGMA table_info(reminders)').all() as Array<{ name: string }>
      const hasNotifiedAt = columns.some((c) => c.name === 'notified_at')
      if (!hasNotifiedAt) {
        db.exec(`ALTER TABLE reminders ADD COLUMN notified_at INTEGER`)
      }
    })()
  }
}
