import { BrowserWindow, globalShortcut } from 'electron'
import { toggleLauncherWindow } from '../launcher/window'

export interface GlobalShortcutConfig {
  showHide: string
}

export const defaultShortcuts: GlobalShortcutConfig = {
  showHide: 'CommandOrControl+Shift+M'
}

let shortcutConfig: GlobalShortcutConfig = { ...defaultShortcuts }

/**
 * 全局快捷键恢复回调：本模块 register 时会 globalShortcut.unregisterAll()，
 * 把其他模块（截图 / 番茄钟）注册的全局快捷键一并清掉。各模块通过
 * addShortcutRestorer 挂恢复回调，注册完成后统一重挂。
 */
type ShortcutRestorer = () => void
const shortcutRestorers = new Set<ShortcutRestorer>()

/** 注册恢复回调；返回取消注册函数 */
export function addShortcutRestorer(cb: ShortcutRestorer): () => void {
  shortcutRestorers.add(cb)
  return () => {
    shortcutRestorers.delete(cb)
  }
}

export function registerGlobalShortcuts(_getMainWindow: () => BrowserWindow | null): void {
  globalShortcut.unregisterAll()

  globalShortcut.register(shortcutConfig.showHide, () => {
    // Raycast 化：全局快捷键唤起/隐藏启动器，而不是主窗口
    toggleLauncherWindow()
  })

  // 恢复其他模块注册的全局快捷键（截图 / 番茄钟）
  for (const restore of shortcutRestorers) {
    restore()
  }
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll()
}

export function getShortcutConfig(): GlobalShortcutConfig {
  return shortcutConfig
}

export function setShortcutConfig(
  config: Partial<GlobalShortcutConfig>,
  getMainWindow: () => BrowserWindow | null
): GlobalShortcutConfig {
  shortcutConfig = { ...shortcutConfig, ...config }
  registerGlobalShortcuts(getMainWindow)
  return shortcutConfig
}

export function resetShortcutConfig(
  getMainWindow: () => BrowserWindow | null
): GlobalShortcutConfig {
  shortcutConfig = { ...defaultShortcuts }
  registerGlobalShortcuts(getMainWindow)
  return shortcutConfig
}
