import { describe, it, expect } from 'vitest'
import { test as regexTest, convert } from './lib.js'

describe('regex lib', () => {
  it('匹配与捕获组', () => {
    const r = regexTest('(\\d+)-(\\d+)', 'g', 'a 12-34 b 56-78')
    expect(r.matches).toHaveLength(2)
    expect(r.matches[0].groups).toEqual(['12', '34'])
  })
  it('非法正则 → error；无匹配 → 空 matches', () => {
    expect(regexTest('([', '', 'x').error).toBeTruthy()
    expect(regexTest('z', 'g', 'abc').matches).toEqual([])
  })
  it('convert：匹配列表 + 高亮 detail', () => {
    const r = convert('a 12-34', '\\d+-\\d+', 'g')
    expect(r[0].matches).toHaveLength(1)
    expect(r[0].detail).toContain('12-34')
  })
})
