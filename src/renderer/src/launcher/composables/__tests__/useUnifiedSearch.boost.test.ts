// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

/**
 * P-3 frecency 全类型：异步三路（文件/剪贴板/片段）不再吃固定分，
 * usageBoost 叠进 score 后可以重排（常用文件/条目反超）。
 */

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    fileSearch: {
      query: vi.fn(async () => ({
        items: [{ path: '/tmp/F.pdf', name: 'F.pdf', dir: '/tmp' }]
      }))
    },
    clipHist: {
      search: vi.fn(async () => [
        { id: 'B', kind: 'text', text: 'B-item' },
        { id: 'A', kind: 'text', text: 'A-item' }
      ])
    },
    snippet: {
      quickSearch: vi.fn(async () => [{ id: 'S1', name: 'S1', language: 'ts' }])
    }
  }
})

describe('useUnifiedSearch 异步三路 frecency boost（P-3）', () => {
  it('boost 叠进 score：常用文件/剪贴板条目反超未加权行', async () => {
    const { useUnifiedSearch } = await import('../useUnifiedSearch')
    const suggestions = ref([])
    const { results, runUnifiedSearch } = useUnifiedSearch({
      entries: () => [],
      favorites: ref([]),
      suggestions,
      // F.pdf 与 clip:B 是「高频近期使用」：+70（boost 上限）
      usageBoost: ((entry: { key: string }) =>
        entry.key === 'file:/tmp/F.pdf' || entry.key === 'clip:B' ? 70 : 0) as never
    })
    await runUnifiedSearch('q')
    expect(results.value.map((r) => r.entry.key)).toEqual([
      'file:/tmp/F.pdf', // 50 + 70 = 120
      'clip:B', // 40 + 70 = 110（主进程返回序在后的 B 反超 A）
      'snip:S1', // 45 + 0
      'clip:A' // 40 + 0
    ])
  })

  it('boost 全 0 时维持原固定分相对序（不回归 P-6④ 基线）', async () => {
    const { useUnifiedSearch } = await import('../useUnifiedSearch')
    const suggestions = ref([])
    const { results, runUnifiedSearch } = useUnifiedSearch({
      entries: () => [],
      favorites: ref([]),
      suggestions,
      usageBoost: () => 0
    })
    await runUnifiedSearch('q')
    expect(results.value.map((r) => r.entry.key)).toEqual([
      'file:/tmp/F.pdf', // 50
      'snip:S1', // 45
      'clip:B', // 40
      'clip:A' // 40
    ])
  })
})
