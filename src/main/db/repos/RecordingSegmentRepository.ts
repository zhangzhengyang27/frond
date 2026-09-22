/**
 * Leaf · RecordingSegmentRepository
 *
 * 职责：管理 rec_segments 表（暂停分片记录）。
 * 用于：状态机切换 pause/resume 时记录分段，让 UI / 最终时长统计能识别「实际录制时长」。
 *
 * Schema（008 新建）：
 *   rec_segments(
 *     id, recording_id, seg_index, started_at, ended_at, state,
 *     UNIQUE(recording_id, seg_index),
 *     FK -> rec_recordings(id) ON DELETE CASCADE
 *   )
 *
 * state 枚举：'committed'（已完成的分片） | 'discarded'（失败/异常关闭丢弃的分片）
 *
 * 设计要点：
 * - seg_index 单调递增：recording 开始时 0，每次 resume 增 1
 * - 不在 Repository 层做 segment 计算，由 RecordingEngine 状态机驱动
 * - ended_at 为 null 表示分片仍在进行中
 */

import type Database from 'better-sqlite3'
import { database } from '../database'
import { now, mustGet } from '../repo'

export type SegmentState = 'committed' | 'discarded'

export interface SegmentRow {
  id: number
  recording_id: string
  seg_index: number
  started_at: number
  ended_at: number | null
  state: SegmentState
}

export class RecordingSegmentRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  /** 打开新分片（resume 时调用），返回新行的 row */
  open(recordingId: string): SegmentRow {
    // 计算下一个 seg_index
    const row = this.db
      .prepare(
        `SELECT COALESCE(MAX(seg_index), -1) AS max_idx
         FROM rec_segments WHERE recording_id = ?`
      )
      .get(recordingId) as { max_idx: number }
    const segIndex = row.max_idx + 1
    const ts = now()

    this.db
      .prepare(
        `INSERT INTO rec_segments (recording_id, seg_index, started_at, state)
         VALUES (?, ?, ?, 'committed')`
      )
      .run(recordingId, segIndex, ts)

    const inserted = this.db
      .prepare(
        `SELECT * FROM rec_segments
         WHERE recording_id = ? AND seg_index = ?`
      )
      .get(recordingId, segIndex) as SegmentRow | undefined
    return mustGet(inserted, 'rec_segment', `${recordingId}#${segIndex}`)
  }

  /** 关闭当前分片（pause / stop 时调用） */
  close(segmentId: number, endedAt?: number): void {
    const ts = endedAt ?? now()
    const r = this.db
      .prepare(`UPDATE rec_segments SET ended_at = ? WHERE id = ? AND ended_at IS NULL`)
      .run(ts, segmentId)
    if (r.changes === 0) {
      // 已经被关闭，幂等，不抛错
    }
  }

  /** 列出某录制的所有分片（按 seg_index 升序） */
  listByRecording(recordingId: string): SegmentRow[] {
    return this.db
      .prepare(
        `SELECT * FROM rec_segments
         WHERE recording_id = ?
         ORDER BY seg_index ASC`
      )
      .all(recordingId) as SegmentRow[]
  }

  /** 当前正在进行的分片（ended_at IS NULL） */
  findOpen(recordingId: string): SegmentRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM rec_segments
         WHERE recording_id = ? AND ended_at IS NULL
         ORDER BY seg_index DESC LIMIT 1`
      )
      .get(recordingId) as SegmentRow | undefined
    return row ?? null
  }

  /**
   * 计算实际录制时长（扣除 paused 间隔）。
   * 返回每个 committed 分片的 (ended_at - started_at) 之和。
   * 仍未关闭的分片按 now() - started_at 计算（用于 status 实时显示）。
   */
  totalDurationMs(recordingId: string, asOf?: number): number {
    const ref = asOf ?? now()
    const rows = this.listByRecording(recordingId)
    let total = 0
    for (const s of rows) {
      if (s.state !== 'committed') continue
      const end = s.ended_at ?? ref
      if (end > s.started_at) total += end - s.started_at
    }
    return total
  }

  /**
   * 把所有未关闭的分片标记为 discarded（异常退出：app crash / kill -9 时用）
   * 返回被标记的行数
   */
  discardOpen(recordingId: string): number {
    const r = this.db
      .prepare(
        `UPDATE rec_segments SET state = 'discarded', ended_at = ?
         WHERE recording_id = ? AND ended_at IS NULL`
      )
      .run(now(), recordingId)
    return r.changes
  }

  /**
   * 删除某录制的所有分片（hardDelete 时级联，但有时单独调用）
   */
  removeAllForRecording(recordingId: string): number {
    const r = this.db.prepare(`DELETE FROM rec_segments WHERE recording_id = ?`).run(recordingId)
    return r.changes
  }
}

export const recordingSegmentRepository = new RecordingSegmentRepository()
