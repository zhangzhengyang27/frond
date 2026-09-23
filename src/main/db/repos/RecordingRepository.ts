/**
 * Frond · RecordingRepository
 *
 * 职责：管理 rec_recordings 主表（屏幕录制历史与当前录制）。
 *
 * Schema（008 之后的最终形态）：
 *   rec_recordings(
 *     id, file_path, file_name,
 *     duration_ms, file_size, width, height, fps,
 *     has_camera, has_mic, has_system_audio,
 *     status, error_message,
 *     quality, cursor_style,
 *     started_at, ended_at, recovered_at,
 *     thumbnail_path, description,
 *     updated_at, deleted_at
 *   )
 *
 * status 枚举（业务层保证；SQLite CHECK 未加，详见 008 注释）：
 *   'recording' | 'paused' | 'completed' | 'failed' | 'recovered'
 *
 * 设计要点：
 * - id 用 UUIDv4（与 photo_* / snip_* 等一致）；旧 JSON id (timestamp+random) 不兼容，
 *   迁移由 RecordingHistoryServiceLegacy.addHistory() 在调用时双写生成
 * - file_path 用绝对路径；partial 时为 *.partial.mp4
 * - 不在 Repository 层做 ffmpeg 调用；fsm 状态机由调用方驱动
 */

import type Database from 'better-sqlite3'
import { database } from '../database'
import { now, mustGet, likeContains } from '../repo'

export type RecordingStatus = 'recording' | 'paused' | 'completed' | 'failed' | 'recovered'

export type RecordingQuality = 'low' | 'medium' | 'high' | 'source'

export type CursorStyle = 'halo' | 'highlight' | 'click-ring'

export interface RecordingRow {
  id: string
  file_path: string
  file_name: string
  duration_ms: number
  file_size: number
  width: number | null
  height: number | null
  fps: number
  has_camera: number
  has_mic: number
  has_system_audio: number
  status: RecordingStatus
  error_message: string | null
  quality: RecordingQuality
  cursor_style: CursorStyle | null
  started_at: number
  ended_at: number | null
  recovered_at: number | null
  thumbnail_path: string | null
  description: string | null
  updated_at: number
  deleted_at: number | null
}

export interface RecordingFilter {
  status?: RecordingStatus | RecordingStatus[]
  excludeStatus?: RecordingStatus | RecordingStatus[]
  search?: string
  sinceMs?: number
  untilMs?: number
}

export interface ListOptions {
  filter?: RecordingFilter
  limit?: number
  offset?: number
  orderBy?: 'started_at' | 'duration_ms' | 'file_size'
  orderDir?: 'ASC' | 'DESC'
}

export class RecordingRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  /**
   * 取一行；不存在抛 NotFound
   */
  get(id: string): RecordingRow {
    const row = this.db
      .prepare(`SELECT * FROM rec_recordings WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as RecordingRow | undefined
    return mustGet(row, 'recording', id)
  }

  /**
   * 取一行；不存在返回 null
   */
  findById(id: string): RecordingRow | null {
    const row = this.db
      .prepare(`SELECT * FROM rec_recordings WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as RecordingRow | undefined
    return row ?? null
  }

  /**
   * 列表 + 过滤 + 排序 + 分页
   * 默认按 started_at DESC，取最近 100 条
   */
  list(opts: ListOptions = {}): RecordingRow[] {
    const where: string[] = ['deleted_at IS NULL']
    const params: unknown[] = []

    const filter = opts.filter ?? {}
    if (filter.status) {
      const list = Array.isArray(filter.status) ? filter.status : [filter.status]
      where.push(`status IN (${list.map(() => '?').join(',')})`)
      params.push(...list)
    }
    if (filter.excludeStatus) {
      const list = Array.isArray(filter.excludeStatus)
        ? filter.excludeStatus
        : [filter.excludeStatus]
      where.push(`status NOT IN (${list.map(() => '?').join(',')})`)
      params.push(...list)
    }
    if (filter.search) {
      where.push(`(file_name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')`)
      const q = likeContains(filter.search)
      params.push(q, q)
    }
    if (typeof filter.sinceMs === 'number') {
      where.push(`started_at >= ?`)
      params.push(filter.sinceMs)
    }
    if (typeof filter.untilMs === 'number') {
      where.push(`started_at <= ?`)
      params.push(filter.untilMs)
    }

    const orderCol = opts.orderBy ?? 'started_at'
    const orderDir = opts.orderDir ?? 'DESC'
    const limit = opts.limit ?? 100
    const offset = opts.offset ?? 0

    const sql = `SELECT * FROM rec_recordings
                 WHERE ${where.join(' AND ')}
                 ORDER BY ${orderCol} ${orderDir}
                 LIMIT ? OFFSET ?`
    return this.db.prepare(sql).all(...params, limit, offset) as RecordingRow[]
  }

  /**
   * 计数（用于 UI 角标 / 列表 paging）
   */
  count(filter: RecordingFilter = {}): number {
    const where: string[] = ['deleted_at IS NULL']
    const params: unknown[] = []
    if (filter.status) {
      const list = Array.isArray(filter.status) ? filter.status : [filter.status]
      where.push(`status IN (${list.map(() => '?').join(',')})`)
      params.push(...list)
    }
    if (filter.excludeStatus) {
      const list = Array.isArray(filter.excludeStatus)
        ? filter.excludeStatus
        : [filter.excludeStatus]
      where.push(`status NOT IN (${list.map(() => '?').join(',')})`)
      params.push(...list)
    }
    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM rec_recordings WHERE ${where.join(' AND ')}`)
      .get(...params) as { n: number }
    return row.n
  }

  /**
   * 插入一条新录制（开始录制时调用）。返回新行的快照。
   *
   * 设计：
   * - id 由调用方传入（UUIDv4）；不在 Repository 内生成，便于 renderer 提前获知
   * - status 默认 'recording'（业务层传入也会被覆盖）
   * - created_at 列在 001 没建——008 也没补：rec_recordings 没有 created_at，
   *   用 started_at 充当；updated_at 由 onUpdate 内部维护
   */
  insert(row: {
    id: string
    file_path: string
    file_name: string
    duration_ms?: number // PR-2：迁移路径从 JSON duration(秒) × 1000
    file_size?: number
    width?: number | null
    height?: number | null
    fps?: number
    has_camera?: boolean
    has_mic?: boolean
    has_system_audio?: boolean
    quality?: RecordingQuality
    cursor_style?: CursorStyle | null
    description?: string | null
    started_at?: number
    ended_at?: number | null
    status?: RecordingStatus
    thumbnail_path?: string | null // PR-2 新增：迁移路径回填缩略图
  }): RecordingRow {
    const ts = row.started_at ?? now()
    this.db
      .prepare(
        `INSERT INTO rec_recordings (
            id, file_path, file_name,
            duration_ms, file_size,
            width, height, fps,
            has_camera, has_mic, has_system_audio,
            status, quality, cursor_style, description,
            started_at, ended_at, updated_at, thumbnail_path
          ) VALUES (
            ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?
          )`
      )
      .run(
        row.id,
        row.file_path,
        row.file_name,
        row.duration_ms ?? 0,
        row.file_size ?? 0,
        row.width ?? null,
        row.height ?? null,
        row.fps ?? 30,
        row.has_camera ? 1 : 0,
        row.has_mic ? 1 : 0,
        row.has_system_audio ? 1 : 0,
        row.status ?? 'recording',
        row.quality ?? 'medium',
        row.cursor_style ?? null,
        row.description ?? null,
        ts,
        row.ended_at ?? null,
        ts,
        row.thumbnail_path ?? null
      )
    return mustGet(
      this.findById(row.id) as RecordingRow | undefined,
      'recording (after insert)',
      row.id
    )
  }

  /**
   * 更新最终结果（停止录制时调用）
   */
  finalize(
    id: string,
    patch: {
      duration_ms: number
      file_size: number
      file_path?: string // PR-3: 停止时回填实际写入路径（saveFile 时才有）
      ended_at?: number
      status?: RecordingStatus
      error_message?: string | null
      thumbnail_path?: string | null
      description?: string | null
    }
  ): void {
    const r = this.findById(id)
    if (!r) throw new Error(`[RecordingRepository] finalize: not found ${id}`)
    const ts = patch.ended_at ?? now()
    this.db
      .prepare(
        `UPDATE rec_recordings
         SET duration_ms   = ?,
             file_size     = ?,
             file_path     = COALESCE(?, file_path),
             ended_at      = ?,
             status        = ?,
             error_message = COALESCE(?, error_message),
             thumbnail_path = COALESCE(?, thumbnail_path),
             description   = COALESCE(?, description),
             updated_at    = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(
        patch.duration_ms,
        patch.file_size,
        patch.file_path ?? null,
        ts,
        patch.status ?? 'completed',
        patch.error_message ?? null,
        patch.thumbnail_path ?? null,
        patch.description ?? null,
        ts,
        id
      )
  }

  /**
   * 状态切换（pause / resume / failed 等）。
   * 不动 duration_ms / file_size / ended_at。
   */
  setStatus(id: string, status: RecordingStatus, errorMessage?: string | null): void {
    const r = this.findById(id)
    if (!r) throw new Error(`[RecordingRepository] setStatus: not found ${id}`)
    this.db
      .prepare(
        `UPDATE rec_recordings
         SET status        = ?,
             error_message = COALESCE(?, error_message),
             updated_at    = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(status, errorMessage ?? null, now(), id)
  }

  /**
   * 软删除（Library 删除按钮）
   */
  softDelete(id: string): boolean {
    const r = this.db
      .prepare(
        `UPDATE rec_recordings
         SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(now(), now(), id)
    return r.changes > 0
  }

  /**
   * 硬删除（含级联 rec_markers / rec_segments）
   * 谨慎：物理文件由调用方另行处理
   */
  hardDelete(id: string): boolean {
    // FK 级联只覆盖 rec_segments（008 声明了外键）；rec_markers 建表时（001）没有
    // 外键，子行必须显式删除，否则成孤儿。rec_clips 已随 027 下线，不再清理。
    let changes = 0
    const tx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM rec_markers WHERE recording_id = ?`).run(id)
      this.db.prepare(`DELETE FROM rec_segments WHERE recording_id = ?`).run(id)
      changes = this.db.prepare(`DELETE FROM rec_recordings WHERE id = ?`).run(id).changes
    })
    tx()
    return changes > 0
  }

  /**
   * 找出所有 status='recording' 的行（启动扫描 / 崩溃恢复用）
   */
  findInProgress(): RecordingRow[] {
    return this.db
      .prepare(
        `SELECT * FROM rec_recordings
         WHERE status IN ('recording','paused') AND deleted_at IS NULL`
      )
      .all() as RecordingRow[]
  }

  /**
   * 标记恢复成功（orphan → recovered）
   */
  markRecovered(id: string, endedAt?: number): void {
    this.db
      .prepare(
        `UPDATE rec_recordings
         SET status        = 'recovered',
             recovered_at  = ?,
             ended_at      = COALESCE(?, ended_at),
             updated_at    = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(now(), endedAt ?? null, now(), id)
  }

  /**
   * 扫描存量的 orphan 标记：file_path 以 .partial.mp4 结尾且 status != 'recovered'
   * 用于 RecoveryManager.scan 之外的快速查询
   */
  findOrphanCandidates(): RecordingRow[] {
    return this.db
      .prepare(
        `SELECT * FROM rec_recordings
         WHERE file_path LIKE '%.partial.mp4'
           AND deleted_at IS NULL
         ORDER BY started_at DESC`
      )
      .all() as RecordingRow[]
  }
}

export const recordingRepository = new RecordingRepository()

