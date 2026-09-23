/**
 * Frond · 窗口级快捷键 watcher（替代 electron-toolkit 的 optimizer.watchWindowShortcuts）
 *
 * 为什么不用 optimizer：
 * - 生产分支无条件 preventDefault ⌘R/Ctrl+R 且无开关，页面永远收不到；
 * - 快速搜索页需要 ⌘R 触发「刷新应用列表」。
 *
 * 行为：
 * - dev：F12 开关 DevTools（与 optimizer 一致）
 * - ⌘R / Ctrl+R（无 Shift/Alt）：拦截后转发 'app:refresh-applications' IPC——
 *   快速搜索页监听并刷新列表，其他页面无监听者、自动忽略。
 *   键盘重载入口保留在应用菜单的 ⇧⌘R（forceReload）。
 */
import { is } from '@electron-toolkit/utils'
import type { BrowserWindow } from 'electron'

export const REFRESH_APPLICATIONS_CHANNEL = 'app:refresh-applications'

export function watchWindowShortcuts(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    // dev：F12 开关 DevTools
    if (is.dev && input.code === 'F12') {
      event.preventDefault()
      if (window.webContents.isDevToolsOpened()) {
        window.webContents.closeDevTools()
      } else {
        window.webContents.openDevTools({ mode: 'undocked' })
      }
      return
    }

    // ⌘R / Ctrl+R：拦截并转发「刷新应用列表」（Shift/Alt 组合不拦，留给 forceReload）
    if (input.code === 'KeyR' && (input.meta || input.control) && !input.shift && !input.alt) {
      event.preventDefault()
      window.webContents.send(REFRESH_APPLICATIONS_CHANNEL)
    }
  })
}
