/**
 * Leaf · 统一 Menu Builder（dock + tray 共用）
 *
 * 设计：
 * - dockMenu（macOS Dock 右键）与 tray（Win/Linux 托盘）共用同一 builder
 * - 模块跳转走 IPC：menu:openModule → renderer 调 router.push + usage.recordUse
 *   与 ⌘1-9 / CommandPalette 走同一条跳转路径（单一真相）
 *
 * 数据来源：
 * - 模块列表：src/shared/modules.ts（与 Sidebar / Hub / CommandPalette 一致）
 * - 最近使用 / 收藏：usageStore（每次 setMenu 前实时拉，避免 stale）
 */

import { app, BrowserWindow, Menu } from 'electron'
import { MODULES, type ModuleMeta } from '../../shared/modules'
import { usageStore } from '../stores'
import { isMac, toAccelerator } from '../utils/platform'
import { usageRepository } from '../db/repos/UsageRepository'
import { pomodoroIntegrationService } from '../services/PomodoroIntegrationService'

// ─── 事件驱动菜单自动刷新（tray / dock 共用）───

const menuRefreshUnsubscribers: Array<() => void> = []
const menuFallbackTimers: Array<ReturnType<typeof setInterval>> = []

/**
 * 事件驱动 + 低频兜底的菜单刷新：
 * - usage（recent/favorites 增删）与番茄钟 badge/title 变更时防抖重建
 * - 60s 兜底覆盖未接事件的漂移（频率远低于原 10s 盲轮询）
 */
export function registerMenuAutoRefresh(build: () => void): void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const rebuild = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      try {
        build()
      } catch {
        /* 菜单构建失败不致命，等下次触发 */
      }
    }, 1000)
  }
  menuRefreshUnsubscribers.push(usageRepository.onUsageChanged(rebuild))
  const integration = pomodoroIntegrationService()
  menuRefreshUnsubscribers.push(integration.onBadgeUpdate(() => rebuild()))
  menuRefreshUnsubscribers.push(integration.onTitleUpdate(() => rebuild()))
  menuFallbackTimers.push(setInterval(rebuild, 60_000))
}

/** 清理自动刷新订阅与兜底 timer（幂等） */
export function destroyMenuAutoRefresh(): void {
  for (const fn of menuRefreshUnsubscribers) fn()
  menuRefreshUnsubscribers.length = 0
  for (const t of menuFallbackTimers) clearInterval(t)
  menuFallbackTimers.length = 0
}

export interface AppMenuContext {
  getMainWindow: () => BrowserWindow | null
  recreateWindow?: () => BrowserWindow
  /** 当前番茄钟状态（tray 显示「模式 + 任务 + 倒计时」用） */
  pomodoroStatus?: { primary: string; secondary: string }
  /** P1-2：可切换焦点的项目列表（id, name, isActive） */
  pomodoroProjects?: Array<{ id: string; name: string; isActive: boolean }>
  /** P1-2：当前焦点项目 id */
  pomodoroFocusedProjectId?: string | null
}

/**
