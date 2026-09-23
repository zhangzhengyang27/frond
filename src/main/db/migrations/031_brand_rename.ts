/**
 * Frond · Migration 031 — 旧品牌（Leaf）留下的两处库内标识
 *
 * 1. `leaf_meta` → `frond_meta`：**必须搬**。`dataMigrations.ts` 用这张表的标志位判
 *    「electron-store 双栈收尾 / v2 导入跑过没有」，表名对不上就等于标志位全丢，
 *    老数据会被再导入一遍（重复条目）。本条在 `runDataMigrations()` 之前跑完，
 *    所以那边读到的就是改名后的同一份记账。
 * 2. `launcher_docs` 里以插件 id 为键的行（`plugin_id` 与复合主键 `doc_id` 的
 *    `<pluginId>:<docId>` 前缀）跟着 `com.leaf.*` → `com.frond.*` 一起改，
 *    否则插件的偏好与自存数据认不出主人。
 *
 * 幂等：两处都以「旧名在不在」为条件，跑过第二次没有可改的行。
 */
import type Database from 'better-sqlite3'
import type { Migration } from './index'

export const m031_brand_rename: Migration = {
  version: 31,
  name: 'brand_rename',
  up(db: Database.Database) {
    db.transaction(() => {
      const hasTable = (name: string): boolean =>
        !!db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name)
      if (hasTable('leaf_meta') && !hasTable('frond_meta')) {
        db.exec(`ALTER TABLE leaf_meta RENAME TO frond_meta`)
      }
      if (hasTable('launcher_docs')) {
        db.prepare(
          `UPDATE launcher_docs
             SET plugin_id = replace(plugin_id, 'com.leaf.', 'com.frond.'),
                 doc_id    = replace(doc_id, 'com.leaf.', 'com.frond.')
           WHERE plugin_id LIKE 'com.leaf.%'`
        ).run()
      }
    })()
  }
}
