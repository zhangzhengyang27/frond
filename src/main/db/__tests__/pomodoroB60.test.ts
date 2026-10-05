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
    ;(prefRepoSet)(`pomodoro_timer_state_legacy`, raw)
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
  )
    .run(key, value, Date.now())
}
