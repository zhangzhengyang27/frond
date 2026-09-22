import { describe, it, expect } from 'vitest'
import { cronError, cronMatches, parseCron } from '../cron'

/**
 * 极简 cron（P-4④）。核心判据是 fail-closed：
 * 写错的表达式宁可不跑，也不能被解释成「每分钟都跑」。
 */
const at = (y: number, mo: number, d: number, h: number, mi: number): Date =>
  new Date(y, mo - 1, d, h, mi, 0, 0)

function matches(expr: string, date: Date): boolean {
  const spec = parseCron(expr)
  expect(spec, `表达式应当合法：${expr}`).not.toBeNull()
  return cronMatches(spec!, date)
}

describe('parseCron / cronMatches', () => {
  it('* * * * * 每分钟', () => {
    expect(matches('* * * * *', at(2026, 9, 20, 3, 17))).toBe(true)
  })

  it('精确分与时', () => {
    expect(matches('30 9 * * *', at(2026, 9, 20, 9, 30))).toBe(true)
    expect(matches('30 9 * * *', at(2026, 9, 20, 9, 31))).toBe(false)
    expect(matches('30 9 * * *', at(2026, 9, 20, 10, 30))).toBe(false)
  })

  it('步进 */15 与 5-45/10', () => {
    for (const m of [0, 15, 30, 45]) expect(matches('*/15 * * * *', at(2026, 1, 1, 0, m))).toBe(true)
    expect(matches('*/15 * * * *', at(2026, 1, 1, 0, 7))).toBe(false)
    expect(matches('5-45/10 * * * *', at(2026, 1, 1, 0, 25))).toBe(true)
    expect(matches('5-45/10 * * * *', at(2026, 1, 1, 0, 26))).toBe(false)
  })

  it('列表与区间', () => {
    expect(matches('1,15 * * * *', at(2026, 1, 1, 0, 15))).toBe(true)
    expect(matches('1,15 * * * *', at(2026, 1, 1, 0, 16))).toBe(false)
    expect(matches('* 10-12 * * *', at(2026, 1, 1, 11, 5))).toBe(true)
    expect(matches('* 10-12 * * *', at(2026, 1, 1, 13, 5))).toBe(false)
  })

  it('每月 1 号 00:00 与 1 月限定', () => {
    expect(matches('0 0 1 1 *', at(2026, 1, 1, 0, 0))).toBe(true)
    expect(matches('0 0 1 1 *', at(2026, 2, 1, 0, 0))).toBe(false)
    expect(matches('0 0 1 * *', at(2026, 7, 1, 0, 0))).toBe(true)
    expect(matches('0 0 1 * *', at(2026, 7, 2, 0, 0))).toBe(false)
  })

  it('周日=0：每周一 08:00', () => {
    // 2026-09-21 是周一
    expect(matches('0 8 * * 1', at(2026, 9, 21, 8, 0))).toBe(true)
    expect(matches('0 8 * * 1', at(2026, 9, 20, 8, 0))).toBe(false)
    // 2026-09-20 是周日 → dow 0
    expect(matches('0 8 * * 0', at(2026, 9, 20, 8, 0))).toBe(true)
  })

  it('日与周同时受限时取并集（cron 惯例，取交集几乎永不为真）', () => {
    // 每月 1 号 或 每周一，00:00
    const firstOfMonth = at(2026, 9, 1, 0, 0) // 周二
    const someMonday = at(2026, 9, 7, 0, 0) // 周一，不是 1 号
    const neither = at(2026, 9, 8, 0, 0) // 周二，不是 1 号
    expect(matches('0 0 1 * 1', firstOfMonth)).toBe(true)
    expect(matches('0 0 1 * 1', someMonday)).toBe(true)
    expect(matches('0 0 1 * 1', neither)).toBe(false)
  })

  it('非法表达式一律 null，不猜', () => {
    for (const bad of [
      '',
      '   ',
      '* * * *',
      '* * * * * *',
      '60 * * * *',
      '* 24 * * *',
      '0 0 32 * *',
      '0 0 1 13 *',
      '0 0 1 1 7',
      '*/0 * * * *',
      '*/a * * * *',
      '45-10 * * * *',
      'a * * * *',
      '1,,2 * * * *'
    ]) {
      expect(parseCron(bad), `应当拒绝：${JSON.stringify(bad)}`).toBeNull()
    }
  })

  it('cronError 说得出人话', () => {
    expect(cronError('* * * * *')).toBeNull()
    expect(cronError('30 9 * *')).toContain('4 个')
    expect(cronError('70 * * * *')).toContain('超出范围')
  })

  it('解析结果保留规范化后的原串（持久化回显不丢用户写法）', () => {
    expect(parseCron('  30    9 * * *  ')?.source).toBe('30 9 * * *')
  })
})
