<template>
  <ScreenshotsButton
    :title="lang.operation_ellipse_title"
    icon="icon-ellipse"
    :checked="checked"
    @click="handleSelectEllipse"
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
export interface EllipseData {
  size: number
  color: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export enum EllipseEditType {
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

export interface EllipseEditData {
  type: EllipseEditType
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
import draw, { getEditedEllipseData } from './draw'

const store = useStore()
const lang = computed(() => store.lang)
const [history, historyDispatcher] = useHistory()
const [operation, operationDispatcher] = useOperation()
const [, cursorDispatcher] = useCursor()
const canvasContextRef = useCanvasContextRef()

const size = ref(3)
const color = ref('#ee5126')
const ellipseRef = ref<
  import('../../../types').HistoryItemSource<EllipseData, EllipseEditData> | null
>(null)
const ellipseEditRef = ref<
  import('../../../types').HistoryItemEdit<EllipseEditData, EllipseData> | null
>(null)

const setSize = (newSize: number): void => {
  size.value = newSize
}

const setColor = (newColor: string): void => {
  color.value = newColor
}

const checked = computed(() => operation === 'Ellipse')

const selectEllipse = (): void => {
  operationDispatcher.set('Ellipse')
  cursorDispatcher.set('crosshair')
}

const handleSelectEllipse = (): void => {
  if (checked.value) {
    return
  }
  selectEllipse()
  historyDispatcher.clearSelect()
}

const onDrawSelect = (
  action: import('../../../types').HistoryItemSource<unknown, unknown>,
  e: MouseEvent
): void => {
  if (action.name !== 'Ellipse' || !canvasContextRef.value) {
    return
  }

  const source = action as import('../../../types').HistoryItemSource<EllipseData, EllipseEditData>
  selectEllipse()

  const { x1, y1, x2, y2 } = getEditedEllipseData(source)

  let type = EllipseEditType.Move
  if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: (x1 + x2) / 2,
      y: y1
    })
  ) {
    type = EllipseEditType.ResizeTop
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x2,
      y: y1
    })
  ) {
    type = EllipseEditType.ResizeRightTop
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x2,
      y: (y1 + y2) / 2
    })
  ) {
    type = EllipseEditType.ResizeRight
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x2,
      y: y2
    })
  ) {
    type = EllipseEditType.ResizeRightBottom
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: (x1 + x2) / 2,
      y: y2
    })
  ) {
    type = EllipseEditType.ResizeBottom
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x1,
      y: y2
    })
  ) {
    type = EllipseEditType.ResizeLeftBottom
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x1,
      y: (y1 + y2) / 2
    })
  ) {
    type = EllipseEditType.ResizeLeft
  } else if (
    isHitCircle(canvasContextRef.value.canvas, e, {
      x: x1,
      y: y1
    })
  ) {
    type = EllipseEditType.ResizeLeftTop
  }

  ellipseEditRef.value = {
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
  if (!checked.value || !canvasContextRef.value || ellipseRef.value) {
    return
  }

  const { left, top } = canvasContextRef.value.canvas!.getBoundingClientRect()
  const x = e.clientX - left
  const y = e.clientY - top
  ellipseRef.value = {
    name: 'Ellipse',
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

const onMousemove = (e: MouseEvent): void => {
  if (!checked.value || !canvasContextRef.value) {
    return
  }
  if (ellipseEditRef.value) {
    ellipseEditRef.value.data.x2 = e.clientX
    ellipseEditRef.value.data.y2 = e.clientY
    if (history.top !== ellipseEditRef.value) {
      ellipseEditRef.value.source.editHistory.push(ellipseEditRef.value)
      historyDispatcher.push(ellipseEditRef.value)
    } else {
      historyDispatcher.set(history)
    }
  } else if (ellipseRef.value) {
    const { left, top } = canvasContextRef.value.canvas!.getBoundingClientRect()
    ellipseRef.value.data.x2 = e.clientX - left
    ellipseRef.value.data.y2 = e.clientY - top

    if (history.top !== ellipseRef.value) {
      historyDispatcher.push(ellipseRef.value)
    } else {
      historyDispatcher.set(history)
    }
  }
}

const onMouseup = (): void => {
  if (!checked.value) {
    return
  }

  if (ellipseRef.value) {
    historyDispatcher.clearSelect()
  }

  ellipseRef.value = null
  ellipseEditRef.value = null
}

useDrawSelect(onDrawSelect)
useCanvasMousedown(onMousedown)
useCanvasMousemove(onMousemove)
useCanvasMouseup(onMouseup)
</script>
