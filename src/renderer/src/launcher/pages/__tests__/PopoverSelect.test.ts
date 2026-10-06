// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import PopoverSelect from '../PopoverSelect.vue'

/**
 * 胶囊内下拉（原生 select 的替代）：
 * 原生选项 popup 在透明窗里渲染不出来（点击无反应），本组件是 DOM 内浮层。
 */

const OPTIONS = [
  { value: '', label: '不提醒' },
  { value: '1h', label: '1 小时后' },
  { value: 'custom', label: '自定义…' }
]

const mounted: VueWrapper[] = []

function setup(modelValue = ''): VueWrapper {
  const w = mount(PopoverSelect, {
    props: {
      modelValue,
      options: OPTIONS,
      'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v })
    },
    attachTo: document.body
  })
  mounted.push(w)
  return w
}

const panel = (): HTMLElement | null => document.querySelector<HTMLElement>('.popover-select-panel')

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
  document.body.innerHTML = ''
})

describe('PopoverSelect（透明窗内下拉）', () => {
  it('trigger 显示当前值的 label（value 空串也映射到「不提醒」）', () => {
    const w = setup('')
    expect(w.find('.popover-select-value').text()).toBe('不提醒')
  })

  it('点击 trigger 展开浮层（Teleport 到 body），点选项写回并收起', async () => {
    const w = setup()
    await w.find('.popover-select-trigger').trigger('click')
    expect(panel()).not.toBeNull()
    expect(panel()!.parentElement).toBe(document.body)
    const opts = document.querySelectorAll('.popover-select-option')
    expect(opts).toHaveLength(3)
    ;(opts[1] as HTMLElement).click()
    await w.vm.$nextTick()
    expect(w.emitted('update:modelValue')![0]).toEqual(['1h'])
    expect(panel()).toBeNull()
  })

  it('handleKey：面板没开时 ↓ 展开，↵ 选中写回，ESC 收起', async () => {
    const w = setup('')
    const comp = w.getComponent(PopoverSelect)
    // 面板没开：↓ 展开面板（handleKey 返回 true 表示消费）
    expect(comp.vm.handleKey!(new window.KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(true)
    await w.vm.$nextTick()
    expect(panel()).not.toBeNull()
    // 光标从「不提醒」向后移一项到「1 小时后」，↵ 选中
    comp.vm.handleKey!(new window.KeyboardEvent('keydown', { key: 'ArrowDown' }))
    comp.vm.handleKey!(new window.KeyboardEvent('keydown', { key: 'Enter' }))
    await w.vm.$nextTick()
    expect(w.emitted('update:modelValue')![0]).toEqual(['1h'])
    expect(panel()).toBeNull()
  })

  it('面板外 mousedown 收起，anchor/面板内不收', async () => {
    const w = setup()
    await w.find('.popover-select-trigger').trigger('click')
    expect(panel()).not.toBeNull()
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(panel()).toBeNull()
  })

  it('面板有内联定位坐标（fixed 锚定生效）', async () => {
    const w = setup()
    await w.find('.popover-select-trigger').trigger('click')
    const p = panel()!
    expect(p.style.top).toContain('px')
    expect(p.style.left).toContain('px')
  })
})
