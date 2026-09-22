import { describe, it, expect } from 'vitest'
import { sanitizePluginSearchItems, PLUGIN_MAX_SEARCH_ITEMS } from '../plugin-protocol'

/**
 * 插件搜索条目清洗（#5 插件双通道）：插件（第三方代码）提交的可搜索条目集，
 * 与 permissions / arguments 同一 fail-closed 哲学——非法项剔除、数量封顶，
 * 保证根搜索合并层拿到的永远合法。
 */
describe('sanitizePluginSearchItems', () => {
  it('合法条目保留（copy/open/callback 三种动作）', () => {
    const items = sanitizePluginSearchItems([
      {
        title: 'Rust 入门笔记',
        subtitle: ' Trae Work KB ',
        icon: 'book-2-line',
        keywords: ['rust', 'Trae'],
        badge: '笔记',
        action: { type: 'open', payload: 'https://example.com/rust' }
      },
      { title: '部署密钥', action: { type: 'copy', payload: 'secret' } },
      { title: '重新同步', action: { type: 'callback', payload: 'sync' } }
    ])
    expect(items).toHaveLength(3)
    expect(items[0]).toEqual({
      title: 'Rust 入门笔记',
      subtitle: 'Trae Work KB',
      icon: 'book-2-line',
      keywords: ['rust', 'Trae'],
      badge: '笔记',
      action: { type: 'open', payload: 'https://example.com/rust' }
    })
    expect(items[1].action).toEqual({ type: 'copy', payload: 'secret' })
  })

  it('非数组输入返回空数组', () => {
    expect(sanitizePluginSearchItems('x')).toEqual([])
    expect(sanitizePluginSearchItems(null)).toEqual([])
  })

  it('title 必填：非法项剔除（非字符串 / 空）；超长头部截断到 120', () => {
    const items = sanitizePluginSearchItems([
      { subtitle: 'no title' },
      { title: '   ' },
      42,
      { title: 'a'.repeat(130) + 'tail', action: { type: 'copy', payload: 'p' } }
    ])
    expect(items).toHaveLength(1)
    expect(items[0].title.length).toBeLessThanOrEqual(120)
    expect(items[0].title.startsWith('aaa')).toBe(true)
  })

  it('action 非法 → 整条剔除（fail-closed：动作必须有类型和非空 payload，不猜测默认动作）', () => {
    const items = sanitizePluginSearchItems([
      { title: 'a', action: { type: 'sudo', payload: 'x' } },
      { title: 'b', action: { type: 'open' } },
      { title: 'c' },
      { title: 'd', action: 'copy' }
    ])
    expect(items).toEqual([])
  })

  it('keywords 清洗：trim / 去空 / 去重 / 封顶 8', () => {
    const items = sanitizePluginSearchItems([
      {
        title: 'x',
        action: { type: 'copy', payload: 'p' },
        keywords: [' a ', '', 'a', 42, 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
      }
    ])
    expect(items[0].keywords).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
  })

  it(`数量封顶 300 条`, () => {
    const many = Array.from({ length: 400 }, (_, i) => ({
      title: `t${i}`,
      action: { type: 'copy', payload: String(i) }
    }))
    expect(sanitizePluginSearchItems(many)).toHaveLength(PLUGIN_MAX_SEARCH_ITEMS)
    expect(PLUGIN_MAX_SEARCH_ITEMS).toBe(300)
  })

  it('subtitle / icon / badge 非字符串剔除字段', () => {
    const items = sanitizePluginSearchItems([
      { title: 'x', subtitle: 42, icon: true, badge: {}, action: { type: 'copy', payload: 'p' } }
    ])
    expect(items[0]).toEqual({ title: 'x', action: { type: 'copy', payload: 'p' } })
  })
})
