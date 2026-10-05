import { describe, it, expect } from 'vitest'
import { parse, toHsl, convert } from './lib.js'

describe('colorpicker lib', () => {
  it('解析与转换', () => {
    expect(parse('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parse('#f00')).toEqual({ r: 255, g: 0, b: 0 })
    expect(toHsl({ r: 255, g: 0, b: 0 })).toContain('hsl(0')
  })
  it('convert 五格式并列 + tintColor 随条目色', () => {
    const r = convert('#336699')
    expect(r).toHaveLength(5)
    expect(r[0].icon.tintColor).toMatch(/^#[0-9a-f]{6}$/)
    expect(r[0].output).toBe('#336699')
  })
})
