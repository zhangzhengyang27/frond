<template>
  <ScreenshotsButton title="重做" icon="icon-redo" :disabled="disabled" @click="handleClick" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore, getValue } from '../../composables/useScreenshotsContext'
import { HistoryItemType } from '../../types'
import ScreenshotsButton from '../ScreenshotsButton.vue'

const store = useStore()
const history = computed(() => getValue(store.history))

const disabled = computed(
  () => !history.value.stack.length || history.value.stack.length - 1 === history.value.index
)

const handleClick = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyDispatcher = (store as any).dispatcher?.setHistory
  if (!historyDispatcher) return

  const { index, stack } = history.value
  const item = stack[index + 1]

  if (item) {
    if (item.type === HistoryItemType.Source) {
      // 重做 = 恢复该图形为选中态（undo 时已被置 false）
      item.isSelected = true
    } else if (item.type === HistoryItemType.Edit) {
      item.source.editHistory.push(item)
    }
  }

  historyDispatcher({
    index: index >= stack.length - 1 ? stack.length - 1 : index + 1,
    stack
  })
}
</script>
