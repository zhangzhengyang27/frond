<template>
  <div>
    <ScreenshotsButton
      :title="lang.operation_text_title"
      icon="icon-text"
      :checked="checked"
      @click="handleSelectText"
    >
      <template #option>
        <ScreenshotsSizeColor
          :size="size"
          :color="color"
          @size-change="handleSizeChange"
          @color-change="handleColorChange"
        />
      </template>
    </ScreenshotsButton>
    <ScreenshotsTextarea
      v-if="checked && textareaBounds"
      :x="textareaBounds.x"
      :y="textareaBounds.y"
      :max-width="textareaBounds.maxWidth"
      :max-height="textareaBounds.maxHeight"
      :size="sizes[size]"
      :color="color"
      :value="text"
      @change="handleTextareaChange"
      @blur="handleTextareaBlur"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore, getValue } from '../../../composables/useScreenshotsContext'
import { useHistory } from '../../../composables/useHistory'
import { useOperation } from '../../../composables/useOperation'
import { useCursor } from '../../../composables/useCursor'
import { useCanvasContextRef } from '../../../composables/useCanvasContextRef'
import useCanvasMousedown from '../../../composables/useCanvasMousedown'
import useCanvasMousemove from '../../../composables/useCanvasMousemove'
import useCanvasMouseup from '../../../composables/useCanvasMouseup'
import useDrawSelect from '../../../composables/useDrawSelect'
import { HistoryItemType } from '../../../types'
import ScreenshotsButton from '../../ScreenshotsButton.vue'
import ScreenshotsSizeColor from '../../ScreenshotsSizeColor.vue'
import ScreenshotsTextarea from '../../ScreenshotsTextarea/index.vue'
import { draw, isHit } from './draw'

export interface TextData {
  size: number
  color: string
  fontFamily: string
  x: number
  y: number
  text: string
}

export interface TextEditData {
  x1: number
  x2: number
  y1: number
  y2: number
}

export interface TextareaBounds {
  x: number
  y: number
  maxWidth: number
  maxHeight: number
}

const sizes: Record<number, number> = {
  3: 18,
  6: 32,
  9: 46
}

const store = useStore()
const lang = computed(() => store.lang)
const [history, historyDispatcher] = useHistory()
const bounds = computed(() => getValue(store.bounds))
const [operation, operationDispatcher] = useOperation()
const [, cursorDispatcher] = useCursor()
const canvasContextRef = useCanvasContextRef()

const size = ref(3)
const color = ref('#ee5126')
const textRef = ref<import('../../../types').HistoryItemSource<TextData, TextEditData> | null>(null)
const textEditRef = ref<import('../../../types').HistoryItemEdit<TextEditData, TextData> | null>(
  null
)
const textareaBounds = ref<TextareaBounds | null>(null)
const text = ref<string>('')

const checked = computed(() => operation === 'Text')

const selectText = () => {
  operationDispatcher.set('Text')
  cursorDispatcher.set('default')
}

const handleSelectText = () => {
  if (checked.value) {
    return
  }
  selectText()
  historyDispatcher.clearSelect()
}

const handleSizeChange = (newSize: number) => {
  if (textRef.value) {
    textRef.value.data.size = sizes[newSize]
  }
  size.value = newSize
}

const handleColorChange = (newColor: string) => {
  if (textRef.value) {
    textRef.value.data.color = newColor
  }
  color.value = newColor
}

const handleTextareaChange = (value: string) => {
  text.value = value
  if (checked.value && textRef.value) {
    textRef.value.data.text = value
  }
}

const handleTextareaBlur = () => {
  if (textRef.value && textRef.value.data.text) {
    historyDispatcher.push(textRef.value)
  }
  textRef.value = null
  text.value = ''
  textareaBounds.value = null
}

const onDrawSelect = (
  action: import('../../../types').HistoryItemSource<unknown, unknown>,
  e: MouseEvent
) => {
  if (action.name !== 'Text') {
    return
  }

  selectText()

  textEditRef.value = {
    type: HistoryItemType.Edit,
    data: {
      x1: e.clientX,
      y1: e.clientY,
      x2: e.clientX,
      y2: e.clientY
    },
    source: action as import('../../../types').HistoryItemSource<TextData, TextEditData>
  }

  historyDispatcher.select(action)
}

const onMousedown = (e: MouseEvent) => {
  if (!checked.value || !canvasContextRef.value || textRef.value || !bounds.value) {
    return
  }
  const { left, top } = canvasContextRef.value.canvas!.getBoundingClientRect()
  const fontFamily = window.getComputedStyle(canvasContextRef.value.canvas!).fontFamily
  const x = e.clientX - left
  const y = e.clientY - top

  textRef.value = {
    name: 'Text',
    type: HistoryItemType.Source,
    data: {
      size: sizes[size.value],
      color: color.value,
      fontFamily,
      x,
      y,
      text: ''
    },
    editHistory: [],
    draw,
    isHit
  }

  textareaBounds.value = {
    x: e.clientX,
    y: e.clientY,
    maxWidth: bounds.value.width - x,
    maxHeight: bounds.value.height - y
  }
}

const onMousemove = (e: MouseEvent): void => {
  if (!checked.value) {
    return
  }

  if (textEditRef.value) {
    textEditRef.value.data.x2 = e.clientX
    textEditRef.value.data.y2 = e.clientY
    if (history.top !== textEditRef.value) {
      textEditRef.value.source.editHistory.push(textEditRef.value)
      historyDispatcher.push(textEditRef.value)
    } else {
      historyDispatcher.set(history)
    }
  }
}

const onMouseup = (): void => {
  if (!checked.value) {
    return
  }

  textEditRef.value = null
}

useDrawSelect(onDrawSelect)
useCanvasMousedown(onMousedown)
useCanvasMousemove(onMousemove)
useCanvasMouseup(onMouseup)
</script>
