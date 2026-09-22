/**
 * Leaf · ScreenshotRepository
 *
 * 截图历史记录管理
 *
 * Schema: ss_screenshots (已在 001_init.ts 中定义)
 */

import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { database } from '../database'
import { now, likeContains } from '../repo'

export interface Screenshot {
  id: string
  filePath: string
  fileName: string
  fileSize: number
  width: number | null
  height: number | null
  captureMode: 'screen' | 'window' | 'region'
  capturedAt: number
  updatedAt: number
  hash: string | null
  isOcrDone: boolean
  ocrText: string | null
}

interface ScreenshotRow {
  id: string
  file_path: string
  file_name: string
  file_size: number
  width: number | null
  height: number | null
  capture_mode: string
  captured_at: number
  updated_at: number
  hash: string | null
  is_ocr_done: number
  ocr_text: string | null
  deleted_at: number | null
}

export interface ScreenshotFilter {
  search?: string
  sinceMs?: number
  untilMs?: number
  captureMode?: 'screen' | 'window' | 'region'
}

export interface ListOptions {
  limit?: number
  offset?: number
}

export class ScreenshotRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  private fromRow(row: ScreenshotRow): Screenshot {
    return {
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      fileSize: row.file_size,
      width: row.width,
      height: row.height,
      captureMode: row.capture_mode as 'screen' | 'window' | 'region',
      capturedAt: row.captured_at,
      updatedAt: row.updated_at,
      hash: row.hash,
      isOcrDone: row.is_ocr_done === 1,
      ocrText: row.ocr_text
    }
  }

  /** 获取所有截图（按时间倒序） */
  getAll(options?: ListOptions): Screenshot[] {
    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0
    const rows = this.db
      .prepare(
        `SELECT * FROM ss_screenshots
         WHERE deleted_at IS NULL
         ORDER BY captured_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as ScreenshotRow[]
    return rows.map((r) => this.fromRow(r))
  }

  /** 按条件筛选截图 */
  list(filter?: ScreenshotFilter, options?: ListOptions): Screenshot[] {
    const conditions: string[] = ['deleted_at IS NULL']
    const params: (string | number)[] = []

    if (filter?.search) {
      conditions.push(`(file_name LIKE ? ESCAPE '\\' OR ocr_text LIKE ? ESCAPE '\\')`)
      const like = likeContains(filter.search)
      params.push(like, like)
    }

    if (filter?.sinceMs) {
      conditions.push(`captured_at >= ?`)
      params.push(filter.sinceMs)
    }

    if (filter?.untilMs) {
      conditions.push(`captured_at <= ?`)
      params.push(filter.untilMs)
    }

    if (filter?.captureMode) {
      conditions.push(`capture_mode = ?`)
      params.push(filter.captureMode)
    }

    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0

    const sql = `SELECT * FROM ss_screenshots
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY captured_at DESC
                 LIMIT ? OFFSET ?`

    const rows = this.db.prepare(sql).all(...params, limit, offset) as ScreenshotRow[]
    return rows.map((r) => this.fromRow(r))
  }

  /** 获取总数 */
  count(filter?: ScreenshotFilter): number {
    const conditions: string[] = ['deleted_at IS NULL']
    const params: (string | number)[] = []

    if (filter?.search) {
      conditions.push(`(file_name LIKE ? ESCAPE '\\' OR ocr_text LIKE ? ESCAPE '\\')`)
      const like = likeContains(filter.search)
      params.push(like, like)
    }

    if (filter?.sinceMs) {
      conditions.push(`captured_at >= ?`)
      params.push(filter.sinceMs)
    }

    if (filter?.untilMs) {
      conditions.push(`captured_at <= ?`)
      params.push(filter.untilMs)
    }

    const sql = `SELECT COUNT(*) as count FROM ss_screenshots WHERE ${conditions.join(' AND ')}`
    const row = this.db.prepare(sql).get(...params) as { count: number }
    return row.count
  }

  /** 按 ID 获取 */
  getById(id: string): Screenshot | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ss_screenshots WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as ScreenshotRow | undefined
    return row ? this.fromRow(row) : undefined
  }

  /** 添加截图记录 */
  add(params: {
    filePath: string
    fileName: string
    fileSize: number
    width?: number
    height?: number
    captureMode?: 'screen' | 'window' | 'region'
    hash?: string
  }): Screenshot {
    const id = uuidv4()
    const ts = now()
    const captureMode = params.captureMode ?? 'region'

    this.db
      .prepare(
        `INSERT INTO ss_screenshots
         (id, file_path, file_name, file_size, width, height, capture_mode, captured_at, updated_at, hash, is_ocr_done, ocr_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`
      )
      .run(
        id,
        params.filePath,
        params.fileName,
        params.fileSize,
        params.width ?? null,
        params.height ?? null,
        captureMode,
        ts,
        ts,
        params.hash ?? null
      )

    return this.fromRow({
      id,
      file_path: params.filePath,
      file_name: params.fileName,
      file_size: params.fileSize,
      width: params.width ?? null,
      height: params.height ?? null,
      capture_mode: captureMode,
      captured_at: ts,
      updated_at: ts,
      hash: params.hash ?? null,
      is_ocr_done: 0,
      ocr_text: null,
      deleted_at: null
    })
  }

  /** 更新 OCR 结果 */
  updateOcrResult(id: string, ocrText: string): Screenshot | undefined {
    const ts = now()
    this.db
      .prepare(
        `UPDATE ss_screenshots SET is_ocr_done = 1, ocr_text = ?, updated_at = ? WHERE id = ?`
      )
      .run(ocrText, ts, id)
    return this.getById(id)
  }

  /** 删除截图 */
  delete(id: string): boolean {
    const ts = now()
    const r = this.db
      .prepare(`UPDATE ss_screenshots SET deleted_at = ?, updated_at = ? WHERE id = ?`)
      .run(ts, ts, id)
    return r.changes > 0
  }

  /** 批量删除 */
  deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0

    const ts = now()
    const placeholders = ids.map(() => '?').join(',')

    // 先查询要删除的记录数（deleted_at IS NULL 的记录）
    const countSql = `SELECT COUNT(*) as count FROM ss_screenshots WHERE id IN (${placeholders}) AND deleted_at IS NULL`
    const countRow = this.db.prepare(countSql).get(...ids) as { count: number }
    const deleteCount = countRow.count

    // 执行软删除
    this.db
      .prepare(
        `UPDATE ss_screenshots SET deleted_at = ?, updated_at = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`
      )
      .run(ts, ts, ...ids)

    return deleteCount
  }

  /** 获取最近的截图 */
  getRecent(limit: number = 10): Screenshot[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM ss_screenshots
         WHERE deleted_at IS NULL
         ORDER BY captured_at DESC
         LIMIT ?`
      )
      .all(limit) as ScreenshotRow[]
    return rows.map((r) => this.fromRow(r))
  }

  /** 搜索截图（按 OCR 文本） */
  searchByOcr(query: string, options?: ListOptions): Screenshot[] {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0
    const rows = this.db
      .prepare(
        `SELECT * FROM ss_screenshots
         WHERE deleted_at IS NULL AND is_ocr_done = 1 AND ocr_text LIKE ? ESCAPE '\\'
         ORDER BY captured_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(likeContains(query), limit, offset) as ScreenshotRow[]
    return rows.map((r) => this.fromRow(r))
  }

  /** 计算存储空间使用 */
  getStorageUsage(): { totalSize: number; count: number } {
    const row = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(file_size), 0) as total_size,
           COUNT(*) as count
         FROM ss_screenshots
         WHERE deleted_at IS NULL`
      )
      .get() as { total_size: number; count: number }
    return { totalSize: row.total_size, count: row.count }
  }

  /** 清理旧截图（保留最近 N 条） */
  cleanupKeepRecent(keepCount: number): number {
    // 先获取要保留的 ID
    const keepRows = this.db
      .prepare(
        `SELECT id FROM ss_screenshots
         WHERE deleted_at IS NULL
         ORDER BY captured_at DESC
         LIMIT ?`
      )
      .all(keepCount) as Array<{ id: string }>
    const keepIds = keepRows.map((r) => r.id)

    if (keepIds.length === 0) return 0

    const placeholders = keepIds.map(() => '?').join(',')
    const ts = now()
    const r = this.db
      .prepare(
        `UPDATE ss_screenshots
         SET deleted_at = ?, updated_at = ?
         WHERE deleted_at IS NULL AND id NOT IN (${placeholders})`
      )
      .run(ts, ts, ...keepIds)
    return r.changes
  }

  /**
   * 物理清除软删墓碑行（deleted_at 早于 ts）。
   * 删除流程已把文件一并移除，墓碑只剩 ocr_text 等纯 DB 体积——
   * 不清理的话 ss_screenshots 只增不减。
   */
  purgeDeletedBefore(ts: number): number {
    const r = this.db
      .prepare(`DELETE FROM ss_screenshots WHERE deleted_at IS NOT NULL AND deleted_at < ?`)
      .run(ts)
    return r.changes
  }
}

export const screenshotRepository = new ScreenshotRepository()

