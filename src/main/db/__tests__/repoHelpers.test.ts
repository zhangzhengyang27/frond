import { describe, it, expect } from 'vitest'
import { likeContains } from '../repo'

/** LIKE 子串匹配参数：转义 % _ \，配合 `LIKE ? ESCAPE '\'` 使用 */
describe('likeContains', () => {
  it('普通子串包裹 %', () => {
    expect(likeContains('foo')).toBe('%foo%')
  })

  it('通配字符 % _ 被转义（输入 % 不得匹配全部）', () => {
    expect(likeContains('100%')).toBe('%100\\%%')
    expect(likeContains('a_b')).toBe('%a\\_b%')
    expect(likeContains('%')).toBe('%\\%%')
  })

  it('转义字符 \\ 本身被转义', () => {
    expect(likeContains('a\\b')).toBe('%a\\\\b%')
  })

  it('空串产生 %%（匹配全部，调用方应先判空）', () => {
    expect(likeContains('')).toBe('%%')
  })

  it('中文原样保留', () => {
    expect(likeContains('番茄钟')).toBe('%番茄钟%')
  })
})
