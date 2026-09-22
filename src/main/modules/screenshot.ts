import { globalShortcut, ipcMain } from 'electron'
import { addShortcutRestorer } from './globalShortcuts'
import ScreenshotService, {
  listWindowSources,
  captureWindowSource
} from '../services/ScreenshotService'

// 自研截图服务（B 套）：BrowserView 常驻 + 自定义 Vue 标注 UI。
// 历史入库 / 剪贴板 / 通知均在 ScreenshotService.listenIpc 内完成。
let service: ScreenshotService | null = null

const SCREENSHOT_SHORTCUT = 'CommandOrControl+Shift+A'

/** 供命令热键（M4）等主进程入口触发截图 */
export async function triggerScreenshot(): Promise<void> {
  try {
    await service?.startCapture()
  } catch (error) {
    console.error('触发截图失败:', error)
  }
}

function registerScreenshotShortcut(): void {
  globalShortcut.register(SCREENSHOT_SHORTCUT, async () => {
    try {
      await service?.startCapture()
    } catch (error) {
      console.error('快捷键启动截图失败:', error)
    }
  })
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

  // 注册快捷键，并挂恢复回调（globalShortcuts.unregisterAll 会清掉它）
  registerScreenshotShortcut()
  addShortcutRestorer(registerScreenshotShortcut)

  console.log('[Screenshot] 自研截图服务初始化完成')
}

/**
 * 注销截图快捷键并销毁截图服务
 */
export function unregisterScreenshotShortcuts(): void {
  globalShortcut.unregister(SCREENSHOT_SHORTCUT)
  if (service) {
    service.destroy()
    service = null
  }
}
