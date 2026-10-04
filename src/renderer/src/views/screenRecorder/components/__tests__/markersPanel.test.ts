// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkersPanel from '../MarkersPanel.vue'

/**
 * MarkersPanel 的渲染契约（B44 重建件判别性断言）
 *
 * 断言盯「列表行为与事件」，不盯样式：
 * - recordingId 变化 → getMarkers 拉取并渲染（时间戳排序）
 * - 点行 → jumpToMarker(timestamp)；删除 → removeMarker(id)
 * - 空态文案；导出按钮触发 exportToCSV
 */

const markers = [
  { id: 'm1', label: '开场', timestamp: 5, color: '#3b82f6' },
  { id: 'm2', label: '重点', timestamp: 42, color: '#ef4444' }
]

const confirmMock = vi.hoisted(() => vi.fn(async () => true))
vi.mock('@composables/useConfirm', () => ({
  confirm: confirmMock
}))

const apiMarker = vi.hoisted(() => ({
  getMarkers: vi.fn(async (): Promise<unknown[]> => []),
  removeMarker: vi.fn(async () => true),
  exportToCSV: vi.fn(async () => 'label,timestamp'),
  addMarker: vi.fn(async () => null),
  updateMarker: vi.fn(async () => null),
  clearMarkers: vi.fn(async () => undefined)
}))

beforeEach(() => {
  // mockReset：连 Once 队列一起清，防跨用例泄漏（上条用例没消费完的 Once 会顶掉本条）
  apiMarker.getMarkers.mockReset()
  apiMarker.removeMarker.mockReset()
  apiMarker.exportToCSV.mockReset()
  confirmMock.mockClear()
  apiMarker.getMarkers.mockResolvedValue([])
  apiMarker.removeMarker.mockResolvedValue(true)
  ;(window as unknown as { api: unknown }).api = { marker: apiMarker }
})

const setup = async (list: Array<{ id: string; label: string; timestamp: number; color?: string }>): Promise<ReturnType<typeof mount>> => {
  apiMarker.getMarkers.mockResolvedValue(list)
  const w = mount(MarkersPanel, {
    props: { recordingId: 'r1', isRecording: false, recordingTime: 0, duration: 100 }
  })
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
  return w
}

describe('MarkersPanel 契约（B44）', () => {
  it('拉取并渲染标记列表，按时间戳排序', async () => {
    const w = await setup([
      { id: 'm2', label: '后加的', timestamp: 42 },
      { id: 'm1', label: '先加的', timestamp: 5 }
    ])
    expect(apiMarker.getMarkers).toHaveBeenCalledWith('r1')
    const rows = w.findAll('.space-y-2 > div')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('先加的')
    expect(rows[1]!.text()).toContain('后加的')
  })

  it('点击标记行发出 jumpToMarker(timestamp)', async () => {
    const w = await setup(markers)
    const row = w.findAll('.space-y-2 > div').find((r) => r.text().includes('开场'))!
    // 跳转是行内独立的播放按钮（行本体无点击语义）
    const jumpBtn = row.findAll('button').find((b) => b.attributes('title') === '跳转到标记时间点')!
    await jumpBtn.trigger('click')
    expect(w.emitted('jumpToMarker')![0]![0]).toBe(5)
  })

  it('删除标记：调用 removeMarker 且列表刷新', async () => {
    const w = await setup(markers)
    apiMarker.getMarkers.mockResolvedValueOnce([markers[0]!])
    const row = w.findAll('.space-y-2 > div').find((r) => r.text().includes('开场'))!
    const delBtn = row.findAll('button').find((b) => b.attributes('title') === '删除标记')!
    await delBtn.trigger('click')
    // useConfirm 二次确认（mock 直接确认）
    await new Promise((r) => setTimeout(r, 0))
    expect(confirmMock).toHaveBeenCalled()
    expect(apiMarker.removeMarker).toHaveBeenCalledWith('r1', 'm1')
  })

  it('空态：显示暂无标记', async () => {
    const w = await setup([])
    expect(w.text()).toContain('暂无标记')
  })

  it('导出按钮触发 exportToCSV', async () => {
    const w = await setup(markers)
    const exportBtn = w.findAll('button').find((b) => b.text().includes('导出'))!
    await exportBtn.trigger('click')
    expect(apiMarker.exportToCSV).toHaveBeenCalledWith('r1')
  })
})
