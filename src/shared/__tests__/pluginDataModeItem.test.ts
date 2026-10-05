import { describe, it, expect } from 'vitest'
import { sanitizeDataModeListItem } from '../plugin-protocol'

const baseItem = {
  title: '结果',
  actions: [{ label: '复制', type: 'copy', payload: 'x' }]
}

describe('sanitizeDataModeListItem', () => {
  it('向后兼容：旧形状条目字段逐项等价清洗', () => {
    const out = sanitizeDataModeListItem(
      {
        ...baseItem,
        subtitle: '副标题',
        icon: 'ri-plug-2',
        accessories: ['1 KB'],
        detail: '正文',
        detailFormat: 'markdown'
      },
      { reactMode: false }
    )
    expect(out).toEqual({
      title: '结果',
      subtitle: '副标题',
      icon: 'ri-plug-2',
      accessories: ['1 KB'],
      detail: '正文',
      detailFormat: 'markdown',
      actions: [{ label: '复制', type: 'copy', payload: 'x' }]
    })
  })
  it('null 条件与 runtime 现行整批拒绝一致：非 object / title 非 string / actions 非数组', () => {
    expect(sanitizeDataModeListItem(null, { reactMode: false })).toBeNull()
    expect(sanitizeDataModeListItem({ actions: [] }, { reactMode: false })).toBeNull()
    expect(sanitizeDataModeListItem({ title: 't', actions: 'x' }, { reactMode: false })).toBeNull()
  })
  it('新字段：icon 对象 / tag 徽章 / section 透传清洗', () => {
    const out = sanitizeDataModeListItem(
      {
        ...baseItem,
        icon: { value: 'ri-plug-2', tintColor: '#f00' },
        accessories: [{ tag: 'AA', tone: 'success' }],
        section: ' 分组一 '
      },
      { reactMode: false }
    )
    expect(out?.icon).toEqual({ value: 'ri-plug-2', tintColor: '#f00' })
    expect(out?.accessories).toEqual([{ tag: 'AA', tone: 'success' }])
    expect(out?.section).toBe('分组一')
  })
  it('data 模式不透传 callbackId；react 模式透传', () => {
    const item = { ...baseItem, actions: [{ label: 'a', type: 'callback', callbackId: 'cb1' }] }
    expect(
      sanitizeDataModeListItem(item, { reactMode: false })?.actions[0]?.callbackId
    ).toBeUndefined()
    expect(sanitizeDataModeListItem(item, { reactMode: true })?.actions[0]?.callbackId).toBe('cb1')
  })
  it('限额钉子：title 200 / subtitle 300 / detail 5000 / actions 10 / accessories 3', () => {
    const out = sanitizeDataModeListItem(
      {
        title: 't'.repeat(300),
        subtitle: 's'.repeat(400),
        detail: 'd'.repeat(6000),
        accessories: ['1', '2', '3', '4'],
        actions: Array.from({ length: 12 }, (_, i) => ({
          label: `a${i}`,
          type: 'copy',
          payload: 'p'
        }))
      },
      { reactMode: false }
    )
    expect(out?.title.length).toBe(200)
    expect(out?.subtitle?.length).toBe(300)
    expect(out?.detail?.length).toBe(5000)
    expect(out?.accessories?.length).toBe(3)
    expect(out?.actions.length).toBe(10)
  })
})
