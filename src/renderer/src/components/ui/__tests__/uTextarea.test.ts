// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UTextarea from '../UTextarea.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(UTextarea, { props: { modelValue: '', ...props } })
}

describe('UTextarea', () => {
  it('输入发出 update:modelValue', async () => {
    const w = setup()
    await w.get('textarea').setValue('hello')
    expect(w.emitted('update:modelValue')![0]).toEqual(['hello'])
  })

  it('rows/mono/resize 透传', () => {
    const w = setup({ rows: 7, mono: true, resize: 'y' })
    const el = w.get('textarea')
    expect(el.attributes('rows')).toBe('7')
    expect(el.classes()).toContain('font-mono')
    expect(el.classes()).toContain('resize-y')
  })

  it('error 渲染文案并设置 aria-invalid', () => {
    const w = setup({ error: 'JSON 格式错误' })
    expect(w.get('textarea').attributes('aria-invalid')).toBe('true')
    expect(w.text()).toContain('JSON 格式错误')
  })

  it('attrs 透传到原生 textarea（spellcheck 可关闭）', () => {
    const w = setup({ spellcheck: false })
    expect(w.get('textarea').attributes('spellcheck')).toBe('false')
  })

  it('label 渲染', () => {
    const w = setup({ label: 'MCP JSON' })
    expect(w.text()).toContain('MCP JSON')
  })
})
