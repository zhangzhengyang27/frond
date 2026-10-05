// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsModal from '../SettingsModal.vue'
import { useSettingsModal } from '@composables/useSettingsModal'

/**
 * B58 后续回归钉：设置弹窗形态（主窗/沉浸窗内 = 居中模态浮层）。
 *  - open → 浮层渲染 SettingsView（embedded），遮罩点击/ESC 关闭
 *  - ESC 在 capture 阶段拦截（设置页内输入框聚焦时也能关）
 *  - SettingsView 以 embedded 挂载（高度交宿主、自身 ESC 让位）
 */

vi.mock('@views/SettingsView.vue', async (importOriginal) => {
  const { defineComponent, h } = await import('vue')
  void importOriginal
  return {
    default: defineComponent({
      name: 'SettingsView',
      props: { embedded: { type: Boolean, default: false } },
      setup(props) {
        return () =>
          h('div', { 'data-testid': 'settings-view', 'data-embedded': String(props.embedded) })
      }
    })
  }
})

beforeEach(() => {
  useSettingsModal().close()
})

describe('SettingsModal（设置弹窗形态）', () => {
  it('open → 渲染 embedded SettingsView；遮罩点击关闭', async () => {
    const w = mount(SettingsModal, { attachTo: document.body })
    const q = (): Element | null => document.body.querySelector('[data-testid="settings-modal"]')
    expect(q()).toBeNull()

    useSettingsModal().open()
    await w.vm.$nextTick()
    expect(q()).not.toBeNull()
    expect(
      document.body.querySelector('[data-testid="settings-view"]')?.getAttribute('data-embedded')
    ).toBe('true')

    q()!.dispatchEvent(new MouseEvent('click', { bubbles: true })) // 落在遮罩自身
    await w.vm.$nextTick()
    expect(q()).toBeNull()
    w.unmount()
  })

  it('ESC 关闭（capture 阶段，输入框聚焦同样生效）', async () => {
    const w = mount(SettingsModal, { attachTo: document.body })
    useSettingsModal().open()
    await w.vm.$nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(useSettingsModal().isOpen.value).toBe(false)
    w.unmount()
  })

  it('非 ESC 按键不关闭', async () => {
    const w = mount(SettingsModal, { attachTo: document.body })
    useSettingsModal().open()
    await w.vm.$nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await w.vm.$nextTick()
    expect(useSettingsModal().isOpen.value).toBe(true)
    w.unmount()
  })
})
