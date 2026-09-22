import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 018: 下线 图片管理 / 壁纸 模块，删除其全部表
 *
 * 图片管理与壁纸功能迁移至独立项目，从应用中移除。此迁移：
 * 1. 删除 photo_* 六张表
 *    （photo_photos / photo_albums / photo_album_items / photo_tags 来自 001_init，
 *      photo_smart_albums 来自 014，photo_embeddings 来自 015，photo_folders 来自 016；
 *      017 的 source_url 列随 photo_photos 一并消失）
 * 2. 删除 wall_* 两张表（001_init 引入）
 * 3. 删除 lib_files（003 引入；此前壁纸「本地文件库」使用，音乐下线后已无消费方）
 *
 * 注：共享的 tag_tags 标签字典表保留（截图 / 片段等模块仍在使用）。
 *
 * 幂等：全部 DROP TABLE IF EXISTS。
 */
export const m018_remove_photos_and_wallpaper: Migration = {
  version: 18,
  name: 'remove_photos_and_wallpaper',
  up(db: Database.Database) {
    db.transaction(() => {
      // photo_*（001_init / 014 / 015 / 016）
      db.exec(`DROP TABLE IF EXISTS photo_tags`)
      db.exec(`DROP TABLE IF EXISTS photo_album_items`)
      db.exec(`DROP TABLE IF EXISTS photo_albums`)
      db.exec(`DROP TABLE IF EXISTS photo_smart_albums`)
      db.exec(`DROP TABLE IF EXISTS photo_embeddings`)
      db.exec(`DROP TABLE IF EXISTS photo_folders`)
      db.exec(`DROP TABLE IF EXISTS photo_photos`)

      // wall_*（001_init）
      db.exec(`DROP TABLE IF EXISTS wall_files`)
      db.exec(`DROP TABLE IF EXISTS wall_collections`)

      // lib_files（003）
      db.exec(`DROP TABLE IF EXISTS lib_files`)
    })()
  }
}
