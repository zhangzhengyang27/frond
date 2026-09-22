/**
 * Leaf · 剪贴板历史服务（阶段B：胶囊「剪贴板历史」内联页）
 *
 * 主进程轮询系统剪贴板（1s），捕获文本 / 图片 / 文件变更：
 * - 文本：readText() 非空即比对指纹去重；内容为 http(s) URL 时 kind 记为 link
 * - 图片：仅在无文本且 availableFormats 含 image 时，用 8px 缩略图做廉价指纹，
 *   变更时才 toPNG 落盘到 userData/clipboard-history/
 * - 文件：mac 读 NSFilenamesPboardType（plist），win 读 FileNameW（单文件）
 * - 容量：最多 200 条，图片文件最多 50 张；置顶条目不受容量/保留期淘汰
 *
 * 持久化：条目索引原子写入同目录 index.json，启动时恢复（图片文件缺失的
 * 条目剔除），保留期 30 天，到期条目启动时清理。
 *
 * 隐私：历史仅驻本机（内存 + userData/clipboard-history），不参与任何同步；
 * 清空按钮会立即删除索引与全部图片文件。
 */
import { execFile } from 'child_process'
import { app, clipboard, nativeImage } from 'electron'
import { createHash } from 'crypto'
import { join } from 'path'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  renameSync,
  rmSync
} from 'fs'
import plist from 'plist'
import { encryptText, decryptText } from '../utils/crypto'

/** P1-6：敏感应用屏蔽默认列表（密码管理器等） */
const DEFAULT_BLOCKED_APPS = ['钥匙串访问', '密码', '1Password', 'Bitwarden', 'KeePass']

export type ClipboardItemKind = 'text' | 'image' | 'files' | 'link'

export interface ClipboardHistoryItem {
  id: string
  kind: ClipboardItemKind
  /** text / link 时的完整文本（link 即 URL） */
  text?: string
  /** kind=files 时的文件路径列表 */
  paths?: string[]
  /** kind=image 时的 PNG 落盘路径（渲染端走 image:// 协议） */
  filePath?: string
  width?: number
  height?: number
  pinned?: boolean
  createdAt: number
  /** 来源应用名（macOS 前台应用；旧数据 / 非 mac 缺失） */
  sourceApp?: string
  /** P1-6：图片 OCR 提取的文字（异步填充，可搜索） */
  ocrText?: string
  /** P1-6：OCR 处理状态（pending/done/failed），避免重复处理 */
  ocrStatus?: 'pending' | 'done' | 'failed'
}

const MAX_ITEMS = 200
const MAX_IMAGE_FILES = 50
const POLL_MS = 1000
/** 历史保留期：30 天（置顶条目不受限） */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000

const URL_RE = /^https?:\/\/\S+$/i

class ClipboardHistoryService {
  private items: ClipboardHistoryItem[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private lastTextFingerprint = ''
  private lastImageFingerprint = ''
  private lastFilesFingerprint = ''
  private dir = ''
  private enabled = true
  /** P1-6：依次粘贴的当前索引（从选中条目开始，每次 ⌘V 后递增） */
  private pasteSeqIndex = -1
  /** P1-6：OCR 工作标记（避免并发处理） */
  private ocrProcessing = false
  /** OCR 待处理队列（处理期间新到的图片排队，不再静默丢弃） */
  private ocrQueue: Array<{ id: string; filePath: string }> = []
  /** 轮询重入保护（前台应用查询改为异步后，防止上一轮未完成时叠加） */
  private pollBusy = false
  /** 屏蔽应用列表缓存（避免每秒读盘；setBlockedApps 时失效） */
  private blockedAppsCache: string[] | null = null

  start(): void {
    this.dir = join(app.getPath('userData'), 'clipboard-history')
    mkdirSync(this.dir, { recursive: true })
    this.enabled = this.readEnabled()
    if (!this.enabled) return
    if (this.timer) return
    this.loadPersisted()
    // 启动时把当前剪贴板内容纳入历史，避免首次复制被指纹误判
    this.lastTextFingerprint = this.fingerprintText(clipboard.readText())
    this.timer = setInterval(() => {
      void this.poll()
    }, POLL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    try {
      writeFileSync(this.enabledPath(), JSON.stringify({ enabled: on }))
    } catch {
      /* 持久化失败不影响本次会话 */
    }
    if (on) {
      this.start()
    } else {
      this.stop()
    }
  }

  getEnabled(): { enabled: boolean; supported: boolean } {
    return { enabled: this.enabled, supported: true }
  }

  // ───── P1-6：敏感应用屏蔽 ─────

  private blockedAppsPath(): string {
    return join(this.dir, 'blockedApps.json')
  }

  getBlockedApps(): string[] {
    if (this.blockedAppsCache) return [...this.blockedAppsCache]
    try {
      if (!existsSync(this.blockedAppsPath())) {
        this.blockedAppsCache = [...DEFAULT_BLOCKED_APPS]
        return [...DEFAULT_BLOCKED_APPS]
      }
      const raw = JSON.parse(readFileSync(this.blockedAppsPath(), 'utf-8')) as { apps?: unknown }
      const apps = Array.isArray(raw.apps)
        ? raw.apps.filter((a): a is string => typeof a === 'string')
        : [...DEFAULT_BLOCKED_APPS]
      this.blockedAppsCache = apps
      return [...apps]
    } catch {
      this.blockedAppsCache = [...DEFAULT_BLOCKED_APPS]
      return [...DEFAULT_BLOCKED_APPS]
    }
  }

  setBlockedApps(apps: string[]): void {
    try {
      writeFileSync(this.blockedAppsPath(), JSON.stringify({ apps }))
    } catch {
      /* 持久化失败不影响本次会话 */
    }
    this.blockedAppsCache = [...apps]
  }

  /**
   * macOS：获取前台应用名（AppleScript）；非 macOS 返回 null。
   * execFile 异步执行（不经 shell 也不阻塞主进程事件循环），2s 超时兜底。
   */
  private getFrontmostAppName(): Promise<string | null> {
    if (process.platform !== 'darwin') return Promise.resolve(null)
    return new Promise((resolve) => {
      execFile(
        'osascript',
        [
          '-e',
          'tell application "System Events" to get name of first application process whose frontmost is true'
        ],
        { timeout: 2000 },
        (error, stdout) => {
          if (error) {
            resolve(null)
            return
          }
          const name = String(stdout).trim()
          resolve(name || null)
        }
      )
    })
  }

  private isAppBlocked(appName: string): boolean {
    const blocked = this.getBlockedApps()
    return blocked.some((b) => appName.toLowerCase().includes(b.toLowerCase()))
  }

  private enabledPath(): string {
    return join(this.dir, 'enabled.json')
  }

  private readEnabled(): boolean {
    try {
      if (!existsSync(this.enabledPath())) return true
      const raw = JSON.parse(readFileSync(this.enabledPath(), 'utf-8')) as { enabled?: unknown }
      return raw.enabled !== false
    } catch {
      return true
    }
  }

  list(): ClipboardHistoryItem[] {
    // 置顶在前，其余按时间倒序
    return [...this.items].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
      return b.createdAt - a.createdAt
    })
  }



  togglePin(id: string): boolean {
    const item = this.items.find((i) => i.id === id)
    if (!item) return false
    item.pinned = !item.pinned
    this.persist()
    return true
  }

  /** 把指定历史条目写回系统剪贴板 */
  copy(id: string): boolean {
    const item = this.items.find((i) => i.id === id)
    if (!item) return false
    if ((item.kind === 'text' || item.kind === 'link') && item.text !== undefined) {
      clipboard.writeText(item.text)
      this.lastTextFingerprint = this.fingerprintText(item.text)
    } else if (item.kind === 'files' && item.paths?.length) {
      this.writeFilesToClipboard(item.paths)
      this.lastFilesFingerprint = this.fingerprintFiles(item.paths)
    } else if (item.kind === 'image' && item.filePath && existsSync(item.filePath)) {
      const img = nativeImage.createFromPath(item.filePath)
      if (!img.isEmpty()) {
        clipboard.writeImage(img)
        this.lastImageFingerprint = this.fingerprintImage(img)
      }
    }
    return true


   * 让轮询把这次写入视为「无变化」——扩展内容不应混进用户剪贴板历史。   */  noteExternalTextWrite(text: string): void {
    this.lastTextFingerprint = this.fingerprintText(text)
  }

  remove(id: string): boolean {
    const idx = this.items.findIndex((i) => i.id === id)
    if (idx === -1) return false
    const [item] = this.items.splice(idx, 1)
    if (item.kind === 'image' && item.filePath && existsSync(item.filePath)) {
      try {
        unlinkSync(item.filePath)
      } catch {
        /* noop */
      }
    }
    this.persist()
    return true
  }

  clear(): void {
    for (const item of this.items) {
      if (item.kind === 'image' && item.filePath && existsSync(item.filePath)) {
        try {
          unlinkSync(item.filePath)
        } catch {
          /* noop */
        }
      }
    }
    this.items = []
    this.persist()
  }

  // ───── 剪贴板写入（文件条目还原）─────

  private writeFilesToClipboard(paths: string[]): void {
    if (process.platform === 'darwin') {
      const xml = plist.build(paths)
      clipboard.writeBuffer('NSFilenamesPboardType', Buffer.from(xml, 'utf-8'))
    } else if (process.platform === 'win32') {
      // Windows 单文件：CF_HDROP 完整多文件写入需要原生模块，这里尽力还原首个
      clipboard.writeBuffer('FileNameW', Buffer.from(`${paths[0]}\0`, 'utf-16le'))
    } else {
      // 其他平台退化为文本路径列表
      clipboard.writeText(paths.join('\n'))
    }
  }

  /** 读取系统剪贴板里的文件列表；无文件时返回 null */
  private readFilesFromClipboard(): string[] | null {
    try {
      if (process.platform === 'darwin') {
        const formats = clipboard.availableFormats() as string[]
        if (!formats.includes('NSFilenamesPboardType')) return null
        const raw = clipboard.read('NSFilenamesPboardType')
        if (!raw) return null
        const parsed = plist.parse(raw)
        if (!Array.isArray(parsed)) return null
        const paths = parsed.filter((p): p is string => typeof p === 'string')
        return paths.length > 0 ? paths : null
      }
      if (process.platform === 'win32') {
        const formats = clipboard.availableFormats() as string[]
        if (!formats.includes('FileNameW')) return null
        const raw = clipboard.read('FileNameW')
        if (!raw) return null
        const path = raw.replace(/\0/g, '').trim()
        return path ? [path] : null
      }
    } catch {
      /* 读取失败按无文件处理 */
    }
    return null
  }

  // ───── 持久化（index.json 原子写；图片文件本就在同目录）─────

  private indexPath(): string {
    return join(this.dir, 'index.json')
  }

  private loadPersisted(): void {
    if (!existsSync(this.indexPath())) return
    try {
      const raw = JSON.parse(readFileSync(this.indexPath(), 'utf-8')) as unknown
      if (!Array.isArray(raw)) return
      const cutoff = Date.now() - RETENTION_MS
      const valid = (i: ClipboardHistoryItem): boolean => {
        if (!i || typeof i.id !== 'string' || typeof i.createdAt !== 'number') return false
        // 置顶条目不受保留期约束
        if (!i.pinned && i.createdAt < cutoff) return false
        if (i.kind === 'text' || i.kind === 'link') return typeof i.text === 'string'
        if (i.kind === 'files') return Array.isArray(i.paths) && i.paths.length > 0
        return i.kind === 'image' && typeof i.filePath === 'string' && existsSync(i.filePath)
      }
      this.items = (raw as ClipboardHistoryItem[])
        .filter(valid)
        .map((i) => {
          // 解密敏感字段（向后兼容：明文数据 decryptText 原样返回）
          if (i.text) i.text = decryptText(i.text)
          if (i.ocrText) i.ocrText = decryptText(i.ocrText)
          return i
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_ITEMS)
      // 淘汰未被引用的孤儿图片文件
      this.cleanOrphanImages()
    } catch (error) {
      console.warn('[Clipboard] 历史索引读取失败，按空历史启动:', (error as Error).message)
      this.items = []
    }
  }

  /** 目录里未被当前条目引用的 PNG 清掉（保留期淘汰 / 崩溃残留） */
  private cleanOrphanImages(): void {
    const referenced = new Set(this.items.map((i) => i.filePath).filter(Boolean) as string[])
    try {
      for (const name of readdirSync(this.dir)) {
        if (!name.endsWith('.png')) continue
        const filePath = join(this.dir, name)
        if (!referenced.has(filePath)) {
          try {
            unlinkSync(filePath)
          } catch {
            /* noop */
          }
        }
      }
    } catch {
      /* noop */
    }
  }

  private persist(): void {
    try {
      const tmpFile = `${this.indexPath()}.tmp-${process.pid}`
      // 加密敏感字段后写入（内存中的 items 保持明文，仅持久化时加密）
      const encrypted = this.items.map((i) => ({
        ...i,
        text: i.text ? encryptText(i.text) : i.text,
        ocrText: i.ocrText ? encryptText(i.ocrText) : i.ocrText
      }))
      writeFileSync(tmpFile, JSON.stringify(encrypted))
      rmSync(this.indexPath(), { force: true })
      renameSync(tmpFile, this.indexPath())
    } catch {
      /* 持久化失败不阻塞内存中的历史 */
    }
  }

  private async poll(): Promise<void> {
    if (this.pollBusy) return
    this.pollBusy = true
    try {
      // 前台应用只取一次：既做敏感应用屏蔽判断，又作为新条目的来源应用
      const frontApp = await this.getFrontmostAppName()
      // P1-6：敏感应用屏蔽——前台为密码管理器等时不记录
      if (frontApp && this.isAppBlocked(frontApp)) return
      const sourceApp = frontApp ?? undefined
      // 1) 文件（复制文件时通常也带文本格式，须先于文本检测）
      const files = this.readFilesFromClipboard()
      if (files) {
        const fingerprint = this.fingerprintFiles(files)
        if (fingerprint !== this.lastFilesFingerprint) {
          this.lastFilesFingerprint = fingerprint
          this.push({ kind: 'files', paths: files, sourceApp })
        }
        return
      }
      // 2) 文本（http(s) URL 记为 link）
      const text = clipboard.readText()
      if (text) {
        const fingerprint = this.fingerprintText(text)
        if (fingerprint === this.lastTextFingerprint) return
        this.lastTextFingerprint = fingerprint
        this.push({
          kind: URL_RE.test(text.trim()) ? 'link' : 'text',
          text,
          sourceApp
        })
        return
      }
      // 3) 图片
      const formats = clipboard.availableFormats() as string[]
      if (!formats.some((f) => f.startsWith('image'))) return
      const img = clipboard.readImage()
      if (img.isEmpty()) return
      const fingerprint = this.fingerprintImage(img)
      if (fingerprint === this.lastImageFingerprint) return
      this.lastImageFingerprint = fingerprint
      const size = img.getSize()
      const filePath = this.saveImage(img)
      if (filePath) {
        const item: ClipboardHistoryItem = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          kind: 'image',
          filePath,
          width: size.width,
          height: size.height,
          createdAt: Date.now(),
          sourceApp,
          ocrStatus: 'pending'
        }
        this.pushItem(item)
        // P1-6：异步 OCR（不阻塞轮询）
        void this.runOCR(item.id, filePath)
      }
    } catch {
      /* 剪贴板读取失败（权限等）下一轮重试 */
    } finally {
      this.pollBusy = false
    }
  }

  private push(part: Omit<ClipboardHistoryItem, 'id' | 'createdAt'>): void {
    this.pushItem({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      ...part
    })
  }

  /** 接受完整条目（图片 OCR 标记等场景） */
  private pushItem(item: ClipboardHistoryItem): void {
    // 同内容已存在则移除旧条目（提到最前，Raycast 行为）；图片已由指纹层去重
    const existing =
      item.kind === 'text' || item.kind === 'link'
        ? this.items.findIndex((i) => i.text === item.text)
        : item.kind === 'files'
          ? this.items.findIndex(
              (i) =>
                this.fingerprintFiles(i.paths ?? []) === this.fingerprintFiles(item.paths ?? [])
            )
          : -1
    if (existing !== -1 && this.items[existing]?.pinned) {
      // 置顶条目保留原位（不重复提升），仅在原条目非置顶时去重
      return
    }
    if (existing !== -1) {
      this.items.splice(existing, 1)
    }
    this.items.unshift(item)
    this.trim()
    this.persist()
  }

  // ───── P1-6：OCR 文字识别 ─────

  /** 对图片条目异步执行 OCR，结果写入条目并持久化；处理期间新条目进队列，不静默丢弃 */
  private async runOCR(itemId: string, filePath: string): Promise<void> {
    this.ocrQueue.push({ id: itemId, filePath })
    if (this.ocrProcessing) return
    this.ocrProcessing = true
    try {
      while (this.ocrQueue.length > 0) {
        const job = this.ocrQueue.shift()
        if (job) await this.runOcrJob(job.id, job.filePath)
      }
    } finally {
      this.ocrProcessing = false
    }
  }

  /** 单张图片 OCR：worker 在 finally 中销毁，识别失败也不会泄漏原生线程 */
  private async runOcrJob(itemId: string, filePath: string): Promise<void> {
    let worker: {
      recognize: (p: string) => Promise<{ data: { text?: string } }>
      terminate: () => Promise<unknown>
    } | null = null
    try {
      // 动态导入 tesseract.js（避免主进程启动时加载大依赖）
      const { createWorker } = await import('tesseract.js')
      worker = await createWorker('chi_sim+eng')
      const { data } = await worker.recognize(filePath)
      const text = (data.text ?? '').trim()
      const item = this.items.find((i) => i.id === itemId)
      if (item) {
        item.ocrText = text || undefined
        item.ocrStatus = text ? 'done' : 'failed'
        this.persist()
      }
    } catch (err) {
      console.warn('[Clipboard] OCR 失败:', (err as Error).message)
      const item = this.items.find((i) => i.id === itemId)
      if (item) {
        item.ocrStatus = 'failed'
        this.persist()
      }
    } finally {
      if (worker) {
        try {
          await worker.terminate()
        } catch {
          /* noop */
        }
      }
    }
  }

  // ───── P1-6：依次粘贴（Paste Sequentially）─────

  /**
   * 从指定条目开始依次粘贴：复制当前条目 → 模拟 ⌘V → 移动到下一条。
   * 再次调用时继续下一条；调用 startPasteSequence 重置起点。
   */
  startPasteSequence(fromId: string): { ok: boolean; count?: number; error?: string } {
    const sorted = this.list()
    const idx = sorted.findIndex((i) => i.id === fromId)
    if (idx === -1) return { ok: false, error: '条目不存在' }
    this.pasteSeqIndex = idx
    return { ok: true, count: sorted.length - idx }
  }

  /** 粘贴序列中的下一条：复制到剪贴板并移动索引；按键注入由 IPC 层处理 */
  pasteNext(): { ok: boolean; hasMore: boolean; error?: string } {
    if (this.pasteSeqIndex < 0) return { ok: false, hasMore: false, error: '未开始依次粘贴' }
    const sorted = this.list()
    const item = sorted[this.pasteSeqIndex]
    if (!item) {
      this.pasteSeqIndex = -1
      return { ok: false, hasMore: false, error: '序列已结束' }
    }
    this.copy(item.id)
    this.pasteSeqIndex++
    const hasMore = this.pasteSeqIndex < sorted.length
    if (!hasMore) this.pasteSeqIndex = -1
    return { ok: true, hasMore }
  }

  private trim(): void {
    // 置顶条目不参与容量淘汰
    const unpinned = (): ClipboardHistoryItem[] => this.items.filter((i) => !i.pinned)
    while (unpinned().length > MAX_ITEMS) {
      const oldest = unpinned().pop()
      if (!oldest) break
      const idx = this.items.indexOf(oldest)
      this.items.splice(idx, 1)
      if (oldest.kind === 'image' && oldest.filePath && existsSync(oldest.filePath)) {
        try {
          unlinkSync(oldest.filePath)
        } catch {
          /* noop */
        }
      }
    }
    // 图片文件单独限额（置顶优先保留）；超限条目直接移除——
    // 只置 filePath=undefined 会留下无文件的 image 条目污染列表
    const imageItems = this.items.filter((i) => i.kind === 'image' && !i.pinned)
    const overflow = imageItems.slice(Math.max(0, MAX_IMAGE_FILES))
    for (const item of overflow) {
      if (item.filePath && existsSync(item.filePath)) {
        try {
          unlinkSync(item.filePath)
        } catch {
          /* noop */
        }
      }
      const idx = this.items.indexOf(item)
      if (idx >= 0) this.items.splice(idx, 1)
    }
  }

  private fingerprintText(text: string): string {
    if (!text) return ''
    return createHash('sha256').update(text, 'utf8').digest('hex')
  }

  private fingerprintFiles(paths: string[] | undefined): string {
    if (!paths || paths.length === 0) return ''
    return createHash('sha256').update(paths.join('\n'), 'utf8').digest('hex')
  }

  /** 廉价图片指纹：尺寸 + 8px 缩略图 dataURL（避免每秒 toPNG 大图） */
  private fingerprintImage(img: Electron.NativeImage): string {
    const size = img.getSize()
    let thumb = ''
    try {
      thumb = img.resize({ width: 8 }).toDataURL()
    } catch {
      /* noop */
    }
    return createHash('sha256').update(`${size.width}x${size.height}:${thumb}`).digest('hex')
  }

  private saveImage(img: Electron.NativeImage): string | null {
    try {
      const filePath = join(this.dir, `${Date.now().toString(36)}.png`)
      writeFileSync(filePath, img.toPNG())
      return filePath
    } catch {
      return null
    }
  }
}

export const clipboardHistory = new ClipboardHistoryService()

