import { describe, it, expect } from 'vitest'
import { encodeNamed, decode, convert } from './lib.js'

describe('htmlentity lib', () => {
  it('encode：命名实体优先，无命名的走数字实体', () => {
    expect(encodeNamed('<div>')).toBe('&lt;div&gt;')
    expect(encodeNamed('中')).toBe('&#20013;')
    expect(decode('&lt;&#20013;&amp;')).toBe('<中&')
  })
  it('convert：含可编码字符时双列（命名/数字），纯文本单列', () => {
    const r = convert('<b>bold</b>', 'encode')
    expect(r.map((x) => x.section)).toEqual(['命名实体', '数字实体'])
    expect(convert('plain', 'encode')).toHaveLength(1)
  })
})
