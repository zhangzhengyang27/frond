import { describe, it, expect } from 'vitest'
import { mapAuthStatus, extractAndSortMeetings } from '../CalendarService'

/**
 * V4 批次4：日历授权状态映射（纯函数）。
 * 背景：EKAuthorizationStatus 的 authorized=3（不是 2）——曾因解析侧误按 2
 * 判断导致授权用户日历整体失效（代码审查 Critical 发现），此处固定语义。
 */
describe('mapAuthStatus（EKAuthorizationStatus → 语义）', () => {
  it('3 = authorized', () => {
    expect(mapAuthStatus(3)).toBe('authorized')
  })

  it('0 = notDetermined；未知值一律 notDetermined（fail-safe）', () => {
    expect(mapAuthStatus(0)).toBe('notDetermined')
    expect(mapAuthStatus(99)).toBe('notDetermined')
    expect(mapAuthStatus(-1)).toBe('notDetermined')
  })

  it('1 restricted / 2 denied = denied', () => {
    expect(mapAuthStatus(1)).toBe('denied')
    expect(mapAuthStatus(2)).toBe('denied')
  })
})

describe('extractAndSortMeetings', () => {
  const now = 1_789_000_000_000
  const ev = (start: number, end: number, allDay = false): { start: number; end: number; allDay: boolean } => ({
    start,
    end,
    allDay
  })

  it('过滤全天事件与已结束事件，按开始时间升序', () => {
    const meetings = extractAndSortMeetings(
      [ev(now + 7200_000, now + 7800_000), ev(now - 3600_000, now - 1800_000), ev(now + 3600_000, now + 4200_000, true)],
      now
    )
    expect(meetings).toHaveLength(1)
    expect(meetings[0].start).toBe(now + 7200_000)
  })

  it('空输入返回空数组', () => {
    expect(extractAndSortMeetings([], now)).toEqual([])
  })
})
