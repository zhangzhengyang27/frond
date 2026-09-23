import { describe, it, expect } from 'vitest'
import { computeWindowRect, roundRect, type Rect } from '../windowGeometry'

/**
 * V4 P1-7 批次3：窗口几何纯函数。
 * workArea 1000x700 @ (0,0)（已扣除菜单栏/Dock），gap 默认 0。
 * 六分语义与 Rectangle/Raycast 一致：中间列 = 中间两个六分（1/3 宽）。
 */
const WA: Rect = { x: 0, y: 0, width: 1000, height: 700 }

describe('computeWindowRect · 无 gap', () => {
  it('左右半屏', () => {
    expect(computeWindowRect('left', WA, 0)).toEqual({ x: 0, y: 0, width: 500, height: 700 })
    expect(computeWindowRect('right', WA, 0)).toEqual({ x: 500, y: 0, width: 500, height: 700 })
  })

  it('上下半屏 / 最大化', () => {
    expect(computeWindowRect('top', WA, 0)).toEqual({ x: 0, y: 0, width: 1000, height: 350 })
    expect(computeWindowRect('bottom', WA, 0)).toEqual({ x: 0, y: 350, width: 1000, height: 350 })
    expect(computeWindowRect('maximize', WA, 0)).toEqual({ x: 0, y: 0, width: 1000, height: 700 })
  })

  it('四分格', () => {
    expect(computeWindowRect('topRight', WA, 0)).toEqual({ x: 500, y: 0, width: 500, height: 350 })
    expect(computeWindowRect('bottomLeft', WA, 0)).toEqual({ x: 0, y: 350, width: 500, height: 350 })
  })

  it('三分（左右三等分，中三分之一居中）', () => {
    expect(computeWindowRect('thirdFirst', WA, 0).width).toBeCloseTo(333.33)
    expect(computeWindowRect('thirdCenter', WA, 0)).toEqual({
      x: 1000 / 3,
      y: 0,
      width: 1000 / 3,
      height: 700
    })
    expect(computeWindowRect('thirdLast', WA, 0).x).toBeCloseTo(666.67)
    expect(computeWindowRect('thirdLastTwo', WA, 0).width).toBeCloseTo(666.67)
  })

  it('六分（中间列 = 中间两个六分）', () => {
    expect(computeWindowRect('sixthTopLeft', WA, 0)).toEqual({
      x: 0,
      y: 0,
      width: 1000 / 6,
      height: 350
    })
    expect(computeWindowRect('sixthTopCenter', WA, 0)).toEqual({
      x: 1000 / 3,
      y: 0,
      width: 1000 / 3,
      height: 350
    })
    const br = computeWindowRect('sixthBottomRight', WA, 0)
    // x 由 5×(1000/6) 得到，与 1000−(1000/6) 数学同值但差 1 ULP：整对象 toEqual 会因末位碎掉
    expect(br.y).toBe(350)
    expect(br.width).toBe(1000 / 6)
    expect(br.height).toBe(350)
    expect(br.x).toBeCloseTo(1000 - 1000 / 6, 6)
  })

  it('maximizeHeight 铺满高、maximizeWidth 保持当前 y/h', () => {
    expect(computeWindowRect('maximizeHeight', WA, 0)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 700
    })
    const cur = { x: 200, y: 100, width: 300, height: 200 }
    expect(computeWindowRect('maximizeWidth', WA, 0, cur)).toEqual({
      x: 0,
      y: 100,
      width: 1000,
      height: 200
    })
  })

  it('center 保持尺寸并在 workArea 内居中', () => {
    const cur = { x: 0, y: 0, width: 400, height: 300 }
    expect(computeWindowRect('center', WA, 0, cur)).toEqual({
      x: 300,
      y: 200,
      width: 400,
      height: 300
    })
  })

  it('缺 currentWindow 时 maximizeWidth / center 抛错（调用方须先探测）', () => {
    expect(() => computeWindowRect('maximizeWidth', WA, 0)).toThrow()
    expect(() => computeWindowRect('center', WA, 0)).toThrow()
  })
})

describe('computeWindowRect · gap 内缩', () => {
  it('gap 双向内缩可排布区（左右半屏）', () => {
    expect(computeWindowRect('left', WA, 10)).toEqual({
      x: 10,
      y: 10,
      width: (1000 - 20) / 2,
      height: 680
    })
    expect(computeWindowRect('right', WA, 10)).toEqual({
      x: 10 + (1000 - 20) / 2,
      y: 10,
      width: (1000 - 20) / 2,
      height: 680
    })
  })

  it('gap 上下同样内缩（top / 六分行高）', () => {
    expect(computeWindowRect('top', WA, 8)).toEqual({
      x: 8,
      y: 8,
      width: 984,
      height: (700 - 16) / 2
    })
    expect(computeWindowRect('sixthBottomRight', WA, 8).y).toBe(8 + (700 - 16) / 2)
  })

  it('gap 大于屏幕时高度收敛为 0（不产生负矩形）', () => {
    expect(computeWindowRect('maximize', WA, 999)).toEqual({ x: 999, y: 999, width: 0, height: 0 })
  })
})

describe('roundRect', () => {
  it('分数坐标取整', () => {
    expect(roundRect({ x: 333.333, y: 0, width: 333.333, height: 700 })).toEqual({
      x: 333,
      y: 0,
      width: 333,
      height: 700
    })
  })
})
