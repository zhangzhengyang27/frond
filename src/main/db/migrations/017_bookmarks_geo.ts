import type Database from 'better-sqlite3'
import type { Migration } from '.'

/**
 * 017: 素材库六期（书签收集 + 反地理编码缓存）
 *
 * - photo_photos.source_url：书签（kind='bookmark'）的来源 URL；剪藏/截图存档也可回填
 * - geo_cache：Nominatim 反地理编码结果缓存（坐标 2 位小数量化 → 城市名），遵守用量政策：
 *   同一坐标只请求一次
 */
export const m017_bookmarks_geo: Migration = {
  version: 17,
  name: 'bookmarks_geo',
  up(db: Database.Database) {
    const cols = db.prepare(`PRAGMA table_info(photo_photos)`).all() as Array<{ name: string }>
    const colNames = new Set(cols.map((c) => c.name))
    if (!colNames.has('source_url')) {
      db.exec(`ALTER TABLE photo_photos ADD COLUMN source_url TEXT`)
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_photo_photos_source_url ON photo_photos(source_url)`)

    db.exec(`
      CREATE TABLE IF NOT EXISTS geo_cache (
        key         TEXT PRIMARY KEY,
        city        TEXT,
        display_name TEXT,
        cached_at   INTEGER NOT NULL
      )
    `)
  }
}
