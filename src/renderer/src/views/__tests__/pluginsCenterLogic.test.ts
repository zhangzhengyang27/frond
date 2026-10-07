import { describe, it, expect } from 'vitest'
import {
  toRows,
  filterRows,
  sortRows,
  statsOf,
  originLabel,
  type PluginRow
} from '../pluginsCenterLogic'

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
    installedAt: 1,
    origin: { kind: 'market', ref: 'curated' },
    permissions: ['clipboard.write', 'net', 'clipboard.write']
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
  it('toRows：从 InstalledPlugin 形状取渲染所需字段（P-3 后含来源与权限标签）', () => {
    const rows = toRows(raw)
    expect(rows[0]).toEqual({
      id: 'com.b.zeta',
      name: 'Zeta 工具',
      version: '1.0.0',
      description: '最后一个安装',
      enabled: true,
      originKind: 'unknown',
      permissionLabels: []
    })
  })

  it('toRows：origin 映射 + 权限去重去未知（与主进程 fail-closed 同口径）', () => {
    const rows = toRows(raw)
    expect(rows[1]?.originKind).toBe('market')
    expect(rows[1]?.permissionLabels).toEqual(['写入剪贴板', '访问网络'])
    // 未知权限名不进标签（主进程读取时本就会剔除，这里兜底）
    const withUnknown = toRows([
      {
        id: 'x',
        name: 'x',
        version: '1',
        description: '',
        enabled: true,
        permissions: ['net', 'root.everything']
      }
    ])
    expect(withUnknown[0]?.permissionLabels).toEqual(['访问网络'])
  })

  it('originLabel：四类来源 + 未知兜底', () => {
    expect(originLabel('builtin')).toBe('内置')
    expect(originLabel('market')).toBe('市场')
    expect(originLabel('local')).toBe('本地导入')
    expect(originLabel('dev')).toBe('开发')
    expect(originLabel('unknown')).toBe('未知')
    expect(originLabel(undefined)).toBe('未知')
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
    const r: PluginRow = {
      id: 'x',
      name: 'x',
      version: '1',
      description: '',
      enabled: false,
      originKind: 'unknown',
      permissionLabels: []
    }
    expect(r.enabled).toBe(false)
  })
})
