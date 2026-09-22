import { describe, it, expect } from 'vitest'
import {
  MAX_INLINE_SLOTS,
  argLayoutOf,
  backspaceExits,
  missingRequiredIndexes,
  moveSlot,
  prefillSlots,
  slotArgs,
  type ArgSlot
} from '../argSlots'
import type { CommandEntry } from '../commands'

/**
 * 内联参数槽的判定（P-1.6b）。
 * 界面不归单测管，判定归：什么时候进内联、几格、缺什么、←/→ 怎么走、什么时候退出。
 */
const entry = (action: Record<string, unknown>): CommandEntry =>
  ({ key: 'k', title: 'T', icon: 'i', badge: '', subtitle: '', action }) as unknown as CommandEntry

const plugin = (args: unknown[]): CommandEntry =>
  entry({ type: 'plugin', pluginId: 'com.x', cmd: 'c', arguments: args })

const slots = (...over: Array<Partial<ArgSlot>>): ArgSlot[] =>
  over.map((o, i) => ({
    id: o.id ?? `a${i}`,
    label: o.label ?? `参数${i}`,
    secret: o.secret ?? false,
    required: o.required ?? false
  }))

describe('argLayoutOf', () => {
  it('不接参数的命令是 none（回车照旧直接执行）', () => {
    expect(argLayoutOf(entry({ type: 'app', path: '/Applications/X.app' }))).toEqual({
      kind: 'none'
    })
    expect(argLayoutOf(plugin([]))).toEqual({ kind: 'none' })
    expect(
      argLayoutOf(entry({ type: 'quicklink', id: 'q', url: 'https://a/?q={encodedQuery}' }))
    ).toEqual({ kind: 'none' })
  })

  it('1-2 格文本/密码走内联；第 3 格起进表单', () => {
    expect(argLayoutOf(plugin([{ name: 'pattern' }]))).toMatchObject({
      kind: 'inline',
      slots: [{ id: 'pattern', required: false, secret: false }]
    })
    expect(argLayoutOf(plugin([{ name: 'a' }, { name: 'b', type: 'password' }]))).toMatchObject({
      kind: 'inline',
      slots: [
        { id: 'a', secret: false },
        { id: 'b', secret: true }
      ]
    })
    expect(argLayoutOf(plugin([{ name: 'a' }, { name: 'b' }, { name: 'c' }]))).toEqual({
      kind: 'form',
      reason: 'too-many'
    })
    expect(MAX_INLINE_SLOTS).toBe(2)
  })

  it('含 dropdown 一律走表单（内联条里放不下候选列表）', () => {
    expect(
      argLayoutOf(
        plugin([{ name: 'flags', type: 'dropdown', data: [{ title: '全局', value: 'g' }] }])
      )
    ).toEqual({ kind: 'form', reason: 'dropdown' })
  })

  it('Quicklink：{query} 与命名占位符都要收，缺一格就拼不出可用地址', () => {
    // 旧规则把 {query} 排除在外：混合 URL 只收 {id}，提交的地址里留着 {query} 字面量
    expect(
      argLayoutOf(entry({ type: 'quicklink', id: 'q', url: 'https://a/?q={query}&x={id}' }))
    ).toMatchObject({
      kind: 'inline',
      slots: [
        { id: 'query', required: true },
        { id: 'id', required: true }
      ]
    })
    const three = entry({
      type: 'quicklink',
      id: 'q',
      url: 'https://a/?a={one}&b={two}&c={three}'
    })
    expect(argLayoutOf(three)).toEqual({ kind: 'form', reason: 'too-many' })
    // 纯 {query} 也是一格（内联填，不再跳表单页）
    expect(argLayoutOf(entry({ type: 'quicklink', id: 'q', url: 'https://a/?q={query}' }))).toEqual(
      {
        kind: 'inline',
        slots: [{ id: 'query', label: '参数', secret: false, required: true }]
      }
    )
  })

  it('声明里缺 name 的参数被忽略（宿主清洗后不该出现，但判定不能因此炸）', () => {
    const layout = argLayoutOf(plugin([{ placeholder: '没有名字' }, { name: 'ok' }]))
    expect(layout).toMatchObject({ kind: 'inline', slots: [{ id: 'ok' }] })
  })
})

describe('填格与提交', () => {
  it('尾巴只填进第一个非密码格；两格时不会替用户猜第二格', () => {
    const two = slots({ id: 'pattern' }, { id: 'text' })
    expect(prefillSlots(two, '\\d+')).toEqual(['\\d+', ''])
    const withSecret = slots({ id: 'pw', secret: true }, { id: 'note' })
    expect(prefillSlots(withSecret, 'abc')).toEqual(['', 'abc'])
    expect(prefillSlots(two, '   ')).toEqual(['', ''])
  })

  it('必填空格挡住提交，填上就放行；可选空着不影响', () => {
    const s = slots({ id: 'a', required: true }, { id: 'b' })
    expect(missingRequiredIndexes(s, ['', ''])).toEqual([0])
    expect(missingRequiredIndexes(s, ['x', ''])).toEqual([])
    expect(missingRequiredIndexes(slots({ id: 'a' }), ['']), '没有必填格应当可以直接回车').toEqual(
      []
    )
  })

  it('提交只带填过的格子（不把空串塞进 args）', () => {
    expect(slotArgs(slots({ id: 'a' }, { id: 'b' }), ['x', ''])).toEqual({ a: 'x' })
  })
})

describe('格子间的移动与退出', () => {
  it('←/→ 夹在两端，不绕圈', () => {
    expect(moveSlot(0, -1, 2)).toBe(0)
    expect(moveSlot(0, 1, 2)).toBe(1)
    expect(moveSlot(1, 1, 2)).toBe(1)
    expect(moveSlot(1, -1, 2)).toBe(0)
    expect(moveSlot(0, 1, 0), '没有格子时不该跳出 0 以外').toBe(0)
  })

  it('只有第一格且已空时退格才退出参数模式', () => {
    expect(backspaceExits(0, '')).toBe(true)
    expect(backspaceExits(0, 'x'), '在删自己打的字，不该退出').toBe(false)
    expect(backspaceExits(1, ''), '第二格空着退格是回到上一格，不是退出').toBe(false)
  })
})
