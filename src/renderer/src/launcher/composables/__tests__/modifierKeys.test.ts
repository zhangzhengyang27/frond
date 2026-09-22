import { describe, it, expect } from 'vitest'
import { isReservedCombo, matchActionKey, prettyKey, resolveModifierAction } from '../modifierKeys'
import type { PanelAction } from '../useActionPanel'

/**
 * P-1.1 / P-1.2：动作模型的修饰键声明与命中判定。
 *
 * 键位语义与 useActionPanel.ts:15 的既有教训配套——面板键帽只标注真实可触发的按键
 * （原先按标签猜 ⌘C/⌘R 但并未绑定），因此「哪些键算命中」必须是可单测的纯函数，
 * 而不是散在 keydown 里的 if。
 */

const actions: PanelAction[] = [
  { id: 'open', label: '启动应用', icon: 'rocket-line', run: () => {} },
  {
    id: 'reveal',
    label: '在 Finder 中显示',
    icon: 'folder-open-line',
    key: 'cmd+backspace',
    run: () => {}
  },
  {
    id: 'copy',
    label: '复制路径',
    icon: 'file-copy-line',
    key: 'cmd+shift+c',
    run: () => {}
  }
]

describe('matchActionKey', () => {
  it('字母键忽略大小写（按住 ⇧ 时 KeyboardEvent.key 给出大写）', () => {
    expect(matchActionKey({ key: 'C', metaKey: true, shiftKey: true }, 'cmd+shift+c')).toBe(true)
    expect(matchActionKey({ key: 'c', metaKey: true, shiftKey: true }, 'cmd+shift+c')).toBe(true)
  })
  it('特殊键（KeyboardEvent.key 形如 Backspace）也能命中', () => {
    expect(matchActionKey({ key: 'Backspace', metaKey: true }, 'cmd+backspace')).toBe(true)
  })
  it('修饰键必须逐个相等（多按与少按都不算命中）', () => {
    expect(matchActionKey({ key: 'c', metaKey: true }, 'cmd+shift+c')).toBe(false)
    expect(matchActionKey({ key: 'c', shiftKey: true }, 'cmd+shift+c')).toBe(false)
    expect(
      matchActionKey({ key: 'c', metaKey: true, shiftKey: true, ctrlKey: true }, 'cmd+shift+c')
    ).toBe(false)
    // alt 位也必须相等：未声明 alt 的键位不能被按住 alt 的组合误命中
    expect(matchActionKey({ key: 'c', metaKey: true, altKey: true }, 'cmd+c')).toBe(false)
  })
})

describe('resolveModifierAction', () => {
  it('metaKey+Backspace 命中声明了 cmd+backspace 的动作', () => {
    expect(resolveModifierAction(actions, { metaKey: true, key: 'Backspace' })?.id).toBe('reveal')
  })
  it('未声明 key 的动作不参与匹配（裸 Enter 由调用方的 ↵ 分支处理）', () => {
    expect(resolveModifierAction(actions, { metaKey: true, key: 'Enter' })).toBeNull()
  })
  it('修饰键不全时不误命中', () => {
    expect(resolveModifierAction(actions, { metaKey: true, key: 'c' })).toBeNull()
    expect(resolveModifierAction(actions, { metaKey: true, shiftKey: true, key: 'C' })?.id).toBe(
      'copy'
    )
  })
})

describe('isReservedCombo', () => {
  it('被二级动作占用的组合一律保留，即使当前行没有该动作也不交给输入框', () => {
    // 不保留的话 ⌘⌫ 会穿透成「删到行首」，把整个查询词清掉
    expect(isReservedCombo({ metaKey: true, key: 'Backspace' })).toBe(true)
    expect(isReservedCombo({ metaKey: true, shiftKey: true, key: 'c' })).toBe(true)
    expect(isReservedCombo({ metaKey: true, shiftKey: true, key: 'v' })).toBe(true)
    expect(isReservedCombo({ metaKey: true, shiftKey: true, key: 'k' })).toBe(true)
    expect(isReservedCombo({ metaKey: true, shiftKey: true, key: 'f' })).toBe(true)
  })
  it('裸键与未占用的组合不算保留', () => {
    expect(isReservedCombo({ key: 'Backspace' })).toBe(false)
    expect(isReservedCombo({ metaKey: true, key: 'c' })).toBe(false)
    expect(isReservedCombo({ shiftKey: true, key: 'v' })).toBe(false)
  })
})

describe('prettyKey', () => {
  it('mac 符号形态：修饰键在前、特殊键用字形', () => {
    expect(prettyKey('cmd+backspace')).toBe('⌘⌫')
    expect(prettyKey('cmd+shift+c')).toBe('⌘⇧C')
    expect(prettyKey('cmd+shift+v')).toBe('⌘⇧V')
    expect(prettyKey('cmd+shift+f')).toBe('⌘⇧F')
    expect(prettyKey('ctrl+enter')).toBe('⌃↵')
    expect(prettyKey('cmd+alt+e')).toBe('⌘⌥E')
  })
})
