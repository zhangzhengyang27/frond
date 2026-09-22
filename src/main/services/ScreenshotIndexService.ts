/**
 * Leaf · ScreenshotIndexService — 截图库 OCR 索引（V4 P1-10，对齐 Raycast Search Screenshots）
 *
 * 只索引不捕捉：扫描截图目录（桌面 + 系统 com.apple.screencapture location）里的
 * 图片文件，on-device OCR（tesseract.js，与剪贴板历史同管线）提取图内文本，
 * 供 `text:` / `name:` / `date:` 搜索与「粘贴最近截图」。
 *
 * 设计：
 * - 索引仅缓存元数据与 OCR 文本，不复制文件；文件消失即清行
 * - 扫描上限 SCAN_MAX_FILES（最新优先），避免无界增长
 * - OCR 批内复用单个 worker（300 张逐个 spawn worker 会拖垮启动）；单批失败不致命
 * - 会话内首次触达自动扫描一次（openScreenshotsPage / pasteLatest 前置）
 */
import { app, clipboard, nativeImage } from 'electron'
import { existsSync, readdirSync, statSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { shotIndexRepository, type ShotRow, type ShotSearchFilter } from '../db/repos'
import { getLauncherWindow } from '../launcher/window'
import { pasteToActiveApp } from '../utils/pasteKeystroke'
import { isMac } from '../utils/platform'

const execFileAsync = promisify(execFile)

/** 索引文件数上限（最新优先；Raycast 用保留期，Leaf 用条数上限 + 文件消失即清） */
export const SCAN_MAX_FILES = 300
/** 单次 OCR 批量上限（防止首次扫描把 CPU 吃满；剩余下一轮继续） */
export const OCR_BATCH_SIZE = 40

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.bmp'])

/** ── 查询解析（纯函数，可单测）──
 *  语法对齐 Raycast：`name:invoice`、`text:发票号`、`date:yesterday|today|"last week"`，
 *  多词值用引号（date:"last week"），其余 token 作为自由文本（匹配文件名或 OCR 文本）。
 *  date: 未知值原样并入自由文本。 */
export function parseShotQuery(
  raw: string,
  now = new Date()
): ShotSearchFilter & { freeText: string } {
  const out: ShotSearchFilter & { freeText: string } = { freeText: '' }
  const dayMs = 24 * 60 * 60 * 1000
  const startOfDay = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const consumed: string[] = []
  const re = /(name|text|date):(?:"([^"]*)"|(\S+))/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    consumed.push(m[0])
    const key = m[1].toLowerCase()
    const value = m[2] ?? m[3] ?? ''
    if (key === 'name' && value) out.name = value
    else if (key === 'text' && value) out.text = value
    else if (key === 'date' && value) {
      const v = value.toLowerCase()
      if (v === 'today') out.since = startOfDay(now)
      else if (v === 'yesterday') out.since = startOfDay(new Date(now.getTime() - dayMs))
      else if (v === 'last week' || v === 'lastweek') out.since = now.getTime() - 7 * dayMs
      else consumed.pop() // 未知 date 值：还原为自由文本
    } else consumed.pop() // 空值前缀：还原为自由文本
  }
  let rest = raw
  for (const c of consumed) rest = rest.replace(c, ' ')
  const free = rest.trim().split(/\s+/).filter(Boolean)
  // 被还原的 date 前缀已在 rest 里，无需再并入
  const q = free.join(' ')
  if (q) out.q = q
  out.freeText = q
  return out
}

/** 候选目录：桌面 + 系统截图保存位置（mac defaults 探测，读取失败跳过） */
export async function screenshotDirs(): Promise<string[]> {
  const dirs = new Set<string>()
  dirs.add(app.getPath('desktop'))
  if (isMac()) {
    try {
      const { stdout } = await execFileAsync('defaults', [
        'read',
        'com.apple.screencapture',
        'location'
      ])
      const dir = String(stdout ?? '').trim()
      if (dir && existsSync(dir)) dirs.add(dir)
    } catch {
      /* 未自定义截图位置：桌面目录已覆盖 macOS 默认 */
    }
  }
  return [...dirs].filter((d) => existsSync(d))
}

type Listener = () => void

class ScreenshotIndexService {
  private indexing = false
  private scannedThisSession = false
  private listeners = new Set<Listener>()
  private ocrAbort = false

  onIndexChanged(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emitChanged(): void {
    for (const fn of this.listeners) {
      try {
        fn()
      } catch {
        /* 监听者异常不影响扫描 */
      }
    }
    // 胶囊页刷新列表（OCR 进度是渐进的，靠推送而非轮询）
    try {
      getLauncherWindow()?.webContents.send('shotidx:changed')
    } catch {
      /* 窗口已销毁 */
    }
  }

  status(): { total: number; pending: number; done: number; failed: number; scanning: boolean } {
    return { ...shotIndexRepository.stats(), scanning: this.indexing }
  }

  /** 扫描目录 → 入库 → 触发 OCR。幂等：进行中的扫描直接返回。 */
  async scan(): Promise<{ added: number }> {
    if (this.indexing) return { added: 0 }
    this.indexing = true
    this.ocrAbort = false
    try {
      const dirs = await screenshotDirs()
      const found: Array<{
        filePath: string
        fileName: string
        fileSize: number
        mtime: number
        capturedAt: number
      }> = []
      for (const dir of dirs) {
        let entries: string[] = []
        try {
          entries = readdirSync(dir)
        } catch {
          continue
        }
        for (const name of entries) {
          if (!IMAGE_EXTS.has(name.slice(name.lastIndexOf('.')).toLowerCase())) continue
          const filePath = join(dir, name)
          let st: ReturnType<typeof statSync>
          try {
            st = statSync(filePath)
          } catch {
            continue
          }
          if (!st.isFile()) continue
          found.push({
            filePath,
            fileName: name,
            fileSize: st.size,
            mtime: Math.floor(st.mtimeMs),
            capturedAt: Math.floor(st.mtimeMs)
          })
        }
      }
      found.sort((a, b) => b.capturedAt - a.capturedAt)
      const capped = found.slice(0, SCAN_MAX_FILES)
      shotIndexRepository.upsert(capped)
      shotIndexRepository.prune(new Set(capped.map((r) => r.filePath)))
      this.scannedThisSession = true
      this.emitChanged()
      // OCR 后台进行（不 await：扫描调用方立即可搜文件名）
      void this.runOcrBatch()
      return { added: capped.length }
    } finally {
      this.indexing = false
    }
  }

  /** 会话内首次触达自动扫描（幂等） */
  async ensureScanned(): Promise<void> {
    if (this.scannedThisSession || this.indexing) return
    this.scannedThisSession = true // 并发重入保护：失败也不无限重试
    try {
      await this.scan()
    } catch (error) {
      console.warn('[ShotIndex] 自动扫描失败:', (error as Error).message)
    }
  }

  /** OCR 批处理：单 worker 跑一批 pending，完成后若仍有剩余自动续批 */
  private async runOcrBatch(): Promise<void> {
    let worker: {
      recognize: (p: string) => Promise<{ data: { text?: string } }>
      terminate: () => Promise<unknown>
    } | null = null
    try {
      const pending = shotIndexRepository.getPending(OCR_BATCH_SIZE)
      if (pending.length === 0) return
      const { createWorker } = await import('tesseract.js')
      worker = await createWorker('chi_sim+eng')
      for (const { filePath } of pending) {
        if (this.ocrAbort) break
        try {
          const { data } = await worker.recognize(filePath)
          const text = (data.text ?? '').trim()
          shotIndexRepository.updateOcr(filePath, text ? 'done' : 'failed', text || null)
        } catch {
          shotIndexRepository.updateOcr(filePath, 'failed', null)
        }
      }
      this.emitChanged()
      if (!this.ocrAbort && shotIndexRepository.getPending(1).length > 0) {
        // 剩余排队下一批（让出事件循环，避免长任务占满主进程）
        setTimeout(() => void this.runOcrBatch(), 200)
      }
    } catch (error) {
      console.warn('[ShotIndex] OCR 批处理失败:', (error as Error).message)
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

  search(query: string, limit = 60): ShotRow[] {
    const parsed = parseShotQuery(query)
    return shotIndexRepository.search(parsed, limit)
  }

  latest(): ShotRow | null {
    return shotIndexRepository.latest()
  }

  /** 把指定截图写入剪贴板（图片），供「粘贴到前台」 */
  copyToClipboard(filePath: string): boolean {
    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) return false
    clipboard.writeImage(image)
    return true
  }

  /** 粘贴最近截图：写剪贴板 → 收起胶囊 → ⌘V 注入前台 */
  async pasteLatest(): Promise<{ ok: boolean; error?: string }> {
    await this.ensureScanned()
    const row = this.latest()
    if (!row) return { ok: false, error: '未找到截图' }
    return this.pastePath(row.filePath)
  }

  async pastePath(filePath: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.copyToClipboard(filePath)) return { ok: false, error: '图片读取失败' }
    getLauncherWindow()?.hide()
    try {
      await new Promise((resolve) => setTimeout(resolve, 250))
      await pasteToActiveApp()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }
}

export const screenshotIndexService = new ScreenshotIndexService()
