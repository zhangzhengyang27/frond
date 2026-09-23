import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 剪辑片段存储迁移测试：electron-store 专用文件 clips.json → pref_preferences 'clips'。
 * 文件结构 = Record<videoId, Clip[]>，与 ClipService 内存镜像同构。
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
import { migrateClipsFromLegacyStore } from '../dataMigrations'

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

function prefClips(db: Database.Database): string | undefined {
  const row = db.prepare('SELECT value FROM pref_preferences WHERE key = ?').get('clips') as
    | { value: string }
    | undefined
  return row?.value
}

describe('migrateClipsFromLegacyStore', () => {
  let db: Database.Database
  let userData: string

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'frond-clips-migration-'))
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

  it('clips.json 整体导入 pref "clips"', () => {
    writeFileSync(
      join(userData, 'clips.json'),
      JSON.stringify({
        'video-a': [{ id: 'c1', startTime: 0, endTime: 5 }],
        'video-b': [{ id: 'c2', startTime: 10, endTime: 20, label: '精彩' }]
      }),
      'utf-8'
    )
    migrateClipsFromLegacyStore()
    expect(JSON.parse(prefClips(db) ?? '{}')).toEqual({
      'video-a': [{ id: 'c1', startTime: 0, endTime: 5 }],
      'video-b': [{ id: 'c2', startTime: 10, endTime: 20, label: '精彩' }]
    })
  })

  it('无 clips.json 不抛错、不写数据', () => {
    expect(() => migrateClipsFromLegacyStore()).not.toThrow()
    expect(prefClips(db)).toBeUndefined()
  })

  it('损坏的 clips.json 按无旧数据处理', () => {
    writeFileSync(join(userData, 'clips.json'), '{not-json', 'utf-8')
    expect(() => migrateClipsFromLegacyStore()).not.toThrow()
    expect(prefClips(db)).toBeUndefined()
  })

  it('幂等：二次运行不覆盖用户新数据', () => {
    writeFileSync(join(userData, 'clips.json'), JSON.stringify({ 'video-a': [] }), 'utf-8')
    migrateClipsFromLegacyStore()
    db.prepare('UPDATE pref_preferences SET value = ? WHERE key = ?').run(
      JSON.stringify({ 'video-new': [{ id: 'c9', startTime: 1, endTime: 2 }] }),
      'clips'
    )
    migrateClipsFromLegacyStore()
    expect(JSON.parse(prefClips(db) ?? '{}')).toHaveProperty('video-new')
  })
})
