// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useEditor } from '../useEditor'

/**
 * useEditor 回写抑制（B50c）：loadSettings 的 Object.assign 会触发 9 个 watch，
 * 防抖 500ms 后把「刚读到的值」原样写回——每次挂载多一次 IPC 写。
 * 修复后加载期挂闸，只有用户真实改动才落盘。
 */

const getEditorSettings = vi.fn(async () => ({ fontSize: 18 }))
const updateEditorSettings = vi.fn(async () => undefined)

beforeEach(() => {
  getEditorSettings.mockClear()
  updateEditorSettings.mockClear()
  ;(globalThis as unknown as { window: unknown }).window = {
    api: { preferences: { getEditorSettings, updateEditorSettings } }
  }
})

afterEach(() => {
  vi.useRealTimers()
})

const Host = defineComponent({
  setup() {
    const { settings } = useEditor()
    return { settings }
  },
  template: '<div>{{ settings.fontSize }}</div>'
})

describe('useEditor 加载不触发回写', () => {
  it('挂载加载设置后，防抖窗口内无 updateEditorSettings 调用', async () => {
    vi.useFakeTimers()
    mount(Host)
    await vi.advanceTimersByTimeAsync(600) // 越过 500ms 防抖
    expect(updateEditorSettings).not.toHaveBeenCalled()
  })

  it('加载完成后用户真实改动仍会保存', async () => {
    vi.useFakeTimers()
    const wrapper = mount(Host)
    await vi.advanceTimersByTimeAsync(600)
    expect(updateEditorSettings).not.toHaveBeenCalled()

    wrapper.vm.settings.fontSize = 20
    await vi.advanceTimersByTimeAsync(600)
    expect(updateEditorSettings).toHaveBeenCalledTimes(1)
  })
})
