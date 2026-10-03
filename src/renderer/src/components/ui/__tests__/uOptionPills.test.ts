// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UOptionPills from '../UOptionPills.vue'

const options = [
  { label: '不倒数', value: 0 },
  { label: '3 秒', value: 3 },
  { label: '7 秒', value: 7, disabled: true }
]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(UOptionPills, { props: { modelValue: 0, options, ...props } })
}

describe('UOptionPills', () => {
  it('渲染 radiogroup 与全部选项，选中项 aria-checked', () => {
    const w = setup()
    expect(w.find('[role=radiogroup]').exists()).toBe(true)
    const radios = w.findAll('[role=radio]')
    expect(radios.length).toBe(3)
    expect(radios[0]!.attributes('aria-checked')).toBe('true')
    expect(radios[1]!.attributes('aria-checked')).toBe('false')
  })

  it('点击发出对应 value', async () => {
    const w = setup()
    await w.findAll('[role=radio]')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([3])
  })

  it('disabled 项与整体 disabled 都不发事件', async () => {
    const w = setup()
    await w.findAll('[role=radio]')[2]!.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    const w2 = setup({ disabled: true })
    await w2.findAll('[role=radio]')[1]!.trigger('click')
    expect(w2.emitted('update:modelValue')).toBeUndefined()
  })

  it('ArrowRight 循环到下一个可用项', async () => {
    const w = setup()
    await w.get('[role=radiogroup]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')![0]).toEqual([3])
  })

  it('ArrowLeft 从首项循环到末项', async () => {
    const w = setup()
    await w.get('[role=radiogroup]').trigger('keydown', { key: 'ArrowLeft' })
    // 末项是 disabled(7)，方向键不做跳过，落在其上时不发事件
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('attrs 透传到容器（data-testid 可命中）', () => {
    const w = setup({ 'data-testid': 'glass-picker' })
    expect(w.find('[data-testid=glass-picker]').exists()).toBe(true)
  })

  it('opt.attrs 透传到对应按钮（data-* 钩子与 title）', () => {
    const w = mount(UOptionPills, {
      props: {
        modelValue: 0,
        options: [
          { label: '宽松', value: 0, attrs: { 'data-density-opt': 'comfortable' } },
          { label: '紧凑', value: 1, attrs: { 'data-density-opt': 'compact', title: '提示' } }
        ]
      }
    })
    expect(w.find('[data-density-opt=compact]').exists()).toBe(true)
    expect(w.find('[data-density-opt=comfortable]').exists()).toBe(true)
    expect(w.find('[data-density-opt=compact]').attributes('title')).toBe('提示')
  })
})
