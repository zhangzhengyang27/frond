import { describe, it, expect } from 'vitest'
import { isTimestamp, tsToDate, relative, convert } from './lib.js'

describe('timestamp lib', () => {
  it('秒/毫秒判定与解读', () => {
    expect(isTimestamp('1700000000')).toBe(true)
    expect(isTimestamp('1700000000000')).toBe(true)
    expect(isTimestamp('123')).toBe(false)
    expect(isTimestamp('17000000000000')).toBe(false)
    expect(tsToDate('0').date.toISOString()).toBe('1970-01-01T00:00:00.000Z')
    expect(tsToDate('1700000000').unit).toBe('sec')
    expect(tsToDate('1700000000000').unit).toBe('ms')
  })
  it('relative 相对时间', () => {
    const now = Date.now()
    expect(relative(now - 65_000, now)).toBe('1 分钟前')
    expect(relative(now + 3_600_000, now)).toBe('1 小时后')
    expect(relative(now - 86_400_000, now)).toBe('1 天前')
  })
  it('convert：时间戳输入与日期输入双方向', () => {
    expect(convert('1700000000')).toHaveLength(3) // 本地/UTC/相对
    expect(convert('1700000000')[0].accessories[0].tag).toBe('秒')
    expect(convert('2024-01-01')[0].section).toBe('时间戳')
    expect(convert('garbage')).toBeNull()
  })
})
