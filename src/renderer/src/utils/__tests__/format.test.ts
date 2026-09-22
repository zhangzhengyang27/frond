import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatDuration,
  formatClock,
  formatClockWithSeconds,
  formatSmartDate,
  formatShortDate,
  formatRelativeDay,
  formatDateTime,
  formatCountdown
} from '../format'

/**
 * 录屏域统一的时长格式化（原 6 处各自为政的 formatTime/formatDuration 收敛）：
 * 有小时 → "HH:MM:SS"，否则 → "MM:SS"；非法输入回退 "00:00"。
 */
describe('formatDuration', () => {
  it('不足一分钟', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(5)).toBe('00:05')
    expect(formatDuration(59)).toBe('00:59')
  })

  it('分钟与小时', () => {
    expect(formatDuration(60)).toBe('01:00')
    expect(formatDuration(75)).toBe('01:15')
    expect(formatDuration(3600)).toBe('01:00:00')
    expect(formatDuration(3675)).toBe('01:01:15')
  })

  it('小数秒向下取整', () => {
    expect(formatDuration(59.9)).toBe('00:59')
    expect(formatDuration(5.4)).toBe('00:05')
  })

  it('非法输入回退 00:00（NaN / Infinity / 负数）', () => {
    expect(formatDuration(Number.NaN)).toBe('00:00')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('00:00')
    expect(formatDuration(-3)).toBe('00:00')
  })
})

// ─── 时间戳格式化（原 11 处 formatTime 重复实现的收敛）───
// 用固定时区无关的本地时间构造；"今天"由 fake timers 控制
describe('时间戳格式化', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // 2026-09-11 14:05:09 本地时间
  const T = new Date(2026, 8, 11, 14, 5, 9).getTime()

  it('formatClock → HH:mm', () => {
    expect(formatClock(T)).toBe('14:05')
    expect(formatClock(new Date(2026, 8, 11, 3, 5).getTime())).toBe('03:05')
  })

  it('formatClockWithSeconds → HH:mm:ss', () => {
    expect(formatClockWithSeconds(T)).toBe('14:05:09')
  })

  it('formatDateTime → YYYY-MM-DD HH:mm', () => {
    expect(formatDateTime(T)).toBe('2026-09-11 14:05')
    expect(formatDateTime(new Date(2026, 0, 3, 8, 5).getTime())).toBe('2026-01-03 08:05')
  })

  it('formatSmartDate：今天 → HH:mm，否则 → MM/DD（补零）', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 20, 0))
    expect(formatSmartDate(T)).toBe('14:05')
    expect(formatSmartDate(new Date(2026, 8, 2, 9, 7).getTime())).toBe('09/02')
    expect(formatSmartDate(new Date(2025, 8, 11, 9, 7).getTime())).toBe('09/11')
  })

  it('formatShortDate：今天 → HH:mm，否则 → M/D（不补零）', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 20, 0))
    expect(formatShortDate(T)).toBe('14:05')
    expect(formatShortDate(new Date(2026, 8, 2, 9, 7).getTime())).toBe('9/2')
  })

  it('formatRelativeDay：今天/明天 前缀 + HH:mm，更远 → M月D日 HH:mm', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 8, 0))
    expect(formatRelativeDay(T)).toBe('今天 14:05')
    expect(formatRelativeDay(new Date(2026, 8, 12, 9, 30).getTime())).toBe('明天 09:30')
    expect(formatRelativeDay(new Date(2026, 8, 15, 9, 30).getTime())).toBe('9月15日 09:30')
  })

  it('formatCountdown → MM:SS，分钟位不封顶（125:00），非法回退 00:00', () => {
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(65)).toBe('01:05')
    expect(formatCountdown(125 * 60)).toBe('125:00')
    expect(formatCountdown(Number.NaN)).toBe('00:00')
    expect(formatCountdown(-1)).toBe('00:00')
  })
})
