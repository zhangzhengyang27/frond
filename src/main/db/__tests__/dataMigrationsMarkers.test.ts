import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 标记存储收敛测试：electron-store markers.json（Record<recordingId, Marker[]>，
 * timestamp 单位秒）→ rec_markers 表（time_ms 单位毫秒，含 color 列）。
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
import { migrateMarkersFromLegacyStore } from '../dataMigrations'

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

type Row = { id: string; recording_id: string; time_ms: number; label: string | null; color: string | null }

function rows(db: Database.Database): Row[] {
  return db
    .prepare('SELECT id, recording_id, time_ms, label, color FROM rec_markers ORDER BY time_ms')
    .all() as Row[]
}

describe('migrateMarkersFromLegacyStore', () => {
  let db: Database.Database
  let userData: string

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'leaf-markers-migration-'))
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

  it('markers.json 导入 rec_markers：秒 → 毫秒、color 落列、id 保留', () => {
    writeFileSync(
      join(userData, 'markers.json'),
      JSON.stringify({
        'rec-a': [
          { id: 'm1', timestamp: 65.5, label: '章节1', color: '#ff4444', recordingId: 'rec-a' },
          { id: 'm2', timestamp: 10, label: '开头' }
        ],
        'rec-b': [{ id: 'm3', timestamp: 120, label: '', recordingId: 'rec-b' }]
      }),
      'utf-8'
    )
    migrateMarkersFromLegacyStore()
    const all = rows(db)
    expect(all).toHaveLength(3)
    expect(all.find((r) => r.id === 'm1')).toMatchObject({
      recording_id: 'rec-a',
      time_ms: 65500,
      label: '章节1',
      color: '#ff4444'
    })
    expect(all.find((r) => r.id === 'm2')).toMatchObject({ recording_id: 'rec-a', time_ms: 10000 })
    expect(all.find((r) => r.id === 'm3')).toMatchObject({ recording_id: 'rec-b', time_ms: 120000 })
  })

  it('无 markers.json 不抛错、不写数据', () => {
    expect(() => migrateMarkersFromLegacyStore()).not.toThrow()
    expect(rows(db)).toHaveLength(0)
  })

  it('幂等：二次运行不重复导入', () => {
    writeFileSync(
      join(userData, 'markers.json'),
      JSON.stringify({ 'rec-a': [{ id: 'm1', timestamp: 5, label: 'x' }] }),
      'utf-8'
    )
    migrateMarkersFromLegacyStore()
    migrateMarkersFromLegacyStore()
    expect(rows(db)).toHaveLength(1)
  })
})
