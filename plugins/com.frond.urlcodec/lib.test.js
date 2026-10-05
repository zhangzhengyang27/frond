import { describe, it, expect } from 'vitest'
import { encodeComponent, decodeComponent, encodeURI_, convert } from './lib.js'

describe('urlcodec lib', () => {
  it('encodeComponent 编码保留字符差异（? & / = 被编码；encodeURI_ 不编码保留字符）', () => {
    expect(encodeComponent('a b&c=1')).toBe('a%20b%26c%3D1')
    expect(decodeComponent('a%20b%26c%3D1')).toBe('a b&c=1')
  })
  it('convert 双向：encode 两列（组件/整体）、decode 失败 → null', () => {
    expect(convert('a=1&b=中', 'encode')).toHaveLength(2)
    expect(convert('%E4%B8%AD', 'decode')[0].output).toBe('中')
    expect(convert('%E4%B8%AD%ZZ', 'decode')).toBeNull()
  })
  it('encodeURI_ 保留结构字符', () => {
    expect(encodeURI_('https://a.com/?b=中')).not.toContain('%3F')
  })
})
