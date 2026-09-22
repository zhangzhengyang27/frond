import { describe, it, expect } from 'vitest'
import { headlessRunBlocker } from '../headlessRun'

/**
 * 「无人值守跑一条插件命令」那三道闸（P-2③）。
 *
 * 判错的方向只有一个有意义的方向：**放开**。放开了就是插件的界面在凌晨自己弹出来，
 * 或者定时任务把用户手上正开着的那个插件关掉。所以每一条拒绝都要有名字、有原因，
 * 而且要真的按清单判，不能只看命令码存不存在。
 */
const plugin = (
  over: Partial<{ enabled: boolean; commands: Array<{ code: string; mode?: 'view' | 'action' }> }> = {}
) => ({
  enabled: true,
  commands: [
    { code: 'sync', mode: 'action' as const },
    { code: 'panel', mode: 'view' as const },
    { code: 'bare' }
  ],
  ...over
})

describe('headlessRunBlocker', () => {
  it('装好、启用、且是 action 命令 → 放行', () => {
    expect(headlessRunBlocker(plugin(), 'sync', false)).toBe(null)
  })

  it('插件不存在 / 已停用都拒绝（停用后还能被定时任务唤起，开关就等于没做）', () => {
    expect(headlessRunBlocker(undefined, 'sync', false)).toBe('插件未安装')
    expect(headlessRunBlocker(plugin({ enabled: false }), 'sync', false)).toBe('插件已停用')
  })

  it('视图命令一律拒（只有 mode:action 能无人值守跑）', () => {
    expect(headlessRunBlocker(plugin(), 'panel', false)).toMatch(/mode:'action'/)
    // 没写 mode 的按视图算——这条口径与 openPlugin 里的 isActionCommand 同一份实现
    expect(headlessRunBlocker(plugin(), 'bare', false)).toMatch(/mode:'action'/)
  })

  it('命令不存在时说得清是「没这条」而不是「不是 action」', () => {
    expect(headlessRunBlocker(plugin(), 'nope', false)).toBe('插件没有这条命令：nope')
  })

  it('胶囊里已有活跃视图时跳过：活跃槽只有一个，挤进去会把用户手上那个插件关掉', () => {
    expect(headlessRunBlocker(plugin(), 'sync', true)).toMatch(/正有插件在用/)
  })

  it('空命令名不是一条「什么都不做」的任务', () => {
    expect(headlessRunBlocker(plugin(), '', false)).toBe('没写要跑哪个命令')
  })
})
