/**
 * Leaf · Migration 029 — 截图库 OCR 索引（V4 差距分析 P1-10）
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
import { m020_snippet_trigger } from './020_snippet_trigger'
import { m021_usage_count } from './021_usage_count'
import { m022_snippet_content_type } from './022_snippet_content_type'
import { m023_notes } from './023_notes'
import { m024_reminders } from './024_reminders'
import { m025_reminders_notified } from './025_reminders_notified'
import { m026_rec_marker_color } from './026_rec_marker_color'
import { m027_drop_rec_clips } from './027_drop_rec_clips'
import { m028_remove_screenshot } from './028_remove_screenshot'
import { m029_create_shot_index } from './029_create_shot_index'

export const migrations: Migration[] = [m001_init, m002_tag_softdelete, m003_lib_files_and_wall_meta, m004_snippet_contents_and_folder_meta, m005_snippet_fts_triggers, m006_online_music_schema, m007_usage_schema, m008_recording_segments_and_status, m009_pomodoro_v2, m010_pomodoro_multi_project, m011_pomodoro_task_title, m012_remove_default_project, m013_remove_music_schema, m014_assets_v1, m015_photo_embeddings, m016_asset_kinds, m017_bookmarks_geo, m018_remove_photos_and_wallpaper, m019_launcher_docs, m020_snippet_trigger, m021_usage_count, m022_snippet_content_type, m023_notes, m024_reminders, m025_reminders_notified, m026_rec_marker_color, m027_drop_rec_clips, m028_remove_screenshot, m029_create_shot_index] // prettier-ignore
