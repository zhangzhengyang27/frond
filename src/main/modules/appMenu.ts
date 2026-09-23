/**
 * Frond · 统一 Menu Builder（dock + tray 共用）
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

/** tray 侧传 Tray 实例，dock 侧传 null（走 app.dock.setMenu） */
export type MenuTarget = import('electron').Tray | null

/** 取（必要时重建）主窗口再执行：点 dock/tray 菜单时窗口可能已经关了 */
function withMainWindow(ctx: AppMenuContext, run: (win: BrowserWindow) => void): void {
  const win = ctx.getMainWindow()
  if (win && !win.isDestroyed()) {
    run(win)
    return
  }
  const recreated = ctx.recreateWindow?.()
  if (recreated) run(recreated)
}

function sendToRenderer(ctx: AppMenuContext, channel: string, payload?: unknown): void {
  withMainWindow(ctx, (win) => win.webContents.send(channel, payload))
}

/**
 * 模块跳转：只推 IPC，不在主进程记 usage——router.push 与 usage.recordUse
 * 都由渲染端做（与 ⌘1-9 / CommandPalette 同一条路径，见文件头）。
 */
function openModuleItem(ctx: AppMenuContext, meta: ModuleMeta): void {
  sendToRenderer(ctx, 'app:openModule', { moduleId: meta.id, path: meta.path })
}

function metaOf(moduleId: string): ModuleMeta | undefined {
  return MODULES.find((m) => m.id === moduleId)
}

function moduleItem(
  ctx: AppMenuContext,
  meta: ModuleMeta,
  extraLabel?: string
): Electron.MenuItemConstructorOptions {
  return {
    label: extraLabel ?? meta.label,
    accelerator: meta.shortcut ? toAccelerator(meta.shortcut) : undefined,
    click: () => openModuleItem(ctx, meta)
  }
}

/** 「最近使用」与「收藏」按 usageStore 实时拉取，避免菜单 stale */
function byIdList(
  ctx: AppMenuContext,
  ids: string[],
  label: string,
  emptyHint: string
): Electron.MenuItemConstructorOptions {
  const items = ids
    .map((id) => metaOf(id))
    .filter((m): m is ModuleMeta => !!m)
    .map((m) => moduleItem(ctx, m))
  return {
    label,
    submenu: items.length ? items : [{ label: emptyHint, enabled: false }]
  }
}

function frondItems(ctx: AppMenuContext): Electron.MenuItemConstructorOptions[] {
  return [
    { label: '启动台', click: () => sendToRenderer(ctx, 'app:goHome') },
    { label: '命令面板…', click: () => sendToRenderer(ctx, 'app:openCommandPalette') },
    {
      label: '偏好设置',
      accelerator: 'CmdOrCtrl+,',
      click: () => sendToRenderer(ctx, 'app:openSettings')
    },
    { label: '关于 Frond', click: () => sendToRenderer(ctx, 'app:openAbout') }
  ]
}

/** 番茄钟段：状态行（只读）+ 焦点项目单选（切换仍由渲染端落库） */
function pomodoroItems(ctx: AppMenuContext): Electron.MenuItemConstructorOptions[] {
  const status = ctx.pomodoroStatus
  const projects = ctx.pomodoroProjects ?? []
  const focused = ctx.pomodoroFocusedProjectId ?? null
  const items: Electron.MenuItemConstructorOptions[] = []
  if (status) {
    items.push({
      label: status.primary,
      sublabel: status.secondary || undefined,
      enabled: false
    })
  }
  if (projects.length) {
    items.push({
      label: '焦点项目',
      submenu: projects.map((p) => ({
        label: p.name,
        type: 'radio' as const,
        checked: p.id === focused,
        click: () => sendToRenderer(ctx, 'pomodoro:focusProject', { projectId: p.id })
      }))
    })
  }
  return items
}

function buildTemplate(
  kind: 'tray' | 'dock',
  ctx: AppMenuContext
): Electron.MenuItemConstructorOptions[] {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...MODULES.map((m) => moduleItem(ctx, m)),
    { type: 'separator' },
    byIdList(ctx, usageStore.getRecent(6), '最近使用', '还没有使用记录'),
    byIdList(ctx, usageStore.getFavorites(), '收藏', '还没有收藏（模块页 ⌘D 收藏）'),
    ...pomodoroItems(ctx),
    { type: 'separator' },
    ...frondItems(ctx)
  ]
  // macOS 的退出由应用菜单负责；tray / dock 菜单在 Win/Linux 才自带退出项
  if (kind === 'tray' && !isMac()) {
    template.push({ type: 'separator' }, { label: '退出 Frond', click: () => app.quit() })
  }
  return template
}

/**
 * 构建并按需挂载 dock / tray 菜单（两者共用同一份 template，见文件头）。
 * dock 侧每次调用都重新 setMenu —— macOS 的 dock 菜单没有「惰性取单」能力。
 */
export function buildAndSetAppMenu(kind: 'tray' | 'dock', target: MenuTarget, ctx: AppMenuContext): void {
  const menu = Menu.buildFromTemplate(buildTemplate(kind, ctx))
  if (kind === 'dock') {
    if (isMac() && app.dock) app.dock.setMenu(menu)
    return
  }
  target?.setContextMenu(menu)
}

/**
 * 应用菜单栏（macOS 顶部）。Windows / Linux 上不设菜单：这两平台的窗口菜单
 * 与 tray 重复，显式 setMenu(null) 免得占一条。
 */
export function installApplicationMenu(ctx: AppMenuContext): void {
  if (!isMac()) {
    Menu.setApplicationMenu(null)
    return
  }
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { label: '关于 Frond', click: () => sendToRenderer(ctx, 'app:openAbout') },
        { label: '偏好设置…', accelerator: 'Cmd+,', click: () => sendToRenderer(ctx, 'app:openSettings') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: '前往',
      submenu: [
        { label: '启动台', click: () => sendToRenderer(ctx, 'app:goHome') },
        { label: '命令面板…', click: () => sendToRenderer(ctx, 'app:openCommandPalette') },
        { type: 'separator' },
        ...MODULES.map((m) => moduleItem(ctx, m))
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

