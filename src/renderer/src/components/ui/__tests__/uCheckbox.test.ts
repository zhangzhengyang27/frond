// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UCheckbox from '../UCheckbox.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(UCheckbox, { props: { modelValue: false, ...props } })
}

describe('UCheckbox', () => {
  it('勾选发出 update:modelValue: true', async () => {
    const w = setup()
    await w.get('input[type=checkbox]').setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([true])
  })

  it('disabled 时不发出事件', async () => {
    const w = setup({ disabled: true })
    await w.get('input[type=checkbox]').setValue(true)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('label 渲染且原生 input 包裹在 label 内（浏览器点击联动由包裹语义保证）', () => {
    const w = setup({ label: '启用音频录制' })
    expect(w.text()).toContain('启用音频录制')
    expect(w.get('label').find('input[type=checkbox]').exists()).toBe(true)
  })

  it('attrs 透传到原生 input（data-test 可命中）', () => {
    const w = setup({ 'data-test': 'cb-system-audio-enabled' })
    expect(w.get('input[type=checkbox]').attributes('data-test')).toBe('cb-system-audio-enabled')
  })
})
