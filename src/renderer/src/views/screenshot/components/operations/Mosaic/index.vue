<template>
  <ScreenshotsButton
    :title="lang.operation_mosaic_title"
    icon="icon-mosaic"
    :checked="checked"
    @click="handleSelectMosaic"
  >
    <template #option>
      <ScreenshotsSize :value="size" @change="setSize" />
    </template>
  </ScreenshotsButton>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStore, getValue } from '../../../composables/useScreenshotsContext'
import { useHistory } from '../../../composables/useHistory'
import { useOperation } from '../../../composables/useOperation'
import { useCursor } from '../../../composables/useCursor'
import { useCanvasContextRef } from '../../../composables/useCanvasContextRef'
import useCanvasMousedown from '../../../composables/useCanvasMousedown'
import useCanvasMousemove from '../../../composables/useCanvasMousemove'
import useCanvasMouseup from '../../../composables/useCanvasMouseup'
import { HistoryItemType } from '../../../types'
import ScreenshotsButton from '../../ScreenshotsButton.vue'
import ScreenshotsSize from '../../ScreenshotsSize.vue'
import draw from './draw'

export interface MosaicTile {
  x: number
  y: number
  color: number[]
}

export interface MosaicData {
  size: number
  tiles: MosaicTile[]
}

function getColor(x: number, y: number, imageData: ImageData): number[] {
  if (!imageData) {
    return [0, 0, 0, 0]
  }
  const { data, width } = imageData

  const index = y * width * 4 + x * 4

  return Array.from(data.slice(index, index + 4))
}

const store = useStore()
const lang = computed(() => store.lang)
const image = computed(() => getValue(store.image))
const width = computed(() => store.width)
const height = computed(() => store.height)
const [operation, operationDispatcher] = useOperation()
const canvasContextRef = useCanvasContextRef()
const [history, historyDispatcher] = useHistory()
const bounds = computed(() => getValue(store.bounds))
const [, cursorDispatcher] = useCursor()

const size = ref(3)
const imageDataRef = ref<ImageData | null>(null)
const mosaicRef = ref<import('../../../types').HistoryItemSource<MosaicData, null> | null>(null)

const checked = computed(() => operation === 'Mosaic')

const selectMosaic = (): void => {
  operationDispatcher.set('Mosaic')
  cursorDispatcher.set('crosshair')
}

const handleSelectMosaic = (): void => {
  if (checked.value) {
    return
  }
  selectMosaic()
  historyDispatcher.clearSelect()
}

const setSize = (value: number): void => {
  size.value = value
}

const onMousedown = (e: MouseEvent): void => {
  if (!checked.value || mosaicRef.value || !imageDataRef.value || !canvasContextRef.value) {
    return
  }

  const rect = canvasContextRef.value.canvas!.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const mosaicSize = size.value * 2
  mosaicRef.value = {
    name: 'Mosaic',
    type: HistoryItemType.Source,
    data: {
      size: mosaicSize,
      tiles: [
        {
          x,
          y,
          color: getColor(x, y, imageDataRef.value)
        }
      ]
    },
    editHistory: [],
    draw
  }
}

const onMousemove = (e: MouseEvent): void => {
  if (!checked.value || !mosaicRef.value || !canvasContextRef.value || !imageDataRef.value) {
    return
  }

  const rect = canvasContextRef.value.canvas!.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const mosaicSize = mosaicRef.value.data.size
  const mosaicTiles = mosaicRef.value.data.tiles

  let lastTile = mosaicTiles[mosaicTiles.length - 1]

  if (!lastTile) {
    mosaicTiles.push({
      x,
      y,
      color: getColor(x, y, imageDataRef.value)
    })
  } else {
    const dx = lastTile.x - x
    const dy = lastTile.y - y
    // 减小点的个数
    let length = Math.sqrt(dx ** 2 + dy ** 2)
    const sin = -dy / length
    const cos = -dx / length

    while (length > mosaicSize) {
      const cx = Math.floor(lastTile.x + mosaicSize * cos)
      const cy = Math.floor(lastTile.y + mosaicSize * sin)
      lastTile = {
        x: cx,
        y: cy,
        color: getColor(cx, cy, imageDataRef.value)
      }
      mosaicTiles.push(lastTile)
      length -= mosaicSize
    }

    // 最后一个位置补充一块
    if (length > mosaicSize / 2) {
      mosaicTiles.push({
        x,
        y,
        color: getColor(x, y, imageDataRef.value)
      })
    }
  }

  if (history.top !== mosaicRef.value) {
    historyDispatcher.push(mosaicRef.value)
  } else {
    historyDispatcher.set(history)
  }
}

const onMouseup = (): void => {
  if (!checked.value) {
    return
  }

  mosaicRef.value = null
}

watch(
  () => [bounds.value, image.value, checked.value],
  () => {
    if (!bounds.value || !image.value || !checked.value) {
      return
    }

    const $canvas = document.createElement('canvas')

    const canvasContext = $canvas.getContext('2d')

    if (!canvasContext) {
      return
    }

    $canvas.width = bounds.value.width
    $canvas.height = bounds.value.height

    const rx = image.value.naturalWidth / width.value
    const ry = image.value.naturalHeight / height.value

    canvasContext.drawImage(
      image.value,
      bounds.value.x * rx,
      bounds.value.y * ry,
      bounds.value.width * rx,
      bounds.value.height * ry,
      0,
      0,
      bounds.value.width,
      bounds.value.height
    )

    imageDataRef.value = canvasContext.getImageData(0, 0, bounds.value.width, bounds.value.height)
  },
  { immediate: true }
)

useCanvasMousedown(onMousedown)
useCanvasMousemove(onMousemove)
useCanvasMouseup(onMouseup)
</script>
