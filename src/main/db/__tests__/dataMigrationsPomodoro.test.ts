import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'

/**
 * dataMigrationsPomodoro 只依赖 database 单例与 LogService；mock electron
 * （database.ts 在 import 阶段会引用 electron 的 app），模式对齐
 * dataMigrations.test.ts。
 */
vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key !== 'userData') throw new Error(`unexpected getPath(${key})`)
      return '/tmp/leaf-test-user-data'
    },
    getVersion: () => '0.0.0-test',
    isReady: () => true
  }
}))

import { database } from '../database'
import { migrations } from '../migrations'
import { runPomodoroDurationMsMigration } from '../dataMigrationsPomodoro'

function freshDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`CREATE TABLE IF NOT EXISTS meta (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`)
  for (const m of migrations) {
    const tx = db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO meta (version, applied_at) VALUES (?, ?)').run(m.version, Date.now())
    })
    tx()
  }
  return db
}

function injectDb(db: Database.Database): void {
  ;(database as unknown as { db: Database.Database | null }).db = db
}

function seedSecondsRow(db: Database.Database, durationSec: number, startedAt = Date.now()): void {
  db.prepare(
    `INSERT INTO pom_pomodoros (id, started_at, ended_at, duration_ms, state)
     VALUES (?, ?, ?, ?, 'work')`
  ).run(`p-${startedAt}-${Math.random()}`, startedAt, startedAt + durationSec * 1000, durationSec)
}

describe('runPomodoroDurationMsMigration', () => {
  let db: Database.Database

  beforeEach(() => {
    db = freshDb()
    injectDb(db)
  })

  afterEach(() => {
    injectDb(new Database(':memory:'))
    db.close()
  })

  it('存量秒值 ×1000 修正为毫秒', () => {
    seedSecondsRow(db, 1500) // 修复前：25 分钟番茄写入 1500
    seedSecondsRow(db, 300, Date.now() - 60_000)

    const result = runPomodoroDurationMsMigration()
    expect(result.ran).toBe(true)
    expect(result.rowsUpdated).toBe(2)

    const rows = db
      .prepare('SELECT duration_ms FROM pom_pomodoros ORDER BY started_at DESC')
      .all() as Array<{ duration_ms: number }>
    expect(rows[0].duration_ms).toBe(1_500_000)
    expect(rows[1].duration_ms).toBe(300_000)
  })

  it('done 标记写入 leaf_meta，二次调用幂等不放大', () => {
    seedSecondsRow(db, 1500)
    runPomodoroDurationMsMigration()

    const second = runPomodoroDurationMsMigration()
    expect(second.ran).toBe(false)
    const row = db.prepare('SELECT duration_ms FROM pom_pomodoros').get() as {
      duration_ms: number
    }
    expect(row.duration_ms).toBe(1_500_000)

    const meta = db
      .prepare('SELECT value FROM leaf_meta WHERE key = ?')
      .get('data_migration_v4_pomodoro_ms') as { value: string }
    expect(meta.value).toBe('done')
  })

  it('空表也标记 done，避免每次启动空转', () => {
    const result = runPomodoroDurationMsMigration()
    expect(result.ran).toBe(true)
    expect(result.rowsUpdated).toBe(0)
    const meta = db
      .prepare('SELECT value FROM leaf_meta WHERE key = ?')
      .get('data_migration_v4_pomodoro_ms') as { value: string }
    expect(meta.value).toBe('done')
  })
})
