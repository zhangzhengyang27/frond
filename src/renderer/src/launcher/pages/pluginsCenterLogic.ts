/**
 * Frond · 胶囊内嵌插件中心页的纯逻辑（2026-10-06）
 *
 * 从 InstalledPlugin IPC 形状到「可渲染行」的映射、查询过滤、排序与卸载确认
 * 状态机。与 SFC 分离以便单测（KillProcessPage 同款拆法）。
 */

/** InstalledPlugin（IPC listPlugins 行）的形状子集（避免页面 import 主进程类型） */
export interface InstalledPluginLike {
  id: string
  name: string
  version: string
  description?: string
  enabled: boolean
}

/** 插件中心的渲染行 */
export interface PluginRow {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
}

export function toRows(plugins: InstalledPluginLike[]): PluginRow[] {
  return plugins.map((p) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    description: p.description ?? '',
    enabled: p.enabled === true
  }))
}

/** 查询过滤：name/description/version 大小写不敏感子串；空查全量（泛型透传页面本地行扩展字段） */
export function filterRows<T extends PluginRow>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (q === '') return rows
  return rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.version.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
  )
}

/** 排序：启用的在前，同组按名称（中文 locale 序） */
export function sortRows(rows: PluginRow[]): PluginRow[] {
  return rows.slice().sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })
}

/**
 * 卸载二次确认状态机：第一次 ⌘U 进入 armed（显示「再按确认」）；同 id 再按 =
 * 执行（返回 null）；换目标换 armed；ESC 清空。
 */
export function nextUninstallArmed(current: string | null, id: string): string | null {
  return current === id ? null : id
}
