import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 024: 提醒事项（Reminders）
 *
 * 对标 Raycast Reminders 的轻量子集：本地提醒事项，支持到期时间、定时通知、完成/删除。
 * 不做云同步、不做列表分组（后续可扩展 list_id）、不做重复提醒。
 */
export const m024_reminders: Migration = {
  version: 24,
  name: 'reminders',
  up(db: Database.Database) {
    db.transaction(() => {
      db.exec(`CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        due_at INTEGER,
        remind_at INTEGER,
        is_completed INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`)

      db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(is_completed)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_deleted ON reminders(is_deleted)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_remind ON reminders(remind_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_created ON reminders(created_at DESC)`)

      // 全文搜索
      db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS reminders_fts USING fts5(
        title, notes, content='reminders', content_rowid='rowid'
      )`)

      db.exec(`CREATE TRIGGER IF NOT EXISTS reminders_ai AFTER INSERT ON reminders BEGIN
        INSERT INTO reminders_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
      END`)
      db.exec(`CREATE TRIGGER IF NOT EXISTS reminders_ad AFTER DELETE ON reminders BEGIN
        INSERT INTO reminders_fts(reminders_fts, rowid, title, notes) VALUES ('delete', old.rowid, old.title, old.notes);
      END`)
      db.exec(`CREATE TRIGGER IF NOT EXISTS reminders_au AFTER UPDATE ON reminders BEGIN
        INSERT INTO reminders_fts(reminders_fts, rowid, title, notes) VALUES ('delete', old.rowid, old.title, old.notes);
        INSERT INTO reminders_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
      END`)
    })()
  }
}
