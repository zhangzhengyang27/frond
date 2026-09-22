/**
 * Leaf · Migration 011 — Pomodoro record task_title field
 *
 * 背景：
 * - 旧 schema 中 pom_pomodoros.note 字段被复用为「任务标题快照」
 * - 这导致备注和任务标题数据混淆，用户无法区分
 *
 * 改动：
 * - pom_pomodoros 新增 task_title 字段（TEXT，可空）
 * - 数据迁移：将现有 note 中非备注的数据迁移到 task_title
 *   （通过分析 note 内容判断：短文本且无换行符的可能是任务标题）
 * - 保留 note 字段，后续可清理
 *
 * 幂等策略：
 * - ADD COLUMN 用 PRAGMA table_info 检查
 */

import type { Migration } from '.'

export const m011_pomodoro_task_title: Migration = {
  version: 11,
  name: 'pomodoro_task_title',
  up(db) {
    // 1) 检查是否已有 task_title 列
    const cols = (
      db.prepare(`PRAGMA table_info('pom_pomodoros')`).all() as Array<{
        name: string
      }>
    ).map((c) => c.name)

    if (!cols.includes('task_title')) {
      db.exec(`ALTER TABLE pom_pomodoros ADD COLUMN task_title TEXT`)
    }

    // 2) 迁移数据：将 note 中合理的任务标题迁移到 task_title
    // 判断规则：
    // - note 不为空
    // - note 长度在 1-100 字符之间（合理的任务标题长度）
    // - note 不包含换行符（备注可能有换行）
    // - note 不以特殊符号开头（可能是用户备注）
    const rows = db
      .prepare(
        `SELECT id, note FROM pom_pomodoros
         WHERE note IS NOT NULL AND note != ''
           AND task_title IS NULL
           AND LENGTH(note) BETWEEN 1 AND 100
           AND note NOT LIKE '%' || CHAR(10) || '%'
           AND note NOT LIKE '%' || CHAR(13) || '%'
           AND note NOT LIKE '#%'
           AND note NOT LIKE '//%'
           AND note NOT LIKE '<!--%'`
      )
      .all() as Array<{ id: string; note: string }>

    if (rows.length > 0) {
      const updateStmt = db.prepare(`UPDATE pom_pomodoros SET task_title = ? WHERE id = ?`)
      const tx = db.transaction(() => {
        for (const row of rows) {
          updateStmt.run(row.note, row.id)
        }
      })
      tx()
    }
  }
}
