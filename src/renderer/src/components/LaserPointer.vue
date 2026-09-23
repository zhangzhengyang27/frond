<script setup lang="ts">
/**
 * LaserPointer · 演示模式激光笔
 * - 全屏覆盖画布，鼠标/触摸拖动即画出一条会自行淡出的红色笔迹
 * - isActive 由父组件（MarkdownPresentation）控制，关闭时清空笔迹
 * 2026-09-23 重建：原文件被截断，仅存脚本尾 70 行 + 模板前半，头部与样式为重建
 */
// 待核：笔迹寿命/线宽/颜色为重建值（原件常量区整体丢失）
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

interface Props {
  isActive: boolean
  /** 画布底部让出的高度（px），避开演示控制条 */
  offsetBottom?: number
}

const props = withDefaults(defineProps<Props>(), {
  offsetBottom: 0
})

interface Point {
  x: number
  y: number
  t: number
}

interface Stroke {
  points: Point[]
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)
const strokes = ref<Stroke[]>([])
let currentStroke: Stroke | null = null
let animationId: number | null = null

const LASER_COLOR = '#ff3b30'
const LASER_WIDTH = 6
/** 单条笔迹从画面上淡出消失所需时间（ms） */
const STROKE_LIFETIME = 900

function resizeCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(canvas.clientWidth * dpr)
  canvas.height = Math.round(canvas.clientHeight * dpr)
  const ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function clearStrokes(): void {
  strokes.value = []
  currentStroke = null
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
}

function pointFrom(source: { clientX: number; clientY: number }): Point {
  return { x: source.clientX, y: source.clientY, t: Date.now() }
}

function onMouseDown(event: MouseEvent): void {
  isDrawing.value = true
  currentStroke = { points: [pointFrom(event)] }
  strokes.value.push(currentStroke)
  if (animationId === null) animationId = requestAnimationFrame(renderLoop)
}

function onMouseMove(event: MouseEvent): void {
  if (!isDrawing.value || !currentStroke) return
  currentStroke.points.push(pointFrom(event))
}

function stopDrawing(): void {
  isDrawing.value = false
  currentStroke = null
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, alpha: number): void {
  const points = stroke.points
  if (points.length === 0) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = LASER_COLOR
  ctx.lineWidth = LASER_WIDTH
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = LASER_COLOR
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (const point of points) ctx.lineTo(point.x, point.y)
  ctx.stroke()
  ctx.restore()
}

function renderLoop(): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) {
    animationId = null
    return
  }
  const now = Date.now()
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  strokes.value = strokes.value.filter((stroke) => {
    const last = stroke.points[stroke.points.length - 1]
    const age = now - (last?.t ?? now)
    if (age > STROKE_LIFETIME && stroke !== currentStroke) return false
    drawStroke(ctx, stroke, Math.max(0, 1 - age / STROKE_LIFETIME))
    return true
  })
  if (strokes.value.length === 0) {
    animationId = null
    return
  }
  animationId = requestAnimationFrame(renderLoop)
}

function onMouseUp(): void {
  stopDrawing()
}

// 触摸事件处理（移动设备支持）
function onTouchStart(event: TouchEvent): void {
  event.preventDefault()
  const touch = event.touches[0]
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  onMouseDown(mouseEvent)
}

function onTouchMove(event: TouchEvent): void {
  event.preventDefault()
  const touch = event.touches[0]
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  onMouseMove(mouseEvent)
}

function onTouchEnd(event: TouchEvent): void {
  event.preventDefault()
  onMouseUp()
}

onMounted(() => {
  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})

// 当激光笔关闭时清除笔画，开启时调整画布大小
watch(
  () => props.isActive,
  (newValue) => {
    if (!newValue) {
      clearStrokes()
      isDrawing.value = false
      currentStroke = null
    } else {
      nextTick(() => {
        resizeCanvas()
      })
    }
  }
)
</script>

<template>
  <canvas
    v-if="isActive"
    v-show="isActive"
    ref="canvasRef"
    class="laser-pointer-canvas"
    :style="{ height: `calc(100vh - ${props.offsetBottom}px)` }"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @touchstart.prevent="onTouchStart"
    @touchmove.prevent="onTouchMove"
    @touchend.prevent="onTouchEnd"
  />
</template>

<style scoped>
.laser-pointer-canvas {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2000;
  width: 100vw;
  cursor: crosshair;
  touch-action: none;
}
</style>
