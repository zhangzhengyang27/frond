/**
 * useLauncherBusy（I9 统一加载态）单测
 *
 * 计数为模块级共享状态：vi.resetModules + 动态导入保证用例间隔离。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'

let mod: typeof import('../useLauncherBusy')

beforeEach(async () => {
  vi.resetModules()
  mod = await import('../useLauncherBusy')
})

describe('useLauncherBusy · 忙碌计数', () => {
  it('begin/end 成对增减', () => {
    const { busyCount } = mod.useLauncherBusy()
    expect(busyCount.value).toBe(0)
    mod.beginBusy()
    expect(busyCount.value).toBe(1)
    mod.beginBusy()
    expect(busyCount.value).toBe(2)
    mod.endBusy()
    expect(busyCount.value).toBe(1)
    mod.endBusy()
    expect(busyCount.value).toBe(0)
  })

  it('endBusy 过额钳制为 0（不出现负数）', () => {
    mod.endBusy()
    mod.endBusy()
    expect(mod.useLauncherBusy().busyCount.value).toBe(0)
  })
})
