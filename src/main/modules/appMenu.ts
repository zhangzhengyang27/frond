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

import { createWindow as createAppWindow, HEAVY_MODULE_WINDOW_SIZES, openHeavyModuleWindow } from './windows'
import { app, BrowserWindow, Menu } from 'electron'
import { MODULES, type ModuleMeta } from '../../shared/modules'
import { usageStore } from '../stores'
import { isMac, toAccelerator } from '../utils/platform'
import { usageRepository } from '../db/repos/UsageRepository'
import { pomodoroIntegrationService } from '../services/PomodoroIntegrationService'
import { log } from '../services/LogService'
import { showLauncherWindow } from '../launcher/window'

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
      } catch (e) {
        // 批 7b 空 catch 清账（原注释：* 菜单构建失败不致命，等下次触发）
        log.debug('app-menu', '* 菜单构建失败不致命，等下次触发', e)
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
  recreateWindow?: (() => BrowserWindow) | undefined
  /** 当前番茄钟状态（tray 显示「模式 + 任务 + 倒计时」用） */
  pomodoroStatus?: { primary: string; secondary: string }
  /** 番茄钟控制项（label 已按运行态定好；null = 无会话不显示，避免「点了不知开什么」） */
  pomodoroControl?: { label: string } | null
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
    // tray/dock 菜单动作全部推给主窗渲染端——窗口隐藏时先带出来，否则动作
    // 在后台窗口里执行、用户面前毫无反应（2026-10-04 实测：菜单点击「不生效」
    // 的真因就是 sendToRenderer 打进隐藏窗口）
    if (!win.isVisible()) {
      win.show()
      win.focus()
    }
    run(win)
    return
  }
  const recreated = ctx.recreateWindow?.()
  if (recreated) {
    recreated.show()
    recreated.focus()
    run(recreated)
  }
}

function sendToRenderer(ctx: AppMenuContext, channel: string, payload?: unknown): void {
  log.info('app-menu', `click -> ${channel}`)
  withMainWindow(ctx, (win) => win.webContents.send(channel, payload))
}

/**
 * 模块跳转：只推 IPC，不在主进程记 usage——router.push 与 usage.recordUse
 * 都由渲染端做（与 ⌘1-9 / CommandPalette 同一条路径，见文件头）。
 * B59b：重型工作模块例外——走独立小窗（与 launcher:openModule 同口径），
 * usage 记账由 openHeavyModuleWindow 转投新窗渲染端。
 */
function openModuleItem(ctx: AppMenuContext, meta: ModuleMeta): void {
  if (meta.id in HEAVY_MODULE_WINDOW_SIZES) {
    openHeavyModuleWindow(meta.id, meta.path, ctx.getMainWindow)
    return
  }
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
    // shortcut 存的是裸数字（语义 ⌘1-9，见 useModuleShortcuts）：不加 Mod 菜单会
    // 显示裸「1」「3」，用户按数字没反应、也看不出真实快捷键
    ...(meta.shortcut && {
      accelerator: toAccelerator(meta.shortcut.includes('Mod') ? meta.shortcut : `Mod+${meta.shortcut}`)
    }),
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

/** 入口/系统项逐条具名：buildTemplate 按 Raycast 式分段引用，不靠数组下标对位 */

function commandPaletteItem(ctx: AppMenuContext): Electron.MenuItemConstructorOptions {
  return { label: '命令面板…', click: () => sendToRenderer(ctx, 'app:openCommandPalette') }
}

function preferencesItem(): Electron.MenuItemConstructorOptions {
  return {
    label: '偏好设置',
    accelerator: 'CmdOrCtrl+,',
    click: () => createAppWindow('/settings', true, 800, 786)
  }
}

function aboutItem(_ctx: AppMenuContext): Electron.MenuItemConstructorOptions {
  // 独立小窗（route 复用幂等），不再路由主窗——关于页摊在 1450×950 巨窗里太空，
  // 且 sendToRenderer 会把藏着的主窗连带弹出来
  return { label: '关于 Frond', click: () => createAppWindow('/about', true, 560, 640) }
}

/** 番茄钟段：控制项（toggle 与全局快捷键同一条 IPC 路径）+ 状态行（只读）+ 焦点项目单选 */
function pomodoroItems(ctx: AppMenuContext): Electron.MenuItemConstructorOptions[] {
  const status = ctx.pomodoroStatus
  const control = ctx.pomodoroControl
  const projects = ctx.pomodoroProjects ?? []
  const focused = ctx.pomodoroFocusedProjectId ?? null
  const items: Electron.MenuItemConstructorOptions[] = []
  if (control) {
    items.push({
      label: control.label,
      click: () => sendToRenderer(ctx, 'pomodoro:shortcut', { action: 'toggle' })
    })
  }
  if (status) {
    items.push({
      label: status.primary,
      ...(status.secondary && { sublabel: status.secondary }),
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

/**
 * 菜单结构（Raycast menu-bar-extra 式：托盘 = 入口 + 系统，不放功能导航）：
 * - 入口：启动台（对位 Open Raycast，第一主入口）/ 命令面板
 *   （不设「打开主窗口」：主窗默认路由就是 /settings，与「偏好设置」同屏，
 *   createWindow 的路由复用让偏好设置项=打开/聚焦设置页，无需双入口）
 * - 番茄钟：控制（暂停/继续，仅已有会话时）+ 状态行 + 焦点项目
 * - Quick Switch：最近使用 / 收藏（Frond 既有设计，DECISIONS.md）
 * - 系统：偏好设置 ⌘, / 关于 / 退出（tray 带 Quit 对位 Raycast；dock 不带——
 *   macOS dock 有系统级退出路径，惯例不重复）
 *
 * 模块跳转走 IPC：menu:openModule → renderer 调 router.push + usage.recordUse
 * （与 ⌘1-9 / CommandPalette 同一条路径）；顶层不再铺模块列表——跳转入口
 * 已由启动台/命令面板/⌘1-9 覆盖（Raycast 哲学：托盘不是导航）。
 */
function buildTemplate(
  kind: 'tray' | 'dock',
  ctx: AppMenuContext
): Electron.MenuItemConstructorOptions[] {
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: '启动台', click: () => showLauncherWindow() },
    commandPaletteItem(ctx),
    { type: 'separator' },
    ...pomodoroItems(ctx),
    { type: 'separator' },
    byIdList(ctx, usageStore.getRecent(6), '最近使用', '还没有使用记录'),
    byIdList(ctx, usageStore.getFavorites(), '收藏', '还没有收藏（模块页 ⌘D 收藏）'),
    { type: 'separator' },
    preferencesItem(),
    { type: 'separator' },
    aboutItem(ctx)
  ]
  if (kind === 'tray') {
    template.push({ type: 'separator' }, { label: '退出 Frond', click: () => app.quit() })
  }
  return template
}

/**
 * 构建并按需挂载 dock / tray 菜单（两者共用同一份 template，见文件头）。
 * dock 侧每次调用都重新 setMenu —— macOS 的 dock 菜单没有「惰性取单」能力。
 */
export function buildAndSetAppMenu(
  kind: 'tray' | 'dock',
  target: MenuTarget,
  ctx: AppMenuContext
): void {
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
        { label: '关于 Frond', click: () => createAppWindow('/about', true, 560, 640) },
        {
          label: '偏好设置…',
          accelerator: 'Cmd+,',
          click: () => createAppWindow('/settings', true, 800, 786)
        },
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
        { label: '启动台', click: () => showLauncherWindow() },
        { label: '命令面板…', click: () => sendToRenderer(ctx, 'app:openCommandPalette') },
        { type: 'separator' },
        ...MODULES.map((m) => moduleItem(ctx, m))
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
