import { describe, it, expect } from 'vitest'
import { PRESETS, generate, batch } from './lib.js'

describe('passwordgen lib', () => {
  it('四预置方案的字符集与默认长度', () => {
    const p = generate('strong', 20)
    expect(p.password).toHaveLength(20)
    expect(p.password).toMatch(/[0-9]/)
    expect(generate('pin', 6).password).toMatch(/^\d{6}$/)
    expect(generate('readable', 16).password).not.toMatch(/[0O1lI]/)
    expect(PRESETS.medium.length).toBe(16)
  })
  it('熵值与越界拒绝', () => {
    expect(generate('strong', 20).entropyBits).toBeGreaterThan(100)
    expect(generate('strong', 3)).toBeNull()
    expect(batch('medium', 16, 5)).toHaveLength(5)
  })
})
