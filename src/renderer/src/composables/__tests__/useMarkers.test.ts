import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

/**
 * useMarkers 竞态守卫（B50）：回放列表快速换片时，慢的旧请求晚到，
 * 不得把上一个录制的标记列表留在面板上。
 */

let deferreds: Array<{ resolve: (v: unknown[]) => void }> = []

beforeEach(() => {
  deferreds = []
  ;(globalThis as unknown as { window: unknown }).window = {
    api: {
      marker: {
        getMarkers: vi.fn(
          (id: string) =>
            new Promise<unknown[]>((resolve) => {
              deferreds.push({
                resolve: (v) =>
                  resolve((v as Array<Record<string, unknown>>).map((m) => ({ ...m, id })))
              })
            })
        )
      }
    }
  }
})

describe('useMarkers 乱序回写防护', () => {
  it('慢的旧请求晚到，不覆盖新选择的标记列表', async () => {
    const { useMarkers } = await import('../useMarkers')
    const recordingId = ref<string | null>(null)
    const { markers, loadMarkers } = useMarkers(recordingId)

    // B57-7 起 markers 视图跟随 recordingId（真实组件 = watch ref 后隐式加载）
    recordingId.value = 'rec-a'
    const p1 = loadMarkers()
    recordingId.value = 'rec-b'
    const p2 = loadMarkers()
    // 后发的 rec-b 先回来
    deferreds[1]!.resolve([{ timestamp: 2, label: 'b1' }])
    await p2
    expect(markers.value.map((m) => m.label)).toEqual(['b1'])

    // rec-a 的慢响应后到：写回 store('rec-a')，绝不污染当前视图（rec-b）
    deferreds[0]!.resolve([
      { timestamp: 1, label: 'a1' },
      { timestamp: 3, label: 'a2' }
    ])
    await p1
    expect(markers.value.map((m) => m.label)).toEqual(['b1'])
  })
})
