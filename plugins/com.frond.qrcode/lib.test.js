import { describe, it, expect } from 'vitest'
import { qrEncode } from './lib.js'

describe('qrcode lib（矩阵契约）', () => {
  it('生成正方矩阵 + 定位图案左上角', () => {
    const qr = qrEncode('HELLO', { eccLevel: 'M' })
    expect(qr.size).toBeGreaterThanOrEqual(21)
    expect(qr.modules).toHaveLength(qr.size)
    expect(qr.modules.every((row) => row.length === qr.size)).toBe(true)
    expect(qr.modules[0][0]).toBe(true)
    expect(qr.modules[6][0]).toBe(true)
    expect(qr.modules[0][6]).toBe(true)
  })
  it('版本随内容增长；空文本 → null', () => {
    const short = qrEncode('A', { eccLevel: 'M' })
    const long = qrEncode('A'.repeat(120), { eccLevel: 'M' })
    expect(long.size).toBeGreaterThan(short.size)
    expect(qrEncode('', { eccLevel: 'M' })).toBeNull()
  })
})
