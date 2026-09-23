import { ipcMain } from 'electron'
import ScreenshotService, {
  listWindowSources,
  captureWindowSource
} from '../services/ScreenshotService'

// 自研截图服务（B 套）：BrowserView 常驻 + 自定义 Vue 标注 UI。
// 历史入库 / 剪贴板 / 通知均在 ScreenshotService.listenIpc 内完成。
let service: ScreenshotService | null = null

/**
 * 触发一次截图。调用方是 launcher 的热键系统（`hotkeys.ts` 注册的截图热键，
 * 默认 ⌥⇧S、启动台设置里可改）与 `screenshot:startCapture` 这条 IPC。
 *
 * 这里以前自己 `globalShortcut.register('CommandOrControl+Shift+A')`：既不可配置，
 * 也躲开了 hotkeys.ts 的冲突检测（用户把别的命令绑到同一串也不会被警告）。
 */
export async function triggerScreenshot(): Promise<void> {
  try {
    await service?.startCapture()
  } catch (error) {
    console.error('触发截图失败:', error)
  }
}

export function registerScreenshotHandlers(): void {
  service = new ScreenshotService({ singleWindow: true })

  // IPC handlers（供渲染进程页面按钮调用）
  ipcMain.removeHandler('screenshot:startCapture')
  ipcMain.removeHandler('screenshot:endCapture')
  ipcMain.removeHandler('screenshot:getWindowList')
  ipcMain.removeHandler('screenshot:captureWindow')

  ipcMain.handle('screenshot:startCapture', async () => {
    try {
      await service!.startCapture()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('screenshot:endCapture', async () => {
    try {
      await service!.endCapture()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 窗口截图模式：窗口列表 + 按窗口捕获
  ipcMain.handle('screenshot:getWindowList', () => listWindowSources())
  ipcMain.handle('screenshot:captureWindow', (_e, windowId: string, scaleFactor?: number) =>
    captureWindowSource(windowId, scaleFactor ?? 1)
  )

  console.log('[Screenshot] 自研截图服务初始化完成')
}
