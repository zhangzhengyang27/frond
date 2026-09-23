import { computed, type ComputedRef } from 'vue'
import { useStore, useDispatcher, getValue } from './useScreenshotsContext'

export interface CursorDispatcher {
  set: (cursor: string) => void
  reset: () => void
}

export function useCursor(): [ComputedRef<string | undefined>, CursorDispatcher] {
  const store = useStore()
  const cursor = computed(() => getValue(store.cursor))
  // 与 useOperation 同一处修法：dispatcher 在 context 里与 store 平级，
  // 从 (store as any).dispatcher 取永远是 undefined
  const dispatcher = useDispatcher()

  const set = (newCursor: string): void => {
    dispatcher.setCursor?.(newCursor)
  }

  const reset = (): void => {
    dispatcher.setCursor?.('move')
  }

  // 交 computed，不交那一刻的快照（否则消费者拿到的选中态永不更新）
  return [cursor, { set, reset }]
}
