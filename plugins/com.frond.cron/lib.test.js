import { describe, it, expect } from 'vitest'
import { describe as describeCron, nextRuns, convert } from './lib.js'

describe('cron lib', () => {
  it('描述与下次执行', () => {
    expect(describeCron('*/5 * * * *')).toContain('5')
    const runs = nextRuns('0 9 * * *', 3, new Date('2026-10-05T00:00:00'))
    expect(runs).toHaveLength(3)
    expect(runs[0].getHours()).toBe(9)
  })
  it('convert 三组 + 常用快捷', () => {
    const r = convert('*/5 * * * *')
    expect(r.some((x) => x.section === '下次执行')).toBe(true)
    expect(r.some((x) => x.section === '字段')).toBe(true)
    expect(r.some((x) => x.section === '常用')).toBe(true)
    expect(convert('bad expr')).toEqual([])
  })
})
