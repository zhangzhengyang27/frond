// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PluginListPage from '../PluginListPage.vue'
import type { PluginListItem } from '@shared/plugin-protocol'

const base: PluginListItem = {
  title: 'A',
  icon: 'ri-plug-2',
  actions: [{ label: '复制', type: 'copy', payload: 'x' }]
}

function mountPage(items: PluginListItem[]) {
  return mount(PluginListPage, {
    props: { pluginId: 'p', items },
    global: {
      stubs: { CapsulePage: { template: '<div><slot /><slot name="detail" /></div>' } }
    }
  })
}

describe('PluginListPage 新字段渲染（spec 3.1/3.2/3.4）', () => {
  it('旧形状零回归：纯字符串 icon + string accessories 不出现组头/缩略图/tag', () => {
    const w = mountPage([{ ...base, accessories: ['1 KB'] }])
    expect(w.find('.plist-header').exists()).toBe(false)
    expect(w.find('.plist-thumb').exists()).toBe(false)
    expect(w.find('.plist-tag').exists()).toBe(false)
    expect(w.find('.plist-accessory').text()).toBe('1 KB')
  })
  it('相邻同名 section 聚合一个组头；不同名断开；无 section 打断', () => {
    const w = mountPage([
      { ...base, title: '1', section: '组A' },
      { ...base, title: '2', section: ' 组A ' }, // sanitize 后同名 → 不重复组头
      { ...base, title: '3', section: '组B' },
      { ...base, title: '4' }, // 无组 → 打断
      { ...base, title: '5', section: '组A' } // 再出现 → 新组头
    ])
    const headers = w.findAll('.plist-header')
    expect(headers.map((h) => h.text())).toEqual(['组A', '组B', '组A'])
  })
  it('tintColor 透传 AppIcon color；dataUrl 渲染 img.plist-thumb 且不渲染 AppIcon', () => {
    const w = mountPage([
      { ...base, icon: { value: 'ri-drop', tintColor: '#ff0000' } },
      { ...base, title: 'B', icon: { value: 'ri-drop', dataUrl: 'data:image/png;base64,AAA' } }
    ])
    const first = w.findAll('.plist-icon')[0]!
    // AppIcon color 落到内联 style（color）；tint 与默认 currentColor 不同即视为透传成功
    const styled = first.find('i, svg')
    expect(styled.exists()).toBe(true)
    expect(styled.attributes('style') ?? '').toContain('ff0000')
    const second = w.findAll('.plist-icon')[1]!
    expect(second.find('img.plist-thumb').attributes('src')).toBe('data:image/png;base64,AAA')
    expect(second.find('i, svg').exists()).toBe(false)
  })
  it('tag 徽章：tone class 映射；string 元素仍是 .plist-accessory', () => {
    const w = mountPage([
      { ...base, accessories: ['纯文本', { tag: 'AA', tone: 'success' }, { tag: 'X' }] }
    ])
    const tags = w.findAll('.plist-tag')
    expect(tags).toHaveLength(2)
    expect(tags[0]!.classes()).toContain('plist-tag--success')
    expect(tags[1]!.classes()).not.toContain('plist-tag--success')
  })
  it('组头不占选择位：条目 DOM 数等于 items 数，首个条目默认选中', () => {
    const w = mountPage([
      { ...base, title: '1', section: '组' },
      { ...base, title: '2', section: '组' }
    ])
    const items = w.findAll('.plist-item')
    expect(items).toHaveLength(2)
    expect(items[0]!.classes()).toContain('selected')
  })
})
