import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 录制设置存储迁移测试：electron-store 专用文件 recording-settings.json
 * 的 settings 键 → pref_preferences 'recording.settings'（全量字段 1:1）。
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
import { migrateRecordingSettingsFromLegacyStore } from '../dataMigrations'

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

function prefSetting(db: Database.Database): string | undefined {
  const row = db.prepare('SELECT value FROM pref_preferences WHERE key = ?').get('recording.settings') as
    | { value: string }
    | undefined
  return row?.value
}

describe('migrateRecordingSettingsFromLegacyStore', () => {
  let db: Database.Database
  let userData: string

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'leaf-recset-migration-'))
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

  it('recording-settings.json 的 settings 全量导入（含 repo 投影没有的字段）', () => {
    writeFileSync(
      join(userData, 'recording-settings.json'),
      JSON.stringify({
        settings: {
          encoder: 'h264',
          quality: 'high',
          bitrate: 10000,
          fps: 60,
          resolution: { width: 1920, height: 1080 },
          format: 'mp4',
          audioEnabled: true,
          audioCodec: 'aac',
          audioBitrate: 192,
          systemAudio: { enabled: true, deviceId: 'dev-1', keepMicrophone: false }
        }
      }),
      'utf-8'
    )
    migrateRecordingSettingsFromLegacyStore()
    expect(JSON.parse(prefSetting(db) ?? '{}')).toMatchObject({
      encoder: 'h264',
      bitrate: 10000,
      format: 'mp4',
      audioCodec: 'aac',
      systemAudio: { enabled: true, deviceId: 'dev-1' }
    })
  })

  it('无文件 / 损坏文件按无旧数据处理', () => {
    writeFileSync(join(userData, 'recording-settings.json'), '{broken', 'utf-8')
    expect(() => migrateRecordingSettingsFromLegacyStore()).not.toThrow()
    expect(prefSetting(db)).toBeUndefined()
  })

  it('幂等：二次运行不覆盖用户新数据', () => {
    writeFileSync(
      join(userData, 'recording-settings.json'),
      JSON.stringify({ settings: { fps: 30 } }),
      'utf-8'
    )
    migrateRecordingSettingsFromLegacyStore()
    db.prepare('UPDATE pref_preferences SET value = ? WHERE key = ?').run(
      JSON.stringify({ fps: 60 }),
      'recording.settings'
    )
    migrateRecordingSettingsFromLegacyStore()
    expect(JSON.parse(prefSetting(db) ?? '{}')).toEqual({ fps: 60 })
  })
})
