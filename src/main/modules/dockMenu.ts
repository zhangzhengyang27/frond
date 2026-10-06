/**
 * Frond · Dock 菜单（macOS 专属）
 *
 * 内容来源：src/main/modules/appMenu.ts（与 tray 共用 builder，Raycast 式分段：
 * 入口 / 番茄钟控制与状态 / Quick Switch / 系统；dock 不带退出——macOS dock
 * 有系统级退出路径）。番茄钟数据与 tray 同源（getPomodoro* 系列）。
 *
 * 注：Dock 右键菜单是 macOS 专属特性，Windows / Linux 由 tray 承担。
 */

import { app, BrowserWindow } from 'electron'
import { buildAndSetAppMenu, registerMenuAutoRefresh, destroyMenuAutoRefresh } from './appMenu'
import {
  getPomodoroStatus,
  getPomodoroControl,
  getPomodoroProjects,
  getPomodoroFocusedProjectId
} from './tray'
import { isMac } from '../utils/platform'

/** 清理 Dock 菜单刷新（幂等；共享 tray 侧的订阅池） */
export function destroyDockMenuTimer(): void {
  destroyMenuAutoRefresh()
}

export function setupDockMenu(getMainWindow: () => BrowserWindow | null): void {
  if (!isMac() || !app.dock) return

  const ctx = {
    getMainWindow,
    // dockMenu 没「窗口已关」场景，recreateWindow 不传
    get pomodoroStatus(): { primary: string; secondary: string } {
      return getPomodoroStatus()
    },
    get pomodoroControl(): { label: string } | null {
      return getPomodoroControl()
    },
    get pomodoroProjects(): Array<{ id: string; name: string; isActive: boolean }> {
      return getPomodoroProjects()
    },
    get pomodoroFocusedProjectId(): string | null {
      return getPomodoroFocusedProjectId()
    }
  }

  buildAndSetAppMenu('dock', null, ctx)

  // 事件驱动刷新（usage / 番茄钟状态变更时防抖重建）+ 60s 兜底，替代 10s 盲轮询
  registerMenuAutoRefresh(() => {
    buildAndSetAppMenu('dock', null, ctx)
  })
}
