import { describe, it, expect } from 'vitest'
import {
  parseDateOffset,
  shiftDate,
  splitFormatOffset,
  renderExpansionTemplate,
  renderExpansionWithCursor,
  type ExpansionTemplateContext
} from '../expansionTemplate'

const NOON = new Date(2026, 0, 31, 12, 0, 0) // 2026-01-31 12:00（月末，验月回滚）
const ctx: ExpansionTemplateContext = { now: NOON, clipboardText: () => '' }

describe('parseDateOffset / shiftDate（P-3 日期算术）', () => {
  it('表达式解析：+7d / -30 m / 非法 null', () => {
    expect(parseDateOffset('+7d')).toEqual({ amount: 7, unit: 'd' })
    expect(parseDateOffset('-30 m')).toEqual({ amount: -30, unit: 'm' })
    expect(parseDateOffset('7d')).toBeNull()
    expect(parseDateOffset('+1x')).toBeNull()
  })

  it('d/w/h/m 直加', () => {
    expect(shiftDate(NOON, 7, 'd').getDate()).toBe(7)
    expect(shiftDate(NOON, 1, 'w').getDate()).toBe(7)
    const plus30m = shiftDate(NOON, 30, 'm')
    expect(plus30m.getHours()).toBe(12)
    expect(plus30m.getMinutes()).toBe(30)
    expect(shiftDate(NOON, 1, 'y').getFullYear()).toBe(2027)
  })

  it('M 月末回滚走 JS Date 语义（1月31 +1M → 3月3）', () => {
    const plusMonth = shiftDate(NOON, 1, 'M')
    expect(plusMonth.getMonth()).toBe(2)
    expect(plusMonth.getDate()).toBe(3)
  })
})

describe('splitFormatOffset', () => {
  it('剥尾部偏移；无空白不误吞格式 token（HH:mm 结尾的 m）', () => {
    expect(splitFormatOffset('YYYY-MM-DD +7d')).toEqual({
      format: 'YYYY-MM-DD',
      offset: { amount: 7, unit: 'd' }
    })
    expect(splitFormatOffset('HH:mm')).toEqual({ format: 'HH:mm', offset: null })
    expect(splitFormatOffset('HH:mm +30m')).toEqual({
      format: 'HH:mm',
      offset: { amount: 30, unit: 'm' }
    })
  })
})

describe('renderExpansionTemplate 日期算术（P-3）', () => {
  it('{date +1d} / {date -1w} / {time +30m} / {time:HH:mm -1h}', () => {
    expect(renderExpansionTemplate('{date +1d}', ctx)).toBe('2026-02-01')
    expect(renderExpansionTemplate('{date -1w}', ctx)).toBe('2026-01-24')
    expect(renderExpansionTemplate('{time +30m}', ctx)).toBe('12:30')
    expect(renderExpansionTemplate('{time:HH:mm -1h}', ctx)).toBe('11:00')
  })

  it('带格式的算术：{date:YYYY年MM月DD日 +1M} 走月末回滚', () => {
    expect(renderExpansionTemplate('{date:YYYY年MM月DD日 +1M}', ctx)).toBe('2026年03月03日')
  })

  it('非法偏移表达式原样保留字面（不吞用户文本）', () => {
    expect(renderExpansionTemplate('{date +1x}', ctx)).toBe('{date +1x}')
    // 无空白时偏移不算偏移，格式串原样喂给 formatDate
    expect(renderExpansionTemplate('{date:YYYY+1d}', ctx)).toBe('2026+1d')
  })

  it('与 {cursor} 切半渲染协同：光标位 = 前半（含偏移渲染）的码点长度', () => {
    const r = renderExpansionWithCursor('{date +1d} {cursor} tail', ctx)
    expect(r.text).toBe('2026-02-01  tail')
    expect(r.cursorIndex).toBe(11)
  })
})
