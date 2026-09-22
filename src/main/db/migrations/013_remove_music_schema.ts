import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 013: 下线 Music / OnlineMusic 模块，删除其全部表
 *
 * 音乐播放器与在线音乐功能从应用中移除。此迁移：
 * 1. 删除 music_* 三张表（001_init 引入；本地曲目数据实际存于共享的
 *    lib_files，由 LocalFileLibrary 继续持有，不动）
 * 2. 删除 om_* 七张表（006_online_music_schema 引入）
 *
 * 幂等：全部 DROP TABLE IF EXISTS。
 */
export const m013_remove_music_schema: Migration = {
  version: 13,
  name: 'remove_music_schema',
  up(db: Database.Database) {
    db.transaction(() => {
      // music_*（001_init）
      db.exec(`DROP TABLE IF EXISTS music_playlist_items`)
      db.exec(`DROP TABLE IF EXISTS music_playlists`)
      db.exec(`DROP TABLE IF EXISTS music_tracks`)

      // om_*（006_online_music_schema）
      db.exec(`DROP TABLE IF EXISTS om_liked_tracks`)
      db.exec(`DROP TABLE IF EXISTS om_liked_playlists`)
      db.exec(`DROP TABLE IF EXISTS om_liked_albums`)
      db.exec(`DROP TABLE IF EXISTS om_liked_artists`)
      db.exec(`DROP TABLE IF EXISTS om_liked_mvs`)
      db.exec(`DROP TABLE IF EXISTS om_play_history`)
      db.exec(`DROP TABLE IF EXISTS om_user_playlists`)
    })()
  }
}
