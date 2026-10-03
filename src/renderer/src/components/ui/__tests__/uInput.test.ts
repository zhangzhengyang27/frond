// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UInput from '../UInput.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(UInput, { props: { modelValue: '', ...props }, slots })
}

describe('UInput', () => {
  it('输入发出 update:modelValue', async () => {
    const w = setup()
    await w.get('input').setValue('sk-abc')
    expect(w.emitted('update:modelValue')![0]).toEqual(['sk-abc'])
  })

  it('v-model.number 修饰符发出 number', async () => {
    const w = mount(UInput, {
      props: { modelValue: 100, modelModifiers: { number: true } }
    })
    await w.get('input').setValue('1920')
    expect(w.emitted('update:modelValue')![0]).toEqual([1920])
  })

  it('v-model.number 对非数字输入回退原始字符串（对齐 Vue looseToNumber）', async () => {
    const w = mount(UInput, {
      props: { modelValue: 100, modelModifiers: { number: true } }
    })
    await w.get('input').setValue('abc')
    expect(w.emitted('update:modelValue')![0]).toEqual(['abc'])
  })

  it('error 渲染错误文案并设置 aria-invalid', () => {
    const w = setup({ error: '必填项' })
    expect(w.get('input').attributes('aria-invalid')).toBe('true')
    expect(w.text()).toContain('必填项')
  })

  it('type=password 透传', () => {
    const w = setup({ type: 'password' })
    expect(w.get('input').attributes('type')).toBe('password')
  })

  it('#prefix 插槽渲染且 attrs 透传到原生 input', () => {
    const w = setup({ 'data-hello': '1' }, { prefix: '<i class="ri-lock-line" />' })
    expect(w.get('input').attributes('data-hello')).toBe('1')
    expect(w.find('.ri-lock-line').exists()).toBe(true)
  })
})
