// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import USlider from '../USlider.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(USlider, { props: { modelValue: 0.5, min: 0, max: 2, step: 0.1, ...props } })
}

describe('USlider', () => {
  it('拖动发出 number', async () => {
    const w = setup()
    await w.get('input[type=range]').setValue('1.5')
    expect(w.emitted('update:modelValue')![0]).toEqual([1.5])
  })

  it('min/max/step 透传', () => {
    const w = setup()
    const el = w.get('input[type=range]').element as HTMLInputElement
    expect(el.min).toBe('0')
    expect(el.max).toBe('2')
    expect(el.step).toBe('0.1')
  })

  it('showValue 显示格式化值', () => {
    const w = setup({ showValue: true, formatValue: (v: number) => `${v.toFixed(1)}x` })
    expect(w.text()).toContain('0.5x')
  })

  it('label 进入 aria-label', () => {
    const w = setup({ label: '温度' })
    expect(w.get('input[type=range]').attributes('aria-label')).toBe('温度')
  })

  it('disabled 时不发出事件', async () => {
    const w = setup({ disabled: true })
    await w.get('input[type=range]').setValue('1')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
