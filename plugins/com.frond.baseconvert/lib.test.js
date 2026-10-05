import { describe, it, expect } from 'vitest'
import { parseInput, toBase, convert } from './lib.js'

describe('baseconvert lib', () => {
  it('前缀识别 + BigInt 大整数', () => {
    expect(parseInput('0xff').value).toBe(255n)
    expect(parseInput('0xff').base).toBe(16)
    expect(parseInput('0b1010').base).toBe(2)
    expect(parseInput('0o17').base).toBe(8)
    expect(parseInput('-42').value).toBe(-42n)
    expect(parseInput('0XFF').base).toBe(16)
  })
  it('toBase 各进制', () => {
    expect(toBase(255n, 16)).toBe('ff')
    expect(toBase(255n, 2)).toBe('11111111')
    expect(toBase(255n, 8)).toBe('377')
    expect(toBase(-42n, 16)).toBe('-2a')
  })
  it('convert 四条并列 + 非法 → null', () => {
    const r = convert('255')
    expect(r.map((x) => x.output)).toEqual(['11111111', '377', '255', 'ff'])
    expect(r[0].section).toBe('二进制')
    expect(r[3].accessories[0].tag).toBe('base16')
    expect(convert('12a3')).toBeNull()
  })
})
