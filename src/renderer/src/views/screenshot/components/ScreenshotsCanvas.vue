<template>
  <div
    v-if="bounds"
    class="screenshots-canvas"
    :style="{
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      transform: `translate(${bounds.x}px, ${bounds.y}px)`
    }"
  >
    <div class="screenshots-canvas-body">
      <img
        class="screenshots-canvas-image"
        :src="url"
        :style="{
          width: `${width}px`,
          height: `${height}px`,
          transform: bounds ? `translate(${-bounds.x}px, ${-bounds.y}px)` : 'none'
        }"
      />
      <canvas
        ref="canvasRef"
        class="screenshots-canvas-panel"
        :width="bounds.width"
        :height="bounds.height"
      />
    </div>
    <div
      class="screenshots-canvas-mask"
      :style="{ cursor: cursor || 'move' }"
      @mousedown="(e) => handleMouseDown(e, 'move')"
    />
    <!-- 尺寸徽章：选区上方空间足够时悬浮在选区外上方，否则贴选区内侧底部 -->
    <div
      v-if="isCanResize"
      class="screenshots-canvas-size"
      :class="{ 'screenshots-canvas-size-above': sizeBadgeAbove }"
    >
      {{ bounds.width }} × {{ bounds.height }}
    </div>
    <div v-for="border in borders" :key="border" :class="`screenshots-canvas-border-${border}`" />
    <template v-if="isCanResize">
      <div
        v-for="resizePoint in resizePoints"
        :key="resizePoint"
        :class="`screenshots-canvas-point-${resizePoint}`"
        @mousedown="(e) => handleMouseDown(e, resizePoint)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useStore, getValue } from '../composables/useScreenshotsContext'
import { HistoryItemType, type Bounds } from '../types'
import { getBoundsByPointsForCanvas, getPoints } from '../utils/getBoundsByPoints'
import useEmiter from '../composables/useEmiter'
import isPointInDraw from '../utils/isPointInDraw'

const store = useStore()
const url = computed(() => store.url)
const image = computed(() => getValue(store.image))
const width = computed(() => store.width)
const height = computed(() => store.height)
const bounds = computed(() => getValue(store.bounds))
const history = computed(() => getValue(store.history))
const operation = computed(() => getValue(store.operation))
const cursor = computed(() => getValue(store.cursor))
const emiter = useEmiter()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const ctxRef = ref<CanvasRenderingContext2D | null>(null)

const borders = ['top', 'right', 'bottom', 'left']
const resizePoints = [
  'top',
  'top-right',
  'right',
  'right-bottom',
  'bottom',
  'bottom-left',
  'left',
  'left-top'
]

const isCanResize = computed(() => bounds.value && !history.value.stack.length && !operation.value)

/** 选区上方留出 ≥30px 时徽章悬浮在选区外上方，避免遮挡选区底部内容 */
const sizeBadgeAbove = computed(() => !!bounds.value && bounds.value.y >= 30)

const resizeOrMoveRef = ref<string>()
const pointRef = ref<{ x: number; y: number } | null>(null)
const boundsRef = ref<Bounds | null>(null)

const draw = () => {
  if (!bounds.value || !ctxRef.value) {
    return
  }

  const ctx = ctxRef.value
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'low'
  ctx.clearRect(0, 0, bounds.value.width, bounds.value.height)

  history.value.stack.slice(0, history.value.index + 1).forEach((item) => {
    if (item.type === HistoryItemType.Source) {
      item.draw(ctx, item)
    }
  })
}

const handleMouseDown = (e: MouseEvent, resizeOrMove: string) => {
  if (e.button !== 0 || !bounds.value) {
    return
  }
  if (!operation.value) {
    resizeOrMoveRef.value = resizeOrMove
    pointRef.value = {
      x: e.clientX,
      y: e.clientY
    }
    boundsRef.value = {
      x: bounds.value.x,
      y: bounds.value.y,
      width: bounds.value.width,
      height: bounds.value.height
    }
  } else {
    const draw = isPointInDraw(bounds.value, canvasRef.value, history.value, e)
    if (draw) {
      emiter.emit('drawselect', draw, e)
    } else {
      emiter.emit('mousedown', e)
    }
  }
}

const updateBounds = (e: MouseEvent): void => {
  if (!resizeOrMoveRef.value || !pointRef.value || !boundsRef.value || !bounds.value) {
    return
  }
  const points = getPoints(e, resizeOrMoveRef.value, pointRef.value, boundsRef.value)
  const dispatcher = useDispatcher()
  const boundsDispatcher = dispatcher.setBounds
  if (boundsDispatcher) {
    boundsDispatcher(
      getBoundsByPointsForCanvas(
        points[0],
        points[1],
        bounds.value,
        width.value,
        height.value,
        resizeOrMoveRef.value
      )
    )
  }
}

// Bug#7: 将事件监听器移到顶层，避免 onMounted 嵌套 onUnmounted 的反模式
let _onMouseMove: ((e: MouseEvent) => void) | null = null
let _onMouseUp: ((e: MouseEvent) => void) | null = null

onMounted(() => {
  _onMouseMove = (e: MouseEvent) => {
    if (!operation.value) {
      if (!resizeOrMoveRef.value || !pointRef.value || !boundsRef.value) {
        return
      }
      updateBounds(e)
    } else {
      emiter.emit('mousemove', e)
    }
  }

  _onMouseUp = (e: MouseEvent) => {
    if (!operation.value) {
      if (!resizeOrMoveRef.value || !pointRef.value || !boundsRef.value) {
        return
      }
      updateBounds(e)
      resizeOrMoveRef.value = undefined
      pointRef.value = null
      boundsRef.value = null
    } else {
      emiter.emit('mouseup', e)
    }
  }

  window.addEventListener('mousemove', _onMouseMove)
  window.addEventListener('mouseup', _onMouseUp)
})

onUnmounted(() => {
  if (_onMouseMove) {
    window.removeEventListener('mousemove', _onMouseMove)
    _onMouseMove = null
  }
  if (_onMouseUp) {
    window.removeEventListener('mouseup', _onMouseUp)
    _onMouseUp = null
  }
})

watch(
  () => [image.value, bounds.value, canvasRef.value, history.value],
  () => {
    if (!image.value || !bounds.value || !canvasRef.value) {
      ctxRef.value = null
      return
    }

    if (!ctxRef.value) {
      ctxRef.value = canvasRef.value.getContext('2d')
    }

    draw()
  },
  { immediate: true }
)

// 更新 store 中的 canvasContextRef
watch(
  ctxRef,
  (newVal) => {
    if (store.canvasContextRef) {
      store.canvasContextRef.value = newVal
    }
  },
  { immediate: true }
)

defineExpose({
  ctx: ctxRef
})
</script>

<style scoped>
.screenshots-canvas {
  position: absolute;
  left: 0;
  top: 0;
  will-change: width, height, transform;
}

.screenshots-canvas-body,
.screenshots-canvas-mask {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
}

.screenshots-canvas-image {
  display: block;
  border: none;
  outline: none;
  will-change: transform;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  -webkit-font-smoothing: antialiased;
}

.screenshots-canvas-panel {
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  will-change: width, height;
}

.screenshots-canvas-size {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: -30px;
  background: var(--shot-glass-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--shot-hairline);
  color: var(--shot-text);
  font-size: 12px;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;
}

.screenshots-canvas-size-above {
  bottom: auto;
  top: 0;
  margin-top: -30px;
  margin-bottom: 0;
}

.screenshots-canvas-border-top {
  box-shadow: 0 0 8px rgba(74, 163, 255, 0.45);
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 2px;
  transform: translateY(-50%);
  background-color: var(--shot-accent);
  pointer-events: none;
}

.screenshots-canvas-border-right {
  box-shadow: 0 0 8px rgba(74, 163, 255, 0.45);
  position: absolute;
  left: 100%;
  top: 0;
  width: 2px;
  height: 100%;
  transform: translateX(-50%);
  background-color: var(--shot-accent);
  pointer-events: none;
}

.screenshots-canvas-border-bottom {
  box-shadow: 0 0 8px rgba(74, 163, 255, 0.45);
  position: absolute;
  left: 0;
  top: 100%;
  width: 100%;
  height: 2px;
  transform: translateY(-50%);
  background-color: var(--shot-accent);
  pointer-events: none;
}

.screenshots-canvas-border-left {
  box-shadow: 0 0 8px rgba(74, 163, 255, 0.45);
  position: absolute;
  left: 0;
  top: 0;
  width: 2px;
  height: 100%;
  transform: translateX(-50%);
  background-color: var(--shot-accent);
  pointer-events: none;
}

.screenshots-canvas-point-top {
  width: 9px;
  height: 9px;
  position: absolute;
  left: 50%;
  top: 0;
  background-color: #ffffff;
  border: 1.5px solid var(--shot-accent);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s;
  transform: translate(-50%, -50%);
  cursor: ns-resize;
}

.screenshots-canvas-point-top-right {
  width: 9px;
  height: 9px;
  position: absolute;
  left: 100%;
  top: 0;
  background-color: #ffffff;
  border: 1.5px solid var(--shot-accent);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s;
  transform: translate(-50%, -50%);
  cursor: nesw-resize;
}

.screenshots-canvas-point-right {
  width: 9px;
  height: 9px;
  position: absolute;
  left: 100%;
  top: 50%;
  background-color: #ffffff;
  border: 1.5px solid var(--shot-accent);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s;
  transform: translate(-50%, -50%);
  cursor: ew-resize;
}

.screenshots-canvas-point-right-bottom {
  width: 9px;
  height: 9px;
  position: absolute;
  left: 100%;
  top: 100%;
  background-color: #ffffff;
  border: 1.5px solid var(--shot-accent);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s;
  transform: translate(-50%, -50%);
  cursor: nwse-resize;
}

.screenshots-canvas-point-bottom {
  width: 9px;
  height: 9px;
  position: absolute;
  left: 50%;
  top: 100%;
  background-color: #ffffff;
  border: 1.5px solid var(--shot-accent);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s;
  transform: translate(-50%, -50%);
  cursor: ns-resize;
}

.screenshots-canvas-point-bottom-left {
  width: 9px;
  height: 9px;
  position: absolute;
  left: 0;
  top: 100%;
  background-color: #ffffff;
  border: 1.5px solid var(--shot-accent);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s;
  transform: translate(-50%, -50%);
  cursor: nesw-resize;
}

.screenshots-canvas-point-left {
  width: 9px;
  height: 9px;
  position: absolute;
  left: 0;
  top: 50%;
  background-color: #ffffff;
  border: 1.5px solid var(--shot-accent);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s;
  transform: translate(-50%, -50%);
  cursor: ew-resize;
}

.screenshots-canvas-point-left-top {
  width: 9px;
  height: 9px;
  position: absolute;
  left: 0;
  top: 0;
  background-color: #ffffff;
  border: 1.5px solid var(--shot-accent);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s;
  transform: translate(-50%, -50%);
  cursor: nwse-resize;
}

.screenshots-canvas-point-top:hover,
.screenshots-canvas-point-top-right:hover,
.screenshots-canvas-point-right:hover,
.screenshots-canvas-point-right-bottom:hover,
.screenshots-canvas-point-bottom:hover,
.screenshots-canvas-point-bottom-left:hover,
.screenshots-canvas-point-left:hover,
.screenshots-canvas-point-left-top:hover {
  transform: translate(-50%, -50%) scale(1.3);
}
</style>

