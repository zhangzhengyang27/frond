import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { Migration } from '.'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * 014: 素材库一期（assets v1）
 *
 * 1. photo_photos 加列：phash（感知哈希，二期以图搜图/查重）、color_dominant（主色）、
 *    thumb_status（缩略图处理状态机 0 待处理/1 完成/2 失败）、source（入库来源）
 * 2. 新建 photo_smart_albums（Eagle 式智能收藏夹：rules_json → SQL WHERE）
 * 3. 数据迁移：photo_tags.tag_id 由裸字符串迁移为 tag_tags.id（绑定全局标签字典）
 *
 * 幂等：ADD COLUMN 走 PRAGMA table_info 检查；CREATE 用 IF NOT EXISTS；
 * 字符串→uuid 映射对「已迁移数据」自动跳过（uuid 正则短路）
 */
export const m014_assets_v1: Migration = {
  version: 14,
  name: 'assets_v1',
  up(db: Database.Database) {
    // 1) photo_photos 加列
    const photoCols = db.prepare(`PRAGMA table_info(photo_photos)`).all() as Array<{ name: string }>
    const colNames = new Set(photoCols.map((c) => c.name))
    const alters: string[] = []
    if (!colNames.has('phash')) alters.push(`ALTER TABLE photo_photos ADD COLUMN phash TEXT`)
    if (!colNames.has('color_dominant'))
      alters.push(`ALTER TABLE photo_photos ADD COLUMN color_dominant TEXT`)
    if (!colNames.has('thumb_status'))
      alters.push(`ALTER TABLE photo_photos ADD COLUMN thumb_status INTEGER NOT NULL DEFAULT 0`)
    if (!colNames.has('source'))
      alters.push(`ALTER TABLE photo_photos ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`)
    for (const sql of alters) db.exec(sql)
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_photo_photos_thumb_status ON photo_photos(thumb_status)`
    )

    // 2) 智能收藏夹
    db.exec(`
      CREATE TABLE IF NOT EXISTS photo_smart_albums (
        id         TEXT PRIMARY KEY,
        name       TEXT    NOT NULL,
        rules_json TEXT    NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )
    `)
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_photo_smart_albums_sort ON photo_smart_albums(sort_order)`
    )

    // 3) photo_tags 裸字符串 → tag_tags.id
    const tagRows = db.prepare(`SELECT DISTINCT tag_id FROM photo_tags`).all() as Array<{
      tag_id: string
    }>
    if (tagRows.length === 0) return

    const getTagByName = db.prepare(
      `SELECT id FROM tag_tags WHERE LOWER(name) = LOWER(?) AND deleted_at IS NULL`
    )
    const insertTag = db.prepare(
      `INSERT INTO tag_tags (id, name, color, icon, parent_id, usage_count, created_at, updated_at, deleted_at)
       VALUES (?, ?, NULL, NULL, NULL, 0, ?, ?, NULL)`
    )
    const now = Date.now()
    const mapping = new Map<string, string>()
    for (const { tag_id } of tagRows) {
      if (UUID_RE.test(tag_id)) continue // 已是 uuid（重复运行等场景），跳过
      if (mapping.has(tag_id)) continue
      const existing = getTagByName.get(tag_id) as { id: string } | undefined
      if (existing) {
        mapping.set(tag_id, existing.id)
      } else {
        const id = uuidv4()
        insertTag.run(id, tag_id, now, now)
        mapping.set(tag_id, id)
      }
    }

    const tx = db.transaction(() => {
      const update = db.prepare(`UPDATE OR IGNORE photo_tags SET tag_id = ? WHERE tag_id = ?`)
      const cleanup = db.prepare(
        `DELETE FROM photo_tags WHERE tag_id = ?` // OR IGNORE 冲突残留的旧行（同 photo 已有目标 uuid 时）
      )
      for (const [str, id] of mapping) {
        update.run(id, str)
        cleanup.run(str)
      }
      // 刷新字典引用计数
      db.exec(
        `UPDATE tag_tags SET usage_count = (
           SELECT COUNT(*) FROM photo_tags pt WHERE pt.tag_id = tag_tags.id
         )`
      )
    })
    tx()
  }
}
