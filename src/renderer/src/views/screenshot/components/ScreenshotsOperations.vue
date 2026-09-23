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

const handlePin = (): void => {
  emit('pin', null, bounds.value as Bounds)
}

const handleOcr = (): void => {
  emit('ocr', null, bounds.value as Bounds)
}

watch(
  () => [bounds.value, elRef.value],
  () => {
    if (!bounds.value || !elRef.value) {
      return
    }

    const elRect = elRef.value.getBoundingClientRect()

    let x = bounds.value.x + bounds.value.width - elRect.width
    let y = bounds.value.y + bounds.value.height + 10

    if (x < 0) {
      x = 0
    }

    if (x > width.value - elRect.width) {
      x = width.value - elRect.width
    }

    if (y > height.value - elRect.height) {
      y = height.value - elRect.height - 10
    }

    if (
      !position.value ||
      Math.abs(position.value.x - x) > 1 ||
      Math.abs(position.value.y - y) > 1
    ) {
      position.value = {
        x,
        y
      }
    }

    if (
      !operationsRect.value ||
      Math.abs(operationsRect.value.x - elRect.x) > 1 ||
      Math.abs(operationsRect.value.y - elRect.y) > 1 ||
      Math.abs(operationsRect.value.width - elRect.width) > 1 ||
      Math.abs(operationsRect.value.height - elRect.height) > 1
    ) {
      operationsRect.value = {
        x: elRect.x,
        y: elRect.y,
        width: elRect.width,
        height: elRect.height
      }
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.screenshots-operations {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
}

.screenshots-operations-buttons {
  display: flex;
  align-items: center;
  padding: 4px 6px;
  border-radius: 10px;
  border: 1px solid var(--shot-hairline);
  background: var(--shot-glass);
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  box-shadow: var(--shot-shadow);
  overflow: hidden;
  animation: shot-bar-in 0.18s ease-out;
}

@keyframes shot-bar-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.screenshots-operations-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.16);
  margin: 0 4px;
}
</style>
