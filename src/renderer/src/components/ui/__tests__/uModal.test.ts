// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UModal from '../UModal.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(UModal, {
    props: { modelValue: true, title: '确认', ...props },
    slots: {
      default: '<button data-a>按钮A</button><button data-b>按钮B</button>',
      footer: '<button data-ok>确定</button>'
    },
    attachTo: document.body
  })
}

describe('UModal', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('渲染 dialog 角色与标题', () => {
    const w = setup()
    const panel = document.body.querySelector('[role=dialog]')
    expect(panel).not.toBeNull()
    expect(panel!.textContent).toContain('确认')
    w.unmount()
  })

  it('Esc 关闭（closeOnEsc 默认开）', () => {
    const w = setup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('update:modelValue')![0]).toEqual([false])
    w.unmount()
  })

  it('closeOnEsc=false 时不关闭', () => {
    const w = setup({ closeOnEsc: false })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('Tab 在末尾时循环回首项（面板内第一个可聚焦 = 头部关闭按钮）', async () => {
    const w = setup()
    await new Promise((r) => requestAnimationFrame(r))
    const panel = document.body.querySelector('[role=dialog]') as HTMLElement
    const ok = panel.querySelector('[data-ok]') as HTMLElement
    ok.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    const closeBtn = panel.querySelector('button[aria-label="关闭"]') as HTMLElement
    expect(document.activeElement).toBe(closeBtn)
    w.unmount()
  })

  it('Shift+Tab 在首项（关闭按钮）时循环回末项', async () => {
    const w = setup()
    await new Promise((r) => requestAnimationFrame(r))
    const panel = document.body.querySelector('[role=dialog]') as HTMLElement
    const closeBtn = panel.querySelector('button[aria-label="关闭"]') as HTMLElement
    closeBtn.focus()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    )
    const ok = panel.querySelector('[data-ok]') as HTMLElement
    expect(document.activeElement).toBe(ok)
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
})
