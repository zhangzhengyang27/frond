import { describe, it, expect } from 'vitest'
import { uuidv4, uuidv7, formatUuid, generate } from './lib.js'

describe('uuid lib', () => {
  it('v4 版本位与变体位正确、批量唯一', () => {
    const u = uuidv4()
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const set = new Set(generate(50, 'std'))
    expect(set.size).toBe(50)
  })
  it('v7：ms 时间戳大端前缀 + 版本位 7', () => {
    const u = uuidv7(1700000000000)
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    // 48bit 大端时间戳：0x018BCFE56800 = 1700000000000
    expect(u.replace(/-/g, '').slice(0, 12)).toBe('018bcfe56800')
    const u2 = uuidv7(1700000000001)
    expect(u2.replace(/-/g, '').slice(0, 12) >= u.replace(/-/g, '').slice(0, 12)).toBe(true)
  })
  it('格式变体', () => {
    const u = uuidv4()
    expect(formatUuid(u, 'upper')).toBe(u.toUpperCase())
    expect(formatUuid(u, 'compact')).not.toContain('-')
    expect(formatUuid(u, 'urn')).toMatch(/^urn:uuid:/)
  })
})
