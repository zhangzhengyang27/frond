import { describe, it, expect } from 'vitest'
import { DetailToken, detailKind } from '../detailLogic'

/**
 * P-1.5：详情面板的异步加载判定。
 *
 * 原状是 `typeof cmd.detail === 'function' ? null : cmd.detail`——函数型 detail
 * 被直接丢弃，且全仓零个函数型提供方，所以「接线」单独存在就是死代码。
 * 这里把两件事拆成可单测的纯件：detail 的三态判别、以及「只认最后一次选中」的过期判定。
 */

describe('detailKind', () => {
  it('缺省 / 对象 / 函数 三态分得清', () => {
    expect(detailKind(undefined)).toBe('none')
    expect(detailKind(null)).toBe('none')
    expect(detailKind({ content: 'x' })).toBe('static')
    expect(detailKind(() => Promise.resolve(null))).toBe('async')
  })
})

describe('DetailToken', () => {
  it('单次加载：begin 后的 token 就是当前值', () => {
    const t = new DetailToken()
    const first = t.begin()
    expect(t.isCurrent(first)).toBe(true)
  })
  it('后发起的加载作废先发起的（快速连按 ↓ 时旧响应不得盖掉新选中项）', () => {
    const t = new DetailToken()
    const slow = t.begin()
    const fast = t.begin()
    expect(t.isCurrent(slow)).toBe(false)
    expect(t.isCurrent(fast)).toBe(true)
  })
  it('回退到更早的选中项也算新的一次加载', () => {
    const t = new DetailToken()
    const a = t.begin()
    t.begin()
    expect(t.isCurrent(a)).toBe(false)
    expect(t.isCurrent(t.begin())).toBe(true)
  })
})
