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
  it('非 UTF-8 字节（二进制数据）→ null（TextDecoder fatal，替代升级前 atob 的报错语义）', () => {
    // '////' 解出字节 FF FF FF —— 非法 UTF-8 序列
    expect(decode('////')).toBeNull()
  })
  it("padding 位置非法 → null：中间 '='、全 '='、padding 超 2 个", () => {
    expect(decode('AB=C')).toBeNull()
    expect(decode('=')).toBeNull()
    expect(decode('====')).toBeNull()
    expect(decode('A===')).toBeNull()
    expect(isProbablyBase64('A===')).toBe(false)
  })
  it('内部 ASCII 空白剥离（atob 语义）：多行粘贴可解码', () => {
    expect(decode('aGVs\nbG8=')).toBe('hello')
    expect(decode(' aGVs bG8= ')).toBe('hello')
  })
})
