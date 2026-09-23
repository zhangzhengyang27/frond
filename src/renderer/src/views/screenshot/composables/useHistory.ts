import { computed } from 'vue'
import type { History, HistoryItem } from '../types'
import { HistoryItemType } from '../types'
import { useStore, useDispatcher, getValue } from './useScreenshotsContext'

export interface HistoryValue extends History {
  top?: HistoryItem<unknown, unknown>
}

export interface HistoryDispatcher {
  push: <S, E>(action: HistoryItem<S, E>) => void
  pop: () => void
  undo: () => void
  redo: () => void
  set: (history: History) => void
  select: <S, E>(action: HistoryItem<S, E>) => void
  clearSelect: () => void
  reset: () => void
}

export function useHistory(): [HistoryValue, HistoryDispatcher] {
  const store = useStore()
  const history = computed(() => getValue(store.history))
  // dispatcher 在 context 里与 store 平级；写成 (store as any).dispatcher 永远取到
  // undefined，于是 push/undo/redo 全是空转（工具画不出图形、撤销按钮永不自检）
  const dispatcher = useDispatcher()

  const push = <S, E>(action: HistoryItem<S, E>): void => {
    const { index, stack } = history.value

    stack.forEach((item) => {
      if (item.type === HistoryItemType.Source) {
        item.isSelected = false
      }
    })

    if (action.type === HistoryItemType.Source) {
      action.isSelected = true
    } else if (action.type === HistoryItemType.Edit) {
      action.source.isSelected = true
    }

    const newStack = stack.slice(0, index + 1)
    newStack.push(action)

    dispatcher.setHistory?.({
      index: newStack.length - 1,
      stack: newStack
    })
  }

  const pop = (): void => {
    const { stack } = history.value
    const newStack = stack.slice()
    newStack.pop()

    dispatcher.setHistory?.({
      index: newStack.length - 1,
      stack: newStack
    })
  }

  const undo = (): void => {
    const { index, stack } = history.value
    const newStack = [...stack]
    const item = newStack[index]

    if (item) {
      if (item.type === HistoryItemType.Source) {
        item.isSelected = false
      } else if (item.type === HistoryItemType.Edit) {
        item.source.editHistory.pop()
      }
    }

    dispatcher.setHistory?.({
      index: index <= 0 ? -1 : index - 1,
      stack: newStack
    })
  }

  const redo = (): void => {
    const { index, stack } = history.value
    const newStack = [...stack]
    const item = newStack[index + 1]

    if (item) {
      if (item.type === HistoryItemType.Source) {
        item.isSelected = false
      } else if (item.type === HistoryItemType.Edit) {
        item.source.editHistory.push(item)
      }
    }

    dispatcher.setHistory?.({
      index: index >= newStack.length - 1 ? newStack.length - 1 : index + 1,
      stack: newStack
    })
  }

  const set = (newHistory: History): void => {
    dispatcher.setHistory?.({ ...newHistory })
  }

  const select = <S, E>(action: HistoryItem<S, E>): void => {
    const { stack } = history.value
    const newStack = [...stack]
    newStack.forEach((item) => {
      if (item.type === HistoryItemType.Source) {
        if (item === action) {
          item.isSelected = true
        } else {
          item.isSelected = false
        }
      }
    })
    dispatcher.setHistory?.({ ...history.value, stack: newStack })
  }

  const clearSelect = (): void => {
    const { stack } = history.value
    const newStack = [...stack]
    newStack.forEach((item) => {
      if (item.type === HistoryItemType.Source) {
        item.isSelected = false
      }
    })

    dispatcher.setHistory?.({ ...history.value, stack: newStack })
  }

  const reset = (): void => {
    dispatcher.setHistory?.({
      index: -1,
      stack: []
    })
  }

  return [
    {
      // 必须用 getter：组件在挂载时（stack 为空）拿到的是引用快照，
      // 若平铺求值则 top/index/stack 永远停留在初始值，导致
      // 「history.top !== x」判断恒真 → 拖动时每帧重复 push 历史（图形飞出画布、撤销失效）
      get index(): number {
        return history.value.index
      },
      get stack(): HistoryItem<unknown, unknown>[] {
        return history.value.stack
      },
      get top(): HistoryItem<unknown, unknown> | undefined {
        return history.value.stack[history.value.index]
      }
    },
    {
      push,
      pop,
      undo,
      redo,
      set,
      select,
      clearSelect,
      reset
    }
  ]
}
