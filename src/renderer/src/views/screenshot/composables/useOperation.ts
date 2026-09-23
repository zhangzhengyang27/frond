import { computed, type ComputedRef } from 'vue'
import { useStore, useDispatcher, getValue } from './useScreenshotsContext'

export interface OperationDispatcher {
  set: (operation: string) => void
  reset: () => void
}

export function useOperation(): [ComputedRef<string | undefined>, OperationDispatcher] {
  const store = useStore()
  const operation = computed(() => getValue(store.operation))
  // dispatcher 是 context 里与 store 平级的那一份；从前写成 (store as any).dispatcher
  // 取到的是 undefined，于是 setOperation 静默空转 —— 点任何工具都没有反应
  const dispatcher = useDispatcher()

  const set = (newOperation: string): void => {
    dispatcher.setOperation?.(newOperation)
  }

  const reset = (): void => {
    dispatcher.setOperation?.(undefined)
  }

  // 必须把 computed 交出去：早先是 `return [operation.value, ...]`，
  // 组件在 setup 期拿到的就是那一刻的字符串，此后选中态永远不再变
  return [operation, { set, reset }]
}
