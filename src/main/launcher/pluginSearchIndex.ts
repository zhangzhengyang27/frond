/**
 * Frond · 插件搜索索引（#5 插件双通道，主进程侧）
 *
 * Frond 的插件是 BrowserView，无法后台常驻跑 JS——「双通道」适配为：
 * 插件打开时经 launcherApi.submitSearchItems(items) 把可搜索条目集持久化到
 * 主进程（docStore 按 pluginId 限定 KV），关闭后条目仍进根搜索；插件每次打开
 * 重新提交即完成刷新（onReady / onEnter 钩子均可）。
 *
 * 门控 fail-closed：仅 manifest `searchable: true` 且已启用的插件可写入；
 * 读取按「已启用 + searchable」过滤——卸载 / 停用天然从根搜索消失，无需清理钩子。
 * 清洗规则见 shared/plugin-protocol.ts sanitizePluginSearchItems（封顶 300 条）。
 */
import { getLauncherDocStore } from './docStore'
import { getPlugin, listEnabledPlugins } from './pluginStore'
import { sanitizePluginSearchItems, type PluginSearchItem } from '../../shared/plugin-protocol'

const DOC_ID = 'search-index'

export interface StoredPluginSearchItems {
  items: PluginSearchItem[]
  updatedAt: number
}

export type PluginSearchItemStored = PluginSearchItem & { pluginId: string }

/** 插件提交可搜索条目集（覆盖式持久化）；未开通 searchable / 未启用 / 未知插件返回 false */
export function setPluginSearchItems(pluginId: string, raw: unknown): boolean {
  const plugin = getPlugin(pluginId)
  if (!plugin || !plugin.enabled || plugin.searchable !== true) return false
  const items = sanitizePluginSearchItems(raw)
  getLauncherDocStore().put(pluginId, DOC_ID, {
    items,
    updatedAt: Date.now()
  } satisfies StoredPluginSearchItems)
  return true
}

/** 合并读取全部「已启用 + searchable」插件的搜索条目（带 pluginId 供动作路由） */
export function listPluginSearchItems(): PluginSearchItemStored[] {
  return listEnabledPlugins()
    .filter((p) => p.searchable === true)
    .flatMap((p) => {
      const doc = getLauncherDocStore().get(p.id, DOC_ID)
      const stored = doc?.data as StoredPluginSearchItems | undefined
      if (!stored || !Array.isArray(stored.items)) return []
      return stored.items.map((item) => ({ ...item, pluginId: p.id }))
    })
}

/** 清除某插件的搜索条目（插件卸载 / 主动撤回） */
export function clearPluginSearchItems(pluginId: string): void {
  getLauncherDocStore().remove(pluginId, DOC_ID)
}
