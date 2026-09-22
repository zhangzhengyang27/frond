import { describe, it, expect } from 'vitest'
import { isActionCommand, sanitizePluginCommandMode } from '../plugin-protocol'

/**
 * P-2.1：命令形态（View / Action）的清洗与判定。
 *
 * fail-closed 是这里唯一要紧的性质：manifest 由第三方手写，拼错的 mode
 * （'Acion' / 'Action' / 布尔 true）绝不能让一条命令悄悄变成「无界面执行」——
 * 那会让用户按回车后看到什么都没发生。
 */

describe('sanitizePluginCommandMode', () => {
  it('只认小写字面量 view / action', () => {
    expect(sanitizePluginCommandMode('action')).toBe('action')
    expect(sanitizePluginCommandMode('view')).toBe('view')
  })
  it('拼错 / 大小写不对 / 非字符串一律 undefined（= 缺省 view）', () => {
    expect(sanitizePluginCommandMode('Action')).toBeUndefined()
    expect(sanitizePluginCommandMode('script')).toBeUndefined()
    expect(sanitizePluginCommandMode(true)).toBeUndefined()
    expect(sanitizePluginCommandMode(undefined)).toBeUndefined()
  })
})

describe('isActionCommand', () => {
  const commands = [
    { code: 'repos', title: '列表' },
    { code: 'paste', title: '无界面', mode: 'action' as const }
  ]

  it('命中的命令按各自声明返回', () => {
    expect(isActionCommand(commands, 'paste')).toBe(true)
    expect(isActionCommand(commands, 'repos')).toBe(false)
  })
  it('无 cmd（默认打开插件）/ 未知 cmd / 无命令表都按 view 处理', () => {
    expect(isActionCommand(commands, null)).toBe(false)
    expect(isActionCommand(commands, 'nope')).toBe(false)
    expect(isActionCommand(undefined, 'paste')).toBe(false)
    expect(isActionCommand([], 'paste')).toBe(false)
  })
})
