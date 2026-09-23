import { computed, type ComputedRef } from 'vue'
import type { Bounds } from '../types'
import { useStore, useDispatcher, getValue } from './useScreenshotsContext'

export interface BoundsDispatcher {
  set: (bounds: Bounds | null) => void
  reset: () => void
}

export function useBounds(): [ComputedRef<Bounds | null>, BoundsDispatcher] {
  const store = useStore()
  const bounds = computed(() => getValue(store.bounds))
  // 与 useOperation/useHistory 同一处修法：dispatcher 在 context 里与 store 平级
  const dispatcher = useDispatcher()

  const set = (newBounds: Bounds | null): void => {
    dispatcher.setBounds?.(newBounds)
  }

  const reset = (): void => {
    dispatcher.setBounds?.(null)
  }

  return [bounds, { set, reset }]
}
