/**
 * Leaf · Migration 001 — initial schema
 *
 * 覆盖 9 个核心模块的初始表结构。
 * 所有表都是 IF NOT EXISTS，重复跑幂等。
 *
 * 表前缀规则：见 docs/DB_SCHEMA.md §4
 *
 * 主键约定：
 * - id TEXT PRIMARY KEY  (UUIDv4)
 * - created_at / updated_at INTEGER (unix ms)
 *
 * 时间戳列都加 DESC 索引，便于「最近」类查询。
 */

import type { Migration } from '.'

const SCHEMA = `
-- ============================================================
-- META (迁移跟踪)
-- ============================================================
CREATE TABLE IF NOT EXISTS meta (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

-- ============================================================
-- PHOTOS — 图片管理
-- ============================================================
CREATE TABLE IF NOT EXISTS photo_photos (
  id              TEXT PRIMARY KEY,
  file_path       TEXT    NOT NULL,
  file_name       TEXT    NOT NULL,
  file_size       INTEGER NOT NULL DEFAULT 0,
  width           INTEGER,
  height          INTEGER,
  mime_type       TEXT,
  taken_at        INTEGER,
  imported_at     INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  hash            TEXT,
  is_favorite     INTEGER NOT NULL DEFAULT 0,
  rating          INTEGER NOT NULL DEFAULT 0,
  description     TEXT,
  camera_model    TEXT,
  lens_model      TEXT,
  iso             INTEGER,
  aperture        REAL,
  shutter         TEXT,
  focal_length    REAL,
  latitude        REAL,
  longitude       REAL,
  deleted_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_photo_photos_imported_at_desc ON photo_photos(imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_photos_taken_at_desc    ON photo_photos(taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_photos_hash            ON photo_photos(hash);
CREATE INDEX IF NOT EXISTS idx_photo_photos_favorite        ON photo_photos(is_favorite);

CREATE TABLE IF NOT EXISTS photo_albums (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  cover_id    TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_photo_albums_sort ON photo_albums(sort_order);

CREATE TABLE IF NOT EXISTS photo_album_items (
  album_id   TEXT    NOT NULL,
  photo_id   TEXT    NOT NULL,
  added_at   INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, photo_id)
);
CREATE INDEX IF NOT EXISTS idx_photo_album_items_album ON photo_album_items(album_id, sort_order);

CREATE TABLE IF NOT EXISTS photo_tags (
  photo_id   TEXT    NOT NULL,
  tag_id     TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (photo_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_photo_tags_tag ON photo_tags(tag_id);

-- ============================================================
-- RECORDINGS — 屏幕录制
-- ============================================================
CREATE TABLE IF NOT EXISTS rec_recordings (
  id              TEXT PRIMARY KEY,
  file_path       TEXT    NOT NULL,
  file_name       TEXT    NOT NULL,
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  file_size       INTEGER NOT NULL DEFAULT 0,
  width           INTEGER,
  height          INTEGER,
  fps             INTEGER NOT NULL DEFAULT 30,
  has_camera      INTEGER NOT NULL DEFAULT 0,
  has_mic         INTEGER NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'recording',
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  updated_at      INTEGER NOT NULL,
  thumbnail_path  TEXT,
  description     TEXT,
  deleted_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rec_recordings_started_desc ON rec_recordings(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_recordings_status       ON rec_recordings(status);

CREATE TABLE IF NOT EXISTS rec_markers (
  id           TEXT PRIMARY KEY,
  recording_id TEXT    NOT NULL,
  time_ms      INTEGER NOT NULL,
  label        TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rec_markers_recording ON rec_markers(recording_id, time_ms);

CREATE TABLE IF NOT EXISTS rec_clips (
  id           TEXT PRIMARY KEY,
  recording_id TEXT    NOT NULL,
  start_ms     INTEGER NOT NULL,
  end_ms       INTEGER NOT NULL,
  output_path  TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rec_clips_recording ON rec_clips(recording_id);

-- ============================================================
-- SCREENSHOTS — 截图
-- ============================================================
CREATE TABLE IF NOT EXISTS ss_screenshots (
  id              TEXT PRIMARY KEY,
  file_path       TEXT    NOT NULL,
  file_name       TEXT    NOT NULL,
  file_size       INTEGER NOT NULL DEFAULT 0,
  width           INTEGER,
  height          INTEGER,
  capture_mode    TEXT    NOT NULL DEFAULT 'region',
  captured_at     INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  hash            TEXT,
  is_ocr_done     INTEGER NOT NULL DEFAULT 0,
  ocr_text        TEXT,
  deleted_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ss_screenshots_captured_desc ON ss_screenshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_ss_screenshots_hash          ON ss_screenshots(hash);

-- ============================================================
-- POMODORO — 番茄钟
-- ============================================================
CREATE TABLE IF NOT EXISTS pom_pomodoros (
  id            TEXT PRIMARY KEY,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER,
  duration_ms   INTEGER NOT NULL DEFAULT 0,
  state         TEXT    NOT NULL DEFAULT 'completed',
  task_id       TEXT,
  note          TEXT
);
CREATE INDEX IF NOT EXISTS idx_pom_pomodoros_started_desc ON pom_pomodoros(started_at DESC);

CREATE TABLE IF NOT EXISTS pom_tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT    NOT NULL,
  description  TEXT,
  estimate_ms  INTEGER,
  actual_ms    INTEGER NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'pending',
  priority     INTEGER NOT NULL DEFAULT 0,
  due_at       INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER,
  deleted_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pom_tasks_status     ON pom_tasks(status);
CREATE INDEX IF NOT EXISTS idx_pom_tasks_priority   ON pom_tasks(priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pom_tasks_due        ON pom_tasks(due_at);

-- ============================================================
-- SNIPPETS — 代码片段
-- ============================================================
CREATE TABLE IF NOT EXISTS snip_folders (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  parent_id   TEXT,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snip_folders_parent ON snip_folders(parent_id, sort_order);

CREATE TABLE IF NOT EXISTS snip_tags (
  snippet_id  TEXT    NOT NULL,
  tag_id      TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (snippet_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_snip_tags_tag ON snip_tags(tag_id);

CREATE TABLE IF NOT EXISTS snip_snippets (
  id          TEXT PRIMARY KEY,
  folder_id   TEXT,
  title       TEXT    NOT NULL,
  content     TEXT    NOT NULL,
  language    TEXT    NOT NULL DEFAULT 'plaintext',
  description TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_snip_snippets_folder    ON snip_snippets(folder_id);
CREATE INDEX IF NOT EXISTS idx_snip_snippets_favorite  ON snip_snippets(is_favorite);
CREATE INDEX IF NOT EXISTS idx_snip_snippets_updated   ON snip_snippets(updated_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS snip_snippets_fts USING fts5(
  title,
  content,
  description,
  content='snip_snippets',
  content_rowid='rowid'
);

-- ============================================================
-- TAGS — 全局标签
-- ============================================================
CREATE TABLE IF NOT EXISTS tag_tags (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  color       TEXT,
  icon        TEXT,
  parent_id   TEXT,
  description TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tag_tags_name   ON tag_tags(name);
CREATE INDEX IF NOT EXISTS idx_tag_tags_parent ON tag_tags(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_tags_unique_name ON tag_tags(name);

-- ============================================================
-- FOLDERS — 文件夹管理
-- ============================================================
CREATE TABLE IF NOT EXISTS folder_folders (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  path        TEXT    NOT NULL,
  parent_id   TEXT,
  icon        TEXT,
  is_pinned   INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  last_scan_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_folder_folders_parent ON folder_folders(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_folder_folders_path   ON folder_folders(path);

-- ============================================================
-- WALLPAPERS — 壁纸
-- ============================================================
CREATE TABLE IF NOT EXISTS wall_collections (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  description TEXT,
  cover_path  TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wall_files (
  id            TEXT PRIMARY KEY,
  collection_id TEXT,
  file_path     TEXT    NOT NULL,
  file_name     TEXT    NOT NULL,
  width         INTEGER,
  height        INTEGER,
  is_favorite   INTEGER NOT NULL DEFAULT 0,
  added_at      INTEGER NOT NULL,
  deleted_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_wall_files_collection ON wall_files(collection_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_wall_files_favorite   ON wall_files(is_favorite);

-- ============================================================
-- PREFERENCES — 用户偏好（key-value）
-- ============================================================
CREATE TABLE IF NOT EXISTS pref_preferences (
  key        TEXT PRIMARY KEY,
  value      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ============================================================
-- MUSIC — 音乐元数据（本地 + 在线）
-- ============================================================
CREATE TABLE IF NOT EXISTS music_tracks (
  id           TEXT PRIMARY KEY,
  source       TEXT    NOT NULL DEFAULT 'local',
  title        TEXT    NOT NULL,
  artist       TEXT,
  album        TEXT,
  duration_ms  INTEGER NOT NULL DEFAULT 0,
  file_path    TEXT,
  cover_url    TEXT,
  source_url   TEXT,
  lyric        TEXT,
  play_count   INTEGER NOT NULL DEFAULT 0,
  is_favorite  INTEGER NOT NULL DEFAULT 0,
  added_at     INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_music_tracks_artist ON music_tracks(artist);
CREATE INDEX IF NOT EXISTS idx_music_tracks_album  ON music_tracks(album);
CREATE INDEX IF NOT EXISTS idx_music_tracks_source ON music_tracks(source);

CREATE TABLE IF NOT EXISTS music_playlists (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  description TEXT,
  cover_path  TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS music_playlist_items (
  playlist_id TEXT    NOT NULL,
  track_id    TEXT    NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_music_playlist_items_pos ON music_playlist_items(playlist_id, position);

-- ============================================================
-- LOG — 服务端日志（落地版，与 LogService 内存 buffer 互补）
-- ============================================================
CREATE TABLE IF NOT EXISTS log_entries (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  level     TEXT    NOT NULL,
  scope     TEXT    NOT NULL,
  msg       TEXT    NOT NULL,
  stack     TEXT,
  meta_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_log_entries_ts_desc ON log_entries(ts DESC);
CREATE INDEX IF NOT EXISTS idx_log_entries_scope  ON log_entries(scope);
`

export const m001_init: Migration = {
  version: 1,
  name: 'initial_schema',
  up(db) {
    db.exec(SCHEMA)
  }
}
