// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import USwitch from '../USwitch.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(USwitch, { props: { modelValue: false, ...props } })
}

describe('USwitch', () => {
  it('渲染 role=switch 与 aria-checked', () => {
    const w = setup({ modelValue: true })
    expect(w.get('button').attributes('role')).toBe('switch')
    expect(w.get('button').attributes('aria-checked')).toBe('true')
  })

  it('点击发出 update:modelValue 翻转值', async () => {
    const w = setup()
    await w.get('button').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([true])
  })

  it('disabled 时不发出事件', async () => {
    const w = setup({ disabled: true })
    await w.get('button').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('label 进入 aria-label', () => {
    const w = setup({ label: '紧凑模式' })
    expect(w.get('button').attributes('aria-label')).toBe('紧凑模式')
  })

  it('attrs 透传到根 button（data-* 可命中）', () => {
    const w = setup({ 'data-compact-toggle': true })
    expect(w.get('button').attributes('data-compact-toggle')).toBe('true')
  })
})
