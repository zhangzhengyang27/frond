import { clipboard, ipcMain, nativeImage, Notification } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import Screenshots from 'electron-screenshots'
import { screenshotDirs, screenshotIndexService } from '../services/ScreenshotIndexService'
import { listWindowSources, captureWindowSource } from '../services/windowSources'
import { log } from '../services/LogService'

/**
 * 截图与标注：直接用上游 `electron-screenshots`（2026-09-23 拍板，见 HANDOFF §11）。
 *
 * 树内原先那套移植副本（`views/screenshot/` + `ScreenshotService` 的覆盖层）已随本批删除；
 * 贴图/钉图（PinService）按同一批决定整体撤掉。
 *
 * 上游的默认行为是：点「确定」只写剪贴板、点「保存」弹另存对话框。这里只在 `ok` 上接管 ——
 * 把图落到**截图库扫得到的目录**（桌面或 macOS 系统截图位置），再触发索引：
 * 自研那套存 `userData/screenshots` 而 `shot_index` 只扫桌面/系统位置，
 * 结果是自己截的图永远不进库（§11）。点「保存」保持上游行为，不另外落一份。
 */
let shots: Screenshots | null = null

/** 工具栏文案：上游只给了这几个键，缺省是英文，这里补中文 */
const LANG = {
  magnifier_position_label: '坐标',
  operation_ok_title: '确定',
  operation_cancel_title: '取消',
  operation_save_title: '保存',
  operation_redo_title: '重做',
  operation_undo_title: '撤销',
  operation_mosaic_title: '马赛克',
  operation_text_title: '文本',
  operation_brush_title: '画笔',
  operation_arrow_title: '箭头',
  operation_ellipse_title: '椭圆',
  operation_rectangle_title: '矩形'
}

/** 落盘并交给截图库索引（scan 是幂等 upsert，会顺带排上 OCR） */
async function persistShot(buffer: Buffer): Promise<string | null> {
  const dirs = await screenshotDirs()
  const dir = dirs[0]
  if (!dir) return null
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)
  const filePath = join(dir, `Leaf-${stamp}.png`)
  writeFileSync(filePath, buffer)
  void screenshotIndexService.scan().catch((error: unknown) => {
    log.warn('screenshot', `索引截图失败: ${(error as Error).message}`)
  })
  return filePath
}

/**
 * 触发一次截图。返回是否真的起来了 —— 此前这条链一路吞错：
 * handler 无论成败都回 `{ success: true }`，UI 上看不出没截屏。
 */
export async function triggerScreenshot(): Promise<{ ok: boolean; error?: string }> {
  if (!shots) return { ok: false, error: '截图服务未初始化' }
  try {
    await shots.startCapture()
    return { ok: true }
  } catch (error) {
    log.error('screenshot', '触发截图失败', error)
    return { ok: false, error: (error as Error).message }
  }
}

export function registerScreenshotHandlers(): void {
  shots = new Screenshots({ singleWindow: true, lang: LANG })

  shots.on('ok', (event: { preventDefault(): void }, buffer: Buffer) => {
    // 不让上游走完（它只写剪贴板且不落文件），由这边接管落盘 + 索引
    event.preventDefault()
    void (async () => {
      const filePath = await persistShot(buffer)
      clipboard.writeImage(nativeImage.createFromBuffer(buffer))
      if (Notification.isSupported()) {
        new Notification({
          title: '截图已保存',
          body: filePath ? filePath : '截图已复制到剪贴板（未找到可写目录）'
        }).show()
      }
      await shots?.endCapture()
    })()
  })

  // 按窗口抓图：上游没有这个能力，桥与 handler 一起留着（渲染端暂无入口，账见 §11）
  ipcMain.removeHandler('screenshot:getWindowList')
  ipcMain.removeHandler('screenshot:captureWindow')
  ipcMain.handle('screenshot:getWindowList', () => listWindowSources())
  ipcMain.handle('screenshot:captureWindow', (_e, windowId: string, scaleFactor?: number) =>
    captureWindowSource(windowId, scaleFactor ?? 1)
  )

  ipcMain.removeHandler('screenshot:startCapture')
  ipcMain.removeHandler('screenshot:endCapture')
  ipcMain.handle('screenshot:startCapture', async () => {
    const res = await triggerScreenshot()
    return res.ok ? { success: true } : { success: false, error: res.error }
  })
  ipcMain.handle('screenshot:endCapture', async () => {
    try {
      await shots?.endCapture()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  log.info('screenshot', 'electron-screenshots 已接管截图与标注')
}
