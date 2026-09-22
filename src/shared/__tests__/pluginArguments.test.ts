import { describe, it, expect } from 'vitest'
import { sanitizePluginArguments, PLUGIN_MAX_ARGUMENTS } from '../plugin-protocol'

/**
 * 插件命令参数声明清洗（多参数命令，对标 Raycast argument1-3）：
 * manifest.commands[].arguments 由第三方作者手写，宿主按 fail-closed 清洗——
 * 非法项剔除 / 非法类型降级 / 数量封顶，保证胶囊参数表单与启动链路拿到的永远合法。
 */
describe('sanitizePluginArguments', () => {
  it('合法声明原样保留（type 归一化写出）', () => {
    const args = sanitizePluginArguments([
      { name: 'query', type: 'text', placeholder: '搜索…', required: true },
      { name: 'mode', type: 'dropdown', data: [{ title: '全部', value: 'all' }] },
      { name: 'token', type: 'password' }
    ])
    expect(args).toHaveLength(3)
    expect(args[0]).toEqual({
      name: 'query',
      type: 'text',
      placeholder: '搜索…',
      required: true
    })
    expect(args[1]).toEqual({
      name: 'mode',
      type: 'dropdown',
      data: [{ title: '全部', value: 'all' }]
    })
    expect(args[2]).toEqual({ name: 'token', type: 'password' })
  })

  it('缺省 type 归一化为 text', () => {
    expect(sanitizePluginArguments([{ name: 'q' }])).toEqual([{ name: 'q', type: 'text' }])
  })

  it('非数组输入返回空数组', () => {
    expect(sanitizePluginArguments('query')).toEqual([])
    expect(sanitizePluginArguments(null)).toEqual([])
    expect(sanitizePluginArguments({ name: 'q' })).toEqual([])
  })

  it('非法项剔除：非对象 / name 非法', () => {
    expect(
      sanitizePluginArguments([null, 42, 'x', { name: '' }, { name: '   ' }, { name: 'ok' }])
    ).toEqual([{ name: 'ok', type: 'text' }])
  })

  it('重名保留首个', () => {
    const args = sanitizePluginArguments([
      { name: 'q', type: 'text' },
      { name: 'q', type: 'password' }
    ])
    expect(args).toEqual([{ name: 'q', type: 'text' }])
  })

  it('非法 type 降级为 text', () => {
    expect(sanitizePluginArguments([{ name: 'q', type: ' richtext ' }])).toEqual([
      { name: 'q', type: 'text' }
    ])
  })

  it('dropdown 缺少 data 或 data 非法 → 降级为 text', () => {
    expect(sanitizePluginArguments([{ name: 'a', type: 'dropdown' }])).toEqual([
      { name: 'a', type: 'text' }
    ])
    expect(sanitizePluginArguments([{ name: 'a', type: 'dropdown', data: [] }])).toEqual([
      { name: 'a', type: 'text' }
    ])
    expect(
      sanitizePluginArguments([{ name: 'a', type: 'dropdown', data: [{ title: 'x' }, 'bad', 1] }])
    ).toEqual([{ name: 'a', type: 'text' }])
  })

  it('dropdown data 非法项剔除、封顶 20 项', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ title: `t${i}`, value: `v${i}` }))
    const args = sanitizePluginArguments([{ name: 'a', type: 'dropdown', data: many }])
    expect(args[0].type).toBe('dropdown')
    expect(args[0].data).toHaveLength(20)
  })

  it('数量封顶 3（对标 Raycast argument1-3）', () => {
    const args = sanitizePluginArguments(
      Array.from({ length: 8 }, (_, i) => ({ name: `arg${i}` }))
    )
    expect(args).toHaveLength(PLUGIN_MAX_ARGUMENTS)
    expect(PLUGIN_MAX_ARGUMENTS).toBe(3)
  })

  it('placeholder 非 string 剔除、required 非 true 不保留', () => {
    expect(
      sanitizePluginArguments([{ name: 'q', placeholder: 123, required: 'yes' }])
    ).toEqual([{ name: 'q', type: 'text' }])
  })
})
