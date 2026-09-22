import { describe, it, expect } from 'vitest'
import { isContentEligible, contentFromBuffer, CONTENT_MAX_BYTES } from '../content'

/**
 * 内容搜索提取策略（#9 v1 含内容搜索）：
 * 白名单扩展名 + 大小截断 + 二进制嗅探（null 字节拒收），防止把索引撑爆。
 */
describe('isContentEligible', () => {
  it('白名单扩展名 + 大小上限内可提取', () => {
    expect(isContentEligible('a.md', 1000)).toBe(true)
    expect(isContentEligible('b.txt', 1000)).toBe(true)
    expect(isContentEligible('c.ts', CONTENT_MAX_BYTES)).toBe(true)
  })

  it('非白名单扩展名 / 目录不可提取', () => {
    expect(isContentEligible('d.png', 1000)).toBe(false)
    expect(isContentEligible('e.app', 1000)).toBe(false)
    expect(isContentEligible('f.md', 0)).toBe(false)
  })

  it('超限拒绝', () => {
    expect(isContentEligible('g.md', CONTENT_MAX_BYTES + 1)).toBe(false)
  })
})

describe('contentFromBuffer', () => {
  it('utf8 文本解码', () => {
    expect(contentFromBuffer(Buffer.from('# 标题\n正文'))).toBe('# 标题\n正文')
  })

  it('含 null 字节判定为二进制拒收', () => {
    const buf = Buffer.alloc(64)
    buf.write('text', 0)
    buf[63] = 0
    expect(contentFromBuffer(buf)).toBeNull()
  })
})
