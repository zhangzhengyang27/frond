/**
 * Leaf · B1 搜索历史 ↑ 恢复（自 LauncherApp.vue 抽出）
 *
 * 空查询按 ↑ 进入历史导航：游标 -1 = 空查询态，0..n-1 对应最近搜索词。
 * historyNavApplying 标记程序性回填，防止 watch(query) 误判为用户键入而退出导航。
 */
import { nextTick, ref, type Ref } from 'vue'
import { nextHistoryCursor } from './launcherInteractions'

export function useSearchHistoryNav(query: Ref<string>) {
  const historyCache = ref<string[]>([])
  const historyNavActive = ref(false)
  const historyCursor = ref(-1)
  const historyNavApplying = ref(false)

  function exitHistoryNav(): void {
    historyNavActive.value = false
    historyCursor.value = -1
  }

  /** 历史缓存为空时兜底重取（正常已在 refreshSuggestions 中填充） */
  function loadHistoryCache(): void {
    void window.api.searchHistory
      .get()
      .then((history) => {
        historyCache.value = history as string[]
      })
      .catch(() => {})
  }

  function applyHistoryCursor(cursor: number): void {
    historyNavApplying.value = true
    query.value = cursor >= 0 ? (historyCache.value[cursor] ?? '') : ''
    void nextTick(() => {
      historyNavApplying.value = false
    })
  }

  /** 空查询按 ↑：进入历史导航并回填最新一条；返回 false = 无历史（调用方回落通用 ↑） */
  function enterHistoryNav(): boolean {
    if (historyCache.value.length === 0) loadHistoryCache()
    historyNavActive.value = true
    historyCursor.value = -1
    stepHistoryNav('up')
    return historyNavActive.value && historyCache.value.length > 0
  }

  /** 历史导航内 ↑/↓ 循环推进并回填；无历史时静默退出 */
  function stepHistoryNav(direction: 'up' | 'down'): void {
    const list = historyCache.value
    if (list.length === 0) {
      exitHistoryNav()
      return
    }
    historyCursor.value = nextHistoryCursor(historyCursor.value, list.length, direction)
    applyHistoryCursor(historyCursor.value)
  }

  return {
    historyCache,
    historyNavActive,
    // 消费方靠它区分「程序回填」与「用户键入」，漏了这一句外面拿到 undefined，
    // `!undefined && active` 直接把历史导航踢掉（文件头写的那个保护就没了）
    historyNavApplying,
    exitHistoryNav,
    loadHistoryCache,
    enterHistoryNav,
    stepHistoryNav
  }
}
