/**
 * Leaf · RecoveryManager
 *
 * 职责：处置「未正常收尾」的录制文件（*.partial.mp4）。两类目标：
 *   - DB 有行、磁盘仍是 partial（录制进程被杀）→ recover 时 markRecovered + 改指新路径
 *   - 磁盘有 partial、DB 没行（写库前就崩）→ recover 时新建行
 *
 * 扫描范围不新增配置：以既有行（orphan / in-progress）的 file_path 所在目录，
 * 加用户默认保存目录为限——不为恢复孤儿文件而全盘搜。
 *
 * 注入点：probeDuration / now / generateId 均可替换，单测不必真跑 ffprobe。
 */

import { existsSync, readdirSync, renameSync, statSync, unlinkSync } from 'fs'
import { basename, dirname, join } from 'path'
import { randomUUID } from 'crypto'
import { database } from '../../db/database'
import { now } from '../../db/repo'
import { recordingRepository } from '../../db/repos/RecordingRepository'
import { recordingSettingsRepository } from '../../db/repos/RecordingSettingsRepository'
import { probeDurationSec } from '../../utils/ffmpeg'

/** 录制进程中途留下的分片后缀（正常收尾时会 rename 掉） */
const PARTIAL_SUFFIX = '.partial.mp4'
/** 短于这个时长的残片基本是损坏文件，恢复出来只是噪音 */
const MIN_RECOVER_DURATION_SEC = 1

export interface RecoveryOrphan {
  /** null = 磁盘有文件但 DB 没行（写库前就崩） */
  recordingId: string | null
  filePath: string
  fileSize: number
  mtimeMs: number
}

export interface RecoveryScan {
  orphans: RecoveryOrphan[]
}

export interface RecoveryDeps {
  probeDuration?: (filePath: string) => Promise<number | null>
  now?: () => number
  generateId?: () => string
}

export class RecoveryManager {
  constructor(private readonly deps: RecoveryDeps = {}) {}

  /** 列出待处置的 orphan 文件（IPC 面板的初始数据） */
  scan(): RecoveryScan {
    const orphans: RecoveryOrphan[] = []
    const seen = new Set<string>()
    for (const dir of this.candidateDirs()) {
      let names: string[] = []
      try {
        names = readdirSync(dir)
      } catch {
        // 目录被外部移走：跳过该根，不拖垮整次扫描
        continue
      }
      for (const name of names) {
        if (!name.endsWith(PARTIAL_SUFFIX)) continue
        const filePath = join(dir, name)
        if (seen.has(filePath)) continue
        seen.add(filePath)
        let fileSize = 0
        let mtimeMs = 0
        try {
          const st = statSync(filePath)
          fileSize = st.size
          mtimeMs = st.mtimeMs
        } catch {
          continue
        }
        orphans.push({ recordingId: this.findRowByFileName(name)?.id ?? null, filePath, fileSize, mtimeMs })
      }
    }
    return { orphans }
  }

  /**
   * 恢复一个 orphan
   * - ffprobe 校验时长 ≥ 1s（类注释承诺的校验，旧实现缺失 → 可能恢复损坏残片）
   * - 若 DB 已有 row（status=failed）→ 走 markRecovered + rename
   * - 若 DB 没 row（orphan file）→ 创建新 row（status='recovered'）+ rename
   *
   * 返回新 / 更新的 recordingId；文件不可恢复时抛错（IPC 层转提示）
   */
  async recover(filePath: string): Promise<{ recordingId: string }> {
    if (!existsSync(filePath)) {
      throw new Error(`[RecoveryManager] file not found: ${filePath}`)
    }

    const probe = this.deps.probeDuration ?? probeDurationSec
    const dur = await probe(filePath)
    if (dur == null || dur < MIN_RECOVER_DURATION_SEC) {
      throw new Error(
        `[RecoveryManager] file too short/corrupted to recover (${dur ?? 'unknown'}s): ${filePath}`
      )
    }

    const fileName = basename(filePath)
    const dbRow = this.findRowByFileName(fileName)

    // rename: <name>.partial.mp4 → <name-replace-partial>.mp4
    const newPath = filePath.replace(PARTIAL_SUFFIX, '.mp4')
    renameSync(filePath, newPath)

    if (dbRow) {
      recordingRepository.markRecovered(dbRow.id)
      // 更新 file_path / file_name 指向新路径
      database.handle
        .prepare(
          `UPDATE rec_recordings
           SET file_path = ?, file_name = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(newPath, basename(newPath), this.nowFn(), dbRow.id)
      return { recordingId: dbRow.id }
    }

    // 无 DB 行：创建 recovered 行（最小字段集）
    const id = this.generateId()
    recordingRepository.insert({
      id,
      file_path: newPath,
      file_name: basename(newPath),
      status: 'recording' // insert 后立即 markRecovered
    })
    recordingRepository.markRecovered(id)
    return { recordingId: id }
  }

  /**
   * 丢弃一个 orphan（unlink + 清理关联行）
   */
  discard(rawFilePath: string): { ok: boolean } {
    let filePath: string
    try {
      filePath = this.resolvePartialPathForMutation(rawFilePath)
    } catch {
      return { ok: false }
    }
    if (!existsSync(filePath)) {
      return { ok: false }
    }
    const fileName = basename(filePath)
    const dbRow = this.findRowByFileName(fileName)

    try {
      unlinkSync(filePath)
    } catch {
      return { ok: false }
    }

    if (dbRow) {
      recordingRepository.hardDelete(dbRow.id)
    }
    return { ok: true }
  }

  /** 扫描范围：已有行所在目录 + 用户默认保存目录（只留真实存在的） */
  private candidateDirs(): string[] {
    const dirs = new Set<string>()
    for (const row of recordingRepository.findOrphanCandidates()) dirs.add(dirname(row.file_path))
    for (const row of recordingRepository.findInProgress()) dirs.add(dirname(row.file_path))
    const def = recordingSettingsRepository.get().defaultSavePath
    if (def) dirs.add(def)
    return [...dirs].filter((d) => existsSync(d))
  }

  /**
   * 按文件名找行：DB 里登记的可能是 .mp4，磁盘上却是 .partial.mp4（或反之），
   * 两种写法都要认，否则 recover 会重复建行。
   */
  private findRowByFileName(fileName: string): { id: string } | null {
    const asFinal = fileName.replace(PARTIAL_SUFFIX, '.mp4')
    const asPartial = asFinal.replace(/\.mp4$/, PARTIAL_SUFFIX)
    const row = database.handle
      .prepare(
        `SELECT id FROM rec_recordings
         WHERE deleted_at IS NULL AND (file_name = ? OR file_name = ? OR file_name = ?)
         ORDER BY started_at DESC LIMIT 1`
      )
      .get(fileName, asFinal, asPartial) as { id: string } | undefined
    return row ?? null
  }

  /** 处置只允许落在真实存在的 partial 文件上：显示名指向成品时改指其 .partial 兄弟 */
  private resolvePartialPathForMutation(rawFilePath: string): string {
    if (existsSync(rawFilePath) && rawFilePath.endsWith(PARTIAL_SUFFIX)) return rawFilePath
    const partial = rawFilePath.endsWith(PARTIAL_SUFFIX)
      ? rawFilePath
      : rawFilePath.replace(/\.mp4$/, PARTIAL_SUFFIX)
    if (existsSync(partial)) return partial
    throw new Error(`[RecoveryManager] not a recoverable partial file: ${rawFilePath}`)
  }

  private nowFn(): number {
    return this.deps.now ? this.deps.now() : now()
  }

  private generateId(): string {
    return this.deps.generateId ? this.deps.generateId() : randomUUID()
  }
}

let instance: RecoveryManager | null = null

export function getRecoveryManager(deps?: RecoveryDeps): RecoveryManager {
  instance ??= new RecoveryManager(deps)
  return instance
}
