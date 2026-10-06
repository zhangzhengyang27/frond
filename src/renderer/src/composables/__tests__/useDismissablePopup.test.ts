// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { useDismissablePopup } from '../useDismissablePopup'

/**
 * useDismissablePopup（B54）：非模态浮层（右键菜单 / 声景选择 / 历史浮层）的
 * 统一收口——Esc 关闭 + 外点关闭。此前 SnippetList/Editor 的右键菜单只靠
 * document click 收（无 Esc、无 role），pomodoro 两个浮层的外点处理器是
 * 明确的 no-op 存根。契约：
 * - open 时按 Esc → onClose（且仅触发一次）
 * - open 时容器外 pointerdown → onClose；容器内不关
 * - 未 open 时事件全部忽略；组件卸载自动摘监听
 */

const Host = defineComponent({
  props: { open: { type: Boolean, default: false } },
  emits: ['close'],
  setup(props, { emit, expose }) {
    const container = ref<HTMLElement | null>(null)
    useDismissablePopup(
      container,
      () => props.open,
      () => emit('close')
    )
    expose({ container })
    return { container }
  },
  template: `
    <div>
      <button data-test="outside">外部</button>
      <div ref="container" data-test="container">
        <button data-test="inside">内部</button>
      </div>
    </div>`
})

const pressEsc = (): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

describe('useDismissablePopup', () => {
  it('ignore 元素（开关按钮本身）的外点不关闭', async () => {
    const onClose = vi.fn()
    const toggle = ref<HTMLElement | null>(null)
    const open = ref(true)
    const container = ref<HTMLElement | null>(null)
    mount(
      defineComponent({
        setup() {
          useDismissablePopup(container, open, onClose, { ignore: [toggle] })
          return { container, toggle }
        },
        template: `<div><button ref="toggle" data-test="toggle">开关</button>
          <div ref="container" data-test="container">菜单</div></div>`
      }),
      { attachTo: document.body }
    )
    toggle.value!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(onClose).not.toHaveBeenCalled()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('open 时按 Esc 关闭；已关后 Esc 不再触发', async () => {
    const w = mount(Host, { props: { open: true } })
    pressEsc()
    expect(w.emitted('close')).toHaveLength(1)
    await w.setProps({ open: false })
    pressEsc()
    expect(w.emitted('close')).toHaveLength(1)
    w.unmount()
  })

  it('open 时容器外 pointerdown 关闭、容器内不关', async () => {
    const w = mount(Host, { props: { open: true } })
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(w.emitted('close')).toHaveLength(1)
    await w.setProps({ open: true })
    w.find('[data-test="inside"]').element.dispatchEvent(
      new Event('pointerdown', { bubbles: true })
    )
    expect(w.emitted('close')).toHaveLength(1)
    w.unmount()
  })

  it('未 open 时外点/Esc 全部忽略', async () => {
    const w = mount(Host, { props: { open: false } })
    pressEsc()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(w.emitted('close')).toBeUndefined()
    w.unmount()
  })
})
