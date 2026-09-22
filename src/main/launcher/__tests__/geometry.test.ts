import { describe, it, expect } from 'vitest'
import {
  animationFrames,
  centeredBounds,
  clampToWorkArea,
  compactRect,
  easeOutCubic,
  expandRect,
  lerpRect,
  parseBoundsMap,
  rememberBounds,
  resolveBounds,
  serializeBoundsMap,
  type Rect
} from '../geometry'

/**
 * 胶囊窗几何（P-6⑤）。
 *
 * 这一格里最容易做错的是「重构改了行为」：落点原来是
 * `window.ts:positionAtCursor()` 里两行算式，搬进 `centeredBounds` 时必须逐值相同，
 * 否则所有人的胶囊会悄悄挪位置。所以第一件事就是把旧算式钉成期望值，
 * 其余都是新加的语义（记忆、Compact、动画帧）。
 */
const MAIN: Rect = { x: 0, y: 0, width: 1512, height: 982 }
const W = 750
const H = 520

describe('centeredBounds / clampToWorkArea', () => {
  it('默认落点与重构前的算式逐值一致（水平居中、垂直 15%）', () => {
    const got = centeredBounds(MAIN, W, H)
    // 旧实现：x = work.x + (work.width - 750) / 2, y = work.y + work.height * 0.15，各自 round
    expect(got.x).toBe(Math.round(MAIN.x + (MAIN.width - W) / 2))
    expect(got.y).toBe(Math.round(MAIN.y + MAIN.height * 0.15))
    expect(got.width).toBe(W)
    expect(got.height).toBe(H)
  })

  it('副屏（workArea 原点非 0、且有菜单栏留白）也按该屏算', () => {
    const sub = { x: 1920, y: 24, width: 1080, height: 1056 }
    expect(centeredBounds(sub, W, H)).toEqual({
      x: Math.round(1920 + (1080 - W) / 2),
      y: Math.round(24 + 1056 * 0.15),
      width: W,
      height: H
    })
  })

  it('越界夹回工作区，且整块留在屏内而不是被裁', () => {
    const work = { x: 0, y: 0, width: 1000, height: 800 }
    expect(clampToWorkArea({ x: -500, y: -500, width: 400, height: 300 }, work)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 300
    })
    expect(clampToWorkArea({ x: 900, y: 700, width: 400, height: 300 }, work)).toEqual({
      x: 600,
      y: 500,
      width: 400,
      height: 300
    })
    // 窗口比屏幕还大：以屏宽为准，坐标贴左上（不能出现负宽高）
    const clamped = clampToWorkArea({ x: 10, y: 10, width: 5000, height: 5000 }, work)
    expect(clamped.width).toBe(1000)
    expect(clamped.height).toBe(800)
    expect(clamped.x).toBe(0)
  })

  it('夹完的矩形一定满足「整块在工作区内」这条不变量', () => {
    const work = { x: 100, y: 50, width: 1200, height: 900 }
    for (const r of [
      { x: -9999, y: -9999, width: 750, height: 520 },
      { x: 9999, y: 9999, width: 750, height: 520 },
      { x: 100, y: 50, width: 750, height: 520 },
      { x: 1250, y: 900, width: 900, height: 600 }
    ]) {
      const c = clampToWorkArea(r, work)
      expect(c.x).toBeGreaterThanOrEqual(work.x)
      expect(c.y).toBeGreaterThanOrEqual(work.y)
      expect(c.x + c.width).toBeLessThanOrEqual(work.x + work.width)
      expect(c.y + c.height).toBeLessThanOrEqual(work.y + work.height)
    }
  })
})

describe('按显示器记忆的读写', () => {
  it('坏 JSON / 非对象 / 数组都当作没有记忆，不抛', () => {
    for (const raw of [undefined, null, '', '  ', '{', '[]', '3', '"x"', 'null']) {
      expect(parseBoundsMap(raw)).toEqual({})
    }
  })

  it('单条非法只丢那一条，合法条目照收', () => {
    const raw = JSON.stringify({
      '1': { x: 10, y: 20, width: 750, height: 520 },
      '2': { x: 1.5, y: 20, width: 750, height: 520 }, // 非整数坐标
      '3': { x: 0, y: 0, width: 0, height: 520 }, // 零宽
      '4': { x: 0, y: 0, width: 750, height: 999999 }, // 尺寸离谱
      '5': { x: '0', y: 0, width: 750, height: 520 }, // 字符串
      '6': { x: 1e9, y: 0, width: 750, height: 520 }, // 坐标离谱
      '7': { x: -30, y: 40, width: 750, height: 520 } // 负坐标但合理：收
    })
    expect(Object.keys(parseBoundsMap(raw)).sort()).toEqual(['1', '7'])
  })

  it('条目数封顶（手工塞进来的超大表不会撑爆 pref）', () => {
    const big: Record<string, Rect> = {}
    for (let i = 0; i < 200; i++) big[`${i}`] = { x: i, y: i, width: 750, height: 520 }
    const parsed = parseBoundsMap(JSON.stringify(big))
    expect(Object.keys(parsed).length).toBeLessThanOrEqual(16)
    expect(Object.keys(parsed).length).toBeGreaterThan(0)
  })

  it('往返一致，且 rememberBounds 存的是副本、不改原 map', () => {
    const base = { '1': { x: 1, y: 2, width: 3, height: 4 } }
    const source = { x: 5, y: 6, width: 7, height: 8 }
    const next = rememberBounds(base, '2', source)
    expect(base).toEqual({ '1': { x: 1, y: 2, width: 3, height: 4 } })
    expect(parseBoundsMap(serializeBoundsMap(next))).toEqual(next)
    // 调用方之后改自己手里那个矩形，不能顺带改掉已经记下的位置
    source.x = 999
    expect(next['2'].x).toBe(5)
  })

  it('resolveBounds：命中记忆用记忆（并夹回当前工作区），没命中用默认落点', () => {
    const work = { x: 0, y: 0, width: 1512, height: 982 }
    const fallback = centeredBounds(work, W, H)
    expect(resolveBounds({}, '1', work, { width: W, height: H })).toEqual(fallback)
    expect(
      resolveBounds({ '1': { x: 40, y: 60, width: W, height: H } }, '1', work, {
        width: W,
        height: H
      })
    ).toEqual({
      x: 40,
      y: 60,
      width: W,
      height: H
    })
    // 换了屏幕：记忆还在但已出界 → 夹回来，不会把窗口丢到不存在的坐标上
    const small = { x: 0, y: 0, width: 900, height: 600 }
    const got = resolveBounds({ '1': { x: 4000, y: 4000, width: W, height: H } }, '1', small, {
      width: W,
      height: H
    })
    expect(got.x + got.width).toBeLessThanOrEqual(900)
    expect(got.y + got.height).toBeLessThanOrEqual(600)
    // 别的显示器的记忆不能串台
    expect(
      resolveBounds({ '2': { x: 40, y: 60, width: W, height: H } }, '1', work, {
        width: W,
        height: H
      })
    ).toEqual(fallback)
  })

  /**
   * 记的是**落点**不是尺寸：Compact Mode / 槽态收窗请求 60 高，
   * 记忆里的 520 高一旦赢过请求，拖过位置的用户就永远收不了窗
   * （界面只有一条栏，窗却还是整块高——一片空窗）。
   */
  it('resolveBounds：记忆只出 x/y，宽高按本次请求', () => {
    const work = { x: 0, y: 0, width: 1512, height: 982 }
    const remembered = { '1': { x: 40, y: 60, width: W, height: H } }
    expect(resolveBounds(remembered, '1', work, { width: W, height: 60 })).toEqual({
      x: 40,
      y: 60,
      width: W,
      height: 60
    })
    // 记忆里的宽高写得再离谱也不作数（这里它是 12 宽，取出来还得是请求的那份）
    expect(
      resolveBounds({ '1': { x: 40, y: 60, width: 12, height: 900 } }, '1', work, {
        width: W,
        height: 300
      })
    ).toEqual({ x: 40, y: 60, width: W, height: 300 })
  })
})

describe('Compact Mode 与动画帧', () => {
  const full = { x: 200, y: 150, width: W, height: H }

  it('收缩是「顶边不动只收高度」，展开回到原高', () => {
    const work = { x: 0, y: 0, width: 1512, height: 982 }
    const c = compactRect(full, 64, work)
    expect(c).toEqual({ x: 200, y: 150, width: W, height: 64 })
    expect(expandRect(c, H, work)).toEqual(full)
  })

  it('贴到屏幕顶时向上让位，但不越出工作区', () => {
    const low = { x: 0, y: 40, width: W, height: 100 } // 底部只剩 100px
    const c = compactRect(low, 64, { x: 0, y: 0, width: 1000, height: 140 })
    expect(c.height).toBe(64)
    expect(c.y).toBeGreaterThanOrEqual(0)
    expect(c.y + c.height).toBeLessThanOrEqual(140)
  })

  it('compactRect 不会把窗口拉高（compactHeight 大于原高时按原高）', () => {
    expect(compactRect(full, 900, { x: 0, y: 0, width: 1512, height: 982 }).height).toBe(H)
  })

  it('easeOutCubic 端点正确、单调、越界夹住', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
    let prev = -1
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = easeOutCubic(t)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5) // 收尾慢 = 前半段已经走了大半
  })

  it('lerpRect 端点逐值正确（t=1 必须精确等于目标，不能差 1px）', () => {
    const to = { x: 0, y: 900, width: 100, height: 40 }
    expect(lerpRect(full, to, 0)).toEqual({ ...full })
    expect(lerpRect(full, to, 1)).toEqual(to)
  })

  it('animationFrames：帧数对、末帧精确是目标、过程单调', () => {
    const to = { x: 0, y: 0, width: 100, height: 100 }
    const frames = animationFrames(full, to, 5)
    expect(frames).toHaveLength(5)
    expect(frames[frames.length - 1]).toEqual(to)
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].width).toBeLessThanOrEqual(frames[i - 1].width)
      expect(frames[i].height).toBeLessThanOrEqual(frames[i - 1].height)
    }
    // steps<=1 只给终点，不能停在起点（那是「动画没跑但卡在半路」）
    expect(animationFrames(full, to, 0)).toEqual([to])
    expect(animationFrames(full, to, 1)).toEqual([to])
  })
})
