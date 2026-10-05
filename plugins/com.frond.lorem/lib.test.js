import { describe, it, expect } from 'vitest'
import { generate } from './lib.js'

describe('lorem lib', () => {
  it('按类型与数量生成', () => {
    expect(generate('words', 5, 'latin').split(/\s+/)).toHaveLength(5)
    expect(generate('sentences', 3, 'latin').split(/[.!?](\s|$)/).filter(Boolean).length).toBeGreaterThanOrEqual(3)
    expect(generate('paragraphs', 2, 'latin').split('\n\n')).toHaveLength(2)
  })
  it('中文占位文', () => {
    expect(generate('paragraphs', 1, 'zh')).toMatch(/[\u4e00-\u9fa5]/)
  })
})
