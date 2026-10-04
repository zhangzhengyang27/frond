// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMarkers } from '../useMarkers'

/**
 * B57-7 回归钉：useMarkers 按 recordingId 单例化。
 * 旧实现每次调用创建独立 markers ref——PlaybackPanel 与 MarkersPanel 各持
 * 一份实例：面板里增删改只刷新自己的列表，回放页时间轴 overlay 永不更新
 * （直到重新选片）。修复：同 recordingId 共享同一 store（标记即单一真相）。
 */

const apiMarker = vi.hoisted(() => ({
  getMarkers: vi.fn((_id?: string): Promise<unknown[]> => Promise.resolve([])),
  addMarker: vi.fn((_id?: string, _ts?: number, _label?: string): Promise<unknown> =>
    Promise.resolve(null)
  ),
  removeMarker: vi.fn(async (): Promise<boolean> => true),
  updateMarker: vi.fn(async (): Promise<unknown> => null),
  clearMarkers: vi.fn(async (): Promise<void> => undefined),
  exportToCSV: vi.fn(async (): Promise<string> => 'label,timestamp')
}))

beforeEach(() => {
  apiMarker.getMarkers.mockReset()
  apiMarker.addMarker.mockReset()
  apiMarker.removeMarker.mockReset()
  apiMarker.getMarkers.mockResolvedValue([])
  apiMarker.addMarker.mockResolvedValue({ id: 'm9', timestamp: 5, label: '新标记' })
  ;(window as unknown as { api: unknown }).api = { marker: apiMarker }
})

describe('useMarkers 按 recordingId 共享（B57-7）', () => {
  it('同 recordingId 的两个实例共享列表：一侧添加、另一侧立即可见', async () => {
    apiMarker.getMarkers.mockResolvedValue([
      { id: 'm9', timestamp: 5, label: '新标记', color: '#3b82f6' }
    ])
    const panel = useMarkers('r1') // MarkersPanel 视角
    const playback = useMarkers('r1') // PlaybackPanel 视角

    await panel.loadMarkers()
    expect(playback.markers.value).toHaveLength(1) // 同一 store，非重复拉取的平行实例

    await panel.addMarker(5, '新标记')
    // addMarker 内部 loadMarkers 刷新共享 store——playback 无需自己重拉
    expect(playback.markers.value).toHaveLength(1)
    expect(apiMarker.getMarkers).toHaveBeenCalledTimes(2) // 初载 + add 后刷新（共享后无第三次）
  })

  it('不同 recordingId 相互隔离', async () => {
    apiMarker.getMarkers.mockImplementation(async (id?: string) =>
      id === 'rA' ? [{ id: 'ma', timestamp: 1, label: 'A' }] : []
    )
    const a = useMarkers('rA')
    const b = useMarkers('rB')
    await a.loadMarkers()
    expect(a.markers.value).toHaveLength(1)
    expect(b.markers.value).toHaveLength(0)
  })

  it('传入 Ref 时动态跟随：id 变化后读写落到新 store', async () => {
    const { ref } = await import('vue')
    const idRef = ref<string | null>(null)
    const w = useMarkers(idRef)
    await w.loadMarkers() // id 为 null：不发请求
    expect(apiMarker.getMarkers).not.toHaveBeenCalled()

    idRef.value = 'rC'
    apiMarker.getMarkers.mockResolvedValue([{ id: 'mc', timestamp: 2, label: 'C' }])
    await w.loadMarkers()
    expect(w.markers.value).toHaveLength(1)
  })
})
