<template>
  <div
    v-if="bounds"
    ref="elRef"
    class="screenshots-operations"
    :style="{
      visibility: position ? 'visible' : 'hidden',
      transform: `translate(${position?.x ?? 0}px, ${position?.y ?? 0}px)`
    }"
    @dblclick.stop
    @contextmenu.prevent.stop
  >
    <div class="screenshots-operations-buttons">
      <Rectangle />
      <Ellipse />
      <Arrow />
      <Brush />
      <Text />
      <Mosaic />
      <div class="screenshots-operations-divider" />
      <Ocr @ocr="handleOcr" />
      <Pin @pin="handlePin" />
      <Ok @ok="handleOk" />
      <Cancel @cancel="handleCancel" />
      <Save @save="handleSave" />
      <div class="screenshots-operations-divider" />
      <Undo />
      <Redo />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, provide } from 'vue'
import type { Bounds, Position } from '../types'
import { useStore, getValue } from '../composables/useScreenshotsContext'
import Ok from './operations/Ok.vue'
import Cancel from './operations/Cancel.vue'
import Save from './operations/Save.vue'
import Undo from './operations/Undo.vue'
import Redo from './operations/Redo.vue'
import Rectangle from './operations/Rectangle/index.vue'
import Ellipse from './operations/Ellipse/index.vue'
import Arrow from './operations/Arrow/index.vue'
import Brush from './operations/Brush/index.vue'
import Text from './operations/Text/index.vue'
import Mosaic from './operations/Mosaic/index.vue'
import Pin from './operations/Pin.vue'
import Ocr from './operations/Ocr.vue'

const store = useStore()
const width = computed(() => store.width)
const height = computed(() => store.height)
const bounds = computed(() => getValue(store.bounds))
const elRef = ref<HTMLDivElement | null>(null)
const position = ref<Position | null>(null)
const operationsRect = ref<Bounds | null>(null)

// 提供 operationsRect 给子组件使用
provide('ScreenshotsOperationsRect', operationsRect)

const emit = defineEmits<{
  ok: [blob: Blob | null, bounds: Bounds]
  cancel: []
  save: [blob: Blob | null, bounds: Bounds]
  pin: [blob: Blob | null, bounds: Bounds]
  ocr: [blob: Blob | null, bounds: Bounds]
}>()

const handleOk = (blob: Blob | null, bounds: Bounds): void => {
  emit('ok', blob, bounds)
}

const handleCancel = (): void => {
  emit('cancel')
}

const handleSave = (blob: Blob | null, bounds: Bounds): void => {
  emit('save', blob, bounds)
}
