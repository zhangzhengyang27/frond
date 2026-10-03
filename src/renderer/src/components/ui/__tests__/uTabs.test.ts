// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UTabs from '../UTabs.vue'

const tabs = [
  { id: 'record', label: '录制' },
  { id: 'history', label: '历史' }
]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(UTabs, { props: { tabs, modelValue: 'record', ...props } })
}

describe('UTabs', () => {
  it('渲染 tablist/tab 与 aria-selected', () => {
    const w = setup()
    expect(w.find('[role=tablist]').exists()).toBe(true)
    const tabEls = w.findAll('[role=tab]')
    expect(tabEls[0]!.attributes('aria-selected')).toBe('true')
    expect(tabEls[1]!.attributes('aria-selected')).toBe('false')
  })

  it('点击发出对应 id', async () => {
    const w = setup()
    await w.findAll('[role=tab]')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual(['history'])
  })

  it('ArrowRight 循环到下一个', async () => {
    const w = setup()
    await w.get('[role=tablist]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')![0]).toEqual(['history'])
  })

  it('ArrowLeft 从第一个循环到最后一个', async () => {
    const w = setup()
    await w.get('[role=tablist]').trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:modelValue')![0]).toEqual(['history'])
  })

  it('Home/End 跳到首尾', async () => {
    const w = setup({ modelValue: 'history' })
    await w.get('[role=tablist]').trigger('keydown', { key: 'Home' })
    expect(w.emitted('update:modelValue')![0]).toEqual(['record'])
    await w.get('[role=tablist]').trigger('keydown', { key: 'End' })
    expect(w.emitted('update:modelValue')![1]).toEqual(['history'])
  })

  it('非激活项 tabindex=-1（roving tabindex）', () => {
    const w = setup()
    expect(w.findAll('[role=tab]')[1]!.attributes('tabindex')).toBe('-1')
  })
})
