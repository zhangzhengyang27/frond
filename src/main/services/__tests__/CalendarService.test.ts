import { describe, it, expect } from 'vitest'
import { mapAuthStatus, extractAndSortMeetings, normalizeRawEvents } from '../CalendarService'

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
  const ev = (
    start: number,
    end: number,
    allDay = false
  ): { start: number; end: number; allDay: boolean } => ({
    start,
    end,
    allDay
  })

  it('过滤全天事件与已结束事件，按开始时间升序', () => {
    const meetings = extractAndSortMeetings(
      [
        ev(now + 7200_000, now + 7800_000),
        ev(now - 3600_000, now - 1800_000),
        ev(now + 3600_000, now + 4200_000, true)
      ],
      now
    )
    expect(meetings).toHaveLength(1)
    expect(meetings[0]!.start).toBe(now + 7200_000)
  })

  it('空输入返回空数组', () => {
    expect(extractAndSortMeetings([], now)).toEqual([])
  })
})

describe('normalizeRawEvents（JXA 双重序列化解包）', () => {
  // buildQueryScript 的 JXA 循环把每条事件先 JSON.stringify 成字符串再进外层 JSON，
  // 解一层后元素仍是字符串——不归一化则字段全 undefined，到 UI 就是 (无标题)+NaN。
  const inner = JSON.stringify({
    title: '周会',
    start: 100,
    end: 200,
    allDay: false,
    location: '',
    notes: '',
    url: ''
  })

  it('字符串元素解包成对象', () => {
    expect(normalizeRawEvents([inner])).toEqual([
      {
        title: '周会',
        start: 100,
        end: 200,
        allDay: false,
        location: '',
        notes: '',
        url: ''
      }
    ])
  })

  it('对象元素原样保留（兼容 JXA 端未来去掉内层序列化）', () => {
    const obj = { title: 't', start: 1, end: 2, allDay: true, location: '', notes: '', url: '' }
    expect(normalizeRawEvents([obj])).toEqual([obj])
  })

  it('混合数组与坏条目：可解析的留、解析不了和不合类型的丢，不抛', () => {
    expect(normalizeRawEvents([inner, '{broken', 42, null]).map((e) => e.title)).toEqual(['周会'])
  })

  it('空输入返回空数组', () => {
    expect(normalizeRawEvents([])).toEqual([])
  })
})
