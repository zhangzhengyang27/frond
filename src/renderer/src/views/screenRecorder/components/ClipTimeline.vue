<script setup lang="ts">
/**
 * ClipTimeline · 剪辑时间轨（纯轨道，不含视频元素）
 *
 * 2026-09-23 重建 + 收拢：原件只存 2 行，先按 ClipEditor 存留的事件契约重建过一版
 * （那时它自带一个 `<video>`，与 ClipEditor 自己那只重复）。现在把 ClipEditor 里
 * 那套更强的内联轨道逻辑（单击跳转 / 按住拖框新增 / 播放头 / 选中环）搬进本件，
 * 使剪辑页只有一份时间轴实现。
 *
 * 视频元素留在 ClipEditor：存留的原件脚本给它挂 timeupdate/play/pause 监听
 * （ClipEditor.vue:96-107），说明原件就是父件持有播放元素。
 *
 * `update` 由片段条左右边界把手拖出来 —— 对应存留但此前无人调用的
 * ClipEditor.handleClipUpdate（轴上改片段边界，不必开对话框）。
 */
import { computed, ref } from 'vue'
import type { Clip } from '@composables/useVideoClip'

interface Props {
  clips?: Clip[]
  selectedClipId?: string | null
  /** 视频总时长（秒）；<=0 时轨道不可交互（还没拿到 metadata） */
  duration: number
  /** 当前播放头位置（秒） */
  currentTime?: number
}

const props = withDefaults(defineProps<Props>(), {
  clips: () => [],
  selectedClipId: null,
  currentTime: 0
})

const emit = defineEmits<{
  seek: [time: number]
  'clip-select': [clip: Clip]
  'add-clip': [startTime: number, endTime: number]
  update: [clip: Clip]
}>()

const trackRef = ref<HTMLDivElement | null>(null)
const dragRange = ref<{ start: number; end: number } | null>(null)
/** 正在拖哪一片段的哪一侧 */
const resizeRef = ref<{ clip: Clip; edge: 'start' | 'end'; time: number } | null>(null)

/** 单击与拖框的分界：小于这个跨度按「跳转」处理，否则算「框选新增」 */
const CLICK_SLACK_SEC = 0.4

const toPercent = (seconds: number): number => {
  if (props.duration <= 0) return 0
  return (seconds / props.duration) * 100
}

const timeFromClientX = (clientX: number): number => {
  const el = trackRef.value
  if (!el || props.duration <= 0) return 0
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return 0
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  return ratio * props.duration
}

const clamp = (t: number): number => Math.min(props.duration, Math.max(0, t))

const onTrackPointerDown = (event: MouseEvent): void => {
  // 还没拿到 metadata 时整条轨道不可动：否则一次空拖会发出 seek(0)，把播放头跳到开头
  if (resizeRef.value || props.duration <= 0) return
  const time = timeFromClientX(event.clientX)
  dragRange.value = { start: time, end: time }
}

const onTrackPointerMove = (event: MouseEvent): void => {
  const time = timeFromClientX(event.clientX)
  if (resizeRef.value) {
    resizeRef.value = { ...resizeRef.value, time }
    return
  }
  if (!dragRange.value) return
  dragRange.value = { ...dragRange.value, end: time }
}

const onTrackPointerUp = (): void => {
  const resize = resizeRef.value
  if (resize) {
    resizeRef.value = null
    const { clip, edge, time } = resize
    const next =
      edge === 'start'
        ? { ...clip, startTime: Math.min(clamp(time), clip.endTime - 0.1) }
        : { ...clip, endTime: Math.max(clamp(time), clip.startTime + 0.1) }
    if (next.startTime !== clip.startTime || next.endTime !== clip.endTime) emit('update', next)
    return
  }

  const range = dragRange.value
  dragRange.value = null
  if (!range) return
  const start = Math.min(range.start, range.end)
  const end = Math.max(range.start, range.end)
  if (end - start < CLICK_SLACK_SEC) {
    emit('seek', start)
    return
  }
  emit('add-clip', start, end)
}

const onEdgePointerDown = (clip: Clip, edge: 'start' | 'end', event: MouseEvent): void => {
  event.stopPropagation()
  resizeRef.value = { clip, edge, time: timeFromClientX(event.clientX) }
}

const onBarClick = (clip: Clip): void => {
  emit('clip-select', clip)
}

/** 拖框或拖边界时的预览区间（边界拖动时显示在片段与光标之间） */
const preview = computed<{ left: number; width: number } | null>(() => {
  if (resizeRef.value) {
    const { clip, edge, time } = resizeRef.value
    const from = edge === 'start' ? clip.endTime : clip.startTime
    return {
      left: toPercent(Math.min(from, time)),
      width: Math.abs(toPercent(Math.max(from, time)) - toPercent(Math.min(from, time)))
    }
  }
  if (!dragRange.value) return null
  const start = Math.min(dragRange.value.start, dragRange.value.end)
  const end = Math.max(dragRange.value.start, dragRange.value.end)
  return { left: toPercent(start), width: Math.abs(toPercent(end) - toPercent(start)) }
})
</script>

<template>
  <div
    ref="trackRef"
    data-testid="clip-track"
    class="relative h-12 w-full cursor-pointer overflow-hidden rounded-lg bg-gray-100"
    @mousedown="onTrackPointerDown"
    @mousemove="onTrackPointerMove"
    @mouseup="onTrackPointerUp"
    @mouseleave="onTrackPointerUp"
  >
    <div
      v-for="clip in clips"
      :key="clip.id"
      :data-clip-id="clip.id"
      class="absolute bottom-0 top-0 rounded bg-brand-500/70"
      :class="{ 'ring-2 ring-brand-600': selectedClipId === clip.id }"
      :style="{
        left: `${toPercent(clip.startTime)}%`,
        width: `${Math.max(toPercent(clip.endTime - clip.startTime), 1)}%`
      }"
      @click.stop="onBarClick(clip)"
    >
      <span
        class="absolute bottom-0 left-0 top-0 w-1.5 cursor-ew-resize bg-white/40"
        data-testid="clip-edge-start"
        @mousedown="onEdgePointerDown(clip, 'start', $event)"
      />
      <span
        class="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize bg-white/40"
        data-testid="clip-edge-end"
        @mousedown="onEdgePointerDown(clip, 'end', $event)"
      />
    </div>
    <div
      v-if="preview"
      class="pointer-events-none absolute bottom-0 top-0 bg-brand-500/25"
      :style="{ left: `${preview.left}%`, width: `${preview.width}%` }"
    />
    <div
      class="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-red-500"
      :style="{ left: `${toPercent(currentTime)}%` }"
    />
  </div>
</template>
