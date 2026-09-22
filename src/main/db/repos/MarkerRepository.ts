/**
 * Leaf · MarkerRepository
 *
 * 职责：管理 rec_markers 表（录制时间点标记）。
 *
 * Schema（001 建表 + 026 追加 color 列）：
 *   rec_markers(id, recording_id, time_ms, label, color, created_at)
 * - time_ms 相对录制起点（秒 ↔ 毫秒的换算在 MarkerService 里做）
 * - label / color 可空；旧 JSON 标记系统与本表并存的历史见 services/MarkerService.ts
 */

import type Database from 'better-sqlite3'
import { database } from '../database'
import { now, mustGet } from '../repo'

export interface MarkerRow {
  id: string
  recording_id: string
  time_ms: number
  label: string | null
  color: string | null
  created_at: number
}

const SELECT_MARKER = `SELECT id, recording_id, time_ms, label, color, created_at
         FROM rec_markers`

export class MarkerRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  listByRecording(recordingId: string): MarkerRow[] {
    return this.db
      .prepare(`${SELECT_MARKER}
         WHERE recording_id = ?
         ORDER BY time_ms ASC`)
      .all(recordingId) as MarkerRow[]
  }

  get(id: string): MarkerRow {
    const row = this.db
      .prepare(`${SELECT_MARKER} WHERE id = ?`)
      .get(id) as MarkerRow | undefined
    return mustGet(row, 'marker', id)
  }

  add(input: {
    id: string
    recording_id: string
    time_ms: number
    label?: string | null
    color?: string | null
  }): MarkerRow {
    const ts = now()
    this.db
      .prepare(
        `INSERT INTO rec_markers (id, recording_id, time_ms, label, color, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(input.id, input.recording_id, input.time_ms, input.label ?? null, input.color ?? null, ts)
    return this.get(input.id)
  }

  /** 只改传进来的列；无任何字段可改时不动库，返回该行是否存在 */
  update(
    id: string,
    fields: { timeMs?: number; label?: string | null; color?: string | null }
  ): boolean {
    const sets: string[] = []
    const values: (number | string | null)[] = []
    if (fields.timeMs !== undefined) {
      sets.push('time_ms = ?')
      values.push(fields.timeMs)
    }
    if (fields.label !== undefined) {
      sets.push('label = ?')
      values.push(fields.label)
    }
    if (fields.color !== undefined) {
      sets.push('color = ?')
      values.push(fields.color)
    }
    if (!sets.length) return !!this.db.prepare(`SELECT 1 FROM rec_markers WHERE id = ?`).get(id)
    values.push(id)
    const r = this.db
      .prepare(`UPDATE rec_markers SET ${sets.join(', ')} WHERE id = ?`)
      .run(...values)
    return r.changes > 0
  }

  remove(id: string): boolean {
    const r = this.db.prepare(`DELETE FROM rec_markers WHERE id = ?`).run(id)
    return r.changes > 0
  }

  removeAllForRecording(recordingId: string): number {
    const r = this.db.prepare(`DELETE FROM rec_markers WHERE recording_id = ?`).run(recordingId)
    return r.changes
  }

  /** 录制合并 / 换身时用：把 from 的标记整体挪到 to，返回挪动条数 */
  reassignRecording(fromRecordingId: string, toRecordingId: string): number {
    const r = this.db
      .prepare(`UPDATE rec_markers SET recording_id = ? WHERE recording_id = ?`)
      .run(toRecordingId, fromRecordingId)
    return r.changes
  }

  rename(id: string, label: string): boolean {
    const r = this.db.prepare(`UPDATE rec_markers SET label = ? WHERE id = ?`).run(label, id)
    return r.changes > 0
  }
}

export const markerRepository = new MarkerRepository()
