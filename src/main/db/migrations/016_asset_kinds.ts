import type Database from 'better-sqlite3'
import type { Migration } from '.'

/**
 * 016: 素材库五期（多类型资源）
 *
 * - photo_photos.kind：image | video | audio | font | file（Eagle 式多类型素材库）
 * - photo_photos.duration_ms：视频/音频时长（ffmpeg 探测）
 * - photo_folders + photo_photos.folder_id：手动文件夹分组（层级预留 parent_id）
 */
export const m016_asset_kinds: Migration = {
  version: 16,
  name: 'asset_kinds',
  up(db: Database.Database) {
    const cols = db.prepare(`PRAGMA table_info(photo_photos)`).all() as Array<{ name: string }>
    const colNames = new Set(cols.map((c) => c.name))
    const alters: string[] = []
    if (!colNames.has('kind'))
      alters.push(`ALTER TABLE photo_photos ADD COLUMN kind TEXT NOT NULL DEFAULT 'image'`)
    if (!colNames.has('duration_ms'))
      alters.push(`ALTER TABLE photo_photos ADD COLUMN duration_ms INTEGER`)
    if (!colNames.has('folder_id'))
      alters.push(`ALTER TABLE photo_photos ADD COLUMN folder_id TEXT`)
    for (const sql of alters) db.exec(sql)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_photo_photos_kind ON photo_photos(kind)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_photo_photos_folder ON photo_photos(folder_id)`)

    // 历史数据按扩展名回填 kind（与 shared/assetTypes 的 kindOfExt 保持一致）
    db.exec(`
      UPDATE photo_photos SET kind = 'video' WHERE kind = 'image' AND (
        file_name LIKE '%.mp4' OR file_name LIKE '%.mov' OR file_name LIKE '%.webm'
        OR file_name LIKE '%.m4v' OR file_name LIKE '%.mkv' OR file_name LIKE '%.avi'
        OR file_name LIKE '%.wmv' OR file_name LIKE '%.flv' OR file_name LIKE '%.mpeg'
        OR file_name LIKE '%.mpg' OR file_name LIKE '%.MP4' OR file_name LIKE '%.MOV'
      )
    `)
    db.exec(`
      UPDATE photo_photos SET kind = 'audio' WHERE kind = 'image' AND (
        file_name LIKE '%.mp3' OR file_name LIKE '%.wav' OR file_name LIKE '%.aac'
        OR file_name LIKE '%.flac' OR file_name LIKE '%.m4a' OR file_name LIKE '%.ogg'
        OR file_name LIKE '%.opus' OR file_name LIKE '%.wma' OR file_name LIKE '%.MP3'
      )
    `)
    db.exec(`
      UPDATE photo_photos SET kind = 'font' WHERE kind = 'image' AND (
        file_name LIKE '%.ttf' OR file_name LIKE '%.otf' OR file_name LIKE '%.woff'
        OR file_name LIKE '%.woff2' OR file_name LIKE '%.ttc' OR file_name LIKE '%.TTF'
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS photo_folders (
        id         TEXT PRIMARY KEY,
        name       TEXT    NOT NULL,
        parent_id  TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_photo_folders_parent ON photo_folders(parent_id, sort_order)`
    )
  }
}
