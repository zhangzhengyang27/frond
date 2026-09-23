import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 「v1+v2 已迁完就早退」不能把 electron-store 那五路收尾一起跳过。
 *
 * 原实现把 migrateAliases/Ai/Clips/RecordingSettings/Markers 五个调用写在
 * `if (v1Done && v2Done) return` 之后 —— 凡是已经跑完 v1+v2 的机器（也就是每台老机器）
 * 都永远不会搬这五个域，旧 config.json 里的别名、AI 配置、剪辑、录屏设置、时间标记
 * 就一直躺在 JSON 里不生效。测试拿 aliases 当代表钉住这条路径。
 */
vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key !== 'userData') throw new Error(`unexpected getPath(${key})`)
      if (!process.env.__FROND_TEST_USER_DATA) throw new Error('test env not set up')
      return process.env.__FROND_TEST_USER_DATA
    },
    getVersion: () => '0.0.0-test',
    isReady: () => true
  }
}))

import Database from 'better-sqlite3'
import { database } from '../database'
import { migrations } from '../migrations'
import { runDataMigrations } from '../dataMigrations'

function injectDb(db: Database.Database): void {
  ;(database as unknown as { db: Database.Database | null }).db = db
}

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

describe('runDataMigrations 与 electron-store 收尾五路', () => {
  let db: Database.Database
  let userData: string

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'frond-legacy-store-hoist-'))
    process.env.__FROND_TEST_USER_DATA = userData
    db = freshDb()
    injectDb(db)
    // 模拟一台「v1+v2 早就迁完」的老机器：这正是原代码提前 return 的那个条件
    db.exec(
      `CREATE TABLE IF NOT EXISTS frond_meta (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER NOT NULL)`
    )
    for (const k of ['data_migration_v1', 'data_migration_v2']) {
      db.prepare('INSERT INTO frond_meta (key, value, updated_at) VALUES (?, ?, ?)').run(
        k,
        'done',
        Date.now()
      )
    }
    writeFileSync(
      join(userData, 'config.json'),
      JSON.stringify({ aliases: [{ pattern: 'gmail', value: 'me@gmail.com' }] }),
      'utf-8'
    )
  })

  afterEach(() => {
    injectDb(new Database(':memory:'))
    db.close()
    rmSync(userData, { recursive: true, force: true })
    delete process.env.__FROND_TEST_USER_DATA
  })

  it('v1+v2 已 done 时仍然把 electron-store 的别名搬进 pref', () => {
    runDataMigrations()

    const row = db.prepare('SELECT value FROM pref_preferences WHERE key = ?').get('aliases') as
      { value: string } | undefined
    expect(JSON.parse(row?.value ?? 'null')).toEqual([{ pattern: 'gmail', value: 'me@gmail.com' }])
    // 标志位落下 → 下次启动不再重复搬（幂等）
    const flag = db
      .prepare('SELECT value FROM frond_meta WHERE key = ?')
      .get('data_migration_aliases') as { value: string } | undefined
    expect(flag?.value).toBe('done')
  })

  it('跑第二次不再重复搬（各自带标志位）', () => {
    runDataMigrations()
    db.prepare('UPDATE pref_preferences SET value = ? WHERE key = ?').run(
      JSON.stringify([{ pattern: 'work', value: 'me@work.com' }]),
      'aliases'
    )
    runDataMigrations()
    const row = db.prepare('SELECT value FROM pref_preferences WHERE key = ?').get('aliases') as {
      value: string
    }
    expect(JSON.parse(row.value)).toEqual([{ pattern: 'work', value: 'me@work.com' }])
  })
})
