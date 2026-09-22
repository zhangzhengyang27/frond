/**
 * Leaf · 系统托盘（tray）
 *
 * 设计（来源：docs/DECISIONS.md「Dock / Tray 菜单重构」+ IA v2 阶段C「入口优先级」）
 * - 菜单构建统一在 src/main/modules/appMenu.ts（与 dockMenu 共用）
 * - 中部：Quick Switch（最近使用 + 收藏）+ 全局动作
 * - macOS：tray 左键点击唤起/收起启动台胶囊（IA v2：胶囊 > 托盘 > 主窗口）；
 *   右键保留「打开主窗口」作为回退路径
 * - Win / Linux：tray 右键 = 完整菜单，双击 = 主窗口
 */

import { BrowserWindow, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import icon from '../../../resources/icon.png?asset'
import { is } from '@electron-toolkit/utils'
import { buildAndSetAppMenu, registerMenuAutoRefresh, destroyMenuAutoRefresh } from './appMenu'
import { isMac, trayClickShouldToggleWindow } from '../utils/platform'
import { pomodoroIntegrationService } from '../services/PomodoroIntegrationService'
import { toggleLauncherWindow } from '../launcher/window'

/** 清理托盘定时器与菜单自动刷新订阅（在 app will-quit 时调用） */
export function destroyTrayTimer(): void {
  destroyMenuAutoRefresh()
}

/** P1-2：renderer 推送的项目列表（用于 tray / dock 切换焦点） */
let currentPomodoroProjects: Array<{ id: string; name: string; isActive: boolean }> = []
let currentPomodoroFocusedProjectId: string | null = null

/** 给 appMenu builder 调用：拿最新番茄钟状态快照（描述文本） */
export function getPomodoroStatus(): { primary: string; secondary: string } {
  return pomodoroIntegrationService().describeTraySnapshot()
}

/** 给 appMenu builder 调用：拿可切换焦点的项目列表 */
export function getPomodoroProjects(): Array<{ id: string; name: string; isActive: boolean }> {
  return currentPomodoroProjects
}

/** 给 appMenu builder 调用：拿当前焦点项目 id */
export function getPomodoroFocusedProjectId(): string | null {
  return currentPomodoroFocusedProjectId
}

/** renderer 推项目列表（用于 tray / dock 切换焦点） */
export function updatePomodoroProjects(
  projects: Array<{ id: string; name: string; isActive: boolean }>,
  focusedProjectId: string | null
): void {
  currentPomodoroProjects = projects
  currentPomodoroFocusedProjectId = focusedProjectId
}

function buildTrayIcon(): Electron.NativeImage {
  let trayIcon: Electron.NativeImage | null = null

  const iconBasePath = is.dev ? join(process.cwd(), 'resources') : __dirname
  const possibleIconPaths = [
    join(iconBasePath, 'icon.png'),
    join(__dirname, '../../resources/icon.png'),
    join(__dirname, '../../build/icon.png'),
    join(__dirname, '../../build/icon.icns'),
    join(process.resourcesPath || '', 'icon.png'),
    join(process.resourcesPath || '', 'icon.icns'),
    icon as unknown as string
  ]

  for (const iconPath of possibleIconPaths) {
    try {
      if (iconPath && existsSync(iconPath)) {
        const testIcon = nativeImage.createFromPath(iconPath)
        if (!testIcon.isEmpty()) {
          trayIcon = testIcon
          break
        }
      }
    } catch {
      continue
    }
  }

  if (!trayIcon || trayIcon.isEmpty()) {
    const size = process.platform === 'darwin' ? 22 : 16
    const buffer = Buffer.alloc(size * size * 4)
    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2 - 2
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = (y * size + x) * 4
        const dx = x - centerX
        const dy = y - centerY
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance <= radius) {
          buffer[index] = 100
          buffer[index + 1] = 150
          buffer[index + 2] = 255
          buffer[index + 3] = 255
        } else {
          buffer[index] = 0
          buffer[index + 1] = 0
          buffer[index + 2] = 0
          buffer[index + 3] = 0
        }
      }
    }
    trayIcon = nativeImage.createFromBuffer(buffer, { width: size, height: size })
  }

  if (isMac()) {
    const sizes = trayIcon.getSize()
    if (sizes.width !== 22 || sizes.height !== 22) {
      trayIcon = trayIcon.resize({ width: 22, height: 22 })
    }
  } else {
    // Win = 16x16 (small system tray); Linux = 22x22
    const size = process.platform === 'win32' ? 16 : 22
    trayIcon = trayIcon.resize({ width: size, height: size })
  }

  return trayIcon
}

function toggleWindow(getMainWindow: () => BrowserWindow | null): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  }
}

export function createTray(
  getMainWindow: () => BrowserWindow | null,
  recreateWindow?: () => BrowserWindow
): Tray {
  const trayIcon = buildTrayIcon()
  const tray = new Tray(trayIcon)

  if (isMac()) {
    tray.setIgnoreDoubleClickEvents(true)
    tray.setTitle('')
  }

  // M1：订阅 integration service 的 dock badge / tray title 变更
  // ⚠️ unsubscribers 不保存：service 是单例，tray 销毁时进程也退出
  const integration = pomodoroIntegrationService()
  void integration.onBadgeUpdate((count) => {
    integration.setDockBadge(count)
  })
  void integration.onTitleUpdate((title) => {
    if (!isMac()) return
    try {
      tray.setTitle(title)
    } catch {
      /* noop */
    }
  })

  // 通用 ctx：dockMenu / tray menu 都依赖这个
  const ctx = {
    getMainWindow,
    recreateWindow,
    get pomodoroStatus(): { primary: string; secondary: string } {
      return getPomodoroStatus()
    },
    get pomodoroProjects(): Array<{ id: string; name: string; isActive: boolean }> {
      return getPomodoroProjects()
    },
    get pomodoroFocusedProjectId(): string | null {
      return getPomodoroFocusedProjectId()
    }
  }

  // —— 平台差异行为 ——
  tray.on('click', () => {
    if (trayClickShouldToggleWindow()) {
      // macOS（IA v2 阶段C）：点击 tray 唤起/收起启动台胶囊
      toggleLauncherWindow()
    } else {
      // Win / Linux：点击直接弹菜单
      buildAndSetAppMenu('tray', tray, ctx)
      tray.popUpContextMenu()
    }
  })

  if (isMac()) {
    tray.on('right-click', () => {
      // macOS：tray 不弹菜单，菜单走 dock（右键 dock）
      // 右键 tray 这里就当「打开窗口」用
      toggleWindow(getMainWindow)
    })
  } else {
    tray.on('double-click', () => {
      toggleWindow(getMainWindow)
    })
  }

  // 初始菜单（Win / Linux 才有意义；macOS 上 dockMenu 单独管理）
  buildAndSetAppMenu('tray', tray, ctx)

  // 事件驱动刷新（usage / 番茄钟状态变更时防抖重建）+ 60s 兜底
  registerMenuAutoRefresh(() => {
    if (!tray.isDestroyed()) buildAndSetAppMenu('tray', tray, ctx)
  })

  return tray
}
