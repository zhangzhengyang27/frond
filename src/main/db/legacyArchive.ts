/**
 * Frond · legacy JSON 归档（一次性）
 *
 * 触发：runDataMigrations() 成功完成（v2 done）后调用。
 * 职责：把 9 个旧 electron-store JSON 文件从 userData 根目录搬到
 *       userData/legacy-backup/<timestamp>/ 子目录。
 *
 * 设计：搬迁而非删除。
 * - 万一 SQLite 损坏、用户想回退、自己手动改过 JSON——备份可还原
 * - 不直接 rm 是「商用级」的容错底线
 * - 备份目录以时间戳命名，重复运行可形成时间线（不去重，留档）
 *
 * 失败策略：单文件失败不阻断整体归档；最终汇总写入 log。
 */

import { join, resolve, relative, isAbsolute } from 'node:path'
import { existsSync, mkdirSync, renameSync, statSync, readdirSync, rmSync } from 'node:fs'
import { log } from '../services/LogService'

/** 所有 v1/v2 数据迁移曾读过的旧 JSON 文件名（含已下线模块 Music / OnlineMusic，保留以便归档清理） */
export const LEGACY_JSON_FILES = [
  'Preferences.json',
  'Tag Data.json',
  'Wallpaper Data.json',
  'Local File Library.json',
  'Music Data.json',
  'pomodoro-data.json',
  'Snippet Data.json',
  'Folder Data.json',
  'Photo Data.json',
  'Online Music Data.json'
] as const

export const ARCHIVE_DIR_NAME = 'legacy-backup'

export interface ArchiveResult {
  ran: boolean
  archivedCount: number
  skippedCount: number
  errors: string[]
  /** 备份目录绝对路径；用户可在「数据迁移中心」找到它 */
  archivePath: string | null
}

/**
 * 把 srcDir 下的 legacy JSON 搬到 srcDir/legacy-backup/<ts>/。
 *
 * 独立于 Electron / database（fs 注入默认是 node:fs），
 * 方便单元测试：把 tmpDir 当 srcDir 传入即可。
 *
 * 返回 ArchiveResult；任何单文件失败不抛错。
 */
export function archiveLegacyJsonInDir(
  srcDir: string,
  now: () => Date = (): Date => new Date()
): ArchiveResult {
  const result: ArchiveResult = {
    ran: false,
    archivedCount: 0,
    skippedCount: 0,
    errors: [],
    archivePath: null
  }

  // 先看有没有任何 legacy 文件；没有就直接退出
  const present = LEGACY_JSON_FILES.filter((f) => existsSync(join(srcDir, f)))
  if (present.length === 0) {
    log.info('legacyArchive', `no legacy JSON in ${srcDir}, skip`)
    return result
  }

  const ts = now().toISOString().replace(/[:.]/g, '-')
  const archiveDir = join(srcDir, ARCHIVE_DIR_NAME, ts)

  try {
    mkdirSync(archiveDir, { recursive: true })
    result.archivePath = archiveDir
    result.ran = true
  } catch (e) {
    const msg = (e as Error).message
    result.errors.push(`mkdir: ${msg}`)
    log.error('legacyArchive', `mkdir failed for ${archiveDir}: ${msg}`, e)
    return result
  }

  for (const name of LEGACY_JSON_FILES) {
    const src = join(srcDir, name)
    if (!existsSync(src)) {
      result.skippedCount += 1
      continue
    }
    try {
      const size = statSync(src).size
      renameSync(src, join(archiveDir, name))
      result.archivedCount += 1
      log.info('legacyArchive', `archived ${name} (${size}B)`)
    } catch (e) {
      const msg = (e as Error).message
      result.errors.push(`${name}: ${msg}`)
      log.error('legacyArchive', `archive failed for ${name}: ${msg}`, e)
    }
  }

  // 看一眼 archive 目录里到底有多少文件（防止 rename 失败但看起来成功了）
  try {
    const files = readdirSync(archiveDir)
    log.info(
      'legacyArchive',
      `done: ${result.archivedCount} archived, ${result.skippedCount} skipped, ${files.length} files in ${archiveDir}`
    )
  } catch {
    /* ignore */
  }

  return result
}

/**
 * 列出 userData/legacy-backup/ 下所有 archive（按时间倒序）。
 * 每条包含：archiveDir（绝对路径）/ ts（时间戳）/ files（每个 JSON 文件名 + 字节数）。
 *
 * UI 用：迁移中心展示「备份时间线」，用户可选某条还原或删除。
 */
export interface ArchiveInfo {
  /** archive 目录的绝对路径 */
  path: string
  /** 时间戳（与目录名一致，ISO 格式） */
  ts: string
  /** 每个 JSON 文件名 + 字节数 */
  files: Array<{ name: string; size: number }>
  /** 目录总字节数 */
  totalSize: number
}

export function listArchives(userDataDir: string): ArchiveInfo[] {
  const baseDir = join(userDataDir, ARCHIVE_DIR_NAME)
  if (!existsSync(baseDir)) return []

  const subs = readdirSync(baseDir).sort().reverse()
  const out: ArchiveInfo[] = []
  for (const sub of subs) {
    const full = join(baseDir, sub)
    try {
      if (!statSync(full).isDirectory()) continue
      const files = readdirSync(full)
      const fileInfos: Array<{ name: string; size: number }> = []
      let total = 0
      for (const f of files) {
        const stat = statSync(join(full, f))
        if (stat.isFile()) {
          fileInfos.push({ name: f, size: stat.size })
          total += stat.size
        }
      }
      out.push({ path: full, ts: sub, files: fileInfos, totalSize: total })
    } catch {
      /* skip broken entry */
    }
  }
  return out
}

/**
 * 校验 archive 路径必须位于 <userDataDir>/legacy-backup/ 直下且为其直接子目录。
 * 传 null 表示拒绝：路径解析后逃逸出备份容器（含 ../、非目录形态等）。
 *
 * 路径来自 IPC（渲染端可传任意字符串），删除/还原是破坏性操作，
 * 必须锚定真实 userData 容器，不能只做子串包含判断。
 */
function resolveContainedArchive(userDataDir: string, archivePath: string): string | null {
  if (typeof archivePath !== 'string' || archivePath.length === 0) return null
  const base = join(resolve(userDataDir), ARCHIVE_DIR_NAME)
  const resolved = resolve(archivePath)
  const rel = relative(base, resolved)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
  return resolved
}

/**
 * 删除某个 archive 目录（不可恢复）。
 * 商用底线：调用前 UI 必须 confirm dialog；这里只做删除动作本身。
 */
export function deleteArchive(
  userDataDir: string,
  archivePath: string
): { ok: boolean; error?: string } {
  try {
    const resolved = resolveContainedArchive(userDataDir, archivePath)
    if (!resolved) {
      return { ok: false, error: 'refused: path is not a legacy-backup archive directory' }
    }
    if (!existsSync(resolved)) {
      return { ok: false, error: 'archive does not exist' }
    }
    if (!statSync(resolved).isDirectory()) {
      return { ok: false, error: 'refused: path is not a directory' }
    }
    rmSync(resolved, { recursive: true, force: true })
    log.info('legacyArchive', `deleted ${resolved}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * 把 archive 目录下的所有 JSON 还原到 userData 根。
 * 用于：用户后悔了想「回到老的 electron-store 时代」（虽然不推荐）。
 *
 * 注意：还原后再次启动 app，runDataMigrations() 会再次跑（idempotent），
 * 把这些 JSON 重新导入 SQLite，然后再归档——形成「无效循环」。
 * 商用策略：还原后提示「下次启动会重新归档，建议改用 SQLite 数据导出」。
 */
export function restoreArchive(
  userDataDir: string,
  archivePath: string
): {
  ok: boolean
  restored: string[]
  errors: string[]
} {
  const result: { ok: boolean; restored: string[]; errors: string[] } = {
    ok: false,
    restored: [],
    errors: []
  }
  const resolved = resolveContainedArchive(userDataDir, archivePath)
  if (!resolved) {
    result.errors.push('refused: path is not a legacy-backup archive directory')
    return result
  }
  if (!existsSync(resolved)) {
    result.errors.push('archive does not exist')
    return result
  }
  // 还原目标由调用方传入的 userData 决定，不再从路径字符串反推（Windows 分隔符下会失效）
  const userData = resolve(userDataDir)
  try {
    const files = readdirSync(resolved)
    for (const f of files) {
      const src = join(resolved, f)
      const dst = join(userData, f)
      if (!statSync(src).isFile()) continue
      // 如果目标已存在，加 .restored 后缀避免覆盖
      let finalDst = dst
      if (existsSync(finalDst)) {
        finalDst = join(userData, `${f}.restored.${Date.now()}`)
      }
      try {
        renameSync(src, finalDst)
        result.restored.push(finalDst)
        log.info('legacyArchive', `restored ${src} → ${finalDst}`)
      } catch (e) {
        result.errors.push(`${f}: ${(e as Error).message}`)
      }
    }
    result.ok = result.errors.length === 0
  } catch (e) {
    result.errors.push(`read archive: ${(e as Error).message}`)
  }
  return result
}
