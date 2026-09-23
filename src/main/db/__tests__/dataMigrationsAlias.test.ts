import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 别名存储迁移测试：electron-store config.json 的 aliases 键 → pref_preferences。
 * 背景：electron-store 双栈收尾——AliasService 是第一个从 JSON 迁到 SQLite 的域。
 */
vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key !== 'userData') throw new Error(`unexpected getPath(${key})`)
      if (!process.env.__FROND_TEST_USER_DATA) {
        throw new Error('test env not set up — call setupFrondTestEnv() first')
      }
      return process.env.__FROND_TEST_USER_DATA
    },
    getVersion: () => '0.0.0-test',
    isReady: () => true
  }
}))

import Database from 'better-sqlite3'
import { database } from '../database'
import { migrations } from '../migrations'
import { migrateAliasesFromLegacyStore } from '../dataMigrations'

/** 用全新 :memory: db 替换 FrondDatabase 单例 handle（与 dataMigrations.test.ts 同法） */
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

function writeConfigJson(userData: string, obj: unknown): void {
  writeFileSync(join(userData, 'config.json'), JSON.stringify(obj), 'utf-8')
}

function prefAliases(db: Database.Database): string | undefined {
  const row = db.prepare('SELECT value FROM pref_preferences WHERE key = ?').get('aliases') as
    | { value: string }
    | undefined
  return row?.value
}

describe('migrateAliasesFromLegacyStore', () => {
  let db: Database.Database
  let userData: string

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'frond-alias-migration-'))
    process.env.__FROND_TEST_USER_DATA = userData
    db = freshDb()
    injectDb(db)
  })

  afterEach(() => {
    injectDb(new Database(':memory:'))
    db.close()
    rmSync(userData, { recursive: true, force: true })
    delete process.env.__FROND_TEST_USER_DATA
  })

  it('config.json 中的 aliases 导入 pref_preferences', () => {
    writeConfigJson(userData, { aliases: { 'clipboard.history': ['ch', 'cb'] } })
    migrateAliasesFromLegacyStore()
    expect(JSON.parse(prefAliases(db) ?? '{}')).toEqual({
      'clipboard.history': ['ch', 'cb']
    })
  })

  it('无 config.json 时不抛错、不打残留数据', () => {
    expect(() => migrateAliasesFromLegacyStore()).not.toThrow()
    expect(prefAliases(db)).toBeUndefined()
  })

  it('config.json 无 aliases 键时不写空对象覆盖', () => {
    writeConfigJson(userData, { otherKey: 1 })
    migrateAliasesFromLegacyStore()
    expect(prefAliases(db)).toBeUndefined()
  })

  it('pref 已有现值时不覆盖（现值优先）', () => {
    db.prepare(
      `INSERT INTO pref_preferences (key, value, updated_at) VALUES ('aliases', ?, ?)`
    ).run(JSON.stringify({ 'already.set': ['x'] }), Date.now())
    writeConfigJson(userData, { aliases: { 'clipboard.history': ['ch'] } })
    migrateAliasesFromLegacyStore()
    expect(JSON.parse(prefAliases(db) ?? '{}')).toEqual({ 'already.set': ['x'] })
  })

  it('幂等：打标志后二次运行不重导（即使旧 JSON 仍在）', () => {
    writeConfigJson(userData, { aliases: { 'clipboard.history': ['ch'] } })
    migrateAliasesFromLegacyStore()
    // 迁移后用户改了数据
    db.prepare('UPDATE pref_preferences SET value = ? WHERE key = ?').run(
      JSON.stringify({ 'user.edited': ['y'] }),
      'aliases'
    )
    migrateAliasesFromLegacyStore()
    expect(JSON.parse(prefAliases(db) ?? '{}')).toEqual({ 'user.edited': ['y'] })
  })
})
