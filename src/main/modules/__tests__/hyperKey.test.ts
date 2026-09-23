import { describe, it, expect, vi } from 'vitest'

// 本测试只跑纯判定函数（decideQuickPress / normalizeQuickPress）。hyperKey 的依赖链
// （uiohook-napi / globalKeys / docStore / launcher.hotkeys → modules/windows）会一路拖到 electron，
// 而 electron 是 CJS：vitest 按 ESM 具名导入它会在**加载阶段**就抛「Named export not found」，
// vi.mock('electron') 也拦不住（外部化的依赖先于 mock 解析）。所以把这三条 IO 依赖就地挡掉。
vi.mock('uiohook-napi', () => ({ UiohookKey: new Proxy({}, { get: () => 0 }) }))
vi.mock('../globalKeys', () => ({
  globalKeyHook: { start: () => {}, stop: () => {}, on: () => {} }
}))
vi.mock('../../launcher/docStore', () => ({
  getLauncherDocStore: () => ({ get: () => null, put: () => ({}) })
}))
vi.mock('../../launcher/hotkeys', () => ({ dispatchChordLetter: () => false }))
vi.mock('../../launcher/window', () => ({ toggleLauncherWindow: () => undefined }))

import { decideQuickPress, normalizeQuickPress, TAP_THRESHOLD_MS } from '../hyperKey'

/**
 * V4 P1-8 方案 A：Hyper Key 纯逻辑（快按判定 / 配置规范化）。
 * hidutil 重映射与 uiohook 监听属平台 IO，由真机验收覆盖。
 */
describe('decideQuickPress（单按判定）', () => {
  it('窗口期内且未触发命令 → true', () => {
    expect(decideQuickPress(1000, 1000 + 50, false)).toBe(true)
    expect(decideQuickPress(1000, 1000 + TAP_THRESHOLD_MS - 1, false)).toBe(true)
  })

  it('按住超过阈值 → false（视为组合键前置）', () => {
    expect(decideQuickPress(1000, 1000 + TAP_THRESHOLD_MS, false)).toBe(false)
    expect(decideQuickPress(1000, 1000 + 5000, false)).toBe(false)
  })

  it('期间已触发过命令 → false（F18+字母 后的抬起不是快按）', () => {
    expect(decideQuickPress(1000, 1000 + 50, true)).toBe(false)
  })
})

describe('normalizeQuickPress', () => {
  it('合法值原样通过', () => {
    expect(normalizeQuickPress('toggle')).toBe('toggle')
    expect(normalizeQuickPress('escape')).toBe('escape')
    expect(normalizeQuickPress('caps')).toBe('caps')
    expect(normalizeQuickPress('nothing')).toBe('nothing')
  })

  it('非法值回落 toggle（fail-safe）', () => {
    expect(normalizeQuickPress('bogus')).toBe('toggle')
    expect(normalizeQuickPress(undefined)).toBe('toggle')
    expect(normalizeQuickPress(42)).toBe('toggle')
  })
})
