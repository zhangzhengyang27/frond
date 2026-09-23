/**
 * Frond · 启动器模块入口
 *
 * 全局热键（M4：主热键可配置 + 命令级热键，统一由 hotkeys.ts 注册）
 * 与 launcher:* IPC。阶段二起插件运行时/管理 IPC 也挂在此模块。
 */
import { BrowserWindow, ipcMain } from 'electron'
import { hideLauncherWindow, showLauncherWindow, toggleLauncherWindow } from './window'
import { registerLauncherIpc } from './ipc'
import { registerAllHotkeys } from './hotkeys'

/** 主窗口跳转到模块（复用 app:openModule 通道；主窗隐藏时先唤起） */
function openModuleInMainWindow(
  moduleId: string,
  path: string,
  getMainWindow: () => BrowserWindow | null
): void {
  const main = getMainWindow()
  if (!main || main.isDestroyed()) return
  if (!main.isVisible()) main.show()
  if (main.isMinimized()) main.restore()
  main.focus()
  main.webContents.send('app:openModule', { moduleId, path })
}

export function registerLauncher(getMainWindow: () => BrowserWindow | null): void {
  // 主热键（默认 Alt+Space，可配置）+ 命令级热键统一注册
  registerAllHotkeys()

  ipcMain.on('launcher:toggle', () => toggleLauncherWindow())
  ipcMain.on('launcher:hide', () => hideLauncherWindow())
  ipcMain.on('launcher:show', () => showLauncherWindow())
  ipcMain.on('launcher:openModule', (_e, payload: { moduleId?: string; path?: string }) => {
    if (!payload?.path || !payload?.moduleId) return
    openModuleInMainWindow(payload.moduleId, payload.path, getMainWindow)
  })

  registerLauncherIpc()
}
