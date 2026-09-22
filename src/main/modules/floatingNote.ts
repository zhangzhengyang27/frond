/**
 * Leaf · Floating Notes（浮动笔记）
 *
 * 对标 Raycast Floating Notes：全局热键呼出的置顶小窗口，
 * 支持 Markdown 快速记录，数据复用 notes 表。
 *
 * 窗口特性：always-on-top、frameless、可调整大小、可移动、
 * 失焦不自动关闭（用户手动关闭或按 Esc）。
 * 窗口位置和大小自动持久化到 userData/floating-note-window.json。
 */

import { BrowserWindow, ipcMain, screen, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'

let floatingWindow: BrowserWindow | null = null

const DEFAULT_WIDTH = 480
const DEFAULT_HEIGHT = 360
const MIN_WIDTH = 320
const MIN_HEIGHT = 240

interface WindowState {
  x: number
  y: number
  width: number
  height: number
}

function getStatePath(): string {
  return join(app.getPath('userData'), 'floating-note-window.json')
}

function loadWindowState(): WindowState | null {
  try {
    const path = getStatePath()
    if (!existsSync(path)) return null
    const data = JSON.parse(readFileSync(path, 'utf-8')) as WindowState
    // 验证数据完整性
    if (
      typeof data.x === 'number' &&
      typeof data.y === 'number' &&
      typeof data.width === 'number' &&
      typeof data.height === 'number' &&
      data.width >= MIN_WIDTH &&
      data.height >= MIN_HEIGHT
    ) {
      // 验证窗口是否在某个显示器内
      const displays = screen.getAllDisplays()
      const inDisplay = displays.some((d) => {
        return (
          data.x >= d.bounds.x - 100 &&
          data.x <= d.bounds.x + d.bounds.width - 100 &&
          data.y >= d.bounds.y - 100 &&
          data.y <= d.bounds.y + d.bounds.height - 100
        )
      })
      if (inDisplay) return data
    }
    return null
  } catch {
    return null
  }
}

function saveWindowState(state: WindowState): void {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(getStatePath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch {
    // 保存失败静默处理，不影响使用
  }
}

// 保存状态的 debounce 定时器
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave(win: BrowserWindow): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (win && !win.isDestroyed()) {
      const bounds = win.getBounds()
      saveWindowState({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height })
    }
  }, 500)
}

export function ensureFloatingNoteWindow(): BrowserWindow {
  if (floatingWindow && !floatingWindow.isDestroyed()) return floatingWindow

  const savedState = loadWindowState()
  let x: number, y: number, width: number, height: number

  if (savedState) {
    x = savedState.x
    y = savedState.y
    width = savedState.width
    height = savedState.height
  } else {
    const display = screen.getPrimaryDisplay()
    const { workArea } = display
    // 默认居中偏上
    x = Math.round(workArea.x + (workArea.width - DEFAULT_WIDTH) / 2)
    y = Math.round(workArea.y + (workArea.height - DEFAULT_HEIGHT) / 3)
    width = DEFAULT_WIDTH
    height = DEFAULT_HEIGHT
  }

  floatingWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      spellcheck: false
    }
  })

  floatingWindow.setAlwaysOnTop(true, 'floating')
  floatingWindow.setVisibleOnAllWorkspaces(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void floatingWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/floating-note`)
  } else {
    void floatingWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '#/floating-note'
    })
  }

  floatingWindow.once('ready-to-show', () => {
    floatingWindow?.show()
    floatingWindow?.focus()
  })

  // 窗口移动/调整大小时保存状态（debounce）
  floatingWindow.on('move', () => scheduleSave(floatingWindow!))
  floatingWindow.on('resize', () => scheduleSave(floatingWindow!))

  floatingWindow.on('closed', () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    floatingWindow = null
  })

  return floatingWindow
}

export function showFloatingNoteWindow(): BrowserWindow {
  const w = ensureFloatingNoteWindow()
  if (!w.isVisible()) w.show()
  w.focus()
  return w
}

export function hideFloatingNoteWindow(): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    // 隐藏前立即保存状态
    const bounds = floatingWindow.getBounds()
    saveWindowState({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height })
    floatingWindow.hide()
  }
}

export function toggleFloatingNoteWindow(): void {
  if (floatingWindow && !floatingWindow.isDestroyed() && floatingWindow.isVisible()) {
    hideFloatingNoteWindow()
  } else {
    showFloatingNoteWindow()
  }
}

export function registerFloatingNoteIpc(): void {
  ipcMain.handle('floatingNote:toggle', () => {
    toggleFloatingNoteWindow()
    return true
  })
  ipcMain.handle('floatingNote:show', () => {
    showFloatingNoteWindow()
    return true
  })
  ipcMain.handle('floatingNote:hide', () => {
    hideFloatingNoteWindow()
    return true
  })
  ipcMain.handle('floatingNote:isVisible', () => {
    return floatingWindow ? !floatingWindow.isDestroyed() && floatingWindow.isVisible() : false
  })
}
