import { describe, it, expect } from 'vitest'
import { dayLabel, groupSchedule, timeRange, type ScheduleEvent } from '../scheduleLogic'

/** V4 批次4-2：My Schedule 分组纯函数 */
const NOW = new Date(2026, 8, 17, 15, 0) // 2026-09-17 周四 15:00

const ev = (start: Date, over: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
  title: 'e',
  startMs: start.getTime(),
  endMs: start.getTime() + 3600 * 1000,
  isAllDay: false,
  meeting: null,
  ...over
})

describe('dayLabel', () => {
  it('今天 / 明天 / 周X 日期', () => {
    expect(dayLabel(new Date(2026, 8, 17).getTime(), NOW)).toBe('今天')
    expect(dayLabel(new Date(2026, 8, 18).getTime(), NOW)).toBe('明天')
    expect(dayLabel(new Date(2026, 8, 21).getTime(), NOW)).toBe('周一 09/21')
  })
})

describe('groupSchedule', () => {
  it('按天分组且全天事件置顶', () => {
    const groups = groupSchedule(
      [
        ev(new Date(2026, 8, 17, 16, 0), { title: 'b' }),
        ev(new Date(2026, 8, 17, 9, 0), { title: 'a' }),
        ev(new Date(2026, 8, 17, 0, 0), { title: 'all', isAllDay: true }),
        ev(new Date(2026, 8, 19, 10, 0), { title: 'c' })
      ],
      NOW
    )
    expect(groups.map((g) => g.label)).toEqual(['今天', '周六 09/19'])
    expect(groups[0].items.map((i) => i.title)).toEqual(['all', 'a', 'b'])
  })

  it('早于今天零点的历史事件不出现', () => {
    const groups = groupSchedule([ev(new Date(2026, 8, 16, 9, 0))], NOW)
    expect(groups).toEqual([])
  })
})

describe('timeRange', () => {
  it('全天 / 普通事件', () => {
    expect(timeRange({ ...ev(new Date(2026, 8, 17)), isAllDay: true })).toBe('全天')
    expect(timeRange(ev(new Date(2026, 8, 17, 9, 5)))).toBe('09:05 – 10:05')
  })
})
