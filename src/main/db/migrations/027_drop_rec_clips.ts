import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 027: 下线 rec_clips（001_init 引入的「剪辑导出」待办表）
 *
 * 剪辑导出改为直接对录制文件转码（RecordingExportService），不再经过
 * 「先建 clips 行、后台逐条消化」这一层；表在本仓已无任何读写方
 * （连 RecordingRepository.hardDelete 的级联清理也一并移除）。
 *
 * 幂等：DROP TABLE IF EXISTS（索引随表消失，无需单独 DROP INDEX）。
 */
export const m027_drop_rec_clips: Migration = {
  version: 27,
  name: 'drop_rec_clips',
  up(db: Database.Database) {
    db.transaction(() => {
      db.exec(`DROP TABLE IF EXISTS rec_clips`)
    })()
  }
}
