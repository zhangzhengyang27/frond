import { describe, it, expect } from 'vitest'
import { parsePair, ratio, grade, convert } from './lib.js'

describe('contrast lib', () => {
  it('黑/白对比度 21:1', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(grade(21).aaa).toBe(true)
    expect(grade(3.5).aa).toBe(false)
  })
  it('parsePair 语法', () => {
    expect(parsePair('#000/#fff')).toEqual({
      fg: { r: 0, g: 0, b: 0 },
      bg: { r: 255, g: 255, b: 255 }
    })
    expect(parsePair('#000 #fff')).toEqual({
      fg: { r: 0, g: 0, b: 0 },
      bg: { r: 255, g: 255, b: 255 }
    })
  })
  it('convert：主条目 + AA 徽章', () => {
    const r = convert('#000/#fff')
    expect(r[0].accessories[0].tag).toBe('AAA ✓')
    expect(r[0].accessories[0].tone).toBe('success')
    expect(convert('zzz')).toBeNull()
  })
})
