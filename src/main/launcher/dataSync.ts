/**
 * Leaf · 轻量多设备同步（V4 P0-2 / Decision-009 批次6）
 *
 * 范围（用户 2026-09-17 确认）：配置+热键基底（pref_preferences + launcher_docs）、
 * 代码片段（snip_* / tag_tags）、笔记+提醒（notes / note_folders / reminders）、
 * 番茄钟（pom_*）。剪贴板历史（pref clips 键）/ 录屏等大文件不参与。
 *
 * 冲突策略（用户确认）：后写覆盖 + 快照。
 * - 远端 bundle 的 exportedAt 晚于本地 lastAppliedAt → 拉平（镜像覆盖本地）
 * - 否则推送本地
 * - 拉平覆盖前把受影响表快照到 userData/sync-snapshots/（保留 5 份），可手动恢复
 *
 * 传输：复用整库备份的 WebDAV 配置（getSyncConfig）；bundle 以 AES-256-GCM 加密，
 * 密钥由 WebDAV 口令经 scrypt 派生（拿不到 WebDAV 口令无法解开密文）。
 */
import type Database from 'better-sqlite3'
import type { WebDAVClient } from 'webdav'
import { createClient } from 'webdav'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { getSyncConfig } from './sync'
import { database } from '../db/database'
import { prefRepository } from '../db/repos'

export const SYNC_MARKER_PREF = 'launcher.syncData.lastAppliedAt'
/** 快照保留份数 */
const SNAPSHOT_KEEP = 5
const SYNC_REMOTE_DIR = 'leaf-data-sync'
const SALT = 'leaf-data-sync-v1'

/** 同步表清单：{ 表名, 主键列[] }；pref_preferences 另有排除键（见 readTable） */
export const SYNC_TABLES: Array<{ table: string; pk: string[] }> = [
  { table: 'pref_preferences', pk: ['key'] },
  { table: 'launcher_docs', pk: ['doc_id'] },
  { table: 'snip_snippets', pk: ['id'] },
  { table: 'snip_snippet_contents', pk: ['id'] },
  { table: 'snip_folders', pk: ['id'] },
  { table: 'snip_tags', pk: ['snippet_id', 'tag_id'] },
  { table: 'tag_tags', pk: ['id'] },
  { table: 'notes', pk: ['id'] },
  { table: 'note_folders', pk: ['id'] },
  { table: 'reminders', pk: ['id'] },
  { table: 'pom_projects', pk: ['id'] },
  { table: 'pom_tasks', pk: ['id'] },
  { table: 'pom_pomodoros', pk: ['id'] }
]

/** pref_preferences 中不同步的键：剪贴板数据（Decision-009 排除）+ 同步自身的标记 */
export function prefExcludedKeys(): Set<string> {
  return new Set(['clips', 'launcher.sync', SYNC_MARKER_PREF])
}

export interface SyncBundle {
  version: 1
  exportedAt: number
  device: string
  tables: Record<string, Array<Record<string, unknown>>>
}

/** LWW 决策（纯函数）：远端比本地已应用的更新 → pull；本地更新 / 远端不存在 → push；相等 → noop */
export function decideSync(
  remoteExportedAt: number,
  lastAppliedAt: number,
  remoteExists: boolean
): 'pull' | 'push' | 'noop' {
  if (!remoteExists) return 'push'
  if (remoteExportedAt > lastAppliedAt) return 'pull'
  if (remoteExportedAt < lastAppliedAt) return 'push'
  return 'noop'
}

function columnsOf(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
    (c) => c.name
  )
}

/** 读取表全量行；pref_preferences 过滤排除键 */
function readTable(db: Database.Database, table: string): Array<Record<string, unknown>> {
  const rows = db.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>
  if (table !== 'pref_preferences') return rows
  const excluded = prefExcludedKeys()
  return rows.filter((r) => !excluded.has(String(r['key'])))
}

export class DataSyncService {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  buildBundle(): SyncBundle {
    const tables: Record<string, Array<Record<string, unknown>>> = {}
    for (const spec of SYNC_TABLES) {
      tables[spec.table] = readTable(this.db, spec.table)
    }
    return {
      version: 1,
      exportedAt: Date.now(),
      device: safeAppName(),
      tables
    }
  }

  /** 拉平回写：镜像远端行（upsert + 删除远端没有的本地行），单事务 */
  applyBundle(bundle: SyncBundle): { applied: number } {
    let applied = 0
    const tx = this.db.transaction(() => {
      for (const spec of SYNC_TABLES) {
        const rows = bundle.tables[spec.table] ?? []
        const cols = columnsOf(this.db, spec.table)
        const placeholders = cols.map(() => '?').join(',')
        const upsert = this.db.prepare(
          `INSERT OR REPLACE INTO ${spec.table} (${cols.join(',')}) VALUES (${placeholders})`
        )
        for (const row of rows) {
          upsert.run(...cols.map((c) => (row[c] === undefined ? null : row[c])))
          applied++
        }
        // 镜像：删除远端没有的本地行（后写覆盖语义）
        const remoteKeys = new Set(
          rows.map((r) => spec.pk.map((k) => String(r[k] ?? '')).join('\u0000'))
        )
        const all = this.db.prepare(`SELECT * FROM ${spec.table}`).all() as Array<
          Record<string, unknown>
        >
        const del = this.db.prepare(
          `DELETE FROM ${spec.table} WHERE ${spec.pk.map((k) => `${k} = ?`).join(' AND ')}`
        )
        for (const row of all) {
          const key = spec.pk.map((k) => String(row[k] ?? '')).join('\u0000')
          if (!remoteKeys.has(key)) del.run(...spec.pk.map((k) => row[k]))
        }
      }
    })
    tx()
    return { applied }
  }

  /** 拉平前的本地快照（userData/sync-snapshots/<ts>.json，保留 5 份）；返回快照路径 */
  snapshot(): string {
    const dir = join(app.getPath('userData'), 'sync-snapshots')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const file = join(dir, `${Date.now()}.json`)
    writeFileSync(file, JSON.stringify(this.buildBundle()))
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
    for (const f of files.slice(0, Math.max(0, files.length - SNAPSHOT_KEEP))) {
      rmSync(join(dir, f))
    }
    return file
  }
}

/** ── 传输层（WebDAV 复用整库备份配置；AES-256-GCM 密钥派生自 WebDAV 口令）── */

function deriveKey(password: string): Buffer {
  return scryptSync(password, SALT, 32)
}

function encryptBundle(bundle: SyncBundle, password: string): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(password), iv)
  const data = Buffer.concat([
    cipher.update(JSON.stringify(bundle), 'utf8'),
    cipher.final(),
    cipher.getAuthTag()
  ])
  return Buffer.concat([iv, data])
}

function decryptBundle(buf: Buffer, password: string): SyncBundle {
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(buf.length - 16)
  const data = buf.subarray(12, buf.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(password), iv)
  decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'))
}

async function syncClient(): Promise<{ client: WebDAVClient; password: string }> {
  const config = getSyncConfig()
  if (!config.url) throw new Error('未配置 WebDAV（启动器设置 → 同步）')
  const client = createClient(config.url, {
    username: config.username,
    password: config.password
  })
  const dir = `${config.remoteDir}/${SYNC_REMOTE_DIR}`
  try {
    await client.createDirectory(dir, { recursive: true })
  } catch {
    /* 目录可能已存在 */
  }
  return { client, password: config.password }
}

/** electron app 在单测环境不可用（electron 包仅导出路径）——安全取应用名 */
function safeAppName(): string {
  try {
    return app.getName()
  } catch {
    return 'unknown'
  }
}

function prefGet(key: string): string | null {
  try {
    return prefRepository.get(key)
  } catch {
    return null
  }
}

function prefSet(key: string, value: string): void {
  try {
    prefRepository.set(key, value)
  } catch {
    /* 写失败静默：下次同步重新决策 */
  }
}

export type SyncDecision = 'pull' | 'push' | 'noop'

/** 推送本地（后写覆盖：覆盖远端 bundle），并记录 lastAppliedAt */
export async function pushDataSync(): Promise<{
  ok: boolean
  decision?: SyncDecision
  error?: string
}> {
  try {
    const service = new DataSyncService()
    const { client, password } = await syncClient()
    const config = getSyncConfig()
    const bundle = service.buildBundle()
    const buf = encryptBundle(bundle, password)
    const remotePath = `${config.remoteDir}/${SYNC_REMOTE_DIR}`
    await client.putFileContents(`${remotePath}/bundle.json.enc`, buf, { overwrite: true })
    await client.putFileContents(
      `${remotePath}/latest.json`,
      JSON.stringify({ exportedAt: bundle.exportedAt, device: bundle.device })
    )
    prefSet(SYNC_MARKER_PREF, String(bundle.exportedAt))
    return { ok: true, decision: 'push' }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

/** 拉平（决策：远端更新才覆盖本地；覆盖前本地快照；远端不存在时转为推送） */
export async function pullDataSync(): Promise<{
  ok: boolean
  decision?: SyncDecision
  applied?: number
  snapshot?: string
  error?: string
}> {
  try {
    const service = new DataSyncService()
    const { client, password } = await syncClient()
    const config = getSyncConfig()
    const remotePath = `${config.remoteDir}/${SYNC_REMOTE_DIR}`
    const hasBundle = await client.exists(`${remotePath}/bundle.json.enc`)
    if (!hasBundle) {
      const r = await pushDataSync()
      return { ok: r.ok, decision: 'push', error: r.error }
    }
    const latest = JSON.parse(
      String(await client.getFileContents(`${remotePath}/latest.json`, { format: 'text' }))
    ) as { exportedAt: number }
    const lastAppliedAt = Number(prefGet(SYNC_MARKER_PREF) ?? '0')
    const decision = decideSync(latest.exportedAt, lastAppliedAt, true)
    if (decision !== 'pull') return { ok: true, decision }
    const buf = (await client.getFileContents(`${remotePath}/bundle.json.enc`, {
      format: 'binary'
    })) as Buffer
    const bundle = decryptBundle(buf, password)
    const snapshot = service.snapshot()
    const { applied } = service.applyBundle(bundle)
    prefSet(SYNC_MARKER_PREF, String(bundle.exportedAt))
    return { ok: true, decision: 'pull', applied, snapshot }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

/** 渲染端状态：lastAppliedAt + 本地快照份数 + WebDAV 是否已配置 */
export function dataSyncStatus(): {
  lastAppliedAt: number
  snapshots: number
  configured: boolean
} {
  const dir = join(app.getPath('userData'), 'sync-snapshots')
  const snapshots = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0
  return {
    lastAppliedAt: Number(prefGet(SYNC_MARKER_PREF) ?? '0'),
    snapshots,
    configured: !!getSyncConfig().url
  }
}
