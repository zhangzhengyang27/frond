import { describe, it, expect } from 'vitest'
import { stats, topWords, convert } from './lib.js'

describe('textstats lib', () => {
  it('统计口径', () => {
    const s = stats('hello 世界\nworld')
    expect(s.chars).toBe(14)
    expect(s.lines).toBe(2)
    expect(s.words).toBeGreaterThanOrEqual(4)
    expect(s.bytes).toBeGreaterThan(12)
  })
  it('词频 TopN', () => {
    expect(topWords('a b a c a', 2)[0]).toEqual({ word: 'a', count: 3 })
  })
  it('convert 两组', () => {
    const r = convert('hello world hello')
    expect(r.some((x) => x.section === '统计')).toBe(true)
    expect(r.some((x) => x.section === '词频 Top10')).toBe(true)
  })
})
