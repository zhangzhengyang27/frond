/**
 * Leaf · 番茄钟时长单位修复迁移（v4）
 *
 * 背景：修复前渲染端 addRecord 传入的 duration 是「秒」（durationFor 返回
 * Math.floor(分钟 × 60)），repository 直接把它写进 pom_pomodoros.duration_ms；
 * 而全部读取侧（getDailyTrend / getFocusHeatmap / getTaskSummary / 报告导出）
 * 按毫秒消费（÷ 60_000）→ 所有时长统计缩水 60 倍（25 分钟番茄统计为 0）。
 *
 * 职责：一次性把存量 duration_ms（秒值）× 1000 修正为毫秒。写入端已在本
 * 发版同步改为毫秒语义（useMultiPomodoroTimer onComplete payload × 1000），
 * 因此迁移必须先于/伴随新写入生效，且只可执行一次。
 *
 * 幂等：leaf_meta.data_migration_v4_pomodoro_ms 标记位；UPDATE 与标记同事务，
 * 避免出现「已放大但未标记」导致重跑双重放大。
 *
 * 注意：v2 legacy 导入（dataMigrations.ts importRecords）仍写入秒值，依赖本
 * 迁移在其后统一放大——顺序由 index.ts 的 runDataMigrations() → v4 保证。
 */

import { database } from './database'
import { log } from '../services/LogService'

const DATA_MIGRATION_KEY = 'data_migration_v4_pomodoro_ms'

export interface PomodoroMsMigrationResult {
  ran: boolean
  rowsUpdated: number
}

/**
 * 独立函数：把存量 pom_pomodoros.duration_ms 从秒放大为毫秒。多次调用幂等。
 */
export function runPomodoroDurationMsMigration(): PomodoroMsMigrationResult {
  const result: PomodoroMsMigrationResult = { ran: false, rowsUpdated: 0 }
  const db = database.handle

  // 标记表由各 data migration 自建（不依赖 v2/v3 的执行顺序）
  db.exec(`CREATE TABLE IF NOT EXISTS leaf_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER NOT NULL
  )`)

  const done = db
    .prepare('SELECT value FROM leaf_meta WHERE key = ?')
    .get(DATA_MIGRATION_KEY) as { value: string } | undefined
  if (done?.value === 'done') {
    log.info('dataMigration.v4', 'already done, skip')
    return result
  }
  result.ran = true

  const run = db.transaction(() => {
    const info = db
      .prepare('UPDATE pom_pomodoros SET duration_ms = duration_ms * 1000')
      .run()
    result.rowsUpdated = info.changes
    db.prepare(
      `INSERT INTO leaf_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(DATA_MIGRATION_KEY, 'done', Date.now())
  })
  run()

  log.info('dataMigration.v4', `done: rowsUpdated=${result.rowsUpdated}`)
  return result
}
