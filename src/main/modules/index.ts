/**
 * 主进程模块统一导出
 * 集中导出所有模块函数，便于统一管理和维护
 */

// 窗口相关
export { createWindow as createAppWindow } from './windows'

// 系统托盘相关
export { createTray as createAppTray, destroyTrayTimer } from './tray'

// Dock 菜单相关
export { setupDockMenu as setupAppDockMenu, destroyDockMenuTimer } from './dockMenu'

// 应用菜单 / 窗口快捷键 watcher
export { installApplicationMenu } from './appMenu'
export { watchWindowShortcuts } from './windowShortcuts'

// 全局快捷键相关
export {
  registerGlobalShortcuts as registerAppGlobalShortcuts,
  unregisterGlobalShortcuts as unregisterAppGlobalShortcuts,
  addShortcutRestorer
} from './globalShortcuts'

// 协议注册
export { registerProtocols } from './protocols'

// 番茄钟处理
export { registerPomodoroHandlers } from './pomodoro'

// 对话框工具
export { showOpenDialogFor, showSaveDialogFor } from './dialogs'

// M5：迷你悬浮窗
export {
  ensureMiniWindow,
  showMiniWindow,
  hideMiniWindow,
  toggleMiniWindow,
  isMiniWindowVisible,
  registerMiniWindowIpc
} from './miniWindow'
