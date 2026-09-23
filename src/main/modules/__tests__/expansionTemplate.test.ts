import { describe, it, expect } from 'vitest'
import { renderExpansionWithCursor } from '../expansionTemplate'

/**
 * `{cursor}` 的定位语义（V4 P1-6）。
 *
 * 消费方（textExpansion）是这么用它的：`[...payload].length - cursorIndex` = 注入完要按几次
 * 左方向键。所以 cursorIndex 必须是**码点**下标，且算的是「渲染后」文本里的位置——
 * 占位符会把 `{date}` 换成 10 个字符，按渲染前的位置回删会把光标删进正文里。
 */
const ctx = {
  now: new Date(2026, 8, 23, 9, 5), // 2026-09-23 09:05
  clipboardText: () => '剪贴板内容'
}

describe('renderExpansionWithCursor', () => {
  it('没有 {cursor} → cursorIndex 为 null，文本照常渲染', () => {
    const r = renderExpansionWithCursor('今天 {date}', ctx)
    expect(r).toEqual({ text: '今天 2026-09-23', cursorIndex: null })
  })

  it('索引按渲染后的文本算（占位符换完才是光标该落的地方）', () => {
    const r = renderExpansionWithCursor('{date} {cursor}', ctx)
    expect(r.text).toBe('2026-09-23 ')
    expect(r.cursorIndex).toBe([...r.text].length)
  })

  it('emoji 按码点计，不按 UTF-16 单元（否则回删会多按一次）', () => {
    const r = renderExpansionWithCursor('🎯 {cursor}结尾', ctx)
    expect(r.text).toBe('🎯 结尾')
    // '🎯 ' 是 3 个 UTF-16 单元、2 个码点：这里要的是 2
    expect(r.cursorIndex).toBe(2)
    expect(r.cursorIndex).toBe([...'🎯 '].length)
  })

  it('剪贴板与多个 {cursor}：{clipboard} 求值同一份，第二个 {cursor} 当文本吃掉', () => {
    const r = renderExpansionWithCursor('{clipboard}{cursor}x{cursor}', ctx)
    expect(r.text).toBe('剪贴板内容x{cursor}')
    expect(r.cursorIndex).toBe(5)
  })
})
