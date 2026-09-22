/**
 * Leaf · 数据库迁移版本声明
 *
 * 约定：
 * - 只能向后追加，不能改已发布的版本
 * - version 必须严格递增
 * - 每个 up() 必须幂等（用 IF NOT EXISTS）
 */

import type Database from 'better-sqlite3'

export interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
}

// 必须在文件末尾追加 import + push
import { m001_init } from './001_init'
import { m002_tag_softdelete } from './002_tag_softdelete'
import { m003_lib_files_and_wall_meta } from './003_lib_files_and_wall_meta'
import { m004_snippet_contents_and_folder_meta } from './004_snippet_contents_and_folder_meta'
import { m005_snippet_fts_triggers } from './005_snippet_fts_triggers'
import { m006_online_music_schema } from './006_online_music_schema'
import { m007_usage_schema } from './007_usage_schema'
import { m008_recording_segments_and_status } from './008_recording_segments_and_status'
import { m009_pomodoro_v2 } from './009_pomodoro_v2'
import { m010_pomodoro_multi_project } from './010_pomodoro_multi_project'
import { m011_pomodoro_task_title } from './011_pomodoro_task_title'
import { m012_remove_default_project } from './012_remove_default_project'
import { m013_remove_music_schema } from './013_remove_music_schema'
import { m014_assets_v1 } from './014_assets_v1'
import { m015_photo_embeddings } from './015_photo_embeddings'
import { m016_asset_kinds } from './016_asset_kinds'
import { m017_bookmarks_geo } from './017_bookmarks_geo'
import { m018_remove_photos_and_wallpaper } from './018_remove_photos_and_wallpaper'
import { m019_launcher_docs } from './019_launcher_docs'
import { m020_snippet_trigger } from './020_snippet_trigger'
import { m021_usage_count } from './021_usage_count'
import { m022_snippet_content_type } from './022_snippet_content_type'
import { m023_notes } from './023_notes'
import { m024_reminders } from './024_reminders'
import { m025_reminders_notified } from './025_reminders_notified'

export const migrations: Migration[] = [m001_init, m002_tag_softdelete, m003_lib_files_and_wall_meta, m004_snippet_contents_and_folder_meta, m005_snippet_fts_triggers, m006_online_music_schema, m007_usage_schema, m008_recording_segments_and_status, m009_pomodoro_v2, m010_pomodoro_multi_project, m011_pomodoro_task_title, m012_remove_default_project, m013_remove_music_schema, m014_assets_v1, m015_photo_embeddings, m016_asset_kinds, m017_bookmarks_geo, m018_remove_photos_and_wallpaper, m019_launcher_docs, m020_snippet_trigger, m021_usage_count, m022_snippet_content_type, m023_notes, m024_reminders, m025_reminders_notified] // prettier-ignore
