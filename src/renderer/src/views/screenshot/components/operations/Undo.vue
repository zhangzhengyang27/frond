<template>
  <ScreenshotsButton title="撤销" icon="icon-undo" :disabled="disabled" @click="handleClick" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore, getValue } from '../../composables/useScreenshotsContext'
import { HistoryItemType } from '../../types'
import ScreenshotsButton from '../ScreenshotsButton.vue'

const store = useStore()
const history = computed(() => getValue(store.history))

const disabled = computed(() => history.value.index === -1)

const handleClick = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyDispatcher = (store as any).dispatcher?.setHistory
  if (!historyDispatcher) return

  const { index, stack } = history.value
  const item = stack[index]

  if (item) {
    if (item.type === HistoryItemType.Source) {
      item.isSelected = false
    } else if (item.type === HistoryItemType.Edit) {
      item.source.editHistory.pop()
    }
  }

  historyDispatcher({
    index: index <= 0 ? -1 : index - 1,
    stack
  })
}
</script>
