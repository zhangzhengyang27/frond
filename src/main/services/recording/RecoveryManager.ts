/**
 * Frond · RecoveryManager（B57-1 D4 重写，RECORDING_MEDIABUNNY_DESIGN.md P2）
 *
 * 职责：处置「未正常收尾」的录制（kill -9 / 断电 / 渲染进程崩溃）。
 *
 * D4 扫描去后缀化：主源 = DB 孤儿行（status IN ('recording','paused') 且
 * file_path 真实存在）——旧引擎 webm、新引擎 fMP4 通吃；不再依赖没人产出的
 * `.partial.mp4` 后缀（历史约定仅作目录扫描兜底保留）。
 *
 * recover = 原地截断恢复：fMP4 按 box 边界扫到最后一个完整 (moof+mdat)，
 * 垃圾尾 ftruncate 掉；不 rename（消灭静默覆盖）、先文件后 DB（DB 失败时
 * 行仍是 recording，下次 scan 可重试，文件永不「消失」）。
 *
 * discard = 行级精确删除（按 recordingId / 精确路径），不再按 basename
 * 跨目录匹配（重名误删）。
 *
 * 注入点：repo / defaultSaveDir / probeDuration / now / generateId 均可替换，
 * 单测跑真实 sqlite（createTestDb）+ 临时目录，不必真跑 ffprobe。
 */

import {
  closeSync,
  existsSync,
  fstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  statSync,
  truncateSync,
  unlinkSync
} from 'fs'
import { basename, dirname, join, sep } from 'path'
import { randomUUID } from 'crypto'
import {
  recordingRepository,
  type RecordingRepository,
  type RecordingRow
} from '../../db/repos/RecordingRepository'
import { recordingSettingsRepository } from '../../db/repos/RecordingSettingsRepository'
import { probeDurationSec } from '../../utils/ffmpeg'

/** 兼容历史约定的分片后缀（旧行可能残留；新管线不再产出） */
const PARTIAL_SUFFIX = '.partial.mp4'
/** 短于这个时长的残片基本是损坏文件，恢复出来只是噪音 */
const MIN_RECOVER_DURATION_SEC = 1

export interface RecoveryOrphan {
  /** null = 磁盘有文件但 DB 没行（写库前就崩，仅历史后缀兜底路径会出现） */
  recordingId: string | null
  filePath: string
  fileSize: number
  mtimeMs: number
}

export interface RecoveryScan {
  orphans: RecoveryOrphan[]
}

export interface RecoveryRecoverRequest {
  filePath: string
  /** D4：scan 结果带行 id，优先按 id 精确恢复（不按文件名猜） */
  recordingId?: string | undefined
}

export interface RecoveryDiscardRequest {
  filePath?: string | undefined
  /** D4：按行 id 精确丢弃 */
  recordingId?: string | undefined
}

export interface RecoveryDeps {
  probeDuration?: (filePath: string) => Promise<number | null>
  generateId?: () => string
  repo?: Pick<
    RecordingRepository,
    | 'findById'
    | 'findByFilePath'
    | 'findInProgress'
    | 'findOrphanCandidates'
    | 'insert'
    | 'markRecovered'
    | 'hardDelete'
  >
  defaultSaveDir?: () => string | null
}

export interface Mp4RecoveryPoint {
  /** 文件以 ftyp 开头（ISO-BMFF/mp4 家族）——非 mp4（webm）绝不截断 */
  sawIsoBmff: boolean
  /** 最后一个完整 box（mdat）的结束偏移；0 = 没有任何完整媒体 box */
  goodEnd: number
  /** 所有 box 都完整走到 EOF（无截断） */
  complete: boolean
}

/**
 * 按 box 边界顺序扫描 mp4：只读每个 box 的头部（8/16 字节）按 size 跳跃，
 * GB 级文件也 O(片段数) 次读。截断点 = 最后一个完整 mdat 的末尾——
 * fragmented MP4 的每个 (moof+mdat) 自包含，头部 moov 完好时截掉尾部
 * 半截 box 后从头到最后完整片段均可播。
 */
export function findMp4RecoveryPoint(filePath: string): Mp4RecoveryPoint {
  const result: Mp4RecoveryPoint = { sawIsoBmff: false, goodEnd: 0, complete: false }
  let fd: number | null = null
  try {
    fd = openSync(filePath, 'r')
    const size = fstatSync(fd).size
    const header = Buffer.alloc(16)
    let pos = 0
    let firstType = ''
    while (pos + 8 <= size) {
      const n = readSync(fd, header, 0, 8, pos)
      if (n < 8) break
      let boxSize = header.readUInt32BE(0)
      const type = header.toString('latin1', 4, 8)
      if (pos === 0) firstType = type
      if (boxSize === 1) {
        // largesize（64 位）
        if (pos + 16 > size) break
        readSync(fd, header, 0, 16, pos)
        boxSize = header.readUInt32BE(8) * 2 ** 32 + header.readUInt32BE(12)
      } else if (boxSize === 0) {
        // size 0 = 延伸到文件尾
        boxSize = size - pos
      }
      if (boxSize < 8 || pos + boxSize > size) break // 半截 box：截断信号
      pos += boxSize
      if (type === 'mdat') result.goodEnd = pos
    }
    result.complete = pos === size && size > 0
    result.sawIsoBmff = firstType === 'ftyp'
  } catch {
    // 读不了就当不可分析：上层据此跳过截断
  } finally {
    if (fd !== null) closeSync(fd)
  }
  return result
}

export class RecoveryManager {
  constructor(private readonly deps: RecoveryDeps = {}) {}

  /** 列出待处置的 orphan（IPC 面板的初始数据） */
  scan(): RecoveryScan {
    const orphans: RecoveryOrphan[] = []
    const seen = new Set<string>()
    const push = (recordingId: string | null, filePath: string): void => {
      if (seen.has(filePath)) return
      seen.add(filePath)
      try {
        const st = statSync(filePath)
        orphans.push({ recordingId, filePath, fileSize: st.size, mtimeMs: st.mtimeMs })
      } catch {
        // stat 失败（竞态删除）：跳过
      }
    }

    // 1) D4 主源：DB 孤儿行——status recording/paused 且文件真实存在
    for (const row of this.repo().findInProgress()) {
      if (!row.file_path || !existsSync(row.file_path)) continue
      push(row.id, row.file_path)
    }

    // 2) 兼容历史 .partial.mp4 约定（目录扫描；含「写库前就崩」的无行文件）
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
        push(this.findRowByPartialName(name)?.id ?? null, join(dir, name))
      }
    }
    return { orphans }
  }

  /**
   * 恢复一个 orphan（原地截断，不 rename）
   * - probe 时长 ≥ 1s（过短残片是噪音）
   * - fMP4 带垃圾尾：截断到最后一个完整 mdat
   * - DB 有行 → markRecovered（路径不变）；无行 → 新建 recovered 行
   *
   * 顺序保证（P0-2）：先文件后 DB。DB 写失败时文件已修复但行仍 recording，
   * 下次 scan 会再列出来重试；绝不出现「文件改了名但行指旧路径」的消失态。
   */
  async recover(req: RecoveryRecoverRequest): Promise<{ recordingId: string }> {
    const filePath = req.filePath
    if (!existsSync(filePath)) {
      throw new Error(`[RecoveryManager] file not found: ${filePath}`)
    }
    // 截断与 unlink 同受目录围栏约束
    this.assertInCandidateDirs(filePath)

    const row = this.resolveRow(req)

    const probe = this.deps.probeDuration ?? probeDurationSec
    const dur = await probe(filePath)
    if (dur == null || dur < MIN_RECOVER_DURATION_SEC) {
      throw new Error(
        `[RecoveryManager] file too short/corrupted to recover (${dur ?? 'unknown'}s): ${filePath}`
      )
    }

    this.truncateMp4TailIfNeeded(filePath)

    if (row) {
      this.repo().markRecovered(row.id)
      return { recordingId: row.id }
    }

    // 无 DB 行：创建 recovered 行（最小字段集），路径保持原样
    const id = this.generateId()
    this.repo().insert({
      id,
      file_path: filePath,
      file_name: basename(filePath),
      status: 'recording' // insert 后立即 markRecovered
    })
    this.repo().markRecovered(id)
    return { recordingId: id }
  }

  /**
   * 丢弃一个 orphan：按 recordingId / 精确路径删行 + 删文件。
   * 不再按 basename 跨目录匹配（P0-4：重名误删）。
   */
  discard(req: RecoveryDiscardRequest): { ok: boolean } {
    if (req.recordingId) {
      const row = this.repo().findById(req.recordingId)
      if (!row) return { ok: false }
      if (!this.unlinkFenced(row.file_path)) return { ok: false }
      this.repo().hardDelete(row.id)
      return { ok: true }
    }

    const filePath = req.filePath
    if (!filePath) return { ok: false }

    // 精确路径优先
    const row = this.repo().findByFilePath(filePath)
    if (row) {
      if (!this.unlinkFenced(row.file_path)) return { ok: false }
      this.repo().hardDelete(row.id)
      return { ok: true }
    }

    // 兼容历史 .partial 约定（无行文件 / 行记成品名而盘上是 partial 名）
    try {
      const partial = this.resolvePartialPathForMutation(filePath)
      const legacyRow = this.findRowByPartialName(basename(partial))
      if (!unlinkSafe(partial)) return { ok: false }
      if (legacyRow) this.repo().hardDelete(legacyRow.id)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  /** ── 内部 ─────────────────────────────────────────────── */

  private repo(): NonNullable<RecoveryDeps['repo']> {
    return this.deps.repo ?? recordingRepository
  }

  private truncateMp4TailIfNeeded(filePath: string): void {
    const point = findMp4RecoveryPoint(filePath)
    if (!point.sawIsoBmff || point.complete || point.goodEnd <= 0) return
    try {
      truncateSync(filePath, point.goodEnd)
    } catch (e) {
      // 截断失败不阻塞登记：文件保持原样，probe 已确认可读
      console.warn('[RecoveryManager] truncate tail failed:', e)
    }
  }

  /** unlink，带目录围栏；文件不存在视为成功（幂等） */
  private unlinkFenced(filePath: string): boolean {
    if (!existsSync(filePath)) return true
    try {
      this.assertInCandidateDirs(filePath)
    } catch {
      return false
    }
    return unlinkSafe(filePath)
  }

  /** 扫描范围：已有行所在目录 + 用户默认保存目录（只留真实存在的） */
  private candidateDirs(): string[] {
    const dirs = new Set<string>()
    for (const row of this.repo().findOrphanCandidates()) dirs.add(dirname(row.file_path))
    for (const row of this.repo().findInProgress()) dirs.add(dirname(row.file_path))
    const def = this.defaultSaveDir()
    if (def) dirs.add(def)
    return [...dirs].filter((d) => existsSync(d))
  }

  private defaultSaveDir(): string | null {
    if (this.deps.defaultSaveDir) return this.deps.defaultSaveDir()
    return recordingSettingsRepository.get().defaultSavePath ?? null
  }

  /**
   * recover 的行解析：recordingId 精确 > 精确路径 > 历史 partial 文件名兜底
   * （前两者都不做 basename 猜测）
   */
  private resolveRow(req: RecoveryRecoverRequest): RecordingRow | null {
    if (req.recordingId) return this.repo().findById(req.recordingId)
    const byPath = this.repo().findByFilePath(req.filePath)
    if (byPath) return byPath
    if (req.filePath.endsWith(PARTIAL_SUFFIX)) {
      const legacy = this.findRowByPartialName(basename(req.filePath))
      if (legacy) return legacy
    }
    return null
  }

  /** 历史 partial 约定的文件名匹配（仅 .partial.mp4 路径使用） */
  private findRowByPartialName(fileName: string): RecordingRow | null {
    const asFinal = fileName.replace(PARTIAL_SUFFIX, '.mp4')
    const asPartial = asFinal.replace(/\.mp4$/, PARTIAL_SUFFIX)
    // 文件名级匹配没有现成查询：在孤儿候选行内比对（行数有限，可接受）
    const candidates = [...this.repo().findInProgress(), ...this.repo().findOrphanCandidates()]
    const hit = candidates.find(
      (r) => r.file_name === fileName || r.file_name === asFinal || r.file_name === asPartial
    )
    return hit ?? null
  }

  /** 处置只允许落在真实存在的 partial 文件上：显示名指向成品时改指其 .partial 兄弟 */
  private resolvePartialPathForMutation(rawFilePath: string): string {
    if (existsSync(rawFilePath) && rawFilePath.endsWith(PARTIAL_SUFFIX)) {
      this.assertInCandidateDirs(rawFilePath)
      return rawFilePath
    }
    const partial = rawFilePath.endsWith(PARTIAL_SUFFIX)
      ? rawFilePath
      : rawFilePath.replace(/\.mp4$/, PARTIAL_SUFFIX)
    if (existsSync(partial)) {
      this.assertInCandidateDirs(partial)
      return partial
    }
    throw new Error(`[RecoveryManager] not a recoverable partial file: ${rawFilePath}`)
  }

  /**
   * 变异（unlink/truncate）只许落在扫描范围（candidateDirs 子树）内：
   * 存在性挡不住「任意目录里的录制文件被渲染端点名删除/改名」。
   */
  private assertInCandidateDirs(filePath: string): void {
    const real = realpathSync(filePath)
    const inside = this.candidateDirs().some((dir) => {
      try {
        const realDir = realpathSync(dir)
        return real === realDir || real.startsWith(realDir + sep)
      } catch {
        return false
      }
    })
    if (!inside) {
      throw new Error(`[RecoveryManager] path outside candidate dirs: ${filePath}`)
    }
  }

  private generateId(): string {
    return this.deps.generateId ? this.deps.generateId() : randomUUID()
  }
}

function unlinkSafe(filePath: string): boolean {
  try {
    unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}

let instance: RecoveryManager | null = null

export function getRecoveryManager(deps?: RecoveryDeps): RecoveryManager {
  instance ??= new RecoveryManager(deps)
  return instance
}
