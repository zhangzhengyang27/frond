import { describe, it, expect } from 'vitest'
import { toRows, filterRows, sortRows, statsOf, type PluginRow } from '../pluginsCenterLogic'

const raw = [
  {
    id: 'com.b.zeta',
    name: 'Zeta 工具',
    version: '1.0.0',
    description: '最后一个安装',
    enabled: true,
    installedAt: 3
  },
  {
    id: 'com.a.alpha',
    name: 'Alpha 插件',
    version: '2.0.0',
    description: '市场同步与导入',
    enabled: false,
    installedAt: 1
  },
  {
    id: 'com.a.beta',
    name: 'Beta 市场',
    version: '0.9.0',
    description: '浏览市场索引',
    enabled: true,
    installedAt: 2
  }
]

describe('pluginsCenterLogic（独立插件中心页）', () => {
  it('toRows：从 InstalledPlugin 形状取渲染所需字段', () => {
    const rows = toRows(raw)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({
      id: 'com.b.zeta',
      name: 'Zeta 工具',
      version: '1.0.0',
      description: '最后一个安装',
      enabled: true
    })
  })
  it('filterRows：name/description/version 大小写不敏感子串；空查全量', () => {
    const rows = toRows(raw)
    expect(filterRows(rows, '')).toHaveLength(3)
    expect(filterRows(rows, '市场').map((r) => r.id)).toEqual(['com.a.alpha', 'com.a.beta'])
    expect(filterRows(rows, 'BETA').map((r) => r.id)).toEqual(['com.a.beta'])
    expect(filterRows(rows, '2.0').map((r) => r.id)).toEqual(['com.a.alpha'])
    expect(filterRows(rows, '不存在的词')).toEqual([])
  })
  it('sortRows：启用的在前，同组按名称中文序', () => {
    const rows = sortRows(toRows(raw))
    expect(rows.map((r) => r.id)).toEqual(['com.a.beta', 'com.b.zeta', 'com.a.alpha'])
  })
  it('statsOf：头部统计（已装/启用）', () => {
    expect(statsOf(toRows(raw as never))).toEqual({ total: 3, enabled: 2 })
    expect(statsOf([])).toEqual({ total: 0, enabled: 0 })
  })
  it('PluginRow 类型可用（编译期契约）', () => {
    const r: PluginRow = { id: 'x', name: 'x', version: '1', description: '', enabled: false }
    expect(r.enabled).toBe(false)
  })
})
