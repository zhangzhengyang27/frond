/**
 * Frond · ShotIndexRepository — 截图库 OCR 索引（V4 P1-10，migration 029）
 *
 * shot_index 表：文件系统上真实存在的截图（不捕捉、不复制，file_path 为绝对路径），
 * OCR 文本在主进程后台回填（ocr_status: pending | done | failed）。
 *
 * 业务接口：
 * - upsert(rows)              扫描结果入库（覆盖 mtime/captured_at，OCR 状态保留）
 * - prune(keepPaths)          清理文件已消失的行
 * - getPending(limit)         拉待 OCR 的行
 * - updateOcr(path, ...)      回填 OCR 结果
 * - search(filter, limit)     name:/text:/date: 过滤 + 自由文本（见 parseShotQuery）
 * - latest()                  最新一张（粘贴最近截图用）
 * - stats()                   索引状态（总数 / 各 OCR 状态计数）
 * - count()                   行数
 */

import type Database from 'better-sqlite3'
import { database } from '../database'

export type ShotOcrStatus = 'pending' | 'done' | 'failed'

export interface ShotRow {
  filePath: string
  fileName: string
  fileSize: number
  mtime: number
  capturedAt: number
  ocrStatus: ShotOcrStatus
  ocrText: string | null
}

export interface ShotSearchFilter {
  /** 自由文本：匹配文件名或 OCR 文本 */
  q?: string
  /** 仅匹配文件名（name: 前缀） */
  name?: string
  /** 仅匹配 OCR 文本（text: 前缀） */
  text?: string
  /** 捕获时间下限（date: 解析结果，unix ms） */
  since?: number
}

export class ShotIndexRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  upsert(rows: Array<Omit<ShotRow, 'ocrStatus' | 'ocrText'>>): void {
    const stmt = this.db.prepare(
      `INSERT INTO shot_index (file_path, file_name, file_size, mtime, captured_at, ocr_status)
       VALUES (?, ?, ?, ?, ?, 'pending')
       ON CONFLICT(file_path) DO UPDATE SET
         file_name = excluded.file_name,
         file_size = excluded.file_size,
         mtime = excluded.mtime`
    )
    const tx = this.db.transaction((batch: Array<Omit<ShotRow, 'ocrStatus' | 'ocrText'>>) => {
      for (const r of batch) {
        stmt.run(r.filePath, r.fileName, r.fileSize, r.mtime, r.capturedAt)
      }
    })
    tx(rows)
  }

  /** 文件已消失的行清掉；返回删除数 */
  prune(keepPaths: Set<string>): number {
    const all = this.db.prepare('SELECT file_path FROM shot_index').all() as Array<{
      file_path: string
    }>
    const gone = all.filter((r) => !keepPaths.has(r.file_path)).map((r) => r.file_path)
    const del = this.db.prepare('DELETE FROM shot_index WHERE file_path = ?')
    const tx = this.db.transaction((paths: string[]) => {
      for (const p of paths) del.run(p)
    })
    tx(gone)
    return gone.length
  }

  getPending(limit: number): Array<{ filePath: string }> {
    return this.db
      .prepare(
        `SELECT file_path AS filePath FROM shot_index
         WHERE ocr_status = 'pending' ORDER BY captured_at DESC LIMIT ?`
      )
      .all(limit) as Array<{ filePath: string }>
  }

  updateOcr(filePath: string, status: ShotOcrStatus, ocrText: string | null): void {
    this.db
      .prepare('UPDATE shot_index SET ocr_status = ?, ocr_text = ? WHERE file_path = ?')
      .run(status, ocrText, filePath)
  }

  search(filter: ShotSearchFilter, limit: number): ShotRow[] {
    const where: string[] = []
    const params: Array<string | number> = []
    if (filter.name) {
      where.push('file_name LIKE ?')
      params.push(`%${filter.name}%`)
    }
    if (filter.text) {
      where.push('ocr_text LIKE ?')
      params.push(`%${filter.text}%`)
    }
    if (filter.q) {
      where.push('(file_name LIKE ? OR ocr_text LIKE ?)')
      params.push(`%${filter.q}%`, `%${filter.q}%`)
    }
    if (filter.since !== undefined) {
      where.push('captured_at >= ?')
      params.push(filter.since)
    }
    const sql = `SELECT file_path AS filePath, file_name AS fileName, file_size AS fileSize,
        mtime, captured_at AS capturedAt, ocr_status AS ocrStatus, ocr_text AS ocrText
      FROM shot_index
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY captured_at DESC LIMIT ?`
    return this.db.prepare(sql).all(...params, limit) as unknown as ShotRow[]
  }

  latest(): ShotRow | null {
    return (
      (this.db
        .prepare(
          `SELECT file_path AS filePath, file_name AS fileName, file_size AS fileSize,
              mtime, captured_at AS capturedAt, ocr_status AS ocrStatus, ocr_text AS ocrText
           FROM shot_index ORDER BY captured_at DESC LIMIT 1`
        )
        .get() as ShotRow | undefined) ?? null
    )
  }

  stats(): { total: number; pending: number; done: number; failed: number } {
    const rows = this.db
      .prepare('SELECT ocr_status AS s, COUNT(*) AS n FROM shot_index GROUP BY ocr_status')
      .all() as Array<{ s: string; n: number }>
    const out = { total: 0, pending: 0, done: 0, failed: 0 }
    for (const r of rows) {
      const n = Number(r.n)
      out.total += n
      if (r.s === 'pending') out.pending = n
      else if (r.s === 'done') out.done = n
      else if (r.s === 'failed') out.failed = n
    }
    return out
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM shot_index').get() as { n: number }
    return Number(row.n)
  }
}

export const shotIndexRepository = new ShotIndexRepository()
