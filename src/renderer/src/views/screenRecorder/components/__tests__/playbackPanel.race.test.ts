// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaybackPanel from '../PlaybackPanel.vue'

/**
 * PlaybackPanel 换片竞态（B50）：watch(videoPath) 无 token——选 A 后立刻选 B，
 * A 的 readFile 晚到会 (1) 覆盖 B 的 blob URL；(2) 其开头的 revokeObjectURL 可能把
 * B 正在播的 URL 掉（黑屏）。修复后：过期回调不得触碰 blobUrl。
 */

let deferreds: Array<{ path: string; resolve: (v: ArrayBuffer) => void }> = []

const readFile = vi.fn(
  (path: string) =>
    new Promise<ArrayBuffer>((resolve) => {
      deferreds.push({ path, resolve })
    })
)

let blobSeq = 0
const createObjectURL = vi.fn(() => `blob:u${++blobSeq}`)
const revokeObjectURL = vi.fn()

beforeEach(() => {
  deferreds = []
  blobSeq = 0
  readFile.mockClear()
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  ;(window as unknown as { api: unknown }).api = { video: { readFile } }
  ;(URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL
  ;(URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL
})

const mountPanel = (videoPath: string): ReturnType<typeof mount> =>
  mount(PlaybackPanel, {
    props: { videoPath, hasPreview: true },
    global: { stubs: { MarkersPanel: true } }
  })

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('PlaybackPanel 换片乱序防护（B50）', () => {
  it('A 的 readFile 晚到：不覆盖 B 的 blob URL，也不 revoke 掉 B 正在用的', async () => {
    const wrapper = mountPanel('/rec/a.mp4')
    await flush()
    expect(readFile).toHaveBeenCalledWith('/rec/a.mp4')

    // 立刻切到 B
    await wrapper.setProps({ videoPath: '/rec/b.mp4' })
    await flush()
    expect(readFile).toHaveBeenCalledWith('/rec/b.mp4')

    // B 先回 → URL 建好并正在使用
    deferreds[1]!.resolve(new ArrayBuffer(8))
    await flush()
    const urlB = createObjectURL.mock.results[0]!.value as string
    expect(revokeObjectURL).not.toHaveBeenCalledWith(urlB)

    // A 的慢响应后到：过期回调必须早退，不建新 URL、不 revoke B 的
    deferreds[0]!.resolve(new ArrayBuffer(8))
    await flush()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).not.toHaveBeenCalledWith(urlB)
    // 视频元素仍指向 B 的 blob
    const video = wrapper.find('video').element as HTMLVideoElement
    expect(video.getAttribute('src')).toBe(urlB)
  })
})
