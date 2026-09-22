import { computed } from 'vue'
import { useStore, getValue } from './useScreenshotsContext'

export interface OperationDispatcher {
  set: (operation: string) => void
  reset: () => void
}

export function useOperation(): [string | undefined, OperationDispatcher] {
  const store = useStore()
  const operation = computed(() => getValue(store.operation))
  // 历史遗留取法：从 store 上取 dispatcher（保持既有运行时行为不变）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatcher = (store as any).dispatcher

  const set = (newOperation: string): void => {
    dispatcher?.setOperation(newOperation)
  }

  const reset = (): void => {
    dispatcher?.setOperation(undefined)
  }

  return [
    operation.value,
    {
      set,
      reset
    }
  ]
}
