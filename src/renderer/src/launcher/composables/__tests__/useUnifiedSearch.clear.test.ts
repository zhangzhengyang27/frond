// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

/**
 * useUnifiedSearch 清空查询竞态（B50）：空查询分支只把 results 换成建议列表，
 * 不递增 token——若上一轮 runUnifiedSearch 的 Promise.all 已在飞，50-500ms 后
 * 旧的文件/剪贴板/片段行会通过 token 校验，把建议列表顶掉。
 * 修复后：回到建议列表同样作废在飞轮次。
 */

let clipDeferred: { resolve: (v: unknown[]) => void } | null = null

beforeEach(() => {
  clipDeferred = null
  ;(window as unknown as { api: unknown }).api = {
    clipHist: {
      // B53-3a 后根搜索走 cliphist:search（主进程侧过滤）
      search: vi.fn(
        () =>
          new Promise<unknown[]>((resolve) => {
            clipDeferred = { resolve }
          })
      )
    },
    snippet: { quickSearch: vi.fn(async () => []) },
    findFiles: vi.fn(async () => ({ items: [] }))
  }
})

describe('useUnifiedSearch 清空查询作废在飞轮次（B50）', () => {
  it('清空后旧搜索结果不得顶掉建议列表', async () => {
    vi.useFakeTimers()
    const { useUnifiedSearch } = await import('../useUnifiedSearch')
    const suggestions = ref<never[]>([])
    const { results, runUnifiedSearch, scheduleForQuery } = useUnifiedSearch({
      entries: () => [],
      favorites: ref([]),
      suggestions,
      usageBoost: () => 1
    } as unknown as Parameters<typeof useUnifiedSearch>[0])

    // 键入触发防抖搜索（clipHist.list 挂起）
    scheduleForQuery('abc')
    await vi.advanceTimersByTimeAsync(200) // 150ms 防抖 + 让 Promise.all 进入挂起
    expect(clipDeferred).not.toBeNull()

    // 清空查询：应立即回建议列表并作废在飞轮次
    scheduleForQuery('')
    expect(results.value).toBe(suggestions.value)

    // 旧搜索晚到：不得覆盖建议列表
    clipDeferred!.resolve([{ id: 'c1', kind: 'text', text: 'abc' }])
    await vi.advanceTimersByTimeAsync(50)
    expect(results.value).toBe(suggestions.value)

    // runUnifiedSearch 直连路径同样守卫（快速清空后旧轮落回）
    const direct = runUnifiedSearch('def')
    await vi.advanceTimersByTimeAsync(0)
    scheduleForQuery('')
    clipDeferred!.resolve([{ id: 'c2', kind: 'text', text: 'def' }])
    await direct
    expect(results.value).toBe(suggestions.value)
  })
})
