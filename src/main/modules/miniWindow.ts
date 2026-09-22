/**
 * Leaf · miniWindow（M5）
 *
 * 迷你悬浮番茄钟：always-on-top、frameless、半透明，
 * 用于跨窗口置顶显示当前 focus timer 状态。
 *
 * 数据通过 IPC 流式推送：
 *   mini -> renderer: `pomodoro:mini:snapshot`（订阅）
 *   renderer -> main:  `pomodoro:mini:toggle` / `show` / `hide`
 */

import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let miniWindow: BrowserWindow | null = null

const MINI_WIDTH = 240
const MINI_HEIGHT = 140

export function ensureMiniWindow(): BrowserWindow {
  if (miniWindow && !miniWindow.isDestroyed()) return miniWindow
  const display = screen.getPrimaryDisplay()
  const { workArea } = display
  const x = Math.round(workArea.x + workArea.width - MINI_WIDTH - 16)
  const y = Math.round(workArea.y + workArea.height - MINI_HEIGHT - 16)

  miniWindow = new BrowserWindow({
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      spellcheck: false
    }
  })

  miniWindow.setAlwaysOnTop(true, 'floating')
  miniWindow.setVisibleOnAllWorkspaces(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void miniWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/mini-timer`)
  } else {
    void miniWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '#/mini-timer'
    })
  }

  miniWindow.once('ready-to-show', () => {
    miniWindow?.show()
  })

  miniWindow.on('closed', () => {
    miniWindow = null
  })

  return miniWindow
}

export function showMiniWindow(): BrowserWindow {
  const w = ensureMiniWindow()
  if (!w.isVisible()) w.show()
  return w
}

export function hideMiniWindow(): void {
  miniWindow?.hide()
}

export function toggleMiniWindow(): BrowserWindow | null {
  if (!miniWindow || miniWindow.isDestroyed()) {
    return showMiniWindow()
  }
  if (miniWindow.isVisible()) {
    miniWindow.hide()
    return null
  }
  miniWindow.show()
  return miniWindow
}

export function isMiniWindowVisible(): boolean {
  return !!miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible()
}

export function registerMiniWindowIpc(): void {
  ipcMain.handle('pomodoro:mini:show', () => {
    showMiniWindow()
    return true
  })
  ipcMain.handle('pomodoro:mini:hide', () => {
    hideMiniWindow()
    return true
  })
  ipcMain.handle('pomodoro:mini:toggle', () => {
    const w = toggleMiniWindow()
    return !!w
  })
  ipcMain.handle('pomodoro:mini:isVisible', () => isMiniWindowVisible())
}
