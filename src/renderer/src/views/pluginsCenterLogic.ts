/**
 * Frond · 胶囊内嵌插件中心页的纯逻辑（2026-10-06）
 *
 * 从 InstalledPlugin IPC 形状到「可渲染行」的映射、查询过滤、排序与卸载确认
 * 状态机。与 SFC 分离以便单测（KillProcessPage 同款拆法）。
 *
 * P-3 扩展（2026-10-07）：来源标签（origin）、声明权限标签、可更新版本号——
 * 权限名只认 shared/plugin-protocol 的已知集合（与运行时 fail-closed 同一口径）。
 */
import {
  PLUGIN_PERMISSION_LABELS,
  isPluginPermission,
  type PluginPermission
} from '../../../shared/plugin-protocol'

/** InstalledPlugin（IPC listPlugins 行）的形状子集（避免页面 import 主进程类型） */
export interface InstalledPluginLike {
  id: string
  name: string
  version: string
  description?: string
  enabled: boolean
  origin?: { kind: string; ref?: string }
  permissions?: string[]
}

/** 插件中心的渲染行 */
export interface PluginRow {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  /** 来源种类：builtin/market/local/dev；旧数据缺省 'unknown' */
  originKind: string
  /** 声明的敏感权限标签（未知权限已被主进程清洗，这里再兜一道） */
  permissionLabels: string[]
}

const ORIGIN_LABELS: Record<string, string> = {
  builtin: '内置',
  market: '市场',
  local: '本地导入',
  dev: '开发'
}

export function originLabel(kind: string | undefined): string {
  return (kind && ORIGIN_LABELS[kind]) || '未知'
}

export function toRows(plugins: InstalledPluginLike[]): PluginRow[] {
  return plugins.map((p) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    description: p.description ?? '',
    enabled: p.enabled === true,
    originKind: p.origin?.kind ?? 'unknown',
    permissionLabels: [...new Set((p.permissions ?? []).filter(isPluginPermission))].map(
      (k) => PLUGIN_PERMISSION_LABELS[k as PluginPermission]
    )
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

/** 头部统计：已装总数与启用数 */
export function statsOf(rows: PluginRow[]): { total: number; enabled: number } {
  return { total: rows.length, enabled: rows.filter((r) => r.enabled).length }
}
