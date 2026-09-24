// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import PreviewPanel from '../PreviewPanel.vue'

/**
 * PreviewPanel 的渲染契约（重建件判别性断言）
 *
 * 为什么必须测：该文件「原文件被截断，**仅存 39 行真实代码**（脚本尾 + 空的 style 头），
 * 其余为重建」—— 模板、样式、绑定名都是**按存留脚本与 RecordPage 的传参反推**的。
 * 它又是录屏页的中间列：猜错一个按钮的禁用条件，用户就会在错误的时机点到
 * 「停止录制」或「开始录制」。
 *
 * 尤其要紧的一条：**父组件靠 `defineExpose` 的 `previewVideoRef` / `pipCameraRef`
 * 直接挂 `srcObject`**（见文件头注释）。expose 的名字或形状猜错 = **预览永远黑屏**，
 * 而且不报错、不留日志。所以这里显式钉住 expose 的形状。
 */

const formatTime = vi.fn((s: number) => `T${s}`)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试辅助
function baseProps(props: Record<string, unknown> = {}) {
  return {
    hasPreview: true,
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    canRecord: true,
    loading: false,
    showPipCamera: false,
    showRecordingModeHint: false,
    formatTime,
    ...props
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(PreviewPanel, {
    props: baseProps(props),
    global: { stubs: { AppIcon: true } }
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试辅助
const btn = (w: ReturnType<typeof setup>, text: string) =>
  w.findAll('button').find((b) => b.text().includes(text))

beforeEach(() => formatTime.mockClear())

describe('PreviewPanel · defineExpose 的形状（父组件靠它挂 srcObject，错了就是黑屏）', () => {
  /**
   * ⚠ 必须**从父组件视角**测，不能读 `wrapper.vm`：
   * `@vue/test-utils` 的 `vm` 会代理到 setup 内部状态，**绕开 `defineExpose`** ——
   * 实测把 expose 改名成 `previewVideo`/`pipCamera` 后，读 `wrapper.vm.previewVideoRef`
   * 仍然拿得到值，用例照样绿（假绿）。真实用法是父组件用 ref 拿 exposed 面，
   * 所以这里照真实用法 mount 一个父组件。
   */
  it('父组件用 ref 能拿到 previewVideoRef 与 pipCameraRef，且指向两个不同的 video', () => {
    let captured: { previewVideoRef?: unknown; pipCameraRef?: unknown } | null = null
    const Parent = defineComponent({
      setup() {
        return () =>
          h(PreviewPanel, {
            ...baseProps({ showPipCamera: true }),
            ref: (el: unknown) => {
              captured = el as typeof captured
            }
          })
      }
    })
    mount(Parent, { global: { stubs: { AppIcon: true } } })

    expect(captured, '父组件的 ref 拿不到子组件实例').toBeTruthy()
    const exposed = captured as unknown as {
      previewVideoRef: HTMLVideoElement | null
      pipCameraRef: HTMLVideoElement | null
    }
    expect(
      exposed.previewVideoRef,
      'expose 面上没有 previewVideoRef —— 父组件挂不了 srcObject（预览永远黑屏）'
    ).toBeTruthy()
    expect(
      exposed.pipCameraRef,
      'expose 面上没有 pipCameraRef —— 画中画挂不了流'
    ).toBeTruthy()
    // 两个 ref 必须指向**不同**的元素，否则给画中画挂 srcObject 会覆盖主预览
    expect(exposed.previewVideoRef).not.toBe(exposed.pipCameraRef)
    expect(exposed.previewVideoRef!.tagName).toBe('VIDEO')
    expect(exposed.pipCameraRef!.tagName).toBe('VIDEO')
  })
})

describe('PreviewPanel · 按钮集合随录制状态切换', () => {
  it('未录制：只有「开始录制」，没有停止 / 暂停', () => {
    const w = setup({ isRecording: false })
    expect(btn(w, '开始录制')).toBeTruthy()
    expect(btn(w, '停止录制')).toBeUndefined()
    expect(btn(w, '暂停')).toBeUndefined()
    expect(btn(w, '继续')).toBeUndefined()
  })

  it('录制中：有「停止录制」与「暂停」，没有「开始录制」', () => {
    const w = setup({ isRecording: true })
    expect(btn(w, '停止录制')).toBeTruthy()
    expect(btn(w, '暂停')).toBeTruthy()
    expect(btn(w, '开始录制')).toBeUndefined()
  })

  it('「开始录制」在 canRecord=false 或 loading=true 时禁用', () => {
    expect(btn(setup({ canRecord: false }), '开始录制')!.attributes('disabled')).toBeDefined()
    expect(btn(setup({ loading: true }), '开始录制')!.attributes('disabled')).toBeDefined()
    expect(btn(setup({}), '开始录制')!.attributes('disabled')).toBeUndefined()
  })

  it('录制中「保存位置」禁用（不能在录制时改落盘路径）', () => {
    expect(btn(setup({ isRecording: true }), '保存位置')!.attributes('disabled')).toBeDefined()
    expect(btn(setup({ isRecording: false }), '保存位置')!.attributes('disabled')).toBeUndefined()
  })
})

describe('PreviewPanel · 暂停态', () => {
  it('isPaused 决定徽标文案与暂停按钮文案', () => {
    const paused = setup({ isRecording: true, isPaused: true, recordingTime: 5 })
    expect(paused.text()).toContain('已暂停')
    expect(paused.text()).not.toContain('录制中')
    expect(btn(paused, '继续')).toBeTruthy()

    const running = setup({ isRecording: true, isPaused: false, recordingTime: 5 })
    expect(running.text()).toContain('录制中')
    expect(running.text()).not.toContain('已暂停')
    expect(btn(running, '暂停')).toBeTruthy()
  })

  it('徽标里的时长来自父组件传进来的 formatTime（不是组件内自己格式化）', () => {
    const w = setup({ isRecording: true, recordingTime: 125 })
    expect(formatTime).toHaveBeenCalledWith(125)
    expect(w.text()).toContain('T125')
  })

  it('没在录制时不显示录制徽标', () => {
    const w = setup({ isRecording: false })
    expect(w.text()).not.toContain('录制中')
    expect(w.text()).not.toContain('已暂停')
  })
})

describe('PreviewPanel · 可选区块的出现条件', () => {
  it('hasPreview=false 显示占位文案，true 时不显示（负向）', () => {
    expect(setup({ hasPreview: false }).text()).toContain('选择录制源后可在此预览')
    expect(setup({ hasPreview: true }).text()).not.toContain('选择录制源后可在此预览')
  })

  it('showPipCamera 决定画中画 video 是否存在', () => {
    expect(setup({ showPipCamera: true }).findAll('video')).toHaveLength(2)
    expect(setup({ showPipCamera: false }).findAll('video')).toHaveLength(1)
  })

  it('showRecordingModeHint 决定区域录制提示是否出现', () => {
    expect(setup({ showRecordingModeHint: true }).text()).toContain('区域录制')
    expect(setup({ showRecordingModeHint: false }).text()).not.toContain('区域录制')
  })

  it('loading 时显示「准备中…」', () => {
    expect(setup({ loading: true }).text()).toContain('准备中…')
    expect(setup({ loading: false }).text()).not.toContain('准备中…')
  })
})

describe('PreviewPanel · 事件', () => {
  it('五个按钮各发对应事件，且不串（点开始不该同时发停止）', async () => {
    const idle = setup({ isRecording: false })
    await btn(idle, '开始录制')!.trigger('click')
    await btn(idle, '保存位置')!.trigger('click')
    await btn(idle, '设置')!.trigger('click')
    expect(idle.emitted('start-recording')).toHaveLength(1)
    expect(idle.emitted('select-save-path')).toHaveLength(1)
    expect(idle.emitted('open-settings')).toHaveLength(1)
    expect(idle.emitted('stop-recording')).toBeUndefined()
    expect(idle.emitted('toggle-pause')).toBeUndefined()

    const rec = setup({ isRecording: true })
    await btn(rec, '停止录制')!.trigger('click')
    await btn(rec, '暂停')!.trigger('click')
    expect(rec.emitted('stop-recording')).toHaveLength(1)
    expect(rec.emitted('toggle-pause')).toHaveLength(1)
    expect(rec.emitted('start-recording')).toBeUndefined()
  })
})
