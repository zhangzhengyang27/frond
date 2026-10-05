import { describe, it, expect } from 'vitest'
import { decode, convert } from './lib.js'

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const token = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: 'u1', exp: 4102444800 })}.sig`

describe('jwt lib', () => {
  it('decode 三段结构', () => {
    const d = decode(token)
    expect(d.header.alg).toBe('HS256')
    expect(d.payload.sub).toBe('u1')
    expect(decode('a.b')).toBeNull()
    expect(decode('aaa.bbb.ccc')).toBeNull()
  })
  it('convert：claims 逐条 + 过期徽章', async () => {
    const r = convert(token)
    expect(r.some((x) => x.section === 'Header')).toBe(true)
    expect(r.some((x) => x.section === 'Payload')).toBe(true)
    const expItem = r.find((x) => x.title.indexOf('exp') === 0)
    expect(expItem.accessories[0].tone).toBe('success') // 4102444800 = 2100 年，未过期
  })
})
