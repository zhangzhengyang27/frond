import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * RecordingSettingsDataStore 行为回归（存储迁到 pref 'recording.settings' 后）。
 * 覆盖：默认值、预设应用、更新持久化、投影双写仍同步 recording.default。
 */
const __userData = join(mkdtempSync(join(tmpdir(), 'frond-recset-store-')), 'userData')
vi.mock('electron', () => ({
  app: { getPath: () => __userData, getVersion: () => '0.0.0-test', isReady: () => true },
  ipcMain: { handle: () => {} }
}))

import Database from 'better-sqlite3'
import { migrations } from '../../db/migrations'
import { database } from '../../db/database'
import {
  RecordingSettingsDataStore,
  QUALITY_PRESETS
} from '../RecordingSettingsDataStore'

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

describe('RecordingSettingsDataStore（SQLite 存储）', () => {
  let db: Database.Database
  let store: RecordingSettingsDataStore

  beforeEach(() => {
    db = freshDb()
    injectDb(db)
    store = new RecordingSettingsDataStore()
  })

  afterEach(() => {
    injectDb(new Database(':memory:'))
    db.close()
  })

  it('无存值时返回默认设置', () => {
    const s = store.getSettings()
    expect(s.fps).toBe(30)
    expect(s.encoder).toBe('vp9')
    expect(s.resolution).toEqual({ width: 1920, height: 1080 })
  })

  it('updateSettings 持久化全量字段并应用质量预设', () => {
    const updated = store.updateSettings({ quality: 'high' })
    expect(updated.fps).toBe(QUALITY_PRESETS.high.fps)
    expect(updated.bitrate).toBe(QUALITY_PRESETS.high.bitrate)

    // 新实例（重新加载）读到持久化值
    const reloaded = new RecordingSettingsDataStore().getSettings()
    expect(reloaded.quality).toBe('high')
    expect(reloaded.bitrate).toBe(QUALITY_PRESETS.high.bitrate)
  })

  it('投影双写仍同步 recording.default（typed 视图）', () => {
    store.updateSettings({ fps: 60, audioEnabled: true })
    const row = db
      .prepare('SELECT value FROM pref_preferences WHERE key = ?')
      .get('recording.default') as { value: string } | undefined
    const projection = JSON.parse(row?.value ?? '{}') as { fps?: number; hasMic?: boolean }
    expect(projection.fps).toBe(60)
    expect(projection.hasMic).toBe(true)
  })

  it('resetToDefaults 恢复默认并持久化', () => {
    store.updateSettings({ fps: 60 })
    const reset = store.resetToDefaults()
    expect(reset.fps).toBe(30)
    expect(new RecordingSettingsDataStore().getSettings().fps).toBe(30)
  })
})
