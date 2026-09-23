/**
 * Frond · 云端整库备份（WebDAV，加密快照）
 *
 * 机制（2026-09 决策：全库加密快照，定位是「备份」而非多设备同步）：
 * - 快照：better-sqlite3 db.backup()（在线一致性快照，不打断主连接）
 * - 加密：用户密码派生密钥 AES-256-GCM（crypto.encryptFileWithPassword），
 *   本地 .frond-key 不参与——拿到网盘文件没有密码无法还原
 * - 远端布局：`<remoteDir>/full/frond-full-<ts>.db.enc` + `latest.json` 指针，
 *   保留最近 KEEP_REMOTE 份（防「备份了坏状态还覆盖了唯一好备份」）
 * - 还原：下载 → 解密 → quick_check → 复用 dbBackup.applyDbFile 换库重启
 */
import { app } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WebDAVClient } from 'webdav'
import { database } from '../db/database'
import { validateSqliteFile, applyDbFile } from '../db/dbBackup'
import { encryptFileWithPassword, decryptFileWithPassword } from '../utils/crypto'
import { log } from '../services/LogService'
import {
  getSyncConfig,
  createClient,
  ensureRemoteDir,
  withTimeout,
  type SyncConfig
} from './sync'

const FULL_DIR = 'full'
const MANIFEST_FILE = 'latest.json'
const KEEP_REMOTE = 3
/** 快照/下载的体积上限：正常库远小于此，超限视为异常拒传 */
const MAX_SNAPSHOT_BYTES = 500 * 1024 * 1024

export interface CloudBackupInfo {
  file: string
  createdAt: number
  size: number
}

export interface CloudBackupListResult {
  ok: boolean
  items?: CloudBackupInfo[]
  configured?: boolean
  error?: string
}

/** 云端 .enc 文件名中的时间戳解析（frond-full-<ts>.db.enc） */
export function tsFromFileName(name: string): number {
  const m = name.match(/^frond-full-(\d+)\.db\.enc$/)
  return m ? Number(m[1]) : 0
}

/**
 * 保留策略纯函数：按时间戳新→旧排序，返回应删除的文件名（保留 keep 份）。
 * 独立导出便于单测。
 */
export function pickPruneCandidates(fileNames: string[], keep = KEEP_REMOTE): string[] {
  const sorted = [...new Set(fileNames)].sort(
    (a, b) => tsFromFileName(b) - tsFromFileName(a)
  )
  return sorted.slice(keep)
}

function fullDir(config: SyncConfig): string {
  return `${config.remoteDir}/${FULL_DIR}`
}

async function getClient(): Promise<{ client: WebDAVClient; config: SyncConfig }> {
  const config = getSyncConfig()
  if (!config.url) throw new Error('未配置 WebDAV（启动器设置 → 同步）')
  const client = await withTimeout(createClient(config), '连接 WebDAV')
  await ensureRemoteDir(client, fullDir(config))
  return { client, config }
}

/** 云端整库备份 */
export async function backupFullDb(
  password: string
): Promise<{ ok: boolean; file?: string; error?: string }> {
  try {
    const { client, config } = await getClient()
    // 1. 在线一致性快照（不关主连接；backup API 自带 WAL 合并）
    const ts = Date.now()
    const tmpSnap = join(app.getPath('userData'), `frond-cloud-snap-${ts}.db`)
    try {
      await database.handle.backup(tmpSnap)
      const problem = validateSqliteFile(tmpSnap)
      if (problem) throw new Error(`快照校验失败：${problem}`)

      // 2. 加密
      const plain = readFileSync(tmpSnap)
      if (plain.length > MAX_SNAPSHOT_BYTES) {
        throw new Error(`数据库体积超出云端备份上限（${Math.round(plain.length / 1024 / 1024)}MB）`)
      }
      const blob = encryptFileWithPassword(plain, password)

      // 3. 上传 + 指针
      const file = `frond-full-${ts}.db.enc`
      const remotePath = `${fullDir(config)}/${file}`
      await withTimeout(client.putFileContents(remotePath, blob), '上传备份')
      const manifest = {
        app: 'frond-cloud-backup',
        schema: 1,
        file,
        createdAt: ts,
        size: blob.length,
        appVersion: app.getVersion()
      }
      await withTimeout(
        client.putFileContents(`${fullDir(config)}/${MANIFEST_FILE}`, JSON.stringify(manifest)),
        '上传指针'
      )

      // 4. 保留最近 KEEP_REMOTE 份
      const listing = (await withTimeout(
        client.getDirectoryContents(fullDir(config)),
        '列出远端备份'
      )) as Array<{ filename: string; basename: string }>
      const names = listing
        .filter((e) => /^frond-full-\d+\.db\.enc$/.test(e.basename))
        .map((e) => e.basename)
      for (const stale of pickPruneCandidates(names)) {
        await client.deleteFile(`${fullDir(config)}/${stale}`).catch(() => undefined)
      }

      log.info('cloudBackup', `full backup uploaded: ${file} (${Math.round(plain.length / 1024)}KB)`)
      return { ok: true, file }
    } finally {
      if (existsSync(tmpSnap)) rmSync(tmpSnap, { force: true })
    }
  } catch (error) {
    log.warn('cloudBackup', `backup failed: ${(error as Error).message}`)
    return { ok: false, error: (error as Error).message }
  }
}

/** 列出云端备份（远端目录不存在视为空列表，不算错误） */
export async function listCloudBackups(): Promise<CloudBackupListResult> {
  const config = getSyncConfig()
  if (!config.url) return { ok: true, items: [], configured: false }
  try {
    const client = await createClient(config)
    const listing = (await withTimeout(
      client.getDirectoryContents(fullDir(config)),
      '列出远端备份'
    )) as Array<{ filename: string; basename: string; size?: number }>
    const items: CloudBackupInfo[] = listing
      .filter((e) => /^frond-full-\d+\.db\.enc$/.test(e.basename))
      .map((e) => ({ file: e.basename, createdAt: tsFromFileName(e.basename), size: e.size ?? 0 }))
      .sort((a, b) => b.createdAt - a.createdAt)
    return { ok: true, items, configured: true }
  } catch (error) {
    // 目录不存在等情形按空列表处理，其他错误如实上报
    const msg = (error as Error).message
    if (/404/.test(msg)) return { ok: true, items: [], configured: true }
    log.warn('cloudBackup', `list failed: ${msg}`)
    return { ok: false, error: msg }
  }
}

/** 从云端还原：下载 → 解密 → 校验 → 换库重启（applyDbFile 内含安全备份） */
export async function restoreFullDb(
  password: string,
  fileName?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { client, config } = await getClient()
    // 1. 定位文件：显式指定 > latest.json > 目录内最新
    let file = fileName
    if (!file) {
      const manifestPath = `${fullDir(config)}/${MANIFEST_FILE}`
      if (await withTimeout(client.exists(manifestPath), '检查指针')) {
        const raw = (await withTimeout(
          client.getFileContents(manifestPath, { format: 'text' }),
          '读取指针'
        )) as string
        const manifest = JSON.parse(raw) as { file?: string }
        if (manifest.file && /^frond-full-\d+\.db\.enc$/.test(manifest.file)) file = manifest.file
      }
    }
    if (!file) {
      const listing = (await withTimeout(
        client.getDirectoryContents(fullDir(config)),
        '列出远端备份'
      )) as Array<{ basename: string }>
      const names = listing
        .filter((e) => /^frond-full-\d+\.db\.enc$/.test(e.basename))
        .map((e) => e.basename)
      file = pickPruneCandidates(names, 0)[0]
    }
    if (!file) throw new Error('云端不存在备份文件')

    // 2. 下载（体积上限防误下超大对象）
    const listing = (await withTimeout(
      client.getDirectoryContents(fullDir(config)),
      '检查备份体积'
    )) as Array<{ basename: string; size?: number }>
    const size = listing.find((e) => e.basename === file)?.size ?? 0
    if (size > MAX_SNAPSHOT_BYTES) {
      throw new Error(`云端文件体积异常（${Math.round(size / 1024 / 1024)}MB），已拒绝下载`)
    }
    const blob = (await withTimeout(
      client.getFileContents(`${fullDir(config)}/${file}`, { format: 'binary' }),
      '下载备份'
    )) as ArrayBuffer

    // 3. 解密 → 落临时文件 → 校验
    const plain = decryptFileWithPassword(Buffer.from(blob), password)
    const tmpDb = join(app.getPath('userData'), `frond-cloud-restore-${Date.now()}.db`)
    try {
      writeFileSync(tmpDb, plain)
      const problem = validateSqliteFile(tmpDb)
      if (problem) throw new Error(`还原校验失败：${problem}`)
      // 4. 换库 + 重启（applyDbFile 会先备份当前库再覆盖）
      applyDbFile(tmpDb)
      log.info('cloudBackup', `restored from ${file}, relaunching`)
      return { ok: true }
    } finally {
      if (existsSync(tmpDb)) rmSync(tmpDb, { force: true })
    }
  } catch (error) {
    log.warn('cloudBackup', `restore failed: ${(error as Error).message}`)
    return { ok: false, error: (error as Error).message }
  }
}
