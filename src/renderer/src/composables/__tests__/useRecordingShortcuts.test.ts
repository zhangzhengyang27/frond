// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

/**
 * B57-6 回归钉：快捷键/倒计时监听器挂 Layout 层（模块常驻）。
 *  1. 监听器同步挂载：事件分发即触发动作（任意标签页有效）
 *  2. 卸载后监听器全部摘除（不留僵尸监听）
 *  3. P2-1：attach IPC 期间卸载——resolve 后监听器必须被立即摘除（不再永久泄漏）
 */

const actionsMock = vi.hoisted(() => ({
  shortcutStart: vi.fn(),
  shortcutPause: vi.fn(),
  beginAfterCountdown: vi.fn()
}))
vi.mock('../recordingActions', () => ({
  useRecordingActions: () => actionsMock
}))
vi.mock('../useStreamManager', () => ({
  useStreamManager: () => ({ setCursorScreenPos: vi.fn() })
}))

import { useRecordingShortcuts } from '../useRecordingShortcuts'

let attachResolve: ((v: { ok: boolean }) => void) | null = null

function HostComponent(): ReturnType<typeof defineComponent> {
  return defineComponent({
    setup(_, { expose }) {
      const state = useRecordingShortcuts()
      expose({ state })
      return () => null
    }
  })
}

function dispatch(name: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

beforeEach(() => {
  vi.clearAllMocks()
  attachResolve = null
  ;(window as unknown as { api: unknown }).api = {
    recording: {
      shortcut: {
        attach: vi.fn(
          () =>
            new Promise<{ ok: boolean }>((r) => {
              attachResolve = r
            })
        ),
        detach: vi.fn(async () => ({ ok: true }))
      }
    }
  }
})

describe('useRecordingShortcuts（B57-6）', () => {
  it('监听器同步挂载：快捷键与倒计时事件直达动作', async () => {
    const w = mount(HostComponent())
    dispatch('frond:shortcut-start')
    dispatch('frond:shortcut-togglePause')
    expect(actionsMock.shortcutStart).toHaveBeenCalledTimes(1)
    expect(actionsMock.shortcutPause).toHaveBeenCalledTimes(1)

    dispatch('frond:countdown-tick', { remaining: 3 })
    const state = (w.vm as unknown as { state: { countdownActive: { value: boolean } } }).state
    expect(state.countdownActive.value).toBe(true)

    dispatch('frond:countdown-begun')
    expect(state.countdownActive.value).toBe(false)
    expect(actionsMock.beginAfterCountdown).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('卸载后监听器全部摘除', async () => {
    const w = mount(HostComponent())
    w.unmount()
    dispatch('frond:shortcut-start')
    dispatch('frond:recording-start-after-countdown')
    expect(actionsMock.shortcutStart).not.toHaveBeenCalled()
    expect(actionsMock.beginAfterCountdown).not.toHaveBeenCalled()
    expect(
      (
        window as unknown as {
          api: { recording: { shortcut: { detach: ReturnType<typeof vi.fn> } } }
        }
      ).api.recording.shortcut.detach
    ).toHaveBeenCalled()
  })

  it('P2-1：attach IPC 期间卸载 → resolve 后监听器立即摘除（无泄漏）', async () => {
    const w = mount(HostComponent()) // attach 挂起中
    w.unmount() // 先卸载
    expect(attachResolve).not.toBeNull()
    attachResolve!({ ok: true }) // 此刻 attach 才完成
    await new Promise((r) => setTimeout(r, 0))
    dispatch('frond:shortcut-start')
    expect(actionsMock.shortcutStart).not.toHaveBeenCalled() // 泄漏即会误触发
  })
})
