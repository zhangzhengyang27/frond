import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * AI 域存储迁移测试：config.json 的 ai.config / ai.sessions 键 → pref_preferences。
 * 注意：apiKey 在 JSON 里已是 enc: 密文，原样搬运（加密密钥同机不变，可解密）。
 */
vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key !== 'userData') throw new Error(`unexpected getPath(${key})`)
      if (!process.env.__LEAF_TEST_USER_DATA) throw new Error('test env not set up')
      return process.env.__LEAF_TEST_USER_DATA
    },
    getVersion: () => '0.0.0-test',
    isReady: () => true
  }
}))

import Database from 'better-sqlite3'
import { database } from '../database'
import { migrations } from '../migrations'
import { migrateAiFromLegacyStore } from '../dataMigrations'

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

function pref(db: Database.Database, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM pref_preferences WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

describe('migrateAiFromLegacyStore', () => {
  let db: Database.Database
  let userData: string

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'leaf-ai-migration-'))
    process.env.__LEAF_TEST_USER_DATA = userData
    db = freshDb()
    injectDb(db)
  })

  afterEach(() => {
    injectDb(new Database(':memory:'))
    db.close()
    rmSync(userData, { recursive: true, force: true })
    delete process.env.__LEAF_TEST_USER_DATA
  })

  it('ai.config 与 ai.sessions 都导入 pref_preferences（密文原样搬运）', () => {
    writeFileSync(
      join(userData, 'config.json'),
      JSON.stringify({
        'ai.config': { enabled: true, apiKey: 'enc:ABCD', model: 'gpt-test' },
        'ai.sessions': [{ id: 's1', title: 't' }]
      }),
      'utf-8'
    )
    migrateAiFromLegacyStore()
    expect(JSON.parse(pref(db, 'ai.config') ?? '{}')).toEqual({
      enabled: true,
      apiKey: 'enc:ABCD',
      model: 'gpt-test'
    })
    expect(JSON.parse(pref(db, 'ai.sessions') ?? '[]')).toEqual([{ id: 's1', title: 't' }])
  })

  it('部分键存在时只导入存在的键', () => {
    writeFileSync(join(userData, 'config.json'), JSON.stringify({ 'ai.config': { enabled: true } }), 'utf-8')
    migrateAiFromLegacyStore()
    expect(pref(db, 'ai.config')).toBe(JSON.stringify({ enabled: true }))
    expect(pref(db, 'ai.sessions')).toBeUndefined()
  })

  it('无 config.json 不抛错', () => {
    expect(() => migrateAiFromLegacyStore()).not.toThrow()
  })

  it('幂等：二次运行不覆盖用户新数据', () => {
    writeFileSync(
      join(userData, 'config.json'),
      JSON.stringify({ 'ai.config': { model: 'old' } }),
      'utf-8'
    )
    migrateAiFromLegacyStore()
    db.prepare('UPDATE pref_preferences SET value = ? WHERE key = ?').run(
      JSON.stringify({ model: 'user-new' }),
      'ai.config'
    )
    migrateAiFromLegacyStore()
    expect(JSON.parse(pref(db, 'ai.config') ?? '{}')).toEqual({ model: 'user-new' })
  })
})
