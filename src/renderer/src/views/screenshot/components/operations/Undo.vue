<template>
  <ScreenshotsButton title="撤销" icon="icon-undo" :disabled="disabled" @click="handleClick" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore, useDispatcher, getValue } from '../../composables/useScreenshotsContext'
import { HistoryItemType } from '../../types'
import ScreenshotsButton from '../ScreenshotsButton.vue'

const store = useStore()
const dispatcher = useDispatcher()
const history = computed(() => getValue(store.history))

const disabled = computed(() => history.value.index === -1)

const handleClick = (): void => {
  const { index, stack } = history.value
  const item = stack[index]

  if (item) {
    if (item.type === HistoryItemType.Source) {
      item.isSelected = false
    } else if (item.type === HistoryItemType.Edit) {
      item.source.editHistory.pop()
    }
  }

  dispatcher.setHistory?.({
    index: index <= 0 ? -1 : index - 1,
    stack
  })
}
</script>
