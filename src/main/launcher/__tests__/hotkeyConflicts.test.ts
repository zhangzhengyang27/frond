import { describe, it, expect } from 'vitest'
import { findHotkeyConflict } from '../hotkeyConflicts'

/**
 * B40 余项回归钉：热键互斥保存时拒绝。此前撞车的加速器由 Electron 二次注册
 * 「看运气」，被顶掉的一方静默失效。findHotkeyConflict 是 ipc handler 的
 * 拒绝依据——下面每条断言对应一种用户真的会设出来的撞车。
 */

const GROUPS = {
  main: 'Alt+Space',
  screenshot: 'CommandOrControl+Shift+A',
  showHide: 'CommandOrControl+Shift+M'
}

describe('findHotkeyConflict（热键互斥）', () => {
  it('命令热键撞主热键：报主热键', () => {
    expect(findHotkeyConflict('Alt+Space', GROUPS, 'command')).toBe('主热键')
  })

  it('大小写不敏感（Electron 加速器同义）', () => {
    expect(findHotkeyConflict('alt+space', GROUPS, 'command')).toBe('主热键')
  })

  it('命令热键撞截图热键 / 撞硬编码 ⌘⇧M', () => {
    expect(findHotkeyConflict('CommandOrControl+Shift+A', GROUPS, 'command')).toBe('截图热键')
    expect(findHotkeyConflict('CommandOrControl+Shift+M', GROUPS, 'command')).toBe(
      '唤起/隐藏热键（⌘⇧M）'
    )
  })

  it('编辑主热键时不与自身比较，但撞截图/⌘⇧M 仍报', () => {
    expect(findHotkeyConflict('Alt+Space', GROUPS, 'main')).toBeNull()
    expect(findHotkeyConflict('CommandOrControl+Shift+M', GROUPS, 'main')).toBe(
      '唤起/隐藏热键（⌘⇧M）'
    )
  })

  it('编辑截图热键时不与自身比较', () => {
    expect(findHotkeyConflict('CommandOrControl+Shift+A', GROUPS, 'screenshot')).toBeNull()
  })

  it('未启用的截图热键（空串）不参与互斥', () => {
    expect(
      findHotkeyConflict('CommandOrControl+Shift+A', { ...GROUPS, screenshot: '' }, 'command')
    ).toBeNull()
  })

  it('空加速器 / 无冲突返回 null', () => {
    expect(findHotkeyConflict('', GROUPS, 'command')).toBeNull()
    expect(findHotkeyConflict('F9', GROUPS, 'command')).toBeNull()
  })
})
