/**
 * Frond · 轻量多设备同步（V4 P0-2 / Decision-009 批次6）
 *
 * 范围（用户 2026-09-17 确认）：配置+热键基底（pref_preferences + launcher_docs）、
 * 代码片段（snip_* / tag_tags）、笔记+提醒（notes / note_folders / reminders）、
 * 番茄钟（pom_*）。剪贴板历史（pref clips 键）/ 录屏等大文件不参与。
 *
 * 冲突策略（P-5① 改判，2026-09-21）：**行级三方合并**，不再镜像覆盖。
 * - `exportedAt` 只用来决定「这次要不要拉」；拉下来谁赢由 `syncMerge.mergeTable()` 判：
 *   本地行、远端行、`sync_state` 里上次见过的基线，三方比过才动数据。
 * - 两边都改过 → 较新的落地、较旧的原地另存一行冲突副本（有 id + 标题的表才谈副本，
 *   KV 与追加型集合只记冲突不造行）；一边删另一边又改过 → 保住编辑并报 delete-edit。
 * - 删除靠 `sync_state` 的墓碑传播。**「远端没有这行」不再等于「删掉它」** ——
 *   那一句是「我昨天写的笔记没了」的来源。
 * - 拉平前仍先落一份本地快照（userData/sync-snapshots/，保留 5 份）：合并判据再稳，
 *   也不该让用户数据只有一条去路。
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
import { getSyncConfig, type SyncConfig } from './sync'
import {
  mergeTable,
  pkValues,
  summarize,
  type ConflictRecord,
  type MergeRow,
  type MergeSummary,
  type StateTable,
  type SyncTableSpec
} from './syncMerge'
import { database } from '../db/database'
import { prefRepository } from '../db/repos'

export const SYNC_MARKER_PREF = 'launcher.syncData.lastAppliedAt'
/**
 * 设备身份：本机派生、**从不同步**（同步过去 = 两台设备共用一个身份，
 * 而它正是冲突副本标题里「这台设备是谁」的那个名字）。
 */
export const DEVICE_ID_PREF = 'launcher.sync.deviceId'
/** 快照保留份数 */
const SNAPSHOT_KEEP = 5
const SYNC_REMOTE_DIR = 'frond-data-sync'
const SALT = 'frond-data-sync-v1'

/** 同步范围的一等定义：合并规格（含冲突策略与副本需要的 id / 标题列） */
export interface SyncSpec extends SyncTableSpec {
  /**
   * 子表自己没有可用的时间戳时，修订号问父行要（如 `snip_snippet_contents` 的
   * 新旧由它所属片段的 `updated_at` 决定）。对端拿不到父行就无从比新旧，
   * 所以这个信息必须随 bundle 一起走（落在每行的 `__rev` 上）。
   */
  parent?: { table: string; childCol: string; parentCol: string; revCol: string }
}

/** 同步表清单：合并判据与修订号来源都在这一张表上 */
export const SYNC_TABLE_SPECS: SyncSpec[] = [
  { table: 'pref_preferences', pk: ['key'], conflict: 'report' },
  { table: 'launcher_docs', pk: ['doc_id'], conflict: 'report' },
  {
    table: 'snip_snippets',
    pk: ['id'],
    conflict: 'copy',
    idCol: 'id',
    titleCol: 'title'
  },
  {
    table: 'snip_snippet_contents',
    pk: ['id'],
    conflict: 'report',
    parent: {
      table: 'snip_snippets',
      childCol: 'snippet_id',
      parentCol: 'id',
      revCol: 'updated_at'
    }
  },
  { table: 'snip_folders', pk: ['id'], conflict: 'copy', idCol: 'id', titleCol: 'name' },
  {
    table: 'snip_tags',
    pk: ['snippet_id', 'tag_id'],
    conflict: 'report',
    parent: {
      table: 'snip_snippets',
      childCol: 'snippet_id',
      parentCol: 'id',
      revCol: 'updated_at'
    }
  },
  { table: 'tag_tags', pk: ['id'], conflict: 'copy', idCol: 'id', titleCol: 'name' },
  { table: 'notes', pk: ['id'], conflict: 'copy', idCol: 'id', titleCol: 'title' },
  { table: 'note_folders', pk: ['id'], conflict: 'copy', idCol: 'id', titleCol: 'name' },
  { table: 'reminders', pk: ['id'], conflict: 'copy', idCol: 'id', titleCol: 'title' },
  { table: 'pom_projects', pk: ['id'], conflict: 'copy', idCol: 'id', titleCol: 'name' },
  { table: 'pom_tasks', pk: ['id'], conflict: 'copy', idCol: 'id', titleCol: 'title' },
  { table: 'pom_pomodoros', pk: ['id'], conflict: 'report' },
  { table: 'folder_folders', pk: ['id'], conflict: 'copy', idCol: 'id', titleCol: 'name' },
  { table: 'rec_markers', pk: ['id'], conflict: 'copy', idCol: 'id', titleCol: 'label' },
  { table: 'usage_favorites', pk: ['module_id'], conflict: 'report' }
]

/** 兼容旧写法（只取表名与主键） */
export const SYNC_TABLES: Array<{ table: string; pk: string[] }> = SYNC_TABLE_SPECS.map((s) => ({
  table: s.table,
  pk: s.pk
}))

/**
 * 不同步的表，每张写明理由 —— 归类靠 `syncExclusionAudit()` 钉住：
 * 库里冒出一张既不在同步清单、也不在这份排除表里的表 = 漏判，直接报出来。
 * 判据是「这条数据能不能变成另一台设备上的一行」，不是「它大不大」。
 */
export const SYNC_EXCLUDED_TABLES: Record<string, string> = {
  meta: '迁移版本表，本机 schema 状态',
  sync_state: '同步自身的三方合并基线（把它同步过去等于两台设备共用一份“上次见过什么”）',
  lib_files: '文件库主表带本机绝对路径与 inode，换机器无意义',
  photo_photos: '同上：路径型数据，且体量按 GB 计',
  photo_albums: '相册是库内组织关系，随 lib_files 一起排除',
  photo_album_items: '相册条目',
  photo_folders: '文件夹是磁盘事实不是用户数据',
  photo_smart_albums: '智能相册是查询条件，本机派生',
  photo_embeddings: '向量是可重建的派生数据，同步过去也没法比',
  photo_tags: '标签关系挂在 lib_files 上',
  shot_index: '截图索引：文件路径 + OCR 结果，均可本机重建',
  ss_screenshots: '截图分享记录，本机临时态',
  rec_recordings: '录屏产物是文件',
  rec_segments: '录屏分段，随文件走',
  rec_clips: '录屏剪辑产物，随文件走',
  usage_records: '使用统计是派生聚合，且按小时增量写',
  geo_cache: 'IP 归属地缓存',
  log_entries: '本机日志',
  wall_collections: '壁纸库：文件路径型',
  wall_files: '壁纸库：文件路径型',
  music_playlists: '第三方音乐库的镜像（网易云），不是 Frond 的数据',
  music_playlist_items: '同上',
  music_tracks: '同上',
  om_user_playlists: 'OpenMusic 的远端目录缓存',
  om_play_history: '远端播放历史，属于账号侧数据',
  om_liked_albums: '远端收藏',
  om_liked_artists: '远端收藏',
  om_liked_mvs: '远端收藏',
  om_liked_playlists: '远端收藏',
  om_liked_tracks: '远端收藏'
}

/** 库里每张表要么同步、要么被点名排除（新加的表不归类会被报出来） */
export function syncExclusionAudit(db: Database.Database): { missing: string[] } {
  const synced = new Set(SYNC_TABLE_SPECS.map((s) => s.table))
  const names = (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>
  )
    .map((r) => r.name)
    // FTS5 的影子表（`x_fts` / `_idx` / `_data` / `_docsize` / `_config` / `_content`）
    // 是索引不是数据：它们由基表触发器重建，同步过去只会跟基表内容打架
    .filter((n) => !/_fts(_|$)/.test(n))
  return {
    missing: names.filter((n) => !synced.has(n) && !(n in SYNC_EXCLUDED_TABLES)).sort()
  }
}

/**
 * pref_preferences 中不同步的键：剪贴板数据（Decision-009 排除）+ 同步自身的标记与设备身份，
 * 再加 MCP 的两项 —— **这不是「同步了不方便」而是「同步了会泄」**：
 * mcp.servers 里是 stdio 命令行与环境变量（常常就是 token），
 * mcp.toolCache 是各服务器工具清单的快照，跟着走只会多一处副本。
 */
export function prefExcludedKeys(): Set<string> {
  return new Set([
    'clips',
    'launcher.sync',
    SYNC_MARKER_PREF,
    DEVICE_ID_PREF,
    'mcp.servers',
    'mcp.toolCache'
  ])
}

export interface SyncBundle {
  /** 1 = 只带行、修订号靠对端自行从列里猜；2 = 每行带 `__rev` */
  version: 1 | 2
  exportedAt: number
  /** 应用名，进状态页显示 */
  device: string
  /** 本机派生的设备身份，不同步（见 DEVICE_ID_PREF） */
  deviceId: string
  tables: Record<string, Array<Record<string, unknown>>>
}

/**
 * 对端某一行的修订号。
 * v2 直读 `__rev`；**没有就当 0**（宁可不动这行，也不拿一个猜出来的新旧去覆盖用户的编辑）。
 * v1 的 bundle 没有 `__rev`，只能回退到行内时间戳列；父行派生的那种（子表自己没时间戳）
 * 在 v1 里根本无法还原 → 同样按 0。
 */
export function revOfRemoteRow(
  spec: SyncSpec,
  row: Record<string, unknown>,
  version: 1 | 2
): number {
  if (version >= 2) {
    const r = row['__rev']
    return typeof r === 'number' && Number.isFinite(r) ? r : 0
  }
  if (spec.parent) return 0
  const col = REV_COLS.find((c) => Object.prototype.hasOwnProperty.call(row, c))
  const v = col ? row[col] : undefined
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** 修订号列的优先级（按建表习惯：改过的行一定动 updated_at，其次才看 created_at） */
const REV_COLS = ['updated_at', 'created_at'] as const

/** 这张表拿哪一列当修订号；一张时间戳列都没有 → undefined（该表比不出新旧） */
function revColumn(db: Database.Database, table: string): string | undefined {
  const cols = columnsOf(db, table)
  return REV_COLS.find((c) => cols.includes(c))
}

/** 拉平还是推送，仍然按 `exportedAt` 比一次就够（它只决定「要不要拉」，
 * 拉下来谁赢由 `syncMerge` 的三方判据决定） */
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

  /** 本机设备身份：第一次用到时生成并落下，之后只读（它进冲突副本的标题） */
  deviceId(): string {
    const row = this.db
      .prepare('SELECT value FROM pref_preferences WHERE key = ?')
      .get(DEVICE_ID_PREF) as { value: string } | undefined
    if (row) {
      try {
        const v = JSON.parse(row.value) as unknown
        if (typeof v === 'string' && v) return v.slice(0, 40)
      } catch {
        /* 存量脏值：下面重新生成一个 */
      }
    }
    const id = `${safeAppName()}-${randomBytes(4).toString('hex')}`
    this.db
      .prepare('INSERT OR REPLACE INTO pref_preferences (key, value, updated_at) VALUES (?,?,?)')
      .run(DEVICE_ID_PREF, JSON.stringify(id), Date.now())
    return id
  }

  /** 一张表的全量行 + 行修订号（`__rev`）。子表按父行的时间戳算，对端才比得出新旧 */
  rowsOf(spec: SyncSpec): MergeRow[] {
    const rows = readTable(this.db, spec.table)
    const parent = spec.parent
    if (parent) {
      const parents = new Map(
        (readTable(this.db, parent.table) as Array<Record<string, unknown>>).map((r) => [
          String(r[parent.parentCol] ?? ''),
          Number(r[parent.revCol] ?? 0)
        ])
      )
      return rows.map((r) => ({
        ...r,
        __rev: parents.get(String(r[parent.childCol] ?? '')) ?? 0
      }))
    }
    const col = revColumn(this.db, spec.table)
    return rows.map((r) => ({ ...r, __rev: col ? Number(r[col] ?? 0) : 0 }))
  }

  buildBundle(): SyncBundle {
    const tables: Record<string, Array<Record<string, unknown>>> = {}
    for (const spec of SYNC_TABLE_SPECS) tables[spec.table] = this.rowsOf(spec)
    return {
      version: 2,
      exportedAt: Date.now(),
      device: safeAppName(),
      deviceId: this.deviceId(),
      tables
    }
  }

  /** 上次同步见过的每一行（三方合并的第三方）：修订号 + 可选墓碑 */
  private readState(table: string): StateTable {
    const rows = this.db
      .prepare('SELECT row_key, rev, deleted_at FROM sync_state WHERE tbl = ?')
      .all(table) as Array<{ row_key: string; rev: number; deleted_at: number | null }>
    const out: StateTable = {}
    for (const r of rows)
      out[r.row_key] = { rev: r.rev, ...(r.deleted_at ? { deletedAt: r.deleted_at } : {}) }
    return out
  }

  private writeState(table: string, state: StateTable): void {
    const put = this.db.prepare(
      'INSERT OR REPLACE INTO sync_state (tbl, row_key, rev, deleted_at) VALUES (?,?,?,?)'
    )
    for (const [key, v] of Object.entries(state)) put.run(table, key, v.rev, v.deletedAt ?? null)
  }

  /**
   * 三方合并后回写本地（P-5①）。**不再有「远端没有就删本地」那一句**：
   * 那一句正是「我昨天写的笔记没了」的来源，删除改走 `sync_state` 的墓碑。
   * 单事务：半合并状态（一半新一半旧）比不合并更糟，宁可整笔失败重来。
   */
  mergeBundle(
    bundle: SyncBundle,
    now = Date.now()
  ): MergeSummary & { conflicts: ConflictRecord[] } {
    const stamp = new Date(now).toLocaleString()
    const device = bundle.deviceId ? bundle.deviceId.slice(0, 12) : '对端'
    const outs: ReturnType<typeof mergeTable>[] = []
    const tx = this.db.transaction(() => {
      for (const spec of SYNC_TABLE_SPECS) {
        const remote: MergeRow[] = (bundle.tables[spec.table] ?? []).map((r) => ({
          ...r,
          __rev: revOfRemoteRow(spec, r, bundle.version ?? 1)
        }))
        const r = mergeTable({
          spec,
          local: this.rowsOf(spec),
          remote,
          state: this.readState(spec.table),
          now,
          device,
          stamp
        })
        const cols = columnsOf(this.db, spec.table)
        const placeholders = cols.map(() => '?').join(',')
        const upsert = this.db.prepare(
          `INSERT OR REPLACE INTO ${spec.table} (${cols.join(',')}) VALUES (${placeholders})`
        )
        for (const row of r.upsert) {
          upsert.run(...cols.map((c) => (row[c] === undefined ? null : row[c])))
        }
        const del = this.db.prepare(
          `DELETE FROM ${spec.table} WHERE ${spec.pk.map((k) => `${k} = ?`).join(' AND ')}`
        )
        for (const key of r.removeKeys) del.run(...pkValues(spec, key))
        this.writeState(spec.table, r.nextState)
        outs.push(r)
      }
    })
    tx()
    return summarize(outs)
  }

  /** @deprecated 旧的镜像覆盖回写；由 `mergeBundle()` 取代（三方判据 + 墓碑） */
  applyBundle(bundle: SyncBundle): { applied: number } {
    const r = this.mergeBundle(bundle)
    return { applied: r.upserted + r.removed }
  }

  /**
   * 推送成功之后记基线：**远端此刻就是这份 bundle 的样子**。
   *
   * 少这一步，先推的那台设备永远没有「第三方」：对端删掉一行之后它拉下来看到的是
   * 「本地有这行、远端没有、我也没见过这行」，按判据只能不删（删了就等于拿猜测量盖用户数据）
   * ——于是删除传不过去。真链路单测（两台设备互拉）把这个洞跑了出来。
   *
   * 实现是「与自己刚发布的那份合一次」：local 与 remote 逐行相同，判据里只剩两种落子——
   * 两边都有的行记下修订号、两边都没有的行（本地已删）盖上墓碑。正是「记基线」这件事，
   * 不必另写一套规则，也就不会与 mergeBundle 漂移。
   */
  markPublished(bundle: SyncBundle, now = Date.now()): void {
    this.mergeBundle(bundle, now)
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

async function syncClient(config: SyncConfig): Promise<{ client: WebDAVClient; password: string }> {
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

/**
 * 一次同步所依赖的「外部世界」：库、WebDAV 配置、记账位、快照落盘点。
 * 生产全走默认；单测要模拟**两台设备**互拉，就得把每台的那四样各换一份进来
 * ——否则「同步真的不丢东西」这句话只能在真机上验，而真机验收一直排不上。
 */
export interface SyncDeps {
  db?: Database.Database
  config?: SyncConfig
  readApplied?: () => number
  markApplied?: (ts: number) => void
  snapshot?: () => string
}

function resolveDeps(
  deps: SyncDeps,
  service: DataSyncService
): {
  config: SyncConfig
  readApplied: () => number
  markApplied: (ts: number) => void
  snapshot: () => string
} {
  return {
    config: deps.config ?? getSyncConfig(),
    readApplied: deps.readApplied ?? ((): number => Number(prefGet(SYNC_MARKER_PREF) ?? '0')),
    markApplied: deps.markApplied ?? ((ts) => prefSet(SYNC_MARKER_PREF, String(ts))),
    snapshot: deps.snapshot ?? ((): string => service.snapshot())
  }
}

/** 推送本地（后写覆盖：覆盖远端 bundle），并记录 lastAppliedAt */
export async function pushDataSync(deps: SyncDeps = {}): Promise<{
  ok: boolean
  decision?: SyncDecision
  error?: string
}> {
  try {
    const service = new DataSyncService(deps.db)
    const { config, markApplied } = resolveDeps(deps, service)
    const { client, password } = await syncClient(config)
    const bundle = service.buildBundle()
    const buf = encryptBundle(bundle, password)
    const remotePath = `${config.remoteDir}/${SYNC_REMOTE_DIR}`
    await client.putFileContents(`${remotePath}/bundle.json.enc`, buf, { overwrite: true })
    await client.putFileContents(
      `${remotePath}/latest.json`,
      JSON.stringify({ exportedAt: bundle.exportedAt, device: bundle.device })
    )
    service.markPublished(bundle)
    markApplied(bundle.exportedAt)
    return { ok: true, decision: 'push' }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

/** 拉平（决策：远端更新才覆盖本地；覆盖前本地快照；远端不存在时转为推送） */
export async function pullDataSync(deps: SyncDeps = {}): Promise<{
  ok: boolean
  decision?: SyncDecision
  applied?: number
  snapshot?: string
  /** 本次合并里被判为「两边都改过 / 删除撞上编辑」的行数（>0 才带上） */
  conflicts?: number
  error?: string
}> {
  try {
    const service = new DataSyncService(deps.db)
    const { config, readApplied, markApplied, snapshot: takeSnapshot } = resolveDeps(deps, service)
    const { client, password } = await syncClient(config)
    const remotePath = `${config.remoteDir}/${SYNC_REMOTE_DIR}`
    const hasBundle = await client.exists(`${remotePath}/bundle.json.enc`)
    if (!hasBundle) {
      const r = await pushDataSync({ ...deps, config, markApplied })
      return { ok: r.ok, decision: 'push', error: r.error }
    }
    const latest = JSON.parse(
      String(await client.getFileContents(`${remotePath}/latest.json`, { format: 'text' }))
    ) as { exportedAt: number }
    const decision = decideSync(latest.exportedAt, readApplied(), true)
    if (decision !== 'pull') return { ok: true, decision }
    const buf = (await client.getFileContents(`${remotePath}/bundle.json.enc`, {
      format: 'binary'
    })) as Buffer
    const bundle = decryptBundle(buf, password)
    const snapshot = takeSnapshot()
    const r = service.mergeBundle(bundle)
    markApplied(bundle.exportedAt)
    // conflicts 带出去给状态页：合并「成功」不等于「没分歧」，
    // 只报 applied 会让人以为同步把两边捏成了一份，实际是并集 + 冲突副本
    return {
      ok: true,
      decision: 'pull',
      applied: r.upserted + r.removed,
      snapshot,
      ...(r.conflicts.length > 0 ? { conflicts: r.conflicts.length } : {})
    }
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
