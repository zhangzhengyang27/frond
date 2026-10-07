import { describe, it, expect } from 'vitest'
import { buildUpdateEventScript, buildDeleteEventScript } from '../CalendarService'

/**
 * P-3 日程修改/删除的 JXA 脚本构造（审查 Minor：此前无测试）。
 * 只测构造：转义安全（id/title 含引号/换行/反斜杠不得破坏脚本结构）、
 * 授权闸、未找到分支、秒值向下取整。
 */

describe('buildUpdateEventScript', () => {
  it('title/id 经 JSON 字符串字面量嵌入：引号与换行不破坏脚本', () => {
    const script = buildUpdateEventScript('x/abc-123', '发布 "v2"\n第二行', 1700000000123, 1700003600789)
    expect(script).toContain('store.eventWithIdentifier("x/abc-123")')
    expect(script).toContain('ev.title = "发布 \\"v2\\"\\n第二行"')
    expect(script).not.toContain('发布 "v2"\n第二行') // 原文不得裸嵌
  })

  it('ms 向下取整到秒', () => {
    const script = buildUpdateEventScript('id-1', 't', 1700000000123, 1700003600789)
    expect(script).toContain('initWithTimeIntervalSince1970(1700000000)')
    expect(script).toContain('initWithTimeIntervalSince1970(1700003600)')
  })

  it('带授权闸、未找到分支与 saveEventSpanError', () => {
    const script = buildUpdateEventScript('id-1', 't', 0, 1)
    expect(script).toContain("authorizationStatusForEntityType(0)")
    expect(script).toContain("calendar-not-authorized:")
    expect(script).toContain("'event-not-found'")
    expect(script).toContain('store.saveEventSpanError(ev, 0, null)')
  })
})

describe('buildDeleteEventScript', () => {
  it('走 removeEventSpanError，id 转义安全', () => {
    const script = buildDeleteEventScript('weird\\"id')
    expect(script).toContain('store.eventWithIdentifier("weird\\\\\\"id")')
    expect(script).toContain('store.removeEventSpanError(ev, 0, null)')
    expect(script).toContain("'event-not-found'")
    expect(script).not.toContain('saveEventSpanError')
  })
})
