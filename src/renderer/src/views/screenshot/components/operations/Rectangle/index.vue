<template>
  <ScreenshotsButton
    :title="lang.operation_rectangle_title"
    icon="icon-rectangle"
    :checked="checked"
    @click="handleSelectRectangle"
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
export interface RectangleData {
  size: number
  color: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export enum RectangleEditType {
  Move,
  ResizeTop,
  ResizeRightTop,
  ResizeRight,
  ResizeRightBottom,
  ResizeBottom,
  ResizeLeftBottom,
  ResizeLeft,
  ResizeLeftTop
}

export interface RectangleEditData {
  type: RectangleEditType
  x1: number
  y1: number
  x2: number
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
import draw, { getEditedRectangleData } from './draw'

const store = useStore()
const lang = computed(() => store.lang)
const [history, historyDispatcher] = useHistory()
const [operation, operationDispatcher] = useOperation()
const [, cursorDispatcher] = useCursor()
const canvasContextRef = useCanvasContextRef()

const size = ref(3)
const color = ref('#ee5126')
const rectangleRef = ref<
  import('../../../types').HistoryItemSource<RectangleData, RectangleEditData> | null
>(null)
const rectangleEditRef = ref<
  import('../../../types').HistoryItemEdit<RectangleEditData, RectangleData> | null
>(null)

const setSize = (newSize: number) => {
  size.value = newSize
}

const setColor = (newColor: string) => {
  color.value = newColor
}

const checked = computed(() => operation === 'Rectangle')

const selectRectangle = () => {
  operationDispatcher.set('Rectangle')
  cursorDispatcher.set('crosshair')
}

const handleSelectRectangle = () => {
  if (checked.value) {
    return
  }
  selectRectangle()
  historyDispatcher.clearSelect()
}

const onDrawSelect = (
  action: import('../../../types').HistoryItemSource<unknown, unknown>,
  e: MouseEvent
) => {
  if (action.name !== 'Rectangle' || !canvasContextRef.value) {
    return
  }

  const source = action as import('../../../types').HistoryItemSource<
    RectangleData,
    RectangleEditData
  >
  selectRectangle()

  const { x1, y1, x2, y2 } = getEditedRectangleData(source)

  let type = RectangleEditType.Move
  if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: (x1 + x2) / 2,
      y: y1
    })
  ) {
    type = RectangleEditType.ResizeTop
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x2,
      y: y1
    })
  ) {
    type = RectangleEditType.ResizeRightTop
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x2,
      y: (y1 + y2) / 2
    })
  ) {
    type = RectangleEditType.ResizeRight
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x2,
      y: y2
    })
  ) {
    type = RectangleEditType.ResizeRightBottom
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: (x1 + x2) / 2,
      y: y2
    })
  ) {
    type = RectangleEditType.ResizeBottom
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x1,
      y: y2
    })
  ) {
    type = RectangleEditType.ResizeLeftBottom
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x1,
      y: (y1 + y2) / 2
    })
  ) {
    type = RectangleEditType.ResizeLeft
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x1,
      y: y1
    })
  ) {
    type = RectangleEditType.ResizeLeftTop
  }

  rectangleEditRef.value = {
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

const onMousedown = (e: MouseEvent) => {
  if (!checked.value || !canvasContextRef.value || rectangleRef.value) {
    return
  }

  const { left, top } = canvasContextRef.value.canvas!.getBoundingClientRect()
  const x = e.clientX - left
  const y = e.clientY - top
  rectangleRef.value = {
    name: 'Rectangle',
    type: HistoryItemType.Source,
    data: {
      size: size.value,
      color: color.value,
      x1: x,
      y1: y,
      x2: x,
      y2: y
    },
    editHistory: [],
    draw,
    isHit
  }
}

const onMousemove = (e: MouseEvent) => {
  if (!checked.value || !canvasContextRef.value) {
    return
  }

  if (rectangleEditRef.value) {
    rectangleEditRef.value.data.x2 = e.clientX
    rectangleEditRef.value.data.y2 = e.clientY
    if (history.top !== rectangleEditRef.value) {
      rectangleEditRef.value.source.editHistory.push(rectangleEditRef.value)
      historyDispatcher.push(rectangleEditRef.value)
    } else {
      historyDispatcher.set(history)
    }
  } else if (rectangleRef.value) {
    const { left, top } = canvasContextRef.value.canvas!.getBoundingClientRect()
    const rectangleData = rectangleRef.value.data
    rectangleData.x2 = e.clientX - left
    rectangleData.y2 = e.clientY - top

    if (history.top !== rectangleRef.value) {
      historyDispatcher.push(rectangleRef.value)
    } else {
      historyDispatcher.set(history)
    }
  }
}

const onMouseup = () => {
  if (!checked.value) {
    return
  }

  if (rectangleRef.value) {
    historyDispatcher.clearSelect()
  }

  rectangleRef.value = null
  rectangleEditRef.value = null
}

useDrawSelect(onDrawSelect)
useCanvasMousedown(onMousedown)
useCanvasMousemove(onMousemove)
useCanvasMouseup(onMouseup)
</script>
