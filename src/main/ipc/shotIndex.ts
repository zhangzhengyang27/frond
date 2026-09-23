/**
 * Frond · 截图库 OCR 索引 IPC（V4 P1-10）
 *
 * - shotidx:status        索引状态（总数 / OCR 进度 / 是否扫描中）
 * - shotidx:scan          手动触发扫描（胶囊页「重新扫描」）
 * - shotidx:search        过滤查询（name:/text:/date: + 自由文本）
 * - shotidx:pastePath     把指定截图写入剪贴板并注入前台
 * - shotidx:pasteLatest   粘贴最近截图（独立命令入口）
 * - shotidx:changed       索引/OCR 进度变化推送（胶囊页刷新列表）
 */
import { ipcMain } from 'electron'
import { screenshotIndexService } from '../services/ScreenshotIndexService'
import { typedHandle } from './typedIpc'

const SEARCH_LIMIT = 60

export function registerShotIndexIpc(): void {
  ipcMain.handle('shotidx:status', () => screenshotIndexService.status())

  ipcMain.handle('shotidx:scan', async () => {
    try {
      const r = await screenshotIndexService.scan()
      return { success: true, added: r.added }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  typedHandle('shotidx:search', (_e, { query, ensure }) => {
    // 契约是单对象（ipc-contract 里 req 就是 { query?, ensure? }），而这里此前还是
    // 位置参数签名 —— preload 把 { query, ensure } 整个当第一个参数传进来，
    // typeof 守卫判它不是 string，于是**从渲染层搜索永远等于空查询**。
    const q = typeof query === 'string' ? query : ''
    // 空查询首开时自动建索引（幂等；有查询不阻塞搜索，先返回现有结果）
    if (ensure === true) void screenshotIndexService.ensureScanned()
    return {
      success: true as const,
      items: screenshotIndexService.search(q, SEARCH_LIMIT)
    }
  })

  ipcMain.handle('shotidx:pastePath', async (_e, filePath: unknown) => {
    if (typeof filePath !== 'string' || !filePath) return { ok: false, error: 'path required' }
    return screenshotIndexService.pastePath(filePath)
  })

  ipcMain.handle('shotidx:pasteLatest', async () => screenshotIndexService.pasteLatest())
}
