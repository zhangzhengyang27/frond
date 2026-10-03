import { describe, it, expect } from 'vitest'
import { assignUniqueIds } from '../WindowSwitcherService'

/**
 * B41-2 回归钉：窗口 id 曾是 `${appName}-${pid}-${title}`——同应用两个同名
 * 窗口（如两个 Untitled）必撞 id → 渲染端 :key 重复 + 选中歧义。
 * assignUniqueIds 给重复窗口追加 #2/#3 并带 occurrence（第几个同名窗口），
 * activateWindow 据此 AXRaise 第 N 个而不是永远第一个。
 */

describe('assignUniqueIds（B41-2）', () => {
  it('唯一窗口保持原 id，无 occurrence 后缀', () => {
    const rows = [{ appName: 'Finder', pid: 100, title: 'Downloads' }]
    const out = assignUniqueIds(rows)
    expect(out[0]!.id).toBe('Finder-100-Downloads')
    expect(out[0]!.occurrence).toBe(1)
  })

  it('同应用同名窗口：id 追加 #2/#3 去重，occurrence 标序号', () => {
    const rows = [
      { appName: 'Code', pid: 42, title: 'Untitled' },
      { appName: 'Code', pid: 42, title: 'Untitled' },
      { appName: 'Code', pid: 42, title: 'Untitled' }
    ]
    const out = assignUniqueIds(rows)
    expect(out.map((w) => w.id)).toEqual(['Code-42-Untitled', 'Code-42-Untitled#2', 'Code-42-Untitled#3'])
    expect(out.map((w) => w.occurrence)).toEqual([1, 2, 3])
  })

  it('不同应用/不同 pid 的同名窗口互不算重复', () => {
    const rows = [
      { appName: 'Code', pid: 42, title: 'Untitled' },
      { appName: 'Code', pid: 43, title: 'Untitled' },
      { appName: 'Terminal', pid: 42, title: 'Untitled' }
    ]
    const out = assignUniqueIds(rows)
    expect(new Set(out.map((w) => w.id)).size).toBe(3)
    expect(out.every((w) => w.occurrence === 1)).toBe(true)
  })
})
