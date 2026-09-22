import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 012: 移除自动创建的"默认"项目
 *
 * 用户不需要系统预置的"默认"项目。此迁移：
 * 1. 将关联到"默认"项目的任务的 project_id 置为 NULL
 * 2. 软删除名为"默认"的项目记录
 */
export const m012_remove_default_project: Migration = {
  version: 12,
  name: 'remove_default_project',
  up(db: Database.Database) {
    // 查找名为"默认"且未删除的项目
    const findDefault = db.prepare(
      `SELECT id FROM pom_projects WHERE name = '默认' AND deleted_at IS NULL`
    )
    const defaultRow = findDefault.get() as { id: string } | undefined
    if (!defaultRow) return // 幂等：已删除则跳过

    const defaultId = defaultRow.id

    // 将关联任务的 project_id 置 NULL
    db.prepare(
      `UPDATE pom_tasks SET project_id = NULL WHERE project_id = ? AND deleted_at IS NULL`
    ).run(defaultId)

    // 软删除该项目
    db.prepare(`UPDATE pom_projects SET deleted_at = ? WHERE id = ?`).run(Date.now(), defaultId)
  }
}
