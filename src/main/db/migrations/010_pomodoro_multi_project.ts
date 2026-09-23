/**
 * Frond · Migration 010 — Pomodoro multi-project timer (P1-2)
 *
 * 背景：
 * - P1-2 升级：番茄钟支持「按项目并行」
 * - 旧 schema 中 pom_pomodoros.task_id → pom_tasks.project_id（间接推）
 * - 直接在 pom_pomodoros 上冗余存 project_id，可避免每次聚合都 join，
 *   同时支持「即使 task 已软删除 / 改项目，番茄记录仍携带当初的项目」。
 *
 * 改动：
 * - pom_pomodoros 新增 project_id 字段（TEXT，可空）
 * - 索引：idx_pom_pomodoros_project（仅 task_id 为空的兼容旧记录；project_id 索引加快按项目聚合）
 *
 * 幂等策略：
 * - ADD COLUMN 用 PRAGMA table_info 检查（与 008 / 009 一致）
 * - CREATE INDEX IF NOT EXISTS
 *
 * 数据迁移（DB 层）：
 * - 不强制回填：旧记录 project_id 留 NULL，由查询时 join pom_tasks 兜底
 *   （PomodoroRepository 内部 SELECT COALESCE(record.project_id, task.project_id)）
 */

import type { Migration } from '.'

export const m010_pomodoro_multi_project: Migration = {
  version: 10,
  name: 'pomodoro_multi_project',
  up(db) {
    // 1) 加列
    const cols = (
      db.prepare(`PRAGMA table_info('pom_pomodoros')`).all() as Array<{
        name: string
      }>
    ).map((c) => c.name)

    if (!cols.includes('project_id')) {
      db.exec(`ALTER TABLE pom_pomodoros ADD COLUMN project_id TEXT`)
    }

    // 2) 加索引（仅活跃记录；含 deleted 的 pom_pomodoros 不存在软删字段，所以不加 WHERE）
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_pom_pomodoros_project
         ON pom_pomodoros(project_id)
         WHERE project_id IS NOT NULL`
    )
  }
}
