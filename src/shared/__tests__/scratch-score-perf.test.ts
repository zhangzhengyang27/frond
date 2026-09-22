// 一次性测量脚本（跑完即删）：打分侧每键多少钱
import { describe, it, expect } from 'vitest'
import { searchEntries } from '../search'
import { FIRST_PARTY_COMMANDS, BUILTIN_COMMANDS } from '../commands'

describe('scratch 打分成本', () => {
  it('量', () => {
    const pool = [...BUILTIN_COMMANDS, ...FIRST_PARTY_COMMANDS] as never[]
    const out: Record<string, number> = { pool: pool.length }
    for (const q of ['a', 'e', 'safari', 'clip', 'zzzz']) {
      // 预热
      for (let i = 0; i < 50; i++) searchEntries(pool, q, 30)
      const t0 = performance.now()
      for (let i = 0; i < 300; i++) searchEntries(pool, q, 30)
      out[q] = Number(((performance.now() - t0) / 300).toFixed(3))
    }
    console.log('[score-ms-per-keystroke]', JSON.stringify(out))
    expect(pool.length).toBeGreaterThan(0)
  })
})
