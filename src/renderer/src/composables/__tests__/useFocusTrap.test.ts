// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { useFocusTrap } from '../useFocusTrap'

/**
 * useFocusTrap（B54）：UModal / UDrawer / CommandPalette 各自手写 Tab 循环 +
 * 焦点保存/归还（前两者已有 ~40 行重复）。原语契约：
 * - active 变 true：记录当前焦点 → 聚焦容器内第一个可聚焦元素
 * - active 期间 Tab/Shift+Tab 在容器内循环，不出容器
 * - active 变 false：焦点归还来源元素
 */

const Host = defineComponent({
  attachTo: 'body',
  props: { active: { type: Boolean, default: false } },
  emits: ['closed'],
  setup(props, { expose }) {
    const container = ref<HTMLElement | null>(null)
    useFocusTrap(container, () => props.active)
    expose({ container })
    return { container }
  },
  template: `
    <div>
      <button data-test="outside">外部</button>
      <div ref="container" data-test="container" tabindex="-1">
        <button data-test="first">一</button>
        <input data-test="middle" />
        <button data-test="last">二</button>
      </div>
    </div>`
})

const pressTab = (shift = false): void => {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true })
  )
}

const sleep = async (ms = 25): Promise<void> => {
  await new Promise((r) => setTimeout(r, ms))
  await nextTick()
}

const get = (w: ReturnType<typeof mount>, t: string): HTMLElement =>
  w.find(`[data-test="${t}"]`).element as HTMLElement

describe('useFocusTrap', () => {
  it('激活：来源焦点被记录，容器内第一个可聚焦元素获得焦点', async () => {
    const w = mount(Host, { attachTo: document.body })
    get(w, 'outside').focus()
    await w.setProps({ active: true })
    await sleep()
    expect(document.activeElement).toBe(get(w, 'first'))
    w.unmount()
  })

  it('Tab 在最后一个元素上循环回第一个；Shift+Tab 反向', async () => {
    const w = mount(Host, { props: { active: true }, attachTo: document.body })
    await sleep()
    get(w, 'last').focus()
    pressTab()
    expect(document.activeElement).toBe(get(w, 'first'))
    get(w, 'first').focus()
    pressTab(true)
    expect(document.activeElement).toBe(get(w, 'last'))
    w.unmount()
  })

  it('停用：焦点归还激活前的来源元素', async () => {
    const w = mount(Host, { attachTo: document.body })
    get(w, 'outside').focus()
    await w.setProps({ active: true })
    await sleep()
    expect(document.activeElement).not.toBe(get(w, 'outside'))
    await w.setProps({ active: false })
    await sleep()
    expect(document.activeElement).toBe(get(w, 'outside'))
    w.unmount()
  })
})
