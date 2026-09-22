import { describe, it, expect } from 'vitest'
import { parsePluginForm } from '../plugin-protocol'

/**
 * React 表单视图解析（#11 M2）：SDK <Form> 提交的 JSON 节点 →
 * { fields: FormField[], submitLabel?, submitId }，胶囊复用 FormPage 渲染，
 * 提交后经 Callback 钩子把值回传插件（onSubmit 回调 id）。
 * fail-closed：submitId 必填、非法字段剔除、select 无选项降级 text、封顶 20 字段。
 */
describe('parsePluginForm', () => {
  it('合法表单：字段类型映射 + submitLabel/submitId 保留', () => {
    const form = parsePluginForm({
      $t: 'form',
      title: '反馈',
      submitLabel: '发送反馈',
      submitId: 'submit-1',
      fields: [
        { id: 'content', label: '内容', type: 'textarea', placeholder: '想说的话' },
        { id: 'kind', label: '类型', type: 'select', options: ['建议', '缺陷'] },
        { id: 'subscribe', label: '订阅回访', type: 'checkbox', initial: true },
        { id: 'token', label: '令牌', type: 'password' }
      ]
    })
    expect(form).not.toBeNull()
    expect(form!.submitId).toBe('submit-1')
    expect(form!.submitLabel).toBe('发送反馈')
    expect(form!.title).toBe('反馈')
    expect(form!.fields).toHaveLength(4)
    expect(form!.fields[0]).toEqual({
      key: 'content',
      label: '内容',
      type: 'textarea',
      placeholder: '想说的话'
    })
    expect(form!.fields[2].type).toBe('checkbox')
    expect(form!.fields[2].initial).toBe(true)
  })

  it('缺 submitId / 非法 $t / 无字段 → null', () => {
    expect(parsePluginForm({ $t: 'form', fields: [{ id: 'a', label: 'A' }] })).toBeNull()
    expect(parsePluginForm({ $t: 'form', submitId: 's', fields: [] })).toBeNull()
    expect(parsePluginForm({ $t: 'list', submitId: 's', fields: [{ id: 'a', label: 'A' }] })).toBeNull()
    expect(parsePluginForm(null)).toBeNull()
  })

  it('非法字段剔除；字段 id 缺失 / 重复去重', () => {
    const form = parsePluginForm({
      $t: 'form',
      submitId: 's',
      fields: [
        { label: 'no id' },
        { id: '', label: 'empty id' },
        { id: 'a', label: 'A' },
        { id: 'a', label: 'dup' },
        { id: 'b' }
      ]
    })
    expect(form!.fields.map((f) => f.key)).toEqual(['a', 'b'])
    expect(form!.fields[1].label).toBe('b') // 无 label 用 id 兜底
  })

  it('select 无选项降级 text；非法类型降级 text', () => {
    const form = parsePluginForm({
      $t: 'form',
      submitId: 's',
      fields: [
        { id: 'a', label: 'A', type: 'select' },
        { id: 'b', label: 'B', type: 'richtext' }
      ]
    })
    expect(form!.fields.every((f) => f.type === 'text')).toBe(true)
  })

  it('数量封顶 20 字段；字段名/标签截断', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `f${i}`,
      label: `L${i}`
    }))
    const form = parsePluginForm({ $t: 'form', submitId: 's', fields: many })
    expect(form!.fields).toHaveLength(20)
  })
})
