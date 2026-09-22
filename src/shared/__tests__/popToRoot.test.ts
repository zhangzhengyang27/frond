import { describe, it, expect } from 'vitest'
import {
  normalizePopToRootMode,
  shouldPopToRootOnShow,
  POP_TO_ROOT_REOPEN_INTERVAL_MS
} from '../popToRoot'

/**
 * Pop to Root 三态（对标 Raycast「Pop to Root Search」设置）：
 * - immediately：隐藏即清栈，唤起必是根搜索（Leaf 现状，缺省）
 * - afterInterval：隐藏保留状态，30 秒内再唤起回到上次位置，超过则清
 * - manually：唤起永不自动清栈，仅用户手动 Esc/Pop to Root 逐级返回
 */
describe('normalizePopToRootMode', () => {
  it('合法值透传', () => {
    expect(normalizePopToRootMode('immediately')).toBe('immediately')
    expect(normalizePopToRootMode('afterInterval')).toBe('afterInterval')
    expect(normalizePopToRootMode('manually')).toBe('manually')
  })

  it('非法 / 缺失值回退缺省 immediately', () => {
    expect(normalizePopToRootMode('never')).toBe('immediately')
    expect(normalizePopToRootMode(42)).toBe('immediately')
    expect(normalizePopToRootMode(null)).toBe('immediately')
    expect(normalizePopToRootMode(undefined)).toBe('immediately')
  })
})

describe('shouldPopToRootOnShow', () => {
  it('immediately：唤起总是回到根', () => {
    expect(shouldPopToRootOnShow('immediately', null, 1000)).toBe(true)
    expect(shouldPopToRootOnShow('immediately', 900, 1000)).toBe(true)
  })

  it('manually：唤起永不自动回到根', () => {
    expect(shouldPopToRootOnShow('manually', null, 1000)).toBe(false)
    expect(shouldPopToRootOnShow('manually', 900, 999_999_999)).toBe(false)
  })

  it('afterInterval：无隐藏时间戳不触发', () => {
    expect(shouldPopToRootOnShow('afterInterval', null, 1000)).toBe(false)
  })

  it('afterInterval：间隔内保留状态，超过间隔清栈', () => {
    const hiddenAt = 1000
    expect(shouldPopToRootOnShow('afterInterval', hiddenAt, hiddenAt + POP_TO_ROOT_REOPEN_INTERVAL_MS - 1)).toBe(false)
    expect(shouldPopToRootOnShow('afterInterval', hiddenAt, hiddenAt + POP_TO_ROOT_REOPEN_INTERVAL_MS)).toBe(true)
  })

  it('间隔为 30 秒（对标 Raycast）', () => {
    expect(POP_TO_ROOT_REOPEN_INTERVAL_MS).toBe(30_000)
  })
})
