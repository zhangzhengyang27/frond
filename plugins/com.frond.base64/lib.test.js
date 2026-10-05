import { describe, it, expect } from 'vitest'
import { encode, decode, isProbablyBase64 } from './lib.js'

describe('base64 lib（计划 2 的插件测试基建样板）', () => {
  it('encode/decode 往返（含中文/emoji/长文本）', () => {
    for (const s of ['hello', '你好，世界', 'emoji 👍', 'a'.repeat(300)]) {
      expect(decode(encode(s))).toBe(s)
    }
  })
  it('decode 非法输入返回 null（不抛错）', () => {
    expect(decode('!!!not-base64!!!')).toBeNull()
    expect(decode('')).toBeNull()
  })
  it('isProbablyBase64 判定：合法 base64 → true，普通句子 → false', () => {
    expect(isProbablyBase64(encode('hello'))).toBe(true)
    expect(isProbablyBase64('hello world!')).toBe(false)
  })
})
