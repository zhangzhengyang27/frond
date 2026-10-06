import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { database } from '../database'
import { migrations } from '../migrations'
import { PomodoroRepository } from '../repos/PomodoroRepository'
import { pomodoroTimerStateRepository } from '../repos/PomodoroTimerStateRepository'

/**
 * B60 批A：数据层正确性
 * - B60-8：优先级四档（0-3）——此前 clampPriority 只收 0-2，「高」被静默钳成「中」
 * - B60-9：TimerState 持久化往返保留 elapsed——此前 parseState 剥字段，
 *   Flowtime 正计时重启后累计清零
 */

/** settings 走全局 prefRepository 单例，需换 handle（同 5_6b.pomodoro.test.ts） */
function injectDb(db: Database.Database): void {
  ;(database as unknown as { db: Database.Database | null }).db = db
}

function freshDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const m of migrations) m.up(db)
  return db
}

describe('B60 批A：数据层正确性', () => {
  let db: Database.Database
  let repo: PomodoroRepository

  beforeEach(() => {
    db = freshDb()
    injectDb(db)
    repo = new PomodoroRepository(db)
  })

  it('B60-8：优先级 3（高）在新建与更新往返后保持为 3', () => {
    const created = repo.addTask('优先级高的任务', { priority: 3 })
    expect(created.priority).toBe(3)
    expect(repo.getTasks().find((t) => t.id === created.id)?.priority).toBe(3)

    const updated = repo.updateTask(created.id, { priority: 3 })
    expect(updated?.priority).toBe(3)
  })

  it('B60-8：越界优先级仍被钳制（负数→0、超大→3）', () => {
    const low = repo.addTask('负数', { priority: -5 })
    expect(low.priority).toBe(0)
    const high = repo.addTask('超大', { priority: 99 })
    expect(high.priority).toBe(3)
  })

  it('B60-9：TimerState 保存/读取往返保留 elapsed', () => {
    pomodoroTimerStateRepository.save('proj-x', {
      mode: 'work',
      status: 'paused',
      timeLeft: 0,
      currentTaskId: null,
      consecutiveCount: 0,
      elapsed: 540,
      updatedAt: Date.now()
    })
    const restored = pomodoroTimerStateRepository.get('proj-x')
    expect(restored?.elapsed).toBe(540)

    // getAll 同口径
    const all = pomodoroTimerStateRepository.getAll()
    expect(all['proj-x']?.elapsed).toBe(540)
  })

  it('B60-9：旧快照无 elapsed 字段时仍兼容（undefined，不炸）', () => {
    const raw = JSON.stringify({
      mode: 'work',
      status: 'idle',
      timeLeft: 1500,
      currentTaskId: null,
      consecutiveCount: 2,
      updatedAt: Date.now()
    })
    prefRepoSet(`pomodoro_timer_state_legacy`, raw)
    const restored = pomodoroTimerStateRepository.get('legacy')
    expect(restored?.mode).toBe('work')
    expect(restored?.elapsed).toBeUndefined()
  })
})

/** 直写 pref_preferences（模拟旧版本落库的快照，绕过类型化 save） */
function prefRepoSet(key: string, value: string): void {
  const d = (database as unknown as { db: Database.Database | null }).db
  d?.prepare(
    `INSERT INTO pref_preferences (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value, Date.now())
}

// ── B60 批B：统计口径 ────────────────────────────────────────
describe('B60 批B：统计口径', () => {
  let db: Database.Database
  let repo: PomodoroRepository

  beforeEach(() => {
    db = freshDb()
    injectDb(db)
    repo = new PomodoroRepository(db)
  })

  it('B60-18：完成率分母限定统计区间（区间外积压任务不稀释）', () => {
    // 上界放宽 1 分钟：repo 内部 now() 与测试取的 to 可能同毫秒，撞 < to 边界
    const to = Date.now() + 60_000
    const from = to - 7 * 86400000
    const stale = repo.addTask('区间外积压')
    db.prepare(`UPDATE pom_tasks SET created_at = ? WHERE id = ?`).run(from - 86400000, stale.id)
    const fresh = repo.addTask('区间内')
    repo.completeTask(fresh.id)

    const stats = repo.getTaskCompletionStats(from, to)
    expect(stats.total).toBe(1)
    expect(stats.completed).toBe(1)
    expect(stats.completionRate).toBe(1)
  })

  it('B60-19：自由番茄（无任务）不计入「每任务平均番茄」分子', () => {
    const to = Date.now() + 60_000
    const from = to - 86400000
    for (let i = 0; i < 3; i++) {
      repo.addRecord({ type: 'work', duration: 1_500_000, completedAt: to - i * 1000 })
    }
    const t = repo.addTask('绑任务')
    repo.addRecord({ type: 'work', duration: 1_500_000, taskId: t.id, completedAt: to })

    const stats = repo.getTaskCompletionStats(from, to)
    expect(stats.completedPomodoros).toBe(1)
    expect(stats.avgPomodorosPerTask).toBe(1)
  })

  it('B60-10：完成 work 番茄累加任务 actual_ms，预估偏差复活', () => {
    const to = Date.now() + 60_000
    const from = to - 86400000
    const t = repo.addTask('带预估任务', { estimateMs: 25 * 60_000 })
    // 一个 10 分钟的番茄：actual 10min < estimate 25min → under 计 1、均偏差 -15min
    repo.addRecord({ type: 'work', duration: 10 * 60_000, taskId: t.id, completedAt: to })
    // 偏差口径只统计已完成任务（实际 vs 预估在完成时才有意义）
    repo.completeTask(t.id)

    const stats = repo.getTaskCompletionStats(from, to)
    expect(stats.estimateUnderCount).toBe(1)
    expect(stats.avgEstimateDeviationMs).toBe(-15 * 60_000)
  })

  it('B60-25a：addRecord 落真实 started_at（无值时退化为完成时刻）', () => {
    const to = Date.now()
    repo.addRecord({
      type: 'work',
      duration: 600_000,
      completedAt: to,
      startedAt: to - 600_000
    })
    const row = db
      .prepare(`SELECT started_at, ended_at FROM pom_pomodoros ORDER BY rowid DESC LIMIT 1`)
      .get() as { started_at: number; ended_at: number }
    expect(row.started_at).toBe(to - 600_000)
    // ended_at 用 repo 内部 now()，可能比测试取的 to 晚 1ms
    expect(row.ended_at).toBeGreaterThanOrEqual(to)

    repo.addRecord({ type: 'work', duration: 600_000, completedAt: to })
    const row2 = db
      .prepare(`SELECT started_at, ended_at FROM pom_pomodoros ORDER BY rowid DESC LIMIT 1`)
      .get() as { started_at: number; ended_at: number }
    // 无 startedAt：started_at 退化为完成时刻（与 ended_at 同值）
    expect(row2.started_at).toBe(row2.ended_at)
  })
})
