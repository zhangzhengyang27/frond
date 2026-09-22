/**
 * Leaf · Dock 菜单（macOS 专属）
 *
 * 内容来源：src/main/modules/appMenu.ts（与 tray 共用 builder）
 * - 顶部：9 模块通过 IPC 跳转
 * - 底部：Hub / 命令面板 / 设置 / 关于 / 退出
 *
 * 注：Dock 右键菜单是 macOS 专属特性，Windows / Linux 由 tray 承担。
 */

import { app, BrowserWindow } from 'electron'
import { buildAndSetAppMenu, registerMenuAutoRefresh, destroyMenuAutoRefresh } from './appMenu'
import { isMac } from '../utils/platform'

/** 清理 Dock 菜单刷新（幂等；共享 tray 侧的订阅池） */
export function destroyDockMenuTimer(): void {
  destroyMenuAutoRefresh()
}

export function setupDockMenu(getMainWindow: () => BrowserWindow | null): void {
  if (!isMac() || !app.dock) return

  const ctx = {
    getMainWindow
    // dockMenu 没「窗口已关」场景，recreateWindow 不传
  }

  buildAndSetAppMenu('dock', null, ctx)

  // 事件驱动刷新（usage / 番茄钟状态变更时防抖重建）+ 60s 兜底，替代 10s 盲轮询
  registerMenuAutoRefresh(() => {
    buildAndSetAppMenu('dock', null, ctx)
  })
}
