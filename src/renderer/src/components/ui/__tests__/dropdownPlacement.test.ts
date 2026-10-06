import { describe, it, expect } from 'vitest'
import { computePlacement } from '../dropdownPlacement'

const rect = (
  o: Partial<{
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
  }>
) => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  width: 0,
  height: 0,
  ...o
})

describe('computePlacement', () => {
  it('下方空间充足 → 维持 bottom', () => {
    const p = computePlacement(
      rect({ top: 100, bottom: 140, left: 100, right: 200 }),
      rect({ height: 200, width: 160 }),
      1280,
      800,
      { side: 'bottom', align: 'start' }
    )
    expect(p.side).toBe('bottom')
  })

  it('下方放不下且上方更宽裕 → 翻转为 top', () => {
    const p = computePlacement(
      rect({ top: 700, bottom: 740, left: 100, right: 200 }),
      rect({ height: 200, width: 160 }),
      1280,
      800,
      { side: 'bottom', align: 'start' }
    )
    expect(p.side).toBe('top')
  })

  it('start 会溢出右缘 → 翻转为 end', () => {
    const p = computePlacement(
      rect({ top: 100, bottom: 140, left: 1200, right: 1260 }),
      rect({ height: 200, width: 160 }),
      1280,
      800,
      { side: 'bottom', align: 'start' }
    )
    expect(p.align).toBe('end')
  })

  it('end 会溢出左缘 → 翻转为 start', () => {
    const p = computePlacement(
      rect({ top: 100, bottom: 140, left: 20, right: 80 }),
      rect({ height: 200, width: 160 }),
      1280,
      800,
      { side: 'bottom', align: 'end' }
    )
    expect(p.align).toBe('start')
  })
})
