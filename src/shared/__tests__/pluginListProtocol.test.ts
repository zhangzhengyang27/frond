import { describe, it, expect, vi } from 'vitest'
import {
  sanitizePluginListIcon,
  sanitizePluginSection,
  sanitizePluginAccessories,
  sanitizePluginHudTitle,
  parsePluginView,
  PLUGIN_MAX_ICON_DATAURL
} from '../plugin-protocol'

describe('sanitizePluginListIcon', () => {
  it('纯字符串向后兼容：trim + 截 40 字符', () => {
    expect(sanitizePluginListIcon('ri-plug-2')).toBe('ri-plug-2')
    expect(sanitizePluginListIcon('  ri-git-branch  ')).toBe('ri-git-branch')
    expect(sanitizePluginListIcon('x'.repeat(50))).toBe('x'.repeat(40))
  })
  it('对象：value 必填非空，其余字段剥离保留', () => {
    expect(sanitizePluginListIcon({ value: 'ri-git-branch', tintColor: '#ff0' })).toEqual({
      value: 'ri-git-branch',
      tintColor: '#ff0'
    })
    expect(sanitizePluginListIcon({ value: '  ri-plug-2 ' })).toEqual({ value: 'ri-plug-2' })
  })
  it('tintColor 仅 #rgb/#rrggbb，非法剥除', () => {
    expect(sanitizePluginListIcon({ value: 'a', tintColor: 'red' })).toEqual({ value: 'a' })
    expect(sanitizePluginListIcon({ value: 'a', tintColor: '#ffff' })).toEqual({ value: 'a' })
    expect(sanitizePluginListIcon({ value: 'a', tintColor: '#A1B2C3' })).toEqual({
      value: 'a',
      tintColor: '#A1B2C3'
    })
  })
  it(`dataUrl：合法前缀且 ≤ ${PLUGIN_MAX_ICON_DATAURL} 保留；压线接受、超限剥除但保留 value/tintColor`, () => {
    const ok = 'data:image/png;base64,' + 'A'.repeat(100)
    expect(sanitizePluginListIcon({ value: 'a', dataUrl: ok })).toEqual({ value: 'a', dataUrl: ok })
    const edge = 'data:image/png;base64,' + 'A'.repeat(PLUGIN_MAX_ICON_DATAURL - 22) // 总长恰 65536
    const edgeOut = sanitizePluginListIcon({ value: 'a', dataUrl: edge })
    expect(typeof edgeOut === 'object' && edgeOut?.dataUrl).toBe(edge)
    const over = edge + 'X'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(sanitizePluginListIcon({ value: 'a', tintColor: '#fff', dataUrl: over })).toEqual({
      value: 'a',
      tintColor: '#fff'
    })
    // spec 3.1/§9：超限剥除必须 console 警告（插件作者可诊断），压线不警告
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('dataUrl')
    warnSpy.mockRestore()
  })
  it('dataUrl 前缀错 / 非字符串 / value 缺失 → 整体 undefined', () => {
    expect(sanitizePluginListIcon({ value: 'a', dataUrl: 'http://x/y.png' })).toEqual({ value: 'a' })
    expect(sanitizePluginListIcon({ dataUrl: 'data:image/png;base64,AA' })).toBeUndefined()
    expect(sanitizePluginListIcon(42)).toBeUndefined()
  })
})

describe('sanitizePluginSection', () => {
  it('trim + 截 40，空串/非字符串 → undefined', () => {
    expect(sanitizePluginSection('  结果 ')).toBe('结果')
    expect(sanitizePluginSection('s'.repeat(50))).toBe('s'.repeat(40))
    expect(sanitizePluginSection('   ')).toBeUndefined()
    expect(sanitizePluginSection(7)).toBeUndefined()
  })
})

describe('sanitizePluginAccessories', () => {
  it('纯字符串元素向后兼容（trim、截 40、空剔除、≤3）', () => {
    expect(sanitizePluginAccessories([' AA ', ''])).toEqual(['AA'])
    expect(sanitizePluginAccessories(['1', '2', '3', '4'])).toEqual(['1', '2', '3'])
  })
  it('tag 对象：截 12、tone 白名单外剥 tone、非字符串剔除', () => {
    expect(sanitizePluginAccessories([{ tag: ' AAAA ' }])).toEqual([{ tag: 'AAAA' }])
    expect(sanitizePluginAccessories([{ tag: 'AAA', tone: 'nope' }])).toEqual([{ tag: 'AAA' }])
    expect(sanitizePluginAccessories([{ tag: 'AA', tone: 'danger' }])).toEqual([
      { tag: 'AA', tone: 'danger' }
    ])
    expect(sanitizePluginAccessories([{ tone: 'danger' }, 5, 'ok'])).toEqual(['ok'])
  })
  it('非数组 → undefined；空数组 → undefined', () => {
    expect(sanitizePluginAccessories('x')).toBeUndefined()
    expect(sanitizePluginAccessories([])).toBeUndefined()
  })
})

describe('sanitizePluginHudTitle', () => {
  it('trim + 截 80；空 → null', () => {
    expect(sanitizePluginHudTitle(' 已复制 ')).toBe('已复制')
    expect(sanitizePluginHudTitle('h'.repeat(100))).toBe('h'.repeat(80))
    expect(sanitizePluginHudTitle('  ')).toBeNull()
  })
})

describe('parsePluginView section 注入（spec 3.2）', () => {
  it('sections 组名注入条目 section 字段，顺序保持', () => {
    const view = {
      $t: 'list',
      sections: [
        { title: 'SHA256', items: [{ title: 'a', actions: [] }] },
        { title: 'SHA1', items: [{ title: 'b', actions: [] }] }
      ]
    }
    const out = parsePluginView(view)
    expect(out.map((i) => i.section)).toEqual(['SHA256', 'SHA1'])
    expect(out.map((i) => i.title)).toEqual(['a', 'b'])
  })
  it('sanitizeViewListItem 接收条目自带 section / icon 对象 / tag 徽章', () => {
    const out = parsePluginView({
      $t: 'list',
      items: [
        {
          title: 'x',
          section: '组',
          icon: { value: 'ri-plug-2', tintColor: '#0f0' },
          accessories: [{ tag: 'OK', tone: 'success' }],
          actions: []
        }
      ]
    })
    expect(out[0]?.section).toBe('组')
    expect(out[0]?.icon).toEqual({ value: 'ri-plug-2', tintColor: '#0f0' })
    expect(out[0]?.accessories).toEqual([{ tag: 'OK', tone: 'success' }])
  })
})
