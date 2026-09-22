import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 023: 轻量笔记（Notes）
 *
 * 对标 Raycast Notes 的轻量子集：本地 Markdown 笔记，支持文件夹、置顶、回收站。
 * 不做云同步、不做协作、不做富文本编辑器（纯 Markdown 文本编辑）。
 */
export const m023_notes: Migration = {
  version: 23,
  name: 'notes',
  up(db: Database.Database) {
    db.transaction(() => {
      // 笔记文件夹
      db.exec(`CREATE TABLE IF NOT EXISTS note_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`)

      // 笔记主表
      db.exec(`CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        folder_id TEXT,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`)

      db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(is_deleted)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC)`)

      // 笔记全文搜索（FTS5）
      db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title, content, content='notes', content_rowid='rowid'
      )`)

      // FTS 同步触发器
      db.exec(`CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
      END`)
      db.exec(`CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
      END`)
      db.exec(`CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
        INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
      END`)
    })()
  }
}
