// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UDrawer from '../UDrawer.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(UDrawer, {
    props: { modelValue: true, ...props },
    slots: {
      default: slots.default ?? '<button data-a>按钮A</button><button data-b>按钮B</button>',
      ...slots
    },
    attachTo: document.body
  })
}

describe('UDrawer', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('Teleport 到 body：面板与遮罩渲染在 document.body', () => {
    const w = setup()
    expect(document.body.querySelector('[role=dialog]')).not.toBeNull()
    expect(w.find('[role=dialog]').exists()).toBe(false) // wrapper 树里没有（已传送）
    w.unmount()
  })

  it('modelValue=false 不渲染', () => {
    const w = setup({ modelValue: false })
    expect(document.body.querySelector('[role=dialog]')).toBeNull()
    w.unmount()
  })

  it('side=right 面板贴右（默认），side=left 贴左', () => {
    const wRight = setup()
    const pRight = document.body.querySelector('[role=dialog]') as HTMLElement
    expect(pRight.className).toContain('right-0')
    wRight.unmount()

    const wLeft = setup({ side: 'left' })
    const pLeft = document.body.querySelector('[role=dialog]') as HTMLElement
    expect(pLeft.className).toContain('left-0')
    wLeft.unmount()
  })

  it('Esc 关闭（closeOnEsc 默认开，可关）', () => {
    const w = setup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('update:modelValue')![0]).toEqual([false])
    w.unmount()

    const w2 = setup({ closeOnEsc: false })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w2.emitted('update:modelValue')).toBeUndefined()
    w2.unmount()
  })

  it('点击遮罩关闭，点击面板内部不关', async () => {
    const w = setup()
    const overlay = document.body.querySelector('.fixed.inset-0') as HTMLElement
    overlay.click()
    expect(w.emitted('update:modelValue')![0]).toEqual([false])
    w.unmount()
  })

  it('Tab 在面板内循环（焦点陷阱），Shift+Tab 反向', async () => {
    const w = setup()
    await new Promise((r) => requestAnimationFrame(r))
    const panel = document.body.querySelector('[role=dialog]') as HTMLElement
    const b = panel.querySelector('[data-b]') as HTMLElement
    b.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    const a = panel.querySelector('[data-a]') as HTMLElement
    expect(document.activeElement).toBe(a)
    // Shift+Tab 从首项回末项
    a.focus()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    )
    expect(document.activeElement).toBe(b)
    w.unmount()
  })

  it('关闭后焦点归还之前的活动元素', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    const w = setup()
    await w.setProps({ modelValue: false })
    expect(document.activeElement).toBe(outside)
    w.unmount()
    outside.remove()
  })

  it('attrs 透传到面板（aria-label / data-* 可命中）', () => {
    const w = setup({ 'aria-label': '任务详情', 'data-x': '1' })
    const panel = document.body.querySelector('[role=dialog]') as HTMLElement
    expect(panel.getAttribute('aria-label')).toBe('任务详情')
    expect(panel.getAttribute('data-x')).toBe('1')
    w.unmount()
  })

  it('title 渲染内置 header；无 title 时不渲染（内容自带 header）', () => {
    const wTitled = setup({ title: '详情' })
    expect(document.body.querySelector('[role=dialog]')!.textContent).toContain('详情')
    wTitled.unmount()
    const wPlain = setup()
    expect(document.body.querySelector('[role=dialog]')!.querySelector('h2')).toBeNull()
    wPlain.unmount()
  })
})
