import { describe, it, expect } from 'vitest'
import { autoJoinDue, autoJoinKey, AUTO_JOIN_WINDOW_MS } from '../autoJoin'

/** V4 批次4-3：自动入会判定纯函数 */
const START = 1_789_000_000_000
const event = {
  title: '周会',
  startMs: START,
  meetingUrl: 'https://zoom.us/j/1'
}

describe('autoJoinDue', () => {
  it('开始后 1 分钟窗口内且未入过 → true', () => {
    expect(autoJoinDue(event, START + 1000, new Set())).toBe(true)
    expect(autoJoinDue(event, START + AUTO_JOIN_WINDOW_MS, new Set())).toBe(true)
  })

  it('未到开始时间 / 超过追认窗口 → false', () => {
    expect(autoJoinDue(event, START - 1000, new Set())).toBe(false)
    expect(autoJoinDue(event, START + AUTO_JOIN_WINDOW_MS + 1, new Set())).toBe(false)
  })

  it('已入过（按 startMs:title 去重）→ false', () => {
    const joined = new Set([autoJoinKey(event)])
    expect(autoJoinDue(event, START + 1000, joined)).toBe(false)
  })

  it('无入会链接 → false', () => {
    expect(autoJoinDue({ ...event, meetingUrl: null }, START + 1000, new Set())).toBe(false)
  })

  it('同标题不同场次不去重冲突', () => {
    const joined = new Set([autoJoinKey({ title: '周会', startMs: START + 3600_000, meetingUrl: 'x' })])
    expect(autoJoinDue(event, START + 1000, joined)).toBe(true)
  })
})
