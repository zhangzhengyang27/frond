import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'

/**
 * MarkerService 回归（存储收敛到 rec_markers 后）。
 * 关键语义保持：对外 timestamp 单位秒（存储 time_ms 毫秒）、归属校验、
 * 迁移标记（录制保存时临时 ID → 正式 ID）。
 */
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/frond-marker-service-test', getVersion: () => '0.0.0-test', isReady: () => true },
  ipcMain: { handle: () => {} }
}))

import { migrations } from '../../db/migrations'
import { database } from '../../db/database'
import { MarkerService } from '../MarkerService'

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

describe('MarkerService（rec_markers 存储）', () => {
  let db: Database.Database
  let service: MarkerService

  beforeEach(() => {
    db = freshDb()
    injectDb(db)
    service = MarkerService.getInstance()
  })

  afterEach(() => {
    injectDb(new Database(':memory:'))
    db.close()
  })

  it('add → get 往返：秒转毫秒落库、默认颜色、按时间排序', () => {
    service.addMarker('rec-1', 5, '开头')
    service.addMarker('rec-1', 65, '章节')
    const markers = service.getMarkers('rec-1')
    expect(markers).toHaveLength(2)
    expect(markers[0].timestamp).toBe(5)
    expect(markers[1].timestamp).toBe(65)
    expect(markers[0].color).toBe('#ff4444')
    // 落库毫秒
    const row = db.prepare('SELECT time_ms FROM rec_markers WHERE id = ?').get(markers[0].id) as {
      time_ms: number
    }
    expect(row.time_ms).toBe(5000)
  })

  it('updateMarker 支持 timestamp/label/color', () => {
    const m = service.addMarker('rec-1', 10, '旧')
    const updated = service.updateMarker('rec-1', m.id, {
      timestamp: 20,
      label: '新',
      color: '#00ff00'
    })
    expect(updated?.timestamp).toBe(20)
    expect(updated?.label).toBe('新')
    expect(updated?.color).toBe('#00ff00')
  })

  it('归属校验：不能操作其他 recordingId 的标记', () => {
    const m = service.addMarker('rec-1', 10)
    expect(service.removeMarker('rec-2', m.id)).toBe(false)
    expect(service.updateMarker('rec-2', m.id, { label: 'x' })).toBeNull()
    expect(service.removeMarker('rec-1', m.id)).toBe(true)
  })

  it('migrateMarkers：临时 ID 的标记整体转正', () => {
    service.addMarker('temp-1', 3)
    service.addMarker('temp-1', 7)
    expect(service.migrateMarkers('temp-1', 'rec-final')).toBe(true)
    expect(service.getMarkers('temp-1')).toHaveLength(0)
    expect(service.getMarkers('rec-final')).toHaveLength(2)
  })

  it('clearMarkers 与 exportToCSV', () => {
    service.addMarker('rec-1', 61.5, '一分')
    const csv = service.exportToCSV('rec-1')
    expect(csv).toContain('01:01.5'.replace('.5', '') + '')
    expect(csv).toContain('一分')
    service.clearMarkers('rec-1')
    expect(service.getMarkers('rec-1')).toHaveLength(0)
  })
})
