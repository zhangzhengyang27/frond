import { describe, it, expect } from 'vitest'
import { shouldHideOnBlur } from '../pinLogic'

/**
 * P-1.3：胶囊窗失焦是否隐藏。
 *
 * 原先 window.ts 里是 `const pinned = false` 写死（注释写着「钉住能力预留」），
 * 于是「保持打开」根本没有可实现的位置。这里把判定抽成纯函数：
 * 不 import electron，所以能在 node 环境下直接单测。
 */

const base = { pinned: false, visible: true, suppressUntil: 0, now: 1000 }

describe('shouldHideOnBlur', () => {
  it('默认：可见且已过焦点抑制窗口 → 隐藏', () => {
    expect(shouldHideOnBlur(base)).toBe(true)
  })
  it('钉住时不隐藏（这就是 keep-open 的全部语义）', () => {
    expect(shouldHideOnBlur({ ...base, pinned: true })).toBe(false)
  })
  it('show() 后焦点未落定的抑制窗口内不隐藏（防「闪一下就消失」）', () => {
    expect(shouldHideOnBlur({ ...base, suppressUntil: 1200 })).toBe(false)
    // 抑制期刚过就恢复隐藏
    expect(shouldHideOnBlur({ ...base, suppressUntil: 1000 })).toBe(true)
  })
  it('窗口本就不可见时不触发隐藏', () => {
    expect(shouldHideOnBlur({ ...base, visible: false })).toBe(false)
  })
})
