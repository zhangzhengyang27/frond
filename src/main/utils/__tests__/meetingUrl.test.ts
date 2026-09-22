import { describe, it, expect } from 'vitest'
import { extractMeetingLink } from '../meetingUrl'

/**
 * V4 P0-1 批次4：会议链接提取（纯函数）。
 * 字段优先级 URL > 位置 > 备注；服务商按优先级；全未命中回退通用 http(s)。
 */
describe('extractMeetingLink', () => {
  it('zoom 链接（URL 字段）', () => {
    const r = extractMeetingLink({ url: 'https://zoom.us/j/1234567890?pwd=abc' })
    expect(r?.provider).toBe('zoom')
    expect(r?.url).toBe('https://zoom.us/j/1234567890?pwd=abc')
  })

  it('位置字段里的 teams 链接', () => {
    const r = extractMeetingLink({ location: 'https://teams.microsoft.com/l/meetup-join/19:abc' })
    expect(r?.provider).toBe('teams')
  })

  it('备注字段里的 meet 链接（优先级低于前两字段）', () => {
    const r = extractMeetingLink({
      notes: '周会\nhttps://meet.google.com/abc-defg-hij\n请准时'
    })
    expect(r?.provider).toBe('meet')
    expect(r?.url).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('zoommtg 客户端 scheme', () => {
    const r = extractMeetingLink({ location: 'zoommtg://zoom.us/join?action=join&confno=123' })
    expect(r?.provider).toBe('zoom')
  })

  it('服务商未命中回退通用 http(s) 链接', () => {
    const r = extractMeetingLink({ location: 'https://example.com/room/1' })
    expect(r?.provider).toBe('generic')
    expect(r?.url).toBe('https://example.com/room/1')
  })

  it('字段优先级：URL 命中后不再看备注', () => {
    const r = extractMeetingLink({
      url: 'https://zoom.us/j/1',
      notes: 'https://meet.google.com/xyz'
    })
    expect(r?.provider).toBe('zoom')
  })

  it('无链接返回 null', () => {
    expect(extractMeetingLink({ location: '会议室 3F', notes: '线下会' })).toBeNull()
    expect(extractMeetingLink({})).toBeNull()
  })

  it('结尾标点被剥掉', () => {
    const r = extractMeetingLink({ notes: 'join https://meet.google.com/abc-defg-hij.' })
    expect(r?.url).toBe('https://meet.google.com/abc-defg-hij')
  })
})
