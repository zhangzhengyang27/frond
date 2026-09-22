/**
 * Leaf · 文件索引服务（#9，M1 macOS / M2 起含 Windows）
 *
 * - ensureStarted：打开 userData/file-index.db，默认范围 home（首次写入 meta），
 *   files 为空时后台全量扫描（分片不阻塞），随后按平台启动事件监听
 *   （darwin=fsevents / win32=@parcel/watcher）；库里已有数据时另起一趟目录水位补偿
 *   （停机期间的变更事件源不回溯）
 * - 增量：事件路径合并节流 500ms → 逐目录 rescanDir diff（增/删/改/改名全覆盖）；
 *   事件路径先按 scope 过滤（审查 I-1：scope 根自身事件不得把 parent 带成范围外目录）
 * - 状态机：disabled（无可用平台）/ scanning（全量中）/ ready / capped（条目达上限）/
 *   error；scanning 期间文件搜索回退 mdfind，ready 后索引优先
 * - 重建：clearAll + 重跑全量（管理页触发；范围变更同样触发），watcher 随范围重启
 *   （审查 I-6：只重建不重启 watcher 会让新范围永无增量）
 */
import { app } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { FileIndexDb } from './db'
import { fullScan, rescanDir, compensateStaleDirs, type UnavailableRoot } from './scanner'
import type { ExcludePolicy } from './excludes'
import { normPath, isInScope, dirsForEvents, partitionReadable } from './paths'
import { activeBackend } from './watcher'
import type { FileIndexHit, FileSearchMode } from './db'

export type FileIndexStatus = 'disabled' | 'scanning' | 'ready' | 'capped' | 'error'

const SCOPES_KEY = 'scopes'
const HIDDEN_KEY = 'hidden'
const FLUSH_MS = 500
/** 有范围被跳过时，隔这么久探一次它是否重新可读（外接卷插回来不必等手动重建） */
const REARM_MS = 60_000
/** 条目上限（设计 §4 磁盘保护；触顶停扫并置 capped，管理页提示） */
export const FILE_INDEX_MAX_ENTRIES = 500_000

class FileIndexService {
  private db: FileIndexDb | null = null
  private stopWatch: (() => void) | null = null
  private statusValue: FileIndexStatus = 'disabled'
  private errorValue: string | null = null
  private filesValue = 0
  private lastFullScan: number | null = null
  private pendingPaths = new Set<string>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private scanGeneration = 0
  /** scopes 只在写时变化，但每条事件路径/每个水位目录都要判一次 → 缓存避免反复 JSON.parse */
  private scopesCache: string[] | null = null
  /** 补扫轮询定时器（仅在存在被跳过范围时存在） */
  private rearmTimer: ReturnType<typeof setInterval> | null = null
  /** 最近一次扫描里读不到的范围（外接卷未挂载等），随状态上报给管理页 */
  private unavailableRoots: UnavailableRoot[] = []

  /** 有自建索引可用（#9 M2 起含 Windows）；其余平台留 null → 上层回退系统检索 */
  get enabled(): boolean {
    return process.platform === 'darwin' || process.platform === 'win32'
  }

  getStatus(): {
    status: FileIndexStatus
    files: number
    scopes: string[]
    lastFullScan: number | null
    error: string | null
    hidden: boolean
    unavailable: UnavailableRoot[]
  } {
    return {
      status: this.statusValue,
      files: this.db?.count() ?? this.filesValue,
      scopes: this.getScopes(),
      lastFullScan: this.lastFullScan,
      error: this.errorValue,
      hidden: this.getHidden(),
      unavailable: this.unavailableRoots
    }
  }

  getScopes(): string[] {
    if (!this.db) return []
    if (this.scopesCache) return this.scopesCache
    try {
      const raw = this.db.getMeta(SCOPES_KEY)
      const parsed = raw ? (JSON.parse(raw) as unknown) : null
      this.scopesCache = Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === 'string').map(normPath)
        : []
    } catch {
      this.scopesCache = []
    }
    return this.scopesCache
  }

  setScopes(dirs: string[]): void {
    if (!this.db) return
    // 绝对路径口径跨平台：POSIX '/…' 与 Windows 'C:\…' / 'C:/…' 都接受，统一折算
    const clean = [
      ...new Set(
        dirs
          .filter(
            (d): d is string => typeof d === 'string' && /^([a-zA-Z]:[\\/]|\/)/.test(d.trim())
          )
          .map((d) => normPath(d.trim()))
      )
    ]
    this.db.setMeta(SCOPES_KEY, JSON.stringify(clean))
    this.scopesCache = clean
    // 审查 I-6：范围变更必须重启 watcher——只重建会让新范围永无增量、旧范围持续监听
    this.stopWatcher()
    void this.rebuild()
  }

  getHidden(): boolean {
    return this.db?.getMeta(HIDDEN_KEY) !== 'false'
  }

  setHidden(value: boolean): void {
    // 隐藏开关影响存量索引（dot 文件已在库中）——必须重建才生效（审查 I-9）
    this.db?.setMeta(HIDDEN_KEY, value ? 'true' : 'false')
    void this.rebuild()
  }

  /** 幂等启动（非 macOS 直接 disabled） */
  async ensureStarted(): Promise<void> {
    if (!this.enabled) {
      this.statusValue = 'disabled'
      return
    }
    if (this.db) return
    try {
      this.db = FileIndexDb.open(join(app.getPath('userData'), 'file-index.db'))
      if (!this.db.getMeta(SCOPES_KEY)) {
        // e2e 覆盖：LEAF_FILE_INDEX_SCOPES（JSON 数组或单路径）优先于默认 home，
        // 让测试用可控小目录验证索引链路，同时避免 e2e 触发 home 全量扫描
        const envScopes = process.env.LEAF_FILE_INDEX_SCOPES
        let scopes: string[] = [homedir()]
        if (envScopes) {
          try {
            const parsed = JSON.parse(envScopes) as unknown
            scopes = Array.isArray(parsed)
              ? parsed.filter((s): s is string => typeof s === 'string')
              : [String(envScopes)]
          } catch {
            scopes = [envScopes]
          }
        }
        this.db.setMeta(SCOPES_KEY, JSON.stringify(scopes))
        this.scopesCache = scopes // 首启写默认范围走的裸 setMeta，缓存同步跟上
      }
      this.statusValue = 'scanning'
      this.filesValue = this.db.count()
      if (this.filesValue === 0) {
        void this.runFullScan()
      } else {
        this.statusValue = 'ready'
        // 停机期间的变更事件源不回溯，用目录水位补一趟（后台分片，不拖首屏）
        void this.compensateMissed()
        if (!this.db.triPopulated()) {
          // 老库升级：trigram 影子表是就地补的，历史行不在里面 → 中缀兜底查不到东西。
          // 走既有分片重建补齐（全量重扫本来就 yield 事件循环，不会卡启动）
          console.error('[FileIndex] 检测到中缀索引未建立，后台重建一次')
          void this.rebuild()
        }
      }
      this.startWatcher()
    } catch (error) {
      this.statusValue = 'error'
      this.errorValue = (error as Error).message
    }
  }

  /** 全量重建（管理页 / 范围变更 / 隐藏开关） */
  async rebuild(): Promise<void> {
    if (!this.db) return
    this.scanGeneration++
    this.db.clearAll()
    this.filesValue = 0
    await this.runFullScan()
  }

  private async runFullScan(): Promise<void> {
    const generation = ++this.scanGeneration
    this.statusValue = 'scanning'
    try {
      const result = await fullScan({
        roots: this.getScopes(),
        db: this.db!,
        policy: this.policy(),
        maxEntries: FILE_INDEX_MAX_ENTRIES,
        signal: this.signalFor(generation)
      })
      if (generation === this.scanGeneration) {
        this.unavailableRoots = result.unavailable
        this.lastFullScan = Date.now()
        this.filesValue = this.db!.count()
        if (this.unavailableRoots.length > 0) {
          // 部分范围读不到不算整体失败：其余条目照常可搜，管理页单列提醒
          console.error(
            '[FileIndex] 以下范围本次不可读，已跳过：',
            this.unavailableRoots.map((u) => `${u.root}（${u.reason}）`).join('；')
          )
        }
        // 全部范围都读不到 → 没有可用索引，如实置 error
        if (this.filesValue === 0 && this.unavailableRoots.length > 0) {
          this.statusValue = 'error'
          this.errorValue = `所有索引范围均不可读：${this.unavailableRoots[0]?.root ?? ''}`
          return
        }
        // 触顶：不再继续索引，管理页提示用户收窄范围（审查 I-9）
        this.statusValue = this.filesValue >= FILE_INDEX_MAX_ENTRIES ? 'capped' : 'ready'
        this.startWatcher()
        this.scheduleRearm()
      }
    } catch (error) {
      if (generation === this.scanGeneration) {
        this.statusValue = 'error'
        this.errorValue = (error as Error).message
      }
    }
  }

  /**
   * 断连卷补扫：上次被跳过的范围，插回来后不必等用户手动重建。
   * 只在「确实有范围被跳过」时才起轮询（正常态零开销）；用轮询而非卷事件是因为
   * 挂载事件是平台私有的（macOS NSWorkspace / Windows 设备通知），而这里一次
   * statSync 的成本可以忽略。
   */
  private scheduleRearm(): void {
    if (this.unavailableRoots.length === 0) {
      this.stopRearm()
      return
    }
    if (this.rearmTimer) return
    this.rearmTimer = setInterval(() => {
      void this.rearmOnce()
    }, REARM_MS)
    ;(this.rearmTimer as { unref?: () => void }).unref?.()
  }

  private stopRearm(): void {
    if (!this.rearmTimer) return
    clearInterval(this.rearmTimer)
    this.rearmTimer = null
  }

  private async rearmOnce(): Promise<void> {
    const db = this.db
    if (!db || this.statusValue === 'scanning') return
    const roots = this.unavailableRoots.map((u) => u.root)
    const { ready, still } = partitionReadable(roots)
    if (ready.length === 0) return
    if (this.statusValue === 'error') {
      // 之前是「所有范围都读不到」才置的 error，现在至少有一个能扫了
      this.statusValue = 'ready'
      this.errorValue = null
    }
    console.error('[FileIndex] 范围重新可读，补扫：', ready.join('、'))
    this.unavailableRoots = this.unavailableRoots.filter((u) => still.includes(u.root))
    const generation = this.scanGeneration
    const result = await fullScan({
      roots: ready,
      db,
      policy: this.policy(),
      maxEntries: FILE_INDEX_MAX_ENTRIES,
      signal: this.signalFor(generation)
    })
    if (generation !== this.scanGeneration) return // 期间被重建/改范围接管
    this.unavailableRoots = [...this.unavailableRoots, ...result.unavailable]
    this.filesValue = db.count()
    // 新回来的范围此前不在 watcher 的监听集里：整组重启（与 setScopes 同一手法）
    this.stopWatcher()
    this.startWatcher()
    this.scheduleRearm()
  }

  /** 扫描中止标志：generation 过期（重建/范围变更后）即中止旧扫描 */
  private signalFor(generation: number): { aborted: boolean } {
    const isAborted = (): boolean => generation !== this.scanGeneration
    return {
      get aborted(): boolean {
        return isAborted()
      }
    }
  }

  private policy(): ExcludePolicy {
    return { hidden: this.getHidden() }
  }

  /** 事件源按平台取后端（darwin=fsevents，win32=@parcel/watcher）；无后端时索引仍可用 */
  private startWatcher(): void {    if (this.stopWatch) return
    const scopes = this.getScopes()
    if (scopes.length === 0) return
    const backend = activeBackend()
    if (!backend) return
    void backend
      .watch(scopes, (path) => {
        this.pendingPaths.add(path)
        this.scheduleFlush()
      })
      .then((stop) => {
        // 启动期间被 stopWatcher 掉过（改范围/重建）：立刻反注册，不留僵尸句柄
        if (this.stopWatch) stop()
        else this.stopWatch = stop
      })
      .catch((error: unknown) => {
        console.error(
          '[FileIndex] 增量监听启动失败（索引仍可用，靠启动补偿与手动重建）:',
          (error as Error).message
        )
      })
  }

  private stopWatcher(): void {
    this.stopWatch?.()
    this.stopWatch = null
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flushPending()
    }, FLUSH_MS)
  }

  /**
   * 事件批处理：事件路径先按 scope 过滤（含 parent 归约的每一步），
   * 再逐目录 diff。rebuild/范围变更进行中（generation 过期）立即停止，
   * 防止旧数据写回清空的库（审查 I-7）；扫描中收到的积压事件重排定时器
   * 待扫描完成后处理（审查 Minor-2）。
   */
  private async flushPending(): Promise<void> {
    if (!this.db) return
    if (this.statusValue === 'scanning') {
      if (this.pendingPaths.size > 0) this.scheduleFlush()
      return
    }
    const generation = this.scanGeneration
    const inScope = this.inScopePath
    const scopes = this.getScopes()
    const paths = [...this.pendingPaths]
    this.pendingPaths.clear()
    const dirs = dirsForEvents(scopes, paths)
    const policy = this.policy()
    for (const dir of dirs) {
      if (generation !== this.scanGeneration) return // 审查 I-7：重建开始后停止写入
      try {
        await rescanDir(this.db, dir, policy, inScope)
      } catch {
        /* 单目录失败不中断本轮 */
      }
    }
    this.filesValue = this.db.count()
  }

  /** 路径是否落在当前索引范围内（增量与补偿共用一份判定） */
  private inScopePath = (p: string): boolean => isInScope(this.getScopes(), p)

  /**
   * 启动期补偿：事件源只报开始监听之后的变更，进程停机期间的增删改名会漏掉。
   * 逐目录水位比对（一趟每目录一次 stat，变了才 rescanDir）后台补齐；
   * 期间用户触发重建（generation 变化）即中止，避免与重建抢写。
   */
  private async compensateMissed(): Promise<void> {
    const db = this.db
    if (!db) return
    const generation = this.scanGeneration
    try {
      await compensateStaleDirs(db, this.policy(), this.inScopePath, this.signalFor(generation))
      this.filesValue = db.count()
    } catch {
      /* 补偿失败不影响既有索引可用（下次事件或重建会覆盖） */
    }
  }

  /**
   * 索引查询；未就绪返回 null（调用方回退 mdfind/PowerShell）。
   * name 模式零结果时先补一次 trigram 中缀（unicode61 的前缀匹配进不去连续 CJK
   * 串的中段），仍然空才让上层去回退系统检索。
   */
  query(tokens: string[], mode: FileSearchMode, limit: number): FileIndexHit[] | null {
    if (!this.db || (this.statusValue !== 'ready' && this.statusValue !== 'capped')) return null
    try {
      const rows = this.db.search(tokens, { mode, limit })
      if (rows.length > 0 || mode !== 'name') return rows
      return this.db.searchInfix(tokens, limit)
    } catch {
      return null
    }
  }
}

export const fileIndex = new FileIndexService()
