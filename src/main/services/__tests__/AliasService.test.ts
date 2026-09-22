import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'

/**
 * AliasService CRUD 回归（迁移到 pref_preferences 后的行为保持）。
 * electron mock 只为 satisfy import 链（PrefRepository → database → electron）。
 */
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/leaf-alias-service-test',
    getVersion: () => '0.0.0-test',
    isReady: () => true
  },
  ipcMain: { handle: () => {} }
}))

import { migrations } from '../../db/migrations'
import { database } from '../../db/database'
import { getAliases, setAlias, removeAlias, getAliasesForCommand } from '../AliasService'

function injectDb(db: Database.Database): void {
  ;(database as unknown as { db: Database.Database | null }).db = db
}

function freshDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const m of migrations) {
    const tx = db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO meta (version, applied_at) VALUES (?, ?)').run(m.version, Date.now())
    })
    tx()
  }
  return db
}

describe('AliasService（SQLite 存储）', () => {
  let db: Database.Database

  beforeEach(() => {
    db = freshDb()
    injectDb(db)
  })

  afterEach(() => {
    injectDb(new Database(':memory:'))
    db.close()
  })

  it('setAlias → getAliases → removeAlias 往返', () => {
    expect(getAliases()).toEqual({})
    expect(setAlias('clipboard.history', 'CH')).toBe(true) // 归一化为小写
    expect(getAliasesForCommand('clipboard.history')).toEqual(['ch'])
    expect(setAlias('clipboard.history', 'ch')).toBe(false) // 重复拒绝
    expect(removeAlias('clipboard.history', 'ch')).toBe(true)
    expect(getAliasesForCommand('clipboard.history')).toEqual([])
  })

  it('非法输入拒绝（空 key / 空别名 / 移除不存在的别名）', () => {
    expect(setAlias('', 'x')).toBe(false)
    expect(setAlias('cmd', '  ')).toBe(false)
    expect(removeAlias('cmd', 'not-exist')).toBe(false)
  })
})
