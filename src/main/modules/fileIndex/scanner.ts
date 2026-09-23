/**
 * Frond · 文件索引扫描器（#9，路径统一索引形态见 paths.ts）
 *
 * - fullScan：初始全量，异步分片（每批 yield 事件循环，主进程单次阻塞 < 16ms）
 * - rescanDir：单目录增量 diff（事件批处理后调用），增/删/改全走
 *   「现读目录 vs DB 子项」对比，天然覆盖改名（= 删旧 + 增新）
 *
 * 排除剪枝在递归入口完成：命中目录直接不进入（node_modules 内部永不 stat）。
 */
import { readdir, stat, readFile, stat as statCb } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import type { FileIndexDb, FileIndexRow } from './db'
import { shouldExcludeDir, shouldExcludeFile, type ExcludePolicy } from './excludes'
import { skeletonize } from './skeleton'
import { isContentEligible, contentFromBuffer } from './content'
import { normPath, joinNorm } from './paths'

const BATCH_SIZE = 400
/** 单批字节上限：better-sqlite3 单事务同步写，批的体积决定主进程单次阻塞时长
 * （实测 400 行 × 512KB content ≈ 276ms，远超 <16ms 预算——按字节分批，审查 I-4） */
const BATCH_BYTES = 2 * 1024 * 1024
const FROND_IGNORE = '.frondignore'

export interface FullScanOptions {
  roots: string[]
  db: FileIndexDb
  policy: ExcludePolicy
  onProgress?: (scanned: number) => void
  signal?: { aborted: boolean }
  /** 条目上限（磁盘保护，审查 I-9）：达到即停扫，服务层置 capped 状态 */
  maxEntries?: number
  /** 范围校验（防御纵深）：增量发现的新目录超出范围时不递归索引 */
  inScope?: (path: string) => boolean
}

/** 单个范围读不到（外接卷未挂载 / 权限）时的记录 */
export interface UnavailableRoot {
  root: string
  reason: string
}

export interface FullScanResult {
  scanned: number
  /** 本次跳过的范围（不视为整体失败：其余范围照常索引） */
  unavailable: UnavailableRoot[]
}

const yieldToLoop = (): Promise<void> => new Promise((r) => setImmediate(r))

/** 目录 mtime 纪元（秒级足够，跨平台一致） */
function dirEpoch(ms: number): number {
  return Math.floor(ms / 1000)
}

/** 批量写入 + 分片 yield：行数与累计字节双阈值 */
class RowBuffer {
  private batch: FileIndexRow[] = []
  private bytes = 0
  constructor(
    private db: FileIndexDb,
    private onProgress: ((scanned: number) => void) | undefined,
    public scanned = 0
  ) {}

  async push(row: FileIndexRow | null): Promise<void> {
    if (row) {
      this.batch.push(row)
      this.bytes +=
        row.path.length + row.name.length + row.skeleton.length + (row.content?.length ?? 0) + 64
    }
    if (this.batch.length >= BATCH_SIZE || this.bytes >= BATCH_BYTES) {
      this.db.upsertFiles(this.batch)
      this.batch = []
      this.bytes = 0
      this.onProgress?.(this.scanned)
      await yieldToLoop()
    }
  }

  flush(): void {
    if (this.batch.length > 0) {
      this.db.upsertFiles(this.batch)
      this.batch = []
      this.bytes = 0
      this.onProgress?.(this.scanned)
    }
  }
}

async function statEntry(path: string): Promise<{ size: number; mtime: number; isDir: boolean }> {
  const s = await statCb(path)
  return { size: s.size, mtime: s.mtimeMs, isDir: s.isDirectory() }
}

/** 读取单文件的索引行（skeleton + 内容提取）；目录行 content 为 null */
async function buildRow(
  path: string,
  parent: string,
  name: string,
  policy: ExcludePolicy
): Promise<FileIndexRow | null> {
  if (shouldExcludeFile(name, policy)) return null
  const { size, mtime, isDir } = await statEntry(path)
  if (isDir) {
    return {
      path,
      parent,
      name,
      ext: null,
      size: null,
      mtime,
      isDir: true,
      skeleton: await skeletonize(name),
      content: null
    }
  }
  const dot = name.lastIndexOf('.')
  const ext = dot === -1 ? null : name.slice(dot + 1).toLowerCase()
  let content: string | null = null
  if (isContentEligible(name, size)) {
    try {
      const buf = await readFile(path)
      content = contentFromBuffer(buf)
    } catch {
      /* 读取失败按无正文处理 */
    }
  }
  return {
    path,
    parent,
    name,
    ext,
    size,
    mtime,
    isDir: false,
    skeleton: await skeletonize(name),
    content
  }
}

/**
 * 初始全量扫描。**逐根隔离**：某个范围当前读不到（外接卷没挂载、权限、目录被删）
 * 只跳过它并记进 unavailable，其余范围照常索引 —— 早先不隔离时一次 ENOENT 会冒到
 * 服务层把整个索引置 error，拔一块移动盘就让文件搜索全线退回 mdfind。
 * 跳过范围的历史索引行**不删**：卷重新插回来还能用，误删反而要全量重扫。
 */
export async function fullScan(opts: FullScanOptions): Promise<FullScanResult> {
  const buffer = new RowBuffer(opts.db, opts.onProgress)
  const walk = async (dir: string, parent: string, name: string): Promise<void> => {
    if (opts.signal?.aborted) return
    // .frondignore 标记目录整棵跳过（含 root 自身——审查 I-5 (a) 路径）
    if (existsSync(join(dir, FROND_IGNORE))) return
    if (opts.maxEntries !== undefined && buffer.scanned >= opts.maxEntries) return
    // 目录行（root 行 parent 取其父；顶层 root 的 parent 为自身以免 parent 为空串）
    await buffer.push(await buildRow(dir, parent, name, opts.policy))
    const entries = await readdir(dir, { withFileTypes: true })
    const dirEpochValue = dirEpoch((await stat(dir)).mtimeMs)
    for (const entry of entries) {
      if (opts.signal?.aborted) return
      const childPath = joinNorm(dir, entry.name)
      if (entry.isDirectory()) {
        if (shouldExcludeDir(entry.name, opts.policy)) continue
        if (opts.inScope && !opts.inScope(childPath)) continue
        await walk(childPath, dir, entry.name)
        continue
      }
      if (!entry.isFile()) continue
      if (shouldExcludeFile(entry.name, opts.policy)) continue
      buffer.scanned++
      await buffer.push(await buildRow(childPath, dir, entry.name, opts.policy))
    }
    opts.db.markDir(dir, dirEpochValue)
  }
  const unavailable: UnavailableRoot[] = []
  for (const rawRoot of opts.roots) {
    const root = normPath(rawRoot)
    if (!root) continue
    try {
      await walk(root, dirname(root), root.split('/').pop() ?? root)
    } catch (error) {
      const e = error as NodeJS.ErrnoException
      unavailable.push({ root, reason: `${e.code ?? 'ERR'}: ${e.message}` })
    }
  }
  buffer.flush()
  return { scanned: buffer.scanned, unavailable }
}

/**
 * 单目录增量 diff：现读目录子项 vs DB 子项 → 增/删/改。
 * 目录水位推进；新增子目录递归全扫（须过 inScope 与 .frondignore 检查，审查 I-1/I-5 (b)）。
 */
export async function rescanDir(
  db: FileIndexDb,
  rawDir: string,
  policy: ExcludePolicy,
  inScope?: (path: string) => boolean
): Promise<void> {
  const dir = normPath(rawDir)
  if (!existsSync(dir)) {
    db.deleteByPrefix(`${dir}/`)
    db.deleteByPaths([dir])
    return
  }
  // .frondignore 标记目录：清掉已有行并跳过（增量路径的 (b) 分支）
  if (existsSync(join(dir, FROND_IGNORE))) {
    db.deleteByPrefix(`${dir}/`)
    db.deleteByPaths([dir])
    return
  }
  const entries = await readdir(dir, { withFileTypes: true })
  const current = new Map<string, { isDir: boolean; name: string }>()
  for (const entry of entries) {
    current.set(entry.name, { isDir: entry.isDirectory(), name: entry.name })
  }
  const dbChildren = db.listDirChildren(dir)
  // 删除：DB 有、现读无（含被排除的旧子项）
  const missing = dbChildren.filter((c) => !current.has(c.name)).map((c) => c.path)
  if (missing.length > 0) {
    for (const p of missing) {
      db.deleteByPrefix(`${p}/`)
    }
    db.deleteByPaths(missing)
  }
  // 新增 / 更新
  for (const [name, info] of current) {
    const childPath = joinNorm(dir, name)
    if (info.isDir) {
      if (shouldExcludeDir(name, policy)) continue
      const existing = dbChildren.find((c) => c.name === name)
      if (
        !existing &&
        (!inScope || inScope(childPath)) &&
        !existsSync(join(childPath, FROND_IGNORE))
      ) {
        await fullScan({ roots: [childPath], db, policy })
      }
      continue
    }
    if (shouldExcludeFile(name, policy)) continue
    const existing = dbChildren.find((c) => c.name === name)
    const { mtime } = await statEntry(childPath)
    if (
      existing &&
      existing.mtime !== null &&
      Math.floor(existing.mtime / 1000) === dirEpoch(mtime)
    ) {
      continue // mtime 未变（秒级）→ 跳过
    }
    const row = await buildRow(childPath, dir, name, policy)
    if (row) db.upsertFiles([row])
  }
  db.markDir(dir, dirEpoch((await stat(dir)).mtimeMs))
}

/** 每处理这么多目录让出一次事件循环（一趟只 stat，不做 readdir，成本远低于重建） */
const COMPENSATE_YIELD_EVERY = 256

/**
 * 启动期水位补偿：进程停机期间的变更事件源不会回溯（监听只报此后发生的事件），
 * 那些变更原本要等手动重建才回补。这里用 dirs 水位逐目录比对 mtime：变了才 rescanDir，
 * 没变的目录连 readdir 都不做；目录已消失则连索引行与子孙水位一并清掉（顺带止住水位泄漏）。
 *
 * 已知边界：原地改文件内容不会改目录 mtime，这类漂移本轮不回补（内容检索是次级能力）。
 */
export async function compensateStaleDirs(
  db: FileIndexDb,
  policy: ExcludePolicy,
  inScope: (path: string) => boolean,
  signal?: { aborted: boolean }
): Promise<number> {
  let rescanned = 0
  let visited = 0
  for (const dir of db.listDirs()) {
    if (signal?.aborted) break
    if (!inScope(dir.path)) continue // 范围已收缩：留给重建清理，此处不动
    let epoch: number | null
    try {
      epoch = dirEpoch((await stat(dir.path)).mtimeMs)
    } catch {
      epoch = null // 已删除 / 无权限
    }
    if (epoch === null) {
      db.deleteByPrefix(`${dir.path}/`)
      db.deleteByPaths([dir.path])
      db.deleteDirsAt(dir.path)
    } else if (epoch !== dir.mtimeEpoch) {
      await rescanDir(db, dir.path, policy, inScope)
      rescanned++
    }
    if (++visited % COMPENSATE_YIELD_EVERY === 0) await yieldToLoop()
  }
  return rescanned
}
