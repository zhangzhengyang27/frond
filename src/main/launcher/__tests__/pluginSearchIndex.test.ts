import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * 插件搜索索引存储（#5 插件双通道，主进程侧）：
 * - 插件打开时 submitSearchItems 持久化条目集（docStore 按 pluginId 限定 KV）
 * - 门控 fail-closed：仅 manifest searchable===true 且已启用的插件可写入
 * - 读取按「已启用 + searchable」过滤——卸载 / 停用天然从根搜索消失，无需清理钩子
 */
vi.mock('../docStore', () => {
  const docs = new Map<string, unknown>()
  return {
    getLauncherDocStore: () => ({
      put: (pluginId: string, docId: string, data: unknown) => {
        docs.set(`${pluginId}::${docId}`, data)
        return { id: `${pluginId}::${docId}` }
      },
      get: (pluginId: string, docId: string) => {
        const data = docs.get(`${pluginId}::${docId}`)
        return data === undefined ? null : { id: `${pluginId}::${docId}`, data }
      },
      remove: (pluginId: string, docId: string) => {
        docs.delete(`${pluginId}::${docId}`)
        return { ok: true }
      },
      __docs: docs
    })
  }
})

const plugins = new Map<string, { id: string; enabled: boolean; searchable?: boolean }>()
vi.mock('../pluginStore', () => ({
  getPlugin: (id: string) => plugins.get(id),
  listEnabledPlugins: () => [...plugins.values()].filter((p) => p.enabled)
}))

import { setPluginSearchItems, listPluginSearchItems, clearPluginSearchItems } from '../pluginSearchIndex'
import { getLauncherDocStore } from '../docStore'

const docs = (getLauncherDocStore() as unknown as { __docs: Map<string, unknown> }).__docs

const VALID_ITEMS = [
  { title: 'Rust 入门笔记', subtitle: 'Trae KB', action: { type: 'open', payload: 'https://e.com/rust' } }
]

beforeEach(() => {
  plugins.clear()
  docs.clear()
})

describe('setPluginSearchItems', () => {
  it('searchable 且已启用的插件：条目清洗后持久化', () => {
    plugins.set('com.a', { id: 'com.a', enabled: true, searchable: true })
    expect(setPluginSearchItems('com.a', VALID_ITEMS)).toBe(true)
    const stored = docs.get('com.a::search-index') as { items: unknown[]; updatedAt: number }
    expect(stored.items).toEqual(VALID_ITEMS)
    expect(typeof stored.updatedAt).toBe('number')
  })

  it('未开通 searchable 的插件拒绝写入（fail-closed）', () => {
    plugins.set('com.b', { id: 'com.b', enabled: true })
    expect(setPluginSearchItems('com.b', VALID_ITEMS)).toBe(false)
    expect(docs.size).toBe(0)
  })

  it('未知插件 / 已停用插件拒绝写入', () => {
    plugins.set('com.c', { id: 'com.c', enabled: false, searchable: true })
    expect(setPluginSearchItems('com.ghost', VALID_ITEMS)).toBe(false)
    expect(setPluginSearchItems('com.c', VALID_ITEMS)).toBe(false)
    expect(docs.size).toBe(0)
  })
})

describe('listPluginSearchItems', () => {
  it('仅合并「已启用 + searchable」插件的条目并标记 pluginId', () => {
    plugins.set('com.a', { id: 'com.a', enabled: true, searchable: true })
    plugins.set('com.b', { id: 'com.b', enabled: true, searchable: true })
    plugins.set('com.off', { id: 'com.off', enabled: false, searchable: true })
    setPluginSearchItems('com.a', VALID_ITEMS)
    setPluginSearchItems('com.b', [
      { title: 'B 条目', action: { type: 'copy', payload: 'p' } }
    ])
    setPluginSearchItems('com.off', [{ title: 'OFF', action: { type: 'copy', payload: 'p' } }])

    const merged = listPluginSearchItems()
    expect(merged.map((i) => ({ pluginId: i.pluginId, title: i.title }))).toEqual([
      { pluginId: 'com.a', title: 'Rust 入门笔记' },
      { pluginId: 'com.b', title: 'B 条目' }
    ])
  })
})

describe('clearPluginSearchItems', () => {
  it('清除后不再返回', () => {
    plugins.set('com.a', { id: 'com.a', enabled: true, searchable: true })
    setPluginSearchItems('com.a', VALID_ITEMS)
    clearPluginSearchItems('com.a')
    expect(listPluginSearchItems()).toEqual([])
  })
})
