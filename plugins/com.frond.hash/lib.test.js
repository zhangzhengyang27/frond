import { describe, it, expect } from 'vitest'
import { md5, sha, convert } from './lib.js'

describe('hash lib', () => {
  it('md5 已知向量', () => {
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })
  it('sha 已知向量（async）', async () => {
    expect(await sha('sha256', 'abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await sha('sha1', 'abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })
  it('convert 五算法并列（async）', async () => {
    const r = await convert('abc')
    expect(r.map((x) => x.section)).toEqual(['MD5', 'SHA1', 'SHA256', 'SHA384', 'SHA512'])
    expect(r.every((x) => /^[0-9a-f]+$/.test(x.output))).toBe(true)
  })
})
