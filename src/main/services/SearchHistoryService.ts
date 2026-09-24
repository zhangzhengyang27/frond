/**
 * Frond · 搜索历史服务（P2-9）
 *
 * 记录启动器胶囊中的搜索词，空查询时作为建议展示，点击可复用。
 * 存储：electron-store，最多 20 条，去重（同词提到最前）。
 */
import Store from 'electron-store'
import { typedHandle } from '../ipc/typedIpc'

interface SearchHistoryStore {
  searchHistory?: string[]
}

const store = new Store<SearchHistoryStore>()
const STORE_KEY = 'searchHistory' as const
const MAX_HISTORY = 20

export function getSearchHistory(): string[] {
  return store.get(STORE_KEY) ?? []
}

export function addSearchHistory(query: string): string[] {
  const q = query.trim()
  if (!q) return getSearchHistory()
  const history = getSearchHistory().filter((item) => item.toLowerCase() !== q.toLowerCase())
  history.unshift(q)
  const trimmed = history.slice(0, MAX_HISTORY)
  store.set(STORE_KEY, trimmed)
  return trimmed
}

export function clearSearchHistory(): void {
  store.delete(STORE_KEY)
}

export function registerSearchHistoryIpc(): void {
  typedHandle('search:history:get', () => getSearchHistory())
  typedHandle('search:history:add', (_e, req) => addSearchHistory(req.query))
  typedHandle('search:history:clear', () => {
    clearSearchHistory()
    return true
  })
}
