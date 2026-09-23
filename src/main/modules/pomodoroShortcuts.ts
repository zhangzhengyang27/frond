/**
 * Frond · 番茄钟全局快捷键（2026-09-23 重建件：原件全盘无副本）
 *
 * 形状由三处现存调用点钉住：`pomodoro.ts`  startup 注册一次、`setShortcut` / `resetShortcuts`
 * 改键后重注册、`addShortcutRestorer` 在 `globalShortcuts.unregisterAll()` 之后恢复本模块的键。
 *
 * 定时器跑在渲染层的 store 里，主进程只投递动作 —— 所以这里只发给**主窗口**：
 * 胶囊窗与主窗共用同一个 store 实现，广播会让一次按键跑两遍。
 */
import { BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { pomodoroIntegrationService } from '../services/PomodoroIntegrationService'
import type { PomodoroShortcuts } from '../../shared/pomodoroIntegration'
import { typedHandle } from '../ipc/typedIpc'

type PomodoroAction = keyof PomodoroShortcuts

const ACTION_ORDER: PomodoroAction[] = ['toggle', 'skip', 'reset']

/** accelerator → action；只记本模块占下的键，卸载时不碰别人的注册 */
const owned = new Map<string, PomodoroAction>()
let dispatchHandlerRegistered = false

export function dispatchPomodoroAction(
  action: PomodoroAction,
  getMainWindow: () => BrowserWindow | null
): boolean {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return false
  win.webContents.send('pomodoro:shortcut', { action })
  return true
}

export function unregisterPomodoroShortcuts(): void {
  for (const accelerator of owned.keys()) globalShortcut.unregister(accelerator)
  owned.clear()
}

export function registerPomodoroShortcuts(getMainWindow: () => BrowserWindow | null): {
  failed: string[]
} {
  unregisterPomodoroShortcuts()
  // 远程入口（胶囊 FocusPage 的「开始专注」）与全局键走同一条投递路，故一并在这里挂上
  ensureDispatchHandler(getMainWindow)
  const shortcuts = pomodoroIntegrationService().getShortcuts()
  const failed: string[] = []
  for (const action of ACTION_ORDER) {
    const accelerator = shortcuts[action]
    if (!accelerator) continue
    const takenByOthers = owned.has(accelerator)
    let ok = false
    if (!takenByOthers) {
      try {
        ok = globalShortcut.register(accelerator, () => {
          dispatchPomodoroAction(action, getMainWindow)
        })
      } catch {
        ok = false
      }
    }
    if (ok) owned.set(accelerator, action)
    else failed.push(action)
  }
  return { failed }
}

function ensureDispatchHandler(getMainWindow: () => BrowserWindow | null): void {
  if (dispatchHandlerRegistered) return
  dispatchHandlerRegistered = true
  ipcMain.removeHandler('pomodoro:dispatchShortcut')
  typedHandle('pomodoro:dispatchShortcut', (_event, { action }) =>
    dispatchPomodoroAction(action, getMainWindow)
  )
}
