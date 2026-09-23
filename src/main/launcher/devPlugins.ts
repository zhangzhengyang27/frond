/**
 * Frond · 插件热重载开发模式（对标 Raycast develop）
 *
 * 开发者把本地插件目录注册进来后：
 *   保存文件 → fs.watch 触发 → importFromFolder 覆盖重装（staging 交换，失败不破坏已装版本）
 *   → reloadPluginView 就地重载胶囊中的插件视图。
 *
 * - 配置持久化在 launcher_docs kv `sys.devplugins`：[{ pluginId, sourceDir, autoReload }]
 * - watcher 惰性启动：只在 addDevPlugin / 开启 autoReload 时创建，句柄集中在模块级 Map，
 *   remove / 关闭 autoReload / 应用 will-quit 时统一 close，不留悬挂句柄
 * - removeDevPlugin 只解除开发跟踪（停 watcher + 删 kv），不卸载插件；
 *   是否卸载由 UI 决定（另调 pluginStore.removePlugin / launcher:removePlugin）
 * - manifest 坏了的重装失败：staging 交换保证已安装版本完好，这里 catch 后
 *   经系统 Notification 与 launcher:devPlugins:changed 推送把错误带给界面
 */
import { app, BrowserWindow, Notification } from 'electron'
import { existsSync, watch, type FSWatcher } from 'fs'
import { resolve } from 'path'
import { getLauncherDocStore } from './docStore'
import {
  importFromFolder,
  readManifest,
  getPlugin,
  setPluginEnabled,
  type InstalledPlugin
} from './pluginStore'
import { reloadPluginView } from './runtime'
import { getLauncherWindow } from './window'

const DEV_PLUGINS_NS = 'sys.devplugins'
const RELOAD_DEBOUNCE_MS = 300

/** kv 里持久化的单条开发配置 */
export interface DevPluginEntry {
  pluginId: string
  sourceDir: string
  autoReload: boolean
}

/** 列表返回条目：附带安装态与源目录健康度，供管理页直接渲染 */
export interface DevPluginInfo extends DevPluginEntry {
  name?: string
  version?: string
  installed: boolean
  sourceExists: boolean
  manifestValid: boolean
}

export type DevPluginChangeKind = 'added' | 'removed' | 'reloaded' | 'error'

export interface DevPluginChangePayload {
  kind: DevPluginChangeKind
  pluginId: string
  name?: string
  error?: string
}

// ─────────── kv 读写 ───────────

function readEntries(): DevPluginEntry[] {
  const doc = getLauncherDocStore().get(DEV_PLUGINS_NS, 'items')
  const raw = (doc?.data as unknown[]) ?? []
  const entries: DevPluginEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const e = item as Record<string, unknown>
    if (typeof e.pluginId !== 'string' || !e.pluginId) continue
    if (typeof e.sourceDir !== 'string' || !e.sourceDir) continue
    entries.push({
      pluginId: e.pluginId,
      sourceDir: e.sourceDir,
      autoReload: e.autoReload === true
    })
  }
  return entries
}

function writeEntries(entries: DevPluginEntry[]): void {
  getLauncherDocStore().put(DEV_PLUGINS_NS, 'items', entries)
}

// ─────────── 变更广播（管理页 toast 提示用；preload 绑定 onDevPluginsChanged）───────────

function broadcast(payload: DevPluginChangePayload): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('launcher:devPlugins:changed', payload)
    }
  }
}

/** 主进程兜底反馈：管理页未必开着，重装失败至少有系统通知 */
function notifyError(pluginId: string, error: string): void {
  if (Notification.isSupported()) {
    new Notification({ title: '插件热重载失败', body: `${pluginId}: ${error}` }).show()
  }
}

// ─────────── watcher（模块级句柄，全部可清理）───────────

/** pluginId → 活动 watcher；autoReload 关闭或 remove 时 close */
const watchers = new Map<string, FSWatcher>()
/** pluginId → 防抖定时器（保存风暴合并为一次重装） */
const pendingTimers = new Map<string, NodeJS.Timeout>()

let quitHooked = false

/** 应用退出时统一清理 watcher（惰性注册一次；不触碰主进程入口文件） */
function ensureQuitHook(): void {
  if (quitHooked) return
  quitHooked = true
  app.on('will-quit', () => {
    stopAllWatchers()
  })
}

function stopWatcher(pluginId: string): void {
  const timer = pendingTimers.get(pluginId)
  if (timer) {
    clearTimeout(timer)
    pendingTimers.delete(pluginId)
  }
  const watcher = watchers.get(pluginId)
  if (watcher) {
    watcher.close()
    watchers.delete(pluginId)
  }
}

function stopAllWatchers(): void {
  for (const pluginId of [...watchers.keys()]) stopWatcher(pluginId)
}

function startWatcher(entry: DevPluginEntry): void {
  // 幂等：已有同插件 watcher 先关（目录可能已更换）
  stopWatcher(entry.pluginId)
  if (!entry.autoReload) return
  const dir = resolve(entry.sourceDir)
  let watcher: FSWatcher
  try {
    watcher = watch(dir, { recursive: true }, () => scheduleReload(entry.pluginId))
  } catch (error) {
    console.error('[Launcher] dev watcher 启动失败:', dir, (error as Error).message)
    return
  }
  watcher.on('error', (error) => {
    console.warn('[Launcher] dev watcher 异常:', entry.pluginId, error.message)
    stopWatcher(entry.pluginId)
  })
  watchers.set(entry.pluginId, watcher)
  ensureQuitHook()
}

function scheduleReload(pluginId: string): void {
  const timer = pendingTimers.get(pluginId)
  if (timer) clearTimeout(timer)
  pendingTimers.set(
    pluginId,
    setTimeout(() => {
      pendingTimers.delete(pluginId)
      // 传入胶囊窗：重载后的握手重置（declaredList 清空）要推送给胶囊渲染端
      void reinstallAndReload(pluginId, getLauncherWindow())
    }, RELOAD_DEBOUNCE_MS)
  )
}

// ─────────── 重装 + 重载 ───────────

/**
 * 从源目录覆盖重装并重载活动视图。
 * importFromFolder 的 staging 交换保证：manifest 坏了抛错、已安装版本原样保留。
 */
async function reinstallAndReload(
  pluginId: string,
  capsule: BrowserWindow | null = null
): Promise<{ ok: boolean; error?: string; plugin?: InstalledPlugin }> {
  const entry = readEntries().find((e) => e.pluginId === pluginId)
  if (!entry) return { ok: false, error: '该插件未注册开发模式' }
  const dir = resolve(entry.sourceDir)
  if (!existsSync(dir)) {
    notifyError(pluginId, '源目录不存在')
    broadcast({ kind: 'error', pluginId, error: '源目录不存在' })
    return { ok: false, error: '源目录不存在' }
  }
  if (!existsSync(joinManifest(dir))) {
    notifyError(pluginId, 'plugin.json 缺失或尚未保存完整')
    broadcast({ kind: 'error', pluginId, error: 'plugin.json 缺失' })
    return { ok: false, error: '目录中不存在 plugin.json' }
  }
  try {
    const before = getPlugin(pluginId)
    const plugin = importFromFolder(dir)
    // importFromFolder 强制 enabled: true：热重装必须保留用户的启停状态，
    // 否则一次文件保存会把手动停用的插件重新拉起
    if (before && !before.enabled) {
      setPluginEnabled(pluginId, false)
      plugin.enabled = false
    }
    reloadPluginView(pluginId, capsule)
    broadcast({ kind: 'reloaded', pluginId, name: plugin.name })
    return { ok: true, plugin }
  } catch (error) {
    // staging 交换已保证旧版本完好：这里只做反馈，不做回滚
    const message = (error as Error).message
    console.error('[Launcher] dev 热重载失败:', pluginId, message)
    notifyError(pluginId, message)
    broadcast({ kind: 'error', pluginId, error: message })
    return { ok: false, error: message }
  }
}

function joinManifest(dir: string): string {
  return resolve(dir, 'plugin.json')
}

// ─────────── 对外 API（ipc 调用）───────────

export function listDevPlugins(): DevPluginInfo[] {
  return readEntries()
    .map((entry) => {
      const installed = getPlugin(entry.pluginId)
      const sourceExists = existsSync(resolve(entry.sourceDir))
      let manifestValid = false
      if (sourceExists) {
        try {
          readManifest(resolve(entry.sourceDir))
          manifestValid = true
        } catch {
          manifestValid = false
        }
      }
      return {
        ...entry,
        name: installed?.name,
        version: installed?.version,
        installed: !!installed,
        sourceExists,
        manifestValid
      }
    })
    .sort((a, b) => a.pluginId.localeCompare(b.pluginId))
}

/** 注册开发目录：校验 manifest → 覆盖安装 → 记录 kv → 惰性启动 watcher */
export function addDevPlugin(sourceDir: string): {
  ok: boolean
  error?: string
  plugin?: InstalledPlugin
} {
  const dir = resolve(String(sourceDir ?? ''))
  if (!existsSync(dir)) return { ok: false, error: '目录不存在' }
  if (!existsSync(joinManifest(dir))) return { ok: false, error: '目录中不存在 plugin.json' }
  let plugin: InstalledPlugin
  try {
    // importFromFolder 内部走 readManifest 校验 + staging 原子交换（覆盖式安装）
    plugin = importFromFolder(dir)
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
  const entries = readEntries().filter((e) => e.pluginId !== plugin.id)
  const entry: DevPluginEntry = { pluginId: plugin.id, sourceDir: dir, autoReload: true }
  entries.push(entry)
  writeEntries(entries)
  startWatcher(entry)
  broadcast({ kind: 'added', pluginId: plugin.id, name: plugin.name })
  return { ok: true, plugin }
}

/** 解除开发跟踪：停 watcher + 删 kv。不卸载插件本体（卸载由 UI 另调 launcher:removePlugin） */
export function removeDevPlugin(pluginId: string): { ok: boolean; error?: string } {
  const id = String(pluginId ?? '')
  const entries = readEntries()
  const target = entries.find((e) => e.pluginId === id)
  if (!target) return { ok: false, error: '该插件未注册开发模式' }
  stopWatcher(id)
  writeEntries(entries.filter((e) => e.pluginId !== id))
  broadcast({ kind: 'removed', pluginId: id })
  return { ok: true }
}

/** 开关自动重载：关 = 停 watcher 释放句柄；开 = 重建 watcher */
export function setDevAutoReload(
  pluginId: string,
  autoReload: boolean
): { ok: boolean; error?: string } {
  const id = String(pluginId ?? '')
  const entries = readEntries()
  const target = entries.find((e) => e.pluginId === id)
  if (!target) return { ok: false, error: '该插件未注册开发模式' }
  target.autoReload = autoReload === true
  writeEntries(entries)
  startWatcher(target)
  return { ok: true }
}

/** 手动重载单插件（不依赖 autoReload 开关） */
export function reloadDevPlugin(
  pluginId: string,
  capsule: BrowserWindow | null
): Promise<{ ok: boolean; error?: string; plugin?: InstalledPlugin }> {
  return reinstallAndReload(String(pluginId ?? ''), capsule)
}
