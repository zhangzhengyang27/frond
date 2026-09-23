/**
 * Frond · Migration 030 — 同步基线表 sync_state（P-5）
 *
 * 双向同步要做**三方比**（本地行 / 远端行 / 上次同步见过的那一行），而「见过哪一版」
 * 这件事以前根本没地方存：旧实现只记一个 `launcher.syncData.lastAppliedAt` 总标记，
 * 于是删除与编辑分不开、只能靠「远端没有就删本地」赌。
 *
 * 这张表就是每台设备自己的基线快照：一行一条，`deleted_at` 非空即墓碑
 * （删除要靠它传播——没有墓碑，另一台设备下次推送就会把已删的东西带回来）。
 *
 * **不进 bundle、不同步**：它是本机的记账，不是用户数据。每台设备对着自己见过的
 * 版本判新旧，比共享一份"全局基线"更贴合两端各自离线改的实际情况。
 *
 * 幂等：CREATE TABLE IF NOT EXISTS。
 */
import type Database from 'better-sqlite3'
import type { Migration } from './index'

export const m030_sync_state: Migration = {
  version: 30,
  name: 'sync_state',
  up(db: Database.Database) {
    db.transaction(() => {
      db.exec(`CREATE TABLE IF NOT EXISTS sync_state (
        tbl        TEXT NOT NULL,
        row_key    TEXT NOT NULL,
        rev        INTEGER NOT NULL,
        deleted_at INTEGER,
        PRIMARY KEY (tbl, row_key)
      )`)
    })()
  }
}
