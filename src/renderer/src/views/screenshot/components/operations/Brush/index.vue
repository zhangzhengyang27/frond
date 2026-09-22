<template>
  <ScreenshotsButton
    :title="lang.operation_brush_title"
    icon="icon-brush"
    :checked="checked"
    @click="handleSelectBrush"
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
import { HistoryItemType, Point } from '../../../types'
import { isHit } from '../../../utils/drawUtils'
import ScreenshotsButton from '../../ScreenshotsButton.vue'
import ScreenshotsSizeColor from '../../ScreenshotsSizeColor.vue'
import draw from './draw'

export interface BrushData {
  size: number
  color: string
  points: Point[]
}

export interface BrushEditData {
  x1: number
  y1: number
  x2: number
  y2: number
}

const store = useStore()
const lang = computed(() => store.lang)
const [, cursorDispatcher] = useCursor()
const [operation, operationDispatcher] = useOperation()
const canvasContextRef = useCanvasContextRef()
const [history, historyDispatcher] = useHistory()

const size = ref(3)
const color = ref('#ee5126')
const brushRef = ref<import('../../../types').HistoryItemSource<BrushData, BrushEditData> | null>(
  null
)
const brushEditRef = ref<import('../../../types').HistoryItemEdit<BrushEditData, BrushData> | null>(
  null
)

const checked = computed(() => operation === 'Brush')

const selectBrush = (): void => {
  operationDispatcher.set('Brush')
  cursorDispatcher.set('default')
}

const handleSelectBrush = (): void => {
  if (checked.value) {
    return
  }
  selectBrush()
  historyDispatcher.clearSelect()
}

const setSize = (value: number): void => {
  size.value = value
}

const setColor = (value: string): void => {
  color.value = value
}

const onDrawSelect = (
  action: import('../../../types').HistoryItemSource<unknown, unknown>,
  e: MouseEvent
): void => {
  if (action.name !== 'Brush') {
    return
  }

  selectBrush()

  brushEditRef.value = {
    type: HistoryItemType.Edit,
    data: {
      x1: e.clientX,
      y1: e.clientY,
      x2: e.clientX,
      y2: e.clientY
    },
    source: action as import('../../../types').HistoryItemSource<BrushData, BrushEditData>
  }

  historyDispatcher.select(action)
}

const onMousedown = (e: MouseEvent): void => {
  if (!checked.value || brushRef.value || !canvasContextRef.value) {
    return
  }

  const { left, top } = canvasContextRef.value.canvas!.getBoundingClientRect()

  brushRef.value = {
    name: 'Brush',
    type: HistoryItemType.Source,
    data: {
      size: size.value,
      color: color.value,
      points: [
        {
          x: e.clientX - left,
          y: e.clientY - top
        }
      ]
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

  if (brushEditRef.value) {
    brushEditRef.value.data.x2 = e.clientX
    brushEditRef.value.data.y2 = e.clientY
    if (history.top !== brushEditRef.value) {
      brushEditRef.value.source.editHistory.push(brushEditRef.value)
      historyDispatcher.push(brushEditRef.value)
    } else {
      historyDispatcher.set(history)
    }
  } else if (brushRef.value) {
    const { left, top } = canvasContextRef.value.canvas!.getBoundingClientRect()

    brushRef.value.data.points.push({
      x: e.clientX - left,
      y: e.clientY - top
    })

    if (history.top !== brushRef.value) {
      historyDispatcher.push(brushRef.value)
    } else {
      historyDispatcher.set(history)
    }
  }
}

const onMouseup = (): void => {
  if (!checked.value) {
    return
  }

  if (brushRef.value) {
    historyDispatcher.clearSelect()
  }

  brushRef.value = null
  brushEditRef.value = null
}

useDrawSelect(onDrawSelect)
useCanvasMousedown(onMousedown)
useCanvasMousemove(onMousemove)
useCanvasMouseup(onMouseup)
</script>
