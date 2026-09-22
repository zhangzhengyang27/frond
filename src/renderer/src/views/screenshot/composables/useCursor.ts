import { computed } from 'vue'
import { useStore, getValue } from './useScreenshotsContext'

export interface CursorDispatcher {
  set: (cursor: string) => void
  reset: () => void
}

export function useCursor(): [string | undefined, CursorDispatcher] {
  const store = useStore()
  const cursor = computed(() => getValue(store.cursor))
  // 历史遗留取法：从 store 上取 dispatcher（保持既有运行时行为不变）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatcher = (store as any).dispatcher

  const set = (newCursor: string): void => {
    dispatcher?.setCursor(newCursor)
  }

  const reset = (): void => {
    dispatcher?.setCursor('move')
  }

  return [
    cursor.value,
    {
      set,
      reset
    }
  ]
}
