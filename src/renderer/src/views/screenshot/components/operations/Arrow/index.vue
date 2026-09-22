<template>
  <ScreenshotsButton
    :title="lang.operation_arrow_title"
    icon="icon-arrow"
    :checked="checked"
    @click="handleSelectArrow"
  >
    <template #option>
      <ScreenshotsSizeColor
        :size="size"
        :color="color"
        @size-change="setSize"
        @color-change="setColor"
      />
    </template>
  </ScreenshotsButton>
</template>

<script lang="ts">
export interface ArrowData {
  size: number
  color: string
  x1: number
  x2: number
  y1: number
  y2: number
}

export enum ArrowEditType {
  Move,
  MoveStart,
  MoveEnd
}

export interface ArrowEditData {
  type: ArrowEditType
  x1: number
  x2: number
  y1: number
  y2: number
}
</script>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from '../../../composables/useScreenshotsContext'
import { useHistory } from '../../../composables/useHistory'
import { useOperation } from '../../../composables/useOperation'
import { useCursor } from '../../../composables/useCursor'
import { useCanvasContextRef } from '../../../composables/useCanvasContextRef'
import useCanvasMousedown from '../../../composables/useCanvasMousedown'
import useCanvasMousemove from '../../../composables/useCanvasMousemove'
import useCanvasMouseup from '../../../composables/useCanvasMouseup'
import useDrawSelect from '../../../composables/useDrawSelect'
import { HistoryItemType } from '../../../types'
import { isHit, isHitCircle } from '../../../utils/drawUtils'
import ScreenshotsButton from '../../ScreenshotsButton.vue'
import ScreenshotsSizeColor from '../../ScreenshotsSizeColor.vue'
import draw, { getEditedArrowData } from './draw'

const store = useStore()
const lang = computed(() => store.lang)
const [, cursorDispatcher] = useCursor()
const [operation, operationDispatcher] = useOperation()
const [history, historyDispatcher] = useHistory()
const canvasContextRef = useCanvasContextRef()

const size = ref(3)
const color = ref('#ee5126')
const arrowRef = ref<
  | import('../../../types').HistoryItemSource<
      import('./index.vue').ArrowData,
      import('./index.vue').ArrowEditData
    >
  | null
>(null)
const arrowEditRef = ref<
  | import('../../../types').HistoryItemEdit<
      import('./index.vue').ArrowEditData,
      import('./index.vue').ArrowData
    >
  | null
>(null)

const setSize = (newSize: number): void => {
  size.value = newSize
}

const setColor = (newColor: string): void => {
  color.value = newColor
}

const checked = computed(() => operation === 'Arrow')

const selectArrow = (): void => {
  operationDispatcher.set('Arrow')
  cursorDispatcher.set('default')
}

const handleSelectArrow = (): void => {
  if (checked.value) {
    return
  }
  selectArrow()
  historyDispatcher.clearSelect()
}

const onDrawSelect = (
  action: import('../../../types').HistoryItemSource<unknown, unknown>,
  e: MouseEvent
): void => {
  if (action.name !== 'Arrow' || !canvasContextRef.value) {
    return
  }

  const source = action as import('../../../types').HistoryItemSource<
    import('./index.vue').ArrowData,
    import('./index.vue').ArrowEditData
  >
  selectArrow()

  const { x1, y1, x2, y2 } = getEditedArrowData(source)
  let type: import('./index.vue').ArrowEditType = 0 // Move
  if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x1,
      y: y1
    })
  ) {
    type = 1 // MoveStart
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x2,
      y: y2
    })
  ) {
    type = 2 // MoveEnd
  }

  arrowEditRef.value = {
    type: HistoryItemType.Edit,
    data: {
      type,
      x1: e.clientX,
      y1: e.clientY,
      x2: e.clientX,
      y2: e.clientY
    },
    source
  }

  historyDispatcher.select(action)
}

const onMousedown = (e: MouseEvent): void => {
  if (!checked.value || arrowRef.value || !canvasContextRef.value) {
    return
  }

  const { left, top } = canvasContextRef.value.canvas!.getBoundingClientRect()
  arrowRef.value = {
    name: 'Arrow',
    type: HistoryItemType.Source,
    data: {
      size: size.value,
      color: color.value,
      x1: e.clientX - left,
      y1: e.clientY - top,
      x2: e.clientX - left,
      y2: e.clientY - top
    },
    editHistory: [],
    draw,
    isHit
  }
}

const onMousemove = (e: MouseEvent): void => {
  if (!checked.value || !canvasContextRef.value) {
    return
  }
  if (arrowEditRef.value) {
    arrowEditRef.value.data.x2 = e.clientX
    arrowEditRef.value.data.y2 = e.clientY
    if (history.top !== arrowEditRef.value) {
      arrowEditRef.value.source.editHistory.push(arrowEditRef.value)
      historyDispatcher.push(arrowEditRef.value)
    } else {
      historyDispatcher.set(history)
    }
  } else if (arrowRef.value) {
    const { left, top } = canvasContextRef.value.canvas!.getBoundingClientRect()

    arrowRef.value.data.x2 = e.clientX - left
    arrowRef.value.data.y2 = e.clientY - top

    if (history.top !== arrowRef.value) {
      historyDispatcher.push(arrowRef.value)
    } else {
      historyDispatcher.set(history)
    }
  }
}

const onMouseup = (): void => {
  if (!checked.value) {
    return
  }

  if (arrowRef.value) {
    historyDispatcher.clearSelect()
  }

  arrowRef.value = null
  arrowEditRef.value = null
}

useDrawSelect(onDrawSelect)
useCanvasMousedown(onMousedown)
useCanvasMousemove(onMousemove)
useCanvasMouseup(onMouseup)
</script>
