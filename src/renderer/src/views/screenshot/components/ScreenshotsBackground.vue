<template>
  <div v-if="url && image" ref="elRef" class="screenshots-background" @mousedown="handleMouseDown">
    <img class="screenshots-background-image" :src="url" />
    <div class="screenshots-background-mask" />
    <ScreenshotsMagnifier v-if="position && !bounds" :x="position.x" :y="position.y" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { Point, Position } from '../types'
import { useStore, useDispatcher, getValue } from '../composables/useScreenshotsContext'
import { getBoundsByPointsForBackground } from '../utils/getBoundsByPoints'
import { computed } from 'vue'
import ScreenshotsMagnifier from './ScreenshotsMagnifier.vue'

const store = useStore()
const url = computed(() => store.url)
const image = computed(() => getValue(store.image))
const width = computed(() => store.width)
const height = computed(() => store.height)
const bounds = computed(() => getValue(store.bounds))
const elRef = ref<HTMLDivElement | null>(null)
const pointRef = ref<Point | null>(null)
const isMoveRef = ref<boolean>(false)
const position = ref<Position | null>(null)

const updateBounds = (p1: Point, p2: Point): void => {
  if (!elRef.value) {
    return
  }
  const { x, y } = elRef.value.getBoundingClientRect()
  const dispatcher = useDispatcher()
  const boundsDispatcher = dispatcher.setBounds
  if (boundsDispatcher) {
    boundsDispatcher(
      getBoundsByPointsForBackground(
        {
          x: p1.x - x,
          y: p1.y - y
        },
        {
          x: p2.x - x,
          y: p2.y - y
        },
        width.value,
        height.value
      )
    )
  }
}

const handleMouseDown = (e: MouseEvent): void => {
  if (pointRef.value || bounds.value || e.button !== 0) {
    return
  }
  pointRef.value = {
    x: e.clientX,
    y: e.clientY
  }
  isMoveRef.value = false
}

// Bug#7: 将事件监听器移到顶层，避免 onMounted 嵌套 onUnmounted 的反模式
let onMouseMove: ((e: MouseEvent) => void) | null = null
let onMouseUp: ((e: MouseEvent) => void) | null = null

onMounted(() => {
  onMouseMove = (e: MouseEvent) => {
    if (elRef.value) {
      const rect = elRef.value.getBoundingClientRect()
      if (
        e.clientX < rect.left ||
        e.clientY < rect.top ||
        e.clientX > rect.right ||
        e.clientY > rect.bottom
      ) {
        position.value = null
      } else {
        position.value = {
          x: e.clientX - rect.x,
          y: e.clientY - rect.y
        }
      }
    }

    if (!pointRef.value) {
      return
    }
    updateBounds(pointRef.value, {
      x: e.clientX,
      y: e.clientY
    })
    isMoveRef.value = true
  }

  onMouseUp = (e: MouseEvent) => {
    if (!pointRef.value) {
      return
    }

    if (isMoveRef.value) {
      updateBounds(pointRef.value, {
        x: e.clientX,
        y: e.clientY
      })
    }
    pointRef.value = null
    isMoveRef.value = false
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  if (onMouseMove) {
    window.removeEventListener('mousemove', onMouseMove)
    onMouseMove = null
  }
  if (onMouseUp) {
    window.removeEventListener('mouseup', onMouseUp)
    onMouseUp = null
  }
})

watch(
  () => [image.value, bounds.value],
  () => {
    if (!image.value || bounds.value) {
      position.value = null
    }
  }
)
</script>

<style scoped>
.screenshots-background {
  width: 100%;
  height: 100%;
  position: relative;
}

.screenshots-background-image {
  width: 100%;
  height: 100%;
  display: block;
  border: none;
  outline: none;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  -webkit-font-smoothing: antialiased;
}

.screenshots-background-mask {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.35);
}
</style>

