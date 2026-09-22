import { describe, it, expect } from 'vitest'
import { bgraToRgba } from '../qrDecode'

/** V4 P1-12 批次3：BGRA → RGBA 通道转换（nativeImage 位图布局适配） */
describe('bgraToRgba', () => {
  it('交换 B/R 通道，G/A 位置不变', () => {
    const bgra = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255])
    const rgba = bgraToRgba(bgra, 2, 1)
    expect([...rgba]).toEqual([30, 20, 10, 255, 60, 50, 40, 255])
  })

  it('alpha 拉满（忽略源预乘 alpha，避免暗部失真）', () => {
    const bgra = new Uint8Array([100, 100, 100, 128])
    expect(bgraToRgba(bgra, 1, 1)[3]).toBe(255)
  })

  it('输出长度与像素数一致', () => {
    const bgra = new Uint8Array(3 * 2 * 4)
    expect(bgraToRgba(bgra, 3, 2).length).toBe(3 * 2 * 4)
  })
})
