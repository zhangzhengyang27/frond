import { computed } from 'vue'
import type { Bounds } from '../types'
import { useStore, getValue } from './useScreenshotsContext'

export interface BoundsDispatcher {
  set: (bounds: Bounds | null) => void
  reset: () => void
}

export function useBounds(): [Bounds | null, BoundsDispatcher] {
  const store = useStore()
  const bounds = computed(() => getValue(store.bounds))
  // 历史遗留取法：从 store 上取 dispatcher（保持既有运行时行为不变）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatcher = (store as any).dispatcher

  const set = (newBounds: Bounds | null): void => {
    dispatcher?.setBounds(newBounds)
  }

  const reset = (): void => {
    dispatcher?.setBounds(null)
  }

  return [
    bounds.value,
    {
      set,
      reset
    }
  ]
}
