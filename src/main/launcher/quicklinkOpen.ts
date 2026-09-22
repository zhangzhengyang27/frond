/**
 * Leaf · Quicklink 打开链路（B4：优先复用已有浏览器标签页）
 *
 * Raycast 行为对齐：打开 quicklink 前先经 BrowserTabsService（mac AppleScript）
 * 精确匹配已打开的标签，命中则激活该标签而非新开；未命中 / 开关关闭 /
 * 非 macOS / 服务不可用时回退 shell.openExternal（原行为）。
 *
 * 开关持久化在 launcher docStore 的 sys.quicklinks 命名空间（docId: reuseTabs），
 * 默认开启；本轮无 UI 开关（B5 接设置页），写入点已导出。
 */
import { shell } from 'electron'
import { findMatchingTab } from './leafUrl'
import { getLauncherDocStore } from './docStore'
import { activateBrowserTab, listAllBrowserTabs } from '../services/BrowserTabsService'

const QUICKLINK_NS = 'sys.quicklinks'
const REUSE_TAB_DOC_ID = 'reuseTabs'

/** 复用已有标签页开关默认值（默认开） */
export const QUICKLINK_REUSE_TAB_DEFAULT = true

/** 读取复用开关（doc 缺失 / 类型异常 / 存储异常一律回落默认值） */
export function isQuicklinkTabReuseEnabled(): boolean {
  try {
    const doc = getLauncherDocStore().get(QUICKLINK_NS, REUSE_TAB_DOC_ID)
    return typeof doc?.data === 'boolean' ? doc.data : QUICKLINK_REUSE_TAB_DEFAULT
  } catch {
    return QUICKLINK_REUSE_TAB_DEFAULT
  }
}

/** 写入复用开关（本轮无 UI 入口，B5 设置页直接调用；手工验证可经 sqlite 写 launcher_docs） */
export function setQuicklinkTabReuseEnabled(enabled: boolean): void {
  getLauncherDocStore().put(QUICKLINK_NS, REUSE_TAB_DOC_ID, enabled === true)
}

// 标签列表缓存：书签/链接打开是热路径，每次都同步枚举 Chrome+Safari 全部标签
// （各 5s 超时）会造成可感知延迟；TTL 内直接复用上次枚举结果。
const TAB_CACHE_TTL_MS = 30_000
let tabCache: { at: number; tabs: Awaited<ReturnType<typeof listAllBrowserTabs>> } | null = null
// macOS TCC（自动化权限）拒绝后置位：不再重试枚举（每次都会弹系统授权且必然失败），
// 全部走 shell.openExternal，直到应用重启。
let tccDenied = false

async function listTabsCached(): Promise<Awaited<ReturnType<typeof listAllBrowserTabs>>> {
  const now = Date.now()
  if (tabCache && now - tabCache.at < TAB_CACHE_TTL_MS) return tabCache.tabs
  const tabs = await listAllBrowserTabs()
  tabCache = { at: now, tabs }
  return tabs
}

function isTccDeniedError(error: unknown): boolean {
  const msg = String((error as Error)?.message ?? error)
  return /-1743|not allowed assistive|Accessibility/i.test(msg)
}

/**
 * 打开 quicklink URL：命中已打开标签则激活（返回 true 即不再系统打开），
 * 否则按原行为 shell.openExternal。fire-and-forget，永不 reject。
 */
export function openQuicklinkUrl(url: string): void {
  void openQuicklinkUrlAsync(url)
}

async function openQuicklinkUrlAsync(url: string): Promise<void> {
  if (url && isQuicklinkTabReuseEnabled() && !tccDenied) {
    try {
      const tabs = await listTabsCached()
      const hit = findMatchingTab(url, tabs)
      if (hit && (await activateBrowserTab(hit))) return
    } catch (error) {
      // 复用链路任何失败（osascript 超时 / 权限缺失 / 服务异常）都不阻断打开；
      // TCC 拒绝（-1743）属持久状态，置位短路避免每次都弹授权+空等超时
      console.warn('[Launcher] quicklink 标签复用失败，回退系统打开:', error)
      if (isTccDeniedError(error)) tccDenied = true
    }
  }
  void shell.openExternal(url)
}
