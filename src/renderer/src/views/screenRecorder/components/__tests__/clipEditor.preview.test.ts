// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ClipEditor from '../ClipEditor.vue'

/**
 * B57-10a 回归钉：剪辑列表「预览」不是半成品。
 * previewClip 真实跑片段渲染（ffmpeg，耗时），产物必须交给系统播放器打开
 * （system.openPath）并给出成功 toast；渲染进行中按钮防重入，不得并发发起。
 */

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
}))
vi.mock('@composables/useToast', () => ({ useToast: () => toastMock }))

const previewClipMock = vi.hoisted(() => vi.fn<() => Promise<string>>())
const clipsRef = vi.hoisted(() => ({ value: [] as unknown[] }))
vi.mock('@composables/useVideoClip', async () => {
  // clips 必须是真 ref：模板 v-for / 子组件 props 依赖 setup 返回值的自动解包
  const { ref } = await import('vue')
  void clipsRef
  return {
    useVideoClip: () => ({
      clips: ref([{ id: 'c1', startTime: 1, endTime: 5, label: '片段一' }]),
      loading: ref(false),
      exporting: ref(false),
      exportProgress: ref(0),
      videoInfo: ref(null),
      addClip: vi.fn(),
      removeClip: vi.fn(),
      updateClip: vi.fn(),
      clearClips: vi.fn(),
      previewClip: previewClipMock,
      exportClips: vi.fn(),
      formatTime: (s: number): string => `${s}s`,
      init: vi.fn(async () => {}),
      loadVideoInfo: vi.fn(async () => {})
    })
  }
})

const openPathMock = vi.fn(async () => ({}))

beforeEach(() => {
  previewClipMock.mockReset()
  openPathMock.mockClear()
  toastMock.success.mockClear()
  toastMock.error.mockClear()
  ;(window as unknown as { api: unknown }).api = {
    system: { openPath: openPathMock },
    clip: {}
  }
})

const flush = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
}

const mountEditor = (): ReturnType<typeof mount> =>
  mount(ClipEditor, { props: { videoPath: '/movies/demo.webm' } })

const previewBtn = (w: ReturnType<typeof mount>) =>
  w.findAll('button').find((b) => b.text().includes('预览'))!

describe('ClipEditor 预览闭环（B57-10a）', () => {
  it('预览成功：产物交给系统播放器打开并弹成功提示', async () => {
    previewClipMock.mockResolvedValue('/tmp/preview-1.mp4')
    const w = mountEditor()
    await flush()
    await previewBtn(w).trigger('click')
    await flush()
    expect(previewClipMock).toHaveBeenCalledTimes(1)
    expect(openPathMock).toHaveBeenCalledWith('/tmp/preview-1.mp4')
    expect(toastMock.success).toHaveBeenCalled()
  })

  it('预览进行中：重复点击不并发发起第二次渲染', async () => {
    let resolvePreview!: (v: string) => void
    previewClipMock.mockReturnValue(
      new Promise<string>((r) => {
        resolvePreview = r
      })
    )
    const w = mountEditor()
    await flush()
    await previewBtn(w).trigger('click')
    await previewBtn(w).trigger('click')
    resolvePreview('/tmp/preview-2.mp4')
    await flush()
    expect(previewClipMock).toHaveBeenCalledTimes(1)
    expect(openPathMock).toHaveBeenCalledWith('/tmp/preview-2.mp4')
  })
})
