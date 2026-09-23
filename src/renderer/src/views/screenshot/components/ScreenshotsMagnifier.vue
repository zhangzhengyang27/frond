<template>
  <div
    ref="elRef"
    class="screenshots-magnifier"
    :style="{
      transform: `translate(${position?.x ?? 0}px, ${position?.y ?? 0}px)`
    }"
  >
    <div class="screenshots-magnifier-body">
      <canvas
        ref="canvasRef"
        class="screenshots-magnifier-body-canvas"
        :width="magnifierWidth"
        :height="magnifierHeight"
      />
    </div>
    <div class="screenshots-magnifier-footer">
      <div class="screenshots-magnifier-footer-item">
        {{ lang.magnifier_position_label }}: ({{ props.x }},{{ props.y }})
      </div>
      <div
        class="screenshots-magnifier-footer-item rgb-value"
        :class="{ copied: justCopied }"
        title="点击复制"
        @click.stop="copyRgb"
      >
        {{ justCopied ? '✓ 已复制' : `RGB: #${rgb}` }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import type { Position } from '../types'
import { useStore, getValue } from '../composables/useScreenshotsContext'

const props = defineProps<{
  x: number
  y: number
}>()

const store = useStore()
const width = computed(() => store.width)
const height = computed(() => store.height)
const image = computed(() => getValue(store.image))
const lang = computed(() => store.lang)
const magnifierWidth = 100
const magnifierHeight = 80
const elRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ctxRef = ref<CanvasRenderingContext2D | null>(null)
const position = ref<Position | null>(null)
const rgb = ref('000000')
const justCopied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

const copyRgb = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(`#${rgb.value}`)
    justCopied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      justCopied.value = false
    }, 1200)
  } catch (err) {
    console.error('[Magnifier] Copy RGB failed:', err)
  }
}

watch(
  () => [props.x, props.y, width.value, height.value],
  () => {
    if (!elRef.value) {
      return
    }
    const elRect = elRef.value.getBoundingClientRect()
    let tx = props.x + 20
    let ty = props.y + 20
    if (tx + elRect.width > width.value) {
      tx = props.x - elRect.width - 20
    }
    if (ty + elRect.height > height.value) {
      ty = props.y - elRect.height - 20
    }

    if (tx < 0) {
      tx = 0
    }
    if (ty < 0) {
      ty = 0
    }
    position.value = {
      x: tx,
      y: ty
    }
  },
  { immediate: true }
)

// Bug#8: 使用 rAF 节流高频 watch，避免每帧都执行 drawImage + getImageData
let rafId: number | null = null

watch(
  () => [image.value, props.x, props.y, width.value, height.value],
  () => {
    // 取消上一帧
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }

    rafId = requestAnimationFrame(() => {
      rafId = null

      if (!image.value || !canvasRef.value) {
        ctxRef.value = null
        return
      }

      if (!ctxRef.value) {
        ctxRef.value = canvasRef.value.getContext('2d')
      }
      if (!ctxRef.value) {
        return
      }

      const ctx = ctxRef.value
      ctx.clearRect(0, 0, magnifierWidth, magnifierHeight)
      const rx = image.value.naturalWidth / width.value
      const ry = image.value.naturalHeight / height.value
      ctx.drawImage(
        image.value,
        props.x * rx - magnifierWidth / 2,
        props.y * ry - magnifierHeight / 2,
        magnifierWidth,
        magnifierHeight,
        0,
        0,
        magnifierWidth,
        magnifierHeight
      )
      const { data } = ctx.getImageData(
        Math.floor(magnifierWidth / 2),
        Math.floor(magnifierHeight / 2),
        1,
        1
      )
      const hex = Array.from(data.slice(0, 3))
        .map((val) => (val >= 16 ? val.toString(16) : `0${val.toString(16)}`))
        .join('')
        .toUpperCase()

      rgb.value = hex
    })
  },
  { immediate: true }
)

// Bug#8 + New-4: 组件卸载时取消 pending 的 rAF，防止内存泄漏和无效回调执行
onUnmounted(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (copyTimer) {
    clearTimeout(copyTimer)
    copyTimer = null
  }
})
</script>

<style scoped>
.screenshots-magnifier {
  position: absolute;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans',
    sans-serif;
  left: 0;
  top: 0;
  width: 100px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--shot-hairline);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
  z-index: 9;
}

.screenshots-magnifier,
.screenshots-magnifier * {
  box-sizing: border-box;
  user-select: none;
}

.screenshots-magnifier-body {
  position: relative;
  background-color: var(--shot-panel);
}

.screenshots-magnifier-body::before {
  content: '';
  background-color: rgba(74, 163, 255, 0.9);
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  z-index: 1;
}

.screenshots-magnifier-body::after {
  content: '';
  background-color: rgba(74, 163, 255, 0.9);
  position: absolute;
  top: 0;
  left: 50%;
  width: 1px;
  height: 100%;
  z-index: 1;
}

.screenshots-magnifier-body-canvas {
  display: block;
  width: 100px;
  height: 80px;
}

.screenshots-magnifier-footer {
  height: 42px;
  color: var(--shot-text);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  background: var(--shot-glass-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--shot-hairline);
  padding: 3px 4px;
  white-space: nowrap;
  overflow: hidden;
  text-align: center;
}

.screenshots-magnifier-footer-item {
  height: 18px;
  line-height: 18px;
}

.rgb-value {
  cursor: pointer;
  border-radius: 3px;
  padding: 0 3px;
  transition: background-color 0.2s;
}

.rgb-value:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.rgb-value.copied {
  color: #4caf50;
}
</style>
