/**
 * Frond · Migration 029 — 截图库 OCR 索引（V4 差距分析 P1-10）
 *
 * 对齐 Raycast「Search Screenshots」：对既有截图文件建索引，on-device OCR
 * 提取图内文本供搜索。注意 ss_screenshots（001）是旧截图模块的历史库并已随
 * 028 下线；本表是全新前缀 shot_*，索引的是文件系统上真实存在的截图（不捕捉）。
 *
 * 幂等：CREATE TABLE / INDEX IF NOT EXISTS。
 */
import type Database from 'better-sqlite3'
import type { Migration } from './index'

export const m029_create_shot_index: Migration = {
  version: 29,
  name: 'create_shot_index',
  up(db: Database.Database) {
    db.transaction(() => {
      db.exec(`CREATE TABLE IF NOT EXISTS shot_index (
        file_path   TEXT PRIMARY KEY,
        file_name   TEXT NOT NULL,
        file_size   INTEGER NOT NULL DEFAULT 0,
        mtime       INTEGER NOT NULL,
        captured_at INTEGER NOT NULL,
        ocr_status  TEXT NOT NULL DEFAULT 'pending',
        ocr_text    TEXT
      )`)
      db.exec('CREATE INDEX IF NOT EXISTS idx_shot_index_captured ON shot_index(captured_at DESC)')
    })()
  }
}
