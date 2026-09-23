/**
 * Frond · Migration 009 — Pomodoro v2
 *
 * 背景：
 * - P0-2 升级：番茄钟任务支持「预估 / 优先级 / 项目 / 描述」
 * - 001_init 已为 pom_tasks 预留 priority / estimate_ms / description 字段（schema 已有但 UI 未暴露）
 * - 001 未建 pom_projects 表
 *
 * 改动：
 * - 新增 pom_projects（id、name、color、sort_order、created_at、updated_at、deleted_at）
 * - 扩展 pom_tasks：新增 project_id 字段（001 未建）
 * - 索引：idx_pom_tasks_project
 *
 * 幂等策略：
 * - CREATE TABLE / INDEX 用 IF NOT EXISTS
 * - ADD COLUMN 用 PRAGMA table_info 检查（与 008 一致）
 *
 * 数据迁移（DB 层）：
 * - 创建一个 sort_order=0 的「默认」项目
 * - 把所有现存 pom_tasks.project_id 为 NULL 的任务的 project_id 指向该项目
 * - 失败回滚：使用 SQLite 事务，any error → ROLLBACK
 */

import type { Migration } from '.'
import { v4 as uuidv4 } from 'uuid'

export const m009_pomodoro_v2: Migration = {
  version: 9,
  name: 'pomodoro_v2',
  up(db) {
    // ─── 1) 新建 pom_projects 表 ───
    db.exec(`
      CREATE TABLE IF NOT EXISTS pom_projects (
        id          TEXT    PRIMARY KEY,
        name        TEXT    NOT NULL,
        color       TEXT    NOT NULL DEFAULT '#4a90e2',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        deleted_at  INTEGER
      )
    `)
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_pom_projects_sort
         ON pom_projects(sort_order)
         WHERE deleted_at IS NULL`
    )

    // ─── 2) 扩展 pom_tasks：新增 project_id ───
    const taskCols = (
      db.prepare(`PRAGMA table_info('pom_tasks')`).all() as Array<{ name: string }>
    ).map((c) => c.name)

    if (!taskCols.includes('project_id')) {
      db.exec(`ALTER TABLE pom_tasks ADD COLUMN project_id TEXT`)
    }

    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_pom_tasks_project
         ON pom_tasks(project_id)
         WHERE deleted_at IS NULL`
    )

    // ─── 3) 数据迁移：插入默认项目并把所有旧任务关联上 ───
    //    用事务保证「项目创建」与「任务绑定」原子性
    const insertDefaultProject = db.prepare(
      `INSERT INTO pom_projects (id, name, color, sort_order, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, 0, ?, ?, NULL)`
    )
    const updateOrphanTasks = db.prepare(
      `UPDATE pom_tasks SET project_id = ? WHERE project_id IS NULL AND deleted_at IS NULL`
    )
    const countOrphanTasks = db.prepare(
      `SELECT COUNT(*) as n FROM pom_tasks WHERE project_id IS NULL AND deleted_at IS NULL`
    )
    const countProjects = db.prepare(
      `SELECT COUNT(*) as n FROM pom_projects WHERE deleted_at IS NULL`
    )

    const tx = db.transaction(() => {
      // 已存在项目 → 不创建默认（避免重复）
      const existing = (countProjects.get() as { n: number }).n
      if (existing > 0) return { defaultProjectId: null, updatedTasks: 0 }

      const ts = Date.now()
      const defaultProjectId = uuidv4()
      insertDefaultProject.run(defaultProjectId, '默认', '#4a90e2', ts, ts)

      const orphan = (countOrphanTasks.get() as { n: number }).n
      if (orphan > 0) {
        updateOrphanTasks.run(defaultProjectId)
      }
      return { defaultProjectId, updatedTasks: orphan }
    })

    // 失败抛错让上层感知
    tx()
  }
}
